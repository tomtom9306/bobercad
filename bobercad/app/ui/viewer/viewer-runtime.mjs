import { createProjectStore } from "../../engine/store/project-command-store.mjs?v=generated-properties-zone-interface-edit-1";
import { arrayValues, jsonClone, uniqueTruthy } from "../../engine/core/model.mjs?v=array-values-dry-1";
import { averageVec3, bounds3, bounds3Corners, clamp, distance2, finiteNumber, finiteNumberOr, screenDistance, validVec3Points, v } from "../../engine/core/math.mjs?v=integer-number-dry-1";
import { memberAuthoringPoints, memberAxisData, memberCenter, memberStationAtPoint } from "../../engine/api/project/members.mjs?v=member-api-distance-dry-1";
import { projectProfileCatalog } from "../../engine/api/project/profiles.mjs?v=profile-api-dry-1";
import { plateOutline as sketchPlateOutline } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs?v=plate-relation-resolve-relax-1";
import { objectCollection } from "../../engine/api/project/objects.mjs?v=array-values-dry-1";
import { memberDependencyObjectIds, smartComponentConnectionZoneId, smartComponentDetachedObjectIds, smartComponentMainMemberId, smartComponentOwnedObjectIds, smartComponentSecondaryMemberId } from "../../engine/api/project/dependencies.mjs?v=array-values-dry-1";
import { loadSmartComponentDefinitions } from "../../engine/modules/smart-components/smart-component-registry.mjs?v=smart-parameter-shell-1";
import { buildScene } from "../../rendering/scene/scene-geometry-builder.mjs?v=visibility-menu-1";
import { memberAxesByTarget, normalizeCoordinateSpace } from "../../rendering/scene/authoring/member-axis-space.mjs?v=final-array-values-dry-1";
import { createCommandController } from "../../rendering/interaction/command-controller.mjs?v=member-reference-snap-1-own-axis-restore-1";
import { createMemberEditController } from "../../rendering/interaction/member-transform-edit-controller.mjs?v=endpoint-drag-snap-3";
import { createPlateSketchEditController } from "../../rendering/interaction/plate-sketch-drag-edit-controller.mjs?v=unified-snap-manager-9";
import { createReferencePlaneEditController } from "../../rendering/interaction/reference-plane-edit-controller.mjs?v=work-plane-point-dry-1";
import { createSelectionController } from "../../rendering/interaction/selection-controller.mjs?v=unified-snap-manager-10";
import { createSnapManager } from "../../rendering/interaction/snap-manager.mjs?v=member-hover-snap-2";
import { createTrimCreateController } from "../../rendering/interaction/trim-create-controller.mjs?v=trim-create-inline-1";
import { isTextInput, matchesShortcut, shortcutSetting } from "../../rendering/interaction/keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { createWebglViewer } from "../../rendering/webgl/webgl-viewer-runtime.mjs?v=member-hover-snap-2-nav-cube-orientation-1";
import { createDimensionEditController } from "./dimensions/dimension-edit-controller.mjs?v=unified-dimension-overlay-1";
import { mountFeatureEditorPanel } from "./panels/feature-editor-panel.mjs?v=reset-sections-1";
import { mountMemberTransformPanel } from "./panels/member-transform-panel.mjs?v=reset-sections-1";
import { mountEditorUi } from "./panels/inspector-panel.mjs?v=plate-relation-fields-1";
import { mountTrimJointEditorPanel } from "./panels/trim-joint-editor-panel.mjs?v=trim-operation-icons-1";
import { mountFeatureNavbar } from "../shell/feature-navbar.mjs?v=tooltip-clean-1";
import { mountCommandPalette } from "../shell/command-palette.mjs?v=model-grid-navbar-1";
import { mountDockTabs } from "../shell/dock-tabs.mjs?v=side-dock-rail-toggle-6-click-reveal-2";
import { mountInspectorDock } from "../shell/inspector-dock.mjs?v=right-dock-tabs-1";
import { mountStatusBar } from "../shell/status-bar.mjs?v=topbar-file-settings-1";
import { mountToolbarWorkspaceCustomization, normalizeViewerOverlaysWorkspace, withWorkspaceCommand } from "../shell/workspace-customizer-panel.mjs?v=workspace-settings-tabs-2";
import { COMMAND_GROUP_ORDER } from "../commands/command-group-metadata.mjs?v=command-groups-1";
import {
  DATA_DOCK_COMMAND_LABEL,
  DATA_DOCK_DEFAULT_TAB,
  DATA_DOCK_LEGACY_TAB_STORAGE_KEY,
  DATA_DOCK_PANEL_DEFAULT_PINNED,
  DATA_DOCK_PANEL_DEFAULT_VISIBLE,
  DATA_DOCK_PANEL_DEFAULT_WIDTH,
  DATA_DOCK_PANEL_DESCRIPTION,
  DATA_DOCK_PANEL_DOCK,
  DATA_DOCK_PANEL_ICON,
  DATA_DOCK_PANEL_ID,
  DATA_DOCK_PANEL_LABEL,
  DATA_DOCK_PANEL_MAX_WIDTH,
  DATA_DOCK_PANEL_MIN_WIDTH,
  DATA_DOCK_TABS,
  dataDockTabLabel
} from "../commands/data-dock-metadata.mjs?v=data-dock-metadata-1";
import { leftDockResultSpecs, validLeftDockResultAction } from "../commands/left-dock-result-metadata.mjs?v=left-dock-result-metadata-1";
import {
  INSPECTOR_ACTIVE_CONTEXT_STORAGE_KEY,
  INSPECTOR_CONTEXTS,
  INSPECTOR_DEFAULT_CONTEXT,
  INSPECTOR_PANEL_DEFAULT_VISIBLE,
  INSPECTOR_PANEL_DEFAULT_WIDTH,
  INSPECTOR_PANEL_DESCRIPTION,
  INSPECTOR_PANEL_DOCK,
  INSPECTOR_PANEL_ICON,
  INSPECTOR_PANEL_ID,
  INSPECTOR_PANEL_LABEL,
  INSPECTOR_PANEL_MAX_WIDTH,
  INSPECTOR_PANEL_MIN_WIDTH,
  inspectorContextLabel,
  inspectorContextSpec
} from "../commands/inspector-dock-metadata.mjs?v=inspector-context-commands-1";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength, snapScopeMode, snapScopeModeLabel, snapTargetLabel } from "../commands/snap-metadata.mjs?v=snap-metadata-1";
import { DISPLAY_MODE_SPECS, VIEW_ORIENTATION_SPECS, activeViewOrientation, displayModeLabel, normalizeDisplayMode, normalizeViewOrientation, normalizeViewOrientationState, viewOrientationLabel } from "../commands/view-metadata.mjs?v=view-metadata-1";
import { applyTooltip, topbarMenuButton } from "../design-system/ui-elements.mjs?v=tooltip-clean-1";
import { createViewerAppController } from "./viewer-app-controller.mjs?v=active-command-state-1";
import { createViewerCommandItems, createViewerPanelCommandActions } from "./viewer-command-adapter.mjs?v=visibility-menu-1";
import { mountModelingToolbar } from "./toolbar/modeling-toolbar.mjs?v=top-nav-commands-1";
import { mountModelBrowser } from "./model-browser.mjs?v=model-collection-metadata-1";
import { mountProjectDataPanel } from "./project-data-panel.mjs?v=model-collection-metadata-1";
import { mountProjectFilesPanel } from "./project-files-panel.mjs?v=project-files-tab-1";
import { mountSmartComponentBrowser } from "./smart-component-browser.mjs?v=smart-component-browser-1";
import { mountNavCube } from "./nav-cube.mjs?v=nav-cube-hit-test-1";
import { mountViewerSettingsStrip } from "./viewer-settings-strip.mjs?v=visibility-menu-1";
import { createIcon } from "../icons/icon-registry.mjs?v=dock-pin-1";

