import { applyCommandState, applyTooltip, compactShortcut } from "../design-system/ui-elements.mjs?v=tooltip-clean-1";
import { createIcon } from "../icons/icon-registry.mjs?v=model-grid-navbar-1";
import {
  COMMAND_GROUP_ORDER,
  commandGroupIcon,
  commandGroupLabel,
  commandGroupSpec,
  commandRibbonSectionLabel,
  commandRibbonSectionOrder,
  inferCommandRibbonSection
} from "../commands/command-group-metadata.mjs?v=ribbon-section-metadata-1";

const FEATURE_NAVBAR_SURFACE = "feature-navbar";

export function mountFeatureNavbar({
  root,
  commands = [],
  groups = COMMAND_GROUP_ORDER,
  onStatusChange
} = {}) {
  if (!root) return null;

  const state = {
    activeGroup: null
  };

  root.classList.add("bc-feature-navbar");
  root.setAttribute("aria-label", root.getAttribute("aria-label") || "Feature navigation");
  render();

  return {
    refresh: render,
    close: () => {},
    isOpen: () => false,
    destroy() {
      root.replaceChildren();
    }
  };

  function render() {
    const grouped = commandGroups(resolveCommands(commands), resolveGroups(groups));
    const activeGroup = resolveActiveGroup(grouped);
    root.replaceChildren(renderTabs(grouped, activeGroup), renderRibbon(activeGroup));
  }

  function resolveActiveGroup(grouped) {
    if (!grouped.length) {
      state.activeGroup = null;
      return null;
    }
    const current = grouped.find((group) => group.id === state.activeGroup);
    if (current) return current;
    state.activeGroup = grouped[0].id;
    return grouped[0];
  }

  function renderTabs(grouped, activeGroup) {
    const tabs = document.createElement("div");
    tabs.className = "bc-feature-nav-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Command tabs");
    tabs.append(...grouped.map((group, index) => renderTab(group, activeGroup?.id === group.id, index, grouped)));
    return tabs;
  }

  function renderTab(group, selected, index, grouped) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = featureTabId(group.id);
    tab.className = "bc-feature-nav-tab";
    tab.dataset.featureNavTrigger = group.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.setAttribute("aria-controls", featurePanelId(group.id));
    tab.tabIndex = selected ? 0 : -1;
    tab.append(createIcon(group.icon || "more"), textSpan(group.label, "bc-feature-nav-tab-label"));
    applyTooltip(tab, group.description || group.label);
    tab.addEventListener("click", () => activateGroup(group.id));
    tab.addEventListener("keydown", (event) => handleTabKeydown(event, index, grouped));
    return tab;
  }

  function renderRibbon(group) {
    const ribbon = document.createElement("div");
    ribbon.className = "bc-feature-nav-ribbon";
    ribbon.setAttribute("role", "tabpanel");

    if (!group) {
      return ribbon;
    }

    ribbon.id = featurePanelId(group.id);
    ribbon.setAttribute("aria-labelledby", featureTabId(group.id));
    ribbon.dataset.featureNavPanel = group.id;

    const sections = ribbonSections(group);
    if (!sections.length) {
      return ribbon;
    }

    const scroller = document.createElement("div");
    scroller.className = "bc-feature-nav-ribbon-scroller";
    scroller.append(...sections.map(renderSection));
    ribbon.append(scroller);
    return ribbon;
  }

  function renderSection(section) {
    const sectionNode = document.createElement("section");
    sectionNode.className = "bc-feature-ribbon-section";
    sectionNode.setAttribute("aria-label", section.label);

    const commandsNode = document.createElement("div");
    commandsNode.className = "bc-feature-ribbon-section-commands";
    commandsNode.append(...section.commands.map(renderCommand));

    const title = textSpan(section.label, "bc-feature-ribbon-section-title");
    sectionNode.append(commandsNode, title);
    return sectionNode;
  }

  function renderCommand(command) {
    const id = requiredCommandField(command, "id");
    const labelText = command.label || command.title || id;
    const titleText = command.title || labelText;
    const disabled = !commandEnabled(command);
    const active = command.active === true;

    const item = document.createElement("button");
    item.type = "button";
    item.className = "bc-feature-ribbon-command";
    applyCommandState(item, {
      command,
      commandId: id,
      active,
      enabled: !disabled,
      disabledReason: commandDisabledReason(command),
      title: titleText,
      shortcut: command.shortcutLabel || "",
      current: true
    });
    item.addEventListener("click", () => runCommand(command));
    item.addEventListener("keydown", handleCommandKeydown);

    const icon = document.createElement("span");
    icon.className = "bc-feature-ribbon-command-icon";
    icon.append(createIcon(command.icon || "more"));

    const copy = document.createElement("span");
    copy.className = "bc-feature-ribbon-command-copy";
    copy.append(textSpan(labelText, "bc-feature-ribbon-command-label"));

    const meta = document.createElement("span");
    meta.className = "bc-feature-ribbon-command-meta";
    if (active) meta.append(textSpan("Active", "bc-feature-ribbon-command-state"));
    if (command.shortcutLabel) {
      const shortcut = document.createElement("kbd");
      shortcut.className = "bc-keycap";
      shortcut.textContent = compactShortcut(command.shortcutLabel);
      meta.append(shortcut);
    }

    item.append(icon, copy, meta);
    return item;
  }

  function activateGroup(groupId, { focus = false } = {}) {
    if (state.activeGroup === groupId) return;
    state.activeGroup = groupId;
    render();
    if (focus) root.querySelector(`[data-feature-nav-trigger="${cssEscape(groupId)}"]`)?.focus();
  }

  function runCommand(command) {
    if (!commandEnabled(command)) {
      onStatusChange?.(commandDisabledReason(command));
      render();
      return;
    }
    try {
      const result = command.run?.(command);
      if (result === false) {
        onStatusChange?.(commandDisabledReason(command));
        render();
      }
    } catch (error) {
      console.error(error);
      onStatusChange?.(`Command failed: ${error?.message || String(error)}`);
    }
  }

  function handleTabKeydown(event, index, grouped) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = grouped[(index + delta + grouped.length) % grouped.length];
      activateGroup(next.id, { focus: true });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? grouped[0] : grouped[grouped.length - 1];
      activateGroup(next.id, { focus: true });
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      root.querySelector(".bc-feature-ribbon-command")?.focus();
    }
  }

  function handleCommandKeydown(event) {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...root.querySelectorAll(".bc-feature-ribbon-command")];
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, items.indexOf(event.currentTarget));
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = currentIndex + 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = currentIndex - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    items[(nextIndex + items.length) % items.length]?.focus();
  }
}

