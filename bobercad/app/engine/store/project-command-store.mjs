import { arrayValues, flattenIds, isPlainObject as plainObject, jsonClone as clone, mergeObjectPatch as mergePatch, normalizedIndexList, objectById, truthyValues, uniqueTruthy as unique } from "../core/model.mjs";
import { averageVec3, finiteInteger, finiteNonNegativeNumber, finiteNumber, finitePositiveNumber, finiteVec3, v } from "../core/math.mjs";
import { requiredReferencePlane } from "../geometry/reference-plane.mjs";
import { resolveInterface } from "../geometry/member-geometry.mjs";
import { addIndexedObject, appendUniqueId, cleanId, nextObjectId, objectCollection, removeIndexedObject, removeProjectObjects } from "../api/project/objects.mjs";
import { projectProfileCatalog, requiredProfileById } from "../api/project/profiles.mjs";
import { createMemberObject } from "../api/project/member-factory.mjs";
import {
  addPlateSketchConstructionLine as addPlateSketchConstructionLineData,
  addPlate as addPlateObject,
  addSketch as addSketchObject,
  fixPlateSketchUnderDefinedEntities as fixPlateSketchUnderDefinedEntitiesData,
  inferPlateSketchRelations as inferPlateSketchRelationsData,
  plateFromSketchObject,
  profileFromSectionSketch,
  insertPlateSketchVertex as insertPlateSketchVertexData,
  notchPlateSketchCorner as notchPlateSketchCornerData,
  removePlateSketchFixedRelations as removePlateSketchFixedRelationsData,
  removePlateSketchRelation as removePlateSketchRelationData,
  removePlateBend as removePlateBendData,
  removePlateSketchVertex as removePlateSketchVertexData,
  setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData,
  setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData,
  setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData,
  setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData,
  setPlateSketchPointDistance as setPlateSketchPointDistanceData,
  setSketchVertex as setSketchVertexData,
  setPlateSketchEdgeLength as setPlateSketchEdgeLengthData,
  setPlateSketchVertex as setPlateSketchVertexData,
  setPlateSketchVertices as setPlateSketchVerticesData,
  solvePlateSketchRelation as solvePlateSketchRelationData,
  upsertPlateBend as upsertPlateBendData,
  upsertPlateSketchRelation as upsertPlateSketchRelationData
} from "../api/project/plate-sketch-relations-and-bends.mjs";
import { TRIM_OPERATION_TYPES, activeTrimJointOperations, trimJointOperations, trimJointParticipants, trimOperationReferencePlaneIds, trimOperationUsesMemberEnd } from "../api/project/trim-operations.mjs";
import {
  axisRelationFromSnap,
  memberAlignRelation,
  memberAxisRelations,
  relationUpsertKey
} from "../api/project/axis-relations.mjs";
import {
  affectedSmartComponentsForMember,
  affectedSmartComponentIdsForMember,
  smartComponentForObject as projectSmartComponentForObject,
  smartComponentObjectIds,
  smartComponentOwnedObjectIds,
  smartComponentReferencesObject,
  smartComponentRoot,
  smartComponentRootForObject as projectSmartComponentRootForObject,
  featureDependencyObjectIds as projectFeatureDependencyObjectIds,
  memberDependencyObjectIds as projectMemberDependencyObjectIds,
  referencePlaneDependencyObjectIds as projectReferencePlaneDependencyObjectIds,
  smartComponentConnectionZoneId,
  smartComponentSecondaryMemberId,
  trimJointDependencyObjectIds as projectTrimJointDependencyObjectIds
} from "../api/project/dependencies.mjs";
import {
  almostSamePoint as almostSamePointData,
  memberAxisData,
  memberCenter,
  memberPointAtEnd,
  moveMemberWithLayout as moveMemberWithLayoutData,
  setMemberLayoutEndpoint as setMemberLayoutEndpointData,
  setMemberPhysicalEndpoint as setMemberPhysicalEndpointData
} from "../api/project/members.mjs";
import {
  optionalPath,
  setPath
} from "../modules/smart-components/smart-component-parameters-and-definition.mjs";
import {
  smartComponentById,
  smartComponentRoleOptions as projectSmartComponentRoleOptions,
  smartComponentPlateOptions as projectSmartComponentPlateOptions,
  createProjectSmartComponentFromPreset,
  setSmartComponentPlateIncluded as setProjectSmartComponentPlateIncluded,
  updateSmartComponent,
  updateSmartComponents
} from "../modules/smart-components/smart-component-runtime.mjs";
import { smartComponentDefinition, supportedSmartComponentPresets, supportedSmartComponents } from "../modules/smart-components/smart-component-registry.mjs";
import { trimRegionSelectorMap } from "../api/model/trim-region-keys.mjs";

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
const FIT_EPSILON = 1e-6;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

function fail(message) {
  throw new Error(`project store: ${message}`);
}

function nearestMemberEnd(member, point) {
  return v.len(v.sub(member.start, point)) <= v.len(v.sub(member.end, point)) ? "start" : "end";
}

const vec3 = (value, label) => finiteVec3(value, label, fail);

