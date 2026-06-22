import { modelCollectionIcon, modelCollectionLabel, modelCollectionSpec } from "./model-collection-metadata.mjs";
import { inspectorEditableObjectPropertySections } from "./inspector-editable-object-property-metadata.mjs";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength, snapScopeMode } from "./snap-metadata.mjs";

export { inspectorSupportObjectPropertySections } from "./inspector-support-object-property-metadata.mjs";
export { inspectorFeatureEditorSections } from "./inspector-editable-object-property-metadata.mjs";

export const INSPECTOR_SECTION_LEVELS = Object.freeze(["primary", "advanced", "diagnostic"]);
export const INSPECTOR_SECTION_PLACEMENTS = Object.freeze(["main", "actions", "reference", "diagnostics"]);
const OBJECT_REF_ACTION_SPECS = Object.freeze({
  select: Object.freeze({ action: "objectRef.select", label: "Select", icon: "selection" }),
  fit: Object.freeze({ action: "objectRef.fit", label: "Fit", icon: "zoom-fit" })
});

const ACTIVE_TOOL_HINTS = {
  "model.beam.create": [
    "Pick the start point, then pick the end point.",
    "Type a length or relative vector and press Enter.",
    "Use Shift to axis-lock from the start point."
  ],
  "model.column.create": [
    "Pick the base point, then set the column height.",
    "Type a height and press Enter.",
    "Use Z input when you need an exact elevation."
  ],
  "model.plate.create": [
    "Pick three points on the active work plane.",
    "Use Alt while picking to temporarily release axis lock.",
    "The third point sets the plate plane and outline direction."
  ],
  "model.sketch.create": [
    "Pick at least three points on the active work plane.",
    "Press Enter to finish the sketch.",
    "Backspace removes the last point."
  ],
  "model.workPlane.set": [
    "Pick three points to define the active work plane.",
    "Use snap targets to place the plane from model geometry."
  ],
  "model.plateBend.add": [
    "Pick a plate edge that can become a bend.",
    "Use Shift or Alt while picking to flip bend direction."
  ],
  "model.trim.create": [
    "Pick the first member, then the second member.",
    "The trim joint is created after the second valid member pick."
  ]
};
export const ACTIVE_TOOL_HINT_COMMAND_IDS = Object.freeze(Object.keys(ACTIVE_TOOL_HINTS));

export function normalizeInspectorPropertySections(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .filter(Boolean)
    .map((section, index) => normalizeInspectorPropertySection(section, index));
}

export function normalizeInspectorPropertySection(section = {}, index = 0) {
  const { rows: _rows, ...descriptor } = section;
  const placement = normalizeInspectorSectionPlacement(descriptor);
  return {
    ...descriptor,
    level: normalizeInspectorSectionLevel(descriptor, placement),
    placement,
    priority: finiteNumber(descriptor.priority) ? descriptor.priority : index * 10
  };
}

function normalizeInspectorSectionLevel(section = {}, placement = "main") {
  if (INSPECTOR_SECTION_LEVELS.includes(section.level)) return section.level;
  if (placement === "diagnostics") return "diagnostic";
  if (section.open === false) return "advanced";
  return "primary";
}

function normalizeInspectorSectionPlacement(section = {}) {
  if (INSPECTOR_SECTION_PLACEMENTS.includes(section.placement)) return section.placement;
  const fields = arrayValues(section.fields);
  if (String(section.id || "").toLowerCase().includes("diagnostic") || fields.some((field) => field?.state === "error" || field?.state === "warning")) {
    return "diagnostics";
  }
  if (fields.length && fields.every((field) => field?.type === "action")) return "actions";
  if (String(section.id || "").toLowerCase().includes("reference") || String(section.label || "").toLowerCase().includes("reference")) return "reference";
  return "main";
}

export function inspectorEmptySelectionContext() {
  return {
    title: "No selection",
    subtitle: "Pick from the model, library, or canvas",
    icon: "inspector"
  };
}

export function inspectorViewContext({ pointCount = 0 } = {}) {
  return {
    title: "View",
    subtitle: "Model space",
    icon: "grid",
    badges: [
      { label: "Model space", state: "ok" },
      pointCount ? { label: `${pointCount} points`, state: "info" } : null
    ].filter(Boolean)
  };
}

