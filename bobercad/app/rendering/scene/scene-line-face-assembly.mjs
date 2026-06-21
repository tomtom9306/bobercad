import { validVec3Points, v } from "../../engine/core/math.mjs";
import { arrayValues, uniqueValues } from "../../engine/core/model.mjs";
import { CSG_EPSILON, ccwPoints, csgCleanPoints, prismPolygons } from "../../engine/geometry/csg.mjs";
import { faceNormal, signedArea2d, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { evaluatedEdgeRef } from "./scene-annotation-metadata.mjs";

export function sectionPoint(origin, frame, point, xOffset = 0) {
  return v.add(origin, v.add(v.mul(frame.x, xOffset), v.add(v.mul(frame.y, point[0]), v.mul(frame.z, point[1]))));
}

export function addLine(scene, a, b, color, meta = {}) {
  scene.lines.push({ points: [a, b], color, ...meta });
}

export function addTextLabel(scene, point, text, meta = {}) {
  if (!text || !validVec3Points([point]).length) return;
  scene.labels.push({ point, text: String(text), ...meta });
}

export function addPolyline(scene, points, color, meta = {}) {
  const cleanPoints = validVec3Points(points);
  if (cleanPoints.length >= 2) scene.lines.push({ points: cleanPoints, color, ...meta });
}

function addInstanceTriangle(geometry, a, b, c) {
  const normal = faceNormal([a, b, c]);
  for (const point of [a, b, c]) {
    geometry.positions.push(point[0], point[1], point[2]);
    geometry.normals.push(normal[0], normal[1], normal[2]);
  }
}

function addInstanceFace(geometry, points) {
  for (const triangle of triangulateFace(points)) addInstanceTriangle(geometry, triangle[0], triangle[1], triangle[2]);
}

function axisAlignedRectangle(points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const ys = uniqueValues(points.map((point) => point[0])).sort((a, b) => a - b);
  const zs = uniqueValues(points.map((point) => point[1])).sort((a, b) => a - b);
  if (ys.length !== 2 || zs.length !== 2) return null;
  const hasCorner = (y, z) => points.some((point) => Math.abs(point[0] - y) <= CSG_EPSILON && Math.abs(point[1] - z) <= CSG_EPSILON);
  if (!ys.every((y) => zs.every((z) => hasCorner(y, z)))) return null;
  return { minY: ys[0], maxY: ys[1], minZ: zs[0], maxZ: zs[1] };
}

function addCapFace2d(geometry, points, x, normalSign) {
  const area = signedArea2d(points);
  const oriented = area * normalSign >= 0 ? points : [...points].reverse();
  addInstanceFace(geometry, oriented.map((point) => [x, point[0], point[1]]));
}

function addContourSides(geometry, contour, reverse = false) {
  const points = reverse ? [...contour].reverse() : contour;
  const start = points.map((point) => [0, point[0], point[1]]);
  const end = points.map((point) => [1, point[0], point[1]]);

  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    addInstanceFace(geometry, [start[index], start[next], end[next], end[index]]);
  }
}

function addSimpleContourPrism(geometry, points) {
  const contour = ccwPoints(points);
  const start = contour.map((point) => [0, point[0], point[1]]);
  const end = contour.map((point) => [1, point[0], point[1]]);

  addInstanceFace(geometry, [...start].reverse());
  addInstanceFace(geometry, end);
  addContourSides(geometry, contour);
}

function addRectangularTubePrism(geometry, solidContour, voidContour) {
  const outer = axisAlignedRectangle(arrayValues(solidContour.points));
  const inner = axisAlignedRectangle(arrayValues(voidContour.points));
  if (!outer || !inner) return false;
  if (inner.minY <= outer.minY || inner.maxY >= outer.maxY || inner.minZ <= outer.minZ || inner.maxZ >= outer.maxZ) return false;

  const capStrips = [
    [[outer.minY, outer.minZ], [outer.maxY, outer.minZ], [inner.maxY, inner.minZ], [inner.minY, inner.minZ]],
    [[outer.maxY, outer.minZ], [outer.maxY, outer.maxZ], [inner.maxY, inner.maxZ], [inner.maxY, inner.minZ]],
    [[outer.maxY, outer.maxZ], [outer.minY, outer.maxZ], [inner.minY, inner.maxZ], [inner.maxY, inner.maxZ]],
    [[outer.minY, outer.maxZ], [outer.minY, outer.minZ], [inner.minY, inner.minZ], [inner.minY, inner.maxZ]]
  ];

  for (const strip of capStrips) {
    addCapFace2d(geometry, strip, 0, -1);
    addCapFace2d(geometry, strip, 1, 1);
  }

  addContourSides(geometry, ccwPoints(arrayValues(solidContour.points)));
  addContourSides(geometry, ccwPoints(arrayValues(voidContour.points)), true);
  return true;
}

function profileInstanceGeometry(profile) {
  const geometry = { positions: [], normals: [] };
  const contours = arrayValues(profile.section?.contours);
  const solidContours = contours.filter((contour) => contour.role === "solid");
  const voidContours = contours.filter((contour) => contour.role === "void");

  if (voidContours.length) {
    if (solidContours.length !== 1 || voidContours.length !== 1) return null;
    if (!addRectangularTubePrism(geometry, solidContours[0], voidContours[0])) return null;
  } else {
    for (const contour of solidContours) {
      const points = ccwPoints(arrayValues(contour.points));
      if (points.length < 3) continue;
      addSimpleContourPrism(geometry, points);
    }
  }

  return geometry.positions.length ? geometry : null;
}

