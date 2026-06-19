import { applyCommandState, segmentedControl } from "../design-system/ui-elements.mjs?v=command-state-1";
import { createIcon } from "../icons/icon-registry.mjs?v=visibility-menu-1";
import { DISPLAY_MODE_SPECS, VIEW_ORIENTATION_SPECS, activeViewOrientation, normalizeDisplayMode, normalizeViewOrientation } from "../commands/view-metadata.mjs?v=view-metadata-1";
import {
  normalizeViewerSettingsStripWorkspace,
  viewerSettingsStripGroupSpec,
  viewerSettingsStripVisibleGroupIds,
  viewerSettingsStripGroupLabel,
  viewerSettingsStripGroupOrder
} from "../commands/settings-strip-metadata.mjs?v=render-visibility-1";

const DISPLAY_MODE_ORDER = new Map(DISPLAY_MODE_SPECS.map((spec) => [spec.id, spec.settingsStripOrder ?? 0]));
const VIEW_ORIENTATION_ORDER = new Map(VIEW_ORIENTATION_SPECS.map((spec) => [spec.id, spec.settingsStripOrder ?? 100]));

export function mountViewerSettingsStrip({
  root,
  commands = [],
  workspace = null,
  displayMode = "shaded",
  orientation = "iso",
  onDisplayModeChange,
  onOrientationChange
} = {}) {
  if (!root) return null;
  let currentDisplayMode = normalizeDisplayMode(displayMode);
  let currentOrientation = normalizeStripOrientation(orientation);
  let commandSource = commands;
  let settingsStripWorkspace = normalizeViewerSettingsStripWorkspace(workspace);

  root.classList.add("bc-viewer-settings-strip");
  render();

  return {
    refresh() {
      render();
    },
    setCommands(nextCommands = []) {
      commandSource = nextCommands;
      render();
    },
    setWorkspace(nextWorkspace = {}) {
      settingsStripWorkspace = normalizeViewerSettingsStripWorkspace(nextWorkspace);
      render();
    },
    setDisplayMode(mode) {
      currentDisplayMode = normalizeDisplayMode(mode);
      syncCommandState();
    },
    displayMode() {
      return currentDisplayMode;
    },
    setOrientation(nextOrientation) {
      currentOrientation = normalizeStripOrientation(nextOrientation);
      syncCommandState();
    },
    orientation() {
      return currentOrientation;
    }
  };

  function render() {
    const openMenuIds = new Set([...root.querySelectorAll(".bc-viewer-settings-menu[open]")]
      .map((menu) => menu.dataset.settingsMenu)
      .filter(Boolean));
    const groups = groupedSettingsCommands(resolveCommands(commandSource), settingsStripWorkspace);
    root.replaceChildren(...groups.map((group) => settingGroup(group, commandControl(group, {
      open: openMenuIds.has(group.id)
    }))));
    syncCommandState();
  }

  function commandControl(group, options = {}) {
    if (group.id === "visibility") return commandMenu(group, options);
    return commandSegment(group);
  }

  function commandSegment(group) {
    return segmentedControl({
      label: group.label,
      className: "bc-viewer-settings-segment",
      buttonClassName: "bc-viewer-settings-button",
      items: group.commands.map((command) => {
        const active = commandActive(command);
        return {
          id: command.id,
          commandId: command.id,
          value: commandValue(command),
          label: command.settingsStripLabel || command.label || command.title || command.id,
          title: command.title || command.label || command.id,
          icon: command.icon || "settings",
          active,
          disabled: command.enabled === false,
          disabledReason: command.enabled === false ? command.disabledReason || "Command unavailable." : "",
          onClick: () => runStripCommand(command)
        };
      })
    });
  }

  function commandMenu(group, { open = false } = {}) {
    const details = document.createElement("details");
    details.className = "bc-viewer-settings-menu";
    details.dataset.settingsMenu = group.id;
    if (open) details.open = true;

    const summary = document.createElement("summary");
    summary.className = "bc-viewer-settings-menu-summary bc-viewer-settings-button";
    summary.setAttribute("aria-label", group.label);
    summary.append(
      createIcon(group.icon || "settings"),
      elementText("span", "bc-viewer-settings-menu-label", group.label),
      createIcon("chevron-down", { className: "bc-viewer-settings-menu-chevron" })
    );

    const body = document.createElement("div");
    body.className = "bc-viewer-settings-menu-popover";
    body.setAttribute("role", "group");
    body.setAttribute("aria-label", group.label);
    body.append(...group.commands.map((command) => commandMenuOption(command)));

    details.append(summary, body);
    return details;
  }

  function commandMenuOption(command) {
    const active = commandActive(command);
    const enabled = command.enabled !== false;
    const option = document.createElement("label");
    option.className = "bc-viewer-settings-menu-option";
    option.dataset.commandId = command.id;
    option.dataset.commandActive = active ? "true" : "false";
    option.setAttribute("aria-disabled", enabled ? "false" : "true");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bc-viewer-settings-menu-checkbox";
    checkbox.checked = active;
    checkbox.disabled = !enabled;
    checkbox.addEventListener("change", () => runStripCommand(command));

    const label = command.settingsStripLabel || command.label || command.title || command.id;
    option.append(
      checkbox,
      createIcon(command.icon || "settings"),
      elementText("span", "bc-viewer-settings-menu-option-label", label)
    );
    return option;
  }

  function runStripCommand(command) {
    if (command.enabled === false) return false;
    if (command.settingsStripGroup === "display") {
      currentDisplayMode = normalizeDisplayMode(command.displayMode);
      syncCommandState();
    } else if (command.settingsStripGroup === "view") {
      currentOrientation = normalizeStripOrientation(command.viewOrientation);
      syncCommandState();
    }
    const result = typeof command.run === "function" ? command.run() : undefined;
    if (typeof command.run !== "function" && command.settingsStripGroup === "display") {
      onDisplayModeChange?.(currentDisplayMode);
    } else if (typeof command.run !== "function" && command.settingsStripGroup === "view") {
      onOrientationChange?.(currentOrientation);
    } else if (result === false && command.settingsStripGroup === "display") {
      onDisplayModeChange?.(currentDisplayMode);
    } else if (result === false && command.settingsStripGroup === "view") {
      onOrientationChange?.(currentOrientation);
    }
    return result;
  }

  function syncCommandState() {
    for (const button of root.querySelectorAll("[data-command-id][data-value]")) {
      const active = buttonActive(button);
      if (active === null) continue;
      applyCommandState(button, {
        commandId: button.dataset.commandId,
        active,
        enabled: button.disabled !== true,
        disabledReason: button.dataset.disabledReason || "Command unavailable.",
        title: button.getAttribute("aria-label") || button.dataset.commandId || "Command"
      });
    }
  }

  function commandActive(command) {
    if (command.settingsStripGroup === "display") {
      return normalizeDisplayMode(command.displayMode) === currentDisplayMode || command.active === true;
    }
    if (command.settingsStripGroup === "view") {
      return normalizeStripOrientation(command.viewOrientation) === currentOrientation || command.active === true;
    }
    return command.active === true;
  }

  function commandValue(command) {
    if (command.settingsStripGroup === "display") return normalizeDisplayMode(command.displayMode);
    if (command.settingsStripGroup === "view") return normalizeViewOrientation(command.viewOrientation);
    return command.id;
  }

  function buttonActive(button) {
    const id = button.dataset.commandId || "";
    if (id.startsWith("view.displayMode.")) return normalizeDisplayMode(button.dataset.value) === currentDisplayMode;
    if (id.startsWith("view.orientation.")) return normalizeStripOrientation(button.dataset.value) === currentOrientation;
    return null;
  }
}