function commandGroups(commands, groupOrder) {
  const allowedGroups = new Set(groupOrder);
  const groupsById = new Map(groupOrder.map((id) => {
    const spec = commandGroupSpec(id);
    return [id, {
      id,
      label: spec?.label || commandGroupLabel(id),
      icon: spec?.icon || commandGroupIcon(id) || "more",
      description: spec?.description || "",
      commands: []
    }];
  }));
  for (const command of commands) {
    if (command?.navSurface !== FEATURE_NAVBAR_SURFACE) continue;
    const id = command.group || "other";
    if (!allowedGroups.has(id)) continue;
    const group = groupsById.get(id);
    if (!group) continue;
    group.commands.push(command);
  }
  return groupOrder
    .map((id) => groupsById.get(id))
    .filter((group) => group?.commands?.length);
}

function ribbonSections(group) {
  const sectionsById = new Map();
  for (const command of group.commands) {
    const sectionId = command.ribbonSection || inferCommandRibbonSection(group.id, command);
    const section = sectionsById.get(sectionId) || {
      id: sectionId,
      label: command.ribbonSectionLabel || commandRibbonSectionLabel(sectionId),
      commands: []
    };
    section.commands.push(command);
    sectionsById.set(sectionId, section);
  }
  const order = commandRibbonSectionOrder(group.id);
  const dynamicOrder = [...order, ...[...sectionsById.keys()].filter((id) => !order.includes(id))];
  return dynamicOrder.map((id) => sectionsById.get(id)).filter(Boolean);
}

function resolveCommands(commands) {
  const resolved = typeof commands === "function" ? commands() : commands;
  return Array.isArray(resolved) ? resolved : [];
}

function resolveGroups(groups) {
  const resolved = typeof groups === "function" ? groups() : groups;
  return Array.isArray(resolved) && resolved.length ? resolved : COMMAND_GROUP_ORDER;
}

function commandEnabled(command) {
  return command?.enabled !== false && command?.disabled !== true;
}

function commandDisabledReason(command) {
  return command?.disabledReason || "Command unavailable.";
}

function requiredCommandField(command, field) {
  const value = command?.[field];
  if (!value) throw new Error(`Feature navbar command missing ${field}.`);
  return value;
}

function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function featureTabId(groupId) {
  return `feature-nav-tab-${domId(groupId)}`;
}

function featurePanelId(groupId) {
  return `feature-nav-panel-${domId(groupId)}`;
}

function domId(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9_-]+/g, "-");
}

function cssEscape(value) {
  return window.CSS?.escape?.(value) || String(value).replace(/"/g, "\\\"");
}
