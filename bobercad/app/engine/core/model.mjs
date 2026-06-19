import { finiteNonNegativeInteger } from "./math.mjs";

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function modelError(message) {
  throw new Error(`model: ${message}`);
}

function optionalPlainObject(value, label) {
  if (value === undefined) return {};
  if (!isPlainObject(value)) modelError(`${label} must be an object`);
  return value;
}

function requiredPlainObject(value, label) {
  if (!isPlainObject(value)) modelError(`${label} must be an object`);
  return value;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
}

export function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function optionalJsonClone(value) {
  return value === undefined ? undefined : jsonClone(value);
}

function skipKeysOption(options) {
  if (options === undefined) return new Set();
  if (!isPlainObject(options)) modelError("merge options must be an object");
  const skipKeys = options.skipKeys;
  if (skipKeys === undefined) return new Set();
  const values = skipKeys instanceof Set ? [...skipKeys] : skipKeys;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    modelError("merge options skipKeys must be an array or set of strings");
  }
  return new Set(values);
}

export function mergeObjectPatch(target, patch, options = {}) {
  if (target !== undefined && !isPlainObject(target)) modelError("merge target must be an object");
  if (!isPlainObject(patch)) modelError("merge patch must be an object");
  const skipped = skipKeysOption(options);
  const next = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (skipped.has(key)) continue;
    next[key] = isPlainObject(value) && isPlainObject(next[key]) ? mergeObjectPatch(next[key], value, options) : cloneValue(value);
  }
  return next;
}

export function arrayValues(values) {
  return Array.isArray(values) ? values : [];
}

export function truthyValues(values) {
  return arrayValues(values).filter(Boolean);
}

export function uniqueValues(values) {
  return [...new Set(arrayValues(values))];
}

export function uniqueTruthy(values) {
  return uniqueValues(truthyValues(values));
}

export function sameIdSet(left, values = []) {
  const right = values instanceof Set ? values : new Set(values);
  if (!left || left.size !== right.size) return false;
  for (const id of right) if (!left.has(id)) return false;
  return true;
}

export function normalizedIndexList(values) {
  if (!Array.isArray(values)) modelError("index list must be an array");
  if (values.some((value) => !finiteNonNegativeInteger(value))) modelError("index list must contain only non-negative integers");
  return uniqueValues(values).sort((a, b) => a - b);
}

export function flattenIds(value) {
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (isPlainObject(value)) return Object.values(value).flatMap(flattenIds);
  modelError("id tree values must be strings, arrays, plain objects, null, or undefined");
}

function deepMerge(base, override, label) {
  const result = cloneValue(optionalPlainObject(base, `${label} base`));
  for (const [key, value] of Object.entries(optionalPlainObject(override, `${label} override`))) {
    result[key] = isPlainObject(result[key]) && isPlainObject(value) ? deepMerge(result[key], value, `${label}.${key}`) : cloneValue(value);
  }
  return result;
}

function effectiveObject(project, collection, object) {
  if (!isPlainObject(object)) modelError(`${collection} object must be an object`);
  const modelDefaults = requiredPlainObject(requiredPlainObject(project, "project").modelDefaults, "modelDefaults");
  const defaultsByCollection = requiredPlainObject(modelDefaults.collections, "modelDefaults.collections");
  const defaults = optionalPlainObject(defaultsByCollection[collection], `modelDefaults.collections.${collection}`);
  const base = deepMerge(defaults["*"], defaults[object.type], `modelDefaults.collections.${collection}`);
  return deepMerge(base, object, `${collection}.${object.id || object.type || "object"}`);
}

export function objectById(project, id) {
  const root = requiredPlainObject(project, "project");
  const objectIndex = requiredPlainObject(root.objectIndex, "objectIndex");
  const entry = objectIndex[id];
  if (!isPlainObject(entry) || typeof entry.collection !== "string" || !entry.collection) modelError(`objectIndex entry missing for ${id}`);
  const model = requiredPlainObject(root.model, "model");
  const collection = requiredPlainObject(model[entry.collection], `model.${entry.collection}`);
  if (!isPlainObject(collection[id])) modelError(`${entry.collection}.${id} missing for objectIndex entry`);
  return effectiveObject(project, entry.collection, collection[id]);
}

export function collectionObjects(project, collection) {
  const model = requiredPlainObject(requiredPlainObject(project, "project").model, "model");
  return Object.values(optionalPlainObject(model[collection], `model.${collection}`)).map((object) => effectiveObject(project, collection, object));
}