export function instanceGeometryForProfile(scene, profile) {
  if (!scene.memberInstanceGeometries[profile.id]) {
    scene.memberInstanceGeometries[profile.id] = profileInstanceGeometry(profile);
  }
  return scene.memberInstanceGeometries[profile.id];
}

export function addLoopLines(scene, points, color, meta = {}) {
  for (let i = 0; i < points.length; i += 1) addLine(scene, points[i], points[(i + 1) % points.length], color, meta);
}

function meshPointKey(point) {
  return point.map((value) => Math.round(value / 0.001)).join(",");
}

function meshEdgeKey(a, b) {
  const ka = meshPointKey(a);
  const kb = meshPointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

export function addMeshCreaseEdges(scene, polygons, edgeColor, meta = {}) {
  const edges = new Map();
  const creaseDot = Math.cos(15 * Math.PI / 180);

  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length < 3) continue;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const key = meshEdgeKey(a, b);
      const edge = edges.get(key) || { a, b, key, normals: [], surfaces: [] };
      edge.normals.push(polygon.plane.normal);
      if (polygon.shared?.surfaceRef) edge.surfaces.push(polygon.shared.surfaceRef);
      edges.set(key, edge);
    }
  }

  for (const edge of edges.values()) {
    const uniqueNormals = [];
    for (const normal of edge.normals) {
      if (!uniqueNormals.some((existing) => Math.abs(v.dot(existing, normal)) > 1 - 0.0001)) uniqueNormals.push(normal);
    }

    const isCrease = uniqueNormals.some((normal, index) => uniqueNormals.slice(index + 1).some((other) => v.dot(normal, other) < creaseDot));
    if (isCrease) {
      const edgeRef = evaluatedEdgeRef(edge, meta);
      addLine(scene, edge.a, edge.b, edgeColor, edgeRef ? {
        ...meta,
        snapRole: "member-evaluated-edge",
        edgeRef,
        edgeKey: edge.key
      } : meta);
    }
  }
}

export function addCsgFaces(scene, polygons, color, meta = {}) {
  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length >= 3) scene.faces.push({ points, color: polygon.shared?.color || color, hideEdges: true, ...meta });
  }
}

export function addPlateSolid(scene, midPoints, normal, thickness, color, edgeColor, meta = {}) {
  const n = v.norm(normal);
  const hx = thickness / 2;
  const back = midPoints.map((point) => v.add(point, v.mul(n, -hx)));
  const front = midPoints.map((point) => v.add(point, v.mul(n, hx)));

  scene.faces.push({ points: back, color, ...meta });
  scene.faces.push({ points: [...front].reverse(), color, ...meta });
  addLoopLines(scene, back, edgeColor, meta);
  addLoopLines(scene, front, edgeColor, meta);
  for (let i = 0; i < midPoints.length; i += 1) {
    const j = (i + 1) % midPoints.length;
    scene.faces.push({ points: [back[i], back[j], front[j], front[i]], color, ...meta });
    addLine(scene, back[i], front[i], edgeColor, meta);
  }
}

export function addPlateLikeCsgSolid(scene, polygons, color, edgeColor, meta = {}) {
  addCsgFaces(scene, polygons, color, meta);
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

export function circleOutline(radius, segments, angleOffset = 0) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = angleOffset + i / segments * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return points;
}

export function hexOutline(acrossFlats) {
  return circleOutline(acrossFlats / Math.sqrt(3), 6, Math.PI / 6);
}

export function addPrism(scene, center, axis, axisY, axisZ, depth, outline, color, edgeColor, meta = {}) {
  const polygons = prismPolygons(center, axis, axisY, axisZ, depth, outline, { color });
  addCsgFaces(scene, polygons, color, meta);
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

function ringPoints(center, axisY, axisZ, radius, segments) {
  return circleOutline(radius, segments).map((point) => v.add(center, v.add(v.mul(axisY, point[0]), v.mul(axisZ, point[1]))));
}

export function addWasher(scene, center, axis, axisY, axisZ, outerRadius, innerRadius, thickness, color, edgeColor, meta = {}) {
  if (outerRadius <= innerRadius || thickness <= 0) return;
  const segments = scene.settings.render.curves.discSegments;
  const frontCenter = v.add(center, v.mul(axis, thickness / 2));
  const backCenter = v.add(center, v.mul(axis, -thickness / 2));
  const outerFront = ringPoints(frontCenter, axisY, axisZ, outerRadius, segments);
  const innerFront = ringPoints(frontCenter, axisY, axisZ, innerRadius, segments);
  const outerBack = ringPoints(backCenter, axisY, axisZ, outerRadius, segments);
  const innerBack = ringPoints(backCenter, axisY, axisZ, innerRadius, segments);

  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    scene.faces.push({ points: [outerBack[i], outerBack[j], outerFront[j], outerFront[i]], color, ...meta });
    scene.faces.push({ points: [innerBack[j], innerBack[i], innerFront[i], innerFront[j]], color, ...meta });
    scene.faces.push({ points: [outerFront[i], outerFront[j], innerFront[j], innerFront[i]], color, ...meta });
    scene.faces.push({ points: [outerBack[j], outerBack[i], innerBack[i], innerBack[j]], color, ...meta });
  }

  addLoopLines(scene, outerFront, edgeColor, meta);
  addLoopLines(scene, innerFront, edgeColor, meta);
  addLoopLines(scene, outerBack, edgeColor, meta);
  addLoopLines(scene, innerBack, edgeColor, meta);
}
