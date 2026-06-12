import { finitePositiveNumber, v } from "../core/math.mjs?v=positive-number-dry-1";

function failDefault(message) {
  throw new Error(message);
}

function sizeFromExtents(extents) {
  if (!extents || typeof extents !== "object") return null;
  const width = extents.xMax - extents.xMin;
  const height = extents.yMax - extents.yMin;
  return finitePositiveNumber(width) && finitePositiveNumber(height) ? [width, height] : null;
}

export function planeExtentsFromSize(size) {
  if (!Array.isArray(size) || size.length !== 2 || size.some((value) => !finitePositiveNumber(value))) {
    return undefined;
  }
  return {
    xMin: -size[0] / 2,
    xMax: size[0] / 2,
    yMin: -size[1] / 2,
    yMax: size[1] / 2
  };
}

export function requiredReferencePlane(project, referencePlaneId, label = "reference plane", fail = failDefault) {
  if (!referencePlaneId) fail(`${label} missing referencePlaneId`);
  const plane = project?.model?.referencePlanes?.[referencePlaneId];
  if (!plane) fail(`${label}: reference plane not found: ${referencePlaneId}`);
  const extentsSize = sizeFromExtents(plane.extents);
  const normalized = {
    ...plane,
    ...(Array.isArray(plane.size) ? { size: [...plane.size] } : extentsSize ? { size: extentsSize } : {})
  };
  if (!v.isVec3(normalized?.origin) || !v.isVec3(normalized?.normal) || !v.isVec3(normalized?.axisX) || !v.isVec3(normalized?.axisY)) {
    fail(`${label}: reference plane ${referencePlaneId} must define origin, normal, axisX and axisY`);
  }
  return normalized;
}
