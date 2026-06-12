import { createProjectStore } from "../../engine/store/project-store.mjs?v=plate-relax-equal-length-drag-1";
import { arrayValues, jsonClone, uniqueTruthy } from "../../engine/core/model.mjs?v=array-values-dry-1";
import { averageVec3, bounds3, bounds3Corners, clamp, distance2, finiteNumber, finiteNumberOr, screenDistance, validVec3Points, v } from "../../engine/core/math.mjs?v=integer-number-dry-1";
import { memberAuthoringPoints, memberAxisData, memberCenter, memberStationAtPoint } from "../../engine/api/project/members.mjs?v=member-api-distance-dry-1";
import { projectProfileCatalog } from "../../engine/api/project/profiles.mjs?v=profile-api-dry-1";
import { plateOutline as sketchPlateOutline } from "../../engine/api/project/plates.mjs?v=plate-relation-resolve-relax-1";
import { objectCollection } from "../../engine/api/project/objects.mjs?v=array-values-dry-1";
import { memberDependencyObjectIds, smartComponentConnectionZoneId, smartComponentDetachedObjectIds, smartComponentMainMemberId, smartComponentOwnedObjectIds, smartComponentSecondaryMemberId } from "../../engine/api/project/dependencies.mjs?v=array-values-dry-1";
import { loadSmartComponentDefinitions } from "../../engine/modules/smart-components/smart-component-registry.mjs?v=smart-config-array-values-dry-1";
import { buildScene } from "../../rendering/scene/build-scene.mjs?v=plate-midpoint-fluid-drag-2";
import { memberAxesByTarget, normalizeCoordinateSpace } from "../../rendering/scene/authoring/member-axis-space.mjs?v=final-array-values-dry-1";
import { createCommandController } from "../../rendering/interaction/command-controller.mjs?v=unified-snap-manager-8";
import { createMemberEditController } from "../../rendering/interaction/member-edit-controller.mjs?v=unified-snap-manager-8";
import { createPlateSketchEditController } from "../../rendering/interaction/plate-sketch-edit-controller.mjs?v=unified-snap-manager-8";
import { createReferencePlaneEditController } from "../../rendering/interaction/reference-plane-edit-controller.mjs?v=work-plane-point-dry-1";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs?v=unified-snap-manager-10";
import { createSnapManager } from "../../rendering/interaction/snap-manager.mjs?v=unified-snap-manager-10";
import { createTrimCreateController } from "../../rendering/interaction/trim-create-controller.mjs?v=trim-create-inline-1";
import { isTextInput, matchesShortcut, shortcutSetting } from "../../rendering/interaction/keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { createWebglViewer } from "../../rendering/webgl/webgl-renderer.mjs?v=unified-snap-manager-7";
import { createDimensionEditController } from "./dimensions/dimension-edit-controller.mjs?v=unified-dimension-overlay-1";
import { mountFeatureEditorPanel } from "./panels/feature-editor-panel.mjs?v=panel-controls-dry-1";
import { mountMemberTransformPanel } from "./panels/member-transform-panel.mjs?v=panel-controls-dry-1";
import { mountEditorUi } from "./panels/property-panel.mjs?v=plate-insert-point-drag-1";
import { mountTrimJointEditorPanel } from "./panels/trim-joint-editor-panel.mjs?v=trim-participants-dry-1";
import { mountModelingToolbar } from "./toolbar/modeling-toolbar.mjs?v=unified-snap-manager-9";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const modelingToolbar = document.getElementById("modeling-toolbar");
const modelingStatus = document.getElementById("modeling-status");
const memberTransformPanel = document.getElementById("member-transform-panel");
const objectEditor = document.getElementById("object-editor");
const featureEditorPanel = document.getElementById("feature-editor");
const trimJointEditorPanel = document.getElementById("trim-joint-editor");
const libraryPanel = document.getElementById("library-panel");
const customPanel = document.getElementById("custom-panel");
const initialSearchParams = new URLSearchParams(window.location.search);
const initialQaView = initialSearchParams.get("qaView");
const initialQaCapture = initialSearchParams.has("qaCapture");
const initialQaDebug = initialSearchParams.has("qaDebug");
const initialQaSelectObject = initialSearchParams.get("qaSelectObject");
const settingsUrl = new URL("./viewer-settings.json?v=plate-grid-finer-step-1", import.meta.url);
let settings = null;
let viewer = null;
let authoringPreview = [];
let authoringPreviewPlates = [];
let renderedLodDetailBucket = null;
let progressiveDetailRenderToken = 0;

const { add, sub, mul, dot, len } = v;
const norm = (point) => v.safeNorm(point, [0, 0, 1]);

function projectObjectCount(project) {
  return Object.values(project.model || {})
    .filter((collection) => collection && typeof collection === "object" && !Array.isArray(collection))
    .reduce((sum, collection) => sum + Object.keys(collection).length, 0);
}

