import { objectById } from "../core/model.mjs";
import { v } from "../core/math.mjs";
import { requiredReferencePlane } from "../geometry/feature-plane.mjs";
import { resolveInterface, sectionBounds } from "../geometry/member-geometry.mjs";
import { addIndexedObject, nextObjectId, removeIndexedObject } from "../api/project/objects.mjs";
import { createMemberObject } from "../api/project/member-factory.mjs?v=axis-snap-1";
import {
  axisRelationFromSnap,
  memberAlignRelation,
  memberAxisRelations,
  relationUpsertKey
} from "../api/project/axis-relations.mjs?v=relation-types-1";
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
  flattenIds,
  memberDependencyObjectIds as projectMemberDependencyObjectIds,
  objectCollection,
  referencePlaneDependencyObjectIds as projectReferencePlaneDependencyObjectIds,
  trimJointDependencyObjectIds as projectTrimJointDependencyObjectIds
} from "../api/project/dependencies.mjs?v=stair-root-select-2";
import {
  memberLayoutAxis,
  moveMemberWithLayout as moveMemberWithLayoutData,
  setMemberLayoutEndpoint as setMemberLayoutEndpointData,
  setMemberPhysicalEndpoint as setMemberPhysicalEndpointData
} from "../api/project/members.mjs";
import {
  optionalPath,
  setPath
} from "../modules/smart-components/parameters.mjs?v=stair-route-ui-fit-2";
import {
  clone,
  smartComponentById,
  smartComponentRoleOptions as projectSmartComponentRoleOptions,
  smartComponentPlateOptions as projectSmartComponentPlateOptions,
  createProjectSmartComponentFromPreset,
  setSmartComponentPlateIncluded as setProjectSmartComponentPlateIncluded,
  updateSmartComponent,
  updateSmartComponents
} from "../modules/smart-components/smart-component-generator.mjs?v=stair-route-ui-fit-2";
import { smartComponentDefinition, supportedSmartComponentPresets, supportedSmartComponents } from "../modules/smart-components/smart-component-registry.mjs?v=stair-route-ui-fit-2";

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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function appendUnique(values, id) {
  return unique([...(Array.isArray(values) ? values : []), id]);
}

function almostSamePoint(a, b, tolerance = FIT_EPSILON) {
  return Array.isArray(a) && Array.isArray(b) && v.len(v.sub(a, b)) <= tolerance;
}

function memberPointAtEnd(member, memberEnd) {
  if (memberEnd === "start") return member.start;
  if (memberEnd === "end") return member.end;
  return v.mul(v.add(member.start, member.end), 0.5);
}

function nearestMemberEnd(member, point) {
  return v.len(v.sub(member.start, point)) <= v.len(v.sub(member.end, point)) ? "start" : "end";
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x, y, z] point`);
  }
  return [...value];
}

function profileById(profiles, profileId) {
  const profile = profiles?.[profileId] || profiles?.profiles?.[profileId];
  if (!profile) fail(`profile not found: ${profileId}`);
  return profile;
}

function memberById(project, memberId) {
  if (!project.model.members?.[memberId]) fail(`member not found: ${memberId}`);
  return project.model.members[memberId];
}

function featureById(project, featureId) {
  if (!project.model.features?.[featureId]) fail(`feature not found: ${featureId}`);
  return project.model.features[featureId];
}

function referencePlaneById(project, referencePlaneId) {
  if (!project.model.referencePlanes?.[referencePlaneId]) fail(`reference plane not found: ${referencePlaneId}`);
  return project.model.referencePlanes[referencePlaneId];
}

function trimJointById(project, trimJointId) {
  if (!project.model.trimJoints?.[trimJointId]) fail(`trim joint not found: ${trimJointId}`);
  return project.model.trimJoints[trimJointId];
}

function fastenerGroupById(project, fastenerGroupId) {
  if (!project.model.fastenerGroups?.[fastenerGroupId]) fail(`fastener group not found: ${fastenerGroupId}`);
  return project.model.fastenerGroups[fastenerGroupId];
}

function assertOptionalPositiveNumber(value, label) {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(`${label} must be a positive number`);
}

function assertOptionalNonNegativeNumber(value, label) {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${label} must be a non-negative number`);
}

function validateFastenerGroup(fasteners, fastenerGroup) {
  if (fastenerGroup.fastenerRef && !fasteners.fasteners?.[fastenerGroup.fastenerRef]) fail(`fastener not found: ${fastenerGroup.fastenerRef}`);
  if (!Array.isArray(fastenerGroup.participants) || !fastenerGroup.participants.length) fail("fastener group participants cannot be empty");
  assertOptionalPositiveNumber(fastenerGroup.assembly?.length, "fastener length");
  assertOptionalPositiveNumber(fastenerGroup.assembly?.gripLength, "fastener grip length");
  assertOptionalNonNegativeNumber(fastenerGroup.assembly?.nutOffset, "fastener nut offset");
}

function trimJointReferencePoint(project, trimJoint) {
  const points = (trimJoint.participants || [])
    .map((participant) => project.model.members?.[participant.memberId] ? memberPointAtEnd(project.model.members[participant.memberId], participant.memberEnd) : null)
    .filter(Boolean);
  if (!points.length) return [0, 0, 0];
  return v.mul(points.reduce((sum, point) => v.add(sum, point), [0, 0, 0]), 1 / points.length);
}

function defaultTrimJointParticipant(project, trimJoint, memberId, patch = {}) {
  const member = memberById(project, memberId);
  return {
    memberId,
    memberEnd: nearestMemberEnd(member, trimJointReferencePoint(project, trimJoint)),
    ...clone(patch)
  };
}

function trimOperationUsesMemberEnd(type, role) {
  if (type === "end-butt-1") return role === "memberA";
  if (type === "end-butt-2") return role === "memberB";
  if (type === "end-butt-both" || type === "end-miter") return true;
  return false;
}

const MITER_MODES = new Set(["equal-angle", "profile-balanced"]);

