import { createIcon } from "../icons/icon-registry.mjs";
import { setWorkspaceSectionOpen, WORKSPACE_SECTIONS_RESET_EVENT, workspaceSectionOpen } from "../shell/workspace-storage.mjs";

const resettingWorkspaceSections = new WeakSet();
let workspaceSectionResetBound = false;
let floatingTooltip = null;
let floatingTooltipAnchor = null;
let floatingTooltipEventsBound = false;

function classNames(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" ");
}

export function iconButton({
  icon,
  label,
  title = label,
  shortcut = "",
  className = "",
  onClick,
  pressed = null,
  commandId = ""
} = {}) {
  const accessibleLabel = label || title;
  if (!accessibleLabel) throw new Error("iconButton requires a label or title.");
  const element = document.createElement("button");
  element.type = "button";
  element.className = ["bc-icon-button", className].filter(Boolean).join(" ");
  element.setAttribute("aria-label", accessibleLabel);
  if (title) applyTooltip(element, shortcut ? `${title} (${shortcut})` : title);
  if (commandId) element.dataset.commandId = commandId;
  if (pressed !== null) element.setAttribute("aria-pressed", pressed ? "true" : "false");
  element.append(createIcon(icon));
  if (shortcut) {
    const badge = document.createElement("span");
    badge.className = "bc-shortcut-badge";
    badge.textContent = compactShortcut(shortcut);
    element.append(badge);
  }
  if (typeof onClick === "function") element.addEventListener("click", onClick);
  return element;
}

export function applyTooltip(element, label) {
  if (!element) return element;
  const text = String(label || "").trim();
  if (!text) {
    if (floatingTooltipAnchor === element) hideFloatingTooltip();
    element.classList.remove("bc-tooltip-anchor");
    delete element.dataset.bcTooltip;
    element.removeAttribute("title");
    return element;
  }
  ensureFloatingTooltipEvents();
  element.classList.add("bc-tooltip-anchor");
  element.dataset.bcTooltip = text;
  element.title = text;
  return element;
}

function ensureFloatingTooltipEvents() {
  if (floatingTooltipEventsBound || typeof document === "undefined") return;
  floatingTooltipEventsBound = true;
  document.addEventListener("pointerover", handleTooltipPointerOver);
  document.addEventListener("pointerout", handleTooltipPointerOut);
  document.addEventListener("focusin", handleTooltipFocusIn);
  document.addEventListener("focusout", handleTooltipFocusOut);
  window.addEventListener("resize", updateFloatingTooltip);
  window.addEventListener("scroll", updateFloatingTooltip, true);
}

function handleTooltipPointerOver(event) {
  const anchor = tooltipAnchorFromEvent(event);
  if (anchor) showFloatingTooltip(anchor);
}

function handleTooltipPointerOut(event) {
  const anchor = tooltipAnchorFromEvent(event);
  if (!anchor) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && anchor.contains(nextTarget)) return;
  hideFloatingTooltip(anchor);
}

function handleTooltipFocusIn(event) {
  const anchor = tooltipAnchorFromEvent(event);
  if (anchor) showFloatingTooltip(anchor);
}

function handleTooltipFocusOut(event) {
  const anchor = tooltipAnchorFromEvent(event);
  if (anchor) hideFloatingTooltip(anchor);
}

function tooltipAnchorFromEvent(event) {
  return event.target?.closest?.(".bc-tooltip-anchor[data-bc-tooltip]") || null;
}

function showFloatingTooltip(anchor) {
  const label = String(anchor?.dataset?.bcTooltip || "").trim();
  if (!label) return;
  if (floatingTooltipAnchor && floatingTooltipAnchor !== anchor) restoreTooltipTitle(floatingTooltipAnchor);
  floatingTooltipAnchor = anchor;
  suppressTooltipTitle(anchor);
  const tooltip = ensureFloatingTooltip();
  tooltip.textContent = label;
  tooltip.hidden = false;
  tooltip.dataset.visible = "true";
  positionFloatingTooltip(anchor, tooltip);
}

function hideFloatingTooltip(anchor = floatingTooltipAnchor) {
  if (anchor && floatingTooltipAnchor && anchor !== floatingTooltipAnchor) return;
  restoreTooltipTitle(floatingTooltipAnchor);
  floatingTooltipAnchor = null;
  if (!floatingTooltip) return;
  floatingTooltip.dataset.visible = "false";
  floatingTooltip.hidden = true;
}

function updateFloatingTooltip() {
  if (!floatingTooltipAnchor || !floatingTooltip || floatingTooltip.hidden) return;
  positionFloatingTooltip(floatingTooltipAnchor, floatingTooltip);
}

