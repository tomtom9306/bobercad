const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function decodePointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveLocalRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref: ${ref}`);
  let cursor = rootSchema;
  for (const part of ref.slice(2).split("/").map(decodePointerPart)) {
    cursor = cursor?.[part];
  }
  if (cursor === undefined) throw new Error(`unresolved $ref: ${ref}`);
  return cursor;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeMatches(value, expected) {
  if (Array.isArray(expected)) return expected.some((item) => typeMatches(value, item));
  if (expected === "object") return isObject(value);
  if (expected === "array") return Array.isArray(value);
  if (expected === "string") return typeof value === "string";
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "boolean") return typeof value === "boolean";
  if (expected === "null") return value === null;
  return true;
}

function valueEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pathLabel(parts) {
  if (!parts.length) return "$";
  return `$${parts.map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`)).join("")}`;
}

function addError(errors, pathParts, message) {
  errors.push({ path: [...pathParts], message });
}

function validateValue(value, schema, rootSchema, errors = [], valuePath = []) {
  if (schema === true || schema === undefined) return errors;
  if (schema === false) {
    addError(errors, valuePath, "value is not allowed");
    return errors;
  }
  if (!isObject(schema)) return errors;

  if (schema.$ref) {
    validateValue(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, errors, valuePath);
    return errors;
  }

  for (const branch of schema.allOf || []) validateValue(value, branch, rootSchema, errors, valuePath);

  if (schema.anyOf) {
    const matches = schema.anyOf.filter((branch) => validateValue(value, branch, rootSchema, [], valuePath).length === 0);
    if (!matches.length) addError(errors, valuePath, "does not match any allowed schema");
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((branch) => validateValue(value, branch, rootSchema, [], valuePath).length === 0);
    if (matches.length !== 1) addError(errors, valuePath, `matches ${matches.length} oneOf branches`);
  }

  if (schema.if) {
    const conditionMatches = validateValue(value, schema.if, rootSchema, [], valuePath).length === 0;
    if (conditionMatches && schema.then) validateValue(value, schema.then, rootSchema, errors, valuePath);
    if (!conditionMatches && schema.else) validateValue(value, schema.else, rootSchema, errors, valuePath);
  }

  if (schema.not && validateValue(value, schema.not, rootSchema, [], valuePath).length === 0) {
    addError(errors, valuePath, "matches a forbidden schema");
  }

  if ("const" in schema && !valueEquals(value, schema.const)) addError(errors, valuePath, `expected ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => valueEquals(item, value))) addError(errors, valuePath, `must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);

  if (schema.type && !typeMatches(value, schema.type)) {
    addError(errors, valuePath, `must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`);
    return errors;
  }

  if (isObject(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) addError(errors, [...valuePath, key], "is required");
    }

    const properties = schema.properties || {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) validateValue(value[key], childSchema, rootSchema, errors, [...valuePath, key]);
    }

    if ("minProperties" in schema && Object.keys(value).length < schema.minProperties) addError(errors, valuePath, `must have at least ${schema.minProperties} properties`);
    if ("maxProperties" in schema && Object.keys(value).length > schema.maxProperties) addError(errors, valuePath, `must have at most ${schema.maxProperties} properties`);

    if ("additionalProperties" in schema) {
      for (const key of Object.keys(value)) {
        if (key in properties) continue;
        if (schema.additionalProperties === false) addError(errors, [...valuePath, key], "is not allowed");
        else if (schema.additionalProperties !== true) validateValue(value[key], schema.additionalProperties, rootSchema, errors, [...valuePath, key]);
      }
    }
  }

  if (Array.isArray(value)) {
    if ("minItems" in schema && value.length < schema.minItems) addError(errors, valuePath, `must contain at least ${schema.minItems} items`);
    if ("maxItems" in schema && value.length > schema.maxItems) addError(errors, valuePath, `must contain at most ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) addError(errors, valuePath, "must contain unique items");
        seen.add(key);
      }
    }

    const prefixCount = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
    for (let index = 0; index < prefixCount && index < value.length; index += 1) {
      validateValue(value[index], schema.prefixItems[index], rootSchema, errors, [...valuePath, index]);
    }
    if (schema.items) {
      const start = prefixCount || 0;
      for (let index = start; index < value.length; index += 1) {
        validateValue(value[index], schema.items, rootSchema, errors, [...valuePath, index]);
      }
    }
  }

  if (typeof value === "string") {
    if ("minLength" in schema && value.length < schema.minLength) addError(errors, valuePath, `must contain at least ${schema.minLength} characters`);
    if ("maxLength" in schema && value.length > schema.maxLength) addError(errors, valuePath, `must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) addError(errors, valuePath, `must match pattern ${schema.pattern}`);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if ("minimum" in schema && value < schema.minimum) addError(errors, valuePath, `must be >= ${schema.minimum}`);
    if ("exclusiveMinimum" in schema && value <= schema.exclusiveMinimum) addError(errors, valuePath, `must be > ${schema.exclusiveMinimum}`);
    if ("maximum" in schema && value > schema.maximum) addError(errors, valuePath, `must be <= ${schema.maximum}`);
    if ("exclusiveMaximum" in schema && value >= schema.exclusiveMaximum) addError(errors, valuePath, `must be < ${schema.exclusiveMaximum}`);
    if ("multipleOf" in schema && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9) addError(errors, valuePath, `must be a multiple of ${schema.multipleOf}`);
  }

  return errors;
}

function resolveSchemaPath(dataPath, data) {
  const schemaRef = data.$schema;
  if (!schemaRef) throw new Error("missing $schema");
  if (schemaRef.includes("://")) throw new Error("remote schemas are not supported by this local validator");
  return path.resolve(path.dirname(dataPath), schemaRef);
}

function validateFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const data = readJson(absolutePath);
  const schemaPath = resolveSchemaPath(absolutePath, data);
  const schema = readJson(schemaPath);
  return {
    dataPath: absolutePath,
    schemaPath,
    errors: validateValue(data, schema, schema, [], [])
  };
}

function defaultFiles() {
  const projects = walk(path.join(ROOT, "bobercad/data/projects")).filter((file) => file.endsWith(".json"));
  const connectionConfigs = walk(path.join(ROOT, "bobercad/data/libraries/connections/connections")).filter((file) => file.endsWith(`${path.sep}config.json`));
  const componentRegister = path.join(ROOT, "bobercad/data/libraries/connection-components/component-register.json");
  const componentConfigs = walk(path.join(ROOT, "bobercad/data/libraries/connection-components/components")).filter((file) => file.endsWith(`${path.sep}config.json`));
  return [...projects, ...connectionConfigs, componentRegister, ...componentConfigs];
}

function formatError(result, error) {
  return `${path.relative(ROOT, result.dataPath)} ${pathLabel(error.path)}: ${error.message}`;
}

function main() {
  const targets = process.argv.slice(2).map((item) => path.resolve(item));
  const files = targets.length ? targets : defaultFiles();
  const failures = [];

  for (const file of files) {
    try {
      const result = validateFile(file);
      for (const error of result.errors) failures.push(formatError(result, error));
    } catch (error) {
      failures.push(`${path.relative(ROOT, file)}: ${error.message}`);
    }
  }

  if (failures.length) {
    console.error("FAILED: JSON schema validation failed");
    for (const failure of failures) console.error(`ERROR: ${failure}`);
    return 1;
  }

  console.log(`OK: ${files.length} JSON files match their local schemas`);
  return 0;
}

module.exports = { validateFile, validateValue, formatError, defaultFiles };

if (require.main === module) process.exit(main());