function shouldUseProgressiveDetails(project) {
  return projectObjectCount(project) > 5000;
}

function lodDetailBucket(scale) {
  if (!finiteNumber(scale) || scale <= 0) return null;
  return Math.floor(Math.log2(scale) * 4);
}

function profileRadius(profile) {
  const points = arrayValues(profile?.section?.contours).flatMap((contour) => arrayValues(contour.points));
  if (!points.length) return 1;
  return Math.max(...points.map((point) => distance2(point, [0, 0])), 1);
}

function plateRadius(plate) {
  const outline = sketchPlateOutline(plate);
  const y = Math.max(...outline.map((point) => Math.abs(point[0] || 0)), 1);
  const z = Math.max(...outline.map((point) => Math.abs(point[1] || 0)), 1);
  return Math.hypot(y, z, (plate.thickness || 1) / 2);
}

function memberRadius(project, profiles, member) {
  const axisLength = len(sub(member.end || [0, 0, 0], member.start || [0, 0, 0]));
  return axisLength / 2 + profileRadius(profiles[member.profile]);
}

function estimateObjectRadius(project, profiles, objectId, seen = new Set()) {
  if (!objectId || seen.has(objectId)) return 1;
  seen.add(objectId);
  const collection = objectCollection(project, objectId);
  const object = collection ? project.model?.[collection]?.[objectId] : null;
  if (!object) return 1;

  if (collection === "members") return memberRadius(project, profiles, object);
  if (collection === "plates") return plateRadius(object);
  if (collection === "fastenerGroups") {
    const pattern = project.model.holePatterns?.[object.holePatternRef];
    const feature = project.model.features?.[object.through?.fromFeatureId];
    const patternRadius = Math.max(...(pattern?.positions || [[0, 0]]).map((point) => distance2([point[0] || 0, point[1] || 0], [0, 0])), 1);
    return patternRadius + Math.max(object.assembly?.length || settings.render.fasteners.length || 1, estimateObjectRadius(project, profiles, feature?.ownerId, seen) * 0.25);
  }
  if (collection === "features") return Math.max(1, estimateObjectRadius(project, profiles, object.ownerId, seen) * 0.25);
  if (collection === "welds") {
    return Math.max(1, ...arrayValues(object.participants).map((id) => estimateObjectRadius(project, profiles, id, seen) * 0.25));
  }
  if (collection === "connectionZones") return 750;
  return 1;
}

function memberSmartComponentDetailObjectIds(project, memberId) {
  return memberDependencyObjectIds(project, memberId, { includeMember: false, includeSmartComponentMembers: false, renderableOnly: true });
}

function objectCenter(project, objectId, seen = new Set()) {
  if (!objectId || seen.has(objectId)) return null;
  seen.add(objectId);
  const collection = objectCollection(project, objectId);
  const object = collection ? project.model?.[collection]?.[objectId] : null;
  if (!object) return null;

  if (collection === "members" && Array.isArray(object.start) && Array.isArray(object.end)) return memberCenter(object);
  if (collection === "plates" && Array.isArray(object.center)) return object.center;
  if (collection === "features") {
    if (Array.isArray(object.center)) return object.center;
    return objectCenter(project, object.ownerId, seen);
  }
  if (collection === "fastenerGroups") {
    const feature = project.model.features?.[object.through?.fromFeatureId];
    return objectCenter(project, feature?.ownerId, seen);
  }
  if (collection === "welds") {
    const centers = arrayValues(object.participants).map((id) => objectCenter(project, id, seen));
    return averageVec3(centers);
  }
  if (collection === "connectionZones" && Array.isArray(object.origin)) return object.origin;
  return null;
}

function projectedDetailScore(center, pixelRadius, detailContext = {}) {
  if (!center || typeof detailContext.projectPoint !== "function" || !detailContext.viewport) return pixelRadius;
  const projected = detailContext.projectPoint(center);
  const viewport = detailContext.viewport;
  if (!projected || !finiteNumber(projected.x) || !finiteNumber(projected.y)) return null;
  const margin = Math.max(120, pixelRadius * 2);
  if (projected.x < -margin || projected.x > viewport.width + margin || projected.y < -margin || projected.y > viewport.height + margin) return null;
  const dx = projected.x - viewport.width / 2;
  const dy = projected.y - viewport.height / 2;
  return pixelRadius - Math.hypot(dx, dy) * 0.015;
}

