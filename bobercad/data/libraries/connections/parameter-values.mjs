import { optionalPath, requiredPath } from "../../../app/engine/modules/connections/connection-schema.mjs";

function fastenerHoleDiameter(api, parameters, derive = {}) {
  const fastenerRef = optionalPath(parameters, derive.fastenerRef || "bolts.fastenerRef");
  const tolerance = optionalPath(parameters, derive.tolerance || "holes.tolerance", "normal");
  const customDiameter = optionalPath(parameters, derive.customDiameter || "holes.customDiameter");
  const fallbackDiameter = optionalPath(parameters, derive.fallbackDiameter || "holes.diameter");
  const fastener = fastenerRef ? api.catalogEntries?.("fasteners")?.[fastenerRef] : null;
  const shankDiameter = fastener?.shank?.diameter;
  const normal = fastener?.hole?.defaultDiameter ?? (typeof shankDiameter === "number" ? shankDiameter + 2 : fallbackDiameter);
  if (tolerance === "custom") return customDiameter ?? fallbackDiameter ?? normal;
  const catalogDiameter = fastener?.hole?.tolerances?.[tolerance];
  if (typeof catalogDiameter === "number") return catalogDiameter;
  if (typeof normal !== "number") return fallbackDiameter ?? normal;
  if (tolerance === "tight") return Math.max(shankDiameter ?? normal, normal - 1);
  if (tolerance === "loose") return normal + Math.max(2, normal - (shankDiameter ?? normal));
  return normal;
}

export function normalizedSpacingList(parameters, derive = {}, existing = []) {
  const count = Math.max(0, Number(optionalPath(parameters, derive.countPath || "")) - 1 || 0);
  const defaultValue = Number(optionalPath(parameters, derive.defaultPath || "", derive.defaultValue || 0)) || 0;
  const source = Array.isArray(existing) ? existing : [];
  return Array.from({ length: count }, (_, index) => {
    const value = source[index];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : defaultValue;
  });
}

function spacingSpan(parameters, modePath, countPath, equalPath, customPath) {
  const count = Math.max(0, Number(optionalPath(parameters, countPath)) - 1 || 0);
  if (optionalPath(parameters, modePath, "equal") === "custom") {
    return normalizedSpacingList(parameters, {
      countPath,
      defaultPath: equalPath
    }, optionalPath(parameters, customPath, [])).reduce((sum, value) => sum + value, 0);
  }
  return count * (Number(optionalPath(parameters, equalPath, 0)) || 0);
}

function boltEdgeDistance(parameters, derive = {}) {
  const size = Number(optionalPath(parameters, derive.sizePath, 0)) || 0;
  const span = spacingSpan(parameters, derive.spacingModePath, derive.countPath, derive.equalSpacingPath, derive.customSpacingPath);
  return Math.max(0, (size - span) / 2);
}

export function parameterValue(definition, parameters, path, api) {
  const spec = definition.parameters[path];
  if (spec.derive?.kind === "fastenerHoleDiameter") return fastenerHoleDiameter(api, parameters, spec.derive);
  if (spec.derive?.kind === "spacingList") return normalizedSpacingList(parameters, spec.derive, optionalPath(parameters, path, spec.default || []));
  if (spec.derive?.kind === "boltEdgeDistance") return optionalPath(parameters, path) ?? boltEdgeDistance(parameters, spec.derive);
  if (spec.derive?.kind === "sameAsParameter") return optionalPath(parameters, path) ?? optionalPath(parameters, spec.derive.sourcePath, spec.default ?? 0);
  return spec.required === false
    ? optionalPath(parameters, path, spec.default ?? 0)
    : requiredPath(parameters, path, definition.type);
}

export function conditionMatches(condition, parameters) {
  if (!condition) return true;
  if (Array.isArray(condition.all)) return condition.all.every((entry) => conditionMatches(entry, parameters));
  const value = optionalPath(parameters, condition.path);
  if (Object.hasOwn(condition, "equals")) return value === condition.equals;
  if (Object.hasOwn(condition, "notEquals")) return value !== condition.notEquals;
  if (Object.hasOwn(condition, "greaterThan")) return Number(value) > condition.greaterThan;
  if (Array.isArray(condition.in)) return condition.in.includes(value);
  return true;
}

export function conditionDependsOn(condition, path) {
  if (!condition) return false;
  if (Array.isArray(condition.all)) return condition.all.some((entry) => conditionDependsOn(entry, path));
  return condition.path === path;
}
