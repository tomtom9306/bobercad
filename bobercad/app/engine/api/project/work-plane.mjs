import { v } from "../../core/math.mjs";

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function normalized(vector, fallback) {
  const length = finitePoint(vector) ? v.len(vector) : 0;
  return length > 1e-9 ? v.mul(vector, 1 / length) : [...fallback];
}

export function globalWorkPlane(project) {
  const origin = project.settings?.coordinateSystem?.origin || [0, 0, 0];
  return {
    id: "global-xy",
    label: "Global XY",
    origin: finitePoint(origin) ? [...origin] : [0, 0, 0],
    normal: [0, 0, 1],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0]
  };
}

export function referencePlaneWorkPlane(project, planeId) {
  const plane = project.model?.referencePlanes?.[planeId];
  if (!plane) return null;
  return {
    id: plane.id,
    label: plane.name || plane.id,
    origin: finitePoint(plane.origin) ? [...plane.origin] : [0, 0, 0],
    normal: normalized(plane.normal, [0, 0, 1]),
    axisX: normalized(plane.localAxisY || plane.axisX, [1, 0, 0]),
    axisY: normalized(plane.localAxisZ || plane.axisY, [0, 1, 0])
  };
}

export function activeWorkPlane(project, state = {}) {
  return referencePlaneWorkPlane(project, state.referencePlaneId) || globalWorkPlane(project);
}

export function projectPointToPlane(point, plane) {
  const normal = normalized(plane.normal, [0, 0, 1]);
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, plane.origin), normal)));
}

export function rayPlaneIntersection(ray, plane) {
  if (!ray?.origin || !ray?.direction) return null;
  const normal = normalized(plane.normal, [0, 0, 1]);
  const denominator = v.dot(normal, ray.direction);
  if (Math.abs(denominator) <= 1e-9) return null;
  const t = v.dot(normal, v.sub(plane.origin, ray.origin)) / denominator;
  return v.add(ray.origin, v.mul(ray.direction, t));
}

export function dominantPlaneAxis(plane, direction) {
  const x = normalized(plane.axisX, [1, 0, 0]);
  const y = normalized(plane.axisY, [0, 1, 0]);
  return Math.abs(v.dot(direction, x)) >= Math.abs(v.dot(direction, y)) ? x : y;
}
