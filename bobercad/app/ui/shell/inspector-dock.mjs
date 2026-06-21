import { applyTooltip } from "../design-system/ui-elements.mjs";
import { createIcon } from "../icons/icon-registry.mjs";

function validPanels(panels = []) {
  return panels
    .map((panel) => ({ ...panel, id: String(panel?.id || "").trim() }))
    .filter((panel) => panel.id && panel.panel);
}

function ensureShell(root) {
  const existing = root.querySelector(":scope > .bc-inspector-dock-shell");
  if (existing) return {
    shell: existing,
    tabbar: existing.querySelector(":scope > .bc-dock-tabs"),
    tablist: existing.querySelector(":scope > .bc-dock-tabs > .bc-dock-tab-list"),
    body: existing.querySelector(":scope > .bc-inspector-dock-body")
  };

  const shell = document.createElement("section");
  shell.className = "bc-inspector-dock-shell";
  shell.setAttribute("aria-label", "Properties");

  const tabbar = document.createElement("div");
  tabbar.className = "bc-dock-tabs bc-inspector-dock-tabs";

  const revealSlot = document.createElement("div");
  revealSlot.className = "bc-dock-reveal-slot";

  const tablist = document.createElement("div");
  tablist.className = "bc-dock-tab-list";
  tabbar.append(revealSlot, tablist);

  const body = document.createElement("div");
  body.className = "bc-inspector-dock-body";

  shell.append(tabbar, body);
  root.prepend(shell);
  return { shell, tabbar, tablist, body };
}

function availablePanels(panelSpecs) {
  return panelSpecs.filter((spec) => spec.panel.hidden !== true);
}

function syncRevealButton(root, tabbar) {
  const revealSlot = tabbar?.querySelector(":scope > .bc-dock-reveal-slot");
  const revealButton = root.querySelector(".bc-dock-reveal-toggle");
  if (revealSlot && revealButton && !revealSlot.contains(revealButton)) revealSlot.append(revealButton);
}

function tabId(rootId, panelId) {
  return `${rootId}-${panelId}-inspector-tab`;
}

function panelId(rootId, panelId) {
  return `${rootId}-${panelId}-inspector-panel`;
}

