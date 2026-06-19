import { isPlainObject as plainObject, objectById } from "../../core/model.mjs";
import { bounds3OrNull, finiteNonNegativeNumber, finitePositiveNumber, v } from "../../core/math.mjs";
import { signedArea2d } from "../../geometry/polygon.mjs";
import { pathLength, samplePath } from "../geometry/paths.mjs";
import { plateOutline } from "../project/plate-sketch-relations-and-bends.mjs";
import { objectCollection } from "../project/objects.mjs";
import { libraryProfileById } from "../project/profiles.mjs";

function fail(message) {
  throw new Error(`sectioning api: ${message}`);
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) fail(`${label} must be a finite [x, y, z] vector`);
  return value;
}

function requiredDirection(value, label) {
  const vector = requiredVec3(value, label);
  const length = v.len(vector);
  if (length <= 1e-9) fail(`${label} cannot be zero length`);
  return v.mul(vector, 1 / length);
}

function requiredPositiveNumber(value, label) {
  if (!finitePositiveNumber(value)) fail(`${label} must be a positive number`);
  return value;
}

function requiredNonNegativeNumber(value, label) {
  if (!finiteNonNegativeNumber(value)) fail(`${label} must be a non-negative number`);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requiredStringArray(value, label) {
  const values = requiredArray(value, label);
  const seen = new Set();
  for (const item of values) {
    if (typeof item !== "string" || !item.trim()) fail(`${label} must contain only non-empty strings`);
    if (seen.has(item)) fail(`${label} contains duplicate value: ${item}`);
    seen.add(item);
  }
  return values;
}

function optionalObject(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function objectIdsList(value) {
  return requiredStringArray(value, "objectIds");
}

function requiredLibraryMap(library, field, label) {
  if (!plainObject(library)) fail(`${label} library must be an object`);
  const values = library[field];
  if (!plainObject(values)) fail(`${label} library.${field} must be an object`);
  return values;
}

function materialById(materials, id) {
  return requiredLibraryMap(materials, "materials", "materials")[id] || null;
}

function memberWeightKg(member, libraries) {
  const profile = libraryProfileById(libraries.profiles, member.profile);
  if (!profile) fail(`${member.id}: profile not found: ${member.profile}`);
  const massPerLength = requiredPositiveNumber(profile.properties?.massPerLength, `${member.profile}.properties.massPerLength`);
  const lengthM = memberLengthMm(member) / 1000;
  return lengthM * massPerLength;
}

function memberLengthMm(member) {
  if (member.centerline) {
    return pathLength(member.centerline);
  }
  return v.len(v.sub(requiredVec3(member.end, `${member.id}.end`), requiredVec3(member.start, `${member.id}.start`)));
}

function plateAreaMm2(plate) {
  const outline = plateOutline(plate);
  if (!Array.isArray(outline) || outline.length < 3) fail(`${plate.id}: outline must contain at least three points`);
  return requiredPositiveNumber(Math.abs(signedArea2d(outline)), `${plate.id}.area`);
}

function plateWeightKg(plate, libraries) {
  const thickness = requiredPositiveNumber(plate.thickness, `${plate.id}.thickness`);
  const area = plateAreaMm2(plate);
  const materialId = requiredString(plate.material, `${plate.id}.material`);
  const material = materialById(libraries.materials, materialId);
  if (!material) fail(`${plate.id}: material not found: ${materialId}`);
  const density = requiredPositiveNumber(material.density, `${materialId}.density`);
  return area * thickness / 1e9 * density;
}

function objectPoints(object, collection) {
  if (collection === "members") {
    if (object.centerline) {
      return samplePath(object.centerline, { count: 24 }).map((sample) => sample.point);
    }
    return [
      requiredVec3(object.start, `${object.id}.start`),
      requiredVec3(object.end, `${object.id}.end`)
    ];
  }
  if (collection === "plates") {
    const center = requiredVec3(object.center, `${object.id}.center`);
    const axisY = requiredDirection(object.localAxisY, `${object.id}.localAxisY`);
    const axisZ = requiredDirection(object.localAxisZ, `${object.id}.localAxisZ`);
    return plateOutline(object).map(([y, z]) => v.add(center, v.add(v.mul(axisY, y), v.mul(axisZ, z))));
  }
  fail(`${object.id}: sectioning does not support ${collection}`);
}

function mergeBounds(bounds) {
  return bounds3OrNull(bounds.flatMap((item) => [item.min, item.max]));
}

function requiredBounds(bounds, label) {
  if (!bounds) fail(`${label} bounds are required`);
  return {
    ...bounds,
    size: requiredVec3(bounds.size, `${label}.bounds.size`),
    center: requiredVec3(bounds.center, `${label}.bounds.center`)
  };
}

function requiredEstimate(estimate, index, sectionId) {
  if (!plainObject(estimate)) fail(`${sectionId}.estimates[${index}] must be an object`);
  return {
    ...estimate,
    objectId: requiredString(estimate.objectId, `${sectionId}.estimates[${index}].objectId`),
    collection: requiredString(estimate.collection, `${sectionId}.estimates[${index}].collection`),
    weightKg: requiredNonNegativeNumber(estimate.weightKg, `${sectionId}.estimates[${index}].weightKg`),
    bounds: requiredBounds(estimate.bounds, `${sectionId}.estimates[${index}]`)
  };
}

export function estimateObject(project, libraries, objectId) {
  const collection = objectCollection(project, objectId);
  if (!collection) fail(`object not found: ${objectId}`);
  const object = objectById(project, objectId);
  const weightKg = collection === "members"
    ? memberWeightKg(object, libraries)
    : collection === "plates" ? plateWeightKg(object, libraries)
      : fail(`${objectId}: sectioning does not support ${collection}`);
  return {
    objectId,
    collection,
    type: object.type,
    weightKg,
    bounds: bounds3OrNull(objectPoints(object, collection))
  };
}

export function estimateObjects(project, libraries, objectIds) {
  return objectIdsList(objectIds).map((objectId) => estimateObject(project, libraries, objectId));
}

export function createSection(id, estimates, metadata = {}) {
  requiredString(id, "section id");
  requiredArray(estimates, `${id}.estimates`);
  if (!estimates.length) fail(`${id}.estimates must not be empty`);
  const sectionMetadata = optionalObject(metadata, {}, `${id}.metadata`);
  const sectionEstimates = estimates.map((estimate, index) => requiredEstimate(estimate, index, id));
  const objectIds = sectionEstimates.map((estimate) => estimate.objectId);
  const weightKg = sectionEstimates.reduce((sum, estimate) => sum + estimate.weightKg, 0);
  const bounds = mergeBounds(sectionEstimates.map((estimate) => estimate.bounds));
  if (!bounds) fail(`${id}: could not resolve section bounds`);
  return {
    id,
    type: "transport-section",
    objectIds,
    weightKg,
    bounds,
    metadata: { ...sectionMetadata }
  };
}

export function splitByMaxWeight(project, libraries, objectIds, options) {
  if (!plainObject(options)) fail("split options must be an object");
  const maxWeightKg = options.maxWeightKg;
  if (!finitePositiveNumber(maxWeightKg)) fail("maxWeightKg must be a positive number");
  const estimates = estimateObjects(project, libraries, objectIds);
  const idPrefix = requiredString(options.idPrefix, "idPrefix");
  const sections = [];
  let bucket = [];
  let bucketWeight = 0;
  const flush = () => {
    if (!bucket.length) return;
    sections.push(createSection(`${idPrefix}_${sections.length + 1}`, bucket, { strategy: "max-weight", maxWeightKg }));
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

export function sectionSchedule(sections) {
  return requiredArray(sections, "sections").map((section, index) => {
    if (!plainObject(section)) fail(`sections[${index}] must be an object`);
    const sectionId = requiredString(section.id, `sections[${index}].id`);
    const metadata = optionalObject(section.metadata, {}, `${sectionId}.metadata`);
    const objectIds = requiredStringArray(section.objectIds, `${sectionId}.objectIds`);
    const bounds = requiredBounds(section.bounds, sectionId);
    return {
      id: sectionId,
      index,
      objectCount: objectIds.length,
      weightKg: Math.round(requiredNonNegativeNumber(section.weightKg, `${sectionId}.weightKg`) * 1000) / 1000,
      size: bounds.size,
      center: bounds.center,
      metadata
    };
  });
}
