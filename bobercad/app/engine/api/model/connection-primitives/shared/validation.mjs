function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function requiredObject(ctx, value, label) {
  if (!plainObject(value)) ctx.fail(`${label} must be an object`);
  return value;
}

export function requiredString(ctx, value, label) {
  if (typeof value !== "string" || !value.trim()) ctx.fail(`${label} must be a non-empty string`);
  return value;
}

export function requiredBoolean(ctx, value, label) {
  if (typeof value !== "boolean") ctx.fail(`${label} must be boolean`);
  return value;
}

export function requiredFiniteNumber(ctx, value, label) {
  if (!Number.isFinite(value)) ctx.fail(`${label} must be a finite number`);
  return value;
}

export function requiredPositiveNumber(ctx, value, label) {
  if (!Number.isFinite(value) || value <= 0) ctx.fail(`${label} must be a positive number`);
  return value;
}

export function requiredNonNegativeNumber(ctx, value, label) {
  if (!Number.isFinite(value) || value < 0) ctx.fail(`${label} must be a non-negative number`);
  return value;
}

export function requiredPositiveInteger(ctx, value, label) {
  if (!Number.isInteger(value) || value <= 0) ctx.fail(`${label} must be a positive integer`);
  return value;
}

export function requiredVec3(ctx, value, label) {
  if (!ctx.geometry.v.isVec3(value)) ctx.fail(`${label} must be a finite vec3`);
  return value;
}

export function enumValue(ctx, value, allowed, label) {
  if (!Array.isArray(allowed) || !allowed.length || allowed.some((item) => typeof item !== "string" || !item)) {
    ctx.fail(`${label} enum must declare non-empty string values`);
  }
  if (!allowed.includes(value)) ctx.fail(`${label} must be one of ${allowed.join(", ")}`);
  return value;
}

export function optionalPositiveNumber(ctx, value, label) {
  if (value === undefined) return undefined;
  return requiredPositiveNumber(ctx, value, label);
}
