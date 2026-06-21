import { BOTTOM_STRIP_DEFAULT_ITEM_IDS, normalizeBottomStripHiddenItemIds, normalizeBottomStripItemIds } from "../commands/bottom-strip-metadata.mjs";
import { COMMAND_GROUP_ORDER, commandGroupSpec } from "../commands/command-group-metadata.mjs";
import { VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS, mergeViewerSettingsStripWorkspace, normalizeViewerSettingsStripWorkspace } from "../commands/settings-strip-metadata.mjs";
import { titleCase } from "./workspace-customizer-labels.mjs";
import { readWorkspacePreferences, workspacePreferencesEnvelope, workspaceSectionStates } from "./workspace-storage.mjs";

const DEFAULT_TOOLBAR_DOCK = "top";
const DEFAULT_THEME = "light";
const DEFAULT_DENSITY = "compact";
const PANEL_DOCKS = new Set(["top", "left", "right", "bottom", "floating"]);
const WORKSPACE_THEMES = new Set(["light", "dark", "system"]);
const WORKSPACE_DENSITIES = new Set(["compact", "normal", "spacious"]);
const DEFAULT_PANEL_MIN_WIDTH = 220;
const DEFAULT_PANEL_MAX_WIDTH = 720;
const VIEWER_OVERLAY_CORNER_SPECS = [
  { id: "bottom-right", label: "Bottom right", shortLabel: "BR" },
  { id: "bottom-left", label: "Bottom left", shortLabel: "BL" },
  { id: "top-right", label: "Top right", shortLabel: "TR" },
  { id: "top-left", label: "Top left", shortLabel: "TL" }
];
const VIEWER_OVERLAY_CORNERS = new Set(VIEWER_OVERLAY_CORNER_SPECS.map((corner) => corner.id));
const VIEWER_OVERLAY_SPECS = [
  {
    id: "navCube",
    label: "NavCube",
    icon: "view-orientation",
    description: "View orientation control shown inside the viewer.",
    defaultVisible: true,
    defaultCorner: "bottom-right"
  }
];

function loadToolbarWorkspace(defaultWorkspaceState, knownCommandIds = defaultWorkspaceState?.commandIds || [], panelConfigs = [], commandSpecs = []) {
  const normalizedDefault = normalizeToolbarWorkspace(
    defaultWorkspaceState,
    defaultWorkspaceState?.commandIds || [],
    knownCommandIds,
    panelConfigs,
    commandSpecs
  );
  try {
    const stored = readWorkspacePreferences();
    const storedToolbar = stored?.toolbars?.modeling || stored;
    const storedPanels = stored?.panels || storedToolbar?.panels;
    const mergedPanels = mergePanelWorkspaceDefaults(normalizedDefault.panels, storedPanels);
    return normalizeToolbarWorkspace({
      ...normalizedDefault,
      ...storedToolbar,
      theme: stored?.theme ?? storedToolbar?.theme ?? normalizedDefault.theme,
      density: stored?.density ?? storedToolbar?.density ?? normalizedDefault.density,
      navigation: mergeNavigationWorkspace(normalizedDefault.navigation, stored?.navigation ?? storedToolbar?.navigation),
      bottomStrip: mergeBottomStripWorkspace(normalizedDefault.bottomStrip, stored?.bottomStrip ?? storedToolbar?.bottomStrip),
      viewerSettingsStrip: mergeViewerSettingsStripWorkspace(normalizedDefault.viewerSettingsStrip, stored?.viewerSettingsStrip ?? storedToolbar?.viewerSettingsStrip),
      viewerOverlays: mergeViewerOverlaysWorkspace(normalizedDefault.viewerOverlays, stored?.viewerOverlays ?? storedToolbar?.viewerOverlays),
      panels: mergedPanels
    }, normalizedDefault.commandIds, knownCommandIds, panelConfigs, commandSpecs);
  } catch (error) {
    console.warn(`Workspace preferences could not be loaded: ${error?.message || String(error)}`);
    return normalizedDefault;
  }
}

