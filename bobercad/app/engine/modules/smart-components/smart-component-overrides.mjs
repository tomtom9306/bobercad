import { flattenIds, jsonClone as clone, mergeObjectPatch, normalizedIndexList, truthyValues, uniqueTruthy as unique } from "../../core/model.mjs";
import { MODEL_COLLECTIONS } from "./smart-component-model-helpers.mjs";
import { objectStringValues } from "./smart-component-catalog.mjs";
import {
  fail,
  optionalIndexArrayValue,
  optionalObjectValue,
  optionalStringValue,
  plainObject,
  requiredArrayValue,
  requiredObjectValue,
  requiredStringArrayValue
} from "./smart-component-runtime-validation.mjs";

const DEFAULT_GHOST_OPACITY = 0.01;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

export function hasDiagnosticErrors(diagnostics) {
  return diagnostics.some((entry) => entry.severity === "error");
}

export function prefixedChildDiagnostics(ctx) {
  const parentPatch = requiredObjectValue(ctx.model.smartComponentInstances[ctx.instanceId], `${ctx.instanceId}.patch`, ctx);
  const childRoles = requiredObjectValue(parentPatch.childComponentRoles, `${ctx.instanceId}.childComponentRoles`, ctx);
  const childIds = unique(objectStringValues(childRoles, `${ctx.instanceId}.childComponentRoles`, ctx));
  return childIds.flatMap((childId) => {
    const child = ctx.model.smartComponentInstances[childId];
    if (!child) fail(`${ctx.instanceId}: child Smart Component not found: ${childId}`);
    return requiredArrayValue(child.diagnostics, `${childId}.diagnostics`).map((diagnostic, index) => {
      diagnostic = requiredObjectValue(diagnostic, `${childId}.diagnostics[${index}]`);
      return {
        ...clone(diagnostic),
        source: {
          ...optionalObjectValue(diagnostic.source, {}, `${childId}.diagnostics[${index}].source`),
          componentInstanceId: childId,
          componentType: child.type,
          parentInstanceId: ctx.instanceId
        }
      };
    });
  });
}

export function addDiagnosticDisplay(model, objectIds, diagnostics) {
  if (!hasDiagnosticErrors(diagnostics)) return;
  for (const id of objectIds) {
    for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
      const object = model[collection]?.[id];
      if (object) object.display = { ...optionalObjectValue(object.display, {}, `${id}.display`), ...DIAGNOSTIC_DISPLAY };
    }
  }
}

function collectionObjectById(model, id) {
  for (const collection of MODEL_COLLECTIONS) {
    const object = model[collection]?.[id];
    if (object) return { collection, object };
  }
  return null;
}

function suppressObject(object) {
  const display = optionalObjectValue(object.display, {}, `${object.id || "object"}.display`);
  object.display = {
    ...display,
    suppressed: true,
    transparent: true,
    opacity: display.opacity ?? DEFAULT_GHOST_OPACITY
  };
}

function suppressHolePatternPositions(model, patternId, indices) {
  if (typeof patternId !== "string" || !patternId) fail("suppressed hole pattern id must be a non-empty string");
  const pattern = requiredObjectValue(model.holePatterns, "model.holePatterns")[patternId];
  if (!pattern) fail(`hole pattern not found: ${patternId}`);
  const positions = requiredArrayValue(pattern.positions, `${patternId}.positions`);
  const existing = optionalIndexArrayValue(pattern.suppressedPositionIndices, [], `${patternId}.suppressedPositionIndices`);
  const requested = optionalIndexArrayValue(indices, [], `${patternId} suppressed position indices`);
  const suppressed = normalizedIndexList([...existing, ...requested]);
  const outOfRange = suppressed.find((index) => index >= positions.length);
  if (outOfRange !== undefined) fail(`${patternId}: suppressed position index ${outOfRange} is outside ${positions.length} positions`);
  pattern.suppressedPositionIndices = suppressed;
}

function suppressFastenerHoles(model, fastenerGroup) {
  fastenerGroup = requiredObjectValue(fastenerGroup, "fastener group");
  const patternId = optionalStringValue(fastenerGroup.holePatternRef, null, `${fastenerGroup.id || "fastener group"}.holePatternRef`);
  if (!patternId) return;
  const pattern = requiredObjectValue(model.holePatterns, "model.holePatterns")[patternId];
  if (!pattern) fail(`hole pattern not found: ${patternId}`);
  suppressHolePatternPositions(model, pattern.id, requiredArrayValue(pattern.positions, `${patternId}.positions`).map((_, index) => index));
}

