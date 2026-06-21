import { applyTooltip } from "../design-system/ui-elements.mjs";
import { createIcon } from "../icons/icon-registry.mjs";

function validTabs(tabs = []) {
  return tabs
    .map((tab) => ({ ...tab, id: String(tab?.id || "").trim() }))
    .filter((tab) => tab.id && tab.panel);
}

function activeTabId(id, tabs, fallbackId) {
  return tabs.some((tab) => tab.id === id) ? id : fallbackId;
}

function removeExistingTabbar(root) {
  const tabbar = root.querySelector(":scope > .bc-dock-tabs");
  const revealButton = tabbar?.querySelector(".bc-dock-reveal-toggle");
  const pinButton = tabbar?.querySelector(".bc-dock-pin-toggle");
  const dock = root.closest?.(".bc-left-dock, .bc-right-dock");
  if (revealButton && dock) dock.append(revealButton);
  if (pinButton && dock) dock.append(pinButton);
  tabbar?.remove();
}

function panelId(tab, rootId) {
  return tab.panel.id || `${rootId}-${tab.id}-panel`;
}

function revealParentDock(root) {
  const dock = root.closest?.(".bc-left-dock, .bc-right-dock");
  if (!dock || dock.dataset.workspacePanelPinned !== "false") return false;
  dock.dataset.workspacePanelRevealed = "true";
  const revealButton = dock.querySelector(".bc-dock-reveal-toggle");
  if (revealButton) {
    revealButton.setAttribute("aria-expanded", "true");
    revealButton.dataset.panelRevealed = "true";
  }
  return true;
}

function createTabButton({ tab, root, rootId, activeId, activate, onKeydown }) {
  const button = document.createElement("button");
  const label = tab.label || tab.id;
  button.type = "button";
  button.className = "bc-dock-tab";
  button.id = `${rootId}-${tab.id}-tab`;
  button.dataset.dockTab = tab.id;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", tab.id === activeId ? "true" : "false");
  button.setAttribute("aria-controls", panelId(tab, rootId));
  button.tabIndex = tab.id === activeId ? 0 : -1;
  applyTooltip(button, tab.title || label);
  if (tab.icon) button.append(createIcon(tab.icon));
  const text = document.createElement("span");
  text.className = "bc-dock-tab-label";
  text.textContent = label;
  button.append(text);
  button.addEventListener("click", () => {
    revealParentDock(root);
    activate(tab.id, { notify: true });
  });
  if (onKeydown) button.addEventListener("keydown", onKeydown);
  return button;
}

export function mountDockTabs({
  root,
  tabs,
  activeTab = "",
  label = "Dock tabs",
  getActiveTab = null,
  onActiveTabChange = null,
  onStatusChange
} = {}) {
  if (!root) throw new Error("mountDockTabs requires a root element.");
  let tabSpecs = validTabs(tabs);
  if (!tabSpecs.length) {
    removeExistingTabbar(root);
    return { activate: () => false, activeTab: () => "", refresh: () => {}, setTabs: () => "", destroy: () => {} };
  }

  const panelByTabId = new Map(tabSpecs.map((tab) => [tab.id, tab.panel]));
  const fallbackId = activeTabId(activeTab, tabSpecs, tabSpecs[0].id);
  let activeId = activeTabId(getActiveTab?.(), tabSpecs, fallbackId);
  const rootId = root.id || "dock";

  const focusTab = (id) => {
    window.requestAnimationFrame(() => {
      const button = [...root.querySelectorAll("[data-dock-tab]")].find((item) => item.dataset.dockTab === id);
      button?.focus();
    });
  };

  const applyPanelState = () => {
    for (const [tabId, panel] of panelByTabId) {
      if (!tabSpecs.some((tab) => tab.id === tabId)) panel.hidden = true;
    }
    for (const tab of tabSpecs) {
      const selected = tab.id === activeId;
      panelByTabId.set(tab.id, tab.panel);
      if (!tab.panel.id) tab.panel.id = panelId(tab, rootId);
      tab.panel.classList.add("bc-dock-tab-panel");
      tab.panel.dataset.dockTabPanel = tab.id;
      tab.panel.setAttribute("role", "tabpanel");
      tab.panel.setAttribute("aria-labelledby", `${rootId}-${tab.id}-tab`);
      tab.panel.hidden = !selected;
    }
  };

  const render = () => {
    removeExistingTabbar(root);
    const tabbar = document.createElement("div");
    tabbar.className = "bc-dock-tabs";
    const tablist = document.createElement("div");
    tablist.className = "bc-dock-tab-list";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-orientation", "vertical");
    tablist.setAttribute("aria-label", label);
    for (const tab of tabSpecs) {
      tablist.append(createTabButton({ tab, root, rootId, activeId, activate, onKeydown: handleKeydown }));
    }
    const revealSlot = document.createElement("div");
    revealSlot.className = "bc-dock-reveal-slot";
    const dock = root.closest?.(".bc-left-dock, .bc-right-dock");
    const pinButton = dock?.querySelector(".bc-dock-pin-toggle");
    const revealButton = dock?.querySelector(".bc-dock-reveal-toggle");
    if (pinButton) revealSlot.append(pinButton);
    if (revealButton) revealSlot.append(revealButton);
    tabbar.append(revealSlot, tablist);
    tabbar.addEventListener("click", (event) => {
      if (event.target?.closest?.(".bc-dock-reveal-toggle, .bc-dock-pin-toggle")) return;
      revealParentDock(root);
    });
    root.prepend(tabbar);
    applyPanelState();
  };

  function activate(id, { notify = false } = {}) {
    if (!tabSpecs.some((tab) => tab.id === id)) return false;
    if (activeId === id) return true;
    activeId = id;
    render();
    onActiveTabChange?.(id);
    if (notify) {
      const tab = tabSpecs.find((item) => item.id === id);
      onStatusChange?.(`${tab?.label || id} panel shown.`);
    }
    return true;
  }

  function handleKeydown(event) {
    const currentIndex = tabSpecs.findIndex((tab) => tab.id === activeId);
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabSpecs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabSpecs.length) % tabSpecs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabSpecs.length - 1;
    else return;
    event.preventDefault();
    const nextId = tabSpecs[nextIndex].id;
    activate(nextId, { notify: true });
    focusTab(nextId);
  }

  render();

  return {
    activate,
    activeTab: () => activeId,
    refresh: () => {
      activeId = activeTabId(getActiveTab?.(), tabSpecs, activeId);
      render();
    },
    setTabs: (nextTabs = [], options = {}) => {
      const nextTabSpecs = validTabs(nextTabs);
      if (!nextTabSpecs.length) {
        removeExistingTabbar(root);
        for (const panel of panelByTabId.values()) panel.hidden = true;
        activeId = "";
        return activeId;
      }
      for (const tab of nextTabSpecs) panelByTabId.set(tab.id, tab.panel);
      tabSpecs = nextTabSpecs;
      activeId = activeTabId(options.activeTab || getActiveTab?.(), tabSpecs, activeId || tabSpecs[0].id);
      render();
      return activeId;
    },
    destroy: () => {
      removeExistingTabbar(root);
      for (const panel of panelByTabId.values()) {
        delete panel.dataset.dockTabPanel;
        panel.classList.remove("bc-dock-tab-panel");
        panel.removeAttribute("role");
        panel.removeAttribute("aria-labelledby");
        panel.hidden = false;
      }
    }
  };
}
