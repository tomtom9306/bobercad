import { v } from "../../../engine/core/math.mjs";

export const EPSILON = 1e-6;

export function platePoint(plate, point) {
  return v.add(
    plate.center,
    v.add(v.mul(plate.localAxisY, point[0]), v.mul(plate.localAxisZ, point[1]))
  );
}

export function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function requiredPoint2(value, label = "sketch point") {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`plate sketch editor: ${label} must be a finite [y, z] point`);
  }
  return value;
}

export function add2(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub2(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

export function mul2(a, scale) {
  return [a[0] * scale, a[1] * scale];
}

export function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

export function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

export function len2(a) {
  return Math.hypot(a[0], a[1]);
}

export function norm2(a) {
  const length = len2(a);
  return length > EPSILON ? [a[0] / length, a[1] / length] : [0, 0];
}

export function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

export function edgeOutwardNormal(a, b, windingSign) {
  const tangent = norm2(sub2(b, a));
  if (len2(tangent) <= EPSILON) return [0, 0];
  return windingSign >= 0 ? [tangent[1], -tangent[0]] : [-tangent[1], tangent[0]];
}

export function edgeById(edges, edgeId) {
  return edges.find((edge) => edge.id === edgeId) || null;
}

export function edgePointPair(edges, vertexMap, edgeId) {
  const edge = edgeById(edges, edgeId);
  const from = edge ? vertexMap.get(edge.from) : null;
  const to = edge ? vertexMap.get(edge.to) : null;
  return from && to ? { edge, from: requiredPoint2(from.point, `${from.id}.point`), to: requiredPoint2(to.point, `${to.id}.point`) } : null;
}
