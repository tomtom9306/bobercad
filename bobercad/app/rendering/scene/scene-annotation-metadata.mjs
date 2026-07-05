import { arrayValues, collectionObjects, objectById } from "../../engine/core/model.mjs";
import { smartComponentOwnedObjectIds } from "../../engine/api/project/dependencies.mjs";
import { isActiveSmartComponentObject } from "./scene-object-visibility.mjs";

function contourStableId(contour, index = 0) {
  return contour?.id || `${contour?.role || "contour"}-${index}`;
}

function memberSurfaceRef(member, kind, data = {}) {
  return {
    kind,
    memberId: member.id,
    profileId: member.profile,
    ...data
  };
}

export function memberContourSurfaceRefs(member, contour, contourIndex = 0) {
  const contourId = contourStableId(contour, contourIndex);
  const points = arrayValues(contour.points);
  return {
    back: memberSurfaceRef(member, "member-profile-section-face", { contourId, stationRole: "start" }),
    front: memberSurfaceRef(member, "member-profile-section-face", { contourId, stationRole: "end" }),
    sides: points.map((_, edgeIndex) => memberSurfaceRef(member, "member-profile-face", { contourId, edgeIndex }))
  };
}

function cutBaseSurfaceRef(feature, bodyIndex = 0, data = {}) {
  return {
    kind: "cut-face",
    ownerId: feature.ownerId,
    featureId: feature.id,
    featureType: feature.type,
    ...(feature.trimJointId ? { trimJointId: feature.trimJointId } : {}),
    ...(feature.cutKind ? { cutKind: feature.cutKind } : {}),
    bodyIndex,
    ...data
  };
}

function cutBodySurfaceRefs(feature, body, bodyIndex = 0) {
  const sideIds = body?.type === "box"
    ? ["zMin", "yPlus", "zPlus", "yMin"]
    : arrayValues(body?.outline).map((_, index) => `outline-${index}`);
  return {
    back: cutBaseSurfaceRef(feature, bodyIndex, { faceId: "xMin" }),
    front: cutBaseSurfaceRef(feature, bodyIndex, { faceId: "xPlus" }),
    sides: sideIds.map((faceId) => cutBaseSurfaceRef(feature, bodyIndex, { faceId }))
  };
}

export function featureCutterShared(shared, feature, body, bodyIndex = 0) {
  return {
    ...shared,
    surfaceRefs: cutBodySurfaceRefs(feature, body, bodyIndex)
  };
}

export function trimPlaneSurfaceRefs(feature, plane, side = null) {
  const planeId = plane?.id || plane?.referencePlaneId || "runtime-plane";
  const face = (faceId) => cutBaseSurfaceRef(feature, 0, {
    faceId,
    planeId,
    ...(side ? { regionSide: side } : {})
  });
  return {
    back: face("trimBox.xMin"),
    front: face("trimBox.xPlus"),
    sides: ["trimBox.zMin", "trimBox.yPlus", "trimBox.zPlus", "trimBox.yMin"].map(face)
  };
}

function stableRefString(value) {
  if (!value || typeof value !== "object") return "";
  return Object.keys(value).sort().map((key) => {
    const item = value[key];
    return `${key}:${item && typeof item === "object" ? stableRefString(item) : String(item)}`;
  }).join("|");
}

function uniqueSurfaceRefs(surfaceRefs = []) {
  const refs = [];
  const seen = new Set();
  for (const ref of surfaceRefs) {
    if (!ref || typeof ref !== "object") continue;
    const key = stableRefString(ref);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs.sort((left, right) => stableRefString(left).localeCompare(stableRefString(right)));
}

export function evaluatedEdgeRef(edge, meta = {}) {
  if (meta.collection !== "members" || !meta.objectId) return null;
  const surfaces = uniqueSurfaceRefs(edge.surfaces);
  if (!surfaces.length) return null;
  return {
    kind: "evaluated-edge",
    owner: { collection: "members", objectId: meta.objectId },
    surfaces
  };
}

export function detailMeta(objectId) {
  return objectId ? { lodDetailObjectId: objectId } : {};
}

export function generatedSmartComponentObjectIds(project) {
  return new Set(Object.values(project.model.smartComponentInstances || {}).flatMap(smartComponentOwnedObjectIds));
}

export function renderCollectionObjects(project, collection, renderObjectIds = null) {
  if (!renderObjectIds) return collectionObjects(project, collection);
  return [...renderObjectIds]
    .filter((objectId) => project.objectIndex?.[objectId]?.collection === collection)
    .map((objectId) => objectById(project, objectId));
}

export function shouldApplyMemberFeature(scene, feature) {
  if (feature.type !== "hole-pattern") return true;
  if (!scene?.generatedSmartComponentObjectIds?.has(feature.id)) return true;
  return isActiveSmartComponentObject(scene, feature.id);
}

export function shouldBuildLodDetail(scene, objectId) {
  if (!objectId) return true;
  if (isActiveSmartComponentObject(scene, objectId)) return true;
  return typeof scene?.lodDetailFilter === "function" ? scene.lodDetailFilter(objectId) : true;
}

export function renderVisibilityEnabled(scene, key) {
  return scene.settings?.render?.visibility?.[key] !== false;
}

export function shouldRenderCuttingObjects(scene) {
  return renderVisibilityEnabled(scene, "cuttingObjects");
}

export function shouldRenderReferencePlanes(scene) {
  return renderVisibilityEnabled(scene, "referencePlanes");
}

export function shouldRenderGrids(scene) {
  return renderVisibilityEnabled(scene, "grids");
}

export function shouldRenderReferenceGeometry(scene) {
  return renderVisibilityEnabled(scene, "referenceGeometry");
}

export function shouldRenderFasteners(scene) {
  return renderVisibilityEnabled(scene, "fasteners");
}

export function objectDisplayColor(project, objectId, fallback) {
  if (!objectId) return fallback;
  const object = project.model?.[project.objectIndex?.[objectId]?.collection]?.[objectId];
  return object?.display?.color || fallback;
}
