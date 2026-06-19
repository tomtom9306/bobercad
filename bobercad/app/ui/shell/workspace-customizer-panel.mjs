import { createIcon } from "../icons/icon-registry.mjs?v=pin-off-icon-1";
import { applyCommandState, applyTooltip, bindWorkspaceCustomizerRowReorderDrag, dockPinToggleControl, dockResizeHandleControl, dockRevealToggleControl, iconButton, segmentedControl, toolbarDragHandleControl, toolbarOverflowMenuItemControl, topbarMenuButton, workspaceCustomizerActionRow, workspaceCustomizerDragHandle, workspaceCustomizerMoveButton, workspaceCustomizerToggleRow } from "../design-system/ui-elements.mjs?v=toolbar-overflow-item-1";
import { BOTTOM_STRIP_DEFAULT_ITEM_IDS, BOTTOM_STRIP_ITEM_SPECS, bottomStripItemSpec, normalizeBottomStripHiddenItemIds, normalizeBottomStripItemIds } from "../commands/bottom-strip-metadata.mjs?v=bottom-strip-metadata-1";
import { COMMAND_GROUP_ORDER, commandGroupSpec } from "../commands/command-group-metadata.mjs?v=command-groups-1";
import { VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS, mergeViewerSettingsStripWorkspace, normalizeViewerSettingsStripWorkspace, viewerSettingsStripGroupSpec } from "../commands/settings-strip-metadata.mjs?v=render-visibility-1";
import {
  exportWorkspacePreferences,
  importWorkspacePreferences,
  readWorkspacePreferences,
  resetWorkspaceSectionStates,
  WORKSPACE_STORAGE_KEY,
  workspacePreferencesEnvelope,
  workspaceSectionStates,
  writeWorkspacePreferences
} from "./workspace-storage.mjs?v=viewer-overlays-1";

export { WORKSPACE_STORAGE_KEY };
const DEFAULT_TOOLBAR_DOCK = "top";
const DEFAULT_THEME = "light";
const DEFAULT_DENSITY = "compact";
const TOOLBAR_DOCKS = new Set(["top", "left", "right", "bottom"]);
const PANEL_DOCKS = new Set(["top", "left", "right", "bottom", "floating"]);
const WORKSPACE_THEMES = new Set(["light", "dark", "system"]);
const WORKSPACE_DENSITIES = new Set(["compact", "normal", "spacious"]);
const DEFAULT_PANEL_MIN_WIDTH = 220;
const DEFAULT_PANEL_MAX_WIDTH = 720;
const WORKSPACE_PANEL_PIN_ACTION = "workspace.panel.pin";
const WORKSPACE_PANEL_UNPIN_ACTION = "workspace.panel.unpin";
const WORKSPACE_TOOLBAR_GROUP_SELECTOR = ":scope > .bc-toolbar-group[data-workspace-toolbar-group]";
const PANEL_REVEAL_CONCEAL_GRACE_MS = 220;
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

function classNames(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" ");
}

export function withWorkspaceCommand(commands, workspaceCustomizer) {
  if (!workspaceCustomizer) return commands;
  return () => {
    const resolvedCommands = typeof commands === "function" ? commands() : commands;
    const baseCommands = Array.isArray(resolvedCommands) ? resolvedCommands : [];
    const hasCustomize = baseCommands.some((command) => command.id === "workspace.customize.open");
    const hasReset = baseCommands.some((command) => command.id === "workspace.reset");
    const hasToolbarReset = baseCommands.some((command) => command.id === "workspace.toolbar.reset");
    const hasImport = baseCommands.some((command) => command.id === "workspace.import");
    const hasExport = baseCommands.some((command) => command.id === "workspace.export");
    const pinCommands = workspaceCustomizer.toolbarPinCommands?.(baseCommands) || [];
    const panelPinCommands = workspaceCustomizer.panelPinCommands?.() || [];
    const workspaceState = workspaceCustomizer.state?.() || {};
    const panelTabCommands = workspacePanelTabCommands(workspaceCustomizer, workspaceState);
    const workspaceCommands = [];
    if (!hasCustomize) {
      workspaceCommands.push({
        id: "workspace.customize.open",
        action: "workspace.customize.open",
        label: "Customize",
        title: "Customize workspace",
        description: "Show theme, density, top navigation, toolbar, bottom strip, panel, import, export, and reset controls.",
        group: "tools",
        groupLabel: "Tools",
        ribbonSection: "layout",
        icon: "settings",
        run: () => workspaceCustomizer.open()
      });
    }
    if (!hasReset) {
      workspaceCommands.push({
        id: "workspace.reset",
        action: "workspace.reset",
        label: "Reset Workspace",
        title: "Reset workspace",
        description: "Restore default theme, density, top navigation, toolbars, bottom strip, panels, and disclosure sections.",
        group: "tools",
        groupLabel: "Tools",
        icon: "reset-view",
        run: () => workspaceCustomizer.resetWorkspace?.()
      });
    }
    if (!hasToolbarReset) {
      workspaceCommands.push({
        id: "workspace.toolbar.reset",
        action: "workspace.toolbar.reset",
        label: "Reset Toolbar",
        title: "Reset toolbar",
        description: "Restore the default modeling toolbar order, visibility, and dock without changing other workspace preferences.",
        group: "tools",
        groupLabel: "Tools",
        icon: "reset-view",
        run: () => workspaceCustomizer.resetToolbar?.()
      });
    }
    if (!hasImport) {
      workspaceCommands.push({
        id: "workspace.import",
        action: "workspace.import",
        label: "Import Workspace",
        title: "Import workspace",
        description: "Load a Bobercad UI workspace JSON file into the current workspace preferences.",
        group: "tools",
        groupLabel: "Tools",
        icon: "upload",
        run: () => workspaceCustomizer.importWorkspaceFile?.()
      });
    }
    if (!hasExport) {
      workspaceCommands.push({
        id: "workspace.export",
        action: "workspace.export",
        label: "Export Workspace",
        title: "Export workspace",
        description: "Download the current UI workspace preferences as JSON.",
        group: "tools",
        groupLabel: "Tools",
        icon: "download",
        run: () => workspaceCustomizer.exportWorkspace?.()
      });
    }
    for (const theme of ["light", "dark", "system"]) {
      const label = `${titleCase(theme)} Theme`;
      const active = normalizeTheme(workspaceState.theme) === theme;
      workspaceCommands.push({
        id: `workspace.theme.${theme}`,
        action: "workspace.theme",
        label,
        title: label,
        description: active ? `${label} is active.` : `Switch the workspace to ${themeLabel(theme)} theme.`,
        group: "tools",
        groupLabel: "Tools",
        icon: "settings",
        active,
        run: () => workspaceCustomizer.setTheme?.(theme)
      });
    }
    for (const density of ["compact", "normal", "spacious"]) {
      const label = `${titleCase(density)} Density`;
      const active = normalizeDensity(workspaceState.density) === density;
      workspaceCommands.push({
        id: `workspace.density.${density}`,
        action: "workspace.density",
        label,
        title: label,
        description: active ? `${label} is active.` : `Switch the workspace to ${densityLabel(density)} density.`,
        group: "tools",
        groupLabel: "Tools",
        icon: "settings",
        active,
        run: () => workspaceCustomizer.setDensity?.(density)
      });
    }
    const activeDock = normalizeToolbarDock(workspaceState.toolbars?.modeling?.dock);
    for (const [dock, label] of [
      ["top", "Top"],
      ["left", "Left"],
      ["right", "Right"],
      ["bottom", "Bottom"]
    ]) {
      const title = `Dock Toolbar ${label}`;
      const active = activeDock === dock;
      workspaceCommands.push({
        id: `workspace.toolbarDock.${dock}`,
        action: "workspace.toolbarDock",
        label: title,
        title,
        description: active ? `Toolbar is docked ${dock}.` : `Move the modeling toolbar to the ${dock} edge.`,
        group: "tools",
        groupLabel: "Tools",
        icon: "settings",
        active,
        run: () => workspaceCustomizer.setToolbarDock?.(dock)
      });
    }
    const featureNavbar = normalizeNavigationWorkspace(workspaceState.navigation).featureNavbar;
    const hiddenFeatureNavbarGroups = new Set(featureNavbar.hiddenGroupIds);
    for (const groupId of featureNavbar.groupIds) {
      const group = commandGroupSpec(groupId);
      if (!group) continue;
      const visible = !hiddenFeatureNavbarGroups.has(groupId);
      const action = visible ? "hide" : "show";
      const verb = visible ? "Hide" : "Show";
      const label = `${verb} ${group.label} Top Navigation`;
      workspaceCommands.push({
        id: `workspace.featureNavbar.${action}.${groupId}`,
        action: `workspace.featureNavbar.${action}`,
        label,
        title: label,
        description: visible
          ? `Remove ${group.label} from the top navigation.`
          : `Restore ${group.label} to the top navigation.`,
        group: "workspace",
        groupLabel: "Workspace",
        icon: group.icon || "settings",
        run: () => workspaceCustomizer.setFeatureNavbarGroupVisible?.(groupId, !visible)
      });
    }
    const bottomStrip = normalizeBottomStripWorkspace(workspaceState.bottomStrip);
    const hiddenBottomStripItems = new Set(bottomStrip.hiddenItemIds);
    for (const itemId of bottomStrip.itemIds) {
      const item = bottomStripItemSpec(itemId);
      if (!item) continue;
      const visible = !hiddenBottomStripItems.has(item.id);
      const action = visible ? "hide" : "show";
      const verb = visible ? "Hide" : "Show";
      const label = `${verb} ${item.label} Bottom Strip`;
      workspaceCommands.push({
        id: `workspace.bottomStrip.${action}.${item.id}`,
        action: `workspace.bottomStrip.${action}`,
        label,
        title: label,
        description: visible
          ? `Remove ${item.label} from the bottom interaction strip.`
          : `Restore ${item.label} to the bottom interaction strip.`,
        group: "workspace",
        groupLabel: "Workspace",
        icon: item.icon || "settings",
        run: () => workspaceCustomizer.setBottomStripItemVisible?.(item.id, !visible)
      });
    }
    const viewerSettingsStrip = normalizeViewerSettingsStripWorkspace(workspaceState.viewerSettingsStrip);
    const hiddenViewerSettingsStripGroups = new Set(viewerSettingsStrip.hiddenGroupIds);
    for (const groupId of viewerSettingsStrip.groupIds) {
      const group = viewerSettingsStripGroupSpec(groupId);
      if (!group) continue;
      const visible = !hiddenViewerSettingsStripGroups.has(group.id);
      const action = visible ? "hide" : "show";
      const verb = visible ? "Hide" : "Show";
      const label = `${verb} ${group.label} Settings Strip`;
      workspaceCommands.push({
        id: `workspace.settingsStrip.${action}.${group.id}`,
        action: `workspace.settingsStrip.${action}`,
        label,
        title: label,
        description: visible
          ? `Remove ${group.label} controls from the top viewer settings strip.`
          : `Restore ${group.label} controls to the top viewer settings strip.`,
        group: "workspace",
        groupLabel: "Workspace",
        icon: group.icon || "settings",
        run: () => workspaceCustomizer.setViewerSettingsStripGroupVisible?.(group.id, !visible)
      });
    }
    for (const overlay of viewerOverlayEntries(workspaceState.viewerOverlays)) {
      const visible = overlay.visible !== false;
      const action = visible ? "hide" : "show";
      const verb = visible ? "Hide" : "Show";
      const label = `${verb} ${overlay.label} Overlay`;
      workspaceCommands.push({
        id: `workspace.viewerOverlay.${action}.${overlay.id}`,
        action: `workspace.viewerOverlay.${action}`,
        label,
        title: label,
        description: visible
          ? `Remove ${overlay.label} from the viewer overlay controls.`
          : `Restore ${overlay.label} to the viewer overlay controls.`,
        group: "workspace",
        groupLabel: "Workspace",
        icon: overlay.icon || "view-orientation",
        run: () => workspaceCustomizer.setViewerOverlayVisible?.(overlay.id, !visible)
      });
      for (const corner of VIEWER_OVERLAY_CORNER_SPECS) {
        const active = overlay.corner === corner.id;
        const cornerLabel = `${overlay.label} ${corner.label}`;
        workspaceCommands.push({
          id: `workspace.viewerOverlay.corner.${overlay.id}.${corner.id}`,
          action: "workspace.viewerOverlay.corner",
          label: cornerLabel,
          title: cornerLabel,
          description: active
            ? `${overlay.label} is placed in the ${corner.label.toLowerCase()} corner.`
            : `Move ${overlay.label} to the ${corner.label.toLowerCase()} corner.`,
          group: "workspace",
          groupLabel: "Workspace",
          icon: overlay.icon || "view-orientation",
          active,
          run: () => workspaceCustomizer.setViewerOverlayCorner?.(overlay.id, corner.id)
        });
      }
    }
    return [
      ...baseCommands,
      ...pinCommands,
      ...panelPinCommands,
      ...panelTabCommands,
      ...workspaceCommands
    ];
  };
}

function workspacePanelTabCommands(workspaceCustomizer, workspaceState = {}) {
  const panelIds = Object.keys(workspaceState.panels || {});
  const commands = [];
  for (const panelId of panelIds) {
    const tabState = workspaceCustomizer.panelTabState?.(panelId);
    if (!tabState?.tabs?.length) continue;
    const hiddenTabIds = new Set(tabState.hiddenTabIds || []);
    const visibleCount = tabState.tabIds.filter((tabId) => !hiddenTabIds.has(tabId)).length;
    for (const tab of tabState.tabs) {
      const visible = !hiddenTabIds.has(tab.id);
      const action = visible ? "hide" : "show";
      const verb = visible ? "Hide" : "Show";
      const canToggle = !visible || visibleCount > 1;
      const panelLabel = tabState.panelLabel || panelId;
      commands.push({
        id: `workspace.panelTab.${action}.${panelId}.${tab.id}`,
        action: `workspace.panelTab.${action}`,
        label: `${verb} ${tab.label || titleCase(tab.id)} Tab`,
        title: `${verb} ${panelLabel} ${tab.label || titleCase(tab.id)} tab`,
        description: canToggle
          ? visible
            ? `Remove ${tab.label || tab.id} from ${panelLabel}.`
            : `Restore ${tab.label || tab.id} to ${panelLabel}.`
          : `${tab.label || tab.id} is the last visible ${panelLabel} tab.`,
        group: "workspace",
        groupLabel: "Workspace",
        icon: tab.icon || "database",
        enabled: canToggle,
        disabledReason: canToggle ? "" : `${tab.label || tab.id} is the last visible ${panelLabel} tab.`,
        run: () => {
          if (!canToggle) return;
          workspaceCustomizer.setPanelTabVisible?.(panelId, tab.id, !visible);
        }
      });
    }
  }
  return commands;
}

