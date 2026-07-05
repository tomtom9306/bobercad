import {
  DATA_DOCK_COMMAND_DESCRIPTION,
  DATA_DOCK_COMMAND_ICON,
  DATA_DOCK_COMMAND_LABEL,
  DATA_DOCK_COMMAND_TITLE,
  DATA_DOCK_TABS
} from "./data-dock-metadata.mjs";
import { INSPECTOR_COMMAND_DESCRIPTION, INSPECTOR_COMMAND_ICON, INSPECTOR_COMMAND_LABEL, INSPECTOR_COMMAND_TITLE, INSPECTOR_CONTEXTS } from "./inspector-dock-metadata.mjs";
import { COMMAND_GROUPS } from "./command-group-metadata.mjs";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS } from "./snap-metadata.mjs";
import { DISPLAY_MODE_SPECS, VIEW_ORIENTATION_SPECS } from "./view-metadata.mjs";

export { COMMAND_GROUPS };

const FEATURE_NAVBAR_SURFACE = "feature-navbar";

export const MODELING_TOOLBAR_COMMANDS = [
  {
    id: "model.beam.create",
    command: "beam",
    action: "onBeam",
    shortcut: "createBeam",
    keyFallback: "B",
    label: "Beam",
    title: "Create beam",
    description: "Create a beam from two picked points.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "members",
    defaultToolbar: "modeling",
    icon: "beam"
  },
  {
    id: "model.column.create",
    command: "column",
    action: "onColumn",
    shortcut: "createColumn",
    keyFallback: "C",
    label: "Column",
    title: "Create column",
    description: "Create a vertical column from a base point.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "members",
    defaultToolbar: "modeling",
    icon: "column"
  },
  {
    id: "model.plate.create",
    command: "plate",
    action: "onPlate",
    shortcut: "createPlate",
    keyFallback: "P",
    label: "Plate",
    title: "Create plate",
    description: "Create a plate by placing its outline and thickness.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "plates",
    defaultToolbar: "modeling",
    icon: "plate"
  },
  {
    id: "model.sketch.create",
    command: "sketch",
    action: "onSketch",
    shortcut: "createSketch",
    keyFallback: "S",
    label: "Sketch",
    title: "Create sketch",
    description: "Start a sketch on the active work plane.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "sketching",
    defaultToolbar: "modeling",
    icon: "sketch"
  },
  {
    id: "model.workPlane.set",
    command: "workPlane",
    action: "onWorkPlane",
    shortcut: "setWorkPlane",
    keyFallback: "W",
    label: "Work Plane",
    title: "Set work plane from 3 points",
    description: "Define the active modeling plane from three points.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "sketching",
    defaultToolbar: "modeling",
    icon: "work-plane"
  },
  {
    id: "model.plateBend.add",
    command: "plateBend",
    action: "onPlateBend",
    shortcut: "addPlateBend",
    keyFallback: "F",
    label: "Plate Bend",
    title: "Add plate bend",
    description: "Add a bend feature to a plate.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "plates",
    defaultToolbar: "modeling",
    icon: "bend"
  },
  {
    id: "model.trim.create",
    command: "trim",
    action: "onTrim",
    shortcut: "createTrim",
    keyFallback: "T",
    label: "Trim",
    title: "Create trim",
    description: "Create a trim joint between selected members.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "modify",
    defaultToolbar: "modeling",
    icon: "trim"
  }
];

export const MODEL_CONNECTION_COMMANDS = [
  {
    id: "model.connectionComponent.open",
    action: "onConnectionComponentOpen",
    label: "Connection Component",
    title: "Show connection components",
    description: "Open connection component presets in the Connections panel.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "connections",
    icon: "smart-component"
  },
  {
    id: "model.weld.open",
    action: "onWeldOpen",
    label: "Weld",
    title: "Show welds",
    description: "Open weld objects in the Model Browser.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "connections",
    icon: "weld"
  },
  {
    id: "model.boltGroup.open",
    action: "onBoltGroupOpen",
    label: "Bolt Group",
    title: "Show bolt groups",
    description: "Open bolt group objects in the Model Browser.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "connections",
    icon: "fastener"
  },
  {
    id: "model.bolt.open",
    action: "onBoltOpen",
    label: "Bolt",
    title: "Show bolts",
    description: "Open bolt hole patterns in the Model Browser.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "connections",
    icon: "hole-pattern"
  },
  {
    id: "model.autoConnection.open",
    action: "onAutoConnectionOpen",
    label: "Auto",
    title: "Show auto connections",
    description: "Open automatic connection zones in the Model Browser.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "connections",
    icon: "connection-zone"
  }
];

