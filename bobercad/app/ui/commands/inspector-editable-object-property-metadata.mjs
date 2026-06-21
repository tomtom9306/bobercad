import { modelCollectionIcon } from "./model-collection-metadata.mjs";
import { TRIM_OPERATION_TYPES, trimOperationIcon, trimOperationLabel, trimOperationSupportsGap } from "./trim-operation-metadata.mjs";

const VECTOR_AXIS_LABELS = ["X", "Y", "Z"];
const BOOLEAN_TYPE_OPTIONS = [
  { id: "BOOLEAN_CUT", label: "Cut" },
  { id: "BOOLEAN_ADD", label: "Add" },
  { id: "BOOLEAN_WELDPREP", label: "Weld prep" }
];
const SOURCE_KIND_OPTIONS = [
  { id: "member-profile", label: "Member profile" }
];
const BODY_AXIS_TYPES = new Set(["box", "cylinder", "polygonal-prism"]);
const BEND_DIRECTION_OPTIONS = [
  { id: "up", label: "Up" },
  { id: "down", label: "Down" }
];
const BEND_RELIEF_OPTIONS = [
  { id: "round", label: "Round" },
  { id: "rect", label: "Rect" },
  { id: "obround", label: "Obround" },
  { id: "v-notch", label: "V notch" },
  { id: "none", label: "None" }
];
const OBJECT_REF_ACTION_SPECS = Object.freeze({
  select: Object.freeze({ action: "objectRef.select", label: "Select", icon: "selection" }),
  fit: Object.freeze({ action: "objectRef.fit", label: "Fit", icon: "zoom-fit" })
});
const MITER_MODE_OPTIONS = Object.freeze([
  { id: "equal-angle", label: "Equal angle" },
  { id: "profile-balanced", label: "Balanced profile" }
]);

export function inspectorEditableObjectPropertySections({
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
        { type: "action", label: "Edit Trim", icon: "trim", primary: true, action: "object.trim.openEditor", payload: { objectId } }
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
        title: "Edit plane trim in Properties",
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
    emptyMessage: "Use Edit Trim to pick reference planes.",
    actions: [
      ...referencePlaneIds.map((referencePlaneId) => ({
        label: referencePlaneId,
        icon: modelCollectionIcon("referencePlanes"),
        title: `Edit plane ${referencePlaneId} in Properties`,
        action: "object.trim.openEditor",
        payload: { objectId, detail: { operationId: operation.id } }
      })),
      {
        label: referencePlaneIds.length ? "Manage planes" : "Pick planes",
        icon: "trim",
        title: "Edit Trim for plane selection",
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
      title: "Edit this region in Properties",
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

function inspectorFormatNumber(value) {
  return finiteNumber(value) ? Number(value.toFixed(3)).toString() : "-";
}

function inspectorFormatVector(value) {
  const values = arrayValues(value);
  if (!values.length) return "-";
  return values.map((item) => finiteNumber(item) ? inspectorFormatNumber(item) : String(item)).join(", ");
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteNumberOr(value, fallback) {
  return finiteNumber(value) ? value : fallback;
}

function arrayValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [];
}
