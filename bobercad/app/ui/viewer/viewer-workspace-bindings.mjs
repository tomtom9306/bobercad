import { COMMAND_GROUP_ORDER } from "../commands/command-group-metadata.mjs";
import {
  DATA_DOCK_COMMAND_LABEL,
  DATA_DOCK_DEFAULT_TAB,
  DATA_DOCK_PANEL_DEFAULT_PINNED,
  DATA_DOCK_PANEL_DEFAULT_VISIBLE,
  DATA_DOCK_PANEL_DEFAULT_WIDTH,
  DATA_DOCK_PANEL_DESCRIPTION,
  DATA_DOCK_PANEL_DOCK,
  DATA_DOCK_PANEL_ICON,
  DATA_DOCK_PANEL_ID,
  DATA_DOCK_PANEL_LABEL,
  DATA_DOCK_PANEL_MAX_WIDTH,
  DATA_DOCK_PANEL_MIN_WIDTH,
  DATA_DOCK_TABS,
  dataDockTabLabel
} from "../commands/data-dock-metadata.mjs";
import {
  INSPECTOR_CONTEXTS,
  INSPECTOR_DEFAULT_CONTEXT,
  INSPECTOR_PANEL_DEFAULT_VISIBLE,
  INSPECTOR_PANEL_DEFAULT_WIDTH,
  INSPECTOR_PANEL_DESCRIPTION,
  INSPECTOR_PANEL_DOCK,
  INSPECTOR_PANEL_ICON,
  INSPECTOR_PANEL_ID,
  INSPECTOR_PANEL_LABEL,
  INSPECTOR_PANEL_MAX_WIDTH,
  INSPECTOR_PANEL_MIN_WIDTH,
  inspectorContextLabel,
  inspectorContextSpec
} from "../commands/inspector-dock-metadata.mjs";
import { mountDockTabs } from "../shell/dock-tabs.mjs";
import { mountFeatureNavbar } from "../shell/feature-navbar.mjs";
import { mountInspectorDock } from "../shell/inspector-dock.mjs";
import { mountToolbarWorkspaceCustomization, normalizeViewerOverlaysWorkspace, withWorkspaceCommand } from "../shell/workspace-customizer-panel.mjs";