function ensureFloatingTooltip() {
  if (floatingTooltip) return floatingTooltip;
  floatingTooltip = document.createElement("div");
  floatingTooltip.className = "bc-floating-tooltip";
  floatingTooltip.hidden = true;
  floatingTooltip.setAttribute("role", "tooltip");
  floatingTooltip.setAttribute("aria-hidden", "true");
  document.body.append(floatingTooltip);
  return floatingTooltip;
}

function positionFloatingTooltip(anchor, tooltip) {
  const anchorRect = anchor.getBoundingClientRect();
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 10;
  const margin = 8;
  const center = anchorRect.left + anchorRect.width / 2;
  const left = clampNumber(center - tooltipRect.width / 2, margin, window.innerWidth - tooltipRect.width - margin);
  const belowTop = anchorRect.bottom + gap;
  const aboveTop = anchorRect.top - tooltipRect.height - gap;
  const belowFits = belowTop + tooltipRect.height <= window.innerHeight - margin;
  const top = belowFits ? belowTop : clampNumber(aboveTop, margin, window.innerHeight - tooltipRect.height - margin);
  tooltip.dataset.placement = belowFits ? "bottom" : "top";
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function suppressTooltipTitle(anchor) {
  if (!anchor || !anchor.hasAttribute("title")) return;
  anchor.dataset.bcTooltipTitle = anchor.getAttribute("title") || "";
  anchor.removeAttribute("title");
}

function restoreTooltipTitle(anchor) {
  if (!anchor?.dataset || !Object.prototype.hasOwnProperty.call(anchor.dataset, "bcTooltipTitle")) return;
  anchor.title = anchor.dataset.bcTooltipTitle;
  delete anchor.dataset.bcTooltipTitle;
}

function clampNumber(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function applyCommandState(element, {
  command = {},
  commandId = command?.id || "",
  active = command?.active === true,
  enabled = command?.enabled !== false && command?.disabled !== true,
  disabledReason = command?.disabledReason || "Command unavailable.",
  title = command?.title || command?.label || commandId,
  shortcut = command?.shortcutLabel || "",
  pressable = true,
  current = false,
  setDisabledProperty = false,
  activeClass = "active",
  disabledClass = ""
} = {}) {
  if (!element) return element;
  const isActive = active === true;
  const isEnabled = enabled !== false;
  if (commandId) element.dataset.commandId = commandId;
  element.dataset.commandActive = isActive ? "true" : "false";
  if (isEnabled) delete element.dataset.disabledReason;
  else element.dataset.disabledReason = disabledReason;
  element.setAttribute("aria-disabled", isEnabled ? "false" : "true");
  if (pressable) element.setAttribute("aria-pressed", isActive ? "true" : "false");
  else element.removeAttribute("aria-pressed");
  if (current && isActive) element.setAttribute("aria-current", "true");
  else element.removeAttribute("aria-current");
  if (setDisabledProperty && "disabled" in element) element.disabled = !isEnabled;
  if (activeClass) element.classList.toggle(activeClass, isActive);
  if (disabledClass) element.classList.toggle(disabledClass, !isEnabled);
  const tooltip = isEnabled ? title : `${title} - ${disabledReason}`;
  applyTooltip(element, shortcut ? `${tooltip} (${shortcut})` : tooltip);
  return element;
}

export function topbarMenuButton(button, {
  icon = "",
  label = "",
  title = label,
  ariaLabel = title || label,
  className = "bc-topbar-menu-button",
  labelClassName = "bc-topbar-menu-label",
  shortcut = "",
  hasPopup = "",
  expanded = null
} = {}) {
  if (!button) return null;
  button.type = "button";
  addClasses(button, className);
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  if (hasPopup) button.setAttribute("aria-haspopup", hasPopup);
  if (expanded !== null) button.setAttribute("aria-expanded", expanded ? "true" : "false");
  applyTooltip(button, title || ariaLabel || label);

  const children = [];
  if (icon) children.push(createIcon(icon));
  if (label) {
    const copy = document.createElement("span");
    copy.className = labelClassName;
    copy.textContent = label;
    children.push(copy);
  }
  if (shortcut) {
    const key = document.createElement("kbd");
    key.className = "bc-keycap";
    key.textContent = compactShortcut(shortcut);
    children.push(key);
  }
  button.replaceChildren(...children);
  return button;
}

export function shellChromeButton({
  button = null,
  className = "",
  label = "",
  title = label,
  icon = "",
  pressed = null,
  expanded = null,
  hidden = null,
  dataset = {}
} = {}) {
  const element = button || document.createElement("button");
  element.type = "button";
  element.className = className;
  applyDataset(element, dataset);
  if (label) element.setAttribute("aria-label", label);
  else element.removeAttribute("aria-label");
  if (pressed !== null) element.setAttribute("aria-pressed", pressed ? "true" : "false");
  else element.removeAttribute("aria-pressed");
  if (expanded !== null) element.setAttribute("aria-expanded", expanded ? "true" : "false");
  else element.removeAttribute("aria-expanded");
  if (hidden !== null) element.hidden = hidden === true;
  applyTooltip(element, title || label);
  element.replaceChildren(...(icon ? [createIcon(icon)] : []));
  return element;
}

export function dockResizeHandleControl({ button = null, label = "Resize panel", dock = "" } = {}) {
  return shellChromeButton({
    button,
    className: "bc-dock-resize-handle",
    label,
    title: label,
    dataset: dock ? { dock } : {}
  });
}

export function dockRevealToggleControl({
  button = null,
  dock = "right",
  revealed = false,
  pinned = true,
  label = ""
} = {}) {
  return shellChromeButton({
    button,
    className: "bc-dock-reveal-toggle",
    label,
    title: label,
    icon: dockRevealToggleIcon(dock, revealed),
    expanded: revealed,
    dataset: {
      dock,
      panelPinned: pinned ? "true" : "false",
      panelRevealed: revealed ? "true" : "false"
    }
  });
}

export function dockPinToggleControl({
  button = null,
  dock = "right",
  pinned = true,
  label = ""
} = {}) {
  return shellChromeButton({
    button,
    className: "bc-dock-pin-toggle",
    label,
    title: label,
    icon: pinned ? "pin-off" : "pin",
    pressed: pinned,
    dataset: {
      dock,
      panelPinned: pinned ? "true" : "false"
    }
  });
}

export function toolbarOverflowMenuItemControl({
  command = {},
  commandId = command?.id || "",
  label = command?.label || command?.title || commandId,
  description = command?.description || "",
  icon = command?.icon || "more",
  shortcut = command?.shortcutLabel || "",
  enabled = command?.enabled !== false && command?.disabled !== true,
  active = command?.active === true,
  disabledReason = command?.disabledReason || "Command unavailable.",
  onSelect,
  onDisabled
} = {}) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "bc-toolbar-overflow-item";
  item.setAttribute("role", "menuitem");
  applyCommandState(item, {
    command,
    commandId,
    active,
    enabled,
    disabledReason,
    title: label,
    shortcut,
    pressable: false,
    current: true,
    activeClass: ""
  });

  const iconNode = document.createElement("span");
  iconNode.className = "bc-toolbar-overflow-icon";
  iconNode.append(createIcon(icon));
  const copy = document.createElement("span");
  copy.className = "bc-toolbar-overflow-copy";
  const labelNode = document.createElement("span");
  labelNode.className = "bc-toolbar-overflow-label";
  labelNode.textContent = label;
  const descriptionNode = document.createElement("span");
  descriptionNode.className = "bc-toolbar-overflow-description";
  descriptionNode.textContent = enabled ? description : disabledReason;
  copy.append(labelNode, descriptionNode);

  if (shortcut) {
    const key = document.createElement("span");
    key.className = "bc-keycap";
    key.textContent = shortcut;
    item.append(iconNode, copy, key);
  } else {
    item.append(iconNode, copy);
  }

  item.addEventListener("click", () => {
    if (!enabled) {
      onDisabled?.(disabledReason);
      return;
    }
    onSelect?.();
  });
  return item;
}

export function segmentedControl({
  label,
  items = [],
  className = "",
  buttonClassName = "",
  onSelect
} = {}) {
  const segment = document.createElement("div");
  segment.className = ["bc-segment", className].filter(Boolean).join(" ");
  segment.setAttribute("role", "group");
  if (label) segment.setAttribute("aria-label", label);
  for (const item of items.filter(Boolean)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ["bc-segment-button", buttonClassName, item.className || ""].filter(Boolean).join(" ");
    if (item.id) button.dataset.itemId = item.id;
    if (item.commandId) button.dataset.commandId = item.commandId;
    if (item.value !== undefined) button.dataset.value = String(item.value);
    const text = item.label || item.title || item.id || item.commandId || "";
    button.setAttribute("aria-label", item.title || text);
    button.setAttribute("aria-pressed", item.active ? "true" : "false");
    button.disabled = item.disabled === true;
    if (item.disabledReason) button.dataset.disabledReason = item.disabledReason;
    if (item.icon) button.append(createIcon(item.icon));
    const copy = document.createElement("span");
    copy.className = "bc-segment-button-label";
    copy.textContent = text;
    button.append(copy);
    applyTooltip(button, item.disabledReason ? `${item.title || text} - ${item.disabledReason}` : item.title || text);
    button.addEventListener("click", () => {
      if (button.disabled) return;
      onSelect?.(item, button);
      item.onClick?.(item, button);
    });
    segment.append(button);
  }
  return segment;
}

export function workspaceCustomizerToggleRow({
  className = "",
  dataset = {},
  active = false,
  icon = "settings",
  label = "",
  description = "",
  statusLabel = "",
  ariaLabel = "",
  toggleDisabled = false,
  onToggle,
  actions = []
} = {}) {
  const row = document.createElement("div");
  row.className = ["bc-workspace-customizer-row", "bc-workspace-customizer-command-row", className].filter(Boolean).join(" ");
  applyDataset(row, dataset);
  row.setAttribute("aria-pressed", active ? "true" : "false");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "bc-workspace-customizer-row-toggle";
  toggle.disabled = toggleDisabled === true;
  toggle.setAttribute("aria-pressed", active ? "true" : "false");
  toggle.setAttribute("aria-label", ariaLabel || label || "Toggle workspace item");
  if (typeof onToggle === "function") toggle.addEventListener("click", onToggle);
  toggle.append(
    workspaceCustomizerStatus(statusLabel || (active ? "On" : "Off")),
    workspaceCustomizerIcon(icon),
    workspaceCustomizerCopy(label, description)
  );
  row.append(toggle);

  const resolvedActions = typeof actions === "function" ? actions(row) : actions;
  const visibleActions = (Array.isArray(resolvedActions) ? resolvedActions : [resolvedActions]).filter(Boolean);
  if (visibleActions.length) row.append(workspaceCustomizerRowActions(visibleActions));
  return row;
}

export function workspaceCustomizerActionRow({
  tag = "button",
  className = "",
  dataset = {},
  icon = "settings",
  label = "",
  description = "",
  statusLabel = "Add",
  ariaLabel = label,
  onClick
} = {}) {
  const row = document.createElement(tag || "button");
  if (row.tagName === "BUTTON") row.type = "button";
  row.className = ["bc-workspace-customizer-row", className].filter(Boolean).join(" ");
  applyDataset(row, dataset);
  if (ariaLabel) row.setAttribute("aria-label", ariaLabel);
  if (typeof onClick === "function") row.addEventListener("click", onClick);
  row.append(
    workspaceCustomizerStatus(statusLabel),
    workspaceCustomizerIcon(icon),
    workspaceCustomizerCopy(label, description)
  );
  return row;
}

export function workspaceCustomizerRowActions(actions = []) {
  const container = document.createElement("span");
  container.className = "bc-workspace-customizer-row-actions";
  container.append(...(Array.isArray(actions) ? actions : [actions]).filter(Boolean));
  return container;
}

export function workspaceCustomizerMoveButton({
  label = "",
  direction = "up",
  enabled = false,
  onClick
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bc-icon-button bc-workspace-customizer-move";
  button.disabled = !enabled;
  const tooltip = `Move ${label} ${direction}`;
  button.setAttribute("aria-label", tooltip);
  applyTooltip(button, tooltip);
  button.append(createIcon(direction === "up" ? "chevron-up" : "chevron-down"));
  button.addEventListener("click", () => {
    if (!enabled) return;
    onClick?.();
  });
  return button;
}

export function workspaceCustomizerDragHandle({
  id = "",
  dataset = {},
  datasetKey = "",
  label = "",
  enabled = false,
  enabledTitle = "",
  disabledTitle = "",
  onBind
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bc-icon-button bc-workspace-customizer-drag-handle";
  button.disabled = !enabled;
  applyDataset(button, dataset);
  if (datasetKey && id) button.dataset[datasetKey] = id;
  const tooltip = enabled
    ? enabledTitle || `Drag ${label || id}`
    : disabledTitle || `Enable drag mode to drag ${label || id}`;
  button.setAttribute("aria-label", tooltip);
  applyTooltip(button, tooltip);
  button.append(createIcon("drag-handle"));
  if (typeof onBind === "function") onBind(button);
  return button;
}

export function bindWorkspaceCustomizerRowReorderDrag({
  root = null,
  handle = null,
  row = null,
  enabled = true,
  rowSelector = "",
  sourceDatasetKey = "",
  targetDatasetKey = "",
  scopeDatasetKey = "",
  onReorder
} = {}) {
  if (!handle || !row || !rowSelector || !sourceDatasetKey || !targetDatasetKey) return null;
  const rootNode = root || document;
  const isEnabled = () => typeof enabled === "function" ? enabled() !== false : enabled !== false;
  const scopedValue = (targetRow) => scopeDatasetKey ? targetRow?.dataset?.[scopeDatasetKey] || "" : "";
  const sourceValue = () => handle.dataset[sourceDatasetKey] || "";
  const sourceScope = () => scopeDatasetKey ? handle.dataset[scopeDatasetKey] || row.dataset[scopeDatasetKey] || "" : "";
  let drag = null;

  const rowAt = (x, y) => document.elementFromPoint(x, y)?.closest?.(rowSelector) || null;
  const clearTargets = () => {
    for (const item of rootNode.querySelectorAll(`${rowSelector}.is-drop-target`)) item.classList.remove("is-drop-target");
  };
  const cleanup = () => {
    for (const item of rootNode.querySelectorAll(`${rowSelector}.is-dragging, ${rowSelector}.is-drop-target`)) {
      item.classList.remove("is-dragging");
      item.classList.remove("is-drop-target");
    }
    for (const item of rootNode.querySelectorAll(".bc-workspace-customizer-drag-handle.is-dragging")) item.classList.remove("is-dragging");
  };
  const validTarget = (target) => {
    if (!target) return false;
    if (!target.dataset?.[targetDatasetKey]) return false;
    if (target.dataset[targetDatasetKey] === drag?.sourceId) return false;
    if (scopeDatasetKey && scopedValue(target) !== drag?.scopeId) return false;
    return true;
  };

  handle.addEventListener("pointerdown", (event) => {
    if (!isEnabled() || handle.disabled || event.button !== 0) return;
    const sourceId = sourceValue();
    if (!sourceId) return;
    event.preventDefault();
    drag = {
      sourceId,
      scopeId: sourceScope(),
      pointerId: event.pointerId,
      moved: false
    };
    handle.setPointerCapture?.(event.pointerId);
    handle.classList.add("is-dragging");
    row.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    clearTargets();
    const target = rowAt(event.clientX, event.clientY);
    if (validTarget(target)) target.classList.add("is-drop-target");
  });
  handle.addEventListener("pointerup", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const activeDrag = drag;
    drag = null;
    handle.releasePointerCapture?.(event.pointerId);
    const target = rowAt(event.clientX, event.clientY);
    cleanup();
    if (!activeDrag.moved || !validTargetFor(activeDrag, target)) return;
    onReorder?.({
      sourceId: activeDrag.sourceId,
      targetId: target.dataset[targetDatasetKey],
      scopeId: activeDrag.scopeId,
      targetRow: target
    });
  });
  handle.addEventListener("pointercancel", () => {
    drag = null;
    cleanup();
  });
  return handle;

  function validTargetFor(activeDrag, target) {
    if (!target?.dataset?.[targetDatasetKey]) return false;
    if (target.dataset[targetDatasetKey] === activeDrag.sourceId) return false;
    if (scopeDatasetKey && scopedValue(target) !== activeDrag.scopeId) return false;
    return true;
  }
}

function dockRevealToggleIcon(dock, revealed) {
  if (dock === "right") return revealed ? "chevron-right" : "chevron-left";
  return revealed ? "chevron-left" : "chevron-right";
}

function workspaceCustomizerStatus(text) {
  const status = document.createElement("span");
  status.className = "bc-workspace-customizer-check";
  status.textContent = text;
  return status;
}

function workspaceCustomizerIcon(icon) {
  const node = document.createElement("span");
  node.className = "bc-workspace-customizer-command-icon";
  node.append(createIcon(icon || "settings"));
  return node;
}

function workspaceCustomizerCopy(label, description) {
  const copy = document.createElement("span");
  copy.className = "bc-workspace-customizer-command-copy";
  const labelNode = document.createElement("span");
  labelNode.className = "bc-workspace-customizer-command-label";
  labelNode.textContent = label || "";
  const descriptionNode = document.createElement("span");
  descriptionNode.className = "bc-workspace-customizer-command-description";
  descriptionNode.textContent = description || "";
  copy.append(labelNode, descriptionNode);
  return copy;
}

function addClasses(element, className = "") {
  for (const item of String(className || "").split(/\s+/).filter(Boolean)) element.classList.add(item);
}

export function toolbarGroup(...children) {
  const group = document.createElement("div");
  group.className = "bc-toolbar-group";
  group.append(...children.filter(Boolean));
  return group;
}

export function toolbarSeparator() {
  const separator = document.createElement("div");
  separator.className = "bc-toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  return separator;
}

export function labeledField(labelText, control) {
  const label = document.createElement("label");
  label.className = "bc-field";
  const labelNode = document.createElement("span");
  labelNode.className = "bc-field-label";
  labelNode.textContent = labelText;
  label.append(labelNode, control);
  return label;
}

export function propertiesPanelShell({
  title = "Properties",
  context = null,
  children = [],
  emptyMessage = "Select an object to inspect its properties."
} = {}) {
  const panel = document.createElement("section");
  panel.className = "bc-properties-panel";
  panel.dataset.inspectorProperties = "true";
  panel.setAttribute("aria-label", title);

  const header = document.createElement("div");
  header.className = "bc-properties-header";
  const icon = createIcon(context?.icon || "inspector", { className: "bc-properties-header-icon" });
  const copy = document.createElement("div");
  copy.className = "bc-properties-header-copy";
  copy.append(
    elementText("div", "bc-properties-kicker", title),
    elementText("div", "bc-properties-title", context?.title || "No selection")
  );
  if (context?.subtitle) copy.append(elementText("div", "bc-properties-subtitle", context.subtitle));
  header.append(icon, copy);

  const body = document.createElement("div");
  body.className = "bc-properties-body";
  const bodyChildren = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (bodyChildren.length) body.append(...bodyChildren);
  else body.append(elementText("div", "bc-empty", emptyMessage));

  panel.append(header);
  const badges = propertyBadges(context?.badges || []);
  if (badges) panel.append(badges);
  panel.append(body);
  return panel;
}

export function disclosureSection(label, rows = [], options = {}) {
  ensureWorkspaceSectionResetBound();
  const details = document.createElement("details");
  details.className = classNames("bc-disclosure", options.className || "");
  const sectionId = options.sectionId || "";
  const storedOpen = workspaceSectionOpen(sectionId);
  const defaultOpen = Boolean(options.open);
  const open = typeof storedOpen === "boolean" ? storedOpen : defaultOpen;
  let userChangedOpenState = false;
  if (open) details.open = true;
  if (sectionId) {
    details.dataset.sectionId = sectionId;
    details.dataset.sectionDefaultOpen = defaultOpen ? "true" : "false";
  }

  const summary = document.createElement("summary");
  summary.className = classNames("bc-disclosure-summary", options.summaryClassName || "");
  summary.addEventListener("click", () => { userChangedOpenState = true; });
  summary.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") userChangedOpenState = true;
  });
  const chevron = createIcon(options.icon || "chevron-right", { className: "bc-disclosure-chevron" });
  const title = elementText("span", "bc-disclosure-title", label);
  details.addEventListener("toggle", () => {
    syncDisclosureOpenState(details);
    if (resettingWorkspaceSections.has(details)) {
      resettingWorkspaceSections.delete(details);
      return;
    }
    if (sectionId && (userChangedOpenState || typeof storedOpen === "boolean")) setWorkspaceSectionOpen(sectionId, details.open);
  });
  syncDisclosureOpenState(details);
  summary.append(chevron, title);

  const body = document.createElement("div");
  body.className = classNames("bc-disclosure-body", options.bodyClassName || "");
  body.append(...rows.filter(Boolean));
  details.append(summary, body);
  return details;
}