function requiredObject(value, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function optionalObject(value, label) {
  return value === undefined ? {} : requiredObject(value, label);
}

function projectModel(project) {
  return requiredObject(requiredObject(project, "project").model, "project.model");
}

function projectObjectIndex(project) {
  return requiredObject(requiredObject(project, "project").objectIndex, "project.objectIndex");
}

function projectCollection(project, collection) {
  return requiredObject(projectModel(project)[collection], `project.model.${collection}`);
}

function fastenerCatalogEntries(fasteners) {
  return requiredObject(requiredObject(fasteners, "fastener catalog").fasteners, "fastener catalog.fasteners");
}

function optionalStringList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(`${label} must be an array of strings`);
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requiredStringList(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(`${label} must be an array of strings`);
  return value;
}

function memberById(project, memberId) {
  const member = projectCollection(project, "members")[memberId];
  if (!member) fail(`member not found: ${memberId}`);
  return member;
}

function featureById(project, featureId) {
  const feature = projectCollection(project, "features")[featureId];
  if (!feature) fail(`feature not found: ${featureId}`);
  return feature;
}

function plateById(project, plateId) {
  const plate = projectCollection(project, "plates")[plateId];
  if (!plate) fail(`plate not found: ${plateId}`);
  return plate;
}

function sketchById(project, sketchId) {
  const sketch = projectCollection(project, "sketches")[sketchId];
  if (!sketch) fail(`sketch not found: ${sketchId}`);
  return sketch;
}

function referencePlaneById(project, referencePlaneId) {
  const referencePlane = projectCollection(project, "referencePlanes")[referencePlaneId];
  if (!referencePlane) fail(`reference plane not found: ${referencePlaneId}`);
  return referencePlane;
}

function gridSystemById(project, gridSystemId) {
  const gridSystem = projectCollection(project, "gridSystems")[gridSystemId];
  if (!gridSystem) fail(`grid system not found: ${gridSystemId}`);
  return gridSystem;
}

function levelById(project, levelId) {
  const level = projectCollection(project, "levels")[levelId];
  if (!level) fail(`level not found: ${levelId}`);
  return level;
}

function workPointById(project, workPointId) {
  const workPoint = projectCollection(project, "workPoints")[workPointId];
  if (!workPoint) fail(`work point not found: ${workPointId}`);
  return workPoint;
}

function holePatternById(project, holePatternId) {
  const holePattern = projectCollection(project, "holePatterns")[holePatternId];
  if (!holePattern) fail(`hole pattern not found: ${holePatternId}`);
  return holePattern;
}

function groupById(project, groupId) {
  const group = projectCollection(project, "groups")[groupId];
  if (!group) fail(`group not found: ${groupId}`);
  return group;
}

function assemblyById(project, assemblyId) {
  const assembly = projectCollection(project, "assemblies")[assemblyId];
  if (!assembly) fail(`assembly not found: ${assemblyId}`);
  return assembly;
}

function objectPatternById(project, objectPatternId) {
  const objectPattern = projectCollection(project, "objectPatterns")[objectPatternId];
  if (!objectPattern) fail(`object pattern not found: ${objectPatternId}`);
  return objectPattern;
}

function interfaceById(project, interfaceId) {
  const iface = projectCollection(project, "interfaces")[interfaceId];
  if (!iface) fail(`interface not found: ${interfaceId}`);
  return iface;
}

function connectionZoneById(project, connectionZoneId) {
  const zone = projectCollection(project, "connectionZones")[connectionZoneId];
  if (!zone) fail(`connection zone not found: ${connectionZoneId}`);
  return zone;
}

function trimJointById(project, trimJointId) {
  const trimJoint = projectCollection(project, "trimJoints")[trimJointId];
  if (!trimJoint) fail(`trim joint not found: ${trimJointId}`);
  return trimJoint;
}

function fastenerGroupById(project, fastenerGroupId) {
  const fastenerGroup = projectCollection(project, "fastenerGroups")[fastenerGroupId];
  if (!fastenerGroup) fail(`fastener group not found: ${fastenerGroupId}`);
  return fastenerGroup;
}

function weldById(project, weldId) {
  const weld = projectCollection(project, "welds")[weldId];
  if (!weld) fail(`weld not found: ${weldId}`);
  return weld;
}

function assertOptionalNumber(value, label, valid, description) {
  if (value !== undefined && value !== null && !valid(value)) fail(`${label} must be ${description}`);
}

function finiteVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [x, y] point`);
  }
  return [...value];
}

function validateOptionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== "string") fail(`${label} must be a string`);
}

function validateRequiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
}

function validateReferencePlaneExtents(value, label) {
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

function validateInterfaceExtents(value, label) {
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

function validateOptionalVec3(value, label) {
  if (value !== undefined && value !== null) vec3(value, label);
}

function validateOptionalNonZeroVec3(value, label) {
  if (value === undefined || value === null) return;
  const point = vec3(value, label);
  if (v.len(point) <= FIT_EPSILON) fail(`${label} cannot be zero length`);
}

function validateWorkPointGridRefs(value, label) {
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

function validateGridAxis(axis, label) {
  const data = requiredObject(axis, label);
  validateRequiredString(data.id, `${label}.id`);
  validateRequiredString(data.label, `${label}.label`);
  if (!finiteNumber(data.position)) fail(`${label}.position must be a finite number`);
}

function validateGridSystem(gridSystem) {
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

function validateLevel(level) {
  validateRequiredString(level.type, "level type");
  validateOptionalString(level.name, "level name");
  if (!finiteNumber(level.elevation)) fail("level elevation must be a finite number");
}

function validateWorkPoint(workPoint) {
  vec3(workPoint.point, "work point point");
  validateOptionalString(workPoint.type, "work point type");
  validateOptionalString(workPoint.role, "work point role");
  validateWorkPointGridRefs(workPoint.gridRefs, "work point gridRefs");
  validateOptionalString(workPoint.referencePlaneId, "work point reference plane");
  validateOptionalString(workPoint.notes, "work point notes");
}

function validateReferencePlane(referencePlane) {
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

function validateHolePattern(holePattern) {
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

function validateOptionalStringArray(value, label) {
  if (value === undefined) return;
  requiredStringList(value, label);
}

function validateOptionalTracking(tracking, label) {
  if (tracking === undefined || tracking === null) return;
  const value = requiredObject(tracking, label);
  validateOptionalString(value.projectTreeNodeId, `${label}.projectTreeNodeId`);
  validateOptionalString(value.phase, `${label}.phase`);
  validateOptionalString(value.lot, `${label}.lot`);
  validateOptionalString(value.status, `${label}.status`);
  if (value.shopOrSite !== undefined && value.shopOrSite !== "shop" && value.shopOrSite !== "site") fail(`${label}.shopOrSite must be shop or site`);
}

function validateGroup(group) {
  validateRequiredString(group.type, "group type");
  validateRequiredString(group.name, "group name");
  requiredStringList(group.objectIds, "group object ids");
  validateOptionalString(group.projectTreeNodeId, "group project tree node");
  validateOptionalStringArray(group.memberIds, "group member ids");
  validateOptionalStringArray(group.partIds, "group part ids");
  validateOptionalStringArray(group.childGroupIds, "group child group ids");
}

function validateAssembly(assembly) {
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

function validateObjectPatternTransform(transform) {
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

function validateObjectPattern(objectPattern) {
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

function validateInterface(iface) {
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

function validateConnectionZone(zone) {
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

function validateFastenerGroup(fasteners, fastenerGroup) {
  if (fastenerGroup.fastenerRef && !fastenerCatalogEntries(fasteners)[fastenerGroup.fastenerRef]) fail(`fastener not found: ${fastenerGroup.fastenerRef}`);
  if (!Array.isArray(fastenerGroup.participants) || !fastenerGroup.participants.length) fail("fastener group participants cannot be empty");
  assertOptionalNumber(fastenerGroup.assembly?.length, "fastener length", finitePositiveNumber, "a positive number");
  assertOptionalNumber(fastenerGroup.assembly?.gripLength, "fastener grip length", finitePositiveNumber, "a positive number");
  assertOptionalNumber(fastenerGroup.assembly?.nutOffset, "fastener nut offset", finiteNonNegativeNumber, "a non-negative number");
}

function validateWeld(weld) {
  if (!Array.isArray(weld.participants) || !weld.participants.length) fail("weld participants cannot be empty");
  assertOptionalNumber(weld.size, "weld size", finitePositiveNumber, "a positive number");
  if (weld.length !== "profile-perimeter") assertOptionalNumber(weld.length, "weld length", finitePositiveNumber, "a positive number or profile-perimeter");
}

function trimJointReferencePoint(project, trimJoint) {
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

function defaultTrimJointParticipant(project, trimJoint, memberId, patch = {}) {
  const member = memberById(project, memberId);
  const referencePoint = trimJointReferencePoint(project, trimJoint) || memberCenter(member);
  return {
    memberId,
    memberEnd: nearestMemberEnd(member, referencePoint),
    ...clone(patch)
  };
}

const MITER_MODES = new Set(["equal-angle", "profile-balanced"]);

function optionalTrimOperationType(value, label) {
  if (value === undefined) return undefined;
  if (!TRIM_OPERATION_TYPES.has(value)) fail(`${label} must be a supported trim operation type`);
  return value;
}

function trimOperationTypeFromOptions(options, operationPatch) {
  if (operationPatch.type !== undefined) fail("operationPatch.type is not supported; use operationType");
  const operationType = optionalTrimOperationType(options.operationType, "operationType");
  if (operationType === undefined) fail("operationType is required");
  return operationType;
}

function validateTrimRegionKeys(trimJointId, operation) {
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

function trimParticipantEnd(trimJoint, memberId, label) {
  const participant = trimJointParticipants(trimJoint).find((item) => item.memberId === memberId);
  if (!participant) fail(`${label} must reference a trim joint participant`);
  if (participant.memberEnd === "start" || participant.memberEnd === "end") return participant.memberEnd;
  fail(`${label} participant memberEnd must be start or end`);
}

function normalizedOperationMemberEnd(trimJoint, operation, role) {
  const endKey = `${role}End`;
  const memberIdKey = `${role}Id`;
  const explicitEnd = operation[endKey];
  if (explicitEnd === "start" || explicitEnd === "end") return explicitEnd;
  if (explicitEnd !== undefined) fail(`${endKey} must be start or end`);
  return trimParticipantEnd(trimJoint, operation[memberIdKey], role);
}

function rejectDefinedOperationFields(operation, fields, label) {
  for (const field of fields) {
    if (operation[field] !== undefined) fail(`${label}.${field} is not supported for ${operation.type}`);
  }
}

function normalizedTrimJointOperation(trimJoint, operation) {
  const type = operation.type;
  if (!TRIM_OPERATION_TYPES.has(type)) fail(`unsupported trim operation type ${type}`);
  const next = { ...operation, type };
  if (trimOperationUsesMemberEnd(type, "memberA")) next.memberAEnd = normalizedOperationMemberEnd(trimJoint, next, "memberA");
  else {
    rejectDefinedOperationFields(next, ["memberAEnd"], next.id || "trim operation");
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
    rejectDefinedOperationFields(next, ["referencePlaneId", "referencePlaneIds", "removedRegionKeys"], next.id || "trim operation");
    delete next.referencePlaneId;
    delete next.referencePlaneIds;
    delete next.removedRegionKeys;
  }
  if (type !== "end-miter") {
    rejectDefinedOperationFields(next, ["miterMode"], next.id || "trim operation");
    delete next.miterMode;
  }
  return next;
}

function defaultTrimJointOperation(trimJoint, patch = {}) {
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

function trimJointHasParticipant(trimJoint, memberId) {
  return trimJointParticipants(trimJoint).some((participant) => participant.memberId === memberId);
}

function ensureTrimJointParticipant(project, trimJoint, memberId) {
  if (trimJointHasParticipant(trimJoint, memberId)) return trimJoint;
  return {
    ...trimJoint,
    participants: [
      ...trimJointParticipants(trimJoint),
      defaultTrimJointParticipant(project, trimJoint, memberId)
    ]
  };
}

function validateTrimJointOperation(project, trimJointId, trimJoint, operation) {
  const participantIds = new Set(trimJointParticipants(trimJoint).map((participant) => participant.memberId));
  if (!operation.memberAId) fail(`${trimJointId}: operation requires member A`);
  if (!participantIds.has(operation.memberAId)) fail(`${trimJointId}: operation member A must be a participant`);
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
  if (operation.miterMode !== undefined && !MITER_MODES.has(operation.miterMode)) {
    fail(`${trimJointId}: unsupported miterMode ${operation.miterMode}`);
  }
  if (operation.miterMode !== undefined && operation.type !== "end-miter") {
    fail(`${trimJointId}: miterMode is only valid for end-miter operations`);
  }
}

function removeObjects(project, objectIds) {
  const next = clone(project);
  return removeProjectObjects(next, objectIds, {
    shouldPruneArray: (key) => REF_ARRAY_KEYS.has(key)
  });
}

function validateUpdatedModelObject(updated, objectId, label) {
  if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail(`${label} update must return an object`);
  if (updated.id !== objectId) fail(`${label} id cannot be changed`);
  return updated;
}

function setIndexedModelObject(project, collection, objectId, object) {
  if (!object.type) fail(`${objectId}: indexed model object type is required`);
  projectCollection(project, collection)[objectId] = object;
  projectObjectIndex(project)[objectId] = {
    collection,
    type: object.type
  };
}

function cloneProjectForModelCollection(project, collection) {
  return {
    ...project,
    objectIndex: { ...projectObjectIndex(project) },
    model: {
      ...projectModel(project),
      [collection]: { ...projectCollection(project, collection) }
    }
  };
}

function isSmartComponentGeneratedHelper(object, smartComponentId) {
  return object?.authoring?.componentInstanceId === smartComponentId && object.authoring?.lifecycle === "delete-with-smart-component";
}

function smartComponentGeneratedHelperIds(project, smartComponent) {
  const ids = [];
  const zoneId = smartComponentConnectionZoneId(smartComponent);
  const assemblyId = smartComponentAssemblyId(smartComponent);
  const zone = zoneId ? projectCollection(project, "connectionZones")[zoneId] : null;
  if (zoneId && !zone) fail(`${smartComponent.id}: connection zone not found: ${zoneId}`);
  if (isSmartComponentGeneratedHelper(zone, smartComponent.id)) ids.push(zone.id);
  const interfaceIds = zone ? requiredStringList(zone.interfaceIds, `${zoneId}.interfaceIds`) : [];
  for (const interfaceId of interfaceIds) {
    const iface = projectCollection(project, "interfaces")[interfaceId];
    if (!iface) fail(`${smartComponent.id}: generated helper interface not found: ${interfaceId}`);
    if (isSmartComponentGeneratedHelper(iface, smartComponent.id)) ids.push(interfaceId);
  }
  if (assemblyId) {
    const assembly = projectCollection(project, "assemblies")[assemblyId];
    if (!assembly) fail(`${smartComponent.id}: assembly not found: ${assemblyId}`);
    if (isSmartComponentGeneratedHelper(assembly, smartComponent.id)) ids.push(assemblyId);
  }
  return unique(ids);
}

function smartComponentRoleForObject(smartComponent, objectId) {
  for (const [role, value] of Object.entries(requiredObject(smartComponent.objectRoles, `${smartComponent.id}.objectRoles`))) {
    if (flattenIds(value).includes(objectId)) return role;
  }
  return null;
}

function smartComponentManagingObject(project, objectId) {
  const collection = objectCollection(project, objectId);
  const object = collection ? projectCollection(project, collection)[objectId] : null;
  const instanceId = object?.authoring?.componentInstanceId;
  if (!instanceId || !["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return null;
  const instance = projectCollection(project, "smartComponentInstances")[instanceId];
  if (!instance) fail(`${objectId}: managed smart component not found: ${instanceId}`);
  if (!smartComponentOwnedObjectIds(instance).includes(objectId)) return null;
  return instance;
}

function changedObjectPatch(before, after) {
  before = requiredObject(before, "previous managed object");
  after = requiredObject(after, "updated managed object");
  const patch = {};
  for (const [key, value] of Object.entries(after)) {
    if (["id", "type", "authoring"].includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) patch[key] = clone(value);
  }
  return patch;
}

function recordSmartComponentFieldOverride(project, beforeObject, afterObject) {
  afterObject = requiredObject(afterObject, "updated managed object");
  const instance = smartComponentManagingObject(project, afterObject.id);
  if (!instance) return;
  const patch = changedObjectPatch(beforeObject, afterObject);
  if (!Object.keys(patch).length) return;
  const fieldOverrides = requiredObject(instance.fieldOverrides, `${instance.id}.fieldOverrides`);
  const managedFields = requiredObject(instance.managedFields, `${instance.id}.managedFields`);
  const existingOverride = fieldOverrides[afterObject.id] === undefined
    ? {}
    : requiredObject(fieldOverrides[afterObject.id], `${instance.id}.fieldOverrides.${afterObject.id}`);
  fieldOverrides[afterObject.id] = mergePatch(existingOverride, patch);
  managedFields[afterObject.id] = unique([
    ...optionalStringList(managedFields[afterObject.id], `${instance.id}.managedFields.${afterObject.id}`),
    ...Object.keys(fieldOverrides[afterObject.id])
  ]);
}

function appendMemberToDefaultGroup(project, memberId) {
  const group = Object.values(projectCollection(project, "groups")).find((item) => item.type === "member-group");
  if (!group) return;
  if (group.memberIds !== undefined) group.memberIds = appendUniqueId(group.memberIds, memberId);
  group.objectIds = appendUniqueId(group.objectIds, memberId);
}

function upsertRelationObject(project, relation) {
  if (!relation?.id) fail("relation id is required");
  if (!relation.memberId) fail(`${relation.id}: relation memberId is required`);
  const members = projectCollection(project, "members");
  const relations = projectCollection(project, "relations");
  if (!members[relation.memberId]) fail(`${relation.id}: relation member not found: ${relation.memberId}`);
  const objectIndex = projectObjectIndex(project);
  const key = relationUpsertKey(relation);
  for (const existing of Object.values(relations)) {
    if (existing.id !== relation.id && relationUpsertKey(existing) === key) removeIndexedObject(project, existing.id);
  }
  const existingCollection = objectCollection(project, relation.id);
  if (existingCollection && existingCollection !== "relations") fail(`${relation.id}: relation id already used by ${existingCollection}`);
  relations[relation.id] = clone(relation);
  objectIndex[relation.id] = { collection: "relations", type: relation.type };
  return relations[relation.id];
}

function addMemberSnapRelations(project, memberId, options = {}) {
  if (options.autoAxisRelations === false) return;
  for (const [endpoint, snap] of [["start", options.startSnap], ["end", options.endSnap]]) {
    const relation = axisRelationFromSnap(memberId, endpoint, snap, { createdBy: "auto-snap" });
    if (relation) upsertRelationObject(project, relation);
  }
}

function setIndexIncluded(values, index, included) {
  const current = new Set(normalizedIndexList(values));
  if (included) current.delete(index);
  else current.add(index);
  return [...current].sort((a, b) => a - b);
}

function setRoleInList(list, role, active) {
  const current = new Set(requiredStringList(list, "suppressedRoles"));
  if (active) current.add(role);
  else current.delete(role);
  return [...current].sort();
}

function smartComponentAssemblyId(instance) {
  const inputs = requiredObject(instance.inputs, `${instance.id}.inputs`);
  if (inputs.assemblyId === undefined) return null;
  if (typeof inputs.assemblyId !== "string" || !inputs.assemblyId) fail(`${instance.id}.inputs.assemblyId must be a non-empty string`);
  return inputs.assemblyId;
}

function componentFromFace(project, face) {
  if (!face?.objectId) return null;
  const smartComponent = Object.values(projectCollection(project, "smartComponentInstances")).find((item) => smartComponentReferencesObject(item, face.objectId));
  if (!smartComponent) return null;
  const collection = objectCollection(project, face.objectId);
  if (!collection) fail(`component face object not found: ${face.objectId}`);

  const objectRole = smartComponentRoleForObject(smartComponent, face.objectId);
  if (collection === "fastenerGroups" && finiteInteger(face.positionIndex)) {
    const fastenerGroup = projectCollection(project, "fastenerGroups")[face.objectId];
    if (!fastenerGroup) fail(`fastener group not found: ${face.objectId}`);
    const patternRole = fastenerGroup.holePatternRef ? smartComponentRoleForObject(smartComponent, fastenerGroup.holePatternRef) : null;
    if (patternRole) {
      return {
        kind: "pattern-position",
        smartComponentId: smartComponent.id,
        objectId: face.objectId,
        objectRole,
        patternRole,
        positionIndex: face.positionIndex
      };
    }
  }

  if (!objectRole) return null;
  return {
    kind: "object-role",
    smartComponentId: smartComponent.id,
    objectId: face.objectId,
    objectRole
  };
}

function memberDirectionFromInterface(project, iface) {
  if (!iface?.memberEnd) return null;
  if (iface.memberEnd !== "start" && iface.memberEnd !== "end") fail(`${iface.id}: memberEnd must be start or end`);
  const entry = projectObjectIndex(project)[iface.ownerId];
  if (!entry) fail(`${iface.id}: member-end interface owner is not indexed: ${iface.ownerId}`);
  if (entry.collection !== "members") fail(`${iface.id}: member-end interface owner must be a member`);
  const member = memberById(project, iface.ownerId);
  const axis = memberAxisData(member);
  if (!axis || axis.length <= FIT_EPSILON) fail(`${iface.id}: member axis is invalid`);
  return iface.memberEnd === "end" ? v.mul(axis.direction, -1) : axis.direction;
}

function interfaceReferencePoint(project, profiles, zone, interfaceId) {
  const otherId = requiredStringList(zone.interfaceIds, `${zone.id}.interfaceIds`).find((id) => id !== interfaceId);
  if (!otherId) fail(`${zone.id}: connection interface ${interfaceId} has no paired reference interface`);
  const resolved = resolveInterface(project, profiles, otherId);
  const direction = memberDirectionFromInterface(project, resolved);
  return direction ? v.add(resolved.origin, v.mul(direction, 10)) : resolved.origin;
}

function lockSmartComponentZoneFaces(project, profiles, smartComponentId, options = {}) {
  const next = options.inPlace ? project : clone(project);
  const smartComponent = smartComponentById(next, smartComponentId);
  const zoneId = smartComponentConnectionZoneId(smartComponent);
  if (!zoneId) return next;
  const zone = projectCollection(next, "connectionZones")[zoneId];
  if (!zone) fail(`${smartComponentId}: connection zone not found: ${zoneId}`);

  const interfaces = projectCollection(next, "interfaces");
  for (const interfaceId of requiredStringList(zone.interfaceIds, `${zone.id}.interfaceIds`)) {
    const iface = interfaces[interfaceId];
    if (!iface) fail(`${smartComponentId}: connection interface not found: ${interfaceId}`);
    if (iface.faceRef !== "connection-secondary-facing-section-face") continue;
    const referencePoint = interfaceReferencePoint(next, profiles, zone, interfaceId);
    const resolved = resolveInterface(next, profiles, interfaceId, { referencePoint, preferReferencePoint: true });
    if (!resolved.faceRef || resolved.faceRef === iface.faceRef) continue;
    interfaces[interfaceId] = {
      ...iface,
      faceRef: resolved.faceRef,
      semanticIntent: {
        ...optionalObject(iface.semanticIntent, `${iface.id}.semanticIntent`),
        sourceFaceRef: iface.faceRef
      }
    };
  }
  return next;
}

function roundedDimension(value) {
  return Math.round(value * 1000) / 1000;
}

export function createProjectStore({ project, profiles, smartComponentCatalog, fasteners, materials, cloneOnLoad = true }) {
  const initialProject = cloneOnLoad ? clone(project) : project;
  const profilesFor = (projectState) => projectProfileCatalog(projectState, profiles);
  let currentProject = initialProject;
  const subscribers = new Set();

  const definitionFor = (projectState, smartComponentId) => smartComponentDefinition(smartComponentCatalog, smartComponentById(projectState, smartComponentId));
  const emit = () => {
    for (const subscriber of subscribers) subscriber(currentProject);
  };
  const setProject = (nextProject) => {
    currentProject = nextProject;
    emit();
    return currentProject;
  };
  const smartComponentUpdateContext = (projectState) => ({
    project: projectState,
    profiles: profilesFor(projectState),
    catalog: smartComponentCatalog,
    fasteners,
    materials
  });
  const regenerateSmartComponent = (projectState, smartComponentId) => updateSmartComponent({
    ...smartComponentUpdateContext(projectState),
    definition: definitionFor(projectState, smartComponentId),
    instanceId: smartComponentId,
    parameters: smartComponentById(projectState, smartComponentId).referenceParameters
  });
  const updateSmartComponentParameters = (projectState, smartComponentId, parameters) => updateSmartComponent({
    ...smartComponentUpdateContext(projectState),
    definition: definitionFor(projectState, smartComponentId),
    instanceId: smartComponentId,
    parameters
  });
  const regenerateMemberSmartComponents = (projectState, memberId) => {
    const smartComponentIds = affectedSmartComponentsForMember(projectState, memberId)
      .filter((smartComponent) => smartComponent.status === "generated")
      .map((smartComponent) => smartComponent.id);
    if (!smartComponentIds.length) return projectState;
    return updateSmartComponents({
      ...smartComponentUpdateContext(projectState),
      definitionFor,
      instanceIds: smartComponentIds,
      parametersFor: (state, smartComponentId) => smartComponentById(state, smartComponentId).referenceParameters
    });
  };
  const regenerateSmartComponentsBatch = (projectState, smartComponentIds) => {
    const instances = projectCollection(projectState, "smartComponentInstances");
    const ids = requiredStringList(smartComponentIds, "smart component id batch");
    for (const smartComponentId of ids) {
      if (!instances[smartComponentId]) fail(`smart component not found: ${smartComponentId}`);
    }
    if (!ids.length) return projectState;
    return updateSmartComponents({
      ...smartComponentUpdateContext(projectState),
      definitionFor,
      instanceIds: ids
    });
  };
  const generatedSmartComponentIds = (projectState) => Object.values(projectCollection(projectState, "smartComponentInstances"))
    .filter((smartComponent) => smartComponent.status === "generated")
    .map((smartComponent) => smartComponent.id);
  const secondaryInterface = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const definition = definitionFor(projectState, smartComponentId);
    const secondaryIndex = definition.interfaces.findIndex((entry) => entry.role === "secondary");
    if (secondaryIndex < 0) fail(`${smartComponentId}: definition has no secondary interface`);
    const zoneId = smartComponentConnectionZoneId(smartComponent);
    if (!zoneId) fail(`${smartComponentId}: connection zone id is required`);
    const zone = projectCollection(projectState, "connectionZones")[zoneId];
    if (!zone) fail(`${smartComponentId}: connection zone not found: ${zoneId}`);
    const interfaceId = requiredStringList(zone.interfaceIds, `${zoneId}.interfaceIds`)[secondaryIndex];
    if (!interfaceId) fail(`${smartComponentId}: connection zone missing secondary interface`);
    return projectCollection(projectState, "interfaces")[interfaceId] || fail(`${smartComponentId}: secondary interface not found: ${interfaceId}`);
  };
  const memberTrimJoint = (projectState, smartComponent) => {
    const roleId = requiredObject(smartComponent.objectRoles, `${smartComponent.id}.objectRoles`).beamTrim;
    if (roleId === undefined) return null;
    if (typeof roleId !== "string" || !roleId) fail(`${smartComponent.id}.objectRoles.beamTrim must be an id`);
    const trimJoints = projectCollection(projectState, "trimJoints");
    const trimJoint = trimJoints[roleId];
    if (!trimJoint) fail(`${smartComponent.id}.objectRoles.beamTrim not found: ${roleId}`);
    if (trimJoint.type !== "member-trim") fail(`${roleId}: beamTrim role must reference a member-trim`);
    return trimJoint;
  };
  const markSmartComponentError = (projectState, smartComponentId, code, message, objectRoles = []) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const diagnostics = requiredArray(smartComponent.diagnostics, `${smartComponentId}.diagnostics`);
    Object.assign(smartComponent, {
      health: "error",
      diagnostics: diagnostics.some((entry) => entry.code === code)
        ? diagnostics
        : [...diagnostics, { severity: "error", code, message, objectRoles }]
    });
    for (const id of smartComponentOwnedObjectIds(smartComponent)) {
      for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
        const object = projectCollection(projectState, collection)[id];
        if (object) object.display = { ...optionalObject(object.display, `${id}.display`), ...DIAGNOSTIC_DISPLAY };
      }
    }
  };
  const fitMemberEndToTrimPlane = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const trimJoint = memberTrimJoint(projectState, smartComponent);
    const secondaryMemberId = smartComponentSecondaryMemberId(smartComponent);
    if (!trimJoint) return false;
    const operation = activeTrimJointOperations(trimJoint).find((item) => item.type === "plane-trim" && item.memberAId === secondaryMemberId);
    if (!operation) return false;
    const referencePlaneIds = trimOperationReferencePlaneIds(operation);
    if (referencePlaneIds.length !== 1) {
      markSmartComponentError(projectState, smartComponentId, "beam-trim-plane-count", "Generated member trim requires exactly one trim plane.", ["beamTrim"]);
      return false;
    }
    const iface = secondaryInterface(projectState, smartComponentId);
    const memberEnd = iface.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") fail(`${iface.id}: secondary interface memberEnd must be start or end`);

    const member = projectCollection(projectState, "members")[secondaryMemberId];
    if (!member) fail(`${smartComponentId}: secondary member not found: ${secondaryMemberId}`);
    const plane = requiredReferencePlane(projectState, referencePlaneIds[0], `${trimJoint.id}:${operation.id}`, fail);
    const normal = v.norm(vec3(plane.normal, `${trimJoint.id}.${operation.id}.referencePlane.normal`));
    const origin = vec3(plane.origin, `${trimJoint.id}.${operation.id}.referencePlane.origin`);
    const axis = memberAxisData(member);
    if (!axis) fail(`${smartComponentId}: secondary member axis is invalid`);
    const axisVector = v.mul(axis.direction, axis.length);
    const denominator = v.dot(normal, axisVector);
    if (Math.abs(denominator) <= FIT_EPSILON) {
      markSmartComponentError(projectState, smartComponentId, "member-axis-parallel-to-trim-plane", "Secondary member axis does not intersect the trim plane.", ["beamTrim"]);
      return false;
    }

    const t = v.dot(normal, v.sub(origin, axis.start)) / denominator;
    const fittedPoint = v.add(axis.start, v.mul(axisVector, t));
    if (memberEnd === "start") {
      if (almostSamePointData(member.start, fittedPoint, FIT_EPSILON)) return false;
      member.start = fittedPoint;
      return true;
    }
    if (almostSamePointData(member.end, fittedPoint, FIT_EPSILON)) return false;
    member.end = fittedPoint;
    return true;
  };
  const reconcileGeneratedSmartComponents = (projectState, iterations = 4) => {
    let next = projectState;
    const ids = generatedSmartComponentIds(next);
    for (let index = 0; index < iterations; index += 1) {
      next = regenerateSmartComponentsBatch(next, ids);
      let changed = false;
      for (const smartComponentId of ids) {
        if (!projectCollection(next, "smartComponentInstances")[smartComponentId]) fail(`smart component not found after regeneration: ${smartComponentId}`);
        changed = fitMemberEndToTrimPlane(next, smartComponentId) || changed;
      }
      if (!changed) return next;
    }
    return regenerateSmartComponentsBatch(next, ids);
  };
  const setRegeneratedSmartComponent = (projectState, smartComponentId) => setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(projectState, smartComponentId)));
  const updateRegeneratedSmartComponent = (smartComponentId, update) => {
    const next = clone(currentProject);
    const smartComponent = smartComponentById(next, smartComponentId);
    const updated = update(next, smartComponent);
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("smart component update must return a project object");
    return setRegeneratedSmartComponent(updated, smartComponentId);
  };
  const applyResolveHint = (parameters, hint) => {
    if (!plainObject(hint)) fail("resolve hint must be an object");
    if (typeof hint.path !== "string" || !hint.path) fail("resolve hint path must be a non-empty string");
    if (!finiteNumber(hint.value)) fail(`${hint.path}: resolve hint value must be finite`);
    if (hint.mode !== "max" && hint.mode !== "min" && hint.mode !== "set") fail(`${hint.path}: unsupported resolve hint mode ${hint.mode || "missing"}`);
    const current = optionalPath(parameters, hint.path);
    if (!finiteNumber(current)) fail(`${hint.path}: resolved parameter must be finite`);
    const value = roundedDimension(hint.value);
    if (value <= 0) fail(`${hint.path}: resolve hint value must be positive`);
    if (hint.mode === "max" && current > value) {
      setPath(parameters, hint.path, value);
      return true;
    }
    if (hint.mode === "min" && current < value) {
      setPath(parameters, hint.path, value);
      return true;
    }
    if (hint.mode === "set" && Math.abs(current - value) > FIT_EPSILON) {
      setPath(parameters, hint.path, value);
      return true;
    }
    return false;
  };
  const resolveSmartComponentDiagnostics = (smartComponentId) => {
    let next = currentProject;
    let changed = false;
    for (let index = 0; index < 4; index += 1) {
      const smartComponent = smartComponentById(next, smartComponentId);
      const diagnostics = arrayValues(smartComponent.diagnostics);
      const parameters = clone(smartComponent.referenceParameters);
      let iterationChanged = false;
      for (const diagnostic of diagnostics) {
        const resolveHints = diagnostic.resolve === undefined ? [] : diagnostic.resolve;
        if (!Array.isArray(resolveHints)) fail(`${diagnostic.code || "diagnostic"}.resolve must be an array`);
        for (const hint of resolveHints) {
          iterationChanged = applyResolveHint(parameters, hint) || iterationChanged;
        }
      }
      if (!iterationChanged) break;
      next = reconcileGeneratedSmartComponents(updateSmartComponentParameters(next, smartComponentId, parameters));
      changed = true;
      if (!arrayValues(smartComponentById(next, smartComponentId).diagnostics).length) break;
    }
    if (!changed) fail(`${smartComponentId}: no automatic resolver is available for current diagnostics`);
    return setProject(next);
  };
  const replaceMember = (memberId, update, options = {}) => {
    const next = cloneProjectForModelCollection(currentProject, "members");
    const member = memberById(next, memberId);
    const updated = update(member);
    next.model.members[memberId] = updated;
    recordSmartComponentFieldOverride(next, member, updated);
    if (options.regenerateSmartComponents === false) return setProject(next);
    return setProject(regenerateMemberSmartComponents(next, memberId));
  };
  const replaceFeature = (featureId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "features");
    const feature = featureById(next, featureId);
    const updated = validateUpdatedModelObject(update(feature), featureId, "feature");
    if (updated.ownerId !== feature.ownerId) fail("feature owner cannot be changed");
    if (updated.type !== feature.type) fail("feature type cannot be changed");
    setIndexedModelObject(next, "features", featureId, updated);
    return setProject(next);
  };
  const replaceClonedIndexedObject = (collection, objectId, read, update, label) => {
    const next = clone(currentProject);
    const object = read(next, objectId);
    const updated = validateUpdatedModelObject(update(clone(object)), objectId, label);
    if (updated.type !== object.type) fail(`${label} type cannot be changed`);
    setIndexedModelObject(next, collection, objectId, updated);
    return setProject(next);
  };
  const replacePlate = (plateId, update) => replaceClonedIndexedObject("plates", plateId, plateById, update, "plate");
  const replaceSketch = (sketchId, update) => replaceClonedIndexedObject("sketches", sketchId, sketchById, update, "sketch");
  const replaceGridSystem = (gridSystemId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "gridSystems");
    const gridSystem = gridSystemById(next, gridSystemId);
    const updated = validateUpdatedModelObject(update(gridSystem), gridSystemId, "grid system");
    if (updated.type !== gridSystem.type) fail("grid system type cannot be changed");
    validateGridSystem(updated);
    setIndexedModelObject(next, "gridSystems", gridSystemId, updated);
    return setProject(next);
  };
  const replaceLevel = (levelId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "levels");
    const level = levelById(next, levelId);
    const updated = validateUpdatedModelObject(update(level), levelId, "level");
    if (updated.type !== level.type) fail("level type cannot be changed");
    validateLevel(updated);
    setIndexedModelObject(next, "levels", levelId, updated);
    return setProject(next);
  };
  const replaceWorkPoint = (workPointId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "workPoints");
    const workPoint = workPointById(next, workPointId);
    const updated = validateUpdatedModelObject(update(workPoint), workPointId, "work point");
    if (updated.type !== workPoint.type) fail("work point type cannot be changed");
    validateWorkPoint(updated);
    setIndexedModelObject(next, "workPoints", workPointId, updated);
    return setProject(next);
  };
  const replaceReferencePlane = (referencePlaneId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "referencePlanes");
    const plane = referencePlaneById(next, referencePlaneId);
    const updated = validateUpdatedModelObject(update(plane), referencePlaneId, "reference plane");
    if (updated.type !== plane.type) fail("reference plane type cannot be changed");
    validateReferencePlane(updated);
    setIndexedModelObject(next, "referencePlanes", referencePlaneId, updated);
    return setProject(next);
  };
  const replaceHolePattern = (holePatternId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "holePatterns");
    const holePattern = holePatternById(next, holePatternId);
    const updated = validateUpdatedModelObject(update(holePattern), holePatternId, "hole pattern");
    if (updated.type !== holePattern.type) fail("hole pattern type cannot be changed");
    validateHolePattern(updated);
    setIndexedModelObject(next, "holePatterns", holePatternId, updated);
    return setProject(next);
  };
  const replaceGroup = (groupId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "groups");
    const group = groupById(next, groupId);
    const updated = validateUpdatedModelObject(update(group), groupId, "group");
    if (updated.type !== group.type) fail("group type cannot be changed");
    validateGroup(updated);
    setIndexedModelObject(next, "groups", groupId, updated);
    return setProject(next);
  };
  const replaceAssembly = (assemblyId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "assemblies");
    const assembly = assemblyById(next, assemblyId);
    const updated = validateUpdatedModelObject(update(assembly), assemblyId, "assembly");
    if (updated.type !== assembly.type) fail("assembly type cannot be changed");
    validateAssembly(updated);
    setIndexedModelObject(next, "assemblies", assemblyId, updated);
    return setProject(next);
  };
  const replaceObjectPattern = (objectPatternId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "objectPatterns");
    const objectPattern = objectPatternById(next, objectPatternId);
    const updated = validateUpdatedModelObject(update(objectPattern), objectPatternId, "object pattern");
    if (updated.type !== objectPattern.type) fail("object pattern type cannot be changed");
    validateObjectPattern(updated);
    setIndexedModelObject(next, "objectPatterns", objectPatternId, updated);
    return setProject(next);
  };
  const replaceInterface = (interfaceId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "interfaces");
    const iface = interfaceById(next, interfaceId);
    const updated = validateUpdatedModelObject(update(iface), interfaceId, "interface");
    if (updated.type !== iface.type) fail("interface type cannot be changed");
    if (updated.ownerId !== iface.ownerId) fail("interface owner cannot be changed");
    validateInterface(updated);
    setIndexedModelObject(next, "interfaces", interfaceId, updated);
    return setProject(next);
  };
  const replaceConnectionZone = (connectionZoneId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "connectionZones");
    const zone = connectionZoneById(next, connectionZoneId);
    const updated = validateUpdatedModelObject(update(zone), connectionZoneId, "connection zone");
    if (updated.type !== zone.type) fail("connection zone type cannot be changed");
    if (updated.mainObjectId !== zone.mainObjectId) fail("connection zone main object cannot be changed");
    validateConnectionZone(updated);
    setIndexedModelObject(next, "connectionZones", connectionZoneId, updated);
    return setProject(next);
  };
  const replaceTrimJoint = (trimJointId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "trimJoints");
    const trimJoint = trimJointById(next, trimJointId);
    const updated = validateUpdatedModelObject(update(trimJoint), trimJointId, "trim joint");
    if (updated.type !== trimJoint.type) fail("trim joint type cannot be changed");
    setIndexedModelObject(next, "trimJoints", trimJointId, updated);
    return setProject(next);
  };
  const replaceFastenerGroup = (fastenerGroupId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "fastenerGroups");
    next.model.smartComponentInstances = Object.fromEntries(Object.entries(projectCollection(currentProject, "smartComponentInstances")).map(([id, instance]) => [id, clone(instance)]));
    const fastenerGroup = clone(fastenerGroupById(next, fastenerGroupId));
    const updated = validateUpdatedModelObject(update(clone(fastenerGroup)), fastenerGroupId, "fastener group");
    if (updated.type !== fastenerGroup.type) fail("fastener group type cannot be changed");
    validateFastenerGroup(fasteners, updated);
    setIndexedModelObject(next, "fastenerGroups", fastenerGroupId, updated);
    recordSmartComponentFieldOverride(next, fastenerGroup, updated);
    return setProject(next);
  };
  const replaceWeld = (weldId, update) => {
    const next = cloneProjectForModelCollection(currentProject, "welds");
    next.model.smartComponentInstances = Object.fromEntries(Object.entries(projectCollection(currentProject, "smartComponentInstances")).map(([id, instance]) => [id, clone(instance)]));
    const weld = clone(weldById(next, weldId));
    const updated = validateUpdatedModelObject(update(clone(weld)), weldId, "weld");
    if (updated.type !== weld.type) fail("weld type cannot be changed");
    validateWeld(updated);
    setIndexedModelObject(next, "welds", weldId, updated);
    recordSmartComponentFieldOverride(next, weld, updated);
    return setProject(next);
  };

  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    project() {
      return currentProject;
    },

    object(objectId) {
      if (!projectObjectIndex(currentProject)[objectId]) fail(`object not found: ${objectId}`);
      return objectById(currentProject, objectId);
    },

    member(memberId) {
      memberById(currentProject, memberId);
      return objectById(currentProject, memberId);
    },

    smartComponent(smartComponentId) {
      return smartComponentById(currentProject, smartComponentId);
    },

    smartComponentForObject(objectId) {
      return projectSmartComponentForObject(currentProject, objectId);
    },

    smartComponentRoot(smartComponentId) {
      return smartComponentRoot(currentProject, smartComponentById(currentProject, smartComponentId));
    },

    smartComponentRootForObject(objectId) {
      return projectSmartComponentRootForObject(currentProject, objectId);
    },

    toggleSmartComponentRoleFromFace(face) {
      const component = componentFromFace(currentProject, face);
      if (!component) return null;
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, component.smartComponentId);

      let included = true;
      if (component.kind === "pattern-position") {
        const suppressedPatternPositions = requiredObject(smartComponent.suppressedPatternPositions, `${component.smartComponentId}.suppressedPatternPositions`);
        const current = arrayValues(suppressedPatternPositions[component.patternRole]);
        included = current.includes(component.positionIndex);
        const nextList = setIndexIncluded(current, component.positionIndex, included);
        if (nextList.length) suppressedPatternPositions[component.patternRole] = nextList;
        else delete suppressedPatternPositions[component.patternRole];
      } else if (component.kind === "object-role") {
        const definition = definitionFor(next, component.smartComponentId);
        if (!requiredArray(definition.components, `${definition.type}.components`).some((entry) => entry?.role === component.objectRole)) fail(`${component.smartComponentId}: unknown component role ${component.objectRole}`);
        const current = new Set(requiredStringList(smartComponent.suppressedRoles, `${component.smartComponentId}.suppressedRoles`));
        included = current.has(component.objectRole);
        if (included) current.delete(component.objectRole);
        else current.add(component.objectRole);
        smartComponent.suppressedRoles = [...current].sort();
      }

      const updated = setRegeneratedSmartComponent(next, component.smartComponentId);
      return { project: updated, component, included };
    },

    smartComponentObjectIds(smartComponentId) {
      return smartComponentObjectIds(currentProject, smartComponentById(currentProject, smartComponentId));
    },

    resetSmartComponentObjectOverrides(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        delete requiredObject(smartComponent.fieldOverrides, `${smartComponentId}.fieldOverrides`)[objectId];
        delete requiredObject(smartComponent.managedFields, `${smartComponentId}.managedFields`)[objectId];
        return next;
      });
    },

    detachSmartComponentObject(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        if (!smartComponentOwnedObjectIds(smartComponent).includes(objectId)) fail(`${objectId}: object is not owned by ${smartComponentId}`);
        const collection = objectCollection(next, objectId);
        const object = collection ? projectCollection(next, collection)[objectId] : null;
        if (!object) fail(`object not found: ${objectId}`);
        smartComponent.detachedObjectIds = unique([...requiredStringList(smartComponent.detachedObjectIds, `${smartComponentId}.detachedObjectIds`), objectId]);
        object.authoring = { ...optionalObject(object.authoring, `${objectId}.authoring`), componentStatus: "detached" };
        return next;
      });
    },

    reattachSmartComponentObject(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        smartComponent.detachedObjectIds = requiredStringList(smartComponent.detachedObjectIds, `${smartComponentId}.detachedObjectIds`).filter((id) => id !== objectId);
        delete requiredObject(smartComponent.fieldOverrides, `${smartComponentId}.fieldOverrides`)[objectId];
        delete requiredObject(smartComponent.managedFields, `${smartComponentId}.managedFields`)[objectId];
        return removeObjects(next, [objectId]);
      });
    },

    affectedSmartComponentIds(memberId) {
      memberById(currentProject, memberId);
      return affectedSmartComponentIdsForMember(currentProject, memberId);
    },

    memberDependencyObjectIds(memberId, options = {}) {
      memberById(currentProject, memberId);
      return projectMemberDependencyObjectIds(currentProject, memberId, options);
    },

    featureDependencyObjectIds(featureId, options = {}) {
      featureById(currentProject, featureId);
      return projectFeatureDependencyObjectIds(currentProject, featureId, options);
    },

    referencePlaneDependencyObjectIds(referencePlaneId, options = {}) {
      referencePlaneById(currentProject, referencePlaneId);
      return projectReferencePlaneDependencyObjectIds(currentProject, referencePlaneId, options);
    },

    trimJointDependencyObjectIds(trimJointId, options = {}) {
      trimJointById(currentProject, trimJointId);
      return projectTrimJointDependencyObjectIds(currentProject, trimJointId, options);
    },

    definition(smartComponentId) {
      return definitionFor(currentProject, smartComponentId);
    },

    supportedSmartComponents() {
      return supportedSmartComponents(currentProject, smartComponentCatalog);
    },

    smartComponentPresets() {
      return supportedSmartComponentPresets(smartComponentCatalog);
    },

    catalogEntries(catalog) {
      if (catalog === "fasteners") return fastenerCatalogEntries(fasteners);
      if (catalog === "profiles") return profilesFor(currentProject);
      fail(`unsupported catalog ${catalog}`);
    },

    profiles() {
      return profilesFor(currentProject);
    },

    createSmartComponentFromPreset(presetId, memberIds) {
      const preset = smartComponentCatalog.smartComponents[presetId];
      if (!preset) fail(`smart component preset not found: ${presetId}`);
      const definition = smartComponentDefinition(smartComponentCatalog, { type: preset.type, sourceComponent: { id: presetId } });
      if (preset.kind !== "connection") {
        const created = createProjectSmartComponentFromPreset(currentProject, smartComponentCatalog, presetId, [], { definition });
        const next = regenerateSmartComponent(created.project, created.smartComponentId);
        setProject(next);
        return { project: currentProject, smartComponentId: created.smartComponentId };
      }
      const created = createProjectSmartComponentFromPreset(currentProject, smartComponentCatalog, presetId, memberIds, { definition });
      const locked = lockSmartComponentZoneFaces(created.project, profilesFor(created.project), created.smartComponentId);
      const next = reconcileGeneratedSmartComponents(regenerateSmartComponent(locked, created.smartComponentId));
      setProject(next);
      return { project: currentProject, smartComponentId: created.smartComponentId };
    },

    createLevel(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("level options must be an object");
      const next = clone(currentProject);
      const id = nextObjectId(next, options.id === undefined ? "level" : options.id);
      const level = {
        id,
        type: options.type || "datum-level",
        name: options.name || id,
        elevation: finiteNumber(options.elevation) ? Number(options.elevation) : 0
      };
      validateLevel(level);
      addIndexedObject(next, "levels", level);
      const updated = setProject(next);
      return { project: updated, levelId: id, level: updated.model.levels[id] };
    },

    createGridSystem(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("grid system options must be an object");
      const next = clone(currentProject);
      const id = nextObjectId(next, options.id === undefined ? "grid" : options.id);
      const levelIds = Array.isArray(options.levelIds)
        ? unique(options.levelIds.filter((levelId) => projectCollection(next, "levels")[levelId]))
        : Object.keys(projectCollection(next, "levels"));
      const gridSystem = {
        id,
        type: options.type || "orthogonal-grid-system",
        name: options.name || "Grid",
        origin: Array.isArray(options.origin) ? [...options.origin] : [0, 0, 0],
        axisX: Array.isArray(options.axisX) ? [...options.axisX] : [1, 0, 0],
        axisY: Array.isArray(options.axisY) ? [...options.axisY] : [0, 1, 0],
        axisZ: Array.isArray(options.axisZ) ? [...options.axisZ] : [0, 0, 1],
        axes: {
          x: arrayValues(options.axes?.x).length ? clone(options.axes.x) : [
            { id: `${id}_x_1`, label: "1", position: 0 },
            { id: `${id}_x_2`, label: "2", position: 6000 }
          ],
          y: arrayValues(options.axes?.y).length ? clone(options.axes.y) : [
            { id: `${id}_y_a`, label: "A", position: 0 },
            { id: `${id}_y_b`, label: "B", position: 6000 }
          ]
        },
        levelIds
      };
      validateGridSystem(gridSystem);
      addIndexedObject(next, "gridSystems", gridSystem);
      const updated = setProject(next);
      return { project: updated, gridSystemId: id, gridSystem: updated.model.gridSystems[id] };
    },

    deleteSmartComponent(smartComponentId) {
      const smartComponent = smartComponentById(currentProject, smartComponentId);
      const ownedIds = smartComponentOwnedObjectIds(smartComponent);
      const helperIds = smartComponentGeneratedHelperIds(currentProject, smartComponent);
      return setProject(removeObjects(currentProject, [...ownedIds, ...helperIds, smartComponentId]));
    },

    smartComponentPlateOptions(smartComponentId) {
      return projectSmartComponentPlateOptions(currentProject, definitionFor(currentProject, smartComponentId), smartComponentId);
    },

    smartComponentRoleOptions(smartComponentId) {
      return projectSmartComponentRoleOptions(currentProject, definitionFor(currentProject, smartComponentId), smartComponentId);
    },

    setSmartComponentRoleActive(smartComponentId, role, active) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        const definition = definitionFor(next, smartComponentId);
        if (!requiredArray(definition.components, `${definition.type}.components`).some((component) => component?.role === role)) fail(`${smartComponentId}: unknown component role ${role}`);
        smartComponent.suppressedRoles = setRoleInList(smartComponent.suppressedRoles, role, !active);
        return next;
      });
    },

    setSmartComponentPlateIncluded(smartComponentId, plateId, included) {
      return setProject(setProjectSmartComponentPlateIncluded(currentProject, definitionFor(currentProject, smartComponentId), smartComponentId, plateId, included));
    },

    resolveSmartComponentDiagnostics,

    updateSmartComponent(smartComponentId, parameters) {
      return setProject(reconcileGeneratedSmartComponents(updateSmartComponent({
        project: currentProject,
        profiles: profilesFor(currentProject),
        definition: definitionFor(currentProject, smartComponentId),
        catalog: smartComponentCatalog,
        fasteners,
        materials,
        instanceId: smartComponentId,
        parameters
      })));
    },

    createMember(options = {}) {
      const next = clone(currentProject);
      const member = createMemberObject(next, options);
      addIndexedObject(next, "members", member);
      addMemberSnapRelations(next, member.id, options);
      appendMemberToDefaultGroup(next, member.id);
      const updated = setProject(reconcileGeneratedSmartComponents(next));
      return { project: updated, memberId: member.id, member: updated.model.members[member.id] };
    },

    createPlate(options = {}) {
      const next = clone(currentProject);
      const plate = addPlateObject(next, options);
      const updated = setProject(next);
      return { project: updated, plateId: plate.id, plate: updated.model.plates[plate.id] };
    },

    createSketch(options = {}) {
      const next = clone(currentProject);
      const sketch = addSketchObject(next, options);
      const updated = setProject(next);
      return { project: updated, sketchId: sketch.id, sketch: updated.model.sketches[sketch.id] };
    },

    createPlateFromSketch(sketchId, options = {}) {
      const next = clone(currentProject);
      const source = sketchById(next, sketchId);
      const plate = plateFromSketchObject(next, source, options);
      addIndexedObject(next, "plates", plate);
      const updated = setProject(next);
      return { project: updated, plateId: plate.id, plate: updated.model.plates[plate.id] };
    },

    createTrimJoint(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("trim joint options must be an object");
      const memberIds = unique(requiredStringList(options.memberIds, "trim joint memberIds"));
      for (const memberId of memberIds) memberById(currentProject, memberId);
      if (options.operationPatch !== undefined && !plainObject(options.operationPatch)) fail("trim joint operationPatch must be an object");
      const operationPatch = options.operationPatch === undefined ? {} : clone(options.operationPatch);
      const operationType = trimOperationTypeFromOptions(options, operationPatch);
      if (operationType !== "plane-trim" && memberIds.length < 2) fail("member-to-member trim requires two members");
      if (operationType === "plane-trim" && memberIds.length < 1) fail("plane trim requires one member");
      if (options.patch !== undefined && !plainObject(options.patch)) fail("trim joint patch must be an object");

      const next = clone(currentProject);
      if (options.id !== undefined && (typeof options.id !== "string" || !options.id.trim())) fail("trim joint id must be a non-empty string");
      const id = nextObjectId(next, options.id === undefined ? `trim_${memberIds.join("_") || "joint"}` : options.id);
      let trimJoint = {
        id,
        type: operationType === "plane-trim" ? "member-trim" : "corner-trim",
        gap: 0,
        participants: [],
        operations: [],
        ...(options.patch === undefined ? {} : clone(options.patch))
      };
      trimJoint.id = id;
      trimJoint.type = operationType === "plane-trim" ? "member-trim" : "corner-trim";
      for (const memberId of memberIds) {
        trimJoint.participants.push(defaultTrimJointParticipant(next, trimJoint, memberId));
      }

      const operation = defaultTrimJointOperation(trimJoint, {
        type: operationType,
        memberAId: operationPatch.memberAId === undefined ? memberIds[0] : operationPatch.memberAId,
        memberBId: operationType === "plane-trim" ? undefined : operationPatch.memberBId === undefined ? memberIds[1] : operationPatch.memberBId,
        gap: 0,
        ...operationPatch
      });
      validateTrimJointOperation(next, id, trimJoint, operation);
      trimJoint.operations = [operation];
      addIndexedObject(next, "trimJoints", trimJoint);
      const updated = setProject(next);
      return { project: updated, trimJointId: id, trimJoint: updated.model.trimJoints[id] };
    },

    deleteMember(memberId) {
      if (!projectCollection(currentProject, "members")[memberId]) fail(`member not found: ${memberId}`);
      const next = clone(currentProject);
      const relationIds = memberAxisRelations(next, memberId).map((relation) => relation.id);
      for (const relationId of relationIds) removeIndexedObject(next, relationId);
      removeIndexedObject(next, memberId);
      removeReferences(next.model, new Set([memberId, ...relationIds]));
      return setProject(reconcileGeneratedSmartComponents(next));
    },

    updateMember(memberId, patch, options = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("member patch must be an object");
      return replaceMember(memberId, (member) => ({ ...member, ...clone(patch) }), options);
    },

    memberAxisRelations(memberId) {
      memberById(currentProject, memberId);
      return memberAxisRelations(currentProject, memberId);
    },

    setMemberAlignment(memberId, source) {
      memberById(currentProject, memberId);
      const next = clone(currentProject);
      upsertRelationObject(next, memberAlignRelation(memberId, source));
      return setProject(next);
    },

    clearMemberAlignment(memberId) {
      memberById(currentProject, memberId);
      const relation = memberAxisRelations(currentProject, memberId).find((item) => item.type === "member-align-axis");
      return relation ? setProject(removeObjects(currentProject, [relation.id])) : currentProject;
    },

    upsertRelation(relation) {
      const next = clone(currentProject);
      upsertRelationObject(next, relation);
      return setProject(next);
    },

    deleteRelation(relationId) {
      if (typeof relationId !== "string" || !relationId) fail("relation id must be a non-empty string");
      if (!projectCollection(currentProject, "relations")[relationId]) fail(`relation not found: ${relationId}`);
      return setProject(removeObjects(currentProject, [relationId]));
    },

    updateFeature(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature patch must be an object");
      if ("id" in patch && patch.id !== featureId) fail("feature id cannot be changed");
      if ("ownerId" in patch) fail("feature owner cannot be changed");
      if ("type" in patch) fail("feature type cannot be changed");
      return replaceFeature(featureId, (feature) => mergePatch(feature, patch));
    },

    updateTrimJoint(trimJointId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint patch must be an object");
      if ("id" in patch && patch.id !== trimJointId) fail("trim joint id cannot be changed");
      if ("type" in patch) fail("trim joint type cannot be changed");
      if ("jointPoint" in patch) fail("trim joint point is derived from participant member axes");
      return replaceTrimJoint(trimJointId, (trimJoint) => mergePatch(trimJoint, patch));
    },

    updateFastenerGroup(fastenerGroupId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("fastener group patch must be an object");
      if ("id" in patch && patch.id !== fastenerGroupId) fail("fastener group id cannot be changed");
      if ("type" in patch) fail("fastener group type cannot be changed");
      return replaceFastenerGroup(fastenerGroupId, (fastenerGroup) => mergePatch(fastenerGroup, patch));
    },

    updateWeld(weldId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("weld patch must be an object");
      if ("id" in patch && patch.id !== weldId) fail("weld id cannot be changed");
      if ("type" in patch) fail("weld type cannot be changed");
      return replaceWeld(weldId, (weld) => mergePatch(weld, patch));
    },

    updateGridSystem(gridSystemId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("grid system patch must be an object");
      if ("id" in patch && patch.id !== gridSystemId) fail("grid system id cannot be changed");
      if ("type" in patch) fail("grid system type cannot be changed");
      return replaceGridSystem(gridSystemId, (gridSystem) => mergePatch(gridSystem, patch));
    },

    updateLevel(levelId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("level patch must be an object");
      if ("id" in patch && patch.id !== levelId) fail("level id cannot be changed");
      if ("type" in patch) fail("level type cannot be changed");
      return replaceLevel(levelId, (level) => mergePatch(level, patch));
    },

    updateWorkPoint(workPointId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("work point patch must be an object");
      if ("id" in patch && patch.id !== workPointId) fail("work point id cannot be changed");
      if ("type" in patch) fail("work point type cannot be changed");
      return replaceWorkPoint(workPointId, (workPoint) => mergePatch(workPoint, patch));
    },

    updateHolePattern(holePatternId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("hole pattern patch must be an object");
      if ("id" in patch && patch.id !== holePatternId) fail("hole pattern id cannot be changed");
      if ("type" in patch) fail("hole pattern type cannot be changed");
      return replaceHolePattern(holePatternId, (holePattern) => mergePatch(holePattern, patch));
    },

    updateGroup(groupId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("group patch must be an object");
      if ("id" in patch && patch.id !== groupId) fail("group id cannot be changed");
      if ("type" in patch) fail("group type cannot be changed");
      return replaceGroup(groupId, (group) => mergePatch(group, patch));
    },

    updateAssembly(assemblyId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("assembly patch must be an object");
      if ("id" in patch && patch.id !== assemblyId) fail("assembly id cannot be changed");
      if ("type" in patch) fail("assembly type cannot be changed");
      return replaceAssembly(assemblyId, (assembly) => mergePatch(assembly, patch));
    },

    updateObjectPattern(objectPatternId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("object pattern patch must be an object");
      if ("id" in patch && patch.id !== objectPatternId) fail("object pattern id cannot be changed");
      if ("type" in patch) fail("object pattern type cannot be changed");
      return replaceObjectPattern(objectPatternId, (objectPattern) => mergePatch(objectPattern, patch));
    },

    updateInterface(interfaceId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("interface patch must be an object");
      if ("id" in patch && patch.id !== interfaceId) fail("interface id cannot be changed");
      if ("type" in patch) fail("interface type cannot be changed");
      if ("ownerId" in patch) fail("interface owner cannot be changed");
      return replaceInterface(interfaceId, (iface) => mergePatch(iface, patch));
    },

    updateConnectionZone(connectionZoneId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("connection zone patch must be an object");
      if ("id" in patch && patch.id !== connectionZoneId) fail("connection zone id cannot be changed");
      if ("type" in patch) fail("connection zone type cannot be changed");
      if ("mainObjectId" in patch) fail("connection zone main object cannot be changed");
      return replaceConnectionZone(connectionZoneId, (zone) => mergePatch(zone, patch));
    },

    updateTrimJointParticipant(trimJointId, memberId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint participant patch must be an object");
      if ("memberId" in patch && patch.memberId !== memberId) fail("participant member cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = trimJointParticipants(trimJoint).map((participant) => (
          participant.memberId === memberId ? mergePatch(participant, patch) : participant
        ));
        if (!participants.some((participant) => participant.memberId === memberId)) fail(`${trimJointId}: participant not found: ${memberId}`);
        return { ...trimJoint, participants };
      });
    },

    addTrimJointParticipant(trimJointId, memberId, patch = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint participant patch must be an object");
      if ("memberId" in patch && patch.memberId !== memberId) fail("participant member cannot be changed");
      memberById(currentProject, memberId);
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        if (trimJointParticipants(trimJoint).some((participant) => participant.memberId === memberId)) {
          fail(`${trimJointId}: participant already exists: ${memberId}`);
        }
        return {
          ...trimJoint,
          participants: [
            ...trimJointParticipants(trimJoint),
            defaultTrimJointParticipant(currentProject, trimJoint, memberId, patch)
          ]
        };
      });
    },

    removeTrimJointParticipant(trimJointId, memberId) {
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = trimJointParticipants(trimJoint).filter((participant) => participant.memberId !== memberId);
        if (participants.length === trimJointParticipants(trimJoint).length) fail(`${trimJointId}: participant not found: ${memberId}`);
        if (!participants.length) fail(`${trimJointId}: trim requires at least one participant`);
        const operations = trimJointOperations(trimJoint).filter((operation) => (
          operation.memberAId !== memberId && operation.memberBId !== memberId
        ));
        return { ...trimJoint, participants, operations };
      });
    },

    addTrimJointOperation(trimJointId, patch = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint operation patch must be an object");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operation = defaultTrimJointOperation(trimJoint, patch);
        validateTrimJointOperation(currentProject, trimJointId, trimJoint, operation);
        if (trimJointOperations(trimJoint).some((item) => item.id === operation.id)) fail(`${trimJointId}: operation already exists: ${operation.id}`);
        return { ...trimJoint, operations: [...trimJointOperations(trimJoint), operation] };
      });
    },

    updateTrimJointOperation(trimJointId, operationId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint operation patch must be an object");
      if ("id" in patch && patch.id !== operationId) fail("trim joint operation id cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operations = trimJointOperations(trimJoint).map((operation) => {
          if (operation.id !== operationId) return operation;
          const next = normalizedTrimJointOperation(trimJoint, mergePatch(operation, patch));
          validateTrimJointOperation(currentProject, trimJointId, trimJoint, next);
          return next;
        });
        if (!operations.some((operation) => operation.id === operationId)) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...trimJoint, operations };
      });
    },

    setTrimJointOperationMember(trimJointId, operationId, role, memberId) {
      if (role !== "memberA" && role !== "memberB") fail("trim joint operation role must be memberA or memberB");
      memberById(currentProject, memberId);
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const nextTrimJoint = ensureTrimJointParticipant(currentProject, trimJoint, memberId);
        let found = false;
        const operations = trimJointOperations(nextTrimJoint).map((operation) => {
          if (operation.id !== operationId) return operation;
          found = true;
          const patch = role === "memberA" ? { memberAId: memberId } : { memberBId: memberId };
          if (!TRIM_OPERATION_TYPES.has(operation.type)) fail(`${trimJointId}: unsupported trim operation type ${operation.type}`);
          if (trimOperationUsesMemberEnd(operation.type, role)) {
            const referencePoint = trimJointReferencePoint(currentProject, nextTrimJoint);
            if (!referencePoint) fail(`${trimJointId}: trim joint has no member reference point`);
            patch[`${role}End`] = nearestMemberEnd(memberById(currentProject, memberId), referencePoint);
          }
          const next = normalizedTrimJointOperation(nextTrimJoint, mergePatch(operation, patch));
          validateTrimJointOperation(currentProject, trimJointId, nextTrimJoint, next);
          return next;
        });
        if (!found) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...nextTrimJoint, operations };
      });
    },

    removeTrimJointOperation(trimJointId, operationId) {
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operations = trimJointOperations(trimJoint).filter((operation) => operation.id !== operationId);
        if (operations.length === trimJointOperations(trimJoint).length) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...trimJoint, operations };
      });
    },

    setFeatureOperationEnabled(featureId, enabled) {
      if (typeof enabled !== "boolean") fail("feature enabled state must be boolean");
      return replaceFeature(featureId, (feature) => ({ ...feature, operationEnabled: enabled }));
    },

    setReferencePlane(referencePlaneId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("reference plane patch must be an object");
      if ("id" in patch && patch.id !== referencePlaneId) fail("reference plane id cannot be changed");
      if ("type" in patch) fail("reference plane type cannot be changed");
      return replaceReferencePlane(referencePlaneId, (plane) => mergePatch(plane, patch));
    },

    setFeatureBody(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature body patch must be an object");
      return replaceFeature(featureId, (feature) => {
        if (feature.type !== "boolean-part") fail(`${featureId}: feature body is only supported for boolean-part features`);
        if (!feature.body || typeof feature.body !== "object" || Array.isArray(feature.body)) fail(`${featureId}: feature body must be an object`);
        return { ...feature, body: mergePatch(feature.body, patch) };
      });
    },

    setFeatureSource(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature source patch must be an object");
      return replaceFeature(featureId, (feature) => {
        if (!feature.source || typeof feature.source !== "object" || Array.isArray(feature.source)) fail(`${featureId}: feature source must be an object`);
        return { ...feature, source: mergePatch(feature.source, patch) };
      });
    },

    updatePlate(plateId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("plate patch must be an object");
      if ("id" in patch && patch.id !== plateId) fail("plate id cannot be changed");
      if ("type" in patch) fail("plate type cannot be changed directly");
      return replacePlate(plateId, (plate) => mergePatch(plate, patch));
    },

    setPlateSketchVertex(plateId, vertexId, point) {
      return replacePlate(plateId, (plate) => setPlateSketchVertexData(plate, vertexId, point));
    },

    setPlateSketchVertices(plateId, vertexPoints) {
      return replacePlate(plateId, (plate) => setPlateSketchVerticesData(plate, vertexPoints));
    },

    addPlateSketchConstructionLine(plateId, fromPoint, toPoint, options = {}) {
      return replacePlate(plateId, (plate) => addPlateSketchConstructionLineData(plate, fromPoint, toPoint, options));
    },

    setPlateSketchEdgeLength(plateId, edgeId, length, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthData(plate, edgeId, length, options));
    },

    setPlateSketchEdgeLengthMode(plateId, edgeId, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthModeData(plate, edgeId, mode));
    },

    setPlateSketchEdgeAngle(plateId, edgeIds, angle, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeAngleData(plate, edgeIds, angle, options));
    },

    setPlateSketchEdgeAngleMode(plateId, edgeIds, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeAngleModeData(plate, edgeIds, mode));
    },

    setPlateSketchPointDistance(plateId, vertexIds, distance, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchPointDistanceData(plate, vertexIds, distance, options));
    },

    setPlateSketchPointDistanceMode(plateId, vertexIds, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchPointDistanceModeData(plate, vertexIds, mode));
    },

    insertPlateSketchVertex(plateId, edgeId, point, options = {}) {
      let insertedVertexId = null;
      const project = replacePlate(plateId, (plate) => {
        const result = insertPlateSketchVertexData(plate, edgeId, point, options);
        insertedVertexId = result.vertexId;
        return result.plate;
      });
      return { project, vertexId: insertedVertexId };
    },

    removePlateSketchVertex(plateId, vertexId) {
      return replacePlate(plateId, (plate) => removePlateSketchVertexData(plate, vertexId));
    },

    notchPlateSketchCorner(plateId, vertexId, options = {}) {
      let notchVertexIds = [];
      const project = replacePlate(plateId, (plate) => {
        const result = notchPlateSketchCornerData(plate, vertexId, options);
        notchVertexIds = result.vertexIds;
        return result.plate;
      });
      return { project, vertexIds: notchVertexIds };
    },

    removePlateSketchRelation(plateId, relationId) {
      return replacePlate(plateId, (plate) => removePlateSketchRelationData(plate, relationId));
    },

    removePlateSketchFixedRelations(plateId) {
      return replacePlate(plateId, (plate) => removePlateSketchFixedRelationsData(plate));
    },

    solvePlateSketchRelation(plateId, relationId) {
      return replacePlate(plateId, (plate) => solvePlateSketchRelationData(plate, relationId));
    },

    upsertPlateSketchRelation(plateId, relation) {
      return replacePlate(plateId, (plate) => upsertPlateSketchRelationData(plate, relation));
    },

    fixPlateSketchUnderDefinedEntities(plateId, options = {}) {
      return replacePlate(plateId, (plate) => fixPlateSketchUnderDefinedEntitiesData(plate, options));
    },

    inferPlateSketchRelations(plateId) {
      return replacePlate(plateId, (plate) => inferPlateSketchRelationsData(plate));
    },

    setSketchVertex(sketchId, vertexId, point) {
      return replaceSketch(sketchId, (sketch) => setSketchVertexData(sketch, vertexId, point));
    },

    upsertPlateBend(plateId, bend) {
      return replacePlate(plateId, (plate) => upsertPlateBendData(plate, bend));
    },

    removePlateBend(plateId, bendId) {
      return replacePlate(plateId, (plate) => removePlateBendData(plate, bendId));
    },

    createCustomProfile(profile) {
      profile = requiredObject(profile, "profile");
      const id = profile.id === undefined ? nextObjectId(currentProject, "custom_profile") : cleanId(profile.id);
      if (!id) fail("profile id must be a non-empty string");
      if (profile.id !== undefined && id !== profile.id) fail("profile id must contain only id-safe characters");
      if (profilesFor(currentProject)[id]) fail(`profile already exists: ${id}`);
      const next = clone(currentProject);
      const profiles = requiredObject(requiredObject(next.model, "model").profiles, "model.profiles");
      const stored = profile.section
        ? { ...clone(profile), id }
        : profileFromSectionSketch({ ...profile, id });
      profiles[id] = stored;
      return setProject(next);
    },

    setMemberProfile(memberId, profileId) {
      requiredProfileById(profilesFor(currentProject), profileId, fail);
      return replaceMember(memberId, (member) => ({ ...member, profile: profileId }));
    },

    setMemberRotation(memberId, rotation) {
      if (!finiteNumber(rotation)) fail("member rotation must be a finite number");
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    rotateMember(memberId, deltaDegrees) {
      if (!finiteNumber(deltaDegrees)) fail("rotation delta must be a finite number");
      const currentRotation = objectById(currentProject, memberId).rotation;
      if (!finiteNumber(currentRotation)) fail(`${memberId}: member rotation must be a finite number`);
      const rotation = currentRotation + deltaDegrees;
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    setMemberEndpoints(memberId, start, end) {
      const nextStart = vec3(start, "member start");
      const nextEnd = vec3(end, "member end");
      if (v.len(v.sub(nextEnd, nextStart)) <= 1e-9) fail(`${memberId}: member cannot have zero length`);
      return replaceMember(memberId, (member) => ({ ...member, start: nextStart, end: nextEnd }));
    },

    moveMember(memberId, delta) {
      const offset = vec3(delta, "member move delta");
      return replaceMember(memberId, (member) => ({
        ...member,
        start: v.add(member.start, offset),
        end: v.add(member.end, offset)
      }));
    },

    moveMemberWithLayout(memberId, delta, options = {}) {
      return replaceMember(memberId, (member) => moveMemberWithLayoutData(member, delta), options);
    },

    setMemberPhysicalEndpoint(memberId, endpoint, point, options = {}) {
      return replaceMember(memberId, (member) => setMemberPhysicalEndpointData(member, endpoint, point), options);
    },

    setMemberLayoutEndpoint(memberId, endpoint, point, options = {}) {
      return replaceMember(memberId, (member) => setMemberLayoutEndpointData(member, endpoint, point), options);
    },

    regenerateMemberSmartComponents(memberId) {
      memberById(currentProject, memberId);
      return setProject(regenerateMemberSmartComponents(currentProject, memberId));
    },

    draftMemberProject(memberId, member, options = {}) {
      memberById(currentProject, memberId);
      const next = cloneProjectForModelCollection(currentProject, "members");
      next.model.members[memberId] = clone(member);
      if (options.regenerateSmartComponents === false) return next;
      return regenerateMemberSmartComponents(next, memberId);
    },

    setMemberCenter(memberId, center) {
      const target = vec3(center, "member center");
      const member = memberById(currentProject, memberId);
      const offset = v.sub(target, memberCenter(member));
      return replaceMember(memberId, (storedMember) => ({
        ...storedMember,
        start: v.add(storedMember.start, offset),
        end: v.add(storedMember.end, offset)
      }));
    }
  };
}
