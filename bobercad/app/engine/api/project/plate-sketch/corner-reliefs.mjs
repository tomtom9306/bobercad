import { finiteNonNegativeNumber, finiteNumber, finitePositiveNumber } from "../../../core/math.mjs";
import { arrayValues } from "../../../core/model.mjs";
import { plateBends, sketchVertices } from "./model-accessors.mjs";
import { fail, orderedSketchLoop, plainObject } from "./sketch-geometry-and-relations.mjs";

const CORNER_RELIEF_TYPES = new Set(["round", "circular", "rect", "rectangular", "obround"]);
const CANONICAL_CORNER_RELIEF_TYPES = new Set(["circular", "rectangular", "obround"]);
const FLANGE_GAP_MODES = new Set(["symmetric", "butt"]);
const CHILD_CORNER_PARENT_EDGES = new Set(["start", "end"]);
const CORNER_RELIEF_CLAMP_MARGIN = 1e-4;
const DEFAULT_CIRCULAR_CORNER_RELIEF_SIZE = 2;
const DEFAULT_LINEAR_CORNER_RELIEF_SIZE = 1;
const CIRCULAR_CORNER_RELIEF_SIZE_FIELD = Object.freeze({
  key: "size",
  sourceKey: "size",
  label: "Size",
  required: true,
  defaultValue: DEFAULT_CIRCULAR_CORNER_RELIEF_SIZE
});
const LINEAR_CORNER_RELIEF_SIZE_FIELD = Object.freeze({
  key: "size",
  sourceKey: "size",
  label: "Size",
  required: false,
  defaultValue: DEFAULT_LINEAR_CORNER_RELIEF_SIZE
});
const CORNER_RELIEF_FLANGE_FIELDS = Object.freeze([
  Object.freeze({
    key: "flangeGap",
    sourceKey: "flangeGap",
    label: "Flange gap",
    kind: "signed-number",
    required: false,
    defaultValue: 0
  }),
  Object.freeze({
    key: "flangeGapMode",
    sourceKey: "flangeGapMode",
    label: "Flange offset",
    kind: "select",
    required: false,
    defaultValue: "symmetric"
  }),
  Object.freeze({
    key: "flangeGapSwapped",
    sourceKey: "flangeGapSwapped",
    label: "Swap",
    kind: "boolean",
    required: false,
    defaultValue: false
  })
]);

export const PLATE_CORNER_RELIEF_PROPERTY_TABLE = Object.freeze({
  circular: Object.freeze({
    type: "circular",
    dimensions: Object.freeze([CIRCULAR_CORNER_RELIEF_SIZE_FIELD]),
    clearance: false
  }),
  rectangular: Object.freeze({
    type: "rectangular",
    dimensions: Object.freeze([LINEAR_CORNER_RELIEF_SIZE_FIELD]),
    clearance: false
  }),
  obround: Object.freeze({
    type: "obround",
    dimensions: Object.freeze([LINEAR_CORNER_RELIEF_SIZE_FIELD]),
    clearance: false
  })
});

export const PLATE_CORNER_RELIEF_TYPES = Object.freeze([...CORNER_RELIEF_TYPES]);

export function canonicalPlateCornerReliefType(type = "circular") {
  if (type === "round") return "circular";
  if (type === "rect") return "rectangular";
  return CANONICAL_CORNER_RELIEF_TYPES.has(type) ? type : "circular";
}

function canonicalReliefTypeOrNull(type) {
  if (type === "round") return "circular";
  if (type === "rect") return "rectangular";
  return CANONICAL_CORNER_RELIEF_TYPES.has(type) ? type : null;
}

export function cornerReliefPropertyDefinition(type = "circular") {
  return PLATE_CORNER_RELIEF_PROPERTY_TABLE[canonicalPlateCornerReliefType(type)] || PLATE_CORNER_RELIEF_PROPERTY_TABLE.circular;
}

function reliefPropertyFieldsForDefinition(definition) {
  const fields = [...(definition?.dimensions || [])].map((field) => ({
    key: field.key,
    sourceKey: field.sourceKey || field.key,
    label: field.label || field.key,
    kind: field.kind || "number",
    required: field.required === true,
    min: 0,
    defaultValue: field.defaultValue
  }));
  if (definition?.clearance) {
    fields.push({ key: "clearance", sourceKey: "gap", label: "Clearance", kind: "number", required: false, min: 0, defaultValue: 0 });
  }
  if (definition?.type) {
    fields.push(...CORNER_RELIEF_FLANGE_FIELDS.map((field) => ({ ...field })));
  }
  return fields;
}

