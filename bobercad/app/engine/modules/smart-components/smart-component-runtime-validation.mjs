import { finiteVec3 } from "../../core/math.mjs";
import { isPlainObject as plainObject } from "../../core/model.mjs";

export { plainObject };

export function fail(message) {
  throw new Error(`smart component engine: ${message}`);
}

export function reject(ctx, message) {
  if (ctx) ctx.fail(message);
  fail(message);
}

export function optionalObjectValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!plainObject(value)) reject(ctx, `${label} must be an object`);
  return value;
}

export function requiredObjectValue(value, label, ctx = null) {
  if (!plainObject(value)) reject(ctx, `${label} must be an object`);
  return value;
}

export function optionalStringValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string`);
  return value;
}

export function requiredStringValue(value, label, ctx = null) {
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string`);
  return value;
}

export function optionalMemberEndValue(value, label, ctx = null) {
  if (value === undefined) return undefined;
  if (value === "start" || value === "end") return value;
  reject(ctx, `${label} must be start or end`);
}

export function optionalNullableStringValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string or null`);
  return value;
}

export function optionalStringArrayValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    reject(ctx, `${label} must be an array of non-empty strings`);
  }
  return value;
}

export function requiredStringArrayValue(value, label, ctx = null) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    reject(ctx, `${label} must be an array of non-empty strings`);
  }
  return value;
}

export function requiredArrayValue(value, label, ctx = null) {
  if (!Array.isArray(value)) reject(ctx, `${label} must be an array`);
  return value;
}

export function optionalIndexArrayValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item) || item < 0)) {
    reject(ctx, `${label} must be an array of non-negative integers`);
  }
  return value;
}

export function safeId(value, label = "id") {
  requiredStringValue(value, label);
  const id = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!id) fail(`${label} must contain an alphanumeric character`);
  return id;
}

export const vec3 = (value, label) => finiteVec3(value, label, fail);
