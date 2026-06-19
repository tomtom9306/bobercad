import { jsonClone as clone } from "../../../app/engine/core/model.mjs?v=json-clone-dry-1";
import { optionalPath, requiredPath } from "../../../app/engine/modules/smart-components/smart-component-parameters-and-definition.mjs?v=smart-config-array-values-dry-1";

export const QUICK_PARAMETER_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "numberList", "boolean", "catalogRef", "enum", "text"]);
export const GENERATED_PARAMETER_FIELD_KINDS = new Set([...QUICK_PARAMETER_KINDS]);

function fastenerHoleDiameter(api, parameters, derive = {}) {
  const fastenerRef = optionalPath(parameters, derive.fastenerRef || "bolts.fastenerRef");
  const tolerance = optionalPath(parameters, derive.tolerance || "holes.tolerance", "normal");
  const customDiameter = optionalPath(parameters, derive.customDiameter || "holes.customDiameter");
  const fallbackDiameter = optionalPath(parameters, derive.fallbackDiameter || "holes.diameter");
  const fastener = fastenerRef ? api.catalogEntries?.("fasteners")?.[fastenerRef] : null;
  const shankDiameter = fastener?.shank?.diameter;
  const normal = fastener?.hole?.defaultDiameter ?? (typeof shankDiameter === "number" ? shankDiameter + 2 : fallbackDiameter);
  if (tolerance === "custom") return customDiameter ?? fallbackDiameter ?? normal;
  const catalogDiameter = fastener?.hole?.tolerances?.[tolerance];
  if (typeof catalogDiameter === "number") return catalogDiameter;
  if (typeof normal !== "number") return fallbackDiameter ?? normal;
  if (tolerance === "tight") return Math.max(shankDiameter ?? normal, normal - 1);
  if (tolerance === "loose") return normal + Math.max(2, normal - (shankDiameter ?? normal));
  return normal;
}

export function normalizedSpacingList(parameters, derive = {}, existing = []) {
  const count = Math.max(0, Number(optionalPath(parameters, derive.countPath || "")) - 1 || 0);
  const defaultValue = Number(optionalPath(parameters, derive.defaultPath || "", derive.defaultValue || 0)) || 0;
  const source = Array.isArray(existing) ? existing : [];
  return Array.from({ length: count }, (_, index) => {
    const value = source[index];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : defaultValue;
  });
}

function spacingSpan(parameters, modePath, countPath, equalPath, customPath) {
  const count = Math.max(0, Number(optionalPath(parameters, countPath)) - 1 || 0);
  if (optionalPath(parameters, modePath, "equal") === "custom") {
    return normalizedSpacingList(parameters, {
      countPath,
      defaultPath: equalPath
    }, optionalPath(parameters, customPath, [])).reduce((sum, value) => sum + value, 0);
  }
  return count * (Number(optionalPath(parameters, equalPath, 0)) || 0);
}

function boltEdgeDistance(parameters, derive = {}) {
  const size = Number(optionalPath(parameters, derive.sizePath, 0)) || 0;
  const span = spacingSpan(parameters, derive.spacingModePath, derive.countPath, derive.equalSpacingPath, derive.customSpacingPath);
  return Math.max(0, (size - span) / 2);
}

export function parameterValue(definition, parameters, path, api) {
  const spec = definition.parameters[path];
  if (spec.derive?.kind === "fastenerHoleDiameter") return fastenerHoleDiameter(api, parameters, spec.derive);
  if (spec.derive?.kind === "spacingList") return normalizedSpacingList(parameters, spec.derive, optionalPath(parameters, path, spec.default || []));
  if (spec.derive?.kind === "boltEdgeDistance") return optionalPath(parameters, path) ?? boltEdgeDistance(parameters, spec.derive);
  if (spec.derive?.kind === "sameAsParameter") return optionalPath(parameters, path) ?? optionalPath(parameters, spec.derive.sourcePath, spec.default ?? 0);
  const value = optionalPath(parameters, path);
  if (value !== undefined) return value;
  if (spec.default !== undefined) return clone(spec.default);
  return spec.required === false
    ? 0
    : requiredPath(parameters, path, definition.type);
}

