import { clone, requiredPath, setPath } from "./schema.mjs";

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
    if (next !== null) onChange(next);
  });
  row.append(text("span", "property-label", spec.label), input, text("span", "property-unit", spec.unit || ""));
  return row;
}

function readout(label, value) {
  const row = document.createElement("div");
  row.className = "property-readout";
  row.append(text("span", "property-label", label), text("span", "property-value", value));
  return row;
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

function statusText(status) {
  return String(status).replaceAll("-", " ");
}

function connectionHealth(connection) {
  return connection.generator?.health || "ok";
}

function firstError(connection) {
  return (connection.generator?.diagnostics || []).find((entry) => entry.severity === "error") || null;
}

function tabButton(tab, activeTab, onSelect) {
  return button(tab.label, `property-tab${tab.id === activeTab ? " active" : ""}`, () => onSelect(tab.id));
}

function renderParameter(definition, parameters, path, update) {
  const spec = definition.parameters[path];
  const value = requiredPath(parameters, path, definition.type);
  if (spec.readOnly || !["number", "positiveNumber", "nonNegativeNumber", "positiveInteger"].includes(spec.kind)) {
    return readout(spec.label, value);
  }
  return field({ spec, value, onChange: (next) => update(path, next) });
}

export function mountConnectionUi({ panel, connectionId, api, onProjectChange, onConnectionDeleted }) {
  const definition = api.definition(connectionId);
  const connection = api.connection(connectionId);
  if (connection.generator?.status !== "generated") throw new Error(`${connectionId}: connection is not generated`);

  const parameters = clone(connection.referenceParameters);
  const body = document.createElement("div");
  const tabs = document.createElement("div");
  const message = text("div", "connection-message", "Ready");
  const status = text("div", "connection-status", "");
  let activeTab = definition.ui.tabs[0].id;

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

  const update = (path, value) => {
    setPath(parameters, path, value, definition.type);
    apply();
  };

  const updatePlateIncluded = (plateId, included) => {
    try {
      onProjectChange(api.setConnectionPlateIncluded(connectionId, plateId, included));
      refreshStatus("Applied");
      renderBody();
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

  const renderTabs = () => {
    tabs.className = "property-tabs";
    tabs.replaceChildren(...definition.ui.tabs.map((tab) => tabButton(tab, activeTab, (next) => {
      activeTab = next;
      renderTabs();
      renderBody();
    })));
  };

  const renderItem = (item) => {
    if (typeof item === "string") return renderParameter(definition, parameters, item, update);
    if (item.kind === "connectionPlates") {
      return api.connectionPlateOptions(connectionId).map((plate) => checkboxField({
        label: plate.label,
        note: plate.required ? "required" : plate.role,
        checked: plate.included,
        disabled: plate.required,
        onChange: (included) => updatePlateIncluded(plate.id, included)
      }));
    }
    throw new Error(`${definition.type}: unsupported ui item ${item.kind}`);
  };

  function renderBody() {
    const tab = definition.ui.tabs.find((entry) => entry.id === activeTab);
    body.className = "property-tab-body";
    body.replaceChildren(...tab.items.flatMap(renderItem));
  }

  const header = document.createElement("header");
  header.className = "connection-header";
  header.append(
    text("div", "connection-kicker", connectionId),
    text("h1", "connection-title", definition.title),
    status
  );

  const footer = document.createElement("footer");
  footer.className = "connection-footer";
  footer.append(
    button("Modify", "connection-action primary", apply),
    button("Delete", "connection-action danger", removeConnection),
    message
  );

  renderTabs();
  renderBody();
  refreshStatus();
  panel.hidden = false;
  panel.replaceChildren(header, tabs, body, footer);
}
