import { isPlainObject as plainObject, jsonClone } from "../../core/model.mjs";
import { finiteNumber } from "../../core/math.mjs";
import { solverDiagnostic } from "./solver-result.mjs";

function fail(message) {
  throw new Error(`compliance api: ${message}`);
}

function optionalArray(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function optionalStringArray(value, label) {
  const items = optionalArray(value, label);
  const seen = new Set();
  for (const item of items) {
    if (typeof item !== "string" || !item.trim()) fail(`${label} must contain only non-empty strings`);
    if (seen.has(item)) fail(`${label} contains duplicate value: ${item}`);
    seen.add(item);
  }
  return items;
}

function optionalObject(value, label) {
  if (value === undefined) return {};
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function requiredObject(value, label) {
  if (!plainObject(value)) fail(`${label} must be an object`);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function optionalStringField(field, value, label) {
  if (value === undefined) return {};
  return { [field]: requiredString(value, label) };
}

function optionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  if (value.split(".").some((segment) => !segment.trim())) fail(`${label} must not contain empty path segments`);
  return value;
}

function optionalFiniteBound(rule, field) {
  if (rule[field] === undefined) return undefined;
  if (!finiteNumber(rule[field])) fail(`${rule.id}: ${field} must be a finite number`);
  return rule[field];
}

function pathValue(source, path, label) {
  const normalizedPath = optionalPath(path, label);
  if (normalizedPath === undefined) return undefined;
  return normalizedPath.split(".").reduce((cursor, key) => cursor?.[key], source);
}

function appliesToContext(rule, context) {
  const applies = optionalObject(rule.appliesTo, `${rule.id}.appliesTo`);
  const componentKinds = optionalStringArray(applies.componentKinds, `${rule.id}.appliesTo.componentKinds`);
  const componentTypes = optionalStringArray(applies.componentTypes, `${rule.id}.appliesTo.componentTypes`);
  const appliesTags = optionalStringArray(applies.tags, `${rule.id}.appliesTo.tags`);
  if (componentKinds.length && !componentKinds.includes(context.componentKind)) return false;
  if (componentTypes.length && !componentTypes.includes(context.componentType)) return false;
  if (appliesTags.length) {
    const tags = new Set(optionalStringArray(context.tags, "context.tags"));
    if (!appliesTags.some((tag) => tags.has(tag))) return false;
  }
  return true;
}

function comparisonDiagnostic(rule, measured, allowed, message) {
  const parameterPaths = optionalStringArray(rule.parameterPaths, `${rule.id}.parameterPaths`);
  if (rule.parameterPath !== undefined) fail(`${rule.id}.parameterPath is not supported; use parameterPaths`);
  return solverDiagnostic({
    severity: requiredString(rule.severity, `${rule.id}.severity`),
    code: rule.id,
    message: message === undefined
      ? requiredString(rule.message, `${rule.id}.message`)
      : requiredString(message, `${rule.id}.missingMessage`),
    ruleId: rule.id,
    clause: rule.clause,
    source: rule.source,
    parameterPaths,
    objectRoles: optionalStringArray(rule.objectRoles, `${rule.id}.objectRoles`),
    measured,
    allowed,
    resolve: optionalArray(rule.resolve, `${rule.id}.resolve`)
  });
}

function runNumberRangeRule(rule, context) {
  const hasValuePath = rule.valuePath !== undefined;
  const hasMeasurementPath = rule.measurementPath !== undefined;
  if (hasValuePath === hasMeasurementPath) fail(`${rule.id}: define exactly one of valuePath or measurementPath`);
  const measurements = optionalObject(context.measurements, "context.measurements");
  const value = hasValuePath
    ? pathValue(context, rule.valuePath, `${rule.id}.valuePath`)
    : pathValue(measurements, rule.measurementPath, `${rule.id}.measurementPath`);
  const min = optionalFiniteBound(rule, "min");
  const max = optionalFiniteBound(rule, "max");
  if (!finiteNumber(value)) {
    if (rule.required === false) return [];
    if (rule.missingMessage === undefined) fail(`${rule.id}.missingMessage is required when a measured value is missing`);
    const missingMessage = requiredString(rule.missingMessage, `${rule.id}.missingMessage`);
    return [comparisonDiagnostic(rule, value, { min, max }, missingMessage)];
  }
  if (min !== undefined && value < min) return [comparisonDiagnostic(rule, value, { min, max })];
  if (max !== undefined && value > max) return [comparisonDiagnostic(rule, value, { min, max })];
  return [];
}

function normalizeDiagnostics(value) {
  if (!Array.isArray(value)) fail("rule check diagnostics must be an array");
  return value.map((item) => solverDiagnostic(item));
}

export function createRulePack(config) {
  requiredObject(config, "rule pack config");
  const id = requiredString(config.id, "rule pack id");
  return {
    id,
    title: requiredString(config.title, `${id}.title`),
    jurisdiction: requiredString(config.jurisdiction, `${id}.jurisdiction`),
    ...optionalStringField("edition", config.edition, `${id}.edition`),
    sourceReferences: jsonClone(requiredArray(config.sourceReferences, `${id}.sourceReferences`)),
    applicableComponentKinds: [...optionalStringArray(requiredArray(config.applicableComponentKinds, `${id}.applicableComponentKinds`), `${id}.applicableComponentKinds`)],
    rules: jsonClone(requiredArray(config.rules, `${id}.rules`))
  };
}

export function runRule(rule, context, helpers) {
  if (!plainObject(rule)) fail("rule must be an object");
  requiredObject(context, "context");
  requiredObject(helpers, "helpers");
  if (!rule.id || typeof rule.id !== "string") fail("rule id is required");
  if (!appliesToContext(rule, context)) return [];
  if (typeof rule.check === "function") return normalizeDiagnostics(rule.check(context, helpers));
  if (rule.type === "number-range") return runNumberRangeRule(rule, context);
  fail(`${rule.id}: unsupported rule type ${rule.type}`);
}

export function runRulePack(rulePack, context, helpers) {
  const pack = createRulePack(rulePack);
  requiredObject(context, "context");
  requiredObject(helpers, "helpers");
  if (pack.applicableComponentKinds.length && !pack.applicableComponentKinds.includes(context.componentKind)) {
    return { rulePack: pack, diagnostics: [] };
  }
  const diagnostics = [];
  for (const rule of pack.rules) diagnostics.push(...runRule(rule, context, helpers));
  return { rulePack: pack, diagnostics };
}
