export const VIEWER_SETTINGS_STRIP_GROUP_SPECS = Object.freeze([
  {
    id: "display",
    label: "Display",
    order: 0,
    icon: "display-shaded",
    description: "Canvas display mode controls."
  },
  {
    id: "view",
    label: "View",
    order: 1,
    icon: "view-orientation",
    description: "Common camera orientation controls."
  },
  {
    id: "visibility",
    label: "Visibility",
    order: 2,
    icon: "feature",
    description: "Scene visibility controls for modeling helpers."
  }
]);

const GROUP_BY_ID = new Map(VIEWER_SETTINGS_STRIP_GROUP_SPECS.map((group) => [group.id, group]));
const GROUP_IDS = new Set(VIEWER_SETTINGS_STRIP_GROUP_SPECS.map((group) => group.id));

export const VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS = Object.freeze(VIEWER_SETTINGS_STRIP_GROUP_SPECS.map((group) => group.id));

export function viewerSettingsStripGroupSpec(groupId) {
  return GROUP_BY_ID.get(groupId) || null;
}

export function viewerSettingsStripGroupLabel(groupId) {
  return viewerSettingsStripGroupSpec(groupId)?.label || titleCase(groupId);
}

export function viewerSettingsStripGroupOrder(groupId) {
  return viewerSettingsStripGroupSpec(groupId)?.order ?? 100;
}

export function normalizeViewerSettingsStripGroupIds(values, fallback = VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS) {
  const normalized = uniqueKnownGroupIds(values);
  return normalized.length ? normalized : fallback.slice();
}

export function normalizeViewerSettingsStripHiddenGroupIds(values, groupIds = VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS) {
  const known = new Set(groupIds);
  return uniqueKnownGroupIds(values).filter((groupId) => known.has(groupId));
}

export function normalizeViewerSettingsStripWorkspace(settingsStrip = {}) {
  const groupIds = normalizeViewerSettingsStripGroupIds(settingsStrip?.groupIds, VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS);
  return {
    groupIds,
    hiddenGroupIds: normalizeViewerSettingsStripHiddenGroupIds(settingsStrip?.hiddenGroupIds, groupIds)
  };
}

export function mergeViewerSettingsStripWorkspace(defaultSettingsStrip, storedSettingsStrip) {
  const defaults = normalizeViewerSettingsStripWorkspace(defaultSettingsStrip);
  const stored = objectMap(storedSettingsStrip);
  const storedGroupIds = normalizeViewerSettingsStripGroupIds(stored.groupIds, defaults.groupIds);
  const groupIds = mergeGroupOrder(defaults.groupIds, storedGroupIds);
  return {
    groupIds,
    hiddenGroupIds: normalizeViewerSettingsStripHiddenGroupIds(stored.hiddenGroupIds, groupIds)
  };
}

export function viewerSettingsStripVisibleGroupIds(settingsStrip = {}) {
  const state = normalizeViewerSettingsStripWorkspace(settingsStrip);
  const hidden = new Set(state.hiddenGroupIds);
  return state.groupIds.filter((groupId) => !hidden.has(groupId));
}

function uniqueKnownGroupIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && GROUP_IDS.has(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}

function objectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeGroupOrder(defaultGroupIds = [], storedGroupIds = []) {
  const defaults = normalizeViewerSettingsStripGroupIds(defaultGroupIds, VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS);
  const stored = uniqueKnownGroupIds(storedGroupIds);
  return [
    ...stored.filter((groupId) => defaults.includes(groupId)),
    ...defaults.filter((groupId) => !stored.includes(groupId))
  ];
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
