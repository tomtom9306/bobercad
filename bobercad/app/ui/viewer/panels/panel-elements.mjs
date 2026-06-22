import { createIcon } from "../../icons/icon-registry.mjs";
import {
  disclosureSection as designDisclosureSection,
  field as designField,
  propertiesPanelShell as designPropertiesPanelShell,
  readout as designReadout,
  segmentedControl
} from "../../design-system/ui-elements.mjs";

const CUSTOM_NUMBER_CHOICE = "__custom";

function classNames(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" ");
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatControlNumber(value, options = {}) {
  if (!finiteNumber(value)) return "";
  const digits = Number.isInteger(options.digits) && options.digits >= 0 ? options.digits : 2;
  const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
  if (Number.isInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(digits);
  return options.trimTrailingZeros
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;
}

export function text(tag, className, value) {
  const element = document.createElement(tag);
  element.className = classNames(className);
  element.textContent = value;
  return element;
}

export function createPanelMessageState(render, initialMessage = "", initialState = "") {
  let messageText = initialMessage;
  let messageState = initialState;
  const set = (message, state = "", options = {}) => {
    messageText = message;
    messageState = state;
    if (options.render !== false) render();
  };
  return {
    set,
    clear: (options = {}) => set("", "", options),
    hasMessage: () => Boolean(messageText),
    element() {
      const message = text("div", "bc-message", messageText);
      message.dataset.state = messageState;
      return message;
    }
  };
}

export function hidePanel(panel) {
  panel.hidden = true;
  panel.replaceChildren();
}

export function renderEditorPanel(panel, title, onClose, rows, message) {
  const header = document.createElement("div");
  panel.classList.add("bc-inspector");
  header.className = "bc-editor-header bc-inspector-header";
  header.append(text("div", "bc-inspector-title", title), button("Close", "bc-button", onClose, {
    icon: "cancel",
    title: "Close panel"
  }));
  const body = document.createElement("section");
  body.className = "bc-inspector-section";
  body.append(...rows);
  panel.hidden = false;
  panel.replaceChildren(header, body, message);
}

export function propertiesPanelShell(options = {}) {
  return designPropertiesPanelShell(options);
}

export function disclosureSection(label, rows = [], options = {}) {
  return designDisclosureSection(label, rows, options);
}

function labeledElement(tag, className, label, ...children) {
  const row = document.createElement(tag);
  row.className = classNames(className);
  row.append(text("span", "bc-label", label), ...children);
  return row;
}

function changeControl(tag, label, onChange) {
  const element = document.createElement(tag);
  element.setAttribute("aria-label", label);
  element.addEventListener("change", () => onChange(element));
  return element;
}

export function field(label, ...children) {
  return designField(label, ...children);
}

export function button(label, className = "", onClick, options = {}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = classNames(className);
  if (options.icon) {
    element.append(createIcon(options.icon));
    const textLabel = document.createElement("span");
    textLabel.className = "bc-button-label";
    textLabel.textContent = label;
    element.append(textLabel);
  } else {
    element.textContent = label;
  }
  if (options.title) element.title = options.title;
  if (options.pressed !== undefined) element.setAttribute("aria-pressed", options.pressed ? "true" : "false");
  if (options.disabled) {
    element.disabled = true;
    element.dataset.disabledReason = options.disabledReason || "";
    element.setAttribute("aria-disabled", "true");
    if (options.disabledReason && !element.title) element.title = options.disabledReason;
  }
  element.addEventListener("click", (event) => {
    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  });
  return element;
}

export function actionButton(action = {}, className = "bc-button") {
  if (!action?.label || typeof action.onClick !== "function") return null;
  return button(action.label, className, action.onClick, {
    title: action.title,
    icon: action.icon,
    pressed: action.pressed,
    disabled: action.disabled,
    disabledReason: action.disabledReason
  });
}

export function actionRow(actions = [], options = {}) {
  const visibleActions = (Array.isArray(actions) ? actions : [])
    .filter((action) => action?.label && typeof action.onClick === "function");
  if (!visibleActions.length) return null;
  const row = document.createElement(options.tag || "div");
  row.className = classNames(options.className || "bc-action-row");
  if (options.label) row.setAttribute("aria-label", options.label);
  for (const action of visibleActions) {
    const className = typeof options.buttonClassName === "function"
      ? options.buttonClassName(action)
      : options.buttonClassName || "bc-button";
    const item = actionButton(action, className);
    if (item) row.append(item);
  }
  return row;
}

export function descriptorActions(field = {}) {
  return (Array.isArray(field.actions) ? field.actions : [])
    .filter((action) => action?.label && typeof action.onClick === "function");
}

export function propertyButtonClass(field = {}) {
  return [
    "bc-button",
    field.className || "",
    field.status && field.status !== "ok" ? `bc-button-${field.status}` : "",
    field.primary ? "bc-button-primary" : "",
    field.danger ? "bc-button-danger" : ""
  ].filter(Boolean).join(" ");
}

export function actionFieldControl(field = {}) {
  const row = document.createElement("div");
  row.className = "bc-generated-action-field";
  const control = actionButton(field, propertyButtonClass(field));
  if (control) row.append(control);
  return row;
}

export function actionRowControl(field = {}) {
  return actionRow(descriptorActions(field), {
    className: "bc-action-row",
    label: field.label,
    buttonClassName: propertyButtonClass
  });
}

export function actionListControl(field = {}) {
  const row = document.createElement("div");
  row.className = "bc-field bc-action-list-field";
  row.append(text("span", "bc-label", field.label || "Actions"));
  const controls = document.createElement("span");
  controls.className = "bc-action-list-control";
  const actions = descriptorActions(field);
  if (!actions.length) {
    controls.append(text("span", "bc-action-list-empty", field.emptyMessage || "No actions available."));
  }
  for (const action of actions) {
    const control = actionButton(action, propertyButtonClass(action));
    if (control) controls.append(control);
  }
  row.append(controls);
  return row;
}

export function statusGroupTitleControl(field = {}) {
  return text("div", ["bc-status-group-title", field.status || ""].filter(Boolean).join(" "), field.label || "");
}

export function statusRowControl(field = {}, options = {}) {
  const row = document.createElement("div");
  row.className = [
    "bc-status-row",
    field.compact ? "compact" : "",
    field.selected ? "selected" : "",
    field.status && field.status !== "ok" ? field.status : ""
  ].filter(Boolean).join(" ");
  row.append(text("span", "bc-status-label", field.label || "-"));
  if (field.diagnostic) row.append(text("div", "bc-status-diagnostic", field.diagnostic));
  if (field.value !== undefined && typeof field.onChange === "function") {
    const input = numericControl(field.valueLabel || field.label || "Value", field.value, field.onChange, field.options || {});
    input.className = "bc-status-value-input";
    if (field.valueTitle || field.title) input.title = field.valueTitle || field.title;
    row.append(input);
  }
  const buttonClassName = options.buttonClassName || propertyButtonClass;
  for (const action of descriptorActions(field)) {
    const className = typeof buttonClassName === "function" ? buttonClassName(action) : buttonClassName;
    const control = actionButton(action, className);
    if (control) row.append(control);
  }
  if (field.title) row.title = field.title;
  return row;
}

export function messageControl(field = {}) {
  const item = text("div", "bc-message", field.value || field.message || "");
  if (field.state) item.dataset.state = field.state;
  return item;
}

export function previewImageControl(field = {}) {
  const root = document.createElement("div");
  root.className = "bc-preview-image-field";
  root.dataset.previewState = field.state || "pending";
  if (field.label) root.setAttribute("aria-label", field.label);
  const frame = document.createElement("div");
  frame.className = "bc-preview-image-frame";
  if (field.dataUrl) {
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.src = field.dataUrl;
    frame.append(image);
  } else if (field.icon) {
    frame.append(createIcon(field.icon));
  }
  const copy = document.createElement("div");
  copy.className = "bc-preview-image-copy";
  if (field.title || field.label) copy.append(text("div", "bc-preview-image-title", field.title || field.label));
  if (field.value || field.reason) copy.append(text("div", "bc-preview-image-meta", field.value || field.reason));
  root.append(frame, copy);
  return root;
}

export function summaryCardControl(field = {}, {
  defaultStatus = "",
  titleFallback = "",
  includeOkStatus = true
} = {}) {
  const status = field.status || defaultStatus;
  const statusClass = status && (includeOkStatus || status !== "ok") ? status : "";
  const card = document.createElement("div");
  card.className = ["bc-summary-card", statusClass].filter(Boolean).join(" ");
  const title = field.title || titleFallback;
  if (title) card.append(text("div", "bc-summary-card-title", title));
  return card;
}

export function statusListRowControl(row = {}, options = {}) {
  const item = document.createElement("div");
  item.className = "bc-status-list-row";
  item.append(text("span", "bc-status-label", row.label || row.id || "-"));
  const buttonClassName = options.buttonClassName || propertyButtonClass;
  for (const action of descriptorActions(row)) {
    const className = typeof buttonClassName === "function" ? buttonClassName(action) : buttonClassName;
    const control = actionButton(action, className);
    if (control) item.append(control);
  }
  return item;
}

export function segmentedFieldControl(options = {}) {
  if (typeof options.onChange !== "function") return readout(options.label, options.value);
  const row = document.createElement("div");
  row.className = "bc-field bc-segmented-field";
  row.append(
    text("span", "bc-label", options.label || "Options"),
    segmentedControl({
      label: options.label || "Options",
      className: options.className || "bc-generated-segment",
      buttonClassName: options.buttonClassName || "",
      items: normalizeChoiceOptions(options.options || [], options.value),
      onSelect: (item) => options.onChange?.(item.id)
    })
  );
  return row;
}

export function numberChoiceControl(options = {}) {
  if (typeof options.onChange !== "function") return readout(options.label, options.value);
  const choices = normalizeNumberChoiceOptions(options.options || []);
  if (!choices.length) return numericInput(options.label, options.value, options.onChange, options.numberOptions || {});
  const row = document.createElement("label");
  const currentValue = String(options.value ?? "");
  let custom = Boolean(options.custom) || !choices.some((option) => option.id === currentValue);
  row.className = "bc-field bc-number-choice-field";
  const label = text("span", "bc-label", options.label || "Value");
  const controls = document.createElement("span");
  controls.className = "bc-number-choice-controls";
  let selectedValue = currentValue;
  const select = document.createElement("select");
  select.className = "bc-select";
  select.setAttribute("aria-label", options.label || "Value");
  for (const option of [...choices, { id: CUSTOM_NUMBER_CHOICE, label: "Custom" }]) {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    select.append(element);
  }
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = options.numberOptions?.integer ? "numeric" : "decimal";
  input.className = "bc-input bc-number-choice-input";
  input.value = options.value ?? "";
  input.setAttribute("aria-label", `Custom ${String(options.label || "value").toLowerCase()}`);
  input.readOnly = options.readOnly === true;
  const applyCustomState = () => {
    row.classList.toggle("custom-choice", custom);
    input.hidden = !custom;
    select.value = custom ? CUSTOM_NUMBER_CHOICE : selectedValue;
  };
  select.addEventListener("change", () => {
    if (select.value === CUSTOM_NUMBER_CHOICE) {
      custom = true;
      applyCustomState();
      options.onCustom?.();
      input.focus();
      input.select?.();
      return;
    }
    custom = false;
    selectedValue = select.value;
    applyCustomState();
    const next = Number(select.value);
    if (Number.isFinite(next)) options.onChange(next);
  });
  input.addEventListener("input", () => {
    parseNumericControlValue(input, options.numberOptions || {});
  });
  input.addEventListener("change", () => {
    const next = parseNumericControlValue(input, options.numberOptions || {});
    if (next !== null) options.onChange(next);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  controls.append(select, input);
  row.append(label, controls);
  if (options.unit) row.append(text("span", "bc-number-choice-unit", options.unit));
  applyCustomState();
  row.input = input;
  return row;
}

export function optionGridControl(options = {}) {
  if (typeof options.onChange !== "function") return readout(options.label, options.value);
  const row = document.createElement("div");
  row.className = "bc-field bc-option-grid-field";
  const group = document.createElement("div");
  group.className = classNames("bc-option-grid", options.className || "");
  group.setAttribute("role", options.role || "radiogroup");
  group.setAttribute("aria-label", options.ariaLabel || options.label || "Options");
  for (const option of normalizeChoiceOptions(options.options || [], options.value)) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = classNames("bc-option-grid-button", options.buttonClassName || "");
    item.dataset.selected = option.active ? "true" : "false";
    item.setAttribute("role", options.itemRole || "radio");
    item.setAttribute(options.selectedAttribute || "aria-checked", option.active ? "true" : "false");
    item.setAttribute("aria-label", option.ariaLabel || option.label);
    if (option.icon) item.append(createIcon(option.icon));
    item.append(text("span", "bc-option-grid-label", option.label));
    item.addEventListener("click", () => {
      if (!option.active) options.onChange?.(option.id, option);
    });
    group.append(item);
  }
  row.append(text("span", "bc-label", options.label || "Options"), group);
  return row;
}

export function tabListControl(options = {}) {
  if (typeof options.onChange !== "function") return readout(options.label, options.value);
  const tabs = normalizeChoiceOptions(options.options || options.items || [], options.value);
  const list = document.createElement("div");
  const listId = options.id || options.tabListId || "generated-tabs";
  list.className = classNames("bc-tab-list", options.className || "");
  list.dataset.generatedTabList = listId;
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", options.ariaLabel || options.label || "Tabs");
  const focusTab = (id) => {
    window.requestAnimationFrame(() => {
      for (const tabList of document.querySelectorAll("[data-generated-tab-list]")) {
        if (tabList.dataset.generatedTabList !== listId) continue;
        const activeTab = [...tabList.querySelectorAll("[data-generated-tab]")]
          .find((item) => item.dataset.generatedTab === id);
        if (activeTab) {
          activeTab.focus();
          return;
        }
      }
    });
  };
  const selectTab = (id) => {
    if (!id) return;
    options.onChange?.(id);
    focusTab(id);
  };
  for (const tab of tabs) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = classNames("bc-tab-button", options.buttonClassName || "", tab.active ? "active" : "");
    item.dataset.generatedTab = tab.id;
    item.setAttribute("role", "tab");
    item.setAttribute("aria-selected", tab.active ? "true" : "false");
    if (options.panelId || tab.controls) item.setAttribute("aria-controls", tab.controls || options.panelId);
    item.tabIndex = tab.active ? 0 : -1;
    item.textContent = tab.label;
    item.addEventListener("click", () => selectTab(tab.id));
    item.addEventListener("keydown", (event) => {
      const currentIndex = tabs.findIndex((entry) => entry.active);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[nextIndex]?.id);
    });
    list.append(item);
  }
  return list;
}