function elementText(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text || "";
  return element;
}

function settingGroup(groupSpec, control) {
  const labelText = groupSpec?.label || "";
  const group = document.createElement("section");
  group.className = "bc-viewer-settings-group";
  if (groupSpec?.id) group.dataset.settingsGroup = groupSpec.id;
  group.setAttribute("aria-label", labelText);
  group.append(control);
  return group;
}

function groupedSettingsCommands(commands, settingsStripWorkspace = {}) {
  const groups = new Map();
  const visibleGroupIds = viewerSettingsStripVisibleGroupIds(settingsStripWorkspace);
  const visibleGroupIdSet = new Set(visibleGroupIds);
  for (const command of commands.filter((item) => item?.settingsStripGroup)) {
    const id = command.settingsStripGroup;
    if (!visibleGroupIdSet.has(id)) continue;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: viewerSettingsStripGroupLabel(id),
        icon: viewerSettingsStripGroupSpec(id)?.icon || "settings",
        commands: []
      });
    }
    groups.get(id).commands.push(command);
  }
  const normalizedGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      commands: group.commands.sort((a, b) => settingsStripOrder(a) - settingsStripOrder(b))
    }));
  const groupById = new Map(normalizedGroups.map((group) => [group.id, group]));
  return visibleGroupIds
    .map((groupId) => groupById.get(groupId))
    .filter(Boolean)
    .sort((a, b) => {
      const preferred = visibleGroupIds.indexOf(a.id) - visibleGroupIds.indexOf(b.id);
      return preferred || viewerSettingsStripGroupOrder(a.id) - viewerSettingsStripGroupOrder(b.id);
    })
    .filter((group) => group.commands.length);
}

function resolveCommands(commands) {
  const resolved = typeof commands === "function" ? commands() : commands;
  return Array.isArray(resolved) ? resolved : [];
}

function settingsStripOrder(command) {
  if (Number.isFinite(command.settingsStripOrder)) return command.settingsStripOrder;
  if (command.settingsStripGroup === "display") return displayModeOrder(command.displayMode);
  if (command.settingsStripGroup === "view") return viewOrientationOrder(command.viewOrientation);
  return 100;
}

function displayModeOrder(mode) {
  return DISPLAY_MODE_ORDER.get(normalizeDisplayMode(mode)) ?? 0;
}

function viewOrientationOrder(orientation) {
  return VIEW_ORIENTATION_ORDER.get(normalizeViewOrientation(orientation)) ?? 100;
}

function normalizeStripOrientation(orientation) {
  return activeViewOrientation(orientation);
}
