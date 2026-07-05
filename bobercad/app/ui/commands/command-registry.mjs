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
import {
  referenceGeometryImportAdapterPreflightDescriptors,
  referenceGeometryImportActionPreview,
  referenceGeometryImportCommandPlanDescriptor,
  referenceGeometryImportFilePickerDescriptor,
  referenceGeometryImportCliBlueprints,
  referenceGeometryImportInputDescriptors,
  referenceGeometryImportResultDescriptors,
  referenceGeometryImportSessionDescriptor,
  referenceGeometryImportWorkspaceRequestDescriptor,
  referenceGeometryImportWorkspaceResponseDescriptor,
  referenceGeometryImportWorkflowDescriptor
} from "./data-surface-metadata.mjs";

export { COMMAND_GROUPS };

const FEATURE_NAVBAR_SURFACE = "feature-navbar";
const REFERENCE_GEOMETRY_IMPORT_FILE_PICKER = referenceGeometryImportFilePickerDescriptor();
const REFERENCE_GEOMETRY_IMPORT_INPUTS = referenceGeometryImportInputDescriptors();
const REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINTS = referenceGeometryImportCliBlueprints();
const REFERENCE_GEOMETRY_IMPORT_RESULTS = referenceGeometryImportResultDescriptors();
const REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT = referenceGeometryImportAdapterPreflightDescriptors();
const REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN = referenceGeometryImportCommandPlanDescriptor();
const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST = referenceGeometryImportWorkspaceRequestDescriptor();
const REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE = referenceGeometryImportWorkspaceResponseDescriptor();
const REFERENCE_GEOMETRY_IMPORT_SESSION = referenceGeometryImportSessionDescriptor();
const REFERENCE_GEOMETRY_IMPORT_WORKFLOW = referenceGeometryImportWorkflowDescriptor();
const REFERENCE_GEOMETRY_IMPORT_ACTION_PREVIEW = referenceGeometryImportActionPreview();

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
  },
  {
    id: "model.referenceGeometry.import",
    action: "onReferenceGeometryImportOpen",
    label: "Reference Import",
    title: "Import reference geometry",
    description: `Open an isolated reference geometry import session for ${REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.accept}.`,
    group: "model",
    status: "available",
    implemented: true,
    navSurface: FEATURE_NAVBAR_SURFACE,
    ribbonSection: "references",
    icon: "reference-plane",
    referenceImport: Object.freeze({
      filePickerDescriptorId: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.id,
      inputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUTS.id,
      inputDescriptorIds: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_INPUTS.descriptorIds]),
      cliBlueprintId: REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINTS.id,
      resultDescriptorId: REFERENCE_GEOMETRY_IMPORT_RESULTS.id,
      adapterPreflightDescriptorId: REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT.id,
      commandPlanDescriptorId: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.id,
      workspaceRequestDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.id,
      workspaceResponseDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.id,
      sessionDescriptorId: REFERENCE_GEOMETRY_IMPORT_SESSION.id,
      workflowDescriptorId: REFERENCE_GEOMETRY_IMPORT_WORKFLOW.id,
      actionPreviewDescriptorId: REFERENCE_GEOMETRY_IMPORT_ACTION_PREVIEW.id,
      sourceInputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUTS.sourceInputDescriptorId,
      projectInputDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUTS.projectInputDescriptorId,
      adapterRequestArtifactDescriptorId: REFERENCE_GEOMETRY_IMPORT_INPUTS.adapterRequestArtifactDescriptorId,
      accept: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.accept,
      canonicalFormats: Object.freeze(REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.sourceGroups.map((group) => group.canonicalFormat)),
      targetFormatCoverage: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.targetFormatCoverage,
      safeFirstExecutionMode: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.safeFirstExecutionMode,
      recommendedPrewriteValidationMode: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.recommendedPrewriteValidationMode,
      targetPromotionExecutionMode: REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.targetPromotionExecutionMode,
      safeGateOrder: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.safeGateOrder]),
      externalAdapterGateOrder: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_FILE_PICKER.externalAdapterGateOrder]),
      workflowStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.workflowStages]),
      stageRequiredInputDescriptorIds: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.stageRequiredInputDescriptorIds }),
      stageArtifactDescriptorIds: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.stageArtifactDescriptorIds }),
      stageRequiredCliFlags: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINTS.stageRequiredCliFlags }),
      stageOptionalCliFlags: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINTS.stageOptionalCliFlags }),
      cliFlagBindings: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_CLI_BLUEPRINTS.cliFlagBindings }),
      successEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULTS.successEnvelopeFields]),
      errorEnvelopeFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_RESULTS.errorEnvelopeFields]),
      failureDecisionField: REFERENCE_GEOMETRY_IMPORT_RESULTS.failureDecisionField,
      adapterPreflightCommand: REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT.discoveryCommand,
      adapterPreflightRequiredInputDescriptorIds: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT.requiredInputDescriptorIds]),
      adapterPreflightDecisionField: REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT.preflightDecisionField,
      adapterPreflightDiagnosticCodes: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_ADAPTER_PREFLIGHT.diagnosticCodes]),
      commandPlanFunction: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.commandPlanFunction,
      commandPlanFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.commandPlanFields]),
      commandPlanRuntimeCommand: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.runtimeCommand,
      commandPlanCliEntrypoint: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.cliEntrypoint,
      commandPlanRequiresWorkspaceCommandHost: REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.requiresWorkspaceCommandHost,
      commandPlanRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_COMMAND_PLAN.appRuntimeBoundary }),
      workspaceRequestKind: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.requestKind,
      workspaceRequestBuilderFunction: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.requestBuilderFunction,
      workspaceRequestFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.requestFields]),
      workspaceRequestResultRoutingFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.resultRoutingFields]),
      workspaceRequestRequiresWriteConfirmationStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.requiresWriteConfirmationStages]),
      workspaceRequestCommandHostBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.commandHostBoundary }),
      workspaceRequestRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_REQUEST.appRuntimeBoundary }),
      workspaceResponseBuilderFunction: REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.responseBuilderFunction,
      workspaceResponseFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.responseFields]),
      workspaceResponseStatuses: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.responseStatuses]),
      workspaceResponseParsePolicy: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.parsePolicy }),
      workspaceResponseRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_WORKSPACE_RESPONSE.appRuntimeBoundary }),
      sessionBuilderFunction: REFERENCE_GEOMETRY_IMPORT_SESSION.sessionBuilderFunction,
      sessionFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SESSION.sessionFields]),
      sessionStageStateFields: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_SESSION.stageStateFields]),
      sessionDryRunRequiredBeforeImport: REFERENCE_GEOMETRY_IMPORT_SESSION.dryRunRequiredBeforeImport,
      sessionNextRequestPolicy: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_SESSION.nextRequestPolicy }),
      sessionRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_SESSION.appRuntimeBoundary }),
      optionalWorkflowStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.optionalStages]),
      noProjectOrTargetWriteStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.noProjectOrTargetWriteStages]),
      promotedWriteStages: Object.freeze([...REFERENCE_GEOMETRY_IMPORT_WORKFLOW.promotedWriteStages]),
      workflowStatusField: REFERENCE_GEOMETRY_IMPORT_WORKFLOW.workflowStatusField,
      actionPreviewRuntimeBoundary: Object.freeze({ ...REFERENCE_GEOMETRY_IMPORT_ACTION_PREVIEW.appRuntimeBoundary })
    })
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
    ...CORE_COMMANDS
  ].filter((command) => command.palette !== false);
}

export function commandById(commands, id) {
  return commands.find((command) => command.id === id) || null;
}