export function mountToolbarWorkspaceCustomization({
  toolbar,
  topbarActions,
  shell,
  commands = [],
  panels = [],
  defaultWorkspace = null,
  onWorkspaceChange,
  onStatusChange
} = {}) {
  if (!toolbar || !topbarActions || !shell) return null;
  const manager = createToolbarWorkspaceManager({ toolbar, commands, panels, defaultWorkspace, onWorkspaceChange, onStatusChange });
  const button = ensureWorkspaceCustomizeButton(topbarActions);
  const root = ensureWorkspaceCustomizerRoot(shell);
  const customizer = mountWorkspaceCustomizer({
    button,
    root,
    commands: manager.commands(),
    toolbarState: manager.state(),
    panelState: manager.panelState(),
    bottomStripState: manager.bottomStripState(),
    viewerSettingsStripState: manager.viewerSettingsStripState(),
    viewerOverlayState: manager.viewerOverlayState(),
    customizeMode: false,
    onCustomizeModeChange: (enabled) => manager.setCustomizeMode(enabled, customizer),
    onFeatureNavbarGroupVisibilityChange: (groupId, visible) => manager.setFeatureNavbarGroupVisible(groupId, visible, customizer),
    onFeatureNavbarGroupMove: (groupId, direction) => manager.moveFeatureNavbarGroup(groupId, direction, customizer),
    onFeatureNavbarGroupReorder: (sourceId, targetId) => manager.reorderFeatureNavbarGroup(sourceId, targetId, customizer),
    onGroupVisibilityChange: (groupId, visible) => manager.setGroupVisible(groupId, visible, customizer),
    onToolbarGroupMove: (groupId, direction) => manager.moveToolbarGroup(groupId, direction, customizer),
    onToolbarGroupReorder: (sourceId, targetId) => manager.reorderToolbarGroup(sourceId, targetId, customizer),
    onCommandVisibilityChange: (commandId, visible) => manager.setCommandVisible(commandId, visible, customizer),
    onCommandAdd: (commandId) => manager.addToolbarCommand(commandId, customizer),
    onCommandRemove: (commandId) => manager.removeToolbarCommand(commandId, customizer),
    onCommandMove: (commandId, direction) => manager.moveToolbarCommand(commandId, direction, customizer),
    onCommandReorder: (sourceId, targetId) => manager.reorderToolbarCommand(sourceId, targetId, customizer),
    onBottomStripVisibilityChange: (itemId, visible) => manager.setBottomStripItemVisible(itemId, visible, customizer),
    onBottomStripMove: (itemId, direction) => manager.moveBottomStripItem(itemId, direction, customizer),
    onBottomStripReorder: (sourceId, targetId) => manager.reorderBottomStripItem(sourceId, targetId, customizer),
    onViewerSettingsStripVisibilityChange: (groupId, visible) => manager.setViewerSettingsStripGroupVisible(groupId, visible, customizer),
    onViewerSettingsStripMove: (groupId, direction) => manager.moveViewerSettingsStripGroup(groupId, direction, customizer),
    onViewerSettingsStripReorder: (sourceId, targetId) => manager.reorderViewerSettingsStripGroup(sourceId, targetId, customizer),
    onViewerOverlayVisibilityChange: (overlayId, visible) => manager.setViewerOverlayVisible(overlayId, visible, customizer),
    onViewerOverlayCornerChange: (overlayId, corner) => manager.setViewerOverlayCorner(overlayId, corner, customizer),
    onPanelVisibilityChange: (panelId, visible) => manager.setPanelVisible(panelId, visible, customizer),
    onPanelPinChange: (panelId, pinned) => manager.setPanelPinned(panelId, pinned, customizer),
    onPanelDockChange: (panelId, dock) => manager.setPanelDock(panelId, dock, customizer),
    onPanelTabVisibilityChange: (panelId, tabId, visible) => manager.setPanelTabVisible(panelId, tabId, visible, customizer),
    onPanelTabMove: (panelId, tabId, direction) => manager.movePanelTab(panelId, tabId, direction, customizer),
    onPanelTabReorder: (panelId, sourceId, targetId) => manager.reorderPanelTab(panelId, sourceId, targetId, customizer),
    onToolbarDockChange: (dock) => manager.setToolbarDock(dock, customizer),
    onThemeChange: (theme) => manager.setTheme(theme, customizer),
    onDensityChange: (density) => manager.setDensity(density, customizer),
    onWorkspaceExport: () => manager.exportWorkspace(customizer),
    onWorkspaceImport: () => manager.chooseWorkspaceImport(customizer),
    onToolbarReset: () => manager.resetToolbar(customizer),
    onWorkspaceReset: () => manager.reset(customizer)
  });
  manager.apply(customizer);
  return {
    open: () => customizer?.open(),
    setCommands(nextCommands = []) {
      manager.setCommands(nextCommands);
      manager.apply(customizer);
    },
    refreshCommandState() {
      manager.refreshCommandState(customizer);
    },
    toolbarPinCommands(sourceCommands = []) {
      return manager.toolbarPinCommands(sourceCommands, customizer);
    },
    panelPinCommands() {
      return manager.panelPinCommands(customizer);
    },
    togglePanel(panelId) {
      return manager.togglePanel(panelId, customizer);
    },
    setPanelVisible(panelId, visible) {
      return manager.setPanelVisible(panelId, visible, customizer);
    },
    setPanelWidth(panelId, width) {
      return manager.setPanelWidth(panelId, width, customizer);
    },
    setPanelPinned(panelId, pinned) {
      return manager.setPanelPinned(panelId, pinned, customizer);
    },
    setPanelDock(panelId, dock) {
      manager.setPanelDock(panelId, dock, customizer);
      return workspaceState(manager.state());
    },
    togglePanelPinned(panelId) {
      return manager.togglePanelPinned(panelId, customizer);
    },
    panelPinned(panelId) {
      return manager.panelPinned(panelId);
    },
    panelActiveTab(panelId) {
      return manager.panelActiveTab(panelId);
    },
    panelTabState(panelId) {
      return manager.panelTabState(panelId);
    },
    setPanelActiveTab(panelId, tabId, options = {}) {
      return manager.setPanelActiveTab(panelId, tabId, customizer, options);
    },
    setPanelTabVisible(panelId, tabId, visible, options = {}) {
      return manager.setPanelTabVisible(panelId, tabId, visible, customizer, options);
    },
    movePanelTab(panelId, tabId, direction) {
      return manager.movePanelTab(panelId, tabId, direction, customizer);
    },
    reorderPanelTab(panelId, sourceId, targetId) {
      return manager.reorderPanelTab(panelId, sourceId, targetId, customizer);
    },
    panelVisible(panelId) {
      return manager.panelVisible(panelId);
    },
    state() {
      return workspaceState(manager.state());
    },
    setWorkspacePatch(patch = {}) {
      const state = manager.setWorkspacePatch(patch, customizer);
      return workspaceState(state);
    },
    setTheme(theme) {
      manager.setTheme(theme, customizer);
      return workspaceState(manager.state());
    },
    setDensity(density) {
      manager.setDensity(density, customizer);
      return workspaceState(manager.state());
    },
    setToolbarDock(dock) {
      manager.setToolbarDock(dock, customizer);
      return workspaceState(manager.state());
    },
    setFeatureNavbarGroupVisible(groupId, visible) {
      manager.setFeatureNavbarGroupVisible(groupId, visible, customizer);
      return workspaceState(manager.state());
    },
    moveFeatureNavbarGroup(groupId, direction) {
      manager.moveFeatureNavbarGroup(groupId, direction, customizer);
      return workspaceState(manager.state());
    },
    setBottomStripItemVisible(itemId, visible) {
      manager.setBottomStripItemVisible(itemId, visible, customizer);
      return workspaceState(manager.state());
    },
    moveBottomStripItem(itemId, direction) {
      manager.moveBottomStripItem(itemId, direction, customizer);
      return workspaceState(manager.state());
    },
    reorderToolbarCommand(sourceId, targetId) {
      manager.reorderToolbarCommand(sourceId, targetId, customizer);
      return workspaceState(manager.state());
    },
    reorderFeatureNavbarGroup(sourceId, targetId) {
      manager.reorderFeatureNavbarGroup(sourceId, targetId, customizer);
      return workspaceState(manager.state());
    },
    setViewerSettingsStripGroupVisible(groupId, visible) {
      manager.setViewerSettingsStripGroupVisible(groupId, visible, customizer);
      return workspaceState(manager.state());
    },
    moveViewerSettingsStripGroup(groupId, direction) {
      manager.moveViewerSettingsStripGroup(groupId, direction, customizer);
      return workspaceState(manager.state());
    },
    reorderViewerSettingsStripGroup(sourceId, targetId) {
      manager.reorderViewerSettingsStripGroup(sourceId, targetId, customizer);
      return workspaceState(manager.state());
    },
    setViewerOverlayVisible(overlayId, visible) {
      manager.setViewerOverlayVisible(overlayId, visible, customizer);
      return workspaceState(manager.state());
    },
    setViewerOverlayCorner(overlayId, corner) {
      manager.setViewerOverlayCorner(overlayId, corner, customizer);
      return workspaceState(manager.state());
    },
    resetWorkspace() {
      manager.reset(customizer);
      return workspaceState(manager.state());
    },
    resetToolbar() {
      manager.resetToolbar(customizer);
      return workspaceState(manager.state());
    },
    exportWorkspace() {
      return manager.exportWorkspace(customizer);
    },
    importWorkspaceFile() {
      manager.chooseWorkspaceImport(customizer);
    },
    importWorkspace(preferences = {}) {
      const state = manager.importWorkspace(preferences, customizer);
      return workspaceState(state);
    }
  };
}

function ensureWorkspaceCustomizeButton(topbarActions) {
  let button = document.getElementById("workspace-customize-open");
  if (!button) {
    button = document.createElement("button");
    button.id = "workspace-customize-open";
    button.type = "button";
    topbarActions.append(button);
  }
  return topbarMenuButton(button, {
    icon: "settings",
    label: "Settings",
    title: "Settings",
    ariaLabel: "Settings",
    className: "bc-workspace-customizer-trigger bc-topbar-menu-button",
    labelClassName: "bc-topbar-menu-label",
    hasPopup: "dialog",
    expanded: false
  });
}

function ensureWorkspaceCustomizerRoot(shell) {
  let root = document.getElementById("workspace-customizer");
  if (!root) {
    root = document.createElement("div");
    root.id = "workspace-customizer";
    root.hidden = true;
    shell.append(root);
  }
  root.classList.add("bc-workspace-customizer");
  return root;
}