export function inspectorViewPropertySections({ project = {}, bounds = null, counts = {}, pointCount = 0 } = {}) {
  const projectSettings = project.settings || {};
  const units = projectSettings.units || {};
  const coordinateSystem = projectSettings.coordinateSystem || {};
  return [
    {
      id: "inspector.properties.view.identity",
      label: "View",
      fields: [
        { label: "Name", value: "Model space" },
        { label: "Type", value: "model-space-view" },
        { label: "Length unit", value: units.length || "-" },
        { label: "Angle unit", value: units.angle || "-" }
      ]
    },
    {
      id: "inspector.properties.view.coordinates",
      label: "Coordinates",
      fields: [
        { label: "System", value: coordinateSystem.id || "-" },
        { label: "Type", value: coordinateSystem.type || "-" },
        { label: "Origin", value: inspectorFormatVector(coordinateSystem.origin) },
        { label: "Axis X", value: inspectorFormatVector(coordinateSystem.axisX) },
        { label: "Axis Y", value: inspectorFormatVector(coordinateSystem.axisY) },
        { label: "Axis Z", value: inspectorFormatVector(coordinateSystem.axisZ) }
      ]
    },
    {
      id: "inspector.properties.view.workingArea",
      label: "Working Area",
      fields: [
        { label: "Min", value: bounds ? inspectorFormatVector(bounds.min) : "-" },
        { label: "Max", value: bounds ? inspectorFormatVector(bounds.max) : "-" },
        { label: "Size", value: bounds ? inspectorFormatVector(bounds.size) : "-" },
        { label: "Center", value: bounds ? inspectorFormatVector(bounds.center) : "-" },
        { label: "Source points", value: String(pointCount || 0) }
      ]
    },
    {
      id: "inspector.properties.view.contents",
      label: "Contents",
      fields: [
        { label: "Members", value: String(counts.members || 0) },
        { label: "Plates", value: String(counts.plates || 0) },
        { label: "Sketches", value: String(counts.sketches || 0) },
        { label: "Trim joints", value: String(counts.trimJoints || 0) },
        { label: "Fasteners", value: String(counts.fastenerGroups || 0) },
        { label: "Welds", value: String(counts.welds || 0) },
        { label: "Grid systems", value: String(counts.gridSystems || 0) },
        { label: "Levels", value: String(counts.levels || 0) },
        { label: "Work points", value: String(counts.workPoints || 0) },
        { label: "Reference planes", value: String(counts.referencePlanes || 0) }
      ]
    }
  ];
}

export function inspectorActiveToolContext({ command = null } = {}) {
  return {
    title: command?.label || command?.title || "Active Tool",
    subtitle: command?.description || "Use the canvas to complete the active tool.",
    icon: command?.icon || "settings",
    badges: [{ label: "Active", state: "ok" }]
  };
}

export function inspectorActiveToolSections({
  command = null,
  commandState = {},
  toolState = {},
  snapSettings = {},
  selectionState = {},
  canCancel = false,
  canCycleSnap = false,
  canOpenSnapSettings = false,
  canSnapStrengthChange = false,
  canSnapScopeChange = false,
  canSnapTargetChange = false,
  onCancel = null,
  onCycleSnap = null,
  onOpenSnapSettings = null,
  onSnapStrengthChange = null,
  onSnapScopeChange = null,
  onSnapTargetChange = null
} = {}) {
  const currentFields = [
    { label: "Command", value: command?.title || command?.label || commandState?.activeCommandId || commandState?.activeCommand || "-" },
    command?.keyFallback ? { label: "Shortcut", value: command.keyFallback } : null,
    { label: "Status", value: commandState?.active ? "Running" : "Idle" },
    toolState?.status ? { label: "Prompt", value: toolState.status } : null,
    toolState?.needsPointerHit === false ? { label: "Pointer", value: "Work-plane point" } : null,
    command?.description ? { label: "Next", value: command.description } : null,
    toolState?.canCycleSnap && (canCycleSnap || typeof onCycleSnap === "function")
      ? { type: "action", label: "Cycle Snap", icon: "snap", action: "activeTool.cycleSnap" }
      : null,
    canCancel || typeof onCancel === "function"
      ? { type: "action", label: "Cancel Command", icon: "cancel", danger: true, action: "activeTool.cancel" }
      : null
  ].filter(Boolean);
  const sections = [];
  if (currentFields.length) sections.push({
    id: "inspector.properties.activeTool.current",
    label: "Current Tool",
    fields: currentFields
  });
  const hintFields = activeToolHintFields(command?.id);
  if (hintFields.length) sections.push({
    id: "inspector.properties.activeTool.guidance",
    label: "Guidance",
    fields: hintFields
  });
  const precisionFields = activeToolPrecisionFields({
    snapSettings,
    selectionState,
    canSnapStrengthChange,
    canSnapScopeChange,
    canOpenSnapSettings,
    onSnapStrengthChange,
    onSnapScopeChange,
    onOpenSnapSettings
  });
  if (precisionFields.length) sections.push({
    id: "inspector.properties.activeTool.precision",
    label: "Precision",
    fields: precisionFields
  });
  const targetFields = activeToolSnapTargetFields({
    snapSettings,
    canSnapTargetChange,
    onSnapTargetChange
  });
  if (targetFields.length) sections.push({
    id: "inspector.properties.activeTool.snapTargets",
    label: "Snap Targets",
    open: false,
    fields: targetFields
  });
  return sections;
}

