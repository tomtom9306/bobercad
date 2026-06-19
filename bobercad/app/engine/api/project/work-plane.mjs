import { linePlaneIntersection, projectPointToPlane as projectPointToPlaneCore, v } from "../../core/math.mjs";

const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`work plane api: ${message}`);
}

function fallbackGlobalWorkPlane(project) {
  const origin = project.settings?.coordinateSystem?.origin;
  if (origin !== undefined && !v.isVec3(origin)) fail("settings.coordinateSystem.origin must be a finite [x, y, z] point");
  return {
    id: "global-xy",
    label: "Global XY",
    origin: origin ? [...origin] : [0, 0, 0],
    normal: [0, 0, 1],
    axisX: [1, 0, 0],
    axisY: [0, 1, 0]
  };
}

function requiredPoint(value, label) {
  if (!v.isVec3(value)) fail(`${label} must be a finite [x, y, z] point`);
  return [...value];
}

function requiredPlaneCoordinates(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x, y] point`);
  }
  return value;
}

function optionalState(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("work plane state must be an object");
  return value;
}

function requiredDirection(value, label) {
  const vector = requiredPoint(value, label);
  const length = v.len(vector);
  if (length <= EPSILON) fail(`${label} cannot be zero length`);
  return v.mul(vector, 1 / length);
}

export function activeWorkPlane(project, state = {}) {
  state = optionalState(state);
  const planeId = state.referencePlaneId;
  if (!planeId) return fallbackGlobalWorkPlane(project);
  if (typeof planeId !== "string" || !planeId.trim()) fail("work plane referencePlaneId must be a non-empty string");
  if (!project?.model || typeof project.model !== "object") fail("project.model is required");
  if (!project.model.referencePlanes || typeof project.model.referencePlanes !== "object" || Array.isArray(project.model.referencePlanes)) {
    fail("project.model.referencePlanes must be an object");
  }
  const plane = project.model.referencePlanes[planeId];
  if (!plane) fail(`reference plane not found: ${planeId}`);
  return {
    id: plane.id,
    label: plane.name || plane.id,
    origin: requiredPoint(plane.origin, `${planeId}.origin`),
    normal: requiredDirection(plane.normal, `${planeId}.normal`),
    axisX: requiredDirection(plane.axisX, `${planeId}.axisX`),
    axisY: requiredDirection(plane.axisY, `${planeId}.axisY`)
  };
}

export function projectPointToPlane(point, plane) {
  const origin = requiredPoint(plane.origin, `${plane.id || "work plane"}.origin`);
  const normal = requiredDirection(plane.normal, `${plane.id || "work plane"}.normal`);
  return projectPointToPlaneCore(requiredPoint(point, "point"), origin, normal);
}

export function rayPlaneIntersection(ray, plane) {
  if (!ray?.origin || !ray?.direction) return null;
  const origin = requiredPoint(plane.origin, `${plane.id || "work plane"}.origin`);
  const normal = requiredDirection(plane.normal, `${plane.id || "work plane"}.normal`);
  return linePlaneIntersection(requiredPoint(ray.origin, "ray.origin"), requiredDirection(ray.direction, "ray.direction"), origin, normal);
}

export function pointToPlaneCoordinates(point, plane) {
  const delta = v.sub(requiredPoint(point, "point"), requiredPoint(plane.origin, `${plane.id || "work plane"}.origin`));
  const axisX = requiredDirection(plane.axisX, `${plane.id || "work plane"}.axisX`);
  const axisY = requiredDirection(plane.axisY, `${plane.id || "work plane"}.axisY`);
  return [v.dot(delta, axisX), v.dot(delta, axisY)];
}

export function pointFromPlaneCoordinates(coords, plane) {
  const local = requiredPlaneCoordinates(coords, "plane coordinates");
  const origin = requiredPoint(plane.origin, `${plane.id || "work plane"}.origin`);
  return v.add(
    origin,
    v.add(
      v.mul(requiredDirection(plane.axisX, `${plane.id || "work plane"}.axisX`), local[0]),
      v.mul(requiredDirection(plane.axisY, `${plane.id || "work plane"}.axisY`), local[1])
    )
  );
}
