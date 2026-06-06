export const DEFAULT_GHOST_OPACITY = 0.01;

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

export function activeSmartComponentObjectIds(project, smartComponentId) {
  const smartComponent = smartComponentId ? project.model.smartComponentInstances?.[smartComponentId] : null;
  if (!smartComponent) return new Set();
  return new Set([
    ...flattenIds(smartComponent.objectRoles),
    ...(smartComponent.ownedObjectIds || []),
    ...(smartComponent.detachedObjectIds || [])
  ].filter(Boolean));
}

export function isActiveSmartComponentObject(scene, objectId) {
  return Boolean(objectId && scene.activeSmartComponentObjectIds?.has(objectId));
}

export function shouldRenderObject(scene, object) {
  if (object.display?.visible === false) return false;
  if (object.display?.suppressed) return isActiveSmartComponentObject(scene, object.id);
  return true;
}
