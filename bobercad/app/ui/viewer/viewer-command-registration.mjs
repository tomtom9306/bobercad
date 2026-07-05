import {
  DATA_DOCK_COMMAND_LABEL,
  DATA_DOCK_PANEL_ID,
  DATA_DOCK_TABS
} from "../commands/data-dock-metadata.mjs";
import { leftDockResultSpecs, validLeftDockResultAction } from "../commands/left-dock-result-metadata.mjs";
import {
  INSPECTOR_CONTEXTS,
  INSPECTOR_PANEL_ID,
  INSPECTOR_PANEL_LABEL,
  inspectorContextLabel
} from "../commands/inspector-dock-metadata.mjs";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength, snapScopeMode, snapScopeModeLabel, snapTargetLabel } from "../commands/snap-metadata.mjs";
import { DISPLAY_MODE_SPECS, VIEW_ORIENTATION_SPECS, activeViewOrientation, displayModeLabel, normalizeDisplayMode, normalizeViewOrientation, normalizeViewOrientationState, viewOrientationLabel } from "../commands/view-metadata.mjs";
import { createViewerCommandItems, createViewerPanelCommandActions } from "./viewer-command-adapter.mjs";

const MODELING_COMMAND_ID_BY_TYPE = {
  beam: "model.beam.create",
  column: "model.column.create",
  plate: "model.plate.create",
  sketch: "model.sketch.create",
  workPlane: "model.workPlane.set",
  plateBend: "model.plateBend.add",
  trim: "model.trim.create"
};
const MODELING_COMMANDS_WITH_SIDE_DOCK_EDITOR = new Set(["plateBend", "trim"]);
const SKETCH_CONTEXT_COMMAND_IDS = new Set([
  "sketch.line.create",
  "sketch.line.contour",
  "sketch.circle.create",
  "sketch.circle.diameter",
  "sketch.circle.threePoint",
  "sketch.rectangle.center",
  "sketch.roundedRectangle.create",
  "sketch.slot.create",
  "sketch.slot.center",
  "sketch.arc.center",
  "sketch.arc.centerContour",
  "sketch.arc.threePoint",
  "sketch.arc.threePointContour",
  "sketch.corner.fillet",
  "sketch.edge.arc",
  "sketch.arc.flip",
  "sketch.arc.split",
  "sketch.modify.trim",
  "sketch.modify.extend",
  "sketch.modify.delete",
  "sketch.convert.toPlate",
  "sketch.dimension.length",
  "sketch.dimension.angle",
  "sketch.dimension.distance",
  "sketch.dimension.radius",
  "sketch.dimension.diameter",
  "sketch.relation.fix",
  "sketch.relation.coincident",
  "sketch.relation.pointOnCircle",
  "sketch.relation.tangent",
  "sketch.relation.concentric",
  "sketch.relation.equalRadius",
  "sketch.relations.toggle",
  "sketch.relations.infer",
  "sketch.view.clean",
  "sketch.selection.clear",
  "sketch.exit"
]);
const RENDER_VISIBILITY_LABELS = {
  cuttingObjects: "Cutting objects",
  fasteners: "Fasteners",
  grids: "Grids",
  referencePlanes: "Planes"
};

function sketchEdgeIsCircularArc(sketch, edgeId) {
  const edges = [
    ...Object.values(sketch?.edges || {}),
    ...Object.values(sketch?.constructionEdges || {})
  ];
  return edges.some((edge) => edge?.id === edgeId && edge.kind === "circular-arc");
}

function sketchVertexTouchesOtherCircularArc(sketch, vertexId, targetEdgeId) {
  if (!vertexId || !targetEdgeId) return false;
  const edges = [
    ...Object.values(sketch?.edges || {}),
    ...Object.values(sketch?.constructionEdges || {})
  ];
  return edges.some((edge) => (
    edge?.id
    && edge.id !== targetEdgeId
    && (edge.from === vertexId || edge.to === vertexId)
    && edge.kind === "circular-arc"
  ));
}

function sketchEdgeRelationDisabledReason({
  label,
  selectedEdgeCount,
  selectedArcEdgeCount,
  selectedVertexCount,
  requiresTwoArcs = false
}) {
  if (selectedVertexCount > 0) return `Select only two sketch edges before using ${label}.`;
  if (selectedEdgeCount > 2) return `Select exactly two sketch edges before using ${label}.`;
  if (requiresTwoArcs) {
    if (selectedEdgeCount < 2 || selectedArcEdgeCount === 0) return `Select two circular sketch edges before using ${label}.`;
    return `Both selected sketch edges must be circular arcs before using ${label}.`;
  }
  if (selectedEdgeCount < 2) return `Select two sketch edges, including at least one circular arc, before using ${label}.`;
  if (selectedArcEdgeCount < 1) return `Select at least one circular sketch edge before using ${label}.`;
  return `Select two sketch edges before using ${label}.`;
}

function sketchArcDimensionDisabledReason({ label, selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount }) {
  if (selectedVertexCount > 0) return `Clear selected sketch points before using ${label}; select only one circular sketch edge.`;
  if (selectedEdgeCount > 1) return `Select exactly one circular sketch edge before using ${label}.`;
  if (selectedEdgeCount === 1 && selectedArcEdgeCount === 0) return `Selected sketch edge must be circular before using ${label}.`;
  return `Select one circular sketch edge before using ${label}.`;
}

