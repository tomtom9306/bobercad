import { arrayValues, uniqueTruthy } from "../../core/model.mjs?v=array-values-dry-1";

const MODEL_COLLECTIONS = new Set([
  "members",
  "plates",
  "sketches",
  "features",
  "holePatterns",
  "fastenerGroups",
  "welds",
  "interfaces",
  "connectionZones",
  "assemblies",
  "workPoints",
  "referencePlanes",
  "trimJoints",
  "groups",
  "objectPatterns",
  "relations"
]);

function fail(message) {
  throw new Error(`object api: ${message}`);
}

export function cleanId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function appendUniqueId(values = [], id) {
  return uniqueTruthy([...arrayValues(values), id]);
}

export function objectCollection(project, objectId) {
  const indexed = project.objectIndex?.[objectId]?.collection;
  if (indexed && project.model?.[indexed]?.[objectId]) return indexed;
  for (const [collection, objects] of Object.entries(project.model || {})) {
    if (objects && typeof objects === "object" && !Array.isArray(objects) && objects[objectId]) return collection;
  }
  return null;
}

export function nextObjectId(project, preferredId) {
  const base = cleanId(preferredId) || "object";
  if (!project.objectIndex?.[base] && !objectCollection(project, base)) return base;
  let index = 2;
  while (project.objectIndex?.[`${base}_${index}`] || objectCollection(project, `${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function addIndexedObject(project, collection, object) {
  if (!MODEL_COLLECTIONS.has(collection)) fail(`unsupported collection ${collection}`);
  if (!object?.id) fail("object id is required");
  project.model ||= {};
  project.model[collection] ||= {};
  if (project.model[collection][object.id] || project.objectIndex?.[object.id]) fail(`object already exists: ${object.id}`);
  project.model[collection][object.id] = object;
  project.objectIndex ||= {};
  project.objectIndex[object.id] = {
    collection,
    type: object.type || collection.replace(/s$/, "")
  };
  return object;
}

export function removeIndexedObject(project, objectId) {
  const collection = objectCollection(project, objectId);
  if (collection) delete project.model[collection][objectId];
  if (project.objectIndex) delete project.objectIndex[objectId];
}

function removeObjectReferences(value, deletedIds, options = {}) {
  const deleted = deletedIds instanceof Set ? deletedIds : new Set(uniqueTruthy(deletedIds));
  const shouldPruneArray = typeof options.shouldPruneArray === "function"
    ? options.shouldPruneArray
    : (key) => key.endsWith("Ids");
  if (Array.isArray(value)) return value.filter((item) => !deleted.has(item)).map((item) => removeObjectReferences(item, deleted, options));
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child) && shouldPruneArray(key, child)) {
      value[key] = child.filter((id) => !deleted.has(id));
    } else {
      removeObjectReferences(child, deleted, options);
    }
  }
  return value;
}

export function removeProjectObjects(project, objectIds, options = {}) {
  const deletedIds = new Set(uniqueTruthy(objectIds));
  if (!deletedIds.size) return project;
  for (const objectId of deletedIds) removeIndexedObject(project, objectId);
  removeObjectReferences(project.model, deletedIds, options);
  return project;
}
