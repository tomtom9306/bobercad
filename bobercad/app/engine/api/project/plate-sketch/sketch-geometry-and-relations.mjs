import { cleanVec2Loop, finiteNumber, finitePositiveNumber, finiteVec3, v } from "../../../core/math.mjs";
import {
  sketchEdges,
  sketchRelationEdges,
  sketchRelationVertices,
  sketchRelations,
  sketchVertices
} from "./model-accessors.mjs";
import {
  SKETCH_DIMENSION_RELATION_MODES,
  SKETCH_RELATION_TYPES,
  sketchRelationKey,
  sketchRelationLabel
} from "./relation-metadata.mjs";

export const EPSILON = 1e-9;
export const DEG_PER_RAD = 180 / Math.PI;
export const RAD_PER_DEG = Math.PI / 180;
export const DEFAULT_SKETCH_NOTCH_SIZE = 10;
export const DEFAULT_SKETCH_NOTCH_MAX_SIZE = 40;

export function fail(message) {
  throw new Error(`plate api: ${message}`);
}

export function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function optionalObject(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

export function optionalString(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

export function requiredIdPair(value, label) {
  if (!Array.isArray(value) || value.length !== 2) fail(`${label} must be an array of exactly two ids`);
  for (const [index, id] of value.entries()) {
    if (typeof id !== "string" || !id.trim()) fail(`${label} item ${index + 1} must be a non-empty string`);
  }
  if (value[0] === value[1]) fail(`${label} must reference two distinct ids`);
  return [...value];
}

export function sketchDimensionMode(value, label) {
  if (value === undefined) return "driving";
  if (SKETCH_DIMENSION_RELATION_MODES.has(value)) return value;
  fail(`${label} must be driving or driven`);
}

export function sketchSource(options, id, label) {
  const hasSketch = options.sketch !== undefined;
  const hasOutline = options.outline !== undefined;
  const hasRectangle = options.width !== undefined || options.height !== undefined;
  const sourceCount = [hasSketch, hasOutline, hasRectangle].filter(Boolean).length;
  if (sourceCount !== 1) fail(`${label} must define exactly one sketch source: sketch, outline, or width/height`);
  if (hasSketch) return options.sketch;
  if (hasOutline) return sketchFromOutline(options.outline, id);
  return sketchFromRectangle(options.width, options.height, id);
}

export function vec2(value, label = "point") {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [y, z] point`);
  }
  return [...value];
}

export function vec3(value, label = "point") {
  return finiteVec3(value, label, fail);
}

export function cleanOutline(outline) {
  return cleanVec2Loop(outline, {
    tolerance: EPSILON,
    label: "plate outline point",
    minPoints: 3,
    minMessage: "plate sketch requires at least three distinct points",
    fail
  });
}

export function normalized(vector, label) {
  const unit = v.safeNorm(vector);
  if (v.len(unit) <= EPSILON) fail(`${label} must have non-zero length`);
  return unit;
}

export function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

export function pointMoved(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > EPSILON;
}

export function clampUnit(value) {
  return Math.max(-1, Math.min(1, value));
}

export function finiteAngleDegrees(value, label = "plate sketch angle relation") {
  if (!finiteNumber(value) || value <= EPSILON || value >= 180 - EPSILON) {
    fail(`${label} requires an angle greater than 0 and less than 180 degrees`);
  }
  return value;
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
    sketch: sketchFromRectangle(length, depth, optionalString(options.idPrefix, "plate", "plate idPrefix"))
  };
}

export function outlineFromSketch(sketch) {
  if (!sketch || typeof sketch !== "object") fail("plate sketch is required");
  return cleanOutline(orderedSketchLoop(sketch).map((item) => item.point));
}

export function plateOutline(plate) {
  return outlineFromSketch(plate?.sketch);
}

export function sketchRelationId(type, ids = []) {
  return `rel_${type}_${ids.filter(Boolean).join("_")}`;
}

export function axisRelationTypeForEdgePoints(a, b, tolerance = EPSILON) {
  const dy = Math.abs(b[0] - a[0]);
  const dz = Math.abs(b[1] - a[1]);
  if (dz <= tolerance && dy > tolerance) return "horizontal";
  if (dy <= tolerance && dz > tolerance) return "vertical";
  return null;
}

export function inferredSketchRelations(sketch) {
  const edges = sketchEdges(sketch);
  const vertexMap = sketchVertexPointMap(sketch);
  const relations = [];
  const edgeVectors = new Map();
  const edgeLengths = new Map();
  for (const edge of edges) {
    const { a, b } = sketchEdgePoints(sketch, edge, vertexMap);
    const type = axisRelationTypeForEdgePoints(a, b);
    if (type) relations.push({ id: sketchRelationId(type, [edge.id]), type, edgeId: edge.id });
    const delta = [b[0] - a[0], b[1] - a[1]];
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
      if (Math.abs(edgeLengths.get(firstEdge.id) - edgeLengths.get(secondEdge.id)) <= EPSILON) {
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

export function measuredSketchEdgeLength(sketch, edgeId) {
  const { a, b } = sketchEdgePoints(sketch, edgeId);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length <= EPSILON) fail(`plate sketch edge ${edgeId} has zero length`);
  return length;
}

export function measuredSketchPointDistance(sketch, vertexIds, vertexMap = sketchVertexPointMap(sketch)) {
  const ids = requiredIdPair(vertexIds, "plate sketch distance relation vertexIds");
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

export function sketchEdgeAngleFromVectors(first, second) {
  const dot = clampUnit(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]);
  return Math.acos(dot) * DEG_PER_RAD;
}

export function sketchAngleDeltaDegrees(actual, expected) {
  return Math.abs(actual - expected);
}

export function measuredSketchEdgeAngle(sketch, edgeIds, vertexMap = sketchVertexPointMap(sketch)) {
  const ids = requiredIdPair(edgeIds, "plate sketch angle relation edgeIds");
  const first = sketchRelationVector(sketch, ids[0], vertexMap);
  const second = sketchRelationVector(sketch, ids[1], vertexMap);
  return sketchEdgeAngleFromVectors(first, second);
}

export function sketchEdgeAngleDegrees(sketch, edgeIds) {
  return measuredSketchEdgeAngle(sketch, edgeIds);
}

export function normalizeSketchRelations(sketch) {
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
      const mode = type === "length" ? sketchDimensionMode(relation.mode, "plate sketch length relation mode") : undefined;
      const value = type === "length" && mode === "driven"
        ? measuredSketchEdgeLength(sketch, relation.edgeId)
        : type === "length"
          ? relation.value
          : undefined;
      if (type === "length" && !finitePositiveNumber(value)) fail("plate sketch length relation requires positive value");
      next = {
        id: relation.id || sketchRelationId(type, [relation.edgeId]),
        type,
        edgeId: relation.edgeId,
        ...(type === "length" ? { value, mode } : {})
      };
    } else if (type === "horizontal-points" || type === "vertical-points" || type === "coincident" || type === "distance") {
      const ids = requiredIdPair(relation.vertexIds, `${type} plate sketch relation vertexIds`);
      for (const vertexId of ids) {
        if (!vertexIds.has(vertexId)) fail(`plate sketch relation references unknown vertex ${vertexId}`);
      }
      const mode = type === "distance" ? sketchDimensionMode(relation.mode, "plate sketch distance relation mode") : undefined;
      const value = type === "distance" && mode === "driven"
        ? measuredSketchPointDistance(sketch, ids)
        : type === "distance"
          ? relation.value
          : undefined;
      if (type === "distance" && !finitePositiveNumber(value)) fail("plate sketch distance relation requires positive value");
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
      const ids = requiredIdPair(relation.vertexIds, "symmetric plate sketch relation vertexIds");
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
      const hasVertexId = relation.vertexId !== undefined;
      const hasEdgeId = relation.edgeId !== undefined;
      if (hasVertexId === hasEdgeId) fail("fixed plate sketch relation requires exactly one of vertexId or edgeId");
      if (hasVertexId) {
        if (typeof relation.vertexId !== "string" || !relation.vertexId.trim()) fail("fixed plate sketch relation vertexId must be a non-empty string");
        if (!vertexIds.has(relation.vertexId)) fail(`plate sketch relation references unknown vertex ${relation.vertexId}`);
        next = {
          id: relation.id || sketchRelationId(type, [relation.vertexId]),
          type,
          vertexId: relation.vertexId
        };
      } else {
        if (typeof relation.edgeId !== "string" || !relation.edgeId.trim()) fail("fixed plate sketch relation edgeId must be a non-empty string");
        if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
        next = {
          id: relation.id || sketchRelationId(type, [relation.edgeId]),
          type,
          edgeId: relation.edgeId
        };
      }
    } else if (type === "perpendicular" || type === "parallel" || type === "collinear" || type === "equal-length" || type === "angle") {
      const ids = requiredIdPair(relation.edgeIds, `${type} plate sketch relation edgeIds`);
      for (const edgeId of ids) {
        if (!edgeIds.has(edgeId)) fail(`plate sketch relation references unknown edge ${edgeId}`);
      }
      const mode = type === "angle" ? sketchDimensionMode(relation.mode, "plate sketch angle relation mode") : undefined;
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

export function withSketchRelations(sketch, relations) {
  return {
    ...sketch,
    relations: normalizeSketchRelations({ ...sketch, relations })
  };
}

export function withInferredSketchRelations(sketch) {
  return withSketchRelations(sketch, inferredSketchRelations(sketch));
}

export function normalizeSketch(sketch) {
  if (!Array.isArray(sketch?.relations)) fail("plate sketch relations must be an array");
  return withSketchRelations(sketch, sketch.relations);
}

export function edgeById(sketch, edgeId) {
  return sketchRelationEdges(sketch).find((edge) => edge.id === edgeId) || null;
}

export function edgeEndpointIds(sketch, edgeId) {
  const edge = edgeById(sketch, edgeId);
  return edge ? [edge.from, edge.to] : [];
}

export function assertSketchPointLineRelationCanUseEdge(sketch, relation) {
  if (!relation?.vertexId || !relation?.edgeId) return;
  if (edgeEndpointIds(sketch, relation.edgeId).includes(relation.vertexId)) {
    fail(`${sketchRelationLabel(relation)} relation cannot target an edge that already owns ${relation.vertexId}`);
  }
}


export function sketchRelationVector(sketch, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
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