export function field(label, ...children) {
  return labeledElement("div", "bc-field", label, ...children);
}

export function readout(label, value) {
  return labeledElement("div", "bc-readout", label, elementText("span", "bc-readout-value", value));
}

function ensureWorkspaceSectionResetBound() {
  if (workspaceSectionResetBound) return;
  workspaceSectionResetBound = true;
  window.addEventListener(WORKSPACE_SECTIONS_RESET_EVENT, () => {
    for (const details of document.querySelectorAll("details[data-section-id][data-section-default-open]")) {
      const defaultOpen = details.dataset.sectionDefaultOpen === "true";
      if (details.open !== defaultOpen) {
        resettingWorkspaceSections.add(details);
        details.open = defaultOpen;
      }
      syncDisclosureOpenState(details);
    }
  });
}

function syncDisclosureOpenState(details) {
  details.dataset.state = details.open ? "open" : "closed";
}

function propertyBadges(badges = []) {
  const values = badges.map((badge) => typeof badge === "string" ? { label: badge } : badge).filter((badge) => badge?.label);
  if (!values.length) return null;
  const row = document.createElement("div");
  row.className = "bc-properties-badges";
  for (const badge of values) {
    const item = document.createElement("span");
    item.className = "bc-properties-badge";
    if (badge.state) item.dataset.state = badge.state;
    item.textContent = badge.label;
    row.append(item);
  }
  return row;
}

