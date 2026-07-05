export const SMART_COMPONENT_MEMBER_ROLE_COLORS = Object.freeze({
  primary: "#0284c7",
  secondary: "#b45309"
});

const HIGHLIGHT_COLLECTIONS = new Set(["members", "plates", "fastenerGroups", "welds"]);

function objectIdList(objectIds = []) {
  if (Array.isArray(objectIds)) return objectIds;
  if (objectIds && typeof objectIds !== "string" && typeof objectIds[Symbol.iterator] === "function") return [...objectIds];
  return [];
}

function highlightableObjectIds(project, objectIds = []) {
  const ids = [];
  const seen = new Set();
  for (const objectId of objectIdList(objectIds)) {
    if (!objectId || seen.has(objectId)) continue;
    if (!HIGHLIGHT_COLLECTIONS.has(project?.objectIndex?.[objectId]?.collection)) continue;
    seen.add(objectId);
    ids.push(objectId);
  }
  return ids;
}

export function smartComponentHighlightObjectIds(project, objectIds = []) {
  return highlightableObjectIds(project, objectIds);
}

export function smartComponentMemberHighlightColors(project, smartComponentId) {
  const instance = project?.model?.smartComponentInstances?.[smartComponentId];
  if (!instance || instance.kind !== "connection") return {};
  const zone = project?.model?.connectionZones?.[instance.inputs?.connectionZoneId];
  const mainMemberId = zone?.mainObjectId || instance.inputs?.main?.memberId || "";
  const secondaryMemberId = Array.isArray(zone?.secondaryObjectIds)
    ? zone.secondaryObjectIds[0]
    : instance.inputs?.secondary?.memberId || "";
  const colors = {};
  if (mainMemberId) colors[mainMemberId] = SMART_COMPONENT_MEMBER_ROLE_COLORS.primary;
  if (secondaryMemberId) {
    colors[secondaryMemberId] = instance.type === "member-splice" || zone?.type === "member-splice-zone"
      ? SMART_COMPONENT_MEMBER_ROLE_COLORS.primary
      : SMART_COMPONENT_MEMBER_ROLE_COLORS.secondary;
  }
  return colors;
}

export function smartComponentMemberHighlightObjectIds(project, smartComponentId) {
  return highlightableObjectIds(project, Object.keys(smartComponentMemberHighlightColors(project, smartComponentId)));
}

export function smartComponentEditingHighlightObjectIds(project, smartComponentId, objectIds = []) {
  return highlightableObjectIds(project, [
    ...objectIdList(objectIds),
    ...smartComponentMemberHighlightObjectIds(project, smartComponentId)
  ]);
}