export function numberListControl(options = {}) {
  if (typeof options.onChange !== "function") return readout(options.label, numberListText(options.value));
  const row = document.createElement("label");
  row.className = "bc-field bc-number-list-field";
  const label = text("span", "bc-label", options.label || "Values");
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "bc-input";
  input.value = numberListText(options.value);
  input.placeholder = options.placeholder || options.options?.placeholder || "60 | 60";
  input.setAttribute("aria-label", options.label || "Values");
  input.addEventListener("input", () => {
    setControlInvalidState(input, parseNumberList(input.value, options.options || {}) === null);
  });
  input.addEventListener("change", () => {
    const next = parseNumberList(input.value, options.options || {});
    setControlInvalidState(input, next === null);
    if (next !== null) options.onChange(next);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  row.append(label, input);
  if (options.unit) row.append(text("span", "bc-number-list-unit", options.unit));
  row.input = input;
  return row;
}

export function vectorControl(options = {}, axisLabels = ["X", "Y", "Z"]) {
  const axes = Array.isArray(axisLabels) && axisLabels.length ? axisLabels : ["X", "Y", "Z"];
  const labels = Array.isArray(options.axisLabels) && options.axisLabels.length
    ? options.axisLabels.slice(0, axes.length)
    : Array.isArray(options.options?.axisLabels) && options.options.axisLabels.length
      ? options.options.axisLabels.slice(0, axes.length)
      : axes;
  const value = Array.isArray(options.value) ? options.value.slice(0, axes.length) : [];
  if (value.length !== axes.length || value.some((item) => !finiteNumber(Number(item)))) {
    return readout(options.label, options.fallbackValue ?? options.value);
  }
  const row = document.createElement("label");
  row.className = "bc-field bc-vector-field";
  const label = text("span", "bc-label", options.label || "Vector");
  const controls = document.createElement("span");
  controls.className = "bc-vector-controls";
  axes.forEach((axis, index) => {
    const axisLabel = labels[index] || axis;
    const axisControl = document.createElement("span");
    axisControl.className = "bc-vector-axis";
    axisControl.append(text("span", "bc-vector-axis-label", axisLabel));
    const input = numericControl(`${options.label || "Vector"} ${axisLabel}`, value[index], (nextValue) => {
      const next = value.slice();
      next[index] = nextValue;
      options.onChange?.(next);
    }, options.options || {});
    axisControl.append(input);
    controls.append(axisControl);
  });
  if (options.unit) controls.append(text("span", "bc-vector-unit", options.unit));
  row.append(label, controls);
  return row;
}

export function axisTransformGridControl(field = {}) {
  const root = document.createElement("div");
  root.className = "bc-axis-transform-field";
  const grid = document.createElement("div");
  grid.className = "bc-axis-transform-grid";
  const columns = field.columns || {};
  for (const heading of [
    columns.axis || "Axis",
    columns.before || "Before",
    columns.delta || "Move",
    columns.result || "After",
    columns.actions || ""
  ]) {
    grid.append(text("span", "bc-axis-transform-heading", heading));
  }

  for (const axis of Array.isArray(field.rows) ? field.rows : []) {
    const rowLabel = axis.label || axis.axisId || "";
    grid.append(
      text("span", "bc-axis-transform-axis", rowLabel),
      text("span", "bc-axis-transform-before", axis.before ?? "-"),
      axisTransformInput(axis.delta, field, `${rowLabel} move`),
      axisTransformInput(axis.result, field, `${rowLabel} coordinate`),
      axisTransformActions(axis.actions)
    );
  }
  root.append(grid);
  if (field.increment) root.append(axisTransformIncrement(field.increment, field));
  return root;
}

function axisTransformInput(control = {}, field = {}, fallbackLabel = "Value") {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = field.numberOptions?.integer ? "numeric" : "decimal";
  input.className = "bc-axis-transform-input bc-input";
  input.value = control.value ?? "";
  input.setAttribute("aria-label", control.label || fallbackLabel);
  const apply = () => {
    const parsed = parseNumericControlValue(input, control.numberOptions || field.numberOptions || {});
    if (parsed === null) return false;
    return control.onChange?.(parsed) !== false;
  };
  input.addEventListener("change", apply);
  input.addEventListener("keydown", (event) => {
    if (axisTransformShortcutMatches(event, axisTransformShortcutSetting(field.shortcuts, "confirmTransform", "Enter"))) {
      event.preventDefault();
      event.stopPropagation();
      if (apply()) field.confirmAction?.onClick?.();
    } else if (axisTransformShortcutMatches(event, axisTransformShortcutSetting(field.shortcuts, "cancelTransform", "Escape"))) {
      event.preventDefault();
      event.stopPropagation();
      field.cancelAction?.onClick?.();
    }
  });
  return input;
}

function axisTransformShortcutSetting(shortcuts, key, fallback = "") {
  return Object.prototype.hasOwnProperty.call(shortcuts || {}, key) ? shortcuts[key] : fallback;
}

function axisTransformShortcutMatches(event, binding) {
  const bindings = Array.isArray(binding) ? binding : [binding];
  return bindings.some((item) => axisTransformShortcutMatchesOne(event, item));
}

function axisTransformShortcutMatchesOne(event, binding) {
  if (!event || typeof binding !== "string") return false;
  const parts = binding.split("+").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return false;
  const key = parts.pop().toLowerCase();
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  const controlOrMeta = modifiers.has("controlormeta") || modifiers.has("ctrlormeta");
  const expectedCtrl = modifiers.has("ctrl") || modifiers.has("control");
  const expectedMeta = modifiers.has("cmd") || modifiers.has("meta");
  if (controlOrMeta && !event.ctrlKey && !event.metaKey) return false;
  if (!controlOrMeta && Boolean(event.ctrlKey) !== expectedCtrl) return false;
  if (!controlOrMeta && Boolean(event.metaKey) !== expectedMeta) return false;
  return String(event.key || "").toLowerCase() === key
    && Boolean(event.altKey) === modifiers.has("alt")
    && Boolean(event.shiftKey) === modifiers.has("shift");
}

function axisTransformActions(actions = []) {
  const group = document.createElement("span");
  group.className = "bc-axis-transform-actions";
  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action) continue;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "bc-axis-transform-step";
    item.setAttribute("aria-label", action.title || action.label || "Move");
    if (action.title) item.title = action.title;
    if (action.icon) item.append(createIcon(action.icon));
    else item.textContent = action.label || "";
    item.addEventListener("click", () => action.onClick?.());
    group.append(item);
  }
  return group;
}