function labeledElement(tag, className, label, ...children) {
  const row = document.createElement(tag);
  row.className = classNames(className);
  row.append(elementText("span", "bc-label", label), ...children);
  return row;
}

function elementText(tag, className, value) {
  const element = document.createElement(tag);
  element.className = classNames(className);
  element.textContent = value;
  return element;
}

export function dataPanelHeader({
  namespace = "bc-data-panel",
  icon = "",
  title = "",
  meta = ""
} = {}) {
  const header = document.createElement("div");
  header.className = `${namespace}-header bc-data-header`;
  if (icon) header.append(createIcon(icon, { className: `${namespace}-title-icon bc-data-header-icon` }));
  const copy = document.createElement("div");
  copy.className = `${namespace}-header-copy bc-data-header-copy`;
  const titleNode = document.createElement("div");
  titleNode.className = `${namespace}-title bc-data-title`;
  titleNode.textContent = title;
  const metaNode = document.createElement("div");
  metaNode.className = `${namespace}-meta bc-data-meta`;
  metaNode.textContent = meta;
  copy.append(titleNode, metaNode);
  header.append(copy);
  return header;
}

export function dataPanelSearch({
  namespace = "bc-data-panel",
  value = "",
  placeholder = "",
  label = "Search",
  datasetKey = "",
  onInput
} = {}) {
  const root = document.createElement("label");
  root.className = `${namespace}-search bc-data-search`;
  root.append(createIcon("search"));
  const input = document.createElement("input");
  input.type = "search";
  input.value = value || "";
  input.placeholder = placeholder || "";
  input.autocomplete = "off";
  input.spellcheck = false;
  if (datasetKey) input.dataset[datasetKey] = "true";
  input.setAttribute("aria-label", label || "Search");
  input.addEventListener("input", () => onInput?.(input.value, input));
  root.append(input);
  return root;
}

