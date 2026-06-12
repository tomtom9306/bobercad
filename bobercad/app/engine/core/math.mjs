export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function finiteInteger(value) {
  return Number.isInteger(value);
}

export function finitePositiveNumber(value) {
  return finiteNumber(value) && value > 0;
}

export function finiteNonNegativeNumber(value) {
  return finiteNumber(value) && value >= 0;
}

export function finitePositiveInteger(value) {
  return finiteInteger(value) && value > 0;
}

export function finiteNonNegativeInteger(value) {
  return finiteInteger(value) && value >= 0;
}

export function finiteNumberOr(value, fallback) {
  return finiteNumber(value) ? value : fallback;
}

export function finitePositiveNumberOr(value, fallback) {
  return finitePositiveNumber(value) ? value : fallback;
}

export function finiteNonNegativeNumberOr(value, fallback) {
  return finiteNonNegativeNumber(value) ? value : fallback;
}

export const WORLD_AXIS_IDS = ["x", "y", "z"];
export const WORLD_AXIS_DIRECTIONS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
export const WORLD_AXIS_ENTRIES = WORLD_AXIS_IDS.map((axis) => [axis, WORLD_AXIS_DIRECTIONS[axis]]);

export function validVec3Points(points) {
  return (points || []).filter(v.isVec3);
}

export function uniqueVec3Points(points, tolerance = 1e-6) {
  const result = [];
  for (const point of validVec3Points(points)) {
    if (!result.some((existing) => sameVec3(existing, point, tolerance))) result.push(point);
  }
  return result;
}

export function averageVec3(points, fallback = null) {
  const valid = validVec3Points(points);
  return valid.length
    ? v.mul(valid.reduce((sum, point) => v.add(sum, point), [0, 0, 0]), 1 / valid.length)
    : fallback;
}

export function bounds3(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5];
  return { min, max, size, center, maxSize: Math.max(Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2]), 1) };
}

export function bounds3OrNull(points) {
  const valid = validVec3Points(points);
  return valid.length ? bounds3(valid) : null;
}

export function bounds2(points) {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const point of points) {
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
  }
  return { min, max };
}

export function boundsYz(points) {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const point of points) {
    min[0] = Math.min(min[0], point[0]);
    max[0] = Math.max(max[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[1] = Math.max(max[1], point[1]);
  }
  return { minY: min[0], maxY: max[0], minZ: min[1], maxZ: max[1] };
}

export function bounds3Corners(bounds) {
  const { min, max } = bounds;
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]]
  ];
}

function finiteVec2(value, label = "point", fail = (message) => { throw new Error(message); }) {
  const message = `${label} must be a finite [y, z] point`;
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(message);
    throw new Error(message);
  }
  return [...value];
}

export function finiteVec3(value, label = "point", fail = (message) => { throw new Error(message); }) {
  const message = `${label} must be a finite [x, y, z] point`;
  if (!v.isVec3(value)) {
    fail(message);
    throw new Error(message);
  }
  return [...value];
}

export function cleanVec2Loop(outline, options = {}) {
  const {
    tolerance = 1e-9,
    strict = false,
    label = "outline point",
    minPoints = 0,
    minMessage = `outline requires at least ${minPoints} distinct points`,
    fail = (message) => { throw new Error(message); }
  } = options;
  const clean = [];
  for (const point of outline || []) {
    const next = strict
      ? finiteVec2(point, label, fail)
      : Array.isArray(point) && point.length === 2 && point.every(finiteNumber) ? [...point] : null;
    if (!next) continue;
    const previous = clean[clean.length - 1];
    if (!previous || distance2(previous, next) > tolerance) clean.push(next);
  }
  if (clean.length > 1) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (distance2(first, last) <= tolerance) clean.pop();
  }
  if (clean.length < minPoints) {
    fail(minMessage);
    throw new Error(minMessage);
  }
  return clean;
}

export function sameVec3(left, right, tolerance = 1e-6) {
  return v.isVec3(left) && v.isVec3(right) && v.len(v.sub(left, right)) <= tolerance;
}

export function distance3(a, b) {
  return v.len(v.sub(b, a));
}

