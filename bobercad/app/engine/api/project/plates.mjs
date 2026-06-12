import { cleanVec2Loop, finiteNumber, finiteNumberOr, finitePositiveNumber, finiteVec3, v } from "../../core/math.mjs?v=distance2-dry-1";
import { arrayValues, uniqueTruthy } from "../../core/model.mjs?v=array-values-dry-1";
import { addIndexedObject, nextObjectId } from "./objects.mjs";

const EPSILON = 1e-9;
const SKETCH_RELATION_TYPES = new Set(["horizontal", "vertical", "horizontal-points", "vertical-points", "coincident", "point-on-line", "midpoint", "symmetric", "perpendicular", "parallel", "collinear", "equal-length", "fixed", "length", "angle", "distance"]);
const SKETCH_DIMENSION_RELATION_MODES = new Set(["driving", "driven"]);
const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;
const DEFAULT_SKETCH_NOTCH_SIZE = 10;
const DEFAULT_SKETCH_NOTCH_MAX_SIZE = 40;

function fail(message) {
  throw new Error(`plate api: ${message}`);
}

function vec2(value, label = "point") {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [y, z] point`);
  }
  return [...value];
}

function vec3(value, label = "point") {
  return finiteVec3(value, label, fail);
}

function cleanOutline(outline) {
  return cleanVec2Loop(outline, {
    tolerance: EPSILON,
    strict: true,
    label: "plate outline point",
    minPoints: 3,
    minMessage: "plate sketch requires at least three distinct points",
    fail
  });
}

function normalized(vector, label) {
  const unit = v.safeNorm(vector);
  if (v.len(unit) <= EPSILON) fail(`${label} must have non-zero length`);
  return unit;
}

function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

function finiteAngleDegrees(value, label = "plate sketch angle relation") {
  const angle = finiteNumberOr(value, NaN);
  if (!Number.isFinite(angle) || angle <= EPSILON || angle >= 180 - EPSILON) {
    fail(`${label} requires an angle greater than 0 and less than 180 degrees`);
  }
  return angle;
}

export function rectangleOutline(width, height) {
  if (!finitePositiveNumber(width)) fail("plate width must be a positive number");
  if (!finitePositiveNumber(height)) fail("plate height must be a positive number");
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2]
  ];
}

export function sketchFromOutline(outline, idPrefix = "sketch") {
  const points = cleanOutline(outline);
  const vertices = points.map((point, index) => ({
    id: `${idPrefix}_v${index + 1}`,
    point
  }));
  const edges = vertices.map((vertex, index) => ({
    id: `${idPrefix}_e${index + 1}`,
    from: vertex.id,
    to: vertices[(index + 1) % vertices.length].id
  }));
  return withInferredSketchRelations({ type: "plate-sketch", vertices, edges });
}

export function sketchFromRectangle(width, height, idPrefix = "sketch") {
  return sketchFromOutline(rectangleOutline(width, height), idPrefix);
}

export function workPlaneFromThreePoints(first, second, third, id = "work-plane") {
  const p0 = vec3(first, "work plane first point");
  const p1 = vec3(second, "work plane second point");
  const p2 = vec3(third, "work plane third point");
  const axisX = normalized(v.sub(p1, p0), "work plane axis");
  const rawSide = v.sub(p2, p0);
  const side = v.sub(rawSide, v.mul(axisX, v.dot(rawSide, axisX)));
  const axisY = normalized(side, "work plane side axis");
  const normal = normalized(v.cross(axisX, axisY), "work plane normal");
  return {
    id,
    label: id,
    origin: p0,
    normal,
    axisX,
    axisY
  };
}

export function platePlacementFromThreePoints(first, second, third, options = {}) {
  const p0 = vec3(first, "plate first point");
  const p1 = vec3(second, "plate second point");
  const p2 = vec3(third, "plate third point");
  const edge = v.sub(p1, p0);
  const length = v.len(edge);
  if (length <= EPSILON) fail("plate first edge must have non-zero length");
  const localAxisY = v.mul(edge, 1 / length);
  const rawSide = v.sub(p2, p0);
  const side = v.sub(rawSide, v.mul(localAxisY, v.dot(rawSide, localAxisY)));
  const depth = v.len(side);
  if (depth <= EPSILON) fail("plate third point must define non-zero plate depth");
  const localAxisZ = v.mul(side, 1 / depth);
  let normal = options.normal ? v.norm(vec3(options.normal, "plate normal")) : v.norm(v.cross(localAxisY, localAxisZ));
  if (v.len(normal) <= EPSILON) fail("plate normal could not be resolved");
  if (options.preferredNormal && v.dot(normal, options.preferredNormal) < 0) normal = v.mul(normal, -1);
  const center = v.add(p0, v.add(v.mul(localAxisY, length / 2), v.mul(localAxisZ, depth / 2)));
  return {
    center,
    normal,
    localAxisY,
    localAxisZ,
    sketch: sketchFromRectangle(length, depth, options.idPrefix || "plate")
  };
}

function outlineFromSketch(sketch) {
  if (!sketch || typeof sketch !== "object") fail("plate sketch is required");
  return cleanOutline(orderedSketchLoop(sketch).map((item) => item.point));
}

export function plateOutline(plate) {
  return outlineFromSketch(plate?.sketch);
}

export const sketchVertices = (sketch) => arrayValues(sketch?.vertices);
export const sketchEdges = (sketch) => arrayValues(sketch?.edges);
export const sketchConstructionVertices = (sketch) => arrayValues(sketch?.constructionVertices);
export const sketchConstructionEdges = (sketch) => arrayValues(sketch?.constructionEdges);
export const sketchRelationVertices = (sketch) => [...sketchVertices(sketch), ...sketchConstructionVertices(sketch)];
export const sketchRelationEdges = (sketch) => [...sketchEdges(sketch), ...sketchConstructionEdges(sketch)];
export const sketchRelations = (sketch) => arrayValues(sketch?.relations);
export const plateBends = (plate) => arrayValues(plate?.fabrication?.bends);

function sketchRelationId(type, ids = []) {
  return `rel_${type}_${ids.filter(Boolean).join("_")}`;
}

export function sketchRelationKey(relation) {
  if (relation?.type === "horizontal" || relation?.type === "vertical") return `${relation.type}|${relation.edgeId}`;
  if (relation?.type === "horizontal-points" || relation?.type === "vertical-points" || relation?.type === "coincident" || relation?.type === "distance") return `${relation.type}|${arrayValues(relation.vertexIds).sort().join("|")}`;
  if (relation?.type === "point-on-line" || relation?.type === "midpoint") return `${relation.type}|${relation.vertexId}|${relation.edgeId}`;
  if (relation?.type === "symmetric") return `${relation.type}|${arrayValues(relation.vertexIds).sort().join("|")}|${relation.edgeId}`;
  if (relation?.type === "length") return `${relation.type}|${relation.edgeId}`;
  if (relation?.type === "angle") return `${relation.type}|${arrayValues(relation.edgeIds).sort().join("|")}`;
  if (relation?.type === "fixed") return `${relation.type}|${relation.vertexId || relation.edgeId}`;
  if (relation?.type === "perpendicular" || relation?.type === "parallel" || relation?.type === "collinear" || relation?.type === "equal-length") {
    return `${relation.type}|${arrayValues(relation.edgeIds).sort().join("|")}`;
  }
  return `${relation?.type || ""}|${relation?.id || ""}`;
}

export function sketchRelationEdgeIds(relation) {
  if (!relation) return [];
  if (relation.edgeId) return [relation.edgeId];
  return arrayValues(relation.edgeIds);
}

export function sketchRelationVertexIds(relation) {
  return relation?.vertexId ? [relation.vertexId] : arrayValues(relation?.vertexIds);
}

export function sketchRelationLabel(relation) {
  if (!relation) return "Relation";
  if (relation.type === "horizontal") return "Horizontal";
  if (relation.type === "vertical") return "Vertical";
  if (relation.type === "horizontal-points") return "Horizontal points";
  if (relation.type === "vertical-points") return "Vertical points";
  if (relation.type === "coincident") return "Coincident";
  if (relation.type === "point-on-line") return "Point on line";
  if (relation.type === "midpoint") return "Midpoint";
  if (relation.type === "symmetric") return "Symmetric";
  if (relation.type === "perpendicular") return "Perpendicular";
  if (relation.type === "parallel") return "Parallel";
  if (relation.type === "collinear") return "Collinear";
  if (relation.type === "equal-length") return "Equal length";
  if (relation.type === "length") return "Length";
  if (relation.type === "angle") return "Angle";
  if (relation.type === "distance") return "Distance";
  if (relation.type === "fixed") return "Fixed";
  return relation.label || relation.type || "Relation";
}

export function sketchDimensionRelationMode(relation) {
  if (relation?.type !== "length" && relation?.type !== "angle" && relation?.type !== "distance") return null;
  return SKETCH_DIMENSION_RELATION_MODES.has(relation.mode) ? relation.mode : "driving";
}

export function sketchLengthRelationMode(relation) {
  if (relation?.type !== "length") return null;
  return sketchDimensionRelationMode(relation);
}

export function sketchAngleRelationMode(relation) {
  if (relation?.type !== "angle") return null;
  return sketchDimensionRelationMode(relation);
}

export function sketchDistanceRelationMode(relation) {
  if (relation?.type !== "distance") return null;
  return sketchDimensionRelationMode(relation);
}

export function isSketchLengthRelationDriven(relation) {
  return relation?.type === "length" && sketchLengthRelationMode(relation) === "driven";
}

export function isSketchAngleRelationDriven(relation) {
  return relation?.type === "angle" && sketchAngleRelationMode(relation) === "driven";
}

export function isSketchDistanceRelationDriven(relation) {
  return relation?.type === "distance" && sketchDistanceRelationMode(relation) === "driven";
}

function isDrivingLengthRelation(relation) {
  return relation?.type === "length" && sketchLengthRelationMode(relation) === "driving";
}

function isDrivingAngleRelation(relation) {
  return relation?.type === "angle" && sketchAngleRelationMode(relation) === "driving";
}

function isDrivingDistanceRelation(relation) {
  return relation?.type === "distance" && sketchDistanceRelationMode(relation) === "driving";
}

function isDrivingDimensionRelation(relation) {
  return isDrivingLengthRelation(relation) || isDrivingAngleRelation(relation) || isDrivingDistanceRelation(relation);
}

export function sketchRelationBadge(relation) {
  if (relation?.type === "horizontal") return "H";
  if (relation?.type === "vertical") return "V";
  if (relation?.type === "horizontal-points") return "H";
  if (relation?.type === "vertical-points") return "V";
  if (relation?.type === "coincident") return "CO";
  if (relation?.type === "point-on-line") return "ON";
  if (relation?.type === "midpoint") return "MID";
  if (relation?.type === "symmetric") return "SYM";
  if (relation?.type === "perpendicular") return "PERP";
  if (relation?.type === "parallel") return "PAR";
  if (relation?.type === "collinear") return "COL";
  if (relation?.type === "equal-length") return "EQ";
  if (relation?.type === "length") return isSketchLengthRelationDriven(relation) ? "REF" : "DIM";
  if (relation?.type === "angle") return isSketchAngleRelationDriven(relation) ? "REF" : "ANG";
  if (relation?.type === "distance") return isSketchDistanceRelationDriven(relation) ? "REF" : "DIST";
  if (relation?.type === "fixed") return "FIX";
  return "R";
}

function axisRelationTypeForEdgePoints(a, b, tolerance = EPSILON) {
  const dy = Math.abs((b?.[0] || 0) - (a?.[0] || 0));
  const dz = Math.abs((b?.[1] || 0) - (a?.[1] || 0));
  if (dz <= tolerance && dy > tolerance) return "horizontal";
  if (dy <= tolerance && dz > tolerance) return "vertical";
  return null;
}

function inferredSketchRelations(sketch) {
  const edges = sketchEdges(sketch);
  const vertexMap = sketchVertexPointMap(sketch);
  const relations = [];
  const edgeVectors = new Map();
  const edgeLengths = new Map();
  for (const edge of edges) {
    const a = vertexMap.get(edge.from);
    const b = vertexMap.get(edge.to);
    const type = axisRelationTypeForEdgePoints(a, b);
    if (type) relations.push({ id: sketchRelationId(type, [edge.id]), type, edgeId: edge.id });
    const delta = [(b?.[0] || 0) - (a?.[0] || 0), (b?.[1] || 0) - (a?.[1] || 0)];
    const length = Math.hypot(delta[0], delta[1]);
    edgeVectors.set(edge.id, length > EPSILON ? [delta[0] / length, delta[1] / length] : [0, 0]);
    edgeLengths.set(edge.id, length);
  }
  for (const edge of edges) {
    const next = edges.find((item) => item.from === edge.to);
    if (!next) continue;
    const { a, b } = sketchEdgePoints(sketch, edge, vertexMap);
    const { a: c, b: d } = sketchEdgePoints(sketch, next, vertexMap);
    const first = v.safeNorm([b[0] - a[0], b[1] - a[1], 0], [0, 0, 0]);
    const second = v.safeNorm([d[0] - c[0], d[1] - c[1], 0], [0, 0, 0]);
    if (v.len(first) <= EPSILON || v.len(second) <= EPSILON) continue;
    if (Math.abs(v.dot(first, second)) <= 1e-6) {
      relations.push({
        id: sketchRelationId("perpendicular", [edge.id, next.id]),
        type: "perpendicular",
        edgeIds: [edge.id, next.id]
      });
    }
  }
  if (edges.length === 4) {
    const pairs = [[edges[0], edges[2]], [edges[1], edges[3]]];
    for (const [firstEdge, secondEdge] of pairs) {
      const first = edgeVectors.get(firstEdge.id);
      const second = edgeVectors.get(secondEdge.id);
      if (!first || !second) continue;
      if (Math.abs(Math.abs(first[0] * second[0] + first[1] * second[1]) - 1) <= 1e-6) {
        relations.push({
          id: sketchRelationId("parallel", [firstEdge.id, secondEdge.id]),
          type: "parallel",
          edgeIds: [firstEdge.id, secondEdge.id]
        });
      }
      if (Math.abs((edgeLengths.get(firstEdge.id) || 0) - (edgeLengths.get(secondEdge.id) || 0)) <= EPSILON) {
        relations.push({
          id: sketchRelationId("equal-length", [firstEdge.id, secondEdge.id]),
          type: "equal-length",
          edgeIds: [firstEdge.id, secondEdge.id]
        });
      }
    }
  }
  return relations;
}

function measuredSketchEdgeLength(sketch, edgeId) {
  const { a, b } = sketchEdgePoints(sketch, edgeId);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length <= EPSILON) fail(`plate sketch edge ${edgeId} has zero length`);
  return length;
}

function measuredSketchPointDistance(sketch, vertexIds, vertexMap = sketchVertexPointMap(sketch)) {
  const ids = uniqueTruthy(arrayValues(vertexIds));
  if (ids.length !== 2) fail("plate sketch distance relation requires two vertexIds");
  const first = vertexMap.get(ids[0]);
  const second = vertexMap.get(ids[1]);
  if (!first || !second) fail("plate sketch distance relation references missing vertex");
  const distance = Math.hypot(second[0] - first[0], second[1] - first[1]);
  if (distance <= EPSILON) fail("plate sketch distance relation requires non-zero point distance");
  return distance;
}

export function sketchPointDistance(sketch, vertexIds) {
  return measuredSketchPointDistance(sketch, vertexIds);
}

function sketchEdgeAngleFromVectors(first, second) {
  const dot = clampUnit(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]);
  return Math.acos(dot) * DEG_PER_RAD;
}

function sketchAngleDeltaDegrees(actual, expected) {
  return Math.abs(actual - expected);
}

function measuredSketchEdgeAngle(sketch, edgeIds, vertexMap = sketchVertexPointMap(sketch)) {
  const ids = uniqueTruthy(arrayValues(edgeIds));
  if (ids.length !== 2) fail("plate sketch angle relation requires two edgeIds");
  const first = sketchRelationVector(sketch, ids[0], vertexMap);
  const second = sketchRelationVector(sketch, ids[1], vertexMap);
  return sketchEdgeAngleFromVectors(first, second);
}

export function sketchEdgeAngleDegrees(sketch, edgeIds) {
  return measuredSketchEdgeAngle(sketch, edgeIds);
}

function normalizeSketchRelations(sketch) {
  const edgeIds = new Set(sketchRelationEdges(sketch).map((edge) => edge.id));
  const vertexIds = new Set(sketchRelationVertices(sketch).map((vertex) => vertex.id));
  const seen = new Set();
  const relations = [];
  for (const relation of sketchRelations(sketch)) {
    const type = relation?.type;
    if (!SKETCH_RELATION_TYPES.has(type)) fail(`unsupported plate sketch relation type: ${type || "missing"}`);
    let next = null;
    if (type === "horizontal" || type === "vertical" || type === "length") {
      if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
      const mode = type === "length" && relation.mode === "driven" ? "driven" : "driving";
      const value = type === "length" && mode === "driven"
        ? measuredSketchEdgeLength(sketch, relation.edgeId)
        : type === "length"
          ? finiteNumberOr(relation.value, NaN)
          : undefined;
      if (type === "length" && (!Number.isFinite(value) || value <= EPSILON)) fail("plate sketch length relation requires positive value");
      next = {
        id: relation.id || sketchRelationId(type, [relation.edgeId]),
        type,
        edgeId: relation.edgeId,
        ...(type === "length" ? { value, mode } : {})
      };
    } else if (type === "horizontal-points" || type === "vertical-points" || type === "coincident" || type === "distance") {
      const ids = uniqueTruthy(arrayValues(relation.vertexIds));
      if (ids.length !== 2) fail(`${type} plate sketch relation requires two vertexIds`);
      for (const vertexId of ids) {
        if (!vertexIds.has(vertexId)) fail(`plate sketch relation references unknown vertex ${vertexId}`);
      }
      const mode = type === "distance" && relation.mode === "driven" ? "driven" : "driving";
      const value = type === "distance" && mode === "driven"
        ? measuredSketchPointDistance(sketch, ids)
        : type === "distance"
          ? finiteNumberOr(relation.value, NaN)
          : undefined;
      if (type === "distance" && (!Number.isFinite(value) || value <= EPSILON)) fail("plate sketch distance relation requires positive value");
      next = {
        id: relation.id || sketchRelationId(type, ids),
        type,
        vertexIds: ids,
        ...(type === "distance" ? { value, mode } : {})
      };
    } else if (type === "point-on-line" || type === "midpoint") {
      if (!vertexIds.has(relation.vertexId)) fail(`plate sketch relation references unknown vertex ${relation.vertexId}`);
      if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
      assertSketchPointLineRelationCanUseEdge(sketch, relation);
      next = {
        id: relation.id || sketchRelationId(type, [relation.vertexId, relation.edgeId]),
        type,
        vertexId: relation.vertexId,
        edgeId: relation.edgeId
      };
    } else if (type === "symmetric") {
      const ids = uniqueTruthy(arrayValues(relation.vertexIds));
      if (ids.length !== 2) fail("symmetric plate sketch relation requires two vertexIds");
      for (const vertexId of ids) {
        if (!vertexIds.has(vertexId)) fail(`plate sketch relation references unknown vertex ${vertexId}`);
      }
      if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
      next = {
        id: relation.id || sketchRelationId(type, [...ids, relation.edgeId]),
        type,
        vertexIds: ids,
        edgeId: relation.edgeId
      };
    } else if (type === "fixed") {
      if (relation.vertexId) {
        if (!vertexIds.has(relation.vertexId)) fail(`plate sketch relation references unknown vertex ${relation.vertexId}`);
        next = {
          id: relation.id || sketchRelationId(type, [relation.vertexId]),
          type,
          vertexId: relation.vertexId
        };
      } else {
        if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
        next = {
          id: relation.id || sketchRelationId(type, [relation.edgeId]),
          type,
          edgeId: relation.edgeId
        };
      }
    } else if (type === "perpendicular" || type === "parallel" || type === "collinear" || type === "equal-length" || type === "angle") {
      const ids = uniqueTruthy(arrayValues(relation.edgeIds));
      if (ids.length !== 2) fail(`${type} plate sketch relation requires two edgeIds`);
      for (const edgeId of ids) {
        if (!edgeIds.has(edgeId)) fail(`plate sketch relation references unknown edge ${edgeId}`);
      }
      const mode = type === "angle" && relation.mode === "driven" ? "driven" : "driving";
      const value = type === "angle" && mode === "driven"
        ? measuredSketchEdgeAngle(sketch, ids)
        : type === "angle"
          ? finiteAngleDegrees(relation.value)
          : undefined;
      next = {
        id: relation.id || sketchRelationId(type, ids),
        type,
        edgeIds: ids,
        ...(type === "angle" ? { value, mode } : {})
      };
    }
    const key = sketchRelationKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    relations.push(next);
  }
  return relations;
}

function withSketchRelations(sketch, relations) {
  return {
    ...sketch,
    relations: normalizeSketchRelations({ ...sketch, relations })
  };
}

function withInferredSketchRelations(sketch) {
  return withSketchRelations(sketch, inferredSketchRelations(sketch));
}

function normalizeSketchWithOptionalInference(sketch) {
  return Array.isArray(sketch?.relations)
    ? withSketchRelations(sketch, sketch.relations)
    : withInferredSketchRelations(sketch);
}

function edgeById(sketch, edgeId) {
  return sketchRelationEdges(sketch).find((edge) => edge.id === edgeId) || null;
}

function edgeEndpointIds(sketch, edgeId) {
  const edge = edgeById(sketch, edgeId);
  return edge ? [edge.from, edge.to] : [];
}

function assertSketchPointLineRelationCanUseEdge(sketch, relation) {
  if (!relation?.vertexId || !relation?.edgeId) return;
  if (edgeEndpointIds(sketch, relation.edgeId).includes(relation.vertexId)) {
    fail(`${sketchRelationLabel(relation)} relation cannot target an edge that already owns ${relation.vertexId}`);
  }
}

function sketchSolverFixedVertexIds(sketch) {
  const fixed = new Set();
  for (const relation of sketchRelations(sketch)) {
    if (relation.type !== "fixed") continue;
    if (relation.vertexId) fixed.add(relation.vertexId);
    for (const edgeId of sketchRelationEdgeIds(relation)) {
      for (const vertexId of edgeEndpointIds(sketch, edgeId)) fixed.add(vertexId);
    }
  }
  return fixed;
}

function solveSketchRelationsAfterVertexChange(sketch, changedVertexIds = []) {
  const changed = new Set(uniqueTruthy(changedVertexIds));
  const drivers = new Set(changed);
  const fixed = sketchSolverFixedVertexIds(sketch);
  for (const vertexId of changed) {
    if (fixed.has(vertexId)) fail(`plate sketch vertex ${vertexId} is fixed`);
  }

  const vertices = sketchRelationVertices(sketch).map((vertex) => ({ ...vertex, point: vec2(vertex.point, `plate sketch vertex ${vertex.id}`) }));
  const vertexMap = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const point = (vertexId) => vertexMap.get(vertexId)?.point || null;
  const setPoint = (vertexId, nextPoint) => {
    if (fixed.has(vertexId)) return false;
    const vertex = vertexMap.get(vertexId);
    if (!vertex) return false;
    vertex.point = vec2(nextPoint, `plate sketch vertex ${vertexId}`);
    changed.add(vertexId);
    return true;
  };
  const edgeVector = (edgeId) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const a = point(from);
    const b = point(to);
    return a && b ? [b[0] - a[0], b[1] - a[1]] : null;
  };
  const edgeLength = (edgeId) => {
    const vector = edgeVector(edgeId);
    return vector ? Math.hypot(vector[0], vector[1]) : 0;
  };
  const edgeChanged = (edgeId) => edgeEndpointIds(sketch, edgeId).some((vertexId) => changed.has(vertexId));
  const vertexConstraintWeight = (vertexId, currentEdgeId) => {
    if (fixed.has(vertexId)) return Infinity;
    let weight = 0;
    for (const relation of sketchRelations(sketch)) {
      for (const edgeId of sketchRelationEdgeIds(relation)) {
        if (edgeId === currentEdgeId) continue;
        if (edgeEndpointIds(sketch, edgeId).includes(vertexId)) weight += 1;
      }
      if (sketchRelationVertexIds(relation).includes(vertexId)) weight += 1;
    }
    return weight;
  };
  const edgeFreeEndpoint = (edgeId) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const candidates = [
      { moving: to, anchor: from, changed: changed.has(to), weight: vertexConstraintWeight(to, edgeId), order: 0 },
      { moving: from, anchor: to, changed: changed.has(from), weight: vertexConstraintWeight(from, edgeId), order: 1 }
    ].filter((candidate) => candidate.moving && candidate.anchor && Number.isFinite(candidate.weight));
    if (!candidates.length) return null;
    const pool = candidates.some((candidate) => candidate.changed)
      ? candidates.filter((candidate) => candidate.changed)
      : candidates;
    pool.sort((a, b) => a.weight - b.weight || a.order - b.order);
    return { moving: pool[0].moving, anchor: pool[0].anchor };
  };
  const addAxisLock = (locks, coord, value, label) => {
    if (!Number.isFinite(value)) return;
    if (locks.has(coord) && Math.abs(locks.get(coord) - value) > EPSILON) {
      fail(`plate sketch ${label} has conflicting axis relations`);
    }
    locks.set(coord, value);
  };
  const axisLocksForVertex = (vertexId) => {
    const locks = new Map();
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal" || relation.type === "vertical") {
        const coord = relation.type === "horizontal" ? 1 : 0;
        const [from, to] = edgeEndpointIds(sketch, relation.edgeId);
        if (from !== vertexId && to !== vertexId) continue;
        const other = point(from === vertexId ? to : from);
        addAxisLock(locks, coord, other?.[coord], vertexId);
      }
      if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
        const coord = relation.type === "horizontal-points" ? 1 : 0;
        const ids = sketchRelationVertexIds(relation);
        if (!ids.includes(vertexId)) continue;
        const otherId = ids.find((id) => id !== vertexId);
        const other = point(otherId);
        addAxisLock(locks, coord, other?.[coord], vertexId);
      }
    }
    return locks;
  };
  const constrainedPointOnLineProjection = (vertexId, vertexPoint, lineStart, lineVector, fallbackProjected) => {
    const locks = axisLocksForVertex(vertexId);
    if (!locks.size) return fallbackProjected;
    if (locks.has(0) && locks.has(1)) return [locks.get(0), locks.get(1)];
    const coord = locks.has(0) ? 0 : 1;
    const lockedValue = locks.get(coord);
    const denom = lineVector[coord];
    if (Math.abs(denom) > EPSILON) {
      const station = (lockedValue - lineStart[coord]) / denom;
      return [lineStart[0] + lineVector[0] * station, lineStart[1] + lineVector[1] * station];
    }
    if (Math.abs(lineStart[coord] - lockedValue) <= EPSILON) {
      const next = [...fallbackProjected];
      next[coord] = lockedValue;
      return next;
    }
    return vertexPoint;
  };
  const setAxisRelation = (edgeId, axis) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const a = point(from);
    const b = point(to);
    if (!a || !b) return;
    const coord = axis === "z" ? 1 : 0;
    const target = fixed.has(from)
      ? a[coord]
      : fixed.has(to)
        ? b[coord]
        : drivers.has(from) && !drivers.has(to)
          ? a[coord]
          : drivers.has(to) && !drivers.has(from)
            ? b[coord]
            : changed.has(from) && !changed.has(to)
              ? a[coord]
              : changed.has(to) && !changed.has(from)
                ? b[coord]
                : (a[coord] + b[coord]) / 2;
    if (fixed.has(from) && Math.abs(a[coord] - target) > EPSILON) fail(`fixed vertex ${from} conflicts with ${axis === "z" ? "horizontal" : "vertical"} relation`);
    if (fixed.has(to) && Math.abs(b[coord] - target) > EPSILON) fail(`fixed vertex ${to} conflicts with ${axis === "z" ? "horizontal" : "vertical"} relation`);
    if (!fixed.has(from) && Math.abs(a[coord] - target) > EPSILON) {
      const next = [...a];
      next[coord] = target;
      setPoint(from, next);
    }
    if (!fixed.has(to) && Math.abs(b[coord] - target) > EPSILON) {
      const next = [...b];
      next[coord] = target;
      setPoint(to, next);
    }
  };
  const setPointAxisRelation = (vertexIds, axis) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second) return;
    const coord = axis === "z" ? 1 : 0;
    const target = fixed.has(firstId)
      ? first[coord]
      : fixed.has(secondId)
        ? second[coord]
        : drivers.has(firstId) && !drivers.has(secondId)
          ? first[coord]
          : drivers.has(secondId) && !drivers.has(firstId)
            ? second[coord]
            : changed.has(firstId) && !changed.has(secondId)
              ? first[coord]
              : changed.has(secondId) && !changed.has(firstId)
                ? second[coord]
                : (first[coord] + second[coord]) / 2;
    if (fixed.has(firstId) && Math.abs(first[coord] - target) > EPSILON) fail(`fixed vertex ${firstId} conflicts with point alignment relation`);
    if (fixed.has(secondId) && Math.abs(second[coord] - target) > EPSILON) fail(`fixed vertex ${secondId} conflicts with point alignment relation`);
    if (!fixed.has(firstId) && Math.abs(first[coord] - target) > EPSILON) {
      const next = [...first];
      next[coord] = target;
      setPoint(firstId, next);
    }
    if (!fixed.has(secondId) && Math.abs(second[coord] - target) > EPSILON) {
      const next = [...second];
      next[coord] = target;
      setPoint(secondId, next);
    }
  };
  const applyCoincidentRelation = (vertexIds) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second) return;
    const target = fixed.has(firstId)
      ? first
      : fixed.has(secondId)
        ? second
        : drivers.has(firstId) && !drivers.has(secondId)
          ? first
          : drivers.has(secondId) && !drivers.has(firstId)
            ? second
            : changed.has(firstId) && !changed.has(secondId)
              ? first
              : changed.has(secondId) && !changed.has(firstId)
                ? second
                : [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    if (fixed.has(firstId) && Math.hypot(first[0] - target[0], first[1] - target[1]) > EPSILON) fail(`fixed vertex ${firstId} conflicts with coincident relation`);
    if (fixed.has(secondId) && Math.hypot(second[0] - target[0], second[1] - target[1]) > EPSILON) fail(`fixed vertex ${secondId} conflicts with coincident relation`);
    if (!fixed.has(firstId) && Math.hypot(first[0] - target[0], first[1] - target[1]) > EPSILON) setPoint(firstId, target);
    if (!fixed.has(secondId) && Math.hypot(second[0] - target[0], second[1] - target[1]) > EPSILON) setPoint(secondId, target);
  };
  const applyDirectionalRelation = (targetEdgeId, referenceEdgeId, relationType) => {
    const target = edgeVector(targetEdgeId);
    const reference = edgeVector(referenceEdgeId);
    const length = edgeLength(targetEdgeId);
    if (!target || !reference || length <= EPSILON) return;
    const referenceLength = Math.hypot(reference[0], reference[1]);
    if (referenceLength <= EPSILON) return;
    let unit = [reference[0] / referenceLength, reference[1] / referenceLength];
    if (relationType === "perpendicular") unit = [-unit[1], unit[0]];
    if (unit[0] * target[0] + unit[1] * target[1] < 0) unit = [-unit[0], -unit[1]];
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    const sign = endpoint.moving === edgeById(sketch, targetEdgeId)?.to ? 1 : -1;
    setPoint(endpoint.moving, [anchor[0] + unit[0] * length * sign, anchor[1] + unit[1] * length * sign]);
  };
  const rotateUnit = (unit, radians) => {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [unit[0] * cos - unit[1] * sin, unit[0] * sin + unit[1] * cos];
  };
  const applyAngleRelation = (targetEdgeId, referenceEdgeId, angleDegrees) => {
    const target = edgeVector(targetEdgeId);
    const reference = edgeVector(referenceEdgeId);
    const length = edgeLength(targetEdgeId);
    if (!target || !reference || length <= EPSILON) return;
    const targetLength = Math.hypot(target[0], target[1]);
    const referenceLength = Math.hypot(reference[0], reference[1]);
    if (targetLength <= EPSILON || referenceLength <= EPSILON) return;
    const targetUnit = [target[0] / targetLength, target[1] / targetLength];
    const referenceUnit = [reference[0] / referenceLength, reference[1] / referenceLength];
    const radians = finiteAngleDegrees(angleDegrees) * RAD_PER_DEG;
    const candidates = [
      rotateUnit(referenceUnit, radians),
      rotateUnit(referenceUnit, -radians)
    ];
    let unit = candidates[0];
    if (dot2(candidates[1], targetUnit) > dot2(unit, targetUnit)) unit = candidates[1];
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    const sign = endpoint.moving === edgeById(sketch, targetEdgeId)?.to ? 1 : -1;
    setPoint(endpoint.moving, [anchor[0] + unit[0] * length * sign, anchor[1] + unit[1] * length * sign]);
  };
  const applyCollinearRelation = (targetEdgeId, referenceEdgeId) => {
    const targetEdge = edgeById(sketch, targetEdgeId);
    const referenceEdge = edgeById(sketch, referenceEdgeId);
    if (!targetEdge || !referenceEdge) return;
    const referenceVector = edgeVector(referenceEdgeId);
    const targetVector = edgeVector(targetEdgeId);
    const targetLength = edgeLength(targetEdgeId);
    const referenceStart = point(referenceEdge.from);
    const targetStart = point(targetEdge.from);
    const targetEnd = point(targetEdge.to);
    if (!referenceVector || !targetVector || !referenceStart || !targetStart || !targetEnd || targetLength <= EPSILON) return;
    const referenceLength = Math.hypot(referenceVector[0], referenceVector[1]);
    if (referenceLength <= EPSILON) return;
    let unit = [referenceVector[0] / referenceLength, referenceVector[1] / referenceLength];
    if (unit[0] * targetVector[0] + unit[1] * targetVector[1] < 0) unit = [-unit[0], -unit[1]];
    const projectedPoint = (item) => {
      const station = dot2([item[0] - referenceStart[0], item[1] - referenceStart[1]], unit);
      return [referenceStart[0] + unit[0] * station, referenceStart[1] + unit[1] * station];
    };
    if (fixed.has(targetEdge.from) && !fixed.has(targetEdge.to)) {
      const anchor = point(targetEdge.from);
      setPoint(targetEdge.to, [anchor[0] + unit[0] * targetLength, anchor[1] + unit[1] * targetLength]);
      return;
    }
    if (fixed.has(targetEdge.to) && !fixed.has(targetEdge.from)) {
      const anchor = point(targetEdge.to);
      setPoint(targetEdge.from, [anchor[0] - unit[0] * targetLength, anchor[1] - unit[1] * targetLength]);
      return;
    }
    if (fixed.has(targetEdge.from) && fixed.has(targetEdge.to)) return;
    const midpointOnLine = projectedPoint([(targetStart[0] + targetEnd[0]) / 2, (targetStart[1] + targetEnd[1]) / 2]);
    setPoint(targetEdge.from, [midpointOnLine[0] - unit[0] * targetLength / 2, midpointOnLine[1] - unit[1] * targetLength / 2]);
    setPoint(targetEdge.to, [midpointOnLine[0] + unit[0] * targetLength / 2, midpointOnLine[1] + unit[1] * targetLength / 2]);
  };
  const applyPointOnLineRelation = (vertexId, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const vertexPoint = point(vertexId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const edgeVectorValue = edgeVector(edgeId);
    if (!edge || !vertexPoint || !from || !to || !edgeVectorValue) return;
    const length = Math.hypot(edgeVectorValue[0], edgeVectorValue[1]);
    if (length <= EPSILON) return;
    const unit = [edgeVectorValue[0] / length, edgeVectorValue[1] / length];
    const station = dot2([vertexPoint[0] - from[0], vertexPoint[1] - from[1]], unit);
    const projected = [from[0] + unit[0] * station, from[1] + unit[1] * station];
    const constrainedProjected = fixed.has(vertexId)
      ? projected
      : constrainedPointOnLineProjection(vertexId, vertexPoint, from, edgeVectorValue, projected);
    const targetPoint = constrainedProjected || projected;
    const offset = [vertexPoint[0] - targetPoint[0], vertexPoint[1] - targetPoint[1]];
    if (Math.hypot(offset[0], offset[1]) <= EPSILON) return;
    if (!fixed.has(vertexId)) {
      setPoint(vertexId, targetPoint);
      return;
    }
    if (fixed.has(edge.from) && fixed.has(edge.to)) return;
    if (!fixed.has(edge.from)) setPoint(edge.from, [from[0] + offset[0], from[1] + offset[1]]);
    if (!fixed.has(edge.to)) setPoint(edge.to, [to[0] + offset[0], to[1] + offset[1]]);
  };
  const applyMidpointRelation = (vertexId, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const vertexPoint = point(vertexId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    if (!edge || !vertexPoint || !from || !to) return;
    const midpointPoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const offset = [vertexPoint[0] - midpointPoint[0], vertexPoint[1] - midpointPoint[1]];
    if (Math.hypot(offset[0], offset[1]) <= EPSILON) return;
    if (!fixed.has(vertexId)) {
      setPoint(vertexId, midpointPoint);
      return;
    }
    if (fixed.has(edge.from) && fixed.has(edge.to)) return;
    if (fixed.has(edge.from) && !fixed.has(edge.to)) {
      setPoint(edge.to, [vertexPoint[0] * 2 - from[0], vertexPoint[1] * 2 - from[1]]);
      return;
    }
    if (fixed.has(edge.to) && !fixed.has(edge.from)) {
      setPoint(edge.from, [vertexPoint[0] * 2 - to[0], vertexPoint[1] * 2 - to[1]]);
      return;
    }
    setPoint(edge.from, [from[0] + offset[0], from[1] + offset[1]]);
    setPoint(edge.to, [to[0] + offset[0], to[1] + offset[1]]);
  };
  const reflectedPointAcrossEdge = (item, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const axis = edgeVector(edgeId);
    if (!edge || !from || !to || !axis) return null;
    const length = Math.hypot(axis[0], axis[1]);
    if (length <= EPSILON) return null;
    const unit = [axis[0] / length, axis[1] / length];
    const station = dot2([item[0] - from[0], item[1] - from[1]], unit);
    const projected = [from[0] + unit[0] * station, from[1] + unit[1] * station];
    return [projected[0] * 2 - item[0], projected[1] * 2 - item[1]];
  };
  const alignSymmetryEdgeToFixedPoints = (first, second, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const axis = edgeVector(edgeId);
    if (!edge || !from || !to || !axis || fixed.has(edge.from) || fixed.has(edge.to)) return;
    const pair = [second[0] - first[0], second[1] - first[1]];
    const pairLength = Math.hypot(pair[0], pair[1]);
    const edgeLengthValue = Math.hypot(axis[0], axis[1]);
    if (pairLength <= EPSILON || edgeLengthValue <= EPSILON) return;
    let unit = [-pair[1] / pairLength, pair[0] / pairLength];
    if (unit[0] * axis[0] + unit[1] * axis[1] < 0) unit = [-unit[0], -unit[1]];
    const center = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    setPoint(edge.from, [center[0] - unit[0] * edgeLengthValue / 2, center[1] - unit[1] * edgeLengthValue / 2]);
    setPoint(edge.to, [center[0] + unit[0] * edgeLengthValue / 2, center[1] + unit[1] * edgeLengthValue / 2]);
  };
  const applySymmetricRelation = (vertexIds, edgeId) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second || !edgeById(sketch, edgeId)) return;
    if (fixed.has(firstId) && fixed.has(secondId)) {
      alignSymmetryEdgeToFixedPoints(first, second, edgeId);
      return;
    }
    if (fixed.has(firstId) && !fixed.has(secondId)) {
      const reflected = reflectedPointAcrossEdge(first, edgeId);
      if (reflected) setPoint(secondId, reflected);
      return;
    }
    if (fixed.has(secondId) && !fixed.has(firstId)) {
      const reflected = reflectedPointAcrossEdge(second, edgeId);
      if (reflected) setPoint(firstId, reflected);
      return;
    }
    const useFirstAsDriver = drivers.has(firstId) || changed.has(firstId) || (!drivers.has(secondId) && !changed.has(secondId));
    const source = useFirstAsDriver ? first : second;
    const targetId = useFirstAsDriver ? secondId : firstId;
    const reflected = reflectedPointAcrossEdge(source, edgeId);
    if (reflected) setPoint(targetId, reflected);
  };
  const applyEqualLengthRelation = (targetEdgeId, referenceEdgeId) => {
    const targetLength = edgeLength(referenceEdgeId);
    applyLengthRelation(targetEdgeId, targetLength);
  };
  const applyLengthRelation = (targetEdgeId, targetLength) => {
    const vector = edgeVector(targetEdgeId);
    const currentLength = vector ? Math.hypot(vector[0], vector[1]) : 0;
    if (targetLength <= EPSILON || currentLength <= EPSILON) return;
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    let unit = [vector[0] / currentLength, vector[1] / currentLength];
    if (endpoint.moving === edgeById(sketch, targetEdgeId)?.from) unit = [-unit[0], -unit[1]];
    setPoint(endpoint.moving, [anchor[0] + unit[0] * targetLength, anchor[1] + unit[1] * targetLength]);
  };
  const applyDistanceRelation = (vertexIds, targetDistance) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second || targetDistance <= EPSILON) return;
    let movingId = null;
    let anchorId = null;
    if (fixed.has(firstId) && !fixed.has(secondId)) {
      movingId = secondId;
      anchorId = firstId;
    } else if (fixed.has(secondId) && !fixed.has(firstId)) {
      movingId = firstId;
      anchorId = secondId;
    } else if (fixed.has(firstId) && fixed.has(secondId)) {
      return;
    } else if ((drivers.has(firstId) || changed.has(firstId)) && !drivers.has(secondId) && !changed.has(secondId)) {
      movingId = firstId;
      anchorId = secondId;
    } else if ((drivers.has(secondId) || changed.has(secondId)) && !drivers.has(firstId) && !changed.has(firstId)) {
      movingId = secondId;
      anchorId = firstId;
    } else {
      movingId = secondId;
      anchorId = firstId;
    }
    const moving = point(movingId);
    const anchor = point(anchorId);
    if (!moving || !anchor) return;
    const vector = [moving[0] - anchor[0], moving[1] - anchor[1]];
    const currentDistance = Math.hypot(vector[0], vector[1]);
    const unit = currentDistance > EPSILON
      ? [vector[0] / currentDistance, vector[1] / currentDistance]
      : [1, 0];
    setPoint(movingId, [anchor[0] + unit[0] * targetDistance, anchor[1] + unit[1] * targetDistance]);
  };

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal") setAxisRelation(relation.edgeId, "z");
      if (relation.type === "vertical") setAxisRelation(relation.edgeId, "y");
      if (relation.type === "horizontal-points") setPointAxisRelation(relation.vertexIds, "z");
      if (relation.type === "vertical-points") setPointAxisRelation(relation.vertexIds, "y");
      if (relation.type === "coincident") applyCoincidentRelation(relation.vertexIds);
      if (relation.type === "point-on-line") applyPointOnLineRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "midpoint") applyMidpointRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "symmetric") applySymmetricRelation(relation.vertexIds, relation.edgeId);
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "parallel" && relation.type !== "perpendicular" && relation.type !== "collinear") continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) {
        if (relation.type === "collinear") applyCollinearRelation(firstEdgeId, secondEdgeId);
        else applyDirectionalRelation(firstEdgeId, secondEdgeId, relation.type);
      } else if (secondChanged && !firstChanged) {
        if (relation.type === "collinear") applyCollinearRelation(secondEdgeId, firstEdgeId);
        else applyDirectionalRelation(secondEdgeId, firstEdgeId, relation.type);
      }
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "equal-length") continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) applyEqualLengthRelation(firstEdgeId, secondEdgeId);
      else if (secondChanged && !firstChanged) applyEqualLengthRelation(secondEdgeId, firstEdgeId);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingAngleRelation(relation)) continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) applyAngleRelation(firstEdgeId, secondEdgeId, relation.value);
      else if (secondChanged && !firstChanged) applyAngleRelation(secondEdgeId, firstEdgeId, relation.value);
      else applyAngleRelation(secondEdgeId, firstEdgeId, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingLengthRelation(relation)) continue;
      applyLengthRelation(relation.edgeId, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingDistanceRelation(relation)) continue;
      applyDistanceRelation(relation.vertexIds, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal") setAxisRelation(relation.edgeId, "z");
      if (relation.type === "vertical") setAxisRelation(relation.edgeId, "y");
      if (relation.type === "horizontal-points") setPointAxisRelation(relation.vertexIds, "z");
      if (relation.type === "vertical-points") setPointAxisRelation(relation.vertexIds, "y");
      if (relation.type === "coincident") applyCoincidentRelation(relation.vertexIds);
      if (relation.type === "point-on-line") applyPointOnLineRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "midpoint") applyMidpointRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "symmetric") applySymmetricRelation(relation.vertexIds, relation.edgeId);
    }
  }

  const outlineVertexIds = new Set(sketchVertices(sketch).map((vertex) => vertex.id));
  const solvedVertexMap = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  return {
    ...sketch,
    vertices: vertices.filter((vertex) => outlineVertexIds.has(vertex.id)),
    constructionVertices: sketchConstructionVertices(sketch).map((vertex) => solvedVertexMap.get(vertex.id) || vertex)
  };
}

function relationTouchesVertices(sketch, relation, vertexIds) {
  const ids = new Set(vertexIds);
  if (!ids.size) return false;
  if (sketchRelationVertexIds(relation).some((vertexId) => ids.has(vertexId))) return true;
  return sketchRelationEdgeIds(relation).some((edgeId) => edgeEndpointIds(sketch, edgeId).some((vertexId) => ids.has(vertexId)));
}

function relaxRelationsForDirectVertexMove(sketch, changedVertexIds = []) {
  if (!changedVertexIds.length) return sketch;
  const relations = sketchRelations(sketch).filter((relation) => {
    if (relation.type !== "equal-length") return true;
    return !relationTouchesVertices(sketch, relation, changedVertexIds);
  });
  return withSketchRelations(sketch, relations);
}

function sketchRelationVector(sketch, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const { a, b } = sketchEdgePoints(sketch, edgeId, vertexMap);
  const delta = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(delta[0], delta[1]);
  if (length <= EPSILON) fail(`plate sketch relation edge ${edgeId} has zero length`);
  return {
    a,
    b,
    delta,
    length,
    unit: [delta[0] / length, delta[1] / length]
  };
}

function sketchCollinearDistance(first, second) {
  const offset = [second.a[0] - first.a[0], second.a[1] - first.a[1]];
  return Math.abs(first.delta[0] * offset[1] - first.delta[1] * offset[0]) / Math.max(first.length, EPSILON);
}

function sketchPointOnLineDistance(sketch, vertexId, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const vertex = vertexMap.get(vertexId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  const offset = [vertex?.[0] - edge.a[0], vertex?.[1] - edge.a[1]];
  return Math.abs(edge.delta[0] * offset[1] - edge.delta[1] * offset[0]) / Math.max(edge.length, EPSILON);
}

function sketchMidpointDistance(sketch, vertexId, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const vertex = vertexMap.get(vertexId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  const midpointPoint = [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2];
  return vertex ? Math.hypot(vertex[0] - midpointPoint[0], vertex[1] - midpointPoint[1]) : Infinity;
}

function sketchSymmetricResidual(sketch, vertexIds, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const [firstId, secondId] = sketchRelationVertexIds({ vertexIds });
  const first = vertexMap.get(firstId);
  const second = vertexMap.get(secondId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  if (!first || !second) return Infinity;
  const pair = [second[0] - first[0], second[1] - first[1]];
  const pairMidpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const midpointOffset = [pairMidpoint[0] - edge.a[0], pairMidpoint[1] - edge.a[1]];
  const midpointDistance = Math.abs(edge.delta[0] * midpointOffset[1] - edge.delta[1] * midpointOffset[0]) / Math.max(edge.length, EPSILON);
  const perpendicularResidual = Math.abs(edge.unit[0] * pair[0] + edge.unit[1] * pair[1]);
  return Math.max(midpointDistance, perpendicularResidual);
}

function assertSketchRelationsSatisfied(sketch) {
  const vertexMap = sketchVertexPointMap(sketch);
  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "fixed") continue;
    if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const first = vertexMap.get(firstId);
      const second = vertexMap.get(secondId);
      if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
      const coord = relation.type === "horizontal-points" ? 1 : 0;
      if (Math.abs(first[coord] - second[coord]) > 1e-6) {
        fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${firstId}/${secondId}`);
      }
      continue;
    }
    if (relation.type === "coincident") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const first = vertexMap.get(firstId);
      const second = vertexMap.get(secondId);
      if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
      if (Math.hypot(first[0] - second[0], first[1] - second[1]) > 1e-6) {
        fail(`Coincident relation is not satisfied on ${firstId}/${secondId}`);
      }
      continue;
    }
    if (relation.type === "point-on-line") {
      if (sketchPointOnLineDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Point on line relation is not satisfied on ${relation.vertexId}/${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "midpoint") {
      if (sketchMidpointDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Midpoint relation is not satisfied on ${relation.vertexId}/${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "symmetric") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      if (sketchSymmetricResidual(sketch, relation.vertexIds, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Symmetric relation is not satisfied on ${firstId}/${secondId} about ${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "distance") {
      if (!isDrivingDistanceRelation(relation)) continue;
      const actual = measuredSketchPointDistance(sketch, relation.vertexIds, vertexMap);
      if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
        fail(`Distance relation is not satisfied on ${sketchRelationVertexIds(relation).join("/")}`);
      }
      continue;
    }
    if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
      if (relation.type === "length" && !isDrivingLengthRelation(relation)) continue;
      const edge = sketchRelationVector(sketch, relation.edgeId, vertexMap);
      if (relation.type === "length") {
        if (Math.abs(edge.length - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
          fail(`Length relation is not satisfied on ${relation.edgeId}`);
        }
        continue;
      }
      const distance = relation.type === "horizontal"
        ? Math.abs(edge.delta[1])
        : Math.abs(edge.delta[0]);
      if (distance > 1e-6) fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${relation.edgeId}`);
      continue;
    }
    if (relation.type === "angle") {
      if (!isDrivingAngleRelation(relation)) continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
      const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
      const actual = sketchEdgeAngleFromVectors(first, second);
      if (sketchAngleDeltaDegrees(actual, relation.value) > 1e-6) {
        fail(`Angle relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      continue;
    }
    if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
      const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
      if ((relation.type === "parallel" || relation.type === "collinear") && Math.abs(Math.abs(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]) - 1) > 1e-6) {
        fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "collinear" && sketchCollinearDistance(first, second) > 1e-6) {
        fail(`Collinear relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "perpendicular" && Math.abs(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]) > 1e-6) {
        fail(`Perpendicular relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "equal-length" && Math.abs(first.length - second.length) > Math.max(1e-6, Math.max(first.length, second.length) * 1e-9)) {
        fail(`Equal length relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
    }
  }
}

function sketchRelationSatisfactionIssues(sketch) {
  const vertexMap = sketchVertexPointMap(sketch);
  const issues = [];
  const pushIssue = (relation, message) => {
    issues.push({
      severity: "error",
      code: `sketch-relation-${relation?.type || "unknown"}-unsatisfied`,
      relationId: relation?.id || null,
      message
    });
  };
  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "fixed") continue;
    try {
      if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        const first = vertexMap.get(firstId);
        const second = vertexMap.get(secondId);
        if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
        const coord = relation.type === "horizontal-points" ? 1 : 0;
        if (Math.abs(first[coord] - second[coord]) > 1e-6) {
          pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${firstId}/${secondId}.`);
        }
        continue;
      }
      if (relation.type === "coincident") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        const first = vertexMap.get(firstId);
        const second = vertexMap.get(secondId);
        if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
        if (Math.hypot(first[0] - second[0], first[1] - second[1]) > 1e-6) {
          pushIssue(relation, `Coincident relation is not satisfied on ${firstId}/${secondId}.`);
        }
        continue;
      }
      if (relation.type === "point-on-line") {
        if (sketchPointOnLineDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Point on line relation is not satisfied on ${relation.vertexId}/${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "midpoint") {
        if (sketchMidpointDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Midpoint relation is not satisfied on ${relation.vertexId}/${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "symmetric") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        if (sketchSymmetricResidual(sketch, relation.vertexIds, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Symmetric relation is not satisfied on ${firstId}/${secondId} about ${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "distance") {
        if (!isDrivingDistanceRelation(relation)) continue;
        const actual = measuredSketchPointDistance(sketch, relation.vertexIds, vertexMap);
        if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
          pushIssue(relation, `Distance relation on ${sketchRelationVertexIds(relation).join("/")} expects ${relation.value} mm but reads ${actual.toFixed(3)} mm.`);
        }
        continue;
      }
      if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
        if (relation.type === "length" && !isDrivingLengthRelation(relation)) continue;
        const edge = sketchRelationVector(sketch, relation.edgeId, vertexMap);
        if (relation.type === "length") {
          if (Math.abs(edge.length - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
            pushIssue(relation, `Length relation on ${relation.edgeId} expects ${relation.value} mm but reads ${edge.length.toFixed(3)} mm.`);
          }
          continue;
        }
        const distance = relation.type === "horizontal"
          ? Math.abs(edge.delta[1])
          : Math.abs(edge.delta[0]);
        if (distance > 1e-6) pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${relation.edgeId}.`);
        continue;
      }
      if (relation.type === "angle") {
        if (!isDrivingAngleRelation(relation)) continue;
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
        const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
        const actual = sketchEdgeAngleFromVectors(first, second);
        if (sketchAngleDeltaDegrees(actual, relation.value) > 1e-6) {
          pushIssue(relation, `Angle relation on ${firstEdgeId}/${secondEdgeId} expects ${relation.value} deg but reads ${actual.toFixed(3)} deg.`);
        }
        continue;
      }
      if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
        const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
        const dot = first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1];
        if ((relation.type === "parallel" || relation.type === "collinear") && Math.abs(Math.abs(dot) - 1) > 1e-6) {
          pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "collinear" && sketchCollinearDistance(first, second) > 1e-6) {
          pushIssue(relation, `Collinear relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "perpendicular" && Math.abs(dot) > 1e-6) {
          pushIssue(relation, `Perpendicular relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "equal-length" && Math.abs(first.length - second.length) > Math.max(1e-6, Math.max(first.length, second.length) * 1e-9)) {
          pushIssue(relation, `Equal length relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
      }
    } catch (error) {
      pushIssue(relation, error?.message || `${sketchRelationLabel(relation)} relation could not be evaluated.`);
    }
  }
  return issues;
}

function sketchConstraintSystem(sketch) {
  const vertices = sketchRelationVertices(sketch);
  const vertexIndex = new Map(vertices.map((vertex, index) => [vertex.id, index]));
  const edges = new Map(sketchRelationEdges(sketch).map((edge) => [edge.id, edge]));
  const baseCoords = vertices.flatMap((vertex) => vec2(vertex.point, `plate sketch vertex ${vertex.id}`));
  const pointAt = (coords, vertexId) => {
    const index = vertexIndex.get(vertexId);
    if (index === undefined) fail(`plate sketch vertex not found: ${vertexId}`);
    return [coords[index * 2], coords[index * 2 + 1]];
  };
  const edgePointsAt = (coords, edgeId) => {
    const edge = edges.get(edgeId);
    if (!edge) fail(`plate sketch edge not found: ${edgeId}`);
    return {
      edge,
      a: pointAt(coords, edge.from),
      b: pointAt(coords, edge.to)
    };
  };
  const edgeVectorAt = (coords, edgeId) => {
    const { a, b } = edgePointsAt(coords, edgeId);
    return [b[0] - a[0], b[1] - a[1]];
  };
  const edgeLengthAt = (coords, edgeId) => {
    const delta = edgeVectorAt(coords, edgeId);
    return Math.hypot(delta[0], delta[1]);
  };
  const equations = [];
  const pushEquation = (relation, label, fn) => {
    equations.push({
      relation,
      relationId: relation?.id || null,
      type: relation?.type || "unknown",
      label,
      fn
    });
  };

  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "horizontal") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeVectorAt(coords, relation.edgeId)[1]);
    } else if (relation.type === "vertical") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeVectorAt(coords, relation.edgeId)[0]);
    } else if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const coord = relation.type === "horizontal-points" ? 1 : 0;
      pushEquation(relation, sketchRelationLabel(relation), (coords) => pointAt(coords, firstId)[coord] - pointAt(coords, secondId)[coord]);
    } else if (relation.type === "coincident") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => pointAt(coords, firstId)[0] - pointAt(coords, secondId)[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => pointAt(coords, firstId)[1] - pointAt(coords, secondId)[1]);
    } else if (relation.type === "point-on-line") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        const edgeVector = [edgePoints.b[0] - edgePoints.a[0], edgePoints.b[1] - edgePoints.a[1]];
        const offset = [point[0] - edgePoints.a[0], point[1] - edgePoints.a[1]];
        return edgeVector[0] * offset[1] - edgeVector[1] * offset[0];
      });
    } else if (relation.type === "midpoint") {
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        return point[0] - (edgePoints.a[0] + edgePoints.b[0]) / 2;
      });
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        return point[1] - (edgePoints.a[1] + edgePoints.b[1]) / 2;
      });
    } else if (relation.type === "symmetric") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, `${sketchRelationLabel(relation)} midpoint`, (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        const edgeVector = [edgePoints.b[0] - edgePoints.a[0], edgePoints.b[1] - edgePoints.a[1]];
        const pairMidpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
        const offset = [pairMidpoint[0] - edgePoints.a[0], pairMidpoint[1] - edgePoints.a[1]];
        return edgeVector[0] * offset[1] - edgeVector[1] * offset[0];
      });
      pushEquation(relation, `${sketchRelationLabel(relation)} perpendicular`, (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        const edgeVector = edgeVectorAt(coords, relation.edgeId);
        const pair = [second[0] - first[0], second[1] - first[1]];
        return edgeVector[0] * pair[0] + edgeVector[1] * pair[1];
      });
    } else if (isDrivingLengthRelation(relation)) {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeLengthAt(coords, relation.edgeId) - relation.value);
    } else if (isDrivingDistanceRelation(relation)) {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        return Math.hypot(second[0] - first[0], second[1] - first[1]) - relation.value;
      });
    } else if (isDrivingAngleRelation(relation)) {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const targetCos = Math.cos(finiteAngleDegrees(relation.value) * RAD_PER_DEG);
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const first = edgeVectorAt(coords, firstEdgeId);
        const second = edgeVectorAt(coords, secondEdgeId);
        const firstLength = Math.hypot(first[0], first[1]);
        const secondLength = Math.hypot(second[0], second[1]);
        return first[0] * second[0] + first[1] * second[1] - firstLength * secondLength * targetCos;
      });
    } else if (relation.type === "fixed" && relation.vertexId) {
      const target = pointAt(baseCoords, relation.vertexId);
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => pointAt(coords, relation.vertexId)[0] - target[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => pointAt(coords, relation.vertexId)[1] - target[1]);
    } else if (relation.type === "fixed" && relation.edgeId) {
      const edge = edges.get(relation.edgeId);
      const fromTarget = pointAt(baseCoords, edge.from);
      const toTarget = pointAt(baseCoords, edge.to);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.from} Y`, (coords) => pointAt(coords, edge.from)[0] - fromTarget[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.from} Z`, (coords) => pointAt(coords, edge.from)[1] - fromTarget[1]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.to} Y`, (coords) => pointAt(coords, edge.to)[0] - toTarget[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.to} Z`, (coords) => pointAt(coords, edge.to)[1] - toTarget[1]);
    } else if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      if (relation.type === "equal-length") {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeLengthAt(coords, firstEdgeId) - edgeLengthAt(coords, secondEdgeId));
      } else if (relation.type === "parallel" || relation.type === "collinear") {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => {
          const first = edgeVectorAt(coords, firstEdgeId);
          const second = edgeVectorAt(coords, secondEdgeId);
          return first[0] * second[1] - first[1] * second[0];
        });
        if (relation.type === "collinear") {
          pushEquation(relation, `${sketchRelationLabel(relation)} offset`, (coords) => {
            const first = edgeVectorAt(coords, firstEdgeId);
            const firstPoints = edgePointsAt(coords, firstEdgeId);
            const secondPoints = edgePointsAt(coords, secondEdgeId);
            const offset = [secondPoints.a[0] - firstPoints.a[0], secondPoints.a[1] - firstPoints.a[1]];
            return first[0] * offset[1] - first[1] * offset[0];
          });
        }
      } else {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => {
          const first = edgeVectorAt(coords, firstEdgeId);
          const second = edgeVectorAt(coords, secondEdgeId);
          return first[0] * second[0] + first[1] * second[1];
        });
      }
    }
  }

  return {
    vertices,
    edges: [...edges.values()],
    vertexIndex,
    baseCoords,
    variableCount: vertices.length * 2,
    equations
  };
}

