const PARAMETER_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "numberList", "boolean", "catalogRef", "enum", "text"]);

function fail(scope, message) {
  throw new Error(`${scope}: ${message}`);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function pathKeys(path) {
  if (typeof path !== "string" || !path.includes(".")) fail("connection path", `invalid parameter path ${path}`);
  return path.split(".");
}

export function requiredPath(source, path, scope = "connection parameters") {
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

export function setPath(source, path, value, scope = "connection parameters") {
  let cursor = source;
  const keys = pathKeys(path);
  for (const key of keys.slice(0, -1)) {
    if (!cursor[key]) cursor[key] = {};
    if (typeof cursor[key] !== "object") fail(scope, `missing ${path}`);
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

export function validateParameterValue(definition, path, value, libraries = {}) {
  const spec = definition.parameters[path];
  if (!spec) fail(definition.type, `unknown parameter ${path}`);
  if (spec.required !== false && (value === undefined || value === null)) fail(definition.type, `missing ${path}`);
  if (value === undefined || value === null) return value;

  if (spec.kind === "number" && (typeof value !== "number" || !Number.isFinite(value))) fail(definition.type, `${path} must be a number`);
  if (spec.kind === "positiveNumber" && (typeof value !== "number" || !Number.isFinite(value) || value <= 0)) fail(definition.type, `${path} must be a positive number`);
  if (spec.kind === "nonNegativeNumber" && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) fail(definition.type, `${path} must be zero or positive`);
  if (spec.kind === "positiveInteger" && (!Number.isInteger(value) || value <= 0)) fail(definition.type, `${path} must be a positive integer`);
  if (spec.kind === "numberList") {
    if (!Array.isArray(value)) fail(definition.type, `${path} must be a number list`);
    for (const item of value) {
      if (typeof item !== "number" || !Number.isFinite(item)) fail(definition.type, `${path} must contain only numbers`);
      if (spec.itemMinimum !== undefined && item < spec.itemMinimum) fail(definition.type, `${path} values must be at least ${spec.itemMinimum}`);
      if (spec.itemExclusiveMinimum !== undefined && item <= spec.itemExclusiveMinimum) fail(definition.type, `${path} values must be greater than ${spec.itemExclusiveMinimum}`);
    }
  }
  if (spec.kind === "boolean" && typeof value !== "boolean") fail(definition.type, `${path} must be true or false`);
  if (spec.kind === "text" && typeof value !== "string") fail(definition.type, `${path} must be text`);
  if (spec.kind === "enum" && !spec.values?.includes(value)) fail(definition.type, `${path} must be one of ${spec.values.join(", ")}`);
  if (spec.kind === "catalogRef") {
    if (typeof value !== "string" || !value) fail(definition.type, `${path} must be a catalog reference`);
    const catalog = libraries[spec.catalog];
    const entries = catalog?.[spec.catalog];
    if (!entries?.[value]) fail(definition.type, `${path} not found in ${spec.catalog}: ${value}`);
  }
  return value;
}

export function validateConnectionParameters(definition, parameters, libraries = {}) {
  if (!parameters || typeof parameters !== "object") fail(definition.type, "missing referenceParameters");
  for (const [path, spec] of Object.entries(definition.parameters)) {
    const value = optionalPath(parameters, path);
    if (value === undefined && spec.required === false) continue;
    validateParameterValue(definition, path, value === undefined ? requiredPath(parameters, path, definition.type) : value, libraries);
  }
}

function uiItemFields(item) {
    if (typeof item === "string") return [item];
    if (item?.kind === "parameter" && item.path) return [item.path];
    if (item?.kind === "section") return (item.items || []).flatMap(uiItemFields);
    return [];
}

function referencedUiFields(definition) {
  return (definition.ui?.tabs || []).flatMap((tab) => tab.items || []).flatMap(uiItemFields);
}

function validateParameterSpec(definition, path, spec) {
  if (!spec || typeof spec !== "object") fail(definition.type, `${path} parameter must be an object`);
  if (!PARAMETER_KINDS.has(spec.kind)) fail(definition.type, `${path} has unsupported kind ${spec.kind}`);
  if (spec.kind === "catalogRef" && !spec.catalog) fail(definition.type, `${path} missing catalog`);
  if (spec.kind === "enum" && !Array.isArray(spec.values)) fail(definition.type, `${path} missing enum values`);
}

function validateDimensionSpec(definition, spec) {
  if (!spec || typeof spec !== "object") fail(definition.type, "dimension must be an object");
  if (!spec.id) fail(definition.type, "dimension missing id");
  if (!definition.parameters[spec.parameter]) fail(definition.type, `${spec.id} dimension references unknown parameter ${spec.parameter}`);
  if (!spec.reference?.kind) fail(definition.type, `${spec.id} dimension missing reference.kind`);
}

export function defineConnection(definition) {
  if (!definition?.type) fail("connection definition", "missing type");
  if (!definition.version) fail(definition.type, "missing version");
  if (!definition.title) fail(definition.type, "missing title");
  if (typeof definition.build !== "function") fail(definition.type, "missing build(ctx)");
  if (typeof definition.customUi?.mountConnectionUi !== "function") fail(definition.type, "missing ui.mjs mountConnectionUi(args)");
  if (!definition.parameters || typeof definition.parameters !== "object") fail(definition.type, "missing parameters");
  if (!Array.isArray(definition.ui?.tabs) || !definition.ui.tabs.length) fail(definition.type, "missing ui.tabs");
  for (const [path, spec] of Object.entries(definition.parameters)) validateParameterSpec(definition, path, spec);
  for (const path of referencedUiFields(definition)) {
    if (!definition.parameters[path]) fail(definition.type, `ui references unknown parameter ${path}`);
  }
  for (const spec of definition.dimensions || []) validateDimensionSpec(definition, spec);
  return Object.freeze({
    requiredPlateRoles: ["endPlate"],
    interfaces: [{ role: "main" }, { role: "secondary" }],
    ...definition
  });
}
