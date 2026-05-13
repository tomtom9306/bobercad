import { v } from "../core/math.mjs";

export function faceNormal(points) {
  if (points.length < 3) return [0, 0, 1];
  return v.norm(v.cross(v.sub(points[1], points[0]), v.sub(points[2], points[0])));
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
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
}

function projectFacePoint(point, dropAxis) {
  if (dropAxis === 0) return { x: point[1], y: point[2] };
  if (dropAxis === 1) return { x: point[0], y: point[2] };
  return { x: point[0], y: point[1] };
}

export function triangulateFace(points) {
  if (points.length < 3) return [];
  if (points.length === 3) return [[points[0], points[1], points[2]]];

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

      if (edge(a, b, c) * orientation <= 0) continue;

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
      for (let i = 1; i < points.length - 1; i += 1) triangles.push([points[0], points[i], points[i + 1]]);
      return triangles;
    }
  }

  triangles.push(indexes.map((index) => points[index]));
  return triangles;
}