export function inspectorSelectionQuickActions({
  memberId = "",
  smartComponentId = "",
  objectId = "",
  objectDetail = {},
  entry = null,
  rootSmartComponent = null
} = {}) {
  if (!memberId && !smartComponentId && !objectId) return [];
  const actions = [{
    action: "selection.fit",
    icon: "zoom-fit",
    label: "Fit",
    title: "Fit selection in view",
    primary: true
  }];
  if (objectId) {
    if (rootSmartComponent?.id) {
      actions.push({
        action: "selection.smartComponent.open",
        payload: { smartComponentId: rootSmartComponent.id },
        icon: "smart-component",
        label: "Component",
        title: "Open linked Smart Component"
      });
    }
    if (entry?.collection === "features") {
      actions.push({
        action: "selection.feature.open",
        payload: { objectId },
        icon: "inspector",
        label: "Feature",
        title: "Open Feature Editor"
      });
    }
    if (entry?.collection === "trimJoints") {
      actions.push({
        action: "selection.trim.open",
        payload: { objectId, detail: objectDetail || {} },
        icon: "trim",
        label: "Trim",
        title: "Edit Trim in Properties"
      });
    }
    if (entry?.collection === "plates") {
      const relationsVisible = objectDetail?.sketchMode === "relations";
      actions.push({
        action: "selection.plateRelations.toggle",
        payload: {
          objectId,
          detail: relationsVisible
            ? { sketchMode: "clean", clearSketchSelection: true }
            : { ...(objectDetail || {}), sketchMode: "relations" }
        },
        icon: "relation",
        label: "Relations",
        title: relationsVisible ? "Hide sketch relations in 3D" : "Show sketch relations in 3D",
        pressed: relationsVisible
      });
    }
  }
  actions.push({
    action: "selection.clear",
    icon: "cancel",
    label: "Clear",
    title: "Clear selection",
    danger: true
  });
  return actions;
}

export function inspectorPrimaryActions() {
  return [
    {
      action: "inspector.pickMember",
      icon: "beam",
      label: "Pick Member",
      title: "Pick a member from the model"
    },
    {
      action: "inspector.pickSmartComponent",
      icon: "smart-component",
      label: "Pick Smart Component",
      title: "Pick a generated Smart Component object"
    },
    {
      action: "inspector.pickObject",
      icon: "selection",
      label: "Pick Object",
      title: "Pick an object from the model"
    },
    {
      action: "selection.clear",
      icon: "selection-clear",
      label: "Clear",
      title: "Clear selection"
    }
  ];
}

export function inspectorMemberContext({ memberId = "", member = null } = {}) {
  return {
    title: modelCollectionLabel("members", { singular: true }),
    subtitle: memberId,
    icon: modelCollectionIcon("members"),
    badges: [member?.type || "member", member?.material ? { label: member.material } : null].filter(Boolean)
  };
}

export function inspectorMemberIdentitySection({ memberId = "", member = null, lengthText = "-" } = {}) {
  return {
    id: "inspector.properties.member.identity",
    label: "Identity",
    fields: [
      { label: "ID", value: memberId },
      { label: "Type", value: member?.type || "-" },
      { label: "Material", value: member?.material || "-" },
      { label: "Length", value: lengthText || "-" }
    ]
  };
}

