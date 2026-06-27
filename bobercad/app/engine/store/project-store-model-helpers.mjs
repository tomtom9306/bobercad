import {
  arrayValues,
  isPlainObject as plainObject,
  jsonClone as clone,
  truthyValues,
  uniqueTruthy as unique
} from "../core/model.mjs";
import {
  averageVec3,
  finiteInteger,
  finiteNonNegativeInteger,
  finiteNonNegativeNumber,
  finiteNumber,
  finitePositiveNumber,
  finiteVec3,
  v
} from "../core/math.mjs";
import { cleanId, removeProjectObjects } from "../api/project/objects.mjs";
import { TRIM_OPERATION_TYPES, trimJointOperations, trimJointParticipants, trimOperationMemberIds, trimOperationReferencePlaneIds, trimOperationUsesMemberEnd } from "../api/project/trim-operations.mjs";
import { memberCenter, memberPointAtEnd } from "../api/project/members.mjs";
import { reconcileObjectTrimRemovedRegionKeys, trimRegionSelectorMap } from "../api/model/trim-region-keys.mjs";

const REF_ARRAY_KEYS = new Set([
  "objectIds",
  "partIds",
  "memberIds",
  "plateIds",
  "featureIds",
  "holePatternIds",
  "objectPatternIds",
  "fastenerGroupIds",
  "weldIds",
  "interfaceIds",
  "connectionZoneIds",
  "childAssemblyIds",
  "smartComponentInstanceIds"
]);
export const FIT_EPSILON = 1e-6;
export function fail(message) {
  throw new Error(`project store: ${message}`);
}

export function nearestMemberEnd(member, point) {
  return v.len(v.sub(member.start, point)) <= v.len(v.sub(member.end, point)) ? "start" : "end";
}

export const vec3 = (value, label) => finiteVec3(value, label, fail);

export function requiredObject(value, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

export function optionalObject(value, label) {
  return value === undefined ? {} : requiredObject(value, label);
}

export function projectModel(project) {
  return requiredObject(requiredObject(project, "project").model, "project.model");
}

export function projectObjectIndex(project) {
  return requiredObject(requiredObject(project, "project").objectIndex, "project.objectIndex");
}

export function projectCollection(project, collection) {
  return requiredObject(projectModel(project)[collection], `project.model.${collection}`);
}

export function fastenerCatalogEntries(fasteners) {
  return requiredObject(requiredObject(fasteners, "fastener catalog").fasteners, "fastener catalog.fasteners");
}

export function optionalStringList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(`${label} must be an array of strings`);
  return value;
}

export function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

export function requiredStringList(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(`${label} must be an array of strings`);
  return value;
}

export function memberById(project, memberId) {
  const member = projectCollection(project, "members")[memberId];
  if (!member) fail(`member not found: ${memberId}`);
  return member;
}

export function featureById(project, featureId) {
  const feature = projectCollection(project, "features")[featureId];
  if (!feature) fail(`feature not found: ${featureId}`);
  return feature;
}

export function plateById(project, plateId) {
  const plate = projectCollection(project, "plates")[plateId];
  if (!plate) fail(`plate not found: ${plateId}`);
  return plate;
}

export function sketchById(project, sketchId) {
  const sketch = projectCollection(project, "sketches")[sketchId];
  if (!sketch) fail(`sketch not found: ${sketchId}`);
  return sketch;
}

export function referencePlaneById(project, referencePlaneId) {
  const referencePlane = projectCollection(project, "referencePlanes")[referencePlaneId];
  if (!referencePlane) fail(`reference plane not found: ${referencePlaneId}`);
  return referencePlane;
}

export function gridSystemById(project, gridSystemId) {
  const gridSystem = projectCollection(project, "gridSystems")[gridSystemId];
  if (!gridSystem) fail(`grid system not found: ${gridSystemId}`);
  return gridSystem;
}

export function levelById(project, levelId) {
  const level = projectCollection(project, "levels")[levelId];
  if (!level) fail(`level not found: ${levelId}`);
  return level;
}

export function workPointById(project, workPointId) {
  const workPoint = projectCollection(project, "workPoints")[workPointId];
  if (!workPoint) fail(`work point not found: ${workPointId}`);
  return workPoint;
}