function suppressParticipantWelds(model, objectIds) {
  for (const weld of Object.values(requiredObjectValue(model.welds, "model.welds"))) {
    if (requiredStringArrayValue(weld.participants, `${weld.id}.participants`).some((id) => objectIds.has(id))) suppressObject(weld);
  }
}

export function applyComponentOverrides(model, roles, overrides) {
  roles = requiredObjectValue(roles, "component roles");
  overrides = requiredObjectValue(overrides, "component overrides");
  const patternPositions = requiredObjectValue(overrides.suppressedPatternPositions, "component overrides suppressedPatternPositions");
  for (const [role, indices] of Object.entries(patternPositions)) {
    if (!Object.hasOwn(roles, role)) fail(`suppressed pattern role not found: ${role}`);
    const patternId = roles[role];
    suppressHolePatternPositions(model, patternId, indices);
  }

  const objectRoles = new Set(requiredStringArrayValue(overrides.suppressedRoles, "component overrides suppressedRoles"));
  const suppressedObjectIds = new Set();
  for (const role of objectRoles) {
    if (!Object.hasOwn(roles, role)) fail(`suppressed role not found: ${role}`);
    const objectIds = flattenIds(roles[role]);
    for (const objectId of objectIds) {
      const entry = collectionObjectById(model, objectId);
      if (!entry) fail(`${role}: suppressed object not found: ${objectId}`);
      suppressObject(entry.object);
      suppressedObjectIds.add(objectId);
      if (entry.collection === "fastenerGroups") suppressFastenerHoles(model, entry.object);
    }
  }
  suppressParticipantWelds(model, suppressedObjectIds);
}

export function setNestedOutput(target, path, value) {
  if (typeof path !== "string" || !path) fail(`invalid output path ${path}`);
  const keys = path.split(".");
  if (keys.some((key) => !key)) fail(`invalid output path ${path}`);
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    if (cursor[key] === undefined) cursor[key] = {};
    if (!plainObject(cursor[key])) fail(`invalid output path ${path}`);
    cursor = cursor[key];
  }
  const leafKey = keys[keys.length - 1];
  if (Object.hasOwn(cursor, leafKey)) fail(`duplicate output path ${path}`);
  cursor[leafKey] = clone(value);
}

export function outputContractIssue(path, value) {
  const key = path.split(".").at(-1);
  if (/Ids$/.test(key)) {
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? null
      : `${path} must be an array of object ids`;
  }
  if (/Id$/.test(key)) {
    return value === null || (typeof value === "string" && value)
      ? null
      : `${path} must be a non-empty object id or null`;
  }
  return null;
}

export function applyFieldOverrides(model, fieldOverrides) {
  if (!plainObject(fieldOverrides)) fail("fieldOverrides must be an object");
  for (const [objectId, patch] of Object.entries(fieldOverrides)) {
    if (!plainObject(patch)) fail(`${objectId}: field override patch must be an object`);
    const entry = collectionObjectById(model, objectId);
    if (!entry) fail(`${objectId}: field override target not found`);
    const authoring = entry.object.authoring;
    const next = mergeObjectPatch(entry.object, patch, { skipKeys: ["id", "type"] });
    entry.object = {
      ...next,
      id: entry.object.id,
      type: entry.object.type,
      authoring: {
        ...optionalObjectValue(next.authoring, {}, `${objectId}.authoring`),
        ...optionalObjectValue(authoring, {}, `${objectId}.authoring`),
        componentStatus: "managed-with-overrides"
      }
    };
    model[entry.collection][objectId] = entry.object;
  }
}

export function fieldOverrideDiagnostics(model, fieldOverrides) {
  if (!plainObject(fieldOverrides)) fail("fieldOverrides must be an object");
  return Object.entries(fieldOverrides).flatMap(([objectId, patch]) => {
    const entry = collectionObjectById(model, objectId);
    if (!entry) fail(`${objectId}: field override target not found`);
    const controls = entry.object.authoring?.controls;
    if (controls === undefined) return [];
    const controlsObject = requiredObjectValue(controls, `${objectId}.authoring.controls`);
    if (controlsObject.kind !== "component-driven-fastener-values") return [];
    return [{
      severity: "warning",
      code: "component-driven-fastener-overridden",
      message: `${objectId}: direct fastener override masks component-driven values.`,
      objectRoles: truthyValues([entry.object.authoring?.componentRole]),
      parameterPaths: truthyValues(Object.values(optionalObjectValue(controlsObject.parameterPaths, {}, `${objectId}.authoring.controls.parameterPaths`))),
      measured: clone(patch)
    }];
  });
}
