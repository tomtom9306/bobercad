import { applyCommandState, compactShortcut, topbarMenuButton } from "../design-system/ui-elements.mjs?v=command-state-1";
import { createIcon } from "../icons/icon-registry.mjs?v=model-grid-navbar-1";
import { COMMAND_PALETTE_SHORTCUT, COMMAND_PALETTE_SPEC } from "../commands/command-palette-metadata.mjs?v=command-palette-metadata-1";
export const COMMAND_RECENTS_STORAGE_KEY = "bobercad.ui.command-palette.recents.v1";
const MAX_RECENT_COMMANDS = 6;

export function mountCommandPalette({
  button,
  root,
  commands = [],
  placeholder = COMMAND_PALETTE_SPEC.placeholder,
  onCommandRun,
  onStatusChange
} = {}) {
  if (!root) return null;
  const state = {
    query: "",
    results: [],
    activeIndex: 0,
    recentCommandIds: loadRecentCommandIds()
  };

  root.classList.add("bc-command-palette");
  root.hidden = true;

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "bc-command-palette-backdrop";
  backdrop.setAttribute("aria-label", COMMAND_PALETTE_SPEC.closeLabel);

  const dialog = document.createElement("section");
  dialog.className = "bc-command-palette-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "command-palette-title");

  const header = document.createElement("div");
  header.className = "bc-command-palette-header";

  const title = document.createElement("div");
  title.id = "command-palette-title";
  title.className = "bc-command-palette-title";
  title.textContent = COMMAND_PALETTE_SPEC.title;

  const hint = document.createElement("kbd");
  hint.className = "bc-keycap";
  hint.textContent = COMMAND_PALETTE_SHORTCUT;
  header.append(title, hint);

  const search = document.createElement("label");
  search.className = "bc-command-palette-search";
  search.append(createIcon("search"));

  const input = document.createElement("input");
  input.type = "search";
  input.className = "bc-command-palette-input";
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", placeholder);
  input.setAttribute("aria-controls", "command-palette-results");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  search.append(input);

  const list = document.createElement("div");
  list.id = "command-palette-results";
  list.className = "bc-command-palette-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", COMMAND_PALETTE_SPEC.resultsLabel);

  const empty = document.createElement("div");
  empty.className = "bc-command-palette-empty";
  empty.textContent = COMMAND_PALETTE_SPEC.emptyMessage;

  dialog.append(header, search, list, empty);
  root.replaceChildren(backdrop, dialog);

  decorateTrigger(button);
  button?.addEventListener("click", () => (root.hidden ? open() : close()));
  backdrop.addEventListener("click", () => close());
  input.addEventListener("input", () => {
    state.query = input.value;
    state.activeIndex = 0;
    render();
  });

  window.addEventListener("keydown", handleGlobalKeydown, { capture: true });
  render();

  return {
    open,
    close,
    isOpen: () => !root.hidden,
    refresh: render,
    setCommands(nextCommands = []) {
      commands = nextCommands;
      render();
    }
  };

  function decorateTrigger(trigger) {
    if (!trigger) return;
    topbarMenuButton(trigger, {
      icon: "search",
      label: COMMAND_PALETTE_SPEC.triggerLabel,
      title: COMMAND_PALETTE_SPEC.triggerTitle,
      ariaLabel: COMMAND_PALETTE_SPEC.triggerAriaLabel,
      className: "bc-command-trigger",
      labelClassName: "bc-command-trigger-label",
      shortcut: COMMAND_PALETTE_SHORTCUT,
      hasPopup: "dialog",
      expanded: false
    });
  }

  function open(options = {}) {
    const query = String(options.query || "");
    root.hidden = false;
    root.classList.add("open");
    button?.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    input.value = query;
    state.query = query;
    state.activeIndex = 0;
    render();
    window.requestAnimationFrame(() => input.focus());
  }

  function close({ focusTrigger = true } = {}) {
    if (root.hidden) return;
    root.hidden = true;
    root.classList.remove("open");
    button?.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    if (focusTrigger) button?.focus();
  }

  function handleGlobalKeydown(event) {
    const key = event.key?.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === "k") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (root.hidden) open();
      else close();
      return;
    }
    if (root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopImmediatePropagation();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopImmediatePropagation();
      moveActive(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      runActive();
    }
  }

  function moveActive(delta) {
    if (!state.results.length) return;
    setActiveIndex(state.activeIndex + delta);
  }

  function setActiveIndex(nextIndex, options = {}) {
    if (!state.results.length) {
      state.activeIndex = 0;
      syncActiveOption(options);
      return;
    }
    const previousIndex = state.activeIndex;
    const numericIndex = Number(nextIndex);
    const requestedIndex = Number.isFinite(numericIndex) ? numericIndex : 0;
    const normalizedIndex = ((requestedIndex % state.results.length) + state.results.length) % state.results.length;
    state.activeIndex = normalizedIndex;
    if (previousIndex !== normalizedIndex) {
      syncOptionSelection(previousIndex, false);
      syncOptionSelection(normalizedIndex, true);
    }
    syncActiveOption(options);
  }

  function runActive() {
    const command = state.results[state.activeIndex];
    if (command) runCommand(command);
  }

  function runCommand(command) {
    if (!commandEnabled(command)) {
      onStatusChange?.(commandDisabledReason(command));
      render();
      return;
    }
    close({ focusTrigger: false });
    try {
      command.run?.(command);
      recordRecentCommand(command);
      onCommandRun?.(command);
    } catch (error) {
      console.error(error);
      onStatusChange?.(`Command failed: ${error?.message || String(error)}`);
    }
  }

  function render() {
    state.results = commandResults(resolveCommands(commands), state.query, state.recentCommandIds);
    if (state.activeIndex >= state.results.length) state.activeIndex = Math.max(0, state.results.length - 1);
    list.replaceChildren(...state.results.map(renderCommand));
    empty.hidden = state.results.length > 0;
    syncActiveOption();
  }

  function renderCommand(command, index) {
    const id = requiredCommandField(command, "id");
    const title = requiredCommandField(command, "title");
    const descriptionText = commandDescription(command);
    const groupLabel = requiredCommandField(command, "groupLabel");
    const iconName = requiredCommandField(command, "icon");
    const disabled = !commandEnabled(command);
    const commandActive = command.active === true;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "bc-command-palette-item";
    item.id = commandOptionId(id);
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", index === state.activeIndex ? "true" : "false");
    applyCommandState(item, {
      command,
      commandId: id,
      active: commandActive,
      enabled: !disabled,
      disabledReason: commandDisabledReason(command),
      title,
      shortcut: command.shortcutLabel || "",
      pressable: false,
      current: true,
      setDisabledProperty: true,
      activeClass: "command-active",
      disabledClass: "disabled"
    });
    if (index === state.activeIndex) item.classList.add("active");
    item.addEventListener("mouseenter", () => {
      if (state.activeIndex === index) return;
      setActiveIndex(index, { scroll: false });
    });
    item.addEventListener("click", () => runCommand(command));

    const icon = document.createElement("span");
    icon.className = "bc-command-palette-icon";
    icon.append(createIcon(iconName));

    const copy = document.createElement("span");
    copy.className = "bc-command-palette-copy";

    const label = document.createElement("span");
    label.className = "bc-command-palette-label";
    label.textContent = title;

    const description = document.createElement("span");
    description.className = "bc-command-palette-description";
    description.textContent = descriptionText;
    copy.append(label, description);

    const meta = document.createElement("span");
    meta.className = "bc-command-palette-meta";
    const group = document.createElement("span");
    group.className = "bc-command-palette-group";
    group.textContent = groupLabel;
    meta.append(group);
    if (commandActive) {
      const stateBadge = document.createElement("span");
      stateBadge.className = "bc-command-palette-state";
      stateBadge.textContent = COMMAND_PALETTE_SPEC.activeLabel;
      meta.append(stateBadge);
    }
    if (command.kindLabel) {
      const kind = document.createElement("span");
      kind.className = "bc-command-palette-kind";
      kind.textContent = command.kindLabel;
      meta.append(kind);
    }
    if (command.shortcutLabel) {
      const shortcut = document.createElement("kbd");
      shortcut.className = "bc-keycap";
      shortcut.textContent = compactShortcut(command.shortcutLabel);
      meta.append(shortcut);
    }

    item.append(icon, copy, meta);
    return item;
  }

  function syncOptionSelection(index, active) {
    const command = state.results[index];
    if (!command) return;
    const item = document.getElementById(commandOptionId(command.id));
    item?.classList.toggle("active", active);
    item?.setAttribute("aria-selected", active ? "true" : "false");
  }

  function syncActiveOption({ scroll = true } = {}) {
    const command = state.results[state.activeIndex];
    if (root.hidden || !command) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    const activeId = commandOptionId(command.id);
    input.setAttribute("aria-activedescendant", activeId);
    if (scroll) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }

  function recordRecentCommand(command) {
    if (!recentEligible(command)) return;
    const commandId = command.id;
    state.recentCommandIds = [commandId, ...state.recentCommandIds.filter((id) => id !== commandId)]
      .slice(0, MAX_RECENT_COMMANDS);
    saveRecentCommandIds(state.recentCommandIds);
  }
}

