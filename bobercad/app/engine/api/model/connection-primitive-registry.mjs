const operations = new Map();

function fail(message, options = {}) {
  if (typeof options.fail === "function") options.fail(message);
  throw new Error(message);
}

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, label, options = {}) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`, options);
  return value;
}

function stringSet(value, label, options = {}) {
  if (value === undefined) return new Set();
  if (!Array.isArray(value)) fail(`${label} must be an array`, options);
  const set = new Set();
  for (const item of value) set.add(nonEmptyString(item, label, options));
  if (set.size !== value.length) fail(`${label} must not contain duplicates`, options);
  return set;
}

function operationContract(value, type) {
  if (value === undefined) return { required: new Set(), optional: new Set() };
  if (!plainObject(value)) throw new Error(`${type}: inputs contract must be an object`);
  return {
    required: stringSet(value.required, `${type}.inputs.required`),
    optional: stringSet(value.optional, `${type}.inputs.optional`)
  };
}

function operationDefinition(type, options = {}) {
  nonEmptyString(type, "model operation type", options);
  const operation = operations.get(type);
  if (!operation) fail(`model operation not found: ${type}`, options);
  return operation;
}

export function registerModelOperation(definition) {
  if (!plainObject(definition)) throw new Error("model operation definition must be an object");
  const type = nonEmptyString(definition.type, "model operation type");
  if (operations.has(type)) throw new Error(`model operation already registered: ${type}`);
  if (typeof definition.build !== "function") throw new Error(`${type}: build must be a function`);
  operations.set(type, Object.freeze({
    type,
    build: definition.build,
    inputs: operationContract(definition.inputs, type)
  }));
}

export function modelOperationBuilder(type) {
  return operationDefinition(type).build;
}

export function validateModelOperationInput(type, input, options = {}) {
  const operation = operationDefinition(type, options);
  if (!plainObject(input)) fail(`${type}: operation input must be an object`, options);
  const runtimeKeys = stringSet(options.runtimeKeys, `${type}.runtimeKeys`, options);
  const allowed = new Set([...operation.inputs.required, ...operation.inputs.optional, ...runtimeKeys]);
  for (const key of operation.inputs.required) {
    if (!Object.hasOwn(input, key)) fail(`${type}: operation input missing ${key}`, options);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail(`${type}: operation input ${key} is not registered`, options);
  }
  return input;
}

export function registeredModelOperations() {
  return [...operations.values()].map((operation) => ({
    type: operation.type,
    inputs: {
      required: [...operation.inputs.required],
      optional: [...operation.inputs.optional]
    }
  }));
}