function constraintRows(system, equations = system.equations) {
  const rows = [];
  const epsilon = 1e-4;
  for (const equation of equations) {
    const row = [];
    for (let column = 0; column < system.variableCount; column += 1) {
      const plus = [...system.baseCoords];
      const minus = [...system.baseCoords];
      plus[column] += epsilon;
      minus[column] -= epsilon;
      row[column] = (equation.fn(plus) - equation.fn(minus)) / (2 * epsilon);
    }
    const length = Math.hypot(...row);
    if (length > 1e-9) rows.push(row.map((value) => value / length));
  }
  return rows;
}

function matrixRank(rows, columnCount, tolerance = 1e-7) {
  const matrix = rows.map((row) => [...row]);
  let rank = 0;
  for (let column = 0; column < columnCount && rank < matrix.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < matrix.length; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) <= tolerance) continue;
    [matrix[rank], matrix[pivot]] = [matrix[pivot], matrix[rank]];
    const divisor = matrix[rank][column];
    for (let col = column; col < columnCount; col += 1) matrix[rank][col] /= divisor;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === rank) continue;
      const factor = matrix[row][column];
      if (Math.abs(factor) <= tolerance) continue;
      for (let col = column; col < columnCount; col += 1) matrix[row][col] -= factor * matrix[rank][col];
    }
    rank += 1;
  }
  return rank;
}

