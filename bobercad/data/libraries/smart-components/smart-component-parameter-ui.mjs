import { jsonClone as clone } from "../../../app/engine/core/model.mjs?v=json-clone-dry-1";
import { optionalPath, setPath } from "../../../app/engine/modules/smart-components/smart-component-parameters-and-definition.mjs?v=smart-config-array-values-dry-1";
import { bindGeneratedPropertyField } from "../../../app/ui/viewer/panels/generated-property-bindings.mjs?v=generated-property-bindings-1";
import { generatedPropertyField } from "../../../app/ui/viewer/panels/generated-properties-panel.mjs?v=smart-component-generated-fields-1";
import { disclosureSection as sharedDisclosureSection } from "../../../app/ui/viewer/panels/panel-elements.mjs?v=panel-primitives-1";
import { conditionDependsOn, conditionMatches, parameterFieldDescriptor, parameterValue } from "./parameter-values.mjs?v=smart-component-generated-fields-1";

const STYLE_ID = "bobercad-connection-ui";

const STYLE = `
.connection-ui .connection-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--bc-space-1, 2px) var(--bc-space-6, 12px);
  padding: var(--bc-space-6, 12px) var(--bc-space-8, 16px) var(--bc-space-5, 10px);
  border-bottom: 1px solid var(--bc-color-border, #cbd5e1);
  background: var(--bc-color-surface-solid, #f8fafc);
}
.connection-ui .connection-kicker {
  grid-column: 1 / 2;
  color: var(--bc-color-text-subtle, #64748b);
  font-size: var(--bc-font-size-11, 11px);
}
.connection-ui .connection-title {
  min-width: 0;
  overflow: hidden;
  grid-column: 1 / 2;
  margin: 0;
  color: var(--bc-color-text, #111827);
  font-size: var(--bc-font-size-14, 14px);
  line-height: var(--bc-line-tight, 1.2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-ui .connection-status {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  align-self: start;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-hover, #e8eef5);
  color: var(--bc-color-text-muted, #334155);
  padding: var(--bc-space-1, 2px) var(--bc-space-3, 6px);
  font-size: var(--bc-font-size-11, 11px);
  text-transform: capitalize;
}
.connection-ui .connection-status[data-state="error"] {
  border-color: var(--bc-color-danger, #991b1b);
  background: color-mix(in srgb, var(--bc-color-danger, #991b1b) 12%, var(--bc-color-field, #ffffff));
  color: var(--bc-color-danger, #991b1b);
}
.connection-ui .bc-parameter-tab-body {
  display: grid;
  align-content: start;
  gap: var(--bc-space-4, 8px);
  min-width: 0;
  min-height: 220px;
  overflow-x: hidden;
  padding: var(--bc-space-6, 12px) var(--bc-space-8, 16px);
  background: var(--bc-color-field, #ffffff);
}
.connection-ui [data-parameter-path].focused {
  outline: 2px solid var(--bc-color-accent, #2563eb);
  outline-offset: 2px;
}
.connection-ui input[type="text"],
.connection-ui select {
  width: 100%;
  min-width: 0;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--bc-color-border-strong, #aeb9c9);
  border-radius: var(--bc-radius-1, 2px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-4, 8px);
  font: inherit;
}
.connection-ui input[type="text"]:focus,
.connection-ui select:focus {
  outline: 2px solid var(--bc-color-focus, #7aa7d9);
  outline-offset: 0;
  border-color: var(--bc-color-accent, #4d7fb6);
}
.connection-ui input[type="text"].invalid {
  border-color: var(--bc-color-danger, #b91c1c);
  background: color-mix(in srgb, var(--bc-color-danger, #b91c1c) 7%, var(--bc-color-field, #ffffff));
}
.connection-ui input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
}
.connection-ui input[type="checkbox"]:disabled {
  opacity: 0.65;
}
.connection-ui .connection-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--bc-space-5, 10px);
  min-width: 0;
  overflow-x: hidden;
  padding: var(--bc-space-5, 10px) var(--bc-space-8, 16px);
  border-top: 1px solid var(--bc-color-border, #cbd5e1);
  background: var(--bc-color-surface-solid, #f8fafc);
}
.connection-ui .connection-action {
  min-width: 0;
  min-height: 28px;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-5, 10px);
  font: var(--bc-font-weight-medium, 600) var(--bc-font-size-12, 12px) / 1 var(--bc-font-family, inherit);
  cursor: pointer;
}
.connection-ui .connection-action.primary {
  border-color: var(--bc-color-border-strong, #9fb0c3);
  background: var(--bc-color-hover, #e8eef5);
  color: var(--bc-color-accent-strong, #1d4ed8);
}
.connection-ui .connection-action.danger {
  border-color: color-mix(in srgb, var(--bc-color-danger, #b91c1c) 45%, transparent);
  color: var(--bc-color-danger, #991b1b);
}
.connection-ui .connection-message {
  flex: 1 1 120px;
  min-width: 0;
  min-height: 18px;
  color: var(--bc-color-text-muted, #475569);
  line-height: 1.35;
}
.connection-ui .connection-message[data-state="ok"] {
  color: var(--bc-color-success, #166534);
}
.connection-ui .connection-message[data-state="error"] {
  color: var(--bc-color-danger, #b91c1c);
}
.connection-ui .stair-route-modules {
  display: grid;
  gap: var(--bc-space-5, 10px);
  min-width: 0;
}
.connection-ui .stair-route-card {
  display: grid;
  gap: var(--bc-space-4, 8px);
  min-width: 0;
  overflow-x: hidden;
  border: 1px solid var(--bc-color-border, #cbd5e1);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-surface-solid, #f8fafc);
  padding: var(--bc-space-4, 8px);
}
.connection-ui .stair-route-card.dragging {
  opacity: 0.55;
}
.connection-ui .stair-route-card.drop-before {
  border-top-color: var(--bc-color-accent, #2563eb);
  box-shadow: inset 0 3px 0 var(--bc-color-accent, #2563eb);
}
.connection-ui .stair-route-card.drop-after {
  border-bottom-color: var(--bc-color-accent, #2563eb);
  box-shadow: inset 0 -3px 0 var(--bc-color-accent, #2563eb);
}
.connection-ui .stair-route-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--bc-space-3, 6px);
}
.connection-ui .stair-route-card-header {
  justify-content: space-between;
}
.connection-ui .stair-route-title {
  min-width: 0;
  overflow: hidden;
  color: var(--bc-color-text, #172033);
  font-weight: var(--bc-font-weight-bold, 700);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-ui .stair-route-card-controls,
.connection-ui .stair-route-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--bc-space-2, 4px);
  min-width: 0;
}
.connection-ui .stair-route-card-controls {
  justify-content: flex-end;
}
.connection-ui .stair-route-drag-handle {
  width: 26px;
  min-width: 26px;
  height: 24px;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text-muted, #334155);
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
  min-height: 24px;
  padding: 0 var(--bc-space-3, 6px);
  font-size: var(--bc-font-size-11, 11px);
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

function listValueText(value) {
  return Array.isArray(value) ? value.join(" | ") : "";
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

function catalogParameterOptions(api, spec, value) {
  if (spec.kind !== "catalogRef") return [];
  const entries = api.catalogEntries?.(spec.catalog) || {};
  const options = Object.keys(entries)
    .sort()
    .map((id) => ({ id, label: entries[id].designation || entries[id].name || id }));
  const currentId = String(value || "");
  if (currentId && !options.some((option) => option.id === currentId)) options.unshift({ id: currentId, label: currentId });
  return options;
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

function smartComponentDiagnosticListDescriptor(instance = {}) {
  return {
    type: "diagnosticList",
    label: "Diagnostics",
    emptyValue: "No issues",
    items: (instance.diagnostics || []).map((diagnostic) => {
      const severity = diagnostic.severity || "warning";
      const meta = [
        diagnostic.clause,
        diagnostic.ruleId || diagnostic.code,
        diagnostic.parameters?.length ? `params: ${diagnostic.parameters.join(", ")}` : "",
        diagnostic.objectRoles?.length ? `roles: ${diagnostic.objectRoles.join(", ")}` : "",
        diagnostic.measured !== undefined ? `measured: ${compactValue(diagnostic.measured)}` : "",
        diagnostic.allowed !== undefined ? `allowed: ${compactValue(diagnostic.allowed)}` : ""
      ].filter(Boolean).join(" | ");
      return {
        severity,
        title: `${severity}: ${diagnostic.message}`,
        meta: meta || diagnostic.code || ""
      };
    })
  };
}

function renderSmartComponentDiagnosticList(instance = {}) {
  return generatedPropertyField(smartComponentDiagnosticListDescriptor(instance));
}

function smartComponentManagedObjectListDescriptor(smartComponentId, instance = {}, api = {}) {
  const detached = new Set(instance.detachedObjectIds || []);
  const overrides = instance.fieldOverrides || {};
  const items = Object.entries(instance.objectRoles || {})
    .flatMap(([role, value]) => flattenIds(value).map((objectId) => {
      const hasOverride = Boolean(overrides[objectId]);
      const isDetached = detached.has(objectId);
      const actions = [];
      if (hasOverride && api.resetSmartComponentObjectOverrides) {
        actions.push({
          label: "Reset overrides",
          icon: "reset-view",
          action: "smartComponent.objectOverrides.reset",
          payload: { smartComponentId, objectId }
        });
      }
      if (!isDetached && api.detachSmartComponentObject) {
        actions.push({
          label: "Detach",
          icon: "unlink",
          action: "smartComponent.object.detach",
          payload: { smartComponentId, objectId }
        });
      }
      if (isDetached && api.reattachSmartComponentObject) {
        actions.push({
          label: "Reattach",
          icon: "link",
          primary: true,
          action: "smartComponent.object.reattach",
          payload: { smartComponentId, objectId }
        });
      }
      return {
        type: "objectRef",
        label: role,
        value: objectId,
        status: isDetached ? "detached" : hasOverride ? "managed with overrides" : "managed",
        actions
      };
    }));
  return {
    type: "objectRefList",
    label: "Overrides",
    emptyValue: "No managed objects",
    items
  };
}

function smartComponentFooterActionRowDescriptor(instance = {}, api = {}) {
  const actions = [];
  if (firstIssue(instance) && api.resolveSmartComponentDiagnostics) {
    actions.push({
      label: "Resolve",
      icon: "reset-view",
      action: "smartComponent.parameterPanel.resolveDiagnostics"
    });
  }
  actions.push(
    {
      label: "Modify",
      icon: "check",
      primary: true,
      action: "smartComponent.parameterPanel.apply"
    },
    {
      label: "Delete",
      icon: "cancel",
      danger: true,
      action: "smartComponent.parameterPanel.delete"
    }
  );
  return {
    type: "actionRow",
    label: "Smart Component actions",
    className: "connection-footer-actions",
    actions
  };
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

function stairComputedGeometryReadoutListDescriptor(instance) {
  const outputs = instance?.outputs || {};
  const measurements = { ...(outputs.computedGeometry || {}), ...(outputs.measurements || {}) };
  const stepHeight = measurements.rise ?? measurements.stepHeight;
  const stepCount = measurements.stepCount ?? measurements.calculatedStepCount;
  const targetStepCount = measurements.targetStepCount;
  const flightStepDistribution = measurements.flightStepDistribution || outputs.computedGeometry?.flightStepDistribution;
  const items = [
    { label: "Calculated step height", value: measurementValue(stepHeight, "mm") },
    { label: "Calculated step count", value: readoutValue(stepCount) },
    { label: "Target step count", value: readoutValue(targetStepCount) }
  ];
  if (Array.isArray(flightStepDistribution) && flightStepDistribution.length) {
    items.push({ label: "Flight step split", value: flightStepDistribution.join(" / ") });
  }
  return {
    type: "readoutList",
    label: "Computed geometry",
    items
  };
}

function renderStairComputedGeometryReadoutList(instance) {
  return generatedPropertyField(stairComputedGeometryReadoutListDescriptor(instance));
}

function smartComponentTabStripDescriptor(tabs = [], activeTab = "", panelId = "") {
  return {
    type: "tabList",
    id: "smart-component-parameter-tabs",
    label: "Smart Component parameter groups",
    ariaLabel: "Smart Component parameter groups",
    value: activeTab,
    panelId,
    className: "bc-panel-tab-strip",
    buttonClassName: "bc-panel-tab",
    options: tabs.map((tab) => ({
      id: tab.id,
      label: tab.label || tab.id
    })),
    commit: { action: "smartComponent.parameterPanel.tab.set" }
  };
}

function parameterRow(row, path, uiState) {
  row.dataset.parameterPath = path;
  if (uiState.focusPath === path) row.classList.add("focused");
  return row;
}

function bindParameterDescriptor(descriptor, definition, update, uiState) {
  return bindGeneratedPropertyField(descriptor, {
    commits: {
      "smartComponent.parameter.set": (next, commit = {}) => {
        const parameterPath = commit.parameterPath || descriptor.parameterPath || descriptor.path;
        const sourcePath = commit.sourcePath || parameterPath;
        const spec = definition.parameters?.[sourcePath];
        if (spec?.standardOptions) uiState.customNumberPaths.delete(sourcePath);
        update(parameterPath, next);
      }
    },
    actions: {
      "smartComponent.parameter.customNumber": (action = {}) => {
        const sourcePath = action.sourcePath || action.parameterPath || descriptor.parameterPath || descriptor.path;
        if (sourcePath) uiState.customNumberPaths.add(sourcePath);
        uiState.renderBody();
      }
    }
  });
}

function smartComponentPlateFieldDescriptor(smartComponentId, plate) {
  return {
    type: "checkbox",
    label: plate.label,
    value: plate.included,
    help: plate.required ? "required" : plate.role,
    disabled: Boolean(plate.required),
    disabledReason: plate.required ? "Required generated plate" : "",
    commit: {
      action: "smartComponent.plateIncluded.set",
      smartComponentId,
      plateId: plate.id
    }
  };
}

function smartComponentRoleFieldDescriptor(smartComponentId, component) {
  return {
    type: "checkbox",
    label: component.label,
    value: component.active,
    help: component.active ? "active" : "ghost",
    commit: {
      action: "smartComponent.roleActive.set",
      smartComponentId,
      role: component.role
    }
  };
}

function renderParameter(definition, parameters, path, update, api, uiState) {
  const spec = definition.parameters[path];
  const value = parameterValue(definition, parameters, path, api);
  const descriptor = parameterFieldDescriptor(definition, parameters, path, {
    api,
    focusPath: uiState.focusPath,
    customNumberPaths: uiState.customNumberPaths,
    catalogOptions: (entrySpec, entryValue) => catalogParameterOptions(api, entrySpec, entryValue),
    commit: { action: "smartComponent.parameter.set" },
    customAction: { action: "smartComponent.parameter.customNumber" }
  });
  if (descriptor) return parameterRow(generatedPropertyField(bindParameterDescriptor(descriptor, definition, update, uiState)), path, uiState);
  const readoutDescriptor = {
    label: spec.label,
    value: readoutValue(value, spec.unit),
    path
  };
  return parameterRow(generatedPropertyField(readoutDescriptor), path, uiState);
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

function routeModuleFieldLabel(spec = {}) {
  return spec.unit ? `${spec.label} (${spec.unit})` : spec.label;
}

function routeModuleNumberOptions(spec = {}) {
  const options = {};
  if (spec.kind === "positiveInteger") options.integer = true;
  if (spec.kind === "positiveInteger" || spec.kind === "positiveNumber") {
    options.min = 0;
    options.minExclusive = true;
  } else if (spec.kind === "nonNegativeNumber") {
    options.min = 0;
  }
  return options;
}

function routeModuleSelectOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option) => ({
      id: String(option?.id ?? option?.value ?? ""),
      label: String(option?.label ?? option?.id ?? option?.value ?? "")
    }))
    .filter((option) => option.id);
}

function routeModuleCommit(moduleIndex, mode = "patch", extras = {}) {
  return {
    action: "smartComponent.routeModule.set",
    moduleIndex,
    mode,
    ...extras
  };
}

function routeModuleFieldDescriptor({
  moduleIndex = 0,
  fieldType = "number",
  label = "",
  value = "",
  spec = null,
  options = [],
  patchKey = "",
  mode = "patch",
  help = "",
  removeKeys = [],
  stepOverride = null
} = {}) {
  const descriptor = {
    type: fieldType,
    label: spec ? routeModuleFieldLabel(spec) : label,
    value,
    commit: routeModuleCommit(moduleIndex, mode, { patchKey, removeKeys, stepOverride })
  };
  if (help) descriptor.help = help;
  if (fieldType === "number") descriptor.options = routeModuleNumberOptions(spec);
  if (fieldType === "select") descriptor.options = routeModuleSelectOptions(options);
  return descriptor;
}

function bindRouteModuleDescriptor(descriptor, modules, commitModules) {
  return bindGeneratedPropertyField(descriptor, {
    commits: {
      "smartComponent.routeModule.set": (value, commit = {}) => {
        const moduleIndex = Number(commit.moduleIndex);
        if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex >= modules.length) return;
        const module = modules[moduleIndex];
        const next = [...modules];
        if (commit.mode === "type") {
          next[moduleIndex] = { ...defaultRouteModule(value), id: module.id, type: value };
          commitModules(next);
          return;
        }
        const nextModule = { ...module };
        if (commit.mode === "stepOverrideEnabled") {
          delete nextModule.stepCount;
          if (value) nextModule.stepCountOverride = commit.stepOverride || 1;
          else delete nextModule.stepCountOverride;
          next[moduleIndex] = nextModule;
          commitModules(next);
          return;
        }
        if (!commit.patchKey) return;
        for (const key of Array.isArray(commit.removeKeys) ? commit.removeKeys : []) {
          if (key) delete nextModule[key];
        }
        nextModule[commit.patchKey] = value;
        next[moduleIndex] = nextModule;
        commitModules(next);
      }
    }
  });
}

function renderRouteModuleField(descriptor, modules, commitModules) {
  return generatedPropertyField(bindRouteModuleDescriptor(descriptor, modules, commitModules));
}

function routeModuleActionRowDescriptor({ label = "Route actions", className = "", actions = [] } = {}) {
  return {
    type: "actionRow",
    label,
    className,
    actions
  };
}

function routeModuleRemoveAction(moduleIndex) {
  return {
    label: "Remove",
    icon: "cancel",
    danger: true,
    title: "Remove route module",
    action: "smartComponent.routeModule.remove",
    payload: { moduleIndex }
  };
}

function routeModuleAddAction(moduleType, label) {
  return {
    label,
    icon: "add",
    action: "smartComponent.routeModule.add",
    payload: { moduleType }
  };
}

function bindRouteModuleActionRowDescriptor(descriptor, modules, commitModules) {
  return bindGeneratedPropertyField(descriptor, {
    actions: {
      "smartComponent.routeModule.remove": (field) => {
        const moduleIndex = Number(field.payload?.moduleIndex);
        if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex >= modules.length) return;
        commitModules(modules.filter((_, index) => index !== moduleIndex));
      },
      "smartComponent.routeModule.add": (field) => {
        const moduleType = field.payload?.moduleType || "flight.straight";
        commitModules([...modules, defaultRouteModule(moduleType)]);
      }
    }
  });
}

function renderRouteModuleActionRow(descriptor, modules, commitModules) {
  return generatedPropertyField(bindRouteModuleActionRowDescriptor(descriptor, modules, commitModules));
}

function routeModulesField(row, path) {
  row.dataset.parameterPath = path;
  return row;
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
      renderRouteModuleActionRow(routeModuleActionRowDescriptor({
        label: "Module actions",
        className: "stair-route-card-actions",
        actions: [routeModuleRemoveAction(index)]
      }), modules, commit)
    );
    header.append(text("div", "stair-route-title", routeModuleLabel(module, index)), controls);
    card.append(header);

    card.append(renderRouteModuleField(routeModuleFieldDescriptor({
      moduleIndex: index,
      fieldType: "select",
      label: "Module type",
      value: module.type,
      options: routeModuleTypeOptions(module.type),
      mode: "type"
    }), modules, commit));

    if (routeModuleKind(module.type) === "flight") {
      const stepOverride = Number.isInteger(module.stepCountOverride) && module.stepCountOverride > 0
        ? module.stepCountOverride
        : Number.isInteger(module.stepCount) && module.stepCount > 0
          ? module.stepCount
          : null;
      card.append(renderRouteModuleField(routeModuleFieldDescriptor({
        moduleIndex: index,
        fieldType: "checkbox",
        label: "Override steps",
        value: stepOverride !== null,
        help: stepOverride ? `${stepOverride}` : "auto",
        mode: "stepOverrideEnabled",
        stepOverride
      }), modules, commit));
      if (stepOverride !== null) {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "stepCountOverride",
          spec: routeModuleSpec("positiveInteger", "Step override", ""),
          value: stepOverride,
          removeKeys: ["stepCount"]
        }), modules, commit));
      }
      if (["flight.winder", "flight.curved", "flight.spiral", "flight.helical"].includes(module.type)) {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "radius",
          spec: routeModuleSpec("positiveNumber", "Radius"),
          value: module.radius ?? 1500
        }), modules, commit));
      }
      if (["flight.winder", "flight.curved"].includes(module.type)) {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          fieldType: "select",
          label: "Turn",
          patchKey: "turnDirection",
          value: module.turnDirection || "left",
          options: [{ value: "left", label: "left" }, { value: "right", label: "right" }],
        }), modules, commit));
      }
      if (["flight.spiral", "flight.helical"].includes(module.type)) {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "rotationDegrees",
          spec: routeModuleSpec("positiveNumber", "Rotation", "deg"),
          value: module.rotationDegrees ?? 360
        }), modules, commit));
      }
    } else {
      if (module.type === "landing.straight") {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "length",
          spec: routeModuleSpec("positiveNumber", "Length"),
          value: module.length ?? 1200
        }), modules, commit));
      }
      if (["landing.l", "landing.u"].includes(module.type)) {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          fieldType: "select",
          label: "Turn",
          patchKey: "turnDirection",
          value: module.turnDirection || "left",
          options: [{ value: "left", label: "left" }, { value: "right", label: "right" }],
        }), modules, commit));
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "entryExtensionLength",
          spec: routeModuleSpec("nonNegativeNumber", "Entry extension"),
          value: module.entryExtensionLength ?? 0
        }), modules, commit));
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "exitExtensionLength",
          spec: routeModuleSpec("nonNegativeNumber", "Exit extension"),
          value: module.exitExtensionLength ?? 0
        }), modules, commit));
      }
      if (module.type === "landing.u") {
        card.append(renderRouteModuleField(routeModuleFieldDescriptor({
          moduleIndex: index,
          patchKey: "turnAcross",
          spec: routeModuleSpec("positiveNumber", "Switchback across"),
          value: module.turnAcross ?? 1800
        }), modules, commit));
      }
    }
    root.append(routeModulesField(card, path));
  });

  const actions = document.createElement("div");
  actions.className = "stair-route-actions";
  actions.append(renderRouteModuleActionRow(routeModuleActionRowDescriptor({
    label: "Add route module",
    className: "stair-route-add-actions",
    actions: [
      routeModuleAddAction("flight.straight", "Straight flight"),
      routeModuleAddAction("flight.curved", "Curved flight"),
      routeModuleAddAction("landing.straight", "Straight landing"),
      routeModuleAddAction("landing.l", "L landing"),
      routeModuleAddAction("landing.u", "U landing")
    ]
  }), modules, commit));
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
  const tabPanelId = `smart-component-parameters-${String(smartComponentId).replace(/[^A-Za-z0-9_-]+/g, "-") || "panel"}`;
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
    for (const row of body.querySelectorAll(".bc-readout[data-path]")) {
      const path = row.dataset.path;
      const spec = definition.parameters[path];
      const target = row.querySelector(".bc-readout-value");
      if (target) target.textContent = readoutValue(parameterValue(definition, parameters, path, api), spec.unit);
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

  const commitSmartComponentObjectAction = (methodName, okText, payload = {}) => {
    try {
      onProjectChange(api[methodName](payload.smartComponentId || smartComponentId, payload.objectId));
      refreshStatus(okText);
      renderBody();
      renderFooter();
    } catch (error) {
      message.textContent = error.message;
      message.dataset.state = "error";
      renderBody();
    }
  };

  const bindSmartComponentToggleDescriptor = (descriptor) => bindGeneratedPropertyField(descriptor, {
    commits: {
      "smartComponent.plateIncluded.set": (included, commit = {}) => updatePlateIncluded(commit.plateId, included),
      "smartComponent.roleActive.set": (active, commit = {}) => updateComponentActive(commit.role, active)
    }
  });

  const renderSmartComponentToggle = (descriptor) => generatedPropertyField(bindSmartComponentToggleDescriptor(descriptor));
  const bindSmartComponentManagedObjectListDescriptor = (descriptor) => bindGeneratedPropertyField(descriptor, {
    actions: {
      "smartComponent.objectOverrides.reset": (field) => commitSmartComponentObjectAction("resetSmartComponentObjectOverrides", "Overrides reset", field.payload),
      "smartComponent.object.detach": (field) => commitSmartComponentObjectAction("detachSmartComponentObject", "Detached", field.payload),
      "smartComponent.object.reattach": (field) => commitSmartComponentObjectAction("reattachSmartComponentObject", "Reattached", field.payload)
    }
  });
  const renderSmartComponentManagedObjectList = (instance) => generatedPropertyField(
    bindSmartComponentManagedObjectListDescriptor(smartComponentManagedObjectListDescriptor(smartComponentId, instance, api))
  );
  const bindSmartComponentFooterActionRowDescriptor = (descriptor) => bindGeneratedPropertyField(descriptor, {
    actions: {
      "smartComponent.parameterPanel.apply": () => apply(),
      "smartComponent.parameterPanel.delete": () => removeSmartComponent(),
      "smartComponent.parameterPanel.resolveDiagnostics": () => resolveIssues()
    }
  });
  const renderSmartComponentFooterActionRow = () => generatedPropertyField(
    bindSmartComponentFooterActionRowDescriptor(smartComponentFooterActionRowDescriptor(api.smartComponent(smartComponentId), api))
  );
  const bindSmartComponentTabStripDescriptor = (descriptor) => bindGeneratedPropertyField(descriptor, {
    commits: {
      "smartComponent.parameterPanel.tab.set": (nextTabId) => {
        if (!definition.ui.tabs.some((tab) => tab.id === nextTabId)) return;
        activeTab = nextTabId;
        renderTabs();
        renderBody();
      }
    }
  });
  const renderSmartComponentTabStrip = () => generatedPropertyField(
    bindSmartComponentTabStripDescriptor(smartComponentTabStripDescriptor(definition.ui.tabs, activeTab, tabPanelId))
  );

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
    tabs.replaceChildren(renderSmartComponentTabStrip());
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
    if (item.kind === "stairComputedGeometry") return renderStairComputedGeometryReadoutList(api.smartComponent(smartComponentId));
    if (item.kind === "section") {
      const sectionKey = item.id || item.label;
      const section = sharedDisclosureSection(item.label, (item.items || []).flatMap(renderItem), {
        open: uiState.sectionOpen.get(sectionKey) ?? Boolean(item.open),
        className: "bc-disclosure-nested",
        bodyClassName: "bc-parameter-section-body"
      });
      section.addEventListener("toggle", () => uiState.sectionOpen.set(sectionKey, section.open));
      return section;
    }
    if (item.kind === "smartComponentPlates") {
      return api.smartComponentPlateOptions(smartComponentId)
        .map((plate) => renderSmartComponentToggle(smartComponentPlateFieldDescriptor(smartComponentId, plate)));
    }
    if (item.kind === "smartComponentRoles") {
      const allowedRoles = new Set(Array.isArray(item.roles) ? item.roles : []);
      return api.smartComponentRoleOptions(smartComponentId)
        .filter((component) => !allowedRoles.size || allowedRoles.has(component.role))
        .map((component) => renderSmartComponentToggle(smartComponentRoleFieldDescriptor(smartComponentId, component)));
    }
    if (item.kind === "diagnostics") return renderSmartComponentDiagnosticList(api.smartComponent(smartComponentId));
    if (item.kind === "smartComponentOverrides") {
      return renderSmartComponentManagedObjectList(api.smartComponent(smartComponentId));
    }
    throw new Error(`${definition.type}: unsupported ui item ${item.kind}`);
  };

  function renderBody() {
    const tab = definition.ui.tabs.find((entry) => entry.id === activeTab);
    body.className = "bc-parameter-tab-body bc-properties-body";
    body.id = tabPanelId;
    body.setAttribute("role", "tabpanel");
    body.setAttribute("aria-label", tab?.label || "Parameters");
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
    footer.className = "connection-footer";
    footer.replaceChildren(renderSmartComponentFooterActionRow(), message);
  }

  renderTabs();
  renderBody();
  renderFooter();
  refreshStatus();
  panel.classList.add("connection-ui", "bc-inspector");
  panel.hidden = false;
  panel.replaceChildren(header, tabs, body, footer);
}