export const MODEL_REFERENCE_COMMANDS = [
  {
    id: "model.grid.create",
    action: "onGridCreate",
    label: "Grid System",
    title: "Grid System Editor",
    description: "Open grid system and level editing in Properties.",
    group: "model",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "references",
    icon: "grid"
  }
];

export const TOOLS_WORKFLOW_COMMANDS = [
  {
    id: "tools.clashDetection.open",
    action: "onClashDetectionOpen",
    label: "Clash Detection",
    title: "Open clash detection",
    description: "Review model object clashes and coordination issues.",
    group: "tools",
    status: "planned",
    implemented: false,
    disabledReason: "Clash detection workflow is planned.",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "coordination",
    icon: "search"
  }
];

export const STRUCTURAL_ANALYSIS_COMMANDS = [
  {
    id: "structural-analysis.open",
    action: "onStructuralAnalysisOpen",
    label: "Structural Analysis",
    title: "Open structural analysis",
    description: "Prepare and review structural analysis workflows.",
    group: "structural-analysis",
    status: "planned",
    implemented: false,
    disabledReason: "Structural analysis workflow is planned.",
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "analysis",
    icon: "feature"
  }
];

export const CORE_COMMANDS = [
  {
    id: "command.cancel",
    command: "cancel",
    action: "onCancel",
    shortcut: "cancel",
    keyFallback: "Escape",
    label: "Cancel",
    title: "Cancel command",
    description: "Stop the active command or close the current edit.",
    group: "tools",
    ribbonSection: "commands",
    icon: "cancel"
  }
];

export const VIEW_ORIENTATION_COMMANDS = VIEW_ORIENTATION_SPECS.map((spec) => ({
  id: `view.orientation.${spec.id}`,
  action: `onViewOrientation${spec.label}`,
  viewOrientation: spec.id,
  label: `${spec.label} View`,
  title: spec.title,
  description: spec.description,
  group: "tools",
  ribbonSection: "orientation",
  toolbarPin: true,
  settingsStripGroup: spec.settingsStripGroup,
  settingsStripLabel: spec.settingsStripLabel,
  settingsStripOrder: spec.settingsStripOrder,
  icon: "view-orientation"
}));

export const DISPLAY_MODE_COMMANDS = DISPLAY_MODE_SPECS.map((spec) => ({
  id: `view.displayMode.${spec.id}`,
  action: `onDisplayMode${spec.label.replace(/[^A-Za-z0-9]/g, "")}`,
  displayMode: spec.id,
  label: spec.label,
  title: spec.title,
  description: spec.description,
  group: "tools",
  ribbonSection: "display",
  toolbarPin: true,
  settingsStripGroup: spec.settingsStripGroup,
  settingsStripLabel: spec.settingsStripLabel,
  settingsStripOrder: spec.settingsStripOrder,
  icon: spec.icon
}));

export const VIEW_COMMANDS = [
  {
    id: "view.reset",
    action: "onResetView",
    label: "Reset View",
    title: "Reset view",
    description: "Reset the camera and fit the model to the canvas.",
    group: "tools",
    ribbonSection: "camera",
    toolbarPin: true,
    icon: "reset-view"
  },
  {
    id: "view.fitSelection",
    action: "onFitSelection",
    label: "Fit Selection",
    title: "Fit selection",
    description: "Frame the current selection in the canvas.",
    group: "tools",
    ribbonSection: "camera",
    toolbarPin: true,
    icon: "zoom-fit"
  },
  ...DISPLAY_MODE_COMMANDS,
  ...VIEW_ORIENTATION_COMMANDS
];