export function inspectorMemberEditSections({
  memberId = "",
  member = null,
  profileOptions = [],
  materialOptions = [],
  center = [],
  alignmentLabel = "None",
  hasAlignment = false,
  worldAxisIds = ["x", "y", "z"]
} = {}) {
  const axisLabels = ["X", "Y", "Z"];
  return [
    {
      id: "inspector.properties.member.primary",
      label: "Primary",
      fields: [
        {
          type: "select",
          label: "Section",
          options: arrayValues(profileOptions),
          value: member?.profile || "",
          commit: { action: "member.profile.set", memberId }
        },
        arrayValues(materialOptions).length ? {
          type: "select",
          label: "Material",
          options: arrayValues(materialOptions),
          value: member?.material || "",
          commit: { action: "member.material.set", memberId }
        } : null,
        {
          type: "number",
          label: "Rotation",
          value: member?.rotation || 0,
          commit: { action: "member.rotation.set", memberId }
        }
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.member.position",
      label: "Position",
      fields: axisLabels.map((axis, axisIndex) => ({
        type: "number",
        label: `Center ${axis}`,
        value: center?.[axisIndex],
        commit: { action: "member.centerCoordinate.set", memberId, axisIndex }
      }))
    },
    {
      id: "inspector.properties.member.endpoints",
      label: "Endpoints",
      fields: ["start", "end"].flatMap((endpoint) => axisLabels.map((axis, axisIndex) => ({
        type: "number",
        label: `${endpoint === "start" ? "Start" : "End"} ${axis}`,
        value: member?.[endpoint]?.[axisIndex],
        commit: { action: "member.endpointCoordinate.set", memberId, endpoint, axisIndex }
      })))
    },
    {
      id: "inspector.properties.member.alignment",
      label: "Alignment",
      open: false,
      fields: [
        { label: "Current", value: alignmentLabel || "None" },
        ...arrayValues(worldAxisIds).map((axisId) => ({
          type: "action",
          label: `Align ${String(axisId).toUpperCase()}`,
          icon: "relation",
          action: "member.alignment.setGlobalAxis",
          payload: { memberId, axisId }
        })),
        { type: "action", label: "Pick Axis", icon: "selection", action: "member.alignment.pickAxis", payload: { memberId } },
        hasAlignment ? { type: "action", label: "Remove Alignment", icon: "cancel", danger: true, action: "member.alignment.clear", payload: { memberId } } : null
      ].filter(Boolean)
    }
  ];
}

export function inspectorMemberAdvancedSections({
  memberId = "",
  customProfileValue = "",
  pointRelations = [],
  alignmentLabel = "None"
} = {}) {
  const constraints = arrayValues(pointRelations).filter((relation) => relation?.id);
  return [
    {
      id: "inspector.properties.member.customSection",
      label: "Custom Section",
      open: false,
      level: "advanced",
      fields: [
        {
          type: "message",
          state: "help",
          value: "Manual section contours are an advanced fallback. Main sketch editing belongs in the 3D view."
        },
        {
          type: "text",
          label: "Contour points",
          value: customProfileValue,
          commit: { action: "member.customProfileDraft.set", memberId },
          options: { multiline: true, rows: 5, className: "bc-field bc-field-stack" }
        },
        {
          type: "action",
          label: "Create + Apply Section",
          icon: "beam",
          action: "member.customProfile.create",
          payload: { memberId }
        }
      ]
    },
    {
      id: "inspector.properties.member.constraints",
      label: "Constraints",
      open: false,
      level: "advanced",
      fields: [
        { label: "Member alignment", value: alignmentLabel || "None" },
        constraints.length ? { label: "Point constraints", value: String(constraints.length) } : {
          type: "message",
          state: "help",
          value: "No point constraints."
        },
        ...constraints.flatMap((relation, index) => [
          { label: `Constraint ${index + 1}`, value: relation.label || relation.id },
          {
            type: "action",
            label: `Remove ${relation.label || relation.id}`,
            icon: "cancel",
            danger: true,
            action: "member.relation.remove",
            payload: { memberId, relationId: relation.id }
          }
        ])
      ]
    }
  ];
}

export function inspectorSmartComponentContext({
  smartComponentId = "",
  smartComponent = null,
  health = "ok",
  errorCount = 0,
  warningCount = 0,
  diagnosticsSummary = null
} = {}) {
  const summary = diagnosticsSummary || { health, errorCount, warningCount };
  return {
    title: modelCollectionLabel("smartComponentInstances", { singular: true }),
    subtitle: smartComponentId,
    icon: modelCollectionIcon("smartComponentInstances"),
    badges: [
      { label: summary.health || "ok", state: summary.errorCount ? "error" : summary.warningCount ? "warning" : "ok" },
      smartComponent?.kind ? { label: smartComponent.kind } : null
    ].filter(Boolean)
  };
}

export function inspectorSmartComponentDiagnosticsSummary(smartComponent = null) {
  const diagnostics = arrayValues(smartComponent?.diagnostics);
  const errorCount = diagnostics.filter((item) => item?.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item?.severity === "warning").length;
  return {
    diagnostics,
    errorCount,
    warningCount,
    health: smartComponent?.health || "ok"
  };
}

export function inspectorSmartComponentIdentitySection({
  smartComponentId = "",
  smartComponent = null,
  diagnosticsSummary = null,
  managedObjectCount = 0,
  detachedObjectCount = 0,
  overrideObjectCount = 0
} = {}) {
  const summary = diagnosticsSummary || inspectorSmartComponentDiagnosticsSummary(smartComponent);
  return {
    id: "inspector.properties.smartComponent.identity",
    label: "Identity",
    fields: [
      { label: "ID", value: smartComponentId },
      { label: "Type", value: smartComponent?.type || "-" },
      { label: "Kind", value: smartComponent?.kind || "-" },
      { label: "Diagnostics", value: `${summary.errorCount} errors, ${summary.warningCount} warnings` },
      { label: "Managed objects", value: String(managedObjectCount) },
      { label: "Detached", value: String(detachedObjectCount) },
      { label: "Overrides", value: String(overrideObjectCount) }
    ]
  };
}

export function inspectorSmartComponentPropertySections({
  smartComponentId = "",
  smartComponent = null,
  definition = null,
  diagnosticsSummary = null,
  preview = null,
  quickParameterFields = [],
  liveRoleOptions = [],
  objectIndex = {},
  capabilities = {},
  managedObjectLimit = 8
} = {}) {
  if (!smartComponent) return [];
  const summary = diagnosticsSummary || inspectorSmartComponentDiagnosticsSummary(smartComponent);
  const managedEntries = smartComponentManagedObjectEntries(smartComponent);
  const detachedObjectIds = new Set(arrayValues(smartComponent.detachedObjectIds));
  const overrideObjectIds = smartComponentOverrideObjectIds(smartComponent);
  return [
    inspectorSmartComponentIdentitySection({
      smartComponentId,
      smartComponent,
      diagnosticsSummary: summary,
      managedObjectCount: managedEntries.length,
      detachedObjectCount: detachedObjectIds.size,
      overrideObjectCount: overrideObjectIds.size
    }),
    smartComponentPreviewSection({ smartComponent, preview }),
    smartComponentDiagnosticsSection({ diagnosticsSummary: summary }),
    smartComponentQuickParameterSection(quickParameterFields),
    smartComponentRoleSection({ smartComponent, definition, liveRoleOptions }),
    smartComponentLifecycleSection({
      smartComponent,
      entries: managedEntries,
      detachedObjectIds,
      overrideObjectIds,
      objectIndex,
      capabilities,
      limit: managedObjectLimit
    }),
    smartComponentActionsSection({ smartComponentId, diagnosticsSummary: summary, capabilities })
  ].filter(Boolean);
}

function smartComponentPreviewSection({ smartComponent = null, preview = null } = {}) {
  if (!smartComponent) return null;
  const state = preview?.state || "pending";
  const title = smartComponent.bim?.name || smartComponent.sourceComponent?.id || smartComponent.id || "Preview";
  return {
    id: "inspector.properties.smartComponent.preview",
    label: "Preview",
    placement: "main",
    priority: -10,
    open: true,
    fields: [
      {
        type: "previewImage",
        label: "Generated preview",
        title,
        value: state === "pending" ? "Generating preview" : preview?.reason || state,
        reason: preview?.reason || "",
        state,
        dataUrl: preview?.dataUrl || "",
        icon: "smart-component"
      }
    ]
  };
}

export function inspectorObjectGeneratedBySection({
  smartComponent = null,
  rootSmartComponent = null,
  objectId = "",
  objectIndex = {},
  capabilities = {}
} = {}) {
  if (!smartComponent) return null;
  const roles = smartComponentObjectRolesForObject(smartComponent, objectId);
  const detached = new Set(arrayValues(smartComponent.detachedObjectIds)).has(objectId);
  const overridden = smartComponentOverrideObjectIds(smartComponent).has(objectId);
  const status = detached ? "detached" : overridden ? "overrides" : "managed";
  const componentEntry = objectIndex?.[smartComponent.id];
  const rootEntry = rootSmartComponent ? objectIndex?.[rootSmartComponent.id] : null;
  const fields = [
    {
      type: "objectRef",
      label: "Component",
      value: smartComponent.id,
      status: smartComponent.kind || smartComponent.type || "component",
      icon: "smart-component",
      actions: objectRefActions({
        select: { smartComponentId: smartComponent.id },
        fit: componentEntry ? { objectId: smartComponent.id } : null,
        value: smartComponent.id
      })
    },
    rootSmartComponent && rootSmartComponent.id !== smartComponent.id ? {
      type: "objectRef",
      label: "Root",
      value: rootSmartComponent.id,
      status: rootSmartComponent.kind || rootSmartComponent.type || "root",
      icon: "smart-component",
      actions: objectRefActions({
        select: { smartComponentId: rootSmartComponent.id },
        fit: rootEntry ? { objectId: rootSmartComponent.id } : null,
        value: rootSmartComponent.id
      })
    } : null,
    { label: "Role", value: roles.length ? roles.map(inspectorMetadataLabel).join(", ") : "-" },
    { label: "Lifecycle", value: inspectorMetadataLabel(status) },
    componentEntry ? null : { label: "Component", value: smartComponent.id }
  ].filter(Boolean);
  if (overridden && capabilities.resetObjectOverrides) {
    fields.push({
      type: "action",
      label: "Reset Overrides",
      icon: "reset-view",
      action: "smartComponent.objectOverrides.reset",
      payload: { smartComponentId: smartComponent.id, objectId }
    });
  }
  if (detached && capabilities.reattachObject) {
    fields.push({
      type: "action",
      label: "Reattach",
      icon: "link",
      primary: true,
      action: "smartComponent.object.reattach",
      payload: { smartComponentId: smartComponent.id, objectId }
    });
  } else if (!detached && capabilities.detachObject) {
    fields.push({
      type: "action",
      label: "Detach",
      icon: "unlink",
      action: "smartComponent.object.detach",
      payload: { smartComponentId: smartComponent.id, objectId }
    });
  }
  fields.push({
    type: "action",
    label: "Open Parameters",
    icon: "smart-component",
    action: "smartComponent.parameters.open",
    payload: { smartComponentId: smartComponent.id }
  });
  return {
    id: "inspector.properties.object.generatedBy",
    label: "Generated By",
    placement: "reference",
    priority: 70,
    open: true,
    fields
  };
}

export function inspectorObjectContext({ objectId = "", entry = null, object = null } = {}) {
  return {
    title: inspectorObjectTitleForEntry(entry),
    subtitle: objectId,
    icon: inspectorObjectIconForEntry(entry),
    badges: [entry?.collection, object?.type || entry?.type || ""].filter(Boolean)
  };
}

export function inspectorObjectIdentitySection({ objectId = "", entry = null, object = null } = {}) {
  return {
    id: "inspector.properties.object.identity",
    label: "Identity",
    fields: [
      { label: "ID", value: objectId },
      { label: "Collection", value: entry?.collection || "-" },
      { label: "Type", value: object?.type || entry?.type || "-" },
      object?.ownerId ? { label: "Owner", value: object.ownerId } : null,
      object?.memberEnd ? { label: "Member end", value: object.memberEnd } : null,
      object?.fabrication?.operation ? { label: "Operation", value: object.fabrication.operation } : null
    ].filter(Boolean)
  };
}

export function inspectorObjectTitleForEntry(entry) {
  return entry?.collection && modelCollectionSpec(entry.collection)
    ? modelCollectionLabel(entry.collection, { singular: true })
    : "Object";
}

export function inspectorObjectIconForEntry(entry) {
  return entry?.collection && modelCollectionSpec(entry.collection)
    ? modelCollectionIcon(entry.collection)
    : "inspector";
}

function objectRefActions({ select = null, fit = null, value = "" } = {}) {
  return [
    select ? objectRefActionDescriptor("select", select, value) : null,
    fit ? objectRefActionDescriptor("fit", fit, value) : null
  ].filter(Boolean);
}

function objectRefActionDescriptor(type, payload, value = "") {
  const spec = OBJECT_REF_ACTION_SPECS[type];
  return {
    action: spec.action,
    label: spec.label,
    icon: spec.icon,
    title: value ? `${spec.label} ${value}` : spec.label,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : { objectId: payload }
  };
}

export function inspectorObjectReferenceSection({
  id = "",
  label = "Objects",
  values = [],
  itemLabel = "Object",
  objectIndex = {},
  limit = 8,
  canSelectObject = false,
  canFitObject = false,
  onSelectObject = null,
  onFitObject = null
} = {}) {
  const ids = arrayValues(values).filter((value) => value !== undefined && value !== null && value !== "");
  if (!ids.length) return null;
  const visible = ids.slice(0, limit);
  const fields = visible.map((objectId, index) => {
    const entry = objectIndex?.[objectId];
    const selectable = Boolean(entry?.collection);
    const select = selectable && (canSelectObject || typeof onSelectObject === "function") ? { objectId } : null;
    const fit = selectable && (canFitObject || typeof onFitObject === "function") ? { objectId } : null;
    return {
      type: "objectRef",
      label: `${itemLabel} ${index + 1}`,
      value: objectId,
      icon: entry ? inspectorObjectIconForEntry(entry) : null,
      actions: objectRefActions({ select, fit, value: objectId })
    };
  });
  if (ids.length > visible.length) fields.push({ label: "More", value: `${ids.length - visible.length} additional` });
  return { id, label, placement: "reference", priority: 80, open: false, fields };
}

export function inspectorObjectPropertySections(options = {}) {
  return inspectorEditableObjectPropertySections(options);
}

export function inspectorIdListSection({ id = "", label = "Items", values = [], itemLabel = "Item", limit = 8 } = {}) {
  const ids = arrayValues(values).filter((value) => value !== undefined && value !== null && value !== "");
  if (!ids.length) return null;
  const visible = ids.slice(0, limit);
  const fields = visible.map((value, index) => ({ label: `${itemLabel} ${index + 1}`, value }));
  if (ids.length > visible.length) fields.push({ label: "More", value: `${ids.length - visible.length} additional` });
  return { id, label, fields };
}

export function inspectorMetadataSection({ id = "", object = null, label = "Authoring", key = "authoring" } = {}) {
  const value = object?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = Object.entries(value)
    .filter(([, item]) => item !== undefined && item !== null && item !== "")
    .map(([field, item]) => ({
      label: inspectorMetadataLabel(field),
      value: Array.isArray(item) ? inspectorFormatVector(item) : item
    }));
  return fields.length ? { id, label, fields, open: false } : null;
}

export function inspectorAssemblyContentIds(assembly = {}) {
  return [
    ...arrayValues(assembly.partIds),
    ...arrayValues(assembly.memberIds),
    ...arrayValues(assembly.plateIds),
    ...arrayValues(assembly.fastenerGroupIds),
    ...arrayValues(assembly.weldIds),
    ...arrayValues(assembly.connectionZoneIds),
    ...arrayValues(assembly.childAssemblyIds),
    ...arrayValues(assembly.smartComponentInstanceIds)
  ];
}

export function inspectorFlattenSmartComponentObjectIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(inspectorFlattenSmartComponentObjectIds);
  if (typeof value === "object") return Object.values(value).flatMap(inspectorFlattenSmartComponentObjectIds);
  return [];
}

