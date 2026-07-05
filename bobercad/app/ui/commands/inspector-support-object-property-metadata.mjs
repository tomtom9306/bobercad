import { modelCollectionIcon } from "./model-collection-metadata.mjs";

const VECTOR_AXIS_LABELS = ["X", "Y", "Z"];

const OBJECT_PATTERN_STATUS_OPTIONS = [
  { id: "linked", label: "Linked" },
  { id: "partially-detached", label: "Partially detached" },
  { id: "broken", label: "Broken" }
];

const SUPPORT_OBJECT_ACTIONS = {
  gridSystem: "supportObject.gridSystem.update",
  level: "supportObject.level.update",
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

function objectRefActions({ select = null, fit = null, value = "" } = {}) {
  return [
    select ? objectRefActionDescriptor("select", select, value) : null,
    fit ? objectRefActionDescriptor("fit", fit, value) : null
  ].filter(Boolean);
}

function objectRefActionDescriptor(type, payload, value = "") {
  const spec = OBJECT_REF_ACTION_SPECS[type];
  const overrides = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  return {
    action: spec.action,
    label: overrides.label || spec.label,
    icon: spec.icon,
    title: overrides.title || (value ? `${spec.label} ${value}` : spec.label),
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : { objectId: payload }
  };
}

function inspectorObjectReferenceSection({
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

function inspectorObjectIconForEntry(entry) {
  return modelCollectionIcon(entry?.collection) || "object";
}

function inspectorIdListSection({ id = "", label = "Items", values = [], itemLabel = "Item", limit = 8 } = {}) {
  const ids = arrayValues(values).filter((value) => value !== undefined && value !== null && value !== "");
  if (!ids.length) return null;
  const visible = ids.slice(0, limit);
  const fields = visible.map((value, index) => ({ label: `${itemLabel} ${index + 1}`, value }));
  if (ids.length > visible.length) fields.push({ label: "More", value: `${ids.length - visible.length} additional` });
  return { id, label, fields };
}

function inspectorMetadataSection({ id = "", object = null, label = "Authoring", key = "authoring" } = {}) {
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

function inspectorAssemblyContentIds(assembly = {}) {
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

function inspectorFlattenSmartComponentObjectIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(inspectorFlattenSmartComponentObjectIds);
  if (typeof value === "object") return Object.values(value).flatMap(inspectorFlattenSmartComponentObjectIds);
  return [];
}

function inspectorMetadataLabel(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inspectorFormatNumber(value) {
  if (!finiteNumber(value)) return "-";
  return String(Number(value.toFixed(3)));
}

function inspectorFormatVector(value) {
  const values = arrayValues(value);
  if (!values.length) return "-";
  return values.map((item) => finiteNumber(item) ? inspectorFormatNumber(item) : String(item)).join(", ");
}

function inspectorFormatKeyValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "-";
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
  if (!entries.length) return "-";
  return entries.map(([key, item]) => `${key}: ${Array.isArray(item) ? inspectorFormatVector(item) : item}`).join(", ");
}

function inspectorFormatPointBounds(points) {
  const valid = arrayValues(points).filter((point) => Array.isArray(point) && point.length >= 2 && point.every(finiteNumber));
  if (!valid.length) return "-";
  const dimensions = valid[0].length;
  const axes = ["X", "Y", "Z"];
  return Array.from({ length: dimensions }, (_, axis) => {
    const values = valid.map((point) => point[axis]);
    return `${axes[axis] || axis + 1}: ${inspectorFormatNumber(Math.min(...values))}..${inspectorFormatNumber(Math.max(...values))}`;
  }).join(", ");
}

export function inspectorSupportObjectPropertySections({ collection = "", object = null, actions = {} } = {}) {
  if (!object) return [];
  if (collection === "gridSystems") return gridSystemPropertiesSections(object, actions);
  if (collection === "levels") return levelPropertiesSections(object, actions);
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

function gridSystemPropertiesSections(gridSystem, actions = {}) {
  return [
    {
      id: "inspector.properties.object.gridSystem",
      label: "Grid System",
      fields: [
        { type: "text", label: "Name", value: gridSystem.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.gridSystem, "name") },
        vector3PropertyField("Origin", gridSystem.origin, SUPPORT_OBJECT_ACTIONS.gridSystem, "origin", { unit: "mm" })
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.gridSystem.levels",
      label: "Levels",
      fields: gridLevelPropertyFields(gridSystem, actions)
    },
    {
      id: "inspector.properties.object.gridSystem.basis",
      label: "Local Axes",
      level: "advanced",
      fields: [
        vector3PropertyField("Axis X", gridSystem.axisX, SUPPORT_OBJECT_ACTIONS.gridSystem, "axisX"),
        vector3PropertyField("Axis Y", gridSystem.axisY, SUPPORT_OBJECT_ACTIONS.gridSystem, "axisY"),
        vector3PropertyField("Axis Z", gridSystem.axisZ, SUPPORT_OBJECT_ACTIONS.gridSystem, "axisZ")
      ].filter(Boolean)
    },
    {
      id: "inspector.properties.object.gridSystem.axesX",
      label: "X Axes",
      fields: gridAxisPropertyFields(gridSystem, "x")
    },
    {
      id: "inspector.properties.object.gridSystem.axesY",
      label: "Y Axes",
      fields: gridAxisPropertyFields(gridSystem, "y")
    }
  ].filter((section) => section.fields?.length);
}

function gridLevelPropertyFields(gridSystem, actions = {}) {
  const projectLevels = actions.project?.model?.levels || {};
  const levelIds = arrayValues(gridSystem.levelIds).length
    ? arrayValues(gridSystem.levelIds)
    : Object.keys(projectLevels);
  const levels = levelIds
    .map((levelId) => projectLevels[levelId])
    .filter(Boolean);
  const fields = levels.length
    ? levels.flatMap((level, index) => {
      const label = level.name || level.id || `Level ${index + 1}`;
      return [
        {
          type: "objectRef",
          label: `Level ${index + 1}`,
          value: level.id,
          icon: "reference-plane",
          status: finiteNumber(level.elevation) ? `${inspectorFormatNumber(level.elevation)} mm` : "",
          actions: objectRefActions({
            select: { objectId: level.id },
            fit: { objectId: level.id },
            value: level.id
          })
        },
        {
          type: "text",
          label: `${label} name`,
          value: level.name || "",
          commit: supportObjectCommit("supportObject.gridLevel.update", "name", { levelId: level.id })
        },
        {
          type: "number",
          label: `${label} elevation`,
          value: finiteNumber(level.elevation) ? level.elevation : 0,
          commit: supportObjectCommit("supportObject.gridLevel.update", "elevation", { levelId: level.id }),
          options: { unit: "mm" }
        }
      ];
    })
    : [{ type: "message", state: "help", value: "No levels are linked to this grid." }];
  return [
    ...fields,
    { type: "action", label: "Add Level", icon: "reference-plane", action: "gridLevel.add", payload: { gridSystemId: gridSystem.id } }
  ];
}

function gridAxisPropertyFields(gridSystem, axisGroup) {
  const axes = arrayValues(gridSystem.axes?.[axisGroup]);
  const groupLabel = axisGroup.toUpperCase();
  const fields = axes.length
    ? axes.flatMap((axis, index) => [
      { type: "text", label: `${groupLabel} ${index + 1} label`, value: axis.label || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.gridSystem, null, { patchPath: ["axes", axisGroup], arrayObjectValue: axes, itemIndex: index, childKey: "label" }) },
      { type: "number", label: `${groupLabel} ${axis.label || index + 1} position`, value: finiteNumber(axis.position) ? axis.position : 0, commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.gridSystem, null, { patchPath: ["axes", axisGroup], arrayObjectValue: axes, itemIndex: index, childKey: "position" }), options: { unit: "mm" } },
      axes.length > 1
        ? { type: "action", label: `Remove ${groupLabel} ${axis.label || index + 1}`, icon: "cancel", danger: true, action: "gridAxis.remove", payload: { axisGroup, axisId: axis.id } }
        : null
    ].filter(Boolean))
    : [{ label: "Axes", value: "-" }];
  return [
    ...fields,
    { type: "action", label: `Add ${groupLabel} Axis`, icon: "grid", action: "gridAxis.add", payload: { axisGroup } }
  ];
}

function levelPropertiesSections(level, actions = {}) {
  return [
    {
      id: "inspector.properties.object.level",
      label: "Level",
      fields: [
        { type: "text", label: "Name", value: level.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.level, "name") },
        { type: "number", label: "Elevation", value: finiteNumber(level.elevation) ? level.elevation : 0, commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.level, "elevation"), options: { unit: "mm" } }
      ]
    }
  ];
}

function workPointPropertiesSections(workPoint, actions = {}) {
  return [
    {
      id: "inspector.properties.object.workPoint",
      label: "Work Point",
      fields: [
        { type: "text", label: "Role", value: workPoint.role || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.workPoint, "role") },
        vector3PropertyField("Point", workPoint.point, SUPPORT_OBJECT_ACTIONS.workPoint, "point", { unit: "mm" }),
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
    connectionZoneMemberSection(zone, actions),
    {
      id: "inspector.properties.object.connectionZone",
      label: "Connection Zone",
      fields: [
        { type: "text", label: "Name", value: zone.name || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.connectionZone, "name") },
        { type: "text", label: "Notes", value: zone.notes || "", commit: supportObjectCommit(SUPPORT_OBJECT_ACTIONS.connectionZone, "notes") },
        ...vectorPropertyFields("Origin", zone.origin, SUPPORT_OBJECT_ACTIONS.connectionZone, "origin"),
        { label: "Members", value: String(connectionZoneMemberIds(zone).length) },
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

function connectionZoneMemberSection(zone, actions = {}) {
  const members = connectionZoneMemberIds(zone);
  if (!members.length) return null;
  const linkedConnection = connectionZoneConnectionSmartComponent(zone, actions);
  const secondaryIds = arrayValues(zone.secondaryObjectIds);
  const fields = [
    connectionZoneCanSwapMembers(zone, linkedConnection)
      ? connectionZoneMemberSwapField(linkedConnection.id, zone.mainObjectId, secondaryIds[0])
      : null,
    zone.mainObjectId ? connectionZoneMemberRefField("Main", zone.mainObjectId, "main", actions) : null,
    ...secondaryIds.map((memberId, index) => connectionZoneMemberRefField(secondaryIds.length > 1 ? `Secondary ${index + 1}` : "Secondary", memberId, "secondary", actions))
  ].filter(Boolean);
  return {
    id: "inspector.properties.object.connectionZone.members",
    label: "Members",
    priority: -20,
    open: true,
    fields
  };
}

function connectionZoneMemberIds(zone) {
  return [zone.mainObjectId, ...arrayValues(zone.secondaryObjectIds)].filter(Boolean);
}

function connectionZoneConnectionSmartComponent(zone, actions = {}) {
  const instances = objectMap(actions.project?.model?.smartComponentInstances);
  return arrayValues(zone.smartComponentInstanceIds)
    .map((id) => instances[id])
    .find((instance) => instance?.kind === "connection") || null;
}

function connectionZoneCanSwapMembers(zone, linkedConnection = null) {
  const secondaryIds = arrayValues(zone.secondaryObjectIds);
  if (!linkedConnection?.id || !zone.mainObjectId || secondaryIds.length !== 1 || zone.mainObjectId === secondaryIds[0]) return false;
  if (linkedConnection.inputs?.memberSwapAllowed === false || linkedConnection.inputs?.allowMemberSwap === false) return false;
  return false;
}

function connectionZoneMemberSwapField(smartComponentId, mainMemberId, secondaryMemberId) {
  return {
    type: "actionRow",
    label: "Member actions",
    actions: [{
      label: "Swap",
      icon: "swap",
      title: "Swap Main and Secondary members",
      action: "smartComponent.member.swap",
      payload: {
        smartComponentId,
        mainMemberId,
        secondaryMemberId
      }
    }]
  };
}

function connectionZoneMemberRefField(label, memberId, status, actions = {}) {
  const entry = actions.objectIndex?.[memberId];
  const member = actions.project?.model?.members?.[memberId];
  const selectable = Boolean(entry?.collection);
  const displayValue = member ? connectionZoneMemberOptionLabel(member) : memberId;
  return {
    type: "objectRef",
    label,
    value: displayValue,
    status: displayValue !== memberId ? memberId : status,
    icon: entry ? inspectorObjectIconForEntry(entry) : null,
    className: "bc-smart-component-member-field",
    actions: objectRefActions({
      select: selectable ? { objectId: memberId } : null,
      value: displayValue
    })
  };
}

function connectionZoneMemberOptionLabel(member) {
  const mark = member.fabrication?.partMark || member.bim?.propertySets?.Identity?.mark || "";
  const name = member.bim?.name || "";
  const profile = member.profile || "";
  return [mark || member.id, name && name !== member.id && name !== mark ? name : "", profile].filter(Boolean).join(" - ");
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