export function dataPanelEmpty({
  namespace = "bc-data-panel",
  message = ""
} = {}) {
  const empty = document.createElement("div");
  empty.className = `${namespace}-empty bc-data-empty`;
  empty.textContent = message;
  return empty;
}

export function dataPanelSection({
  namespace = "bc-data-panel",
  suffix = "section",
  label = "",
  children = [],
  emptyMessage = "",
  list = false
} = {}) {
  const visibleChildren = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const section = document.createElement("section");
  section.className = `${namespace}-${suffix} bc-data-section`;
  const title = document.createElement("div");
  title.className = `${namespace}-${suffix}-title bc-data-section-title`;
  title.textContent = label;
  section.append(title);
  if (visibleChildren.length && list) {
    const rows = document.createElement("div");
    rows.className = `${namespace}-list bc-data-list`;
    rows.append(...visibleChildren);
    section.append(rows);
  } else if (visibleChildren.length) {
    section.append(...visibleChildren);
  } else if (emptyMessage) {
    section.append(dataPanelEmpty({ namespace, message: emptyMessage }));
  }
  return section;
}

export function dataPanelCollection({
  namespace = "bc-data-panel",
  icon = "",
  label = "",
  count = 0,
  rows = [],
  open = false
} = {}) {
  const details = document.createElement("details");
  details.className = `${namespace}-collection bc-data-collection`;
  details.open = Boolean(open);
  const summary = document.createElement("summary");
  summary.className = `${namespace}-collection-summary bc-data-collection-summary`;
  if (icon) summary.append(createIcon(icon, { className: `${namespace}-collection-icon bc-data-collection-icon` }));
  const labelNode = document.createElement("span");
  labelNode.className = `${namespace}-collection-label bc-data-collection-label`;
  labelNode.textContent = label;
  const countNode = document.createElement("span");
  countNode.className = `${namespace}-count bc-data-count`;
  countNode.textContent = String(count);
  summary.append(labelNode, countNode);
  const rowContainer = document.createElement("div");
  rowContainer.className = `${namespace}-rows bc-data-rows`;
  rowContainer.append(...(Array.isArray(rows) ? rows : [rows]).filter(Boolean));
  details.append(summary, rowContainer);
  return details;
}

