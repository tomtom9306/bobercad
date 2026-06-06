export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function fail(message) {
  throw new Error(`solver result: ${message}`);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedSeverity(value) {
  if (value === "error" || value === "warning" || value === "info") return value;
  fail(`unsupported diagnostic severity ${value}`);
}

function stringList(values = [], label) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) fail(`${label} must be an array of strings`);
  return [...new Set(values)];
}

export function solverDiagnostic(input = {}) {
  if (!input.code || typeof input.code !== "string") fail("diagnostic code is required");
  if (!input.message || typeof input.message !== "string") fail(`${input.code}: diagnostic message is required`);
  return {
    severity: normalizedSeverity(input.severity || "error"),
    code: input.code,
    message: input.message,
    ...(input.source ? { source: clone(input.source) } : {}),
    ...(input.ruleId ? { ruleId: input.ruleId } : {}),
    ...(input.clause ? { clause: input.clause } : {}),
    parameterPaths: stringList(input.parameterPaths, `${input.code}.parameterPaths`),
    objectRoles: stringList(input.objectRoles, `${input.code}.objectRoles`),
    ...(input.measured !== undefined ? { measured: clone(input.measured) } : {}),
    ...(input.allowed !== undefined ? { allowed: clone(input.allowed) } : {}),
    resolve: Array.isArray(input.resolve) ? clone(input.resolve) : []
  };
}

export function createSolverResult(input = {}) {
  const inputParameters = plainObject(input.inputParameters) ? clone(input.inputParameters) : {};
  const resolvedParameters = plainObject(input.resolvedParameters) ? clone(input.resolvedParameters) : clone(inputParameters);
  const computedValues = plainObject(input.computedValues) ? clone(input.computedValues) : {};
  const objectRoleHints = plainObject(input.objectRoleHints) ? clone(input.objectRoleHints) : {};
  const diagnostics = Array.isArray(input.diagnostics)
    ? input.diagnostics.map((diagnostic) => solverDiagnostic(diagnostic))
    : [];
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
  return (result?.diagnostics || []).some((diagnostic) => diagnostic.severity === "error");
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
