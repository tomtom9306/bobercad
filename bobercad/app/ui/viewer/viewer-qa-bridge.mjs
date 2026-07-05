import { arrayValues, jsonClone, uniqueTruthy } from "../../engine/core/model.mjs";
import { averageVec3, bounds3, bounds3Corners, clamp, finiteNumberOr, screenDistance, validVec3Points, v } from "../../engine/core/math.mjs";
import { memberAuthoringPoints, memberAxisData, memberStationAtPoint } from "../../engine/api/project/members.mjs";
import { projectProfileCatalog } from "../../engine/api/project/profiles.mjs";
import { smartComponentConnectionZoneId, smartComponentDetachedObjectIds, smartComponentMainMemberId, smartComponentOwnedObjectIds, smartComponentSecondaryMemberId } from "../../engine/api/project/dependencies.mjs";
import { memberAxesByTarget, normalizeCoordinateSpace } from "../../rendering/scene/authoring/member-axis-space.mjs";
import { profileRadius, projectObjectCount } from "./viewer-render-scheduler.mjs";
import { smartComponentHighlightObjectIds } from "./viewer-smart-component-highlights.mjs";
import { referencePreviewChunkIds, referenceProjectAssetLoadError, referenceSourceRequestedFormatMetadata } from "./reference-geometry-runtime-paths.mjs";

