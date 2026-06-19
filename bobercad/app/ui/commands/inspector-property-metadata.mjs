import { modelCollectionIcon, modelCollectionLabel, modelCollectionSpec } from "./model-collection-metadata.mjs?v=inspector-property-metadata-1";
import { SNAP_SCOPE_MODES, SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength, snapScopeMode } from "./snap-metadata.mjs?v=snap-metadata-1";
import { TRIM_OPERATION_TYPES, trimOperationIcon, trimOperationLabel, trimOperationSupportsGap } from "./trim-operation-metadata.mjs?v=trim-operation-metadata-1";

const VECTOR_AXIS_LABELS = ["X", "Y", "Z"];
export const INSPECTOR_SECTION_LEVELS = Object.freeze(["primary", "advanced", "diagnostic"]);
export const INSPECTOR_SECTION_PLACEMENTS = Object.freeze(["main", "actions", "reference", "diagnostics"]);
export const BOOLEAN_TYPE_OPTIONS = [
  { id: "BOOLEAN_CUT", label: "Cut" },
  { id: "BOOLEAN_ADD", label: "Add" },
  { id: "BOOLEAN_WELDPREP", label: "Weld prep" }
];
export const SOURCE_KIND_OPTIONS = [
  { id: "member-profile", label: "Member profile" }
];
export const BODY_AXIS_TYPES = new Set(["box", "cylinder", "polygonal-prism"]);
export const BEND_DIRECTION_OPTIONS = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" }
];
export const BEND_RELIEF_OPTIONS = [
  { id: "round", label: "Round" },
  { id: "rect", label: "Rect" },
  { id: "obround", label: "Obround" },
  { id: "v-notch", label: "V notch" },
  { id: "none", label: "None" }
];
const OBJECT_PATTERN_STATUS_OPTIONS = [
  { id: "linked", label: "Linked" },
  { id: "partially-detached", label: "Partially detached" },
  { id: "broken", label: "Broken" }
];
const SUPPORT_OBJECT_ACTIONS = {
  workPoint: "supportObject.workPoint.update",
  referencePlane: "supportObject.referencePlane.update",
  interface: "supportObject.interface.update",
  connectionZone: "supportObject.connectionZone.update",
  assembly: "supportObject.assembly.update",
  group: "supportObject.group.update",
  holePattern: "supportObject.holePattern.update",
  objectPattern: "supportObject.objectPattern.update"
};
const OBJECT_REF_ACTION_SPECS = Object.freeze({
  select: Object.freeze({ action: "objectRef.select", label: "Select", icon: "selection" }),
  fit: Object.freeze({ action: "objectRef.fit", label: "Fit", icon: "zoom-fit" })
});
const MITER_MODE_OPTIONS = Object.freeze([
  { id: "equal-angle", label: "Equal angle" },
  { id: "profile-balanced", label: "Balanced profile" }
]);
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
        title: "Open Trim Editor"
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

