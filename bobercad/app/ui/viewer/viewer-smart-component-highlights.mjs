export function smartComponentHighlightObjectIds(project, objectIds = []) {
  const highlightCollections = new Set(["members", "plates", "fastenerGroups", "welds"]);
  return objectIds.filter((objectId) => highlightCollections.has(project.objectIndex?.[objectId]?.collection));
}
