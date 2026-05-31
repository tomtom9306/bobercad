function failDefault(message) {
  throw new Error(message);
}

function finiteVec3(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function sizeFromExtents(extents) {
  if (!extents || typeof extents !== "object") return null;
  const width = extents.xMax - extents.xMin;
  const height = extents.yMax - extents.yMin;
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? [width, height] : null;
}

export function planeExtentsFromSize(size) {
  if (!Array.isArray(size) || size.length !== 2 || size.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
    return undefined;
  }
  return {
    xMin: -size[0] / 2,
    xMax: size[0] / 2,
    yMin: -size[1] / 2,
    yMax: size[1] / 2
  };
}

export function normalizeReferencePlane(plane) {
  if (!plane || typeof plane !== "object") return null;
  return {
    ...plane,
    ...(Array.isArray(plane.size) ? { size: [...plane.size] } : {}),
    ...(Array.isArray(plane.size) ? {} : sizeFromExtents(plane.extents) ? { size: sizeFromExtents(plane.extents) } : {})
  };
}

export function requiredReferencePlane(project, referencePlaneId, label = "reference plane", fail = failDefault) {
  if (!referencePlaneId) fail(`${label} missing referencePlaneId`);
  const plane = project?.model?.referencePlanes?.[referencePlaneId];
  if (!plane) fail(`${label}: reference plane not found: ${referencePlaneId}`);
  const normalized = normalizeReferencePlane(plane);
  if (!finiteVec3(normalized?.origin) || !finiteVec3(normalized?.normal) || !finiteVec3(normalized?.axisX) || !finiteVec3(normalized?.axisY)) {
    fail(`${label}: reference plane ${referencePlaneId} must define origin, normal, axisX and axisY`);
  }
  return normalized;
}
