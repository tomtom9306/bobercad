import { topbarMenuButton } from "../design-system/ui-elements.mjs";
import { workspaceState } from "./workspace-customizer-state.mjs";
import { mountWorkspaceCustomizer } from "./workspace-customizer-dialog.mjs";
import { createToolbarWorkspaceManager } from "./workspace-customizer-manager.mjs";

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
  return root;
}
