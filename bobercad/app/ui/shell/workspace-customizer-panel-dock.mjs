import { dockPinToggleControl, dockResizeHandleControl, dockRevealToggleControl } from "../design-system/ui-elements.mjs";
import { normalizePanelActiveTab, normalizePanelDock, normalizePanelState } from "./workspace-customizer-state.mjs";

export function panelTabStateForPanel(panel, panelState = {}) {
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

export function ensurePanelResizeHandle(panel) {
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

export function ensurePanelRevealToggle(panel) {
  let button = panel.element.querySelector(".bc-dock-reveal-toggle");
  if (!button) {
    button = dockRevealToggleControl({ label: `Show ${panel.label}` });
  }
  const host = panel.element.querySelector(".bc-dock-reveal-slot") || panel.element;
  if (button.parentElement !== host) host.append(button);
  return button;
}

export function ensurePanelPinToggle(panel) {
  let button = panel.element.querySelector(".bc-dock-pin-toggle");
  if (!button) {
    button = dockPinToggleControl({ label: `Pin ${panel.label}` });
  }
  const host = panel.element.querySelector(".bc-dock-reveal-slot") || panel.element;
  if (button.parentElement !== host) {
    if (host.classList?.contains("bc-dock-reveal-slot")) host.prepend(button);
    else host.append(button);
  }
  return button;
}

export function syncPanelPinToggle(panel, workspaceState = {}) {
  const button = panel.element.querySelector(".bc-dock-pin-toggle");
  if (!button) return;
  const dock = workspacePanelDock(panel, workspaceState);
  const pinned = workspaceState.panels?.[panel.id]?.pinned !== false;
  const label = `${pinned ? "Unpin" : "Pin"} ${panel.label}`;
  dockPinToggleControl({ button, dock, pinned, label });
}

export function syncPanelRevealToggle(panel, workspaceState = {}) {
  const button = panel.element.querySelector(".bc-dock-reveal-toggle");
  if (!button) return;
  const dock = workspacePanelDock(panel, workspaceState);
  const pinned = workspaceState.panels?.[panel.id]?.pinned !== false;
  const revealed = pinned || panel.element.dataset.workspacePanelRevealed === "true";
  const label = `${revealed ? "Hide" : "Show"} ${panel.label}`;
  dockRevealToggleControl({ button, dock, revealed, pinned, label });
}

export function syncPanelDockOffset(panel, workspaceState = {}) {
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

export function isSidePanelDock(dock) {
  return dock === "left" || dock === "right";
}

export function workspacePanelDock(panel, workspaceState = {}) {
  return normalizePanelDock(workspaceState?.panels?.[panel.id]?.dock, normalizePanelDock(panel?.dock));
}
