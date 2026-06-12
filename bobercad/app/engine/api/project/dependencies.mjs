import { arrayValues, flattenIds, uniqueTruthy as unique } from "../../core/model.mjs?v=array-values-dry-1";
import { objectCollection } from "./objects.mjs?v=array-values-dry-1";
import { trimJointOperations, trimJointParticipants, trimOperationReferencePlaneIds } from "./trim-operations.mjs?v=geometry-api-array-values-dry-1";

const RENDER_COLLECTIONS = new Set(["members", "plates", "features", "trimJoints", "fastenerGroups", "welds"]);

function fail(message) {
  throw new Error(`project dependencies: ${message}`);
}

function filterProjectIds(project, ids, options = {}) {
  const collections = options.renderableOnly
    ? RENDER_COLLECTIONS
    : options.collections instanceof Set
      ? options.collections
      : Array.isArray(options.collections)
        ? new Set(options.collections)
        : null;
  return unique(ids).filter((id) => {
    const collection = objectCollection(project, id);
    if (!collection) return Boolean(options.includeMissing);
    return !collections || collections.has(collection);
  });
}

export function smartComponentDetachedObjectIds(instance) {
  const ids = instance.detachedObjectIds;
  if (ids === undefined) return [];
  if (!Array.isArray(ids)) fail(`${instance.id}: detachedObjectIds must be an array`);
  return ids;
}

export function smartComponentOwnedObjectIds(instance) {
  const owned = arrayValues(instance.ownedObjectIds);
  return unique([...owned, ...flattenIds(instance.objectRoles)]);
}

export function smartComponentObjectIds(project, instance, options = {}) {
  if (!instance) return [];
  const seen = options.seenSmartComponentIds instanceof Set ? options.seenSmartComponentIds : new Set();
  if (seen.has(instance.id)) fail(`${instance.id}: cyclic Smart Component object ownership`);
  seen.add(instance.id);
  const directIds = [
    instance.id,
    ...smartComponentOwnedObjectIds(instance),
    ...smartComponentDetachedObjectIds(instance)
  ];
  const childIds = directIds.flatMap((objectId) => {
    const child = objectId !== instance.id ? project.model?.smartComponentInstances?.[objectId] : null;
    return child ? smartComponentObjectIds(project, child, { ...options, seenSmartComponentIds: seen }) : [];
  });
  return filterProjectIds(project, [...directIds, ...childIds], options);
}