export function inspectorObjectPropertySections({
  collection = "",
  object = null,
  objectId = "",
  objectDetail = {},
  objectState = {},
  catalogEntries = null,
  catalogOptions = null,
  fastenerLengthOptions = null
} = {}) {
  if (!object) return [];
  if (collection === "plates") return platePropertiesSections(object, { objectId, objectDetail, objectState });
  if (collection === "fastenerGroups") return fastenerPropertiesSections(object, { catalogEntries, catalogOptions, fastenerLengthOptions });
  if (collection === "trimJoints") return trimJointPropertiesSections(object, { objectId, objectDetail });
  if (collection === "features") return featurePropertiesSections(object, { objectId });
  if (collection === "sketches") return sketchPropertiesSections({ objectId, objectState });
  if (collection === "welds") return weldPropertiesSections(object);
  return [];
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
      { type: "action", label: "Open Parameters", icon: "smart-component", primary: true, action: "smartComponent.parameters.open", payload: { smartComponentId } },
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

function objectPropertyCommit(action, patchKey, extras = {}) {
  return { action, patchKey, ...extras };
}

function featureEditorCommit(action, patchKey, extras = {}) {
  return { action, patchKey, ...extras };
}

export function inspectorFeatureEditorSections(feature = {}) {
  if (!feature) return [];
  return [
    {
      id: "feature.overview",
      label: "Overview",
      open: true,
      fields: [
        { label: "Feature", value: feature.id },
        { label: "Type", value: feature.type },
        { label: "Owner", value: feature.ownerId || "-" }
      ]
    },
    {
      id: "feature.operation",
      label: "Operation",
      open: true,
      fields: [
        { type: "checkbox", label: "Enabled", value: feature.operationEnabled !== false, commit: { action: "feature.operationEnabled.set" } }
      ]
    },
    featureSourceEditorSection(feature),
    featureBodyEditorSection(feature)
  ].filter(Boolean);
}

function featureBodyEditorSection(feature = {}) {
  const body = feature.body;
  if (!body) return null;
  const fields = [
    { label: "Body", value: body.type || "-" },
    { type: "vector3", label: "Center", value: body.center, commit: featureEditorCommit("feature.body.update", "center") }
  ];
  const sections = [];
  if (feature.type === "boolean-part") {
    fields.push({
      type: "select",
      label: "Boolean",
      options: BOOLEAN_TYPE_OPTIONS,
      value: feature.booleanType || "BOOLEAN_CUT",
      commit: featureEditorCommit("feature.update", "booleanType")
    });
  }
  if (body.type === "box") {
    fields.push({ type: "vector3", label: "Size", value: body.size, commit: featureEditorCommit("feature.body.update", "size") });
  } else if (body.type === "cylinder") {
    fields.push(
      { type: "number", label: "Radius", value: body.radius, commit: featureEditorCommit("feature.body.update", "radius") },
      { type: "number", label: "Depth", value: body.depth, commit: featureEditorCommit("feature.body.update", "depth") }
    );
  } else if (body.type === "polygonal-prism") {
    fields.push({ type: "number", label: "Depth", value: body.depth, commit: featureEditorCommit("feature.body.update", "depth") });
  }
  if (BODY_AXIS_TYPES.has(body.type)) {
    sections.push({ id: "feature.body.axes", label: "Axes", fields: featureBodyAxesFields(body) });
  }
  if (body.type === "polygonal-prism") {
    sections.push({
      id: "feature.body.outline",
      label: "Outline",
      fields: arrayValues(body.outline).map((point, index) => ({
        type: "vector2",
        label: `Point ${index + 1}`,
        value: point,
        axisLabels: ["Y", "Z"],
        commit: featureEditorCommit("feature.body.outlinePoint.update", null, { pointIndex: index })
      }))
    });
  }
  return { id: "feature.body", label: "Cutting body", open: true, fields, sections };
}

function featureBodyAxesFields(body = {}) {
  return [
    { type: "vector3", label: "Axis X", value: body.axisX, commit: featureEditorCommit("feature.body.update", "axisX") },
    { type: "vector3", label: "Axis Y", value: body.axisY, commit: featureEditorCommit("feature.body.update", "axisY") },
    { type: "vector3", label: "Axis Z", value: body.axisZ, commit: featureEditorCommit("feature.body.update", "axisZ") }
  ];
}

function featureSourceEditorSection(feature = {}) {
  if (!feature.source) return null;
  const source = feature.source;
  return {
    id: "feature.source",
    label: "Source",
    fields: [
      { type: "select", label: "Kind", options: SOURCE_KIND_OPTIONS, value: source.kind || "member-profile", commit: featureEditorCommit("feature.source.update", "kind") },
      { type: "text", label: "Member", value: source.memberId || "", commit: featureEditorCommit("feature.source.update", "memberId") }
    ]
  };
}

function fastenerPropertiesSections(fastenerGroup, { catalogEntries = null, catalogOptions = null, fastenerLengthOptions = null } = {}) {
  const assembly = fastenerGroup.assembly || {};
  const washers = assembly.washers || {};
  const fasteners = typeof catalogEntries === "function" ? catalogEntries("fasteners") : {};
  const fastener = fasteners?.[fastenerGroup.fastenerRef] || null;
  const lengthOptions = typeof fastenerLengthOptions === "function"
    ? arrayValues(fastenerLengthOptions(fastenerGroup.fastenerRef, assembly.length))
    : [];
  const fastenerOptions = typeof catalogOptions === "function"
    ? arrayValues(catalogOptions("fasteners", fastenerGroup.fastenerRef))
    : [];
  return [
    {
      id: "inspector.properties.object.fastenerGroup.catalog",
      label: "Fastener",
      fields: [
        { type: "select", label: "Fastener", options: fastenerOptions, value: fastenerGroup.fastenerRef || "", commit: objectPropertyCommit("object.fastenerGroup.update", "fastenerRef") },
        fastener?.kind ? { label: "Kind", value: fastener.kind } : null,
        fastener?.standard ? { label: "Standard", value: fastener.standard } : null,
        fastener?.grade ? { label: "Grade", value: fastener.grade } : null,
        finiteNumber(fastener?.shank?.diameter) ? { label: "Diameter", value: inspectorFormatNumber(fastener.shank.diameter) } : null,
        finiteNumber(fastener?.hole?.defaultDiameter) ? { label: "Hole", value: `${inspectorFormatNumber(fastener.hole.defaultDiameter)} ${fastener.hole.shape || "hole"}` } : null
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.fastenerGroup.assembly",
      label: "Assembly",
      fields: [
        lengthOptions.length
          ? { type: "select", label: "Length", options: lengthOptions, value: String(finiteNumberOr(assembly.length, lengthOptions[0].id)), commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "length"], valueType: "number" }) }
          : { type: "number", label: "Length", value: assembly.length, commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "length"] }), options: { min: 0, minExclusive: true } },
        { type: "number", label: "Grip length", value: assembly.gripLength, commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "gripLength"] }), options: { min: 0, minExclusive: true } },
        finiteNumber(assembly.nutOffset) ? { type: "number", label: "Nut offset", value: assembly.nutOffset, commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "nutOffset"] }), options: { min: 0 } } : null
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.fastenerGroup.washers",
      label: "Washers",
      fields: [
        { type: "checkbox", label: "Head washer", value: washers.head, commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "washers", "head"] }) },
        { type: "checkbox", label: "Nut washer", value: washers.nut, commit: objectPropertyCommit("object.fastenerGroup.update", null, { patchPath: ["assembly", "washers", "nut"] }) },
        finiteNumber(fastener?.washer?.outerDiameter) ? { label: "Outer diameter", value: inspectorFormatNumber(fastener.washer.outerDiameter) } : null,
        finiteNumber(fastener?.washer?.thickness) ? { label: "Thickness", value: inspectorFormatNumber(fastener.washer.thickness) } : null
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.fastenerGroup.installation",
      label: "Installation",
      fields: [
        fastenerGroup.holePatternRef ? { label: "Hole pattern", value: fastenerGroup.holePatternRef } : null,
        fastenerGroup.through?.fromFeatureId ? { label: "From feature", value: fastenerGroup.through.fromFeatureId } : null,
        fastenerGroup.through?.toFeatureId ? { label: "To feature", value: fastenerGroup.through.toFeatureId } : null,
        fastenerGroup.orientation?.headSide ? { label: "Head side", value: fastenerGroup.orientation.headSide } : null,
        fastenerGroup.orientation?.axis ? { label: "Axis", value: fastenerGroup.orientation.axis } : null,
        { label: "Participants", value: String(arrayValues(fastenerGroup.participants).length) },
        ...arrayValues(fastenerGroup.participants).map((participantId, index) => ({ label: `Participant ${index + 1}`, value: participantId }))
      ].filter(Boolean)
    }
  ];
}