function axisTransformIncrement(control = {}, field = {}) {
  const row = document.createElement("label");
  row.className = "bc-axis-transform-increment";
  row.append(
    text("span", "bc-axis-transform-increment-label", control.label || "Step"),
    axisTransformInput(control, field, control.label || "Step")
  );
  return row;
}

export function objectRefControl(field = {}) {
  const row = document.createElement("div");
  row.className = "bc-object-ref-field";
  const label = text("div", "bc-object-ref-label", field.label || "Object");
  const value = document.createElement("div");
  value.className = "bc-object-ref-value";
  if (field.icon) value.append(createIcon(field.icon));
  value.append(text("span", "bc-object-ref-id", field.value || "-"));
  if (field.status) value.append(text("span", "bc-object-ref-status", field.status));
  const actions = document.createElement("div");
  actions.className = "bc-object-ref-actions";
  const extraActions = Array.isArray(field.actions) ? field.actions.filter((action) => action && typeof action.onClick === "function") : [];
  for (const action of extraActions) {
    const control = actionButton(action, objectRefActionClass(action));
    if (control) actions.append(control);
  }
  row.append(label, value);
  if (actions.childElementCount) row.append(actions);
  return row;
}

export function objectRefListControl(field = {}) {
  const list = document.createElement("div");
  list.className = "bc-object-ref-list";
  const items = Array.isArray(field.items) ? field.items : [];
  if (!items.length) {
    list.append(readout(field.emptyLabel || field.label || "Objects", field.emptyValue || "No objects"));
    return list;
  }
  for (const item of items) {
    list.append(objectRefControl(item));
  }
  return list;
}

