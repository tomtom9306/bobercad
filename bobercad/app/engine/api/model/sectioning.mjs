import { v } from "../../core/math.mjs";
import { pathLength, samplePath } from "../geometry/paths.mjs";

const DEFAULT_DENSITY_KG_M3 = 7850;

function fail(message) {
  throw new Error(`sectioning api: ${message}`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function profileById(profiles, id) {
  return profiles?.[id] || profiles?.profiles?.[id] || null;
}

function materialById(materials, id) {
  return materials?.[id] || materials?.materials?.[id] || null;
}

function objectCollection(project, objectId) {
  const indexed = project.objectIndex?.[objectId]?.collection;
  if (indexed && project.model?.[indexed]?.[objectId]) return indexed;
  for (const [collection, objects] of Object.entries(project.model || {})) {
    if (objects?.[objectId]) return collection;
  }
  return null;
}

function objectById(project, objectId) {
  const collection = objectCollection(project, objectId);
  return collection ? { collection, object: project.model[collection][objectId] } : null;
}

function memberWeightKg(member, libraries = {}) {
  const profile = profileById(libraries.profiles, member.profile);
  const massPerLength = profile?.properties?.massPerLength;
  if (typeof massPerLength !== "number" || !Number.isFinite(massPerLength)) return 0;
  const lengthM = memberLengthMm(member) / 1000;
  return lengthM * massPerLength;
}

function memberLengthMm(member) {
  if (member.centerline) {
    try {
      return pathLength(member.centerline);
    } catch {
      return v.len(v.sub(member.end, member.start));
    }
  }
  return v.len(v.sub(member.end, member.start));
}

function polygonArea(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function plateAreaMm2(plate) {
  if (Array.isArray(plate.outline) && plate.outline.length >= 3) return polygonArea(plate.outline);
  if (typeof plate.width === "number" && typeof plate.height === "number") return Math.abs(plate.width * plate.height);
  return 0;
}

function plateWeightKg(plate, libraries = {}) {
  const thickness = typeof plate.thickness === "number" ? plate.thickness : 0;
  const area = plateAreaMm2(plate);
  if (thickness <= 0 || area <= 0) return 0;
  const material = materialById(libraries.materials, plate.material);
  const density = typeof material?.density === "number" ? material.density : DEFAULT_DENSITY_KG_M3;
  return area * thickness / 1e9 * density;
}

function objectPoints(object, collection) {
  if (collection === "members") {
    if (object.centerline) {
      try {
        return samplePath(object.centerline, { count: 24 }).map((sample) => sample.point);
      } catch {
        return [object.start, object.end].filter(Array.isArray);
      }
    }
    return [object.start, object.end].filter(Array.isArray);
  }
  if (collection === "plates") {
    const center = Array.isArray(object.center) ? object.center : [0, 0, 0];
    const axisY = Array.isArray(object.localAxisY) ? v.norm(object.localAxisY) : [0, 1, 0];
    const axisZ = Array.isArray(object.localAxisZ) ? v.norm(object.localAxisZ) : [0, 0, 1];
    const halfWidth = (object.width || 0) / 2;
    const halfHeight = (object.height || 0) / 2;
    return [
      v.add(center, v.add(v.mul(axisY, -halfWidth), v.mul(axisZ, -halfHeight))),
      v.add(center, v.add(v.mul(axisY, halfWidth), v.mul(axisZ, -halfHeight))),
      v.add(center, v.add(v.mul(axisY, halfWidth), v.mul(axisZ, halfHeight))),
      v.add(center, v.add(v.mul(axisY, -halfWidth), v.mul(axisZ, halfHeight)))
    ];
  }
  return [];
}

function boundsForPoints(points = []) {
  const valid = points.filter((point) => Array.isArray(point) && point.length === 3);
  if (!valid.length) return null;
  const min = [...valid[0]];
  const max = [...valid[0]];
  for (const point of valid.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return {
    min,
    max,
    size: v.sub(max, min),
    center: v.mul(v.add(min, max), 0.5)
  };
}

function mergeBounds(bounds) {
  const valid = bounds.filter(Boolean);
  if (!valid.length) return null;
  return boundsForPoints(valid.flatMap((item) => [item.min, item.max]));
}

export function estimateObject(project, libraries, objectId) {
  const entry = objectById(project, objectId);
  if (!entry) fail(`object not found: ${objectId}`);
  const weightKg = entry.collection === "members"
    ? memberWeightKg(entry.object, libraries)
    : entry.collection === "plates" ? plateWeightKg(entry.object, libraries)
      : 0;
  return {
    objectId,
    collection: entry.collection,
    type: entry.object.type,
    weightKg,
    bounds: boundsForPoints(objectPoints(entry.object, entry.collection))
  };
}

export function estimateObjects(project, libraries, objectIds = []) {
  return unique(objectIds).map((objectId) => estimateObject(project, libraries, objectId));
}

export function createSection(id, estimates = [], metadata = {}) {
  const objectIds = estimates.map((estimate) => estimate.objectId);
  const weightKg = estimates.reduce((sum, estimate) => sum + (estimate.weightKg || 0), 0);
  const bounds = mergeBounds(estimates.map((estimate) => estimate.bounds));
  return {
    id,
    type: "transport-section",
    objectIds,
    weightKg,
    bounds,
    metadata: { ...metadata }
  };
}

export function splitByMaxWeight(project, libraries, objectIds = [], options = {}) {
  const maxWeightKg = typeof options.maxWeightKg === "number" && options.maxWeightKg > 0 ? options.maxWeightKg : Infinity;
  const estimates = estimateObjects(project, libraries, objectIds);
  const sections = [];
  let bucket = [];
  let bucketWeight = 0;
  const flush = () => {
    if (!bucket.length) return;
    sections.push(createSection(`${options.idPrefix || "section"}_${sections.length + 1}`, bucket, { strategy: "max-weight", maxWeightKg }));
    bucket = [];
    bucketWeight = 0;
  };
  for (const estimate of estimates) {
    if (bucket.length && bucketWeight + estimate.weightKg > maxWeightKg) flush();
    bucket.push(estimate);
    bucketWeight += estimate.weightKg;
  }
  flush();
  return sections;
}

export function sectionSchedule(sections = []) {
  return sections.map((section, index) => ({
    id: section.id,
    index,
    objectCount: section.objectIds.length,
    weightKg: Math.round((section.weightKg || 0) * 1000) / 1000,
    size: section.bounds?.size || [0, 0, 0],
    center: section.bounds?.center || [0, 0, 0],
    metadata: section.metadata || {}
  }));
}