export function uiParameterEntries(definition, parameters = {}) {
  const entries = [];
  const seen = new Set();
  const addParameter = (path, item = null) => {
    if (!path || seen.has(path)) return;
    const spec = definition?.parameters?.[path];
    if (!spec) return;
    seen.add(path);
    entries.push({ path, spec, item });
  };
  const walkItems = (items = []) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item === "string") {
        addParameter(item);
        continue;
      }
      if (!item || typeof item !== "object") continue;
      if (item.visibleWhen && !conditionMatches(item.visibleWhen, parameters)) continue;
      if (item.kind === "parameter") addParameter(item.path, item);
      else if (item.kind === "section") walkItems(item.items);
    }
  };
  for (const tab of Array.isArray(definition?.ui?.tabs) ? definition.ui.tabs : []) {
    walkItems(tab.items);
  }
  return entries;
}

export function uiQuickParameterEntries(definition, parameters = {}, { limit = 6, kinds = QUICK_PARAMETER_KINDS } = {}) {
  const quickKinds = kinds instanceof Set ? kinds : new Set(kinds || []);
  const entries = uiParameterEntries(definition, parameters)
    .filter(({ spec }) => isQuickParameterSpec(spec, parameters, quickKinds));
  return Number.isFinite(limit) && limit >= 0 ? entries.slice(0, limit) : entries;
}

export function parameterFieldDescriptor(definition, parameters = {}, path, {
  api = null,
  catalogOptions = null,
  labelFor = defaultParameterLabel,
  onChange = null,
  commit = null,
  focusPath = null,
  customNumberPaths = null,
  onCustom = null,
  customAction = null,
  skipStandardOptions = false,
  kinds = GENERATED_PARAMETER_FIELD_KINDS
} = {}) {
  const spec = definition?.parameters?.[path];
  if (!spec || !(kinds instanceof Set ? kinds.has(spec.kind) : new Set(kinds || []).has(spec.kind))) return null;
  if (skipStandardOptions && spec.standardOptions) return null;
  const value = parameterValue(definition, parameters, path, api);
  const label = parameterFieldLabel(path, spec, labelFor);
  const baseLabel = parameterBaseLabel(path, spec, labelFor);
  const editable = isEditableParameterSpec(spec, parameters, kinds);
  const updatePath = spec.writePath || path;
  const changeHandler = typeof onChange === "function"
    ? (next) => onChange(updatePath, next, { path, spec })
    : null;
  const commitDescriptor = parameterCommitDescriptor(commit, updatePath, path, spec);
  const commitTarget = changeHandler || commitDescriptor;
  const editableBinding = changeHandler
    ? { onChange: changeHandler }
    : commitDescriptor
      ? { commit: commitDescriptor }
      : {};
  const base = {
    label,
    parameterPath: path,
    path,
    focused: focusPath === path,
    help: parameterHelpText(spec),
    readOnly: !editable || !commitTarget
  };
  if (!editable || !commitTarget) {
    return {
      ...base,
      value: parameterReadoutValue(value, spec, { api, catalogOptions, labelFor })
    };
  }
  if (spec.kind === "numberList") {
    return {
      ...base,
      label: baseLabel,
      type: "numberList",
      value: Array.isArray(value) ? value : [],
      unit: spec.unit || "",
      ...editableBinding,
      options: {
        itemMinimum: spec.itemMinimum,
        itemExclusiveMinimum: spec.itemExclusiveMinimum,
        placeholder: spec.placeholder
      }
    };
  }
  if (["number", "positiveNumber", "nonNegativeNumber", "positiveInteger"].includes(spec.kind)) {
    const numberOptions = numericParameterOptions(spec);
    const numberValue = finiteNumber(value) ? value : finiteNumber(spec.default) ? spec.default : 0;
    const standardOptions = skipStandardOptions ? [] : standardNumberOptions(parameters, spec, api);
    if (standardOptions.length) {
      const standardValue = standardOptions.some((option) => option.id === String(numberValue));
      const forcedCustom = Boolean(customNumberPaths?.has?.(path));
      return {
        ...base,
        label: baseLabel,
        type: "numberChoice",
        value: numberValue,
        unit: spec.unit || "",
        options: standardOptions,
        numberOptions,
        custom: forcedCustom || !standardValue,
        ...parameterCustomNumberBinding({ customAction, onCustom, path, spec }),
        ...editableBinding
      };
    }
    return {
      ...base,
      type: "number",
      value: numberValue,
      ...editableBinding,
      options: numberOptions
    };
  }
  if (spec.kind === "boolean") {
    return {
      ...base,
      type: "checkbox",
      value: Boolean(value),
      ...editableBinding
    };
  }
  if (spec.kind === "text") {
    return {
      ...base,
      type: "text",
      value: value || "",
      ...editableBinding
    };
  }
  if (spec.kind === "catalogRef" || spec.kind === "enum") {
    const options = parameterSelectOptions(spec, value, { api, catalogOptions, labelFor });
    return options.length
      ? {
        ...base,
        type: "select",
        options,
        value: String(value || ""),
        ...editableBinding
      }
      : {
        ...base,
        value: parameterReadoutValue(value, spec, { api, catalogOptions, labelFor })
      };
  }
  return null;
}

