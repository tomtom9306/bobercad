import { createProjectStore } from "../../engine/store/project-store.mjs?v=trim-create-ui-1";
import { memberAuthoringPoints } from "../../engine/api/project/members.mjs";
import { memberDependencyObjectIds } from "../../engine/api/project/dependencies.mjs?v=plane-region-hard-1";
import { loadConnectionDefinitions } from "../../engine/modules/connections/connection-registry.mjs";
import { buildScene } from "../../rendering/scene/build-scene.mjs?v=butt-contact-plane-1";
import { memberAxesByTarget, normalizeCoordinateSpace } from "../../rendering/scene/authoring/member-axis-space.mjs";
import { createCommandController } from "../../rendering/interaction/command-controller.mjs?v=snap-settings-json-1";
import { createMemberEditController } from "../../rendering/interaction/member-edit-controller.mjs?v=snap-settings-json-1";
import { createReferencePlaneEditController } from "../../rendering/interaction/reference-plane-edit-controller.mjs?v=solidworks-plane-2";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs";
import { createTrimCreateController } from "../../rendering/interaction/trim-create-controller.mjs?v=trim-create-ui-1";
import { createWebglViewer } from "../../rendering/webgl/webgl-renderer.mjs?v=axis-snap-1";
import { createDimensionEditController } from "./dimensions/dimension-edit-controller.mjs?v=reference-plane-1";
import { mountFeatureEditorPanel } from "./panels/feature-editor-panel.mjs?v=reference-plane-1";
import { mountMemberTransformPanel } from "./panels/member-transform-panel.mjs";
import { mountEditorUi } from "./panels/property-panel.mjs?v=relation-types-1";
import { mountTrimJointEditorPanel } from "./panels/trim-joint-editor-panel.mjs?v=trim-region-click-2";
import { mountModelingToolbar } from "./toolbar/modeling-toolbar.mjs?v=trim-create-ui-1";

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
const settingsUrl = new URL("./viewer-settings.json?v=snap-settings-json-1", import.meta.url);
let settings = null;
let viewer = null;
let authoringPreview = [];
let renderedLodDetailBucket = null;
let progressiveDetailRenderToken = 0;

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function sub(a, b) {
  return a.map((value, index) => value - b[index]);
}

function mul(a, scalar) {
  return a.map((value) => value * scalar);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function len(a) {
  return Math.hypot(...a);
}

function norm(a) {
  const length = len(a);
  return length > 1e-9 ? mul(a, 1 / length) : [0, 0, 1];
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pointsBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], point[i]);
      max[i] = Math.max(max[i], point[i]);
    }
  }
  const size = sub(max, min);
  return { min, max, size, center: mul(add(min, max), 0.5), maxSize: Math.max(...size.map(Math.abs), 1) };
}

function boxPoints(bounds) {
  const { min, max } = bounds;
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]]
  ];
}

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

function objectEntry(project, objectId) {
  const entry = project.objectIndex?.[objectId];
  if (!entry?.collection) return null;
  const object = project.model?.[entry.collection]?.[objectId];
  return object ? { collection: entry.collection, object } : null;
}

function profileRadius(profile) {
  const points = (profile?.section?.contours || []).flatMap((contour) => contour.points || []);
  if (!points.length) return 1;
  return Math.max(...points.map((point) => Math.hypot(point[0], point[1])), 1);
}