export function distance2(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function screenDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closestPointOnSegment2(a, b, point) {
  const axis = [b[0] - a[0], b[1] - a[1]];
  const lengthSq = axis[0] * axis[0] + axis[1] * axis[1];
  if (lengthSq <= 1e-12) return { point: [...a], t: 0 };
  const t = clamp(((point[0] - a[0]) * axis[0] + (point[1] - a[1]) * axis[1]) / lengthSq, 0, 1);
  return { point: [a[0] + axis[0] * t, a[1] + axis[1] * t], t };
}

export function distancePointToSegment2(point, a, b) {
  return distance2(point, closestPointOnSegment2(a, b, point).point);
}

export function closestPointOnSegment(a, b, point) {
  const axis = v.sub(b, a);
  const lengthSq = v.dot(axis, axis);
  if (lengthSq <= 1e-12) return { point: [...a], t: 0 };
  const t = clamp(v.dot(v.sub(point, a), axis) / lengthSq, 0, 1);
  return { point: v.add(a, v.mul(axis, t)), t };
}

export function distancePointToSegment(point, a, b) {
  return v.len(v.sub(point, closestPointOnSegment(a, b, point).point));
}

function infiniteAxisPoint(axis) {
  return axis.a || axis.origin;
}

function infiniteAxisDirection(axis) {
  return axis.direction || v.norm(v.sub(axis.b, axis.a));
}

export function closestAxisPoints(left, right, options = {}) {
  const config = typeof options === "number" ? { epsilon: options } : (options || {});
  const epsilon = finiteNumberOr(config.epsilon, 1e-9);
  const a0 = infiniteAxisPoint(left);
  const b0 = infiniteAxisPoint(right);
  const ad = infiniteAxisDirection(left);
  const bd = infiniteAxisDirection(right);
  const r = v.sub(a0, b0);
  const dot = v.dot(ad, bd);
  const c = v.dot(ad, r);
  const f = v.dot(bd, r);
  const denominator = 1 - dot * dot;
  if (Math.abs(denominator) <= epsilon && config.parallel === "null") return null;
  const s = Math.abs(denominator) <= epsilon ? 0 : (dot * f - c) / denominator;
  const t = Math.abs(denominator) <= epsilon ? f : (f - dot * c) / denominator;
  const pointA = v.add(a0, v.mul(ad, s));
  const pointB = v.add(b0, v.mul(bd, t));
  return { pointA, pointB, distance: v.len(v.sub(pointA, pointB)) };
}

function segmentAxisDirection(axis) {
  return axis.direction || axis.x;
}

function segmentAxisPoint(axis, station) {
  return v.add(axis.start, v.mul(segmentAxisDirection(axis), station));
}

function projectSegmentAxisStation(axis, point) {
  return v.dot(v.sub(point, axis.start), segmentAxisDirection(axis));
}

export function closestAxisSegmentPoints(axisA, axisB, epsilon = 1e-9) {
  const candidates = [];
  const addCandidate = (stationA, stationB) => {
    const a = segmentAxisPoint(axisA, clamp(stationA, 0, axisA.length));
    const b = segmentAxisPoint(axisB, clamp(stationB, 0, axisB.length));
    candidates.push({ a, b, pointA: a, pointB: b, distance: v.len(v.sub(a, b)) });
  };

  const delta = v.sub(axisA.start, axisB.start);
  const axisDot = v.dot(segmentAxisDirection(axisA), segmentAxisDirection(axisB));
  const aDelta = v.dot(segmentAxisDirection(axisA), delta);
  const bDelta = v.dot(segmentAxisDirection(axisB), delta);
  const denominator = 1 - axisDot * axisDot;
  if (Math.abs(denominator) > epsilon) {
    const stationA = (axisDot * bDelta - aDelta) / denominator;
    addCandidate(stationA, bDelta + axisDot * stationA);
  }

  addCandidate(0, projectSegmentAxisStation(axisB, axisA.start));
  addCandidate(axisA.length, projectSegmentAxisStation(axisB, segmentAxisPoint(axisA, axisA.length)));
  addCandidate(projectSegmentAxisStation(axisA, axisB.start), 0);
  addCandidate(projectSegmentAxisStation(axisA, segmentAxisPoint(axisB, axisB.length)), axisB.length);
  return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
}

export function projectPointToPlane(point, planeOrigin, normal) {
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, planeOrigin), normal)));
}

export function projectedAxis(axis, normal, epsilon = 1e-9) {
  if (!v.isVec3(axis) || !v.isVec3(normal)) return null;
  const projected = v.sub(axis, v.mul(normal, v.dot(axis, normal)));
  return v.len(projected) > epsilon ? v.norm(projected) : null;
}

export function linePlaneIntersection(point, direction, planeOrigin, normal, epsilon = 1e-9) {
  const denominator = v.dot(direction, normal);
  if (Math.abs(denominator) <= epsilon) return null;
  return v.add(point, v.mul(direction, v.dot(v.sub(planeOrigin, point), normal) / denominator));
}

export const v = {
  isVec3: (a) => Array.isArray(a) && a.length === 3 && a.every(finiteNumber),
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) {
    const length = v.len(a);
    return length ? v.mul(a, 1 / length) : [0, 0, 0];
  },
  safeNorm(a, fallback = [0, 0, 0]) {
    if (!v.isVec3(a)) return [...fallback];
    const length = v.len(a);
    return length > 1e-9 ? v.mul(a, 1 / length) : [...fallback];
  }
};