function sketchDefinitionLabel(status) {
  if (status === "under-defined") return "Under-defined";
  if (status === "fully-defined") return "Fully-defined";
  if (status === "over-defined") return "Over-defined";
  if (status === "conflicted") return "Conflicted";
  return "Invalid";
}

function sketchDefinitionSeverity(status) {
  if (status === "fully-defined") return "ok";
  if (status === "under-defined") return "warning";
  return "error";
}

function fixedCoordinateRows(system, vertexIds) {
  const rows = [];
  for (const vertexId of uniqueTruthy(vertexIds)) {
    const index = system.vertexIndex.get(vertexId);
    if (index === undefined) continue;
    const yRow = new Array(system.variableCount).fill(0);
    const zRow = new Array(system.variableCount).fill(0);
    yRow[index * 2] = 1;
    zRow[index * 2 + 1] = 1;
    rows.push(yRow, zRow);
  }
  return rows;
}

function entityDefinitionFromRank(system, baseRows, baseRank, vertexIds) {
  const rows = fixedCoordinateRows(system, vertexIds);
  if (!rows.length) return "invalid";
  const rankWithFixedEntity = matrixRank([...baseRows, ...rows], system.variableCount);
  return rankWithFixedEntity > baseRank ? "under-defined" : "fully-defined";
}