export function inspectorMetadataLabel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function inspectorFormatNumber(value) {
  if (!finiteNumber(value)) return "-";
  return String(Number(value.toFixed(3)));
}

export function inspectorFormatVector(value) {
  const values = arrayValues(value);
  if (!values.length) return "-";
  return values.map((item) => finiteNumber(item) ? inspectorFormatNumber(item) : String(item)).join(", ");
}

export function inspectorFormatKeyValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "-";
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
  if (!entries.length) return "-";
  return entries.map(([key, item]) => `${key}: ${Array.isArray(item) ? inspectorFormatVector(item) : item}`).join(", ");
}

export function inspectorFormatPointBounds(points) {
  const valid = arrayValues(points).filter((point) => Array.isArray(point) && point.length >= 2 && point.every(finiteNumber));
  if (!valid.length) return "-";
  const dimensions = valid[0].length;
  const axes = ["X", "Y", "Z"];
  return Array.from({ length: dimensions }, (_, axis) => {
    const values = valid.map((point) => point[axis]);
    return `${axes[axis] || axis + 1}: ${inspectorFormatNumber(Math.min(...values))}..${inspectorFormatNumber(Math.max(...values))}`;
  }).join(", ");
}

function activeToolHintFields(commandId) {
  return arrayValues(ACTIVE_TOOL_HINTS[commandId])
    .map((value, index) => ({ label: index === 0 ? "Step" : `Tip ${index}`, value }));
}