function resolveCommands(commands) {
  const resolved = typeof commands === "function" ? commands() : commands;
  return Array.isArray(resolved) ? resolved : [];
}

function commandResults(commands, query, recentCommandIds = []) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length) return filterCommands(commands, terms);
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const recent = recentCommandIds
    .map((id) => commandById.get(id))
    .filter(recentEligible)
    .map((command) => ({
      ...command,
      groupLabel: COMMAND_PALETTE_SPEC.recentGroupLabel,
      description: command.description || command.title
    }));
  const recentIds = new Set(recent.map((command) => command.id));
  return [
    ...recent,
    ...commands.filter((command) => !recentIds.has(command.id) && command.paletteDefault !== false)
  ];
}

function filterCommands(commands, terms) {
  return commands.filter((command) => {
    const text = normalize([
      command.id,
      command.label,
      command.title,
      command.description,
      command.disabledReason,
      command.group,
      command.groupLabel,
      command.shortcutLabel,
      ...(Array.isArray(command.keywords) ? command.keywords : [])
    ].filter(Boolean).join(" "));
    return terms.every((term) => text.includes(term));
  });
}

function loadRecentCommandIds() {
  try {
    const raw = window.localStorage?.getItem?.(COMMAND_RECENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id, index, values) => validRecentId(id) && values.indexOf(id) === index).slice(0, MAX_RECENT_COMMANDS)
      : [];
  } catch (error) {
    console.warn(`Command recents could not be loaded: ${error?.message || String(error)}`);
    return [];
  }
}