function underDefinedEntityIds(system, baseRows, baseRank) {
  const vertices = system.vertices
    .filter((vertex) => entityDefinitionFromRank(system, baseRows, baseRank, [vertex.id]) === "under-defined")
    .map((vertex) => vertex.id);
  const edges = system.edges
    .filter((edge) => entityDefinitionFromRank(system, baseRows, baseRank, [edge.from, edge.to]) === "under-defined")
    .map((edge) => edge.id);
  return { vertices, edges };
}

function formatEntityList(ids, limit = 6) {
  if (!ids.length) return "none";
  const shown = ids.slice(0, limit);
  return `${shown.join(", ")}${ids.length > shown.length ? ` +${ids.length - shown.length} more` : ""}`;
}

export function sketchEntityDefinitionStatus(sketch) {
  try {
    const normalized = normalizeSketchWithOptionalInference(sketch);
    const definition = sketchDefinitionStatus(normalized);
    const system = sketchConstraintSystem(normalized);
    const vertices = {};
    const edges = {};
    if (definition.status === "conflicted" || definition.status === "over-defined" || definition.status === "invalid") {
      for (const vertex of system.vertices) vertices[vertex.id] = definition.status;
      for (const edge of system.edges) edges[edge.id] = definition.status;
      return { definition, vertices, edges };
    }
    const baseRows = constraintRows(system);
    const baseRank = matrixRank(baseRows, system.variableCount);
    for (const vertex of system.vertices) {
      vertices[vertex.id] = entityDefinitionFromRank(system, baseRows, baseRank, [vertex.id]);
    }
    for (const edge of system.edges) {
      edges[edge.id] = entityDefinitionFromRank(system, baseRows, baseRank, [edge.from, edge.to]);
    }
    return { definition, vertices, edges };
  } catch (error) {
    const definition = {
      status: "invalid",
      label: sketchDefinitionLabel("invalid"),
      severity: "error",
      diagnostics: [{
        severity: "error",
        code: "sketch-invalid",
        message: error?.message || "Sketch could not be evaluated."
      }]
    };
    return { definition, vertices: {}, edges: {} };
  }
}