function trimRegionParts(regionKey) {
  if (typeof regionKey !== "string" || !regionKey) fail("plane trim region key must be a non-empty string");
  return regionKey.split("|").map((part) => {
    const index = part.lastIndexOf(":");
    if (index <= 0) fail(`invalid plane trim region key: ${regionKey}`);
    const planeId = part.slice(0, index);
    const side = part.slice(index + 1);
    if (side !== "+" && side !== "-") fail(`invalid plane trim region side in key: ${regionKey}`);
    return { planeId, side };
  });
}

function validateTrimRegionKeys(trimJointId, operation) {
  const planeIds = new Set(operation.referencePlaneIds || []);
  for (const regionKey of operation.removedRegionKeys || []) {
    const parts = trimRegionParts(regionKey);
    if (parts.length !== planeIds.size) fail(`${trimJointId}: plane trim region key must include every selected plane`);
    const seen = new Set();
    for (const { planeId } of parts) {
      if (!planeIds.has(planeId)) fail(`${trimJointId}: plane trim region references an unselected plane: ${planeId}`);
      if (seen.has(planeId)) fail(`${trimJointId}: plane trim region repeats plane: ${planeId}`);
      seen.add(planeId);
    }
  }
}

function normalizedTrimJointOperation(trimJoint, operation) {
  const type = operation.type || "end-butt-1";
  const next = { ...operation, type };
  const memberA = (trimJoint.participants || []).find((participant) => participant.memberId === next.memberAId);
  const memberB = (trimJoint.participants || []).find((participant) => participant.memberId === next.memberBId);
  if (trimOperationUsesMemberEnd(type, "memberA")) next.memberAEnd = next.memberAEnd === "start" || next.memberAEnd === "end" ? next.memberAEnd : memberA?.memberEnd || "end";
  else delete next.memberAEnd;
  if (trimOperationUsesMemberEnd(type, "memberB")) next.memberBEnd = next.memberBEnd === "start" || next.memberBEnd === "end" ? next.memberBEnd : memberB?.memberEnd || "end";
  else delete next.memberBEnd;
  if (type === "plane-trim") {
    delete next.memberBId;
    delete next.memberBEnd;
    next.referencePlaneIds = Array.isArray(next.referencePlaneIds) ? [...new Set(next.referencePlaneIds)] : [];
    next.removedRegionKeys = Array.isArray(next.removedRegionKeys) ? [...new Set(next.removedRegionKeys)] : [];
    delete next.referencePlaneId;
  } else {
    delete next.referencePlaneId;
    delete next.referencePlaneIds;
    delete next.removedRegionKeys;
  }
  if (type !== "end-miter") delete next.miterMode;
  return next;
}

function defaultTrimJointOperation(trimJoint, patch = {}) {
  const participants = trimJoint.participants || [];
  const memberAId = patch.memberAId || participants[1]?.memberId || participants[0]?.memberId;
  const memberBId = patch.memberBId || participants.find((participant) => participant.memberId !== memberAId)?.memberId;
  const existingIds = new Set((trimJoint.operations || []).map((operation) => operation.id));
  let index = (trimJoint.operations || []).length + 1;
  let id = patch.id || `end_butt_1_${index}`;
  while (existingIds.has(id)) {
    index += 1;
    id = `end_butt_1_${index}`;
  }
  return normalizedTrimJointOperation(trimJoint, {
    id,
    type: "end-butt-1",
    memberAId,
    memberBId,
    enabled: true,
    ...clone(patch),
    id
  });
}

function trimJointHasParticipant(trimJoint, memberId) {
  return (trimJoint.participants || []).some((participant) => participant.memberId === memberId);
}

function ensureTrimJointParticipant(project, trimJoint, memberId) {
  if (trimJointHasParticipant(trimJoint, memberId)) return trimJoint;
  return {
    ...trimJoint,
    participants: [
      ...(trimJoint.participants || []),
      defaultTrimJointParticipant(project, trimJoint, memberId)
    ]
  };
}

function validateTrimJointOperation(project, trimJointId, trimJoint, operation) {
  const participantIds = new Set((trimJoint.participants || []).map((participant) => participant.memberId));
  if (!operation.memberAId) fail(`${trimJointId}: operation requires member A`);
  if (!participantIds.has(operation.memberAId)) fail(`${trimJointId}: operation member A must be a participant`);
  if (operation.type === "plane-trim") {
    if (!Array.isArray(operation.referencePlaneIds) || !operation.referencePlaneIds.length) {
      fail(`${trimJointId}: plane trim operation requires referencePlaneIds`);
    }
    for (const referencePlaneId of operation.referencePlaneIds) referencePlaneById(project, referencePlaneId);
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

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePatch(target, patch) {
  if (!plainObject(patch)) return clone(patch);
  const next = plainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    next[key] = plainObject(value) && plainObject(next[key]) ? mergePatch(next[key], value) : clone(value);
  }
  return next;
}

function removeReferences(value, deletedIds) {
  if (Array.isArray(value)) return value.filter((item) => !deletedIds.has(item)).map((item) => removeReferences(item, deletedIds));
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    if (REF_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      value[key] = child.filter((id) => !deletedIds.has(id));
    } else {
      removeReferences(child, deletedIds);
    }
  }
  return value;
}

function removeObjects(project, objectIds) {
  const next = clone(project);
  const deletedIds = new Set(unique(objectIds));

  for (const id of deletedIds) {
    const collection = objectCollection(next, id);
    if (collection) delete next.model[collection][id];
    delete next.objectIndex[id];
  }
  removeReferences(next.model, deletedIds);
  return next;
}

function cloneProjectForMemberUpdate(project, memberId) {
  return {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: {
      ...(project.model || {}),
      members: { ...(project.model?.members || {}) }
    }
  };
}

function cloneProjectForFeatureUpdate(project, featureId) {
  return {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: {
      ...(project.model || {}),
      features: { ...(project.model?.features || {}) }
    }
  };
}

