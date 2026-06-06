import { v } from "../../core/math.mjs";

const EPSILON = 1e-9;
const DEFAULT_UP = [0, 0, 1];

function fail(message) {
  throw new Error(`path api: ${message}`);
}

function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${label} must be a finite number`);
  return value;
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x,y,z] point`);
  }
  return [...value];
}

function unit(value, label) {
  const vector = vec3(value, label);
  const length = v.len(vector);
  if (length <= EPSILON) fail(`${label} cannot be zero length`);
  return v.mul(vector, 1 / length);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
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
    pointAt: (distance) => lerpPoint(start, end, clamp(distance / length, 0, 1)),
    tangentAt: () => v.mul(axis, 1 / length)
  };
}

function polylineSegments(spec) {
  const points = (spec.points || []).map((point, index) => vec3(point, `polyline point ${index}`));
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

function arcSegment(spec, index = 0) {
  const { center, axisX, axisY } = arcAxes(spec, index);
  const radius = finiteNumber(spec.radius, `segment ${index} radius`);
  if (radius <= EPSILON) fail(`segment ${index} radius must be positive`);
  const startAngle = finiteNumber(spec.startAngle || 0, `segment ${index} startAngle`);
  const endAngle = finiteNumber(spec.endAngle, `segment ${index} endAngle`);
  const sweep = endAngle - startAngle;
  if (Math.abs(sweep) <= EPSILON) fail(`segment ${index} arc sweep cannot be zero`);
  const length = Math.abs(sweep) * radius;
  const directionSign = Math.sign(sweep);
  return {
    id: spec.id || `segment_${index + 1}`,
    type: "arc",
    center,
    radius,
    startAngle,
    endAngle,
    length,
    pointAt: (distance) => {
      const t = clamp(distance / length, 0, 1);
      return arcPoint(center, axisX, axisY, radius, startAngle + sweep * t);
    },
    tangentAt: (distance) => {
      const t = clamp(distance / length, 0, 1);
      return arcTangent(axisX, axisY, startAngle + sweep * t, directionSign);
    }
  };
}

function helixSegment(spec, index = 0) {
  const { center, axisX, axisY } = arcAxes(spec, index);
  const axisZ = unit(spec.axisZ || v.cross(axisX, axisY), `segment ${index} axisZ`);
  const radius = finiteNumber(spec.radius, `segment ${index} radius`);
  if (radius <= EPSILON) fail(`segment ${index} radius must be positive`);
  const startAngle = finiteNumber(spec.startAngle || 0, `segment ${index} startAngle`);
  const endAngle = finiteNumber(spec.endAngle, `segment ${index} endAngle`);
  const height = finiteNumber(spec.height || 0, `segment ${index} height`);
  const sweep = endAngle - startAngle;
  if (Math.abs(sweep) <= EPSILON && Math.abs(height) <= EPSILON) fail(`segment ${index} helix cannot have zero length`);
  const length = Math.hypot(Math.abs(sweep) * radius, height);
  const directionSign = Math.sign(sweep || 1);
  return {
    id: spec.id || `segment_${index + 1}`,
    type: spec.type === "spiral" ? "spiral" : "helix",
    center,
    radius,
    startAngle,
    endAngle,
    height,
    length,
    pointAt: (distance) => {
      const t = clamp(distance / length, 0, 1);
      const angle = startAngle + sweep * t;
      return arcPoint(center, axisX, axisY, radius, angle, v.mul(axisZ, height * t));
    },
    tangentAt: (distance) => {
      const t = clamp(distance / length, 0, 1);
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
  const normalized = path.segments ? path : normalizePath(path);
  const clampedStation = clamp(station, 0, normalized.length);
  return normalized.segments.find((segment) => clampedStation <= segment.stationEnd + EPSILON) || normalized.segments[normalized.segments.length - 1];
}

export function pathLength(spec) {
  return normalizePath(spec).length;
}

export function pointAtStation(spec, station) {
  const path = spec.segments ? spec : normalizePath(spec);
  const segment = segmentAtStation(path, station);
  return segment.pointAt(clamp(station, segment.stationStart, segment.stationEnd) - segment.stationStart);
}

export function tangentAtStation(spec, station) {
  const path = spec.segments ? spec : normalizePath(spec);
  const segment = segmentAtStation(path, station);
  return segment.tangentAt(clamp(station, segment.stationStart, segment.stationEnd) - segment.stationStart);
}

export function frameAtStation(spec, station, options = {}) {
  const origin = pointAtStation(spec, station);
  const tangent = tangentAtStation(spec, station);
  return { origin, ...chooseFrameAxes(tangent, options.up || DEFAULT_UP), station: clamp(station, 0, (spec.segments ? spec : normalizePath(spec)).length) };
}

export function samplePath(spec, options = {}) {
  const path = spec.segments ? spec : normalizePath(spec);
  const count = Math.max(2, Math.floor(options.count || 16));
  return Array.from({ length: count }, (_, index) => {
    const station = path.length * index / (count - 1);
    return { station, point: pointAtStation(path, station), frame: frameAtStation(path, station, options) };
  });
}

export function offsetPath(spec, offset, options = {}) {
  const distance = finiteNumber(offset, "offset");
  const samples = samplePath(spec, { count: options.count || 24, up: options.up || DEFAULT_UP });
  return {
    id: options.id || `${spec.id || "path"}_offset`,
    type: "polyline",
    points: samples.map(({ frame }) => v.add(frame.origin, v.mul(frame.normal, distance)))
  };
}