export function plateSketchEntityDefinitionStatus(plate) {
  return sketchEntityDefinitionStatus(plate?.sketch);
}

function relationHealthRecord(status, message = "") {
  const severity = status === "ok"
    ? "ok"
    : status === "driven"
      ? "info"
      : status === "redundant"
        ? "warning"
        : "error";
  return {
    status,
    severity,
    ...(message ? { message } : {})
  };
}

export function sketchRelationHealth(sketch) {
  try {
    const normalized = normalizeSketchWithOptionalInference(sketch);
    const relations = sketchRelations(normalized);
    const health = Object.fromEntries(relations.map((relation) => [
      relation.id,
      isSketchLengthRelationDriven(relation) || isSketchAngleRelationDriven(relation) || isSketchDistanceRelationDriven(relation)
        ? relationHealthRecord("driven", `Driven reference dimension; it reports the current ${relation.type} and does not solve sketch geometry.`)
        : relationHealthRecord("ok")
    ]));
    for (const issue of sketchRelationSatisfactionIssues(normalized)) {
      if (!issue.relationId) continue;
      health[issue.relationId] = relationHealthRecord("conflicted", issue.message);
    }

    const system = sketchConstraintSystem(normalized);
    for (const relation of relations) {
      if (health[relation.id]?.status === "conflicted") continue;
      if (relation.type !== "fixed" && !isDrivingDimensionRelation(relation)) continue;
      const relationEquations = system.equations.filter((equation) => equation.relationId === relation.id);
      if (!relationEquations.length) continue;
      const withoutEquations = system.equations.filter((equation) => equation.relationId !== relation.id);
      const withoutRows = constraintRows(system, withoutEquations);
      const withoutRank = matrixRank(withoutRows, system.variableCount);
      const withRows = [...withoutRows, ...constraintRows(system, relationEquations)];
      const withRank = matrixRank(withRows, system.variableCount);
      if (withRank === withoutRank) {
        health[relation.id] = relationHealthRecord("redundant", `${sketchRelationLabel(relation)} relation is redundant.`);
      }
    }
    return health;
  } catch {
    return {};
  }
}

export function plateSketchRelationHealth(plate) {
  return sketchRelationHealth(plate?.sketch);
}

export function plateSketchRelationActionPreview(plate, relationPatch) {
  if (!relationPatch || typeof relationPatch !== "object") fail("plate sketch relation preview requires a relation");
  let nextPlate = null;
  if (relationPatch.type === "length") {
    nextPlate = setPlateSketchEdgeLengthMode(plate, relationPatch.edgeId, "driving");
  } else if (relationPatch.type === "angle") {
    nextPlate = setPlateSketchEdgeAngleMode(plate, relationPatch.edgeIds, "driving");
  } else if (relationPatch.type === "distance") {
    nextPlate = setPlateSketchPointDistanceMode(plate, relationPatch.vertexIds, "driving");
  } else {
    nextPlate = upsertPlateSketchRelation(plate, relationPatch);
  }
  const relationKey = sketchRelationKey(relationPatch);
  const relation = sketchRelations(nextPlate?.sketch).find((item) => sketchRelationKey(item) === relationKey) || null;
  const health = relation
    ? plateSketchRelationHealth(nextPlate)[relation.id] || relationHealthRecord("ok")
    : relationHealthRecord("conflicted", "Relation could not be evaluated.");
  return {
    plate: nextPlate,
    relation,
    health,
    definition: plateSketchDefinitionStatus(nextPlate)
  };
}

export function sketchDefinitionStatus(sketch) {
  try {
    const normalized = normalizeSketchWithOptionalInference(sketch);
    const system = sketchConstraintSystem(normalized);
    const rows = constraintRows(system);
    const rank = matrixRank(rows, system.variableCount);
    const freeDof = Math.max(0, system.variableCount - rank);
    const underDefined = freeDof > 0 ? underDefinedEntityIds(system, rows, rank) : { vertices: [], edges: [] };
    const issues = sketchRelationSatisfactionIssues(normalized);
    const drivingEquations = system.equations.filter((equation) => equation.type === "length" || equation.type === "angle" || equation.type === "distance" || equation.type === "fixed");
    const baseEquations = system.equations.filter((equation) => equation.type !== "length" && equation.type !== "angle" && equation.type !== "distance" && equation.type !== "fixed");
    const baseRank = matrixRank(constraintRows(system, baseEquations), system.variableCount);
    const drivenRankContribution = Math.max(0, rank - baseRank);
    const redundantDrivenEquations = Math.max(0, drivingEquations.length - drivenRankContribution);
    const redundantConstraintEstimate = Math.max(0, system.equations.length - rank);
    const diagnostics = [...issues];
    let status = "fully-defined";
    if (issues.length) {
      status = "conflicted";
    } else if (redundantDrivenEquations > 0) {
      status = "over-defined";
      diagnostics.push({
        severity: "error",
        code: "sketch-over-defined",
        message: `${redundantDrivenEquations} fixed or driving dimension equation${redundantDrivenEquations === 1 ? " is" : "s are"} redundant. Remove the extra fixed relation or convert the extra driving dimension to driven/reference.`
      });
      if (freeDof > 0) {
        diagnostics.push({
          severity: "warning",
          code: "sketch-under-defined",
          message: `${freeDof} sketch degree${freeDof === 1 ? "" : "s"} of freedom also remain after the redundant constraint.`
        });
        diagnostics.push({
          severity: "warning",
          code: "sketch-under-defined-entities",
          message: `Under-defined entities: vertices ${formatEntityList(underDefined.vertices)}; edges ${formatEntityList(underDefined.edges)}.`,
          vertexIds: underDefined.vertices,
          edgeIds: underDefined.edges
        });
      }
    } else if (freeDof > 0) {
      status = "under-defined";
      diagnostics.push({
        severity: "warning",
        code: "sketch-under-defined",
        message: `${freeDof} sketch degree${freeDof === 1 ? "" : "s"} of freedom remain. Add fixed relations or driving dimensions.`
      });
      diagnostics.push({
        severity: "warning",
        code: "sketch-under-defined-entities",
        message: `Under-defined entities: vertices ${formatEntityList(underDefined.vertices)}; edges ${formatEntityList(underDefined.edges)}.`,
        vertexIds: underDefined.vertices,
        edgeIds: underDefined.edges
      });
    }
    if (!issues.length && redundantConstraintEstimate > redundantDrivenEquations) {
      diagnostics.push({
        severity: "info",
        code: "sketch-redundant-inferred-relations",
        message: `${redundantConstraintEstimate - redundantDrivenEquations} inferred relation equation${redundantConstraintEstimate - redundantDrivenEquations === 1 ? "" : "s"} are redundant but consistent.`
      });
    }
    return {
      status,
      label: sketchDefinitionLabel(status),
      severity: sketchDefinitionSeverity(status),
      vertexCount: system.vertices.length,
      variableCount: system.variableCount,
      relationCount: sketchRelations(normalized).length,
      constraintEquationCount: system.equations.length,
      independentConstraintCount: rank,
      degreesOfFreedom: freeDof,
      underDefinedVertexIds: underDefined.vertices,
      underDefinedEdgeIds: underDefined.edges,
      redundantConstraintEstimate,
      redundantDrivenEquations,
      diagnostics
    };
  } catch (error) {
    return {
      status: "invalid",
      label: sketchDefinitionLabel("invalid"),
      severity: "error",
      vertexCount: 0,
      variableCount: 0,
      relationCount: 0,
      constraintEquationCount: 0,
      independentConstraintCount: 0,
      degreesOfFreedom: 0,
      underDefinedVertexIds: [],
      underDefinedEdgeIds: [],
      redundantConstraintEstimate: 0,
      redundantDrivenEquations: 0,
      diagnostics: [{
        severity: "error",
        code: "sketch-invalid",
        message: error?.message || "Sketch could not be evaluated."
      }]
    };
  }
}