export function mountInspectorDock({
  root,
  panels,
  activePanel = "",
  onActivePanelChange,
  onStatusChange
} = {}) {
  if (!root) throw new Error("mountInspectorDock requires a root element.");
  let panelSpecs = validPanels(panels);
  if (!panelSpecs.length) return { refresh: () => {}, setPanels: () => "", activePanel: () => "", activate: () => false, destroy: () => {} };

  const { shell, tabbar, tablist, body } = ensureShell(root);
  const rootId = root.id || "inspector";
  let fallbackId = panelSpecs.some((spec) => spec.id === activePanel) ? activePanel : panelSpecs[0].id;
  let activeId = fallbackId;
  let observers = [];
  const knownPanels = new Map();

  mountPanelSpecs(panelSpecs);
  bindObservers();

  const activePanelSpec = () => panelSpecs.find((spec) => spec.id === activeId) || null;

  const focusActivePanel = () => {
    window.requestAnimationFrame(() => {
      const panel = activePanelSpec()?.panel;
      const focusTarget = panel?.querySelector?.("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusTarget) {
        focusTarget.focus();
        return;
      }
      if (panel && !panel.hasAttribute("tabindex")) panel.tabIndex = -1;
      panel?.focus?.();
    });
  };

  const focusTab = (id) => {
    window.requestAnimationFrame(() => {
      tablist.querySelector(`[data-inspector-tab="${id}"]`)?.focus?.();
    });
  };

  const activateRelativeTab = (direction) => {
    const available = availablePanels(panelSpecs);
    if (!available.length) return;
    const currentIndex = Math.max(0, available.findIndex((spec) => spec.id === activeId));
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? available.length - 1
        : (currentIndex + direction + available.length) % available.length;
    const nextId = available[nextIndex]?.id;
    if (!nextId) return;
    activate(nextId, { notify: true, focus: false });
    focusTab(nextId);
  };

  const render = () => {
    const available = availablePanels(panelSpecs);
    shell.hidden = available.length === 0;
    syncRevealButton(root, tabbar);

    if (!available.some((spec) => spec.id === activeId)) {
      activeId = available[0]?.id || fallbackId;
    }

    tablist.replaceChildren();
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-orientation", "vertical");
    tablist.setAttribute("aria-label", "Inspector contexts");

    for (const spec of available) {
      const isActive = spec.id === activeId;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "bc-dock-tab";
      tab.dataset.dockTab = spec.id;
      tab.dataset.inspectorTab = spec.id;
      tab.id = tabId(rootId, spec.id);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("aria-controls", spec.panel.id || panelId(rootId, spec.id));
      tab.tabIndex = isActive ? 0 : -1;
      applyTooltip(tab, spec.description || spec.label || spec.id);
      tab.append(createIcon(spec.icon || "inspector"), textSpan(spec.label || spec.id, "bc-dock-tab-label"));
      tab.addEventListener("click", () => activate(spec.id, { notify: true, focus: false }));
      tab.addEventListener("keydown", handleTabKeydown);
      tablist.append(tab);
    }

    const visiblePanelIds = new Set(panelSpecs.map((spec) => spec.id));
    for (const spec of knownPanels.values()) {
      if (visiblePanelIds.has(spec.id)) continue;
      applyPanelState(spec, false, false);
    }

    for (const spec of panelSpecs) {
      const isAvailable = spec.panel.hidden !== true;
      const isActive = isAvailable && spec.id === activeId;
      applyPanelState(spec, isAvailable, isActive);
    }
  };

  function handleTabKeydown(event) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      activateRelativeTab(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      activateRelativeTab(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      activateRelativeTab("first");
    } else if (event.key === "End") {
      event.preventDefault();
      activateRelativeTab("last");
    }
  }

  function applyPanelState(spec, isAvailable, isActive) {
    spec.panel.dataset.inspectorAvailable = isAvailable ? "true" : "false";
    spec.panel.dataset.inspectorActive = isActive ? "true" : "false";
    spec.panel.setAttribute("role", "tabpanel");
    spec.panel.setAttribute("aria-labelledby", tabId(rootId, spec.id));
    spec.panel.setAttribute("aria-label", spec.label || spec.id);
    spec.panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    spec.panel.tabIndex = isActive ? 0 : -1;
  }

  function mountPanelSpecs(specs) {
    for (const spec of specs) {
      spec.panel.classList.add("bc-inspector-context-panel");
      spec.panel.dataset.inspectorContext = spec.id;
      spec.panel.dataset.inspectorLabel = spec.label || spec.id;
      if (!spec.panel.id) spec.panel.id = panelId(rootId, spec.id);
      body.append(spec.panel);
      knownPanels.set(spec.id, spec);
    }
  }

  function bindObservers() {
    observers.forEach((observer) => observer.disconnect());
    observers = [];
    for (const spec of panelSpecs) {
      const observer = new MutationObserver(() => render());
      observer.observe(spec.panel, { attributes: true, attributeFilter: ["hidden"] });
      observers.push(observer);
    }
  }

  function setPanels(nextPanels = [], { activePanel: nextActivePanel = activeId } = {}) {
    const nextSpecs = validPanels(nextPanels);
    if (!nextSpecs.length) return activeId;
    panelSpecs = nextSpecs;
    fallbackId = panelSpecs.some((spec) => spec.id === nextActivePanel) ? nextActivePanel : panelSpecs[0].id;
    activeId = fallbackId;
    mountPanelSpecs(panelSpecs);
    bindObservers();
    render();
    return activeId;
  }

  function activate(id, { notify = false, focus = true, persist = true } = {}) {
    const spec = panelSpecs.find((item) => item.id === id && item.panel.hidden !== true);
    if (!spec) return false;
    activeId = id;
    render();
    if (persist) onActivePanelChange?.(id);
    if (focus) focusActivePanel();
    if (notify) onStatusChange?.(`${spec.label || id} inspector shown.`);
    return true;
  }
  render();

  return {
    refresh: render,
    setPanels,
    activePanel: () => activeId,
    activate,
    destroy: () => {
      observers.forEach((observer) => observer.disconnect());
      for (const spec of knownPanels.values()) {
        delete spec.panel.dataset.inspectorContext;
        delete spec.panel.dataset.inspectorLabel;
        delete spec.panel.dataset.inspectorAvailable;
        delete spec.panel.dataset.inspectorActive;
        spec.panel.classList.remove("bc-inspector-context-panel");
        spec.panel.removeAttribute("role");
        spec.panel.removeAttribute("aria-labelledby");
        spec.panel.removeAttribute("aria-hidden");
        spec.panel.removeAttribute("aria-label");
        spec.panel.removeAttribute("tabindex");
        root.append(spec.panel);
      }
      shell.remove();
    }
  };
}

function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
