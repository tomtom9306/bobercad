import { finiteNonNegativeNumber, finiteNumber, finitePositiveNumber } from "../../../core/math.mjs";
import { uniqueTruthy } from "../../../core/model.mjs";
import { sketchEdges } from "./model-accessors.mjs";
import { fail, plainObject, sketchEdgeIsCircularArc } from "./sketch-geometry-and-relations.mjs";

const BEND_PARENT_EDGES = new Set(["outer", "start", "end"]);

export function normalizeBend(bend, sketch, bendIds = new Set()) {
  if (!plainObject(bend)) fail("bend must be an object");
  if (bend.relief !== undefined) fail("bend relief is not supported; use plate fabrication.reliefDefaults and fabrication.cornerReliefs");
  const edgeIds = new Set(sketchEdges(sketch).map((edge) => edge.id));
  const parentBendId = bend.parentBendId;
  if (parentBendId !== undefined && (typeof parentBendId !== "string" || !parentBendId)) fail("bend parentBendId must be a non-empty string");
  const edgeId = parentBendId ? null : bend.edgeId;
  if (typeof bend.id !== "string" || !bend.id) fail("bend id must be a non-empty string");
  if (parentBendId) {
    if (!bendIds.has(parentBendId)) fail(`bend references unknown parent bend ${parentBendId}`);
    if (parentBendId === bend.id) fail("bend cannot reference itself as parent");
    if (!BEND_PARENT_EDGES.has(bend.parentEdge)) fail("bend parentEdge must be outer, start, or end");
  } else if (!edgeIds.has(edgeId)) {
    fail(`bend references unknown sketch edge ${edgeId}`);
  } else if (sketchEdgeIsCircularArc(sketch, edgeId)) {
    fail(`bend edge ${edgeId} must be a straight sketch edge; curved bend edges are not supported yet`);
  }
  const angle = bend.angle;
  const radius = bend.radius;
  const kFactor = bend.kFactor;
  const flangeLength = bend.flangeLength;
  const gap = bend.gap;
  const startGap = bend.startGap;
  const endGap = bend.endGap;
  if (!finiteNumber(angle)) fail("bend angle must be a finite number");
  if (!finiteNonNegativeNumber(radius)) fail("bend radius must be zero or positive");
  if (kFactor !== undefined && (!finiteNumber(kFactor) || kFactor < 0 || kFactor > 1)) fail("bend kFactor must be between 0 and 1");
  if (!finitePositiveNumber(flangeLength)) fail("bend flangeLength must be positive");
  if (gap !== undefined && !finiteNonNegativeNumber(gap)) fail("bend gap must be zero or positive");
  if (startGap !== undefined && !finiteNonNegativeNumber(startGap)) fail("bend startGap must be zero or positive");
  if (endGap !== undefined && !finiteNonNegativeNumber(endGap)) fail("bend endGap must be zero or positive");
  if (bend.direction !== "up" && bend.direction !== "down") fail("bend direction must be up or down");
  return {
    id: bend.id,
    ...(parentBendId ? { parentBendId, parentEdge: bend.parentEdge } : { edgeId }),
    direction: bend.direction,
    angle,
    radius,
    ...(kFactor !== undefined ? { kFactor } : {}),
    ...(gap !== undefined ? { gap } : {}),
    ...(startGap !== undefined ? { startGap } : {}),
    ...(endGap !== undefined ? { endGap } : {}),
    flangeLength
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
