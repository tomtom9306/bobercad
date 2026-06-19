import { isPlainObject as plainObject, optionalJsonClone } from "../../core/model.mjs";

function fail(message) {
  throw new Error(`solver result: ${message}`);
}

function normalizedSeverity(value) {
  if (value === "error" || value === "warning" || value === "info") return value;
  fail(`unsupported diagnostic severity ${value}`);
}

function stringList(values, label) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) fail(`${label} must be an array of non-empty strings`);
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) fail(`${label} must be an array of non-empty strings`);
    if (seen.has(value)) fail(`${label} contains duplicate value: ${value}`);
    seen.add(value);
  }
  return [...values];
}

function optionalStringField(input, field, label) {
  const value = input[field];
  if (value === undefined) return {};
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return { [field]: value };
}

function objectField(input, field) {
  const value = input[field];
  if (value === undefined) fail(`${field} is required`);
  if (!plainObject(value)) fail(`${field} must be an object`);
  return optionalJsonClone(value);
}

function optionalObjectField(input, field) {
  const value = input[field];
  if (value === undefined) return {};
  if (!plainObject(value)) fail(`${field} must be an object`);
  return optionalJsonClone(value);
}

function diagnosticsField(input, { required = false } = {}) {
  if (required && input.diagnostics === undefined) fail("diagnostics is required");
  if (input.diagnostics === undefined) return [];
  if (!Array.isArray(input.diagnostics)) fail("diagnostics must be an array");
  return input.diagnostics.map((diagnostic) => solverDiagnostic(diagnostic));
}

export function solverDiagnostic(input) {
  if (!plainObject(input)) fail("diagnostic must be an object");
  if (typeof input.code !== "string" || !input.code.trim()) fail("diagnostic code is required");
  if (typeof input.message !== "string" || !input.message.trim()) fail(`${input.code}: diagnostic message is required`);
  if (input.severity === undefined) fail(`${input.code}: diagnostic severity is required`);
  if (input.parameters !== undefined) fail(`${input.code}.parameters is not supported; use parameterPaths`);
  const resolve = input.resolve === undefined ? [] : input.resolve;
  if (!Array.isArray(resolve)) fail(`${input.code}.resolve must be an array`);
  return {
    severity: normalizedSeverity(input.severity),
    code: input.code,
    message: input.message,
    ...(input.source !== undefined ? { source: optionalJsonClone(input.source) } : {}),
    ...optionalStringField(input, "ruleId", `${input.code}.ruleId`),
    ...optionalStringField(input, "clause", `${input.code}.clause`),
    parameterPaths: stringList(input.parameterPaths, `${input.code}.parameterPaths`),
    objectRoles: stringList(input.objectRoles, `${input.code}.objectRoles`),
    ...(input.measured !== undefined ? { measured: optionalJsonClone(input.measured) } : {}),
    ...(input.allowed !== undefined ? { allowed: optionalJsonClone(input.allowed) } : {}),
    resolve: optionalJsonClone(resolve)
  };
}

export function createSolverResult(input) {
  if (!plainObject(input)) fail("input must be an object");
  const inputParameters = objectField(input, "inputParameters");
  const resolvedParameters = objectField(input, "resolvedParameters");
  const computedValues = objectField(input, "computedValues");
  const objectRoleHints = objectField(input, "objectRoleHints");
  const diagnostics = diagnosticsField(input, { required: true });
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
  return createSolverResult(result).diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function solverResultPatch(input) {
  if (!plainObject(input)) fail("merge extension must be an object");
  return {
    inputParameters: optionalObjectField(input, "inputParameters"),
    resolvedParameters: optionalObjectField(input, "resolvedParameters"),
    computedValues: optionalObjectField(input, "computedValues"),
    objectRoleHints: optionalObjectField(input, "objectRoleHints"),
    diagnostics: diagnosticsField(input)
  };
}

export function mergeSolverResults(base, extension) {
  const first = createSolverResult(base);
  const second = solverResultPatch(extension);
  return {
    inputParameters: { ...first.inputParameters, ...second.inputParameters },
    resolvedParameters: { ...first.resolvedParameters, ...second.resolvedParameters },
    computedValues: { ...first.computedValues, ...second.computedValues },
    objectRoleHints: { ...first.objectRoleHints, ...second.objectRoleHints },
    diagnostics: [...first.diagnostics, ...second.diagnostics]
  };
}
