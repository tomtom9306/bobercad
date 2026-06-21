import { bottomStripItemSpec } from "../commands/bottom-strip-metadata.mjs";
import { viewerSettingsStripGroupSpec } from "../commands/settings-strip-metadata.mjs";
import { importWorkspacePreferences, resetWorkspaceSectionStates, workspaceSectionStates } from "./workspace-storage.mjs";
import { bottomStripStateForStorage, commandById, commandGroupId, commandGroupsById, defaultToolbarCommandIds, defaultWorkspaceSections, densityLabel, loadToolbarWorkspace, normalizeBottomStripWorkspace, normalizeCollapsedGroups, normalizeDefaultWorkspace, normalizeDensity, normalizeNavigationWorkspace, normalizePanelActiveTab, normalizePanelConfigs, normalizePanelDock, normalizePanelState, normalizePanelWidth, normalizeTheme, normalizeToolbarGroupIds, normalizeToolbarWorkspace, normalizeViewerOverlaysWorkspace, normalizeViewerSettingsStripWorkspace, objectMap, panelConfigById, resolveCommands, systemTheme, themeLabel, toolbarEligibleCommands, toolbarGroups, toolbarGroupLabel, toolbarWorkspacePatch, viewerOverlayCornerSpec, viewerOverlaySpec, viewerOverlayStateForStorage, viewerSettingsStripStateForStorage, workspacePreferencePayload, workspaceState, navigationStateForStorage } from "./workspace-customizer-state.mjs";
import { saveToolbarWorkspace, downloadWorkspaceFile, chooseWorkspaceFile } from "./workspace-customizer-file-io.mjs";
import { navigationGroupLabel } from "./workspace-customizer-labels.mjs";
import { moveBottomStripItemBefore, moveBottomStripItemByDirection, moveFeatureNavbarGroupBefore, moveFeatureNavbarGroupByDirection, movePanelTabBefore, movePanelTabByDirection, moveToolbarCommand, moveToolbarCommandByDirection, moveToolbarGroupBefore, moveToolbarGroupByDirection, moveViewerSettingsStripGroupBefore, moveViewerSettingsStripGroupByDirection } from "./workspace-customizer-ordering.mjs";
import { ensurePanelPinToggle, ensurePanelResizeHandle, ensurePanelRevealToggle, isSidePanelDock, panelTabStateForPanel, syncPanelDockOffset, syncPanelPinToggle, syncPanelRevealToggle, workspacePanelDock } from "./workspace-customizer-panel-dock.mjs";
import { collectWorkspaceToolbarButtons, createToolbarCommandButton, ensureInitialWorkspaceToolbarGroup, ensureToolbarOverflow, ensureWorkspaceToolbarCommandGroup, removeUnusedWorkspaceToolbarGroups, renderToolbarOverflowMenu, syncToolbarCommandButton, workspaceToolbarCommandButtons } from "./workspace-customizer-toolbar-dom.mjs";

const DEFAULT_TOOLBAR_DOCK = "top";
const WORKSPACE_PANEL_PIN_ACTION = "workspace.panel.pin";
const WORKSPACE_PANEL_UNPIN_ACTION = "workspace.panel.unpin";
const PANEL_REVEAL_CONCEAL_GRACE_MS = 220;

export function createToolbarWorkspaceManager({ toolbar, commands, panels = [], defaultWorkspace = null, onWorkspaceChange, onStatusChange } = {}) {
  const toolbarBand = toolbar.closest(".bc-toolbar-band");
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
      dock: DEFAULT_TOOLBAR_DOCK,
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
    toolbarBand?.setAttribute("data-toolbar-dock", DEFAULT_TOOLBAR_DOCK);
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
    syncPanelPinToggle(panel, workspace);
    if (button.dataset.workspacePanelPinBound === "true") return;
    button.dataset.workspacePanelPinBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextPinned = workspace.panels[panel.id]?.pinned === false;
      setPanelPinned(panel.id, nextPinned);
      if (!nextPinned) {
        panel.element.dataset.workspacePanelRevealed = "true";
        syncPanelDockOffset(panel, workspace);
        syncPanelRevealToggle(panel, workspace);
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
