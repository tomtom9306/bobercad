const MODEL_COLLECTIONS = new Set([
  "members",
  "plates",
  "features",
  "holePatterns",
  "fastenerGroups",
  "welds",
  "interfaces",
  "connectionZones",
  "assemblies",
  "workPoints",
  "referencePlanes",
  "groups",
  "objectPatterns",
  "connections"
]);

function fail(message) {
  throw new Error(`object api: ${message}`);
}

function cleanId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function appendUniqueId(values = [], id) {
  return [...new Set([...(Array.isArray(values) ? values : []), id].filter(Boolean))];
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