export function readoutListControl(field = {}, options = {}) {
  const list = document.createElement("div");
  list.className = "bc-readout-list";
  const items = Array.isArray(field.items) ? field.items : [];
  const formatValue = typeof options.formatValue === "function" ? options.formatValue : (value) => value;
  if (!items.length) {
    list.append(readout(field.emptyLabel || field.label || "Values", field.emptyValue || "-"));
    return list;
  }
  for (const item of items) {
    if (!item?.label) continue;
    list.append(readout(item.label, formatValue(item.value)));
  }
  return list;
}

export function diagnosticListControl(field = {}) {
  const list = document.createElement("div");
  list.className = "bc-diagnostic-list";
  const items = Array.isArray(field.items)
    ? field.items
    : Array.isArray(field.diagnostics) ? field.diagnostics : [];
  if (!items.length) {
    list.append(readout(field.emptyLabel || field.label || "Diagnostics", field.emptyValue || "No issues"));
    return list;
  }
  for (const diagnostic of items) {
    const severity = diagnostic.severity || diagnostic.state || "warning";
    const item = document.createElement("div");
    item.className = "bc-diagnostic-item";
    item.dataset.severity = severity;
    item.append(
      text("div", "bc-diagnostic-title", diagnostic.title || `${severity}: ${diagnostic.message || "-"}`),
      text("div", "bc-diagnostic-meta", diagnostic.meta || diagnostic.code || "")
    );
    list.append(item);
  }
  return list;
}

