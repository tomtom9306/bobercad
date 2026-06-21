const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function fail(errors, message) {
  errors.push(message);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function refName(ref) {
  return String(ref || "").match(/^#\/\$defs\/(.+)$/)?.[1] || null;
}

function checkStrictProjectSchema(errors) {
  const relative = "bobercad/app/schemas/project.schema.json";
  const schema = readJson(relative);
  if (schema.additionalProperties !== false) fail(errors, `${relative}: root project object must reject unknown top-level fields`);
  if (schema.$defs?.model?.additionalProperties !== false) fail(errors, `${relative}: model must reject unknown collection names`);

  for (const [collection, spec] of Object.entries(schema.$defs?.model?.properties || {})) {
    const defName = refName(spec.additionalProperties?.$ref);
    if (!defName) continue;
    const def = schema.$defs?.[defName];
    if (!def) {
      fail(errors, `${relative}: model.${collection} points at missing definition ${defName}`);
      continue;
    }
    if (def.additionalProperties !== false) {
      fail(errors, `${relative}: model.${collection} item definition ${defName} must reject unknown fields`);
    }
  }
}

module.exports = {
  checkStrictProjectSchema
};
