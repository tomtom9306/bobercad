import { clamp, finiteNumber, finiteVec3, v } from "../../core/math.mjs?v=finite-vec3-dry-1";
import { arrayValues } from "../../core/model.mjs?v=final-array-values-dry-1";

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

function segmentParameter(distance, length) {
  return clamp(distance / length, 0, 1);
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
    id: spec.id || `segment_${index + 1}`,
    type: "line",
    start,
    end,
    length,
    pointAt: (distance) => lerpPoint(start, end, segmentParameter(distance, length)),
    tangentAt: () => v.mul(axis, 1 / length)
  };
}

function polylineSegments(spec) {
  const points = arrayValues(spec.points).map((point, index) => vec3(point, `polyline point ${index}`));
  if (points.length < 2) fail("polyline path requires at least two points");
  return points.slice(0, -1).map((point, index) => lineSegment({
    id: spec.id ? `${spec.id}_${index + 1}` : undefined,
    start: point,
    end: points[index + 1]
  }, index));
}

function arcAxes(spec, index) {
  const center = vec3(spec.center, `segment ${index} center`);
  const axisX = unit(spec.axisX || [1, 0, 0], `segment ${index} axisX`);
  const rawAxisY = vec3(spec.axisY || [0, 1, 0], `segment ${index} axisY`);
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
  const startAngle = requiredFiniteNumber(spec.startAngle || 0, `segment ${index} startAngle`);
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
    id: spec.id || `segment_${index + 1}`,
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
      const t = segmentParameter(distance, length);
      return arcPoint(center, axisX, axisY, radius, startAngle + sweep * t);
    },
    tangentAt: (distance) => {
      const t = segmentParameter(distance, length);
      return arcTangent(axisX, axisY, startAngle + sweep * t, directionSign);
    }
  };
}

function helixSegment(spec, index = 0) {
  const { center, axisX, axisY } = arcAxes(spec, index);
  const axisZ = unit(spec.axisZ || v.cross(axisX, axisY), `segment ${index} axisZ`);
  const { radius, startAngle, endAngle, sweep } = radialSweep(spec, index);
  const height = requiredFiniteNumber(spec.height || 0, `segment ${index} height`);
  if (Math.abs(sweep) <= EPSILON && Math.abs(height) <= EPSILON) fail(`segment ${index} helix cannot have zero length`);
  const length = Math.hypot(Math.abs(sweep) * radius, height);
  const directionSign = Math.sign(sweep || 1);
  return {
    id: spec.id || `segment_${index + 1}`,
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
      const t = segmentParameter(distance, length);
      const angle = startAngle + sweep * t;
      return arcPoint(center, axisX, axisY, radius, angle, v.mul(axisZ, height * t));
    },
    tangentAt: (distance) => {
      const t = segmentParameter(distance, length);
      const angle = startAngle + sweep * t;
      const angular = v.mul(arcTangent(axisX, axisY, angle, directionSign), Math.abs(sweep) * radius);
      return v.norm(v.add(angular, v.mul(axisZ, height)));
    }
  };
}

function normalizeSegments(spec) {
  const sourceSegments = spec.type === "polyline"
    ? polylineSegments(spec)
    : Array.isArray(spec.segments) ? spec.segments.flatMap((segment, index) => normalizeSegment(segment, index))
      : [normalizeSegment(spec, 0)].flat();
  let station = 0;
  return sourceSegments.map((segment) => {
    const next = { ...segment, stationStart: station, stationEnd: station + segment.length };
    station = next.stationEnd;
    return next;
  });
}

function normalizeSegment(spec, index) {
  if (spec.type === "polyline") return polylineSegments(spec);
  if (spec.type === "line") return [lineSegment(spec, index)];
  if (spec.type === "arc") return [arcSegment(spec, index)];
  if (spec.type === "helix" || spec.type === "spiral") return [helixSegment(spec, index)];
  fail(`unsupported path segment type ${spec.type}`);
}

export function normalizePath(spec = {}) {
  const segments = normalizeSegments(spec);
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (length <= EPSILON) fail("path cannot have zero length");
  return {
    id: spec.id || "path",
    type: spec.type || "custom",
    length,
    segments
  };
}

function segmentAtStation(path, station) {
  const normalized = normalizedPath(path);
  const clampedStation = clamp(station, 0, normalized.length);
  return normalized.segments.find((segment) => clampedStation <= segment.stationEnd + EPSILON) || normalized.segments[normalized.segments.length - 1];
}

function normalizedPath(spec) {
  return spec.segments ? spec : normalizePath(spec);
}

export function pathLength(spec) {
  return normalizePath(spec).length;
}

export function pointAtStation(spec, station) {
  const path = normalizedPath(spec);
  const segment = segmentAtStation(path, station);
  return segment.pointAt(clamp(station, segment.stationStart, segment.stationEnd) - segment.stationStart);
}

export function frameAtStation(spec, station, options = {}) {
  const path = normalizedPath(spec);
  const segment = segmentAtStation(path, station);
  const localStation = clamp(station, segment.stationStart, segment.stationEnd) - segment.stationStart;
  const origin = segment.pointAt(localStation);
  const tangent = segment.tangentAt(localStation);
  return { origin, ...chooseFrameAxes(tangent, options.up || DEFAULT_UP), station: clamp(station, 0, path.length) };
}

export function samplePath(spec, options = {}) {
  const path = normalizedPath(spec);
  const count = Math.max(2, Math.floor(options.count || 16));
  return Array.from({ length: count }, (_, index) => {
    const station = path.length * index / (count - 1);
    return { station, point: pointAtStation(path, station), frame: frameAtStation(path, station, options) };
  });
}

export function offsetPath(spec, offset, options = {}) {
  const distance = requiredFiniteNumber(offset, "offset");
  const samples = samplePath(spec, { count: options.count || 24, up: options.up || DEFAULT_UP });
  return {
    id: options.id || `${spec.id || "path"}_offset`,
    type: "polyline",
    points: samples.map(({ frame }) => v.add(frame.origin, v.mul(frame.normal, distance)))
  };
}