export function dataPanelRowCopy({
  namespace = "bc-data-panel",
  label = "",
  value = "",
  tag = "span"
} = {}) {
  const copy = document.createElement(tag);
  copy.className = `${namespace}-row-copy bc-data-row-copy`;
  const rowLabel = document.createElement(tag);
  rowLabel.className = `${namespace}-row-label bc-data-row-label`;
  rowLabel.textContent = label;
  const rowValue = document.createElement(tag);
  rowValue.className = `${namespace}-row-value bc-data-row-value`;
  rowValue.textContent = value || "-";
  copy.append(rowLabel, rowValue);
  return copy;
}

export function dataPanelRow({
  namespace = "bc-data-panel",
  icon = "",
  label = "",
  value = "",
  meta = "",
  className = "",
  dataset = {},
  state = ""
} = {}) {
  if (!label) return null;
  const row = document.createElement("div");
  row.className = [namespace ? `${namespace}-row` : "", "bc-data-row", className].filter(Boolean).join(" ");
  applyDataset(row, dataset);
  if (state) row.dataset.state = state;
  if (icon) row.append(createIcon(icon, { className: `${namespace}-row-icon bc-data-row-icon` }));
  row.append(dataPanelRowCopy({ namespace, label, value }));
  const badge = document.createElement("span");
  badge.className = `${namespace}-row-meta bc-data-row-meta`;
  badge.textContent = meta;
  row.append(badge);
  return row;
}

