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
  "gridSystems",
  "levels",
  "workPoints",
  "referencePlanes",
  "trimJoints",
  "groups",
  "objectPatterns",
  "relations",
  "smartComponentInstances"
]);

function fail(message) {
  throw new Error(`object api: ${message}`);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredObject(value, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function requiredId(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function requiredIdList(values, label) {
  if (!Array.isArray(values)) fail(`${label} must be an array`);
  for (const [index, value] of values.entries()) requiredId(value, `${label}[${index}]`);
  return values;
}

function projectModel(project) {
  return requiredObject(requiredObject(project, "project").model, "project.model");
}

function projectObjectIndex(project) {
  return requiredObject(requiredObject(project, "project").objectIndex, "project.objectIndex");
}

function modelCollection(project, collection) {
  if (!MODEL_COLLECTIONS.has(collection)) fail(`unsupported collection ${collection}`);
  const model = projectModel(project);
  return requiredObject(model[collection], `project.model.${collection}`);
}

export function cleanId(value) {
  if (typeof value !== "string") fail("id must be a string");
  return value
    .trim()
    .replace(/[^A-Za-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function appendUniqueId(values, id) {
  return [...new Set([...requiredIdList(values, "id list"), requiredId(id, "id")])];
}

export function objectCollection(project, objectId) {
  if (typeof objectId !== "string" || !objectId) return null;
  const entry = projectObjectIndex(project)[objectId];
  if (entry === undefined) return null;
  if (!plainObject(entry)) fail(`objectIndex.${objectId} must be an object`);
  const indexed = entry.collection;
  if (typeof indexed !== "string" || !indexed) fail(`objectIndex.${objectId}.collection must be a non-empty string`);
  if (!MODEL_COLLECTIONS.has(indexed)) fail(`objectIndex.${objectId}.collection is unsupported: ${indexed}`);
  const collection = modelCollection(project, indexed);
  if (!collection[objectId]) fail(`objectIndex.${objectId} points to missing model.${indexed}.${objectId}`);
  return indexed;
}

export function nextObjectId(project, preferredId) {
  const base = cleanId(preferredId);
  if (!base) fail("preferred id must contain at least one id-safe character");
  const objectIndex = projectObjectIndex(project);
  if (!objectIndex[base]) return base;
  let index = 2;
  while (objectIndex[`${base}_${index}`]) index += 1;
  return `${base}_${index}`;
}

export function addIndexedObject(project, collection, object) {
  if (!MODEL_COLLECTIONS.has(collection)) fail(`unsupported collection ${collection}`);
  object = requiredObject(object, "object");
  const objectId = requiredId(object.id, "object id");
  const objectType = requiredId(object.type, `${objectId}: object type`);
  const objects = modelCollection(project, collection);
  const objectIndex = projectObjectIndex(project);
  if (objects[objectId] || objectIndex[objectId]) fail(`object already exists: ${objectId}`);
  objects[objectId] = object;
  objectIndex[objectId] = {
    collection,
    type: objectType
  };
  return object;
}

export function removeIndexedObject(project, objectId) {
  const collection = objectCollection(project, objectId);
  if (!collection) fail(`object not found: ${objectId}`);
  delete projectModel(project)[collection][objectId];
  delete projectObjectIndex(project)[objectId];
}

function removeObjectReferences(value, deletedIds, options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("remove options must be an object");
  if (typeof options.shouldPruneArray !== "function") {
    fail("remove options shouldPruneArray must be a function");
  }
  if (!(deletedIds instanceof Set)) fail("deletedIds must be a set");
  const deleted = deletedIds;
  const { shouldPruneArray } = options;
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
  const ids = objectIds instanceof Set ? [...objectIds] : objectIds;
  const deletedIds = new Set(requiredIdList(ids, "objectIds"));
  if (!deletedIds.size) return project;
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("remove options must be an object");
  if (typeof options.shouldPruneArray !== "function") fail("remove options shouldPruneArray must be a function");
  for (const objectId of deletedIds) removeIndexedObject(project, objectId);
  removeObjectReferences(projectModel(project), deletedIds, options);
  return project;
}