function saveRecentCommandIds(commandIds) {
  try {
    window.localStorage?.setItem?.(COMMAND_RECENTS_STORAGE_KEY, JSON.stringify(commandIds.filter(validRecentId).slice(0, MAX_RECENT_COMMANDS)));
  } catch (error) {
    console.warn(`Command recents could not be saved: ${error?.message || String(error)}`);
  }
}

function validRecentId(id) {
  return typeof id === "string" && /^[a-z][A-Za-z0-9.-]*$/.test(id);
}

function commandOptionId(commandId) {
  return `command-palette-option-${String(commandId || "unknown").replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function recentEligible(command) {
  return Boolean(command?.id)
    && command.recent !== false
    && !command.id.startsWith("workspace.toolbar.");
}

function commandEnabled(command) {
  return command?.enabled !== false && command?.disabled !== true;
}

function commandDisabledReason(command) {
  return command?.disabledReason || COMMAND_PALETTE_SPEC.unavailableMessage;
}

function commandDescription(command) {
  const description = commandEnabled(command)
    ? command.description
    : command.disabledReason || command.description;
  if (!description) throw new Error(`Command ${command.id || "(unknown)"} is missing description.`);
  return description;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function requiredCommandField(command, field) {
  const value = command[field];
  if (!value) throw new Error(`Command ${command.id || "(unknown)"} is missing ${field}.`);
  return value;
}
