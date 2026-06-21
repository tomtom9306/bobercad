import { smartComponentDetachedObjectIds, smartComponentOwnedObjectIds } from "../../api/project/dependencies.mjs";
import { removeProjectObjects } from "../../api/project/objects.mjs";
import { jsonClone as clone, uniqueTruthy as unique } from "../../core/model.mjs";
import { objectStringValues } from "./smart-component-catalog.mjs";
import {
  indexedCollectionForObject,
  MODEL_COLLECTIONS,
  projectCollection,
  projectModel,
  projectObjectIndex,
  SMART_COMPONENT_PRUNE_ARRAYS
} from "./smart-component-model-helpers.mjs";
import {
  fail,
  requiredObjectValue
} from "./smart-component-runtime-validation.mjs";

function smartComponentOwnedTreeObjectIds(project, instanceId, visited = new Set()) {
  if (visited.has(instanceId)) fail(`${instanceId}: cyclic Smart Component ownership tree`);
  visited.add(instanceId);
  const instances = projectCollection(project, "smartComponentInstances");
  const instance = instances[instanceId];
  if (!instance) fail(`smart component not found: ${instanceId}`);
  const directIds = smartComponentOwnedObjectIds(instance);
  const childRoles = requiredObjectValue(instance.childComponentRoles, `${instanceId}.childComponentRoles`);
  const childIds = unique([
    ...objectStringValues(childRoles, `${instanceId}.childComponentRoles`),
    ...directIds.filter((objectId) => instances[objectId]?.parentInstanceId === instanceId)
  ]);
  return unique([
    ...directIds,
    ...childIds.flatMap((childId) => smartComponentOwnedTreeObjectIds(project, childId, visited))
  ]);
}

function managedBySmartComponent(project, objectId, instanceId) {
  const collection = indexedCollectionForObject(project, objectId);
  if (!collection) return false;
  const object = projectCollection(project, collection)[objectId];
  if (object?.authoring?.componentInstanceId === instanceId && ["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return true;
  return collection === "smartComponentInstances" && object?.parentInstanceId === instanceId;
}

function removedManagedObjectIds(project, patch) {
  const removed = [];
  const projectInstances = projectCollection(project, "smartComponentInstances");
  const patchModel = requiredObjectValue(requiredObjectValue(patch, "smart component patch").model, "smart component patch.model");
  const patchInstances = requiredObjectValue(patchModel.smartComponentInstances, "smart component patch.model.smartComponentInstances");
  for (const [instanceId, nextInstance] of Object.entries(patchInstances)) {
    const previousInstance = projectInstances[instanceId];
    if (!previousInstance) continue;
    const nextIds = new Set([...smartComponentOwnedObjectIds(nextInstance), ...smartComponentDetachedObjectIds(nextInstance), instanceId]);
    for (const objectId of smartComponentOwnedObjectIds(previousInstance)) {
      if (nextIds.has(objectId)) continue;
      if (managedBySmartComponent(project, objectId, instanceId)) {
        removed.push(objectId);
        if (projectInstances[objectId]) removed.push(...smartComponentOwnedTreeObjectIds(project, objectId), objectId);
      }
    }
  }
  return unique(removed);
}

export function applySmartComponentPatch(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  const patchModel = requiredObjectValue(patch.model, "smart component patch.model");
  const next = removedIds.length ? clone(project) : {
    ...project,
    objectIndex: { ...projectObjectIndex(project) },
    model: { ...projectModel(project) }
  };
  projectObjectIndex(next);
  projectModel(next);
  Object.assign(next.objectIndex, requiredObjectValue(patch.objectIndex, "smart component patch.objectIndex"));
  for (const [collection, objects] of Object.entries(patchModel)) {
    next.model[collection] = {
      ...projectCollection(next, collection),
      ...objects
    };
  }
  removeProjectObjects(next, removedIds, { shouldPruneArray: SMART_COMPONENT_PRUNE_ARRAYS });
  return next;
}

export function clonePatchableProject(project) {
  const next = clone(project);
  for (const collection of MODEL_COLLECTIONS) {
    projectCollection(next, collection);
  }
  return next;
}

export function applySmartComponentPatchInPlace(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  const patchModel = requiredObjectValue(patch.model, "smart component patch.model");
  Object.assign(projectObjectIndex(project), requiredObjectValue(patch.objectIndex, "smart component patch.objectIndex"));
  for (const [collection, objects] of Object.entries(patchModel)) {
    Object.assign(projectCollection(project, collection), objects);
  }
  removeProjectObjects(project, removedIds, { shouldPruneArray: SMART_COMPONENT_PRUNE_ARRAYS });
  return project;
}
