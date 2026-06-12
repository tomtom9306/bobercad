import { smartComponentDetachedObjectIds, smartComponentOwnedObjectIds } from "../../engine/api/project/dependencies.mjs?v=array-values-dry-1";

export const DEFAULT_GHOST_OPACITY = 0.01;

export function activeSmartComponentObjectIds(project, smartComponentId) {
  const smartComponent = smartComponentId ? project.model.smartComponentInstances?.[smartComponentId] : null;
  if (!smartComponent) return new Set();
  return new Set([
    ...smartComponentOwnedObjectIds(smartComponent),
    ...smartComponentDetachedObjectIds(smartComponent)
  ]);
}

export function isActiveSmartComponentObject(scene, objectId) {
  return Boolean(objectId && scene?.activeSmartComponentObjectIds?.has?.(objectId));
}

export function shouldRenderObject(scene, object) {
  if (object.display?.visible === false) return false;
  if (object.display?.suppressed) return isActiveSmartComponentObject(scene, object.id);
  return true;
}
