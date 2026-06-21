import { finiteNumber, finitePositiveNumber, v } from "../../engine/core/math.mjs";
import { arrayValues, objectById } from "../../engine/core/model.mjs";
import { csgSubtract, cutBodyPolygons, geometryError, prismPolygons, requiredArray, requiredNumber, requiredVector, slotOutline2d } from "../../engine/geometry/csg.mjs";
import { evaluateTrimJointMemberFeatures } from "../../engine/geometry/evaluators/trim-evaluator.mjs";
import { resolveInterfaceWithConnectionReference } from "../../engine/geometry/member-geometry.mjs";
import { featureCutterShared, shouldApplyMemberFeature } from "./scene-annotation-metadata.mjs";

export function memberFeatures(project, member, scene = null) {
  const storedFeatures = arrayValues(member.featureIds)
    .map((id) => objectById(project, id))
    .filter((feature) => feature.ownerId === member.id && feature.operationEnabled !== false && shouldApplyMemberFeature(scene, feature));
  const trimJointFeatures = scene?.profiles ? evaluateTrimJointMemberFeatures(project, scene.profiles, member) : [];
  return [...storedFeatures, ...trimJointFeatures];
}

export function objectFeatures(project, object) {
  return arrayValues(object.featureIds)
    .map((id) => objectById(project, id))
    .filter((feature) => feature.ownerId === object.id && feature.operationEnabled !== false);
}

function featureOrigin(project, profiles, feature) {
  const ref = feature.reference;
  if (!ref || !ref.kind) geometryError(`${feature.id}: feature missing reference.kind`);
  if (ref.kind === "plate-face") {
    const plate = objectById(project, feature.ownerId);
    const normal = v.norm(requiredVector(plate, "normal", plate.id));
    if (!["front", "back"].includes(ref.face)) geometryError(`${feature.id}: plate-face reference must set face to front or back`);
    const faceOffset = ref.face === "front" ? -plate.thickness / 2 : ref.face === "back" ? plate.thickness / 2 : 0;
    const origin = Array.isArray(ref.origin) ? requiredVector(ref, "origin", `${feature.id} reference`) : plate.center;
    return {
      origin: v.add(origin, v.mul(normal, faceOffset)),
      normal,
      y: v.norm(requiredVector(ref, "localAxisY", `${feature.id} reference`)),
      z: v.norm(requiredVector(ref, "localAxisZ", `${feature.id} reference`))
    };
  }
  if (ref.interfaceRef) {
    const options = {};
    if (ref.stationReferenceInterfaceRef) {
      options.referencePoint = resolveInterfaceWithConnectionReference(project, profiles, ref.stationReferenceInterfaceRef).origin;
      options.preferReferencePoint = true;
    }
    const iface = resolveInterfaceWithConnectionReference(project, profiles, ref.interfaceRef, options);
    return {
      origin: requiredVector(iface, "origin", `${feature.id} resolved interface`),
      normal: v.norm(requiredVector(iface, "normal", `${feature.id} resolved interface`)),
      y: v.norm(requiredVector(iface, "localAxisY", `${feature.id} resolved interface`)),
      z: v.norm(requiredVector(iface, "localAxisZ", `${feature.id} resolved interface`))
    };
  }
  if (!Array.isArray(ref.origin)) geometryError(`${feature.id}: non-plate feature reference must provide numeric origin`);
  return {
    origin: requiredVector(ref, "origin", `${feature.id} reference`),
    normal: v.norm(requiredVector(ref, "normal", `${feature.id} reference`)),
    y: v.norm(requiredVector(ref, "localAxisY", `${feature.id} reference`)),
    z: v.norm(requiredVector(ref, "localAxisZ", `${feature.id} reference`))
  };
}

function holePatternCutters(scene, project, profiles, feature, depth, shared = {}) {
  if (feature.type !== "hole-pattern") return [];
  if (!feature.holePatternRef) geometryError(`${feature.id}: hole-pattern missing holePatternRef`);
  const cutterDepth = feature.depth === undefined ? depth : requiredNumber(feature, "depth", feature.id);
  if (!finitePositiveNumber(cutterDepth)) geometryError(`${feature.id}: hole-pattern depth must be positive`);
  const pattern = objectById(project, feature.holePatternRef);
  const diameter = requiredNumber(pattern, "holeDiameter", `${pattern.id} hole pattern`);
  const positions = requiredArray(pattern, "positions", `${pattern.id} hole pattern`);
  const basis = featureOrigin(project, profiles, feature);
  const radius = diameter / 2;
  if (radius <= 0) geometryError(`${pattern.id}: holeDiameter must be positive`);
  const suppressed = new Set(arrayValues(pattern.suppressedPositionIndices));
  let cutters = [];

  for (const [index, position] of positions.entries()) {
    if (suppressed.has(index)) continue;
    if (!Array.isArray(position) || position.length !== 2 || position.some((value) => !finiteNumber(value))) {
      geometryError(`${pattern.id}: hole position must be [y, z]`);
    }
    const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
    const body = {
      type: "cylinder",
      center,
      axisX: basis.normal,
      axisY: basis.y,
      axisZ: basis.z,
      radius,
      depth: cutterDepth
    };
    cutters = cutters.concat(cutBodyPolygons(body, featureCutterShared(shared, feature, body, index), scene.tessellation));
  }

  return cutters;
}

function slotCutters(scene, project, profiles, feature, depth, shared = {}) {
  if (feature.type !== "slot-hole") return [];
  if (!feature.reference) geometryError(`${feature.id}: slot-hole missing reference`);
  const cutterDepth = feature.depth === undefined ? depth : requiredNumber(feature, "depth", feature.id);
  if (!finitePositiveNumber(cutterDepth)) geometryError(`${feature.id}: slot-hole depth must be positive`);
  const basis = featureOrigin(project, profiles, feature);
  const position = requiredArray(feature, "position", `${feature.id} slot-hole`);
  if (position.length !== 2 || position.some((value) => !finiteNumber(value))) {
    geometryError(`${feature.id}: slot-hole position must be [y, z]`);
  }
  const slot = feature.slot || geometryError(`${feature.id}: slot-hole missing slot`);
  const length = requiredNumber(slot, "length", `${feature.id} slot`);
  const width = requiredNumber(slot, "width", `${feature.id} slot`);
  const orientation = requiredNumber(slot, "orientation", `${feature.id} slot`);
  const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
  const outline = slotOutline2d(length, width, orientation * Math.PI / 180, scene.tessellation);
  const body = {
    type: "polygonal-prism",
    center,
    axisX: basis.normal,
    axisY: basis.y,
    axisZ: basis.z,
    depth: cutterDepth,
    outline
  };
  return prismPolygons(center, basis.normal, basis.y, basis.z, cutterDepth, outline, featureCutterShared(shared, feature, body, 0));
}

export function holeOrSlotCut(scene, project, profiles, polygons, feature, depth, shared) {
  if (feature.type === "hole-pattern") return csgSubtract(polygons, holePatternCutters(scene, project, profiles, feature, depth, shared));
  if (feature.type === "slot-hole") return csgSubtract(polygons, slotCutters(scene, project, profiles, feature, depth, shared));
  return null;
}