function activeToolPrecisionFields({
  snapSettings = {},
  selectionState = {},
  canSnapStrengthChange = false,
  canSnapScopeChange = false,
  canOpenSnapSettings = false,
  onSnapStrengthChange = null,
  onSnapScopeChange = null,
  onOpenSnapSettings = null
} = {}) {
  const scope = objectMap(snapSettings.scope || selectionState.scope);
  const scopeMode = snapScopeMode(scope);
  const fields = [
    canSnapStrengthChange || typeof onSnapStrengthChange === "function" ? {
      type: "select",
      label: "Snap strength",
      options: SNAP_STRENGTH_SPECS.map(({ id, label }) => ({ id, label })),
      value: normalizeSnapStrength(snapSettings.strength),
      commit: { action: "snapStrength.set" }
    } : { label: "Snap strength", value: normalizeSnapStrength(snapSettings.strength) },
    canSnapScopeChange || typeof onSnapScopeChange === "function" ? {
      type: "select",
      label: "Selection scope",
      options: SNAP_SCOPE_MODES.map(({ id, label }) => ({
        id,
        label: activeToolScopeOptionLabel(id, label, scope)
      })),
      value: scopeMode,
      commit: { action: "selectionScope.set" }
    } : { label: "Selection scope", value: activeToolScopeLabel(scopeMode) },
    selectedCountField(selectionState),
    canOpenSnapSettings || typeof onOpenSnapSettings === "function"
      ? { type: "action", label: "Open Snap Settings", icon: "settings", commandId: "settings.snap.toggle" }
      : null
  ].filter(Boolean);
  return fields;
}