function normalizeDefaultWorkspace(workspace, defaultCommandIds, knownCommandIds = defaultCommandIds, panelConfigs = [], commandSpecs = []) {
  const toolbar = workspace?.toolbars?.modeling || {};
  return normalizeToolbarWorkspace({
    commandIds: defaultCommandIds,
    hiddenCommandIds: toolbar.hiddenCommandIds,
    groupIds: toolbar.groupIds,
    collapsedGroups: toolbar.collapsedGroups,
    dock: toolbar.dock,
    theme: workspace?.theme,
    density: workspace?.density,
    navigation: workspace?.navigation,
    bottomStrip: workspace?.bottomStrip,
    viewerSettingsStrip: workspace?.viewerSettingsStrip,
    viewerOverlays: workspace?.viewerOverlays,
    panels: workspace?.panels || defaultPanelWorkspace(panelConfigs)
  }, defaultCommandIds, knownCommandIds, panelConfigs, commandSpecs);
}

function defaultWorkspaceSections(workspace) {
  return objectMap(workspace?.sections);
}

function normalizePanelTabs(tabs = []) {
  const seen = new Set();
  return (Array.isArray(tabs) ? tabs : [])
    .map((tab) => (typeof tab === "string" ? { id: tab } : tab))
    .map((tab) => ({
      id: String(tab?.id || "").trim(),
      label: String(tab?.label || tab?.id || "").trim(),
      icon: String(tab?.icon || "").trim(),
      title: String(tab?.title || tab?.label || tab?.id || "").trim(),
      description: String(tab?.description || "").trim()
    }))
    .filter((tab) => validWorkspaceId(tab.id) && !seen.has(tab.id) && seen.add(tab.id))
    .map((tab) => ({
      id: tab.id,
      label: tab.label || titleCase(tab.id),
      ...(tab.icon ? { icon: tab.icon } : {}),
      ...(tab.title ? { title: tab.title } : {}),
      ...(tab.description ? { description: tab.description } : {})
    }));
}

function normalizePanelTabIds(values, panelConfig, fallback = null) {
  const knownIds = panelConfig?.tabs?.map((tab) => tab.id) || [];
  const normalized = uniqueStringIds(values).filter((tabId) => knownIds.includes(tabId));
  const fallbackIds = Array.isArray(fallback) ? fallback : knownIds;
  return [...normalized, ...fallbackIds.filter((tabId) => knownIds.includes(tabId) && !normalized.includes(tabId))];
}

function normalizePanelHiddenTabIds(values, tabIds = []) {
  const known = new Set(tabIds);
  return uniqueStringIds(values).filter((tabId) => known.has(tabId));
}

function normalizePanelActiveTab(tabId, panelConfig, panelState = {}) {
  const tabs = Array.isArray(panelConfig?.tabs) ? panelConfig.tabs : [];
  if (!tabs.length) return "";
  const tabIds = normalizePanelTabIds(panelState?.tabIds, panelConfig);
  const hiddenTabIds = new Set(normalizePanelHiddenTabIds(panelState?.hiddenTabIds, tabIds));
  const visibleTabIds = tabIds.filter((id) => !hiddenTabIds.has(id));
  const fallback = visibleTabIds.includes(panelConfig?.defaultActiveTab)
    ? panelConfig.defaultActiveTab
    : visibleTabIds[0] || tabIds[0] || "";
  return visibleTabIds.includes(tabId) ? tabId : fallback;
}

