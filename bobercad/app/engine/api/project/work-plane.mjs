import { linePlaneIntersection, projectPointToPlane as projectPointToPlaneCore, v } from "../../core/math.mjs?v=plane-math-dry-1";

function fallbackGlobalWorkPlane(project) {
  const origin = project.settings?.coordinateSystem?.origin || [0, 0, 0];
  return {
    id: "global-xy",
    label: "Global XY",
    origin: v.isVec3(origin) ? [...origin] : [0, 0, 0],
    normal: [0, 0, 1],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0]
  };
}

export function activeWorkPlane(project, state = {}) {
  const planeId = state.referencePlaneId;
  const plane = project.model?.referencePlanes?.[planeId];
  return plane ? {
    id: plane.id,
    label: plane.name || plane.id,
    origin: v.isVec3(plane.origin) ? [...plane.origin] : [0, 0, 0],
    normal: v.safeNorm(plane.normal, [0, 0, 1]),
    axisX: v.safeNorm(plane.localAxisY || plane.axisX, [1, 0, 0]),
    axisY: v.safeNorm(plane.localAxisZ || plane.axisY, [0, 1, 0])
  } : fallbackGlobalWorkPlane(project);
}

export function projectPointToPlane(point, plane) {
  const normal = v.safeNorm(plane.normal, [0, 0, 1]);
  return projectPointToPlaneCore(point, plane.origin, normal);
}

export function rayPlaneIntersection(ray, plane) {
  if (!ray?.origin || !ray?.direction) return null;
  const normal = v.safeNorm(plane.normal, [0, 0, 1]);
  return linePlaneIntersection(ray.origin, ray.direction, plane.origin, normal);
}

export function pointToPlaneCoordinates(point, plane) {
  const delta = v.sub(point, plane.origin);
  const axisX = v.safeNorm(plane.axisX, [1, 0, 0]);
  const axisY = v.safeNorm(plane.axisY, [0, 1, 0]);
  return [v.dot(delta, axisX), v.dot(delta, axisY)];
}

export function pointFromPlaneCoordinates(coords, plane) {
  return v.add(
    plane.origin,
    v.add(v.mul(v.safeNorm(plane.axisX, [1, 0, 0]), coords[0]), v.mul(v.safeNorm(plane.axisY, [0, 1, 0]), coords[1]))
  );
}