function sketchPropertiesSections({ objectId = "", objectState = {} } = {}) {
  const definition = objectState.definition || null;
  const outlineVertices = objectState.outlineVertices;
  return [{
    id: "inspector.properties.object.sketch",
    label: "Sketch",
    fields: [
      { label: "Status", value: definition?.label || "-" },
      { label: "Outline", value: `${finiteNumber(outlineVertices) ? outlineVertices : 0} vertices` },
      definition?.degreesOfFreedom ? { label: "Free DOF", value: definition.degreesOfFreedom } : null,
      {
        type: "action",
        label: "Create Plate",
        icon: "plate",
        primary: true,
        action: "object.sketch.createPlate",
        payload: { objectId }
      }
    ].filter(Boolean)
  }];
}

function platePropertiesSections(plate, { objectId = "", objectDetail = {}, objectState = {} } = {}) {
  const definition = objectState.definition || { label: "-" };
  const outlineVertices = finiteNumber(objectState.outlineVertices) ? objectState.outlineVertices : 0;
  const bends = arrayValues(objectState.bends);
  const relationsVisibleIn3d = objectId === plate.id && objectDetail?.sketchMode === "relations";
  const relationViewDetail = relationsVisibleIn3d
    ? { sketchMode: "clean", clearSketchSelection: true }
    : { ...(objectDetail || {}), sketchMode: "relations" };
  return [
    {
      id: "inspector.properties.object.plate",
      label: "Plate",
      fields: [
        { type: "number", label: "Thickness", value: plate.thickness, commit: objectPropertyCommit("object.plate.update", "thickness"), options: { min: 0, minExclusive: true } },
        { label: "Material", value: plate.material || "-" },
        plate.referencePlaneId ? { label: "Reference plane", value: plate.referencePlaneId } : null,
        plate.assemblyId ? { label: "Assembly", value: plate.assemblyId } : null,
        plate.fabrication?.partMark ? { label: "Part mark", value: plate.fabrication.partMark } : null,
        plate.fabrication?.assemblyMark ? { label: "Assembly mark", value: plate.fabrication.assemblyMark } : null
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.plate.sketch",
      label: "Sketch",
      fields: [
        { label: "Status", value: definition.label },
        { label: "Outline", value: `${outlineVertices} vertices` },
        { label: "Relations", value: plateRelationSummary(definition) },
        definition.degreesOfFreedom ? { label: "Free DOF", value: definition.degreesOfFreedom } : null,
        definition.degreesOfFreedom ? { label: "Under-defined", value: `${arrayValues(definition.underDefinedVertexIds).length} vertices, ${arrayValues(definition.underDefinedEdgeIds).length} edges` } : null,
        ...plateSketchDiagnosticFields(definition),
        { type: "action", label: relationsVisibleIn3d ? "Hide Relations in 3D" : "Show Relations in 3D", icon: "relation", pressed: relationsVisibleIn3d, action: "object.plate.relations.toggle", payload: { objectId: plate.id, detail: relationViewDetail } },
        { type: "action", label: "Infer Relations", icon: "relation", action: "object.plate.relations.infer", payload: { objectId: plate.id }, title: "Infer missing sketch relations for this plate" }
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.plate.bends",
      label: "Bends",
      fields: [{ label: "Count", value: String(bends.length) }]
    },
    ...bends.map((bend, index) => plateBendPropertiesSection(plate, bend, index))
  ];
}

function plateBendPropertiesSection(plate, bend, index) {
  return {
    id: `inspector.properties.object.plate.bend.${safeInspectorId(bend.id || bend.edgeId || index + 1)}`,
    label: `Bend ${index + 1}`,
    open: index === 0,
    fields: [
      { label: "ID", value: bend.id || bend.edgeId || "bend" },
      { label: "Target", value: bend.targetLabel || "-" },
      { type: "select", label: "Direction", options: BEND_DIRECTION_OPTIONS, value: bend.direction || "up", commit: objectPropertyCommit("object.plate.bend.update", "direction", { bend }) },
      { type: "number", label: "Angle", value: finiteNumberOr(bend.angle, 90), commit: objectPropertyCommit("object.plate.bend.update", "angle", { bend }) },
      { type: "number", label: "Radius", value: finiteNumberOr(bend.radius, 0), commit: objectPropertyCommit("object.plate.bend.update", "radius", { bend }), options: { min: 0 } },
      { type: "number", label: "Flange length", value: finiteNumberOr(bend.flangeLength, 0), commit: objectPropertyCommit("object.plate.bend.update", "flangeLength", { bend }), options: { min: 0, minExclusive: true } },
      { type: "select", label: "Relief", options: BEND_RELIEF_OPTIONS, value: bend.relief?.type || "round", commit: objectPropertyCommit("object.plate.bend.update", null, { bend, patchPath: ["relief", "type"] }) },
      { type: "number", label: "Relief radius", value: finiteNumberOr(bend.relief?.radius, Math.max(finiteNumberOr(plate.thickness, 8), 8)), commit: objectPropertyCommit("object.plate.bend.update", null, { bend, patchPath: ["relief", "radius"] }), options: { min: 0 } },
      bend.id ? { type: "action", label: "Remove Bend", icon: "cancel", danger: true, action: "object.plate.bend.remove", payload: { objectId: plate.id, bendId: bend.id } } : null
    ].filter(Boolean)
  };
}

function safeInspectorId(value) {
  return String(value || "item").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function trimJointPropertiesSections(trimJoint, { objectId = "", objectDetail = {} } = {}) {
  const participants = arrayValues(trimJoint.participants);
  const operations = arrayValues(trimJoint.operations);
  const selectedOperation = operations.find((operation) => operation.id === objectDetail?.operationId) || operations[0] || null;
  return [
    {
      id: "inspector.properties.object.trimJoint.overview",
      label: "Trim Joint",
      fields: [
        { label: "Participants", value: String(participants.length) },
        { label: "Operations", value: String(operations.length) },
        trimJoint.fabrication?.operation ? { label: "Fabrication", value: trimJoint.fabrication.operation } : null,
        selectedOperation ? { label: "Active cut", value: selectedOperation.id } : null,
        { type: "action", label: "Open Trim Editor", icon: "trim", primary: true, action: "object.trim.openEditor", payload: { objectId } }
      ].filter(Boolean)
    },
    operations.length ? {
      id: "inspector.properties.object.trimJoint.cuts",
      label: "Cuts",
      fields: [
        {
          type: "tabList",
          label: "Cuts",
          value: selectedOperation?.id || operations[0]?.id || "",
          options: operations.map((operation, index) => ({
            id: operation.id,
            label: `${index + 1}. ${trimOperationLabel(operation.type)}`
          })),
          commit: { action: "object.trimJoint.operation.select" }
        }
      ]
    } : null,
    participants.length ? {
      id: "inspector.properties.object.trimJoint.participants",
      label: "Participants",
      placement: "reference",
      priority: 80,
      open: false,
      fields: [{
        type: "objectRefList",
        label: "Participants",
        items: participants.map((participant, index) => ({
          label: `Member ${index + 1}`,
          value: participant.memberId || "-",
          status: participant.enabled === false ? "Disabled" : "",
          icon: modelCollectionIcon("members"),
          actions: objectRefActions({
            select: { objectId: participant.memberId },
            fit: { objectId: participant.memberId },
            value: participant.memberId
          })
        }))
      }]
    } : null,
    selectedOperation ? {
      id: "inspector.properties.object.trimJoint.operation",
      label: `Cut: ${trimOperationLabel(selectedOperation.type)}`,
      fields: trimOperationFields(selectedOperation, { objectId })
    } : null
  ].filter(Boolean);
}

function trimOperationFields(operation, { objectId = "" } = {}) {
  const referencePlaneIds = arrayValues(operation.referencePlaneIds);
  const removedRegionKeys = arrayValues(operation.removedRegionKeys);
  return [
    { label: "ID", value: operation.id },
    trimOperationTypeField(operation),
    { type: "checkbox", label: "Enabled", value: operation.enabled !== false, commit: objectPropertyCommit("object.trimJoint.operation.update", "enabled", { operationId: operation.id }) },
    trimOperationSupportsGap(operation.type)
      ? { type: "number", label: "Gap", value: finiteNumberOr(operation.gap, 0), commit: objectPropertyCommit("object.trimJoint.operation.update", "gap", { operationId: operation.id }) }
      : null,
    trimOperationMemberField("Member A", operation.memberAId),
    trimOperationMemberEndField("Member A end", "memberAEnd", operation),
    trimOperationMemberField("Member B", operation.memberBId),
    trimOperationMemberEndField("Member B end", "memberBEnd", operation),
    operation.type === "end-miter" ? {
      type: "segmented",
      label: "Miter",
      value: operation.miterMode || "equal-angle",
      options: MITER_MODE_OPTIONS,
      commit: objectPropertyCommit("object.trimJoint.operation.update", "miterMode", { operationId: operation.id })
    } : null,
    trimOperationPlaneActions(operation, referencePlaneIds, objectId),
    trimOperationRegionActions(operation, referencePlaneIds, removedRegionKeys, objectId)
  ].filter(Boolean);
}

function trimOperationTypeField(operation) {
  if (operation.type === "plane-trim") {
    return {
      type: "actionList",
      label: "Type",
      emptyMessage: trimOperationLabel(operation.type),
      actions: [{
        label: trimOperationLabel(operation.type),
        icon: trimOperationIcon(operation.type),
        title: "Edit plane trim in the advanced Trim editor",
        action: "object.trim.openEditor",
        payload: { detail: { operationId: operation.id } }
      }]
    };
  }
  return {
    type: "optionGrid",
    label: "Type",
    value: operation.type,
    options: TRIM_OPERATION_TYPES
      .filter((option) => option.id !== "plane-trim")
      .map((option) => ({
        id: option.id,
        label: option.label,
        icon: option.icon
      })),
    commit: { action: "object.trimJoint.operation.type.set", operationId: operation.id }
  };
}

function trimOperationMemberField(label, memberId) {
  if (!memberId) return null;
  return {
    type: "objectRef",
    label,
    value: memberId,
    icon: modelCollectionIcon("members"),
    actions: objectRefActions({
      select: { objectId: memberId },
      fit: { objectId: memberId },
      value: memberId
    })
  };
}

function trimOperationMemberEndField(label, patchKey, operation) {
  if (!operation[patchKey]) return null;
  return {
    type: "segmented",
    label,
    value: operation[patchKey],
    options: [
      { id: "start", label: "Start" },
      { id: "end", label: "End" }
    ],
    commit: objectPropertyCommit("object.trimJoint.operation.update", patchKey, { operationId: operation.id })
  };
}

function trimOperationPlaneActions(operation, referencePlaneIds, objectId) {
  if (operation.type !== "plane-trim" && !referencePlaneIds.length) return null;
  return {
    type: "actionList",
    label: "Planes",
    emptyMessage: "Open Trim Editor to pick reference planes.",
    actions: [
      ...referencePlaneIds.map((referencePlaneId) => ({
        label: referencePlaneId,
        icon: modelCollectionIcon("referencePlanes"),
        title: `Edit plane ${referencePlaneId} in Trim Editor`,
        action: "object.trim.openEditor",
        payload: { objectId, detail: { operationId: operation.id } }
      })),
      {
        label: referencePlaneIds.length ? "Manage planes" : "Pick planes",
        icon: "trim",
        title: "Open Trim Editor for plane selection",
        primary: !referencePlaneIds.length,
        action: "object.trim.openEditor",
        payload: { objectId, detail: { operationId: operation.id } }
      }
    ]
  };
}

function trimOperationRegionActions(operation, referencePlaneIds, removedRegionKeys, objectId) {
  if (operation.type !== "plane-trim") return null;
  const regionKeys = trimPlaneRegionKeys(referencePlaneIds);
  return {
    type: "actionList",
    label: "Regions",
    emptyMessage: "Pick planes to create removable regions.",
    actions: regionKeys.map((regionKey) => ({
      label: `${removedRegionKeys.includes(regionKey) ? "Removed" : "Kept"}: ${trimRegionLabel(regionKey)}`,
      icon: removedRegionKeys.includes(regionKey) ? "cancel" : "selection",
      pressed: removedRegionKeys.includes(regionKey),
      title: "Open this region in Trim Editor",
      action: "object.trim.openEditor",
      payload: { objectId, detail: { operationId: operation.id, regionKey } }
    }))
  };
}

function trimPlaneRegionKeys(referencePlaneIds) {
  const planeIds = arrayValues(referencePlaneIds).filter(Boolean);
  if (!planeIds.length) return [];
  const keys = [];
  const walk = (index, parts) => {
    if (index >= planeIds.length) {
      keys.push(parts.map(({ planeId, side }) => `${planeId}:${side}`).join("|"));
      return;
    }
    const planeId = planeIds[index];
    walk(index + 1, [...parts, { planeId, side: "-" }]);
    walk(index + 1, [...parts, { planeId, side: "+" }]);
  };
  walk(0, []);
  return keys;
}

function trimRegionLabel(regionKey) {
  return String(regionKey || "").split("|")
    .map((part) => {
      const index = part.lastIndexOf(":");
      return index > 0 ? `${part.slice(0, index)} ${part.slice(index + 1)}` : part;
    })
    .join(" / ");
}

function featurePropertiesSections(feature, { objectId = "" } = {}) {
  const body = feature.body && typeof feature.body === "object" && !Array.isArray(feature.body) ? feature.body : null;
  const operationFields = [
    { type: "checkbox", label: "Enabled", value: feature.operationEnabled !== false, commit: { action: "object.feature.operationEnabled.set" } },
    feature.type === "boolean-part"
      ? { type: "select", label: "Boolean", options: BOOLEAN_TYPE_OPTIONS, value: feature.booleanType || "BOOLEAN_CUT", commit: objectPropertyCommit("object.feature.update", "booleanType") }
      : null,
    { label: "Cut kind", value: feature.cutKind || "-" },
    feature.fabrication?.operation ? { label: "Fabrication", value: feature.fabrication.operation } : null
  ].filter(Boolean);
  return [
    {
      id: "inspector.properties.object.feature.operation",
      label: "Operation",
      fields: operationFields
    },
    body ? {
      id: "inspector.properties.object.feature.body",
      label: "Cutting Body",
      fields: featureBodyFields(feature, body, { objectId })
    } : null
  ].filter(Boolean);
}

function featureBodyFields(feature, body, { objectId = "" } = {}) {
  const fields = [
    { label: "Body", value: body.type || "-" },
    ...objectVectorPropertyFields("Center", body.center, { action: "object.feature.body.update", patchKey: "center" })
  ];
  if (body.type === "box") {
    fields.push(...objectVectorPropertyFields("Size", body.size, { action: "object.feature.body.update", patchKey: "size" }, { min: 0, minExclusive: true }));
  } else if (body.type === "cylinder") {
    fields.push(
      { type: "number", label: "Radius", value: body.radius, commit: objectPropertyCommit("object.feature.body.update", "radius"), options: { min: 0, minExclusive: true } },
      { type: "number", label: "Depth", value: body.depth, commit: objectPropertyCommit("object.feature.body.update", "depth"), options: { min: 0, minExclusive: true } }
    );
  } else if (body.type === "polygonal-prism") {
    fields.push(
      { type: "number", label: "Depth", value: body.depth, commit: objectPropertyCommit("object.feature.body.update", "depth"), options: { min: 0, minExclusive: true } },
      { label: "Outline", value: `${arrayValues(body.outline).length} points` }
    );
  }
  if (feature.source?.memberId) fields.push({ label: "Source member", value: feature.source.memberId });
  fields.push({ type: "action", label: "Open Feature Editor", icon: "feature", primary: true, action: "object.feature.openEditor", payload: { objectId } });
  return fields;
}

function weldPropertiesSections(weld) {
  const participants = arrayValues(weld.participants);
  const runs = arrayValues(weld.reference?.runs);
  return [
    {
      id: "inspector.properties.object.weld",
      label: "Weld",
      fields: [
        { type: "number", label: "Size", value: finiteNumberOr(weld.size, 0), commit: objectPropertyCommit("object.weld.update", "size"), options: { min: 0, minExclusive: true } },
        finiteNumber(weld.length) ? { type: "number", label: "Length", value: weld.length, commit: objectPropertyCommit("object.weld.update", "length"), options: { min: 0, minExclusive: true } } : null,
        { label: "Participants", value: String(participants.length) },
        { label: "Runs", value: String(runs.length) }
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.weld.participants",
      label: "Participants",
      placement: "reference",
      priority: 80,
      open: false,
      fields: participants.map((participantId, index) => ({ label: `Participant ${index + 1}`, value: participantId }))
    },
    weld.reference ? {
      id: "inspector.properties.object.weld.reference",
      label: "Reference",
      placement: "reference",
      priority: 90,
      open: false,
      fields: [
        weld.reference.kind ? { label: "Kind", value: weld.reference.kind } : null,
        weld.reference.plateId ? { label: "Plate", value: weld.reference.plateId } : null,
        weld.reference.supportInterfaceId ? { label: "Support interface", value: weld.reference.supportInterfaceId } : null,
        weld.reference.stationReferenceInterfaceRef ? { label: "Station reference", value: weld.reference.stationReferenceInterfaceRef } : null
      ].filter(Boolean)
    } : null,
    runs.length ? {
      id: "inspector.properties.object.weld.runs",
      label: "Runs",
      placement: "reference",
      priority: 100,
      open: false,
      fields: runs.flatMap((run, index) => weldRunFields(run, index))
    } : null
  ].filter((section) => section?.fields?.length);
}

function objectVectorPropertyFields(label, value, commit, options = {}) {
  const current = arrayValues(value).slice(0, VECTOR_AXIS_LABELS.length);
  if (current.length !== VECTOR_AXIS_LABELS.length || current.some((item) => !finiteNumber(item))) {
    return [{ label, value: arrayValues(value).length ? inspectorFormatVector(value) : "-" }];
  }
  return VECTOR_AXIS_LABELS.map((axis, index) => ({
    type: "number",
    label: `${label} ${axis}`,
    value: current[index],
    commit: { ...commit, vectorValue: current, axisIndex: index },
    options
  }));
}

function trimOperationTypeLabel(type) {
  return {
    "end-butt-1": "End butt",
    "end-butt-2": "End butt",
    "end-butt-both": "Double end butt",
    "end-miter": "End miter",
    "profile-cope": "Profile cope",
    "plane-trim": "Plane trim",
    "equal-angle": "Equal angle",
    "profile-balanced": "Balanced profile"
  }[type] || String(type || "-");
}

function plateRelationSummary(definition) {
  const relationCount = finiteNumberOr(definition?.relationCount, 0);
  const independent = finiteNumberOr(definition?.independentConstraintCount, 0);
  const variables = finiteNumberOr(definition?.variableCount, 0);
  return `${relationCount} (${independent}/${variables} independent)`;
}

function plateSketchDiagnosticFields(definition) {
  const diagnostics = arrayValues(definition?.diagnostics).filter((item) => item?.severity && item.severity !== "info");
  if (!diagnostics.length) return [];
  const errors = diagnostics.filter((item) => item.severity === "error");
  const warnings = diagnostics.filter((item) => item.severity !== "error");
  const summary = [
    errors.length ? `${errors.length} error${errors.length === 1 ? "" : "s"}` : "",
    warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""
  ].filter(Boolean).join(", ");
  return [
    { label: "Diagnostics", value: summary },
    errors[0] ? {
      type: "message",
      state: "error",
      value: errors[0].message || errors[0].code || "Sketch diagnostic"
    } : null
  ].filter(Boolean);
}

function weldRunFields(run, index) {
  return [
    { label: `Run ${index + 1}`, value: [run.edge, run.side].filter(Boolean).join(" / ") || run.id || "-" },
    finiteNumber(run.size) ? { label: `Run ${index + 1} size`, value: inspectorFormatNumber(run.size) } : null,
    finiteNumber(run.length) ? { label: `Run ${index + 1} length`, value: inspectorFormatNumber(run.length) } : null
  ].filter(Boolean);
}

export function inspectorSupportObjectPropertySections({ collection = "", object = null, actions = {} } = {}) {
  if (!object) return [];
  if (collection === "workPoints") return workPointPropertiesSections(object, actions);
  if (collection === "referencePlanes") return referencePlanePropertiesSections(object, actions);
  if (collection === "interfaces") return interfacePropertiesSections(object, actions);
  if (collection === "connectionZones") return connectionZonePropertiesSections(object, actions);
  if (collection === "assemblies") return assemblyPropertiesSections(object, actions);
  if (collection === "groups") return groupPropertiesSections(object, actions);
  if (collection === "holePatterns") return holePatternPropertiesSections(object, actions);
  if (collection === "objectPatterns") return objectPatternPropertiesSections(object, actions);
  if (collection === "relations") return relationPropertiesSections(object);
  return [];
}

function supportObjectCommit(action, patchKey, extras = {}) {
  return { action, patchKey, ...extras };
}

function workPointPropertiesSections(workPoint, actions = {}) {
  return [
    {
      id: "inspector.properties.object.workPoint",
      label: "Work Point",
      fields: [
        { type: "text", label: "Role", value: workPoint.role || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.workPoint, "role") },
        vector3PropertyField("Point", workPoint.point, SUPPORT_OBJECT_ACTIONS.workPoint, "point", { unit: "mm" }),
        workPoint.gridSystemId ? { label: "Grid system", value: workPoint.gridSystemId } : null,
        workPoint.gridRefs ? { label: "Grid refs", value: inspectorFormatKeyValues(workPoint.gridRefs) } : null
      ].filter(Boolean)
    }
  ];
}

function referencePlanePropertiesSections(plane, actions = {}) {
  return [
    {
      id: "inspector.properties.object.referencePlane",
      label: "Reference Plane",
      fields: [
        { type: "text", label: "Name", value: plane.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.referencePlane, "name") },
        vector3PropertyField("Origin", plane.origin, SUPPORT_OBJECT_ACTIONS.referencePlane, "origin", { unit: "mm" }),
        vector3PropertyField("Normal", plane.normal, SUPPORT_OBJECT_ACTIONS.referencePlane, "normal"),
        vector3PropertyField("Axis X", plane.axisX, SUPPORT_OBJECT_ACTIONS.referencePlane, "axisX"),
        vector3PropertyField("Axis Y", plane.axisY, SUPPORT_OBJECT_ACTIONS.referencePlane, "axisY"),
        ...extentPropertyFields("Extents", plane.extents, SUPPORT_OBJECT_ACTIONS.referencePlane, "extents")
      ].filter(Boolean)
    },
    inspectorMetadataSection({ id: "inspector.properties.object.referencePlane.authoring", object: plane })
  ].filter(Boolean);
}

function interfacePropertiesSections(iface, actions = {}) {
  return [
    {
      id: "inspector.properties.object.interface",
      label: "Interface",
      fields: [
        { type: "text", label: "Role", value: iface.role || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.interface, "role") },
        { type: "text", label: "Notes", value: iface.notes || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.interface, "notes") },
        iface.faceRef ? { label: "Face", value: iface.faceRef } : null,
        finiteNumber(iface.station) ? { type: "number", label: "Station", value: iface.station, commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.interface, "station") } : null,
        iface.memberEnd ? { label: "Member end", value: iface.memberEnd } : null,
        ...vectorPropertyFields("Origin", iface.origin, SUPPORT_OBJECT_ACTIONS.interface, "origin"),
        ...vectorPropertyFields("Normal", iface.normal, SUPPORT_OBJECT_ACTIONS.interface, "normal"),
        ...extentPropertyFields("Extents", iface.extents, SUPPORT_OBJECT_ACTIONS.interface, "extents")
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.interface.axes",
      label: "Local Axes",
      fields: [
        ...vectorPropertyFields("Local Y", iface.localAxisY, SUPPORT_OBJECT_ACTIONS.interface, "localAxisY"),
        ...vectorPropertyFields("Local Z", iface.localAxisZ, SUPPORT_OBJECT_ACTIONS.interface, "localAxisZ")
      ]
    },
    inspectorMetadataSection({ id: "inspector.properties.object.interface.authoring", object: iface })
  ].filter(Boolean);
}