export const SELECT_COMMANDS = [
  {
    id: "selection.clear",
    action: "onClearSelection",
    label: "Clear Selection",
    title: "Clear selection",
    description: "Clear the current member, object, or Smart Component selection.",
    group: "tools",
    ribbonSection: "selection",
    toolbarPin: true,
    icon: "selection-clear"
  }
];

export const SNAP_SCOPE_COMMANDS = SNAP_SCOPE_MODES.map((mode) => ({
  id: `selection.scope.${mode.id}`,
  action: `onSelectionScope${mode.label}`,
  snapScopeMode: mode.id,
  snapScopePatch: mode.patch,
  label: `${mode.label} Scope`,
  title: `Selection scope: ${mode.label}`,
  description: mode.description,
  group: "tools",
  ribbonSection: "scope",
  toolbarPin: true,
  icon: mode.icon
}));

export const DATA_DOCK_COMMANDS = DATA_DOCK_TABS.map((tab) => ({
  id: tab.commandId,
  action: tab.action,
  dataDockTab: tab.id,
  label: tab.label,
  title: tab.title,
  description: tab.description,
  group: "tools",
  ribbonSection: ["components", "connections"].includes(tab.id) ? "libraries" : "project-data",
  icon: tab.icon
}));

export const PANEL_COMMANDS = [
  {
    id: "panel.library.toggle",
    action: "onLibraryToggle",
    label: DATA_DOCK_COMMAND_LABEL,
    title: DATA_DOCK_COMMAND_TITLE,
    description: DATA_DOCK_COMMAND_DESCRIPTION,
    group: "tools",
    ribbonSection: "docks",
    toolbarPin: true,
    icon: DATA_DOCK_COMMAND_ICON
  },
  {
    id: "panel.inspector.toggle",
    action: "onInspectorToggle",
    label: INSPECTOR_COMMAND_LABEL,
    title: INSPECTOR_COMMAND_TITLE,
    description: INSPECTOR_COMMAND_DESCRIPTION,
    group: "tools",
    ribbonSection: "docks",
    toolbarPin: true,
    icon: INSPECTOR_COMMAND_ICON
  }
];

export const INSPECTOR_CONTEXT_COMMANDS = INSPECTOR_CONTEXTS.map((context) => ({
  id: context.commandId,
  action: context.action,
  inspectorContext: context.id,
  label: context.label,
  title: context.title || `Show ${context.label}`,
  description: context.description,
  group: "tools",
  ribbonSection: "properties",
  icon: context.icon
}));

export const SNAP_STRENGTH_COMMANDS = SNAP_STRENGTH_SPECS.map((spec) => ({
  id: `settings.snapStrength.${spec.id}`,
  action: `onSnapStrength${spec.label}`,
  snapStrength: spec.id,
  label: `Snap ${spec.label}`,
  title: `Set snap strength: ${spec.label}`,
  description: spec.description,
  group: "tools",
  ribbonSection: "snap",
  toolbarPin: true,
  icon: "snap"
}));

export const SNAP_TARGET_COMMANDS = SNAP_TARGET_SPECS.map((target) => ({
  id: `settings.snapTarget.${target.key}.toggle`,
  action: `onSnapTarget${target.key[0].toUpperCase()}${target.key.slice(1)}Toggle`,
  snapTarget: target.key,
  label: `${target.label} Snap`,
  title: `Toggle snap target: ${target.label}`,
  description: target.description,
  group: "tools",
  ribbonSection: "snap",
  icon: "snap"
}));