const canvas = document.getElementById("view");
const title = document.getElementById("title");
const meta = document.getElementById("meta");
const reset = document.getElementById("reset");
const hud = document.getElementById("hud");
const featureNavbarRoot = document.getElementById("feature-navbar");
const commandPaletteButton = document.getElementById("command-palette-open");
const topbarFileButton = document.getElementById("topbar-file-open");
const commandPaletteRoot = document.getElementById("command-palette");
const viewerSettingsRoot = document.getElementById("viewer-settings-strip");
const navCubeRoot = document.getElementById("nav-cube");
const modelingToolbar = document.getElementById("modeling-toolbar");
const modelingStatus = document.getElementById("modeling-status");
const statusBarRoot = document.querySelector(".bc-statusbar");
const memberTransformPanel = document.getElementById("member-transform-panel");
const libraryPanel = document.getElementById("library-panel");
const projectFilesPanelRoot = document.getElementById("project-files-panel");
const projectDataPanelRoot = document.getElementById("project-data-panel");
const modelBrowserRoot = document.getElementById("model-browser");
const smartComponentLibraryPanel = document.getElementById("smart-component-library");
const libraryDock = document.querySelector(".bc-left-dock");
const inspectorDock = document.querySelector(".bc-right-dock");
const inspectorPanelByContext = new Map(INSPECTOR_CONTEXTS.map((context) => [
  context.id,
  document.querySelector(`[data-inspector-context-panel="${context.panelSlot || context.id}"]`)
]));
const objectEditor = inspectorContextPanel("properties");
const featureEditorPanel = inspectorContextPanel("feature");
const trimJointEditorPanel = inspectorContextPanel("trim");
const customPanel = inspectorContextPanel("component");
const initialSearchParams = new URLSearchParams(window.location.search);
const initialQaView = initialSearchParams.get("qaView");
const initialQaCapture = initialSearchParams.has("qaCapture");
const initialQaDebug = initialSearchParams.has("qaDebug");
const initialQaSelectObject = initialSearchParams.get("qaSelectObject");
const TOPBAR_FILE_COMMAND_QUERY = "file";
const settingsUrl = new URL("./viewer-settings.json?v=visibility-menu-1", import.meta.url);
const defaultWorkspaceUrl = new URL("../workspaces/default-workspace.json?v=render-visibility-1", import.meta.url);
const GRID_CREATE_DISABLED_REASON = "Grid creation is planned; edit existing grid systems from Data and Properties for now.";
const RENDER_VISIBILITY_LABELS = {
  cuttingObjects: "Cutting objects",
  fasteners: "Fasteners",
  referencePlanes: "Planes"
};

function inspectorContextPanel(contextId) {
  return inspectorPanelByContext.get(contextId) || null;
}

let settings = null;
let viewer = null;
let authoringPreview = [];
let authoringPreviewPlates = [];
let renderedLodDetailBucket = null;
let progressiveDetailRenderToken = 0;
const { add, sub, mul, dot, len } = v;
const norm = (point) => v.safeNorm(point, [0, 0, 1]);
const MODELING_COMMAND_ID_BY_TYPE = {
  beam: "model.beam.create",
  column: "model.column.create",
  plate: "model.plate.create",
  sketch: "model.sketch.create",
  workPlane: "model.workPlane.set",
  plateBend: "model.plateBend.add",
  trim: "model.trim.create"
};
decorateResetAction(reset);
decorateTopbarFileAction(topbarFileButton);

function requiredVec3(value, label) {
  if (!v.isVec3(value)) throw new Error(`viewer: ${label} must be a finite [x, y, z] vector`);
  return value;
}

function decorateResetAction(button) {
  if (!button) return;
  button.classList.remove("bc-text-button");
  button.classList.add("bc-icon-button", "bc-viewer-overlay-action");
  button.setAttribute("aria-label", "Reset view");
  applyTooltip(button, "Reset view");
  button.replaceChildren(createIcon("reset-view"));
}

function decorateTopbarFileAction(button) {
  if (!button) return;
  topbarMenuButton(button, {
    icon: "file",
    label: "File",
    title: "File actions",
    ariaLabel: "File actions",
    className: "bc-topbar-menu-button",
    labelClassName: "bc-topbar-menu-label"
  });
}