function reliefRequestedDimensions(relief = {}) {
  return {
    ...(relief.size !== undefined ? { size: relief.size } : {}),
    ...(relief.radius !== undefined ? { radius: relief.radius } : {}),
    ...(relief.width !== undefined ? { width: relief.width } : {}),
    ...(relief.depth !== undefined ? { depth: relief.depth } : {}),
    ...(relief.gap !== undefined ? { gap: relief.gap } : {}),
    ...(relief.flangeGap !== undefined ? { flangeGap: relief.flangeGap } : {}),
    ...(relief.flangeGapMode !== undefined ? { flangeGapMode: relief.flangeGapMode } : {}),
    ...(relief.flangeGapSwapped !== undefined ? { flangeGapSwapped: relief.flangeGapSwapped } : {})
  };
}

function clearanceFromRelief(relief = {}) {
  // Project JSON keeps the legacy field name `gap`; the resolved model
  // contract exposes it only as cutout clearance, never as bend endpoint trim.
  return finiteNonNegativeNumber(relief.gap) ? relief.gap : 0;
}

function flangeGapFromRelief(relief = {}) {
  return finiteNumber(relief.flangeGap) ? relief.flangeGap : 0;
}

function flangeGapModeFromRelief(relief = {}) {
  return FLANGE_GAP_MODES.has(relief.flangeGapMode) ? relief.flangeGapMode : "symmetric";
}

function flangeGapSwappedFromRelief(relief = {}) {
  return relief.flangeGapSwapped === true;
}

function tableDefaultValue(value, thickness = 0) {
  const resolved = typeof value === "function" ? value(thickness) : value;
  return finiteNumber(resolved) ? Math.max(0, resolved) : resolved;
}

function defaultDimensionsForType(type, thickness = 0) {
  const definition = cornerReliefPropertyDefinition(type);
  const result = {};
  for (const field of definition.dimensions || []) {
    const value = tableDefaultValue(field.defaultValue, finiteNonNegativeNumber(thickness) ? thickness : 0);
    if (finiteNonNegativeNumber(value)) result[field.sourceKey || field.key] = value;
  }
  return result;
}

function finiteLimit(value) {
  return finitePositiveNumber(value) ? value : null;
}

function bendAngleRadians(bend) {
  const angle = finiteNumber(bend?.angle) ? bend.angle : 90;
  return Math.abs(angle) * Math.PI / 180;
}

function bendDevelopedWidth(bend) {
  const radius = finiteNonNegativeNumber(bend?.radius) ? bend.radius : 0;
  return radius * bendAngleRadians(bend);
}

function bendById(plate) {
  return new Map(plateBends(plate).map((bend) => [bend.id, bend]));
}

function automaticReliefFlatDepth(thickness, size = DEFAULT_LINEAR_CORNER_RELIEF_SIZE) {
  if (!finitePositiveNumber(thickness) || !finiteNonNegativeNumber(size)) return null;
  return thickness * size;
}

function automaticReliefDevelopedDepth(plate, site, axisIndex, flatDepth) {
  const bendId = site?.bends?.[axisIndex]?.bendId || "";
  const bend = bendById(plate).get(bendId);
  if (!bend) return null;
  const bendDepth = bendDevelopedWidth(bend);
  const reliefDepth = finiteNonNegativeNumber(flatDepth) ? flatDepth : 0;
  return bendDepth + reliefDepth;
}

function automaticReliefDevelopedDepths(plate, site, flatDepths = []) {
  return [0, 1].map((axisIndex) => automaticReliefDevelopedDepth(plate, site, axisIndex, flatDepths[axisIndex]));
}

function automaticObroundCornerRadius(thickness) {
  return finitePositiveNumber(thickness) ? thickness / 4 : null;
}

function obroundCornerRadius(width, depth, thickness, relief = {}) {
  if (!finiteNonNegativeNumber(width) || !finiteNonNegativeNumber(depth)) return null;
  const footprintLimit = Math.max(0, Math.min(width, depth) / 2);
  const requested = automaticObroundCornerRadius(thickness);
  const fallback = footprintLimit;
  return Math.max(0, Math.min(finiteNonNegativeNumber(requested) ? requested : fallback, footprintLimit));
}

