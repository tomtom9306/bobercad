import { clone, optionalPath, setPath } from "../../../app/engine/modules/connections/connection-schema.mjs";
import { conditionDependsOn, conditionMatches, parameterValue } from "./parameter-values.mjs";

const STYLE_ID = "bobercad-connection-ui";
const EDITABLE_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "numberList", "boolean", "catalogRef", "enum"]);

const STYLE = `
.connection-ui .connection-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 12px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid #cbd5e1;
  background: #f8fafc;
}
.connection-ui .connection-kicker {
  grid-column: 1 / 2;
  color: #64748b;
  font-size: 11px;
}
.connection-ui .connection-title {
  grid-column: 1 / 2;
  margin: 0;
  color: #111827;
  font-size: 15px;
  line-height: 1.2;
}
.connection-ui .connection-status {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  align-self: start;
  border: 1px solid #9fb0c3;
  background: #e8eef5;
  color: #334155;
  padding: 3px 7px;
  font-size: 11px;
  text-transform: capitalize;
}
.connection-ui .connection-status[data-state="error"] {
  border-color: #991b1b;
  background: #fee2e2;
  color: #991b1b;
}
.connection-ui .property-tabs {
  display: flex;
  gap: 0;
  padding: 8px 10px 0;
  border-bottom: 1px solid #b8c2d2;
  background: #eef2f7;
}
.connection-ui .property-tab {
  min-width: 62px;
  border: 1px solid #aeb8c7;
  border-bottom: 0;
  background: #dfe6ef;
  color: #172033;
  padding: 5px 9px;
  font: inherit;
  cursor: pointer;
}
.connection-ui .property-tab + .property-tab {
  margin-left: -1px;
}
.connection-ui .property-tab.active {
  position: relative;
  top: 1px;
  background: #ffffff;
  font-weight: 700;
}
.connection-ui .property-tab-body {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 220px;
  padding: 12px 14px;
  background: #ffffff;
}
.connection-ui .property-section {
  display: grid;
  gap: 8px;
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
}
.connection-ui .property-section summary {
  color: #172033;
  cursor: pointer;
  font-weight: 700;
}
.connection-ui .property-section-body {
  display: grid;
  gap: 8px;
  padding-top: 4px;
}
.connection-ui .property-field,
.connection-ui .property-readout,
.connection-ui .property-check {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px 36px;
  align-items: center;
  gap: 7px;
}
.connection-ui .property-check {
  grid-template-columns: 16px minmax(0, 1fr) 78px;
}
.connection-ui .property-field.custom-choice {
  grid-template-columns: minmax(0, 1fr) 76px 62px 36px;
}
.connection-ui [data-parameter-path].focused {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.connection-ui .property-label {
  color: #475569;
  line-height: 1.25;
}
.connection-ui input[type="text"],
.connection-ui select {
  min-width: 0;
  height: 26px;
  box-sizing: border-box;
  border: 1px solid #aeb9c9;
  background: #ffffff;
  color: #172033;
  padding: 4px 7px;
  font: inherit;
}
.connection-ui input[type="text"]:focus,
.connection-ui select:focus {
  outline: 2px solid #7aa7d9;
  outline-offset: 0;
  border-color: #4d7fb6;
}
.connection-ui input[type="text"].invalid {
  border-color: #b91c1c;
  background: #fff5f5;
}
.connection-ui input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
}
.connection-ui input[type="checkbox"]:disabled {
  opacity: 0.65;
}
.connection-ui .property-unit {
  color: #64748b;
  font-size: 11px;
  line-height: 1;
}
.connection-ui .property-value {
  grid-column: 2 / 4;
  color: #172033;
  line-height: 1.25;
}
.connection-ui .connection-footer {
  display: grid;
  grid-template-columns: repeat(3, max-content) 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid #cbd5e1;
  background: #f8fafc;
}
.connection-ui .connection-action {
  border: 1px solid #9fb0c3;
  background: #ffffff;
  color: #172033;
  padding: 5px 10px;
  font: inherit;
  cursor: pointer;
}
.connection-ui .connection-action.primary {
  background: #e8eef5;
}
.connection-ui .connection-action.danger {
  border-color: #b91c1c;
  color: #991b1b;
}
.connection-ui .connection-message {
  min-height: 18px;
  color: #475569;
  line-height: 1.35;
}
.connection-ui .connection-message[data-state="ok"] {
  color: #166534;
}
.connection-ui .connection-message[data-state="error"] {
  color: #b91c1c;
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

function text(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function button(label, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function numberValue(input, spec) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) return null;
  if (spec.kind === "positiveInteger" && (!Number.isInteger(value) || value <= 0)) return null;
  if (spec.kind === "positiveNumber" && value <= 0) return null;
  if (spec.kind === "nonNegativeNumber" && value < 0) return null;
  return value;
}

function normalizeListItems(items, spec) {
  const values = [];
  for (const item of items) {
    const value = Number(item);
    if (!Number.isFinite(value)) return null;
    if (spec.itemMinimum !== undefined && value < spec.itemMinimum) return null;
    if (spec.itemExclusiveMinimum !== undefined && value <= spec.itemExclusiveMinimum) return null;
    values.push(value);
  }
  return values;
}

function numberListValue(input, spec) {
  const text = input.value.trim();
  if (!text) return [];
  return normalizeListItems(text.split(/[|,; ]+/).filter(Boolean), spec);
}

function field({ spec, value, onChange }) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  const integer = spec.kind === "positiveInteger";
  row.className = "property-field";
  input.type = "text";
  input.inputMode = integer ? "numeric" : "decimal";
  input.value = value;
  input.setAttribute("aria-label", spec.label);
  input.addEventListener("input", () => {
    const next = numberValue(input, spec);
    input.classList.toggle("invalid", next === null);
  });
  input.addEventListener("change", () => {
    const next = numberValue(input, spec);
    input.classList.toggle("invalid", next === null);
    if (next !== null) onChange(next);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  row.append(text("span", "property-label", spec.label), input, text("span", "property-unit", spec.unit || ""));
  return row;
}

function listValueText(value) {
  return Array.isArray(value) ? value.join(" | ") : "";
}

function numberListField({ spec, value, onChange }) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "property-field";
  input.type = "text";
  input.inputMode = "decimal";
  input.value = listValueText(value);
  input.placeholder = spec.placeholder || "60 | 60";
  input.setAttribute("aria-label", spec.label);
  input.addEventListener("input", () => {
    const next = numberListValue(input, spec);
    input.classList.toggle("invalid", next === null);
  });
  input.addEventListener("change", () => {
    const next = numberListValue(input, spec);
    input.classList.toggle("invalid", next === null);
    if (next !== null) onChange(next);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  row.append(text("span", "property-label", spec.label), input, text("span", "property-unit", spec.unit || ""));
  return row;
}

function readout(label, value, path = "") {
  const row = document.createElement("div");
  row.className = "property-readout";
  if (path) row.dataset.path = path;
  row.append(text("span", "property-label", label), text("span", "property-value", value));
  return row;
}

function numberOptions(definition, parameters, spec, api) {
  if (spec.standardOptions?.kind !== "fastenerLengths") return [];
  const fastenerRef = optionalPath(parameters, spec.standardOptions.fastenerRef || "bolts.fastenerRef");
  const fastener = fastenerRef ? api.catalogEntries?.("fasteners")?.[fastenerRef] : null;
  return (fastener?.lengths || [])
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: String(value) }));
}

function standardNumberField({ spec, value, options, custom, onSelect, onCustom, onChange }) {
  const row = document.createElement("label");
  const select = document.createElement("select");
  row.className = `property-field${custom ? " custom-choice" : ""}`;
  select.setAttribute("aria-label", spec.label);
  for (const option of [...options, { value: "__custom", label: "Custom" }]) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = custom ? "__custom" : String(value);
  select.addEventListener("change", () => {
    if (select.value === "__custom") onCustom();
    else onSelect(Number(select.value));
  });

  if (!custom) {
    row.append(text("span", "property-label", spec.label), select, text("span", "property-unit", spec.unit || ""));
    return row;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = value;
  input.setAttribute("aria-label", `Custom ${spec.label.toLowerCase()}`);
  input.addEventListener("input", () => {
    const next = numberValue(input, spec);
    input.classList.toggle("invalid", next === null);
  });
  input.addEventListener("change", () => {
    const next = numberValue(input, spec);
    input.classList.toggle("invalid", next === null);
    if (next !== null) onChange(next);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  });
  row.append(text("span", "property-label", spec.label), select, input, text("span", "property-unit", spec.unit || ""));
  return row;
}

function readoutValue(value, unit) {
  const content = Array.isArray(value)
    ? listValueText(value)
    : value === undefined || value === null || value === "" ? "-" : String(value);
  return unit ? `${content} ${unit}` : content;
}

function checkboxField({ label, note, checked, disabled = false, onChange }) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "property-check";
  input.type = "checkbox";
  input.checked = checked;
  input.disabled = disabled;
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => onChange(input.checked));
  row.append(input, text("span", "property-label", label), text("span", "property-unit", note || ""));
  return row;
}

function selectField({ spec, value, options, onChange }) {
  const row = document.createElement("label");
  const select = document.createElement("select");
  row.className = "property-field";
  select.setAttribute("aria-label", spec.label);
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.append(element);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  row.append(text("span", "property-label", spec.label), select, text("span", "property-unit", spec.unit || ""));
  return row;
}

function statusText(status) {
  return String(status).replaceAll("-", " ");
}

function connectionHealth(connection) {
  return connection.generator?.health || "ok";
}

function firstError(connection) {
  return (connection.generator?.diagnostics || []).find((entry) => entry.severity === "error") || null;
}

function firstIssue(connection) {
  return (connection.generator?.diagnostics || []).find((entry) => entry.severity === "error" || entry.severity === "warning") || null;
}

function tabButton(tab, activeTab, onSelect) {
  return button(tab.label, `property-tab${tab.id === activeTab ? " active" : ""}`, () => onSelect(tab.id));
}

function parameterRow(row, path, uiState) {
  row.dataset.parameterPath = path;
  if (uiState.focusPath === path) row.classList.add("focused");
  return row;
}

function renderParameter(definition, parameters, path, update, api, uiState) {
  const spec = definition.parameters[path];
  const value = parameterValue(definition, parameters, path, api);
  const editable = EDITABLE_KINDS.has(spec.kind) && (!spec.readOnly || conditionMatches(spec.editableWhen, parameters));
  const updatePath = spec.writePath || path;
  if (!editable) {
    return parameterRow(readout(spec.label, readoutValue(value, spec.unit), path), path, uiState);
  }
  const options = numberOptions(definition, parameters, spec, api);
  if (options.length) {
    const standardValue = options.some((option) => option.value === String(value));
    const custom = uiState.customNumberPaths.has(path) || !standardValue;
    return parameterRow(standardNumberField({
      spec,
      value,
      options,
      custom,
      onCustom: () => {
        uiState.customNumberPaths.add(path);
        uiState.renderBody();
      },
      onSelect: (next) => {
        uiState.customNumberPaths.delete(path);
        update(updatePath, next);
        uiState.renderBody();
      },
      onChange: (next) => update(updatePath, next)
    }), path, uiState);
  }
  if (spec.kind === "catalogRef") {
    const entries = api.catalogEntries?.(spec.catalog) || {};
    const options = Object.keys(entries).sort().map((id) => ({ value: id, label: entries[id].name || id }));
    return parameterRow(selectField({ spec, value, options, onChange: (next) => update(updatePath, next) }), path, uiState);
  }
  if (spec.kind === "enum") {
    const options = spec.values.map((item) => ({ value: item, label: item }));
    return parameterRow(selectField({ spec, value, options, onChange: (next) => update(updatePath, next) }), path, uiState);
  }
  if (spec.kind === "boolean") {
    return parameterRow(checkboxField({
      label: spec.label,
      note: spec.note || "",
      checked: Boolean(value),
      onChange: (next) => update(updatePath, next)
    }), path, uiState);
  }
  if (spec.kind === "numberList") {
    return parameterRow(numberListField({ spec, value, onChange: (next) => update(updatePath, next) }), path, uiState);
  }
  return parameterRow(field({ spec, value, onChange: (next) => update(updatePath, next) }), path, uiState);
}

export function mountParameterConnectionUi({ panel, definition, connectionId, api, onProjectChange, onConnectionDeleted, onPanelFocus, focusPath = null, focusMode = "select", focusInput = true }) {
  ensureStyle();
  definition ||= api.definition(connectionId);
  const connection = api.connection(connectionId);
  if (connection.generator?.status !== "generated") throw new Error(`${connectionId}: connection is not generated`);

  let parameters = clone(connection.referenceParameters);
  const body = document.createElement("div");
  const tabs = document.createElement("div");
  const message = text("div", "connection-message", "Ready");
  const status = text("div", "connection-status", "");
  const tabFields = (item) => {
    if (typeof item === "string") return [item];
    if (item?.kind === "parameter") return [item.path];
    if (item?.kind === "section") return (item.items || []).flatMap(tabFields);
    return [];
  };
  const tabForFocus = focusPath ? definition.ui.tabs.find((tab) => (tab.items || []).flatMap(tabFields).includes(focusPath)) : null;
  let activeTab = tabForFocus?.id || definition.ui.tabs[0].id;
  const uiState = { customNumberPaths: new Set(), focusPath, focusMode, focusInput, sectionOpen: new Map(), renderBody: () => renderBody() };
  body.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.("input, select, button")) onPanelFocus?.();
  });

  const focusParameter = () => {
    if (!uiState.focusPath) return;
    const row = [...body.querySelectorAll("[data-parameter-path]")].find((entry) => entry.dataset.parameterPath === uiState.focusPath);
    const control = row?.querySelector("input:not(:disabled), select:not(:disabled), button:not(:disabled)");
    row?.scrollIntoView({ block: "nearest" });
    if (!uiState.focusInput) return;
    control?.focus();
    if (control?.tagName === "INPUT" && control.type === "text") {
      if (uiState.focusMode === "cursor") control.setSelectionRange?.(control.value.length, control.value.length);
      else control.select();
    }
  };

  const refreshStatus = (okText = "Ready") => {
    const nextConnection = api.connection(connectionId);
    const error = firstError(nextConnection);
    const health = connectionHealth(nextConnection);
    status.textContent = error ? "issues" : statusText(nextConnection.generator.status);
    status.dataset.state = health;
    message.textContent = error ? error.message : okText;
    message.dataset.state = error ? "error" : "ok";
  };

  const apply = () => {
    try {
      onProjectChange(api.updateConnection(connectionId, parameters));
      refreshStatus("Applied");
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
    }
  };

  const layoutDependsOn = (path) => Object.values(definition.parameters).some((spec) => (
    spec.editableWhen?.path === path || spec.standardOptions?.fastenerRef === path
    || spec.derive?.countPath === path || spec.derive?.defaultPath === path || spec.derive?.sizePath === path
    || spec.derive?.spacingModePath === path || spec.derive?.equalSpacingPath === path || spec.derive?.customSpacingPath === path
    || spec.derive?.sourcePath === path
  )) || (definition.ui.tabs || []).some((tab) => (tab.items || []).some((item) => itemDependsOn(item, path)));

  const refreshReadouts = () => {
    for (const row of body.querySelectorAll(".property-readout[data-path]")) {
      const path = row.dataset.path;
      const spec = definition.parameters[path];
      row.querySelector(".property-value").textContent = readoutValue(parameterValue(definition, parameters, path, api), spec.unit);
    }
  };

  const update = (path, value) => {
    setPath(parameters, path, value, definition.type);
    apply();
    renderFooter();
    if (layoutDependsOn(path)) renderBody();
    else refreshReadouts();
  };

  const updatePlateIncluded = (plateId, included) => {
    try {
      onProjectChange(api.setConnectionPlateIncluded(connectionId, plateId, included));
      refreshStatus("Applied");
      renderBody();
      renderFooter();
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
      renderBody();
    }
  };

  const updateComponentActive = (role, active) => {
    try {
      onProjectChange(api.setConnectionComponentActive(connectionId, role, active));
      refreshStatus("Applied");
      renderBody();
      renderFooter();
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
      renderBody();
    }
  };

  const removeConnection = () => {
    try {
      onProjectChange(api.deleteConnection(connectionId));
      onConnectionDeleted?.(connectionId);
      panel.hidden = true;
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
    }
  };

  const resolveIssues = () => {
    try {
      const nextProject = api.resolveConnectionDiagnostics(connectionId);
      parameters = clone(api.connection(connectionId).referenceParameters);
      onProjectChange(nextProject);
      refreshStatus("Resolved");
      renderBody();
      renderFooter();
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
    }
  };

  const renderTabs = () => {
    tabs.className = "property-tabs";
    tabs.replaceChildren(...definition.ui.tabs.map((tab) => tabButton(tab, activeTab, (next) => {
      activeTab = next;
      renderTabs();
      renderBody();
    })));
  };

  const itemDependsOn = (item, path) => {
    if (!item || typeof item === "string") return false;
    if (conditionDependsOn(item.visibleWhen, path)) return true;
    if (item.kind === "section") return (item.items || []).some((child) => itemDependsOn(child, path));
    return false;
  };

  const renderItem = (item) => {
    if (item?.visibleWhen && !conditionMatches(item.visibleWhen, parameters)) return [];
    if (typeof item === "string") return renderParameter(definition, parameters, item, update, api, uiState);
    if (item.kind === "parameter") return renderParameter(definition, parameters, item.path, update, api, uiState);
    if (item.kind === "section") {
      const section = document.createElement("details");
      const summary = document.createElement("summary");
      const content = document.createElement("div");
      const sectionKey = item.id || item.label;
      section.className = "property-section";
      section.open = uiState.sectionOpen.get(sectionKey) ?? Boolean(item.open);
      section.addEventListener("toggle", () => uiState.sectionOpen.set(sectionKey, section.open));
      content.className = "property-section-body";
      summary.textContent = item.label;
      content.replaceChildren(...(item.items || []).flatMap(renderItem));
      section.append(summary, content);
      return section;
    }
    if (item.kind === "connectionPlates") {
      return api.connectionPlateOptions(connectionId).map((plate) => checkboxField({
        label: plate.label,
        note: plate.required ? "required" : plate.role,
        checked: plate.included,
        disabled: plate.required,
        onChange: (included) => updatePlateIncluded(plate.id, included)
      }));
    }
    if (item.kind === "connectionComponents") {
      const allowedRoles = new Set(Array.isArray(item.roles) ? item.roles : []);
      return api.connectionComponentOptions(connectionId)
        .filter((component) => !allowedRoles.size || allowedRoles.has(component.role))
        .map((component) => checkboxField({
          label: component.label,
          note: component.active ? "active" : "ghost",
          checked: component.active,
          onChange: (active) => updateComponentActive(component.role, active)
        }));
    }
    throw new Error(`${definition.type}: unsupported ui item ${item.kind}`);
  };

  function renderBody() {
    const tab = definition.ui.tabs.find((entry) => entry.id === activeTab);
    body.className = "property-tab-body";
    body.replaceChildren(...tab.items.flatMap(renderItem));
    requestAnimationFrame(focusParameter);
  }

  const header = document.createElement("header");
  header.className = "connection-header";
  header.append(
    text("div", "connection-kicker", connectionId),
    text("h1", "connection-title", definition.title),
    status
  );

  const footer = document.createElement("footer");
  function renderFooter() {
    const issue = firstIssue(api.connection(connectionId));
    const controls = [
      button("Modify", "connection-action primary", apply),
      button("Delete", "connection-action danger", removeConnection)
    ];
    if (issue && api.resolveConnectionDiagnostics) controls.unshift(button("Resolve", "connection-action", resolveIssues));
    footer.className = "connection-footer";
    footer.replaceChildren(...controls, message);
  }

  renderTabs();
  renderBody();
  renderFooter();
  refreshStatus();
  panel.classList.add("connection-ui");
  panel.hidden = false;
  panel.replaceChildren(header, tabs, body, footer);
}
