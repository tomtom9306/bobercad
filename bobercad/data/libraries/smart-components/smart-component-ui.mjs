import { jsonClone as clone } from "../../../app/engine/core/model.mjs?v=json-clone-dry-1";
import { optionalPath, setPath } from "../../../app/engine/modules/smart-components/parameters.mjs?v=smart-config-array-values-dry-1";
import { conditionDependsOn, conditionMatches, parameterValue } from "./parameter-values.mjs?v=json-clone-dry-1";

const STYLE_ID = "bobercad-connection-ui";
const EDITABLE_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "numberList", "boolean", "catalogRef", "enum", "text"]);

const STYLE = `
.connection-ui .connection-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
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
  min-width: 0;
  overflow: hidden;
  grid-column: 1 / 2;
  margin: 0;
  color: #111827;
  font-size: 15px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex-wrap: wrap;
  gap: 0;
  min-width: 0;
  overflow-x: hidden;
  padding: 8px 10px 0;
  border-bottom: 1px solid #b8c2d2;
  background: #eef2f7;
}
.connection-ui .property-tab {
  flex: 1 1 58px;
  min-width: 0;
  border: 1px solid #aeb8c7;
  background: #dfe6ef;
  color: #172033;
  padding: 5px 8px;
  font: inherit;
  cursor: pointer;
  text-align: center;
}
.connection-ui .property-tab + .property-tab {
  margin-left: -1px;
}
.connection-ui .property-tab.active {
  background: #ffffff;
  font-weight: 700;
}
.connection-ui .property-tab-body {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  min-height: 220px;
  overflow-x: hidden;
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
  grid-template-columns: minmax(0, 1fr) minmax(74px, 92px) max-content;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.connection-ui .property-check {
  grid-template-columns: 16px minmax(0, 1fr) minmax(0, max-content);
}
.connection-ui .property-field.custom-choice {
  grid-template-columns: minmax(0, 1fr) minmax(68px, 76px) minmax(54px, 62px) max-content;
}
.connection-ui [data-parameter-path].focused {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.connection-ui .property-label {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #475569;
  line-height: 1.25;
}
.connection-ui input[type="text"],
.connection-ui select {
  width: 100%;
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
  min-width: 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
}
.connection-ui .property-value {
  grid-column: 2 / 4;
  min-width: 0;
  overflow: hidden;
  color: #172033;
  line-height: 1.25;
  text-overflow: ellipsis;
}
.connection-ui .diagnostic-list {
  display: grid;
  gap: 7px;
}
.connection-ui .diagnostic-item {
  display: grid;
  gap: 3px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  padding: 7px 8px;
}
.connection-ui .diagnostic-item[data-severity="error"] {
  border-color: #dc2626;
  background: #fff5f5;
}
.connection-ui .diagnostic-title {
  color: #172033;
  font-weight: 700;
}
.connection-ui .diagnostic-meta {
  color: #64748b;
  font-size: 11px;
  line-height: 1.3;
}
.connection-ui .connection-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow-x: hidden;
  padding: 10px 14px;
  border-top: 1px solid #cbd5e1;
  background: #f8fafc;
}
.connection-ui .connection-action {
  min-width: 0;
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
  flex: 1 1 120px;
  min-width: 0;
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
.connection-ui .stair-route-modules {
  display: grid;
  gap: 9px;
  min-width: 0;
}
.connection-ui .stair-route-card {
  display: grid;
  gap: 7px;
  min-width: 0;
  overflow-x: hidden;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  padding: 8px;
}
.connection-ui .stair-route-card.dragging {
  opacity: 0.55;
}
.connection-ui .stair-route-card.drop-before {
  border-top-color: #2563eb;
  box-shadow: inset 0 3px 0 #2563eb;
}
.connection-ui .stair-route-card.drop-after {
  border-bottom-color: #2563eb;
  box-shadow: inset 0 -3px 0 #2563eb;
}
.connection-ui .stair-route-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}
.connection-ui .stair-route-card-header {
  justify-content: space-between;
}
.connection-ui .stair-route-title {
  min-width: 0;
  overflow: hidden;
  color: #172033;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-ui .stair-route-card-controls,
.connection-ui .stair-route-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.connection-ui .stair-route-card-controls {
  justify-content: flex-end;
}
.connection-ui .stair-route-drag-handle {
  width: 26px;
  min-width: 26px;
  height: 24px;
  border: 1px solid #9fb0c3;
  background: #ffffff;
  color: #334155;
  padding: 0;
  cursor: grab;
  font: inherit;
  line-height: 1;
}
.connection-ui .stair-route-drag-handle:active {
  cursor: grabbing;
}
.connection-ui .stair-route-actions .connection-action {
  flex: 1 1 135px;
  white-space: normal;
  line-height: 1.2;
}
.connection-ui .connection-action.compact {
  padding: 3px 7px;
  font-size: 11px;
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

function textField({ spec, value, onChange }) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "property-field";
  input.type = "text";
  input.value = value ?? "";
  input.setAttribute("aria-label", spec.label);
  input.addEventListener("change", () => onChange(input.value));
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
  const content = value && typeof value === "object" && !Array.isArray(value)
    ? JSON.stringify(value)
    : Array.isArray(value) && value.some((item) => item && typeof item === "object")
      ? JSON.stringify(value)
      : Array.isArray(value)
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

function smartComponentHealth(instance) {
  return instance.health || "ok";
}

function firstError(instance) {
  return (instance.diagnostics || []).find((entry) => entry.severity === "error") || null;
}

function firstIssue(instance) {
  return (instance.diagnostics || []).find((entry) => entry.severity === "error" || entry.severity === "warning") || null;
}

function compactValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function diagnosticList(instance) {
  const list = document.createElement("div");
  list.className = "diagnostic-list";
  const diagnostics = instance.diagnostics || [];
  if (!diagnostics.length) {
    list.append(readout("Diagnostics", "No issues"));
    return list;
  }
  for (const diagnostic of diagnostics) {
    const item = document.createElement("div");
    const meta = [
      diagnostic.clause,
      diagnostic.ruleId || diagnostic.code,
      diagnostic.parameters?.length ? `params: ${diagnostic.parameters.join(", ")}` : "",
      diagnostic.objectRoles?.length ? `roles: ${diagnostic.objectRoles.join(", ")}` : "",
      diagnostic.measured !== undefined ? `measured: ${compactValue(diagnostic.measured)}` : "",
      diagnostic.allowed !== undefined ? `allowed: ${compactValue(diagnostic.allowed)}` : ""
    ].filter(Boolean).join(" | ");
    item.className = "diagnostic-item";
    item.dataset.severity = diagnostic.severity || "warning";
    item.append(
      text("div", "diagnostic-title", `${diagnostic.severity || "warning"}: ${diagnostic.message}`),
      text("div", "diagnostic-meta", meta || diagnostic.code)
    );
    list.append(item);
  }
  return list;
}

function formatNumber(value, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const rounded = Number(value.toFixed(digits));
  return String(rounded);
}

function measurementValue(value, unit) {
  if (value === undefined || value === null || value === "") return "-";
  return readoutValue(formatNumber(value), unit);
}

function stairComputedGeometryReadouts(instance) {
  const outputs = instance?.outputs || {};
  const measurements = { ...(outputs.computedGeometry || {}), ...(outputs.measurements || {}) };
  const stepHeight = measurements.rise ?? measurements.stepHeight;
  const stepCount = measurements.stepCount ?? measurements.calculatedStepCount;
  const targetStepCount = measurements.targetStepCount;
  const flightStepDistribution = measurements.flightStepDistribution || outputs.computedGeometry?.flightStepDistribution;
  const list = document.createElement("div");
  list.className = "diagnostic-list";
  list.append(
    readout("Calculated step height", measurementValue(stepHeight, "mm")),
    readout("Calculated step count", readoutValue(stepCount)),
    readout("Target step count", readoutValue(targetStepCount))
  );
  if (Array.isArray(flightStepDistribution) && flightStepDistribution.length) {
    list.append(readout("Flight step split", flightStepDistribution.join(" / ")));
  }
  return list;
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
  if (spec.kind === "text") {
    return parameterRow(textField({ spec, value, onChange: (next) => update(updatePath, next) }), path, uiState);
  }
  return parameterRow(field({ spec, value, onChange: (next) => update(updatePath, next) }), path, uiState);
}

const STAIR_FLIGHT_TYPES = [
  { value: "flight.straight", label: "Straight flight" },
  { value: "flight.winder", label: "Winder flight" },
  { value: "flight.curved", label: "Curved flight" },
  { value: "flight.spiral", label: "Spiral flight" },
  { value: "flight.helical", label: "Helical flight" }
];

const STAIR_LANDING_TYPES = [
  { value: "landing.straight", label: "Straight landing" },
  { value: "landing.l", label: "L landing" },
  { value: "landing.u", label: "U landing" }
];

function routeModuleKind(type) {
  return String(type || "").startsWith("landing.") ? "landing" : "flight";
}

function routeModuleTypeOptions(type) {
  return routeModuleKind(type) === "landing" ? STAIR_LANDING_TYPES : STAIR_FLIGHT_TYPES;
}

function defaultRouteModule(type = "flight.straight") {
  if (String(type).startsWith("landing.")) {
    const module = {
      type,
      entryExtensionLength: 0,
      exitExtensionLength: 0,
      turnDirection: "left",
      turnAcross: 1800
    };
    if (type === "landing.straight") module.length = 1200;
    return module;
  }
  return {
    type,
    radius: type === "flight.curved" || type === "flight.winder" ? 1800 : 1500,
    rotationDegrees: type === "flight.spiral" || type === "flight.helical" ? 360 : 180,
    turnDirection: type === "flight.curved" || type === "flight.winder" ? "left" : undefined
  };
}

function routeModuleRenderDefaults(type = "flight.straight") {
  if (String(type).startsWith("landing.")) return defaultRouteModule(type);
  const defaults = { type };
  if (type === "flight.curved" || type === "flight.winder") {
    defaults.radius = 1800;
    defaults.turnDirection = "left";
  }
  if (type === "flight.spiral" || type === "flight.helical") {
    defaults.radius = 1500;
    defaults.rotationDegrees = 360;
  }
  return defaults;
}

function normalizeRouteModules(value) {
  const source = Array.isArray(value) && value.length ? value : [{ type: "flight.straight" }];
  return source.map((module, index) => ({
    id: module?.id || `${routeModuleKind(module?.type)}_${index + 1}`,
    ...routeModuleRenderDefaults(module?.type || "flight.straight"),
    ...(module && typeof module === "object" ? module : {})
  }));
}

function routeModuleLabel(module, index) {
  const option = [...STAIR_FLIGHT_TYPES, ...STAIR_LANDING_TYPES].find((entry) => entry.value === module.type);
  return `${index + 1}. ${option?.label || module.type || "Module"}`;
}

function routeModuleSpec(kind, label, unit = "mm") {
  return { kind, label, unit };
}

function routeModulesField(row, path) {
  row.dataset.parameterPath = path;
  return row;
}

function compactRouteAction(label, onClick) {
  return button(label, "connection-action compact", onClick);
}

function routeDragHandle(index) {
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "stair-route-drag-handle";
  handle.textContent = "⋮⋮";
  handle.draggable = true;
  handle.dataset.routeDragIndex = String(index);
  handle.title = "Drag to reorder";
  handle.setAttribute("aria-label", "Drag segment to reorder");
  handle.addEventListener("click", (event) => event.preventDefault());
  return handle;
}

function reorderedModules(modules, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= modules.length || toIndex < 0 || toIndex > modules.length) return modules;
  const next = [...modules];
  const [moved] = next.splice(fromIndex, 1);
  const insertionIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  next.splice(insertionIndex, 0, moved);
  return next;
}

function renderStairRouteModules(parameters, path, update, uiState) {
  const modules = normalizeRouteModules(optionalPath(parameters, path, []));
  const root = document.createElement("div");
  root.className = "stair-route-modules";
  let draggedIndex = null;

  const clearDropState = () => {
    root.querySelectorAll(".stair-route-card.drop-before, .stair-route-card.drop-after").forEach((card) => {
      card.classList.remove("drop-before", "drop-after");
    });
  };

  const dropIndexForEvent = (event, index) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  };

  const commit = (nextModules) => {
    update(path, nextModules.map((module, index) => ({
      ...module,
      id: module.id || `${routeModuleKind(module.type)}_${index + 1}`
    })));
    uiState.renderBody();
  };

  modules.forEach((module, index) => {
    const card = document.createElement("div");
    card.className = "stair-route-card";
    card.dataset.routeIndex = String(index);
    card.addEventListener("dragover", (event) => {
      if (draggedIndex === null || draggedIndex === index) return;
      event.preventDefault();
      clearDropState();
      card.classList.add(dropIndexForEvent(event, index) === index ? "drop-before" : "drop-after");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drop-before", "drop-after");
    });
    card.addEventListener("drop", (event) => {
      if (draggedIndex === null) return;
      event.preventDefault();
      const targetIndex = dropIndexForEvent(event, index);
      clearDropState();
      commit(reorderedModules(modules, draggedIndex, targetIndex));
    });
    const header = document.createElement("div");
    header.className = "stair-route-card-header";
    const controls = document.createElement("div");
    controls.className = "stair-route-card-controls";
    const handle = routeDragHandle(index);
    handle.addEventListener("dragstart", (event) => {
      draggedIndex = index;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    handle.addEventListener("dragend", () => {
      draggedIndex = null;
      card.classList.remove("dragging");
      clearDropState();
    });
    controls.append(
      handle,
      compactRouteAction("Remove", () => commit(modules.filter((_, moduleIndex) => moduleIndex !== index)))
    );
    header.append(text("div", "stair-route-title", routeModuleLabel(module, index)), controls);
    card.append(header);

    card.append(selectField({
      spec: { label: "Module type", unit: "" },
      value: module.type,
      options: routeModuleTypeOptions(module.type),
      onChange: (nextType) => {
        const next = [...modules];
        next[index] = { ...defaultRouteModule(nextType), id: module.id, type: nextType };
        commit(next);
      }
    }));

    if (routeModuleKind(module.type) === "flight") {
      const stepOverride = Number.isInteger(module.stepCountOverride) && module.stepCountOverride > 0
        ? module.stepCountOverride
        : Number.isInteger(module.stepCount) && module.stepCount > 0
          ? module.stepCount
          : null;
      card.append(checkboxField({
        label: "Override steps",
        note: stepOverride ? `${stepOverride}` : "auto",
        checked: stepOverride !== null,
        onChange: (enabled) => {
          const next = [...modules];
          const nextModule = { ...module };
          delete nextModule.stepCount;
          if (enabled) nextModule.stepCountOverride = stepOverride || 1;
          else delete nextModule.stepCountOverride;
          next[index] = nextModule;
          commit(next);
        }
      }));
      if (stepOverride !== null) {
        card.append(field({
          spec: routeModuleSpec("positiveInteger", "Step override", ""),
          value: stepOverride,
          onChange: (stepCountOverride) => {
            const next = [...modules];
            const nextModule = { ...module, stepCountOverride };
            delete nextModule.stepCount;
            next[index] = nextModule;
            commit(next);
          }
        }));
      }
      if (["flight.winder", "flight.curved", "flight.spiral", "flight.helical"].includes(module.type)) {
        card.append(field({
          spec: routeModuleSpec("positiveNumber", "Radius"),
          value: module.radius ?? 1500,
          onChange: (radius) => {
            const next = [...modules];
            next[index] = { ...module, radius };
            commit(next);
          }
        }));
      }
      if (["flight.winder", "flight.curved"].includes(module.type)) {
        card.append(selectField({
          spec: { label: "Turn", unit: "" },
          value: module.turnDirection || "left",
          options: [{ value: "left", label: "left" }, { value: "right", label: "right" }],
          onChange: (turnDirection) => {
            const next = [...modules];
            next[index] = { ...module, turnDirection };
            commit(next);
          }
        }));
      }
      if (["flight.spiral", "flight.helical"].includes(module.type)) {
        card.append(field({
          spec: routeModuleSpec("positiveNumber", "Rotation", "deg"),
          value: module.rotationDegrees ?? 360,
          onChange: (rotationDegrees) => {
            const next = [...modules];
            next[index] = { ...module, rotationDegrees };
            commit(next);
          }
        }));
      }
    } else {
      if (module.type === "landing.straight") {
        card.append(field({
          spec: routeModuleSpec("positiveNumber", "Length"),
          value: module.length ?? 1200,
          onChange: (length) => {
            const next = [...modules];
            next[index] = { ...module, length };
            commit(next);
          }
        }));
      }
      if (["landing.l", "landing.u"].includes(module.type)) {
        card.append(selectField({
          spec: { label: "Turn", unit: "" },
          value: module.turnDirection || "left",
          options: [{ value: "left", label: "left" }, { value: "right", label: "right" }],
          onChange: (turnDirection) => {
            const next = [...modules];
            next[index] = { ...module, turnDirection };
            commit(next);
          }
        }));
        card.append(field({
          spec: routeModuleSpec("nonNegativeNumber", "Entry extension"),
          value: module.entryExtensionLength ?? 0,
          onChange: (entryExtensionLength) => {
            const next = [...modules];
            next[index] = { ...module, entryExtensionLength };
            commit(next);
          }
        }));
        card.append(field({
          spec: routeModuleSpec("nonNegativeNumber", "Exit extension"),
          value: module.exitExtensionLength ?? 0,
          onChange: (exitExtensionLength) => {
            const next = [...modules];
            next[index] = { ...module, exitExtensionLength };
            commit(next);
          }
        }));
      }
      if (module.type === "landing.u") {
        card.append(field({
          spec: routeModuleSpec("positiveNumber", "Switchback across"),
          value: module.turnAcross ?? 1800,
          onChange: (turnAcross) => {
            const next = [...modules];
            next[index] = { ...module, turnAcross };
            commit(next);
          }
        }));
      }
    }
    root.append(routeModulesField(card, path));
  });

  const actions = document.createElement("div");
  actions.className = "stair-route-actions";
  actions.append(
    button("Add straight flight", "connection-action", () => commit([...modules, defaultRouteModule("flight.straight")])),
    button("Add curved flight", "connection-action", () => commit([...modules, defaultRouteModule("flight.curved")])),
    button("Add straight landing", "connection-action", () => commit([...modules, defaultRouteModule("landing.straight")])),
    button("Add L landing", "connection-action", () => commit([...modules, defaultRouteModule("landing.l")])),
    button("Add U landing", "connection-action", () => commit([...modules, defaultRouteModule("landing.u")]))
  );
  root.append(actions);
  return root;
}

export function mountParameterSmartComponentUi({ panel, definition, smartComponentId, api, onProjectChange, onSmartComponentDeleted, onPanelFocus, focusPath = null, focusMode = "select", focusInput = true }) {
  ensureStyle();
  definition ||= api.definition(smartComponentId);
  const instance = api.smartComponent(smartComponentId);
  if (instance.status !== "generated") throw new Error(`${smartComponentId}: smart component is not generated`);

  let parameters = clone(instance.referenceParameters);
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
    const nextInstance = api.smartComponent(smartComponentId);
    const error = firstError(nextInstance);
    const health = smartComponentHealth(nextInstance);
    status.textContent = error ? "issues" : statusText(nextInstance.status);
    status.dataset.state = health;
    message.textContent = error ? error.message : okText;
    message.dataset.state = error ? "error" : "ok";
  };

  const apply = () => {
    try {
      onProjectChange(api.updateSmartComponent(smartComponentId, parameters));
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
      onProjectChange(api.setSmartComponentPlateIncluded(smartComponentId, plateId, included));
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
      onProjectChange(api.setSmartComponentRoleActive(smartComponentId, role, active));
      refreshStatus("Applied");
      renderBody();
      renderFooter();
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
      renderBody();
    }
  };

  const removeSmartComponent = () => {
    try {
      onProjectChange(api.deleteSmartComponent(smartComponentId));
      onSmartComponentDeleted?.(smartComponentId);
      panel.hidden = true;
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
    }
  };

  const resolveIssues = () => {
    try {
      const nextProject = api.resolveSmartComponentDiagnostics(smartComponentId);
      parameters = clone(api.smartComponent(smartComponentId).referenceParameters);
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
    if (item.kind === "stairRouteModules") return item.path === path;
    if (item.kind === "stairComputedGeometry") return path === "route.modules" || path.startsWith("levels.") || path === "geometry.maxStepHeight";
    return false;
  };

  const renderItem = (item) => {
    if (item?.visibleWhen && !conditionMatches(item.visibleWhen, parameters)) return [];
    if (typeof item === "string") return renderParameter(definition, parameters, item, update, api, uiState);
    if (item.kind === "parameter") return renderParameter(definition, parameters, item.path, update, api, uiState);
    if (item.kind === "stairRouteModules") return renderStairRouteModules(parameters, item.path || "route.modules", update, uiState);
    if (item.kind === "stairComputedGeometry") return stairComputedGeometryReadouts(api.smartComponent(smartComponentId));
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
    if (item.kind === "smartComponentPlates") {
      return api.smartComponentPlateOptions(smartComponentId).map((plate) => checkboxField({
        label: plate.label,
        note: plate.required ? "required" : plate.role,
        checked: plate.included,
        disabled: plate.required,
        onChange: (included) => updatePlateIncluded(plate.id, included)
      }));
    }
    if (item.kind === "smartComponentRoles") {
      const allowedRoles = new Set(Array.isArray(item.roles) ? item.roles : []);
      return api.smartComponentRoleOptions(smartComponentId)
        .filter((component) => !allowedRoles.size || allowedRoles.has(component.role))
        .map((component) => checkboxField({
          label: component.label,
          note: component.active ? "active" : "ghost",
          checked: component.active,
          onChange: (active) => updateComponentActive(component.role, active)
        }));
    }
    if (item.kind === "diagnostics") return diagnosticList(api.smartComponent(smartComponentId));
    if (item.kind === "smartComponentOverrides") {
      const instance = api.smartComponent(smartComponentId);
      const detached = new Set(instance.detachedObjectIds || []);
      const overrides = instance.fieldOverrides || {};
      const rows = [];
      const entries = Object.entries(instance.objectRoles || {}).flatMap(([role, value]) => flattenIds(value).map((objectId) => ({ role, objectId })));
      for (const { role, objectId } of entries) {
        const row = document.createElement("div");
        const hasOverride = Boolean(overrides[objectId]);
        row.className = "diagnostic-item";
        row.dataset.severity = detached.has(objectId) ? "warning" : "info";
        const controls = document.createElement("div");
        controls.className = "diagnostic-meta";
        if (hasOverride && api.resetSmartComponentObjectOverrides) {
          controls.append(button("Reset overrides", "connection-action", () => {
            onProjectChange(api.resetSmartComponentObjectOverrides(smartComponentId, objectId));
            refreshStatus("Overrides reset");
            renderBody();
            renderFooter();
          }));
        }
        if (!detached.has(objectId) && api.detachSmartComponentObject) {
          controls.append(button("Detach", "connection-action", () => {
            onProjectChange(api.detachSmartComponentObject(smartComponentId, objectId));
            refreshStatus("Detached");
            renderBody();
            renderFooter();
          }));
        }
        if (detached.has(objectId) && api.reattachSmartComponentObject) {
          controls.append(button("Reattach", "connection-action", () => {
            onProjectChange(api.reattachSmartComponentObject(smartComponentId, objectId));
            refreshStatus("Reattached");
            renderBody();
            renderFooter();
          }));
        }
        row.append(
          text("div", "diagnostic-title", `${role}: ${objectId}`),
          text("div", "diagnostic-meta", detached.has(objectId) ? "detached" : hasOverride ? "managed with overrides" : "managed"),
          controls
        );
        rows.push(row);
      }
      if (!rows.length) return readout("Overrides", "No managed objects");
      const list = document.createElement("div");
      list.className = "diagnostic-list";
      list.replaceChildren(...rows);
      return list;
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
    text("div", "connection-kicker", smartComponentId),
    text("h1", "connection-title", definition.title),
    status
  );

  const footer = document.createElement("footer");
  function renderFooter() {
    const issue = firstIssue(api.smartComponent(smartComponentId));
    const controls = [
      button("Modify", "connection-action primary", apply),
      button("Delete", "connection-action danger", removeSmartComponent)
    ];
    if (issue && api.resolveSmartComponentDiagnostics) controls.unshift(button("Resolve", "connection-action", resolveIssues));
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
