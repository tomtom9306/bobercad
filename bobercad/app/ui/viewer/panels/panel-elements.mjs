import { finiteNumber, finiteNumberOr } from "../../../engine/core/math.mjs?v=panel-number-dry-1";
import { formatNumber } from "../../../engine/core/format.mjs?v=panel-format-dry-1";
import { arrayValues } from "../../../engine/core/model.mjs?v=array-values-dry-1";

export function text(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
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
    element() {
      const message = text("div", "editor-message", messageText);
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
  header.className = "feature-editor-header";
  header.append(text("div", "editor-title", title), button("Close", "editor-button", onClose));
  const body = document.createElement("section");
  body.className = "editor-section";
  body.append(...rows);
  panel.hidden = false;
  panel.replaceChildren(header, body, message);
}

function labeledElement(tag, className, label, ...children) {
  const row = document.createElement(tag);
  row.className = className;
  row.append(text("span", "editor-label", label), ...children);
  return row;
}

function changeControl(tag, label, onChange) {
  const element = document.createElement(tag);
  element.setAttribute("aria-label", label);
  element.addEventListener("change", () => onChange(element));
  return element;
}

export function field(label, ...children) {
  return labeledElement("div", "editor-field", label, ...children);
}

export function button(label, className, onClick, options = {}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  if (options.title) element.title = options.title;
  element.addEventListener("click", onClick);
  return element;
}

export function textInput(label, value, onChange, options = {}) {
  const input = changeControl(options.multiline ? "textarea" : "input", label, (element) => onChange(element.value));
  if (!options.multiline) input.type = "text";
  if (options.rows) input.rows = options.rows;
  input.value = value || "";
  const row = labeledElement("label", options.className || "editor-field", label, input);
  row.input = input;
  return row;
}

export function parseNumericControlValue(input, options = {}) {
  const next = Number(input.value);
  const aboveMin = options.min === undefined
    || (options.minExclusive ? next > options.min : next >= options.min);
  const valid = finiteNumber(next) && aboveMin;
  input.classList.toggle("invalid", !valid);
  return valid ? next : null;
}

export function numericControl(label, value, onChange, options = {}) {
  const input = changeControl("input", label, () => {
    const next = parseNumericControlValue(input, options);
    if (next !== null) onChange(next);
  });
  input.type = "text";
  input.inputMode = "decimal";
  input.value = formatNumber(value, { digits: 6, trimTrailingZeros: true });
  return input;
}

export function numericInput(label, value, onChange, options = {}) {
  const input = numericControl(label, value, onChange, options);
  return labeledElement("label", "editor-field", label, input);
}

export function arrayInput(label, labels, value, onChange) {
  const rows = [text("div", "editor-subtitle", label)];
  const source = arrayValues(value);
  const current = labels.map((_, index) => finiteNumberOr(source[index], NaN));
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
  return labeledElement("label", "editor-field", label, input);
}

export function selectInput(label, options, value, onChange) {
  const select = changeControl("select", label, (element) => onChange(element.value));
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    select.append(item);
  }
  select.value = value;
  return labeledElement("label", "editor-field", label, select);
}

export function readout(label, value) {
  return labeledElement("div", "editor-readout", label, text("span", "editor-value", value));
}