function createLodDetailFilter(project, profileMap, scale, detailContext = {}) {
  const threshold = finiteNumber(settings.render.lod?.detailPixelThreshold)
    ? settings.render.lod.detailPixelThreshold
    : 24;
  const maxAutoDetails = finiteNumber(settings.render.lod?.maxAutoDetailObjects)
    ? Math.max(0, Math.floor(settings.render.lod.maxAutoDetailObjects))
    : 600;
  const forced = new Set(arrayValues(detailContext.forceDetailObjectIds));
  if (!maxAutoDetails && !forced.size) return () => false;

  const candidates = [];
  for (const objectId of Object.keys(project.objectIndex || {})) {
    if (forced.has(objectId)) continue;
    const pixelRadius = estimateObjectRadius(project, profileMap, objectId) * scale;
    if (pixelRadius < threshold) continue;
    const score = projectedDetailScore(objectCenter(project, objectId), pixelRadius, detailContext);
    if (!finiteNumber(score)) continue;
    candidates.push({ objectId, score });
  }

  const selected = new Set(candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, maxAutoDetails)
    .map((entry) => entry.objectId));
  for (const objectId of forced) selected.add(objectId);
  return (objectId) => selected.has(objectId);
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

function smartComponentHighlightObjectIds(project, objectIds = []) {
  const highlightCollections = new Set(["members", "plates", "fastenerGroups", "welds"]);
  return objectIds.filter((objectId) => highlightCollections.has(project.objectIndex?.[objectId]?.collection));
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
      normal: norm(plate.normal),
      localAxisY: norm(plate.localAxisY),
      localAxisZ: norm(plate.localAxisZ)
    };
  }
  const secondary = memberAxis(project, smartComponentSecondaryMemberId(instance));
  const main = memberAxis(project, smartComponentMainMemberId(instance));
  const normal = secondary?.axis || [1, 0, 0];
  let localAxisZ = [0, 0, 1];
  if (Math.abs(dot(normal, localAxisZ)) > 0.95) localAxisZ = main?.axis || [0, 1, 0];
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

