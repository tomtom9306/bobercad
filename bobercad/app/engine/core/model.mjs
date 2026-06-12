import { finiteNonNegativeInteger } from "./math.mjs?v=integer-number-dry-1";

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

export function mergeObjectPatch(target, patch, options = {}) {
  if (!isPlainObject(patch)) return cloneValue(patch);
  const skipped = options.skipKeys || [];
  const next = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (skipped.includes?.(key) || skipped.has?.(key)) continue;
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
  if (!Array.isArray(values)) return [];
  return uniqueValues(values.filter(finiteNonNegativeInteger)).sort((a, b) => a - b);
}

export function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function deepMerge(base, override) {
  const result = cloneValue(base || {});
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = isPlainObject(result[key]) && isPlainObject(value) ? deepMerge(result[key], value) : cloneValue(value);
  }
  return result;
}

function effectiveObject(project, collection, object) {
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