export const RENDER_VISIBILITY_COMMANDS = [
  {
    id: "settings.visibility.cuts.toggle",
    action: "onCuttingObjectsVisibilityToggle",
    renderVisibilityKey: "cuttingObjects",
    label: "Cuts",
    title: "Toggle cutting objects",
    description: "Show or hide cutting objects and trim cut callouts.",
    group: "tools",
    ribbonSection: "display",
    settingsStripGroup: "visibility",
    settingsStripLabel: "Cuts",
    settingsStripOrder: 0,
    icon: "feature"
  },
  {
    id: "settings.visibility.planes.toggle",
    action: "onReferencePlanesVisibilityToggle",
    renderVisibilityKey: "referencePlanes",
    label: "Planes",
    title: "Toggle reference planes",
    description: "Show or hide reference and trim plane markers.",
    group: "tools",
    ribbonSection: "display",
    settingsStripGroup: "visibility",
    settingsStripLabel: "Planes",
    settingsStripOrder: 1,
    icon: "reference-plane"
  },
  {
    id: "settings.visibility.grids.toggle",
    action: "onGridVisibilityToggle",
    renderVisibilityKey: "grids",
    label: "Grids",
    title: "Toggle grids",
    description: "Show or hide structural grid system lines.",
    group: "tools",
    ribbonSection: "display",
    settingsStripGroup: "visibility",
    settingsStripLabel: "Grids",
    settingsStripOrder: 2,
    icon: "grid"
  },
  {
    id: "settings.visibility.fasteners.toggle",
    action: "onFastenersVisibilityToggle",
    renderVisibilityKey: "fasteners",
    label: "Fasteners",
    title: "Toggle fasteners",
    description: "Show or hide fastener assemblies.",
    group: "tools",
    ribbonSection: "display",
    settingsStripGroup: "visibility",
    settingsStripLabel: "Fasteners",
    settingsStripOrder: 3,
    icon: "fastener"
  }
];

export const SETTINGS_COMMANDS = [
  {
    id: "settings.relations.toggle",
    action: "onRelationsToggle",
    label: "Axis Relations",
    title: "Toggle axis relations",
    description: "Toggle automatic axis relation helpers or the active sketch relation overlay.",
    group: "tools",
    ribbonSection: "relations",
    toolbarPin: true,
    icon: "relation"
  },
  {
    id: "settings.snap.toggle",
    action: "onSnapSettingsToggle",
    label: "Snap Settings",
    title: "Toggle snap settings",
    description: "Open or close snap strength and filter settings.",
    group: "tools",
    ribbonSection: "snap",
    toolbarPin: true,
    icon: "settings"
  },
  ...RENDER_VISIBILITY_COMMANDS,
  ...SNAP_STRENGTH_COMMANDS
];

