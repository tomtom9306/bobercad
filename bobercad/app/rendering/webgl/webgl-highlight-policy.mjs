import { arrayValues, uniqueTruthy } from "../../engine/core/model.mjs";

function isLargeScene(scene) {
  return (scene?.faces?.length || 0) + (scene?.lines?.length || 0) + (scene?.memberInstances?.length || 0) > 25000;
}

function objectCollection(scene, objectId) {
  return scene?.project?.objectIndex?.[objectId]?.collection || null;
}

export function memberOnlyHighlightChange(scene, highlightedObjectIds, nextObjectIds = []) {
  if (!isLargeScene(scene)) return false;
  const ids = uniqueTruthy([...highlightedObjectIds, ...nextObjectIds]);
  return ids.length > 0 && ids.every((id) => objectCollection(scene, id) === "members");
}

export function highlightedObjectIdsForOverlay(highlightedObjectIds, authoringOverlay) {
  const suppressed = new Set(arrayValues(authoringOverlay?.suppressHighlightObjectIds));
  if (!suppressed.size) return highlightedObjectIds;
  return new Set([...highlightedObjectIds].filter((objectId) => !suppressed.has(objectId)));
}
