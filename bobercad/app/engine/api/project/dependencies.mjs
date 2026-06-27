import { flattenIds, uniqueTruthy as unique } from "../../core/model.mjs";
import { objectCollection } from "./objects.mjs";
import { trimJointOperations, trimJointParticipants, trimOperationMemberIds, trimOperationReferencePlaneIds, trimOperationUsesMemberB } from "./trim-operations.mjs";

const RENDER_COLLECTIONS = new Set(["members", "plates", "features", "trimJoints", "fastenerGroups", "welds"]);
const PROJECT_DEPENDENCY_INDEX = new WeakMap();

function fail(message) {
  throw new Error(`project dependencies: ${message}`);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredSmartComponentInstance(instance) {
  if (!plainObject(instance)) fail("Smart Component instance must be an object");
  return instance;
}

function requiredObject(value, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function optionalInputObject(instance, key) {
  const inputs = requiredObject(requiredSmartComponentInstance(instance).inputs, `${instance.id}.inputs`);
  const value = inputs[key];
  if (value === undefined) return null;
  return requiredObject(value, `${instance.id}.inputs.${key}`);
}

function optionalInputString(instance, key) {
  const inputs = requiredObject(requiredSmartComponentInstance(instance).inputs, `${instance.id}.inputs`);
  const value = inputs[key];
  if (value === undefined) return null;
  if (typeof value !== "string" || !value) fail(`${instance.id}.inputs.${key} must be a non-empty string`);
  return value;
}

function optionalMemberInputId(instance, key) {
  const input = optionalInputObject(instance, key);
  const value = input?.memberId;
  if (value === undefined) return null;
  if (typeof value !== "string" || !value) fail(`${instance.id}.inputs.${key}.memberId must be a non-empty string`);
  return value;
}

function requiredStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) fail(`${label} must be an array of non-empty strings`);
  return value;
}

function modelCollection(project, collection) {
  if (!plainObject(project)) fail("project must be an object");
  if (!plainObject(project.model)) fail("project model must be an object");
  const values = project.model[collection];
  if (values === undefined) fail(`model.${collection} must be an object`);
  if (!plainObject(values)) fail(`model.${collection} must be an object`);
  return values;
}