function connectionZonePropertiesSections(zone, actions = {}) {
  return [
    {
      id: "inspector.properties.object.connectionZone",
      label: "Connection Zone",
      fields: [
        { type: "text", label: "Name", value: zone.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.connectionZone, "name") },
        { type: "text", label: "Notes", value: zone.notes || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.connectionZone, "notes") },
        zone.mainObjectId ? { label: "Main object", value: zone.mainObjectId } : null,
        ...vectorPropertyFields("Origin", zone.origin, SUPPORT_OBJECT_ACTIONS.connectionZone, "origin"),
        { label: "Secondary objects", value: String(arrayValues(zone.secondaryObjectIds).length) },
        { label: "Interfaces", value: String(arrayValues(zone.interfaceIds).length) },
        { label: "Managed objects", value: String(arrayValues(zone.objectIds).length) },
        { label: "Smart Components", value: String(arrayValues(zone.smartComponentInstanceIds).length) }
      ].filter(Boolean)
    },
    objectReferencePropertiesSection("inspector.properties.object.connectionZone.interfaces", "Interfaces", zone.interfaceIds, "Interface", actions),
    objectReferencePropertiesSection("inspector.properties.object.connectionZone.objects", "Objects", zone.objectIds, "Object", actions),
    objectReferencePropertiesSection("inspector.properties.object.connectionZone.components", "Smart Components", zone.smartComponentInstanceIds, "Component", actions),
    inspectorMetadataSection({ id: "inspector.properties.object.connectionZone.authoring", object: zone })
  ].filter(Boolean);
}

