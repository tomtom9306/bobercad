import { jsonClone as clone, objectById, uniqueTruthy as unique } from "../../core/model.mjs";
import {
  fail,
  optionalStringArrayValue,
  requiredObjectValue,
  requiredStringValue,
  safeId
} from "./smart-component-runtime-validation.mjs";

export const MODEL_COLLECTIONS = ["groups", "interfaces", "connectionZones", "assemblies", "gridSystems", "levels", "members", "plates", "sketches", "holePatterns", "objectPatterns", "workPoints", "referencePlanes", "features", "trimJoints", "fastenerGroups", "welds", "smartComponentInstances"];
export const SMART_COMPONENT_PRUNE_ARRAYS = (key) => key.endsWith("Ids");

const MODEL_COLLECTION_SET = new Set(MODEL_COLLECTIONS);

export function projectModel(project, label = "project") {
  return requiredObjectValue(requiredObjectValue(project, label).model, `${label}.model`);
}

export function projectObjectIndex(project, label = "project") {
  return requiredObjectValue(requiredObjectValue(project, label).objectIndex, `${label}.objectIndex`);
}

export function projectCollection(project, collection, label = "project") {
  const model = projectModel(project, label);
  if (model[collection] === undefined) model[collection] = {};
  return requiredObjectValue(model[collection], `${label}.model.${collection}`);
}

export function nextId(project, base) {
  const objectIndex = projectObjectIndex(project);
  const cleanBase = safeId(base);
  let id = cleanBase;
  let index = 2;
  while (objectIndex[id]) {
    id = `${cleanBase}_${index}`;
    index += 1;
  }
  return id;
}

export function setId(list, id, included) {
  const values = optionalStringArrayValue(list, [], "assembly object id list");
  return included ? unique([...values, id]) : values.filter((value) => value !== id);
}

export function objectIndexFor(model) {
  const objectIndex = {};
  for (const [collection, objects] of Object.entries(requiredObjectValue(model, "model patch"))) {
    if (!MODEL_COLLECTION_SET.has(collection)) fail(`unsupported model patch collection ${collection}`);
    for (const [key, object] of Object.entries(requiredObjectValue(objects, `model.${collection}`))) {
      const id = requiredStringValue(object?.id, `${collection}.${key}.id`);
      const type = requiredStringValue(object?.type, `${collection}.${key}.type`);
      if (id !== key) fail(`${collection}.${key} id mismatch: ${id}`);
      objectIndex[key] = { collection, type };
    }
  }
  return objectIndex;
}

export function projectObject(project, collection, id) {
  const object = projectCollection(project, collection)[id];
  if (!object) fail(`missing ${collection}.${id}`);
  return object;
}

export function resolvedProjectObject(project, collection, id) {
  projectObject(project, collection, id);
  return objectById(project, id);
}

export function smartComponentById(project, instanceId) {
  const instance = projectCollection(project, "smartComponentInstances")[instanceId];
  if (!instance) fail(`smart component not found: ${instanceId}`);
  return instance;
}

export function mergedProjectView(project, modelPatch) {
  const next = {
    ...project,
    objectIndex: { ...projectObjectIndex(project), ...objectIndexFor(modelPatch) },
    model: { ...projectModel(project) }
  };
  for (const [collection, objects] of Object.entries(modelPatch)) {
    next.model[collection] = { ...projectCollection(next, collection), ...objects };
  }
  return next;
}

export function mergePatchModel(target, patch) {
  const patchModel = requiredObjectValue(
    requiredObjectValue(patch, "smart component patch").model,
    "smart component patch.model"
  );
  for (const [collection, objects] of Object.entries(patchModel)) {
    Object.assign(requiredObjectValue(target[collection], `smart component target model.${collection}`), objects);
  }
}

export function indexedCollectionForObject(project, objectId) {
  const indexed = projectObjectIndex(project)[objectId]?.collection;
  if (!indexed) return null;
  return projectCollection(project, indexed)[objectId] ? indexed : null;
}

export function collectionForObject(project, objectId) {
  const collection = indexedCollectionForObject(project, objectId);
  if (collection) return collection;
  fail(`object not found: ${objectId}`);
}

export function addModelObject(project, collection, object) {
  const objects = projectCollection(project, collection);
  const objectIndex = projectObjectIndex(project);
  if (!object?.id) fail(`${collection}: object id is required`);
  if (!object.type) fail(`${collection}.${object.id} missing type`);
  if (objects[object.id] || objectIndex[object.id]) fail(`object already exists: ${object.id}`);
  objects[object.id] = clone(object);
  objectIndex[object.id] = { collection, type: object.type };
}
