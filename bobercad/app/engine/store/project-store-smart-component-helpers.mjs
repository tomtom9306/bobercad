import { flattenIds, jsonClone as clone, mergeObjectPatch as mergePatch, normalizedIndexList, uniqueTruthy as unique } from "../core/model.mjs";
import { finiteInteger, v } from "../core/math.mjs";
import { resolveInterface } from "../geometry/member-geometry.mjs";
import { appendUniqueId, objectCollection, removeIndexedObject } from "../api/project/objects.mjs";
import { axisRelationFromSnap, relationUpsertKey } from "../api/project/axis-relations.mjs";
import { memberAxisData } from "../api/project/members.mjs";
import { smartComponentConnectionZoneId, smartComponentOwnedObjectIds, smartComponentReferencesObject } from "../api/project/dependencies.mjs";
import { smartComponentById } from "../modules/smart-components/smart-component-runtime.mjs";
import { FIT_EPSILON, fail, memberById, optionalObject, optionalStringList, projectCollection, projectObjectIndex, requiredObject, requiredStringList } from "./project-store-model-helpers.mjs";

export function isSmartComponentGeneratedHelper(object, smartComponentId) {
  return object?.authoring?.componentInstanceId === smartComponentId && object.authoring?.lifecycle === "delete-with-smart-component";
}

export function smartComponentGeneratedHelperIds(project, smartComponent) {
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

export function smartComponentRoleForObject(smartComponent, objectId) {
  for (const [role, value] of Object.entries(requiredObject(smartComponent.objectRoles, `${smartComponent.id}.objectRoles`))) {
    if (flattenIds(value).includes(objectId)) return role;
  }
  return null;
}

export function smartComponentManagingObject(project, objectId) {
  const collection = objectCollection(project, objectId);
  const object = collection ? projectCollection(project, collection)[objectId] : null;
  const instanceId = object?.authoring?.componentInstanceId;
  if (!instanceId || !["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return null;
  const instance = projectCollection(project, "smartComponentInstances")[instanceId];
  if (!instance) fail(`${objectId}: managed smart component not found: ${instanceId}`);
  if (!smartComponentOwnedObjectIds(instance).includes(objectId)) return null;
  return instance;
}

export function changedObjectPatch(before, after) {
  before = requiredObject(before, "previous managed object");
  after = requiredObject(after, "updated managed object");
  const patch = {};
  for (const [key, value] of Object.entries(after)) {
    if (["id", "type", "authoring"].includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) patch[key] = clone(value);
  }
  return patch;
}

export function recordSmartComponentFieldOverride(project, beforeObject, afterObject) {
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

export function appendMemberToDefaultGroup(project, memberId) {
  const group = Object.values(projectCollection(project, "groups")).find((item) => item.type === "member-group");
  if (!group) return;
  if (group.memberIds !== undefined) group.memberIds = appendUniqueId(group.memberIds, memberId);
  group.objectIds = appendUniqueId(group.objectIds, memberId);
}

export function upsertRelationObject(project, relation) {
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

export function addMemberSnapRelations(project, memberId, options = {}) {
  if (options.autoAxisRelations === false) return;
  for (const [endpoint, snap] of [["start", options.startSnap], ["end", options.endSnap]]) {
    const relation = axisRelationFromSnap(memberId, endpoint, snap, { createdBy: "auto-snap" });
    if (relation) upsertRelationObject(project, relation);
  }
}

export function setIndexIncluded(values, index, included) {
  const current = new Set(normalizedIndexList(values));
  if (included) current.delete(index);
  else current.add(index);
  return [...current].sort((a, b) => a - b);
}

export function setRoleInList(list, role, active) {
  const current = new Set(requiredStringList(list, "suppressedRoles"));
  if (active) current.add(role);
  else current.delete(role);
  return [...current].sort();
}

export function smartComponentAssemblyId(instance) {
  const inputs = requiredObject(instance.inputs, `${instance.id}.inputs`);
  if (inputs.assemblyId === undefined) return null;
  if (typeof inputs.assemblyId !== "string" || !inputs.assemblyId) fail(`${instance.id}.inputs.assemblyId must be a non-empty string`);
  return inputs.assemblyId;
}

export function componentFromFace(project, face) {
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

export function memberDirectionFromInterface(project, iface) {
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

export function interfaceReferencePoint(project, profiles, zone, interfaceId) {
  const otherId = requiredStringList(zone.interfaceIds, `${zone.id}.interfaceIds`).find((id) => id !== interfaceId);
  if (!otherId) fail(`${zone.id}: connection interface ${interfaceId} has no paired reference interface`);
  const resolved = resolveInterface(project, profiles, otherId);
  const direction = memberDirectionFromInterface(project, resolved);
  return direction ? v.add(resolved.origin, v.mul(direction, 10)) : resolved.origin;
}

export function lockSmartComponentZoneFaces(project, profiles, smartComponentId, options = {}) {
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

export function roundedDimension(value) {
  return Math.round(value * 1000) / 1000;
}