function normalizePanelConfigs(panels = []) {
  const seen = new Set();
  return panels
    .filter((panel) => panel?.id && panel?.element && !seen.has(panel.id) && seen.add(panel.id))
    .map((panel) => {
      const minWidth = finitePanelWidth(panel.minWidth, DEFAULT_PANEL_MIN_WIDTH);
      const maxWidth = Math.max(minWidth, finitePanelWidth(panel.maxWidth, DEFAULT_PANEL_MAX_WIDTH));
      const tabs = normalizePanelTabs(panel.tabs);
      return {
        id: panel.id,
        label: panel.label || panel.id,
        description: panel.description || "",
        icon: panel.icon || "inspector",
        dock: normalizePanelDock(panel.dock, "floating"),
        defaultVisible: panel.defaultVisible !== false,
        defaultPinned: panel.defaultPinned !== false,
        defaultWidth: clampPanelWidth(finitePanelWidth(panel.defaultWidth, panel.width || 320), minWidth, maxWidth),
        minWidth,
        maxWidth,
        tabs,
        defaultActiveTab: normalizePanelActiveTab(panel.defaultActiveTab, { tabs }),
        element: panel.element
      };
    });
}

function panelConfigById(panelConfigs, panelId) {
  return panelConfigs.find((panel) => panel.id === panelId) || null;
}

function defaultPanelWorkspace(panelConfigs = []) {
  return Object.fromEntries(panelConfigs.map((panel) => [panel.id, normalizePanelState(null, panel)]));
}

function normalizePanelWorkspace(panels, panelConfigs = []) {
  const stored = panels && typeof panels === "object" && !Array.isArray(panels) ? panels : {};
  return Object.fromEntries(panelConfigs.map((panel) => [panel.id, normalizePanelState(stored[panel.id], panel)]));
}

function normalizePanelState(state, panelConfig) {
  return normalizeWorkspacePanelState(state, panelConfig);
}

function normalizePanelDock(dock, fallback = "floating") {
  const normalizedFallback = typeof fallback === "string" && PANEL_DOCKS.has(fallback) ? fallback : "floating";
  return typeof dock === "string" && PANEL_DOCKS.has(dock) ? dock : normalizedFallback;
}

function normalizeWorkspacePanelState(state, panelConfig = {}) {
  const tabs = Array.isArray(panelConfig.tabs) ? panelConfig.tabs : [];
  const minWidth = finitePanelWidth(panelConfig.minWidth, DEFAULT_PANEL_MIN_WIDTH);
  const maxWidth = Math.max(minWidth, finitePanelWidth(panelConfig.maxWidth, DEFAULT_PANEL_MAX_WIDTH));
  const defaultWidth = clampPanelWidth(finitePanelWidth(panelConfig.defaultWidth, panelConfig.width || 320), minWidth, maxWidth);
  const normalizedPanelConfig = {
    ...panelConfig,
    tabs,
    defaultWidth,
    minWidth,
    maxWidth
  };
  const fallbackDock = normalizePanelDock(panelConfig.dock, "floating");
  const panelState = {
    visible: typeof state?.visible === "boolean" ? state.visible : panelConfig.defaultVisible !== false,
    width: normalizePanelWidth(state?.width, normalizedPanelConfig),
    dock: normalizePanelDock(state?.dock, fallbackDock),
    pinned: typeof state?.pinned === "boolean" ? state.pinned : panelConfig.defaultPinned !== false
  };
  if (normalizedPanelConfig.tabs.length) {
    panelState.tabIds = normalizePanelTabIds(state?.tabIds, normalizedPanelConfig);
    panelState.hiddenTabIds = normalizePanelHiddenTabIds(state?.hiddenTabIds, panelState.tabIds);
    panelState.activeTab = normalizePanelActiveTab(state?.activeTab, normalizedPanelConfig, panelState);
  }
  return panelState;
}

function normalizePanelWidth(width, panelConfig) {
  return clampPanelWidth(finitePanelWidth(width, panelConfig.defaultWidth), panelConfig.minWidth, panelConfig.maxWidth);
}

function finitePanelWidth(value, fallback) {
  const width = Number(value);
  return Number.isFinite(width) ? Math.round(width) : fallback;
}

function clampPanelWidth(width, minWidth, maxWidth) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

function toolbarEligibleCommands(commands) {
  return commands.filter((command) => command.defaultToolbar === "modeling" || command.group === "model" || command.toolbarPin === true);
}

