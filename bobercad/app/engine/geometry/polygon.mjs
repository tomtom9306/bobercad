import { v } from "../core/math.mjs";

const EPSILON = 1e-9;

function polygonError(message) {
  throw new Error(`polygon: ${message}`);
}

export function faceNormal(points) {
  if (!Array.isArray(points) || points.length < 3) polygonError("face requires at least three points");
  for (const [index, point] of points.entries()) {
    if (!v.isVec3(point)) polygonError(`face point ${index} must be a finite [x, y, z] point`);
  }
  let normal = [0, 0, 0];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    normal = v.add(normal, [
      (current[1] - next[1]) * (current[2] + next[2]),
      (current[2] - next[2]) * (current[0] + next[0]),
      (current[0] - next[0]) * (current[1] + next[1])
    ]);
  }
  if (v.len(normal) > EPSILON) return v.norm(normal);
  for (let index = 1; index + 1 < points.length; index += 1) {
    const candidate = v.cross(v.sub(points[index], points[0]), v.sub(points[index + 1], points[0]));
    if (v.len(candidate) > EPSILON) return v.norm(candidate);
  }
  polygonError("face points are degenerate");
}

export function signedArea2d(points) {
  if (!Array.isArray(points)) polygonError("2d polygon points must be an array");
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (!Array.isArray(a) || a.length !== 2 || typeof a[0] !== "number" || !Number.isFinite(a[0]) || typeof a[1] !== "number" || !Number.isFinite(a[1])) {
      polygonError(`2d polygon point ${index} must be a finite [x, y] point`);
    }
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function edge(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function screenArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInTriangle(p, a, b, c) {
  const d1 = edge(a, b, p);
  const d2 = edge(b, c, p);
  const d3 = edge(c, a, p);
  return (d1 > EPSILON && d2 > EPSILON && d3 > EPSILON)
    || (d1 < -EPSILON && d2 < -EPSILON && d3 < -EPSILON);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const x = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

function triangleCentroid(a, b, c) {
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3
  };
}

function triangleNormalLength(a, b, c) {
  return v.len(v.cross(v.sub(b, a), v.sub(c, a)));
}

function projectFacePoint(point, dropAxis) {
  if (dropAxis === 0) return { x: point[1], y: point[2] };
  if (dropAxis === 1) return { x: point[0], y: point[2] };
  return { x: point[0], y: point[1] };
}

export function triangulateFace(points) {
  if (!Array.isArray(points) || points.length < 3) polygonError("face requires at least three points");
  if (points.length === 3) {
    if (triangleNormalLength(points[0], points[1], points[2]) <= EPSILON) polygonError("face points are degenerate");
    return [[points[0], points[1], points[2]]];
  }

  const normal = faceNormal(points);
  const absNormal = normal.map(Math.abs);
  const dropAxis = absNormal[0] > absNormal[1] && absNormal[0] > absNormal[2] ? 0 : absNormal[1] > absNormal[2] ? 1 : 2;
  const flatPoints = points.map((point) => projectFacePoint(point, dropAxis));
  const triangles = [];
  const indexes = flatPoints.map((_, index) => index);
  const orientation = screenArea(flatPoints) >= 0 ? 1 : -1;

  while (indexes.length > 3) {
    let earFound = false;
    for (let i = 0; i < indexes.length; i += 1) {
      const ia = indexes[(i - 1 + indexes.length) % indexes.length];
      const ib = indexes[i];
      const ic = indexes[(i + 1) % indexes.length];
      const a = flatPoints[ia];
      const b = flatPoints[ib];
      const c = flatPoints[ic];
      const turn = edge(a, b, c) * orientation;

      if (Math.abs(turn) <= EPSILON) {
        indexes.splice(i, 1);
        earFound = true;
        break;
      }
      if (turn < 0) continue;
      if (!pointInPolygon(triangleCentroid(a, b, c), flatPoints)) continue;

      let containsPoint = false;
      for (const index of indexes) {
        if (index === ia || index === ib || index === ic) continue;
        if (pointInTriangle(flatPoints[index], a, b, c)) {
          containsPoint = true;
          break;
        }
      }

      if (containsPoint) continue;

      triangles.push([points[ia], points[ib], points[ic]]);
      indexes.splice(i, 1);
      earFound = true;
      break;
    }

    if (!earFound) {
      polygonError("failed to triangulate face");
    }
  }

  const finalTriangle = indexes.map((index) => points[index]);
  if (triangleNormalLength(finalTriangle[0], finalTriangle[1], finalTriangle[2]) > EPSILON) triangles.push(finalTriangle);
  if (!triangles.length) polygonError("failed to triangulate face");
  return triangles;
}