const { add, sub, mul, dot, len } = v;
const norm = (point) => v.safeNorm(point, [0, 0, 1]);
const QA_REFERENCE_DIAGNOSTIC_SEVERITIES = new Set(["info", "warning", "error"]);
const QA_REFERENCE_ID_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const QA_REFERENCE_DIAGNOSTIC_TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const QA_REFERENCE_DIAGNOSTIC_MESSAGE_PATH_PATTERN = /(?:[A-Za-z]:[\\/]|(?:^|[\s"'`])\.\.[\\/]|https?:|file:|\\\\)/i;

function qaReferenceDiagnosticToken(value, fallback = "") {
  const token = typeof value === "string" ? value.trim() : "";
  return QA_REFERENCE_DIAGNOSTIC_TOKEN_PATTERN.test(token) ? token : fallback;
}

function qaReferenceIdToken(value, fallback = "") {
  const token = typeof value === "string" ? value.trim() : "";
  return QA_REFERENCE_ID_TOKEN_PATTERN.test(token) ? token : fallback;
}

function qaLoadedReferenceChunk(loadedChunks, chunkId) {
  if (!loadedChunks || typeof loadedChunks !== "object" || Array.isArray(loadedChunks)) return false;
  if (!Object.hasOwn(loadedChunks, chunkId)) return false;
  const chunk = loadedChunks[chunkId];
  return chunk && typeof chunk === "object" && !Array.isArray(chunk) && qaReferenceIdToken(chunk.id) === chunkId;
}

function qaLoadedReferenceAssetId(entry) {
  const assetId = qaReferenceIdToken(entry?.id);
  const manifestAssetId = qaReferenceIdToken(entry?.data?.asset?.id);
  const sourceFormat = referenceSourceRequestedFormatMetadata(entry?.data?.asset?.source).sourceFormat;
  return assetId && manifestAssetId === assetId && sourceFormat ? assetId : "";
}

function qaLoadedReferenceAssetsById(entries) {
  const loadedAssets = new Map();
  for (const entry of arrayValues(entries)) {
    const assetId = qaLoadedReferenceAssetId(entry);
    if (assetId && !loadedAssets.has(assetId)) loadedAssets.set(assetId, entry);
  }
  return loadedAssets;
}

function qaReferenceMapEntryCount(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return 0;
  return Object.entries(record).filter(([entryId, entry]) => {
    return qaReferenceIdToken(entryId) === entryId
      && entry
      && typeof entry === "object"
      && !Array.isArray(entry)
      && qaReferenceIdToken(entry.id) === entryId;
  }).length;
}

function qaReferenceDeclaredChunkIds(assetData) {
  const seen = new Set();
  for (const chunk of Array.isArray(assetData?.chunks) ? assetData.chunks : []) {
    const chunkId = qaReferenceIdToken(chunk?.id);
    if (chunkId) seen.add(chunkId);
  }
  return seen;
}

function qaReferenceDiagnosticSeverity(value) {
  const token = qaReferenceDiagnosticToken(value, "error");
  return QA_REFERENCE_DIAGNOSTIC_SEVERITIES.has(token) ? token : "error";
}

function qaReferenceDiagnosticMessage(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || QA_REFERENCE_DIAGNOSTIC_MESSAGE_PATH_PATTERN.test(message)) return "";
  return message.slice(0, 180);
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) throw new Error(`viewer: ${label} must be a finite [x, y, z] vector`);
  return value;
}

function requiredDirection(value, label) {
  const direction = v.safeNorm(requiredVec3(value, label));
  if (len(direction) <= 1e-9) throw new Error(`viewer: ${label} must have non-zero length`);
  return direction;
}

function expandedPoints(points, basis, margin) {
  const axes = validVec3Points([basis.normal, basis.localAxisY, basis.localAxisZ]).map(norm);
  const expanded = [...points];
  for (const point of points) {
    for (const axis of axes) {
      expanded.push(add(point, mul(axis, margin)), add(point, mul(axis, -margin)));
    }
  }
  return expanded;
}

function smartComponentOwnedIds(instance) {
  return [
    ...smartComponentOwnedObjectIds(instance),
    ...smartComponentDetachedObjectIds(instance)
  ];
}

function isolatedSmartComponentProject(project, instance, visibleSmartComponentObjectIds) {
  const next = jsonClone(project);
  const visibleObjects = new Set(visibleSmartComponentObjectIds);
  visibleObjects.add(smartComponentMainMemberId(instance));
  visibleObjects.add(smartComponentSecondaryMemberId(instance));

  for (const [memberId, member] of Object.entries(next.model.members || {})) {
    if (visibleObjects.has(memberId)) {
      member.featureIds = arrayValues(member.featureIds).filter((featureId) => visibleObjects.has(featureId));
    } else {
      member.display = { ...(member.display || {}), visible: false };
      member.featureIds = [];
    }
  }

  for (const collection of ["plates", "features", "fastenerGroups", "welds"]) {
    for (const [objectId, object] of Object.entries(next.model[collection] || {})) {
      if (visibleObjects.has(objectId)) continue;
      object.display = { ...(object.display || {}), visible: false };
    }
  }

  return next;
}

function smartComponentPrimaryPlate(project, instance) {
  const roles = instance.objectRoles || {};
  const preferredRoles = ["endPlate", "finPlate", "gussetPlate", "basePlate"];
  for (const role of preferredRoles) {
    const plate = project.model.plates?.[roles[role]];
    if (plate) return plate;
  }
  return smartComponentOwnedIds(instance).map((id) => project.model.plates?.[id]).find(Boolean) || null;
}

function memberAxis(project, memberId) {
  const member = project.model.members?.[memberId];
  const axis = memberAxisData(member);
  return axis ? { member, axis: axis.direction, length: axis.length } : null;
}

function smartComponentBasis(project, instance) {
  const plate = smartComponentPrimaryPlate(project, instance);
  if (plate?.normal && plate?.localAxisY && plate?.localAxisZ) {
    return {
      normal: requiredDirection(plate.normal, `${plate.id}.normal`),
      localAxisY: requiredDirection(plate.localAxisY, `${plate.id}.localAxisY`),
      localAxisZ: requiredDirection(plate.localAxisZ, `${plate.id}.localAxisZ`)
    };
  }
  const secondary = memberAxis(project, smartComponentSecondaryMemberId(instance));
  const main = memberAxis(project, smartComponentMainMemberId(instance));
  if (!secondary) throw new Error(`${instance.id}: secondary member axis is required for smart component view basis`);
  const normal = secondary.axis;
  let localAxisZ = [0, 0, 1];
  if (Math.abs(dot(normal, localAxisZ)) > 0.95) {
    if (!main) throw new Error(`${instance.id}: main member axis is required for smart component view basis`);
    localAxisZ = main.axis;
  }
  localAxisZ = norm(sub(localAxisZ, mul(normal, dot(localAxisZ, normal))));
  const localAxisY = norm([
    localAxisZ[1] * normal[2] - localAxisZ[2] * normal[1],
    localAxisZ[2] * normal[0] - localAxisZ[0] * normal[2],
    localAxisZ[0] * normal[1] - localAxisZ[1] * normal[0]
  ]);
  return { normal, localAxisY, localAxisZ };
}

function viewDirection(basis, view) {
  const directions = {
    front: basis.normal,
    back: mul(basis.normal, -1),
    right: basis.localAxisY,
    left: mul(basis.localAxisY, -1),
    top: basis.localAxisZ,
    bottom: mul(basis.localAxisZ, -1),
    "front-iso": norm(add(add(basis.normal, mul(basis.localAxisY, 0.62)), mul(basis.localAxisZ, -0.48))),
    "back-iso": norm(add(add(mul(basis.normal, -1), mul(basis.localAxisY, -0.62)), mul(basis.localAxisZ, -0.48))),
    iso: norm(add(add(mul(basis.normal, -1), mul(basis.localAxisY, -0.75)), mul(basis.localAxisZ, -0.55)))
  };
  return norm(directions[view] || directions.iso);
}

function cameraAnglesForDirection(direction) {
  const d = norm(direction);
  const pitch = Math.acos(clamp(-d[2], -1, 1));
  const horizontal = Math.hypot(d[0], d[1]);
  const yaw = horizontal <= 1e-9 ? 0 : Math.atan2(-d[0], -d[1]);
  return { yaw, pitch };
}

function qaViewDirection(view) {
  const directions = {
    top: [0, 0, 1],
    axonometric: norm([-1, -1, -0.62]),
    "elevation-left": [0, -1, 0],
    "elevation-right": [0, 1, 0],
    "elevation-front": [-1, 0, 0],
    "elevation-back": [1, 0, 0]
  };
  return directions[view] || null;
}

function qaViewCamera(settings, view, direction) {
  if (view === "axonometric") {
    return {
      yaw: finiteNumberOr(settings?.camera?.home?.yaw, -0.55),
      pitch: finiteNumberOr(settings?.camera?.home?.pitch, -0.62)
    };
  }
  const elevations = {
    "elevation-left": { yaw: Math.PI, pitch: -Math.PI / 2 },
    "elevation-right": { yaw: 0, pitch: -Math.PI / 2 },
    "elevation-front": { yaw: -Math.PI / 2, pitch: -Math.PI / 2 },
    "elevation-back": { yaw: Math.PI / 2, pitch: -Math.PI / 2 }
  };
  return elevations[view] || cameraAnglesForDirection(direction);
}

function enableQaScreenshotMode(view) {
  document.documentElement.dataset.qaView = view;
  document.body.dataset.qaView = view;
  if (document.getElementById("qa-screenshot-style")) return;
  const style = document.createElement("style");
  style.id = "qa-screenshot-style";
  style.textContent = `
    html[data-qa-view] #hud,
    html[data-qa-view] #modeling-toolbar,
    html[data-qa-view] #modeling-status,
    html[data-qa-view] #member-transform-panel,
    html[data-qa-view] [data-inspector-context-panel],
    html[data-qa-view] #library-panel,
    html[data-qa-view] #command-palette,
    html[data-qa-view] .bc-topbar,
    html[data-qa-view] .bc-viewer-settings-band,
    html[data-qa-view] .bc-nav-cube,
    html[data-qa-view] .bc-toolbar-band,
    html[data-qa-view] .bc-left-dock,
    html[data-qa-view] .bc-right-dock,
    html[data-qa-view] .bc-floating-layer,
    html[data-qa-view] .bc-statusbar {
      display: none !important;
    }
  `;
  document.head.append(style);
}

function memberContextPoints(project, memberId, center, radius) {
  const data = memberAxis(project, memberId);
  if (!data) return [];
  const station = memberStationAtPoint(data.member, center);
  return [
    add(data.member.start, mul(data.axis, Math.max(0, station - radius))),
    add(data.member.start, mul(data.axis, Math.min(data.length, station + radius)))
  ];
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function writeQaDomResult(payload) {
  let node = document.getElementById("bober-cad-qa-result");
  if (!node) {
    node = document.createElement("script");
    node.type = "application/json";
    node.id = "bober-cad-qa-result";
    document.documentElement.append(node);
  }
  node.textContent = JSON.stringify(payload);
  document.documentElement.dataset.qaLastRequestId = String(payload.id || "");
}

function mountQaDomBridge(qaApi) {
  document.addEventListener("bobercad:qa-request", (event) => {
    const request = event.detail || {};
    const id = String(request.id || "");
    const method = String(request.method || "");
    const args = Array.isArray(request.args) ? request.args : [];
    if (!id || typeof qaApi[method] !== "function") {
      writeQaDomResult({ id, ok: false, error: `Unknown QA method: ${method}` });
      return;
    }
    Promise.resolve()
      .then(() => qaApi[method](...args))
      .then((result) => writeQaDomResult({ id, ok: true, result }))
      .catch((error) => writeQaDomResult({ id, ok: false, error: error?.message || String(error) }));
  });
  document.documentElement.dataset.qaDomBridgeReady = "true";
}

function runInitialQaSnapSmoke(qaApi, project, searchParams) {
  if (!searchParams.has("qaSnapSmoke")) return;
  const plate = Object.values(project.model?.plates || {})[0] || null;
  try {
    const activeSketchSnap = plate ? qaApi.snapDiagnosticsAtPoint(plate.center, {
      context: {
        includeGlobalAxes: false,
        includeLines: false,
        activeSketch: {
          plate,
          candidates: [{
            type: "plate-sketch-grid",
            point: [0, 0],
            label: "Sketch grid",
            priority: 200,
            relations: [{ type: "horizontal", edgeId: "edge_1" }],
            subId: "grid",
            semanticRole: "adaptive-grid"
          }]
        }
      }
    }) : null;
    const memberSnap = qaApi.snapDiagnosticsAtPoint([171, 0, 1500], {
      strength: "normal",
      context: { includeGlobalAxes: false, includeLines: true }
    });
    writeQaDomResult({
      id: "initial-snap-smoke",
      ok: true,
      result: {
        activeSketchSnap,
        memberCandidateTypes: memberSnap?.candidateTypes || {},
        memberCandidateCount: memberSnap?.candidateCount || 0
      }
    });
    document.documentElement.dataset.qaSnapSmokeReady = "true";
  } catch (error) {
    writeQaDomResult({ id: "initial-snap-smoke", ok: false, error: error?.message || String(error) });
    document.documentElement.dataset.qaSnapSmokeReady = "false";
  }
}

export function createViewerQaBridge({
  viewer,
  canvas,
  settings,
  searchParams = new URLSearchParams(),
  qaView = searchParams.get("qaView"),
  qaCapture = searchParams.has("qaCapture"),
  qaDebug = searchParams.has("qaDebug"),
  hiddenCaptureElements = [],
  renderProject,
  getReferenceGeometryAssets = () => [],
  getReferenceGeometryLoadDiagnostics = () => []
}) {
  async function applyQaView(project, options = {}) {
    const direction = qaViewDirection(qaView);
    if (!direction || !viewer) return;
    if (qaCapture) {
      enableQaScreenshotMode(qaView);
      for (const element of hiddenCaptureElements) {
        if (element) element.hidden = true;
      }
    }
    await waitFrame();
    await waitFrame();
    const renderableCollections = new Set(["members", "plates", "features", "trimJoints", "fastenerGroups", "welds"]);
    const objectIds = Object.entries(project.objectIndex || {})
      .filter(([, entry]) => renderableCollections.has(entry.collection))
      .map(([objectId]) => objectId);
    const points = viewer.objectPoints(objectIds);
    if (!points.length) return;
    const boundsData = bounds3(points);
    const focusPoints = expandedPoints([...points, ...bounds3Corners(boundsData)], {
      normal: [1, 0, 0],
      localAxisY: [0, 1, 0],
      localAxisZ: [0, 0, 1]
    }, options.margin || 180);
    viewer.fitPoints(focusPoints, {
      ...qaViewCamera(settings, qaView, direction),
      padding: options.padding || 0.72,
      minSpan: options.minSpan || 520
    });
    if (qaCapture) {
      await waitFrame();
      await waitFrame();
      const payload = {
        view: qaView,
        dataUrl: viewer.canvasDataUrl("image/png"),
        capturedAt: new Date().toISOString()
      };
      let output = document.getElementById("qa-capture-data");
      if (!output) {
        output = document.createElement("textarea");
        output.id = "qa-capture-data";
        output.hidden = true;
        document.body.append(output);
      }
      output.value = JSON.stringify(payload);
      output.textContent = output.value;
      try {
        window.localStorage?.setItem?.("bobercadQaCapture", output.value);
      } catch (error) {
        console.warn(`QA capture storage unavailable: ${error.message}`);
      }
      document.documentElement.dataset.qaCaptureReady = "true";
    }
  }

  function mountQaApi({ api, profiles, snapManager = null }) {
    const smartComponentSummaries = () => Object.values(api.project().model.smartComponentInstances || {}).map((instance) => ({
      id: instance.id,
      type: instance.type,
      kind: instance.kind,
      name: instance.bim?.name || instance.sourceComponent?.id || instance.id,
      mainMemberId: smartComponentMainMemberId(instance),
      secondaryMemberId: smartComponentSecondaryMemberId(instance),
      health: instance.health || "ok"
    }));

    const clientPoint = (point) => {
      const projected = viewer.projectPoint(point);
      const rect = canvas.getBoundingClientRect();
      if (!projected) return null;
      return {
        x: rect.left + projected.x,
        y: rect.top + projected.y,
        screen: projected,
        inside: projected.x >= 0 && projected.x <= rect.width && projected.y >= 0 && projected.y <= rect.height,
        hitCanvas: document.elementFromPoint(rect.left + projected.x, rect.top + projected.y) === canvas,
        viewport: { width: rect.width, height: rect.height }
      };
    };

    const memberInteractionTarget = (options = {}) => {
      const project = api.project();
      const profileMap = projectProfileCatalog(project, profiles);
      const smartComponentCounts = new Map();
      for (const instance of Object.values(project.model.smartComponentInstances || {})) {
        for (const memberId of [smartComponentMainMemberId(instance), smartComponentSecondaryMemberId(instance)]) {
          if (!memberId) continue;
          smartComponentCounts.set(memberId, (smartComponentCounts.get(memberId) || 0) + 1);
        }
      }
      const members = Object.values(project.model.members || {})
        .filter((member) => member.display?.visible !== false && (!options.memberId || member.id === options.memberId));
      let best = null;
      for (const member of members) {
        const affectedSmartComponents = smartComponentCounts.get(member.id) || 0;
        if (options.connected !== false && !options.memberId && affectedSmartComponents <= 0) continue;
        const points = memberAuthoringPoints(member);
        const center = clientPoint(points.center);
        if (!center?.inside || !center.hitCanvas) continue;
        const start = clientPoint(points.physicalStart);
        const end = clientPoint(points.physicalEnd);
        const lengthPx = start && end ? screenDistance(end, start) : 0;
        const radiusPx = profileRadius(profileMap[member.profile]) * viewer.screenScale();
        const viewport = center.viewport;
        const centerDistance = screenDistance(center.screen, { x: viewport.width / 2, y: viewport.height / 2 });
        const score = affectedSmartComponents * 25 + radiusPx * 10 + lengthPx * 0.1 - centerDistance * 0.02;
        if (!best || score > best.score) {
          best = {
            memberId: member.id,
            score,
            affectedSmartComponents,
            radiusPx,
            lengthPx,
            select: { x: center.x, y: center.y },
            handles: {
              move: { x: center.x, y: center.y },
              physicalStart: start ? { x: start.x, y: start.y } : null,
              physicalEnd: end ? { x: end.x, y: end.y } : null
            },
            start: [...member.start],
            end: [...member.end]
          };
        }
      }
      if (!best) throw new Error("No visible member target found.");
      return best;
    };

    const memberManipulatorTargets = (options = {}) => {
      const target = options.memberId
        ? memberInteractionTarget({ memberId: options.memberId, connected: false })
        : memberInteractionTarget(options);
      const member = api.project().model.members?.[target.memberId];
      const points = memberAuthoringPoints(member);
      const axisLengthPx = settings.authoring?.manipulator?.screen?.axisLengthPx || 58;
      const coordinateSpace = normalizeCoordinateSpace(settings.authoring?.manipulator?.coordinateSpace);
      const axesByTarget = memberAxesByTarget(member, coordinateSpace);
      const projectedAxis = (point, axis) => {
        const origin = viewer.projectPoint(point);
        const probe = Math.max(10, 42 / Math.max(viewer.screenScale(), 1e-9));
        const end = viewer.projectPoint(add(point, mul(axis, probe)));
        if (!origin || !end) return null;
        const dx = end.x - origin.x;
        const dy = end.y - origin.y;
        const length = Math.hypot(dx, dy);
        if (length <= 1e-6) return null;
        const ux = dx / length;
        const uy = dy / length;
        return {
          start: { x: origin.x, y: origin.y },
          mid: { x: origin.x + ux * axisLengthPx * 0.58, y: origin.y + uy * axisLengthPx * 0.58 },
          end: { x: origin.x + ux * axisLengthPx, y: origin.y + uy * axisLengthPx }
        };
      };
      const anchors = {
        start: points.physicalStart,
        center: points.center,
        end: points.physicalEnd
      };
      return {
        memberId: target.memberId,
        anchors: Object.fromEntries(Object.entries(anchors).map(([name, point]) => [
          name,
          {
            point,
            screen: viewer.projectPoint(point),
            axes: Object.fromEntries(Object.entries(axesByTarget[name]).map(([axisId, spec]) => [axisId, projectedAxis(point, spec.axis)])),
            coordinateSpace
          }
        ]))
      };
    };

    const memberState = (memberId) => {
      const member = api.project().model.members?.[memberId];
      if (!member) throw new Error(`member not found: ${memberId}`);
      return { id: member.id, start: [...member.start], end: [...member.end], rotation: member.rotation || 0 };
    };

    const memberSmartComponentObjectIds = (memberId) => {
      const project = api.project();
      const ids = [];
      for (const instance of Object.values(project.model.smartComponentInstances || {})) {
        if (smartComponentMainMemberId(instance) !== memberId && smartComponentSecondaryMemberId(instance) !== memberId) continue;
        ids.push(
          ...smartComponentOwnedObjectIds(instance),
          ...smartComponentDetachedObjectIds(instance)
        );
      }
      return uniqueTruthy(ids).filter((id) => project.objectIndex?.[id] && id !== memberId);
    };

    const memberSmartComponentPoints = (memberId) => {
      const objectIds = memberSmartComponentObjectIds(memberId);
      const points = viewer.objectPoints(objectIds);
      return {
        memberId,
        objectIds,
        pointCount: points.length,
        center: averageVec3(points)
      };
    };

    const captureSmartComponentView = async (options = {}) => {
      const smartComponentId = options.smartComponentId;
      const project = api.project();
      const instance = project.model.smartComponentInstances?.[smartComponentId];
      if (!instance) throw new Error(`smart component not found: ${smartComponentId}`);

      const previousAxesVisible = settings.render.axes.visible;
      const smartComponentObjectIds = api.smartComponentObjectIds(smartComponentId);
      const captureProject = options.isolate === false
        ? project
        : isolatedSmartComponentProject(project, instance, smartComponentObjectIds);
      if (options.hideAxes !== false) settings.render.axes.visible = false;
      renderProject(captureProject, { preserveCamera: true, activeSmartComponentId: smartComponentId });
      settings.render.axes.visible = previousAxesVisible;
      viewer.setDimensionOverlay({ lines: [], labels: [] });

      const basis = smartComponentBasis(project, instance);
      if (options.highlight) viewer.setHighlightedObjects(smartComponentHighlightObjectIds(project, smartComponentObjectIds));
      else viewer.setHighlightedObjects([]);

      const zone = project.model.connectionZones?.[smartComponentConnectionZoneId(instance)];
      const seedPoints = [
        ...(Array.isArray(zone?.origin) ? [zone.origin] : []),
        ...viewer.objectPoints(smartComponentObjectIds)
      ];
      const seedBounds = bounds3(seedPoints.length ? seedPoints : [[0, 0, 0]]);
      const memberRadius = Math.max(options.memberContext || 520, seedBounds.maxSize * 1.15);
      const focusPoints = [
        ...seedPoints,
        ...memberContextPoints(project, smartComponentMainMemberId(instance), seedBounds.center, memberRadius),
        ...memberContextPoints(project, smartComponentSecondaryMemberId(instance), seedBounds.center, memberRadius)
      ];
      const focusBounds = bounds3(focusPoints);
      const margin = Math.max(options.margin || 0, clamp(focusBounds.maxSize * 0.12, 140, 650));
      const fitPoints = expandedPoints([...focusPoints, ...bounds3Corners(focusBounds)], basis, margin);
      const angles = cameraAnglesForDirection(viewDirection(basis, options.view || "iso"));
      viewer.fitPoints(fitPoints, {
        ...angles,
        padding: finiteNumberOr(options.padding, 0.74),
        minSpan: options.minSpan || 520
      });

      await waitFrame();
      await waitFrame();
      const dataUrl = viewer.canvasDataUrl("image/png");
      return {
        dataUrl,
        smartComponent: smartComponentSummaries().find((item) => item.id === smartComponentId),
        view: options.view || "iso",
        camera: angles,
        focus: {
          center: focusBounds.center,
          size: focusBounds.size,
          pointCount: fitPoints.length
        }
      };
    };

    const captureView = async (options = {}) => {
      if (options.applyQaView !== false) await applyQaView(api.project(), options);
      await waitFrame();
      await waitFrame();
      return {
        dataUrl: viewer.canvasDataUrl("image/png"),
        view: qaView || options.view || "current",
        focus: {
          objectCount: projectObjectCount(api.project())
        }
      };
    };

    const referenceGeometryRuntimeStatus = () => {
      const projectAssets = api.project()?.referenceGeometry?.assets || {};
      const loadedAssets = qaLoadedReferenceAssetsById(getReferenceGeometryAssets());
      const diagnosticsByAsset = new Map();
      for (const diagnostic of arrayValues(getReferenceGeometryLoadDiagnostics())) {
        const assetId = qaReferenceIdToken(diagnostic?.assetId);
        if (!assetId) continue;
        if (!diagnosticsByAsset.has(assetId)) diagnosticsByAsset.set(assetId, []);
        diagnosticsByAsset.get(assetId).push({
          stage: qaReferenceDiagnosticToken(diagnostic.stage, "load"),
          severity: qaReferenceDiagnosticSeverity(diagnostic.severity),
          code: qaReferenceDiagnosticToken(diagnostic.code, "reference-load-error"),
          message: qaReferenceDiagnosticMessage(diagnostic.message),
          chunkId: qaReferenceIdToken(diagnostic.chunkId) || null,
          objectId: qaReferenceIdToken(diagnostic.objectId) || null
        });
      }
      const entries = Object.entries(projectAssets)
        .map(([rawAssetId, projectAsset]) => {
          const assetId = qaReferenceIdToken(rawAssetId);
          if (!assetId) return null;
          const projectAssetError = referenceProjectAssetLoadError(assetId, projectAsset);
          const validProjectAsset = !projectAssetError;
          const loaded = validProjectAsset ? loadedAssets.get(assetId) || null : null;
          const assetData = loaded?.data || null;
          const diagnostics = diagnosticsByAsset.get(assetId) || [];
          const diagnosticEntries = diagnostics.slice(0, 8);
          const diagnosticCount = diagnostics.length;
          const diagnosticEntryOmittedCount = Math.max(0, diagnostics.length - diagnosticEntries.length);
          const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning").length;
          const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
          const diagnosticCodeCounts = diagnostics.reduce((counts, diagnostic) => {
            const code = diagnostic.code || "reference-load-error";
            counts[code] = (counts[code] || 0) + 1;
            return counts;
          }, {});
          const declaredChunkCount = loaded ? qaReferenceDeclaredChunkIds(assetData).size : 0;
          const loadedChunks = loaded?.loadedChunks || {};
          const selectedPreviewChunkIds = loaded ? referencePreviewChunkIds(assetData, settings) : new Set();
          const selectedPreviewChunkCount = selectedPreviewChunkIds.size;
          const loadedPreviewChunkCount = [...selectedPreviewChunkIds].filter((chunkId) => qaLoadedReferenceChunk(loadedChunks, chunkId)).length;
          const missingPreviewChunkCount = Math.max(0, selectedPreviewChunkCount - loadedPreviewChunkCount);
          const omittedPreviewChunkCount = Math.max(0, declaredChunkCount - selectedPreviewChunkCount);
          const sourceFormatMetadata = referenceSourceRequestedFormatMetadata(assetData?.asset?.source);
          const status = !loaded
            ? "not-loaded"
            : missingPreviewChunkCount > 0
              ? "preview-chunks-missing"
              : "ready";
          return {
            assetId,
            path: validProjectAsset && typeof projectAsset?.path === "string" ? projectAsset.path : null,
            status,
            loaded: Boolean(loaded),
            visible: validProjectAsset && projectAsset?.visible !== false && projectAsset?.display?.visible !== false,
            snapEnabled: validProjectAsset && projectAsset?.snapEnabled === true,
            sourceFormat: sourceFormatMetadata.sourceFormat,
            requestedFormat: sourceFormatMetadata.sourceRequestedFormat,
            sourceRequestedFormat: sourceFormatMetadata.sourceRequestedFormat,
            sourceRequestedFormatFamily: sourceFormatMetadata.sourceRequestedFormatFamily,
            sourceRequestedFormatAliases: sourceFormatMetadata.sourceRequestedFormatAliases,
            sourceRequestedFormatMatchesFamily: sourceFormatMetadata.sourceRequestedFormatMatchesFamily,
            units: assetData?.asset?.units || null,
            layerCount: loaded ? qaReferenceMapEntryCount(assetData?.layers) : 0,
            objectCount: loaded ? qaReferenceMapEntryCount(assetData?.objects) : 0,
            declaredChunkCount,
            selectedPreviewChunkCount,
            loadedPreviewChunkCount,
            missingPreviewChunkCount,
            omittedPreviewChunkCount,
            previewChunkLoading: declaredChunkCount > selectedPreviewChunkCount ? "budgeted-subset" : "all",
            diagnosticCount,
            errorCount,
            warningCount,
            diagnosticCodeCounts,
            diagnosticEntries,
            diagnosticEntryOmittedCount
          };
        })
        .filter(Boolean);
      const readyAssetCount = entries.filter((entry) => entry.status === "ready").length;
      const notLoadedAssetCount = entries.filter((entry) => entry.status === "not-loaded").length;
      const previewChunkMissingAssetCount = entries.filter((entry) => entry.status === "preview-chunks-missing").length;
      const diagnosticCount = entries.reduce((sum, entry) => sum + entry.diagnosticCount, 0);
      const errorCount = entries.reduce((sum, entry) => sum + entry.errorCount, 0);
      const warningCount = entries.reduce((sum, entry) => sum + entry.warningCount, 0);
      const missingPreviewChunkCount = entries.reduce((sum, entry) => sum + entry.missingPreviewChunkCount, 0);
      const omittedPreviewChunkCount = entries.reduce((sum, entry) => sum + entry.omittedPreviewChunkCount, 0);
      const diagnosticCodeCounts = entries.reduce((counts, entry) => {
        for (const [code, count] of Object.entries(entry.diagnosticCodeCounts || {})) {
          counts[code] = (counts[code] || 0) + count;
        }
        return counts;
      }, {});
      return {
        version: 1,
        assetCount: entries.length,
        loadedAssetCount: entries.length - notLoadedAssetCount,
        readyAssetCount,
        notLoadedAssetCount,
        previewChunkMissingAssetCount,
        diagnosticCount,
        errorCount,
        warningCount,
        diagnosticCodeCounts,
        missingPreviewChunkCount,
        omittedPreviewChunkCount,
        entries
      };
    };

    const referenceGeometryPreviewStats = () => {
      const stats = viewer.scene?.referenceGeometryPreviewStats;
      return stats ? jsonClone(stats) : null;
    };

    const snapDiagnosticsAtPoint = (point, options = {}) => {
      if (!snapManager?.resolve) return null;
      const rawPoint = v.isVec3(point) ? point : v.isVec3(options.rawPoint) ? options.rawPoint : null;
      if (!rawPoint) throw new Error("snap diagnostics require a raw point");
      const screen = options.screen || viewer.projectPoint(rawPoint);
      const result = snapManager.resolve({
        screen,
        rawPoint,
        strength: options.strength,
        scope: options.scope,
        context: {
          tool: "qa",
          phase: "diagnostic",
          projectToPlane: false,
          includeLines: true,
          ...(options.context || {})
        }
      });
      const candidateTypes = {};
      for (const candidate of result.candidates || []) {
        const type = candidate.type || candidate.kind || "unknown";
        candidateTypes[type] = (candidateTypes[type] || 0) + 1;
      }
      return {
        accepted: result.accepted,
        label: result.label || null,
        providerId: result.providerId || null,
        type: result.type || null,
        target: result.target || null,
        candidateCount: result.candidates?.length || 0,
        candidateTypes,
        diagnostics: (result.diagnostics || []).slice(0, 12).map((diagnostic) => ({
          candidateId: diagnostic.candidateId || null,
          status: diagnostic.status || null,
          reason: diagnostic.reason || null,
          providerId: diagnostic.providerId || null,
          type: diagnostic.type || null,
          rank: diagnostic.rank || null,
          screenDistance: diagnostic.screenDistance
        })),
        snapshot: snapManager.snapshot?.() || null
      };
    };

    const qaApi = {
      version: 1,
      ready: true,
      authoringOverlaySnapshot: () => viewer.authoringOverlaySnapshot?.() || null,
      smartComponentSummaries,
      snapSnapshot: () => snapManager?.snapshot?.() || null,
      snapDiagnosticsAtPoint,
      memberInteractionTarget,
      memberManipulatorTargets,
      memberState,
      memberSmartComponentObjectIds,
      memberSmartComponentPoints,
      captureView,
      captureSmartComponentView,
      referenceGeometryRuntimeStatus,
      referenceGeometryPreviewStats
    };
    Object.defineProperty(window, "__boberCadQa", {
      value: qaApi,
      configurable: true,
      enumerable: false,
      writable: false
    });
    mountQaDomBridge(qaApi);
    document.documentElement.dataset.qaApiReady = "true";
    document.documentElement.dataset.qaApiVersion = String(qaApi.version);
    runInitialQaSnapSmoke(qaApi, api.project(), searchParams);
    if (qaDebug) {
      try {
        const target = memberInteractionTarget({ connected: false });
        const candidates = Object.values(api.project().model.members || {})
          .filter((member) => member.display?.visible !== false)
          .map((member) => {
            const points = memberAuthoringPoints(member);
            return {
              memberId: member.id,
              center: clientPoint(points.center),
              start: clientPoint(points.physicalStart),
              end: clientPoint(points.physicalEnd)
            };
          })
          .filter((candidate) => candidate.center?.inside || candidate.start?.inside || candidate.end?.inside);
        document.documentElement.dataset.qaMemberTarget = JSON.stringify({
          target,
          handles: memberManipulatorTargets({ memberId: target.memberId }),
          candidates
        });
      } catch (error) {
        document.documentElement.dataset.qaMemberTarget = JSON.stringify({ error: error.message });
      }
    }
    return qaApi;
  }

  return {
    applyQaView,
    mountQaApi
  };
}
