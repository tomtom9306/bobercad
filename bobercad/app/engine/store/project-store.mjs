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
  affectedConnectionsForMember,
  affectedConnectionIdsForMember,
  connectionObjectIds,
  connectionOwnedObjectIds,
  connectionReferencesObject,
  featureDependencyObjectIds as projectFeatureDependencyObjectIds,
  flattenIds,
  memberDependencyObjectIds as projectMemberDependencyObjectIds,
  objectCollection,
  referencePlaneDependencyObjectIds as projectReferencePlaneDependencyObjectIds,
  trimJointDependencyObjectIds as projectTrimJointDependencyObjectIds
} from "../api/project/dependencies.mjs";
import {
  memberLayoutAxis,
  moveMemberWithLayout as moveMemberWithLayoutData,
  setMemberLayoutEndpoint as setMemberLayoutEndpointData,
  setMemberPhysicalEndpoint as setMemberPhysicalEndpointData
} from "../api/project/members.mjs";
import {
  optionalPath,
  setPath
} from "../modules/connections/connection-schema.mjs";
import {
  clone,
  connectionById,
  connectionComponentOptions as projectConnectionComponentOptions,
  connectionPlateOptions as projectConnectionPlateOptions,
  createProjectConnectionFromPreset,
  setConnectionPlateIncluded as setProjectConnectionPlateIncluded,
  updateConnection,
  updateConnections
} from "../modules/connections/connection-generator.mjs";
import { connectionDefinition, supportedConnectionPresets, supportedConnections } from "../modules/connections/connection-registry.mjs";

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
  "connectionIds"
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

function isConnectionGeneratedHelper(object, connectionId) {
  return object?.authoring?.generatedBy === connectionId && object.authoring?.lifecycle === "delete-with-connection";
}

function connectionGeneratedHelperIds(project, connection) {
  const ids = [];
  const zone = project.model.connectionZones?.[connection.connectionZoneId];
  if (isConnectionGeneratedHelper(zone, connection.id)) ids.push(zone.id);
  for (const interfaceId of zone?.interfaceIds || []) {
    if (isConnectionGeneratedHelper(project.model.interfaces?.[interfaceId], connection.id)) ids.push(interfaceId);
  }
  if (isConnectionGeneratedHelper(project.model.assemblies?.[connection.assemblyId], connection.id)) ids.push(connection.assemblyId);
  return unique(ids);
}

