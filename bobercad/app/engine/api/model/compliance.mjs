import { arrayValues, isPlainObject as plainObject, jsonClone } from "../../core/model.mjs?v=array-values-dry-1";
import { finiteNumber } from "../../core/math.mjs?v=compliance-number-dry-1";
import { solverDiagnostic } from "./solver-result.mjs?v=final-array-values-dry-1";

function fail(message) {
  throw new Error(`compliance api: ${message}`);
}

function pathValue(source, path) {
  if (!path) return undefined;
  return String(path).split(".").reduce((cursor, key) => cursor?.[key], source);
}

function appliesToContext(rule, context = {}) {
  const applies = rule.appliesTo || {};
  if (Array.isArray(applies.componentKinds) && applies.componentKinds.length && !applies.componentKinds.includes(context.componentKind)) return false;
  if (Array.isArray(applies.componentTypes) && applies.componentTypes.length && !applies.componentTypes.includes(context.componentType)) return false;
  if (Array.isArray(applies.tags) && applies.tags.length) {
    const tags = new Set(arrayValues(context.tags));
    if (!applies.tags.some((tag) => tags.has(tag))) return false;
  }
  return true;
}

function comparisonDiagnostic(rule, measured, allowed, message) {
  const parameterPaths = arrayValues(rule.parameterPaths);
  return solverDiagnostic({
    severity: rule.severity || "error",
    code: rule.id,
    message: message || rule.message || `${rule.id}: value is outside allowed range`,
    ruleId: rule.id,
    clause: rule.clause,
    source: rule.source,
    parameterPaths: parameterPaths.length ? parameterPaths : (rule.parameterPath ? [rule.parameterPath] : []),
    objectRoles: arrayValues(rule.objectRoles),
    measured,
    allowed,
    resolve: arrayValues(rule.resolve)
  });
}

function runNumberRangeRule(rule, context) {
  const value = rule.valuePath
    ? pathValue(context, rule.valuePath)
    : rule.measurementPath ? pathValue(context.measurements || {}, rule.measurementPath)
      : undefined;
  if (!finiteNumber(value)) {
    if (rule.required === false) return [];
    return [comparisonDiagnostic(rule, value, { min: rule.min, max: rule.max }, rule.missingMessage || `${rule.id}: measured value is missing`)];
  }
  const min = finiteNumber(rule.min) ? rule.min : undefined;
  const max = finiteNumber(rule.max) ? rule.max : undefined;
  if (min !== undefined && value < min) return [comparisonDiagnostic(rule, value, { min, max })];
  if (max !== undefined && value > max) return [comparisonDiagnostic(rule, value, { min, max })];
  return [];
}

function normalizeDiagnostics(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => solverDiagnostic(item));
}

export function createRulePack(config = {}) {
  if (!config.id || typeof config.id !== "string") fail("rule pack id is required");
  if (!config.title || typeof config.title !== "string") fail(`${config.id}: rule pack title is required`);
  return {
    id: config.id,
    title: config.title,
    jurisdiction: config.jurisdiction || "",
    edition: config.edition || "",
    sourceReferences: jsonClone(arrayValues(config.sourceReferences)),
    applicableComponentKinds: [...arrayValues(config.applicableComponentKinds)],
    rules: jsonClone(arrayValues(config.rules))
  };
}

export function runRule(rule, context = {}, helpers = {}) {
  if (!plainObject(rule)) fail("rule must be an object");
  if (!rule.id || typeof rule.id !== "string") fail("rule id is required");
  if (!appliesToContext(rule, context)) return [];
  if (typeof rule.check === "function") return normalizeDiagnostics(rule.check(context, helpers));
  if (rule.type === "number-range") return runNumberRangeRule(rule, context);
  fail(`${rule.id}: unsupported rule type ${rule.type}`);
}

export function runRulePack(rulePack, context = {}, helpers = {}) {
  const pack = createRulePack(rulePack);
  if (pack.applicableComponentKinds.length && !pack.applicableComponentKinds.includes(context.componentKind)) {
    return { rulePack: pack, diagnostics: [] };
  }
  const diagnostics = [];
  for (const rule of arrayValues(rulePack.rules)) diagnostics.push(...runRule(rule, context, helpers));
  return { rulePack: pack, diagnostics };
}
