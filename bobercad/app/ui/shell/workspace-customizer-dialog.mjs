import { createIcon } from "../icons/icon-registry.mjs";
import { applyTooltip, bindWorkspaceCustomizerRowReorderDrag, segmentedControl, workspaceCustomizerActionRow, workspaceCustomizerDragHandle, workspaceCustomizerMoveButton, workspaceCustomizerToggleRow } from "../design-system/ui-elements.mjs";
import { BOTTOM_STRIP_DEFAULT_ITEM_IDS, bottomStripItemSpec } from "../commands/bottom-strip-metadata.mjs";
import { commandGroupSpec } from "../commands/command-group-metadata.mjs";
import { viewerSettingsStripGroupSpec } from "../commands/settings-strip-metadata.mjs";
import { VIEWER_SETTINGS_STRIP_DEFAULT_GROUP_IDS, commandGroupId, normalizeBottomStripWorkspace, normalizeDensity, normalizeNavigationWorkspace, normalizePanelDock, normalizeTheme, normalizeViewerOverlaysWorkspace, normalizeViewerSettingsStripWorkspace, overlayCornerLabel, toolbarGroups, viewerOverlayEntries } from "./workspace-customizer-state.mjs";

const DEFAULT_TOOLBAR_DOCK = "top";
const VIEWER_OVERLAY_CORNER_SPECS = [
  { id: "bottom-right", label: "Bottom right", shortLabel: "BR" },
  { id: "bottom-left", label: "Bottom left", shortLabel: "BL" },
  { id: "top-right", label: "Top right", shortLabel: "TR" },
  { id: "top-left", label: "Top left", shortLabel: "TL" }
];

function titleCase(value = "") {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function mountWorkspaceCustomizer({
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
          sectionBlock(sectionTitle("Editing"), settingsList(modeRow))
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
