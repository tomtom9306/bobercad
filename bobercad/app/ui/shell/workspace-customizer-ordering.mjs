import { normalizeBottomStripWorkspace, normalizeNavigationWorkspace, normalizePanelState, normalizeToolbarGroupIds, normalizeViewerSettingsStripWorkspace } from "./workspace-customizer-state.mjs";

export function moveToolbarCommand(workspace, sourceId, targetId) {
  if (sourceId === targetId || !workspace?.commandIds?.includes(sourceId) || !workspace?.commandIds?.includes(targetId)) return workspace;
  const ordered = workspace.commandIds.filter((id) => id !== sourceId);
  const targetIndex = ordered.indexOf(targetId);
  if (targetIndex === -1) return workspace;
  ordered.splice(targetIndex, 0, sourceId);
  return { ...workspace, commandIds: ordered };
}

export function moveToolbarCommandByDirection(workspace, commandId, direction) {
  const currentIndex = workspace.commandIds.indexOf(commandId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= workspace.commandIds.length) return workspace;
  const commandIds = workspace.commandIds.slice();
  const [moved] = commandIds.splice(currentIndex, 1);
  commandIds.splice(nextIndex, 0, moved);
  return { ...workspace, commandIds };
}

export function moveToolbarGroupByDirection(workspace, groupId, direction, commandSpecs = []) {
  const groupIds = normalizeToolbarGroupIds(workspace?.groupIds, commandSpecs);
  const currentIndex = groupIds.indexOf(groupId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= groupIds.length) return workspace;
  const nextGroupIds = groupIds.slice();
  const [moved] = nextGroupIds.splice(currentIndex, 1);
  nextGroupIds.splice(nextIndex, 0, moved);
  return { ...workspace, groupIds: nextGroupIds };
}

export function moveToolbarGroupBefore(workspace, sourceId, targetId, commandSpecs = []) {
  if (sourceId === targetId) return workspace;
  const groupIds = normalizeToolbarGroupIds(workspace?.groupIds, commandSpecs);
  if (!groupIds.includes(sourceId) || !groupIds.includes(targetId)) return workspace;
  const nextGroupIds = groupIds.filter((groupId) => groupId !== sourceId);
  const targetIndex = nextGroupIds.indexOf(targetId);
  if (targetIndex < 0) return workspace;
  nextGroupIds.splice(targetIndex, 0, sourceId);
  return { ...workspace, groupIds: nextGroupIds };
}

export function movePanelTabByDirection(panelState, panelConfig, tabId, direction) {
  const state = normalizePanelState(panelState, panelConfig);
  const currentIndex = state.tabIds.indexOf(tabId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= state.tabIds.length) return panelState;
  const tabIds = state.tabIds.slice();
  const [moved] = tabIds.splice(currentIndex, 1);
  tabIds.splice(nextIndex, 0, moved);
  return normalizePanelState({ ...state, tabIds }, panelConfig);
}

export function movePanelTabBefore(panelState, panelConfig, sourceId, targetId) {
  if (sourceId === targetId) return panelState;
  const state = normalizePanelState(panelState, panelConfig);
  if (!state.tabIds.includes(sourceId) || !state.tabIds.includes(targetId)) return panelState;
  const tabIds = state.tabIds.filter((tabId) => tabId !== sourceId);
  const targetIndex = tabIds.indexOf(targetId);
  if (targetIndex < 0) return panelState;
  tabIds.splice(targetIndex, 0, sourceId);
  return normalizePanelState({ ...state, tabIds }, panelConfig);
}

export function moveFeatureNavbarGroupByDirection(navigation, groupId, direction) {
  const state = normalizeNavigationWorkspace(navigation);
  const currentIndex = state.featureNavbar.groupIds.indexOf(groupId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= state.featureNavbar.groupIds.length) return navigation;
  const groupIds = state.featureNavbar.groupIds.slice();
  const [moved] = groupIds.splice(currentIndex, 1);
  groupIds.splice(nextIndex, 0, moved);
  return normalizeNavigationWorkspace({
    featureNavbar: {
      ...state.featureNavbar,
      groupIds
    }
  });
}

export function moveFeatureNavbarGroupBefore(navigation, sourceId, targetId) {
  if (sourceId === targetId) return navigation;
  const state = normalizeNavigationWorkspace(navigation);
  if (!state.featureNavbar.groupIds.includes(sourceId) || !state.featureNavbar.groupIds.includes(targetId)) return navigation;
  const groupIds = state.featureNavbar.groupIds.filter((groupId) => groupId !== sourceId);
  const targetIndex = groupIds.indexOf(targetId);
  if (targetIndex < 0) return navigation;
  groupIds.splice(targetIndex, 0, sourceId);
  return normalizeNavigationWorkspace({
    featureNavbar: {
      ...state.featureNavbar,
      groupIds
    }
  });
}

export function moveBottomStripItemByDirection(bottomStrip, itemId, direction) {
  const state = normalizeBottomStripWorkspace(bottomStrip);
  const currentIndex = state.itemIds.indexOf(itemId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= state.itemIds.length) return bottomStrip;
  const itemIds = state.itemIds.slice();
  const [moved] = itemIds.splice(currentIndex, 1);
  itemIds.splice(nextIndex, 0, moved);
  return normalizeBottomStripWorkspace({ ...state, itemIds });
}

export function moveBottomStripItemBefore(bottomStrip, sourceId, targetId) {
  if (sourceId === targetId) return bottomStrip;
  const state = normalizeBottomStripWorkspace(bottomStrip);
  if (!state.itemIds.includes(sourceId) || !state.itemIds.includes(targetId)) return bottomStrip;
  const itemIds = state.itemIds.filter((itemId) => itemId !== sourceId);
  const targetIndex = itemIds.indexOf(targetId);
  if (targetIndex < 0) return bottomStrip;
  itemIds.splice(targetIndex, 0, sourceId);
  return normalizeBottomStripWorkspace({ ...state, itemIds });
}

export function moveViewerSettingsStripGroupByDirection(viewerSettingsStrip, groupId, direction) {
  const state = normalizeViewerSettingsStripWorkspace(viewerSettingsStrip);
  const currentIndex = state.groupIds.indexOf(groupId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= state.groupIds.length) return viewerSettingsStrip;
  const groupIds = state.groupIds.slice();
  const [moved] = groupIds.splice(currentIndex, 1);
  groupIds.splice(nextIndex, 0, moved);
  return normalizeViewerSettingsStripWorkspace({ ...state, groupIds });
}

export function moveViewerSettingsStripGroupBefore(viewerSettingsStrip, sourceId, targetId) {
  if (sourceId === targetId) return viewerSettingsStrip;
  const state = normalizeViewerSettingsStripWorkspace(viewerSettingsStrip);
  if (!state.groupIds.includes(sourceId) || !state.groupIds.includes(targetId)) return viewerSettingsStrip;
  const groupIds = state.groupIds.filter((groupId) => groupId !== sourceId);
  const targetIndex = groupIds.indexOf(targetId);
  if (targetIndex < 0) return viewerSettingsStrip;
  groupIds.splice(targetIndex, 0, sourceId);
  return normalizeViewerSettingsStripWorkspace({ ...state, groupIds });
}