function filterProjectIds(project, ids, options = {}) {
  if (!Array.isArray(ids)) fail("dependency ids must be an array");
  requiredStringArray(ids, "dependency ids");
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("dependency options must be an object");
  if (options.collections !== undefined && !(options.collections instanceof Set) && !Array.isArray(options.collections)) {
    fail("dependency options collections must be an array or set");
  }
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

function projectObjectExists(project, objectId, collection, options = {}) {
  if (typeof objectId !== "string" || !objectId) fail(`${collection} id must be a non-empty string`);
  const indexedCollection = objectCollection(project, objectId);
  if (!indexedCollection) {
    if (options.includeMissing) return false;
    fail(`${collection} not found: ${objectId}`);
  }
  if (indexedCollection !== collection) fail(`${objectId} belongs to ${indexedCollection}, not ${collection}`);
  return true;
}

function pushIndexedValue(map, key, value) {
  if (!key) return;
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function indexedValues(map, key) {
  return map.get(key) || [];
}

function connectionZoneObjectIds(zone) {
  return requiredStringArray(zone?.objectIds || [], `${zone?.id || "connectionZone"}.objectIds`);
}

function connectionZoneSmartComponentInstanceIds(zone) {
  return requiredStringArray(zone?.smartComponentInstanceIds || [], `${zone?.id || "connectionZone"}.smartComponentInstanceIds`);
}

function smartComponentConnectionZoneObjectIds(project, instance) {
  const zones = modelCollection(project, "connectionZones");
  const zoneIds = new Set();
  const inputZoneId = smartComponentConnectionZoneId(instance);
  if (inputZoneId) zoneIds.add(inputZoneId);
  for (const zone of Object.values(zones)) {
    if (connectionZoneSmartComponentInstanceIds(zone).includes(instance.id)) zoneIds.add(zone.id);
  }
  const ids = [];
  for (const zoneId of zoneIds) {
    const zone = zones[zoneId];
    if (zone) ids.push(...connectionZoneObjectIds(zone));
  }
  return unique(ids);
}

function projectDependencyIndex(project) {
  let cached = PROJECT_DEPENDENCY_INDEX.get(project);
  if (cached) return cached;
  const index = {
    smartComponentsByMemberId: new Map(),
    smartComponentsByObjectId: new Map(),
    featuresBySourceMemberId: new Map(),
    trimJointsByMemberId: new Map(),
    trimJointsByReferencePlaneId: new Map()
  };
  for (const instance of Object.values(modelCollection(project, "smartComponentInstances"))) {
    for (const memberId of instanceMemberIds(instance)) pushIndexedValue(index.smartComponentsByMemberId, memberId, instance);
    for (const objectId of unique([
      instance.id,
      ...smartComponentOwnedObjectIds(instance),
      ...smartComponentDetachedObjectIds(instance),
      ...smartComponentConnectionZoneObjectIds(project, instance)
    ])) {
      pushIndexedValue(index.smartComponentsByObjectId, objectId, instance);
    }
  }
  for (const feature of Object.values(modelCollection(project, "features"))) {
    pushIndexedValue(index.featuresBySourceMemberId, featureSourceMemberId(feature), feature);
  }
  for (const trimJoint of Object.values(modelCollection(project, "trimJoints"))) {
    const memberIds = [];
    for (const participant of trimJointParticipants(trimJoint)) memberIds.push(participant.memberId);
    for (const operation of trimJointOperations(trimJoint)) {
      memberIds.push(...trimOperationMemberIds(operation, "memberA"));
      if (trimOperationUsesMemberB(operation.type)) memberIds.push(...trimOperationMemberIds(operation, "memberB"));
      for (const referencePlaneId of trimOperationReferencePlaneIds(operation)) {
        pushIndexedValue(index.trimJointsByReferencePlaneId, referencePlaneId, trimJoint);
      }
    }
    for (const memberId of unique(memberIds)) pushIndexedValue(index.trimJointsByMemberId, memberId, trimJoint);
  }
  PROJECT_DEPENDENCY_INDEX.set(project, index);
  return index;
}

export function smartComponentDetachedObjectIds(instance) {
  instance = requiredSmartComponentInstance(instance);
  return requiredStringArray(instance.detachedObjectIds, `${instance.id}.detachedObjectIds`);
}

export function smartComponentOwnedObjectIds(instance) {
  instance = requiredSmartComponentInstance(instance);
  const owned = requiredStringArray(instance.ownedObjectIds, `${instance.id}.ownedObjectIds`);
  const roles = instance.objectRoles;
  if (!plainObject(roles)) fail(`${instance.id}: objectRoles must be an object`);
  return unique([...owned, ...flattenIds(roles)]);
}

export function smartComponentObjectIds(project, instance, options = {}) {
  instance = requiredSmartComponentInstance(instance);
  const seen = options.seenSmartComponentIds instanceof Set ? options.seenSmartComponentIds : new Set();
  if (seen.has(instance.id)) fail(`${instance.id}: cyclic Smart Component object ownership`);
  seen.add(instance.id);
  const directIds = [
    instance.id,
    ...smartComponentOwnedObjectIds(instance),
    ...smartComponentDetachedObjectIds(instance),
    ...smartComponentConnectionZoneObjectIds(project, instance)
  ];
  const childIds = directIds.flatMap((objectId) => {
    const child = objectId !== instance.id ? modelCollection(project, "smartComponentInstances")[objectId] : null;
    return child ? smartComponentObjectIds(project, child, { ...options, seenSmartComponentIds: seen }) : [];
  });
  return filterProjectIds(project, [...directIds, ...childIds], options);
}

export function smartComponentRoot(project, instance) {
  let current = requiredSmartComponentInstance(instance);
  const seen = new Set();
  while (current.parentInstanceId) {
    if (seen.has(current.id)) fail(`${current.id}: cyclic Smart Component parent chain`);
    seen.add(current.id);
    const parent = modelCollection(project, "smartComponentInstances")[current.parentInstanceId];
    if (!parent) fail(`${current.id}: parent Smart Component not found: ${current.parentInstanceId}`);
    current = parent;
  }
  return current;
}

export function smartComponentForObject(project, objectId) {
  return Object.values(modelCollection(project, "smartComponentInstances")).find((instance) => (
    smartComponentReferencesObject(instance, objectId)
  )) || indexedValues(projectDependencyIndex(project).smartComponentsByObjectId, objectId)[0] || null;
}

export function smartComponentRootForObject(project, objectId) {
  const instance = smartComponentForObject(project, objectId);
  return instance ? smartComponentRoot(project, instance) : null;
}

function instanceMemberIds(instance) {
  return unique([
    optionalMemberInputId(instance, "main"),
    optionalMemberInputId(instance, "secondary")
  ]);
}

export function smartComponentMainMemberId(instance) {
  return optionalMemberInputId(instance, "main");
}

export function smartComponentSecondaryMemberId(instance) {
  return optionalMemberInputId(instance, "secondary");
}

export function smartComponentConnectionZoneId(instance) {
  return optionalInputString(instance, "connectionZoneId");
}

export function affectedSmartComponentsForMember(project, memberId) {
  return indexedValues(projectDependencyIndex(project).smartComponentsByMemberId, memberId);
}

export function affectedSmartComponentIdsForMember(project, memberId) {
  return affectedSmartComponentsForMember(project, memberId).map((instance) => instance.id);
}

function featureSourceMemberId(feature) {
  feature = requiredObject(feature, "feature");
  if (feature.source === undefined) return null;
  const source = requiredObject(feature.source, `${feature.id || "feature"}.source`);
  if (source.memberId === undefined) return null;
  if (typeof source.memberId !== "string" || !source.memberId) fail(`${feature.id || "feature"}.source.memberId must be a non-empty string`);
  return source.memberId;
}

function featureOwnerId(feature) {
  feature = requiredObject(feature, "feature");
  if (typeof feature.ownerId !== "string" || !feature.ownerId) fail(`${feature.id || "feature"}.ownerId must be a non-empty string`);
  return feature.ownerId;
}

function trimJointsUsingReferencePlane(project, referencePlaneId) {
  return indexedValues(projectDependencyIndex(project).trimJointsByReferencePlaneId, referencePlaneId);
}

function memberSourceFeatureObjectIds(project, memberId) {
  const ids = [];
  for (const feature of indexedValues(projectDependencyIndex(project).featuresBySourceMemberId, memberId)) {
    ids.push(feature.id, featureOwnerId(feature));
  }
  return ids;
}

function trimJointObjectIds(project, trimJoint, options = {}) {
  const ids = [
    trimJoint.id,
    ...trimJointParticipants(trimJoint).map((participant) => participant.memberId)
  ];
  for (const operation of trimJointOperations(trimJoint)) {
    ids.push(...trimOperationMemberIds(operation, "memberA"));
    if (trimOperationUsesMemberB(operation.type)) ids.push(...trimOperationMemberIds(operation, "memberB"));
    ids.push(...trimOperationReferencePlaneIds(operation));
  }
  return filterProjectIds(project, ids, options);
}

export function memberDependencyObjectIds(project, memberId, options = {}) {
  if (!projectObjectExists(project, memberId, "members", options)) return filterProjectIds(project, [memberId], options);
  const ids = options.includeMember === false ? [] : [memberId];
  ids.push(...memberSourceFeatureObjectIds(project, memberId));
  for (const trimJoint of indexedValues(projectDependencyIndex(project).trimJointsByMemberId, memberId)) {
    ids.push(...trimJointObjectIds(project, trimJoint, options));
  }
  for (const instance of affectedSmartComponentsForMember(project, memberId)) {
    if (options.includeSmartComponentMembers !== false) ids.push(...instanceMemberIds(instance));
    ids.push(...smartComponentObjectIds(project, instance, options));
  }
  return unique(ids);
}

export function featureDependencyObjectIds(project, featureId, options = {}) {
  if (!projectObjectExists(project, featureId, "features", options)) return filterProjectIds(project, [featureId], options);
  const feature = modelCollection(project, "features")[featureId];
  const ownerId = featureOwnerId(feature);
  const ids = [featureId, ownerId];
  const sourceMemberId = featureSourceMemberId(feature);
  if (sourceMemberId) ids.push(sourceMemberId);
  const instances = unique([
    ...indexedValues(projectDependencyIndex(project).smartComponentsByObjectId, featureId),
    ...indexedValues(projectDependencyIndex(project).smartComponentsByObjectId, ownerId)
  ]);
  for (const instance of instances) {
    if (options.includeSmartComponentMembers) ids.push(...instanceMemberIds(instance));
    ids.push(...smartComponentObjectIds(project, instance, options));
  }
  return filterProjectIds(project, ids, options);
}

export function referencePlaneDependencyObjectIds(project, referencePlaneId, options = {}) {
  if (!projectObjectExists(project, referencePlaneId, "referencePlanes", options)) return filterProjectIds(project, [referencePlaneId], options);
  const ids = [referencePlaneId];
  for (const trimJoint of trimJointsUsingReferencePlane(project, referencePlaneId)) {
    ids.push(...trimJointObjectIds(project, trimJoint, { ...options, includeMissing: true }));
  }
  return filterProjectIds(project, ids, options);
}

export function trimJointDependencyObjectIds(project, trimJointId, options = {}) {
  if (!projectObjectExists(project, trimJointId, "trimJoints", options)) return filterProjectIds(project, [trimJointId], options);
  const trimJoint = modelCollection(project, "trimJoints")[trimJointId];
  return trimJointObjectIds(project, trimJoint, options);
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
