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
  ribbonSection: tab.id === "components" ? "libraries" : "project-data",
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
    description: "Toggle automatic axis relation helpers or the active plate sketch relation overlay.",
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

export function commandPaletteSpecs() {
  return [
    ...MODELING_TOOLBAR_COMMANDS,
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
    ...CORE_COMMANDS
  ].filter((command) => command.palette !== false);
}

export function commandById(commands, id) {
  return commands.find((command) => command.id === id) || null;
}