function assemblyPropertiesSections(assembly, actions = {}) {
  return [
    {
      id: "inspector.properties.object.assembly",
      label: "Assembly",
      fields: [
        { type: "text", label: "Name", value: assembly.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.assembly, "name") },
        { type: "text", label: "Mark", value: assembly.mark || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.assembly, "mark") },
        { type: "text", label: "Status", value: assembly.tracking?.status || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.assembly, null, { patchPath: ["tracking", "status"] }) },
        assembly.parentAssemblyId ? { label: "Parent", value: assembly.parentAssemblyId } : null,
        assembly.mainPartId ? { label: "Main part", value: assembly.mainPartId } : null,
        { label: "Children", value: String(arrayValues(assembly.childAssemblyIds).length) },
        { label: "Parts", value: String(arrayValues(assembly.partIds).length) },
        { label: "Members", value: String(arrayValues(assembly.memberIds).length) },
        { label: "Plates", value: String(arrayValues(assembly.plateIds).length) },
        { label: "Fasteners", value: String(arrayValues(assembly.fastenerGroupIds).length) },
        { label: "Welds", value: String(arrayValues(assembly.weldIds).length) },
        { label: "Zones", value: String(arrayValues(assembly.connectionZoneIds).length) }
      ].filter(Boolean)
    },
    objectReferencePropertiesSection("inspector.properties.object.assembly.contents", "Contents", inspectorAssemblyContentIds(assembly), "Object", actions),
    inspectorMetadataSection({ id: "inspector.properties.object.assembly.tracking", object: assembly, label: "Tracking", key: "tracking" }),
    inspectorMetadataSection({ id: "inspector.properties.object.assembly.authoring", object: assembly })
  ].filter(Boolean);
}

