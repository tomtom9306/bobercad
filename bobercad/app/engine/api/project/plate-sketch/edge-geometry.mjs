import { clamp, finiteNumber } from "../../../core/math.mjs";

const EPSILON = 1e-9;
const TAU = Math.PI * 2;
const DEFAULT_CIRCLE_SEGMENTS = 32;
const QUADRANT_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

export const SKETCH_EDGE_LINE = "line";
export const SKETCH_EDGE_CIRCULAR_ARC = "circular-arc";

function edgeFail(message) {
  throw new Error(`plate sketch edge geometry: ${message}`);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

function requiredPoint2(value, label, fail = edgeFail) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [y, z] point`);
  }
  return [...value];
}

function pointDistance2(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function angleOf(center, point) {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function positiveAngle(angle) {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
}

function arcSweep(startAngle, endAngle, direction) {
  if (direction === "ccw") return positiveAngle(endAngle - startAngle);
  return -positiveAngle(startAngle - endAngle);
}

function angleInsideRuntimeArc(runtime, angle) {
  const sweep = Math.abs(runtime.sweep);
  const distance = runtime.sweep >= 0
    ? positiveAngle(angle - runtime.startAngle)
    : positiveAngle(runtime.startAngle - angle);
  return distance > EPSILON && distance < sweep - EPSILON;
}

function finitePositive(value) {
  return finiteNumber(value) && value > EPSILON;
}

function sampleSegmentCount(runtime, options = {}) {
  if (finitePositive(options.segmentLength)) {
    return Math.max(2, Math.ceil(runtime.length / options.segmentLength));
  }
  const baseSegments = Number.isInteger(options.circleSegments) && options.circleSegments >= 4
    ? options.circleSegments
    : DEFAULT_CIRCLE_SEGMENTS;
  return Math.max(2, Math.ceil(baseSegments * Math.abs(runtime.sweep) / TAU));
}

function assertEndpointRadius(point, center, radius, label, fail) {
  const distance = pointDistance2(center, point);
  const tolerance = Math.max(1e-6, radius * 1e-6);
  if (Math.abs(distance - radius) > tolerance) {
    fail(`${label} must lie on circular-arc radius ${radius}`);
  }
}

function edgeEndpointPoints(edge, vertexMap, fail = edgeFail) {
  const a = vertexMap.get(edge.from);
  const b = vertexMap.get(edge.to);
  if (!a || !b) fail(`edge ${edge.id || ""} has missing vertices`);
  return { a, b };
}

export function sketchEdgeKind(edge) {
  if (!edge || typeof edge !== "object") return SKETCH_EDGE_LINE;
  if (edge.kind === undefined || edge.kind === SKETCH_EDGE_LINE) return SKETCH_EDGE_LINE;
  return edge.kind;
}

export function normalizeSketchEdge(edge, vertexMap, options = {}) {
  const fail = options.fail || edgeFail;
  if (!edge || typeof edge !== "object" || Array.isArray(edge)) fail("sketch edge must be an object");
  if (!nonEmptyString(edge.id)) fail("sketch edge id must be a non-empty string");
  if (!nonEmptyString(edge.from)) fail(`sketch edge ${edge.id} from must be a non-empty string`);
  if (!nonEmptyString(edge.to)) fail(`sketch edge ${edge.id} to must be a non-empty string`);
  if (edge.from === edge.to) fail(`sketch edge ${edge.id} must reference two distinct vertices`);
  edgeEndpointPoints(edge, vertexMap, fail);

  const kind = sketchEdgeKind(edge);
  if (kind === SKETCH_EDGE_LINE) {
    return edge.kind === undefined ? { ...edge } : { ...edge, kind };
  }

  if (kind !== SKETCH_EDGE_CIRCULAR_ARC) fail(`unsupported sketch edge kind: ${kind}`);
  const center = requiredPoint2(edge.center, `sketch edge ${edge.id} center`, fail);
  if (!finitePositive(edge.radius)) fail(`sketch edge ${edge.id} radius must be positive`);
  if (edge.direction !== "cw" && edge.direction !== "ccw") {
    fail(`sketch edge ${edge.id} direction must be cw or ccw`);
  }
  const runtime = sketchEdgeRuntime({ ...edge, kind, center }, vertexMap, { fail });
  if (Math.abs(runtime.sweep) <= EPSILON) fail(`sketch edge ${edge.id} circular-arc sweep cannot be zero`);
  return {
    ...edge,
    kind,
    center,
    radius: edge.radius,
    direction: edge.direction
  };
}

export function sketchEdgeRuntime(edge, vertexMap, options = {}) {
  const fail = options.fail || edgeFail;
  const { a, b } = edgeEndpointPoints(edge, vertexMap, fail);
  const kind = sketchEdgeKind(edge);
  if (kind === SKETCH_EDGE_LINE) {
    const length = pointDistance2(a, b);
    if (length <= EPSILON) fail(`sketch edge ${edge.id || ""} has zero length`);
    return {
      id: edge.id,
      kind,
      a,
      b,
      length,
      pointAt: (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      tangentAt: () => [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
    };
  }
  if (kind !== SKETCH_EDGE_CIRCULAR_ARC) fail(`unsupported sketch edge kind: ${kind}`);
  const center = requiredPoint2(edge.center, `sketch edge ${edge.id || ""} center`, fail);
  const radius = edge.radius;
  if (!finitePositive(radius)) fail(`sketch edge ${edge.id || ""} radius must be positive`);
  const direction = edge.direction;
  if (direction !== "cw" && direction !== "ccw") fail(`sketch edge ${edge.id || ""} direction must be cw or ccw`);
  assertEndpointRadius(a, center, radius, `sketch edge ${edge.id || ""} start`, fail);
  assertEndpointRadius(b, center, radius, `sketch edge ${edge.id || ""} end`, fail);
  const startAngle = angleOf(center, a);
  const endAngle = angleOf(center, b);
  const sweep = arcSweep(startAngle, endAngle, direction);
  if (Math.abs(sweep) <= EPSILON) fail(`sketch edge ${edge.id || ""} circular-arc sweep cannot be zero`);
  const directionSign = Math.sign(sweep);
  return {
    id: edge.id,
    kind,
    a,
    b,
    center,
    radius,
    direction,
    startAngle,
    endAngle,
    sweep,
    length: Math.abs(sweep) * radius,
    pointAt: (t) => {
      const angle = startAngle + sweep * clamp(t, 0, 1);
      return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
    },
    tangentAt: (t) => {
      const angle = startAngle + sweep * clamp(t, 0, 1);
      return [-Math.sin(angle) * directionSign, Math.cos(angle) * directionSign];
    }
  };
}

export function sketchEdgeLength(edge, vertexMap, options = {}) {
  return sketchEdgeRuntime(edge, vertexMap, options).length;
}

export function sketchEdgePointAt(edge, vertexMap, t = 0.5, options = {}) {
  return sketchEdgeRuntime(edge, vertexMap, options).pointAt(clamp(t, 0, 1));
}

export function sketchEdgeCenterPoint(edge, vertexMap, options = {}) {
  const runtime = sketchEdgeRuntime(edge, vertexMap, options);
  return runtime.kind === SKETCH_EDGE_CIRCULAR_ARC ? [...runtime.center] : null;
}

export function sketchEdgeQuadrantPoints(edge, vertexMap, options = {}) {
  const runtime = sketchEdgeRuntime(edge, vertexMap, options);
  if (runtime.kind !== SKETCH_EDGE_CIRCULAR_ARC) return [];
  return QUADRANT_ANGLES
    .filter((angle) => angleInsideRuntimeArc(runtime, angle))
    .map((angle) => ({
      angle,
      point: [
        runtime.center[0] + Math.cos(angle) * runtime.radius,
        runtime.center[1] + Math.sin(angle) * runtime.radius
      ]
    }));
}

export function sampleSketchEdge(edge, vertexMap, options = {}) {
  const runtime = sketchEdgeRuntime(edge, vertexMap, options);
  if (runtime.kind === SKETCH_EDGE_LINE) return [[...runtime.a], [...runtime.b]];
  const segmentCount = sampleSegmentCount(runtime, options);
  const points = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    points.push(runtime.pointAt(index / segmentCount));
  }
  return points;
}