export const SKETCH_CONTEXT_COMMANDS = [
  {
    id: "sketch.line.create",
    action: "onSketchLineCreate",
    label: "Line",
    title: "Create construction line",
    description: "Draw a construction line in the active sketch or add one from a selected edge or two selected points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "line"
  },
  {
    id: "sketch.line.contour",
    action: "onSketchLineContourCreate",
    label: "Line Contour",
    title: "Create line/arc contour",
    description: "Draw a closed contour by picking three or more points; use Alt or Shift+Alt to turn contour segments into semantic arcs.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "line"
  },
  {
    id: "sketch.circle.create",
    action: "onSketchCircleCreate",
    label: "Circle",
    title: "Create circle sketch",
    description: "Draw a semantic circular sketch by picking a center point and radius point.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "circle"
  },
  {
    id: "sketch.circle.diameter",
    action: "onSketchDiameterCircleCreate",
    label: "Diameter Circle",
    title: "Create diameter circle sketch",
    description: "Draw a semantic circular sketch by picking two opposite diameter points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "circle"
  },
  {
    id: "sketch.circle.threePoint",
    action: "onSketchThreePointCircleCreate",
    label: "3 Point Circle",
    title: "Create 3 point circle sketch",
    description: "Draw a semantic circular sketch through three picked points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "circle"
  },
  {
    id: "sketch.rectangle.center",
    action: "onSketchCenterRectangleCreate",
    label: "Center Rect",
    title: "Create center rectangle sketch",
    description: "Draw a centered semantic rectangle by picking center and corner points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "rectangle"
  },
  {
    id: "sketch.roundedRectangle.create",
    action: "onSketchRoundedRectangleCreate",
    label: "Rounded Rect",
    title: "Create rounded rectangle sketch",
    description: "Draw a semantic rounded rectangle by picking center, corner, and radius point.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "rounded-rectangle"
  },
  {
    id: "sketch.slot.create",
    action: "onSketchSlotCreate",
    label: "Slot",
    title: "Create slot sketch",
    description: "Draw a semantic rounded slot by picking start center, end center, and radius point.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "slot"
  },
  {
    id: "sketch.slot.center",
    action: "onSketchCenterSlotCreate",
    label: "Center Slot",
    title: "Create center slot sketch",
    description: "Draw a semantic rounded slot by picking center, end-center, and radius point.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "slot"
  },
  {
    id: "sketch.arc.center",
    action: "onSketchCenterArcCreate",
    label: "Center Arc",
    title: "Create center arc sketch",
    description: "Draw a construction arc from center, start, and end points in the active sketch.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "arc"
  },
  {
    id: "sketch.arc.centerContour",
    action: "onSketchCenterArcContourCreate",
    label: "Center Arc Contour",
    title: "Create center arc contour",
    description: "Draw a closed semantic arc-sector contour by picking center, start, and end points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "arc"
  },
  {
    id: "sketch.arc.threePoint",
    action: "onSketchThreePointArcCreate",
    label: "3 Point Arc",
    title: "Create 3 point arc",
    description: "Draw a construction arc through three points or convert three consecutive selected sketch vertices into a semantic circular arc.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "arc"
  },
  {
    id: "sketch.arc.threePointContour",
    action: "onSketchThreePointArcContourCreate",
    label: "3 Point Arc Contour",
    title: "Create 3 point arc contour",
    description: "Draw a closed semantic arc-sector contour through start, through, and end points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "create",
    icon: "arc"
  },
  {
    id: "sketch.corner.fillet",
    action: "onSketchCornerFillet",
    label: "Fillet",
    title: "Fillet selected corner",
    description: "Add a radius to the selected sketch corner.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "bend"
  },
  {
    id: "sketch.edge.arc",
    action: "onSketchEdgeArc",
    label: "Edge Arc",
    title: "Convert or update edge arc",
    description: "Convert a selected straight sketch edge into a semantic circular arc, or update a selected circular arc, by picking a through point.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "arc"
  },
  {
    id: "sketch.arc.flip",
    action: "onSketchArcFlip",
    label: "Flip Arc",
    title: "Flip selected arc",
    description: "Flip the selected circular sketch arc to the opposite side of its chord.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "arc"
  },
  {
    id: "sketch.arc.split",
    action: "onSketchArcSplit",
    label: "Split Arc",
    title: "Split selected arc",
    description: "Insert a midpoint vertex and split the selected circular sketch arc into two tangent arcs.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "arc"
  },
  {
    id: "sketch.modify.trim",
    action: "onSketchTrim",
    label: "Trim",
    title: "Trim selected sketch edge",
    description: "Trim or extend selected sketch outline edges, or remove a selected construction edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "trim"
  },
  {
    id: "sketch.modify.extend",
    action: "onSketchExtend",
    label: "Extend",
    title: "Extend selected sketch edge",
    description: "Extend one selected sketch outline edge to a second selected outline edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "extend"
  },
  {
    id: "sketch.modify.delete",
    action: "onSketchDelete",
    label: "Delete",
    title: "Delete sketch item",
    description: "Delete the selected sketch relation, corner, outline edge, construction point, or construction edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "delete"
  },
  {
    id: "sketch.convert.toPlate",
    action: "onSketchConvertToPlate",
    label: "To Plate",
    title: "Convert sketch to plate",
    description: "Create a plate from the active standalone sketch.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "modify",
    icon: "plate"
  },
  {
    id: "sketch.dimension.length",
    action: "onSketchLengthDimension",
    label: "Length",
    title: "Add length dimension",
    description: "Add a reference length dimension to the selected straight sketch edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "dimensions",
    icon: "dimension"
  },
  {
    id: "sketch.dimension.angle",
    action: "onSketchAngleDimension",
    label: "Angle",
    title: "Add angle dimension",
    description: "Add a reference angle dimension between two selected straight sketch edges.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "dimensions",
    icon: "dimension"
  },
  {
    id: "sketch.dimension.distance",
    action: "onSketchDistanceDimension",
    label: "Distance",
    title: "Add point distance dimension",
    description: "Add a reference distance dimension between two selected sketch points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "dimensions",
    icon: "dimension"
  },
  {
    id: "sketch.dimension.radius",
    action: "onSketchRadiusDimension",
    label: "Radius",
    title: "Add radius dimension",
    description: "Add a reference radius dimension to the selected circular sketch edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "dimensions",
    icon: "radius"
  },
  {
    id: "sketch.dimension.diameter",
    action: "onSketchDiameterDimension",
    label: "Diameter",
    title: "Add diameter dimension",
    description: "Add a reference diameter dimension to the selected circular sketch edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "dimensions",
    icon: "diameter"
  },
  {
    id: "sketch.relation.fix",
    action: "onSketchFixRelation",
    label: "Fix",
    title: "Fix selected sketch item",
    description: "Add or remove a fixed relation on the selected sketch point or edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "pin"
  },
  {
    id: "sketch.relation.coincident",
    action: "onSketchCoincidentRelation",
    label: "Coincident",
    title: "Add coincident relation",
    description: "Add a coincident relation between two selected sketch points.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "relation"
  },
  {
    id: "sketch.relation.pointOnCircle",
    action: "onSketchPointOnCircleRelation",
    label: "On Circle",
    title: "Add point on circle relation",
    description: "Keep one selected sketch point on one selected circular sketch edge.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "circle"
  },
  {
    id: "sketch.relation.tangent",
    action: "onSketchTangentRelation",
    label: "Tangent",
    title: "Add tangent relation",
    description: "Add a tangent relation between two selected sketch edges.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "relation"
  },
  {
    id: "sketch.relation.concentric",
    action: "onSketchConcentricRelation",
    label: "Concentric",
    title: "Add concentric relation",
    description: "Add a concentric relation between two selected circular sketch edges.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "relation"
  },
  {
    id: "sketch.relation.equalRadius",
    action: "onSketchEqualRadiusRelation",
    label: "Equal Radius",
    title: "Add equal radius relation",
    description: "Add an equal-radius relation between two selected circular sketch edges.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "radius"
  },
  {
    id: "sketch.relations.toggle",
    action: "onSketchRelationsToggle",
    label: "Relations",
    title: "Show or hide sketch relations",
    description: "Toggle the active sketch relation overlay.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "relation"
  },
  {
    id: "sketch.relations.infer",
    action: "onSketchRelationsInfer",
    label: "Infer Relations",
    title: "Infer missing sketch relations",
    description: "Infer axis and simple geometric relations for the active sketch.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "relations",
    icon: "relation"
  },
  {
    id: "sketch.view.clean",
    action: "onSketchCleanView",
    label: "Clean View",
    title: "Clean sketch view",
    description: "Hide sketch relations and clear sketch selection without leaving Sketch mode.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "selection",
    icon: "clean-view"
  },
  {
    id: "sketch.selection.clear",
    action: "onSketchSelectionClear",
    label: "Clear",
    title: "Clear sketch selection",
    description: "Clear selected sketch edges, corners, and relations.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "selection",
    icon: "selection-clear"
  },
  {
    id: "sketch.exit",
    action: "onSketchExit",
    label: "Exit Sketch",
    title: "Exit sketch mode",
    description: "Close the active sketch editor and return the toolbar to Model.",
    group: "model",
    groupLabel: "Sketch",
    groupIcon: "sketch",
    groupDescription: "Sketch editing tools for the active sketch.",
    ribbonSection: "selection",
    icon: "cancel"
  }
];

export function commandPaletteSpecs() {
  return [
    ...MODELING_TOOLBAR_COMMANDS,
    ...MODEL_CONNECTION_COMMANDS,
    ...MODEL_REFERENCE_COMMANDS,
    ...TOOLS_WORKFLOW_COMMANDS,
    ...STRUCTURAL_ANALYSIS_COMMANDS,
    ...VIEW_COMMANDS,
    ...SELECT_COMMANDS,
    ...SNAP_SCOPE_COMMANDS,
    ...DATA_DOCK_COMMANDS,
    ...PANEL_COMMANDS,
    ...INSPECTOR_CONTEXT_COMMANDS,
    ...SNAP_TARGET_COMMANDS,
    ...SETTINGS_COMMANDS,
    ...SKETCH_CONTEXT_COMMANDS,
    ...CORE_COMMANDS
  ].filter((command) => command.palette !== false);
}

export function commandById(commands, id) {
  return commands.find((command) => command.id === id) || null;
}