function groupPropertiesSections(group, actions = {}) {
  return [
    {
      id: "inspector.properties.object.group",
      label: "Group",
      fields: [
        { type: "text", label: "Name", value: group.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.group, "name") },
        group.projectTreeNodeId ? { label: "Project tree", value: group.projectTreeNodeId } : null,
        { label: "Objects", value: String(arrayValues(group.objectIds).length) },
        { label: "Members", value: String(arrayValues(group.memberIds).length) },
        { label: "Parts", value: String(arrayValues(group.partIds).length) },
        { label: "Child groups", value: String(arrayValues(group.childGroupIds).length) }
      ].filter(Boolean)
    },
    objectReferencePropertiesSection("inspector.properties.object.group.objects", "Objects", group.objectIds, "Object", actions),
    inspectorMetadataSection({ id: "inspector.properties.object.group.authoring", object: group })
  ].filter(Boolean);
}

function holePatternPropertiesSections(pattern, actions = {}) {
  const positions = arrayValues(pattern.positions);
  return [
    {
      id: "inspector.properties.object.holePattern",
      label: "Hole Pattern",
      fields: [
        finiteNumber(pattern.holeDiameter) ? { type: "number", label: "Hole diameter", value: pattern.holeDiameter, commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.holePattern, "holeDiameter"), options: { min: 0, minExclusive: true } } : null,
        { type: "text", label: "Hole type", value: pattern.holeType || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.holePattern, "holeType") },
        pattern.ownerId ? { label: "Owner", value: pattern.ownerId } : null,
        { label: "Positions", value: String(positions.length) },
        positions.length ? { label: "First position", value: inspectorFormatVector(positions[0]) } : null,
        positions.length ? { label: "Bounds", value: inspectorFormatPointBounds(positions) } : null
      ].filter(Boolean)
    },
    holePatternPositionEditSection(pattern, positions, actions),
    inspectorIdListSection({
      id: "inspector.properties.object.holePattern.positions",
      label: "Positions",
      values: positions.map(inspectorFormatVector),
      itemLabel: "Position"
    }),
    inspectorMetadataSection({ id: "inspector.properties.object.holePattern.authoring", object: pattern })
  ].filter(Boolean);
}