function resolveCommands(commands) {
  const resolved = typeof commands === "function" ? commands() : commands;
  return Array.isArray(resolved) ? resolved : [];
}

function defaultToolbarCommandIds(commands, defaultWorkspace = null) {
  const knownCommandIds = new Set(commands.map((command) => command.id));
  const presetCommandIds = uniqueStringIds(defaultWorkspace?.toolbars?.modeling?.commandIds)
    .filter((commandId) => knownCommandIds.has(commandId));
  if (presetCommandIds.length) return presetCommandIds;
  return commands
    .filter((command) => command.defaultToolbar === "modeling" || command.group === "model")
    .map((command) => command.id);
}

function uniqueStringIds(values) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && value)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function objectMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergePanelWorkspaceDefaults(defaultPanels, storedPanels) {
  const defaults = objectMap(defaultPanels);
  const stored = objectMap(storedPanels);
  return Object.fromEntries([...new Set([...Object.keys(defaults), ...Object.keys(stored)])]
    .map((panelId) => [panelId, { ...objectMap(defaults[panelId]), ...objectMap(stored[panelId]) }]));
}

function commandById(commands, commandId) {
  return commands.find((command) => command.id === commandId) || null;
}

function toolbarWorkspacePatch(patch = {}) {
  const toolbarPatch = patch.toolbars?.modeling || patch.modeling || patch;
  return {
    ...toolbarPatch,
    ...(patch.theme ? { theme: patch.theme } : {}),
    ...(patch.density ? { density: patch.density } : {}),
    ...(patch.navigation ? { navigation: patch.navigation } : {}),
    ...(patch.bottomStrip ? { bottomStrip: patch.bottomStrip } : {}),
    ...(patch.viewerSettingsStrip ? { viewerSettingsStrip: patch.viewerSettingsStrip } : {}),
    ...(patch.viewerOverlays ? { viewerOverlays: patch.viewerOverlays } : {})
  };
}

function workspacePreferencePayload(workspace, options = {}) {
  return workspacePreferencesEnvelope({
    theme: normalizeTheme(workspace.theme),
    density: normalizeDensity(workspace.density),
    toolbars: {
      modeling: toolbarStateForStorage(workspace)
    },
    navigation: navigationStateForStorage(workspace.navigation),
    bottomStrip: bottomStripStateForStorage(workspace.bottomStrip),
    viewerSettingsStrip: viewerSettingsStripStateForStorage(workspace.viewerSettingsStrip),
    viewerOverlays: viewerOverlayStateForStorage(workspace.viewerOverlays),
    panels: panelStateForStorage(workspace.panels),
    sections: options.sections ?? workspaceSectionStates()
  });
}


function workspaceDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeToolbarWorkspace(workspace, defaultCommandIds, knownCommandIds = defaultCommandIds, panelConfigs = [], commandSpecs = []) {
  const known = new Set(knownCommandIds);
  const defaults = defaultCommandIds.filter((id) => known.has(id));
  const ordered = [...(Array.isArray(workspace?.commandIds) ? workspace.commandIds : []), ...defaults]
    .filter((id, index, values) => known.has(id) && values.indexOf(id) === index);
  const hidden = (Array.isArray(workspace?.hiddenCommandIds) ? workspace.hiddenCommandIds : [])
    .filter((id, index, values) => known.has(id) && ordered.includes(id) && values.indexOf(id) === index);
  const orderedCommandSpecs = ordered.map((id) => commandById(commandSpecs, id)).filter(Boolean);
  return {
    commandIds: ordered,
    hiddenCommandIds: hidden,
    groupIds: normalizeToolbarGroupIds(workspace?.groupIds, orderedCommandSpecs),
    collapsedGroups: normalizeCollapsedGroups(workspace?.collapsedGroups),
    dock: normalizeToolbarDock(workspace?.dock),
    theme: normalizeTheme(workspace?.theme),
    density: normalizeDensity(workspace?.density),
    navigation: normalizeNavigationWorkspace(workspace?.navigation),
    bottomStrip: normalizeBottomStripWorkspace(workspace?.bottomStrip),
    viewerSettingsStrip: normalizeViewerSettingsStripWorkspace(workspace?.viewerSettingsStrip),
    viewerOverlays: normalizeViewerOverlaysWorkspace(workspace?.viewerOverlays),
    panels: normalizePanelWorkspace(workspace?.panels, panelConfigs)
  };
}