function connectionRoleForObject(connection, objectId) {
  for (const [role, value] of Object.entries(connection.generator?.objectRoles || {})) {
    if (flattenIds(value).includes(objectId)) return role;
  }
  return null;
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

function componentFromFace(project, face) {
  if (!face?.objectId) return null;
  const connection = Object.values(project.model.connections || {}).find((item) => connectionReferencesObject(item, face.objectId));
  if (!connection) return null;
  const collection = objectCollection(project, face.objectId);
  if (!collection) return null;

  const objectRole = connectionRoleForObject(connection, face.objectId);
  if (collection === "fastenerGroups" && Number.isInteger(face.positionIndex)) {
    const fastenerGroup = project.model.fastenerGroups?.[face.objectId];
    const patternRole = fastenerGroup?.holePatternRef ? connectionRoleForObject(connection, fastenerGroup.holePatternRef) : null;
    if (patternRole) {
      return {
        kind: "pattern-position",
        connectionId: connection.id,
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
    connectionId: connection.id,
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

function lockConnectionZoneFaces(project, profiles, connectionId, options = {}) {
  const next = options.inPlace ? project : clone(project);
  const connection = connectionById(next, connectionId);
  const zone = next.model.connectionZones?.[connection.connectionZoneId];
  if (!zone) fail(`${connectionId}: connection zone not found: ${connection.connectionZoneId}`);

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

function lockGeneratedConnectionFaces(project, profiles) {
  let next = project;
  for (const connection of Object.values(project.model.connections || {})) {
    if (connection.generator?.status === "generated") next = lockConnectionZoneFaces(next, profiles, connection.id, { inPlace: true });
  }
  return next;
}

function memberCenter(member) {
  return v.mul(v.add(member.start, member.end), 0.5);
}

function roundedDimension(value) {
  return Math.round(value * 1000) / 1000;
}

function connectionTolerance(project) {
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
    connectionTolerance(project),
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
      source: "connection-create",
      mainMemberId: repair.mainMemberId,
      endpoint: repair.endpoint,
      offset: repair.offset.map(roundedDimension)
    }
  };
  return next;
}

function connectionSeedProjects(project, profiles, memberIds) {
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

export function createProjectStore({ project, profiles, connectionCatalog, fasteners, reconcileOnLoad = false, cloneOnLoad = true }) {
  const initialProject = cloneOnLoad ? clone(project) : project;
  let currentProject = lockGeneratedConnectionFaces(initialProject, profiles);
  const subscribers = new Set();

  const definitionFor = (projectState, connectionId) => connectionDefinition(connectionCatalog, connectionById(projectState, connectionId));
  const emit = () => {
    for (const subscriber of subscribers) subscriber(currentProject);
  };
  const setProject = (nextProject) => {
    currentProject = nextProject;
    emit();
    return currentProject;
  };
  const regenerateConnection = (projectState, connectionId) => updateConnection({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, connectionId),
    connectionCatalog,
    fasteners,
    connectionId,
    parameters: connectionById(projectState, connectionId).referenceParameters
  });
  const updateConnectionParameters = (projectState, connectionId, parameters) => updateConnection({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, connectionId),
    connectionCatalog,
    fasteners,
    connectionId,
    parameters
  });
  const regenerateMemberConnections = (projectState, memberId) => {
    const connectionIds = affectedConnectionsForMember(projectState, memberId)
      .filter((connection) => connection.generator?.status === "generated")
      .map((connection) => connection.id);
    if (!connectionIds.length) return projectState;
    return updateConnections({
      project: projectState,
      profiles,
      definitionFor,
      connectionCatalog,
      fasteners,
      connectionIds,
      parametersFor: (state, connectionId) => connectionById(state, connectionId).referenceParameters
    });
  };
  const regenerateConnectionsBatch = (projectState, connectionIds) => {
    const ids = connectionIds.filter((connectionId) => projectState.model.connections?.[connectionId]);
    if (!ids.length) return projectState;
    return updateConnections({
      project: projectState,
      profiles,
      definitionFor,
      connectionCatalog,
      fasteners,
      connectionIds: ids
    });
  };
  const generatedConnectionIds = (projectState) => Object.values(projectState.model.connections || {})
    .filter((connection) => connection.generator?.status === "generated")
    .map((connection) => connection.id);
  const secondaryInterface = (projectState, connectionId) => {
    const connection = connectionById(projectState, connectionId);
    const definition = definitionFor(projectState, connectionId);
    const secondaryIndex = definition.interfaces.findIndex((entry) => entry.role === "secondary");
    if (secondaryIndex < 0) fail(`${connectionId}: definition has no secondary interface`);
    const interfaceId = projectState.model.connectionZones?.[connection.connectionZoneId]?.interfaceIds?.[secondaryIndex];
    if (!interfaceId) fail(`${connectionId}: connection zone missing secondary interface`);
    return projectState.model.interfaces?.[interfaceId] || fail(`${connectionId}: secondary interface not found: ${interfaceId}`);
  };
  const memberTrimJoint = (projectState, connection) => {
    const roleId = connection.generator?.objectRoles?.beamTrim;
    if (roleId && projectState.model.trimJoints?.[roleId]?.type === "member-trim") return projectState.model.trimJoints[roleId];
    return connectionOwnedObjectIds(connection)
      .map((id) => projectState.model.trimJoints?.[id])
      .find((trimJoint) => trimJoint?.type === "member-trim" && (trimJoint.participants || []).some((participant) => participant.memberId === connection.secondaryMemberId)) || null;
  };
  const markConnectionError = (projectState, connectionId, code, message, objectRoles = []) => {
    const connection = projectState.model.connections?.[connectionId];
    if (!connection) return;
    const diagnostics = connection.generator?.diagnostics || [];
    connection.generator = {
      ...(connection.generator || {}),
      health: "error",
      diagnostics: diagnostics.some((entry) => entry.code === code)
        ? diagnostics
        : [...diagnostics, { severity: "error", code, message, objectRoles }]
    };
    for (const id of connectionOwnedObjectIds(connection)) {
      for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
        const object = projectState.model[collection]?.[id];
        if (object) object.display = { ...(object.display || {}), ...DIAGNOSTIC_DISPLAY };
      }
    }
  };
  const fitMemberEndToTrimPlane = (projectState, connectionId) => {
    const connection = connectionById(projectState, connectionId);
    const trimJoint = memberTrimJoint(projectState, connection);
    if (!trimJoint) return false;
    const operation = (trimJoint.operations || []).find((item) => item.enabled !== false && item.type === "plane-trim" && item.memberAId === connection.secondaryMemberId);
    if (!operation) return false;
    if (!Array.isArray(operation.referencePlaneIds) || operation.referencePlaneIds.length !== 1) {
      markConnectionError(projectState, connectionId, "beam-trim-plane-count", "Generated member trim requires exactly one trim plane.", ["beamTrim"]);
      return false;
    }
    const iface = secondaryInterface(projectState, connectionId);
    const memberEnd = iface.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") return false;

    const member = projectState.model.members?.[connection.secondaryMemberId];
    if (!member) fail(`${connectionId}: secondary member not found: ${connection.secondaryMemberId}`);
    const plane = requiredReferencePlane(projectState, operation.referencePlaneIds[0], `${trimJoint.id}:${operation.id}`, fail);
    const normal = v.norm(vec3(plane.normal, `${trimJoint.id}.${operation.id}.referencePlane.normal`));
    const origin = vec3(plane.origin, `${trimJoint.id}.${operation.id}.referencePlane.origin`);
    const axis = v.sub(member.end, member.start);
    const denominator = v.dot(normal, axis);
    if (Math.abs(denominator) <= FIT_EPSILON) {
      markConnectionError(projectState, connectionId, "member-axis-parallel-to-trim-plane", "Secondary member axis does not intersect the trim plane.", ["beamTrim"]);
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
  const reconcileGeneratedConnections = (projectState, iterations = 4) => {
    let next = projectState;
    const ids = generatedConnectionIds(next);
    for (let index = 0; index < iterations; index += 1) {
      next = regenerateConnectionsBatch(next, ids);
      let changed = false;
      for (const connectionId of ids) {
        if (next.model.connections?.[connectionId]) changed = fitMemberEndToTrimPlane(next, connectionId) || changed;
      }
      if (!changed) return next;
    }
    return regenerateConnectionsBatch(next, ids);
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
  const resolveConnectionDiagnostics = (connectionId) => {
    let next = currentProject;
    let changed = false;
    for (let index = 0; index < 4; index += 1) {
      const connection = connectionById(next, connectionId);
      const diagnostics = connection.generator?.diagnostics || [];
      const parameters = clone(connection.referenceParameters);
      let iterationChanged = false;
      for (const diagnostic of diagnostics) {
        for (const hint of diagnostic.resolve || []) {
          iterationChanged = applyResolveHint(parameters, hint) || iterationChanged;
        }
      }
      if (!iterationChanged) break;
      next = reconcileGeneratedConnections(updateConnectionParameters(next, connectionId, parameters));
      changed = true;
      if (!(connectionById(next, connectionId).generator?.diagnostics || []).length) break;
    }
    if (!changed) fail(`${connectionId}: no automatic resolver is available for current diagnostics`);
    return setProject(next);
  };
  const replaceMember = (memberId, update, options = {}) => {
    const next = cloneProjectForMemberUpdate(currentProject, memberId);
    const member = memberById(next, memberId);
    next.model.members[memberId] = update(member);
    if (options.regenerateConnections === false) return setProject(next);
    return setProject(regenerateMemberConnections(next, memberId));
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

  if (reconcileOnLoad) currentProject = reconcileGeneratedConnections(currentProject);

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

    connection(connectionId) {
      return connectionById(currentProject, connectionId);
    },

    trimJoint(trimJointId) {
      return trimJointById(currentProject, trimJointId);
    },

    connectionForObject(objectId) {
      return Object.values(currentProject.model.connections || {}).find((connection) => connectionReferencesObject(connection, objectId)) || null;
    },

    componentFromFace(face) {
      return componentFromFace(currentProject, face);
    },

    toggleConnectionComponentFromFace(face) {
      const component = componentFromFace(currentProject, face);
      if (!component) return null;
      const next = clone(currentProject);
      const connection = connectionById(next, component.connectionId);
      connection.componentOverrides ||= {};

      let included = true;
      if (component.kind === "pattern-position") {
        connection.componentOverrides.suppressedPatternPositions ||= {};
        const current = connection.componentOverrides.suppressedPatternPositions[component.patternRole] || [];
        included = current.includes(component.positionIndex);
        const nextList = setIndexIncluded(current, component.positionIndex, included);
        if (nextList.length) connection.componentOverrides.suppressedPatternPositions[component.patternRole] = nextList;
        else delete connection.componentOverrides.suppressedPatternPositions[component.patternRole];
      } else if (component.kind === "object-role") {
        const definition = definitionFor(next, component.connectionId);
        if (optionalComponentRole(definition, component.objectRole)) {
          const current = new Set(connection.componentOverrides.activeObjectRoles || []);
          included = !current.has(component.objectRole);
          if (included) current.add(component.objectRole);
          else current.delete(component.objectRole);
          connection.componentOverrides.activeObjectRoles = [...current].sort();
        } else {
          const current = new Set(connection.componentOverrides.suppressedObjectRoles || []);
          included = current.has(component.objectRole);
          if (included) current.delete(component.objectRole);
          else current.add(component.objectRole);
          connection.componentOverrides.suppressedObjectRoles = [...current].sort();
        }
      }

      const updated = setProject(reconcileGeneratedConnections(regenerateConnection(next, component.connectionId)));
      return { project: updated, component, included };
    },

    connectionObjectIds(connectionId) {
      return connectionObjectIds(currentProject, connectionById(currentProject, connectionId));
    },

    affectedConnectionIds(memberId) {
      memberById(currentProject, memberId);
      return affectedConnectionIdsForMember(currentProject, memberId);
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

    definition(connectionId) {
      return definitionFor(currentProject, connectionId);
    },

    supportedConnections() {
      return supportedConnections(currentProject, connectionCatalog);
    },

    connectionPresets() {
      return supportedConnectionPresets(connectionCatalog);
    },

    catalogEntries(catalog) {
      if (catalog === "fasteners") return fasteners.fasteners || {};
      return {};
    },

    createConnectionFromPreset(presetId, memberIds) {
      const preset = connectionCatalog.connections[presetId];
      if (!preset) fail(`connection preset not found: ${presetId}`);
      const definition = connectionDefinition(connectionCatalog, { type: preset.type, sourcePreset: { id: presetId } });
      let created = null;
      let firstError = null;
      for (const seedProject of connectionSeedProjects(currentProject, profiles, memberIds)) {
        try {
          created = createProjectConnectionFromPreset(seedProject, connectionCatalog, presetId, memberIds, { definition });
          break;
        } catch (error) {
          firstError ||= error;
          if (!String(firstError.message || "").includes("layout axes do not intersect")) break;
        }
      }
      if (!created) throw firstError;
      const locked = lockConnectionZoneFaces(created.project, profiles, created.connectionId);
      const next = reconcileGeneratedConnections(regenerateConnection(locked, created.connectionId));
      setProject(next);
      return { project: currentProject, connectionId: created.connectionId };
    },

    deleteConnection(connectionId) {
      const connection = connectionById(currentProject, connectionId);
      const ownedIds = connectionOwnedObjectIds(connection);
      const helperIds = connectionGeneratedHelperIds(currentProject, connection);
      return setProject(removeObjects(currentProject, [...ownedIds, ...helperIds, connectionId]));
    },

    connectionPlateOptions(connectionId) {
      return projectConnectionPlateOptions(currentProject, definitionFor(currentProject, connectionId), connectionId);
    },

    connectionComponentOptions(connectionId) {
      return projectConnectionComponentOptions(currentProject, definitionFor(currentProject, connectionId), connectionId);
    },

    setConnectionComponentActive(connectionId, role, active) {
      const next = clone(currentProject);
      const connection = connectionById(next, connectionId);
      const definition = definitionFor(next, connectionId);
      if (!(definition.components || []).some((component) => component?.role === role)) fail(`${connectionId}: unknown component role ${role}`);
      connection.componentOverrides ||= {};
      if (optionalComponentRole(definition, role)) {
        connection.componentOverrides.activeObjectRoles = setRoleInList(connection.componentOverrides.activeObjectRoles, role, active);
      } else {
        connection.componentOverrides.suppressedObjectRoles = setRoleInList(connection.componentOverrides.suppressedObjectRoles, role, !active);
      }
      return setProject(reconcileGeneratedConnections(regenerateConnection(next, connectionId)));
    },

    setConnectionPlateIncluded(connectionId, plateId, included) {
      return setProject(setProjectConnectionPlateIncluded(currentProject, definitionFor(currentProject, connectionId), connectionId, plateId, included));
    },

    resolveConnectionDiagnostics,

    updateConnection(connectionId, parameters) {
      return setProject(reconcileGeneratedConnections(updateConnection({
        project: currentProject,
        profiles,
        definition: definitionFor(currentProject, connectionId),
        connectionCatalog,
        fasteners,
        connectionId,
        parameters
      })));
    },

    createMember(options = {}) {
      const next = clone(currentProject);
      const member = createMemberObject(next, profiles, options);
      addIndexedObject(next, "members", member);
      addMemberSnapRelations(next, member.id, options);
      appendMemberToDefaultGroup(next, member.id);
      const updated = setProject(reconcileGeneratedConnections(next));
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
      return setProject(reconcileGeneratedConnections(next));
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

    regenerateMemberConnections(memberId) {
      memberById(currentProject, memberId);
      return setProject(regenerateMemberConnections(currentProject, memberId));
    },

    draftMemberProject(memberId, member, options = {}) {
      memberById(currentProject, memberId);
      const next = cloneProjectForMemberUpdate(currentProject, memberId);
      next.model.members[memberId] = clone(member);
      if (options.regenerateConnections === false) return next;
      return regenerateMemberConnections(next, memberId);
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