export function holePatternById(project, holePatternId) {
  const holePattern = projectCollection(project, "holePatterns")[holePatternId];
  if (!holePattern) fail(`hole pattern not found: ${holePatternId}`);
  return holePattern;
}

export function groupById(project, groupId) {
  const group = projectCollection(project, "groups")[groupId];
  if (!group) fail(`group not found: ${groupId}`);
  return group;
}

export function assemblyById(project, assemblyId) {
  const assembly = projectCollection(project, "assemblies")[assemblyId];
  if (!assembly) fail(`assembly not found: ${assemblyId}`);
  return assembly;
}

export function objectPatternById(project, objectPatternId) {
  const objectPattern = projectCollection(project, "objectPatterns")[objectPatternId];
  if (!objectPattern) fail(`object pattern not found: ${objectPatternId}`);
  return objectPattern;
}

export function interfaceById(project, interfaceId) {
  const iface = projectCollection(project, "interfaces")[interfaceId];
  if (!iface) fail(`interface not found: ${interfaceId}`);
  return iface;
}

export function connectionZoneById(project, connectionZoneId) {
  const zone = projectCollection(project, "connectionZones")[connectionZoneId];
  if (!zone) fail(`connection zone not found: ${connectionZoneId}`);
  return zone;
}

export function trimJointById(project, trimJointId) {
  const trimJoint = projectCollection(project, "trimJoints")[trimJointId];
  if (!trimJoint) fail(`trim joint not found: ${trimJointId}`);
  return trimJoint;
}

export function fastenerGroupById(project, fastenerGroupId) {
  const fastenerGroup = projectCollection(project, "fastenerGroups")[fastenerGroupId];
  if (!fastenerGroup) fail(`fastener group not found: ${fastenerGroupId}`);
  return fastenerGroup;
}

export function weldById(project, weldId) {
  const weld = projectCollection(project, "welds")[weldId];
  if (!weld) fail(`weld not found: ${weldId}`);
  return weld;
}

export function assertOptionalNumber(value, label, valid, description) {
  if (value !== undefined && value !== null && !valid(value)) fail(`${label} must be ${description}`);
}

