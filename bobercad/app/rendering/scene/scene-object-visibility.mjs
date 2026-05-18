export const DEFAULT_GHOST_OPACITY = 0.01;

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

export function activeConnectionObjectIds(project, connectionId) {
  const connection = connectionId ? project.model.connections?.[connectionId] : null;
  if (!connection) return new Set();
  return new Set([
    ...flattenIds(connection.generator?.objectRoles),
    ...(connection.generator?.ownedObjectIds || []),
    ...flattenIds(connection.manualParts)
  ].filter(Boolean));
}

export function isActiveConnectionObject(scene, objectId) {
  return Boolean(objectId && scene.activeConnectionObjectIds?.has(objectId));
}

export function shouldRenderObject(scene, object) {
  if (object.display?.visible === false) return false;
  if (object.display?.suppressed) return isActiveConnectionObject(scene, object.id);
  return true;
}