function objectPatternPropertiesSections(pattern, actions = {}) {
  return [
    {
      id: "inspector.properties.object.objectPattern",
      label: "Object Pattern",
      fields: [
        { type: "text", label: "Name", value: pattern.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.objectPattern, "name") },
        { type: "select", label: "Status", options: OBJECT_PATTERN_STATUS_OPTIONS, value: pattern.status || "linked", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.objectPattern, "status") },
        pattern.transform?.kind ? { label: "Kind", value: pattern.transform.kind } : null,
        pattern.transform?.family ? { label: "Family", value: pattern.transform.family } : null,
        finiteNumber(pattern.transform?.count) ? { label: "Count", value: inspectorFormatNumber(pattern.transform.count) } : null,
        { label: "Generated objects", value: String(arrayValues(pattern.generatedObjectIds).length) },
        { label: "Detached objects", value: String(arrayValues(pattern.detachedObjectIds).length) },
        { type: "text", label: "Notes", value: pattern.notes || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.objectPattern, "notes") }
      ].filter(Boolean)
    },
    objectReferencePropertiesSection("inspector.properties.object.objectPattern.generated", "Generated Objects", pattern.generatedObjectIds, "Object", actions),
    objectReferencePropertiesSection("inspector.properties.object.objectPattern.detached", "Detached Objects", pattern.detachedObjectIds, "Object", actions),
    inspectorMetadataSection({ id: "inspector.properties.object.objectPattern.authoring", object: pattern })
  ].filter(Boolean);
}

