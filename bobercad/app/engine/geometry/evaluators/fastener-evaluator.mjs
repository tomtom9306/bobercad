import { finiteNumber, finitePositiveNumber, finitePositiveNumberOr, v } from "../../core/math.mjs";
import { arrayValues, objectById } from "../../core/model.mjs";
import { resolveInterfaceWithConnectionReference } from "../member-geometry.mjs";

function fail(message) {
  throw new Error(`fastener evaluator: ${message}`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) fail(`${label} must be a finite [x, y, z] vector`);
  return value;
}

function requiredVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [y, z] point`);
  }
  return value;
}

function requiredPositiveNumber(value, label) {
  if (!finitePositiveNumber(value)) fail(`${label} must be a positive number`);
  return value;
}

function indexedObject(project, objectId, collection, label) {
  requiredString(objectId, label);
  if (project?.objectIndex?.[objectId]?.collection !== collection) {
    fail(`${label} must reference an indexed ${collection} object: ${objectId}`);
  }
  return objectById(project, objectId);
}

function catalogEntries(fastenerCatalog) {
  if (fastenerCatalog?.fasteners && typeof fastenerCatalog.fasteners === "object" && !Array.isArray(fastenerCatalog.fasteners)) {
    return fastenerCatalog.fasteners;
  }
  if (fastenerCatalog && typeof fastenerCatalog === "object" && !Array.isArray(fastenerCatalog)) return fastenerCatalog;
  fail("fastener catalog must be an object");
}

function fastenerDefinition(fastenerCatalog, fastenerGroup) {
  const fastenerRef = requiredString(fastenerGroup.fastenerRef, `${fastenerGroup.id}.fastenerRef`);
  const fastener = catalogEntries(fastenerCatalog)[fastenerRef];
  if (!fastener) fail(`${fastenerGroup.id}: fastenerRef not found in fastener library: ${fastenerRef}`);
  return fastener;
}

function resolvedFeatureReferencePoint(project, profiles, referenceId) {
  return resolveInterfaceWithConnectionReference(project, profiles, referenceId).origin;
}

function featureReferenceBasis(project, profiles, feature) {
  const ref = feature.reference;
  if (!ref || typeof ref !== "object" || Array.isArray(ref) || !ref.kind) fail(`${feature.id}: feature missing reference.kind`);

  if (ref.kind === "plate-face") {
    const plate = objectById(project, feature.ownerId);
    const normal = v.norm(requiredVec3(plate.normal, `${plate.id}.normal`));
    if (!["front", "back"].includes(ref.face)) fail(`${feature.id}: plate-face reference must set face to front or back`);
    const thickness = requiredPositiveNumber(plate.thickness, `${plate.id}.thickness`);
    const faceOffset = ref.face === "front" ? -thickness / 2 : thickness / 2;
    const sourceOrigin = Array.isArray(ref.origin) ? requiredVec3(ref.origin, `${feature.id}.reference.origin`) : requiredVec3(plate.center, `${plate.id}.center`);
    return {
      origin: v.add(sourceOrigin, v.mul(normal, faceOffset)),
      normal,
      y: v.norm(requiredVec3(ref.localAxisY, `${feature.id}.reference.localAxisY`)),
      z: v.norm(requiredVec3(ref.localAxisZ, `${feature.id}.reference.localAxisZ`))
    };
  }

  if (ref.interfaceRef) {
    const options = {};
    if (ref.stationReferenceInterfaceRef) {
      options.referencePoint = resolvedFeatureReferencePoint(project, profiles, ref.stationReferenceInterfaceRef);
      options.preferReferencePoint = true;
    }
    const iface = resolveInterfaceWithConnectionReference(project, profiles, ref.interfaceRef, options);
    return {
      origin: requiredVec3(iface.origin, `${feature.id}.resolvedInterface.origin`),
      normal: v.norm(requiredVec3(iface.normal, `${feature.id}.resolvedInterface.normal`)),
      y: v.norm(requiredVec3(iface.localAxisY, `${feature.id}.resolvedInterface.localAxisY`)),
      z: v.norm(requiredVec3(iface.localAxisZ, `${feature.id}.resolvedInterface.localAxisZ`))
    };
  }

  return {
    origin: requiredVec3(ref.origin, `${feature.id}.reference.origin`),
    normal: v.norm(requiredVec3(ref.normal, `${feature.id}.reference.normal`)),
    y: v.norm(requiredVec3(ref.localAxisY, `${feature.id}.reference.localAxisY`)),
    z: v.norm(requiredVec3(ref.localAxisZ, `${feature.id}.reference.localAxisZ`))
  };
}

function validateMatchingHolePattern(fastenerGroup, feature, role) {
  if (feature.holePatternRef && feature.holePatternRef !== fastenerGroup.holePatternRef) {
    fail(`${fastenerGroup.id}: through.${role} ${feature.id} must use holePatternRef ${fastenerGroup.holePatternRef}`);
  }
}

export function evaluateFastenerGroupBasis(project, profiles, fastenerGroup) {
  const fromFeatureId = requiredString(fastenerGroup.through?.fromFeatureId, `${fastenerGroup.id}.through.fromFeatureId`);
  const fromFeature = indexedObject(project, fromFeatureId, "features", `${fastenerGroup.id}.through.fromFeatureId`);
  validateMatchingHolePattern(fastenerGroup, fromFeature, "fromFeatureId");
  return {
    feature: fromFeature,
    featureId: fromFeatureId,
    basis: featureReferenceBasis(project, profiles, fromFeature)
  };
}

function optionalThroughFeature(project, fastenerGroup, key) {
  const featureId = fastenerGroup.through?.[key];
  if (featureId === undefined) return { featureId: null, feature: null };
  const feature = indexedObject(project, featureId, "features", `${fastenerGroup.id}.through.${key}`);
  validateMatchingHolePattern(fastenerGroup, feature, key);
  return { featureId, feature };
}

function fastenerGripLength(project, fastenerGroup, fromFeature, toFeature, options = {}) {
  if (finitePositiveNumber(fastenerGroup.assembly?.gripLength)) return fastenerGroup.assembly.gripLength;
  const owner = fromFeature?.ownerId ? objectById(project, fromFeature.ownerId) : null;
  const fromDepth = finitePositiveNumber(owner?.thickness) ? owner.thickness : finitePositiveNumberOr(fromFeature?.depth, 0);
  const toDepth = finitePositiveNumberOr(toFeature?.depth, 0);
  return Math.max(fromDepth + toDepth, finitePositiveNumberOr(options.minimumGripLength, 0));
}

function evaluatedAxis(fastenerGroup, basis) {
  return Array.isArray(fastenerGroup.orientation?.axis)
    ? v.norm(requiredVec3(fastenerGroup.orientation.axis, `${fastenerGroup.id}.orientation.axis`))
    : basis.normal;
}

function evaluatedPositions(pattern, basis) {
  const suppressed = new Set(arrayValues(pattern.suppressedPositionIndices));
  if (!Array.isArray(pattern.positions) || !pattern.positions.length) fail(`${pattern.id}: positions must be a non-empty array`);
  return pattern.positions.map((position, index) => {
    const localPosition = requiredVec2(position, `${pattern.id}.positions[${index}]`);
    return {
      index,
      localPosition,
      suppressed: suppressed.has(index),
      center: v.add(basis.origin, v.add(v.mul(basis.y, localPosition[0]), v.mul(basis.z, localPosition[1])))
    };
  });
}

export function evaluateFastenerGroup(project, profiles, fastenerCatalog, fastenerGroup, options = {}) {
  if (!fastenerGroup || typeof fastenerGroup !== "object" || Array.isArray(fastenerGroup)) fail("fastener group must be an object");
  requiredString(fastenerGroup.id, "fastenerGroup.id");
  const holePatternRef = requiredString(fastenerGroup.holePatternRef, `${fastenerGroup.id}.holePatternRef`);
  const holePattern = indexedObject(project, holePatternRef, "holePatterns", `${fastenerGroup.id}.holePatternRef`);
  const fastener = fastenerDefinition(fastenerCatalog, fastenerGroup);
  const { featureId: fromFeatureId, feature: fromFeature, basis } = evaluateFastenerGroupBasis(project, profiles, fastenerGroup);
  const { featureId: toFeatureId, feature: toFeature } = optionalThroughFeature(project, fastenerGroup, "toFeatureId");
  const axis = evaluatedAxis(fastenerGroup, basis);
  return {
    id: fastenerGroup.id,
    source: fastenerGroup,
    fastener,
    fastenerRef: fastenerGroup.fastenerRef,
    holePattern,
    holePatternRef,
    basis,
    axis,
    gripLength: fastenerGripLength(project, fastenerGroup, fromFeature, toFeature, options),
    through: {
      fromFeatureId,
      fromFeature,
      toFeatureId,
      toFeature
    },
    positions: evaluatedPositions(holePattern, basis)
  };
}
