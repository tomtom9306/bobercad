import { objectById, truthyValues, uniqueTruthy as unique } from "../../core/model.mjs?v=sectioning-object-lookup-dry-1";
import { bounds3OrNull, finiteNumber, finiteNumberOr, finitePositiveNumberOr, v } from "../../core/math.mjs?v=bounds3-null-dry-1";
import { signedArea2d } from "../../geometry/polygon.mjs?v=polygon-area-dry-1";
import { pathLength, samplePath } from "../geometry/paths.mjs?v=path-segment-parameter-dry-1";
import { plateOutline } from "../project/plates.mjs";
import { objectCollection } from "../project/objects.mjs";
import { libraryProfileById } from "../project/profiles.mjs?v=profile-lookup-dry-1";

const DEFAULT_DENSITY_KG_M3 = 7850;

function materialById(materials, id) {
  return materials?.[id] || materials?.materials?.[id] || null;
}

function memberWeightKg(member, libraries = {}) {
  const profile = libraryProfileById(libraries.profiles, member.profile);
  const massPerLength = profile?.properties?.massPerLength;
  if (!finiteNumber(massPerLength)) return 0;
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

function plateAreaMm2(plate) {
  const outline = plateOutline(plate);
  return Array.isArray(outline) && outline.length >= 3 ? Math.abs(signedArea2d(outline)) : 0;
}

function plateWeightKg(plate, libraries = {}) {
  const thickness = finiteNumberOr(plate.thickness, 0);
  const area = plateAreaMm2(plate);
  if (thickness <= 0 || area <= 0) return 0;
  const material = materialById(libraries.materials, plate.material);
  const density = finiteNumberOr(material?.density, DEFAULT_DENSITY_KG_M3);
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
    return plateOutline(object).map(([y, z]) => v.add(center, v.add(v.mul(axisY, y), v.mul(axisZ, z))));
  }
  return [];
}

function mergeBounds(bounds) {
  return bounds3OrNull(truthyValues(bounds).flatMap((item) => [item.min, item.max]));
}

export function estimateObject(project, libraries, objectId) {
  const collection = objectCollection(project, objectId);
  if (!collection) throw new Error(`sectioning api: object not found: ${objectId}`);
  const object = objectById(project, objectId);
  const weightKg = collection === "members"
    ? memberWeightKg(object, libraries)
    : collection === "plates" ? plateWeightKg(object, libraries)
      : 0;
  return {
    objectId,
    collection,
    type: object.type,
    weightKg,
    bounds: bounds3OrNull(objectPoints(object, collection))
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
  const maxWeightKg = finitePositiveNumberOr(options.maxWeightKg, Infinity);
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