function normalizeChoiceOptions(options = [], value = "") {
  const activeValue = String(value ?? "");
  return (Array.isArray(options) ? options : [])
    .map((option) => {
      const id = option?.id ?? option?.value ?? "";
      const label = option?.label ?? option?.title ?? id;
      return {
        ...option,
        id: String(id),
        label,
        active: String(id) === activeValue
      };
    })
    .filter((option) => option.id);
}

function normalizeNumberChoiceOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option) => ({
      id: String(option?.id ?? option?.value ?? ""),
      label: String(option?.label ?? option?.id ?? option?.value ?? "")
    }))
    .filter((option) => option.id);
}

function numberListText(value) {
  return Array.isArray(value) ? value.join(" | ") : "";
}

function parseNumberList(textValue, options = {}) {
  const textContent = String(textValue || "").trim();
  if (!textContent) return [];
  const values = [];
  for (const item of textContent.split(/[|,; ]+/).filter(Boolean)) {
    const value = Number(item);
    if (!Number.isFinite(value)) return null;
    if (options.itemMinimum !== undefined && value < options.itemMinimum) return null;
    if (options.itemExclusiveMinimum !== undefined && value <= options.itemExclusiveMinimum) return null;
    values.push(value);
  }
  return values;
}

function setControlInvalidState(control, invalid) {
  control.classList.toggle("invalid", invalid);
  control.toggleAttribute("aria-invalid", invalid);
}