function siteLimit(site, role, clearance = 0) {
  const rawLimit = role === "incoming"
    ? finiteLimit(site?.limits2d?.incoming)
    : role === "outgoing"
      ? finiteLimit(site?.limits2d?.outgoing)
      : finiteLimit(site?.limits2d?.corner);
  if (rawLimit === null) return null;
  return Math.max(0, rawLimit - Math.max(0, clearance || 0) - CORNER_RELIEF_CLAMP_MARGIN);
}

function pairedSiteLimit(site, clearance = 0) {
  const limits = [
    siteLimit(site, "incoming", clearance),
    siteLimit(site, "outgoing", clearance)
  ].filter((limit) => limit !== null);
  return limits.length ? Math.min(...limits) : null;
}

function clampResolvedDimension(value, key, limit, site, diagnostics) {
  if (!finiteNonNegativeNumber(value) || limit === null || value <= limit + 1e-7) return value;
  const effective = Math.max(0, limit);
  diagnostics.push({
    code: `corner-relief.${key}.clamped-by-edge`,
    severity: "warning",
    message: `Corner relief ${key} was clamped from ${value} to ${effective} by adjacent edge length.`,
    siteKey: site?.key || "",
    cornerReliefVertexId: site?.legacyVertexId || site?.target?.vertexId || "",
    requested: value,
    effective,
    limit
  });
  return effective;
}