function activeToolSnapTargetFields({ snapSettings = {}, canSnapTargetChange = false, onSnapTargetChange = null } = {}) {
  const scope = objectMap(snapSettings.scope);
  return SNAP_TARGET_SPECS.map((target) => {
    const enabled = scope[target.key] !== false;
    return canSnapTargetChange || typeof onSnapTargetChange === "function"
      ? {
        type: "checkbox",
        label: target.label,
        value: enabled,
        commit: { action: "snapTarget.set", target: target.key }
      }
      : { label: target.label, value: enabled ? "Enabled" : "Disabled" };
  });
}

function activeToolScopeOptionLabel(id, label, scope = {}) {
  if (id === "selected") {
    const count = arrayValues(scope.selectedObjectIds).length;
    return count ? `${label} (${count})` : `${label} (select first)`;
  }
  if (id === "component") return scope.activeSmartComponentId ? `${label} (active)` : `${label} (select component)`;
  return label;
}

function activeToolScopeLabel(scopeModeId) {
  return SNAP_SCOPE_MODES.find((mode) => mode.id === scopeModeId)?.label || scopeModeId || "All";
}

function selectedCountField(selectionState = {}) {
  const selected = arrayValues(selectionState.selectedObjectIds);
  return selected.length ? { label: "Selected objects", value: String(selected.length) } : null;
}

function smartComponentQuickParameterSection(fields = []) {
  const visibleFields = arrayValues(fields).filter(Boolean);
  return visibleFields.length ? {
    id: "inspector.properties.smartComponent.primaryParameters",
    label: "Primary Parameters",
    fields: visibleFields
  } : null;
}

function smartComponentDiagnosticsSection({ diagnosticsSummary = {}, limit = 4 } = {}) {
  const diagnostics = arrayValues(diagnosticsSummary.diagnostics).filter(Boolean);
  if (!diagnostics.length) return null;
  const visibleDiagnostics = diagnostics.slice(0, limit);
  const fields = visibleDiagnostics.map((diagnostic, index) => ({
    type: "message",
    label: diagnostic.code || `Diagnostic ${index + 1}`,
    value: diagnostic.message || inspectorMetadataLabel(diagnostic.severity || "info"),
    state: diagnostic.severity === "error" ? "error" : diagnostic.severity === "warning" ? "warning" : "info"
  }));
  if (diagnostics.length > visibleDiagnostics.length) fields.push({ label: "More", value: `${diagnostics.length - visibleDiagnostics.length} additional` });
  return {
    id: "inspector.properties.smartComponent.diagnostics",
    label: "Diagnostics",
    placement: "diagnostics",
    priority: 10,
    open: diagnostics.some((diagnostic) => diagnostic?.severity === "error" || diagnostic?.severity === "warning"),
    fields
  };
}

