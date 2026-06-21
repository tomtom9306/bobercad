import { createIcon } from "../icons/icon-registry.mjs";
import { applyCommandState, applyTooltip, iconButton, toolbarOverflowMenuItemControl } from "../design-system/ui-elements.mjs";
import { commandGroupId, toolbarGroupLabel } from "./workspace-customizer-state.mjs";

const WORKSPACE_TOOLBAR_GROUP_SELECTOR = ":scope > .bc-toolbar-group[data-workspace-toolbar-group]";

export function createToolbarCommandButton(command, setToolbarStatus = () => {}) {
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

export function syncToolbarCommandButton(button, command) {
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

export function ensureInitialWorkspaceToolbarGroup(toolbar, groupId = "") {
  const managed = toolbar.querySelector(WORKSPACE_TOOLBAR_GROUP_SELECTOR);
  if (managed) return managed;
  const firstGroup = toolbar.querySelector(":scope > .bc-toolbar-group");
  if (!firstGroup) return null;
  stampWorkspaceToolbarGroup(firstGroup, groupId || "model");
  return firstGroup;
}

export function ensureWorkspaceToolbarCommandGroup(toolbar, groupId, commands = []) {
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

export function collectWorkspaceToolbarButtons(toolbar) {
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

export function workspaceToolbarCommandButtons(toolbar) {
  return [...toolbar.querySelectorAll(`${WORKSPACE_TOOLBAR_GROUP_SELECTOR} > [data-command-id]`)];
}

export function removeUnusedWorkspaceToolbarGroups(toolbar, activeGroupIds = new Set()) {
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

export function ensureToolbarOverflow(toolbar, existing = null) {
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

export function renderToolbarOverflowMenu(overflow, entries = [], setStatus = () => {}) {
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