function relationPropertiesSections(relation) {
  return [
    {
      id: "inspector.properties.object.relation",
      label: "Relation",
      fields: [
        relation.label ? { label: "Label", value: relation.label } : null,
        relation.memberId ? { label: "Member", value: relation.memberId } : null,
        relation.endpoint ? { label: "Endpoint", value: relation.endpoint } : null,
        relation.createdBy ? { label: "Created by", value: relation.createdBy } : null
      ].filter(Boolean)
    },
    relation.source ? {
      id: "inspector.properties.object.relation.source",
      label: "Source",
      fields: [
        relation.source.type ? { label: "Type", value: relation.source.type } : null,
        relation.source.memberId ? { label: "Source member", value: relation.source.memberId } : null,
        relation.source.axis ? { label: "Axis", value: relation.source.axis } : null,
        relation.source.label ? { label: "Label", value: relation.source.label } : null,
        relation.source.origin ? { label: "Origin", value: inspectorFormatVector(relation.source.origin) } : null,
        relation.source.direction ? { label: "Direction", value: inspectorFormatVector(relation.source.direction) } : null,
        relation.source.a ? { label: "A", value: inspectorFormatVector(relation.source.a) } : null,
        relation.source.b ? { label: "B", value: inspectorFormatVector(relation.source.b) } : null
      ].filter(Boolean)
    } : null
  ].filter(Boolean);
}

function objectReferencePropertiesSection(id, label, values, itemLabel, actions = {}, limit = 8) {
  return inspectorObjectReferenceSection({
    id,
    label,
    values,
    itemLabel,
    limit,
    objectIndex: actions.objectIndex || {},
    onSelectObject: actions.selectObjectReference,
    onFitObject: actions.focusObjectReference
  });
}

function vectorPropertyFields(label, value, action, patchKey, options = {}) {
  const current = arrayValues(value).slice(0, VECTOR_AXIS_LABELS.length);
  if (current.length !== VECTOR_AXIS_LABELS.length || current.some((item) => !finiteNumber(item))) {
    return [{ label, value: arrayValues(value).length ? inspectorFormatVector(value) : "-" }];
  }
  return VECTOR_AXIS_LABELS.map((axis, index) => ({
    type: "number",
    label: `${label} ${axis}`,
    value: current[index],
    commit: supportObjectCommit(action, patchKey, { vectorValue: current, axisIndex: index }),
    options
  }));
}

function vector3PropertyField(label, value, action, patchKey, options = {}) {
  const current = arrayValues(value).slice(0, VECTOR_AXIS_LABELS.length);
  if (current.length !== VECTOR_AXIS_LABELS.length || current.some((item) => !finiteNumber(item))) {
    return { label, value: arrayValues(value).length ? value : "-" };
  }
  return {
    type: "vector3",
    label,
    value: current,
    commit: supportObjectCommit(action, patchKey),
    unit: options.unit,
    options
  };
}

function vector2PropertyFields(label, value, action, patchKey, options = {}, extras = {}) {
  const axisLabels = ["X", "Y"];
  const current = arrayValues(value).slice(0, axisLabels.length);
  if (current.length !== axisLabels.length || current.some((item) => !finiteNumber(item))) {
    return [{ label, value: arrayValues(value).length ? inspectorFormatVector(value) : "-" }];
  }
  return axisLabels.map((axis, index) => ({
    type: "number",
    label: `${label} ${axis}`,
    value: current[index],
    commit: supportObjectCommit(action, patchKey, { vectorValue: current, axisIndex: index, ...extras }),
    options
  }));
}

function extentPropertyFields(label, extents, action, patchKey) {
  if (!extents || typeof extents !== "object" || Array.isArray(extents)) return [];
  const entries = [
    ["xMin", "X min"],
    ["xMax", "X max"],
    ["yMin", "Y min"],
    ["yMax", "Y max"],
    ["width", "Width"],
    ["height", "Height"],
    ["length", "Length"]
  ].filter(([key]) => finiteNumber(extents[key]));
  return entries.map(([key, fieldLabel]) => ({
    type: "number",
    label: `${label} ${fieldLabel}`,
    value: extents[key],
    commit: supportObjectCommit(action, patchKey, { objectValue: extents, childKey: key })
  }));
}

function holePatternPositionEditSection(pattern, positions, actions = {}) {
  const editablePositions = positions.slice(0, 4);
  if (!editablePositions.length) return null;
  const fields = editablePositions.flatMap((position, index) => vector2PropertyFields(`Position ${index + 1}`, position, SUPPORT_OBJECT_ACTIONS.holePattern, "positions", {}, { arrayValue: positions, itemIndex: index }));
  if (positions.length > editablePositions.length) fields.push({ label: "More positions", value: `${positions.length - editablePositions.length} additional in Positions` });
  return {
    id: "inspector.properties.object.holePattern.positionEdit",
    label: "Position Editing",
    fields,
    open: false
  };
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
