import {
  isNormalizedReferenceGeometry,
  normalizeReferenceGeometry,
  normalizedReferenceGeometryCounts
} from "../../engine/reference-geometry/reference-geometry.mjs";
import { arrayValues } from "../../engine/core/model.mjs";

const DEFAULT_LINE_COLOR = "#94a3b8";
const DEFAULT_MESH_COLOR = "#60a5fa";
const DEFAULT_POINT_COLOR = "#f59e0b";

function layerColor(referenceGeometry, item, fallback) {
  return item.color || referenceGeometry.layers?.[item.layer]?.color || fallback;
}

function opacity(referenceGeometry, item, fallback) {
  const value = Number.isFinite(item.opacity) ? item.opacity : referenceGeometry.layers?.[item.layer]?.opacity;
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function addLine(scene, a, b, color, item = {}, referenceGeometry = {}) {
  scene.lines.push({
    points: [a, b],
    color,
    opacity: opacity(referenceGeometry, item, 0.86),
    depthTest: false,
    pickable: false,
    referenceGeometry: true
  });
}

function addPolyline(scene, polyline, referenceGeometry) {
  const color = layerColor(referenceGeometry, polyline, DEFAULT_LINE_COLOR);
  for (let index = 1; index < polyline.points.length; index += 1) {
    addLine(scene, polyline.points[index - 1], polyline.points[index], color, polyline, referenceGeometry);
  }
  if (polyline.closed && polyline.points.length > 2) {
    addLine(scene, polyline.points[polyline.points.length - 1], polyline.points[0], color, polyline, referenceGeometry);
  }
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function addMesh(scene, mesh, referenceGeometry) {
  const color = layerColor(referenceGeometry, mesh, DEFAULT_MESH_COLOR);
  const edges = new Set();
  for (const face of mesh.faces) {
    const points = face.map((index) => mesh.vertices[index]).filter(Boolean);
    if (points.length >= 3) {
      scene.faces.push({
        points,
        color,
        opacity: opacity(referenceGeometry, mesh, 0.16),
        hideEdges: true,
        pickable: false,
        referenceGeometry: true
      });
    }
    for (let index = 0; index < face.length; index += 1) {
      const a = face[index];
      const b = face[(index + 1) % face.length];
      const key = edgeKey(a, b);
      if (edges.has(key)) continue;
      edges.add(key);
      addLine(scene, mesh.vertices[a], mesh.vertices[b], color, mesh, referenceGeometry);
    }
  }
}

function addPointCloud(scene, cloud, referenceGeometry) {
  const color = layerColor(referenceGeometry, cloud, DEFAULT_POINT_COLOR);
  const pointSize = Number.isFinite(cloud.pointSize) ? Math.max(1, cloud.pointSize) : 3;
  scene.pointClouds = scene.pointClouds || [];
  scene.pointClouds.push({
    points: cloud.points,
    color,
    pointSize,
    opacity: opacity(referenceGeometry, cloud, 0.9),
    depthTest: false,
    pickable: false,
    referenceGeometry: true
  });
}

function normalizedReferenceGeometryForScene(input) {
  if (isNormalizedReferenceGeometry(input)) return input;
  return normalizeReferenceGeometry(input);
}

export function addReferenceGeometry(scene, input = null) {
  if (!input) return null;
  const referenceGeometry = normalizedReferenceGeometryForScene(input);
  for (const line of referenceGeometry.lines) addLine(scene, line.points[0], line.points[1], layerColor(referenceGeometry, line, DEFAULT_LINE_COLOR), line, referenceGeometry);
  for (const polyline of referenceGeometry.polylines) addPolyline(scene, polyline, referenceGeometry);
  for (const mesh of referenceGeometry.meshes) addMesh(scene, mesh, referenceGeometry);
  for (const cloud of referenceGeometry.pointClouds) addPointCloud(scene, cloud, referenceGeometry);
  scene.referenceGeometry = {
    source: referenceGeometry.source,
    counts: normalizedReferenceGeometryCounts(referenceGeometry),
    diagnostics: arrayValues(referenceGeometry.diagnostics)
  };
  return referenceGeometry;
}