function workspaceState(state) {
  return {
    theme: normalizeTheme(state.theme),
    density: normalizeDensity(state.density),
    toolbars: {
      modeling: toolbarStateForStorage(state)
    },
    navigation: navigationStateForStorage(state.navigation),
    bottomStrip: bottomStripStateForStorage(state.bottomStrip),
    viewerSettingsStrip: viewerSettingsStripStateForStorage(state.viewerSettingsStrip),
    viewerOverlays: viewerOverlayStateForStorage(state.viewerOverlays),
    panels: panelStateForStorage(state.panels)
  };
}

function toolbarStateForStorage(state) {
  return {
    commandIds: state.commandIds.slice(),
    hiddenCommandIds: state.hiddenCommandIds.slice(),
    groupIds: normalizeToolbarGroupIds(state.groupIds),
    collapsedGroups: normalizeCollapsedGroups(state.collapsedGroups),
    dock: normalizeToolbarDock(state.dock)
  };
}

function panelStateForStorage(panels = {}) {
  return Object.fromEntries(Object.entries(panels).map(([id, panel]) => [id, {
    visible: panel.visible !== false,
    width: panel.width,
    dock: normalizePanelDock(panel.dock),
    pinned: panel.pinned !== false,
    ...(Array.isArray(panel.tabIds) ? { tabIds: panel.tabIds.slice() } : {}),
    ...(Array.isArray(panel.hiddenTabIds) ? { hiddenTabIds: panel.hiddenTabIds.slice() } : {}),
    ...(panel.activeTab ? { activeTab: panel.activeTab } : {})
  }]));
}

function navigationStateForStorage(navigation = {}) {
  return normalizeNavigationWorkspace(navigation);
}

function bottomStripStateForStorage(bottomStrip = {}) {
  return normalizeBottomStripWorkspace(bottomStrip);
}

function viewerSettingsStripStateForStorage(viewerSettingsStrip = {}) {
  return normalizeViewerSettingsStripWorkspace(viewerSettingsStrip);
}

function viewerOverlayStateForStorage(viewerOverlays = {}) {
  return normalizeViewerOverlaysWorkspace(viewerOverlays);
}

function normalizeToolbarDock() {
  return DEFAULT_TOOLBAR_DOCK;
}