export function dataPanelActionRow({
  namespace = "bc-data-panel",
  icon = "",
  label = "",
  value = "",
  className = "",
  active = false,
  rowDataset = {},
  mainDataset = {},
  actionDataset = {},
  mainLabel = label,
  mainTitle = mainLabel,
  actionLabel = "Open",
  actionTitle = actionLabel,
  actionIcon = "",
  mainDisabled = false,
  actionDisabled = false,
  onMain,
  onAction
} = {}) {
  if (!label) return null;
  const row = document.createElement("div");
  row.className = [namespace ? `${namespace}-row ${namespace}-action-row` : "", "bc-data-action-row", className].filter(Boolean).join(" ");
  applyDataset(row, rowDataset);
  if (active) row.dataset.active = "true";
  const main = document.createElement("button");
  main.type = "button";
  main.className = `${namespace}-row-main bc-data-row-main`;
  main.disabled = mainDisabled === true;
  main.setAttribute("aria-label", mainLabel || label);
  applyDataset(main, mainDataset);
  main.append(...[
    icon ? createIcon(icon, { className: `${namespace}-row-icon bc-data-row-icon` }) : null,
    dataPanelRowCopy({ namespace, label, value })
  ].filter(Boolean));
  applyTooltip(main, mainTitle || mainLabel || label);
  if (typeof onMain === "function") main.addEventListener("click", onMain);

  const action = document.createElement("button");
  action.type = "button";
  action.className = `${namespace}-row-action bc-data-row-action`;
  action.disabled = actionDisabled === true;
  action.setAttribute("aria-label", actionTitle || actionLabel || label);
  applyDataset(action, actionDataset);
  if (actionIcon) action.append(createIcon(actionIcon));
  applyTooltip(action, actionTitle || actionLabel || label);
  if (typeof onAction === "function") action.addEventListener("click", onAction);
  row.append(main, action);
  return row;
}

