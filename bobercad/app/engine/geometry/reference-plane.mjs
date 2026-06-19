import { finiteNumber, finitePositiveNumber, v } from "../core/math.mjs";

const EXTENT_KEYS = ["xMin", "xMax", "yMin", "yMax"];
const MIN_AXIS_LENGTH = 1e-9;

function failDefault(message) {
  throw new Error(message);
}

function reject(fail, message) {
  fail(message);
  throw new Error(message);
}

function dataObject(value, label, fail) {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject(fail, `${label} must be an object`);
  return value;
}

function validateExtents(extents, label = "reference plane extents", fail = failDefault) {
  if (extents === undefined) return;
  extents = dataObject(extents, label, fail);
  for (const key of Object.keys(extents)) {
    if (!EXTENT_KEYS.includes(key)) reject(fail, `${label}.${key} is not supported`);
  }
  for (const key of EXTENT_KEYS) {
    if (!finiteNumber(extents[key])) reject(fail, `${label}.${key} must be a finite number`);
  }
  const width = extents.xMax - extents.xMin;
  const height = extents.yMax - extents.yMin;
  if (!finitePositiveNumber(width) || !finitePositiveNumber(height)) reject(fail, `${label} must define positive width and height`);
  return [width, height];
}

function validatePlaneVector(plane, key, label, fail) {
  if (!v.isVec3(plane[key])) reject(fail, `${label} must define origin, normal, axisX and axisY`);
  if (key !== "origin" && v.len(plane[key]) <= MIN_AXIS_LENGTH) reject(fail, `${label}.${key} cannot be zero length`);
}

export function requiredReferencePlane(project, referencePlaneId, label = "reference plane", fail = failDefault) {
  if (typeof fail !== "function") throw new Error(`${label} fail callback must be a function`);
  if (typeof referencePlaneId !== "string" || !referencePlaneId) reject(fail, `${label} missing referencePlaneId`);
  const model = dataObject(dataObject(project, "project", fail).model, "project.model", fail);
  const referencePlanes = model.referencePlanes;
  dataObject(referencePlanes, "project.model.referencePlanes", fail);
  const plane = referencePlanes[referencePlaneId];
  if (!plane) reject(fail, `${label}: reference plane not found: ${referencePlaneId}`);
  dataObject(plane, `${label}: reference plane ${referencePlaneId}`, fail);
  if (plane.size !== undefined) reject(fail, `${label}: reference plane ${referencePlaneId}.size is not supported; use extents`);
  const extentsSize = validateExtents(plane.extents, `${label}: reference plane ${referencePlaneId}.extents`, fail);
  for (const key of ["origin", "normal", "axisX", "axisY"]) validatePlaneVector(plane, key, `${label}: reference plane ${referencePlaneId}`, fail);
  return {
    ...plane,
    ...(extentsSize ? { size: extentsSize } : {})
  };
}
