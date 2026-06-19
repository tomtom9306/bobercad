export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mathError(message) {
  throw new Error(`math: ${message}`);
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) mathError(`${label} must be a finite [x, y, z] vector`);
  return value;
}

function requiredDirection(value, label) {
  const direction = requiredVec3(value, label);
  if (v.len(direction) <= 1e-12) mathError(`${label} cannot be zero length`);
  return direction;
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

export const WORLD_AXIS_IDS = ["x", "y", "z"];
export const WORLD_AXIS_DIRECTIONS = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
export const WORLD_AXIS_ENTRIES = WORLD_AXIS_IDS.map((axis) => [axis, WORLD_AXIS_DIRECTIONS[axis]]);

export function validVec3Points(points) {
  if (!Array.isArray(points)) mathError("vec3 point list must be an array");
  for (const [index, point] of points.entries()) {
    if (!v.isVec3(point)) mathError(`vec3 point ${index} must be a finite [x, y, z] point`);
  }
  return points;
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

function bounds3FromValidPoints(valid) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of valid) {
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], point[index]);
      max[index] = Math.max(max[index], point[index]);
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5];
  return { min, max, size, center, maxSize: Math.max(Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2]), 1) };
}

export function bounds3(points) {
  const valid = validVec3Points(points);
  if (!valid.length) mathError("bounds3 requires at least one point");
  return bounds3FromValidPoints(valid);
}

export function bounds3OrNull(points) {
  const valid = validVec3Points(points);
  return valid.length ? bounds3FromValidPoints(valid) : null;
}

export function bounds2(points) {
  if (!Array.isArray(points)) mathError("bounds2 point list must be an array");
  if (!points.length) mathError("bounds2 requires at least one point");
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const [index, point] of points.entries()) {
    finiteVec2(point, `bounds2 point ${index}`, mathError);
    min[0] = Math.min(min[0], point[0]);
    min[1] = Math.min(min[1], point[1]);
    max[0] = Math.max(max[0], point[0]);
    max[1] = Math.max(max[1], point[1]);
  }
  return { min, max };
}

export function boundsYz(points) {
  if (!Array.isArray(points)) mathError("boundsYz point list must be an array");
  if (!points.length) mathError("boundsYz requires at least one point");
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (const [index, point] of points.entries()) {
    finiteVec2(point, `boundsYz point ${index}`, mathError);
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
    label = "outline point",
    minPoints = 0,
    minMessage = `outline requires at least ${minPoints} distinct points`,
    fail = (message) => { throw new Error(message); }
  } = options;
  if (!Array.isArray(outline)) {
    const message = `${label} list must be an array`;
    fail(message);
    throw new Error(message);
  }
  const clean = [];
  for (const point of outline) {
    const next = finiteVec2(point, label, fail);
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
  if (!axis || typeof axis !== "object" || Array.isArray(axis)) mathError("axis must be an object");
  return requiredVec3(axis.a ?? axis.origin, "axis point");
}

function infiniteAxisDirection(axis) {
  if (axis.direction !== undefined) return requiredDirection(axis.direction, "axis direction");
  return v.norm(requiredDirection(v.sub(requiredVec3(axis.b, "axis b"), requiredVec3(axis.a, "axis a")), "axis direction"));
}

export function closestAxisPoints(left, right, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) mathError("closestAxisPoints options must be an object");
  const epsilon = options.epsilon === undefined ? 1e-9 : options.epsilon;
  if (!finiteNonNegativeNumber(epsilon)) mathError("closestAxisPoints epsilon must be a non-negative number");
  if (options.parallel !== undefined && options.parallel !== "null") mathError("closestAxisPoints parallel must be \"null\"");
  const a0 = infiniteAxisPoint(left);
  const b0 = infiniteAxisPoint(right);
  const ad = infiniteAxisDirection(left);
  const bd = infiniteAxisDirection(right);
  const r = v.sub(a0, b0);
  const dot = v.dot(ad, bd);
  const c = v.dot(ad, r);
  const f = v.dot(bd, r);
  const denominator = 1 - dot * dot;
  if (Math.abs(denominator) <= epsilon && options.parallel === "null") return null;
  const s = Math.abs(denominator) <= epsilon ? 0 : (dot * f - c) / denominator;
  const t = Math.abs(denominator) <= epsilon ? f : (f - dot * c) / denominator;
  const pointA = v.add(a0, v.mul(ad, s));
  const pointB = v.add(b0, v.mul(bd, t));
  return { pointA, pointB, distance: v.len(v.sub(pointA, pointB)) };
}

function segmentAxisDirection(axis) {
  if (!axis || typeof axis !== "object" || Array.isArray(axis)) mathError("segment axis must be an object");
  return requiredDirection(axis.direction ?? axis.x, "segment axis direction");
}

function segmentAxisPoint(axis, station) {
  return v.add(requiredVec3(axis.start, "segment axis start"), v.mul(segmentAxisDirection(axis), station));
}

function projectSegmentAxisStation(axis, point) {
  return v.dot(v.sub(requiredVec3(point, "segment axis point"), requiredVec3(axis.start, "segment axis start")), segmentAxisDirection(axis));
}

export function closestAxisSegmentPoints(axisA, axisB, epsilon = 1e-9) {
  if (!finiteNonNegativeNumber(epsilon)) mathError("closestAxisSegmentPoints epsilon must be a non-negative number");
  if (!finitePositiveNumber(axisA?.length)) mathError("closestAxisSegmentPoints axisA.length must be positive");
  if (!finitePositiveNumber(axisB?.length)) mathError("closestAxisSegmentPoints axisB.length must be positive");
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
  const sourcePoint = requiredVec3(point, "point");
  const origin = requiredVec3(planeOrigin, "plane origin");
  const planeNormal = requiredDirection(normal, "plane normal");
  return v.sub(sourcePoint, v.mul(planeNormal, v.dot(v.sub(sourcePoint, origin), planeNormal)));
}

export function projectedAxis(axis, normal, epsilon = 1e-9) {
  if (!finiteNonNegativeNumber(epsilon)) mathError("projectedAxis epsilon must be a non-negative number");
  const sourceAxis = requiredDirection(axis, "axis");
  const planeNormal = requiredDirection(normal, "plane normal");
  const projected = v.sub(sourceAxis, v.mul(planeNormal, v.dot(sourceAxis, planeNormal)));
  return v.len(projected) > epsilon ? v.norm(projected) : null;
}

export function linePlaneIntersection(point, direction, planeOrigin, normal, epsilon = 1e-9) {
  if (!finiteNonNegativeNumber(epsilon)) mathError("linePlaneIntersection epsilon must be a non-negative number");
  const linePoint = requiredVec3(point, "line point");
  const lineDirection = requiredDirection(direction, "line direction");
  const origin = requiredVec3(planeOrigin, "plane origin");
  const planeNormal = requiredDirection(normal, "plane normal");
  const denominator = v.dot(lineDirection, planeNormal);
  if (Math.abs(denominator) <= epsilon) return null;
  return v.add(linePoint, v.mul(lineDirection, v.dot(v.sub(origin, linePoint), planeNormal) / denominator));
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