export function plateSketchDefinitionStatus(plate) {
  return sketchDefinitionStatus(plate?.sketch);
}

function sketchRelationSolveVertexIds(sketch, relation) {
  if (!relation) return [];
  if (relation.type === "fixed") return [];
  if (relation.type === "length" && !isDrivingLengthRelation(relation)) return [];
  if (relation.type === "angle" && !isDrivingAngleRelation(relation)) return [];
  if (relation.type === "distance" && !isDrivingDistanceRelation(relation)) return [];
  if (relation.type === "horizontal-points" || relation.type === "vertical-points") return sketchRelationVertexIds(relation);
  if (relation.type === "distance") {
    const ids = sketchRelationVertexIds(relation);
    const targetVertexId = relation.targetVertexId && ids.includes(relation.targetVertexId)
      ? relation.targetVertexId
      : ids[1];
    return [targetVertexId];
  }
  if (relation.type === "coincident") {
    const [firstId, secondId] = sketchRelationVertexIds(relation);
    const fixed = sketchSolverFixedVertexIds(sketch);
    if (fixed.has(firstId) && !fixed.has(secondId)) return [secondId];
    if (fixed.has(secondId) && !fixed.has(firstId)) return [firstId];
    return [firstId];
  }
  if (relation.type === "point-on-line") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? edgeEndpointIds(sketch, relation.edgeId) : [relation.vertexId];
  }
  if (relation.type === "midpoint") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? edgeEndpointIds(sketch, relation.edgeId) : [relation.vertexId];
  }
  if (relation.type === "symmetric") {
    const [firstId, secondId] = sketchRelationVertexIds(relation);
    const fixed = sketchSolverFixedVertexIds(sketch);
    if (fixed.has(firstId) && fixed.has(secondId)) return edgeEndpointIds(sketch, relation.edgeId);
    return [firstId, secondId];
  }
  if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
    return edgeEndpointIds(sketch, relation.edgeId);
  }
  if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length" || relation.type === "angle") {
    const edgeIds = sketchRelationEdgeIds(relation);
    const targetEdgeId = relation.targetEdgeId && edgeIds.includes(relation.targetEdgeId)
      ? relation.targetEdgeId
      : edgeIds[1];
    const referenceEdgeId = edgeIds.find((edgeId) => edgeId !== targetEdgeId);
    const referenceVertexIds = new Set(edgeEndpointIds(sketch, referenceEdgeId));
    const freeTargetVertexIds = edgeEndpointIds(sketch, targetEdgeId).filter((vertexId) => !referenceVertexIds.has(vertexId));
    return freeTargetVertexIds.length ? freeTargetVertexIds : edgeEndpointIds(sketch, targetEdgeId);
  }
  return [];
}

function sketchWithVertexPoint(sketch, vertexId, point) {
  const nextPoint = vec2(point, `plate sketch vertex ${vertexId}`);
  let found = false;
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    return { ...vertex, point: nextPoint };
  });
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    return { ...vertex, point: nextPoint };
  });
  if (!found) fail(`plate sketch vertex not found: ${vertexId}`);
  return { ...sketch, vertices, constructionVertices };
}

function pointOnLineProjection(sketch, vertexId, edgeId) {
  const vertexMap = sketchVertexPointMap(sketch);
  const pointValue = vertexMap.get(vertexId);
  const { a, b } = sketchEdgePoints(sketch, edgeId, vertexMap);
  if (!pointValue) fail(`plate sketch vertex not found: ${vertexId}`);
  const axis = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(axis[0], axis[1]);
  if (length <= EPSILON) fail(`plate sketch edge ${edgeId} has zero length`);
  const unit = [axis[0] / length, axis[1] / length];
  const station = dot2([pointValue[0] - a[0], pointValue[1] - a[1]], unit);
  return [a[0] + unit[0] * station, a[1] + unit[1] * station];
}

function midpointProjection(sketch, edgeId) {
  const { a, b } = sketchEdgePoints(sketch, edgeId);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function seedSketchForRelationSolve(sketch, relation) {
  if (relation?.type === "point-on-line" && relation.vertexId && relation.edgeId) {
    return sketchWithVertexPoint(sketch, relation.vertexId, pointOnLineProjection(sketch, relation.vertexId, relation.edgeId));
  }
  if (relation?.type === "midpoint" && relation.vertexId && relation.edgeId) {
    return sketchWithVertexPoint(sketch, relation.vertexId, midpointProjection(sketch, relation.edgeId));
  }
  return sketch;
}

function solveSketchAfterRelationUpsert(sketch, relation) {
  const fixed = sketchSolverFixedVertexIds(sketch);
  const solvedVertexIds = sketchRelationSolveVertexIds(sketch, relation).filter((vertexId) => !fixed.has(vertexId));
  if (!solvedVertexIds.length) {
    assertSketchRelationsSatisfied(sketch);
    return sketch;
  }
  const seededSketch = seedSketchForRelationSolve(sketch, relation);
  const solvedSketch = solveSketchRelationsAfterVertexChange(seededSketch, solvedVertexIds);
  assertSketchRelationsSatisfied(solvedSketch);
  return solvedSketch;
}

function relationTouchesAnyVertex(sketch, relation, vertexIds) {
  const touched = new Set(uniqueTruthy(vertexIds));
  if (!touched.size || !relation) return false;
  if (sketchRelationVertexIds(relation).some((vertexId) => touched.has(vertexId))) return true;
  for (const edgeId of sketchRelationEdgeIds(relation)) {
    if (edgeEndpointIds(sketch, edgeId).some((vertexId) => touched.has(vertexId))) return true;
  }
  return false;
}

function solveSketchAfterRelaxingLocalRelations(sketch, relation) {
  const fixed = sketchSolverFixedVertexIds(sketch);
  const solvedVertexIds = sketchRelationSolveVertexIds(sketch, relation).filter((vertexId) => !fixed.has(vertexId));
  if (!solvedVertexIds.length) return solveSketchAfterRelationUpsert(sketch, relation);
  const relaxedRelations = sketchRelations(sketch).filter((item) => (
    item.id === relation.id
    || item.type === "fixed"
    || !relationTouchesAnyVertex(sketch, item, solvedVertexIds)
  ));
  if (relaxedRelations.length === sketchRelations(sketch).length) {
    return solveSketchAfterRelationUpsert(sketch, relation);
  }
  return solveSketchAfterRelationUpsert(withSketchRelations(sketch, relaxedRelations), relation);
}

function edgeRelationInheritance(oldSketch, oldEdgeId, nextEdgeIds, options = {}) {
  const ids = uniqueTruthy(nextEdgeIds);
  if (!ids.length) return [];
  const inherited = [];
  for (const relation of sketchRelations(oldSketch)) {
    const relationEdgeIds = sketchRelationEdgeIds(relation);
    if (!relationEdgeIds.includes(oldEdgeId)) continue;
    if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "fixed") {
      if ((relation.type === "horizontal" || relation.type === "vertical") && options.inheritAxisRelations === false) continue;
      inherited.push(...ids.map((edgeId) => ({ type: relation.type, edgeId })));
    } else if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear") {
      if (options.inheritDirectionalRelations === false) continue;
      const otherEdgeId = relationEdgeIds.find((edgeId) => edgeId !== oldEdgeId);
      inherited.push(...ids.map((edgeId) => ({ type: relation.type, edgeIds: [edgeId, otherEdgeId] })));
    }
  }
  return inherited;
}

function edgeLengthDimensionInheritance(oldSketch, oldEdgeId, nextSketch, nextEdgeIds) {
  if (!sketchRelations(oldSketch).some((relation) => relation.type === "length" && relation.edgeId === oldEdgeId)) return [];
  return uniqueTruthy(nextEdgeIds).map((edgeId) => ({
    type: "length",
    edgeId,
    value: sketchRelationVector(nextSketch, edgeId).length,
    mode: "driven"
  }));
}

function relationsForTopologyChange(oldSketch, nextSketch, removedEdgeIds = [], extraRelations = [], options = {}) {
  const removed = new Set(removedEdgeIds);
  const nextEdgeIds = new Set(sketchRelationEdges(nextSketch).map((edge) => edge.id));
  const nextVertexIds = new Set(sketchRelationVertices(nextSketch).map((vertex) => vertex.id));
  const oldEdgeIds = new Set(sketchEdges(oldSketch).map((edge) => edge.id));
  const newEdgeIds = new Set([...nextEdgeIds].filter((edgeId) => !oldEdgeIds.has(edgeId)));
  const preserved = sketchRelations(oldSketch).filter((relation) => {
    const ids = sketchRelationEdgeIds(relation);
    if (ids.length) return ids.every((edgeId) => nextEdgeIds.has(edgeId) && !removed.has(edgeId));
    const vertexIds = sketchRelationVertexIds(relation);
    return vertexIds.length && vertexIds.every((vertexId) => nextVertexIds.has(vertexId));
  });
  const validExtraRelations = extraRelations.filter((relation) => {
    const ids = sketchRelationEdgeIds(relation);
    if (ids.length) return ids.every((edgeId) => nextEdgeIds.has(edgeId));
    const vertexIds = sketchRelationVertexIds(relation);
    return !vertexIds.length || vertexIds.every((vertexId) => nextVertexIds.has(vertexId));
  });
  const inferred = options.inferNewRelations === false
    ? []
    : inferredSketchRelations(nextSketch).filter((relation) => (
      sketchRelationEdgeIds(relation).some((edgeId) => newEdgeIds.has(edgeId))
    ));
  return withSketchRelations(nextSketch, [...preserved, ...validExtraRelations, ...inferred]);
}

export function sketchEdgeAxisRelation(sketch, edgeId) {
  return sketchRelations(sketch).find((relation) => (
    (relation.type === "horizontal" || relation.type === "vertical") && relation.edgeId === edgeId
  )) || null;
}

export function sketchRelationsForEdge(sketch, edgeId) {
  return sketchRelations(sketch).filter((relation) => sketchRelationEdgeIds(relation).includes(edgeId));
}

export function sketchRelationsForVertex(sketch, vertexId) {
  return sketchRelations(sketch).filter((relation) => sketchRelationVertexIds(relation).includes(vertexId));
}

export function addPlateSketchConstructionLine(plate, fromPoint, toPoint, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const sketch = normalizeSketchWithOptionalInference(plate.sketch);
  const from = vec2(fromPoint, "plate sketch construction line start");
  const to = vec2(toPoint, "plate sketch construction line end");
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= EPSILON) {
    fail("plate sketch construction line must have non-zero length");
  }
  const firstVertexId = options.fromVertexId || nextSketchItemId(sketch, "cv");
  const sketchWithFirst = {
    ...sketch,
    constructionVertices: [
      ...sketchConstructionVertices(sketch),
      { id: firstVertexId, point: from, construction: true }
    ]
  };
  const secondVertexId = options.toVertexId || nextSketchItemId(sketchWithFirst, "cv");
  const sketchWithVertices = {
    ...sketchWithFirst,
    constructionVertices: [
      ...sketchConstructionVertices(sketchWithFirst),
      { id: secondVertexId, point: to, construction: true }
    ]
  };
  const edgeId = options.edgeId || nextSketchItemId(sketchWithVertices, "ce");
  return normalizePlate({
    ...plate,
    sketch: withSketchRelations({
      ...sketchWithVertices,
      constructionEdges: [
        ...sketchConstructionEdges(sketchWithVertices),
        { id: edgeId, from: firstVertexId, to: secondVertexId, construction: true }
      ]
    }, sketchRelations(sketch))
  });
}

export function upsertSketchRelationFromHost(sketchHost, relation, normalize = normalizePlate) {
  if (!relation || typeof relation !== "object") fail("plate sketch relation is required");
  const sketch = normalizeSketchWithOptionalInference(sketchHost.sketch);
  const key = sketchRelationKey(relation);
  const nextSketch = withSketchRelations(sketch, [
    ...sketchRelations(sketch).filter((item) => sketchRelationKey(item) !== key),
    relation
  ]);
  const normalizedRelation = sketchRelations(nextSketch).find((item) => sketchRelationKey(item) === sketchRelationKey(relation)) || relation;
  let solvedSketch = nextSketch;
  try {
    solvedSketch = solveSketchAfterRelationUpsert(nextSketch, {
      ...normalizedRelation,
      ...(relation.targetEdgeId ? { targetEdgeId: relation.targetEdgeId } : {}),
      ...(relation.targetVertexId ? { targetVertexId: relation.targetVertexId } : {})
    });
  } catch {
    solvedSketch = nextSketch;
  }
  return normalize({
    ...sketchHost,
    sketch: solvedSketch
  });
}

export function removeSketchRelationFromHost(sketchHost, relationId, normalize = normalizePlate) {
  if (typeof relationId !== "string" || !relationId) fail("plate sketch relation id is required");
  const relations = sketchRelations(sketchHost.sketch);
  const nextRelations = relations.filter((relation) => relation.id !== relationId);
  if (nextRelations.length === relations.length) fail(`${sketchHost.id}: sketch relation not found: ${relationId}`);
  return normalize({ ...sketchHost, sketch: { ...sketchHost.sketch, relations: nextRelations } });
}

export function inferSketchRelationsForHost(sketchHost, normalize = normalizePlate) {
  const sketch = sketchHost?.sketch;
  if (!sketch) fail("plate sketch is required");
  return normalize({
    ...sketchHost,
    sketch: withSketchRelations(sketch, [...sketchRelations(sketch), ...inferredSketchRelations(sketch)])
  });
}