function plateRadius(plate) {
  const outline = Array.isArray(plate.outline) && plate.outline.length
    ? plate.outline
    : [
        [-(plate.width || 1) / 2, -(plate.height || plate.depth || 1) / 2],
        [(plate.width || 1) / 2, (plate.height || plate.depth || 1) / 2]
      ];
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
  const entry = objectEntry(project, objectId);
  if (!entry) return 1;
  const { collection, object } = entry;

  if (collection === "members") return memberRadius(project, profiles, object);
  if (collection === "plates") return plateRadius(object);
  if (collection === "fastenerGroups") {
    const pattern = project.model.holePatterns?.[object.holePatternRef];
    const feature = project.model.features?.[object.through?.fromFeatureId];
    const patternRadius = Math.max(...(pattern?.positions || [[0, 0]]).map((point) => Math.hypot(point[0] || 0, point[1] || 0)), 1);
    return patternRadius + Math.max(object.assembly?.length || settings.render.fasteners.length || 1, estimateObjectRadius(project, profiles, feature?.ownerId, seen) * 0.25);
  }
  if (collection === "features") return Math.max(1, estimateObjectRadius(project, profiles, object.ownerId, seen) * 0.25);
  if (collection === "welds") {
    return Math.max(1, ...(object.participants || []).map((id) => estimateObjectRadius(project, profiles, id, seen) * 0.25));
  }
  if (collection === "connectionZones") return 750;
  return 1;
}

function memberConnectionDetailObjectIds(project, memberId) {
  return memberDependencyObjectIds(project, memberId, { includeMember: false, includeConnectionMembers: false, renderableOnly: true });
}

function averagePoints(points) {
  const valid = points.filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
  if (!valid.length) return null;
  return valid.reduce((sum, point) => add(sum, point), [0, 0, 0]).map((value) => value / valid.length);
}

function memberCenter(member) {
  if (!Array.isArray(member?.start) || !Array.isArray(member?.end)) return null;
  return mul(add(member.start, member.end), 0.5);
}

function objectCenter(project, objectId, seen = new Set()) {
  if (!objectId || seen.has(objectId)) return null;
  seen.add(objectId);
  const entry = objectEntry(project, objectId);
  if (!entry) return null;
  const { collection, object } = entry;

  if (collection === "members") return memberCenter(object);
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
    const centers = (object.participants || []).map((id) => objectCenter(project, id, seen)).filter(Boolean);
    return averagePoints(centers);
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
  const threshold = Number.isFinite(settings.render.lod?.detailPixelThreshold)
    ? settings.render.lod.detailPixelThreshold
    : 24;
  const maxAutoDetails = Number.isFinite(settings.render.lod?.maxAutoDetailObjects)
    ? Math.max(0, Math.floor(settings.render.lod.maxAutoDetailObjects))
    : 600;
  const forced = new Set(detailContext.forceDetailObjectIds || []);
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
  const axes = [basis.normal, basis.localAxisY, basis.localAxisZ].filter(Boolean).map(norm);
  const expanded = [...points];
  for (const point of points) {
    for (const axis of axes) {
      expanded.push(add(point, mul(axis, margin)), add(point, mul(axis, -margin)));
    }
  }
  return expanded;
}

function connectionOwnedIds(connection) {
  return [
    ...flattenIds(connection.generator?.objectRoles),
    ...(connection.generator?.ownedObjectIds || []),
    ...flattenIds(connection.manualParts)
  ];
}

function connectionHighlightObjectIds(project, objectIds = []) {
  const highlightCollections = new Set(["plates", "fastenerGroups", "welds"]);
  return objectIds.filter((objectId) => highlightCollections.has(project.objectIndex?.[objectId]?.collection));
}

