import { finiteNonNegativeNumber, finiteNumber, finitePositiveNumber } from "../../../core/math.mjs";
import { uniqueTruthy } from "../../../core/model.mjs";
import { sketchEdges } from "./model-accessors.mjs";
import { fail, plainObject } from "./sketch-geometry-and-relations.mjs";

export function normalizeBend(bend, sketch, bendIds = new Set()) {
  if (!plainObject(bend)) fail("bend must be an object");
  const edgeIds = new Set(sketchEdges(sketch).map((edge) => edge.id));
  const parentBendId = bend.parentBendId;
  if (parentBendId !== undefined && (typeof parentBendId !== "string" || !parentBendId)) fail("bend parentBendId must be a non-empty string");
  const edgeId = parentBendId ? null : bend.edgeId;
  if (typeof bend.id !== "string" || !bend.id) fail("bend id must be a non-empty string");
  if (parentBendId) {
    if (!bendIds.has(parentBendId)) fail(`bend references unknown parent bend ${parentBendId}`);
    if (parentBendId === bend.id) fail("bend cannot reference itself as parent");
    if (bend.parentEdge !== "outer") fail("bend parentEdge must be outer");
  } else if (!edgeIds.has(edgeId)) {
    fail(`bend references unknown sketch edge ${edgeId}`);
  }
  const angle = bend.angle;
  const radius = bend.radius;
  const flangeLength = bend.flangeLength;
  if (!finiteNumber(angle)) fail("bend angle must be a finite number");
  if (!finiteNonNegativeNumber(radius)) fail("bend radius must be zero or positive");
  if (!finitePositiveNumber(flangeLength)) fail("bend flangeLength must be positive");
  if (bend.direction !== "up" && bend.direction !== "down") fail("bend direction must be up or down");
  return {
    id: bend.id,
    ...(parentBendId ? { parentBendId, parentEdge: bend.parentEdge } : { edgeId }),
    direction: bend.direction,
    angle,
    radius,
    flangeLength,
    relief: normalizeRelief(bend.relief)
  };
}

export function bendDescendantIds(bends, seedIds) {
  const removed = new Set(uniqueTruthy(seedIds));
  let changed = true;
  while (changed) {
    changed = false;
    for (const bend of bends) {
      if (!removed.has(bend.id) && removed.has(bend.parentBendId)) {
        removed.add(bend.id);
        changed = true;
      }
    }
  }
  return removed;
}

export function normalizeRelief(relief) {
  if (!plainObject(relief)) fail("bend relief must be an object");
  if (!["auto", "manual"].includes(relief.mode)) fail(`unsupported bend relief mode ${relief.mode}`);
  if (!["none", "round", "rect", "obround", "v-notch"].includes(relief.type)) fail(`unsupported bend relief type ${relief.type}`);
  const optionalDimension = (key) => {
    const value = relief[key];
    if (value === undefined) return undefined;
    if (!finiteNonNegativeNumber(value)) fail(`bend relief ${key} must be zero or positive`);
    return value;
  };
  const radius = optionalDimension("radius");
  const width = optionalDimension("width");
  const depth = optionalDimension("depth");
  return {
    mode: relief.mode,
    type: relief.type,
    ...(radius !== undefined ? { radius } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(depth !== undefined ? { depth } : {})
  };
}
