import { v } from "../core/math.mjs";
import { arrayValues } from "../core/model.mjs";
import { objectTrimRegionKey, trimRegionSelectorMap } from "../api/model/trim-region-keys.mjs";
import { CSG_EPSILON, csgCleanPoints, csgSubtract, cutBodyPolygons, geometryError, prismPolygons, projectCoincidentTolerance, requiredVector } from "./csg.mjs";
import { memberLength, sectionBounds } from "./member-geometry.mjs";

export const trimMemberStation = (member, frame, point) => v.dot(v.sub(point, member.start), frame.x);

export function sectionMaxSpan(profile) {
  if (!profile) return 1;
  const bounds = sectionBounds(profile);
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
}

export function planeTrimDiscardPolygons(member, frame, profile, plane, shared = {}) {
  if (!plane) geometryError("plane trim missing plane");
  const length = memberLength(member);
  const span = Math.max(length, sectionMaxSpan(profile)) * 4 + 1000;
  const depth = span * 2;
  const keepNormal = v.norm(requiredVector(plane, "normal", "plane trim"));
  const discardAxis = v.mul(keepNormal, -1);
  let axisY = v.norm(requiredVector(plane, "axisX", "plane trim"));
  axisY = v.norm(v.sub(axisY, v.mul(discardAxis, v.dot(axisY, discardAxis))));
  if (v.len(axisY) <= CSG_EPSILON) geometryError("plane trim axisX cannot be parallel to normal");
  const axisZ = v.norm(v.cross(discardAxis, axisY));
  const center = v.add(requiredVector(plane, "origin", "plane trim"), v.mul(discardAxis, depth / 2));
  return prismPolygons(center, discardAxis, axisY, axisZ, depth, [[-span, -span], [span, -span], [span, span], [-span, span]], shared);
}

const flippedPlane = (plane) => ({ ...plane, normal: v.mul(v.norm(requiredVector(plane, "normal", "plane trim region")), -1) });

function trimRegionBoxPolygons(project, member, frame, profile, tessellation, shared = {}) {
  const length = memberLength(member);
  const sectionSpan = sectionMaxSpan(profile);
  const padding = Math.max(sectionSpan * 5, projectCoincidentTolerance(project) * 100, 100);
  return cutBodyPolygons({
    type: "box",
    center: v.add(member.start, v.mul(frame.x, length / 2)),
    axisX: frame.x,
    axisY: frame.y,
    axisZ: frame.z,
    size: [length + padding * 2, sectionSpan + padding * 2, sectionSpan + padding * 2]
  }, shared, tessellation);
}

export function planeTrimRegionPolygons(project, member, frame, profile, planes, regionKey, tessellation, shared = {}, surfaceRefsForPlaneSide = null) {
  if (typeof regionKey !== "string" || !regionKey) geometryError("plane trim region key must be a non-empty string");
  const parts = regionKey.split("|");
  const signs = trimRegionSelectorMap(regionKey);
  if (signs.size !== parts.length) geometryError(`invalid or duplicate plane trim region key: ${regionKey}`);
  if (signs.size !== planes.length) geometryError(`${regionKey}: trim region key does not match selected planes`);
  let polygons = trimRegionBoxPolygons(project, member, frame, profile, tessellation, shared);
  for (const plane of planes) {
    const side = signs.get(plane.id);
    if (!side) geometryError(`${regionKey}: missing side for reference plane ${plane.id}`);
    const cutterPlane = side === "+" ? plane : flippedPlane(plane);
    const surfaceRefs = typeof surfaceRefsForPlaneSide === "function" ? surfaceRefsForPlaneSide(plane, side) : undefined;
    polygons = csgSubtract(polygons, planeTrimDiscardPolygons(member, frame, profile, cutterPlane, { ...shared, ...(surfaceRefs ? { surfaceRefs } : {}) }));
  }
  return polygons;
}

export function applyPlaneTrimRegionCuts(project, member, frame, profile, polygons, feature, tessellation, shared = {}, surfaceRefsForPlaneSide = null) {
  const planes = arrayValues(feature.runtimePlanes);
  if (!planes.length) geometryError(`${feature.id}: plane trim missing runtime planes`);
  for (const regionKey of arrayValues(feature.removedRegionKeys)) {
    polygons = csgSubtract(polygons, planeTrimRegionPolygons(project, member, frame, profile, planes, regionKey, tessellation, shared, (plane, side) => (typeof surfaceRefsForPlaneSide === "function" ? surfaceRefsForPlaneSide(feature, plane, side) : null)));
  }
  return polygons;
}

const polygonComponentPointKey = (point, tolerance) => point.map((value) => Math.round(value / tolerance)).join(",");

export function connectedPolygonComponents(project, member, frame, polygons) {
  const tolerance = Math.max(projectCoincidentTolerance(project) * 1e-4, CSG_EPSILON * 1000, 1e-5);
  const pointToPolygonIndexes = new Map();
  for (const [polygonIndex, polygon] of polygons.entries()) {
    for (const point of csgCleanPoints(polygon.vertices)) {
      const key = polygonComponentPointKey(point, tolerance);
      if (!pointToPolygonIndexes.has(key)) pointToPolygonIndexes.set(key, []);
      pointToPolygonIndexes.get(key).push(polygonIndex);
    }
  }

  const visited = new Set();
  const components = [];
  for (let index = 0; index < polygons.length; index += 1) {
    if (visited.has(index)) continue;
    const queue = [index];
    const indexes = [];
    visited.add(index);
    while (queue.length) {
      const current = queue.pop();
      indexes.push(current);
      for (const point of csgCleanPoints(polygons[current].vertices)) {
        const key = polygonComponentPointKey(point, tolerance);
        for (const neighbor of pointToPolygonIndexes.get(key) || []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    const componentPolygons = indexes.map((polygonIndex) => polygons[polygonIndex]);
    const points = componentPolygons.flatMap((polygon) => csgCleanPoints(polygon.vertices));
    const stations = points.map((point) => trimMemberStation(member, frame, point));
    const minStation = Math.min(...stations);
    const maxStation = Math.max(...stations);
    const centerStation = stations.reduce((sum, station) => sum + station, 0) / Math.max(stations.length, 1);
    components.push({ polygons: componentPolygons, minStation, maxStation, centerStation });
  }
  components.sort((left, right) => left.minStation - right.minStation || left.maxStation - right.maxStation || left.centerStation - right.centerStation || right.polygons.length - left.polygons.length);
  return components;
}

function objectTrimRegionKeys(feature, partIndex) {
  const key = objectTrimRegionKey(feature.id, partIndex);
  const legacyFeatureId = feature.id.replace(/:owner_[^:]+:cutter_[^:]+$/, "");
  return legacyFeatureId === feature.id ? [key] : [key, objectTrimRegionKey(legacyFeatureId, partIndex)];
}

export function objectTrimComponentRegions(project, member, frame, polygons, feature) {
  return connectedPolygonComponents(project, member, frame, polygons).map((component, index) => {
    const keys = objectTrimRegionKeys(feature, index + 1);
    return { ...component, key: keys[0], aliases: keys };
  });
}

export function removeObjectTrimRegions(project, member, frame, polygons, feature) {
  const removedRegionKeys = new Set(arrayValues(feature.removedRegionKeys));
  if (!removedRegionKeys.size) return polygons;
  const regions = objectTrimComponentRegions(project, member, frame, polygons, feature);
  if (regions.length <= 1) return polygons;
  return regions.filter((region) => !region.aliases.some((key) => removedRegionKeys.has(key))).flatMap((region) => region.polygons);
}
