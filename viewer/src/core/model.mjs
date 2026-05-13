function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
}

function deepMerge(base, override) {
  const result = cloneValue(base || {});
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = isPlainObject(result[key]) && isPlainObject(value) ? deepMerge(result[key], value) : cloneValue(value);
  }
  return result;
}

export function effectiveObject(project, collection, object) {
  const defaults = project.modelDefaults?.collections?.[collection] || {};
  return deepMerge(deepMerge(defaults["*"], defaults[object.type]), object);
}

export function objectById(project, id) {
  const entry = project.objectIndex[id];
  return effectiveObject(project, entry.collection, project.model[entry.collection][id]);
}

export function collectionObjects(project, collection) {
  return Object.values(project.model[collection] || {}).map((object) => effectiveObject(project, collection, object));
}
