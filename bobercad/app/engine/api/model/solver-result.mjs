import { arrayValues, isPlainObject as plainObject, optionalJsonClone, uniqueValues } from "../../core/model.mjs?v=array-values-dry-1";

function fail(message) {
  throw new Error(`solver result: ${message}`);
}

function normalizedSeverity(value) {
  if (value === "error" || value === "warning" || value === "info") return value;
  fail(`unsupported diagnostic severity ${value}`);
}

function stringList(values = [], label) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) fail(`${label} must be an array of strings`);
  return uniqueValues(values);
}

export function solverDiagnostic(input = {}) {
  if (!input.code || typeof input.code !== "string") fail("diagnostic code is required");
  if (!input.message || typeof input.message !== "string") fail(`${input.code}: diagnostic message is required`);
  return {
    severity: normalizedSeverity(input.severity || "error"),
    code: input.code,
    message: input.message,
    ...(input.source ? { source: optionalJsonClone(input.source) } : {}),
    ...(input.ruleId ? { ruleId: input.ruleId } : {}),
    ...(input.clause ? { clause: input.clause } : {}),
    parameterPaths: stringList(input.parameterPaths, `${input.code}.parameterPaths`),
    objectRoles: stringList(input.objectRoles, `${input.code}.objectRoles`),
    ...(input.measured !== undefined ? { measured: optionalJsonClone(input.measured) } : {}),
    ...(input.allowed !== undefined ? { allowed: optionalJsonClone(input.allowed) } : {}),
    resolve: optionalJsonClone(arrayValues(input.resolve))
  };
}

export function createSolverResult(input = {}) {
  const inputParameters = plainObject(input.inputParameters) ? optionalJsonClone(input.inputParameters) : {};
  const resolvedParameters = plainObject(input.resolvedParameters) ? optionalJsonClone(input.resolvedParameters) : optionalJsonClone(inputParameters);
  const computedValues = plainObject(input.computedValues) ? optionalJsonClone(input.computedValues) : {};
  const objectRoleHints = plainObject(input.objectRoleHints) ? optionalJsonClone(input.objectRoleHints) : {};
  const diagnostics = arrayValues(input.diagnostics).map((diagnostic) => solverDiagnostic(diagnostic));
  return {
    inputParameters,
    resolvedParameters,
    computedValues,
    diagnostics,
    objectRoleHints
  };
}

export function addSolverDiagnostic(result, diagnostic) {
  if (!plainObject(result)) fail("result must be an object");
  const next = createSolverResult(result);
  next.diagnostics.push(solverDiagnostic(diagnostic));
  return next;
}

export function hasSolverErrors(result) {
  return arrayValues(result?.diagnostics).some((diagnostic) => diagnostic.severity === "error");
}

export function mergeSolverResults(base, extension) {
  const first = createSolverResult(base);
  const second = createSolverResult(extension);
  return {
    inputParameters: { ...first.inputParameters, ...second.inputParameters },
    resolvedParameters: { ...first.resolvedParameters, ...second.resolvedParameters },
    computedValues: { ...first.computedValues, ...second.computedValues },
    objectRoleHints: { ...first.objectRoleHints, ...second.objectRoleHints },
    diagnostics: [...first.diagnostics, ...second.diagnostics]
  };
}