function objectRefActionClass(action) {
  return [
    "bc-button",
    "bc-button-reference",
    action.primary ? "bc-button-primary" : "",
    action.danger ? "bc-button-danger" : ""
  ].filter(Boolean).join(" ");
}

export function quickActions(actions = [], options = {}) {
  const visibleActions = actions.filter(Boolean);
  if (!visibleActions.length) return null;
  const row = document.createElement("div");
  row.className = classNames("bc-quick-actions", options.className || "");
  row.setAttribute("aria-label", options.label || "Quick actions");
  for (const action of visibleActions) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = classNames(
      "bc-quick-action",
      action.primary ? "bc-quick-action-primary" : "",
      action.danger ? "bc-quick-action-danger" : "",
      action.className || ""
    );
    element.title = action.title || action.label;
    element.setAttribute("aria-label", action.title || action.label);
    if (action.pressed !== undefined) element.setAttribute("aria-pressed", action.pressed ? "true" : "false");
    if (action.icon) element.append(createIcon(action.icon));
    const label = document.createElement("span");
    label.className = "bc-quick-action-label";
    label.textContent = action.label;
    element.append(label);
    element.addEventListener("click", action.onClick);
    row.append(element);
  }
  return row;
}

export function textInput(label, value, onChange, options = {}) {
  const input = changeControl(options.multiline ? "textarea" : "input", label, (element) => onChange(element.value));
  if (!options.multiline) input.type = "text";
  input.className = options.multiline ? "bc-input" : "bc-input";
  if (options.rows) input.rows = options.rows;
  input.value = value || "";
  const row = labeledElement("label", options.className || "bc-field", label, input);
  row.input = input;
  return row;
}