export function createViewerWorkspaceBindings({
  toolbar = null,
  topbarActions = null,
  shell = null,
  libraryPanel = null,
  libraryDock = null,
  inspectorDock = null,
  navCubeRoot = null,
  defaultWorkspace = {},
  getStatusBar = () => null,
  getViewerSettingsUi = () => null,
  getCommandPalette = () => null,
  getViewerCommandItems = () => [],
  onStatusChange = () => {}
} = {}) {
  const inspectorPanelByContext = new Map(INSPECTOR_CONTEXTS.map((context) => [
    context.id,
    document.querySelector(`[data-inspector-context-panel="${context.panelSlot || context.id}"]`)
  ]));
  let workspaceCustomizer = null;
  let leftDockTabs = null;
  let inspectorDockApi = null;
  let featureNavbar = null;
  let navCubeDockClearanceObserver = null;
  let navCubeDockClearanceMutationObserver = null;

  function inspectorContextPanel(contextId) {
    return inspectorPanelByContext.get(contextId) || null;
  }

  function dataDockElement() {
    return libraryDock || libraryPanel;
  }

  function inspectorDockElement() {
    return inspectorDock || inspectorContextPanel("properties");
  }

  function panelSpecs() {
    return [
      {
        id: DATA_DOCK_PANEL_ID,
        label: DATA_DOCK_PANEL_LABEL,
        description: DATA_DOCK_PANEL_DESCRIPTION,
        icon: DATA_DOCK_PANEL_ICON,
        dock: DATA_DOCK_PANEL_DOCK,
        element: dataDockElement(),
        defaultWidth: DATA_DOCK_PANEL_DEFAULT_WIDTH,
        minWidth: DATA_DOCK_PANEL_MIN_WIDTH,
        maxWidth: DATA_DOCK_PANEL_MAX_WIDTH,
        defaultVisible: DATA_DOCK_PANEL_DEFAULT_VISIBLE,
        defaultPinned: DATA_DOCK_PANEL_DEFAULT_PINNED,
        tabs: DATA_DOCK_TABS,
        defaultActiveTab: DATA_DOCK_DEFAULT_TAB
      },
      {
        id: INSPECTOR_PANEL_ID,
        label: INSPECTOR_PANEL_LABEL,
        description: INSPECTOR_PANEL_DESCRIPTION,
        icon: INSPECTOR_PANEL_ICON,
        dock: INSPECTOR_PANEL_DOCK,
        element: inspectorDockElement(),
        defaultWidth: INSPECTOR_PANEL_DEFAULT_WIDTH,
        minWidth: INSPECTOR_PANEL_MIN_WIDTH,
        maxWidth: INSPECTOR_PANEL_MAX_WIDTH,
        defaultVisible: INSPECTOR_PANEL_DEFAULT_VISIBLE,
        defaultPinned: true,
        tabs: INSPECTOR_CONTEXTS,
        defaultActiveTab: INSPECTOR_DEFAULT_CONTEXT
      }
    ];
  }

  function dataDockTabSpecById(tabId) {
    return DATA_DOCK_TABS.find((tab) => tab.id === tabId) || null;
  }

  function dataDockTabRuntimeSpec(tab) {
    return {
      ...tab,
      panel: document.getElementById(tab.panelElementId)
    };
  }

  function inspectorContextRuntimeSpec(context) {
    return {
      ...context,
      panel: inspectorContextPanel(context.id)
    };
  }

  function dataDockTabsForWorkspace() {
    const tabState = workspaceCustomizer?.panelTabState?.(DATA_DOCK_PANEL_ID);
    const tabIds = Array.isArray(tabState?.tabIds) && tabState.tabIds.length
      ? tabState.tabIds
      : DATA_DOCK_TABS.map((tab) => tab.id);
    const hiddenTabIds = new Set(Array.isArray(tabState?.hiddenTabIds) ? tabState.hiddenTabIds : []);
    return tabIds
      .map(dataDockTabSpecById)
      .filter(Boolean)
      .filter((tab) => !hiddenTabIds.has(tab.id))
      .map(dataDockTabRuntimeSpec);
  }

  function inspectorContextTabsForWorkspace() {
    const tabState = workspaceCustomizer?.panelTabState?.(INSPECTOR_PANEL_ID);
    const tabIds = Array.isArray(tabState?.tabIds) && tabState.tabIds.length
      ? tabState.tabIds
      : INSPECTOR_CONTEXTS.map((context) => context.id);
    const hiddenTabIds = new Set(Array.isArray(tabState?.hiddenTabIds) ? tabState.hiddenTabIds : []);
    return tabIds
      .map(inspectorContextSpec)
      .filter(Boolean)
      .filter((context) => !hiddenTabIds.has(context.id))
      .map(inspectorContextRuntimeSpec);
  }

  function dataDockActiveTab() {
    return workspaceCustomizer?.panelActiveTab?.(DATA_DOCK_PANEL_ID) || DATA_DOCK_DEFAULT_TAB;
  }

  function inspectorActiveContext() {
    return workspaceCustomizer?.panelActiveTab?.(INSPECTOR_PANEL_ID) || inspectorDockApi?.activePanel?.() || INSPECTOR_DEFAULT_CONTEXT;
  }

  function panelVisible(panelId, fallbackElement = null) {
    return typeof workspaceCustomizer?.panelVisible === "function"
      ? workspaceCustomizer.panelVisible(panelId)
      : fallbackElement?.hidden !== true;
  }

  function syncDataDockTabs() {
    const activeTab = dataDockActiveTab();
    return leftDockTabs?.setTabs?.(dataDockTabsForWorkspace(), { activeTab }) || activeTab;
  }

  function syncInspectorDockTabs() {
    const requestedPanel = workspaceCustomizer?.panelActiveTab?.(INSPECTOR_PANEL_ID) || INSPECTOR_DEFAULT_CONTEXT;
    const activePanel = inspectorDockApi?.setPanels?.(inspectorContextTabsForWorkspace(), { activePanel: requestedPanel }) || requestedPanel;
    if (activePanel !== requestedPanel) {
      workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, activePanel, { notify: false });
    }
    return activePanel;
  }

  function showInspectorContext(contextId, options = {}) {
    const label = inspectorContextLabel(contextId);
    workspaceCustomizer?.setPanelTabVisible?.(INSPECTOR_PANEL_ID, contextId, true, { notify: false });
    const activeContext = workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, contextId, { notify: false }) || contextId;
    workspaceCustomizer?.setPanelVisible?.(INSPECTOR_PANEL_ID, true);
    syncInspectorDockTabs();
    const shown = inspectorDockApi?.activate?.(activeContext, { notify: false, focus: options.focus !== false, persist: false }) === true;
    if (options.status !== false) {
      onStatusChange(shown ? `${label} shown in ${INSPECTOR_PANEL_LABEL}.` : `${label} inspector is not available.`);
    }
    refreshCommandState();
    return shown;
  }

  function showInspectorProperties(options = {}) {
    return showInspectorContext(INSPECTOR_DEFAULT_CONTEXT, {
      focus: false,
      status: options.notify === true
    });
  }

  function showDataDockTab(tabId) {
    workspaceCustomizer?.setPanelTabVisible?.(DATA_DOCK_PANEL_ID, tabId, true, { notify: false });
    const activeTab = workspaceCustomizer?.setPanelActiveTab?.(DATA_DOCK_PANEL_ID, tabId, { notify: false }) || tabId;
    workspaceCustomizer?.setPanelVisible?.(DATA_DOCK_PANEL_ID, true);
    syncDataDockTabs();
    onStatusChange(`${dataDockTabLabel(activeTab)} shown in ${DATA_DOCK_COMMAND_LABEL}.`);
    refreshCommandState();
    return activeTab;
  }

  function applyViewerOverlayWorkspace(viewerOverlays = {}) {
    if (!navCubeRoot) return;
    const navCube = normalizeViewerOverlaysWorkspace(viewerOverlays).navCube;
    const visible = navCube?.visible !== false;
    navCubeRoot.hidden = !visible;
    navCubeRoot.dataset.overlayVisible = visible ? "true" : "false";
    navCubeRoot.dataset.overlayCorner = navCube?.corner || "bottom-right";
  }

  function rightDockOccupiesNavCubeCorner(dock) {
    return Boolean(dock)
      && !dock.hidden
      && dock.dataset.authoringActive !== "true"
      && dock.dataset.workspacePanelVisible !== "false"
      && dock.dataset.workspacePanelDock === "right"
      && dock.dataset.workspacePanelSideDock === "true"
      && (
        dock.dataset.workspacePanelPinned !== "false"
        || dock.dataset.workspacePanelRevealed === "true"
      );
  }

  function syncNavCubeDockClearance() {
    if (!navCubeRoot) return;
    const dock = inspectorDock;
    const dockVisible = rightDockOccupiesNavCubeCorner(dock);
    const dockWidth = dockVisible
      ? Math.max(0, Math.ceil(dock.getBoundingClientRect?.().width || Number(dock.dataset.workspacePanelWidth) || 0))
      : 0;
    navCubeRoot.style.setProperty("--bc-nav-cube-right-dock-clearance", `${dockWidth}px`);
  }

  function bindNavCubeDockClearanceObserver() {
    if (!navCubeRoot) return;
    if (!navCubeDockClearanceObserver) {
      window.addEventListener("resize", syncNavCubeDockClearance);
      if (typeof ResizeObserver === "function" && inspectorDock) {
        navCubeDockClearanceObserver = new ResizeObserver(syncNavCubeDockClearance);
        navCubeDockClearanceObserver.observe(inspectorDock);
      }
    }
    if (!navCubeDockClearanceMutationObserver && typeof MutationObserver === "function" && inspectorDock) {
      navCubeDockClearanceMutationObserver = new MutationObserver(syncNavCubeDockClearance);
      navCubeDockClearanceMutationObserver.observe(inspectorDock, {
        attributeFilter: [
          "data-authoring-active",
          "data-workspace-panel-dock",
          "data-workspace-panel-pinned",
          "data-workspace-panel-revealed",
          "data-workspace-panel-side-dock",
          "data-workspace-panel-visible",
          "data-workspace-panel-width",
          "hidden"
        ],
        attributes: true
      });
    }
  }

  function mountWorkspaceCustomizer() {
    workspaceCustomizer = mountToolbarWorkspaceCustomization({
      toolbar,
      topbarActions,
      shell,
      commands: () => getViewerCommandItems(),
      panels: panelSpecs(),
      defaultWorkspace,
      onWorkspaceChange: (workspace) => {
        getStatusBar()?.setWorkspace?.(workspace?.bottomStrip);
        getViewerSettingsUi()?.setWorkspace?.(workspace?.viewerSettingsStrip);
        applyViewerOverlayWorkspace(workspace?.viewerOverlays);
        syncDataDockTabs();
        syncInspectorDockTabs();
        syncNavCubeDockClearance();
        featureNavbar?.refresh?.();
        getCommandPalette()?.refresh?.();
      },
      onStatusChange
    });
    return workspaceCustomizer;
  }

  function mountInspectorDockTabs() {
    if (!inspectorDock) return null;
    inspectorDockApi = mountInspectorDock({
      root: inspectorDock,
      activePanel: inspectorActiveContext(),
      panels: inspectorContextTabsForWorkspace(),
      onActivePanelChange: (contextId) => {
        workspaceCustomizer?.setPanelActiveTab?.(INSPECTOR_PANEL_ID, contextId, { notify: false });
        refreshCommandState();
      },
      onStatusChange
    });
    syncInspectorDockTabs();
    return inspectorDockApi;
  }

  function mountDataDockTabs() {
    if (!libraryPanel) return null;
    leftDockTabs = mountDockTabs({
      root: libraryPanel,
      activeTab: dataDockActiveTab(),
      label: `${DATA_DOCK_COMMAND_LABEL} panels`,
      tabs: dataDockTabsForWorkspace(),
      getActiveTab: dataDockActiveTab,
      onActiveTabChange: (tabId) => {
        workspaceCustomizer?.setPanelActiveTab?.(DATA_DOCK_PANEL_ID, tabId, { notify: false });
        refreshCommandState();
      },
      onStatusChange
    });
    return leftDockTabs;
  }

  function visibleFeatureNavbarGroups(workspace = {}) {
    const featureNavbarState = workspace.navigation?.featureNavbar || {};
    const order = Array.isArray(featureNavbarState.groupIds) && featureNavbarState.groupIds.length
      ? featureNavbarState.groupIds
      : COMMAND_GROUP_ORDER;
    const hidden = new Set(Array.isArray(featureNavbarState.hiddenGroupIds) ? featureNavbarState.hiddenGroupIds : []);
    return order.filter((groupId) => COMMAND_GROUP_ORDER.includes(groupId) && !hidden.has(groupId));
  }

  function workspaceCommandItems(options = {}) {
    return withWorkspaceCommand(() => getViewerCommandItems(options), workspaceCustomizer)();
  }

  function mountFeatureNavbarTabs({ root } = {}) {
    featureNavbar = mountFeatureNavbar({
      root,
      commands: () => workspaceCommandItems(),
      groups: () => visibleFeatureNavbarGroups(workspaceCustomizer?.state?.()),
      onStatusChange
    });
    return featureNavbar;
  }

  function refreshCommandState() {
    leftDockTabs?.refresh?.();
    workspaceCustomizer?.refreshCommandState?.();
    getViewerSettingsUi()?.refresh?.();
    featureNavbar?.refresh?.();
    getCommandPalette()?.refresh?.();
  }

  return {
    workspace: () => workspaceCustomizer,
    inspectorDockApi: () => inspectorDockApi,
    dataDockElement,
    inspectorDockElement,
    inspectorContextPanel,
    inspectorContextAvailable: (contextId) => inspectorContextPanel(contextId)?.hidden !== true,
    dataDockActiveTab,
    inspectorActiveContext,
    dataDockVisible: () => panelVisible(DATA_DOCK_PANEL_ID, dataDockElement()),
    inspectorDockVisible: () => panelVisible(INSPECTOR_PANEL_ID, inspectorDock || inspectorContextPanel("properties")),
    mountWorkspaceCustomizer,
    mountInspectorDockTabs,
    mountDataDockTabs,
    mountFeatureNavbarTabs,
    workspaceCommandItems,
    syncDataDockTabs,
    syncInspectorDockTabs,
    showDataDockTab,
    showInspectorContext,
    showInspectorProperties,
    applyViewerOverlayWorkspace,
    syncNavCubeDockClearance,
    bindNavCubeDockClearanceObserver,
    refreshCommandState
  };
}