function parameterCommitDescriptor(commit, updatePath, path, spec = {}) {
  if (typeof commit === "function") return commit(updatePath, { path, spec });
  if (!commit || typeof commit !== "object" || Array.isArray(commit)) return null;
  return {
    ...commit,
    parameterPath: commit.parameterPath || updatePath,
    sourcePath: commit.sourcePath || path,
    parameterKind: commit.parameterKind || spec.kind || ""
  };
}

function parameterCustomNumberBinding({ customAction = null, onCustom = null, path = "", spec = {} } = {}) {
  if (typeof onCustom === "function") return { onCustom: () => onCustom(path, { path, spec }) };
  if (!customAction || typeof customAction !== "object" || Array.isArray(customAction)) return {};
  return {
    customAction: {
      ...customAction,
      parameterPath: customAction.parameterPath || path,
      sourcePath: customAction.sourcePath || path,
      parameterKind: customAction.parameterKind || spec.kind || ""
    }
  };
}

export function isEditableParameterSpec(spec, parameters = {}, kinds = GENERATED_PARAMETER_FIELD_KINDS) {
  const allowedKinds = kinds instanceof Set ? kinds : new Set(kinds || []);
  if (!spec || !allowedKinds.has(spec.kind)) return false;
  return !spec.readOnly || (spec.editableWhen && conditionMatches(spec.editableWhen, parameters));
}

export function parameterFieldLabel(path, spec = {}, labelFor = defaultParameterLabel) {
  const label = parameterBaseLabel(path, spec, labelFor);
  return spec.unit ? `${label} (${spec.unit})` : label;
}

function parameterBaseLabel(path, spec = {}, labelFor = defaultParameterLabel) {
  return spec.label || labelFor(path);
}

