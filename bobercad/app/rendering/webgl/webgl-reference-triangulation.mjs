import { v } from "../../engine/core/math.mjs";
import { triangulateFace } from "../../engine/geometry/polygon.mjs";

function triangleNormalLength(a, b, c) {
  if (!v.isVec3(a) || !v.isVec3(b) || !v.isVec3(c)) return 0;
  return v.len(v.cross(v.sub(b, a), v.sub(c, a)));
}

function fanTriangulate(points) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const triangles = [];
  for (let index = 1; index + 1 < points.length; index += 1) {
    const triangle = [points[0], points[index], points[index + 1]];
    if (triangleNormalLength(...triangle) > 1e-9) triangles.push(triangle);
  }
  return triangles;
}

export function triangulateSceneFace(face) {
  try {
    return triangulateFace(face?.points);
  } catch (error) {
    if (face?.collection !== "referenceGeometry") throw error;
    return fanTriangulate(face.points);
  }
}