function mountWorkspaceCustomizer({
  button,
  root,
  commands = [],
  toolbarState = { commandIds: [], hiddenCommandIds: [], dock: DEFAULT_TOOLBAR_DOCK },
  panelState = {},
  bottomStripState = { itemIds: BOTTOM_STRIP_DEFAULT_ITEM_IDS, hiddenItemIds: [] },
  viewerSettingsStripState = { groupIds: VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS, hiddenGroupIds: [] },
  viewerOverlayState = normalizeViewerOverlaysWorkspace(),
  customizeMode = false,
  onCustomizeModeChange,
  onFeatureNavbarGroupVisibilityChange,
  onFeatureNavbarGroupMove,
  onFeatureNavbarGroupReorder,
  onGroupVisibilityChange,
  onToolbarGroupMove,
  onToolbarGroupReorder,
  onCommandVisibilityChange,
  onCommandAdd,
  onCommandRemove,
  onCommandMove,
  onCommandReorder,
  onBottomStripVisibilityChange,
  onBottomStripMove,
  onBottomStripReorder,
  onViewerSettingsStripVisibilityChange,
  onViewerSettingsStripMove,
  onViewerSettingsStripReorder,
  onViewerOverlayVisibilityChange,
  onViewerOverlayCornerChange,
  onPanelVisibilityChange,
  onPanelPinChange,
  onPanelDockChange,
  onPanelTabVisibilityChange,
  onPanelTabMove,
  onPanelTabReorder,
  onToolbarDockChange,
  onThemeChange,
  onDensityChange,
  onWorkspaceExport,
  onWorkspaceImport,
  onToolbarReset,
  onWorkspaceReset
} = {}) {
  if (!root) return null;
  let currentToolbarState = toolbarState;
  let currentPanelState = panelState;
  let currentBottomStripState = normalizeBottomStripWorkspace(bottomStripState);
  let currentViewerSettingsStripState = normalizeViewerSettingsStripWorkspace(viewerSettingsStripState);
  let currentViewerOverlayState = normalizeViewerOverlaysWorkspace(viewerOverlayState);
  let currentCustomizeMode = Boolean(customizeMode);
  let currentCustomizerTab = "general";
  let returnFocusTo = null;

  root.hidden = true;
  button?.addEventListener("click", () => (root.hidden ? open() : close({ focusTrigger: false })));
  root.addEventListener("keydown", handlePanelKeydown);
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeydown);
  render();

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    setState({
      toolbarState: nextToolbarState = currentToolbarState,
      panelState: nextPanelState = currentPanelState,
      bottomStripState: nextBottomStripState = currentBottomStripState,
      viewerSettingsStripState: nextViewerSettingsStripState = currentViewerSettingsStripState,
      viewerOverlayState: nextViewerOverlayState = currentViewerOverlayState,
      customizeMode: nextCustomizeMode = currentCustomizeMode
    } = {}) {
      currentToolbarState = nextToolbarState;
      currentPanelState = nextPanelState;
      currentBottomStripState = normalizeBottomStripWorkspace(nextBottomStripState);
      currentViewerSettingsStripState = normalizeViewerSettingsStripWorkspace(nextViewerSettingsStripState);
      currentViewerOverlayState = normalizeViewerOverlaysWorkspace(nextViewerOverlayState);
      currentCustomizeMode = Boolean(nextCustomizeMode);
      render();
    }
  };

  function open() {
    returnFocusTo = focusReturnTarget();
    root.hidden = false;
    document.body?.classList.add("bc-workspace-customizer-open");
    button?.setAttribute("aria-expanded", "true");
    render();
    window.requestAnimationFrame(() => focusDialog());
  }

  function close({ focusTrigger = true } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    document.body?.classList.remove("bc-workspace-customizer-open");
    button?.setAttribute("aria-expanded", "false");
    if (focusTrigger) focusReturnTarget()?.focus?.();
  }

  function handlePanelKeydown(event) {
    if (event.key !== "Escape" || root.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  function handleDocumentKeydown(event) {
    if (event.key !== "Escape" || root.hidden || root.contains(event.target)) return;
    close();
  }

  function handleDocumentPointerDown(event) {
    if (root.hidden || root.contains(event.target) || button?.contains?.(event.target)) return;
    close({ focusTrigger: false });
  }

  function focusReturnTarget() {
    return returnFocusTo?.isConnected ? returnFocusTo : button;
  }

  function focusDialog() {
    const panel = root.querySelector(".bc-workspace-customizer-panel");
    panel?.focus?.({ preventScroll: true });
  }

  function render() {
    const hidden = new Set(currentToolbarState.hiddenCommandIds || []);
    const collapsedGroups = new Set(currentToolbarState.collapsedGroups || []);
    const commandById = new Map(commands.map((command) => [command.id, command]));
    const ordered = (currentToolbarState.commandIds || []).map((id) => commandById.get(id)).filter(Boolean);
    const commandIds = new Set(ordered.map((command) => command.id));
    const defaultCommandIds = new Set(currentToolbarState.defaultCommandIds || []);
    const available = commands.filter((command) => !commandIds.has(command.id));
    const groups = toolbarGroups(ordered, hidden, collapsedGroups, currentToolbarState.groupIds);
    const featureNavbar = normalizeNavigationWorkspace(currentToolbarState.navigation).featureNavbar;
    const hiddenFeatureGroups = new Set(featureNavbar.hiddenGroupIds);
    const viewerSettingsStrip = normalizeViewerSettingsStripWorkspace(currentViewerSettingsStripState);
    const hiddenViewerSettingsStripGroups = new Set(viewerSettingsStrip.hiddenGroupIds);
    const viewerOverlays = viewerOverlayEntries(currentViewerOverlayState);

    const panel = document.createElement("section");
    panel.className = "bc-workspace-customizer-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "workspace-customizer-title");
    panel.tabIndex = -1;

    const header = document.createElement("div");
    header.className = "bc-workspace-customizer-header";
    const title = document.createElement("div");
    title.id = "workspace-customizer-title";
    title.className = "bc-workspace-customizer-title";
    title.textContent = "Workspace Settings";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "bc-icon-button";
    closeButton.setAttribute("aria-label", "Close customize panel");
    applyTooltip(closeButton, "Close customize panel");
    closeButton.append(createIcon("cancel"));
    closeButton.addEventListener("click", close);
    header.append(title, closeButton);

    const modeRow = document.createElement("label");
    modeRow.className = "bc-workspace-customizer-mode";
    const modeInput = document.createElement("input");
    modeInput.type = "checkbox";
    modeInput.checked = currentCustomizeMode;
    modeInput.addEventListener("change", () => onCustomizeModeChange?.(modeInput.checked));
    const modeText = document.createElement("span");
    modeText.textContent = "Reorder mode";
    modeRow.append(modeInput, modeText);

    const dockRow = document.createElement("div");
    dockRow.className = "bc-workspace-customizer-dock";
    const dockLabel = document.createElement("span");
    dockLabel.className = "bc-workspace-customizer-dock-label";
    dockLabel.textContent = "Toolbar position";
    const dockOptions = segmentedControl({
      label: "Toolbar position",
      className: "bc-workspace-customizer-dock-options",
      items: [
        ["top", "Top"],
        ["left", "Left"],
        ["right", "Right"],
        ["bottom", "Bottom"]
      ].map(([id, label]) => ({
        id,
        label,
        title: `Dock toolbar ${id}`,
        active: currentToolbarState.dock === id
      })),
      onSelect: (item) => onToolbarDockChange?.(item.id)
    });
    dockRow.append(dockLabel, dockOptions);

    const themeRow = settingSegmentRow("Theme", [
      ["light", "Light"],
      ["dark", "Dark"],
      ["system", "System"]
    ], normalizeTheme(currentToolbarState.theme), onThemeChange);
    const densityRow = settingSegmentRow("Density", [
      ["compact", "Compact"],
      ["normal", "Normal"],
      ["spacious", "Spacious"]
    ], normalizeDensity(currentToolbarState.density), onDensityChange);

    const navTitle = sectionTitle("Top navigation");
    const navList = document.createElement("div");
    navList.className = "bc-workspace-customizer-list";
    for (const [index, groupId] of featureNavbar.groupIds.entries()) {
      const group = commandGroupSpec(groupId);
      const labelText = group?.label || titleCase(groupId);
      const isVisible = !hiddenFeatureGroups.has(groupId);
      const row = workspaceCustomizerToggleRow({
        dataset: { featureNavbarGroupId: groupId },
        active: isVisible,
        icon: group?.icon || "settings",
        label: labelText,
        description: group?.description || `Show ${labelText} commands in the top navigation.`,
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${labelText} in top navigation`,
        onToggle: () => onFeatureNavbarGroupVisibilityChange?.(groupId, !isVisible),
        actions: (rowNode) => [
          featureNavbarGroupDragHandle({ id: groupId, label: labelText }, rowNode),
          groupMoveButton({ id: groupId, label: labelText }, "up", index > 0, onFeatureNavbarGroupMove),
          groupMoveButton({ id: groupId, label: labelText }, "down", index < featureNavbar.groupIds.length - 1, onFeatureNavbarGroupMove)
        ]
      });
      navList.append(row);
    }

    const groupTitle = sectionTitle("Toolbar groups");
    const groupList = document.createElement("div");
    groupList.className = "bc-workspace-customizer-list";
    for (const [index, groupEntry] of groups.entries()) {
      const isVisible = !collapsedGroups.has(groupEntry.id);
      const row = workspaceCustomizerToggleRow({
        dataset: { toolbarGroupId: groupEntry.id },
        active: isVisible,
        icon: groupEntry.icon || "snap",
        label: groupEntry.label,
        description: isVisible
          ? `${groupEntry.visibleCount}/${groupEntry.count} commands shown`
          : `${groupEntry.count} commands hidden`,
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${groupEntry.label} toolbar group`,
        onToggle: () => onGroupVisibilityChange?.(groupEntry.id, !isVisible),
        actions: (rowNode) => [
          toolbarGroupDragHandle(groupEntry, rowNode),
          groupMoveButton(groupEntry, "up", index > 0, onToolbarGroupMove),
          groupMoveButton(groupEntry, "down", index < groups.length - 1, onToolbarGroupMove)
        ]
      });
      groupList.append(row);
    }

    const commandTitle = sectionTitle("Toolbar commands");
    const list = document.createElement("div");
    list.className = "bc-workspace-customizer-list";
    for (const [index, command] of ordered.entries()) {
      const groupHidden = collapsedGroups.has(commandGroupId(command));
      const isVisible = !hidden.has(command.id) && !groupHidden;
      const removable = !defaultCommandIds.has(command.id);
      const canMoveUp = index > 0;
      const canMoveDown = index < ordered.length - 1;
      const label = command.label || command.title || command.id;
      const description = groupHidden
        ? "Group hidden. Click to show this command and its group."
        : removable
          ? `${command.description || command.title || ""} Optional toolbar command.`
          : command.description || command.title || "";
      const row = workspaceCustomizerToggleRow({
        dataset: { commandId: command.id },
        active: isVisible,
        icon: command.icon || "snap",
        label,
        description,
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${label}`,
        onToggle: () => onCommandVisibilityChange?.(command.id, !isVisible),
        actions: (rowNode) => {
          const actions = [
            commandRowDragHandle(command, rowNode),
            commandMoveButton(command, "up", canMoveUp, onCommandMove),
            commandMoveButton(command, "down", canMoveDown, onCommandMove)
          ];
          if (removable) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "bc-icon-button bc-workspace-customizer-remove";
            const removeLabel = `Remove ${label} from toolbar`;
            remove.setAttribute("aria-label", removeLabel);
            applyTooltip(remove, removeLabel);
            remove.append(createIcon("cancel"));
            remove.addEventListener("click", () => onCommandRemove?.(command.id));
            actions.push(remove);
          }
          return actions;
        }
      });
      list.append(row);
    }

    const availableTitle = sectionTitle("Add commands");
    const availableList = document.createElement("div");
    availableList.className = "bc-workspace-customizer-list";
    for (const command of available) {
      const label = command.label || command.title || command.id;
      const row = workspaceCustomizerActionRow({
        dataset: { availableCommandId: command.id },
        icon: command.icon || "snap",
        label,
        description: command.description || command.title || "",
        ariaLabel: `Add ${label} to toolbar`,
        onClick: () => onCommandAdd?.(command.id)
      });
      availableList.append(row);
    }

    const bottomStripTitle = sectionTitle("Bottom strip");
    const bottomStripList = document.createElement("div");
    bottomStripList.className = "bc-workspace-customizer-list";
    const bottomStrip = normalizeBottomStripWorkspace(currentBottomStripState);
    const hiddenBottomItems = new Set(bottomStrip.hiddenItemIds);
    for (const [index, itemId] of bottomStrip.itemIds.entries()) {
      const item = bottomStripItemSpec(itemId);
      if (!item) continue;
      const isVisible = !hiddenBottomItems.has(item.id);
      const row = workspaceCustomizerToggleRow({
        dataset: { bottomStripItemId: item.id },
        active: isVisible,
        icon: item.icon || "settings",
        label: item.label || item.id,
        description: item.description || "",
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${item.label || item.id}`,
        onToggle: () => onBottomStripVisibilityChange?.(item.id, !isVisible),
        actions: (rowNode) => [
          bottomStripDragHandle(item, rowNode),
          itemMoveButton(item, "up", index > 0, onBottomStripMove),
          itemMoveButton(item, "down", index < bottomStrip.itemIds.length - 1, onBottomStripMove)
        ]
      });
      bottomStripList.append(row);
    }

    const viewerSettingsStripTitle = sectionTitle("Top settings strip");
    const viewerSettingsStripList = document.createElement("div");
    viewerSettingsStripList.className = "bc-workspace-customizer-list";
    for (const [index, groupId] of viewerSettingsStrip.groupIds.entries()) {
      const group = viewerSettingsStripGroupSpec(groupId);
      if (!group) continue;
      const isVisible = !hiddenViewerSettingsStripGroups.has(group.id);
      const row = workspaceCustomizerToggleRow({
        dataset: { viewerSettingsStripGroupId: group.id },
        active: isVisible,
        icon: group.icon || "settings",
        label: group.label || titleCase(group.id),
        description: group.description || `Show ${group.label || group.id} controls in the top settings strip.`,
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${group.label || group.id} in top settings strip`,
        onToggle: () => onViewerSettingsStripVisibilityChange?.(group.id, !isVisible),
        actions: (rowNode) => [
          viewerSettingsStripDragHandle(group, rowNode),
          itemMoveButton(group, "up", index > 0, onViewerSettingsStripMove),
          itemMoveButton(group, "down", index < viewerSettingsStrip.groupIds.length - 1, onViewerSettingsStripMove)
        ]
      });
      viewerSettingsStripList.append(row);
    }

    const viewerOverlayTitle = sectionTitle("Viewer overlays");
    const viewerOverlayList = document.createElement("div");
    viewerOverlayList.className = "bc-workspace-customizer-list";
    for (const overlay of viewerOverlays) {
      const isVisible = overlay.visible !== false;
      const row = workspaceCustomizerToggleRow({
        dataset: { viewerOverlayId: overlay.id },
        active: isVisible,
        icon: overlay.icon || "view-orientation",
        label: overlay.label,
        description: `${overlay.description} ${overlayCornerLabel(overlay.corner)} corner.`,
        ariaLabel: `${isVisible ? "Hide" : "Show"} ${overlay.label} viewer overlay`,
        onToggle: () => onViewerOverlayVisibilityChange?.(overlay.id, !isVisible),
        actions: [
          viewerOverlayCornerButtons(overlay, onViewerOverlayCornerChange)
        ]
      });
      viewerOverlayList.append(row);
    }

    const panelEntries = Object.values(currentPanelState || {});
    const panelsTitle = sectionTitle("Panels");
    const panelList = document.createElement("div");
    panelList.className = "bc-workspace-customizer-list";
    for (const panelEntry of panelEntries) {
      const description = [
        panelEntry.description,
        `${titleCase(panelEntry.dock || "floating")} dock`,
        `${panelEntry.width}px wide`,
        panelEntry.pinned ? "Pinned" : "Auto-hide"
      ].filter(Boolean).join(" ");
      const row = workspaceCustomizerToggleRow({
        dataset: { panelId: panelEntry.id },
        active: panelEntry.visible,
        icon: panelEntry.icon || "inspector",
        label: panelEntry.label || panelEntry.id,
        description,
        ariaLabel: `${panelEntry.visible ? "Hide" : "Show"} ${panelEntry.label || panelEntry.id}`,
        onToggle: () => onPanelVisibilityChange?.(panelEntry.id, !panelEntry.visible),
        actions: [
          panelDockButtons(panelEntry, onPanelDockChange),
          panelPinButton(panelEntry, onPanelPinChange)
        ]
      });
      panelList.append(row);
    }

    const panelTabSections = [];
    for (const panelEntry of panelEntries.filter((entry) => Array.isArray(entry.tabs) && entry.tabs.length)) {
      const tabTitle = sectionTitle(`${panelEntry.label || panelEntry.id} tabs`);
      const tabList = document.createElement("div");
      tabList.className = "bc-workspace-customizer-list";
      const tabById = new Map(panelEntry.tabs.map((tab) => [tab.id, tab]));
      const tabIds = Array.isArray(panelEntry.tabIds) && panelEntry.tabIds.length
        ? panelEntry.tabIds
        : panelEntry.tabs.map((tab) => tab.id);
      const hiddenTabIds = new Set(panelEntry.hiddenTabIds || []);
      const visibleCount = tabIds.filter((tabId) => !hiddenTabIds.has(tabId)).length;
      for (const [index, tabId] of tabIds.entries()) {
        const tab = tabById.get(tabId);
        if (!tab) continue;
        const isVisible = !hiddenTabIds.has(tab.id);
        const canToggle = !isVisible || visibleCount > 1;
        const row = workspaceCustomizerToggleRow({
          dataset: {
            panelTabPanelId: panelEntry.id,
            panelTabId: tab.id
          },
          active: isVisible,
          icon: tab.icon || panelEntry.icon || "database",
          label: tab.label || titleCase(tab.id),
          description: tab.description || `Show ${tab.label || tab.id} in ${panelEntry.label || panelEntry.id}.`,
          toggleDisabled: !canToggle,
          ariaLabel: canToggle
            ? `${isVisible ? "Hide" : "Show"} ${tab.label || tab.id} tab`
            : `${tab.label || tab.id} is the last visible tab`,
          onToggle: () => {
            if (!canToggle) return;
            onPanelTabVisibilityChange?.(panelEntry.id, tab.id, !isVisible);
          },
          actions: (rowNode) => [
            panelTabDragHandle(panelEntry, tab, rowNode),
            panelTabMoveButton(panelEntry, tab, "up", index > 0, onPanelTabMove),
            panelTabMoveButton(panelEntry, tab, "down", index < tabIds.length - 1, onPanelTabMove)
          ]
        });
        tabList.append(row);
      }
      panelTabSections.push({ title: tabTitle, list: tabList });
    }

    const actions = document.createElement("div");
    actions.className = "bc-workspace-customizer-actions";
    const importButton = workspaceActionButton("Import workspace", "upload", () => onWorkspaceImport?.());
    const exportButton = workspaceActionButton("Export workspace", "download", () => onWorkspaceExport?.());
    const resetToolbar = workspaceActionButton("Reset toolbar", "reset-view", () => onToolbarReset?.());
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "bc-button";
    reset.append(createIcon("reset-view"), document.createTextNode("Reset workspace"));
    reset.addEventListener("click", () => onWorkspaceReset?.());
    actions.append(importButton, exportButton, resetToolbar, reset);

    const tabSpecs = [
      {
        id: "general",
        label: "General",
        sections: [
          sectionBlock(sectionTitle("Appearance"), settingsList(themeRow, densityRow)),
          sectionBlock(sectionTitle("Editing"), settingsList(modeRow)),
          sectionBlock(sectionTitle("Toolbar placement"), settingsList(dockRow))
        ]
      },
      {
        id: "navigation",
        label: "Navigation",
        sections: [
          featureNavbar.groupIds.length ? sectionBlock(navTitle, navList) : null
        ].filter(Boolean)
      },
      {
        id: "toolbar",
        label: "Toolbar",
        sections: [
          groups.length ? sectionBlock(groupTitle, groupList) : null,
          sectionBlock(commandTitle, list),
          available.length ? sectionBlock(availableTitle, availableList) : null
        ].filter(Boolean)
      },
      {
        id: "viewer",
        label: "Viewer",
        sections: [
          viewerSettingsStrip.groupIds.length ? sectionBlock(viewerSettingsStripTitle, viewerSettingsStripList) : null,
          viewerOverlays.length ? sectionBlock(viewerOverlayTitle, viewerOverlayList) : null,
          bottomStrip.itemIds.length ? sectionBlock(bottomStripTitle, bottomStripList) : null
        ].filter(Boolean)
      },
      {
        id: "panels",
        label: "Panels",
        sections: [
          panelEntries.length ? sectionBlock(panelsTitle, panelList) : null,
          ...panelTabSections.map((section) => sectionBlock(section.title, section.list))
        ].filter(Boolean)
      }
    ];
    if (!tabSpecs.some((tab) => tab.id === currentCustomizerTab)) currentCustomizerTab = "general";

    const tabBar = workspaceTabBar(tabSpecs);
    const activeTab = tabSpecs.find((tab) => tab.id === currentCustomizerTab) || tabSpecs[0];
    const content = document.createElement("div");
    content.id = `workspace-customizer-tabpanel-${activeTab.id}`;
    content.className = "bc-workspace-customizer-content";
    content.setAttribute("role", "tabpanel");
    content.setAttribute("aria-labelledby", `workspace-customizer-tab-${activeTab.id}`);
    content.append(...activeTab.sections);

    panel.append(header, tabBar, content);
    panel.append(actions);
    root.replaceChildren(panel);
  }

  function workspaceTabBar(tabs = []) {
    const tabBar = document.createElement("div");
    tabBar.className = "bc-workspace-customizer-tabs";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", "Workspace settings categories");
    for (const tab of tabs) {
      const button = document.createElement("button");
      button.id = `workspace-customizer-tab-${tab.id}`;
      button.type = "button";
      button.className = "bc-workspace-customizer-tab";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", currentCustomizerTab === tab.id ? "true" : "false");
      button.setAttribute("aria-controls", `workspace-customizer-tabpanel-${tab.id}`);
      button.textContent = tab.label;
      button.addEventListener("click", () => {
        currentCustomizerTab = tab.id;
        render();
      });
      tabBar.append(button);
    }
    tabBar.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const ids = tabs.map((tab) => tab.id);
      const currentIndex = Math.max(0, ids.indexOf(currentCustomizerTab));
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? ids.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
      currentCustomizerTab = ids[nextIndex] || "general";
      render();
      root.querySelector(`#workspace-customizer-tab-${currentCustomizerTab}`)?.focus?.();
    });
    return tabBar;
  }

  function settingsList(...rows) {
    const list = document.createElement("div");
    list.className = "bc-workspace-customizer-list bc-workspace-customizer-settings-list";
    list.append(...rows.filter(Boolean));
    return list;
  }

  function sectionBlock(title, list) {
    const section = document.createElement("section");
    section.className = "bc-workspace-customizer-section";
    section.append(title, list);
    return section;
  }

  function sectionTitle(text) {
    const title = document.createElement("div");
    title.className = "bc-workspace-customizer-section-title";
    title.textContent = text;
    return title;
  }

  function workspaceActionButton(label, icon, onClick) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = "bc-button";
    control.append(createIcon(icon), document.createTextNode(label));
    control.addEventListener("click", () => onClick?.());
    return control;
  }

  function settingSegmentRow(labelText, options, currentValue, onChange) {
    const row = document.createElement("div");
    row.className = "bc-workspace-customizer-setting";
    const label = document.createElement("span");
    label.className = "bc-workspace-customizer-setting-label";
    label.textContent = labelText;
    const optionGroup = segmentedControl({
      label: labelText,
      className: "bc-workspace-customizer-segment-options",
      items: options.map(([id, label]) => ({
        id,
        label,
        title: `${labelText}: ${label}`,
        active: currentValue === id
      })),
      onSelect: (item) => onChange?.(item.id)
    });
    row.append(label, optionGroup);
    return row;
  }

  function commandMoveButton(command, direction, enabled, onMove) {
    return workspaceCustomizerMoveButton({
      label: command.label || command.title || command.id,
      direction,
      enabled,
      onClick: () => onMove?.(command.id, direction)
    });
  }

  function groupMoveButton(group, direction, enabled, onMove) {
    return workspaceCustomizerMoveButton({
      label: group.label || group.id,
      direction,
      enabled,
      onClick: () => onMove?.(group.id, direction)
    });
  }

  function itemMoveButton(item, direction, enabled, onMove) {
    return workspaceCustomizerMoveButton({
      label: item.label || item.id,
      direction,
      enabled,
      onClick: () => onMove?.(item.id, direction)
    });
  }

  function panelTabMoveButton(panel, tab, direction, enabled, onMove) {
    return workspaceCustomizerMoveButton({
      label: tab.label || tab.id,
      direction,
      enabled,
      onClick: () => onMove?.(panel.id, tab.id, direction)
    });
  }

  function panelTabDragHandle(panel, tab, row) {
    const label = tab.label || tab.id;
    return workspaceCustomizerDragHandle({
      id: tab.id,
      dataset: { panelTabPanelId: panel.id },
      datasetKey: "panelTabDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder ${panel.label || panel.id} tabs`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-panel-tab-id]",
        sourceDatasetKey: "panelTabDragHandle",
        targetDatasetKey: "panelTabId",
        scopeDatasetKey: "panelTabPanelId",
        onReorder: ({ scopeId, sourceId, targetId }) => onPanelTabReorder?.(scopeId, sourceId, targetId)
      })
    });
  }

  function commandRowDragHandle(command, row) {
    const label = command.label || command.title || command.id;
    return workspaceCustomizerDragHandle({
      id: command.id,
      datasetKey: "commandRowDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder toolbar`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-command-id]",
        sourceDatasetKey: "commandRowDragHandle",
        targetDatasetKey: "commandId",
        onReorder: ({ sourceId, targetId }) => onCommandReorder?.(sourceId, targetId)
      })
    });
  }

  function featureNavbarGroupDragHandle(group, row) {
    const label = group.label || group.id;
    return workspaceCustomizerDragHandle({
      id: group.id,
      datasetKey: "featureNavbarDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder top navigation`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-feature-navbar-group-id]",
        sourceDatasetKey: "featureNavbarDragHandle",
        targetDatasetKey: "featureNavbarGroupId",
        onReorder: ({ sourceId, targetId }) => onFeatureNavbarGroupReorder?.(sourceId, targetId)
      })
    });
  }

  function toolbarGroupDragHandle(group, row) {
    const label = group.label || group.id;
    return workspaceCustomizerDragHandle({
      id: group.id,
      datasetKey: "toolbarGroupDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder toolbar groups`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-toolbar-group-id]",
        sourceDatasetKey: "toolbarGroupDragHandle",
        targetDatasetKey: "toolbarGroupId",
        onReorder: ({ sourceId, targetId }) => onToolbarGroupReorder?.(sourceId, targetId)
      })
    });
  }

  function bottomStripDragHandle(item, row) {
    const label = item.label || item.id;
    return workspaceCustomizerDragHandle({
      id: item.id,
      datasetKey: "bottomStripDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder bottom strip`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-bottom-strip-item-id]",
        sourceDatasetKey: "bottomStripDragHandle",
        targetDatasetKey: "bottomStripItemId",
        onReorder: ({ sourceId, targetId }) => onBottomStripReorder?.(sourceId, targetId)
      })
    });
  }

  function viewerSettingsStripDragHandle(group, row) {
    const label = group.label || group.id;
    return workspaceCustomizerDragHandle({
      id: group.id,
      datasetKey: "viewerSettingsStripDragHandle",
      label,
      enabled: currentCustomizeMode,
      enabledTitle: `Drag ${label} to reorder top settings strip`,
      onBind: (button) => bindWorkspaceCustomizerRowReorderDrag({
        root,
        handle: button,
        row,
        enabled: () => currentCustomizeMode,
        rowSelector: ".bc-workspace-customizer-row[data-viewer-settings-strip-group-id]",
        sourceDatasetKey: "viewerSettingsStripDragHandle",
        targetDatasetKey: "viewerSettingsStripGroupId",
        onReorder: ({ sourceId, targetId }) => onViewerSettingsStripReorder?.(sourceId, targetId)
      })
    });
  }

  function panelPinButton(panel, onPinChange) {
    const label = panel.label || panel.id;
    const pinned = panel.pinned !== false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bc-icon-button bc-workspace-customizer-pin";
    const tooltip = `${pinned ? "Unpin" : "Pin"} ${label}`;
    button.setAttribute("aria-label", tooltip);
    button.setAttribute("aria-pressed", pinned ? "true" : "false");
    button.dataset.panelPinned = pinned ? "true" : "false";
    applyTooltip(button, tooltip);
    button.append(createIcon(pinned ? "pin-off" : "pin"));
    button.addEventListener("click", () => onPinChange?.(panel.id, !pinned));
    return button;
  }

  function panelDockButtons(panel, onDockChange) {
    const currentDock = normalizePanelDock(panel.dock);
    return segmentedControl({
      label: `${panel.label || panel.id} dock position`,
      className: "bc-workspace-customizer-panel-dock-options",
      items: [
        ["left", "L"],
        ["right", "R"],
        ["top", "T"],
        ["bottom", "B"],
        ["floating", "F"]
      ].map(([id, label]) => ({
        id,
        label,
        title: `Dock ${panel.label || panel.id} ${id}`,
        active: currentDock === id
      })),
      onSelect: (item) => onDockChange?.(panel.id, item.id)
    });
  }

  function viewerOverlayCornerButtons(overlay, onCornerChange) {
    return segmentedControl({
      label: `${overlay.label} corner`,
      className: "bc-workspace-customizer-overlay-corner-options",
      items: VIEWER_OVERLAY_CORNER_SPECS.map((corner) => ({
        id: corner.id,
        label: corner.shortLabel,
        title: `Move ${overlay.label} to ${corner.label.toLowerCase()}`,
        active: overlay.corner === corner.id
      })),
      onSelect: (item) => onCornerChange?.(overlay.id, item.id)
    });
  }
}