function smartComponentRoleSection({ smartComponent = null, definition = null, liveRoleOptions = [] } = {}) {
  const componentDefinitions = arrayValues(definition?.components).filter((component) => component?.role);
  const liveRoles = new Map(arrayValues(liveRoleOptions).map((role) => [role.role, role]));
  const suppressedRoles = new Set(arrayValues(smartComponent?.suppressedRoles));
  const roles = componentDefinitions.map((component) => {
    const live = liveRoles.get(component.role);
    const roleKeys = arrayValues(component.objectRoles);
    const objectRoleIds = inspectorFlattenSmartComponentObjectIds(roleKeys.length
      ? roleKeys.map((role) => smartComponent?.objectRoles?.[role])
      : smartComponent?.objectRoles?.[component.role]);
    return {
      role: component.role,
      label: component.label || inspectorMetadataLabel(component.role),
      active: live ? live.active : Boolean(objectRoleIds.length) && !suppressedRoles.has(component.role),
      defaultGhost: component.default === "ghost"
    };
  });
  if (!roles.length) return null;
  return {
    id: "inspector.properties.smartComponent.generatedComponents",
    label: "Generated Components",
    open: roles.length <= 5,
    fields: roles.map((role) => ({
      type: "checkbox",
      label: role.defaultGhost ? `${role.label} (optional)` : role.label,
      value: role.active,
      commit: { action: "smartComponent.roleActive.set", smartComponentId: smartComponent?.id, role: role.role }
    }))
  };
}

function smartComponentManagedObjectEntries(smartComponent = {}) {
  return Object.entries(smartComponent.objectRoles || {})
    .flatMap(([role, value]) => inspectorFlattenSmartComponentObjectIds(value).map((objectId) => ({ role, objectId })));
}

function smartComponentOverrideObjectIds(smartComponent = {}) {
  return new Set([
    ...Object.keys(smartComponent.fieldOverrides || {}),
    ...Object.keys(smartComponent.managedFields || {})
  ]);
}

function smartComponentLifecycleSection({
  smartComponent = null,
  entries = [],
  detachedObjectIds = new Set(),
  overrideObjectIds = new Set(),
  objectIndex = {},
  capabilities = {},
  limit = 8
} = {}) {
  const allEntries = arrayValues(entries);
  if (!allEntries.length) return null;
  const visibleEntries = allEntries.slice(0, limit);
  const fields = visibleEntries.map(({ role, objectId }) => {
    const entry = objectIndex?.[objectId];
    const detached = detachedObjectIds.has(objectId);
    const overridden = overrideObjectIds.has(objectId);
    const actions = [];
    if (overridden && capabilities.resetObjectOverrides) {
      actions.push({
        label: "Reset",
        icon: "reset-view",
        title: `Reset overrides for ${objectId}`,
        action: "smartComponent.objectOverrides.reset",
        payload: { smartComponentId: smartComponent?.id, objectId }
      });
    }
    if (detached && capabilities.reattachObject) {
      actions.push({
        label: "Reattach",
        icon: "link",
        title: `Reattach ${objectId}`,
        action: "smartComponent.object.reattach",
        payload: { smartComponentId: smartComponent?.id, objectId }
      });
    } else if (!detached && capabilities.detachObject) {
      actions.push({
        label: "Detach",
        icon: "unlink",
        title: `Detach ${objectId}`,
        action: "smartComponent.object.detach",
        payload: { smartComponentId: smartComponent?.id, objectId }
      });
    }
    return {
      type: "objectRef",
      label: role,
      value: objectId,
      status: detached ? "detached" : overridden ? "overrides" : "managed",
      icon: entry ? inspectorObjectIconForEntry(entry) : null,
      select: entry ? { objectId } : null,
      fit: entry ? { objectId } : null,
      actions
    };
  });
  if (allEntries.length > visibleEntries.length) fields.push({ label: "More", value: `${allEntries.length - visibleEntries.length} additional` });
  return {
    id: "inspector.properties.smartComponent.lifecycle",
    label: "Managed Objects",
    open: Boolean(detachedObjectIds.size || overrideObjectIds.size),
    fields
  };
}

function smartComponentActionsSection({ smartComponentId = "", diagnosticsSummary = {}, capabilities = {} } = {}) {
  return {
    id: "inspector.properties.smartComponent.actions",
    label: "Actions",
    placement: "actions",
    priority: 90,
    fields: [
      arrayValues(diagnosticsSummary.diagnostics).length && capabilities.resolveDiagnostics
        ? { type: "action", label: "Resolve Diagnostics", icon: "reset-view", action: "smartComponent.diagnostics.resolve", payload: { smartComponentId } }
        : null,
      capabilities.openParameters !== false
        ? { type: "action", label: "Open Parameters", icon: "smart-component", primary: true, action: "smartComponent.parameters.open", payload: { smartComponentId } }
        : null,
      capabilities.deleteSmartComponent !== false
        ? { type: "action", label: "Remove Smart Component", icon: "cancel", danger: true, action: "smartComponent.delete", payload: { smartComponentId } }
        : null
    ].filter(Boolean)
  };
}

function smartComponentObjectRolesForObject(smartComponent, objectId) {
  return Object.entries(smartComponent?.objectRoles || {})
    .filter(([, value]) => inspectorFlattenSmartComponentObjectIds(value).includes(objectId))
    .map(([role]) => role);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteNumberOr(value, fallback) {
  return finiteNumber(value) ? value : fallback;
}

function objectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
}