function cloneProjectForReferencePlaneUpdate(project) {
  return {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: {
      ...(project.model || {}),
      referencePlanes: { ...(project.model?.referencePlanes || {}) }
    }
  };
}

function cloneProjectForTrimJointUpdate(project, trimJointId) {
  return {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: {
      ...(project.model || {}),
      trimJoints: { ...(project.model?.trimJoints || {}) }
    }
  };
}

function cloneProjectForFastenerGroupUpdate(project) {
  return {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: {
      ...(project.model || {}),
      fastenerGroups: { ...(project.model?.fastenerGroups || {}) },
      smartComponentInstances: Object.fromEntries(Object.entries(project.model?.smartComponentInstances || {}).map(([id, instance]) => [id, clone(instance)]))
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
  const zone = zoneId ? project.model.connectionZones?.[zoneId] : null;
  if (isSmartComponentGeneratedHelper(zone, smartComponent.id)) ids.push(zone.id);
  for (const interfaceId of zone?.interfaceIds || []) {
    if (isSmartComponentGeneratedHelper(project.model.interfaces?.[interfaceId], smartComponent.id)) ids.push(interfaceId);
  }
  if (assemblyId && isSmartComponentGeneratedHelper(project.model.assemblies?.[assemblyId], smartComponent.id)) ids.push(assemblyId);
  return unique(ids);
}

function smartComponentRoleForObject(smartComponent, objectId) {
  for (const [role, value] of Object.entries(smartComponent.objectRoles || {})) {
    if (flattenIds(value).includes(objectId)) return role;
  }
  return null;
}

function smartComponentManagingObject(project, objectId) {
  const collection = objectCollection(project, objectId);
  const object = collection ? project.model[collection]?.[objectId] : null;
  const instanceId = object?.authoring?.componentInstanceId;
  if (!instanceId || !["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return null;
  const instance = project.model.smartComponentInstances?.[instanceId];
  if (!instance || !smartComponentOwnedObjectIds(instance).includes(objectId)) return null;
  return instance;
}

function changedObjectPatch(before, after) {
  const patch = {};
  for (const [key, value] of Object.entries(after || {})) {
    if (["id", "type", "authoring"].includes(key)) continue;
    if (JSON.stringify(before?.[key]) !== JSON.stringify(value)) patch[key] = clone(value);
  }
  return patch;
}

function recordSmartComponentFieldOverride(project, beforeObject, afterObject) {
  const instance = smartComponentManagingObject(project, afterObject?.id);
  if (!instance) return;
  const patch = changedObjectPatch(beforeObject, afterObject);
  if (!Object.keys(patch).length) return;
  instance.fieldOverrides ||= {};
  instance.fieldOverrides[afterObject.id] = mergePatch(instance.fieldOverrides[afterObject.id] || {}, patch);
  instance.managedFields ||= {};
  instance.managedFields[afterObject.id] = unique([
    ...(Array.isArray(instance.managedFields[afterObject.id]) ? instance.managedFields[afterObject.id] : []),
    ...Object.keys(instance.fieldOverrides[afterObject.id] || {})
  ]);
}

function appendMemberToDefaultGroup(project, memberId) {
  const group = Object.values(project.model.groups || {}).find((item) => item.type === "member-group" || item.groupType === "members");
  if (!group) return;
  group.memberIds = appendUnique(group.memberIds, memberId);
  group.objectIds = appendUnique(group.objectIds, memberId);
}

function upsertRelationObject(project, relation) {
  if (!relation?.id) fail("relation id is required");
  if (!relation.memberId) fail(`${relation.id}: relation memberId is required`);
  if (!project.model?.members?.[relation.memberId]) fail(`${relation.id}: relation member not found: ${relation.memberId}`);
  project.model ||= {};
  project.model.relations ||= {};
  project.objectIndex ||= {};
  const key = relationUpsertKey(relation);
  for (const existing of Object.values(project.model.relations)) {
    if (existing.id !== relation.id && relationUpsertKey(existing) === key) removeIndexedObject(project, existing.id);
  }
  const existingCollection = objectCollection(project, relation.id);
  if (existingCollection && existingCollection !== "relations") fail(`${relation.id}: relation id already used by ${existingCollection}`);
  project.model.relations[relation.id] = clone(relation);
  project.objectIndex[relation.id] = { collection: "relations", type: relation.type };
  return project.model.relations[relation.id];
}

function addMemberSnapRelations(project, memberId, options = {}) {
  if (options.autoAxisRelations === false) return;
  for (const [endpoint, snap] of [["start", options.startSnap], ["end", options.endSnap]]) {
    const relation = axisRelationFromSnap(memberId, endpoint, snap, { createdBy: "auto-snap" });
    if (relation) upsertRelationObject(project, relation);
  }
}

function normalizedIndexList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b);
}

function setIndexIncluded(values, index, included) {
  const current = new Set(normalizedIndexList(values));
  if (included) current.delete(index);
  else current.add(index);
  return [...current].sort((a, b) => a - b);
}

function optionalComponentRole(definition, role) {
  return (definition.components || []).some((component) => component?.role === role && component.default === "ghost");
}

function setRoleInList(list = [], role, active) {
  const current = new Set((Array.isArray(list) ? list : []).filter((value) => typeof value === "string"));
  if (active) current.add(role);
  else current.delete(role);
  return [...current].sort();
}

function smartComponentInput(instance, key) {
  return instance.inputs?.[key] || {};
}

function smartComponentMainMemberId(instance) {
  return smartComponentInput(instance, "main").memberId;
}

function smartComponentSecondaryMemberId(instance) {
  return smartComponentInput(instance, "secondary").memberId;
}

function smartComponentConnectionZoneId(instance) {
  return instance.inputs?.connectionZoneId;
}

function smartComponentAssemblyId(instance) {
  return instance.inputs?.assemblyId;
}

function componentFromFace(project, face) {
  if (!face?.objectId) return null;
  const smartComponent = Object.values(project.model.smartComponentInstances || {}).find((item) => smartComponentReferencesObject(item, face.objectId));
  if (!smartComponent) return null;
  const collection = objectCollection(project, face.objectId);
  if (!collection) return null;

  const objectRole = smartComponentRoleForObject(smartComponent, face.objectId);
  if (collection === "fastenerGroups" && Number.isInteger(face.positionIndex)) {
    const fastenerGroup = project.model.fastenerGroups?.[face.objectId];
    const patternRole = fastenerGroup?.holePatternRef ? smartComponentRoleForObject(smartComponent, fastenerGroup.holePatternRef) : null;
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
  const entry = project.objectIndex?.[iface.ownerId];
  if (entry?.collection !== "members") return null;
  const member = objectById(project, iface.ownerId);
  const axis = v.sub(member.end, member.start);
  const length = v.len(axis);
  if (length <= FIT_EPSILON) return null;
  const direction = v.mul(axis, 1 / length);
  return iface.memberEnd === "end" ? v.mul(direction, -1) : direction;
}

function interfaceReferencePoint(project, profiles, zone, interfaceId) {
  const otherId = (zone.interfaceIds || []).find((id) => id !== interfaceId);
  try {
    if (otherId) {
      const resolved = resolveInterface(project, profiles, otherId);
      const direction = memberDirectionFromInterface(project, resolved);
      return direction ? v.add(resolved.origin, v.mul(direction, 10)) : resolved.origin;
    }
  } catch (error) {
    if (!String(error.message || "").includes("stationReference requires a connection reference point")) throw error;
  }
  return Array.isArray(zone.origin) ? zone.origin : null;
}

function lockSmartComponentZoneFaces(project, profiles, smartComponentId, options = {}) {
  const next = options.inPlace ? project : clone(project);
  const smartComponent = smartComponentById(next, smartComponentId);
  const zoneId = smartComponentConnectionZoneId(smartComponent);
  if (!zoneId) return next;
  const zone = next.model.connectionZones?.[zoneId];
  if (!zone) fail(`${smartComponentId}: connection zone not found: ${zoneId}`);

  for (const interfaceId of zone.interfaceIds || []) {
    const iface = next.model.interfaces?.[interfaceId];
    if (!iface || iface.faceRef !== "connection-secondary-facing-section-face") continue;
    const referencePoint = interfaceReferencePoint(next, profiles, zone, interfaceId);
    const resolved = resolveInterface(next, profiles, interfaceId, referencePoint ? { referencePoint, preferReferencePoint: true } : {});
    if (!resolved.faceRef || resolved.faceRef === iface.faceRef) continue;
    next.model.interfaces[interfaceId] = {
      ...iface,
      faceRef: resolved.faceRef,
      semanticIntent: {
        ...(iface.semanticIntent || {}),
        sourceFaceRef: iface.faceRef
      }
    };
  }
  return next;
}

function lockGeneratedSmartComponentFaces(project, profiles) {
  let next = project;
  for (const smartComponent of Object.values(project.model.smartComponentInstances || {})) {
    if (smartComponent.status === "generated") next = lockSmartComponentZoneFaces(next, profiles, smartComponent.id, { inPlace: true });
  }
  return next;
}

function memberCenter(member) {
  return v.mul(v.add(member.start, member.end), 0.5);
}

function roundedDimension(value) {
  return Math.round(value * 1000) / 1000;
}

function smartComponentTolerance(project) {
  const tolerances = project.settings?.tolerances || {};
  return Math.max(
    tolerances.connectionGap || 0,
    tolerances.snap || 0,
    tolerances.coincident || 0
  ) || 25;
}

function axisGeometry(axis) {
  const vector = v.sub(axis.end, axis.start);
  const length = v.len(vector);
  if (length <= FIT_EPSILON) return null;
  return { ...axis, direction: v.mul(vector, 1 / length), length };
}

function projectedOnAxis(axisData, point) {
  const station = v.dot(v.sub(point, axisData.start), axisData.direction);
  const clampedStation = Math.min(axisData.length, Math.max(0, station));
  return {
    station,
    clampedStation,
    point: v.add(axisData.start, v.mul(axisData.direction, clampedStation))
  };
}

function memberSectionSpan(project, profiles, member) {
  const resolved = objectById(project, member.id);
  const profileId = resolved.profile || member.profile;
  if (!profileId) return 0;
  const bounds = sectionBounds(profileById(profiles, profileId));
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 0);
}

function layoutRepairTolerance(project, profiles, main, secondary) {
  return Math.max(
    smartComponentTolerance(project),
    memberSectionSpan(project, profiles, main),
    memberSectionSpan(project, profiles, secondary)
  ) * 1.25;
}

function canRepairLayoutAxis(member) {
  return member.authoring?.source === "viewer-command" || member.authoring?.command === "create-beam" || member.authoring?.command === "create-column";
}

function layoutRepairCandidate(project, profiles, main, secondary) {
  if (!canRepairLayoutAxis(secondary)) return null;
  const mainAxis = axisGeometry(memberLayoutAxis(main));
  const secondaryAxis = axisGeometry(memberLayoutAxis(secondary));
  if (!mainAxis || !secondaryAxis) return null;
  const tolerance = layoutRepairTolerance(project, profiles, main, secondary);
  let best = null;

  for (const endpoint of ["start", "end"]) {
    const point = secondaryAxis[endpoint];
    const projected = projectedOnAxis(mainAxis, point);
    if (projected.station < -tolerance || projected.station > mainAxis.length + tolerance) continue;
    const distance = v.len(v.sub(point, projected.point));
    if (distance > tolerance) continue;
    const offset = v.sub(projected.point, point);
    const candidate = {
      mainMemberId: main.id,
      secondaryMemberId: secondary.id,
      endpoint,
      offset,
      distance,
      station: projected.clampedStation,
      score: distance
    };
    if (!best || candidate.score < best.score) best = candidate;
  }

  return best;
}

function applyLayoutAxisRepair(project, repair) {
  const next = clone(project);
  const member = memberById(next, repair.secondaryMemberId);
  const axis = memberLayoutAxis(member);
  member.layoutAxis = {
    start: v.add(axis.start, repair.offset),
    end: v.add(axis.end, repair.offset)
  };
  member.authoring = {
    ...(member.authoring || {}),
    layoutAxisRepair: {
      source: "smart-component-create",
      mainMemberId: repair.mainMemberId,
      endpoint: repair.endpoint,
      offset: repair.offset.map(roundedDimension)
    }
  };
  return next;
}

function smartComponentSeedProjects(project, profiles, memberIds) {
  const [firstId, secondId] = memberIds || [];
  const first = project.model.members?.[firstId];
  const second = project.model.members?.[secondId];
  if (!first || !second) return [project];

  const repairs = [
    layoutRepairCandidate(project, profiles, first, second),
    layoutRepairCandidate(project, profiles, second, first)
  ]
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  return [project, ...repairs.map((repair) => applyLayoutAxisRepair(project, repair))];
}

export function createProjectStore({ project, profiles, smartComponentCatalog, fasteners, reconcileOnLoad = false, cloneOnLoad = true }) {
  const initialProject = cloneOnLoad ? clone(project) : project;
  let currentProject = lockGeneratedSmartComponentFaces(initialProject, profiles);
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
  const regenerateSmartComponent = (projectState, smartComponentId) => updateSmartComponent({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, smartComponentId),
    catalog: smartComponentCatalog,
    fasteners,
    instanceId: smartComponentId,
    parameters: smartComponentById(projectState, smartComponentId).referenceParameters
  });
  const updateSmartComponentParameters = (projectState, smartComponentId, parameters) => updateSmartComponent({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, smartComponentId),
    catalog: smartComponentCatalog,
    fasteners,
    instanceId: smartComponentId,
    parameters
  });
  const regenerateMemberSmartComponents = (projectState, memberId) => {
    const smartComponentIds = affectedSmartComponentsForMember(projectState, memberId)
      .filter((smartComponent) => smartComponent.status === "generated")
      .map((smartComponent) => smartComponent.id);
    if (!smartComponentIds.length) return projectState;
    return updateSmartComponents({
      project: projectState,
      profiles,
      definitionFor,
      catalog: smartComponentCatalog,
      fasteners,
      instanceIds: smartComponentIds,
      parametersFor: (state, smartComponentId) => smartComponentById(state, smartComponentId).referenceParameters
    });
  };
  const regenerateSmartComponentsBatch = (projectState, smartComponentIds) => {
    const ids = smartComponentIds.filter((smartComponentId) => projectState.model.smartComponentInstances?.[smartComponentId]);
    if (!ids.length) return projectState;
    return updateSmartComponents({
      project: projectState,
      profiles,
      definitionFor,
      catalog: smartComponentCatalog,
      fasteners,
      instanceIds: ids
    });
  };
  const generatedSmartComponentIds = (projectState) => Object.values(projectState.model.smartComponentInstances || {})
    .filter((smartComponent) => smartComponent.status === "generated")
    .map((smartComponent) => smartComponent.id);
  const secondaryInterface = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const definition = definitionFor(projectState, smartComponentId);
    const secondaryIndex = definition.interfaces.findIndex((entry) => entry.role === "secondary");
    if (secondaryIndex < 0) fail(`${smartComponentId}: definition has no secondary interface`);
    const zoneId = smartComponentConnectionZoneId(smartComponent);
    const interfaceId = projectState.model.connectionZones?.[zoneId]?.interfaceIds?.[secondaryIndex];
    if (!interfaceId) fail(`${smartComponentId}: connection zone missing secondary interface`);
    return projectState.model.interfaces?.[interfaceId] || fail(`${smartComponentId}: secondary interface not found: ${interfaceId}`);
  };
  const memberTrimJoint = (projectState, smartComponent) => {
    const roleId = smartComponent.objectRoles?.beamTrim;
    const secondaryMemberId = smartComponentSecondaryMemberId(smartComponent);
    if (roleId && projectState.model.trimJoints?.[roleId]?.type === "member-trim") return projectState.model.trimJoints[roleId];
    return smartComponentOwnedObjectIds(smartComponent)
      .map((id) => projectState.model.trimJoints?.[id])
      .find((trimJoint) => trimJoint?.type === "member-trim" && (trimJoint.participants || []).some((participant) => participant.memberId === secondaryMemberId)) || null;
  };
  const markSmartComponentError = (projectState, smartComponentId, code, message, objectRoles = []) => {
    const smartComponent = projectState.model.smartComponentInstances?.[smartComponentId];
    if (!smartComponent) return;
    const diagnostics = smartComponent.diagnostics || [];
    Object.assign(smartComponent, {
      health: "error",
      diagnostics: diagnostics.some((entry) => entry.code === code)
        ? diagnostics
        : [...diagnostics, { severity: "error", code, message, objectRoles }]
    });
    for (const id of smartComponentOwnedObjectIds(smartComponent)) {
      for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
        const object = projectState.model[collection]?.[id];
        if (object) object.display = { ...(object.display || {}), ...DIAGNOSTIC_DISPLAY };
      }
    }
  };
  const fitMemberEndToTrimPlane = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const trimJoint = memberTrimJoint(projectState, smartComponent);
    const secondaryMemberId = smartComponentSecondaryMemberId(smartComponent);
    if (!trimJoint) return false;
    const operation = (trimJoint.operations || []).find((item) => item.enabled !== false && item.type === "plane-trim" && item.memberAId === secondaryMemberId);
    if (!operation) return false;
    if (!Array.isArray(operation.referencePlaneIds) || operation.referencePlaneIds.length !== 1) {
      markSmartComponentError(projectState, smartComponentId, "beam-trim-plane-count", "Generated member trim requires exactly one trim plane.", ["beamTrim"]);
      return false;
    }
    const iface = secondaryInterface(projectState, smartComponentId);
    const memberEnd = iface.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") return false;

    const member = projectState.model.members?.[secondaryMemberId];
    if (!member) fail(`${smartComponentId}: secondary member not found: ${secondaryMemberId}`);
    const plane = requiredReferencePlane(projectState, operation.referencePlaneIds[0], `${trimJoint.id}:${operation.id}`, fail);
    const normal = v.norm(vec3(plane.normal, `${trimJoint.id}.${operation.id}.referencePlane.normal`));
    const origin = vec3(plane.origin, `${trimJoint.id}.${operation.id}.referencePlane.origin`);
    const axis = v.sub(member.end, member.start);
    const denominator = v.dot(normal, axis);
    if (Math.abs(denominator) <= FIT_EPSILON) {
      markSmartComponentError(projectState, smartComponentId, "member-axis-parallel-to-trim-plane", "Secondary member axis does not intersect the trim plane.", ["beamTrim"]);
      return false;
    }

    const t = v.dot(normal, v.sub(origin, member.start)) / denominator;
    const fittedPoint = v.add(member.start, v.mul(axis, t));
    if (memberEnd === "start") {
      if (almostSamePoint(member.start, fittedPoint)) return false;
      member.start = fittedPoint;
      return true;
    }
    if (almostSamePoint(member.end, fittedPoint)) return false;
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
        if (next.model.smartComponentInstances?.[smartComponentId]) changed = fitMemberEndToTrimPlane(next, smartComponentId) || changed;
      }
      if (!changed) return next;
    }
    return regenerateSmartComponentsBatch(next, ids);
  };
  const applyResolveHint = (parameters, hint) => {
    if (!hint?.path || typeof hint.value !== "number" || !Number.isFinite(hint.value)) return false;
    const current = optionalPath(parameters, hint.path);
    if (typeof current !== "number" || !Number.isFinite(current)) return false;
    const value = roundedDimension(hint.value);
    if (value <= 0) return false;
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
      const diagnostics = smartComponent.diagnostics || [];
      const parameters = clone(smartComponent.referenceParameters);
      let iterationChanged = false;
      for (const diagnostic of diagnostics) {
        for (const hint of diagnostic.resolve || []) {
          iterationChanged = applyResolveHint(parameters, hint) || iterationChanged;
        }
      }
      if (!iterationChanged) break;
      next = reconcileGeneratedSmartComponents(updateSmartComponentParameters(next, smartComponentId, parameters));
      changed = true;
      if (!(smartComponentById(next, smartComponentId).diagnostics || []).length) break;
    }
    if (!changed) fail(`${smartComponentId}: no automatic resolver is available for current diagnostics`);
    return setProject(next);
  };
  const replaceMember = (memberId, update, options = {}) => {
    const next = cloneProjectForMemberUpdate(currentProject, memberId);
    const member = memberById(next, memberId);
    const updated = update(member);
    next.model.members[memberId] = updated;
    if (options.recordSmartComponentOverride !== false) {
      recordSmartComponentFieldOverride(next, member, updated);
    }
    if (options.regenerateSmartComponents === false) return setProject(next);
    return setProject(regenerateMemberSmartComponents(next, memberId));
  };
  const replaceFeature = (featureId, update) => {
    const next = cloneProjectForFeatureUpdate(currentProject, featureId);
    const feature = featureById(next, featureId);
    const updated = update(feature);
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("feature update must return an object");
    if (updated.id !== featureId) fail("feature id cannot be changed");
    if (updated.ownerId !== feature.ownerId) fail("feature owner cannot be changed");
    if (updated.type !== feature.type) fail("feature type cannot be changed");
    next.model.features[featureId] = updated;
    next.objectIndex[featureId] = {
      ...(next.objectIndex[featureId] || {}),
      collection: "features",
      type: updated.type
    };
    return setProject(next);
  };
  const replaceReferencePlane = (referencePlaneId, update) => {
    const next = cloneProjectForReferencePlaneUpdate(currentProject);
    const plane = referencePlaneById(next, referencePlaneId);
    const updated = update(plane);
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("reference plane update must return an object");
    if (updated.id !== referencePlaneId) fail("reference plane id cannot be changed");
    next.model.referencePlanes[referencePlaneId] = updated;
    next.objectIndex[referencePlaneId] = {
      ...(next.objectIndex[referencePlaneId] || {}),
      collection: "referencePlanes",
      type: updated.type || "reference-plane"
    };
    return setProject(next);
  };
  const replaceTrimJoint = (trimJointId, update) => {
    const next = cloneProjectForTrimJointUpdate(currentProject, trimJointId);
    const trimJoint = trimJointById(next, trimJointId);
    const updated = update(trimJoint);
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("trim joint update must return an object");
    if (updated.id !== trimJointId) fail("trim joint id cannot be changed");
    if (updated.type !== trimJoint.type) fail("trim joint type cannot be changed");
    next.model.trimJoints[trimJointId] = updated;
    next.objectIndex[trimJointId] = {
      ...(next.objectIndex[trimJointId] || {}),
      collection: "trimJoints",
      type: updated.type
    };
    return setProject(next);
  };
  const replaceFastenerGroup = (fastenerGroupId, update) => {
    const next = cloneProjectForFastenerGroupUpdate(currentProject);
    const fastenerGroup = clone(fastenerGroupById(next, fastenerGroupId));
    const updated = update(clone(fastenerGroup));
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("fastener group update must return an object");
    if (updated.id !== fastenerGroupId) fail("fastener group id cannot be changed");
    if (updated.type !== fastenerGroup.type) fail("fastener group type cannot be changed");
    validateFastenerGroup(fasteners, updated);
    next.model.fastenerGroups[fastenerGroupId] = updated;
    next.objectIndex[fastenerGroupId] = {
      ...(next.objectIndex[fastenerGroupId] || {}),
      collection: "fastenerGroups",
      type: updated.type
    };
    recordSmartComponentFieldOverride(next, fastenerGroup, updated);
    return setProject(next);
  };

  if (reconcileOnLoad) currentProject = reconcileGeneratedSmartComponents(currentProject);

  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    project() {
      return currentProject;
    },

    object(objectId) {
      if (!currentProject.objectIndex?.[objectId]) fail(`object not found: ${objectId}`);
      return objectById(currentProject, objectId);
    },

    member(memberId) {
      memberById(currentProject, memberId);
      return objectById(currentProject, memberId);
    },

    smartComponent(smartComponentId) {
      return smartComponentById(currentProject, smartComponentId);
    },

    trimJoint(trimJointId) {
      return trimJointById(currentProject, trimJointId);
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

    componentFromFace(face) {
      return componentFromFace(currentProject, face);
    },

    toggleSmartComponentRoleFromFace(face) {
      const component = componentFromFace(currentProject, face);
      if (!component) return null;
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, component.smartComponentId);

      let included = true;
      if (component.kind === "pattern-position") {
        smartComponent.suppressedPatternPositions ||= {};
        const current = smartComponent.suppressedPatternPositions[component.patternRole] || [];
        included = current.includes(component.positionIndex);
        const nextList = setIndexIncluded(current, component.positionIndex, included);
        if (nextList.length) smartComponent.suppressedPatternPositions[component.patternRole] = nextList;
        else delete smartComponent.suppressedPatternPositions[component.patternRole];
      } else if (component.kind === "object-role") {
        const definition = definitionFor(next, component.smartComponentId);
        if (!(definition.components || []).some((entry) => entry?.role === component.objectRole)) fail(`${component.smartComponentId}: unknown component role ${component.objectRole}`);
        const current = new Set(smartComponent.suppressedRoles || []);
        included = current.has(component.objectRole);
        if (included) current.delete(component.objectRole);
        else current.add(component.objectRole);
        smartComponent.suppressedRoles = [...current].sort();
      }

      const updated = setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(next, component.smartComponentId)));
      return { project: updated, component, included };
    },

    smartComponentObjectIds(smartComponentId) {
      return smartComponentObjectIds(currentProject, smartComponentById(currentProject, smartComponentId));
    },

    resetSmartComponentFieldOverride(smartComponentId, objectId, field) {
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, smartComponentId);
      if (smartComponent.fieldOverrides?.[objectId]) {
        delete smartComponent.fieldOverrides[objectId][field];
        if (!Object.keys(smartComponent.fieldOverrides[objectId]).length) delete smartComponent.fieldOverrides[objectId];
      }
      if (smartComponent.managedFields?.[objectId]) {
        smartComponent.managedFields[objectId] = smartComponent.managedFields[objectId].filter((value) => value !== field);
        if (!smartComponent.managedFields[objectId].length) delete smartComponent.managedFields[objectId];
      }
      return setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(next, smartComponentId)));
    },

    resetSmartComponentObjectOverrides(smartComponentId, objectId) {
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, smartComponentId);
      if (smartComponent.fieldOverrides) delete smartComponent.fieldOverrides[objectId];
      if (smartComponent.managedFields) delete smartComponent.managedFields[objectId];
      return setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(next, smartComponentId)));
    },

    detachSmartComponentObject(smartComponentId, objectId) {
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, smartComponentId);
      if (!smartComponentOwnedObjectIds(smartComponent).includes(objectId)) fail(`${objectId}: object is not owned by ${smartComponentId}`);
      const collection = objectCollection(next, objectId);
      const object = collection ? next.model[collection]?.[objectId] : null;
      if (!object) fail(`object not found: ${objectId}`);
      smartComponent.detachedObjectIds = unique([...(smartComponent.detachedObjectIds || []), objectId]);
      object.authoring = { ...(object.authoring || {}), componentStatus: "detached" };
      return setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(next, smartComponentId)));
    },

    reattachSmartComponentObject(smartComponentId, objectId) {
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, smartComponentId);
      smartComponent.detachedObjectIds = (smartComponent.detachedObjectIds || []).filter((id) => id !== objectId);
      if (smartComponent.fieldOverrides) delete smartComponent.fieldOverrides[objectId];
      if (smartComponent.managedFields) delete smartComponent.managedFields[objectId];
      const cleaned = removeObjects(next, [objectId]);
      return setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(cleaned, smartComponentId)));
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
      if (catalog === "fasteners") return fasteners.fasteners || {};
      return {};
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
      let created = null;
      let firstError = null;
      for (const seedProject of smartComponentSeedProjects(currentProject, profiles, memberIds)) {
        try {
          created = createProjectSmartComponentFromPreset(seedProject, smartComponentCatalog, presetId, memberIds, { definition });
          break;
        } catch (error) {
          firstError ||= error;
          if (!String(firstError.message || "").includes("layout axes do not intersect")) break;
        }
      }
      if (!created) throw firstError;
      const locked = lockSmartComponentZoneFaces(created.project, profiles, created.smartComponentId);
      const next = reconcileGeneratedSmartComponents(regenerateSmartComponent(locked, created.smartComponentId));
      setProject(next);
      return { project: currentProject, smartComponentId: created.smartComponentId };
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
      const next = clone(currentProject);
      const smartComponent = smartComponentById(next, smartComponentId);
      const definition = definitionFor(next, smartComponentId);
      if (!(definition.components || []).some((component) => component?.role === role)) fail(`${smartComponentId}: unknown component role ${role}`);
      smartComponent.suppressedRoles = setRoleInList(smartComponent.suppressedRoles, role, !active);
      return setProject(reconcileGeneratedSmartComponents(regenerateSmartComponent(next, smartComponentId)));
    },

    setSmartComponentPlateIncluded(smartComponentId, plateId, included) {
      return setProject(setProjectSmartComponentPlateIncluded(currentProject, definitionFor(currentProject, smartComponentId), smartComponentId, plateId, included));
    },

    resolveSmartComponentDiagnostics,

    updateSmartComponent(smartComponentId, parameters) {
      return setProject(reconcileGeneratedSmartComponents(updateSmartComponent({
        project: currentProject,
        profiles,
        definition: definitionFor(currentProject, smartComponentId),
        catalog: smartComponentCatalog,
        fasteners,
        instanceId: smartComponentId,
        parameters
      })));
    },

    createMember(options = {}) {
      const next = clone(currentProject);
      const member = createMemberObject(next, profiles, options);
      addIndexedObject(next, "members", member);
      addMemberSnapRelations(next, member.id, options);
      appendMemberToDefaultGroup(next, member.id);
      const updated = setProject(reconcileGeneratedSmartComponents(next));
      return { project: updated, memberId: member.id, member: updated.model.members[member.id] };
    },

    createTrimJoint(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("trim joint options must be an object");
      const memberIds = unique(options.memberIds || []);
      for (const memberId of memberIds) memberById(currentProject, memberId);
      const operationPatch = clone(options.operationPatch || {});
      const operationType = operationPatch.type || options.operationType || "end-butt-both";
      if (operationType !== "plane-trim" && memberIds.length < 2) fail("member-to-member trim requires two members");
      if (operationType === "plane-trim" && memberIds.length < 1) fail("plane trim requires one member");

      const next = clone(currentProject);
      const id = nextObjectId(next, options.id || `trim_${memberIds.join("_") || "joint"}`);
      let trimJoint = {
        id,
        type: operationType === "plane-trim" ? "member-trim" : "corner-trim",
        gap: 0,
        participants: [],
        operations: [],
        ...(plainObject(options.patch) ? clone(options.patch) : {})
      };
      trimJoint.id = id;
      trimJoint.type = operationType === "plane-trim" ? "member-trim" : "corner-trim";
      for (const memberId of memberIds) {
        trimJoint.participants.push(defaultTrimJointParticipant(next, trimJoint, memberId));
      }

      const operation = defaultTrimJointOperation(trimJoint, {
        type: operationType,
        memberAId: operationPatch.memberAId || memberIds[0],
        memberBId: operationType === "plane-trim" ? undefined : operationPatch.memberBId || memberIds[1],
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
      if (!currentProject.model.members?.[memberId]) fail(`member not found: ${memberId}`);
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
      if (!currentProject.model.relations?.[relationId]) fail(`relation not found: ${relationId}`);
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

    updateTrimJointParticipant(trimJointId, memberId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint participant patch must be an object");
      if ("memberId" in patch && patch.memberId !== memberId) fail("participant member cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = (trimJoint.participants || []).map((participant) => (
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
        if ((trimJoint.participants || []).some((participant) => participant.memberId === memberId)) {
          fail(`${trimJointId}: participant already exists: ${memberId}`);
        }
        return {
          ...trimJoint,
          participants: [
            ...(trimJoint.participants || []),
            defaultTrimJointParticipant(currentProject, trimJoint, memberId, patch)
          ]
        };
      });
    },

    removeTrimJointParticipant(trimJointId, memberId) {
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const participants = (trimJoint.participants || []).filter((participant) => participant.memberId !== memberId);
        if (participants.length === (trimJoint.participants || []).length) fail(`${trimJointId}: participant not found: ${memberId}`);
        if (!participants.length) fail(`${trimJointId}: trim requires at least one participant`);
        const operations = (trimJoint.operations || []).filter((operation) => (
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
        if ((trimJoint.operations || []).some((item) => item.id === operation.id)) fail(`${trimJointId}: operation already exists: ${operation.id}`);
        return { ...trimJoint, operations: [...(trimJoint.operations || []), operation] };
      });
    },

    updateTrimJointOperation(trimJointId, operationId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("trim joint operation patch must be an object");
      if ("id" in patch && patch.id !== operationId) fail("trim joint operation id cannot be changed");
      return replaceTrimJoint(trimJointId, (trimJoint) => {
        const operations = (trimJoint.operations || []).map((operation) => {
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
        const operations = (nextTrimJoint.operations || []).map((operation) => {
          if (operation.id !== operationId) return operation;
          found = true;
          const patch = role === "memberA" ? { memberAId: memberId } : { memberBId: memberId };
          if (trimOperationUsesMemberEnd(operation.type || "end-butt-1", role)) {
            patch[`${role}End`] = nearestMemberEnd(memberById(currentProject, memberId), trimJointReferencePoint(currentProject, nextTrimJoint));
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
        const operations = (trimJoint.operations || []).filter((operation) => operation.id !== operationId);
        if (operations.length === (trimJoint.operations || []).length) fail(`${trimJointId}: operation not found: ${operationId}`);
        return { ...trimJoint, operations };
      });
    },

    setFeatureOperationEnabled(featureId, enabled) {
      if (typeof enabled !== "boolean") fail("feature enabled state must be boolean");
      return replaceFeature(featureId, (feature) => ({ ...feature, operationEnabled: enabled }));
    },

    setReferencePlane(referencePlaneId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("reference plane patch must be an object");
      return replaceReferencePlane(referencePlaneId, (plane) => mergePatch(plane, patch));
    },

    setFeatureBody(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature body patch must be an object");
      return replaceFeature(featureId, (feature) => ({ ...feature, body: mergePatch(feature.body || {}, patch) }));
    },

    setFeatureSource(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature source patch must be an object");
      return replaceFeature(featureId, (feature) => ({ ...feature, source: mergePatch(feature.source || {}, patch) }));
    },

    setMemberProfile(memberId, profileId) {
      profileById(profiles, profileId);
      return replaceMember(memberId, (member) => ({ ...member, profile: profileId }));
    },

    setMemberRotation(memberId, rotation) {
      if (typeof rotation !== "number" || !Number.isFinite(rotation)) fail("member rotation must be a finite number");
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    rotateMember(memberId, deltaDegrees) {
      if (typeof deltaDegrees !== "number" || !Number.isFinite(deltaDegrees)) fail("rotation delta must be a finite number");
      const rotation = (objectById(currentProject, memberId).rotation || 0) + deltaDegrees;
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
      const next = cloneProjectForMemberUpdate(currentProject, memberId);
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
