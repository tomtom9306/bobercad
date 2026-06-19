import { jsonClone } from "../../core/model.mjs";
import { finiteNonNegativeNumber, finiteNumber, finitePositiveInteger, finitePositiveNumber } from "../../core/math.mjs";

const PARAMETER_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "numberList", "object", "boolean", "catalogRef", "enum", "text"]);
const UI_ONLY_ITEM_KINDS = new Set(["diagnostics", "smartComponentOverrides", "smartComponentPlates", "stairComputedGeometry"]);
const COMPONENT_KEYS = new Set(["role", "label", "kind", "default", "objectRoles"]);
const COMPONENT_DEFAULTS = new Set(["ghost"]);
const AUTO_INTERFACE_KEYS = new Set(["type", "faceRef", "memberEnd", "stationReference"]);
const AUTO_INTERFACE_TYPES = new Set(["member-end-face", "member-web", "planar-face"]);

function fail(scope, message) {
  throw new Error(`${scope}: ${message}`);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pathKeys(path) {
  if (!nonEmptyString(path) || !path.includes(".")) fail("smart component path", `invalid parameter path ${path}`);
  const keys = path.split(".");
  if (keys.some((key) => !nonEmptyString(key))) fail("smart component path", `invalid parameter path ${path}`);
  return keys;
}

function optionalArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("smart component definition", `${label} must be an array`);
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail("smart component definition", `${label} must be an array`);
  return value;
}

function requiredObject(value, scope, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(scope, `${label} must be an object`);
  return value;
}

function validateKnownKeys(definition, value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(definition.type, `${label}.${key} is not supported`);
  }
}

function optionalString(value, scope, label) {
  if (value === undefined) return undefined;
  if (!nonEmptyString(value)) fail(scope, `${label} must be a non-empty string`);
  return value;
}

function optionalStringArray(value, label) {
  const values = optionalArray(value, label);
  for (const item of values) {
    if (!nonEmptyString(item)) fail("smart component definition", `${label} must contain only non-empty strings`);
  }
  return values;
}

function uiItemPath(item, label) {
  if (!nonEmptyString(item.path)) fail("smart component definition", `${label}.path must be a non-empty string`);
  return item.path;
}

export function requiredPath(source, path, scope = "smart component parameters") {
  let cursor = source;
  for (const key of pathKeys(path)) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) fail(scope, `missing ${path}`);
    cursor = cursor[key];
  }
  if (cursor === null || cursor === undefined) fail(scope, `missing ${path}`);
  return cursor;
}

export function optionalPath(source, path, fallback = undefined) {
  let cursor = source;
  for (const key of pathKeys(path)) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) return fallback;
    cursor = cursor[key];
  }
  return cursor === null || cursor === undefined ? fallback : cursor;
}