export function dataPanelLinkRow({
  namespace = "bc-data-panel",
  icon = "",
  label = "",
  value = "",
  href = "",
  className = "",
  rowDataset = {},
  mainDataset = {},
  actionDataset = {},
  mainLabel = label,
  mainTitle = mainLabel,
  actionLabel = "Open",
  actionTitle = actionLabel,
  actionIcon = "link"
} = {}) {
  if (!label || !href) return null;
  const row = document.createElement("div");
  row.className = [namespace ? `${namespace}-row ${namespace}-action-row` : "", "bc-data-action-row", className].filter(Boolean).join(" ");
  applyDataset(row, rowDataset);
  const main = dataPanelAnchor({
    namespace,
    className: `${namespace}-row-main bc-data-row-main`,
    href,
    label: mainLabel || label,
    title: mainTitle || mainLabel || label,
    dataset: mainDataset,
    children: [
      icon ? createIcon(icon, { className: `${namespace}-row-icon bc-data-row-icon` }) : "",
      dataPanelRowCopy({ namespace, label, value })
    ]
  });
  const action = dataPanelAnchor({
    namespace,
    className: `${namespace}-row-action bc-data-row-action`,
    href,
    label: actionTitle || actionLabel || label,
    title: actionTitle || actionLabel || label,
    dataset: actionDataset,
    children: [actionIcon ? createIcon(actionIcon) : ""]
  });
  row.append(main, action);
  return row;
}

function dataPanelAnchor({ className = "", href = "", label = "", title = "", dataset = {}, children = [] } = {}) {
  const anchor = document.createElement("a");
  anchor.className = className;
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-label", label);
  applyDataset(anchor, dataset);
  anchor.append(...children.filter(Boolean));
  applyTooltip(anchor, title || label);
  return anchor;
}

function applyDataset(element, dataset = {}) {
  for (const [key, value] of Object.entries(dataset || {})) {
    if (!key || value === undefined || value === null || value === "") continue;
    element.dataset[key] = String(value);
  }
}

export function compactShortcut(shortcut) {
  return String(shortcut || "")
    .replace(/^Escape$/i, "Esc")
    .replace(/^Delete$/i, "Del")
    .replace(/^Backspace$/i, "Bk")
    .replace(/\+/g, "");
}
