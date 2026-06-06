const RENDER_COLLECTIONS = new Set(["members", "plates", "features", "trimJoints", "fastenerGroups", "welds"]);

function fail(message) {
  throw new Error(`project dependencies: ${message}`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  fail(`unsupported id reference ${value}`);
}

export function objectCollection(project, objectId) {
  const indexed = project.objectIndex?.[objectId]?.collection;
  if (indexed && project.model?.[indexed]?.[objectId]) return indexed;
  for (const [collection, objects] of Object.entries(project.model || {})) {
    if (objects && typeof objects === "object" && !Array.isArray(objects) && objects[objectId]) return collection;
  }
  return null;
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
  const owned = Array.isArray(instance.ownedObjectIds) ? instance.ownedObjectIds : [];
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
    (trimJoint.operations || []).some((operation) => (operation.referencePlaneIds || []).includes(referencePlaneId))
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

export function trimJointObjectIds(project, trimJoint, options = {}) {
  return filterProjectIds(project, [
    trimJoint.id,
    ...(trimJoint.participants || []).map((participant) => participant.memberId),
    ...(trimJoint.operations || []).flatMap((operation) => [
      operation.memberAId,
      operation.memberBId,
      ...(operation.referencePlaneIds || [])
    ])
  ], options);
}

export function affectedTrimJointsForMember(project, memberId) {
  return Object.values(project.model?.trimJoints || {}).filter((trimJoint) => (
    (trimJoint.participants || []).some((participant) => participant.memberId === memberId)
    || (trimJoint.operations || []).some((operation) => operation.memberAId === memberId || operation.memberBId === memberId)
  ));
}

export function memberDependencyObjectIds(project, memberId, options = {}) {
  const ids = options.includeMember === false ? [] : [memberId];
  ids.push(...memberSourceFeatureObjectIds(project, memberId));
  for (const trimJoint of affectedTrimJointsForMember(project, memberId)) ids.push(...trimJointObjectIds(project, trimJoint, options));
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

export function affectedObjectIdsForFeatureChange(beforeProject, afterProject, featureId, options = {}) {
  return unique([
    ...featureDependencyObjectIds(beforeProject, featureId, options),
    ...featureDependencyObjectIds(afterProject, featureId, { ...options, includeMissing: true })
  ]);
}

export function smartComponentReferencesObject(instance, objectId) {
  if (instance.id === objectId) return true;
  return smartComponentOwnedObjectIds(instance).includes(objectId) || smartComponentDetachedObjectIds(instance).includes(objectId);
}