export function finiteVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [x, y] point`);
  }
  return [...value];
}

export function validateOptionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== "string") fail(`${label} must be a string`);
}

export function validateRequiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
}

export function validateReferencePlaneExtents(value, label) {
  if (value === undefined || value === null) return;
  const extents = requiredObject(value, label);
  const keys = ["xMin", "xMax", "yMin", "yMax"];
  for (const key of Object.keys(extents)) {
    if (!keys.includes(key)) fail(`${label}.${key} is not supported`);
  }
  for (const key of keys) {
    if (!finiteNumber(extents[key])) fail(`${label}.${key} must be a finite number`);
  }
  if (!finitePositiveNumber(extents.xMax - extents.xMin)) fail(`${label} must define positive x width`);
  if (!finitePositiveNumber(extents.yMax - extents.yMin)) fail(`${label} must define positive y height`);
}

export function validateInterfaceExtents(value, label) {
  if (value === undefined || value === null) return;
  const extents = requiredObject(value, label);
  const keys = ["width", "height", "length"];
  for (const key of Object.keys(extents)) {
    if (!keys.includes(key)) fail(`${label}.${key} is not supported`);
  }
  for (const key of keys) {
    const item = extents[key];
    if (item !== undefined && !finitePositiveNumber(item)) fail(`${label}.${key} must be a positive number`);
  }
}

export function validateOptionalVec3(value, label) {
  if (value !== undefined && value !== null) vec3(value, label);
}

export function validateOptionalNonZeroVec3(value, label) {
  if (value === undefined || value === null) return;
  const point = vec3(value, label);
  if (v.len(point) <= FIT_EPSILON) fail(`${label} cannot be zero length`);
}

export function validateWorkPointGridRefs(value, label) {
  if (value === undefined || value === null) return;
  const refs = requiredObject(value, label);
  for (const key of Object.keys(refs)) {
    if (!["gridSystemId", "xAxisId", "yAxisId", "levelId"].includes(key)) fail(`${label}.${key} is not supported`);
  }
  validateOptionalString(refs.gridSystemId, `${label}.gridSystemId`);
  validateOptionalString(refs.xAxisId, `${label}.xAxisId`);
  validateOptionalString(refs.yAxisId, `${label}.yAxisId`);
  validateOptionalString(refs.levelId, `${label}.levelId`);
}

export function validateGridAxis(axis, label) {
  const data = requiredObject(axis, label);
  validateRequiredString(data.id, `${label}.id`);
  validateRequiredString(data.label, `${label}.label`);
  if (!finiteNumber(data.position)) fail(`${label}.position must be a finite number`);
}

export function validateGridAxisGroup(axisGroup) {
  if (axisGroup !== "x" && axisGroup !== "y") fail(`grid axis group is unsupported: ${axisGroup}`);
  return axisGroup;
}

export function validateGridSystem(gridSystem) {
  validateRequiredString(gridSystem.type, "grid system type");
  validateOptionalString(gridSystem.name, "grid system name");
  vec3(gridSystem.origin, "grid system origin");
  const axisX = vec3(gridSystem.axisX, "grid system axis X");
  const axisY = vec3(gridSystem.axisY, "grid system axis Y");
  const axisZ = vec3(gridSystem.axisZ, "grid system axis Z");
  if (v.len(axisX) <= FIT_EPSILON) fail("grid system axis X cannot be zero length");
  if (v.len(axisY) <= FIT_EPSILON) fail("grid system axis Y cannot be zero length");
  if (v.len(axisZ) <= FIT_EPSILON) fail("grid system axis Z cannot be zero length");
  const axes = requiredObject(gridSystem.axes, "grid system axes");
  for (const axisGroup of ["x", "y"]) {
    if (!Array.isArray(axes[axisGroup])) fail(`grid system axes.${axisGroup} must be an array`);
    axes[axisGroup].forEach((axis, index) => validateGridAxis(axis, `grid system axes.${axisGroup}[${index}]`));
  }
  validateOptionalStringArray(gridSystem.levelIds, "grid system levelIds");
}

export function nextGridAxisId(gridSystem, axisGroup) {
  const group = validateGridAxisGroup(axisGroup);
  const existing = new Set(arrayValues(gridSystem.axes?.[group]).map((axis) => axis.id));
  const base = cleanId(`${gridSystem.id}_${group}`);
  let index = existing.size + 1;
  while (existing.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function defaultGridAxis(gridSystem, axisGroup, patch = {}) {
  const group = validateGridAxisGroup(axisGroup);
  const axes = arrayValues(gridSystem.axes?.[group]);
  const previous = axes[axes.length - 1];
  const fallbackStep = axes.length >= 2
    ? Math.abs(Number(axes[axes.length - 1].position || 0) - Number(axes[axes.length - 2].position || 0)) || 6000
    : 6000;
  const position = finiteNumber(patch.position)
    ? Number(patch.position)
    : Number(previous?.position || 0) + fallbackStep;
  const label = patch.label || (group === "x" ? String(axes.length + 1) : String.fromCharCode(65 + axes.length));
  return {
    id: patch.id || nextGridAxisId(gridSystem, group),
    label,
    position
  };
}

export function gridAxisIsReferenced(project, gridSystemId, axisGroup, axisId) {
  const refKey = axisGroup === "x" ? "xAxisId" : "yAxisId";
  return Object.values(projectCollection(project, "workPoints")).some((point) => (
    point.gridRefs?.gridSystemId === gridSystemId && point.gridRefs?.[refKey] === axisId
  ));
}

export function validateLevel(level) {
  validateRequiredString(level.type, "level type");
  validateOptionalString(level.name, "level name");
  if (!finiteNumber(level.elevation)) fail("level elevation must be a finite number");
}

export function validateWorkPoint(workPoint) {
  vec3(workPoint.point, "work point point");
  validateOptionalString(workPoint.type, "work point type");
  validateOptionalString(workPoint.role, "work point role");
  validateWorkPointGridRefs(workPoint.gridRefs, "work point gridRefs");
  validateOptionalString(workPoint.referencePlaneId, "work point reference plane");
  validateOptionalString(workPoint.notes, "work point notes");
}

export function validateReferencePlane(referencePlane) {
  vec3(referencePlane.origin, "reference plane origin");
  const normal = vec3(referencePlane.normal, "reference plane normal");
  const axisX = vec3(referencePlane.axisX, "reference plane axis X");
  const axisY = vec3(referencePlane.axisY, "reference plane axis Y");
  if (v.len(normal) <= FIT_EPSILON) fail("reference plane normal cannot be zero length");
  if (v.len(axisX) <= FIT_EPSILON) fail("reference plane axis X cannot be zero length");
  if (v.len(axisY) <= FIT_EPSILON) fail("reference plane axis Y cannot be zero length");
  validateOptionalString(referencePlane.type, "reference plane type");
  validateOptionalString(referencePlane.name, "reference plane name");
  validateOptionalString(referencePlane.notes, "reference plane notes");
  validateReferencePlaneExtents(referencePlane.extents, "reference plane extents");
}

export function validateHolePattern(holePattern) {
  if (!Array.isArray(holePattern.positions)) fail("hole pattern positions must be an array");
  if (!holePattern.positions.length) fail("hole pattern positions cannot be empty");
  holePattern.positions.forEach((position, index) => finiteVec2(position, `hole pattern position ${index + 1}`));
  validateOptionalString(holePattern.type, "hole pattern type");
  validateOptionalString(holePattern.holeType, "hole pattern hole type");
  assertOptionalNumber(holePattern.holeDiameter, "hole diameter", finitePositiveNumber, "a positive number");
  if (holePattern.suppressedPositionIndices !== undefined) {
    if (!Array.isArray(holePattern.suppressedPositionIndices) || holePattern.suppressedPositionIndices.some((index) => !finiteNonNegativeInteger(index))) {
      fail("hole pattern suppressed position indices must be non-negative integers");
    }
  }
}

export function validateOptionalStringArray(value, label) {
  if (value === undefined) return;
  requiredStringList(value, label);
}

export function validateOptionalTracking(tracking, label) {
  if (tracking === undefined || tracking === null) return;
  const value = requiredObject(tracking, label);
  validateOptionalString(value.projectTreeNodeId, `${label}.projectTreeNodeId`);
  validateOptionalString(value.phase, `${label}.phase`);
  validateOptionalString(value.lot, `${label}.lot`);
  validateOptionalString(value.status, `${label}.status`);
  if (value.shopOrSite !== undefined && value.shopOrSite !== "shop" && value.shopOrSite !== "site") fail(`${label}.shopOrSite must be shop or site`);
}

export function validateGroup(group) {
  validateRequiredString(group.type, "group type");
  validateRequiredString(group.name, "group name");
  requiredStringList(group.objectIds, "group object ids");
  validateOptionalString(group.projectTreeNodeId, "group project tree node");
  validateOptionalStringArray(group.memberIds, "group member ids");
  validateOptionalStringArray(group.partIds, "group part ids");
  validateOptionalStringArray(group.childGroupIds, "group child group ids");
}

export function validateAssembly(assembly) {
  validateRequiredString(assembly.type, "assembly type");
  validateRequiredString(assembly.name, "assembly name");
  validateOptionalString(assembly.mark, "assembly mark");
  if (assembly.parentAssemblyId !== null) validateOptionalString(assembly.parentAssemblyId, "assembly parent");
  validateOptionalString(assembly.mainPartId, "assembly main part");
  validateOptionalStringArray(assembly.childAssemblyIds, "assembly child assembly ids");
  validateOptionalStringArray(assembly.partIds, "assembly part ids");
  validateOptionalStringArray(assembly.memberIds, "assembly member ids");
  validateOptionalStringArray(assembly.plateIds, "assembly plate ids");
  validateOptionalStringArray(assembly.fastenerGroupIds, "assembly fastener group ids");
  validateOptionalStringArray(assembly.weldIds, "assembly weld ids");
  validateOptionalStringArray(assembly.connectionZoneIds, "assembly connection zone ids");
  validateOptionalStringArray(assembly.smartComponentInstanceIds, "assembly smart component ids");
  validateOptionalTracking(assembly.tracking, "assembly tracking");
}

const OBJECT_PATTERN_STATUSES = new Set(["linked", "partially-detached", "broken"]);
const OBJECT_PATTERN_TYPES = new Set(["linear-pattern", "rectangular-pattern", "circular-pattern", "path-pattern", "mirror-pattern"]);

export function validateObjectPatternTransform(transform) {
  if (transform === undefined || transform === null) return;
  const value = requiredObject(transform, "object pattern transform");
  validateOptionalString(value.kind, "object pattern transform kind");
  validateOptionalString(value.family, "object pattern transform family");
  if (value.direction !== undefined) vec3(value.direction, "object pattern transform direction");
  if (value.center !== undefined) vec3(value.center, "object pattern transform center");
  if (value.axis !== undefined) vec3(value.axis, "object pattern transform axis");
  if (value.rowDirection !== undefined) vec3(value.rowDirection, "object pattern transform row direction");
  assertOptionalNumber(value.spacing, "object pattern spacing", finiteNumber, "a finite number");
  assertOptionalNumber(value.angle, "object pattern angle", finiteNumber, "a finite number");
  if (value.count !== undefined && !finiteInteger(value.count)) fail("object pattern count must be an integer");
  if (value.rowCount !== undefined && !finiteInteger(value.rowCount)) fail("object pattern row count must be an integer");
}

export function validateObjectPattern(objectPattern) {
  if (!OBJECT_PATTERN_TYPES.has(objectPattern.type)) fail(`object pattern type is unsupported: ${objectPattern.type}`);
  if (!OBJECT_PATTERN_STATUSES.has(objectPattern.status)) fail(`object pattern status is unsupported: ${objectPattern.status}`);
  validateOptionalString(objectPattern.name, "object pattern name");
  validateOptionalString(objectPattern.notes, "object pattern notes");
  requiredStringList(objectPattern.generatedObjectIds, "object pattern generated object ids");
  validateOptionalStringArray(objectPattern.sourceObjectIds, "object pattern source object ids");
  validateOptionalStringArray(objectPattern.detachedObjectIds, "object pattern detached object ids");
  validateOptionalStringArray(objectPattern.deletedObjectIds, "object pattern deleted object ids");
  validateObjectPatternTransform(objectPattern.transform);
}

const INTERFACE_TYPES = new Set(["component-scope", "member-end-face", "member-web", "planar-face", "plate-face"]);

export function validateInterface(iface) {
  if (!INTERFACE_TYPES.has(iface.type)) fail(`interface type is unsupported: ${iface.type}`);
  validateRequiredString(iface.ownerId, "interface owner");
  validateOptionalString(iface.role, "interface role");
  validateOptionalString(iface.notes, "interface notes");
  validateOptionalString(iface.faceRef, "interface face");
  validateOptionalString(iface.stationReference, "interface station reference");
  if (iface.memberEnd !== undefined && iface.memberEnd !== "start" && iface.memberEnd !== "end") fail("interface member end must be start or end");
  assertOptionalNumber(iface.station, "interface station", finiteNumber, "a finite number");
  validateOptionalVec3(iface.origin, "interface origin");
  validateOptionalNonZeroVec3(iface.normal, "interface normal");
  validateOptionalNonZeroVec3(iface.localAxisY, "interface local axis Y");
  validateOptionalNonZeroVec3(iface.localAxisZ, "interface local axis Z");
  validateInterfaceExtents(iface.extents, "interface extents");
}

export function validateConnectionZone(zone) {
  validateRequiredString(zone.type, "connection zone type");
  validateOptionalString(zone.name, "connection zone name");
  validateRequiredString(zone.mainObjectId, "connection zone main object");
  validateOptionalString(zone.notes, "connection zone notes");
  if (!requiredStringList(zone.interfaceIds, "connection zone interface ids").length) fail("connection zone interface ids cannot be empty");
  validateOptionalStringArray(zone.secondaryObjectIds, "connection zone secondary object ids");
  validateOptionalStringArray(zone.objectIds, "connection zone object ids");
  validateOptionalStringArray(zone.smartComponentInstanceIds, "connection zone smart component ids");
  validateOptionalVec3(zone.origin, "connection zone origin");
}

export function validateFastenerGroup(fasteners, fastenerGroup) {
  if (fastenerGroup.fastenerRef && !fastenerCatalogEntries(fasteners)[fastenerGroup.fastenerRef]) fail(`fastener not found: ${fastenerGroup.fastenerRef}`);
  if (!Array.isArray(fastenerGroup.participants) || !fastenerGroup.participants.length) fail("fastener group participants cannot be empty");
  if (!fastenerGroup.through || typeof fastenerGroup.through !== "object" || Array.isArray(fastenerGroup.through)) fail("fastener group through must be an object");
  validateRequiredString(fastenerGroup.through.fromFeatureId, "fastener group through.fromFeatureId");
  validateOptionalString(fastenerGroup.through.toFeatureId, "fastener group through.toFeatureId");
  assertOptionalNumber(fastenerGroup.assembly?.length, "fastener length", finitePositiveNumber, "a positive number");
  assertOptionalNumber(fastenerGroup.assembly?.gripLength, "fastener grip length", finitePositiveNumber, "a positive number");
  assertOptionalNumber(fastenerGroup.assembly?.nutOffset, "fastener nut offset", finiteNonNegativeNumber, "a non-negative number");
}

export function validateWeld(weld) {
  if (!Array.isArray(weld.participants) || !weld.participants.length) fail("weld participants cannot be empty");
  assertOptionalNumber(weld.size, "weld size", finitePositiveNumber, "a positive number");
  if (weld.length !== "profile-perimeter") assertOptionalNumber(weld.length, "weld length", finitePositiveNumber, "a positive number or profile-perimeter");
}

export function trimJointReferencePoint(project, trimJoint) {
  const members = projectCollection(project, "members");
  const points = truthyValues(trimJointParticipants(trimJoint)
    .map((participant) => {
      const member = members[participant.memberId];
      if (!member) fail(`${trimJoint.id}: participant member not found: ${participant.memberId}`);
      if (participant.memberEnd !== "start" && participant.memberEnd !== "end") {
        fail(`${trimJoint.id}: participant ${participant.memberId} memberEnd must be start or end`);
      }
      return memberPointAtEnd(member, participant.memberEnd);
    }));
  return points.length ? averageVec3(points) : null;
}

export function defaultTrimJointParticipant(project, trimJoint, memberId, patch = {}) {
  const member = memberById(project, memberId);
  const referencePoint = trimJointReferencePoint(project, trimJoint) || memberCenter(member);
  return {
    memberId,
    memberEnd: nearestMemberEnd(member, referencePoint),
    ...clone(patch)
  };
}

const MITER_MODES = new Set(["equal-angle", "profile-balanced"]);

export function optionalTrimOperationType(value, label) {
  if (value === undefined) return undefined;
  if (!TRIM_OPERATION_TYPES.has(value)) fail(`${label} must be a supported trim operation type`);
  return value;
}

export function trimOperationTypeFromOptions(options, operationPatch) {
  if (operationPatch.type !== undefined) fail("operationPatch.type is not supported; use operationType");
  const operationType = optionalTrimOperationType(options.operationType, "operationType");
  if (operationType === undefined) fail("operationType is required");
  return operationType;
}

export function validateTrimRegionKeys(trimJointId, operation) {
  const planeIds = new Set(trimOperationReferencePlaneIds(operation));
  for (const regionKey of requiredStringList(operation.removedRegionKeys, `${trimJointId}.${operation.id || "operation"}.removedRegionKeys`)) {
    if (typeof regionKey !== "string" || !regionKey) fail("plane trim region key must be a non-empty string");
    const parts = regionKey.split("|");
    const selector = trimRegionSelectorMap(regionKey);
    if (selector.size !== parts.length) fail(`invalid or duplicate plane trim region key: ${regionKey}`);
    if (selector.size !== planeIds.size) fail(`${trimJointId}: plane trim region key must include every selected plane`);
    for (const planeId of selector.keys()) {
      if (!planeIds.has(planeId)) fail(`${trimJointId}: plane trim region references an unselected plane: ${planeId}`);
    }
  }
}

export function validateObjectTrimRegionKeys(trimJointId, operation) {
  try {
    reconcileObjectTrimRemovedRegionKeys(operation);
  } catch (error) {
    fail(`${trimJointId}: ${error.message}`);
  }
}

export function trimParticipantEnd(trimJoint, memberId, label) {
  const participant = trimJointParticipants(trimJoint).find((item) => item.memberId === memberId);
  if (!participant) fail(`${label} must reference a trim joint participant`);
  if (participant.memberEnd === "start" || participant.memberEnd === "end") return participant.memberEnd;
  fail(`${label} participant memberEnd must be start or end`);
}

export function normalizedOperationMemberEnd(trimJoint, operation, role) {
  const endKey = `${role}End`;
  const memberIdKey = `${role}Id`;
  const explicitEnd = operation[endKey];
  if (explicitEnd === "start" || explicitEnd === "end") return explicitEnd;
  if (explicitEnd !== undefined) fail(`${endKey} must be start or end`);
  return trimParticipantEnd(trimJoint, operation[memberIdKey], role);
}

export function rejectDefinedOperationFields(operation, fields, label) {
  for (const field of fields) {
    if (operation[field] !== undefined) fail(`${label}.${field} is not supported for ${operation.type}`);
  }
}

export function normalizedTrimJointOperation(trimJoint, operation) {
  const type = operation.type;
  if (!TRIM_OPERATION_TYPES.has(type)) fail(`unsupported trim operation type ${type}`);
  const next = { ...operation, type };
  if (type === "profile-cope") {
    next.memberAIds = trimOperationMemberIds(next, "memberA");
    next.memberBIds = trimOperationMemberIds(next, "memberB");
    next.memberAId = next.memberAIds[0];
    next.memberBId = next.memberBIds[0];
    next.removedRegionKeys = reconcileObjectTrimRemovedRegionKeys(next);
  } else {
    rejectDefinedOperationFields(next, ["memberAIds", "memberBIds"], next.id || "trim operation");
    delete next.memberAIds;
    delete next.memberBIds;
  }
  if (trimOperationUsesMemberEnd(type, "memberA")) next.memberAEnd = normalizedOperationMemberEnd(trimJoint, next, "memberA");
  else {
    if (type !== "plane-trim") rejectDefinedOperationFields(next, ["memberAEnd"], next.id || "trim operation");
    delete next.memberAEnd;
  }
  if (trimOperationUsesMemberEnd(type, "memberB")) next.memberBEnd = normalizedOperationMemberEnd(trimJoint, next, "memberB");
  else {
    rejectDefinedOperationFields(next, ["memberBEnd"], next.id || "trim operation");
    delete next.memberBEnd;
  }
  if (type === "plane-trim") {
    rejectDefinedOperationFields(next, ["memberBId", "memberBEnd", "referencePlaneId", "miterMode"], next.id || "trim operation");
    delete next.memberBId;
    delete next.memberBEnd;
    next.referencePlaneIds = unique(trimOperationReferencePlaneIds(next));
    if (next.removedRegionKeys === undefined) fail(`${next.id || "trim operation"}.removedRegionKeys is required for plane-trim`);
    next.removedRegionKeys = unique(requiredStringList(next.removedRegionKeys, `${next.id || "trim operation"}.removedRegionKeys`));
    delete next.referencePlaneId;
  } else {
    rejectDefinedOperationFields(next, ["referencePlaneId", "referencePlaneIds", ...(type === "profile-cope" ? [] : ["removedRegionKeys"])], next.id || "trim operation");
    delete next.referencePlaneId;
    delete next.referencePlaneIds;
    if (type !== "profile-cope") delete next.removedRegionKeys;
  }
  if (type !== "end-miter") {
    rejectDefinedOperationFields(next, ["miterMode"], next.id || "trim operation");
    delete next.miterMode;
  }
  if (type === "profile-cope" || type === "plane-trim") {
    if (next.allowExtension !== undefined && typeof next.allowExtension !== "boolean") {
      fail(`${next.id || "trim operation"}.allowExtension must be boolean`);
    }
  } else {
    rejectDefinedOperationFields(next, ["allowExtension"], next.id || "trim operation");
    delete next.allowExtension;
  }
  return next;
}

export function defaultTrimJointOperation(trimJoint, patch = {}) {
  if (!plainObject(patch)) fail("trim joint operation patch must be an object");
  const participants = trimJointParticipants(trimJoint);
  const memberAId = patch.memberAId === undefined ? participants[1]?.memberId ?? participants[0]?.memberId : patch.memberAId;
  const memberBId = patch.memberBId === undefined ? participants.find((participant) => participant.memberId !== memberAId)?.memberId : patch.memberBId;
  const existingIds = new Set(trimJointOperations(trimJoint).map((operation) => operation.id));
  let index = trimJointOperations(trimJoint).length + 1;
  let id = patch.id === undefined ? `end_butt_1_${index}` : patch.id;
  if (typeof id !== "string" || !id.trim()) fail("trim operation id must be a non-empty string");
  while (existingIds.has(id)) {
    index += 1;
    id = `end_butt_1_${index}`;
  }
  const type = optionalTrimOperationType(patch.type, "trim operation type");
  if (type === undefined) fail("trim operation type is required");
  return normalizedTrimJointOperation(trimJoint, {
    memberAId,
    memberBId,
    enabled: true,
    ...clone(patch),
    type,
    id
  });
}

export function trimJointHasParticipant(trimJoint, memberId) {
  return trimJointParticipants(trimJoint).some((participant) => participant.memberId === memberId);
}

export function ensureTrimJointParticipant(project, trimJoint, memberId) {
  if (trimJointHasParticipant(trimJoint, memberId)) return trimJoint;
  return {
    ...trimJoint,
    participants: [
      ...trimJointParticipants(trimJoint),
      defaultTrimJointParticipant(project, trimJoint, memberId)
    ]
  };
}

export function validateTrimJointOperation(project, trimJointId, trimJoint, operation) {
  const participantIds = new Set(trimJointParticipants(trimJoint).map((participant) => participant.memberId));
  if (!operation.memberAId) fail(`${trimJointId}: operation requires member A`);
  if (!participantIds.has(operation.memberAId)) fail(`${trimJointId}: operation member A must be a participant`);
  if (operation.allowExtension !== undefined) {
    if (operation.type !== "profile-cope" && operation.type !== "plane-trim") fail(`${trimJointId}: allowExtension is only valid for object trim operations`);
    if (typeof operation.allowExtension !== "boolean") fail(`${trimJointId}: allowExtension must be boolean`);
  }
  if (operation.type === "plane-trim") {
    const referencePlaneIds = trimOperationReferencePlaneIds(operation);
    if (!referencePlaneIds.length) {
      fail(`${trimJointId}: plane trim operation requires referencePlaneIds`);
    }
    for (const referencePlaneId of referencePlaneIds) referencePlaneById(project, referencePlaneId);
    if (!Array.isArray(operation.removedRegionKeys)) fail(`${trimJointId}: plane trim operation requires removedRegionKeys`);
    validateTrimRegionKeys(trimJointId, operation);
    return;
  }
  if (!operation.memberBId) fail(`${trimJointId}: operation requires member B`);
  if (!participantIds.has(operation.memberBId)) fail(`${trimJointId}: operation member B must be a participant`);
  if (operation.memberAId === operation.memberBId) fail(`${trimJointId}: operation members must be different`);
  if (operation.type === "profile-cope") {
    const memberAIds = trimOperationMemberIds(operation, "memberA");
    const memberBIds = trimOperationMemberIds(operation, "memberB");
    if (!memberAIds.length) fail(`${trimJointId}: profile-cope operation requires objects to trim`);
    if (!memberBIds.length) fail(`${trimJointId}: profile-cope operation requires cutting objects`);
    for (const memberId of memberAIds) {
      if (!participantIds.has(memberId)) fail(`${trimJointId}: profile-cope object to trim must be a participant: ${memberId}`);
    }
    for (const memberId of memberBIds) {
      if (!participantIds.has(memberId)) fail(`${trimJointId}: profile-cope cutting object must be a participant: ${memberId}`);
      if (memberAIds.includes(memberId)) fail(`${trimJointId}: profile-cope objects to trim and cutting objects must be different: ${memberId}`);
    }
    validateObjectTrimRegionKeys(trimJointId, operation);
  }
  if (operation.miterMode !== undefined && !MITER_MODES.has(operation.miterMode)) {
    fail(`${trimJointId}: unsupported miterMode ${operation.miterMode}`);
  }
  if (operation.miterMode !== undefined && operation.type !== "end-miter") {
    fail(`${trimJointId}: miterMode is only valid for end-miter operations`);
  }
}

export function removeObjects(project, objectIds) {
  const next = clone(project);
  return removeProjectObjects(next, objectIds, {
    shouldPruneArray: (key) => REF_ARRAY_KEYS.has(key)
  });
}

export function validateUpdatedModelObject(updated, objectId, label) {
  if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail(`${label} update must return an object`);
  if (updated.id !== objectId) fail(`${label} id cannot be changed`);
  return updated;
}

export function setIndexedModelObject(project, collection, objectId, object) {
  if (!object.type) fail(`${objectId}: indexed model object type is required`);
  projectCollection(project, collection)[objectId] = object;
  projectObjectIndex(project)[objectId] = {
    collection,
    type: object.type
  };
}

export function cloneProjectForModelCollection(project, collection) {
  return {
    ...project,
    objectIndex: { ...projectObjectIndex(project) },
    model: {
      ...projectModel(project),
      [collection]: { ...projectCollection(project, collection) }
    }
  };
}