function createToolbarWorkspaceManager({ toolbar, commands, panels = [], defaultWorkspace = null, onWorkspaceChange, onStatusChange } = {}) {
  const toolbarBand = toolbar.closest(".bc-toolbar-band");
  const toolbarDragHandle = ensureToolbarDragHandle(toolbarBand);
  let toolbarOverflow = null;
  let toolbarResizeBound = false;
  let toolbarOverflowFrame = 0;
  let commandSource = commands;
  let toolbarCommands = toolbarEligibleCommands(resolveCommands(commandSource));
  let panelConfigs = normalizePanelConfigs(panels);
  let defaultCommandIds = defaultToolbarCommandIds(toolbarCommands, defaultWorkspace);
  let workspace = loadToolbarWorkspace(defaultWorkspaceState(), knownToolbarCommandIds(), panelConfigs, toolbarCommands);
  let customizeMode = false;
  let customizerRef = null;

  return {
    commands: () => toolbarCommands,
    state,
    setCommands(nextCommands = []) {
      commandSource = nextCommands;
      refreshCommands({ normalize: true });
    },
    refreshCommandState(customizer) {
      customizerRef = customizer || customizerRef;
      refreshCommands();
      applyToolbarWorkspace();
      syncCustomizer();
    },
    panelState,
    bottomStripState,
    viewerSettingsStripState,
    viewerOverlayState,
    setCustomizeMode(enabled, customizer) {
      customizerRef = customizer || customizerRef;
      customizeMode = Boolean(enabled);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(customizeMode ? "Toolbar customize mode on." : "Toolbar customize mode off.");
    },
    setFeatureNavbarGroupVisible(groupId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const navigation = normalizeNavigationWorkspace(workspace.navigation);
      if (!navigation.featureNavbar.groupIds.includes(groupId)) return;
      const hiddenGroupIds = new Set(navigation.featureNavbar.hiddenGroupIds);
      if (visible) hiddenGroupIds.delete(groupId);
      else hiddenGroupIds.add(groupId);
      workspace.navigation = normalizeNavigationWorkspace({
        featureNavbar: {
          ...navigation.featureNavbar,
          hiddenGroupIds: [...hiddenGroupIds]
        }
      });
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${navigationGroupLabel(groupId)} navigation group ${visible ? "shown" : "hidden"}.`);
    },
    moveFeatureNavbarGroup(groupId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const nextNavigation = moveFeatureNavbarGroupByDirection(workspace.navigation, groupId, direction);
      if (nextNavigation === workspace.navigation) return;
      workspace.navigation = nextNavigation;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${navigationGroupLabel(groupId)} navigation group moved ${direction}.`);
    },
    reorderFeatureNavbarGroup(sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const nextNavigation = moveFeatureNavbarGroupBefore(workspace.navigation, sourceId, targetId);
      if (nextNavigation === workspace.navigation) return;
      workspace.navigation = nextNavigation;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${navigationGroupLabel(sourceId)} navigation group moved before ${navigationGroupLabel(targetId)}.`);
    },
    setGroupVisible(groupId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const collapsedGroups = new Set(workspace.collapsedGroups);
      if (visible) collapsedGroups.delete(groupId);
      else collapsedGroups.add(groupId);
      workspace.collapsedGroups = normalizeCollapsedGroups([...collapsedGroups]);
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${toolbarGroupLabel(groupId, toolbarCommands)} group ${visible ? "shown" : "hidden"}.`);
    },
    moveToolbarGroup(groupId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const nextWorkspace = moveToolbarGroupByDirection(workspace, groupId, direction, toolbarCommands);
      if (nextWorkspace === workspace) return;
      workspace = nextWorkspace;
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${toolbarGroupLabel(groupId, toolbarCommands)} group moved ${direction}.`);
    },
    reorderToolbarGroup(sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const nextWorkspace = moveToolbarGroupBefore(workspace, sourceId, targetId, toolbarCommands);
      if (nextWorkspace === workspace) return;
      workspace = nextWorkspace;
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${toolbarGroupLabel(sourceId, toolbarCommands)} group moved before ${toolbarGroupLabel(targetId, toolbarCommands)}.`);
    },
    setCommandVisible(commandId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const hidden = new Set(workspace.hiddenCommandIds);
      if (visible) hidden.delete(commandId);
      else hidden.add(commandId);
      if (visible) {
        const command = commandById(toolbarCommands, commandId);
        workspace.collapsedGroups = workspace.collapsedGroups.filter((groupId) => groupId !== commandGroupId(command));
      }
      workspace.hiddenCommandIds = [...hidden].filter((id) => workspace.commandIds.includes(id));
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(visible ? "Toolbar command shown." : "Toolbar command hidden.");
    },
    addToolbarCommand(commandId, customizer) {
      customizerRef = customizer || customizerRef;
      const command = commandById(toolbarCommands, commandId);
      if (!command || workspace.commandIds.includes(command.id)) return;
      workspace.commandIds = [...workspace.commandIds, command.id]
        .filter((id, index, values) => values.indexOf(id) === index);
      workspace.hiddenCommandIds = workspace.hiddenCommandIds.filter((id) => id !== command.id && workspace.commandIds.includes(id));
      workspace.groupIds = normalizeToolbarGroupIds([...workspace.groupIds, commandGroupId(command)], toolbarCommands);
      workspace.collapsedGroups = workspace.collapsedGroups.filter((groupId) => groupId !== commandGroupId(command));
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${command.label || command.title || command.id} added to toolbar.`);
    },
    removeToolbarCommand(commandId, customizer) {
      customizerRef = customizer || customizerRef;
      if (defaultCommandIds.includes(commandId)) return;
      const command = commandById(toolbarCommands, commandId);
      workspace.commandIds = workspace.commandIds.filter((id) => id !== commandId);
      workspace.hiddenCommandIds = workspace.hiddenCommandIds.filter((id) => id !== commandId && workspace.commandIds.includes(id));
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${command?.label || command?.title || commandId} removed from toolbar.`);
    },
    moveToolbarCommand(commandId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const command = commandById(toolbarCommands, commandId);
      const nextWorkspace = moveToolbarCommandByDirection(workspace, commandId, direction);
      if (nextWorkspace === workspace) return;
      workspace = nextWorkspace;
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${command?.label || command?.title || commandId} moved ${direction}.`);
    },
    reorderToolbarCommand(sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const command = commandById(toolbarCommands, sourceId);
      const target = commandById(toolbarCommands, targetId);
      const nextWorkspace = moveToolbarCommand(workspace, sourceId, targetId);
      if (nextWorkspace === workspace) return;
      workspace = nextWorkspace;
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`${command?.label || command?.title || sourceId} moved before ${target?.label || target?.title || targetId}.`);
    },
    setBottomStripItemVisible(itemId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const item = bottomStripItemSpec(itemId);
      if (!item || !workspace.bottomStrip?.itemIds?.includes(item.id)) return;
      const hidden = new Set(workspace.bottomStrip.hiddenItemIds || []);
      if (visible) hidden.delete(item.id);
      else hidden.add(item.id);
      workspace.bottomStrip = normalizeBottomStripWorkspace({
        ...workspace.bottomStrip,
        hiddenItemIds: [...hidden]
      });
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${item.label} ${visible ? "shown" : "hidden"} in bottom strip.`);
    },
    moveBottomStripItem(itemId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const item = bottomStripItemSpec(itemId);
      if (!item) return;
      const nextBottomStrip = moveBottomStripItemByDirection(workspace.bottomStrip, item.id, direction);
      if (nextBottomStrip === workspace.bottomStrip) return;
      workspace.bottomStrip = nextBottomStrip;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${item.label} moved ${direction} in bottom strip.`);
    },
    reorderBottomStripItem(sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const item = bottomStripItemSpec(sourceId);
      const target = bottomStripItemSpec(targetId);
      if (!item || !target) return;
      const nextBottomStrip = moveBottomStripItemBefore(workspace.bottomStrip, item.id, target.id);
      if (nextBottomStrip === workspace.bottomStrip) return;
      workspace.bottomStrip = nextBottomStrip;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${item.label} moved before ${target.label} in bottom strip.`);
    },
    setViewerSettingsStripGroupVisible(groupId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const group = viewerSettingsStripGroupSpec(groupId);
      if (!group || !workspace.viewerSettingsStrip?.groupIds?.includes(group.id)) return;
      const hidden = new Set(workspace.viewerSettingsStrip.hiddenGroupIds || []);
      if (visible) hidden.delete(group.id);
      else hidden.add(group.id);
      workspace.viewerSettingsStrip = normalizeViewerSettingsStripWorkspace({
        ...workspace.viewerSettingsStrip,
        hiddenGroupIds: [...hidden]
      });
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${group.label} ${visible ? "shown" : "hidden"} in top settings strip.`);
    },
    moveViewerSettingsStripGroup(groupId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const group = viewerSettingsStripGroupSpec(groupId);
      if (!group) return;
      const nextViewerSettingsStrip = moveViewerSettingsStripGroupByDirection(workspace.viewerSettingsStrip, group.id, direction);
      if (nextViewerSettingsStrip === workspace.viewerSettingsStrip) return;
      workspace.viewerSettingsStrip = nextViewerSettingsStrip;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${group.label} moved ${direction} in top settings strip.`);
    },
    reorderViewerSettingsStripGroup(sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const group = viewerSettingsStripGroupSpec(sourceId);
      const target = viewerSettingsStripGroupSpec(targetId);
      if (!group || !target) return;
      const nextViewerSettingsStrip = moveViewerSettingsStripGroupBefore(workspace.viewerSettingsStrip, group.id, target.id);
      if (nextViewerSettingsStrip === workspace.viewerSettingsStrip) return;
      workspace.viewerSettingsStrip = nextViewerSettingsStrip;
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${group.label} moved before ${target.label} in top settings strip.`);
    },
    setViewerOverlayVisible(overlayId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const spec = viewerOverlaySpec(overlayId);
      if (!spec) return false;
      const current = normalizeViewerOverlaysWorkspace(workspace.viewerOverlays);
      const nextVisible = Boolean(visible);
      if (current[spec.id]?.visible === nextVisible) return nextVisible;
      workspace.viewerOverlays = normalizeViewerOverlaysWorkspace({
        ...current,
        [spec.id]: {
          ...current[spec.id],
          visible: nextVisible
        }
      });
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${spec.label} overlay ${nextVisible ? "shown" : "hidden"}.`);
      return workspace.viewerOverlays[spec.id]?.visible !== false;
    },
    setViewerOverlayCorner(overlayId, corner, customizer) {
      customizerRef = customizer || customizerRef;
      const spec = viewerOverlaySpec(overlayId);
      const cornerSpec = viewerOverlayCornerSpec(corner);
      if (!spec || !cornerSpec) return "";
      const current = normalizeViewerOverlaysWorkspace(workspace.viewerOverlays);
      if (current[spec.id]?.corner === cornerSpec.id) return cornerSpec.id;
      workspace.viewerOverlays = normalizeViewerOverlaysWorkspace({
        ...current,
        [spec.id]: {
          ...current[spec.id],
          corner: cornerSpec.id
        }
      });
      saveToolbarWorkspace(workspace);
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${spec.label} moved to ${cornerSpec.label.toLowerCase()}.`);
      return workspace.viewerOverlays[spec.id]?.corner || cornerSpec.id;
    },
    setPanelVisible(panelId, visible, customizer) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel) return false;
      workspace.panels[panel.id] = normalizePanelState({
        ...(workspace.panels[panel.id] || {}),
        visible: Boolean(visible)
      }, panel);
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      syncCustomizer();
      setToolbarStatus(`${panel.label} ${workspace.panels[panel.id].visible ? "shown" : "hidden"}.`);
      return workspace.panels[panel.id].visible;
    },
    setPanelWidth(panelId, width, customizer, options = {}) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel) return 0;
      const nextWidth = normalizePanelWidth(width, panel);
      workspace.panels[panel.id] = normalizePanelState({
        ...(workspace.panels[panel.id] || {}),
        width: nextWidth
      }, panel);
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      syncCustomizer();
      if (options.notify !== false) setToolbarStatus(`${panel.label} width ${nextWidth}px.`);
      return nextWidth;
    },
    setPanelPinned(panelId, pinned, customizer, options = {}) {
      return setPanelPinned(panelId, pinned, customizer, options);
    },
    setPanelDock(panelId, dock, customizer, options = {}) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel) return "";
      const current = normalizePanelState(workspace.panels[panel.id], panel);
      const nextDock = normalizePanelDock(dock, current.dock);
      if (current.dock === nextDock) return current.dock;
      const occupant = panelConfigs.find((candidate) => candidate.id !== panel.id
        && normalizePanelState(workspace.panels[candidate.id], candidate).dock === nextDock);
      workspace.panels[panel.id] = normalizePanelState({
        ...current,
        dock: nextDock
      }, panel);
      if (occupant && isSidePanelDock(nextDock)) {
        const occupantState = normalizePanelState(workspace.panels[occupant.id], occupant);
        workspace.panels[occupant.id] = normalizePanelState({
          ...occupantState,
          dock: current.dock
        }, occupant);
      }
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      syncCustomizer();
      if (options.notify !== false) setToolbarStatus(`${panel.label} docked ${nextDock}.`);
      return workspace.panels[panel.id].dock;
    },
    togglePanelPinned(panelId, customizer) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel) return false;
      const current = workspace.panels[panel.id]?.pinned !== false;
      return setPanelPinned(panelId, !current, customizerRef);
    },
    panelPinned(panelId) {
      const panel = panelConfigById(panelConfigs, panelId);
      return panel ? workspace.panels[panel.id]?.pinned !== false : false;
    },
    togglePanel(panelId, customizer) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel) return false;
      const current = workspace.panels[panel.id]?.visible !== false;
      return this.setPanelVisible(panelId, !current, customizerRef);
    },
    panelVisible(panelId) {
      const panel = panelConfigById(panelConfigs, panelId);
      return panel ? workspace.panels[panel.id]?.visible !== false : false;
    },
    panelTabState(panelId) {
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel?.tabs.length) return null;
      return panelTabStateForPanel(panel, workspace.panels[panel.id]);
    },
    panelActiveTab(panelId) {
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel?.tabs.length) return "";
      return normalizePanelActiveTab(workspace.panels[panel.id]?.activeTab, panel, workspace.panels[panel.id]);
    },
    setPanelActiveTab(panelId, tabId, customizer, options = {}) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      if (!panel?.tabs.length) return "";
      const activeTab = normalizePanelActiveTab(tabId, panel, workspace.panels[panel.id]);
      workspace.panels[panel.id] = normalizePanelState({
        ...(workspace.panels[panel.id] || {}),
        activeTab
      }, panel);
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      syncCustomizer();
      if (options.notify !== false) {
        const tab = panel.tabs.find((item) => item.id === activeTab);
        setToolbarStatus(`${panel.label}: ${tab?.label || activeTab}.`);
      }
      return activeTab;
    },
    setPanelTabVisible(panelId, tabId, visible, customizer, options = {}) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      const tab = panel?.tabs.find((item) => item.id === tabId);
      if (!panel?.tabs.length || !tab) return null;
      const state = normalizePanelState(workspace.panels[panel.id], panel);
      const hiddenTabIds = new Set(state.hiddenTabIds);
      if (visible) {
        hiddenTabIds.delete(tab.id);
      } else {
        const visibleIds = state.tabIds.filter((id) => !hiddenTabIds.has(id));
        if (visibleIds.length <= 1 && visibleIds.includes(tab.id)) {
          if (options.notify !== false) setToolbarStatus(`${tab.label} is the last visible ${panel.label} tab.`);
          return panelTabStateForPanel(panel, state);
        }
        hiddenTabIds.add(tab.id);
      }
      workspace.panels[panel.id] = normalizePanelState({
        ...state,
        hiddenTabIds: [...hiddenTabIds]
      }, panel);
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      if (options.notify !== false) setToolbarStatus(`${tab.label} tab ${visible ? "shown" : "hidden"} in ${panel.label}.`);
      return panelTabStateForPanel(panel, workspace.panels[panel.id]);
    },
    movePanelTab(panelId, tabId, direction, customizer) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      const tab = panel?.tabs.find((item) => item.id === tabId);
      if (!panel?.tabs.length || !tab) return null;
      const nextPanelState = movePanelTabByDirection(workspace.panels[panel.id], panel, tab.id, direction);
      if (nextPanelState === workspace.panels[panel.id]) return panelTabStateForPanel(panel, workspace.panels[panel.id]);
      workspace.panels[panel.id] = nextPanelState;
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${tab.label} tab moved ${direction} in ${panel.label}.`);
      return panelTabStateForPanel(panel, workspace.panels[panel.id]);
    },
    reorderPanelTab(panelId, sourceId, targetId, customizer) {
      customizerRef = customizer || customizerRef;
      const panel = panelConfigById(panelConfigs, panelId);
      const source = panel?.tabs.find((item) => item.id === sourceId);
      const target = panel?.tabs.find((item) => item.id === targetId);
      if (!panel?.tabs.length || !source || !target) return null;
      const nextPanelState = movePanelTabBefore(workspace.panels[panel.id], panel, source.id, target.id);
      if (nextPanelState === workspace.panels[panel.id]) return panelTabStateForPanel(panel, workspace.panels[panel.id]);
      workspace.panels[panel.id] = nextPanelState;
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus(`${source.label} tab moved before ${target.label} in ${panel.label}.`);
      return panelTabStateForPanel(panel, workspace.panels[panel.id]);
    },
    toolbarPinCommands(sourceCommands = [], customizer) {
      customizerRef = customizer || customizerRef;
      refreshCommands();
      const hidden = new Set(workspace.hiddenCommandIds);
      const collapsedGroups = new Set(workspace.collapsedGroups);
      const workspaceCommandIds = new Set(workspace.commandIds);
      const toolbarCommandIds = new Set(toolbarCommands.map((command) => command.id));
      const commandsById = new Map(sourceCommands.map((command) => [command.id, command]));
      const showGroupCommands = toolbarGroups(
        workspace.commandIds.map((commandId) => commandsById.get(commandId) || commandById(toolbarCommands, commandId)).filter(Boolean),
        hidden,
        collapsedGroups,
        workspace.groupIds
      )
        .filter((groupEntry) => collapsedGroups.has(groupEntry.id))
        .map((groupEntry) => ({
          id: `workspace.toolbar.showGroup.${groupEntry.id}`,
          action: "workspace.toolbar.showGroup",
          label: `Show ${groupEntry.label} group`,
          title: `Show ${groupEntry.label} toolbar group`,
          description: `Restore the ${groupEntry.label} commands to the modeling toolbar.`,
          group: "workspace",
          groupLabel: "Workspace",
          icon: groupEntry.icon || "snap",
          run: () => {
            if (!workspace.collapsedGroups.includes(groupEntry.id)) return;
            workspace.collapsedGroups = workspace.collapsedGroups.filter((groupId) => groupId !== groupEntry.id);
            saveToolbarWorkspace(workspace);
            applyToolbarWorkspace();
            syncCustomizer();
            setToolbarStatus(`${groupEntry.label} group shown.`);
          }
        }));
      const showCommands = workspace.commandIds
        .filter((commandId) => hidden.has(commandId))
        .map((commandId) => commandsById.get(commandId) || commandById(toolbarCommands, commandId))
        .filter(Boolean)
        .map((command) => ({
          id: `workspace.toolbar.show.${command.id}`,
          action: "workspace.toolbar.show",
          label: `Show ${command.label || command.title || command.id}`,
          title: `Show ${command.label || command.title || command.id} in toolbar`,
          description: `Add ${command.label || command.title || command.id} back to the modeling toolbar.`,
          group: "workspace",
          groupLabel: "Workspace",
          icon: command.icon || "snap",
          run: () => {
            const nextHidden = new Set(workspace.hiddenCommandIds);
            if (!nextHidden.has(command.id)) return;
            nextHidden.delete(command.id);
            workspace.hiddenCommandIds = [...nextHidden].filter((id) => workspace.commandIds.includes(id));
            workspace.collapsedGroups = workspace.collapsedGroups.filter((groupId) => groupId !== commandGroupId(command));
            saveToolbarWorkspace(workspace);
            applyToolbarWorkspace();
            syncCustomizer();
            setToolbarStatus(`${command.label || command.title || command.id} shown in toolbar.`);
          }
        }));
      const pinCommands = sourceCommands
        .filter((command) => toolbarCommandIds.has(command.id) && !workspaceCommandIds.has(command.id))
        .map((command) => ({
          id: `workspace.toolbar.pin.${command.id}`,
          action: "workspace.toolbar.pin",
          label: `Pin ${command.label || command.title || command.id}`,
          title: `Pin ${command.label || command.title || command.id} to toolbar`,
          description: `Add ${command.label || command.title || command.id} to the modeling toolbar.`,
          group: "workspace",
          groupLabel: "Workspace",
          icon: command.icon || "snap",
          run: () => {
            if (workspace.commandIds.includes(command.id)) return;
            workspace.commandIds = [...workspace.commandIds, command.id].filter((id, index, values) => values.indexOf(id) === index);
            workspace.hiddenCommandIds = workspace.hiddenCommandIds.filter((id) => id !== command.id && workspace.commandIds.includes(id));
            workspace.groupIds = normalizeToolbarGroupIds([...workspace.groupIds, commandGroupId(command)], toolbarCommands);
            workspace.collapsedGroups = workspace.collapsedGroups.filter((groupId) => groupId !== commandGroupId(command));
            saveToolbarWorkspace(workspace);
            applyToolbarWorkspace();
            syncCustomizer();
            setToolbarStatus(`${command.label || command.title || command.id} pinned to toolbar.`);
          }
        }));
      return [...showGroupCommands, ...showCommands, ...pinCommands];
    },
    panelPinCommands(customizer) {
      customizerRef = customizer || customizerRef;
      return panelConfigs
        .filter((panel) => isSidePanelDock(workspacePanelDock(panel, workspace)))
        .map((panel) => {
          const pinned = workspace.panels[panel.id]?.pinned !== false;
          const action = pinned ? WORKSPACE_PANEL_UNPIN_ACTION : WORKSPACE_PANEL_PIN_ACTION;
          const verb = pinned ? "Unpin" : "Pin";
          const label = `${verb} ${panel.label}`;
          return {
            id: `${action}.${panel.id}`,
            action,
            label,
            title: label,
            description: pinned
              ? `Let ${panel.label} auto-hide when it is not in use.`
              : `Keep ${panel.label} visible in its dock.`,
            group: "workspace",
            groupLabel: "Workspace",
            icon: pinned ? "pin-off" : "pin",
            active: pinned,
            run: () => setPanelPinned(panel.id, !pinned, customizerRef)
          };
        });
    },
    setToolbarDock(dock, customizer) {
      customizerRef = customizer || customizerRef;
      const nextDock = normalizeToolbarDock(dock);
      if (workspace.dock === nextDock) return;
      workspace = { ...workspace, dock: nextDock };
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`Toolbar docked ${nextDock}.`);
    },
    setTheme(theme, customizer) {
      customizerRef = customizer || customizerRef;
      const nextTheme = normalizeTheme(theme);
      if (workspace.theme === nextTheme) return;
      workspace = { ...workspace, theme: nextTheme };
      saveToolbarWorkspace(workspace);
      applyWorkspacePreferences();
      syncCustomizer();
      setToolbarStatus(`Theme set to ${themeLabel(nextTheme)}.`);
    },
    setDensity(density, customizer) {
      customizerRef = customizer || customizerRef;
      const nextDensity = normalizeDensity(density);
      if (workspace.density === nextDensity) return;
      workspace = { ...workspace, density: nextDensity };
      saveToolbarWorkspace(workspace);
      applyWorkspacePreferences();
      syncCustomizer();
      setToolbarStatus(`Density set to ${densityLabel(nextDensity)}.`);
    },
    reset(customizer) {
      customizerRef = customizer || customizerRef;
      refreshCommands();
      workspace = defaultWorkspaceState();
      resetWorkspaceSectionStates();
      saveToolbarWorkspace(workspace, { sections: defaultWorkspaceSections(defaultWorkspace) });
      applyToolbarWorkspace();
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus("Workspace reset.");
    },
    resetToolbar(customizer) {
      customizerRef = customizer || customizerRef;
      refreshCommands();
      const defaults = defaultWorkspaceState();
      workspace = normalizeToolbarWorkspace({
        ...workspace,
        commandIds: defaults.commandIds,
        hiddenCommandIds: defaults.hiddenCommandIds,
        groupIds: defaults.groupIds,
        collapsedGroups: defaults.collapsedGroups,
        dock: defaults.dock
      }, defaultCommandIds, knownToolbarCommandIds(), panelConfigs, toolbarCommands);
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus("Toolbar reset.");
    },
    exportWorkspace(customizer) {
      customizerRef = customizer || customizerRef;
      const payload = workspacePreferencePayload(workspace);
      downloadWorkspaceFile(payload);
      setToolbarStatus("Workspace exported.");
      return payload;
    },
    chooseWorkspaceImport(customizer) {
      customizerRef = customizer || customizerRef;
      chooseWorkspaceFile(
        (payload) => this.importWorkspace(payload, customizerRef),
        (error) => setToolbarStatus(`Workspace import failed: ${error?.message || String(error)}`)
      );
    },
    importWorkspace(preferences = {}, customizer) {
      customizerRef = customizer || customizerRef;
      const imported = importWorkspacePreferences(preferences);
      refreshCommands();
      const toolbarPatch = toolbarWorkspacePatch(imported);
      workspace = normalizeToolbarWorkspace({
        ...workspace,
        ...toolbarPatch,
        panels: imported.panels || workspace.panels,
        bottomStrip: imported.bottomStrip || workspace.bottomStrip,
        viewerSettingsStrip: imported.viewerSettingsStrip || workspace.viewerSettingsStrip,
        viewerOverlays: imported.viewerOverlays || workspace.viewerOverlays
      }, defaultCommandIds, knownToolbarCommandIds(), panelConfigs, toolbarCommands);
      saveToolbarWorkspace(workspace, {
        sections: "sections" in imported ? objectMap(imported.sections) : workspaceSectionStates()
      });
      applyToolbarWorkspace();
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus("Workspace imported.");
      return state();
    },
    setWorkspacePatch(patch = {}, customizer) {
      customizerRef = customizer || customizerRef;
      refreshCommands();
      const toolbarPatch = toolbarWorkspacePatch(patch);
      workspace = normalizeToolbarWorkspace({
        ...workspace,
        ...toolbarPatch,
        panels: patch.panels || workspace.panels,
        bottomStrip: patch.bottomStrip || workspace.bottomStrip,
        viewerSettingsStrip: patch.viewerSettingsStrip || workspace.viewerSettingsStrip,
        viewerOverlays: patch.viewerOverlays || workspace.viewerOverlays
      }, defaultCommandIds, knownToolbarCommandIds(), panelConfigs, toolbarCommands);
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
      setToolbarStatus("Workspace updated.");
      return state();
    },
    apply(customizer) {
      customizerRef = customizer || customizerRef;
      applyToolbarWorkspace();
      applyPanelWorkspace();
      emitWorkspaceChange();
      syncCustomizer();
    }
  };

  function refreshCommands({ normalize = false } = {}) {
    toolbarCommands = toolbarEligibleCommands(resolveCommands(commandSource));
    defaultCommandIds = defaultToolbarCommandIds(toolbarCommands, defaultWorkspace);
    if (!normalize) return;
    workspace = normalizeToolbarWorkspace(
      workspace,
      defaultCommandIds,
      knownToolbarCommandIds(),
      panelConfigs,
      toolbarCommands
    );
  }

  function knownToolbarCommandIds() {
    return toolbarCommands.map((command) => command.id);
  }

  function defaultWorkspaceState() {
    return normalizeDefaultWorkspace(defaultWorkspace, defaultCommandIds, knownToolbarCommandIds(), panelConfigs, toolbarCommands);
  }

  function state() {
    return {
      commandIds: workspace.commandIds.slice(),
      hiddenCommandIds: workspace.hiddenCommandIds.slice(),
      groupIds: workspace.groupIds.slice(),
      collapsedGroups: workspace.collapsedGroups.slice(),
      defaultCommandIds: defaultCommandIds.slice(),
      dock: workspace.dock || DEFAULT_TOOLBAR_DOCK,
      theme: normalizeTheme(workspace.theme),
      density: normalizeDensity(workspace.density),
      navigation: navigationStateForStorage(workspace.navigation),
      panels: panelState(),
      bottomStrip: bottomStripState(),
      viewerSettingsStrip: viewerSettingsStripState(),
      viewerOverlays: viewerOverlayState()
    };
  }

  function bottomStripState() {
    return bottomStripStateForStorage(workspace.bottomStrip);
  }

  function viewerSettingsStripState() {
    return viewerSettingsStripStateForStorage(workspace.viewerSettingsStrip);
  }

  function viewerOverlayState() {
    return viewerOverlayStateForStorage(workspace.viewerOverlays);
  }

  function panelState() {
    const result = {};
    for (const panel of panelConfigs) {
      const panelWorkspace = normalizePanelState(workspace.panels[panel.id], panel);
      const tabById = new Map(panel.tabs.map((tab) => [tab.id, tab]));
      const tabIds = panelWorkspace.tabIds || panel.tabs.map((tab) => tab.id);
      result[panel.id] = {
        id: panel.id,
        label: panel.label,
        description: panel.description,
        icon: panel.icon,
        visible: panelWorkspace.visible !== false,
        width: panelWorkspace.width || panel.defaultWidth,
        pinned: panelWorkspace.pinned !== false,
        dock: panelWorkspace.dock,
        tabs: tabIds.map((tabId) => tabById.get(tabId)).filter(Boolean).map((tab) => ({ ...tab })),
        ...(panel.tabs.length ? {
          tabIds: tabIds.slice(),
          hiddenTabIds: (panelWorkspace.hiddenTabIds || []).slice(),
          activeTab: normalizePanelActiveTab(panelWorkspace.activeTab, panel, panelWorkspace)
        } : {})
      };
    }
    return result;
  }

  function syncCustomizer() {
    customizerRef?.setState?.({
      toolbarState: state(),
      panelState: panelState(),
      bottomStripState: bottomStripState(),
      viewerSettingsStripState: viewerSettingsStripState(),
      viewerOverlayState: viewerOverlayState(),
      customizeMode
    });
  }

  function emitWorkspaceChange() {
    onWorkspaceChange?.(workspaceState(workspace));
  }

  function applyToolbarWorkspace() {
    refreshCommands();
    applyWorkspacePreferences();
    const firstGroup = ensureInitialWorkspaceToolbarGroup(toolbar, workspace.groupIds[0]);
    if (!firstGroup) return;
    toolbar.classList.toggle("bc-toolbar-customizing", customizeMode);
    toolbarBand?.classList.toggle("bc-toolbar-band-customizing", customizeMode);
    toolbarBand?.setAttribute("data-toolbar-dock", workspace.dock || DEFAULT_TOOLBAR_DOCK);
    if (toolbarDragHandle) toolbarDragHandle.hidden = !customizeMode;
    bindToolbarDockDrag(toolbarDragHandle);
    const hidden = new Set(workspace.hiddenCommandIds);
    const collapsedGroups = new Set(workspace.collapsedGroups);
    const orderedCommands = workspace.commandIds
      .map((commandId) => commandById(toolbarCommands, commandId))
      .filter(Boolean);
    const commandsByGroup = commandGroupsById(orderedCommands);
    const orderedGroupIds = normalizeToolbarGroupIds(workspace.groupIds, orderedCommands)
      .filter((groupId) => commandsByGroup.has(groupId));
    const buttons = collectWorkspaceToolbarButtons(toolbar);
    for (const commandId of workspace.commandIds) {
      const command = commandById(toolbarCommands, commandId);
      if (!command || buttons.has(commandId)) continue;
      const button = createToolbarCommandButton(command, setToolbarStatus);
      buttons.set(commandId, button);
    }
    for (const button of workspaceToolbarCommandButtons(toolbar)) {
      if (!workspace.commandIds.includes(button.dataset.commandId)) button.remove();
    }
    for (const groupId of orderedGroupIds) {
      const group = ensureWorkspaceToolbarCommandGroup(toolbar, groupId, orderedCommands);
      const groupCommands = commandsByGroup.get(groupId) || [];
      const groupCollapsed = collapsedGroups.has(groupId);
      let visibleCount = 0;
      for (const command of groupCommands) {
        const button = buttons.get(command.id);
        if (!button) continue;
        syncToolbarCommandButton(button, command);
        button.hidden = hidden.has(command.id) || groupCollapsed;
        if (!button.hidden) visibleCount += 1;
        button.classList.toggle("bc-toolbar-command-draggable", customizeMode);
        bindToolbarCommandDrag(button);
        group.append(button);
      }
      group.hidden = visibleCount === 0;
      group.dataset.toolbarGroupCollapsed = groupCollapsed ? "true" : "false";
    }
    removeUnusedWorkspaceToolbarGroups(toolbar, new Set(orderedGroupIds));
    toolbarOverflow = ensureToolbarOverflow(toolbar, toolbarOverflow);
    bindToolbarOverflowResize();
    syncToolbarOverflow();
  }

  function bindToolbarOverflowResize() {
    if (toolbarResizeBound) return;
    toolbarResizeBound = true;
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(scheduleToolbarOverflow);
      observer.observe(toolbar);
      if (toolbarBand) observer.observe(toolbarBand);
    }
    window.addEventListener("resize", scheduleToolbarOverflow);
  }

  function scheduleToolbarOverflow() {
    if (toolbarOverflowFrame) window.cancelAnimationFrame?.(toolbarOverflowFrame);
    toolbarOverflowFrame = window.requestAnimationFrame?.(() => {
      toolbarOverflowFrame = 0;
      syncToolbarOverflow();
    }) || 0;
  }

  function syncToolbarOverflow() {
    if (!toolbarOverflow) return;
    const allButtons = workspaceToolbarCommandButtons(toolbar);
    const buttons = allButtons.filter((button) => !button.hidden && !button.closest(".bc-toolbar-group")?.hidden);
    for (const button of allButtons) {
      button.classList.remove("bc-toolbar-command-overflowed");
      button.dataset.toolbarOverflow = "false";
    }
    renderToolbarOverflowMenu(toolbarOverflow, []);
    toolbarOverflow.root.hidden = true;
    toolbarOverflow.root.open = false;

    const toolbarStyle = window.getComputedStyle?.(toolbar);
    const horizontal = toolbarStyle?.flexDirection !== "column";
    if (!horizontal || buttons.length <= 1 || toolbar.clientWidth <= 0) return;
    if (toolbar.scrollWidth <= toolbar.clientWidth + 1) return;

    toolbarOverflow.root.hidden = false;
    const overflowed = [];
    for (let index = buttons.length - 1; index >= 0 && toolbar.scrollWidth > toolbar.clientWidth + 1; index -= 1) {
      const button = buttons[index];
      button.classList.add("bc-toolbar-command-overflowed");
      button.dataset.toolbarOverflow = "true";
      overflowed.unshift(button);
    }
    if (!overflowed.length) {
      toolbarOverflow.root.hidden = true;
      return;
    }
    renderToolbarOverflowMenu(toolbarOverflow, overflowed.map((button) => ({
      button,
      command: commandById(toolbarCommands, button.dataset.commandId)
    })), setToolbarStatus);
  }

  function applyWorkspacePreferences() {
    const theme = normalizeTheme(workspace.theme);
    const density = normalizeDensity(workspace.density);
    const appliedTheme = theme === "system" ? systemTheme() : theme;
    document.documentElement.dataset.bcTheme = appliedTheme;
    document.documentElement.dataset.bcThemePreference = theme;
    document.documentElement.dataset.bcDensity = density;
  }

  function applyPanelWorkspace() {
    for (const panel of panelConfigs) {
      const state = normalizePanelState(workspace.panels[panel.id], panel);
      workspace.panels[panel.id] = state;
      const visible = state.visible !== false;
      panel.element.hidden = !visible;
      panel.element.dataset.workspacePanelVisible = visible ? "true" : "false";
      panel.element.dataset.workspacePanelWidth = String(state.width);
      panel.element.dataset.workspacePanelConfiguredDock = panel.dock;
      panel.element.dataset.workspacePanelDock = state.dock;
      panel.element.dataset.workspacePanelSideDock = isSidePanelDock(state.dock) ? "true" : "false";
      panel.element.dataset.workspacePanelPinned = state.pinned ? "true" : "false";
      if (state.pinned) panel.element.dataset.workspacePanelRevealed = "false";
      else panel.element.dataset.workspacePanelRevealed ||= "false";
      panel.element.style.setProperty("--bc-dock-width", `${state.width}px`);
      syncPanelDockOffset(panel, workspace);
      bindPanelRevealToggle(panel);
      bindPanelPinToggle(panel);
      bindPanelResizeHandle(panel);
    }
  }

  function setPanelPinned(panelId, pinned, customizer, options = {}) {
    customizerRef = customizer || customizerRef;
    const panel = panelConfigById(panelConfigs, panelId);
    if (!panel) return false;
    workspace.panels[panel.id] = normalizePanelState({
      ...(workspace.panels[panel.id] || {}),
      pinned: Boolean(pinned)
    }, panel);
    saveToolbarWorkspace(workspace);
    applyPanelWorkspace();
    syncCustomizer();
    if (options.notify !== false) setToolbarStatus(`${panel.label} ${workspace.panels[panel.id].pinned ? "pinned" : "auto-hide"}.`);
    return workspace.panels[panel.id].pinned;
  }

  function bindPanelRevealToggle(panel) {
    const dock = workspacePanelDock(panel, workspace);
    if (!isSidePanelDock(dock)) return;
    const button = ensurePanelRevealToggle(panel);
    if (!button) return;
    syncPanelRevealToggle(panel, workspace);
    if (button.dataset.workspacePanelRevealBound === "true") return;
    button.dataset.workspacePanelRevealBound = "true";
    let lastRevealToggleAt = 0;
    const recentlyRevealed = () => panel.element.dataset.workspacePanelRevealed === "true"
      && performance.now() - lastRevealToggleAt < PANEL_REVEAL_CONCEAL_GRACE_MS;
    const conceal = () => {
      if (recentlyRevealed()) return;
      if (workspace.panels[panel.id]?.pinned === false) {
        panel.element.dataset.workspacePanelRevealed = "false";
        syncPanelDockOffset(panel, workspace);
        syncPanelRevealToggle(panel, workspace);
        if (document.activeElement === button) button.blur();
      }
    };
    const containsPointer = (event) => {
      const rect = panel.element.getBoundingClientRect();
      return event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
    };
    panel.element.addEventListener("pointerleave", (event) => {
      if (!containsPointer(event)) conceal();
    });
    window.addEventListener("pointermove", (event) => {
      if (workspace.panels[panel.id]?.pinned !== false) return;
      if (panel.element.dataset.workspacePanelRevealed !== "true") return;
      if (!containsPointer(event)) conceal();
    }, { passive: true });
    panel.element.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!panel.element.matches(":hover, :focus-within")) conceal();
      }, 0);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (workspace.panels[panel.id]?.pinned !== false) {
        setPanelPinned(panel.id, false);
        panel.element.dataset.workspacePanelRevealed = "false";
        syncPanelDockOffset(panel, workspace);
        event.currentTarget.blur();
        return;
      }
      const nextRevealed = panel.element.dataset.workspacePanelRevealed !== "true";
      lastRevealToggleAt = nextRevealed ? performance.now() : 0;
      panel.element.dataset.workspacePanelRevealed = nextRevealed ? "true" : "false";
      syncPanelDockOffset(panel, workspace);
      if (!nextRevealed) event.currentTarget.blur();
      syncPanelRevealToggle(panel, workspace);
    });
  }

  function bindPanelPinToggle(panel) {
    const dock = workspacePanelDock(panel, workspace);
    if (!isSidePanelDock(dock)) return;
    const button = ensurePanelPinToggle(panel);
    if (!button) return;
    const pinned = workspace.panels[panel.id]?.pinned !== false;
    const label = `${pinned ? "Unpin" : "Pin"} ${panel.label}`;
    dockPinToggleControl({ button, dock, pinned, label });
    if (button.dataset.workspacePanelPinBound === "true") return;
    button.dataset.workspacePanelPinBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextPinned = workspace.panels[panel.id]?.pinned === false;
      setPanelPinned(panel.id, nextPinned);
      if (!nextPinned) {
        panel.element.dataset.workspacePanelRevealed = "false";
        syncPanelDockOffset(panel, workspace);
        syncPanelRevealToggle(panel, workspace);
        event.currentTarget.blur();
      }
    });
  }

  function bindPanelResizeHandle(panel) {
    const dock = workspacePanelDock(panel, workspace);
    if (!isSidePanelDock(dock)) return;
    const handle = ensurePanelResizeHandle(panel);
    if (!handle) return;
    handle.dataset.dock = dock;
    if (handle.dataset.workspacePanelResizeBound === "true") return;
    handle.dataset.workspacePanelResizeBound = "true";
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const current = workspace.panels[panel.id]?.width || panel.defaultWidth;
      drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: current };
      handle.setPointerCapture?.(event.pointerId);
      handle.classList.add("is-dragging");
      panel.element.classList.add("is-resizing");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dock = workspacePanelDock(panel, workspace);
      const delta = dock === "left" ? event.clientX - drag.startX : drag.startX - event.clientX;
      const nextWidth = normalizePanelWidth(drag.startWidth + delta, panel);
      workspace.panels[panel.id] = normalizePanelState({
        ...(workspace.panels[panel.id] || {}),
        width: nextWidth
      }, panel);
      panel.element.style.setProperty("--bc-dock-width", `${nextWidth}px`);
      panel.element.dataset.workspacePanelWidth = String(nextWidth);
    });
    handle.addEventListener("pointerup", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      handle.releasePointerCapture?.(event.pointerId);
      handle.classList.remove("is-dragging");
      panel.element.classList.remove("is-resizing");
      saveToolbarWorkspace(workspace);
      applyPanelWorkspace();
      syncCustomizer();
      setToolbarStatus(`${panel.label} width ${workspace.panels[panel.id]?.width || panel.defaultWidth}px.`);
    });
    handle.addEventListener("pointercancel", () => {
      drag = null;
      handle.classList.remove("is-dragging");
      panel.element.classList.remove("is-resizing");
      applyPanelWorkspace();
    });
  }

  function bindToolbarCommandDrag(button) {
    if (button.dataset.workspaceDragBound === "true") return;
    button.dataset.workspaceDragBound = "true";
    let drag = null;
    button.addEventListener("click", (event) => {
      if (!customizeMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
    button.addEventListener("pointerdown", (event) => {
      if (!customizeMode || event.button !== 0) return;
      drag = { sourceId: button.dataset.commandId, pointerId: event.pointerId, moved: false };
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.moved = true;
      button.classList.add("is-dragging");
      clearDragTargets();
      const target = toolbarButtonAt(event.clientX, event.clientY);
      if (target && target.dataset.commandId !== drag.sourceId) target.classList.add("is-drop-target");
    });
    button.addEventListener("pointerup", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const activeDrag = drag;
      drag = null;
      button.releasePointerCapture?.(event.pointerId);
      const target = toolbarButtonAt(event.clientX, event.clientY);
      cleanupDragClasses();
      if (!activeDrag.moved || !target?.dataset.commandId || target.dataset.commandId === activeDrag.sourceId) return;
      workspace = moveToolbarCommand(workspace, activeDrag.sourceId, target.dataset.commandId);
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus("Toolbar order updated.");
    });
    button.addEventListener("pointercancel", () => {
      drag = null;
      cleanupDragClasses();
    });
  }

  function bindToolbarDockDrag(handle) {
    if (!handle || handle.dataset.workspaceDockDragBound === "true") return;
    handle.dataset.workspaceDockDragBound = "true";
    let drag = null;
    handle.addEventListener("click", (event) => {
      if (!customizeMode) return;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });
    handle.addEventListener("pointerdown", (event) => {
      if (!customizeMode || event.button !== 0) return;
      event.preventDefault();
      drag = { pointerId: event.pointerId, moved: false };
      handle.setPointerCapture?.(event.pointerId);
      handle.classList.add("is-dragging");
      toolbarBand?.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.moved = true;
    });
    handle.addEventListener("pointerup", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const activeDrag = drag;
      drag = null;
      handle.releasePointerCapture?.(event.pointerId);
      handle.classList.remove("is-dragging");
      toolbarBand?.classList.remove("is-dragging");
      if (!activeDrag.moved) return;
      const nextDock = toolbarDockFromPoint(event.clientX, event.clientY);
      if (workspace.dock === nextDock) return;
      workspace = { ...workspace, dock: nextDock };
      saveToolbarWorkspace(workspace);
      applyToolbarWorkspace();
      syncCustomizer();
      setToolbarStatus(`Toolbar docked ${nextDock}.`);
    });
    handle.addEventListener("pointercancel", () => {
      drag = null;
      handle.classList.remove("is-dragging");
      toolbarBand?.classList.remove("is-dragging");
    });
  }

  function toolbarButtonAt(x, y) {
    return document.elementFromPoint(x, y)?.closest?.("#modeling-toolbar .bc-toolbar-command-draggable") || null;
  }

  function clearDragTargets() {
    for (const item of toolbar.querySelectorAll(".bc-toolbar-command-draggable.is-drop-target")) item.classList.remove("is-drop-target");
  }

  function cleanupDragClasses() {
    for (const item of toolbar.querySelectorAll(".bc-toolbar-command-draggable.is-dragging, .bc-toolbar-command-draggable.is-drop-target")) {
      item.classList.remove("is-dragging");
      item.classList.remove("is-drop-target");
    }
  }

  function setToolbarStatus(message) {
    onStatusChange?.(message);
  }
}

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
    applyLegacyPanelActiveTabs(mergedPanels, storedPanels, panelConfigs);
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
        legacyActiveTabStorageKey: typeof panel.legacyActiveTabStorageKey === "string" ? panel.legacyActiveTabStorageKey : "",
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

