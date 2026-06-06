import { clone, solverDiagnostic } from "./solver-result.mjs";

function fail(message) {
  throw new Error(`compliance api: ${message}`);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    const tags = new Set(context.tags || []);
    if (!applies.tags.some((tag) => tags.has(tag))) return false;
  }
  return true;
}

function comparisonDiagnostic(rule, measured, allowed, message) {
  return solverDiagnostic({
    severity: rule.severity || "error",
    code: rule.id,
    message: message || rule.message || `${rule.id}: value is outside allowed range`,
    ruleId: rule.id,
    clause: rule.clause,
    source: rule.source,
    parameterPaths: rule.parameterPaths || (rule.parameterPath ? [rule.parameterPath] : []),
    objectRoles: rule.objectRoles || [],
    measured,
    allowed,
    resolve: rule.resolve || []
  });
}

function runNumberRangeRule(rule, context) {
  const value = rule.valuePath
    ? pathValue(context, rule.valuePath)
    : rule.measurementPath ? pathValue(context.measurements || {}, rule.measurementPath)
      : undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (rule.required === false) return [];
    return [comparisonDiagnostic(rule, value, { min: rule.min, max: rule.max }, rule.missingMessage || `${rule.id}: measured value is missing`)];
  }
  const min = typeof rule.min === "number" ? rule.min : undefined;
  const max = typeof rule.max === "number" ? rule.max : undefined;
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
    sourceReferences: Array.isArray(config.sourceReferences) ? clone(config.sourceReferences) : [],
    applicableComponentKinds: Array.isArray(config.applicableComponentKinds) ? [...config.applicableComponentKinds] : [],
    rules: Array.isArray(config.rules) ? clone(config.rules) : []
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
  for (const rule of rulePack.rules || []) diagnostics.push(...runRule(rule, context, helpers));
  return { rulePack: pack, diagnostics };
}

export function diagnosticsBySeverity(diagnostics = []) {
  return diagnostics.reduce((groups, diagnostic) => {
    const severity = diagnostic.severity || "error";
    groups[severity] ||= [];
    groups[severity].push(diagnostic);
    return groups;
  }, {});
}