export function setPath(source, path, value, scope = "smart component parameters") {
  let cursor = source;
  const keys = pathKeys(path);
  for (const key of keys.slice(0, -1)) {
    if (cursor[key] === undefined) cursor[key] = {};
    if (!cursor[key] || typeof cursor[key] !== "object" || Array.isArray(cursor[key])) fail(scope, `missing ${path}`);
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function validateParameterValue(definition, path, value, libraries) {
  const spec = definition.parameters[path];
  if (!spec) fail(definition.type, `unknown parameter ${path}`);
  if (spec.required !== false && (value === undefined || value === null)) fail(definition.type, `missing ${path}`);
  if (value === undefined || value === null) return value;

  if (spec.kind === "number" && !finiteNumber(value)) fail(definition.type, `${path} must be a number`);
  if (spec.kind === "positiveNumber" && !finitePositiveNumber(value)) fail(definition.type, `${path} must be a positive number`);
  if (spec.kind === "nonNegativeNumber" && !finiteNonNegativeNumber(value)) fail(definition.type, `${path} must be zero or positive`);
  if (spec.kind === "positiveInteger" && !finitePositiveInteger(value)) fail(definition.type, `${path} must be a positive integer`);
  if (spec.kind === "numberList") {
    if (!Array.isArray(value)) fail(definition.type, `${path} must be a number list`);
    for (const item of value) {
      if (!finiteNumber(item)) fail(definition.type, `${path} must contain only numbers`);
      if (spec.itemMinimum !== undefined && item < spec.itemMinimum) fail(definition.type, `${path} values must be at least ${spec.itemMinimum}`);
      if (spec.itemExclusiveMinimum !== undefined && item <= spec.itemExclusiveMinimum) fail(definition.type, `${path} values must be greater than ${spec.itemExclusiveMinimum}`);
    }
  }
  if (spec.kind === "object" && (!value || typeof value !== "object")) fail(definition.type, `${path} must be structured data`);
  if (spec.kind === "boolean" && typeof value !== "boolean") fail(definition.type, `${path} must be true or false`);
  if (spec.kind === "text" && typeof value !== "string") fail(definition.type, `${path} must be text`);
  if (spec.kind === "enum" && !spec.values.includes(value)) fail(definition.type, `${path} must be one of ${spec.values.join(", ")}`);
  if (spec.kind === "catalogRef") {
    if (!nonEmptyString(value)) fail(definition.type, `${path} must be a catalog reference`);
    const catalog = requiredObject(libraries[spec.catalog], definition.type, `${spec.catalog} library`);
    const entries = requiredObject(catalog[spec.catalog], definition.type, `${spec.catalog} entries`);
    if (!entries[value]) fail(definition.type, `${path} not found in ${spec.catalog}: ${value}`);
  }
  return value;
}

export function validateSmartComponentParameters(definition, parameters, libraries) {
  if (!libraries || typeof libraries !== "object" || Array.isArray(libraries)) fail(definition.type, "parameter libraries must be an object");
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) fail(definition.type, "missing referenceParameters");
  for (const [path, spec] of Object.entries(definition.parameters)) {
    const value = optionalPath(parameters, path);
    if (value === undefined && spec.default !== undefined) {
      validateParameterValue(definition, path, jsonClone(spec.default), libraries);
      continue;
    }
    if (value === undefined && spec.required === false) continue;
    validateParameterValue(definition, path, value === undefined ? requiredPath(parameters, path, definition.type) : value, libraries);
  }
}

function uiItemFields(definition, item, label) {
  if (typeof item === "string") return [item];
  if (!item || typeof item !== "object" || Array.isArray(item)) fail(definition.type, `${label} must be a parameter path or UI item object`);
  if (item.kind === "parameter") {
    return [uiItemPath(item, label)];
  }
  if (item.kind === "stairRouteModules") {
    return [uiItemPath(item, label)];
  }
  if (item.kind === "section") {
    return requiredArray(item.items, `${label}.items`).flatMap((child, index) => uiItemFields(definition, child, `${label}.items[${index}]`));
  }
  if (item.kind === "smartComponentRoles") {
    optionalStringArray(item.roles, `${label}.roles`);
    return [];
  }
  if (UI_ONLY_ITEM_KINDS.has(item.kind)) return [];
  fail(definition.type, `${label} has unsupported UI item kind ${item.kind || "missing"}`);
}

function referencedUiFields(definition) {
  return definition.ui.tabs.flatMap((tab, tabIndex) => {
    if (!tab || typeof tab !== "object" || Array.isArray(tab)) fail(definition.type, `ui.tabs[${tabIndex}] must be an object`);
    return requiredArray(tab.items, `ui.tabs[${tabIndex}].items`)
      .flatMap((item, itemIndex) => uiItemFields(definition, item, `ui.tabs[${tabIndex}].items[${itemIndex}]`));
  });
}

function validateParameterSpec(definition, path, spec) {
  pathKeys(path);
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail(definition.type, `${path} parameter must be an object`);
  if (!PARAMETER_KINDS.has(spec.kind)) fail(definition.type, `${path} has unsupported kind ${spec.kind}`);
  if (spec.itemMinimum !== undefined && !finiteNumber(spec.itemMinimum)) fail(definition.type, `${path}.itemMinimum must be a number`);
  if (spec.itemExclusiveMinimum !== undefined && !finiteNumber(spec.itemExclusiveMinimum)) fail(definition.type, `${path}.itemExclusiveMinimum must be a number`);
  if (spec.kind === "catalogRef" && !nonEmptyString(spec.catalog)) fail(definition.type, `${path} missing catalog`);
  if (spec.kind === "enum" && (!Array.isArray(spec.values) || !spec.values.length || spec.values.some((value) => !nonEmptyString(value)))) {
    fail(definition.type, `${path} missing enum values`);
  }
}

function validateDimensionSpec(definition, spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail(definition.type, "dimension must be an object");
  if (!nonEmptyString(spec.id)) fail(definition.type, "dimension missing id");
  if (!nonEmptyString(spec.parameter) || !definition.parameters[spec.parameter]) {
    fail(definition.type, `${spec.id} dimension references unknown parameter ${spec.parameter}`);
  }
  const reference = requiredObject(spec.reference, definition.type, `${spec.id} dimension reference`);
  if (!nonEmptyString(reference.kind)) fail(definition.type, `${spec.id} dimension missing reference.kind`);
}

function validateInterfaceSpecs(definition) {
  const interfaces = optionalArray(definition.interfaces, `${definition.type}.interfaces`);
  if (definition.kind === "connection" && !interfaces.length) fail(definition.type, "connection definitions require interfaces");
  for (const [index, spec] of interfaces.entries()) {
    requiredObject(spec, definition.type, `interfaces[${index}]`);
    validateKnownKeys(definition, spec, new Set(["role", "auto"]), `interfaces[${index}]`);
    if (!nonEmptyString(spec.role)) fail(definition.type, `interfaces[${index}] missing role`);
    if (spec.auto === undefined) continue;
    const auto = requiredObject(spec.auto, definition.type, `interfaces[${index}].auto`);
    validateKnownKeys(definition, auto, AUTO_INTERFACE_KEYS, `interfaces[${index}].auto`);
    if (!AUTO_INTERFACE_TYPES.has(auto.type)) fail(definition.type, `interfaces[${index}].auto.type is unsupported: ${auto.type || "missing"}`);
    optionalString(auto.faceRef, definition.type, `interfaces[${index}].auto.faceRef`);
    optionalString(auto.stationReference, definition.type, `interfaces[${index}].auto.stationReference`);
    if (auto.memberEnd !== undefined && auto.memberEnd !== "start" && auto.memberEnd !== "end") {
      fail(definition.type, `interfaces[${index}].auto.memberEnd must be start or end`);
    }
    if (auto.type === "member-web" && auto.faceRef !== "web-center-plane") {
      fail(definition.type, `interfaces[${index}].auto.faceRef must be web-center-plane for member-web`);
    }
    if (auto.type === "planar-face" && auto.faceRef === undefined) {
      fail(definition.type, `interfaces[${index}].auto.faceRef is required for planar-face`);
    }
    if (auto.type !== "member-end-face" && auto.memberEnd !== undefined) {
      fail(definition.type, `interfaces[${index}].auto.memberEnd is only supported for member-end-face`);
    }
    if (auto.type !== "planar-face" && auto.stationReference !== undefined) {
      fail(definition.type, `interfaces[${index}].auto.stationReference is only supported for planar-face`);
    }
    if (auto.type === "member-end-face" && auto.faceRef !== undefined) {
      fail(definition.type, `interfaces[${index}].auto.faceRef is not supported for member-end-face`);
    }
  }
}

function validateComponentSpecs(definition) {
  const roles = new Set();
  for (const [index, spec] of requiredArray(definition.components, `${definition.type}.components`).entries()) {
    requiredObject(spec, definition.type, `components[${index}]`);
    validateKnownKeys(definition, spec, COMPONENT_KEYS, `components[${index}]`);
    if (!nonEmptyString(spec.role)) fail(definition.type, `components[${index}] missing role`);
    if (roles.has(spec.role)) fail(definition.type, `components[${index}] duplicates role ${spec.role}`);
    roles.add(spec.role);
    optionalString(spec.label, definition.type, `components[${index}].label`);
    optionalString(spec.kind, definition.type, `components[${index}].kind`);
    optionalStringArray(spec.objectRoles, `components[${index}].objectRoles`);
    if (spec.default !== undefined && !COMPONENT_DEFAULTS.has(spec.default)) {
      fail(definition.type, `components[${index}].default is unsupported: ${spec.default}`);
    }
  }
}

export function defineSmartComponent(definition) {
  definition = requiredObject(definition, "smart component definition", "definition");
  if (!nonEmptyString(definition.type)) fail("smart component definition", "missing type");
  if (!nonEmptyString(definition.kind)) fail(definition.type, "missing kind");
  if (!(nonEmptyString(definition.version) || finitePositiveInteger(definition.version))) {
    fail(definition.type, "missing version");
  }
  if (!nonEmptyString(definition.title)) fail(definition.type, "missing title");
  if (typeof definition.build !== "function") fail(definition.type, "missing build(ctx)");
  const customUi = requiredObject(definition.customUi, definition.type, "customUi");
  if (typeof customUi.mountSmartComponentUi !== "function") fail(definition.type, "missing generic smart component UI mountSmartComponentUi(args)");
  if (!definition.parameters || typeof definition.parameters !== "object" || Array.isArray(definition.parameters)) fail(definition.type, "missing parameters");
  const ui = requiredObject(definition.ui, definition.type, "ui");
  if (!Array.isArray(ui.tabs) || !ui.tabs.length) fail(definition.type, "missing ui.tabs");
  for (const [path, spec] of Object.entries(definition.parameters)) validateParameterSpec(definition, path, spec);
  for (const path of referencedUiFields(definition)) {
    if (!definition.parameters[path]) fail(definition.type, `ui references unknown parameter ${path}`);
  }
  for (const spec of optionalArray(definition.dimensions, `${definition.type}.dimensions`)) validateDimensionSpec(definition, spec);
  validateInterfaceSpecs(definition);
  validateComponentSpecs(definition);
  optionalStringArray(definition.requiredPlateRoles, `${definition.type}.requiredPlateRoles`);
  return Object.freeze({ ...definition });
}