function requiredDirection(value, label) {
  const direction = v.safeNorm(requiredVec3(value, label));
  if (len(direction) <= 1e-9) throw new Error(`viewer: ${label} must have non-zero length`);
  return direction;
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

function profileRadius(profile) {
  const points = arrayValues(profile?.section?.contours).flatMap((contour) => arrayValues(contour.points));
  if (!points.length) return 1;
  return Math.max(...points.map((point) => distance2(point, [0, 0])), 1);
}

function plateRadius(plate) {
  if (!finiteNumber(plate.thickness) || plate.thickness <= 0) throw new Error(`${plate.id}: plate thickness must be positive`);
  const outline = sketchPlateOutline(plate);
  const y = Math.max(...outline.map((point) => Math.abs(point[0] || 0)), 1);
  const z = Math.max(...outline.map((point) => Math.abs(point[1] || 0)), 1);
  return Math.hypot(y, z, plate.thickness / 2);
}

function memberRadius(project, profiles, member) {
  const profile = profiles[member.profile];
  if (!profile) throw new Error(`${member.id}: profile not found: ${member.profile}`);
  const axisLength = len(sub(requiredVec3(member.end, `${member.id}.end`), requiredVec3(member.start, `${member.id}.start`)));
  return axisLength / 2 + profileRadius(profile);
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
    if (!Array.isArray(pattern?.positions)) throw new Error(`${object.id}: fastener group hole pattern not found: ${object.holePatternRef}`);
    const patternRadius = Math.max(...pattern.positions.map((point) => distance2([point[0] || 0, point[1] || 0], [0, 0])), 1);
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

async function loadRegisteredFrameLibrary(project, projectUrl) {
  const frameRegisterPath = project?.libraries?.frames?.path;
  if (!frameRegisterPath) return null;
  const registerUrl = new URL(frameRegisterPath, projectUrl);
  const register = await loadJson(registerUrl);
  const [libraryPath] = Array.isArray(register?.libraries) ? register.libraries : [];
  if (!libraryPath) return null;
  const libraryUrl = new URL(`${libraryPath.replace(/\/?$/, "/")}config.json`, registerUrl);
  return loadJson(libraryUrl);
}

function applyUiSettings(project) {
  if (hud) hud.hidden = !settings.ui.showHud;
  if (meta) meta.hidden = !settings.ui.showMeta;
  if (reset) reset.hidden = !settings.ui.showResetButton;
  if (title) title.textContent = settings.ui.title === "project-name" ? project.project.name : settings.ui.title;
}

function projectPath() {
  const demo = initialSearchParams.get("demo");
  return settings.project.demos?.[demo]?.path || settings.project.path;
}

function updateMeta(project) {
  if (!meta) return;
  meta.textContent = `${Object.keys(project.model.members).length} members | ${Object.keys(project.model.plates).length} plates | ${Object.keys(project.model.sketches || {}).length} sketches | ${Object.keys(project.model.fastenerGroups).length} fasteners`;
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

function previewOnlyProject(project) {
  return {
    schemaVersion: project?.schemaVersion,
    units: project?.units,
    settings: project?.settings || {},
    libraries: project?.libraries || {},
    objectIndex: {},
    model: {
      profiles: project?.model?.profiles || {},
      members: {},
      plates: {},
      sketches: {},
      features: {},
      trimJoints: {},
      fastenerGroups: {},
      welds: {},
      smartComponentInstances: {}
    }
  };
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
    const materialsUrl = new URL(project.libraries.materials.path, projectUrl);
    const [profiles, fasteners, materials, frames, smartComponentCatalog, defaultWorkspace] = await Promise.all([loadJson(profilesUrl), loadJson(fastenersUrl), loadJson(materialsUrl), loadRegisteredFrameLibrary(project, projectUrl), loadSmartComponentDefinitions(), loadJson(defaultWorkspaceUrl)]);

    viewer = createWebglViewer(canvas, reset, settings, { qaCapture: initialQaCapture });
    applyUiSettings(project);

    const api = createProjectStore({
      project,
      profiles: profiles.profiles,
      smartComponentCatalog,
      fasteners,
      materials,
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
    let modelingUi = null;
    let viewerSettingsUi = null;
    let navCubeUi = null;
    let modelBrowserUi = null;
    let smartComponentBrowserUi = null;
    let projectFilesPanelUi = null;
    let projectDataPanelUi = null;
    let statusBar = null;
    let workspaceCustomizer = null;
    let leftDockTabs = null;
    let inspectorDockApi = null;
    let navCubeDockClearanceObserver = null;
    let navCubeDockClearanceMutationObserver = null;
    let featureNavbar = null;
    let commandPalette = null;
    let activeCommandId = null;
    let displayMode = normalizeDisplayMode(settings.render?.displayMode);
    let viewOrientation = normalizeViewOrientationState(viewer.viewOrientation?.() || "iso");
    const viewerApp = createViewerAppController({
      projectStore: api,
      selectionController: selection,
      settings,
      getCommandController: () => commandController,
      getTrimCreate: () => trimCreate,
      getEditorApi: () => editorApi,
      getWorkspace: () => workspaceCustomizer,
      getActiveCommandId: () => activeCommandId,
      focusObjectIds: (objectIds) => focusObjectIds(objectIds)
    });
    statusBar = mountStatusBar({
      root: statusBarRoot,
      prompt: modelingStatus,
      app: viewerApp,
      snapStrength: settings.authoring?.snap?.strength || "normal",
      snapScope: selection.scope?.() || {},
      relations: relationCommandState(),
      bottomStrip: defaultWorkspace?.bottomStrip,
      units: api.project()?.settings?.units?.length || "mm",
      onSnapSettings: () => viewerApp.runCommand("settings.snap.toggle"),
      onSnapStrengthChange: (strength) => setSnapStrengthCommand(strength),
      onSnapScopeChange: (patch, meta) => {
        const scope = setSnapScopeCommand(patch);
        updateModelingStatus(snapScopeStatus(meta, scope));
      },
      onRelationsToggle: () => viewerApp.runCommand("settings.relations.toggle")
    });
    refreshStatusBar();
    const syncSketchRelationsButton = () => {
      const active = plateSketchEdit?.activeState?.();
      const selected = editorApi?.selectedState?.();
      const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
      modelingUi?.setSketchRelationsState?.({
        available,
        visible: available && active.sketchMode === "relations"
      });
      refreshStatusBar({ relations: relationCommandState() });
      refreshWorkspaceCommandState();
    };
    function snapStrengthValue() {
      return normalizeSnapStrength(settings.authoring?.snap?.strength);
    }
    function setSnapStrengthCommand(value) {
      const strength = normalizeSnapStrength(value);
      settings.authoring = settings.authoring || {};
      settings.authoring.snap = settings.authoring.snap || {};
      settings.authoring.snap.strength = strength;
      modelingUi?.setSnapStrength?.(strength);
      refreshStatusBar({ snapStrength: strength });
      updateModelingStatus(`Snap strength: ${strength}`);
      refreshWorkspaceCommandState();
      return strength;
    }
    function setSnapScopeCommand(patch = {}) {
      const nextSnap = viewerApp.setSnapSettings({ scope: patch });
      const scope = nextSnap?.scope || selection.scope?.() || {};
      modelingUi?.setSnapScope?.(scope);
      refreshStatusBar({ snapScope: scope });
      refreshWorkspaceCommandState();
      return scope;
    }
    function snapScopeCommandState(command) {
      if (!command.snapScopeMode) return {};
      const scope = selection.scope?.() || {};
      const mode = command.snapScopeMode;
      const selectedCount = Array.isArray(scope.selectedObjectIds) ? scope.selectedObjectIds.length : 0;
      const enabled = mode === "selected"
        ? selectedCount > 0
        : mode === "component"
          ? Boolean(scope.activeSmartComponentId)
          : true;
      const active = snapScopeMode(scope) === mode;
      return {
        active,
        enabled,
        disabledReason: enabled
          ? ""
          : mode === "selected"
            ? "Select an object before using selected-only scope."
            : "Select a Smart Component before using component scope.",
        description: active
          ? `${snapScopeModeLabel(mode)} selection scope is active.`
          : command.description
      };
    }
    function setSnapScopeModeCommand(command) {
      const state = snapScopeCommandState(command);
      if (state.enabled === false) {
        updateModelingStatus(state.disabledReason);
        return false;
      }
      const scope = setSnapScopeCommand(command.snapScopePatch || {});
      updateModelingStatus(`Selection scope: ${snapScopeModeLabel(command.snapScopeMode)}`);
      return scope;
    }
    function snapTargetCommandState(command) {
      if (!command.snapTarget) return {};
      const scope = selection.scope?.() || {};
      const enabled = scope[command.snapTarget] !== false;
      const label = snapTargetLabel(command.snapTarget);
      return {
        active: enabled,
        title: enabled ? `Disable ${label} snap` : `Enable ${label} snap`,
        description: enabled
          ? `${label} snap target is enabled.`
          : `${label} snap target is disabled.`
      };
    }
    function toggleSnapTargetCommand(command) {
      const key = command.snapTarget;
      if (!key) return false;
      const scope = selection.scope?.() || {};
      const enabled = !(scope[key] !== false);
      const nextScope = setSnapScopeCommand({ [key]: enabled });
      updateModelingStatus(snapScopeStatus({ key, label: snapTargetLabel(key), enabled }, nextScope));
      return nextScope;
    }
    function snapScopeStatus(meta = {}, scope = {}) {
      if (meta?.source === "scopeMode") return `Selection scope: ${meta.label || "All"}`;
      const label = meta?.label || meta?.key || "Target";
      const enabled = typeof meta?.enabled === "boolean" ? meta.enabled : scope[meta?.key] !== false;
      return `${label} snap ${enabled ? "enabled" : "disabled"}`;
    }
    function snapStrengthCommandState(command) {
      if (!command.id?.startsWith("settings.snapStrength.")) return {};
      const strength = normalizeSnapStrength(command.snapStrength || command.id.replace("settings.snapStrength.", ""));
      const active = snapStrengthValue() === strength;
      return {
        active,
        description: active
          ? `${command.label || command.title || strength} is active.`
          : command.description
      };
    }
    function setDisplayModeCommand(mode) {
      displayMode = normalizeDisplayMode(mode);
      settings.render = settings.render || {};
      settings.render.displayMode = displayMode;
      viewer.setDisplayMode?.(displayMode);
      viewerSettingsUi?.setDisplayMode?.(displayMode);
      updateModelingStatus(`Display mode: ${displayModeLabel(displayMode)}`);
      refreshWorkspaceCommandState();
      return displayMode;
    }
    function displayModeCommandState(command) {
      if (!command.id?.startsWith("view.displayMode.")) return {};
      const mode = normalizeDisplayMode(command.displayMode || command.id.replace("view.displayMode.", ""));
      const active = displayMode === mode;
      return {
        active,
        description: active
          ? `${command.label || command.title || mode} display mode is active.`
          : command.description
      };
    }
    function renderVisibilitySettings() {
      settings.render = settings.render || {};
      settings.render.visibility = settings.render.visibility || {};
      return settings.render.visibility;
    }
    function renderVisibilityEnabled(key) {
      return renderVisibilitySettings()[key] !== false;
    }
    function renderVisibilityLabel(key) {
      return RENDER_VISIBILITY_LABELS[key] || "Scene helpers";
    }
    function toggleRenderVisibilityCommand(key) {
      const nextVisible = !renderVisibilityEnabled(key);
      renderVisibilitySettings()[key] = nextVisible;
      rerender(api.project());
      updateModelingStatus(`${renderVisibilityLabel(key)} ${nextVisible ? "shown" : "hidden"}.`);
      refreshWorkspaceCommandState();
      return nextVisible;
    }
    function renderVisibilityCommandState(command) {
      if (!command.renderVisibilityKey) return {};
      const active = renderVisibilityEnabled(command.renderVisibilityKey);
      const label = command.label || renderVisibilityLabel(command.renderVisibilityKey);
      return {
        active,
        description: active
          ? `${label} are visible.`
          : `${label} are hidden.`
      };
    }
    function syncCameraSurfaces(state = viewer.viewCamera?.()) {
      if (!state) return;
      const previousActiveOrientation = activeViewOrientation(viewOrientation);
      viewOrientation = normalizeViewOrientationState(state.orientation);
      navCubeUi?.setCameraState?.({ ...state, orientation: viewOrientation });
      viewerSettingsUi?.setOrientation?.(viewOrientation);
      if (previousActiveOrientation !== activeViewOrientation(viewOrientation)) refreshWorkspaceCommandState();
    }
    function setViewOrientationCommand(orientation) {
      const requestedOrientation = normalizeViewOrientation(orientation);
      const applied = viewer.setViewOrientation?.(requestedOrientation) !== false;
      syncCameraSurfaces(viewer.viewCamera?.());
      updateModelingStatus(applied ? `View: ${viewOrientationLabel(requestedOrientation)}` : "View orientation unavailable.");
      return applied ? requestedOrientation : false;
    }
    function viewOrientationCommandState(command) {
      if (!command.id?.startsWith("view.orientation.")) return {};
      const orientation = normalizeViewOrientation(command.viewOrientation || command.id.replace("view.orientation.", ""));
      const active = activeViewOrientation(viewOrientation) === orientation;
      return {
        active,
        description: active
          ? `${command.label || command.title || orientation} is active.`
          : command.description
      };
    }
    function relationCommandState() {
      const active = plateSketchEdit?.activeState?.();
      const selected = editorApi?.selectedState?.();
      const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
      const visible = available && active.sketchMode === "relations";
      if (available) {
        return {
          available,
          active: visible,
          title: visible ? "Hide plate sketch relations" : "Show plate sketch relations",
          description: visible
            ? "Hide relation helpers for the selected plate sketch."
            : "Show relation helpers for the selected plate sketch."
        };
      }
      return {
        available: false,
        active: Boolean(autoRelationsEnabled),
        title: "Toggle automatic axis relations",
        description: autoRelationsEnabled
          ? "Automatic axis relations are on."
          : "Automatic axis relations are off."
      };
    }
    function relationCommandPaletteState(command) {
      if (command.id !== "settings.relations.toggle") return {};
      const state = relationCommandState();
      return {
        active: state.active,
        title: state.title,
        description: state.description
      };
    }
    function panelCommandState(command) {
      const panel = command.id === "panel.library.toggle"
        ? { id: DATA_DOCK_PANEL_ID, label: DATA_DOCK_COMMAND_LABEL, element: libraryDock || libraryPanel }
        : command.id === "panel.inspector.toggle"
          ? { id: INSPECTOR_PANEL_ID, label: INSPECTOR_PANEL_LABEL, element: inspectorDock || objectEditor }
          : null;
      if (!panel) return {};
      const visible = typeof workspaceCustomizer?.panelVisible === "function"
        ? workspaceCustomizer.panelVisible(panel.id)
        : panel.element?.hidden !== true;
      return {
        active: visible,
        title: visible ? `Hide ${panel.label}` : `Show ${panel.label}`,
        description: visible
          ? `${panel.label} dock is visible.`
          : command.description
      };
    }
    function dataDockActiveTab() {
      return workspaceCustomizer?.panelActiveTab?.(DATA_DOCK_PANEL_ID) || DATA_DOCK_DEFAULT_TAB;
    }
    function dataDockTabCommandState(command) {
      if (!command.dataDockTab) return {};
      const dockVisible = typeof workspaceCustomizer?.panelVisible === "function"
        ? workspaceCustomizer.panelVisible(DATA_DOCK_PANEL_ID)
        : libraryDock?.hidden !== true;
      const active = dockVisible && dataDockActiveTab() === command.dataDockTab;
      return {
        active,
        title: active ? `${command.label} tab is active` : command.title,
        description: active
          ? `${command.label} is active in the ${DATA_DOCK_COMMAND_LABEL}.`
          : command.description
      };
    }
    function inspectorContextCommandState(command) {
      if (!command.inspectorContext) return {};
      const panel = inspectorPanelByContext.get(command.inspectorContext);
      const visible = typeof workspaceCustomizer?.panelVisible === "function"
        ? workspaceCustomizer.panelVisible(INSPECTOR_PANEL_ID)
        : inspectorDock?.hidden !== true;
      const activeContext = workspaceCustomizer?.panelActiveTab?.(INSPECTOR_PANEL_ID) || inspectorDockApi?.activePanel?.();
      const active = visible && activeContext === command.inspectorContext;
      const available = panel?.hidden !== true;
      return {
        enabled: available,
        disabledReason: `${inspectorContextLabel(command.inspectorContext)} inspector is not available for the current selection.`,
        active,
        title: active ? `${command.label} inspector is active` : command.title,
        description: active
          ? `${command.label} is active in the ${INSPECTOR_PANEL_LABEL} dock.`
          : command.description
      };
    }
    function plannedModelCommandState(command) {
      if (command.id !== "model.grid.create") return {};
      return {
        enabled: false,
        disabledReason: GRID_CREATE_DISABLED_REASON,
        title: "Create grid system",
        description: GRID_CREATE_DISABLED_REASON
      };
    }
    function dataDockTabSpecById(tabId) {
      return DATA_DOCK_TABS.find((tab) => tab.id === tabId) || null;
    }
    function dataDockTabRuntimeSpec(tab) {
      return {
        ...tab,
        panel: document.getElementById(tab.panelElementId)
      };
    }
    function inspectorContextRuntimeSpec(context) {
      return {
        ...context,
        panel: inspectorContextPanel(context.id)
      };
    }
    function dataDockTabsForWorkspace() {
      const tabState = workspaceCustomizer?.panelTabState?.(DATA_DOCK_PANEL_ID);
      const tabIds = Array.isArray(tabState?.tabIds) && tabState.tabIds.length
        ? tabState.tabIds
        : DATA_DOCK_TABS.map((tab) => tab.id);
      const hiddenTabIds = new Set(Array.isArray(tabState?.hiddenTabIds) ? tabState.hiddenTabIds : []);
      return tabIds
        .map(dataDockTabSpecById)
        .filter(Boolean)
        .filter((tab) => !hiddenTabIds.has(tab.id))
        .map(dataDockTabRuntimeSpec);
    }
    function inspectorContextTabsForWorkspace() {
      const tabState = workspaceCustomizer?.panelTabState?.(INSPECTOR_PANEL_ID);
      const tabIds = Array.isArray(tabState?.tabIds) && tabState.tabIds.length
        ? tabState.tabIds
        : INSPECTOR_CONTEXTS.map((context) => context.id);
      const hiddenTabIds = new Set(Array.isArray(tabState?.hiddenTabIds) ? tabState.hiddenTabIds : []);
      return tabIds
        .map(inspectorContextSpec)
        .filter(Boolean)
        .filter((context) => !hiddenTabIds.has(context.id))
        .map(inspectorContextRuntimeSpec);
    }
    function syncDataDockTabs() {
      const activeTab = workspaceCustomizer?.panelActiveTab?.(DATA_DOCK_PANEL_ID) || DATA_DOCK_DEFAULT_TAB;
      return leftDockTabs?.setTabs?.(dataDockTabsForWorkspace(), { activeTab }) || activeTab;
    }
    function syncInspectorDockTabs() {
      const activePanel = workspaceCustomizer?.panelActiveTab?.(INSPECTOR_PANEL_ID) || INSPECTOR_DEFAULT_CONTEXT;
      return inspectorDockApi?.setPanels?.(inspectorContextTabsForWorkspace(), { activePanel }) || activePanel;
    }
    function viewerRuntimeCommandState(command) {
      return {
        ...displayModeCommandState(command),
        ...viewOrientationCommandState(command),
        ...renderVisibilityCommandState(command),
        ...relationCommandPaletteState(command),
        ...snapStrengthCommandState(command),
        ...snapScopeCommandState(command),
        ...snapTargetCommandState(command),
        ...panelCommandState(command),
        ...dataDockTabCommandState(command),
        ...inspectorContextCommandState(command),
        ...plannedModelCommandState(command)
      };
    }
    function showInspectorContext(contextId, options = {}) {
      const label = inspectorContextLabel(contextId);
      workspaceCustomizer?.setPanelTabVisible?.(INSPECTOR_PANEL_ID, contextId, true, { notify: false });
      const activeContext = workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, contextId, { notify: false }) || contextId;
      workspaceCustomizer?.setPanelVisible?.(INSPECTOR_PANEL_ID, true);
      syncInspectorDockTabs();
      const shown = inspectorDockApi?.activate?.(activeContext, { notify: false, focus: options.focus !== false, persist: false }) === true;
      if (options.status !== false) {
        updateModelingStatus(shown ? `${label} shown in ${INSPECTOR_PANEL_LABEL}.` : `${label} inspector is not available.`);
      }
      refreshWorkspaceCommandState();
      return shown;
    }
    function showDataDockTab(tabId) {
      workspaceCustomizer?.setPanelTabVisible?.(DATA_DOCK_PANEL_ID, tabId, true, { notify: false });
      const activeTab = workspaceCustomizer?.setPanelActiveTab?.(DATA_DOCK_PANEL_ID, tabId, { notify: false }) || tabId;
      workspaceCustomizer?.setPanelVisible?.(DATA_DOCK_PANEL_ID, true);
      syncDataDockTabs();
      updateModelingStatus(`${dataDockTabLabel(activeTab)} shown in ${DATA_DOCK_COMMAND_LABEL}.`);
      refreshWorkspaceCommandState();
      return activeTab;
    }
    function projectDataSources() {
      return [
        { id: "project", label: "Project JSON", kind: "Project", icon: "file", path: projectUrl.href },
        { id: "settings", label: "Viewer settings", kind: "UI", icon: "settings", path: settingsUrl.href },
        { id: "workspace", label: "Default workspace", kind: "UI", icon: "settings", path: defaultWorkspaceUrl.href }
      ];
    }
    function leftDockCommandItems() {
      return leftDockResultSpecs({
        project: api.project(),
        sources: projectDataSources(),
        smartComponentPresets: api.smartComponentPresets?.() || [],
        smartComponentCatalog
      })
        .filter((item) => validLeftDockResultAction(item.action))
        .map((item) => ({
          ...item,
          run: () => runLeftDockResult(item)
        }));
    }
    function runLeftDockResult(item) {
      const action = item?.action || {};
      if (!validLeftDockResultAction(action)) return false;
      showDataDockTab(action.tab);
      if (action.type === "showFileRow") {
        const shown = projectFilesPanelUi?.showRow?.(action.rowId);
        updateModelingStatus(shown === false ? `File row not found: ${action.rowId}` : `${item.title} shown in Files.`);
        return shown !== false;
      }
      if (action.type === "showDataRow") {
        const shown = projectDataPanelUi?.showRow?.(action.rowId);
        updateModelingStatus(shown === false ? `Data row not found: ${action.rowId}` : `${item.title} shown in Data.`);
        return shown !== false;
      }
      if (action.type === "showModelCollection") {
        const shown = modelBrowserUi?.showCollection?.(action.collectionId);
        updateModelingStatus(shown === false ? `Model collection not found: ${action.collectionId}` : `Model browser: ${action.collectionId}`);
        return shown !== false;
      }
      if (action.type === "selectModelObject") {
        modelBrowserUi?.showObject?.(action.collectionId, action.objectId);
        viewerApp.selectObject(action.objectId);
        refreshSelectionSurfaces();
        updateModelingStatus(`Selected ${action.objectId}.`);
        return true;
      }
      if (action.type === "selectSmartComponent") {
        modelBrowserUi?.showObject?.(action.collectionId, action.smartComponentId || action.objectId);
        viewerApp.selectSmartComponent(action.smartComponentId || action.objectId);
        refreshSelectionSurfaces();
        updateModelingStatus(`Selected ${action.smartComponentId || action.objectId}.`);
        return true;
      }
      if (action.type === "showSmartComponentPreset") {
        const shown = smartComponentBrowserUi?.showPreset?.(action.presetId);
        updateModelingStatus(shown === false ? `Smart Component preset not found: ${action.presetId}` : `${item.title} shown in Components.`);
        return shown !== false;
      }
      return false;
    }
    function toggleRelationsCommand() {
      const state = relationCommandState();
      if (state.available) {
        const toggled = plateSketchEdit?.toggleRelations?.();
        syncSketchRelationsButton();
        const nextState = relationCommandState();
        refreshStatusBar({ relations: nextState });
        updateModelingStatus(nextState.active
          ? "Plate sketch relations shown."
          : "Plate sketch relations hidden.");
        return toggled;
      }
      autoRelationsEnabled = !autoRelationsEnabled;
      modelingUi?.setAutoRelations?.(autoRelationsEnabled);
      refreshStatusBar({ relations: relationCommandState() });
      updateModelingStatus(autoRelationsEnabled
        ? "Automatic axis relations on."
        : "Automatic axis relations off.");
      refreshWorkspaceCommandState();
      return autoRelationsEnabled;
    }
    const snapStrengthCommandHandlers = Object.fromEntries(SNAP_STRENGTH_SPECS.map((strength) => [
      `settings.snapStrength.${strength.id}`,
      () => setSnapStrengthCommand(strength.id)
    ]));
    const snapScopeCommandHandlers = Object.fromEntries(SNAP_SCOPE_MODES.map((mode) => [
      `selection.scope.${mode.id}`,
      () => setSnapScopeModeCommand({ snapScopeMode: mode.id, snapScopePatch: mode.patch })
    ]));
    const snapTargetCommandHandlers = Object.fromEntries(SNAP_TARGET_SPECS.map((target) => [
      `settings.snapTarget.${target.key}.toggle`,
      () => toggleSnapTargetCommand({ snapTarget: target.key })
    ]));
    const displayModeCommandHandlers = Object.fromEntries(DISPLAY_MODE_SPECS.map((mode) => [
      `view.displayMode.${mode.id}`,
      () => setDisplayModeCommand(mode.id)
    ]));
    const viewOrientationCommandHandlers = Object.fromEntries(VIEW_ORIENTATION_SPECS.map((orientation) => [
      `view.orientation.${orientation.id}`,
      () => setViewOrientationCommand(orientation.id)
    ]));
    const renderVisibilityCommandHandlers = {
      "settings.visibility.cuts.toggle": () => toggleRenderVisibilityCommand("cuttingObjects"),
      "settings.visibility.fasteners.toggle": () => toggleRenderVisibilityCommand("fasteners"),
      "settings.visibility.planes.toggle": () => toggleRenderVisibilityCommand("referencePlanes")
    };
    const dataDockCommandHandlers = Object.fromEntries(DATA_DOCK_TABS.map((tab) => [
      tab.commandId,
      () => showDataDockTab(tab.id)
    ]));
    const inspectorContextCommandHandlers = Object.fromEntries(INSPECTOR_CONTEXTS.map((context) => [
      context.commandId,
      () => showInspectorContext(context.id)
    ]));
    function startTrimCreate() {
      commandController?.cancel();
      setActiveModelingCommand("trim");
      dimensionEdit?.clearDimension({ render: false });
      editorApi?.clearSelection?.({ silent: true });
      memberEdit?.clear({ notify: false });
      clearAuxiliaryEditors();
      trimCreate?.start();
    }
    function startGridCreate() {
      updateModelingStatus(GRID_CREATE_DISABLED_REASON);
      return false;
    }
    function focusObjectIds(objectIds = []) {
      const points = viewer.objectPoints(objectIds);
      if (!points.length) return false;
      viewer.fitPoints(points, { padding: 0.72, minSpan: 220 });
      return true;
    }
    const modelingCommandActions = {
      onBeam: () => viewerApp.runCommand("model.beam.create"),
      onColumn: () => viewerApp.runCommand("model.column.create"),
      onPlate: () => viewerApp.runCommand("model.plate.create"),
      onSketch: () => viewerApp.runCommand("model.sketch.create"),
      onWorkPlane: () => viewerApp.runCommand("model.workPlane.set"),
      onPlateBend: () => viewerApp.runCommand("model.plateBend.add"),
      onTrim: () => viewerApp.runCommand("model.trim.create")
    };
    const shellCommandActions = createViewerPanelCommandActions({
      libraryPanel: libraryDock || libraryPanel,
      inspectorPanel: inspectorDock || objectEditor,
      toolbar: modelingToolbar,
      statusBar,
      getWorkspace: () => workspaceCustomizer,
      setStatus: updateModelingStatus
    });
    viewerApp.registerCommands({
      "model.beam.create": () => commandController?.startBeam(),
      "model.column.create": () => commandController?.startColumn(),
      "model.plate.create": () => commandController?.startPlate(),
      "model.sketch.create": () => commandController?.startSketch(),
      "model.workPlane.set": () => commandController?.startWorkPlane(),
      "model.plateBend.add": () => commandController?.startPlateBend(),
      "model.trim.create": () => startTrimCreate(),
      "model.grid.create": () => startGridCreate(),
      "view.reset": () => {
        if (viewer.resetView?.()) {
          syncCameraSurfaces(viewer.viewCamera?.());
          updateModelingStatus("View reset.");
          refreshWorkspaceCommandState();
        }
      },
      "view.fitSelection": () => {
        updateModelingStatus(viewerApp.focusSelection() ? "Selection framed." : "Select an object to fit.");
      },
      ...displayModeCommandHandlers,
      ...viewOrientationCommandHandlers,
      ...renderVisibilityCommandHandlers,
      "selection.clear": () => {
        viewerApp.clearSelection();
        updateModelingStatus("Selection cleared.");
        refreshSelectionSurfaces();
      },
      ...dataDockCommandHandlers,
      ...inspectorContextCommandHandlers,
      "panel.library.toggle": () => {
        shellCommandActions.onLibraryToggle();
        refreshWorkspaceCommandState();
      },
      "panel.inspector.toggle": () => {
        shellCommandActions.onInspectorToggle();
        refreshWorkspaceCommandState();
      },
      "settings.relations.toggle": () => toggleRelationsCommand(),
      "settings.snap.toggle": shellCommandActions.onSnapSettingsToggle,
      "tools.clashDetection.open": () => {
        updateModelingStatus("Clash detection tools are not available yet.");
      },
      "structural-analysis.open": () => {
        updateModelingStatus("Structural analysis tools are not available yet.");
      },
      ...snapStrengthCommandHandlers,
      ...snapScopeCommandHandlers,
      ...snapTargetCommandHandlers,
      "command.cancel": () => {
        if (trimCreate?.cancel()) {
          setActiveModelingCommand(null);
          return;
        }
        commandController?.cancel();
        setActiveModelingCommand(null);
      }
    });
    const viewerCommandItems = (options = {}) => createViewerCommandItems({
      app: viewerApp,
      shortcutLabelFor: (command) => shortcutSetting(settings.shortcuts?.commands, command.shortcut, command.keyFallback),
      commandStateFor: viewerRuntimeCommandState,
      ...options
    });
    mountViewerSettingsUi();
    mountNavCubeUi();
    viewer.setCameraChangeHandler?.(syncCameraSurfaces);
    syncCameraSurfaces(viewer.viewCamera?.());
    mountModelingUi();
    workspaceCustomizer = mountToolbarWorkspaceCustomization({
      toolbar: modelingToolbar,
      topbarActions: document.querySelector(".bc-topbar-actions"),
      shell: document.querySelector(".bc-workspace-shell"),
      commands: () => viewerCommandItems(),
      panels: [
        {
          id: DATA_DOCK_PANEL_ID,
          label: DATA_DOCK_PANEL_LABEL,
          description: DATA_DOCK_PANEL_DESCRIPTION,
          icon: DATA_DOCK_PANEL_ICON,
          dock: DATA_DOCK_PANEL_DOCK,
          element: libraryDock || libraryPanel,
          defaultWidth: DATA_DOCK_PANEL_DEFAULT_WIDTH,
          minWidth: DATA_DOCK_PANEL_MIN_WIDTH,
          maxWidth: DATA_DOCK_PANEL_MAX_WIDTH,
          defaultVisible: DATA_DOCK_PANEL_DEFAULT_VISIBLE,
          defaultPinned: DATA_DOCK_PANEL_DEFAULT_PINNED,
          tabs: DATA_DOCK_TABS,
          defaultActiveTab: DATA_DOCK_DEFAULT_TAB,
          legacyActiveTabStorageKey: DATA_DOCK_LEGACY_TAB_STORAGE_KEY
        },
        {
          id: INSPECTOR_PANEL_ID,
          label: INSPECTOR_PANEL_LABEL,
          description: INSPECTOR_PANEL_DESCRIPTION,
          icon: INSPECTOR_PANEL_ICON,
          dock: INSPECTOR_PANEL_DOCK,
          element: inspectorDock || objectEditor,
          defaultWidth: INSPECTOR_PANEL_DEFAULT_WIDTH,
          minWidth: INSPECTOR_PANEL_MIN_WIDTH,
          maxWidth: INSPECTOR_PANEL_MAX_WIDTH,
          defaultVisible: INSPECTOR_PANEL_DEFAULT_VISIBLE,
          defaultPinned: true,
          tabs: INSPECTOR_CONTEXTS,
          defaultActiveTab: INSPECTOR_DEFAULT_CONTEXT,
          legacyActiveTabStorageKey: INSPECTOR_ACTIVE_CONTEXT_STORAGE_KEY
        }
      ],
      defaultWorkspace,
      onWorkspaceChange: (workspace) => {
        statusBar?.setWorkspace?.(workspace?.bottomStrip);
        viewerSettingsUi?.setWorkspace?.(workspace?.viewerSettingsStrip);
        applyViewerOverlayWorkspace(workspace?.viewerOverlays);
        syncDataDockTabs();
        syncInspectorDockTabs();
        syncNavCubeDockClearance();
        featureNavbar?.refresh?.();
        commandPalette?.refresh?.();
      },
      onStatusChange: updateModelingStatus
    });
    if (inspectorDock) {
      inspectorDockApi = mountInspectorDock({
        root: inspectorDock,
        activePanel: workspaceCustomizer?.panelActiveTab?.(INSPECTOR_PANEL_ID) || INSPECTOR_DEFAULT_CONTEXT,
        panels: inspectorContextTabsForWorkspace(),
        onActivePanelChange: (contextId) => {
          workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, contextId, { notify: false });
          refreshWorkspaceCommandState();
        },
        onStatusChange: updateModelingStatus
      });
      syncInspectorDockTabs();
    }
    const workspaceCommandItems = (options = {}) => withWorkspaceCommand(() => viewerCommandItems(options), workspaceCustomizer)();
    const commandPaletteItems = () => [
      ...workspaceCommandItems(),
      ...leftDockCommandItems()
    ];
    const featureNavbarGroups = () => visibleFeatureNavbarGroups(workspaceCustomizer?.state?.());
    featureNavbar = mountFeatureNavbar({
      root: featureNavbarRoot,
      commands: () => workspaceCommandItems(),
      groups: featureNavbarGroups,
      onStatusChange: updateModelingStatus
    });
    refreshWorkspaceCommandState();
    commandPalette = mountCommandPalette({
      button: commandPaletteButton,
      root: commandPaletteRoot,
      commands: commandPaletteItems,
      onStatusChange: updateModelingStatus
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
    function updateStatusBarPrompt(message) {
      const nextMessage = message || "Ready";
      if (!statusBar?.setPrompt) return false;
      statusBar.setPrompt(nextMessage);
      return true;
    }
    function updateModelingStatus(message) {
      const nextMessage = message || "Ready";
      if (modelingUi?.setStatus) {
        modelingUi.setStatus(nextMessage);
      } else {
        updateStatusBarPrompt(nextMessage);
      }
      if (nextMessage === "No modeling command") setActiveModelingCommand(null);
    }
    bindTopbarFileAction();
    function bindTopbarFileAction() {
      if (!topbarFileButton || topbarFileButton.dataset.bound === "true") return;
      topbarFileButton.dataset.bound = "true";
      topbarFileButton.addEventListener("click", () => {
        commandPalette?.open?.({ query: TOPBAR_FILE_COMMAND_QUERY });
        updateModelingStatus("File actions opened.");
      });
    }
    function refreshSelectionSurfaces() {
      modelBrowserUi?.setSelectionState?.(viewerApp.selectionState());
      refreshWorkspaceCommandState();
      refreshStatusBar();
    }
    function visibleFeatureNavbarGroups(workspace = {}) {
      const featureNavbarState = workspace.navigation?.featureNavbar || {};
      const order = Array.isArray(featureNavbarState.groupIds) && featureNavbarState.groupIds.length
        ? featureNavbarState.groupIds
        : COMMAND_GROUP_ORDER;
      const hidden = new Set(Array.isArray(featureNavbarState.hiddenGroupIds) ? featureNavbarState.hiddenGroupIds : []);
      return order.filter((groupId) => COMMAND_GROUP_ORDER.includes(groupId) && !hidden.has(groupId));
    }
    function refreshWorkspaceCommandState() {
      leftDockTabs?.refresh?.();
      workspaceCustomizer?.refreshCommandState?.();
      viewerSettingsUi?.refresh?.();
      featureNavbar?.refresh?.();
      commandPalette?.refresh?.();
    }
    function showInspectorProperties(options = {}) {
      return showInspectorContext(INSPECTOR_DEFAULT_CONTEXT, {
        focus: false,
        status: options.notify === true
      });
    }
    function setActiveModelingCommand(type) {
      activeCommandId = type ? MODELING_COMMAND_ID_BY_TYPE[type] || null : null;
      if (inspectorDock) inspectorDock.dataset.authoringActive = activeCommandId ? "true" : "false";
      syncNavCubeDockClearance();
      if (activeCommandId) showInspectorProperties();
      modelingUi?.setActive(type || null);
      editorApi?.refresh?.();
      refreshWorkspaceCommandState();
    }
    function mountViewerSettingsUi() {
      viewerSettingsUi = mountViewerSettingsStrip({
        root: viewerSettingsRoot,
        commands: () => viewerCommandItems(),
        workspace: defaultWorkspace?.viewerSettingsStrip,
        displayMode,
        orientation: viewOrientation,
        onDisplayModeChange: (mode) => viewerApp.runCommand(`view.displayMode.${normalizeDisplayMode(mode)}`),
        onOrientationChange: (orientation) => viewerApp.runCommand(`view.orientation.${normalizeViewOrientation(orientation)}`)
      });
      viewer.setDisplayMode?.(displayMode);
    }
    function mountNavCubeUi() {
      applyViewerOverlayWorkspace(defaultWorkspace?.viewerOverlays);
      navCubeUi = mountNavCube({
        root: navCubeRoot,
        orientation: viewOrientation,
        onOrientationChange: (orientation) => viewerApp.runCommand(`view.orientation.${normalizeViewOrientation(orientation)}`),
        onOrbitDrag: ({ dx, dy }) => {
          viewer.orbitView?.(-dx, -dy, { pivot: "origin" });
        }
      });
      navCubeUi?.setCameraState?.(viewer.viewCamera?.());
      syncNavCubeDockClearance();
      bindNavCubeDockClearanceObserver();
    }
    function applyViewerOverlayWorkspace(viewerOverlays = {}) {
      if (!navCubeRoot) return;
      const navCube = normalizeViewerOverlaysWorkspace(viewerOverlays).navCube;
      const visible = navCube?.visible !== false;
      navCubeRoot.hidden = !visible;
      navCubeRoot.dataset.overlayVisible = visible ? "true" : "false";
      navCubeRoot.dataset.overlayCorner = navCube?.corner || "bottom-right";
    }
    function syncNavCubeDockClearance() {
      if (!navCubeRoot) return;
      const dock = inspectorDock;
      const dockVisible = rightDockOccupiesNavCubeCorner(dock);
      const dockWidth = dockVisible
        ? Math.max(0, Math.ceil(dock.getBoundingClientRect?.().width || Number(dock.dataset.workspacePanelWidth) || 0))
        : 0;
      navCubeRoot.style.setProperty("--bc-nav-cube-right-dock-clearance", `${dockWidth}px`);
    }
    function rightDockOccupiesNavCubeCorner(dock) {
      return Boolean(dock)
        && !dock.hidden
        && dock.dataset.authoringActive !== "true"
        && dock.dataset.workspacePanelVisible !== "false"
        && dock.dataset.workspacePanelDock === "right"
        && dock.dataset.workspacePanelSideDock === "true"
        && (
          dock.dataset.workspacePanelPinned !== "false"
          || dock.dataset.workspacePanelRevealed === "true"
        );
    }
    function bindNavCubeDockClearanceObserver() {
      if (!navCubeRoot) return;
      if (!navCubeDockClearanceObserver) {
        window.addEventListener("resize", syncNavCubeDockClearance);
        if (typeof ResizeObserver === "function" && inspectorDock) {
          navCubeDockClearanceObserver = new ResizeObserver(syncNavCubeDockClearance);
          navCubeDockClearanceObserver.observe(inspectorDock);
        }
      }
      if (!navCubeDockClearanceMutationObserver && typeof MutationObserver === "function" && inspectorDock) {
        navCubeDockClearanceMutationObserver = new MutationObserver(syncNavCubeDockClearance);
        navCubeDockClearanceMutationObserver.observe(inspectorDock, {
          attributeFilter: [
            "data-authoring-active",
            "data-workspace-panel-dock",
            "data-workspace-panel-pinned",
            "data-workspace-panel-revealed",
            "data-workspace-panel-side-dock",
            "data-workspace-panel-visible",
            "data-workspace-panel-width",
            "hidden"
          ],
          attributes: true
        });
      }
    }
    function refreshStatusBar(patch = {}) {
      statusBar?.update({
        selectionCount: viewerApp.selectionState().selectedObjectIds.length,
        snapStrength: settings.authoring?.snap?.strength || "normal",
        snapScope: selection.scope?.() || {},
        relations: relationCommandState(),
        units: api.project()?.settings?.units?.length || "mm",
        ...patch
      });
    }
    function mountModelingUi() {
      modelingUi = mountModelingToolbar({
        toolbar: modelingToolbar,
        status: modelingStatus,
        shortcuts: settings.shortcuts || {},
        ...modelingCommandActions,
        autoRelationsEnabled,
        onAutoRelationsChange: (enabled) => {
          autoRelationsEnabled = enabled;
          updateModelingStatus(enabled ? "Automatic axis relations on." : "Automatic axis relations off.");
        },
        onRelationsToggle: () => viewerApp.runCommand("settings.relations.toggle"),
        onSketchRelationsToggle: () => {
          const toggled = plateSketchEdit?.toggleRelations?.();
          syncSketchRelationsButton();
          return toggled;
        },
        snapSettings: settings.authoring?.snap || {},
        snapScope: selection.scope?.() || {},
        onSnapStrengthChange: setSnapStrengthCommand,
        onSnapScopeChange: (patch) => {
          const scope = setSnapScopeCommand(patch);
          const [key, enabled] = Object.entries(patch)[0] || [];
          if (key) updateModelingStatus(snapScopeStatus({ key, enabled }, scope));
        },
        onStatusChange: updateStatusBarPrompt
      });
      syncSketchRelationsButton();
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
        refreshSelectionSurfaces();
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
        refreshSelectionSurfaces();
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
      needsDragHit: (input) => authoringTarget(input)?.needsDragHit?.(input) !== false,
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
      if (options.inspectorPanel === "component") showInspectorContext("component", { focus: false, status: true });
      else showInspectorProperties();
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
      snapManager,
      settings,
      onPreviewChange: (preview) => {
        const previewMembers = Array.isArray(preview) ? preview : arrayValues(preview?.members);
        const previewPlates = Array.isArray(preview) ? [] : arrayValues(preview?.plates);
        authoringPreview = [];
        authoringPreviewPlates = [];
        const previewScene = previewMembers.length || previewPlates.length
          ? buildScene(previewOnlyProject(api.project()), profiles, fasteners, settings, {
            activeSmartComponentId: dimensionEdit?.smartComponentId() || null,
            renderObjectIds: [],
            previewMembers,
            previewPlates
          })
          : null;
        viewer.setAuthoringPreviewScene?.(previewScene);
      },
      onOverlayChange: (overlay) => viewer.setAuthoringOverlay(overlay),
      onProjectChange: rerender,
      onStatusChange: updateModelingStatus,
      onCommandStart: (type) => {
        trimCreate?.cancel();
        setActiveModelingCommand(type);
        dimensionEdit?.clearDimension({ render: false });
        editorApi?.clearSelection?.({ silent: true });
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
        setActiveModelingCommand(null);
      },
      onCommandEnd: () => setActiveModelingCommand(null),
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
        setActiveModelingCommand(null);
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
    if (libraryPanel) libraryPanel.hidden = false;
    smartComponentBrowserUi = mountSmartComponentBrowser({
      root: smartComponentLibraryPanel || libraryPanel,
      app: viewerApp,
      api,
      smartComponentCatalog,
      selection,
      onProjectChange: rerender,
      onSmartComponentCreated: (smartComponentId) => showSmartComponentEditor(smartComponentId, { inspectorPanel: "component" }),
      onStatusChange: updateModelingStatus
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
      app: viewerApp,
      api,
      profiles: profiles.profiles,
      materials: materials.materials,
      selection,
      memberEdit,
      smartComponentHighlightObjectIds: (smartComponentId) => smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId)),
      onProjectChange: rerender,
      onLocalMemberProjectChange: hotSwapMemberDetails,
      onSmartComponentSelected: (smartComponentId, options) => {
        focusedMemberId = null;
        showSmartComponentEditor(smartComponentId, options);
        refreshSelectionSurfaces();
      },
      onSmartComponentDeleted: () => {
        clearSmartComponentEditor();
        referencePlaneEdit?.clear({ overlay: true });
        refreshSelectionSurfaces();
      },
      onObjectSelected: (objectId, detail = {}) => {
        refreshSelectionSurfaces();
        showInspectorProperties();
        clearSmartComponentEditor();
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection === "features") {
          trimJointEditorApi?.clear();
          featureEditorApi?.selectFeature(objectId);
          if (detail.inspectorPanel === "feature") showInspectorContext("feature", { focus: false, status: true });
          referencePlaneEdit?.selectObject(objectId);
          plateSketchEdit?.clear({ overlay: true });
        } else if (entry?.collection === "trimJoints") {
          featureEditorApi?.clear();
          referencePlaneEdit?.clear({ overlay: true });
          plateSketchEdit?.clear({ overlay: true });
          trimJointEditorApi?.selectTrimJoint(objectId, { operationId: detail.operationId, regionKey: detail.regionKey });
          if (detail.inspectorPanel === "trim") showInspectorContext("trim", { focus: false, status: true });
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
        refreshSelectionSurfaces();
      }
    });
    modelBrowserUi = mountModelBrowser({
      root: modelBrowserRoot,
      app: viewerApp,
      onSelectObject: (objectId) => viewerApp.selectObject(objectId),
      onSelectSmartComponent: (smartComponentId) => viewerApp.selectSmartComponent(smartComponentId),
      onFocusObject: (objectId) => viewerApp.focusSelection([objectId]),
      onFocusSmartComponent: (smartComponentId) => {
        const objectIds = smartComponentHighlightObjectIds(api.project(), api.smartComponentObjectIds(smartComponentId));
        return viewerApp.focusSelection(objectIds);
      },
      onStatusChange: updateModelingStatus
    });
    projectFilesPanelUi = mountProjectFilesPanel({
      root: projectFilesPanelRoot,
      app: viewerApp,
      sourceBaseUrl: projectUrl.href,
      sources: projectDataSources()
    });
    projectDataPanelUi = mountProjectDataPanel({
      root: projectDataPanelRoot,
      app: viewerApp,
      libraries: { profiles, materials, fasteners, frames },
      smartComponentCatalog,
      onRowAction: ({ action, target }) => {
        if (action === "showCollection") {
          showDataDockTab("model");
          const shown = modelBrowserUi?.showCollection?.(target);
          updateModelingStatus(shown === false ? `Model collection not found: ${target}` : `Model browser: ${target}`);
        } else if (action === "showComponents") {
          showDataDockTab("components");
        }
      }
    });
    if (libraryPanel) {
      leftDockTabs = mountDockTabs({
        root: libraryPanel,
        activeTab: workspaceCustomizer?.panelActiveTab?.(DATA_DOCK_PANEL_ID) || DATA_DOCK_DEFAULT_TAB,
        label: `${DATA_DOCK_COMMAND_LABEL} panels`,
        tabs: dataDockTabsForWorkspace(),
        getActiveTab: () => workspaceCustomizer?.panelActiveTab?.(DATA_DOCK_PANEL_ID) || DATA_DOCK_DEFAULT_TAB,
        onActiveTabChange: (tabId) => {
          workspaceCustomizer?.setPanelActiveTab?.(DATA_DOCK_PANEL_ID, tabId, { notify: false });
          refreshWorkspaceCommandState();
        },
        onStatusChange: updateModelingStatus
      });
    }

    if (initialQaSelectObject) {
      try {
        editorApi.selectObject(initialQaSelectObject);
        refreshSelectionSurfaces();
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
