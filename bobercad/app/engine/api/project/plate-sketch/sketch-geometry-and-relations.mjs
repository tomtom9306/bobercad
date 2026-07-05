import { cleanVec2Loop, finiteNumber, finitePositiveNumber, finiteVec3, v } from "../../../core/math.mjs";
import {
  sketchConstructionEdges,
  sketchEdges,
  sketchRelationEdges,
  sketchRelationVertices,
  sketchRelations,
  sketchVertices
} from "./model-accessors.mjs";
import {
  SKETCH_EDGE_CIRCULAR_ARC,
  SKETCH_EDGE_LINE,
  normalizeSketchEdge,
  sampleSketchEdge,
  sketchEdgeCenterPoint as runtimeSketchEdgeCenterPoint,
  sketchEdgeKind,
  sketchEdgeLength as runtimeSketchEdgeLength,
  sketchEdgePointAt as runtimeSketchEdgePointAt,
  sketchEdgeQuadrantPoints as runtimeSketchEdgeQuadrantPoints,
  sketchEdgeRuntime
} from "./edge-geometry.mjs";
import {
  SKETCH_DIMENSION_RELATION_MODES,
  SKETCH_RADIUS_RELATION_DISPLAYS,
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

export function sketchRadiusDimensionDisplay(value, label) {
  if (value === undefined || value === "radius") return undefined;
  if (SKETCH_RADIUS_RELATION_DISPLAYS.has(value)) return value;
  fail(`${label} must be radius or diameter`);
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

export function rectangleOutline(width, height, center = [0, 0]) {
  if (!finitePositiveNumber(width)) fail("plate width must be a positive number");
  if (!finitePositiveNumber(height)) fail("plate height must be a positive number");
  const [cy, cz] = vec2(center, "plate rectangle center");
  return [
    [cy - width / 2, cz - height / 2],
    [cy + width / 2, cz - height / 2],
    [cy + width / 2, cz + height / 2],
    [cy - width / 2, cz + height / 2]
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

export function sketchFromRectangle(width, height, idPrefix = "sketch", center = [0, 0]) {
  return sketchFromOutline(rectangleOutline(width, height, center), idPrefix);
}

export function sketchFromRoundedRectangle(width, height, radius, idPrefix = "sketch", center = [0, 0]) {
  if (!finitePositiveNumber(width)) fail("plate sketch rounded rectangle width must be positive");
  if (!finitePositiveNumber(height)) fail("plate sketch rounded rectangle height must be positive");
  if (!finitePositiveNumber(radius)) fail("plate sketch rounded rectangle radius must be positive");
  if (radius * 2 >= Math.min(width, height) - EPSILON) {
    fail("plate sketch rounded rectangle radius must be less than half the width and height");
  }
  const [cy, cz] = vec2(center, "plate sketch rounded rectangle center");
  const left = cy - width / 2;
  const right = cy + width / 2;
  const bottom = cz - height / 2;
  const top = cz + height / 2;
  const vertices = [
    { id: `${idPrefix}_v1`, point: [left + radius, bottom] },
    { id: `${idPrefix}_v2`, point: [right - radius, bottom] },
    { id: `${idPrefix}_v3`, point: [right, bottom + radius] },
    { id: `${idPrefix}_v4`, point: [right, top - radius] },
    { id: `${idPrefix}_v5`, point: [right - radius, top] },
    { id: `${idPrefix}_v6`, point: [left + radius, top] },
    { id: `${idPrefix}_v7`, point: [left, top - radius] },
    { id: `${idPrefix}_v8`, point: [left, bottom + radius] }
  ];
  const edges = [
    { id: `${idPrefix}_e1`, from: vertices[0].id, to: vertices[1].id },
    {
      id: `${idPrefix}_e2`,
      from: vertices[1].id,
      to: vertices[2].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: [right - radius, bottom + radius],
      radius,
      direction: "ccw"
    },
    { id: `${idPrefix}_e3`, from: vertices[2].id, to: vertices[3].id },
    {
      id: `${idPrefix}_e4`,
      from: vertices[3].id,
      to: vertices[4].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: [right - radius, top - radius],
      radius,
      direction: "ccw"
    },
    { id: `${idPrefix}_e5`, from: vertices[4].id, to: vertices[5].id },
    {
      id: `${idPrefix}_e6`,
      from: vertices[5].id,
      to: vertices[6].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: [left + radius, top - radius],
      radius,
      direction: "ccw"
    },
    { id: `${idPrefix}_e7`, from: vertices[6].id, to: vertices[7].id },
    {
      id: `${idPrefix}_e8`,
      from: vertices[7].id,
      to: vertices[0].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: [left + radius, bottom + radius],
      radius,
      direction: "ccw"
    }
  ];
  return withSketchRelations({ type: "plate-sketch", vertices, edges }, [
    { type: "radius", edgeId: edges[1].id, value: radius, mode: "driven" },
    { type: "equal-radius", edgeIds: [edges[1].id, edges[3].id] },
    { type: "equal-radius", edgeIds: [edges[3].id, edges[5].id] },
    { type: "equal-radius", edgeIds: [edges[5].id, edges[7].id] },
    { type: "tangent", edgeIds: [edges[0].id, edges[1].id] },
    { type: "tangent", edgeIds: [edges[1].id, edges[2].id] },
    { type: "tangent", edgeIds: [edges[2].id, edges[3].id] },
    { type: "tangent", edgeIds: [edges[3].id, edges[4].id] },
    { type: "tangent", edgeIds: [edges[4].id, edges[5].id] },
    { type: "tangent", edgeIds: [edges[5].id, edges[6].id] },
    { type: "tangent", edgeIds: [edges[6].id, edges[7].id] },
    { type: "tangent", edgeIds: [edges[7].id, edges[0].id] }
  ]);
}

export function sketchFromCircle(radius, idPrefix = "sketch", center = [0, 0]) {
  if (!finitePositiveNumber(radius)) fail("plate sketch circle radius must be positive");
  const [cy, cz] = vec2(center, "plate sketch circle center");
  const vertices = [
    { id: `${idPrefix}_v1`, point: [cy + radius, cz] },
    { id: `${idPrefix}_v2`, point: [cy, cz + radius] },
    { id: `${idPrefix}_v3`, point: [cy - radius, cz] },
    { id: `${idPrefix}_v4`, point: [cy, cz - radius] }
  ];
  const edges = vertices.map((vertex, index) => ({
    id: `${idPrefix}_e${index + 1}`,
    from: vertex.id,
    to: vertices[(index + 1) % vertices.length].id,
    kind: SKETCH_EDGE_CIRCULAR_ARC,
    center: [cy, cz],
    radius,
    direction: "ccw"
  }));
  return withSketchRelations({ type: "plate-sketch", vertices, edges }, [{
    type: "radius",
    edgeId: edges[0].id,
    value: radius,
    mode: "driven"
  }]);
}

export function sketchFromSlot(length, radius, idPrefix = "sketch", center = [0, 0]) {
  if (!finitePositiveNumber(length)) fail("plate sketch slot length must be positive");
  if (!finitePositiveNumber(radius)) fail("plate sketch slot radius must be positive");
  if (length <= radius * 2 + EPSILON) fail("plate sketch slot length must be greater than diameter");
  const [cy, cz] = vec2(center, "plate sketch slot center");
  const halfStraight = (length - radius * 2) / 2;
  const leftCenter = [cy - halfStraight, cz];
  const rightCenter = [cy + halfStraight, cz];
  const vertices = [
    { id: `${idPrefix}_v1`, point: [leftCenter[0], cz - radius] },
    { id: `${idPrefix}_v2`, point: [rightCenter[0], cz - radius] },
    { id: `${idPrefix}_v3`, point: [rightCenter[0], cz + radius] },
    { id: `${idPrefix}_v4`, point: [leftCenter[0], cz + radius] }
  ];
  const edges = [
    { id: `${idPrefix}_e1`, from: vertices[0].id, to: vertices[1].id },
    {
      id: `${idPrefix}_e2`,
      from: vertices[1].id,
      to: vertices[2].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: rightCenter,
      radius,
      direction: "ccw"
    },
    { id: `${idPrefix}_e3`, from: vertices[2].id, to: vertices[3].id },
    {
      id: `${idPrefix}_e4`,
      from: vertices[3].id,
      to: vertices[0].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: leftCenter,
      radius,
      direction: "ccw"
    }
  ];
  return withSketchRelations({ type: "plate-sketch", vertices, edges }, [
    { type: "radius", edgeId: edges[1].id, value: radius, mode: "driven" },
    { type: "equal-radius", edgeIds: [edges[1].id, edges[3].id] },
    { type: "tangent", edgeIds: [edges[0].id, edges[1].id] },
    { type: "tangent", edgeIds: [edges[1].id, edges[2].id] },
    { type: "tangent", edgeIds: [edges[2].id, edges[3].id] },
    { type: "tangent", edgeIds: [edges[3].id, edges[0].id] }
  ]);
}

export function sketchFromSlotCenters(startCenterPoint, endCenterPoint, radius, idPrefix = "sketch") {
  if (!finitePositiveNumber(radius)) fail("plate sketch slot radius must be positive");
  const startCenter = vec2(startCenterPoint, "plate sketch slot start center");
  const endCenter = vec2(endCenterPoint, "plate sketch slot end center");
  const axis = [endCenter[0] - startCenter[0], endCenter[1] - startCenter[1]];
  const straightLength = Math.hypot(axis[0], axis[1]);
  if (straightLength <= EPSILON) fail("plate sketch slot centerline must have non-zero length");
  const unit = [axis[0] / straightLength, axis[1] / straightLength];
  const normal = [-unit[1], unit[0]];
  const offset = [normal[0] * radius, normal[1] * radius];
  const vertices = [
    { id: `${idPrefix}_v1`, point: [startCenter[0] - offset[0], startCenter[1] - offset[1]] },
    { id: `${idPrefix}_v2`, point: [endCenter[0] - offset[0], endCenter[1] - offset[1]] },
    { id: `${idPrefix}_v3`, point: [endCenter[0] + offset[0], endCenter[1] + offset[1]] },
    { id: `${idPrefix}_v4`, point: [startCenter[0] + offset[0], startCenter[1] + offset[1]] }
  ];
  const edges = [
    { id: `${idPrefix}_e1`, from: vertices[0].id, to: vertices[1].id },
    {
      id: `${idPrefix}_e2`,
      from: vertices[1].id,
      to: vertices[2].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: endCenter,
      radius,
      direction: "ccw"
    },
    { id: `${idPrefix}_e3`, from: vertices[2].id, to: vertices[3].id },
    {
      id: `${idPrefix}_e4`,
      from: vertices[3].id,
      to: vertices[0].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: startCenter,
      radius,
      direction: "ccw"
    }
  ];
  return withSketchRelations({ type: "plate-sketch", vertices, edges }, [
    { type: "radius", edgeId: edges[1].id, value: radius, mode: "driven" },
    { type: "equal-radius", edgeIds: [edges[1].id, edges[3].id] },
    { type: "tangent", edgeIds: [edges[0].id, edges[1].id] },
    { type: "tangent", edgeIds: [edges[1].id, edges[2].id] },
    { type: "tangent", edgeIds: [edges[2].id, edges[3].id] },
    { type: "tangent", edgeIds: [edges[3].id, edges[0].id] }
  ]);
}

export function sketchFromCenterArc(radius, sweepDegrees = 120, idPrefix = "sketch", center = [0, 0], startAngleDegrees = 0) {
  if (!finitePositiveNumber(radius)) fail("plate sketch center arc radius must be positive");
  const sweep = Number(sweepDegrees);
  if (!Number.isFinite(sweep) || Math.abs(sweep) <= EPSILON || Math.abs(sweep) >= 360 - EPSILON) {
    fail("plate sketch center arc sweep must be greater than 0 and less than 360 degrees");
  }
  const startAngle = Number(startAngleDegrees);
  if (!Number.isFinite(startAngle)) fail("plate sketch center arc start angle must be finite");
  const [cy, cz] = vec2(center, "plate sketch center arc center");
  const start = startAngle * RAD_PER_DEG;
  const end = (startAngle + sweep) * RAD_PER_DEG;
  const startPoint = [cy + Math.cos(start) * radius, cz + Math.sin(start) * radius];
  const endPoint = [cy + Math.cos(end) * radius, cz + Math.sin(end) * radius];
  const vertices = [
    { id: `${idPrefix}_v1`, point: [cy, cz] },
    { id: `${idPrefix}_v2`, point: startPoint },
    { id: `${idPrefix}_v3`, point: endPoint }
  ];
  const edges = [
    { id: `${idPrefix}_e1`, from: vertices[0].id, to: vertices[1].id },
    {
      id: `${idPrefix}_e2`,
      from: vertices[1].id,
      to: vertices[2].id,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: [cy, cz],
      radius,
      direction: sweep >= 0 ? "ccw" : "cw"
    },
    { id: `${idPrefix}_e3`, from: vertices[2].id, to: vertices[0].id }
  ];
  return withSketchRelations({ type: "plate-sketch", vertices, edges }, [{
    type: "radius",
    edgeId: edges[1].id,
    value: radius,
    mode: "driven"
  }]);
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

function samePoint2(a, b, tolerance = EPSILON) {
  return Array.isArray(a)
    && Array.isArray(b)
    && Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

export function tessellatedSketchLoop(sketch, options = {}) {
  if (!sketch || typeof sketch !== "object") fail("plate sketch is required");
  const loop = orderedSketchLoop(sketch);
  const edgeMap = new Map(sketchEdges(sketch).map((edge) => [edge.id, edge]));
  const vertexMap = sketchVertexPointMap(sketch);
  const points = [];
  for (const item of loop) {
    const edge = edgeMap.get(item.outgoingEdgeId);
    const samples = edge ? sampleSketchEdge(edge, vertexMap, options) : [item.point];
    for (const point of samples) {
      if (points.length && samePoint2(points[points.length - 1], point)) continue;
      points.push(point);
    }
  }
  if (points.length > 1 && samePoint2(points[0], points[points.length - 1])) points.pop();
  return points;
}

export function outlineFromSketch(sketch, options = {}) {
  if (!sketch || typeof sketch !== "object") fail("plate sketch is required");
  return cleanOutline(tessellatedSketchLoop(sketch, options));
}

export function plateOutline(plate, options = {}) {
  return outlineFromSketch(plate?.sketch, options);
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

function sharedSketchEdgeVertexId(firstEdge, secondEdge) {
  if (!firstEdge || !secondEdge) return null;
  return [firstEdge.from, firstEdge.to].find((vertexId) => vertexId === secondEdge.from || vertexId === secondEdge.to) || null;
}

function sketchEdgesAreTangentAtSharedVertex(sketch, firstEdge, secondEdge, tolerance = 1e-6) {
  if (!firstEdge || !secondEdge) return false;
  if (sketchEdgeKind(firstEdge) !== SKETCH_EDGE_CIRCULAR_ARC && sketchEdgeKind(secondEdge) !== SKETCH_EDGE_CIRCULAR_ARC) return false;
  const sharedVertexId = sharedSketchEdgeVertexId(firstEdge, secondEdge);
  if (!sharedVertexId) return false;
  const first = sketchEdgeTangentAtVertex(sketch, firstEdge, sharedVertexId);
  const second = sketchEdgeTangentAtVertex(sketch, secondEdge, sharedVertexId);
  return Math.abs(Math.abs(first[0] * second[0] + first[1] * second[1]) - 1) <= tolerance;
}

function inferredEqualRadiusGroups(sketch, edges) {
  const groups = [];
  for (const edge of edges) {
    if (sketchEdgeKind(edge) !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    const radius = measuredSketchEdgeRadius(sketch, edge.id);
    const group = groups.find((item) => Math.abs(item.radius - radius) <= Math.max(EPSILON, Math.max(item.radius, radius) * 1e-6));
    if (group) {
      group.edges.push(edge);
    } else {
      groups.push({ radius, edges: [edge] });
    }
  }
  return groups.filter((group) => group.edges.length > 1);
}

export function inferredSketchRelations(sketch) {
  const edges = sketchEdges(sketch);
  const vertexMap = sketchVertexPointMap(sketch);
  const relations = [];
  const edgeVectors = new Map();
  const edgeLengths = new Map();
  for (const edge of edges) {
    if (sketchEdgeKind(edge) !== SKETCH_EDGE_LINE) continue;
    const { a, b } = sketchEdgePoints(sketch, edge, vertexMap);
    const type = axisRelationTypeForEdgePoints(a, b);
    if (type) relations.push({ id: sketchRelationId(type, [edge.id]), type, edgeId: edge.id });
    const delta = [b[0] - a[0], b[1] - a[1]];
    const length = Math.hypot(delta[0], delta[1]);
    edgeVectors.set(edge.id, length > EPSILON ? [delta[0] / length, delta[1] / length] : [0, 0]);
    edgeLengths.set(edge.id, length);
  }
  for (const edge of edges) {
    if (sketchEdgeKind(edge) !== SKETCH_EDGE_LINE) continue;
    const next = edges.find((item) => item.from === edge.to);
    if (!next || sketchEdgeKind(next) !== SKETCH_EDGE_LINE) continue;
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
      if (sketchEdgeKind(firstEdge) !== SKETCH_EDGE_LINE || sketchEdgeKind(secondEdge) !== SKETCH_EDGE_LINE) continue;
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
  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      const firstEdge = edges[firstIndex];
      const secondEdge = edges[secondIndex];
      if (!sketchEdgesAreTangentAtSharedVertex(sketch, firstEdge, secondEdge)) continue;
      relations.push({
        id: sketchRelationId("tangent", [firstEdge.id, secondEdge.id]),
        type: "tangent",
        edgeIds: [firstEdge.id, secondEdge.id]
      });
    }
  }
  for (const group of inferredEqualRadiusGroups(sketch, edges)) {
    for (let index = 1; index < group.edges.length; index += 1) {
      const firstEdge = group.edges[index - 1];
      const secondEdge = group.edges[index];
      relations.push({
        id: sketchRelationId("equal-radius", [firstEdge.id, secondEdge.id]),
        type: "equal-radius",
        edgeIds: [firstEdge.id, secondEdge.id]
      });
    }
  }
  return relations;
}

export function measuredSketchEdgeLength(sketch, edgeId) {
  const edge = edgeById(sketch, edgeId);
  if (!edge) fail(`plate sketch edge not found: ${edgeId}`);
  const length = runtimeSketchEdgeLength(edge, sketchVertexPointMap(sketch), { fail });
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

function assertStraightSketchRelationEdge(sketch, edgeId, relation) {
  if (sketchEdgeIsCircularArc(sketch, edgeId)) {
    fail(`${sketchRelationLabel(relation)} relation requires straight sketch edges`);
  }
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
    if (type === "horizontal" || type === "vertical" || type === "length" || type === "radius") {
      if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
      if (type === "horizontal" || type === "vertical" || type === "length") {
        assertStraightSketchRelationEdge(sketch, relation.edgeId, relation);
      }
      const mode = type === "length" ? sketchDimensionMode(relation.mode, "plate sketch length relation mode") : undefined;
      const radiusMode = type === "radius" ? sketchDimensionMode(relation.mode, "plate sketch radius relation mode") : undefined;
      const radiusDisplay = type === "radius" ? sketchRadiusDimensionDisplay(relation.display, "plate sketch radius relation display") : undefined;
      const value = type === "length" && mode === "driven"
        ? measuredSketchEdgeLength(sketch, relation.edgeId)
        : type === "radius" && radiusMode === "driven"
          ? measuredSketchEdgeRadius(sketch, relation.edgeId)
          : type === "length" || type === "radius"
            ? relation.value
            : undefined;
      if (type === "length" && !finitePositiveNumber(value)) fail("plate sketch length relation requires positive value");
      if (type === "radius" && !finitePositiveNumber(value)) fail("plate sketch radius relation requires positive value");
      if (type === "radius" && !sketchEdgeIsCircularArc(sketch, relation.edgeId)) fail("plate sketch radius relation requires a circular arc edge");
      next = {
        id: relation.id || sketchRelationId(type, [relation.edgeId]),
        type,
        edgeId: relation.edgeId,
        ...(type === "length" ? { value, mode } : {}),
        ...(type === "radius" ? { value, mode: radiusMode, ...(radiusDisplay ? { display: radiusDisplay } : {}) } : {})
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
    } else if (type === "point-on-line" || type === "point-on-circle" || type === "midpoint") {
      if (!vertexIds.has(relation.vertexId)) fail(`plate sketch relation references unknown vertex ${relation.vertexId}`);
      if (!edgeIds.has(relation.edgeId)) fail(`plate sketch relation references unknown edge ${relation.edgeId}`);
      if (type === "point-on-line" || type === "midpoint") {
        assertStraightSketchRelationEdge(sketch, relation.edgeId, relation);
      }
      assertSketchPointLineRelationCanUseEdge(sketch, relation);
      if (type === "point-on-circle" && !sketchEdgeIsCircularArc(sketch, relation.edgeId)) fail("point-on-circle plate sketch relation requires a circular arc edge");
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
      assertStraightSketchRelationEdge(sketch, relation.edgeId, relation);
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
    } else if (type === "perpendicular" || type === "parallel" || type === "collinear" || type === "equal-length" || type === "tangent" || type === "concentric" || type === "equal-radius" || type === "angle") {
      const ids = requiredIdPair(relation.edgeIds, `${type} plate sketch relation edgeIds`);
      for (const edgeId of ids) {
        if (!edgeIds.has(edgeId)) fail(`plate sketch relation references unknown edge ${edgeId}`);
      }
      if (type === "perpendicular" || type === "parallel" || type === "collinear" || type === "equal-length" || type === "angle") {
        ids.forEach((edgeId) => assertStraightSketchRelationEdge(sketch, edgeId, relation));
      }
      if ((type === "concentric" || type === "equal-radius") && !ids.every((edgeId) => sketchEdgeIsCircularArc(sketch, edgeId))) {
        fail(`${type} plate sketch relation requires two circular arc edges`);
      }
      if (type === "tangent" && !ids.some((edgeId) => sketchEdgeIsCircularArc(sketch, edgeId))) {
        fail("tangent plate sketch relation requires at least one circular arc edge");
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
  const vertexMap = sketchVertexPointMap(sketch);
  const next = {
    ...sketch,
    edges: sketchEdges(sketch).map((edge) => normalizeSketchEdge(edge, vertexMap, { fail })),
    ...(sketch.constructionEdges !== undefined
      ? { constructionEdges: sketchConstructionEdges(sketch).map((edge) => normalizeSketchEdge(edge, vertexMap, { fail })) }
      : {})
  };
  return withSketchRelations(next, next.relations);
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

export function sketchEdgeSamplePoints(sketch, edgeOrId, options = {}) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  return sampleSketchEdge(edge, sketchVertexPointMap(sketch), { fail, ...options });
}

export function sketchEdgeMidpoint(sketch, edgeOrId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  return runtimeSketchEdgePointAt(edge, sketchVertexPointMap(sketch), 0.5, { fail });
}

export function sketchEdgeCenterPoint(sketch, edgeOrId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  return runtimeSketchEdgeCenterPoint(edge, sketchVertexPointMap(sketch), { fail });
}

export function sketchEdgeQuadrantPoints(sketch, edgeOrId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  return runtimeSketchEdgeQuadrantPoints(edge, sketchVertexPointMap(sketch), { fail });
}

export function sketchEdgeTangentAtVertex(sketch, edgeOrId, vertexId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  if (edge.from !== vertexId && edge.to !== vertexId) fail(`plate sketch edge ${edge.id} does not use vertex ${vertexId}`);
  const runtime = sketchEdgeRuntime(edge, sketchVertexPointMap(sketch), { fail });
  return runtime.tangentAt(edge.from === vertexId ? 0 : 1);
}

export function measuredSketchEdgeRadius(sketch, edgeOrId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  const runtime = sketchEdgeRuntime(edge, sketchVertexPointMap(sketch), { fail });
  if (runtime.kind !== SKETCH_EDGE_CIRCULAR_ARC) fail(`plate sketch edge ${edge.id} is not a circular arc`);
  return runtime.radius;
}

export function sketchEdgeIsCircularArc(sketch, edgeOrId) {
  const { edge } = sketchEdgePoints(sketch, edgeOrId);
  return sketchEdgeRuntime(edge, sketchVertexPointMap(sketch), { fail }).kind === SKETCH_EDGE_CIRCULAR_ARC;
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