export function normalizePanelDock(dock, fallback = "floating") {
  const normalizedFallback = typeof fallback === "string" && PANEL_DOCKS.has(fallback) ? fallback : "floating";
  return typeof dock === "string" && PANEL_DOCKS.has(dock) ? dock : normalizedFallback;
}

export function normalizeWorkspacePanelState(state, panelConfig = {}) {
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

function applyLegacyPanelActiveTabs(panels, storedPanels, panelConfigs = []) {
  const stored = objectMap(storedPanels);
  for (const panel of panelConfigs) {
    if (!panel.tabs.length || !panel.legacyActiveTabStorageKey) continue;
    if (validWorkspaceId(stored[panel.id]?.activeTab)) continue;
    const activeTab = readLegacyPanelActiveTab(panel);
    if (!activeTab) continue;
    panels[panel.id] = {
      ...objectMap(panels[panel.id]),
      activeTab
    };
  }
}

function readLegacyPanelActiveTab(panelConfig) {
  try {
    const stored = window.localStorage?.getItem(panelConfig.legacyActiveTabStorageKey);
    return panelConfig.tabs.some((tab) => tab.id === stored) ? stored : "";
  } catch {
    return "";
  }
}

function commandById(commands, commandId) {
  return commands.find((command) => command.id === commandId) || null;
}

function createToolbarCommandButton(command, setToolbarStatus = () => {}) {
  const button = iconButton({
    icon: command.icon || "snap",
    label: command.label || command.title || command.id,
    title: command.title || command.label || command.id,
    shortcut: command.shortcutLabel || "",
    commandId: command.id,
    onClick: () => {
      if (button.dataset.commandEnabled === "false") {
        setToolbarStatus(button.dataset.disabledReason || "Command unavailable.");
        return;
      }
      button.bcCommandRun?.();
    }
  });
  button.dataset.generatedToolbarCommand = "true";
  button.dataset.commandGroup = commandGroupId(command);
  syncToolbarCommandButton(button, command);
  return button;
}

function syncToolbarCommandButton(button, command) {
  const enabled = commandEnabled(command);
  const active = commandActive(command);
  const title = commandTitle(command);
  button.bcCommandRun = () => command.run?.(command);
  button.dataset.commandGroup = commandGroupId(command);
  button.dataset.commandEnabled = enabled ? "true" : "false";
  applyCommandState(button, {
    command,
    active,
    enabled,
    disabledReason: commandDisabledReason(command),
    title,
    shortcut: command.shortcutLabel || ""
  });
}

function commandEnabled(command) {
  return command?.enabled !== false && command?.disabled !== true;
}

function commandActive(command) {
  return command?.active === true;
}

function commandDisabledReason(command) {
  return command?.disabledReason || "Command unavailable.";
}

function commandTitle(command) {
  const title = command.title || command.label || command.id;
  return command.shortcutLabel ? `${title} (${command.shortcutLabel})` : title;
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

function saveToolbarWorkspace(workspace, options = {}) {
  writeWorkspacePreferences(workspacePreferencePayload(workspace, options));
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

function downloadWorkspaceFile(payload = {}) {
  const blob = new Blob([exportWorkspacePreferences(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bobercad-workspace-${workspaceDateStamp()}.json`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function chooseWorkspaceFile(onImport, onError) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.hidden = true;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      input.remove();
      return;
    }
    try {
      onImport?.(JSON.parse(await file.text()));
    } catch (error) {
      onError?.(error);
    } finally {
      input.remove();
    }
  });
  document.body.append(input);
  input.click();
}

function workspaceDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizeToolbarWorkspace(workspace, defaultCommandIds, knownCommandIds = defaultCommandIds, panelConfigs = [], commandSpecs = []) {
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

function normalizeToolbarDock(dock) {
  return TOOLBAR_DOCKS.has(dock) ? dock : DEFAULT_TOOLBAR_DOCK;
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

export function normalizeViewerOverlaysWorkspace(viewerOverlays = {}) {
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

function ensureInitialWorkspaceToolbarGroup(toolbar, groupId = "") {
  const managed = toolbar.querySelector(WORKSPACE_TOOLBAR_GROUP_SELECTOR);
  if (managed) return managed;
  const firstGroup = toolbar.querySelector(":scope > .bc-toolbar-group");
  if (!firstGroup) return null;
  stampWorkspaceToolbarGroup(firstGroup, groupId || "model");
  return firstGroup;
}

function ensureWorkspaceToolbarCommandGroup(toolbar, groupId, commands = []) {
  let group = toolbar.querySelector(`:scope > .bc-toolbar-group[data-workspace-toolbar-group="${cssEscape(groupId)}"]`);
  if (!group) {
    group = document.createElement("div");
    group.className = "bc-toolbar-group";
  }
  stampWorkspaceToolbarGroup(group, groupId, commands);
  const anchor = toolbarCommandGroupAnchor(toolbar);
  if (anchor !== group.nextSibling) toolbar.insertBefore(group, anchor);
  return group;
}

function stampWorkspaceToolbarGroup(group, groupId, commands = []) {
  group.dataset.workspaceToolbarGroup = groupId;
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", `${toolbarGroupLabel(groupId, commands)} toolbar commands`);
  return group;
}

function toolbarCommandGroupAnchor(toolbar) {
  return toolbar.querySelector(":scope > .bc-toolbar-overflow")
    || [...toolbar.children].find((child) => !child.matches?.(".bc-toolbar-group[data-workspace-toolbar-group]"))
    || null;
}

function collectWorkspaceToolbarButtons(toolbar) {
  const buttons = new Map();
  for (const button of workspaceToolbarCommandButtons(toolbar)) {
    const commandId = button.dataset.commandId;
    if (!commandId) continue;
    if (buttons.has(commandId)) {
      button.remove();
      continue;
    }
    buttons.set(commandId, button);
  }
  return buttons;
}

function workspaceToolbarCommandButtons(toolbar) {
  return [...toolbar.querySelectorAll(`${WORKSPACE_TOOLBAR_GROUP_SELECTOR} > [data-command-id]`)];
}

function removeUnusedWorkspaceToolbarGroups(toolbar, activeGroupIds = new Set()) {
  for (const group of toolbar.querySelectorAll(WORKSPACE_TOOLBAR_GROUP_SELECTOR)) {
    if (activeGroupIds.has(group.dataset.workspaceToolbarGroup)) continue;
    group.remove();
  }
}

function lastWorkspaceToolbarGroup(toolbar) {
  return [...toolbar.querySelectorAll(WORKSPACE_TOOLBAR_GROUP_SELECTOR)].at(-1) || null;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function titleCase(value = "") {
  return String(value)
    .replace(/[.-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toolbarDockFromPoint(x, y) {
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  if (y <= Math.max(120, height * 0.22)) return "top";
  if (y >= Math.min(height - 120, height * 0.78)) return "bottom";
  if (x <= width * 0.34) return "left";
  if (x >= width * 0.66) return "right";
  return "top";
}

function ensureToolbarDragHandle(toolbarBand) {
  if (!toolbarBand) return null;
  let handle = toolbarBand.querySelector(".bc-toolbar-drag-handle");
  if (!handle) {
    handle = toolbarDragHandleControl();
    toolbarBand.insertBefore(handle, toolbarBand.firstChild);
  } else {
    toolbarDragHandleControl({ button: handle });
  }
  handle.hidden = true;
  return handle;
}

function ensureToolbarOverflow(toolbar, existing = null) {
  if (existing?.root?.isConnected) {
    positionToolbarOverflow(toolbar, existing.root);
    return existing;
  }
  let root = toolbar.querySelector(":scope > .bc-toolbar-overflow");
  if (!root) {
    root = document.createElement("details");
    root.className = "bc-toolbar-overflow";
    root.hidden = true;
  }
  let summary = root.querySelector(":scope > .bc-toolbar-overflow-summary");
  if (!summary) {
    summary = document.createElement("summary");
    summary.className = "bc-toolbar-overflow-summary";
    summary.setAttribute("aria-label", "More toolbar commands");
    applyTooltip(summary, "More commands");
    summary.append(createIcon("more"));
    root.append(summary);
  }
  let menu = root.querySelector(":scope > .bc-toolbar-overflow-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.className = "bc-toolbar-overflow-menu bc-popover";
    menu.setAttribute("role", "menu");
    root.append(menu);
  }
  if (root.dataset.toolbarOverflowBound !== "true") {
    root.dataset.toolbarOverflowBound = "true";
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      root.open = false;
      summary.focus();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!root.open || root.contains(event.target)) return;
      root.open = false;
    });
  }
  positionToolbarOverflow(toolbar, root);
  return { root, summary, menu };
}

function positionToolbarOverflow(toolbar, root) {
  const anchor = lastWorkspaceToolbarGroup(toolbar) || toolbar.querySelector(":scope > .bc-toolbar-group");
  if (anchor?.nextSibling !== root) anchor?.after(root);
}

function renderToolbarOverflowMenu(overflow, entries = [], setStatus = () => {}) {
  const { root, summary, menu } = overflow;
  menu.replaceChildren(...entries.map(({ button, command }) => toolbarOverflowItem(button, command, root, setStatus)));
  const count = entries.length;
  const label = count === 1 ? "1 more toolbar command" : `${count} more toolbar commands`;
  root.dataset.overflowCount = String(count);
  summary.setAttribute("aria-label", count ? label : "More toolbar commands");
  applyTooltip(summary, count ? label : "More commands");
}

function toolbarOverflowItem(sourceButton, command, root, setStatus = () => {}) {
  const label = command?.label || command?.title || sourceButton.getAttribute("aria-label") || sourceButton.dataset.commandId;
  const description = command?.description || sourceButton.title || "";
  const enabled = toolbarButtonEnabled(sourceButton, command);
  const active = toolbarButtonActive(sourceButton, command);
  const reason = sourceButton.dataset.disabledReason || commandDisabledReason(command);
  const shortcut = command?.shortcutLabel || sourceButton.querySelector(".bc-shortcut-badge")?.textContent || "";
  return toolbarOverflowMenuItemControl({
    command,
    commandId: sourceButton.dataset.commandId,
    label,
    description,
    icon: command?.icon || "more",
    shortcut,
    enabled,
    active,
    disabledReason: reason,
    onDisabled: () => setStatus(reason),
    onSelect: () => {
      root.open = false;
      sourceButton.click();
    }
  });
}

function toolbarButtonEnabled(button, command) {
  if (button?.dataset?.commandEnabled === "false") return false;
  return commandEnabled(command);
}

function toolbarButtonActive(button, command) {
  if (button?.dataset?.commandActive === "true") return true;
  return commandActive(command);
}

function panelTabStateForPanel(panel, panelState = {}) {
  const state = normalizePanelState(panelState, panel);
  const tabById = new Map(panel.tabs.map((tab) => [tab.id, tab]));
  const hidden = new Set(state.hiddenTabIds || []);
  const tabs = (state.tabIds || [])
    .map((tabId) => tabById.get(tabId))
    .filter(Boolean)
    .map((tab) => ({ ...tab }));
  return {
    panelId: panel.id,
    panelLabel: panel.label,
    tabIds: (state.tabIds || []).slice(),
    hiddenTabIds: (state.hiddenTabIds || []).slice(),
    activeTab: normalizePanelActiveTab(state.activeTab, panel, state),
    tabs,
    visibleTabs: tabs.filter((tab) => !hidden.has(tab.id))
  };
}

function ensurePanelResizeHandle(panel) {
  let handle = panel.element.querySelector(":scope > .bc-dock-resize-handle");
  if (!handle) {
    handle = dockResizeHandleControl({ label: `Resize ${panel.label}`, dock: normalizePanelDock(panel.dock) });
    panel.element.append(handle);
  } else {
    dockResizeHandleControl({ button: handle, label: `Resize ${panel.label}`, dock: normalizePanelDock(panel.dock) });
  }
  handle.dataset.dock = normalizePanelDock(panel.dock);
  return handle;
}

function ensurePanelRevealToggle(panel) {
  let button = panel.element.querySelector(".bc-dock-reveal-toggle");
  if (!button) {
    button = dockRevealToggleControl({ label: `Show ${panel.label}` });
  }
  const host = panel.element.querySelector(".bc-dock-reveal-slot") || panel.element;
  if (button.parentElement !== host) host.append(button);
  return button;
}

function ensurePanelPinToggle(panel) {
  let button = panel.element.querySelector(":scope > .bc-dock-pin-toggle");
  if (!button) {
    button = dockPinToggleControl({ label: `Pin ${panel.label}` });
    panel.element.append(button);
  }
  return button;
}

function syncPanelRevealToggle(panel, workspaceState = {}) {
  const button = panel.element.querySelector(".bc-dock-reveal-toggle");
  if (!button) return;
  const dock = workspacePanelDock(panel, workspaceState);
  const pinned = workspaceState.panels?.[panel.id]?.pinned !== false;
  const revealed = pinned || panel.element.dataset.workspacePanelRevealed === "true";
  const label = `${revealed ? "Hide" : "Show"} ${panel.label}`;
  dockRevealToggleControl({ button, dock, revealed, pinned, label });
}

function syncPanelDockOffset(panel, workspaceState = {}) {
  const dock = workspacePanelDock(panel, workspaceState);
  if (!isSidePanelDock(dock)) {
    panel.element.style.left = "";
    panel.element.style.right = "";
    panel.element.style.transform = "";
    return;
  }
  if (dock === "right") {
    panel.element.style.right = "0px";
    panel.element.style.left = "";
  } else {
    panel.element.style.left = "0px";
    panel.element.style.right = "";
  }
  panel.element.style.transform = "";
}

function isSidePanelDock(dock) {
  return dock === "left" || dock === "right";
}

function workspacePanelDock(panel, workspaceState = {}) {
  return normalizePanelDock(workspaceState?.panels?.[panel.id]?.dock, normalizePanelDock(panel?.dock));
}

export function moveToolbarCommand(workspace, sourceId, targetId) {
  if (sourceId === targetId || !workspace?.commandIds?.includes(sourceId) || !workspace?.commandIds?.includes(targetId)) return workspace;
  const ordered = workspace.commandIds.filter((id) => id !== sourceId);
  const targetIndex = ordered.indexOf(targetId);
  if (targetIndex === -1) return workspace;
  ordered.splice(targetIndex, 0, sourceId);
  return { ...workspace, commandIds: ordered };
}

function moveToolbarCommandByDirection(workspace, commandId, direction) {
  const currentIndex = workspace.commandIds.indexOf(commandId);
  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  const nextIndex = currentIndex + delta;
  if (currentIndex < 0 || delta === 0 || nextIndex < 0 || nextIndex >= workspace.commandIds.length) return workspace;
  const commandIds = workspace.commandIds.slice();
  const [moved] = commandIds.splice(currentIndex, 1);
  commandIds.splice(nextIndex, 0, moved);
  return { ...workspace, commandIds };
}

function moveToolbarGroupByDirection(workspace, groupId, direction, commandSpecs = []) {
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

function movePanelTabByDirection(panelState, panelConfig, tabId, direction) {
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

function moveFeatureNavbarGroupByDirection(navigation, groupId, direction) {
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

function moveBottomStripItemByDirection(bottomStrip, itemId, direction) {
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

function moveViewerSettingsStripGroupByDirection(viewerSettingsStrip, groupId, direction) {
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

function navigationGroupLabel(groupId) {
  return commandGroupSpec(groupId)?.label || titleCase(groupId);
}
