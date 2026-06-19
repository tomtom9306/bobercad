import { clamp, finiteNumber, finiteVec3, v } from "../../core/math.mjs";

const EPSILON = 1e-9;
const DEFAULT_UP = [0, 0, 1];

function fail(message) {
  throw new Error(`path api: ${message}`);
}

function requiredFiniteNumber(value, label) {
  if (!finiteNumber(value)) fail(`${label} must be a finite number`);
  return value;
}

const vec3 = (value, label) => finiteVec3(value, label, fail);

function optionalObject(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function optionalString(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function optionalSampleCount(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 2) fail(`${label} must be an integer greater than 1`);
  return value;
}

function pathType(spec) {
  if (spec.type === undefined) fail("path type is required");
  return optionalString(spec.type, undefined, "path type");
}

function unit(value, label) {
  const vector = vec3(value, label);
  const length = v.len(vector);
  if (length <= EPSILON) fail(`${label} cannot be zero length`);
  return v.mul(vector, 1 / length);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function stationParameter(distance, length, label) {
  const station = requiredFiniteNumber(distance, label);
  if (station < -EPSILON || station > length + EPSILON) fail(`${label} must be between 0 and ${length}`);
  return clamp(station / length, 0, 1);
}

function chooseFrameAxes(tangent, preferredUp = DEFAULT_UP) {
  const tangentUnit = unit(tangent, "path tangent");
  let binormal = v.cross(tangentUnit, unit(preferredUp, "preferred up"));
  if (v.len(binormal) <= EPSILON) binormal = v.cross(tangentUnit, [1, 0, 0]);
  if (v.len(binormal) <= EPSILON) binormal = v.cross(tangentUnit, [0, 1, 0]);
  binormal = v.norm(binormal);
  const normal = v.norm(v.cross(binormal, tangentUnit));
  return { tangent: tangentUnit, normal, binormal };
}

function lineSegment(spec, index = 0) {
  const start = vec3(spec.start, `segment ${index} start`);
  const end = vec3(spec.end, `segment ${index} end`);
  const axis = v.sub(end, start);
  const length = v.len(axis);
  if (length <= EPSILON) fail(`segment ${index} line cannot have zero length`);
  return {
    id: optionalString(spec.id, `segment_${index + 1}`, `segment ${index} id`),
    type: "line",
    start,
    end,
    length,
    pointAt: (distance) => lerpPoint(start, end, stationParameter(distance, length, `segment ${index} station`)),
    tangentAt: () => v.mul(axis, 1 / length)
  };
}

function polylineSegments(spec) {
  if (!Array.isArray(spec.points)) fail("polyline points must be an array");
  const points = spec.points.map((point, index) => vec3(point, `polyline point ${index}`));
  if (points.length < 2) fail("polyline path requires at least two points");
  const id = optionalString(spec.id, undefined, "polyline id");
  return points.slice(0, -1).map((point, index) => lineSegment({
    id: id ? `${id}_${index + 1}` : undefined,
    start: point,
    end: points[index + 1]
  }, index));
}

function arcAxes(spec, index) {
  const center = vec3(spec.center, `segment ${index} center`);
  const axisX = unit(spec.axisX, `segment ${index} axisX`);
  const rawAxisY = vec3(spec.axisY, `segment ${index} axisY`);
  const projectedAxisY = v.sub(rawAxisY, v.mul(axisX, v.dot(axisX, rawAxisY)));
  const axisY = unit(projectedAxisY, `segment ${index} axisY`);
  return { center, axisX, axisY };
}

function arcPoint(center, axisX, axisY, radius, angle, zOffset = [0, 0, 0]) {
  return v.add(
    v.add(center, v.mul(axisX, Math.cos(angle) * radius)),
    v.add(v.mul(axisY, Math.sin(angle) * radius), zOffset)
  );
}

function arcTangent(axisX, axisY, angle, directionSign = 1) {
  return v.norm(v.add(
    v.mul(axisX, -Math.sin(angle) * directionSign),
    v.mul(axisY, Math.cos(angle) * directionSign)
  ));
}

function radialSweep(spec, index) {
  const radius = requiredFiniteNumber(spec.radius, `segment ${index} radius`);
  if (radius <= EPSILON) fail(`segment ${index} radius must be positive`);
  const startAngle = requiredFiniteNumber(spec.startAngle, `segment ${index} startAngle`);
  const endAngle = requiredFiniteNumber(spec.endAngle, `segment ${index} endAngle`);
  return { radius, startAngle, endAngle, sweep: endAngle - startAngle };
}

function arcSegment(spec, index = 0) {
  const { center, axisX, axisY } = arcAxes(spec, index);
  const { radius, startAngle, endAngle, sweep } = radialSweep(spec, index);
  if (Math.abs(sweep) <= EPSILON) fail(`segment ${index} arc sweep cannot be zero`);
  const length = Math.abs(sweep) * radius;
  const directionSign = Math.sign(sweep);
  return {
    id: optionalString(spec.id, `segment_${index + 1}`, `segment ${index} id`),
    type: "arc",
    center,
    radius,
    axisX,
    axisY,
    startAngle,
    endAngle,
    sweep,
    directionSign,
    length,
    pointAt: (distance) => {
      const t = stationParameter(distance, length, `segment ${index} station`);
      return arcPoint(center, axisX, axisY, radius, startAngle + sweep * t);
    },
    tangentAt: (distance) => {
      const t = stationParameter(distance, length, `segment ${index} station`);
      return arcTangent(axisX, axisY, startAngle + sweep * t, directionSign);
    }
  };
}

function helixSegment(spec, index = 0) {
  const { center, axisX, axisY } = arcAxes(spec, index);
  const axisZ = unit(spec.axisZ, `segment ${index} axisZ`);
  const { radius, startAngle, endAngle, sweep } = radialSweep(spec, index);
  const height = requiredFiniteNumber(spec.height, `segment ${index} height`);
  if (Math.abs(sweep) <= EPSILON && Math.abs(height) <= EPSILON) fail(`segment ${index} helix cannot have zero length`);
  const length = Math.hypot(Math.abs(sweep) * radius, height);
  const directionSign = Math.sign(sweep || 1);
  return {
    id: optionalString(spec.id, `segment_${index + 1}`, `segment ${index} id`),
    type: spec.type === "spiral" ? "spiral" : "helix",
    center,
    radius,
    axisX,
    axisY,
    axisZ,
    startAngle,
    endAngle,
    sweep,
    directionSign,
    height,
    length,
    pointAt: (distance) => {
      const t = stationParameter(distance, length, `segment ${index} station`);
      const angle = startAngle + sweep * t;
      return arcPoint(center, axisX, axisY, radius, angle, v.mul(axisZ, height * t));
    },
    tangentAt: (distance) => {
      const t = stationParameter(distance, length, `segment ${index} station`);
      const angle = startAngle + sweep * t;
      const angular = v.mul(arcTangent(axisX, axisY, angle, directionSign), Math.abs(sweep) * radius);
      return v.norm(v.add(angular, v.mul(axisZ, height)));
    }
  };
}

function normalizeSegments(spec) {
  const type = pathType(spec);
  if (spec.segments !== undefined && !Array.isArray(spec.segments)) fail("path segments must be an array");
  if (type === "polyline") return stationSegments(polylineSegments(spec));
  if (type === "custom") {
    if (!Array.isArray(spec.segments)) fail("custom path segments must be an array");
    return stationSegments(spec.segments.flatMap((segment, index) => normalizeSegment(segment, index)));
  }
  if (spec.segments !== undefined) fail("path segments require type custom");
  return stationSegments([normalizeSegment(spec, 0)].flat());
}

function stationSegments(sourceSegments) {
  let station = 0;
  return sourceSegments.map((segment) => {
    const next = { ...segment, stationStart: station, stationEnd: station + segment.length };
    station = next.stationEnd;
    return next;
  });
}

function normalizeSegment(spec, index) {
  spec = optionalObject(spec, `segment ${index}`);
  const type = pathType(spec);
  if (type === "polyline") return polylineSegments(spec);
  if (type === "line") return [lineSegment(spec, index)];
  if (type === "arc") return [arcSegment(spec, index)];
  if (type === "helix" || type === "spiral") return [helixSegment(spec, index)];
  fail(`unsupported path segment type ${type}`);
}

export function normalizePath(spec) {
  spec = optionalObject(spec, "path spec");
  const segments = normalizeSegments(spec);
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (length <= EPSILON) fail("path cannot have zero length");
  return {
    id: optionalString(spec.id, "path", "path id"),
    type: pathType(spec),
    length,
    segments
  };
}

function segmentAtStation(path, station) {
  const normalized = normalizedPath(path);
  const clampedStation = stationParameter(station, normalized.length, "path station") * normalized.length;
  const segment = normalized.segments.find((item) => clampedStation <= item.stationEnd + EPSILON);
  if (!segment) fail(`path station ${clampedStation} is outside normalized segments`);
  return segment;
}

function runtimePath(spec) {
  return Array.isArray(spec.segments)
    && spec.segments.length > 0
    && finiteNumber(spec.length)
    && spec.length > EPSILON
    && spec.segments.every((segment) => (
      segment
      && typeof segment === "object"
      && !Array.isArray(segment)
      && finiteNumber(segment.stationStart)
      && finiteNumber(segment.stationEnd)
      && segment.stationEnd >= segment.stationStart
      && typeof segment.pointAt === "function"
      && typeof segment.tangentAt === "function"
    ));
}

function normalizedPath(spec) {
  spec = optionalObject(spec, "path spec");
  return runtimePath(spec) ? spec : normalizePath(spec);
}

export function pathLength(spec) {
  return normalizePath(spec).length;
}

export function pointAtStation(spec, station) {
  const path = normalizedPath(spec);
  const segment = segmentAtStation(path, station);
  const clampedStation = stationParameter(station, path.length, "path station") * path.length;
  return segment.pointAt(clampedStation - segment.stationStart);
}

export function frameAtStation(spec, station, options = {}) {
  options = optionalObject(options, "path frame options");
  const path = normalizedPath(spec);
  const segment = segmentAtStation(path, station);
  const clampedStation = stationParameter(station, path.length, "path station") * path.length;
  const localStation = clampedStation - segment.stationStart;
  const origin = segment.pointAt(localStation);
  const tangent = segment.tangentAt(localStation);
  return { origin, ...chooseFrameAxes(tangent, options.up === undefined ? DEFAULT_UP : options.up), station: clampedStation };
}

export function samplePath(spec, options = {}) {
  options = optionalObject(options, "path sample options");
  const path = normalizedPath(spec);
  const count = optionalSampleCount(options.count, 16, "path sample count");
  return Array.from({ length: count }, (_, index) => {
    const station = path.length * index / (count - 1);
    return { station, point: pointAtStation(path, station), frame: frameAtStation(path, station, options) };
  });
}

export function offsetPath(spec, offset, options = {}) {
  options = optionalObject(options, "path offset options");
  const distance = requiredFiniteNumber(offset, "offset");
  const samples = samplePath(spec, {
    count: optionalSampleCount(options.count, 24, "path offset sample count"),
    up: options.up === undefined ? DEFAULT_UP : options.up
  });
  return {
    id: optionalString(options.id, `${optionalString(spec.id, "path", "path id")}_offset`, "path offset id"),
    type: "polyline",
    points: samples.map(({ frame }) => v.add(frame.origin, v.mul(frame.normal, distance)))
  };
}
