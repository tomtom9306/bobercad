import { bottomStripItemSpec } from "../commands/bottom-strip-metadata.mjs";
import { commandGroupSpec } from "../commands/command-group-metadata.mjs";
import { viewerSettingsStripGroupSpec } from "../commands/settings-strip-metadata.mjs";
import { densityLabel, normalizeBottomStripWorkspace, normalizeDensity, normalizeNavigationWorkspace, normalizeTheme, normalizeViewerSettingsStripWorkspace, themeLabel, viewerOverlayEntries } from "./workspace-customizer-state.mjs";
import { titleCase } from "./workspace-customizer-labels.mjs";

const VIEWER_OVERLAY_CORNER_SPECS = [
  { id: "bottom-right", label: "Bottom right", shortLabel: "BR" },
  { id: "bottom-left", label: "Bottom left", shortLabel: "BL" },
  { id: "top-right", label: "Top right", shortLabel: "TR" },
  { id: "top-left", label: "Top left", shortLabel: "TL" }
];

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
