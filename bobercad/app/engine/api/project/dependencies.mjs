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

export function connectionOptionalObjectIds(connection) {
  const ids = connection.generator?.manualObjectIds;
  if (ids === undefined) return [];
  if (!Array.isArray(ids)) fail(`${connection.id}: generator.manualObjectIds must be an array`);
  return ids;
}

export function connectionOwnedObjectIds(connection) {
  const generator = connection.generator || {};
  const owned = Array.isArray(generator.ownedObjectIds) ? generator.ownedObjectIds : [];
  const manual = new Set(connectionOptionalObjectIds(connection));
  const manualParts = flattenIds(connection.manualParts).filter((id) => !manual.has(id));
  return unique([...owned, ...flattenIds(generator.objectRoles), ...manualParts]);
}

export function connectionObjectIds(project, connection, options = {}) {
  return filterProjectIds(project, [
    connection.id,
    ...connectionOwnedObjectIds(connection),
    ...connectionOptionalObjectIds(connection)
  ], options);
}

export function affectedConnectionsForMember(project, memberId) {
  return Object.values(project.model?.connections || {}).filter((connection) => (
    connection.mainMemberId === memberId || connection.secondaryMemberId === memberId
  ));
}

export function affectedConnectionIdsForMember(project, memberId) {
  return affectedConnectionsForMember(project, memberId).map((connection) => connection.id);
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
  for (const connection of affectedConnectionsForMember(project, memberId)) {
    if (options.includeConnectionMembers !== false) ids.push(connection.mainMemberId, connection.secondaryMemberId);
    ids.push(...connectionObjectIds(project, connection, options));
  }
  return unique(ids);
}

export function featureDependencyObjectIds(project, featureId, options = {}) {
  const feature = project.model?.features?.[featureId];
  const ids = [featureId];
  if (feature?.ownerId) ids.push(feature.ownerId);
  ids.push(featureSourceMemberId(feature));
  for (const connection of Object.values(project.model?.connections || {})) {
    if (!connectionReferencesObject(connection, featureId) && !connectionReferencesObject(connection, feature?.ownerId)) continue;
    if (options.includeConnectionMembers) ids.push(connection.mainMemberId, connection.secondaryMemberId);
    ids.push(...connectionObjectIds(project, connection, options));
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

export function connectionReferencesObject(connection, objectId) {
  if (connection.id === objectId) return true;
  return connectionOwnedObjectIds(connection).includes(objectId) || connectionOptionalObjectIds(connection).includes(objectId);
}