export function sketchVertexPointMap(sketch) {
  return new Map(sketchRelationVertices(sketch).map((vertex) => [vertex.id, vec2(vertex.point, `plate sketch vertex ${vertex.id}`)]));
}

export function sketchEdgePoints(sketch, edgeOrId, vertexMap = sketchVertexPointMap(sketch)) {
  const edge = typeof edgeOrId === "string"
    ? sketchRelationEdges(sketch).find((item) => item.id === edgeOrId)
    : edgeOrId;
  if (!edge) fail(`plate sketch edge not found: ${edgeOrId}`);
  const a = vertexMap.get(edge.from);
  const b = vertexMap.get(edge.to);
  if (!a || !b) fail(`plate sketch edge ${edge.id} has missing vertices`);
  return { edge, a, b };
}

export function orderedSketchLoop(sketch) {
  const vertices = sketchVertices(sketch);
  const edges = sketchEdges(sketch);
  const vertexMap = sketchVertexPointMap(sketch);
  if (vertexMap.size < 3) fail("plate sketch requires at least three vertices");
  if (!edges.length) {
    return vertices.map((vertex) => ({ vertexId: vertex.id, point: vertexMap.get(vertex.id), incomingEdgeId: null, outgoingEdgeId: null }));
  }

  const edgeMap = new Map(edges.map((edge) => [edge.from, edge]));
  const firstEdge = edges[0];
  const loop = [];
  let current = firstEdge.from;
  for (let guard = 0; guard <= edges.length; guard += 1) {
    const edge = edgeMap.get(current);
    if (!edge) fail(`plate sketch has an open edge loop at ${current}`);
    if (loop.some((item) => item.outgoingEdgeId === edge.id)) break;
    const { a } = sketchEdgePoints(sketch, edge, vertexMap);
    loop.push({ vertexId: current, point: a, outgoingEdgeId: edge.id });
    current = edge.to;
    if (current === firstEdge.from) break;
  }
  if (loop.length !== edges.length || current !== firstEdge.from) fail("plate sketch edges must form one closed loop");
  for (let index = 0; index < loop.length; index += 1) {
    loop[index].incomingEdgeId = loop[(index + loop.length - 1) % loop.length].outgoingEdgeId;
  }
  return loop;
}

function normalizeSketchPlacement(object, fallbackId) {
  const label = object.id || fallbackId;
  return {
    ...object,
    center: vec3(object.center, `${label}.center`),
    normal: v.norm(vec3(object.normal, `${label}.normal`)),
    localAxisY: v.norm(vec3(object.localAxisY, `${label}.localAxisY`)),
    localAxisZ: v.norm(vec3(object.localAxisZ, `${label}.localAxisZ`))
  };
}

function normalizeSketchObject(sketchObject) {
  if (!sketchObject || typeof sketchObject !== "object") fail("sketch object must be an object");
  const sketch = normalizeSketchWithOptionalInference(sketchObject.sketch);
  outlineFromSketch(sketch);
  return normalizeSketchPlacement({
    ...sketchObject,
    type: sketchObject.type || "plate-sketch",
    sketch
  }, "sketch");
}

function normalizeBend(bend, sketch, bendIds = new Set()) {
  const edgeIds = new Set(sketchEdges(sketch).map((edge) => edge.id));
  const parentBendId = bend.parentBendId || null;
  const edgeId = parentBendId ? null : bend.edgeId || bend.edge;
  if (parentBendId) {
    if (!bendIds.has(parentBendId)) fail(`bend references unknown parent bend ${parentBendId}`);
    if (parentBendId === bend.id) fail("bend cannot reference itself as parent");
  } else if (!edgeIds.has(edgeId)) {
    fail(`bend references unknown sketch edge ${edgeId}`);
  }
  const angle = finiteNumberOr(bend.angle, finiteNumberOr(bend.angleDeg, 90));
  const radius = finiteNumberOr(bend.radius, 0);
  const flangeLength = finiteNumberOr(bend.flangeLength, 0);
  if (flangeLength <= 0) fail("bend flangeLength must be positive");
  return {
    id: bend.id || (parentBendId ? `bend_${parentBendId}_outer` : `bend_${edgeId}`),
    ...(parentBendId ? { parentBendId, parentEdge: bend.parentEdge || "outer" } : { edgeId }),
    direction: bend.direction === "down" ? "down" : "up",
    angle,
    radius,
    flangeLength,
    relief: normalizeRelief(bend.relief)
  };
}

function bendDescendantIds(bends, seedIds) {
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

function normalizeRelief(relief = {}) {
  const mode = relief.mode === "manual" ? "manual" : "auto";
  const type = ["none", "round", "rect", "obround", "v-notch"].includes(relief.type) ? relief.type : "round";
  const radius = finiteNumberOr(relief.radius, undefined);
  const width = finiteNumberOr(relief.width, undefined);
  const depth = finiteNumberOr(relief.depth, undefined);
  return {
    mode,
    type,
    ...(radius !== undefined ? { radius } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(depth !== undefined ? { depth } : {})
  };
}

export function normalizePlate(plate) {
  if (!plate || typeof plate !== "object") fail("plate must be an object");
  const sketch = normalizeSketchWithOptionalInference(plate.sketch);
  outlineFromSketch(sketch);
  const next = normalizeSketchPlacement({
    ...plate,
    sketch
  }, "plate");
  if (!finitePositiveNumber(next.thickness)) fail(`${next.id || "plate"} thickness must be positive`);
  const bends = plateBends(next);
  if (Array.isArray(next.fabrication?.bends)) {
    const bendIds = new Set(uniqueTruthy(bends.map((bend) => bend.id)));
    next.fabrication = {
      ...next.fabrication,
      bends: bends.map((bend) => normalizeBend(bend, sketch, bendIds))
    };
  }
  return next;
}

function createPlateObject(project, options = {}) {
  const id = nextObjectId(project, options.id || "plate");
  return normalizePlate({
    ...options,
    id,
    type: options.type || "plate",
    sketch: options.sketch
  });
}

export function addPlate(project, options = {}) {
  const plate = createPlateObject(project, options);
  addIndexedObject(project, "plates", plate);
  return plate;
}

export function addSketch(project, options = {}) {
  const id = nextObjectId(project, options.id || "sketch");
  const sketch = options.sketch || (options.outline
    ? sketchFromOutline(options.outline, id)
    : sketchFromRectangle(options.width || 600, options.height || 300, id));
  const sketchObject = normalizeSketchObject({
    ...options,
    id,
    type: options.type || "plate-sketch",
    sketch,
    center: options.center || [0, 0, 0],
    normal: options.normal || [0, 0, 1],
    localAxisY: options.localAxisY || [1, 0, 0],
    localAxisZ: options.localAxisZ || [0, 1, 0]
  });
  addIndexedObject(project, "sketches", sketchObject);
  return sketchObject;
}

export function plateFromSketchObject(project, sketchObject, options = {}) {
  const source = normalizeSketchObject(sketchObject);
  return createPlateObject(project, {
    ...options,
    id: options.id || `${source.id}_plate`,
    type: options.type || "plate",
    sketch: source.sketch,
    center: source.center,
    normal: source.normal,
    localAxisY: source.localAxisY,
    localAxisZ: source.localAxisZ,
    thickness: options.thickness ?? 8,
    material: options.material || "S355",
    placementIntent: {
      ...(options.placementIntent || {}),
      role: options.placementIntent?.role || "plate-from-sketch",
      sourceSketchId: source.id
    }
  });
}

export function setPlateSketchVertex(plate, vertexId, point) {
  return setPlateSketchVertices(plate, [{ vertexId, point }]);
}

export function setPlateSketchVertices(plate, vertexPoints) {
  if (!plate?.sketch) fail("plate sketch is required");
  const updates = vertexPoints instanceof Map
    ? vertexPoints
    : new Map(Array.isArray(vertexPoints)
      ? vertexPoints.map((item) => [item.vertexId || item.id, item.point])
      : Object.entries(vertexPoints || {}));
  if (!updates.size) return normalizePlate(plate);
  const nextPoints = new Map([...updates.entries()].map(([vertexId, point]) => [vertexId, vec2(point, `plate sketch vertex ${vertexId}`)]));
  const sketch = normalizeSketchWithOptionalInference(plate.sketch);
  const found = new Set();
  const changedVertexIds = [];
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (Math.hypot((point[0] || 0) - (vertex.point?.[0] || 0), (point[1] || 0) - (vertex.point?.[1] || 0)) > EPSILON) {
      changedVertexIds.push(vertex.id);
    }
    return { ...vertex, point };
  });
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (Math.hypot((point[0] || 0) - (vertex.point?.[0] || 0), (point[1] || 0) - (vertex.point?.[1] || 0)) > EPSILON) {
      changedVertexIds.push(vertex.id);
    }
    return { ...vertex, point };
  });
  for (const vertexId of nextPoints.keys()) {
    if (!found.has(vertexId)) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  }
  if (!changedVertexIds.length) return normalizePlate(plate);
  const editableSketch = relaxRelationsForDirectVertexMove({ ...sketch, vertices, constructionVertices }, changedVertexIds);
  const solvedSketch = solveSketchRelationsAfterVertexChange(editableSketch, changedVertexIds);
  assertSketchRelationsSatisfied(solvedSketch);
  return normalizePlate({ ...plate, sketch: solvedSketch });
}

export function setPlateSketchEdgeLength(plate, edgeId, length, options = {}) {
  if (!finitePositiveNumber(length)) fail("plate sketch edge length must be a positive number");
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const mode = options.mode === "driven" ? "driven" : "driving";
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, {
    type: "length",
    edgeId,
    value: length,
    mode
  }, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "length" && item.edgeId === edgeId);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchEdgeLength(nextPlate, edgeId, sketchRelationVector(nextPlate.sketch, edgeId).length, { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchEdgeLengthMode(plate, edgeId, mode) {
  const nextMode = mode === "driven" ? "driven" : "driving";
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const measuredLength = sketchRelationVector(sketch, edgeId).length;
  return setPlateSketchEdgeLength(plate, edgeId, measuredLength, {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setPlateSketchEdgeAngle(plate, edgeIds, angleDegrees, options = {}) {
  const ids = uniqueTruthy(arrayValues(edgeIds));
  if (ids.length !== 2) fail("plate sketch edge angle requires two edge ids");
  const angle = finiteAngleDegrees(angleDegrees, "plate sketch edge angle");
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  }
  const mode = options.mode === "driven" ? "driven" : "driving";
  const relationPatch = {
    type: "angle",
    edgeIds: ids,
    value: angle,
    mode,
    ...(ids.includes(options.targetEdgeId) ? { targetEdgeId: options.targetEdgeId } : {})
  };
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, relationPatch, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "angle", edgeIds: ids });
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "angle" && sketchRelationKey(item) === key);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchEdgeAngle(nextPlate, ids, measuredSketchEdgeAngle(nextPlate.sketch, ids), { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchEdgeAngleMode(plate, edgeIds, mode) {
  const nextMode = mode === "driven" ? "driven" : "driving";
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  const ids = uniqueTruthy(arrayValues(edgeIds));
  if (ids.length !== 2) fail("plate sketch edge angle requires two edge ids");
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  }
  return setPlateSketchEdgeAngle(plate, ids, measuredSketchEdgeAngle(sketch, ids), {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setPlateSketchPointDistance(plate, vertexIds, distance, options = {}) {
  const ids = uniqueTruthy(arrayValues(vertexIds));
  if (ids.length !== 2) fail("plate sketch point distance requires two vertex ids");
  if (!finitePositiveNumber(distance)) fail("plate sketch point distance must be a positive number");
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  const sketchVertexIds = new Set(sketchVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${plate?.id || "plate"}: sketch vertex not found: ${vertexId}`);
  }
  const mode = options.mode === "driven" ? "driven" : "driving";
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, {
    type: "distance",
    vertexIds: ids,
    value: distance,
    mode,
    ...(ids.includes(options.targetVertexId) ? { targetVertexId: options.targetVertexId } : {})
  }, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "distance", vertexIds: ids });
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "distance" && sketchRelationKey(item) === key);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchPointDistance(nextPlate, ids, measuredSketchPointDistance(nextPlate.sketch, ids), { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchPointDistanceMode(plate, vertexIds, mode) {
  const nextMode = mode === "driven" ? "driven" : "driving";
  const sketch = normalizeSketchWithOptionalInference(plate?.sketch);
  const ids = uniqueTruthy(arrayValues(vertexIds));
  if (ids.length !== 2) fail("plate sketch point distance requires two vertex ids");
  const sketchVertexIds = new Set(sketchRelationVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${plate?.id || "plate"}: sketch vertex not found: ${vertexId}`);
  }
  return setPlateSketchPointDistance(plate, ids, measuredSketchPointDistance(sketch, ids), {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

function nextSketchItemId(sketch, kind) {
  const ids = new Set([
    ...sketchRelationVertices(sketch).map((vertex) => vertex.id),
    ...sketchRelationEdges(sketch).map((edge) => edge.id)
  ]);
  for (let index = ids.size + 1; index < ids.size + 10000; index += 1) {
    const id = `${kind}${index}`;
    if (!ids.has(id)) return id;
  }
  fail("could not allocate sketch id");
}

function sketchEdgeBetween(sketch, from, to) {
  return sketchEdges(sketch).find((edge) => edge.from === from && edge.to === to) || null;
}

function sketchEdgeLoopFromVertices(sketch, vertices) {
  const used = new Set();
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const existing = sketchEdgeBetween(sketch, vertex.id, next.id);
    if (existing && !used.has(existing.id)) {
      used.add(existing.id);
      return existing;
    }
    const id = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), ...[...used].map((edgeId) => ({ id: edgeId }))] }, "e");
    used.add(id);
    return { id, from: vertex.id, to: next.id };
  });
}

function plateWithSketchTopologyChange(plate, sketch, removedEdgeIds = []) {
  const existingBends = plateBends(plate);
  const removedBendIds = bendDescendantIds(
    existingBends,
    existingBends.filter((bend) => removedEdgeIds.includes(bend.edgeId)).map((bend) => bend.id)
  );
  const bends = existingBends.filter((bend) => !removedBendIds.has(bend.id));
  return normalizePlate({
    ...plate,
    type: bends.length ? "bent-plate" : "plate",
    sketch,
    ...((plate.fabrication || existingBends.length) ? { fabrication: { ...(plate.fabrication || {}), bends } } : {})
  });
}

export function insertPlateSketchVertex(plate, edgeId, point, options = {}) {
  const sketch = plate.sketch;
  const edge = sketchEdges(sketch).find((item) => item.id === edgeId);
  if (!edge) fail(`${plate.id}: sketch edge not found: ${edgeId}`);
  const vertexId = nextSketchItemId(sketch, "v");
  const firstEdgeId = nextSketchItemId(sketch, "e");
  const secondEdgeId = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), { id: firstEdgeId }] }, "e");
  const vertex = { id: vertexId, point: vec2(point, "inserted plate sketch vertex") };
  const vertices = [...sketchVertices(sketch), vertex];
  const edges = sketchEdges(sketch).flatMap((item) => item.id === edgeId
    ? [
      { id: firstEdgeId, from: edge.from, to: vertexId },
      { id: secondEdgeId, from: vertexId, to: edge.to }
    ]
    : [item]);
  const topologySketch = { ...sketch, vertices, edges };
  const extraRelations = [
    ...(options.addSplitCollinear === false ? [] : [{ type: "collinear", edgeIds: [firstEdgeId, secondEdgeId] }]),
    ...edgeRelationInheritance(sketch, edgeId, [firstEdgeId, secondEdgeId], options),
    ...edgeLengthDimensionInheritance(sketch, edgeId, topologySketch, [firstEdgeId, secondEdgeId])
  ];
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [edgeId], extraRelations, options);
  return {
    plate: plateWithSketchTopologyChange(plate, nextSketch, [edgeId]),
    vertexId
  };
}