function parameterHelpText(spec = {}) {
  for (const value of [spec.help, spec.description]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function parameterSelectOptions(spec = {}, value = "", { api = null, catalogOptions = null, labelFor = defaultParameterLabel } = {}) {
  if (spec.kind === "catalogRef") {
    if (typeof catalogOptions === "function") return normalizeSelectOptions(catalogOptions(spec, value));
    const entries = spec.catalog ? api?.catalogEntries?.(spec.catalog) || {} : {};
    const options = Object.values(entries)
      .filter((entry) => entry?.id)
      .map((entry) => ({ id: entry.id, label: entry.designation || entry.name || entry.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const currentId = String(value || "");
    if (currentId && !options.some((option) => option.id === currentId)) options.unshift({ id: currentId, label: currentId });
    return options;
  }
  if (spec.kind === "enum") return normalizeSelectOptions((Array.isArray(spec.values) ? spec.values : []).map((item) => (
    typeof item === "string"
      ? { id: item, label: labelFor(item) }
      : { id: item?.id || item?.value || "", label: item?.label || labelFor(item?.id || item?.value || "") }
  )));
  return [];
}

export function parameterReadoutValue(value, spec = {}, { api = null, catalogOptions = null, labelFor = defaultParameterLabel } = {}) {
  if (Array.isArray(value)) return value.length ? value.map((item) => finiteNumber(item) ? formatParameterNumber(item) : String(item)).join(" / ") : "-";
  if (spec.kind === "boolean") return value ? "Yes" : "No";
  if (spec.kind === "catalogRef" || spec.kind === "enum") {
    const option = parameterSelectOptions(spec, value, { api, catalogOptions, labelFor }).find((entry) => entry.id === String(value || ""));
    return option?.label || value || "-";
  }
  if (finiteNumber(value)) return formatParameterNumber(value);
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function isQuickParameterSpec(spec, parameters, quickKinds) {
  if (!spec || !quickKinds.has(spec.kind)) return false;
  if (spec.readOnly && !spec.derive && (!spec.editableWhen || !conditionMatches(spec.editableWhen, parameters))) return false;
  return true;
}

function numericParameterOptions(spec = {}) {
  const options = {};
  if (spec.kind === "positiveNumber" || spec.kind === "positiveInteger") {
    options.min = 0;
    options.minExclusive = true;
  } else if (spec.kind === "nonNegativeNumber") {
    options.min = 0;
  }
  if (finiteNumber(spec.min)) options.min = spec.min;
  if (finiteNumber(spec.minimum)) options.min = spec.minimum;
  if (finiteNumber(spec.minExclusive)) {
    options.min = spec.minExclusive;
    options.minExclusive = true;
  }
  if (spec.minExclusive === true) options.minExclusive = true;
  if (spec.exclusiveMinimum === true) options.minExclusive = true;
  if (finiteNumber(spec.max)) options.max = spec.max;
  if (finiteNumber(spec.maximum)) options.max = spec.maximum;
  if (finiteNumber(spec.maxExclusive)) {
    options.max = spec.maxExclusive;
    options.maxExclusive = true;
  }
  if (spec.maxExclusive === true) options.maxExclusive = true;
  if (spec.exclusiveMaximum === true) options.maxExclusive = true;
  if (finiteNumber(spec.step) && spec.step > 0) options.step = spec.step;
  if (spec.kind === "positiveInteger") options.integer = true;
  return options;
}

function standardNumberOptions(parameters = {}, spec = {}, api = null) {
  if (spec.standardOptions?.kind !== "fastenerLengths") return [];
  const fastenerRef = optionalPath(parameters, spec.standardOptions.fastenerRef || "bolts.fastenerRef");
  const fastener = fastenerRef ? api?.catalogEntries?.("fasteners")?.[fastenerRef] : null;
  return (fastener?.lengths || [])
    .filter((value) => finiteNumber(value) && value > 0)
    .sort((a, b) => a - b)
    .map((value) => ({ id: String(value), label: String(value), value }));
}

function normalizeSelectOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option) => ({
      id: option?.id ?? option?.value ?? "",
      label: option?.label ?? option?.id ?? option?.value ?? ""
    }))
    .filter((option) => option.id);
}

function defaultParameterLabel(path = "") {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .pop()
    ?.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Parameter";
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatParameterNumber(value) {
  const rounded = Number(value.toFixed(3));
  return String(rounded);
}

export function conditionMatches(condition, parameters) {
  if (!condition) return true;
  if (Array.isArray(condition.all)) return condition.all.every((entry) => conditionMatches(entry, parameters));
  const value = optionalPath(parameters, condition.path);
  if (Object.hasOwn(condition, "equals")) return value === condition.equals;
  if (Object.hasOwn(condition, "notEquals")) return value !== condition.notEquals;
  if (Object.hasOwn(condition, "greaterThan")) return Number(value) > condition.greaterThan;
  if (Array.isArray(condition.in)) return condition.in.includes(value);
  return true;
}

export function conditionDependsOn(condition, path) {
  if (!condition) return false;
  if (Array.isArray(condition.all)) return condition.all.some((entry) => conditionDependsOn(entry, path));
  return condition.path === path;
}