function normalizeTheme(theme) {
  return WORKSPACE_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function normalizeDensity(density) {
  return WORKSPACE_DENSITIES.has(density) ? density : DEFAULT_DENSITY;
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function themeLabel(theme) {
  return theme === "system" ? "system" : theme;
}

function densityLabel(density) {
  return density;
}

function normalizeCollapsedGroups(groups = []) {
  return (Array.isArray(groups) ? groups : [])
    .filter((groupId) => validWorkspaceId(groupId))
    .filter((groupId, index, values) => values.indexOf(groupId) === index);
}

function normalizeToolbarGroupIds(values, commands = []) {
  const known = new Set(COMMAND_GROUP_ORDER);
  const currentGroups = toolbarCommandGroupIds(commands);
  for (const groupId of currentGroups) known.add(groupId);
  const explicit = (Array.isArray(values) ? values : [])
    .filter((groupId) => typeof groupId === "string" && known.has(groupId))
    .filter((groupId, index, all) => all.indexOf(groupId) === index);
  const ordered = explicit.length ? explicit : currentGroups;
  for (const groupId of currentGroups) {
    if (!ordered.includes(groupId)) ordered.push(groupId);
  }
  return ordered;
}

function toolbarCommandGroupIds(commands = []) {
  const commandGroups = commands
    .map(commandGroupId)
    .filter((groupId) => COMMAND_GROUP_ORDER.includes(groupId))
    .filter((groupId, index, all) => all.indexOf(groupId) === index);
  return [
    ...COMMAND_GROUP_ORDER.filter((groupId) => commandGroups.includes(groupId)),
    ...commandGroups.filter((groupId) => !COMMAND_GROUP_ORDER.includes(groupId))
  ];
}

function normalizeNavigationWorkspace(navigation = {}) {
  const featureNavbar = objectMap(navigation?.featureNavbar);
  const groupIds = normalizeCommandGroupIds(featureNavbar.groupIds, COMMAND_GROUP_ORDER);
  const hiddenGroupIds = normalizeCommandGroupIds(featureNavbar.hiddenGroupIds, [])
    .filter((groupId) => groupIds.includes(groupId));
  return {
    featureNavbar: {
      groupIds,
      hiddenGroupIds
    }
  };
}

function normalizeCommandGroupIds(values, fallback = []) {
  const known = new Set(COMMAND_GROUP_ORDER);
  const normalized = (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && known.has(value))
    .filter((value, index, all) => all.indexOf(value) === index);
  if (normalized.length || !fallback.length) return normalized;
  return fallback.filter((value, index, all) => known.has(value) && all.indexOf(value) === index);
}

function mergeNavigationWorkspace(defaultNavigation, storedNavigation) {
  const defaults = normalizeNavigationWorkspace(defaultNavigation);
  const stored = objectMap(storedNavigation);
  return normalizeNavigationWorkspace({
    featureNavbar: {
      ...defaults.featureNavbar,
      ...objectMap(stored.featureNavbar)
    }
  });
}

function normalizeViewerOverlaysWorkspace(viewerOverlays = {}) {
  const stored = objectMap(viewerOverlays);
  return Object.fromEntries(VIEWER_OVERLAY_SPECS.map((spec) => {
    const state = objectMap(stored[spec.id]);
    return [spec.id, {
      visible: typeof state.visible === "boolean" ? state.visible : spec.defaultVisible !== false,
      corner: normalizeViewerOverlayCorner(state.corner, spec.defaultCorner)
    }];
  }));
}

function mergeViewerOverlaysWorkspace(defaultViewerOverlays, storedViewerOverlays) {
  const defaults = normalizeViewerOverlaysWorkspace(defaultViewerOverlays);
  const stored = objectMap(storedViewerOverlays);
  return normalizeViewerOverlaysWorkspace(Object.fromEntries(VIEWER_OVERLAY_SPECS.map((spec) => [
    spec.id,
    {
      ...objectMap(defaults[spec.id]),
      ...objectMap(stored[spec.id])
    }
  ])));
}

function viewerOverlayEntries(viewerOverlays = {}) {
  const normalized = normalizeViewerOverlaysWorkspace(viewerOverlays);
  return VIEWER_OVERLAY_SPECS.map((spec) => ({
    ...spec,
    ...normalized[spec.id]
  }));
}

function viewerOverlaySpec(overlayId) {
  return VIEWER_OVERLAY_SPECS.find((spec) => spec.id === overlayId) || null;
}

function viewerOverlayCornerSpec(cornerId) {
  return VIEWER_OVERLAY_CORNER_SPECS.find((corner) => corner.id === cornerId) || null;
}

function normalizeViewerOverlayCorner(corner, fallback = "bottom-right") {
  const normalizedFallback = VIEWER_OVERLAY_CORNERS.has(fallback) ? fallback : "bottom-right";
  return VIEWER_OVERLAY_CORNERS.has(corner) ? corner : normalizedFallback;
}

function overlayCornerLabel(corner) {
  return viewerOverlayCornerSpec(corner)?.label || "Bottom right";
}

function normalizeBottomStripWorkspace(bottomStrip = {}) {
  const itemIds = normalizeBottomStripItemIds(bottomStrip?.itemIds, BOTTOM_STRIP_DEFAULT_ITEM_IDS);
  return {
    itemIds,
    hiddenItemIds: normalizeBottomStripHiddenItemIds(bottomStrip?.hiddenItemIds, itemIds)
  };
}

function mergeBottomStripWorkspace(defaultBottomStrip, storedBottomStrip) {
  return normalizeBottomStripWorkspace({
    ...normalizeBottomStripWorkspace(defaultBottomStrip),
    ...objectMap(storedBottomStrip)
  });
}

function validWorkspaceId(value) {
  return typeof value === "string" && /^[a-z][A-Za-z0-9.-]*$/.test(value);
}

function commandGroupId(command) {
  return command?.group || "other";
}

function toolbarGroups(commands = [], hidden = new Set(), collapsedGroups = new Set(), groupIds = []) {
  const groups = new Map();
  for (const command of commands) {
    const id = commandGroupId(command);
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: command.groupLabel || titleCase(id),
        icon: command.icon || "snap",
        count: 0,
        visibleCount: 0
      });
    }
    const group = groups.get(id);
    group.count += 1;
    if (!hidden.has(command.id) && !collapsedGroups.has(id)) group.visibleCount += 1;
  }
  const orderedGroupIds = normalizeToolbarGroupIds(groupIds, commands);
  return [
    ...orderedGroupIds.map((groupId) => groups.get(groupId)).filter(Boolean),
    ...[...groups.values()].filter((group) => !orderedGroupIds.includes(group.id))
  ];
}