export function smartComponentRoot(project, instance) {
  let current = instance || null;
  const seen = new Set();
  while (current?.parentInstanceId) {
    if (seen.has(current.id)) fail(`${current.id}: cyclic Smart Component parent chain`);
    seen.add(current.id);
    const parent = project.model?.smartComponentInstances?.[current.parentInstanceId];
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function smartComponentForObject(project, objectId) {
  return Object.values(project.model?.smartComponentInstances || {}).find((instance) => (
    smartComponentReferencesObject(instance, objectId)
  )) || null;
}

export function smartComponentRootForObject(project, objectId) {
  return smartComponentRoot(project, smartComponentForObject(project, objectId));
}

function instanceMemberIds(instance) {
  return unique([
    instance.inputs?.main?.memberId,
    instance.inputs?.secondary?.memberId
  ]);
}

export function smartComponentMainMemberId(instance) {
  return instance?.inputs?.main?.memberId || null;
}

export function smartComponentSecondaryMemberId(instance) {
  return instance?.inputs?.secondary?.memberId || null;
}

export function smartComponentConnectionZoneId(instance) {
  return instance?.inputs?.connectionZoneId || null;
}

export function affectedSmartComponentsForMember(project, memberId) {
  return Object.values(project.model?.smartComponentInstances || {}).filter((instance) => (
    instanceMemberIds(instance).includes(memberId)
  ));
}

export function affectedSmartComponentIdsForMember(project, memberId) {
  return affectedSmartComponentsForMember(project, memberId).map((instance) => instance.id);
}

function featureSourceMemberId(feature) {
  return feature?.source?.memberId || feature?.cut?.source?.memberId || null;
}

function trimJointsUsingReferencePlane(project, referencePlaneId) {
  return Object.values(project.model?.trimJoints || {}).filter((trimJoint) => (
    trimJointOperations(trimJoint).some((operation) => trimOperationReferencePlaneIds(operation).includes(referencePlaneId))
  ));
}

function memberSourceFeatureObjectIds(project, memberId) {
  const ids = [];
  for (const feature of Object.values(project.model?.features || {})) {
    if (featureSourceMemberId(feature) !== memberId) continue;
    ids.push(feature.id, feature.ownerId);
  }
  return ids;
}

function trimJointObjectIds(project, trimJoint, options = {}) {
  return filterProjectIds(project, [
    trimJoint.id,
    ...trimJointParticipants(trimJoint).map((participant) => participant.memberId),
    ...trimJointOperations(trimJoint).flatMap((operation) => [
      operation.memberAId,
      operation.memberBId,
      ...trimOperationReferencePlaneIds(operation)
    ])
  ], options);
}

export function memberDependencyObjectIds(project, memberId, options = {}) {
  const ids = options.includeMember === false ? [] : [memberId];
  ids.push(...memberSourceFeatureObjectIds(project, memberId));
  for (const trimJoint of Object.values(project.model?.trimJoints || {})) {
    if (!trimJointParticipants(trimJoint).some((participant) => participant.memberId === memberId)
      && !trimJointOperations(trimJoint).some((operation) => operation.memberAId === memberId || operation.memberBId === memberId)) continue;
    ids.push(...trimJointObjectIds(project, trimJoint, options));
  }
  for (const instance of affectedSmartComponentsForMember(project, memberId)) {
    if (options.includeSmartComponentMembers !== false) ids.push(...instanceMemberIds(instance));
    ids.push(...smartComponentObjectIds(project, instance, options));
  }
  return unique(ids);
}

export function featureDependencyObjectIds(project, featureId, options = {}) {
  const feature = project.model?.features?.[featureId];
  const ids = [featureId];
  if (feature?.ownerId) ids.push(feature.ownerId);
  ids.push(featureSourceMemberId(feature));
  for (const instance of Object.values(project.model?.smartComponentInstances || {})) {
    if (!smartComponentReferencesObject(instance, featureId) && !smartComponentReferencesObject(instance, feature?.ownerId)) continue;
    if (options.includeSmartComponentMembers) ids.push(...instanceMemberIds(instance));
    ids.push(...smartComponentObjectIds(project, instance, options));
  }
  return filterProjectIds(project, ids, options);
}

export function referencePlaneDependencyObjectIds(project, referencePlaneId, options = {}) {
  const ids = [referencePlaneId];
  for (const trimJoint of trimJointsUsingReferencePlane(project, referencePlaneId)) {
    ids.push(...trimJointObjectIds(project, trimJoint, { ...options, includeMissing: true }));
  }
  return filterProjectIds(project, ids, options);
}

export function trimJointDependencyObjectIds(project, trimJointId, options = {}) {
  const trimJoint = project.model?.trimJoints?.[trimJointId];
  return trimJoint ? trimJointObjectIds(project, trimJoint, options) : filterProjectIds(project, [trimJointId], options);
}

export function affectedObjectIdsForMemberChange(beforeProject, afterProject, memberId, options = {}) {
  return unique([
    ...memberDependencyObjectIds(beforeProject, memberId, options),
    ...memberDependencyObjectIds(afterProject, memberId, { ...options, includeMissing: true })
  ]);
}

export function smartComponentReferencesObject(instance, objectId) {
  if (instance.id === objectId) return true;
  return smartComponentOwnedObjectIds(instance).includes(objectId) || smartComponentDetachedObjectIds(instance).includes(objectId);
}