function resolvedStatus(base, diagnostics) {
  if (base.status === "invalid" || base.status === "unsupported") return base.status;
  return diagnostics.some((diagnostic) => diagnostic.severity === "warning" && String(diagnostic.code || "").includes(".clamped-by-edge"))
    ? "clamped"
    : base.status;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function invalidProvidedDimension(relief, key) {
  return hasOwn(relief, key) && relief[key] !== undefined && !finiteNonNegativeNumber(relief[key]);
}

function invalidProvidedSignedDimension(relief, key) {
  return hasOwn(relief, key) && relief[key] !== undefined && !finiteNumber(relief[key]);
}

function invalidReliefDimensionKeys(relief, type) {
  const keys = new Set([
    "size",
    "radius",
    "width",
    "depth",
    "gap"
  ]);
  return [...keys].filter((key) => invalidProvidedDimension(relief, key));
}

function hasLegacyReliefDimensions(relief, type) {
  if (!plainObject(relief)) return false;
  if (type === "circular") return hasOwn(relief, "radius");
  if (type === "rectangular" || type === "obround") return hasOwn(relief, "width") && hasOwn(relief, "depth");
  return false;
}

function appendMissingDimensionDiagnostics(relief, type, diagnostics) {
  const missing = [];
  const definition = cornerReliefPropertyDefinition(type);
  for (const field of definition.dimensions || []) {
    const sourceKey = field.sourceKey || field.key;
    if (field.required && !hasOwn(relief, sourceKey) && !hasLegacyReliefDimensions(relief, type)) {
      missing.push(sourceKey);
      diagnostics.push({
        code: `corner-relief.${sourceKey}.missing`,
        severity: "error",
        message: `Corner relief ${sourceKey} must be provided explicitly for ${type}.`
      });
    }
  }
  return missing;
}

function appendInvalidDimensionDiagnostics(relief, type, diagnostics) {
  const invalidKeys = invalidReliefDimensionKeys(relief, type);
  invalidKeys.forEach((key) => {
    diagnostics.push({
      code: `corner-relief.${key}.invalid`,
      severity: "error",
      message: `Corner relief ${key} must be zero or positive.`
    });
  });
  if (invalidProvidedSignedDimension(relief, "flangeGap")) {
    invalidKeys.push("flangeGap");
    diagnostics.push({
      code: "corner-relief.flangeGap.invalid",
      severity: "error",
      message: "Corner relief flangeGap must be a finite number."
    });
  }
  return invalidKeys;
}

export function cornerReliefRequiredFields(type = "circular") {
  const definition = cornerReliefPropertyDefinition(type);
  return (definition.dimensions || [])
    .filter((field) => field.required)
    .map((field) => field.sourceKey || field.key);
}

export function resolvePlateCornerReliefSpec(relief, plate = {}, site = null) {
  const fallback = plainObject(relief) ? relief : defaultPlateCornerRelief(plate?.thickness);
  const type = canonicalReliefTypeOrNull(fallback?.type);
  const definition = type ? cornerReliefPropertyDefinition(type) : null;
  const thickness = finitePositiveNumber(plate?.thickness) ? plate.thickness : 0;
  const clearance = type && type !== "circular" ? clearanceFromRelief(fallback) : 0;
  const flangeGap = flangeGapFromRelief(fallback);
  const flangeGapMode = flangeGapModeFromRelief(fallback);
  const flangeGapSwapped = flangeGapSwappedFromRelief(fallback);
  const flangeGapExplicit = true;
  const diagnostics = [];
  const requested = reliefRequestedDimensions(fallback);
  if (!type) {
    diagnostics.push({
      code: "corner-relief.type.unsupported",
      severity: "error",
      message: `Unsupported corner relief type ${String(fallback?.type || "")}.`
    });
  }
  const invalidDimensionKeys = type ? appendInvalidDimensionDiagnostics(fallback, type, diagnostics) : ["type"];
  const missingDimensionKeys = type ? appendMissingDimensionDiagnostics(fallback, type, diagnostics) : [];
  const base = {
    source: site?.source || "",
    type: type || String(fallback?.type || "unsupported"),
    size: null,
    radius: null,
    width: null,
    depth: null,
    clearance,
    flangeGap,
    flangeGapMode,
    flangeGapSwapped,
    flangeGapExplicit,
    requested,
    properties: type ? reliefPropertyFieldsForDefinition(definition) : [],
    status: invalidDimensionKeys.length || missingDimensionKeys.length || !type ? "invalid" : "ok",
    diagnostics
  };
  if (!type) return base;
  const dimensionValue = (key) => (
    finiteNonNegativeNumber(fallback?.[key])
      ? fallback[key]
      : null
  );
  const sizeValue = () => {
    if (finiteNonNegativeNumber(fallback?.size)) return fallback.size;
    if (!thickness) return null;
    if (type === "circular" && finiteNonNegativeNumber(fallback?.radius)) return fallback.radius / thickness;
    if ((type === "rectangular" || type === "obround")
      && finiteNonNegativeNumber(fallback?.width)
      && finiteNonNegativeNumber(fallback?.depth)
    ) {
      return Math.max(fallback.width, fallback.depth) / thickness;
    }
    if (type === "rectangular" || type === "obround") return DEFAULT_LINEAR_CORNER_RELIEF_SIZE;
    return null;
  };
  const requestedSize = sizeValue();
  const scaledSize = finiteNonNegativeNumber(requestedSize) ? requestedSize * thickness : null;
  const useSemanticSize = hasOwn(fallback, "size") || !hasLegacyReliefDimensions(fallback, type);
  if (type === "circular") {
    const size = requestedSize;
    const requestedRadius = useSemanticSize ? scaledSize : dimensionValue("radius");
    const radius = clampResolvedDimension(requestedRadius, "radius", siteLimit(site, "corner", clearance), site, diagnostics);
    return { ...base, status: resolvedStatus(base, diagnostics), size, radius, properties: resolvedReliefProperties({ ...base, size, radius }, definition) };
  }
  if (type === "rectangular") {
    const size = requestedSize;
    const flatDepth = automaticReliefFlatDepth(thickness, size);
    const requestedDepth = finiteNonNegativeNumber(flatDepth)
      ? flatDepth
      : (useSemanticSize ? scaledSize : Math.max(dimensionValue("width") || 0, dimensionValue("depth") || 0));
    const resolvedDepth = clampResolvedDimension(
      requestedDepth,
      "size",
      pairedSiteLimit(site, clearance),
      site,
      diagnostics
    );
    const width = resolvedDepth;
    const depth = resolvedDepth;
    const axisDevelopedDepths = automaticReliefDevelopedDepths(plate, site, [width, depth]);
    return { ...base, status: resolvedStatus(base, diagnostics), size, width, depth, axisDevelopedDepths, properties: resolvedReliefProperties({ ...base, size, width, depth }, definition) };
  }
  if (type === "obround") {
    const size = requestedSize;
    const flatDepth = automaticReliefFlatDepth(thickness, size);
    const requestedDepth = finiteNonNegativeNumber(flatDepth)
      ? flatDepth
      : (useSemanticSize ? scaledSize : Math.max(dimensionValue("width") || 0, dimensionValue("depth") || 0));
    const resolvedDepth = clampResolvedDimension(
      requestedDepth,
      "size",
      pairedSiteLimit(site, clearance),
      site,
      diagnostics
    );
    const width = resolvedDepth;
    const depth = resolvedDepth;
    const radius = obroundCornerRadius(width, depth, thickness, fallback);
    const axisDevelopedDepths = automaticReliefDevelopedDepths(plate, site, [width, depth]);
    return { ...base, status: resolvedStatus(base, diagnostics), size, radius, width, depth, axisDevelopedDepths, properties: resolvedReliefProperties({ ...base, size, radius, width, depth }, definition) };
  }
  return base;
}

function resolvedReliefProperties(spec, definition) {
  return reliefPropertyFieldsForDefinition(definition).map((field) => ({
    ...field,
    value: field.key === "clearance"
      ? spec.clearance
      : field.key === "flangeGap"
        ? spec.flangeGap
        : field.key === "flangeGapMode"
          ? spec.flangeGapMode
          : field.key === "flangeGapSwapped"
            ? spec.flangeGapSwapped
            : spec[field.key]
  }));
}

export function defaultPlateCornerRelief(thickness = 0, type = "circular") {
  const canonicalType = canonicalPlateCornerReliefType(type);
  return {
    type: canonicalType,
    ...defaultDimensionsForType(canonicalType, thickness)
  };
}

export function normalizePlateCornerReliefSpec(relief, label = "plate corner relief") {
  if (!plainObject(relief)) fail(`${label} must be an object`);
  if (relief.mode !== undefined) fail(`${label} mode is no longer supported`);
  if (relief.flangeGapSide !== undefined) fail(`${label} flangeGapSide is no longer supported; use flangeGapMode and flangeGapSwapped`);
  if (!CORNER_RELIEF_TYPES.has(relief.type)) fail(`${label} type is unsupported: ${relief.type}`);
  const type = canonicalPlateCornerReliefType(relief.type);
  const optionalDimension = (key) => {
    const value = relief[key];
    if (value === undefined) return undefined;
    if (!finiteNonNegativeNumber(value)) fail(`${label} ${key} must be zero or positive`);
    return value;
  };
  const size = optionalDimension("size");
  const radius = optionalDimension("radius");
  const width = optionalDimension("width");
  const depth = optionalDimension("depth");
  const gap = optionalDimension("gap");
  const flangeGap = relief.flangeGap;
  if (flangeGap !== undefined && !finiteNumber(flangeGap)) fail(`${label} flangeGap must be a finite number`);
  const flangeGapMode = relief.flangeGapMode;
  if (flangeGapMode !== undefined && !FLANGE_GAP_MODES.has(flangeGapMode)) {
    fail(`${label} flangeGapMode must be symmetric or butt`);
  }
  const flangeGapSwapped = relief.flangeGapSwapped;
  if (flangeGapSwapped !== undefined && typeof flangeGapSwapped !== "boolean") fail(`${label} flangeGapSwapped must be a boolean`);
  return {
    type,
    ...(size !== undefined ? { size } : {}),
    ...(radius !== undefined ? { radius } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(gap !== undefined ? { gap } : {}),
    ...(flangeGap !== undefined ? { flangeGap } : {}),
    ...(flangeGapMode !== undefined ? { flangeGapMode } : {}),
    ...(flangeGapSwapped !== undefined ? { flangeGapSwapped } : {})
  };
}

export function normalizePlateReliefDefaults(reliefDefaults) {
  if (reliefDefaults === undefined) return undefined;
  return normalizePlateCornerReliefSpec(reliefDefaults, "plate fabrication.reliefDefaults");
}

export function generatedBendCornerVertexId(parentBendId, parentEdge, bendId) {
  return `bend_corner_${parentBendId}_${parentEdge}_${bendId}`;
}

export function normalizePlateCornerReliefs(cornerReliefs, sketch, fabrication = {}) {
  if (cornerReliefs === undefined) return undefined;
  if (!Array.isArray(cornerReliefs)) fail("plate fabrication.cornerReliefs must be an array");
  const vertexIds = new Set([
    ...sketchVertices(sketch).map((vertex) => vertex.id),
    ...plateBendCorners({ sketch, fabrication }).map((corner) => corner.vertexId)
  ]);
  const reliefIds = new Set();
  const reliefVertexIds = new Set();
  return cornerReliefs.map((relief, index) => {
    const label = `plate fabrication.cornerReliefs[${index}]`;
    if (!plainObject(relief)) fail(`${label} must be an object`);
    if (typeof relief.id !== "string" || !relief.id.trim()) fail(`${label}.id must be a non-empty string`);
    if (reliefIds.has(relief.id)) fail(`duplicate corner relief id ${relief.id}`);
    reliefIds.add(relief.id);
    if (typeof relief.vertexId !== "string" || !relief.vertexId.trim()) fail(`${label}.vertexId must be a non-empty string`);
    if (!vertexIds.has(relief.vertexId)) fail(`${label}.vertexId references unknown sketch vertex ${relief.vertexId}`);
    if (reliefVertexIds.has(relief.vertexId)) fail(`duplicate corner relief vertex ${relief.vertexId}`);
    reliefVertexIds.add(relief.vertexId);
    return {
      id: relief.id,
      vertexId: relief.vertexId,
      ...normalizePlateCornerReliefSpec(relief, label)
    };
  });
}

export function plateBendCorners(plate) {
  const bends = plateBends(plate);
  const bendByEdge = new Map(
    bends
      .filter((bend) => !bend.parentBendId)
      .map((bend) => [bend.edgeId, bend])
  );
  const bendIds = new Set(bends.map((bend) => bend.id));
  const sketchCorners = orderedSketchLoop(plate?.sketch).flatMap((corner) => {
    const incomingBend = bendByEdge.get(corner.incomingEdgeId);
    const outgoingBend = bendByEdge.get(corner.outgoingEdgeId);
    if (!incomingBend || !outgoingBend) return [];
    return [{
      id: `corner_relief_${corner.vertexId}`,
      vertexId: corner.vertexId,
      siteKey: `sketch:${corner.vertexId}`,
      scope: "sketch",
      target: {
        kind: "sketchVertex",
        vertexId: corner.vertexId
      },
      incomingEdgeId: corner.incomingEdgeId,
      outgoingEdgeId: corner.outgoingEdgeId,
      incomingBendId: incomingBend.id,
      outgoingBendId: outgoingBend.id,
      point: corner.point
    }];
  });
  const childCorners = bends.flatMap((bend) => {
    if (!bend.parentBendId || !CHILD_CORNER_PARENT_EDGES.has(bend.parentEdge) || !bendIds.has(bend.parentBendId)) return [];
    const parentEndpoint = bend.parentEdge === "end" ? "end" : "start";
    const vertexId = generatedBendCornerVertexId(bend.parentBendId, bend.parentEdge, bend.id);
    const siteKey = `bend:${bend.parentBendId}:${bend.parentEdge}:${bend.id}:start`;
    return [{
      id: `corner_relief_${vertexId}`,
      vertexId,
      siteKey,
      scope: "bend",
      target: {
        kind: "bendEndpoint",
        parentBendId: bend.parentBendId,
        parentEdge: bend.parentEdge,
        bendId: bend.id,
        endpoint: "start",
        parentEndpoint
      },
      parentBendId: bend.parentBendId,
      parentEdge: bend.parentEdge,
      targetParentBendId: bend.parentBendId,
      targetParentEdge: bend.parentEdge,
      targetEndpoint: "start",
      incomingBendId: bend.parentBendId,
      outgoingBendId: bend.id
    }];
  });
  return [...sketchCorners, ...childCorners];
}

export function plateCornerReliefs(plate) {
  const corners = plateBendCorners(plate);
  const defaults = plate?.fabrication?.reliefDefaults || (corners.length ? defaultPlateCornerRelief(plate.thickness) : null);
  const overrides = new Map(arrayValues(plate?.fabrication?.cornerReliefs).map((relief) => [relief.vertexId, relief]));
  return corners.map((corner) => {
    const override = overrides.get(corner.vertexId) || null;
    const relief = override || defaults;
    const source = override ? "override" : relief ? "default" : "missing";
    return {
      ...corner,
      id: override?.id || corner.id,
      source,
      relief: relief || null,
      resolvedRelief: relief ? resolvePlateCornerReliefSpec(relief, plate, { ...corner, source }) : null
    };
  });
}

export function cleanPlateCornerReliefFabrication(plate, fabrication) {
  const next = plainObject(fabrication) ? { ...fabrication } : {};
  const cornerVertexIds = new Set(plateBendCorners({ ...plate, fabrication: next }).map((corner) => corner.vertexId));
  if (!cornerVertexIds.size) {
    delete next.reliefDefaults;
    delete next.cornerReliefs;
    return next;
  }
  if (!next.reliefDefaults) next.reliefDefaults = defaultPlateCornerRelief(plate.thickness);
  if (Array.isArray(next.cornerReliefs)) {
    next.cornerReliefs = next.cornerReliefs.filter((relief) => cornerVertexIds.has(relief?.vertexId));
    if (!next.cornerReliefs.length) delete next.cornerReliefs;
  }
  return next;
}