function toolbarGroupLabel(groupId, commands = []) {
  const command = commands.find((item) => commandGroupId(item) === groupId);
  return commandGroupSpec(groupId)?.label || command?.groupLabel || titleCase(groupId);
}

function commandGroupsById(commands = []) {
  const groups = new Map();
  for (const command of commands) {
    const groupId = commandGroupId(command);
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push(command);
  }
  return groups;
}

export {
  VIEWER_OVERLAY_CORNER_SPECS,
  VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS,
  commandById,
  commandGroupId,
  commandGroupsById,
  defaultToolbarCommandIds,
  defaultWorkspaceSections,
  densityLabel,
  loadToolbarWorkspace,
  mergeBottomStripWorkspace,
  mergeNavigationWorkspace,
  mergePanelWorkspaceDefaults,
  mergeViewerOverlaysWorkspace,
  normalizeBottomStripWorkspace,
  normalizeCollapsedGroups,
  normalizeCommandGroupIds,
  normalizeDefaultWorkspace,
  normalizeDensity,
  normalizeNavigationWorkspace,
  normalizePanelActiveTab,
  normalizePanelConfigs,
  normalizePanelDock,
  normalizePanelHiddenTabIds,
  normalizePanelState,
  normalizePanelTabIds,
  normalizePanelTabs,
  normalizePanelWidth,
  normalizeTheme,
  normalizeToolbarDock,
  normalizeToolbarGroupIds,
  normalizeToolbarWorkspace,
  normalizeViewerOverlayCorner,
  normalizeViewerOverlaysWorkspace,
  normalizeViewerSettingsStripWorkspace,
  normalizeWorkspacePanelState,
  objectMap,
  overlayCornerLabel,
  panelConfigById,
  resolveCommands,
  systemTheme,
  themeLabel,
  toolbarCommandGroupIds,
  toolbarEligibleCommands,
  toolbarGroups,
  toolbarGroupLabel,
  toolbarStateForStorage,
  toolbarWorkspacePatch,
  uniqueStringIds,
  validWorkspaceId,
  viewerOverlayCornerSpec,
  viewerOverlayEntries,
  viewerOverlaySpec,
  viewerOverlayStateForStorage,
  viewerSettingsStripStateForStorage,
  workspaceDateStamp,
  workspacePreferencePayload,
  workspaceState,
  bottomStripStateForStorage,
  navigationStateForStorage,
  panelStateForStorage
};
