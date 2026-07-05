import { finiteNumber } from "../core/math.mjs";
import { arrayValues, isPlainObject } from "../core/model.mjs";

export const REFERENCE_GEOMETRY_SCHEMA = "bobercad-reference-geometry";
export const REFERENCE_GEOMETRY_VERSION = "0.1";
const NORMALIZED_REFERENCE_GEOMETRY = Symbol("bobercad.referenceGeometry.normalized");

export function markNormalizedReferenceGeometry(geometry) {
  if (isPlainObject(geometry)) geometry[NORMALIZED_REFERENCE_GEOMETRY] = true;
  return geometry;
}

export function isNormalizedReferenceGeometry(geometry) {
  return Boolean(geometry?.[NORMALIZED_REFERENCE_GEOMETRY]);
}

function text(value, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function color(value, fallback = "") {
  const next = text(value);
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(next);
  if (!match) return fallback;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((item) => `${item}${item}`).join("") : hex}`;
}

function opacity(value) {
  return finiteNumber(value) ? Math.max(0, Math.min(1, value)) : null;
}

function point(value) {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber) ? [...value] : null;
}

function samePoint(a, b) {
  return a?.length === 3 && b?.length === 3 && a.every((value, index) => value === b[index]);
}

function style(item = {}, fallbackId, fallbackColor) {
  const id = text(item.id, fallbackId);
  const layer = text(item.layer);
  const itemColor = color(item.color, layer ? "" : fallbackColor);
  const itemOpacity = opacity(item.opacity);
  return {
    id,
    ...(layer ? { layer } : {}),
    ...(itemColor ? { color: itemColor } : {}),
    ...(itemOpacity !== null ? { opacity: itemOpacity } : {})
  };
}

function diagnostics(input = []) {
  return arrayValues(input).map((item) => {
    if (typeof item === "string") return { severity: "warning", message: item };
    if (!isPlainObject(item) || !text(item.message)) return null;
    const severity = ["info", "warning", "error"].includes(item.severity) ? item.severity : "warning";
    return { severity, ...(text(item.code) ? { code: text(item.code) } : {}), message: text(item.message) };
  }).filter(Boolean);
}

function source(input = {}) {
  return isPlainObject(input) ? { ...input } : {};
}

function units(input = {}) {
  return { length: typeof input?.length === "string" && input.length.trim() ? input.length.trim() : "mm" };
}

function layers(input = {}) {
  if (!isPlainObject(input)) return {};
  return Object.fromEntries(Object.entries(input).map(([id, layer]) => {
    const layerId = text(id);
    if (!layerId || !isPlainObject(layer)) return null;
    const layerColor = color(layer.color);
    const layerOpacity = opacity(layer.opacity);
    return [layerId, {
      name: text(layer.name, layerId),
      ...(layerColor ? { color: layerColor } : {}),
      ...(layerOpacity !== null ? { opacity: layerOpacity } : {})
    }];
  }).filter(Boolean));
}

function line(item = {}, index, addDiagnostic) {
  const points = arrayValues(item.points).map(point).filter(Boolean).slice(0, 2);
  if (points.length < 2) {
    addDiagnostic(`line ${index} ignored: expected two [x,y,z] points`);
    return null;
  }
  return { ...style(item, `line_${index + 1}`, "#94a3b8"), points };
}

function polyline(item = {}, index, addDiagnostic) {
  let points = arrayValues(item.points).map(point).filter(Boolean);
  if (item.closed === true && points.length > 2 && samePoint(points[0], points.at(-1))) points = points.slice(0, -1);
  if (points.length < 2) {
    addDiagnostic(`polyline ${index} ignored: expected at least two [x,y,z] points`);
    return null;
  }
  return { ...style(item, `polyline_${index + 1}`, "#94a3b8"), points, closed: item.closed === true };
}

function mesh(item = {}, index, addDiagnostic) {
  const vertices = arrayValues(item.vertices).map(point).filter(Boolean);
  const faces = arrayValues(item.faces).map((face) => {
    const unique = [];
    for (const value of arrayValues(face)) {
      if (Number.isInteger(value) && value >= 0 && value < vertices.length && !unique.includes(value)) unique.push(value);
    }
    return unique;
  }).filter((face) => face.length >= 3);
  if (vertices.length < 3 || !faces.length) {
    addDiagnostic(`mesh ${index} ignored: expected vertices and index faces`);
    return null;
  }
  return { ...style(item, `mesh_${index + 1}`, "#60a5fa"), vertices, faces };
}

function pointCloud(item = {}, index, addDiagnostic) {
  const points = arrayValues(item.points).map(point).filter(Boolean);
  if (!points.length) {
    addDiagnostic(`pointCloud ${index} ignored: expected [x,y,z] points`);
    return null;
  }
  const pointSize = finiteNumber(item.pointSize) && item.pointSize >= 1 ? item.pointSize : null;
  const sourcePointCount = Number.isInteger(item.sourcePointCount) && item.sourcePointCount >= 0 ? item.sourcePointCount : null;
  const storedPointCount = Number.isInteger(item.storedPointCount) && item.storedPointCount >= 0 ? item.storedPointCount : null;
  return {
    ...style(item, `point_cloud_${index + 1}`, "#f59e0b"),
    points,
    ...(pointSize !== null ? { pointSize } : {}),
    ...(sourcePointCount !== null ? { sourcePointCount } : {}),
    ...(storedPointCount !== null ? { storedPointCount } : {})
  };
}

export function normalizeReferenceGeometry(input = {}) {
  const data = isPlainObject(input) ? input : {};
  const outputDiagnostics = diagnostics(data.diagnostics);
  const addDiagnostic = (message) => outputDiagnostics.push({ severity: "warning", code: "invalid-reference-geometry", message });
  if (!isPlainObject(input)) addDiagnostic("reference geometry ignored: expected sidecar object");
  if (data.schema && data.schema !== REFERENCE_GEOMETRY_SCHEMA) addDiagnostic(`unexpected reference geometry schema: ${data.schema}`);
  return markNormalizedReferenceGeometry({
    schema: REFERENCE_GEOMETRY_SCHEMA,
    schemaVersion: REFERENCE_GEOMETRY_VERSION,
    units: units(data.units),
    source: source(data.source),
    layers: layers(data.layers),
    lines: arrayValues(data.lines).map((item, index) => line(item, index, addDiagnostic)).filter(Boolean),
    polylines: arrayValues(data.polylines).map((item, index) => polyline(item, index, addDiagnostic)).filter(Boolean),
    meshes: arrayValues(data.meshes).map((item, index) => mesh(item, index, addDiagnostic)).filter(Boolean),
    pointClouds: arrayValues(data.pointClouds).map((item, index) => pointCloud(item, index, addDiagnostic)).filter(Boolean),
    diagnostics: outputDiagnostics
  });
}

function expandBounds(bounds, value) {
  if (!point(value)) return bounds;
  if (!bounds) return { min: [...value], max: [...value] };
  for (let index = 0; index < 3; index += 1) {
    bounds.min[index] = Math.min(bounds.min[index], value[index]);
    bounds.max[index] = Math.max(bounds.max[index], value[index]);
  }
  return bounds;
}

export function normalizedReferenceGeometryBounds(geometry = {}) {
  let bounds = null;
  for (const lineItem of arrayValues(geometry.lines)) {
    for (const item of arrayValues(lineItem?.points)) bounds = expandBounds(bounds, item);
  }
  for (const polylineItem of arrayValues(geometry.polylines)) {
    for (const item of arrayValues(polylineItem?.points)) bounds = expandBounds(bounds, item);
  }
  for (const meshItem of arrayValues(geometry.meshes)) {
    for (const item of arrayValues(meshItem?.vertices)) bounds = expandBounds(bounds, item);
  }
  for (const cloud of arrayValues(geometry.pointClouds)) {
    for (const item of arrayValues(cloud?.points)) bounds = expandBounds(bounds, item);
  }
  return bounds;
}

export function normalizedReferenceGeometryCounts(geometry = {}) {
  return {
    lines: arrayValues(geometry.lines).length,
    polylines: arrayValues(geometry.polylines).length,
    meshes: arrayValues(geometry.meshes).length,
    pointClouds: arrayValues(geometry.pointClouds).length,
    points: arrayValues(geometry.pointClouds).reduce((sum, cloud) => sum + arrayValues(cloud?.points).length, 0)
  };
}

export function referenceGeometryCounts(input = {}) {
  return normalizedReferenceGeometryCounts(normalizeReferenceGeometry(input));
}