export function parseNumericControlValue(input, options = {}) {
  const next = Number(input.value);
  const aboveMin = options.min === undefined
    || (options.minExclusive ? next > options.min : next >= options.min);
  const belowMax = options.max === undefined
    || (options.maxExclusive ? next < options.max : next <= options.max);
  const integral = !options.integer || Number.isInteger(next);
  const stepped = !finiteNumber(options.step) || options.step <= 0 || numericStepMatches(next, options);
  const valid = finiteNumber(next) && aboveMin && belowMax && integral && stepped;
  input.classList.toggle("invalid", !valid);
  input.toggleAttribute("aria-invalid", !valid);
  return valid ? next : null;
}

function numericStepMatches(value, options = {}) {
  const step = Number(options.step);
  const base = finiteNumber(options.min) ? Number(options.min) : 0;
  const scaled = (value - base) / step;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

export function numericControl(label, value, onChange, options = {}) {
  const input = changeControl("input", label, () => {
    const next = parseNumericControlValue(input, options);
    if (next !== null) onChange(next);
  });
  input.type = "text";
  input.inputMode = options.integer ? "numeric" : "decimal";
  input.className = "bc-input";
  input.value = formatControlNumber(value, { digits: 6, trimTrailingZeros: true });
  return input;
}

export function numericInput(label, value, onChange, options = {}) {
  const input = numericControl(label, value, onChange, options);
  return labeledElement("label", "bc-field", label, input);
}

export function arrayInput(label, labels, value, onChange) {
  const rows = [text("div", "bc-subtitle", label)];
  const source = Array.isArray(value) ? value : [];
  const current = labels.map((_, index) => finiteNumber(source[index]) ? source[index] : NaN);
  labels.forEach((item, index) => {
    rows.push(numericInput(item, current[index], (nextValue) => {
      const next = [...current];
      next[index] = nextValue;
      if (next.every(finiteNumber)) onChange(next);
    }));
  });
  return rows;
}

export const vectorInput = (label, value, onChange) => arrayInput(label, ["X", "Y", "Z"], value, onChange);

export function checkboxControl(label, checked, onChange) {
  const input = changeControl("input", label, (element) => onChange(element.checked));
  input.type = "checkbox";
  input.checked = Boolean(checked);
  return input;
}

export function checkboxInput(label, checked, onChange) {
  const input = checkboxControl(label, checked, onChange);
  return labeledElement("label", "bc-field", label, input);
}

export function selectInput(label, options, value, onChange) {
  const select = changeControl("select", label, (element) => onChange(element.value));
  select.className = "bc-select";
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    select.append(item);
  }
  select.value = value;
  return labeledElement("label", "bc-field", label, select);
}

export function readout(label, value) {
  return designReadout(label, value);
}