export function removePlateSketchVertex(plate, vertexId) {
  const sketch = plate.sketch;
  const loop = orderedSketchLoop(sketch);
  if (loop.length <= 3) fail("plate sketch requires at least three vertices");
  const removedIndex = loop.findIndex((item) => item.vertexId === vertexId);
  const removed = loop[removedIndex];
  if (!removed) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  const previous = loop[(removedIndex + loop.length - 1) % loop.length];
  const next = loop[(removedIndex + 1) % loop.length];
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const previousPoint = vertexById.get(previous.vertexId)?.point;
  const removedPoint = vertexById.get(removed.vertexId)?.point;
  const nextPoint = vertexById.get(next.vertexId)?.point;
  const incoming = previousPoint && removedPoint ? [removedPoint[0] - previousPoint[0], removedPoint[1] - previousPoint[1]] : null;
  const outgoing = removedPoint && nextPoint ? [nextPoint[0] - removedPoint[0], nextPoint[1] - removedPoint[1]] : null;
  const incomingLength = incoming ? Math.hypot(incoming[0], incoming[1]) : 0;
  const outgoingLength = outgoing ? Math.hypot(outgoing[0], outgoing[1]) : 0;
  const removesIntermediateLinePoint = incomingLength > EPSILON
    && outgoingLength > EPSILON
    && Math.abs(incoming[0] * outgoing[1] - incoming[1] * outgoing[0]) <= EPSILON * incomingLength * outgoingLength
    && dot2(incoming, outgoing) > 0;
  const vertices = loop
    .filter((item) => item.vertexId !== vertexId)
    .map((item) => vertexById.get(item.vertexId));
  const edges = sketchEdgeLoopFromVertices(sketch, vertices);
  const topologySketch = { ...sketch, vertices, edges };
  const replacementEdge = removesIntermediateLinePoint ? sketchEdgeBetween(topologySketch, previous.vertexId, next.vertexId) : null;
  const extraRelations = replacementEdge
    ? [
      ...edgeRelationInheritance(sketch, removed.incomingEdgeId, [replacementEdge.id]),
      ...edgeRelationInheritance(sketch, removed.outgoingEdgeId, [replacementEdge.id])
    ]
    : [];
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [removed.incomingEdgeId, removed.outgoingEdgeId], extraRelations);
  return plateWithSketchTopologyChange(plate, nextSketch, [removed.incomingEdgeId, removed.outgoingEdgeId]);
}

export function notchPlateSketchCorner(plate, vertexId, options = {}) {
  const sketch = plate.sketch;
  const loop = orderedSketchLoop(sketch);
  const cornerIndex = loop.findIndex((item) => item.vertexId === vertexId);
  if (cornerIndex < 0) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const previous = loop[(cornerIndex + loop.length - 1) % loop.length];
  const corner = loop[cornerIndex];
  const next = loop[(cornerIndex + 1) % loop.length];
  const cornerPoint = vertexById.get(corner.vertexId)?.point;
  const previousPoint = vertexById.get(previous.vertexId)?.point;
  const nextPoint = vertexById.get(next.vertexId)?.point;
  const previousVector = [previousPoint[0] - cornerPoint[0], previousPoint[1] - cornerPoint[1]];
  const nextVector = [nextPoint[0] - cornerPoint[0], nextPoint[1] - cornerPoint[1]];
  const previousLength = Math.hypot(previousVector[0], previousVector[1]);
  const nextLength = Math.hypot(nextVector[0], nextVector[1]);
  const size = finitePositiveNumber(options.size)
    ? options.size
    : Math.max(1, Math.min(DEFAULT_SKETCH_NOTCH_SIZE, DEFAULT_SKETCH_NOTCH_MAX_SIZE, previousLength * 0.2, nextLength * 0.2));
  if (previousLength <= EPSILON || nextLength <= EPSILON) fail("notch corner requires non-zero adjacent edges");
  const previousUnit = [previousVector[0] / previousLength, previousVector[1] / previousLength];
  let nextUnit = [nextVector[0] / nextLength, nextVector[1] / nextLength];
  const orthogonal = options.orthogonal !== false;
  if (orthogonal) {
    const perpendicularA = [-previousUnit[1], previousUnit[0]];
    const perpendicularB = [previousUnit[1], -previousUnit[0]];
    nextUnit = perpendicularA[0] * nextUnit[0] + perpendicularA[1] * nextUnit[1] >= perpendicularB[0] * nextUnit[0] + perpendicularB[1] * nextUnit[1]
      ? perpendicularA
      : perpendicularB;
  }
  const firstId = nextSketchItemId(sketch, "v");
  const secondId = nextSketchItemId({ ...sketch, vertices: [...sketchVertices(sketch), { id: firstId }] }, "v");
  const thirdId = nextSketchItemId({ ...sketch, vertices: [...sketchVertices(sketch), { id: firstId }, { id: secondId }] }, "v");
  const first = {
    id: firstId,
    point: [cornerPoint[0] + previousUnit[0] * size, cornerPoint[1] + previousUnit[1] * size]
  };
  const second = {
    id: secondId,
    point: [first.point[0] + nextUnit[0] * size, first.point[1] + nextUnit[1] * size]
  };
  const third = {
    id: thirdId,
    point: [cornerPoint[0] + nextUnit[0] * size, cornerPoint[1] + nextUnit[1] * size]
  };
  const vertices = loop.flatMap((item) => item.vertexId === vertexId
    ? [first, second, third]
    : [vertexById.get(item.vertexId)]);
  const edges = sketchEdgeLoopFromVertices(sketch, vertices);
  const topologySketch = { ...sketch, vertices, edges };
  const incomingOuter = sketchEdgeBetween(topologySketch, previous.vertexId, firstId);
  const outgoingInner = sketchEdgeBetween(topologySketch, firstId, secondId);
  const incomingInner = sketchEdgeBetween(topologySketch, secondId, thirdId);
  const outgoingOuter = sketchEdgeBetween(topologySketch, thirdId, next.vertexId);
  const extraRelations = [
    ...edgeRelationInheritance(sketch, corner.incomingEdgeId, [incomingOuter?.id, incomingInner?.id]),
    ...edgeRelationInheritance(sketch, corner.outgoingEdgeId, [outgoingInner?.id, outgoingOuter?.id]),
    ...edgeLengthDimensionInheritance(sketch, corner.incomingEdgeId, topologySketch, [incomingOuter?.id]),
    ...edgeLengthDimensionInheritance(sketch, corner.outgoingEdgeId, topologySketch, [outgoingOuter?.id])
  ];
  if (incomingOuter && incomingInner) extraRelations.push({ type: "parallel", edgeIds: [incomingOuter.id, incomingInner.id] });
  if (outgoingInner && outgoingOuter) extraRelations.push({ type: "parallel", edgeIds: [outgoingInner.id, outgoingOuter.id] });
  if (outgoingInner && incomingInner) extraRelations.push({ type: "equal-length", edgeIds: [outgoingInner.id, incomingInner.id] });
  if (orthogonal) {
    if (incomingOuter && outgoingInner) extraRelations.push({ type: "perpendicular", edgeIds: [incomingOuter.id, outgoingInner.id] });
    if (outgoingInner && incomingInner) extraRelations.push({ type: "perpendicular", edgeIds: [outgoingInner.id, incomingInner.id] });
    if (incomingInner && outgoingOuter) extraRelations.push({ type: "perpendicular", edgeIds: [incomingInner.id, outgoingOuter.id] });
  }
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [corner.incomingEdgeId, corner.outgoingEdgeId], extraRelations);
  return {
    plate: plateWithSketchTopologyChange(plate, nextSketch, [corner.incomingEdgeId, corner.outgoingEdgeId]),
    vertexIds: [firstId, secondId, thirdId]
  };
}

export function setSketchVertex(sketchObject, vertexId, point) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const sketch = normalizeSketchWithOptionalInference(sketchObject.sketch);
  const nextPoint = vec2(point, "sketch vertex");
  let found = false;
  let changed = false;
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    changed = Math.hypot((nextPoint[0] || 0) - (vertex.point?.[0] || 0), (nextPoint[1] || 0) - (vertex.point?.[1] || 0)) > EPSILON;
    return { ...vertex, point: nextPoint };
  });
  if (!found) fail(`${sketchObject.id}: sketch vertex not found: ${vertexId}`);
  if (!changed) return normalizeSketchObject(sketchObject);
  const solvedSketch = solveSketchRelationsAfterVertexChange({ ...sketch, vertices }, [vertexId]);
  assertSketchRelationsSatisfied(solvedSketch);
  return normalizeSketchObject({ ...sketchObject, sketch: solvedSketch });
}

export function removePlateSketchRelation(plate, relationId) {
  return removeSketchRelationFromHost(plate, relationId, normalizePlate);
}

export function removePlateSketchFixedRelations(plate) {
  if (!plate?.sketch) fail("plate sketch is required");
  const relations = sketchRelations(plate.sketch);
  const nextRelations = relations.filter((relation) => relation.type !== "fixed");
  if (nextRelations.length === relations.length) return normalizePlate(plate);
  return normalizePlate({ ...plate, sketch: { ...plate.sketch, relations: nextRelations } });
}

export function solvePlateSketchRelation(plate, relationId) {
  if (!plate?.sketch) fail("plate sketch is required");
  if (typeof relationId !== "string" || !relationId) fail("plate sketch relation id is required");
  const sketch = normalizeSketchWithOptionalInference(plate.sketch);
  const relation = sketchRelations(sketch).find((item) => item.id === relationId);
  if (!relation) fail(`${plate.id}: sketch relation not found: ${relationId}`);
  let solvedSketch = sketch;
  try {
    solvedSketch = solveSketchAfterRelationUpsert(sketch, relation);
  } catch {
    solvedSketch = solveSketchAfterRelaxingLocalRelations(sketch, relation);
  }
  return normalizePlate({ ...plate, sketch: solvedSketch });
}

export function upsertPlateSketchRelation(plate, relation) {
  return upsertSketchRelationFromHost(plate, relation, normalizePlate);
}

export function fixPlateSketchUnderDefinedEntities(plate, options = {}) {
  const definition = plateSketchDefinitionStatus(plate);
  const edgeIds = options.edges === false ? [] : arrayValues(definition.underDefinedEdgeIds).filter(Boolean);
  const vertexIds = options.vertices === false ? [] : arrayValues(definition.underDefinedVertexIds).filter(Boolean);
  let nextPlate = normalizePlate(plate);
  let nextDefinition = plateSketchDefinitionStatus(nextPlate);
  const candidates = [
    ...vertexIds.map((vertexId) => ({ type: "fixed", vertexId })),
    ...edgeIds.map((edgeId) => ({ type: "fixed", edgeId }))
  ];
  for (const relation of candidates) {
    if (nextDefinition.status === "fully-defined" || nextDefinition.degreesOfFreedom <= 0) break;
    const candidatePlate = upsertSketchRelationFromHost(nextPlate, relation, normalizePlate);
    const candidateDefinition = plateSketchDefinitionStatus(candidatePlate);
    if (candidateDefinition.status === "conflicted" || candidateDefinition.status === "over-defined" || candidateDefinition.status === "invalid") continue;
    if (candidateDefinition.degreesOfFreedom >= nextDefinition.degreesOfFreedom) continue;
    nextPlate = candidatePlate;
    nextDefinition = candidateDefinition;
  }
  return nextPlate;
}

export function inferPlateSketchRelations(plate) {
  return inferSketchRelationsForHost(plate, normalizePlate);
}

export function upsertPlateBend(plate, bendPatch) {
  const sketch = plate.sketch;
  const existingIds = new Set(uniqueTruthy(plateBends(plate).map((item) => item.id)));
  if (bendPatch?.id) existingIds.add(bendPatch.id);
  const bend = normalizeBend(bendPatch, sketch, existingIds);
  const sameTarget = (item) => {
    if (bend.parentBendId || item.parentBendId) {
      return item.parentBendId === bend.parentBendId && (item.parentEdge || "outer") === (bend.parentEdge || "outer");
    }
    return item.edgeId === bend.edgeId;
  };
  const existingBends = plateBends(plate);
  const replacedIds = existingBends
    .filter((item) => item.id !== bend.id && sameTarget(item))
    .map((item) => item.id);
  const removedIds = bendDescendantIds(existingBends, replacedIds);
  const bends = existingBends.filter((item) => item.id !== bend.id && !removedIds.has(item.id));
  bends.push(bend);
  return normalizePlate({
    ...plate,
    type: "bent-plate",
    fabrication: {
      ...(plate.fabrication || {}),
      bends
    }
  });
}

export function removePlateBend(plate, bendId) {
  const existingBends = plateBends(plate);
  const seedIds = existingBends
    .filter((bend) => bend.id === bendId || bend.edgeId === bendId)
    .map((bend) => bend.id);
  const removedIds = bendDescendantIds(existingBends, seedIds);
  const bends = existingBends.filter((bend) => !removedIds.has(bend.id));
  return normalizePlate({
    ...plate,
    type: bends.length ? "bent-plate" : "plate",
    fabrication: {
      ...(plate.fabrication || {}),
      bends
    }
  });
}

export function profileFromSectionSketch({ id, designation, outline, material = "S355" }) {
  const points = cleanOutline(outline);
  return {
    id,
    designation: designation || id,
    profileType: "custom-section",
    section: {
      type: "polygonal-section",
      origin: "center",
      contours: [{ id: "outer", role: "solid", points }]
    },
    properties: { material }
  };
}