function isolatedConnectionProject(project, connection, visibleConnectionObjectIds) {
  const next = clone(project);
  const visibleObjects = new Set(visibleConnectionObjectIds);
  visibleObjects.add(connection.mainMemberId);
  visibleObjects.add(connection.secondaryMemberId);

  for (const [memberId, member] of Object.entries(next.model.members || {})) {
    if (visibleObjects.has(memberId)) {
      member.featureIds = (member.featureIds || []).filter((featureId) => visibleObjects.has(featureId));
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

function connectionPrimaryPlate(project, connection) {
  const roles = connection.generator?.objectRoles || {};
  const preferredRoles = ["endPlate", "finPlate", "gussetPlate", "basePlate"];
  for (const role of preferredRoles) {
    const plate = project.model.plates?.[roles[role]];
    if (plate) return plate;
  }
  return connectionOwnedIds(connection).map((id) => project.model.plates?.[id]).find(Boolean) || null;
}

function memberAxis(project, memberId) {
  const member = project.model.members?.[memberId];
  if (!member) return null;
  const axis = sub(member.end, member.start);
  const length = len(axis);
  if (length <= 1e-9) return null;
  return { member, axis: mul(axis, 1 / length), length };
}

function connectionBasis(project, connection) {
  const plate = connectionPrimaryPlate(project, connection);
  if (plate?.normal && plate?.localAxisY && plate?.localAxisZ) {
    return {
      normal: norm(plate.normal),
      localAxisY: norm(plate.localAxisY),
      localAxisZ: norm(plate.localAxisZ)
    };
  }
  const secondary = memberAxis(project, connection.secondaryMemberId);
  const main = memberAxis(project, connection.mainMemberId);
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
  const pitch = Math.acos(Math.max(-1, Math.min(1, -d[2])));
  const horizontal = Math.hypot(d[0], d[1]);
  const yaw = horizontal <= 1e-9 ? 0 : Math.atan2(-d[0], -d[1]);
  return { yaw, pitch };
}

function memberContextPoints(project, memberId, center, radius) {
  const data = memberAxis(project, memberId);
  if (!data) return [];
  const station = Math.max(0, Math.min(data.length, dot(sub(center, data.member.start), data.axis)));
  return [
    add(data.member.start, mul(data.axis, Math.max(0, station - radius))),
    add(data.member.start, mul(data.axis, Math.min(data.length, station + radius)))
  ];
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
  const demo = new URLSearchParams(window.location.search).get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  meta.textContent = `${Object.keys(project.model.members).length} members\n${Object.keys(project.model.plates).length} plates\n${Object.keys(project.model.fastenerGroups).length} fastener groups`;
}

function renderProject(project, profiles, fasteners, options = {}) {
  const {
    activeConnectionId = null,
    activeTrimJointId = null,
    activeTrimOperationId = null,
    previewMembers = authoringPreview,
    forceDetailObjectIds = [],
    ...viewerOptions
  } = options;
  const progressiveDetails = shouldUseProgressiveDetails(project);
  const profileMap = profiles.profiles || profiles;
  const detailContext = () => ({
    projectPoint: (point) => viewer.projectPoint(point),
    viewport: viewer.viewportSize(),
    forceDetailObjectIds
  });

  if (progressiveDetails && !viewerOptions.preserveCamera) {
    const detailToken = ++progressiveDetailRenderToken;
    const coarseScene = buildScene(project, profiles, fasteners, settings, {
      activeConnectionId,
      activeTrimJointId,
      activeTrimOperationId,
      previewMembers,
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
          activeConnectionId,
          activeTrimJointId,
          activeTrimOperationId,
          previewMembers,
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
  viewer.setScene(buildScene(project, profiles, fasteners, settings, { activeConnectionId, activeTrimJointId, activeTrimOperationId, previewMembers, lodDetailFilter }), {
    ...viewerOptions,
    preserveCamera: progressiveDetails || viewerOptions.preserveCamera
  });
  updateMeta(project);
}
function mountQaApi({ api, profiles, fasteners }) {
  const connectionSummaries = () => Object.values(api.project().model.connections || {}).map((connection) => ({
    id: connection.id,
    type: connection.type,
    name: connection.bim?.name || connection.sourcePreset?.id || connection.id,
    mainMemberId: connection.mainMemberId,
    secondaryMemberId: connection.secondaryMemberId,
    health: connection.generator?.health || "ok"
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
    const profileMap = profiles.profiles || profiles;
    const connectionCounts = new Map();
    for (const connection of Object.values(project.model.connections || {})) {
      for (const memberId of [connection.mainMemberId, connection.secondaryMemberId]) {
        if (!memberId) continue;
        connectionCounts.set(memberId, (connectionCounts.get(memberId) || 0) + 1);
      }
    }
    const members = Object.values(project.model.members || {})
      .filter((member) => member.display?.visible !== false && (!options.memberId || member.id === options.memberId));
    let best = null;
    for (const member of members) {
      const affectedConnections = connectionCounts.get(member.id) || 0;
      if (options.connected !== false && !options.memberId && affectedConnections <= 0) continue;
      const points = memberAuthoringPoints(member);
      const center = clientPoint(points.center);
      if (!center?.inside || !center.hitCanvas) continue;
      const start = clientPoint(points.physicalStart);
      const end = clientPoint(points.physicalEnd);
      const lengthPx = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
      const radiusPx = profileRadius(profileMap[member.profile]) * viewer.screenScale();
      const viewport = center.viewport;
      const centerDistance = Math.hypot(center.screen.x - viewport.width / 2, center.screen.y - viewport.height / 2);
      const score = affectedConnections * 25 + radiusPx * 10 + lengthPx * 0.1 - centerDistance * 0.02;
      if (!best || score > best.score) {
        best = {
          memberId: member.id,
          score,
          affectedConnections,
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

  const memberConnectionObjectIds = (memberId) => {
    const project = api.project();
    const ids = [];
    for (const connection of Object.values(project.model.connections || {})) {
      if (connection.mainMemberId !== memberId && connection.secondaryMemberId !== memberId) continue;
      ids.push(
        ...flattenIds(connection.generator?.objectRoles),
        ...(connection.generator?.ownedObjectIds || []),
        ...flattenIds(connection.manualParts)
      );
    }
    return [...new Set(ids)].filter((id) => project.objectIndex?.[id] && id !== memberId);
  };

  const memberConnectionPoints = (memberId) => {
    const objectIds = memberConnectionObjectIds(memberId);
    const points = viewer.objectPoints(objectIds);
    return {
      memberId,
      objectIds,
      pointCount: points.length,
      center: averagePoints(points)
    };
  };

  const captureConnectionView = async (options = {}) => {
    const connectionId = options.connectionId;
    const project = api.project();
    const connection = project.model.connections?.[connectionId];
    if (!connection) throw new Error(`connection not found: ${connectionId}`);

    const previousAxesVisible = settings.render.axes.visible;
    const connectionObjectIds = api.connectionObjectIds(connectionId);
    const captureProject = options.isolate === false
      ? project
      : isolatedConnectionProject(project, connection, connectionObjectIds);
    if (options.hideAxes !== false) settings.render.axes.visible = false;
    renderProject(captureProject, profiles, fasteners, { preserveCamera: true, activeConnectionId: connectionId });
    settings.render.axes.visible = previousAxesVisible;
    viewer.setDimensionOverlay({ lines: [], labels: [] });

    const basis = connectionBasis(project, connection);
    if (options.highlight) viewer.setHighlightedObjects(connectionHighlightObjectIds(project, connectionObjectIds));
    else viewer.setHighlightedObjects([]);

    const zone = project.model.connectionZones?.[connection.connectionZoneId];
    const seedPoints = [
      ...(Array.isArray(zone?.origin) ? [zone.origin] : []),
      ...viewer.objectPoints(connectionObjectIds)
    ];
    const seedBounds = pointsBounds(seedPoints.length ? seedPoints : [[0, 0, 0]]);
    const memberRadius = Math.max(options.memberContext || 520, seedBounds.maxSize * 1.15);
    const focusPoints = [
      ...seedPoints,
      ...memberContextPoints(project, connection.mainMemberId, seedBounds.center, memberRadius),
      ...memberContextPoints(project, connection.secondaryMemberId, seedBounds.center, memberRadius)
    ];
    const focusBounds = pointsBounds(focusPoints);
    const margin = Math.max(options.margin || 0, Math.min(650, Math.max(140, focusBounds.maxSize * 0.12)));
    const fitPoints = expandedPoints([...focusPoints, ...boxPoints(focusBounds)], basis, margin);
    const angles = cameraAnglesForDirection(viewDirection(basis, options.view || "iso"));
    viewer.fitPoints(fitPoints, {
      ...angles,
      padding: finiteNumber(options.padding) ? options.padding : 0.74,
      minSpan: options.minSpan || 520
    });

    await waitFrame();
    await waitFrame();
    const dataUrl = viewer.canvasDataUrl("image/png");
    return {
      dataUrl,
      connection: connectionSummaries().find((item) => item.id === connectionId),
      view: options.view || "iso",
      camera: angles,
      focus: {
        center: focusBounds.center,
        size: focusBounds.size,
        pointCount: fitPoints.length
      }
    };
  };

  window.__boberCadQa = {
    version: 1,
    ready: true,
    connectionSummaries,
    memberInteractionTarget,
    memberManipulatorTargets,
    memberState,
    memberConnectionObjectIds,
    memberConnectionPoints,
    captureConnectionView
  };
}

async function main() {
  try {
    settings = await loadJson(settingsUrl);
    const projectUrl = new URL(projectPath(), settingsUrl);
    const project = await loadJson(projectUrl);
    const profilesUrl = new URL(project.libraries.profiles.path, projectUrl);
    const fastenersUrl = new URL(project.libraries.fasteners.path, projectUrl);
    const [profiles, fasteners, connectionCatalog] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadConnectionDefinitions()]);

    viewer = createWebglViewer(canvas, reset, settings);
    applyUiSettings(project);

    const api = createProjectStore({
      project,
      profiles: profiles.profiles,
      connectionCatalog,
      fasteners,
      cloneOnLoad: !shouldUseProgressiveDetails(project)
    });
    const selection = createSelectionController({ viewer });
    let commandController = null;
    let trimCreate = null;
    let autoRelationsEnabled = settings.authoring?.autoAxisRelations !== false;
    function startTrimCreate() {
      commandController?.cancel();
      modelingUi.setActive("trim");
      dimensionEdit?.clearDimension({ render: false });
      memberEdit?.clear({ notify: false });
      referencePlaneEdit?.clear();
      featureEditorApi?.clear();
      trimJointEditorApi?.clear();
      trimCreate?.start();
    }
    const modelingUi = mountModelingToolbar({
      toolbar: modelingToolbar,
      status: modelingStatus,
      onBeam: () => commandController?.startBeam(),
      onColumn: () => commandController?.startColumn(),
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
      }
    });
    let dimensionEdit = null;
    let focusedMemberId = null;
    let editorApi = null;
    let featureEditorApi = null;
    let trimJointEditorApi = null;
    let memberEdit = null;
    let referencePlaneEdit = null;
    const focusedDetailObjectIds = () => focusedMemberId ? memberConnectionDetailObjectIds(api.project(), focusedMemberId) : [];
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
        activeConnectionId: dimensionEdit?.connectionId() || null,
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
      const renderIds = new Set([memberId, ...objectIds].filter(Boolean));
      if (!renderIds.size) return false;
      clearQueuedRerender();
      clearDetailRefresh();
      progressiveDetailRenderToken += 1;
      renderedLodDetailBucket = shouldUseProgressiveDetails(nextProject) ? lodDetailBucket(viewer.screenScale()) : null;

      const patchScene = buildScene(nextProject, profiles, fasteners, settings, {
        activeConnectionId: dimensionEdit?.connectionId() || null,
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
      onCancel: () => memberEdit?.cancelPendingTransform()
    });
    memberEdit = createMemberEditController({
      viewer,
      api,
      selection,
      settings,
      onLocalProjectChange: hotSwapMemberDetails,
      onMemberSelected: (memberId) => {
        focusedMemberId = memberId;
        referencePlaneEdit?.clear();
        editorApi?.selectMember(memberId, { fromMemberEdit: true });
        if (dimensionEdit?.connectionId()) {
          dimensionEdit.clearAll();
          customPanel.hidden = true;
          renderProjectNow(api.project());
        }
        featureEditorApi?.clear();
        trimJointEditorApi?.clear();
      },
      onCleared: () => {
        focusedMemberId = null;
        referencePlaneEdit?.clear();
        editorApi?.clearSelection({ fromMemberEdit: true });
        featureEditorApi?.clear();
        trimJointEditorApi?.clear();
      },
      onTransformChange: (state) => memberTransformUi.update(state),
      autoRelationsEnabled: () => autoRelationsEnabled
    });
    referencePlaneEdit = createReferencePlaneEditController({
      viewer,
      api,
      onLocalObjectProjectChange: hotSwapMemberDetails
    });
    const authoringTarget = (input) => input?.handle?.kind === "reference-plane-corner" ? referencePlaneEdit.authoringHandler : memberEdit.authoringHandler;
    viewer.setAuthoringHandler({
      beginDrag: (input) => authoringTarget(input)?.beginDrag?.(input),
      click: (input) => authoringTarget(input)?.click?.(input),
      drag: (input) => authoringTarget(input)?.drag?.(input),
      end: (input) => authoringTarget(input)?.end?.(input),
      cancel: (input) => authoringTarget(input)?.cancel?.(input)
    });
    viewer.setClickHandler((face) => {
      if (!face) dimensionEdit?.clearDimension();
      if (trimJointEditorApi?.toggleRegionFromFace(face)) {
        memberEdit.clear({ notify: false });
        featureEditorApi?.clear();
        referencePlaneEdit?.clear({ overlay: true });
        return;
      }
      if (face?.collection && face.collection !== "members" && face.objectId) {
        memberEdit.clear({ notify: false });
        editorApi?.selectObject(face.objectId, face);
        return;
      }
      memberEdit.handleSceneClick(face);
    });
    const showConnectionEditor = (connectionId, options = {}) => {
      focusedMemberId = null;
      memberEdit.clear({ notify: false });
      referencePlaneEdit?.clear();
      featureEditorApi?.clear();
      trimJointEditorApi?.clear();
      selection.select(connectionHighlightObjectIds(api.project(), api.connectionObjectIds(connectionId)));
      const focus = dimensionEdit.selectConnection(connectionId, options);
      const definition = api.definition(connectionId);
      definition.customUi.mountConnectionUi({
        panel: customPanel,
        definition,
        connectionId,
        api,
        focusPath: focus.path,
        focusMode: focus.mode,
        focusInput: !options.focusLabel,
        onPanelFocus: () => {
          dimensionEdit.stopLabelEdit();
        },
        onProjectChange: rerender,
        onConnectionDeleted: () => {
          dimensionEdit.clearAll();
          customPanel.hidden = true;
          renderProject(api.project(), profiles, fasteners, { preserveCamera: true });
          memberEdit.clear({ notify: false });
          referencePlaneEdit?.clear();
          featureEditorApi?.clear();
          trimJointEditorApi?.clear();
          selection.clear();
        }
      });
      renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeConnectionId: dimensionEdit.connectionId() });
      dimensionEdit.render();
    };
    dimensionEdit = createDimensionEditController({
      viewer,
      api,
      profiles: profiles.profiles,
      settings,
      getEditorApi: () => editorApi,
      onProjectChange: rerender,
      openConnectionEditor: showConnectionEditor
    });
    viewer.setDoubleClickHandler((face) => {
      try {
        const result = api.toggleConnectionComponentFromFace(face);
        if (!result) return;
        dimensionEdit.clearDimension({ render: false });
        editorApi?.selectConnection(result.component.connectionId);
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
      onPreviewChange: (previewMembers) => {
        authoringPreview = previewMembers || [];
        renderProject(api.project(), profiles, fasteners, { preserveCamera: true, activeConnectionId: dimensionEdit?.connectionId() || null });
      },
      onOverlayChange: (overlay) => viewer.setAuthoringOverlay(overlay),
      onProjectChange: rerender,
      onStatusChange: (message) => {
        modelingUi.setStatus(message);
        if (message === "No modeling command") modelingUi.setActive(null);
      },
      onCommandStart: (type) => {
        trimCreate?.cancel();
        modelingUi.setActive(type);
        dimensionEdit?.clearDimension({ render: false });
        memberEdit.clear({ notify: false });
        referencePlaneEdit?.clear();
        featureEditorApi?.clear();
        trimJointEditorApi?.clear();
        selection.clear();
      },
      autoRelationsEnabled: () => autoRelationsEnabled
    });
    trimCreate = createTrimCreateController({
      api,
      selection,
      onProjectChange: rerender,
      onTrimCreated: (trimJointId) => {
        focusedMemberId = null;
        dimensionEdit?.clearDimension({ render: false });
        memberEdit.clear({ notify: false });
        referencePlaneEdit?.clear({ overlay: true });
        featureEditorApi?.clear();
        trimJointEditorApi?.selectTrimJoint(trimJointId);
        modelingUi.setActive(null);
      },
      onCommandEnd: () => modelingUi.setActive(null),
      onStatusChange: (message) => {
        modelingUi.setStatus(message);
        if (message === "No modeling command") modelingUi.setActive(null);
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.target instanceof Element && memberTransformPanel.contains(event.target)) return;
      if (event.key === "Enter" && memberEdit.confirmPendingTransform()) {
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape") return;
      if (trimCreate?.cancel()) {
        modelingUi.setActive(null);
        event.preventDefault();
        return;
      }
      if (memberEdit.cancelPendingTransform()) {
        event.preventDefault();
        return;
      }
      if (dimensionEdit.clearDimension()) event.preventDefault();
    }, { capture: true });

    renderProject(api.project(), profiles, fasteners);
    connectionCatalog.customUi.mountConnectionLibraryUi({
      panel: libraryPanel,
      api,
      selection,
      onProjectChange: rerender,
      onConnectionCreated: showConnectionEditor
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
      connectionHighlightObjectIds: (connectionId) => connectionHighlightObjectIds(api.project(), api.connectionObjectIds(connectionId)),
      onProjectChange: rerender,
      onLocalMemberProjectChange: hotSwapMemberDetails,
      onConnectionSelected: (connectionId, options) => {
        focusedMemberId = null;
        showConnectionEditor(connectionId, options);
      },
      onConnectionDeleted: () => {
        dimensionEdit.clearAll();
        customPanel.hidden = true;
        referencePlaneEdit?.clear({ overlay: true });
      },
      onObjectSelected: (objectId, detail = {}) => {
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection === "features") {
          trimJointEditorApi?.clear();
          featureEditorApi?.selectFeature(objectId);
          referencePlaneEdit?.selectObject(objectId);
        } else if (entry?.collection === "trimJoints") {
          featureEditorApi?.clear();
          referencePlaneEdit?.clear({ overlay: true });
          trimJointEditorApi?.selectTrimJoint(objectId, { operationId: detail.operationId, regionKey: detail.regionKey });
        } else {
          featureEditorApi?.clear();
          referencePlaneEdit?.clear({ overlay: true });
          trimJointEditorApi?.clear();
        }
      },
      onObjectCleared: () => {
        referencePlaneEdit?.clear({ overlay: true });
        featureEditorApi?.clear();
        trimJointEditorApi?.clear();
      }
    });

    customPanel.hidden = true;
    mountQaApi({ api, profiles, fasteners });

  } catch (error) {
    title.textContent = "Viewer error";
    meta.textContent = error.message;
    console.error(error);
  }
}

window.addEventListener("resize", () => viewer?.resize());
main();