function sketchLengthDimensionDisabledReason({ selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount }) {
  if (selectedVertexCount > 0) return "Clear selected sketch points before using Length; select only one straight sketch edge.";
  if (selectedEdgeCount > 1) return "Select exactly one straight sketch edge before using Length.";
  if (selectedEdgeCount === 1 && selectedArcEdgeCount > 0) return "Use Radius or Diameter for circular arc edges before using Length.";
  return "Select one straight sketch edge before using Length.";
}

function sketchAngleDimensionDisabledReason({ selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount }) {
  if (selectedVertexCount > 0) return "Clear selected sketch points before using Angle; select only two straight sketch edges.";
  if (selectedEdgeCount > 2) return "Select exactly two straight sketch edges before using Angle.";
  if (selectedEdgeCount === 2 && selectedArcEdgeCount > 0) return "Angle currently works on straight sketch edges.";
  return "Select two straight sketch edges before using Angle.";
}

function sketchDistanceDimensionDisabledReason({ selectedEdgeCount, selectedVertexCount }) {
  if (selectedEdgeCount > 0) return "Clear selected sketch edges before using Distance; select only two sketch points.";
  return "Select two sketch points before using Distance.";
}

function sketchPointRelationDisabledReason({ label, selectedEdgeCount }) {
  if (selectedEdgeCount > 0) return `Clear selected sketch edges before using ${label}; select only two sketch points.`;
  return `Select two sketch points before using ${label}.`;
}

function sketchPointOnCircleDisabledReason({ selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount, pointMovesOtherArc }) {
  if (selectedVertexCount > 1) return "Clear selected sketch points before using On Circle; select only one sketch point and one circular sketch edge.";
  if (selectedEdgeCount > 1) return "Clear selected sketch edges before using On Circle; select only one sketch point and one circular sketch edge.";
  if (pointMovesOtherArc) return "Point On Circle cannot move a point that is already an endpoint of another circular arc.";
  if (selectedEdgeCount === 1 && selectedArcEdgeCount === 0) return "Selected sketch edge must be circular before using On Circle.";
  return "Select one sketch point and one circular sketch edge before using On Circle.";
}

function sketchArcModifierDisabledReason({ label, selectedEdgeCount, selectedArcEdgeCount, selectedConstructionEdgeCount, selectedVertexCount, requiresArc = true }) {
  if (selectedVertexCount > 0) return `Clear selected sketch points before using ${label}; select only one outline sketch edge.`;
  if (selectedConstructionEdgeCount > 0) return `${label} works on outline sketch edges.`;
  if (selectedEdgeCount > 1) return `Select exactly one outline sketch edge before using ${label}.`;
  if (requiresArc && selectedEdgeCount === 1 && selectedArcEdgeCount === 0) return `Selected outline sketch edge must be circular before using ${label}.`;
  return requiresArc
    ? `Select one circular outline sketch edge before using ${label}.`
    : `Select one outline sketch edge before using ${label}.`;
}

