import { shortcutSetting } from "../../../rendering/interaction/keyboard-shortcuts.mjs";
import { MODELING_TOOLBAR_COMMANDS } from "../../commands/command-registry.mjs";
import { createSnapSettingsControl } from "../../controls/snap-settings-control.mjs";
import { applyCommandState, iconButton, toolbarGroup, toolbarSeparator } from "../../design-system/ui-elements.mjs";
import { createIcon } from "../../icons/icon-registry.mjs";

export function mountModelingToolbar({
  toolbar,
  status,
  shortcuts = {},
  onBeam,
  onColumn,
  onPlate,
  onSketch,
  onWorkPlane,
  onPlateBend,
  onTrim,
  autoRelationsEnabled = false,
  onAutoRelationsChange,
  onRelationsToggle,
  onSketchRelationsToggle,
  snapSettings = {},
  snapScope = {},
  onSnapStrengthChange,
  onSnapScopeChange,
  onStatusChange
}) {
  const commandShortcuts = shortcuts.commands || {};
  let currentAutoRelationsEnabled = Boolean(autoRelationsEnabled);
  let sketchRelationsAvailable = false;
  let sketchRelationsVisible = false;
  const handlers = { onBeam, onColumn, onPlate, onSketch, onWorkPlane, onPlateBend, onTrim };
  const commandButtons = MODELING_TOOLBAR_COMMANDS.map((spec) => {
    const shortcut = shortcutSetting(commandShortcuts, spec.shortcut, spec.keyFallback);
    return {
      spec,
      shortcut,
      command: spec.command,
      node: iconButton({
        icon: spec.icon,
        label: spec.label,
        title: spec.title,
        shortcut,
        onClick: handlers[spec.action],
        commandId: spec.id
      })
    };
  });
  const autoRelations = iconButton({
    icon: "relation",
    label: "Automatic axis relations",
    title: "Automatic axis relations",
    onClick: () => {
      if (typeof onRelationsToggle === "function") {
        onRelationsToggle();
        return;
      }
      if (sketchRelationsAvailable && onSketchRelationsToggle?.()) return;
      setAutoRelations(!currentAutoRelationsEnabled, { notify: true });
    },
    commandId: "settings.relations.toggle",
    pressed: currentAutoRelationsEnabled
  });
  const snapPanel = createSnapPanel({ snapSettings, snapScope, onSnapStrengthChange, onSnapScopeChange });
  const commandGroup = toolbarGroup(...commandButtons.map((item) => item.node));
  commandGroup.dataset.workspaceToolbarGroup = "model";
  commandGroup.setAttribute("role", "group");
  commandGroup.setAttribute("aria-label", "Model toolbar commands");
  const settingsGroup = toolbarGroup(snapPanel.node, autoRelations);
  settingsGroup.dataset.fixedToolbarGroup = "snap-settings";
  settingsGroup.setAttribute("role", "group");
  settingsGroup.setAttribute("aria-label", "Snap and relation settings");
  toolbar.classList.add("bc-toolbar");
  toolbar.replaceChildren(
    commandGroup,
    toolbarSeparator(),
    settingsGroup
  );

  function setActive(command) {
    for (const item of commandButtons) {
      const active = item.command === command;
      applyCommandState(item.node, {
        command: item.spec,
        active,
        title: item.spec.title || item.spec.label || item.command,
        shortcut: item.shortcut || ""
      });
    }
  }

  function setAutoRelations(enabled, options = {}) {
    currentAutoRelationsEnabled = Boolean(enabled);
    syncRelationsButton();
    if (options.notify) onAutoRelationsChange?.(currentAutoRelationsEnabled);
  }

  function setSketchRelationsState({ available = false, visible = false } = {}) {
    sketchRelationsAvailable = Boolean(available);
    sketchRelationsVisible = Boolean(visible);
    syncRelationsButton();
  }

  function syncRelationsButton() {
    const active = sketchRelationsAvailable ? sketchRelationsVisible : currentAutoRelationsEnabled;
    const title = sketchRelationsAvailable
      ? sketchRelationsVisible
        ? "Hide sketch relations"
        : "Show sketch relations"
      : "Automatic axis relations";
    applyCommandState(autoRelations, {
      commandId: "modeling.autoRelations",
      active,
      title,
      shortcut: sketchRelationsAvailable ? "R" : ""
    });
  }

  function setStatus(text) {
    const message = text || "Ready";
    if (typeof onStatusChange === "function") {
      const handled = onStatusChange(message);
      if (handled !== false) return;
    }
    if (status) status.textContent = message;
  }

  setStatus("Ready");
  setAutoRelations(autoRelationsEnabled);
  setActive(null);
  return {
    setActive,
    setAutoRelations,
    setSketchRelationsState,
    setSnapStrength: snapPanel.setStrength,
    setSnapScope: snapPanel.setScope,
    setStatus
  };
}

function createSnapPanel({ snapSettings = {}, snapScope = {}, onSnapStrengthChange, onSnapScopeChange } = {}) {
  const panel = document.createElement("details");
  panel.className = "snap-manager";
  const summary = document.createElement("summary");
  summary.className = "snap-manager-summary";
  summary.append(createIcon("snap"));
  const label = document.createElement("span");
  label.className = "snap-manager-label";
  label.textContent = "Snap";
  summary.append(label);
  summary.title = "Snap manager";
  summary.setAttribute("aria-label", "Snap manager");
  panel.append(summary);

  const settings = createSnapSettingsControl({
    snapSettings,
    snapScope,
    bodyClassName: "snap-manager-body bc-popover",
    filtersClassName: "snap-manager-filters",
    filtersSummaryClassName: "snap-manager-filters-summary",
    filtersChevronClassName: "snap-manager-filters-chevron",
    filtersTitleClassName: "snap-manager-filters-title",
    filtersCountClassName: "snap-manager-filters-count",
    filterGridClassName: "snap-manager-filter-grid",
    checkboxClassName: "snap-manager-checkbox",
    onSnapStrengthChange,
    onSnapScopeChange
  });
  panel.append(settings.body);
  return {
    node: panel,
    setStrength: settings.setStrength,
    setScope: settings.setScope
  };
}
