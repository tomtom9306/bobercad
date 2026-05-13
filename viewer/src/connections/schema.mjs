const PARAMETER_KINDS = new Set(["number", "positiveNumber", "nonNegativeNumber", "positiveInteger", "catalogRef", "enum", "text"]);

function fail(scope, message) {
  throw new Error(`${scope}: ${message}`);
}

function parameter(kind, options = {}) {
  if (!PARAMETER_KINDS.has(kind)) fail("connection definition", `unsupported parameter kind ${kind}`);
  return { kind, required: true, ...options };
}

export const numberValue = (options) => parameter("number", options);
export const positiveNumber = (options) => parameter("positiveNumber", options);
export const nonNegativeNumber = (options) => parameter("nonNegativeNumber", options);
export const positiveInteger = (options) => parameter("positiveInteger", options);
export const catalogRef = (catalog, options) => parameter("catalogRef", { catalog, ...options });
export const enumValue = (values, options) => parameter("enum", { values, ...options });
export const textValue = (options) => parameter("text", options);

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

export function setPath(source, path, value, scope = "connection parameters") {
  let cursor = source;
  const keys = pathKeys(path);
  for (const key of keys.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== "object") fail(scope, `missing ${path}`);
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
  for (const path of Object.keys(definition.parameters)) {
    validateParameterValue(definition, path, requiredPath(parameters, path, definition.type), libraries);
  }
}

function referencedUiFields(definition) {
  return (definition.ui?.tabs || []).flatMap((tab) => tab.items || []).filter((item) => typeof item === "string");
}

export function defineConnection(definition) {
  if (!definition?.type) fail("connection definition", "missing type");
  if (!definition.version) fail(definition.type, "missing version");
  if (!definition.title) fail(definition.type, "missing title");
  if (typeof definition.build !== "function") fail(definition.type, "missing build(ctx)");
  if (!definition.parameters || typeof definition.parameters !== "object") fail(definition.type, "missing parameters");
  if (!Array.isArray(definition.ui?.tabs) || !definition.ui.tabs.length) fail(definition.type, "missing ui.tabs");
  for (const path of referencedUiFields(definition)) {
    if (!definition.parameters[path]) fail(definition.type, `ui references unknown parameter ${path}`);
  }
  return Object.freeze({
    requiredPlateRoles: ["endPlate"],
    interfaces: [{ role: "main" }, { role: "secondary" }],
    ...definition
  });
}