function qaViewCamera(view, direction) {
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
    html[data-qa-view] #object-editor,
    html[data-qa-view] #feature-editor,
    html[data-qa-view] #trim-joint-editor,
    html[data-qa-view] #library-panel,
    html[data-qa-view] #custom-panel {
      display: none !important;
    }
  `;
  document.head.append(style);
}

async function applyQaView(project, options = {}) {
  const view = initialQaView;
  const direction = qaViewDirection(view);
  if (!direction || !viewer) return;
  if (initialQaCapture) {
    enableQaScreenshotMode(view);
    for (const element of [hud, modelingToolbar, modelingStatus, memberTransformPanel, objectEditor, featureEditorPanel, trimJointEditorPanel, libraryPanel, customPanel]) {
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
    ...qaViewCamera(view, direction),
    padding: options.padding || 0.72,
    minSpan: options.minSpan || 520
  });
  if (initialQaCapture) {
    await waitFrame();
    await waitFrame();
    const payload = {
      view,
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

function runInitialQaSnapSmoke(qaApi, project) {
  if (!initialSearchParams.has("qaSnapSmoke")) return;
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

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}

function applyUiSettings(project) {
  hud.hidden = !settings.ui.showHud;
  meta.hidden = !settings.ui.showMeta;
  reset.hidden = !settings.ui.showResetButton;
  title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function projectPath() {
  const demo = initialSearchParams.get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  meta.textContent = `${Object.keys(project.model.members).length} members\n${Object.keys(project.model.plates).length} plates\n${Object.keys(project.model.sketches || {}).length} sketches\n${Object.keys(project.model.fastenerGroups).length} fastener groups`;
}

function renderProject(project, profiles, fasteners, options = {}) {
  const {
    activeSmartComponentId = null,
    activeTrimJointId = null,
    activeTrimOperationId = null,
    previewMembers = authoringPreview,
    previewPlates = authoringPreviewPlates,
    forceDetailObjectIds = [],
    ...viewerOptions
  } = options;
  const progressiveDetails = shouldUseProgressiveDetails(project);
  const profileMap = projectProfileCatalog(project, profiles);
  const detailContext = () => ({
    projectPoint: (point) => viewer.projectPoint(point),
    viewport: viewer.viewportSize(),
    forceDetailObjectIds
  });

  if (progressiveDetails && !viewerOptions.preserveCamera) {
    const detailToken = ++progressiveDetailRenderToken;
    const coarseScene = buildScene(project, profiles, fasteners, settings, {
      activeSmartComponentId,
      activeTrimJointId,
      activeTrimOperationId,
      previewMembers,
      previewPlates,
      lodDetailFilter: () => false
    });
    viewer.setScene(coarseScene, viewerOptions);
    updateMeta(project);
    window.setTimeout(() => {
      const run = () => {
        if (detailToken !== progressiveDetailRenderToken) return;
        const scheduledScale = viewer.screenScale();
        renderedLodDetailBucket = lodDetailBucket(scheduledScale);
        viewer.setScene(buildScene(project, profiles, fasteners, settings, {
          activeSmartComponentId,
          activeTrimJointId,
          activeTrimOperationId,
          previewMembers,
          previewPlates,
          lodDetailFilter: createLodDetailFilter(project, profileMap, scheduledScale, detailContext())
        }), { ...viewerOptions, preserveCamera: true });
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: 1800 });
        return;
      }
      run();
    }, 500);
    return;
  }

  progressiveDetailRenderToken += 1;
  const detailScale = progressiveDetails ? viewer.screenScale() : null;
  renderedLodDetailBucket = progressiveDetails ? lodDetailBucket(detailScale) : null;
  const lodDetailFilter = progressiveDetails ? createLodDetailFilter(project, profileMap, detailScale, detailContext()) : null;
  viewer.setScene(buildScene(project, profiles, fasteners, settings, { activeSmartComponentId, activeTrimJointId, activeTrimOperationId, previewMembers, previewPlates, lodDetailFilter }), {
    ...viewerOptions,
    preserveCamera: progressiveDetails || viewerOptions.preserveCamera
  });
  updateMeta(project);
}
function mountQaApi({ api, profiles, fasteners, snapManager = null }) {
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
    renderProject(captureProject, profiles, fasteners, { preserveCamera: true, activeSmartComponentId: smartComponentId });
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
      view: initialQaView || options.view || "current",
      focus: {
        objectCount: projectObjectCount(api.project())
      }
    };
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
    captureSmartComponentView
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
  runInitialQaSnapSmoke(qaApi, api.project());
  if (initialQaDebug) {
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
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const [profiles, fasteners, smartComponentCatalog] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadSmartComponentDefinitions()]);

    viewer = createWebglViewer(canvas, reset, settings, { qaCapture: initialQaCapture });
    applyUiSettings(project);

    const api = createProjectStore({
      project,
      profiles: profiles.profiles,
      smartComponentCatalog,
      fasteners,
      cloneOnLoad: !shouldUseProgressiveDetails(project)
    });
    const selection = createSelectionController({ viewer, settings, project: () => api.project() });
    const snapManager = createSnapManager({
      viewer,
      api,
      profiles: profiles.profiles,
      settings,
      selectionScope: selection
    });
    let commandController = null;
    let trimCreate = null;
    let autoRelationsEnabled = settings.authoring?.autoAxisRelations !== false;
    let dimensionEdit = null;
    let focusedMemberId = null;
    let editorApi = null;
    let featureEditorApi = null;
    let trimJointEditorApi = null;
    let memberEdit = null;
    let referencePlaneEdit = null;
    let plateSketchEdit = null;
    const syncSketchRelationsButton = () => {
      const active = plateSketchEdit?.activeState?.();
      const selected = editorApi?.selectedState?.();
      const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
      modelingUi?.setSketchRelationsState?.({
        available,
        visible: available && active.sketchMode === "relations"
      });
    };
    function startTrimCreate() {
      commandController?.cancel();
      modelingUi.setActive("trim");
      dimensionEdit?.clearDimension({ render: false });
      memberEdit?.clear({ notify: false });
      clearAuxiliaryEditors();
      trimCreate?.start();
    }
    const modelingUi = mountModelingToolbar({
      toolbar: modelingToolbar,
      status: modelingStatus,
      shortcuts: settings.shortcuts || {},
      onBeam: () => commandController?.startBeam(),
      onColumn: () => commandController?.startColumn(),
      onPlate: () => commandController?.startPlate(),
      onSketch: () => commandController?.startSketch(),
      onWorkPlane: () => commandController?.startWorkPlane(),
      onPlateBend: () => commandController?.startPlateBend(),
      onTrim: () => startTrimCreate(),
      onCancel: () => {
        if (trimCreate?.cancel()) {
          modelingUi.setActive(null);
          return;
        }
        commandController?.cancel();
      },
      autoRelationsEnabled,
      onAutoRelationsChange: (enabled) => {
        autoRelationsEnabled = enabled;
        modelingUi.setStatus(enabled ? "Automatic axis relations on." : "Automatic axis relations off.");
      },
      onSketchRelationsToggle: () => {
        const toggled = plateSketchEdit?.toggleRelations?.();
        syncSketchRelationsButton();
        return toggled;
      },
      snapSettings: settings.authoring?.snap || {},
      snapScope: selection.scope?.() || {},
      onSnapStrengthChange: (strength) => {
        settings.authoring = settings.authoring || {};
        settings.authoring.snap = settings.authoring.snap || {};
        settings.authoring.snap.strength = strength;
        updateModelingStatus(`Snap strength: ${strength}`);
      },
      onSnapScopeChange: (patch) => {
        selection.setScope?.(patch);
        const [key, enabled] = Object.entries(patch)[0] || [];
        if (key) updateModelingStatus(`${key} snap ${enabled ? "enabled" : "disabled"}`);
      }
    });
    function clearAuxiliaryEditors(referencePlaneOptions = undefined) {
      referencePlaneEdit?.clear(referencePlaneOptions);
      plateSketchEdit?.clear(referencePlaneOptions);
      featureEditorApi?.clear();
      trimJointEditorApi?.clear();
    }
    function clearSmartComponentEditor() {
      dimensionEdit?.clearAll();
      selection.setActiveSmartComponent?.(null);
      customPanel.hidden = true;
    }
    function clearMemberEditSilently() {
      memberEdit?.clear({ notify: false });
    }
    function updateModelingStatus(message) {
      modelingUi.setStatus(message);
      if (message === "No modeling command") modelingUi.setActive(null);
    }
    const focusedDetailObjectIds = () => focusedMemberId ? memberSmartComponentDetailObjectIds(api.project(), focusedMemberId) : [];
    const activeTrimRenderOptions = () => trimJointEditorApi?.sceneFocus?.() || {};
    let rerenderTimer = null;
    let rerenderIdle = null;
    const clearQueuedRerender = () => {
      window.clearTimeout(rerenderTimer);
      rerenderTimer = null;
      if (rerenderIdle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(rerenderIdle);
      }
      rerenderIdle = null;
    };
    const renderProjectNow = (nextProject) => {
      renderProject(nextProject, profiles, fasteners, {
        preserveCamera: true,
        activeSmartComponentId: dimensionEdit?.smartComponentId() || null,
        forceDetailObjectIds: focusedDetailObjectIds(),
        ...activeTrimRenderOptions()
      });
      dimensionEdit?.render();
    };
    const queueLargeProjectRerender = () => {
      clearQueuedRerender();
      const run = () => {
        rerenderIdle = null;
        renderProjectNow(api.project());
      };
      rerenderTimer = window.setTimeout(() => {
        rerenderTimer = null;
        if (typeof window.requestIdleCallback === "function") {
          rerenderIdle = window.requestIdleCallback(run, { timeout: 1200 });
        } else {
          run();
        }
      }, 0);
    };
    const rerender = (nextProject) => {
      if (shouldUseProgressiveDetails(nextProject)) {
        queueLargeProjectRerender();
        return;
      }
      clearQueuedRerender();
      renderProjectNow(nextProject);
    };
    let detailRefreshTimer = null;
    let detailRefreshIdle = null;
    const clearDetailRefresh = () => {
      window.clearTimeout(detailRefreshTimer);
      detailRefreshTimer = null;
      if (detailRefreshIdle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(detailRefreshIdle);
      }
      detailRefreshIdle = null;
    };
    const scheduleDetailRefresh = () => {
      clearDetailRefresh();
      const run = () => {
        detailRefreshIdle = null;
        rerender(api.project());
      };
      detailRefreshTimer = window.setTimeout(() => {
        detailRefreshTimer = null;
        if (typeof window.requestIdleCallback === "function") {
          detailRefreshIdle = window.requestIdleCallback(run, { timeout: 1000 });
        } else {
          run();
        }
      }, 0);
    };
    const hotSwapMemberDetails = (nextProject, memberId, objectIds = []) => {
      if (typeof viewer.replaceSceneObjects !== "function") throw new Error("viewer does not support affected-object scene patching");
      const renderIds = new Set(uniqueTruthy([memberId, ...objectIds]));
      if (!renderIds.size) return false;
      clearQueuedRerender();
      clearDetailRefresh();
      progressiveDetailRenderToken += 1;
      renderedLodDetailBucket = shouldUseProgressiveDetails(nextProject) ? lodDetailBucket(viewer.screenScale()) : null;

      const patchScene = buildScene(nextProject, profiles, fasteners, settings, {
        activeSmartComponentId: dimensionEdit?.smartComponentId() || null,
        ...activeTrimRenderOptions(),
        renderObjectIds: renderIds,
        lodDetailFilter: (objectId) => renderIds.has(objectId)
      });
      const replaced = viewer.replaceSceneObjects(patchScene, renderIds);
      if (!replaced) throw new Error("affected-object scene patch failed");
      updateMeta(nextProject);
      dimensionEdit?.render();
      return true;
    };
    viewer.setDetailScaleChangeHandler((scale) => {
      if (!shouldUseProgressiveDetails(api.project())) return;
      const bucket = lodDetailBucket(scale);
      if (bucket === null || bucket === renderedLodDetailBucket) return;
      scheduleDetailRefresh();
    });
    const memberTransformUi = mountMemberTransformPanel({
      panel: memberTransformPanel,
      onDeltaChange: (axisId, value) => memberEdit?.setPendingTransformDelta(axisId, value),
      onResultChange: (axisId, value) => memberEdit?.setPendingTransformResult(axisId, value),
      onNudge: (axisId, direction) => memberEdit?.nudgePendingTransform(axisId, direction),
      onIncrementChange: (value) => memberEdit?.setPendingTransformIncrement(value),
      onConfirm: () => memberEdit?.confirmPendingTransform(),
      onCancel: () => memberEdit?.cancelPendingTransform(),
      shortcuts: settings.shortcuts?.memberEdit || {}
    });
    memberEdit = createMemberEditController({
      viewer,
      api,
      selection,
      snapManager,
      settings,
      onLocalProjectChange: hotSwapMemberDetails,
      onMemberSelected: (memberId) => {
        focusedMemberId = memberId;
        editorApi?.selectMember(memberId, { fromMemberEdit: true });
        if (dimensionEdit?.smartComponentId()) {
          clearSmartComponentEditor();
          renderProjectNow(api.project());
        }
        clearAuxiliaryEditors();
      },
      onCleared: () => {
        focusedMemberId = null;
        editorApi?.clearSelection({ fromMemberEdit: true });
        clearAuxiliaryEditors();
      },
      onTransformChange: (state) => memberTransformUi.update(state),
      autoRelationsEnabled: () => autoRelationsEnabled
    });
    referencePlaneEdit = createReferencePlaneEditController({
      viewer,
      api,
      onLocalObjectProjectChange: hotSwapMemberDetails
    });
    plateSketchEdit = createPlateSketchEditController({
      viewer,
      api,
      snapManager,
      settings: settings.authoring || {},
      onProjectChange: rerender,
      onStatusChange: updateModelingStatus,
      onSelectionChange: ({ plateId, selection: sketchSelection }) => {
        syncSketchRelationsButton();
        if (!plateId || editorApi?.selectedState?.().objectId !== plateId) return;
        editorApi?.selectObject(plateId, {
          edgeIds: sketchSelection?.edgeIds || [],
          vertexIds: sketchSelection?.vertexIds || [],
          ...(sketchSelection?.relationId ? { relationId: sketchSelection.relationId } : {}),
          ...(sketchSelection?.sketchMode ? { sketchMode: sketchSelection.sketchMode } : {})
        }, { notify: false });
      }
    });
    const authoringTarget = (input) => {
      if (input?.handle?.kind === "reference-plane-corner") return referencePlaneEdit.authoringHandler;
      if (input?.handle?.kind?.startsWith("plate-sketch-")) return plateSketchEdit.authoringHandler;
      return memberEdit.authoringHandler;
    };
    viewer.setAuthoringHandler({
      beginDrag: (input) => authoringTarget(input)?.beginDrag?.(input),
      click: (input) => authoringTarget(input)?.click?.(input),
      contextMenu: (input) => plateSketchEdit?.authoringHandler?.contextMenu?.(input) || authoringTarget(input)?.contextMenu?.(input),
      quickListAction: (input) => authoringTarget({ handle: input?.item?.handle })?.quickListAction?.(input),
      drag: (input) => authoringTarget(input)?.drag?.(input),
      end: (input) => authoringTarget(input)?.end?.(input),
      cancel: (input) => authoringTarget(input)?.cancel?.(input)
    });
    const smartComponentPathForObject = (objectId) => {
      const instances = api.project().model?.smartComponentInstances || {};
      const path = [];
      const seen = new Set();
      let current = objectId ? api.smartComponentForObject(objectId) : null;
      while (current && !seen.has(current.id)) {
        path.unshift(current);
        seen.add(current.id);
        current = current.parentInstanceId ? instances[current.parentInstanceId] : null;
      }
      return path;
    };
    const selectHierarchicalFace = (face) => {
      const objectId = face?.objectId || null;
      const entry = objectId ? api.project().objectIndex?.[objectId] : null;
      if (objectId && entry?.collection && selection.objectAllowed?.(api.project(), objectId, entry.collection, { ignoreSelectedObjectsOnly: true }) === false) {
        clearMemberEditSilently();
        editorApi?.clearSelection?.();
        selection.clear();
        updateModelingStatus("Object type is filtered by snap/selection scope.");
        return true;
      }
      const smartComponentPath = smartComponentPathForObject(objectId);
      const rootSmartComponent = smartComponentPath[0] || null;
      const selected = editorApi?.selectedState?.() || {};
      const selectedRootId = selected.smartComponentId
        ? api.smartComponentRoot(selected.smartComponentId)?.id
        : selected.objectId
          ? api.smartComponentRootForObject(selected.objectId)?.id
          : null;

      if (!rootSmartComponent) {
        if (face?.collection && face.collection !== "members" && objectId) {
          clearMemberEditSilently();
          editorApi?.selectObject(objectId, face);
          return true;
        }
        return false;
      }

      if (selectedRootId !== rootSmartComponent.id) {
        editorApi?.selectSmartComponent(rootSmartComponent.id);
        return true;
      }

      const selectedPathIndex = selected.smartComponentId
        ? smartComponentPath.findIndex((component) => component.id === selected.smartComponentId)
        : -1;
      if (selectedPathIndex >= 0 && selectedPathIndex < smartComponentPath.length - 1) {
        editorApi?.selectSmartComponent(smartComponentPath[selectedPathIndex + 1].id);
        return true;
      }

      if (entry?.collection) {
        clearMemberEditSilently();
        editorApi?.selectObject(objectId, face);
        return true;
      }

      return false;
    };
    viewer.setClickHandler((face) => {
      if (!face) dimensionEdit?.clearDimension();
      if (trimJointEditorApi?.toggleRegionFromFace(face)) {
        clearMemberEditSilently();
        featureEditorApi?.clear();
        referencePlaneEdit?.clear({ overlay: true });
        return;
      }
      if (selectHierarchicalFace(face)) return;
      memberEdit.handleSceneClick(face);
    });
    const showSmartComponentEditor = (smartComponentId, options = {}) => {
      focusedMemberId = null;
      clearMemberEditSilently();
      clearAuxiliaryEditors();
      selection.setActiveSmartComponent?.(smartComponentId);
      selection.select(smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId)));
      const focus = dimensionEdit.selectSmartComponent(smartComponentId, options);
      const definition = api.definition(smartComponentId);
      definition.customUi.mountSmartComponentUi({
        panel: customPanel,
        definition,
        smartComponentId,
        api,
        focusPath: focus.path,
        focusMode: focus.mode,
        focusInput: !options.focusLabel,
        onPanelFocus: () => {
          dimensionEdit.stopLabelEdit();
        },
        onProjectChange: rerender,
        onSmartComponentDeleted: () => {
          clearSmartComponentEditor();
          renderProject(api.project(), profiles, fasteners, { preserveCamera: true });
          clearMemberEditSilently();
          clearAuxiliaryEditors();
          selection.clear();
        }
      });
      renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeSmartComponentId: dimensionEdit.smartComponentId() });
      dimensionEdit.render();
    };
    dimensionEdit = createDimensionEditController({
      viewer,
      api,
      profiles: profiles.profiles,
      snapManager,
      settings,
      getEditorApi: () => editorApi,
      onProjectChange: rerender,
      openSmartComponentEditor: showSmartComponentEditor
    });
    viewer.setDoubleClickHandler((face) => {
      try {
        const result = api.toggleSmartComponentRoleFromFace(face);
        if (!result) return;
        dimensionEdit.clearDimension({ render: false });
        editorApi?.selectSmartComponent(result.component.smartComponentId);
        rerender(result.project);
      } catch (error) {
        console.error(error);
      }
    });
    commandController = createCommandController({
      viewer,
      api,
      profiles: profiles.profiles,
      settings,
      onPreviewChange: (preview) => {
        if (Array.isArray(preview)) {
          authoringPreview = preview;
          authoringPreviewPlates = [];
        } else {
          authoringPreview = arrayValues(preview?.members);
          authoringPreviewPlates = arrayValues(preview?.plates);
        }
        renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeSmartComponentId: dimensionEdit?.smartComponentId() || null });
      },
      onOverlayChange: (overlay) => viewer.setAuthoringOverlay(overlay),
      onProjectChange: rerender,
      onStatusChange: updateModelingStatus,
      onCommandStart: (type) => {
        trimCreate?.cancel();
        modelingUi.setActive(type);
        dimensionEdit?.clearDimension({ render: false });
        clearMemberEditSilently();
        clearAuxiliaryEditors();
        selection.clear();
      }
    });
    trimCreate = createTrimCreateController({
      api,
      selection,
      onProjectChange: rerender,
      onTrimCreated: (trimJointId) => {
        focusedMemberId = null;
        dimensionEdit?.clearDimension({ render: false });
        clearMemberEditSilently();
        clearAuxiliaryEditors({ overlay: true });
        trimJointEditorApi?.selectTrimJoint(trimJointId);
        modelingUi.setActive(null);
      },
      onCommandEnd: () => modelingUi.setActive(null),
      onStatusChange: updateModelingStatus
    });
    window.addEventListener("keydown", (event) => {
      if (event.target instanceof Element && memberTransformPanel.contains(event.target)) return;
      if (event.defaultPrevented) return;
      if (!isTextInput(event.target) && matchesShortcut(event, settings.authoring?.snap?.cycleKey || "Tab")) {
        if (plateSketchEdit?.cycleSnap?.() || memberEdit?.cycleSnap?.()) {
          event.preventDefault();
          return;
        }
      }
      if (!isTextInput(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey && event.key?.toLowerCase() === "r") {
        if (plateSketchEdit?.toggleRelations?.()) {
          syncSketchRelationsButton();
          event.preventDefault();
          return;
        }
      }
      if (!isTextInput(event.target) && (event.key === "Delete" || event.key === "Backspace") && plateSketchEdit?.removeSelectedRelation?.()) {
        event.preventDefault();
        return;
      }
      if (!isTextInput(event.target) && matchesShortcut(event, shortcutSetting(settings.shortcuts?.commands, "createTrim", "T"))) {
        if (!commandController?.activeCommand?.() && !trimCreate?.active?.()) {
          startTrimCreate();
          event.preventDefault();
        }
        return;
      }
      if (matchesShortcut(event, shortcutSetting(settings.shortcuts?.memberEdit, "confirmTransform", "Enter")) && memberEdit.confirmPendingTransform()) {
        event.preventDefault();
        return;
      }
      const cancelCommandBinding = shortcutSetting(settings.shortcuts?.commands, "cancel", "Escape");
      const cancelTransformBinding = shortcutSetting(settings.shortcuts?.memberEdit, "cancelTransform", cancelCommandBinding);
      const cancelCommand = matchesShortcut(event, cancelCommandBinding);
      const cancelTransform = matchesShortcut(event, cancelTransformBinding);
      if (!cancelCommand && !cancelTransform) return;
      if (cancelCommand && trimCreate?.cancel()) {
        modelingUi.setActive(null);
        event.preventDefault();
        return;
      }
      if (cancelTransform && memberEdit.cancelPendingTransform()) {
        event.preventDefault();
        return;
      }
      if (cancelCommand && dimensionEdit.clearDimension()) {
        event.preventDefault();
        return;
      }
      if (cancelCommand && !commandController?.activeCommand?.() && !trimCreate?.active?.() && plateSketchEdit?.clearSelection?.()) {
        event.preventDefault();
        return;
      }
    }, { capture: true });

    renderProject(api.project(), profiles, fasteners);
    mountQaApi({ api, profiles, fasteners, snapManager });
    applyQaView(api.project()).catch((error) => console.error(error));
    smartComponentCatalog.customUi.mountSmartComponentLibraryUi({
      panel: libraryPanel,
      api,
      selection,
      onProjectChange: rerender,
      onSmartComponentCreated: showSmartComponentEditor
    });
    featureEditorApi = mountFeatureEditorPanel({
      panel: featureEditorPanel,
      api,
      selection,
      onLocalObjectProjectChange: hotSwapMemberDetails
    });
    trimJointEditorApi = mountTrimJointEditorPanel({
      panel: trimJointEditorPanel,
      api,
      profiles: profiles.profiles,
      selection,
      onLocalObjectProjectChange: hotSwapMemberDetails,
      onFocusChange: () => renderProjectNow(api.project())
    });
    editorApi = mountEditorUi({
      panel: objectEditor,
      api,
      profiles: profiles.profiles,
      selection,
      memberEdit,
      smartComponentHighlightObjectIds: (smartComponentId) => smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId)),
      onProjectChange: rerender,
      onLocalMemberProjectChange: hotSwapMemberDetails,
      onSmartComponentSelected: (smartComponentId, options) => {
        focusedMemberId = null;
        showSmartComponentEditor(smartComponentId, options);
      },
      onSmartComponentDeleted: () => {
        clearSmartComponentEditor();
        referencePlaneEdit?.clear({ overlay: true });
      },
      onObjectSelected: (objectId, detail = {}) => {
        clearSmartComponentEditor();
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection === "features") {
          trimJointEditorApi?.clear();
          featureEditorApi?.selectFeature(objectId);
          referencePlaneEdit?.selectObject(objectId);
          plateSketchEdit?.clear({ overlay: true });
        } else if (entry?.collection === "trimJoints") {
          featureEditorApi?.clear();
          referencePlaneEdit?.clear({ overlay: true });
          plateSketchEdit?.clear({ overlay: true });
          trimJointEditorApi?.selectTrimJoint(objectId, { operationId: detail.operationId, regionKey: detail.regionKey });
        } else if (entry?.collection === "plates") {
          referencePlaneEdit?.clear({ overlay: true });
          featureEditorApi?.clear();
          trimJointEditorApi?.clear();
          plateSketchEdit?.selectObject(objectId, { sketchMode: detail.sketchMode, notify: false });
          if (detail.relationId) plateSketchEdit?.selectRelation(detail.relationId, { notify: false });
          else if (detail.clearSketchSelection) plateSketchEdit?.clearSelection({ notify: false });
          else if (detail.edgeIds?.length || detail.vertexIds?.length) {
            plateSketchEdit?.selectEntities({ edgeIds: detail.edgeIds, vertexIds: detail.vertexIds }, { notify: false, sketchMode: detail.sketchMode });
          }
          syncSketchRelationsButton();
        } else {
          clearAuxiliaryEditors({ overlay: true });
          syncSketchRelationsButton();
        }
      },
      onObjectCleared: () => {
        clearAuxiliaryEditors({ overlay: true });
        syncSketchRelationsButton();
      }
    });

    if (initialQaSelectObject) {
      try {
        editorApi.selectObject(initialQaSelectObject);
        document.documentElement.dataset.qaSelectedObject = initialQaSelectObject;
        const fitQaSelectedObject = () => {
          const points = viewer.objectPoints([initialQaSelectObject]);
          if (points.length) viewer.fitPoints(points, { padding: 0.7, minSpan: 220 });
        };
        fitQaSelectedObject();
        window.requestAnimationFrame(() => window.requestAnimationFrame(fitQaSelectedObject));
      } catch (error) {
        document.documentElement.dataset.qaSelectedObject = JSON.stringify({ error: error.message });
        console.warn(error);
      }
    }

    customPanel.hidden = true;

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", () => viewer?.resize());
main();