export function createViewerCommandRegistration({
  settings,
  viewer,
  viewerApp,
  api,
  selection,
  smartComponentCatalog,
  toolbar = null,
  workspaceBindings,
  getStatusBar = () => null,
  getModelingUi = () => null,
  getViewerSettingsUi = () => null,
  getNavCubeUi = () => null,
  getCommandController = () => null,
  getTrimCreate = () => null,
  getDimensionEdit = () => null,
  getEditorApi = () => null,
  getMemberEdit = () => null,
  getTrimJointEditorApi = () => null,
  getPlateSketchEdit = () => null,
  getModelBrowserUi = () => null,
  getProjectFilesPanelUi = () => null,
  getProjectDataPanelUi = () => null,
  getSmartComponentBrowserUi = () => null,
  getConnectionComponentBrowserUi = () => null,
  projectDataSources = () => [],
  clearAuxiliaryEditors = () => {},
  clearMemberEditSilently = () => {},
  refreshSelectionSurfaces = () => {},
  refreshStatusBar = () => {},
  rerender = () => {},
  updateModelingStatus = () => {}
} = {}) {
  let activeCommandId = null;
  let displayMode = normalizeDisplayMode(settings.render?.displayMode);
  let viewOrientation = normalizeViewOrientationState(viewer.viewOrientation?.() || "iso");
  let autoRelationsEnabled = settings.authoring?.autoAxisRelations !== false;

  function refreshWorkspaceCommandState() {
    workspaceBindings?.refreshCommandState?.();
  }

  function snapStrengthValue() {
    return normalizeSnapStrength(settings.authoring?.snap?.strength);
  }

  function setSnapStrengthCommand(value) {
    const strength = normalizeSnapStrength(value);
    settings.authoring = settings.authoring || {};
    settings.authoring.snap = settings.authoring.snap || {};
    settings.authoring.snap.strength = strength;
    getModelingUi()?.setSnapStrength?.(strength);
    refreshStatusBar({ snapStrength: strength });
    updateModelingStatus(`Snap strength: ${strength}`);
    refreshWorkspaceCommandState();
    return strength;
  }

  function setSnapScopeCommand(patch = {}) {
    const nextSnap = viewerApp.setSnapSettings({ scope: patch });
    const scope = nextSnap?.scope || selection.scope?.() || {};
    getModelingUi()?.setSnapScope?.(scope);
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
    getViewerSettingsUi()?.setDisplayMode?.(displayMode);
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
    getNavCubeUi()?.setCameraState?.({ ...state, orientation: viewOrientation });
    getViewerSettingsUi()?.setOrientation?.(viewOrientation);
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
    const active = getPlateSketchEdit()?.activeState?.();
    const selected = getEditorApi()?.selectedState?.();
    const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
    const visible = available && active.sketchMode === "relations";
    if (available) {
      return {
        available,
        active: visible,
        title: visible ? "Hide sketch relations" : "Show sketch relations",
        description: visible
          ? "Hide relation helpers for the selected sketch."
          : "Show relation helpers for the selected sketch."
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

  function activeSketchCommandContext() {
    const active = getPlateSketchEdit()?.activeState?.();
    const selected = getEditorApi()?.selectedState?.();
    const available = Boolean(active?.plateId && selected?.objectId === active.plateId);
    const sketchSelection = active?.selection || {};
    return {
      available,
      active,
      sketchSelection,
      selected
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

  function sketchContextCommandState(command) {
    const isSketchCommand = SKETCH_CONTEXT_COMMAND_IDS.has(command.id);
    const context = activeSketchCommandContext();
    if (context.available && command.group === "model" && !isSketchCommand) {
      return { navSurface: undefined };
    }
    if (!isSketchCommand) return {};
    if (!context.available) {
      return {
        enabled: false,
        disabledReason: "Select a sketch to use Sketch tools."
      };
    }

    const selectedVertexCount = Array.isArray(context.sketchSelection.vertexIds) ? context.sketchSelection.vertexIds.length : 0;
    const selectedEdgeCount = Array.isArray(context.sketchSelection.edgeIds) ? context.sketchSelection.edgeIds.length : 0;
    const activeSketchHost = context.active?.plateId
      ? api.project()?.model?.[context.active.collection]?.[context.active.plateId] || null
      : null;
    const activeSketch = activeSketchHost?.sketch || null;
    const selectedArcEdgeCount = Array.isArray(context.active?.selectedArcEdgeIds) ? context.active.selectedArcEdgeIds.length : 0;
    const selectedConstructionEdgeCount = Array.isArray(context.active?.selectedConstructionEdgeIds) ? context.active.selectedConstructionEdgeIds.length : 0;
    const selectedConstructionVertexCount = Array.isArray(context.active?.selectedConstructionVertexIds) ? context.active.selectedConstructionVertexIds.length : 0;
    const selectedFixedRelationCount = Array.isArray(context.active?.selectedFixedRelationIds) ? context.active.selectedFixedRelationIds.length : 0;
    const standaloneSketch = context.active?.collection === "sketches";
    const hasSketchSelection = Boolean(
      selectedVertexCount
        || selectedEdgeCount
        || context.sketchSelection.relationId
    );
    const hasDeleteTarget = Boolean(
      context.sketchSelection.relationId
        || (selectedVertexCount === 1 && selectedEdgeCount === 0)
        || (selectedEdgeCount === 1 && selectedVertexCount === 0)
    );
    const hasTrimTarget = Boolean(
      (selectedEdgeCount === 1 && selectedVertexCount <= 2)
        || (selectedEdgeCount === 2 && selectedConstructionEdgeCount === 0 && selectedVertexCount <= 2)
    );
    const hasExtendTarget = Boolean(
      selectedEdgeCount === 2
        && selectedConstructionEdgeCount === 0
        && selectedVertexCount <= 1
    );
    const base = {
      navSurface: "feature-navbar",
      groupLabel: "Sketch",
      groupIcon: "sketch",
      groupDescription: "Sketch editing tools for the active sketch."
    };
    if (command.id === "sketch.relations.toggle") {
      const visible = context.active?.sketchMode === "relations";
      return {
        ...base,
        active: visible,
        label: visible ? "Hide Relations" : "Show Relations",
        title: visible ? "Hide sketch relations" : "Show sketch relations",
        description: visible
          ? "Hide relation helpers for the active sketch."
          : "Show relation helpers for the active sketch."
      };
    }
    if (command.id === "sketch.line.create") {
      return {
        ...base,
        enabled: true,
        active: context.active?.activeSketchTool === "line",
        disabledReason: ""
      };
    }
    if (command.id === "sketch.line.contour") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "lineContour",
        disabledReason: enabled
          ? ""
          : "Line Contour is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.circle.create") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "circle",
        disabledReason: enabled
          ? ""
          : "Circle is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.circle.diameter") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "diameterCircle",
        disabledReason: enabled
          ? ""
          : "Diameter Circle is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.circle.threePoint") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "threePointCircle",
        disabledReason: enabled
          ? ""
          : "3 Point Circle is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.rectangle.center") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "centerRectangle",
        disabledReason: enabled
          ? ""
          : "Center Rectangle is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.roundedRectangle.create") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "roundedRectangle",
        disabledReason: enabled
          ? ""
          : "Rounded Rectangle is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.slot.create") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "slot",
        disabledReason: enabled
          ? ""
          : "Slot is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.slot.center") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "centerSlot",
        disabledReason: enabled
          ? ""
          : "Center Slot is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.arc.center") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "centerArc",
        disabledReason: enabled
          ? ""
          : "Center Arc is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.arc.centerContour") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "centerArcContour",
        disabledReason: enabled
          ? ""
          : "Center Arc Contour is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.arc.threePoint") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "threePointArc",
        disabledReason: enabled
          ? ""
          : "3 Point Arc is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.arc.threePointContour") {
      const enabled = context.active?.collection !== "features";
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "threePointArcContour",
        disabledReason: enabled
          ? ""
          : "3 Point Arc Contour is currently available on plate and standalone sketch objects."
      };
    }
    if (command.id === "sketch.corner.fillet") {
      const hasSelectedEdges = selectedEdgeCount > 0;
      const enabled = selectedVertexCount === 1 && selectedConstructionVertexCount === 0 && !hasSelectedEdges;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : hasSelectedEdges
            ? "Clear selected sketch edges before using Fillet; select only one outline sketch corner."
            : "Select one outline sketch corner before using Fillet."
      };
    }
    if (command.id === "sketch.edge.arc") {
      const label = "Edge Arc";
      const enabled = selectedEdgeCount === 1 && selectedConstructionEdgeCount === 0 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        active: context.active?.activeSketchTool === "edgeArc",
        disabledReason: enabled
          ? ""
          : sketchArcModifierDisabledReason({
            label,
            selectedEdgeCount,
            selectedArcEdgeCount,
            selectedConstructionEdgeCount,
            selectedVertexCount,
            requiresArc: false
          })
      };
    }
    if (command.id === "sketch.arc.flip") {
      const label = "Flip Arc";
      const enabled = selectedEdgeCount === 1 && selectedArcEdgeCount === 1 && selectedConstructionEdgeCount === 0 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchArcModifierDisabledReason({
            label,
            selectedEdgeCount,
            selectedArcEdgeCount,
            selectedConstructionEdgeCount,
            selectedVertexCount
          })
      };
    }
    if (command.id === "sketch.arc.split") {
      const label = "Split Arc";
      const enabled = selectedEdgeCount === 1 && selectedArcEdgeCount === 1 && selectedConstructionEdgeCount === 0 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchArcModifierDisabledReason({
            label,
            selectedEdgeCount,
            selectedArcEdgeCount,
            selectedConstructionEdgeCount,
            selectedVertexCount
          })
      };
    }
    if (command.id === "sketch.modify.trim") {
      return {
        ...base,
        enabled: hasTrimTarget,
        disabledReason: hasTrimTarget
          ? ""
          : "Select one sketch edge or two outline sketch edges before using Trim."
      };
    }
    if (command.id === "sketch.modify.extend") {
      return {
        ...base,
        enabled: hasExtendTarget,
        disabledReason: hasExtendTarget
          ? ""
          : "Select two outline sketch edges before using Extend."
      };
    }
    if (command.id === "sketch.modify.delete") {
      return {
        ...base,
        enabled: hasDeleteTarget,
        disabledReason: hasDeleteTarget
          ? ""
          : "Select one sketch relation, one sketch corner, outline edge, construction point, or construction edge before using Delete."
      };
    }
    if (command.id === "sketch.convert.toPlate") {
      return {
        ...base,
        enabled: standaloneSketch,
        disabledReason: standaloneSketch
          ? ""
          : "Convert To Plate is available for standalone sketch objects."
      };
    }
    if (command.id === "sketch.dimension.length") {
      const enabled = selectedEdgeCount === 1 && selectedArcEdgeCount === 0 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchLengthDimensionDisabledReason({ selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.dimension.angle") {
      const enabled = selectedEdgeCount === 2 && selectedArcEdgeCount === 0 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchAngleDimensionDisabledReason({ selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.dimension.distance") {
      const enabled = selectedVertexCount === 2 && selectedEdgeCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchDistanceDimensionDisabledReason({ selectedEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.dimension.radius") {
      const label = "Radius";
      const enabled = selectedEdgeCount === 1 && selectedArcEdgeCount === 1 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchArcDimensionDisabledReason({ label, selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.dimension.diameter") {
      const label = "Diameter";
      const enabled = selectedEdgeCount === 1 && selectedArcEdgeCount === 1 && selectedVertexCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchArcDimensionDisabledReason({ label, selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.relation.fix") {
      const enabled = (selectedVertexCount === 1 && selectedEdgeCount === 0)
        || (selectedEdgeCount === 1 && selectedVertexCount === 0);
      const fixed = selectedFixedRelationCount > 0;
      return {
        ...base,
        enabled,
        active: fixed,
        label: fixed ? "Unfix" : "Fix",
        title: fixed ? "Remove fixed relation" : "Fix selected sketch item",
        description: fixed
          ? "Remove the fixed relation from the selected sketch point or edge."
          : "Add a fixed relation to the selected sketch point or edge.",
        disabledReason: enabled
          ? ""
          : "Select one sketch point or one sketch edge before using Fix."
      };
    }
    if (command.id === "sketch.relation.coincident") {
      const label = "Coincident";
      const enabled = selectedVertexCount === 2 && selectedEdgeCount === 0;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchPointRelationDisabledReason({ label, selectedEdgeCount })
      };
    }
    if (command.id === "sketch.relation.pointOnCircle") {
      const selectedVertexId = selectedVertexCount === 1 ? context.sketchSelection.vertexIds[0] : null;
      const selectedEdgeId = selectedEdgeCount === 1 ? context.sketchSelection.edgeIds[0] : null;
      const selectedEdgeIsArc = Boolean(selectedEdgeId && sketchEdgeIsCircularArc(activeSketch, selectedEdgeId));
      const pointMovesOtherArc = selectedEdgeIsArc
        && sketchVertexTouchesOtherCircularArc(activeSketch, selectedVertexId, selectedEdgeId);
      const enabled = selectedVertexCount === 1
        && selectedEdgeCount === 1
        && selectedEdgeIsArc
        && !pointMovesOtherArc;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchPointOnCircleDisabledReason({
            selectedEdgeCount,
            selectedArcEdgeCount,
            selectedVertexCount,
            pointMovesOtherArc
          })
      };
    }
    if (command.id === "sketch.relation.tangent") {
      const label = "Tangent";
      const enabled = selectedVertexCount === 0 && selectedEdgeCount === 2 && selectedArcEdgeCount >= 1;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchEdgeRelationDisabledReason({ label, selectedEdgeCount, selectedArcEdgeCount, selectedVertexCount })
      };
    }
    if (command.id === "sketch.relation.concentric" || command.id === "sketch.relation.equalRadius") {
      const label = command.id === "sketch.relation.concentric" ? "Concentric" : "Equal Radius";
      const enabled = selectedVertexCount === 0 && selectedEdgeCount === 2 && selectedArcEdgeCount === 2;
      return {
        ...base,
        enabled,
        disabledReason: enabled
          ? ""
          : sketchEdgeRelationDisabledReason({
            label,
            selectedEdgeCount,
            selectedArcEdgeCount,
            selectedVertexCount,
            requiresTwoArcs: true
          })
      };
    }
    if (command.id === "sketch.relations.infer") {
      return {
        ...base,
        enabled: true,
        disabledReason: ""
      };
    }
    if (command.id === "sketch.selection.clear") {
      return {
        ...base,
        enabled: hasSketchSelection,
        disabledReason: hasSketchSelection ? "" : "No sketch entities are selected."
      };
    }
    if (command.id === "sketch.view.clean") {
      return {
        ...base,
        enabled: true,
        active: context.active?.sketchMode === "clean",
        disabledReason: ""
      };
    }
    if (command.id === "sketch.exit") {
      return base;
    }
    return base;
  }

  function panelCommandState(command) {
    const panel = command.id === "panel.library.toggle"
      ? { label: DATA_DOCK_COMMAND_LABEL, visible: workspaceBindings?.dataDockVisible?.() }
      : command.id === "panel.inspector.toggle"
        ? { label: INSPECTOR_PANEL_LABEL, visible: workspaceBindings?.inspectorDockVisible?.() }
        : null;
    if (!panel) return {};
    return {
      active: Boolean(panel.visible),
      title: panel.visible ? `Hide ${panel.label}` : `Show ${panel.label}`,
      description: panel.visible
        ? `${panel.label} dock is visible.`
        : command.description
    };
  }

  function dataDockTabCommandState(command) {
    if (!command.dataDockTab) return {};
    const active = workspaceBindings?.dataDockVisible?.() && workspaceBindings?.dataDockActiveTab?.() === command.dataDockTab;
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
    const activeContext = workspaceBindings?.inspectorActiveContext?.();
    const active = workspaceBindings?.inspectorDockVisible?.() && activeContext === command.inspectorContext;
    const available = workspaceBindings?.inspectorContextAvailable?.(command.inspectorContext);
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

  function plannedModelCommandState() {
    return {};
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
      ...plannedModelCommandState(command),
      ...sketchContextCommandState(command)
    };
  }

  function syncSketchRelationsButton() {
    const state = relationCommandState();
    getModelingUi()?.setSketchRelationsState?.({
      available: state.available,
      visible: state.available && state.active
    });
    refreshStatusBar({ relations: state });
    refreshWorkspaceCommandState();
  }

  function toggleRelationsCommand() {
    const state = relationCommandState();
    if (state.available) {
      const toggled = getPlateSketchEdit()?.toggleRelations?.();
      syncSketchRelationsButton();
      const nextState = relationCommandState();
      refreshStatusBar({ relations: nextState });
      updateModelingStatus(nextState.active
        ? "Sketch relations shown."
        : "Sketch relations hidden.");
      return toggled;
    }
    autoRelationsEnabled = !autoRelationsEnabled;
    getModelingUi()?.setAutoRelations?.(autoRelationsEnabled);
    refreshStatusBar({ relations: relationCommandState() });
    updateModelingStatus(autoRelationsEnabled
      ? "Automatic axis relations on."
      : "Automatic axis relations off.");
    refreshWorkspaceCommandState();
    return autoRelationsEnabled;
  }

  function setAutoRelationsEnabled(enabled) {
    autoRelationsEnabled = Boolean(enabled);
    updateModelingStatus(autoRelationsEnabled ? "Automatic axis relations on." : "Automatic axis relations off.");
    refreshStatusBar({ relations: relationCommandState() });
    refreshWorkspaceCommandState();
    return autoRelationsEnabled;
  }

  function setActiveModelingCommand(type) {
    activeCommandId = type ? MODELING_COMMAND_ID_BY_TYPE[type] || null : null;
    const inspectorDock = workspaceBindings?.inspectorDockElement?.();
    if (inspectorDock) {
      inspectorDock.dataset.authoringActive = activeCommandId && !MODELING_COMMANDS_WITH_SIDE_DOCK_EDITOR.has(type)
        ? "true"
        : "false";
      inspectorDock.dataset.authoringTool = type || "";
    }
    workspaceBindings?.syncNavCubeDockClearance?.();
    if (activeCommandId) workspaceBindings?.showInspectorProperties?.();
    getModelingUi()?.setActive(type || null);
    getEditorApi()?.refresh?.();
    refreshWorkspaceCommandState();
  }

  function startTrimCreate() {
    getCommandController()?.cancel();
    setActiveModelingCommand("trim");
    getDimensionEdit()?.clearDimension?.({ render: false });
    getEditorApi()?.clearSelection?.({ silent: true });
    getMemberEdit()?.clear?.({ notify: false });
    clearAuxiliaryEditors();
    getTrimJointEditorApi()?.openCreateMode?.();
    workspaceBindings?.showInspectorProperties?.({ notify: false });
    getTrimCreate()?.start?.();
  }

  function startGridCreate() {
    return openGridEditor();
  }

  function openGridEditor() {
    const project = api.project();
    const selectedObjectId = getEditorApi()?.selectedState?.().objectId || "";
    const selectedEntry = selectedObjectId ? project.objectIndex?.[selectedObjectId] : null;
    const gridSystems = project.model?.gridSystems || {};
    const gridSystemId = selectedEntry?.collection === "gridSystems"
      ? selectedObjectId
      : selectedEntry?.collection === "levels"
        ? Object.values(gridSystems).find((grid) => Array.isArray(grid.levelIds) && grid.levelIds.includes(selectedObjectId))?.id
        : Object.keys(gridSystems)[0];
    getCommandController()?.cancel();
    getTrimCreate()?.cancel();
    setActiveModelingCommand(null);
    clearAuxiliaryEditors({ overlay: true });
    if (!gridSystemId) {
      getEditorApi()?.openGridEditor?.();
      workspaceBindings?.showInspectorProperties?.({ notify: true });
      updateModelingStatus("Grid editor opened. Add a grid system from Properties.");
      return true;
    }
    getEditorApi()?.selectObject?.(gridSystemId, { inspectorPanel: "properties" });
    getModelBrowserUi()?.showObject?.("gridSystems", gridSystemId);
    workspaceBindings?.showInspectorProperties?.({ notify: true });
    updateModelingStatus(`Grid editor opened: ${gridSystemId}.`);
    return true;
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
    workspaceBindings?.showDataDockTab?.(action.tab);
    if (action.type === "showFileRow") {
      const shown = getProjectFilesPanelUi()?.showRow?.(action.rowId);
      updateModelingStatus(shown === false ? `File row not found: ${action.rowId}` : `${item.title} shown in Files.`);
      return shown !== false;
    }
    if (action.type === "showDataRow") {
      const shown = getProjectDataPanelUi()?.showRow?.(action.rowId);
      updateModelingStatus(shown === false ? `Data row not found: ${action.rowId}` : `${item.title} shown in Data.`);
      return shown !== false;
    }
    if (action.type === "showModelCollection") {
      const shown = getModelBrowserUi()?.showCollection?.(action.collectionId);
      updateModelingStatus(shown === false ? `Model collection not found: ${action.collectionId}` : `Model browser: ${action.collectionId}`);
      return shown !== false;
    }
    if (action.type === "selectModelObject") {
      getModelBrowserUi()?.showObject?.(action.collectionId, action.objectId);
      viewerApp.selectObject(action.objectId);
      refreshSelectionSurfaces();
      updateModelingStatus(`Selected ${action.objectId}.`);
      return true;
    }
    if (action.type === "selectSmartComponent") {
      getModelBrowserUi()?.showObject?.(action.collectionId, action.smartComponentId || action.objectId);
      viewerApp.selectSmartComponent(action.smartComponentId || action.objectId);
      refreshSelectionSurfaces();
      updateModelingStatus(`Selected ${action.smartComponentId || action.objectId}.`);
      return true;
    }
    if (action.type === "showSmartComponentPreset") {
      const browser = action.tab === "connections" ? getConnectionComponentBrowserUi() : getSmartComponentBrowserUi();
      const shown = browser?.showPreset?.(action.presetId);
      updateModelingStatus(shown === false ? `Smart Component preset not found: ${action.presetId}` : `${item.title} shown in ${action.tab === "connections" ? "Connections" : "Components"}.`);
      return shown !== false;
    }
    return false;
  }

  function showConnectionComponentsCommand() {
    workspaceBindings?.showDataDockTab?.("connections");
    updateModelingStatus("Connection components shown in Connections.");
    return true;
  }

  function showModelCollectionCommand(collectionId, label) {
    workspaceBindings?.showDataDockTab?.("model");
    const shown = getModelBrowserUi()?.showCollection?.(collectionId);
    updateModelingStatus(shown === false ? `${label} collection not found.` : `${label} shown in Model Browser.`);
    return shown !== false;
  }

  function modelingCommandActions() {
    return {
      onBeam: () => viewerApp.runCommand("model.beam.create"),
      onColumn: () => viewerApp.runCommand("model.column.create"),
      onPlate: () => viewerApp.runCommand("model.plate.create"),
      onSketch: () => viewerApp.runCommand("model.sketch.create"),
      onWorkPlane: () => viewerApp.runCommand("model.workPlane.set"),
      onPlateBend: () => viewerApp.runCommand("model.plateBend.add"),
      onTrim: () => viewerApp.runCommand("model.trim.create"),
      onConnectionComponentOpen: () => viewerApp.runCommand("model.connectionComponent.open"),
      onWeldOpen: () => viewerApp.runCommand("model.weld.open"),
      onBoltGroupOpen: () => viewerApp.runCommand("model.boltGroup.open"),
      onBoltOpen: () => viewerApp.runCommand("model.bolt.open"),
      onAutoConnectionOpen: () => viewerApp.runCommand("model.autoConnection.open"),
      onGridCreate: () => viewerApp.runCommand("model.grid.create"),
      onSketchLineCreate: () => viewerApp.runCommand("sketch.line.create"),
      onSketchLineContourCreate: () => viewerApp.runCommand("sketch.line.contour"),
      onSketchCircleCreate: () => viewerApp.runCommand("sketch.circle.create"),
      onSketchDiameterCircleCreate: () => viewerApp.runCommand("sketch.circle.diameter"),
      onSketchThreePointCircleCreate: () => viewerApp.runCommand("sketch.circle.threePoint"),
      onSketchCenterRectangleCreate: () => viewerApp.runCommand("sketch.rectangle.center"),
      onSketchRoundedRectangleCreate: () => viewerApp.runCommand("sketch.roundedRectangle.create"),
      onSketchSlotCreate: () => viewerApp.runCommand("sketch.slot.create"),
      onSketchCenterSlotCreate: () => viewerApp.runCommand("sketch.slot.center"),
      onSketchCenterArcCreate: () => viewerApp.runCommand("sketch.arc.center"),
      onSketchCenterArcContourCreate: () => viewerApp.runCommand("sketch.arc.centerContour"),
      onSketchThreePointArcCreate: () => viewerApp.runCommand("sketch.arc.threePoint"),
      onSketchThreePointArcContourCreate: () => viewerApp.runCommand("sketch.arc.threePointContour"),
      onSketchCornerFillet: () => viewerApp.runCommand("sketch.corner.fillet"),
      onSketchEdgeArc: () => viewerApp.runCommand("sketch.edge.arc"),
      onSketchArcFlip: () => viewerApp.runCommand("sketch.arc.flip"),
      onSketchArcSplit: () => viewerApp.runCommand("sketch.arc.split"),
      onSketchTrim: () => viewerApp.runCommand("sketch.modify.trim"),
      onSketchExtend: () => viewerApp.runCommand("sketch.modify.extend"),
      onSketchDelete: () => viewerApp.runCommand("sketch.modify.delete"),
      onSketchConvertToPlate: () => viewerApp.runCommand("sketch.convert.toPlate"),
      onSketchLengthDimension: () => viewerApp.runCommand("sketch.dimension.length"),
      onSketchAngleDimension: () => viewerApp.runCommand("sketch.dimension.angle"),
      onSketchDistanceDimension: () => viewerApp.runCommand("sketch.dimension.distance"),
      onSketchRadiusDimension: () => viewerApp.runCommand("sketch.dimension.radius"),
      onSketchDiameterDimension: () => viewerApp.runCommand("sketch.dimension.diameter"),
      onSketchFixRelation: () => viewerApp.runCommand("sketch.relation.fix"),
      onSketchCoincidentRelation: () => viewerApp.runCommand("sketch.relation.coincident"),
      onSketchPointOnCircleRelation: () => viewerApp.runCommand("sketch.relation.pointOnCircle"),
      onSketchTangentRelation: () => viewerApp.runCommand("sketch.relation.tangent"),
      onSketchConcentricRelation: () => viewerApp.runCommand("sketch.relation.concentric"),
      onSketchEqualRadiusRelation: () => viewerApp.runCommand("sketch.relation.equalRadius"),
      onSketchRelationsToggle: () => viewerApp.runCommand("sketch.relations.toggle"),
      onSketchRelationsInfer: () => viewerApp.runCommand("sketch.relations.infer"),
      onSketchCleanView: () => viewerApp.runCommand("sketch.view.clean"),
      onSketchSelectionClear: () => viewerApp.runCommand("sketch.selection.clear"),
      onSketchExit: () => viewerApp.runCommand("sketch.exit")
    };
  }

  function registerCommands() {
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
      "settings.visibility.grids.toggle": () => toggleRenderVisibilityCommand("grids"),
      "settings.visibility.planes.toggle": () => toggleRenderVisibilityCommand("referencePlanes")
    };
    const dataDockCommandHandlers = Object.fromEntries(DATA_DOCK_TABS.map((tab) => [
      tab.commandId,
      () => workspaceBindings?.showDataDockTab?.(tab.id)
    ]));
    const inspectorContextCommandHandlers = Object.fromEntries(INSPECTOR_CONTEXTS.map((context) => [
      context.commandId,
      () => workspaceBindings?.showInspectorContext?.(context.id)
    ]));
    const shellCommandActions = createViewerPanelCommandActions({
      libraryPanel: workspaceBindings?.dataDockElement?.(),
      inspectorPanel: workspaceBindings?.inspectorDockElement?.(),
      toolbar,
      statusBar: getStatusBar(),
      getWorkspace: () => workspaceBindings?.workspace?.(),
      setStatus: updateModelingStatus
    });
    return viewerApp.registerCommands({
      "model.beam.create": () => getCommandController()?.startBeam(),
      "model.column.create": () => getCommandController()?.startColumn(),
      "model.plate.create": () => getCommandController()?.startPlate(),
      "model.sketch.create": () => getCommandController()?.startSketch(),
      "model.workPlane.set": () => getCommandController()?.startWorkPlane(),
      "model.plateBend.add": () => getCommandController()?.startPlateBend(),
      "model.trim.create": () => startTrimCreate(),
      "model.connectionComponent.open": () => showConnectionComponentsCommand(),
      "model.weld.open": () => showModelCollectionCommand("welds", "Welds"),
      "model.boltGroup.open": () => showModelCollectionCommand("fastenerGroups", "Bolt groups"),
      "model.bolt.open": () => showModelCollectionCommand("holePatterns", "Bolts"),
      "model.autoConnection.open": () => showModelCollectionCommand("connectionZones", "Auto connections"),
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
      "sketch.relations.toggle": () => toggleRelationsCommand(),
      "sketch.line.create": () => {
        const created = getPlateSketchEdit()?.addLineForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.line.contour": () => {
        const created = getPlateSketchEdit()?.createLineContourSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.circle.create": () => {
        const created = getPlateSketchEdit()?.createCircleSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.circle.diameter": () => {
        const created = getPlateSketchEdit()?.createDiameterCircleSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.circle.threePoint": () => {
        const created = getPlateSketchEdit()?.createThreePointCircleSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.rectangle.center": () => {
        const created = getPlateSketchEdit()?.createCenterRectangleSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.roundedRectangle.create": () => {
        const created = getPlateSketchEdit()?.createRoundedRectangleSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.slot.create": () => {
        const created = getPlateSketchEdit()?.createSlotSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.slot.center": () => {
        const created = getPlateSketchEdit()?.createCenterSlotSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.arc.center": () => {
        const created = getPlateSketchEdit()?.createCenterArcSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.arc.centerContour": () => {
        const created = getPlateSketchEdit()?.createCenterArcContourSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.arc.threePoint": () => {
        const created = getPlateSketchEdit()?.createThreePointArcFromSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.arc.threePointContour": () => {
        const created = getPlateSketchEdit()?.createThreePointArcContourSketch?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return created;
      },
      "sketch.relations.infer": () => {
        const inferred = getPlateSketchEdit()?.inferRelations?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return inferred;
      },
      "sketch.corner.fillet": () => {
        const applied = getPlateSketchEdit()?.filletSelectedCorner?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return applied;
      },
      "sketch.edge.arc": () => {
        const converted = getPlateSketchEdit()?.convertSelectedEdgeToArc?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return converted;
      },
      "sketch.arc.flip": () => {
        const flipped = getPlateSketchEdit()?.flipSelectedArc?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return flipped;
      },
      "sketch.arc.split": () => {
        const split = getPlateSketchEdit()?.splitSelectedArc?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return split;
      },
      "sketch.modify.trim": () => {
        const trimmed = getPlateSketchEdit()?.trimSelectedSketchEntity?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return trimmed;
      },
      "sketch.modify.extend": () => {
        const extended = getPlateSketchEdit()?.extendSelectedSketchEntity?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return extended;
      },
      "sketch.modify.delete": () => {
        const removed = getPlateSketchEdit()?.removeSelectedSketchEntity?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return removed;
      },
      "sketch.convert.toPlate": () => {
        const converted = getPlateSketchEdit()?.convertSketchToPlate?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return converted;
      },
      "sketch.dimension.length": () => {
        const added = getPlateSketchEdit()?.addLengthDimensionForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.dimension.angle": () => {
        const added = getPlateSketchEdit()?.addAngleDimensionForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.dimension.distance": () => {
        const added = getPlateSketchEdit()?.addDistanceDimensionForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.dimension.radius": () => {
        const added = getPlateSketchEdit()?.addRadiusDimensionForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.dimension.diameter": () => {
        const added = getPlateSketchEdit()?.addDiameterDimensionForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.relation.fix": () => {
        const toggled = getPlateSketchEdit()?.toggleFixedRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return toggled;
      },
      "sketch.relation.coincident": () => {
        const added = getPlateSketchEdit()?.addCoincidentRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.relation.pointOnCircle": () => {
        const added = getPlateSketchEdit()?.addPointOnCircleRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.relation.tangent": () => {
        const added = getPlateSketchEdit()?.addTangentRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.relation.concentric": () => {
        const added = getPlateSketchEdit()?.addConcentricRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.relation.equalRadius": () => {
        const added = getPlateSketchEdit()?.addEqualRadiusRelationForSelection?.();
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return added;
      },
      "sketch.selection.clear": () => {
        const cleared = getPlateSketchEdit()?.clearSelection?.({ force: true });
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        return cleared;
      },
      "sketch.view.clean": () => {
        const cleaned = getPlateSketchEdit()?.setSketchMode?.("clean");
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        updateModelingStatus("Sketch clean view.");
        return cleaned;
      },
      "sketch.exit": () => {
        getPlateSketchEdit()?.clear?.({ overlay: true });
        syncSketchRelationsButton();
        refreshWorkspaceCommandState();
        updateModelingStatus("Sketch mode closed.");
        return true;
      },
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
        if (getTrimCreate()?.cancel?.()) {
          setActiveModelingCommand(null);
          return;
        }
        getCommandController()?.cancel();
        setActiveModelingCommand(null);
      }
    });
  }

  function viewerCommandItems(options = {}) {
    return createViewerCommandItems({
      app: viewerApp,
      shortcutLabelFor: (command) => options.shortcutLabelFor?.(command) || "",
      commandStateFor: viewerRuntimeCommandState,
      ...options
    });
  }

  return {
    activeCommandId: () => activeCommandId,
    displayMode: () => displayMode,
    viewOrientation: () => viewOrientation,
    autoRelationsEnabled: () => autoRelationsEnabled,
    setAutoRelationsEnabled,
    setActiveModelingCommand,
    setSnapStrengthCommand,
    setSnapScopeCommand,
    snapScopeStatus,
    syncCameraSurfaces,
    syncSketchRelationsButton,
    relationCommandState,
    modelingCommandActions,
    viewerCommandItems,
    leftDockCommandItems,
    registerCommands,
    startTrimCreate
  };
}
