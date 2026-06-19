import { createSemanticBuilders } from "../../api/model/semantic-builders.mjs";
import { createCheckApi } from "../../api/model/checks.mjs";
import { createGeometryApi } from "../../api/model/geometry.mjs";
import { modelOperationBuilder } from "../../api/model/connection-primitive-registry.mjs";
import { createMemberObject } from "../../api/project/member-factory.mjs";
import { memberLayoutAxis } from "../../api/project/members.mjs";
import { removeProjectObjects } from "../../api/project/objects.mjs";
import { smartComponentDetachedObjectIds, smartComponentOwnedObjectIds } from "../../api/project/dependencies.mjs";
import { libraryProfileById } from "../../api/project/profiles.mjs";
import { closestAxisSegmentPoints, finitePositiveNumber, finiteVec3, v } from "../../core/math.mjs";
import { arrayValues, flattenIds, isPlainObject as plainObject, jsonClone as clone, mergeObjectPatch, normalizedIndexList, objectById, truthyValues, uniqueTruthy as unique } from "../../core/model.mjs";
import { resolveInterface } from "../../geometry/member-geometry.mjs";
import { optionalPath, requiredPath, validateSmartComponentParameters } from "./smart-component-parameters-and-definition.mjs";

const MODEL_COLLECTIONS = ["groups", "interfaces", "connectionZones", "assemblies", "gridSystems", "levels", "members", "plates", "sketches", "holePatterns", "objectPatterns", "workPoints", "referencePlanes", "features", "trimJoints", "fastenerGroups", "welds", "smartComponentInstances"];
const MODEL_COLLECTION_SET = new Set(MODEL_COLLECTIONS);
const AXIS_EPSILON = 1e-9;
const SMART_COMPONENT_PRUNE_ARRAYS = (key) => key.endsWith("Ids");
const DEFAULT_GHOST_OPACITY = 0.01;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

function fail(message) {
  throw new Error(`smart component engine: ${message}`);
}

function reject(ctx, message) {
  if (ctx) ctx.fail(message);
  fail(message);
}

function optionalObjectValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!plainObject(value)) reject(ctx, `${label} must be an object`);
  return value;
}

function requiredObjectValue(value, label, ctx = null) {
  if (!plainObject(value)) reject(ctx, `${label} must be an object`);
  return value;
}

function optionalStringValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string`);
  return value;
}

function requiredStringValue(value, label, ctx = null) {
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string`);
  return value;
}

function optionalMemberEndValue(value, label, ctx = null) {
  if (value === undefined) return undefined;
  if (value === "start" || value === "end") return value;
  reject(ctx, `${label} must be start or end`);
}

function optionalNullableStringValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) reject(ctx, `${label} must be a non-empty string or null`);
  return value;
}

function optionalStringArrayValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    reject(ctx, `${label} must be an array of non-empty strings`);
  }
  return value;
}

function requiredStringArrayValue(value, label, ctx = null) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    reject(ctx, `${label} must be an array of non-empty strings`);
  }
  return value;
}

function requiredArrayValue(value, label, ctx = null) {
  if (!Array.isArray(value)) reject(ctx, `${label} must be an array`);
  return value;
}

function optionalIndexArrayValue(value, fallback, label, ctx = null) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item) || item < 0)) {
    reject(ctx, `${label} must be an array of non-negative integers`);
  }
  return value;
}

function safeId(value, label = "id") {
  requiredStringValue(value, label);
  const id = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!id) fail(`${label} must contain an alphanumeric character`);
  return id;
}

const vec3 = (value, label) => finiteVec3(value, label, fail);

function projectModel(project, label = "project") {
  return requiredObjectValue(requiredObjectValue(project, label).model, `${label}.model`);
}

function projectObjectIndex(project, label = "project") {
  return requiredObjectValue(requiredObjectValue(project, label).objectIndex, `${label}.objectIndex`);
}

function projectCollection(project, collection, label = "project") {
  const model = projectModel(project, label);
  if (model[collection] === undefined) model[collection] = {};
  return requiredObjectValue(model[collection], `${label}.model.${collection}`);
}

function nextId(project, base) {
  const objectIndex = projectObjectIndex(project);
  const cleanBase = safeId(base);
  let id = cleanBase;
  let index = 2;
  while (objectIndex[id]) {
    id = `${cleanBase}_${index}`;
    index += 1;
  }
  return id;
}

function setId(list, id, included) {
  const values = optionalStringArrayValue(list, [], "assembly object id list");
  return included ? unique([...values, id]) : values.filter((value) => value !== id);
}

function componentEntries(definition, ctx = null) {
  return requiredArrayValue(definition.components, `${definition.type || "definition"}.components`, ctx)
    .map((component, index) => requiredObjectValue(component, `${definition.type || "definition"}.components[${index}]`, ctx));
}

function setAssemblyPlateIncluded(assembly, plateId, included) {
  return {
    ...assembly,
    partIds: setId(assembly.partIds, plateId, included),
    plateIds: setId(assembly.plateIds, plateId, included)
  };
}

function objectIndexFor(model) {
  const objectIndex = {};
  for (const [collection, objects] of Object.entries(requiredObjectValue(model, "model patch"))) {
    if (!MODEL_COLLECTION_SET.has(collection)) fail(`unsupported model patch collection ${collection}`);
    for (const [key, object] of Object.entries(requiredObjectValue(objects, `model.${collection}`))) {
      const id = requiredStringValue(object?.id, `${collection}.${key}.id`);
      const type = requiredStringValue(object?.type, `${collection}.${key}.type`);
      if (id !== key) fail(`${collection}.${key} id mismatch: ${id}`);
      objectIndex[key] = { collection, type };
    }
  }
  return objectIndex;
}

function projectObject(project, collection, id) {
  const object = projectCollection(project, collection)[id];
  if (!object) fail(`missing ${collection}.${id}`);
  return object;
}

function resolvedProjectObject(project, collection, id) {
  projectObject(project, collection, id);
  return objectById(project, id);
}

function catalogPresets(catalog) {
  return requiredObjectValue(requiredObjectValue(catalog, "smart component catalog").smartComponents, "smart component catalog.smartComponents");
}

function catalogDefinitions(catalog) {
  return requiredObjectValue(requiredObjectValue(catalog, "smart component catalog").definitions, "smart component catalog.definitions");
}

function smartComponentPreset(catalog, instance) {
  const label = instance.id || "smart component";
  const sourceComponent = requiredObjectValue(instance.sourceComponent, `${label}.sourceComponent`);
  const presetId = requiredStringValue(sourceComponent.id, `${label}.sourceComponent.id`);
  return smartComponentPresetById(catalog, presetId, instance.id);
}

function smartComponentPresetById(catalog, presetId, label = "smart component") {
  requiredStringValue(presetId, `${label}.presetId`);
  const preset = catalogPresets(catalog)[presetId];
  if (!preset) fail(`${label}: preset not found: ${presetId}`);
  return preset;
}

function smartComponentDefinitionForPreset(catalog, preset, label) {
  const definition = catalogDefinitions(catalog)[preset.type];
  if (!definition) fail(`${label}: definition not found for ${preset.type}`);
  return definition;
}

function smartComponentPresetName(preset, label) {
  return requiredStringValue(preset.name, `${label}.name`);
}

function objectStringValues(object, label, ctx = null) {
  return Object.entries(requiredObjectValue(object, label, ctx)).map(([key, value]) => (
    requiredStringValue(value, `${label}.${key}`, ctx)
  ));
}

function smartComponentDefinitionForInstance(catalog, instance) {
  const preset = smartComponentPreset(catalog, instance);
  return smartComponentDefinitionForPreset(catalog, preset, instance.id);
}

function mergedProjectView(project, modelPatch) {
  const next = {
    ...project,
    objectIndex: { ...projectObjectIndex(project), ...objectIndexFor(modelPatch) },
    model: { ...projectModel(project) }
  };
  for (const [collection, objects] of Object.entries(modelPatch)) {
    next.model[collection] = { ...projectCollection(next, collection), ...objects };
  }
  return next;
}

function mergePatchModel(target, patch) {
  const patchModel = requiredObjectValue(
    requiredObjectValue(patch, "smart component patch").model,
    "smart component patch.model"
  );
  for (const [collection, objects] of Object.entries(patchModel)) {
    Object.assign(requiredObjectValue(target[collection], `smart component target model.${collection}`), objects);
  }
}

function connectionTolerance(project) {
  const tolerances = project.settings?.tolerances;
  if (!tolerances) fail("project settings.tolerances is required");
  for (const key of ["connectionGap", "snap", "coincident"]) {
    if (!finitePositiveNumber(tolerances[key])) fail(`project settings.tolerances.${key} must be positive`);
  }
  return Math.max(
    tolerances.connectionGap,
    tolerances.snap,
    tolerances.coincident
  );
}

function memberLine(member) {
  return {
    start: vec3(member.start, `${member.id}.start`),
    end: vec3(member.end, `${member.id}.end`)
  };
}

function memberLayoutLine(member) {
  return memberLayoutAxis(member);
}

function stationOnLine(point, line) {
  const axis = v.sub(line.end, line.start);
  const length = v.len(axis);
  if (length <= AXIS_EPSILON) fail("cannot station zero-length axis");
  return v.dot(v.sub(point, line.start), v.mul(axis, 1 / length));
}

function lineAxisSegment(line, label) {
  const axis = v.sub(line.end, line.start);
  const length = v.len(axis);
  if (length <= AXIS_EPSILON) fail(`${label}: zero-length layout axis`);
  return {
    start: line.start,
    end: line.end,
    direction: v.mul(axis, 1 / length),
    length
  };
}

function closestLayoutAxisPoints(main, secondary) {
  const a = lineAxisSegment(memberLayoutLine(main), main.id);
  const b = lineAxisSegment(memberLayoutLine(secondary), secondary.id);
  const closest = closestAxisSegmentPoints(a, b, AXIS_EPSILON);
  if (!closest) fail("could not resolve closest layout axis points");
  return {
    pointA: closest.pointA,
    pointB: closest.pointB,
    stationA: stationOnLine(closest.pointA, a),
    stationB: stationOnLine(closest.pointB, b),
    lengthA: a.length,
    lengthB: b.length
  };
}

function memberEndAtStation(station, length, tolerance) {
  if (station <= tolerance) return "start";
  if (length - station <= tolerance) return "end";
  return null;
}

function autoConnectionRoles(project, memberIds) {
  const tolerance = connectionTolerance(project);
  const first = objectById(project, memberIds[0]);
  const second = objectById(project, memberIds[1]);
  const axes = closestLayoutAxisPoints(first, second);
  const distance = v.len(v.sub(axes.pointA, axes.pointB));
  if (distance > tolerance) {
    fail(`selected member layout axes do not intersect within ${tolerance} mm: ${memberIds.join(", ")}`);
  }

  const firstEnd = memberEndAtStation(axes.stationA, axes.lengthA, tolerance);
  const secondEnd = memberEndAtStation(axes.stationB, axes.lengthB, tolerance);
  const intersection = v.mul(v.add(axes.pointA, axes.pointB), 0.5);

  if (secondEnd) {
    return {
      mainMember: first,
      mainEnd: firstEnd,
      secondaryMember: second,
      secondaryEnd: secondEnd,
      intersection,
      mainStation: stationOnLine(intersection, memberLine(first))
    };
  }
  if (firstEnd) {
    return {
      mainMember: second,
      mainEnd: secondEnd,
      secondaryMember: first,
      secondaryEnd: firstEnd,
      intersection,
      mainStation: stationOnLine(intersection, memberLine(second))
    };
  }

  fail(`selected member layout axes intersect away from a member end: ${memberIds.join(", ")}`);
}

function indexedCollectionForObject(project, objectId) {
  const indexed = projectObjectIndex(project)[objectId]?.collection;
  if (!indexed) return null;
  return projectCollection(project, indexed)[objectId] ? indexed : null;
}

function collectionForObject(project, objectId) {
  const collection = indexedCollectionForObject(project, objectId);
  if (collection) return collection;
  fail(`object not found: ${objectId}`);
}

function hasDiagnosticErrors(diagnostics) {
  return diagnostics.some((entry) => entry.severity === "error");
}

function prefixedChildDiagnostics(ctx) {
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

function addDiagnosticDisplay(model, objectIds, diagnostics) {
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

function applyComponentOverrides(model, roles, overrides) {
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

function setNestedOutput(target, path, value) {
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

function outputContractIssue(path, value) {
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

function applyFieldOverrides(model, fieldOverrides) {
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

function fieldOverrideDiagnostics(model, fieldOverrides) {
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

function defaultGhostComponentRoles(definition) {
  return componentEntries(definition).flatMap((component, index) => {
    const role = requiredStringValue(component.role, `${definition.type || "definition"}.components[${index}].role`);
    return component.default === "ghost" ? [role] : [];
  });
}

export function smartComponentById(project, instanceId) {
  const instance = projectCollection(project, "smartComponentInstances")[instanceId];
  if (!instance) fail(`smart component not found: ${instanceId}`);
  return instance;
}

function instanceInput(instance, key) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalObjectValue(inputs[key], {}, `${instance.id}.inputs.${key}`);
}

function instanceMainMemberId(instance) {
  return instanceInput(instance, "main").memberId;
}

function instanceSecondaryMemberId(instance) {
  return instanceInput(instance, "secondary").memberId;
}

function instanceConnectionZoneId(instance) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalStringValue(inputs.connectionZoneId, null, `${instance.id}.inputs.connectionZoneId`);
}

function instanceAssemblyId(instance) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalStringValue(inputs.assemblyId, null, `${instance.id}.inputs.assemblyId`);
}

function matchingConnectionZones(project, memberIds) {
  return Object.values(projectCollection(project, "connectionZones")).flatMap((zone) => {
    const secondaryIds = optionalStringArrayValue(zone.secondaryObjectIds, [], `${zone.id}.secondaryObjectIds`);
    if (zone.mainObjectId === memberIds[0] && secondaryIds.includes(memberIds[1])) {
      return [{ zone, mainMemberId: memberIds[0], secondaryMemberId: memberIds[1] }];
    }
    if (zone.mainObjectId === memberIds[1] && secondaryIds.includes(memberIds[0])) {
      return [{ zone, mainMemberId: memberIds[1], secondaryMemberId: memberIds[0] }];
    }
    return [];
  });
}

function generatedSmartComponentHelperAuthoring(instanceId = null) {
  return {
    source: "smart-component-api",
    lifecycle: "delete-with-smart-component",
    status: "generated",
    ...(instanceId ? { componentInstanceId: instanceId, componentStatus: "managed" } : {})
  };
}

function connectionInterfaceDefinitions(definition) {
  const interfaces = definition?.interfaces;
  if (!Array.isArray(interfaces) || !interfaces.length) fail(`${definition?.type || "definition"}: connection interfaces are required`);
  return interfaces;
}

function autoInterfaceSpec(definition, preset, role) {
  const entry = connectionInterfaceDefinitions(definition).find((item) => item.role === role);
  if (!entry) fail(`${preset.type}: missing ${role} interface`);
  return requiredObjectValue(entry.auto, `${preset.type}.${role}.auto`);
}

function autoConnectionObjects(project, memberIds, definition, preset) {
  const roles = autoConnectionRoles(project, memberIds);
  const interfaces = connectionInterfaceDefinitions(definition);
  const interfaceRoles = new Set(interfaces.map((entry) => entry.role));
  if (!interfaceRoles.has("main") || !interfaceRoles.has("secondary") || interfaceRoles.size !== 2) {
    fail(`${preset.type}: automatic connection zones currently support main and secondary interfaces only`);
  }

  const base = `${roles.mainMember.id}_${roles.secondaryMember.id}_${preset.type}`;
  const mainInterfaceId = nextId(project, `if_${base}_main`);
  const secondaryInterfaceId = nextId(project, `if_${base}_secondary`);
  const zoneId = nextId(project, `cz_${base}`);
  const assemblyId = nextId(project, `assembly_${base}`);
  const mainSpec = autoInterfaceSpec(definition, preset, "main");
  const secondarySpec = autoInterfaceSpec(definition, preset, "secondary");
  const mainType = requiredStringValue(mainSpec.type, `${preset.type}.main.auto.type`);
  const secondaryType = requiredStringValue(secondarySpec.type, `${preset.type}.secondary.auto.type`);
  const mainEnd = mainType === "member-end-face"
    ? optionalMemberEndValue(mainSpec.memberEnd, `${preset.type}.main.auto.memberEnd`) || roles.mainEnd
    : null;
  if (mainType === "member-end-face" && !mainEnd) {
    fail(`${preset.type}: automatic main member-end interface requires the main member to meet at an end`);
  }
  const secondaryFaceRef = secondarySpec.faceRef === undefined ? undefined : requiredStringValue(secondarySpec.faceRef, `${preset.type}.secondary.auto.faceRef`);
  const authoring = generatedSmartComponentHelperAuthoring();
  const generatedInterfaces = {
    main: {
      id: mainInterfaceId,
      type: mainType,
      ownerId: roles.mainMember.id,
      role: "connection-main",
      ...(mainEnd ? { memberEnd: mainEnd } : {}),
      ...(mainEnd ? {} : { faceRef: requiredStringValue(mainSpec.faceRef, `${preset.type}.main.auto.faceRef`) }),
      ...(mainEnd || mainSpec.stationReference === undefined ? {} : { stationReference: requiredStringValue(mainSpec.stationReference, `${preset.type}.main.auto.stationReference`) }),
      authoring
    },
    secondary: {
      id: secondaryInterfaceId,
      type: secondaryType,
      ownerId: roles.secondaryMember.id,
      role: "connection-secondary",
      ...(secondaryFaceRef ? { faceRef: secondaryFaceRef } : {}),
      memberEnd: roles.secondaryEnd,
      authoring
    }
  };

  const interfaceIds = interfaces.map((entry) => generatedInterfaces[entry.role].id);
  const zone = {
    id: zoneId,
    type: `${preset.type}-zone`,
    name: `${smartComponentPresetName(preset, preset.id)} zone`,
    mainObjectId: roles.mainMember.id,
    secondaryObjectIds: [roles.secondaryMember.id],
    origin: roles.intersection,
    interfaceIds,
    smartComponentInstanceIds: [],
    objectIds: [],
    authoring
  };
  const assembly = {
    id: assemblyId,
    type: "connection-assembly",
    name: `${smartComponentPresetName(preset, preset.id)} assembly`,
    parentAssemblyId: null,
    childAssemblyIds: unique([roles.mainMember.assemblyId, roles.secondaryMember.assemblyId]),
    memberIds: [roles.mainMember.id, roles.secondaryMember.id],
    connectionZoneIds: [zoneId],
    smartComponentInstanceIds: [],
    authoring
  };
  return {
    roles,
    interfaces: interfaceIds.map((id) => Object.values(generatedInterfaces).find((iface) => iface.id === id)),
    zone,
    assembly
  };
}

function addModelObject(project, collection, object) {
  const objects = projectCollection(project, collection);
  const objectIndex = projectObjectIndex(project);
  if (!object?.id) fail(`${collection}: object id is required`);
  if (!object.type) fail(`${collection}.${object.id} missing type`);
  if (objects[object.id] || objectIndex[object.id]) fail(`object already exists: ${object.id}`);
  objects[object.id] = clone(object);
  objectIndex[object.id] = { collection, type: object.type };
}

function addAutoConnectionObjects(project, auto) {
  for (const iface of auto.interfaces) addModelObject(project, "interfaces", iface);
  addModelObject(project, "connectionZones", auto.zone);
  addModelObject(project, "assemblies", auto.assembly);
}

function markAutoConnectionObjects(project, auto, instanceId) {
  for (const { collection, id } of [
    ...auto.interfaces.map((iface) => ({ collection: "interfaces", id: iface.id })),
    { collection: "connectionZones", id: auto.zone.id },
    { collection: "assemblies", id: auto.assembly.id }
  ]) {
    projectObject(project, collection, id).authoring = generatedSmartComponentHelperAuthoring(instanceId);
  }
}

function zoneAssemblyId(project, zone) {
  const matches = Object.values(projectCollection(project, "assemblies")).filter((assembly) => (
    optionalStringArrayValue(assembly.connectionZoneIds, [], `${assembly.id}.connectionZoneIds`).includes(zone.id)
  ));
  if (matches.length > 1) fail(`${zone.id}: multiple assemblies reference the connection zone`);
  if (matches.length === 1) return matches[0].id;
  fail(`${zone.id}: no assembly references the connection zone`);
}

function nextSmartComponentId(project, zone, preset) {
  const objectIndex = projectObjectIndex(project);
  const type = safeId(preset.type);
  const base = `sc_${zone.id}_${type}`;
  let id = base;
  let index = 2;
  while (objectIndex[id]) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

function smartComponentSourceComponent(preset, version = preset.version) {
  return { library: "smart-components", id: preset.id, version };
}

function addSmartComponentInstance(project, instanceId, preset, instance) {
  projectCollection(project, "smartComponentInstances")[instanceId] = instance;
  projectObjectIndex(project)[instanceId] = { collection: "smartComponentInstances", type: preset.type };
  return instance;
}

function smartComponentInstanceRecord({
  id,
  type,
  kind,
  sourceComponent,
  inputs,
  parameters,
  parentInstanceId = null,
  parentRole = null,
  objectRoles = {},
  ownedObjectIds = [],
  managedFields = {},
  fieldOverrides = {},
  detachedObjectIds = [],
  suppressedRoles = [],
  suppressedPatternPositions = {}
}) {
  return {
    id,
    type,
    kind,
    sourceComponent,
    inputs: clone(optionalObjectValue(inputs, {}, `${id}.inputs`)),
    referenceParameters: clone(optionalObjectValue(parameters, {}, `${id}.parameters`)),
    parentInstanceId,
    parentRole,
    childComponentRoles: {},
    objectRoles: clone(optionalObjectValue(objectRoles, {}, `${id}.objectRoles`)),
    outputs: {},
    ownedObjectIds: clone(optionalStringArrayValue(ownedObjectIds, [], `${id}.ownedObjectIds`)),
    managedFields: clone(optionalObjectValue(managedFields, {}, `${id}.managedFields`)),
    fieldOverrides: clone(optionalObjectValue(fieldOverrides, {}, `${id}.fieldOverrides`)),
    detachedObjectIds: clone(optionalStringArrayValue(detachedObjectIds, [], `${id}.detachedObjectIds`)),
    suppressedRoles: clone(optionalStringArrayValue(suppressedRoles, [], `${id}.suppressedRoles`)),
    suppressedPatternPositions: clone(optionalObjectValue(suppressedPatternPositions, {}, `${id}.suppressedPatternPositions`)),
    status: "generated",
    health: "ok",
    diagnostics: []
  };
}

export function createProjectSmartComponentFromPreset(project, catalog, presetId, memberIds = [], options = {}) {
  options = optionalObjectValue(options, {}, "smart component creation options");
  const preset = smartComponentPresetById(catalog, presetId, "new smart component");
  const definition = requiredObjectValue(options.definition, "smart component definition");
  const initialSuppressedRoles = defaultGhostComponentRoles(definition);
  const presetInputs = optionalObjectValue(preset.inputs, {}, `${preset.id}.inputs`);
  const presetParameters = optionalObjectValue(preset.parameters, {}, `${preset.id}.parameters`);
  const parentInstanceId = optionalNullableStringValue(options.parentInstanceId, null, "smart component parentInstanceId");
  const parentRole = optionalNullableStringValue(options.parentRole, null, "smart component parentRole");
  const presetName = smartComponentPresetName(preset, preset.id);
  if (preset.kind !== "connection") {
    const next = clone(project);
    const instanceId = nextId(next, `sc_${safeId(preset.type)}`);
    const sourceComponent = smartComponentSourceComponent(preset);
    const inputs = options.inputs === undefined
      ? presetInputs
      : optionalObjectValue(options.inputs, {}, "smart component inputs");
    addSmartComponentInstance(next, instanceId, preset, {
      ...smartComponentInstanceRecord({
        id: instanceId,
        type: preset.type,
        kind: preset.kind,
        sourceComponent,
        inputs: clone(inputs),
        parameters: presetParameters,
        parentInstanceId,
        parentRole,
        suppressedRoles: initialSuppressedRoles
      }),
      authoring: {
        source: "smart-component-library",
        sourceComponent
      },
      bim: { name: presetName }
    });
    return { project: next, smartComponentId: instanceId, instanceId };
  }

  if (!Array.isArray(memberIds) || memberIds.length !== 2) fail("select exactly two members");
  if (memberIds[0] === memberIds[1]) fail("selected members must be different");
  for (const memberId of memberIds) projectObject(project, "members", memberId);

  const matches = matchingConnectionZones(project, memberIds);
  if (matches.length > 1) fail(`multiple stored connection zones for selected members: ${memberIds.join(", ")}`);

  const auto = matches.length ? null : autoConnectionObjects(project, memberIds, definition, preset);
  const { zone, mainMemberId, secondaryMemberId } = matches[0] || {
    zone: auto.zone,
    mainMemberId: auto.roles.mainMember.id,
    secondaryMemberId: auto.roles.secondaryMember.id
  };
  if (optionalStringArrayValue(zone.smartComponentInstanceIds, [], `${zone.id}.smartComponentInstanceIds`).length) fail(`${zone.id}: smart component already exists`);

  const next = clone(project);
  if (auto) addAutoConnectionObjects(next, auto);
  const instanceId = nextSmartComponentId(next, zone, preset);
  const sourceComponent = smartComponentSourceComponent(preset);
  addSmartComponentInstance(next, instanceId, preset, {
    ...smartComponentInstanceRecord({
      id: instanceId,
      type: preset.type,
      kind: "connection",
      sourceComponent,
      inputs: {
        ...presetInputs,
        main: { memberId: mainMemberId },
        secondary: { memberId: secondaryMemberId },
        connectionZoneId: zone.id,
        assemblyId: zoneAssemblyId(next, zone)
      },
      parameters: presetParameters,
      parentInstanceId,
      parentRole,
      suppressedRoles: initialSuppressedRoles
    }),
    authoring: {
      source: "smart-component-library",
      sourceComponent,
      notes: auto
        ? "Created from selected smart component and an automatically generated connection zone."
        : "Created from selected smart component and stored connection zone."
    },
    bim: {
      name: presetName
    }
  });

  if (auto) markAutoConnectionObjects(next, auto, instanceId);
  next.model.connectionZones[zone.id] = {
    ...next.model.connectionZones[zone.id],
    smartComponentInstanceIds: unique([...optionalStringArrayValue(next.model.connectionZones[zone.id].smartComponentInstanceIds, [], `${zone.id}.smartComponentInstanceIds`), instanceId])
  };

  const assembly = next.model.assemblies[next.model.smartComponentInstances[instanceId].inputs.assemblyId];
  assembly.smartComponentInstanceIds = unique([...optionalStringArrayValue(assembly.smartComponentInstanceIds, [], `${assembly.id}.smartComponentInstanceIds`), instanceId]);
  return { project: next, smartComponentId: instanceId, instanceId };
}

class SmartComponentBuildContext {
  constructor({ project, profiles, definition, catalog, fasteners, materials, instanceId, parameters }) {
    this.project = project;
    this.profiles = profiles;
    this.definition = definition;
    this.catalog = catalog;
    this.fasteners = fasteners;
    this.materials = materials;
    this.instance = smartComponentById(project, instanceId);
    this.instanceId = instanceId;
    this.mainMemberId = instanceMainMemberId(this.instance);
    this.secondaryMemberId = instanceSecondaryMemberId(this.instance);
    this.connectionZoneId = instanceConnectionZoneId(this.instance);
    this.assemblyId = instanceAssemblyId(this.instance);
    this.preset = smartComponentPreset(catalog, this.instance);
    this.parameters = clone(parameters);
    this.inputs = clone(requiredObjectValue(this.instance.inputs, `${instanceId}.inputs`, this));
    this.roles = {};
    this.generatedRoleSuffixes = {};
    this.childComponentRoles = {};
    this.outputs = {};
    this.diagnostics = [];
    this.model = Object.fromEntries(MODEL_COLLECTIONS.map((collection) => [collection, {}]));
    this.model.smartComponentInstances[this.instanceId] = {
      ...clone(this.instance),
      childComponentRoles: {}
    };
    this.zone = this.instance.kind === "connection" ? projectObject(project, "connectionZones", instanceConnectionZoneId(this.instance)) : null;
    if (this.zone) this.model.connectionZones[this.zone.id] = clone(this.zone);
    this.geometry = createGeometryApi();
    this.check = createCheckApi(this);
    const memberAccessor = this.member.bind(this);
    const semanticBuilders = createSemanticBuilders(this);
    Object.assign(this, semanticBuilders);
    this.member = Object.assign(memberAccessor, requiredObjectValue(semanticBuilders.member, "semanticBuilders.member", this));
    this.component = {
      create: (role, config) => this.createChildComponent(role, config)
    };
  }

  fail(message) {
    fail(`${this.instanceId}: ${message}`);
  }

  diagnostic(severity, code, message, details = {}) {
    if (!["error", "warning"].includes(severity)) this.fail(`unsupported diagnostic severity ${severity}`);
    if (details.parameters !== undefined) this.fail(`${code}.parameters is not supported; use parameterPaths`);
    if (details.resolve !== undefined && !Array.isArray(details.resolve)) this.fail(`${code}.resolve must be an array`);
    this.diagnostics.push({
      severity,
      code,
      message,
      ...(details.source ? { source: clone(details.source) } : {}),
      ...(details.ruleId ? { ruleId: details.ruleId } : {}),
      ...(details.clause ? { clause: details.clause } : {}),
      ...(details.objectRoles ? { objectRoles: details.objectRoles } : {}),
      ...(details.parameterPaths ? { parameterPaths: details.parameterPaths, parameters: details.parameterPaths } : {}),
      ...(details.measured !== undefined ? { measured: clone(details.measured) } : {}),
      ...(details.allowed !== undefined ? { allowed: clone(details.allowed) } : {}),
      ...(details.resolve !== undefined ? { resolve: clone(details.resolve) } : {})
    });
  }

  error(code, message, details = {}) {
    this.diagnostic("error", code, message, details);
  }

  param(path) {
    return requiredPath(this.parameters, path, this.definition.type);
  }

  parameterValue(path, options = {}) {
    const value = optionalPath(this.parameters, path);
    if (value !== undefined) return value;
    const spec = this.definition.parameters?.[path];
    if (spec?.default !== undefined) return clone(spec.default);
    if (options.required === false) return undefined;
    this.error(options.code || "missing-component-parameter", options.message || `${this.definition.type}: missing parameter ${path}`, {
      parameterPaths: [path],
      ...(options.resolve !== undefined ? { resolve: options.resolve } : {})
    });
    return undefined;
  }

  input(path) {
    return optionalPath(this.inputs, path);
  }

  requiredInput(path, options = {}) {
    const value = optionalPath(this.inputs, path);
    if (value !== undefined) return value;
    this.error(options.code || "missing-component-input", options.message || `${this.definition.type}: missing input ${path}`, {
      parameterPaths: [path],
      ...(options.resolve !== undefined ? { resolve: options.resolve } : {})
    });
    return undefined;
  }

  generatedRole(role, suffix = `_${role}`) {
    if (typeof role !== "string" || !role) this.fail(`invalid generated role ${role}`);
    if (typeof suffix !== "string" || !suffix) this.fail(`${role}: generated role suffix must be text`);
    this.generatedRoleSuffixes[role] = suffix;
    return role;
  }

  output(path, value) {
    const contractIssue = outputContractIssue(path, value);
    if (contractIssue) {
      this.error("smart-component-output-contract", `${this.definition.type}: ${contractIssue}`, {
        parameterPaths: [`outputs.${path}`],
        measured: value
      });
    }
    setNestedOutput(this.outputs, path, value);
    return value;
  }

  operation(type, input) {
    input = requiredObjectValue(input, `${type}: operation input`, this);
    const build = modelOperationBuilder(type);
    return build(this, input);
  }

  createChildComponent(role, config) {
    config = requiredObjectValue(config, `${role}: child component config`, this);
    const componentRef = requiredStringValue(config.componentRef, `${role}: child component componentRef`, this);
    const preset = smartComponentPresetById(this.catalog, componentRef, `${role} child component`);
    const definition = smartComponentDefinitionForPreset(this.catalog, preset, `${role} child component`);
    const childId = this.id(role);
    const previous = projectCollection(this.project, "smartComponentInstances")[childId];
    const sameComponent = previous?.sourceComponent?.id === preset.id;
    const kind = requiredStringValue(config.kind, `${role}: child component kind`, this);
    const inputs = kind === "connection"
      ? this.createNestedConnectionInputs(role, childId, preset, definition, config)
      : clone(optionalObjectValue(config.inputs, {}, `${role}: child component inputs`, this));
    const parameters = optionalObjectValue(config.parameters, {}, `${role}: child component parameters`, this);
    this.roles[role] = childId;
    this.model.smartComponentInstances[childId] = {
      ...smartComponentInstanceRecord({
        id: childId,
        type: preset.type,
        kind,
        sourceComponent: smartComponentSourceComponent(preset, config.version === undefined ? preset.version : config.version),
        inputs,
        parameters,
        parentInstanceId: this.instanceId,
        parentRole: role,
        objectRoles: sameComponent ? previous.objectRoles : {},
        ownedObjectIds: sameComponent ? previous.ownedObjectIds : [],
        managedFields: sameComponent ? previous.managedFields : {},
        fieldOverrides: sameComponent ? previous.fieldOverrides : {},
        detachedObjectIds: sameComponent ? previous.detachedObjectIds : [],
        suppressedRoles: sameComponent ? previous.suppressedRoles : defaultGhostComponentRoles(definition)
      })
    };
    this.childComponentRoles[role] = childId;
    const parent = this.model.smartComponentInstances[this.instanceId] || clone(this.instance);
    parent.childComponentRoles = clone(this.childComponentRoles);
    this.model.smartComponentInstances[this.instanceId] = parent;
    return this.model.smartComponentInstances[childId];
  }

  createNestedConnectionInputs(role, childId, preset, definition, config) {
    config = requiredObjectValue(config, `${role}: child component config`, this);
    const inputs = clone(optionalObjectValue(config.inputs, {}, `${role}: child component inputs`, this));
    const hasConnectionZoneId = inputs.connectionZoneId !== undefined;
    const hasAssemblyId = inputs.assemblyId !== undefined;
    if (hasConnectionZoneId && !hasAssemblyId) this.fail(`${role}: inputs.connectionZoneId requires inputs.assemblyId`);
    if (hasConnectionZoneId && hasAssemblyId) {
      optionalStringValue(inputs.connectionZoneId, undefined, `${role}: inputs.connectionZoneId`, this);
      optionalStringValue(inputs.assemblyId, undefined, `${role}: inputs.assemblyId`, this);
      return inputs;
    }
    const connection = optionalObjectValue(config.connection, {}, `${role}: child component connection`, this);
    if (connection.objectIds !== undefined) this.fail(`${role}: connection.objectIds is not supported; use explicit mainObjectId and secondaryObjectIds`);
    if (connection.role !== undefined) this.fail(`${role}: connection.role is not supported; use explicit connection.id and inputs.assemblyId`);
    const mainObjectId = requiredStringValue(connection.mainObjectId, `${role}: connection.mainObjectId`, this);
    const secondaryObjectIds = unique(requiredStringArrayValue(connection.secondaryObjectIds, `${role}: connection.secondaryObjectIds`, this));
    if (!secondaryObjectIds.length) this.fail(`${role}: connection.secondaryObjectIds cannot be empty`);
    const zoneId = requiredStringValue(connection.id, `${role}: connection.id`, this);
    const assemblyId = requiredStringValue(inputs.assemblyId, `${role}: inputs.assemblyId`, this);
    const interfaceIdPrefix = requiredStringValue(connection.interfaceIdPrefix, `${role}: connection.interfaceIdPrefix`, this);
    const interfaces = connectionInterfaceDefinitions(definition);
    const interfaceIds = interfaces.map((entry, index) => {
      const interfaceRole = requiredStringValue(entry.role, `${definition.type}.interfaces[${index}].role`, this);
      const auto = requiredObjectValue(entry.auto, `${definition.type}.interfaces[${index}].auto`, this);
      const ownerId = interfaceRole === "secondary"
        ? secondaryObjectIds[0]
        : mainObjectId;
      const id = nextId(mergedProjectView(this.project, this.model), `${interfaceIdPrefix}_${safeId(interfaceRole)}_interface`);
      this.model.interfaces[id] = {
        id,
        type: requiredStringValue(auto.type, `${definition.type}.interfaces[${index}].auto.type`, this),
        ownerId,
        role: `connection-${interfaceRole}`,
        origin: connection.origin,
        notes: optionalStringValue(connection.notes, `${preset.type} nested connection interface`, `${role}: connection.notes`, this),
        authoring: generatedSmartComponentHelperAuthoring(childId)
      };
      return id;
    });
    this.model.connectionZones[zoneId] = {
      id: zoneId,
      type: optionalStringValue(connection.type, `${preset.type}-zone`, `${role}: connection.type`, this),
      name: optionalStringValue(connection.name, `${smartComponentPresetName(preset, preset.id)} zone`, `${role}: connection.name`, this),
      mainObjectId,
      secondaryObjectIds,
      origin: connection.origin,
      interfaceIds,
      smartComponentInstanceIds: [childId],
      objectIds: [],
      notes: connection.notes,
      authoring: generatedSmartComponentHelperAuthoring(childId)
    };
    this.model.assemblies[assemblyId] = {
      id: assemblyId,
      type: optionalStringValue(connection.assemblyType, "connection-assembly", `${role}: connection.assemblyType`, this),
      name: optionalStringValue(connection.assemblyName, `${smartComponentPresetName(preset, preset.id)} assembly`, `${role}: connection.assemblyName`, this),
      parentAssemblyId: optionalNullableStringValue(connection.parentAssemblyId, null, `${role}: connection.parentAssemblyId`, this),
      childAssemblyIds: optionalStringArrayValue(connection.childAssemblyIds, [], `${role}: connection.childAssemblyIds`, this),
      connectionZoneIds: [zoneId],
      smartComponentInstanceIds: [childId],
      authoring: generatedSmartComponentHelperAuthoring(childId)
    };
    return {
      ...inputs,
      connectionZoneId: zoneId,
      assemblyId
    };
  }

  roleActive(role) {
    if (requiredStringArrayValue(this.instance.suppressedRoles, `${this.instanceId}.suppressedRoles`, this).includes(role)) return false;
    return true;
  }

  params(paths) {
    return Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, this.param(path)]));
  }

  member(role) {
    if (role === "main") return resolvedProjectObject(this.project, "members", instanceMainMemberId(this.instance));
    if (role === "secondary") return resolvedProjectObject(this.project, "members", instanceSecondaryMemberId(this.instance));
    this.fail(`unknown member role ${role}`);
  }

  profile(role) {
    const member = this.member(role);
    const profile = libraryProfileById(this.profiles, member.profile);
    if (!profile) this.fail(`${member.id}: profile not found: ${member.profile}`);
    return profile;
  }

  connectionReferencePoint(secondaryInterfaceId) {
    if (!secondaryInterfaceId) this.fail(`${this.zone.id}: missing secondary interface reference`);
    return resolveInterface(this.project, this.profiles, secondaryInterfaceId).origin;
  }

  interface(role) {
    const index = this.definition.interfaces.findIndex((entry) => entry.role === role);
    if (index < 0) this.fail(`unknown interface role ${role}`);
    const interfaceId = this.zone.interfaceIds?.[index];
    if (!interfaceId) this.fail(`connection zone missing ${role} interface`);
    const iface = projectObject(this.project, "interfaces", interfaceId);
    const options = {};
    if (role === "main") {
      const secondaryIndex = this.definition.interfaces.findIndex((entry) => entry.role === "secondary");
      const secondaryInterfaceId = this.zone.interfaceIds?.[secondaryIndex];
      let referencePoint = this.connectionReferencePoint(secondaryInterfaceId);
      if (secondaryInterfaceId) {
        const secondaryInterface = resolveInterface(this.project, this.profiles, secondaryInterfaceId);
        const ownerEntry = projectObjectIndex(this.project)[secondaryInterface.ownerId];
        if (!ownerEntry) this.fail(`${secondaryInterface.ownerId}: secondary interface owner missing from objectIndex`);
        if (iface.faceRef === "connection-secondary-facing-section-face" && ownerEntry?.collection === "members" && secondaryInterface.memberEnd) {
          const secondaryMember = resolvedProjectObject(this.project, "members", secondaryInterface.ownerId);
          referencePoint = v.add(referencePoint, v.mul(this.geometry.secondaryBeamDirection(secondaryMember, secondaryInterface), 10));
        }
      }
      if (referencePoint) {
        options.referencePoint = referencePoint;
        options.preferReferencePoint = true;
      }
    }
    return resolveInterface(this.project, this.profiles, interfaceId, options);
  }

  id(role) {
    const detachedIds = smartComponentDetachedObjectIds(this.instance);
    const objectRoles = requiredObjectValue(this.instance.objectRoles, `${this.instanceId}.objectRoles`, this);
    if (Object.hasOwn(objectRoles, role)) {
      const existing = requiredStringValue(objectRoles[role], `objectRoles.${role}`, this);
      if (!detachedIds.includes(existing)) return existing;
    }
    const suffix = this.generatedRoleSuffixes[role] || this.definition.roles?.[role];
    if (!suffix) this.fail(`definition missing role suffix for ${role}`);
    const base = `${this.instanceId}${suffix}`;
    if (detachedIds.includes(base) || projectObjectIndex(this.project)[base] || MODEL_COLLECTIONS.some((collection) => this.model[collection][base])) {
      return nextId(mergedProjectView(this.project, this.model), base);
    }
    return base;
  }

  role(role, id) {
    requiredStringValue(role, "component role", this);
    requiredStringValue(id, `${role}.id`, this);
    if (this.roles[role] && this.roles[role] !== id) this.fail(`role ${role} already assigned to ${this.roles[role]}`);
    this.roles[role] = id;
    const collection = Object.keys(this.model).find((name) => this.model[name]?.[id]);
    const object = collection ? this.model[collection][id] : null;
    if (object) object.authoring = { ...optionalObjectValue(object.authoring, {}, `${id}.authoring`, this), componentRole: role };
  }

  createMember(role, data) {
    const id = this.id(role);
    if (data.id && data.id !== id) this.fail(`${role}: generated member id must come from objectRoles, got ${data.id}`);
    const projectView = mergedProjectView(this.project, this.model);
    const member = createMemberObject(projectView, {
      ...data,
      id,
      source: data.source === undefined ? "smart-component" : data.source
    });
    this.add("members", id, member);
    this.role(role, id);
    return member;
  }

  add(collection, id, object) {
    requiredStringValue(id, `${collection}.id`, this);
    if (!this.model[collection]) this.fail(`unsupported output collection ${collection}`);
    if (!object?.type) this.fail(`${collection}.${id} missing type`);
    if (object.id !== undefined && object.id !== id) this.fail(`${collection}.${id} id mismatch: ${object.id}`);
    this.model[collection][id] = {
      ...object,
      id,
      authoring: {
        ...optionalObjectValue(object.authoring, {}, `${id}.authoring`, this),
        componentInstanceId: this.instanceId,
        componentRole: Object.entries(this.roles).find(([, value]) => value === id)?.[0],
        componentStatus: "managed"
      }
    };
  }

  attachFeature(ownerId, featureId) {
    const collection = this.model.plates[ownerId] ? "plates" : collectionForObject(this.project, ownerId);
    if (!["members", "plates"].includes(collection)) this.fail(`${ownerId}: features can only attach to members or plates`);
    const owner = this.model[collection][ownerId] || clone(projectObject(this.project, collection, ownerId));
    owner.featureIds = unique([...arrayValues(owner.featureIds), featureId]);
    this.model[collection][ownerId] = owner;
  }
}

function buildChildSmartComponents(ctx) {
  const parentPatch = requiredObjectValue(ctx.model.smartComponentInstances[ctx.instanceId], `${ctx.instanceId}.patch`, ctx);
  const childRoles = requiredObjectValue(parentPatch.childComponentRoles, `${ctx.instanceId}.childComponentRoles`, ctx);
  const childIds = unique(objectStringValues(childRoles, `${ctx.instanceId}.childComponentRoles`, ctx));
  for (const childId of childIds) {
    const childInstance = ctx.model.smartComponentInstances[childId];
    if (!childInstance) ctx.fail(`child component instance not found: ${childId}`);
    if (!plainObject(childInstance.referenceParameters)) ctx.fail(`${childId}: child component referenceParameters must be an object`);
    const projectView = mergedProjectView(ctx.project, ctx.model);
    const childDefinition = smartComponentDefinitionForInstance(ctx.catalog, childInstance);
    const childPatch = buildSmartComponentPatch({
      project: projectView,
      profiles: ctx.profiles,
      definition: childDefinition,
      catalog: ctx.catalog,
      fasteners: ctx.fasteners,
      materials: ctx.materials,
      instanceId: childId,
      parameters: childInstance.referenceParameters
    });
    mergePatchModel(ctx.model, childPatch);
  }
}

function buildSmartComponentPatch({ project, profiles, definition, catalog, fasteners, materials, instanceId, parameters }) {
  const ctx = new SmartComponentBuildContext({ project, profiles, definition, catalog, fasteners, materials, instanceId, parameters });
  if (ctx.preset.type !== definition.type) fail(`${instanceId}: preset type ${ctx.preset.type} does not match ${definition.type}`);
  validateSmartComponentParameters(definition, ctx.parameters, { fasteners });
  definition.build(ctx);
  buildChildSmartComponents(ctx);
  applyComponentOverrides(ctx.model, ctx.roles, {
    suppressedRoles: requiredStringArrayValue(ctx.instance.suppressedRoles, `${instanceId}.suppressedRoles`, ctx),
    suppressedPatternPositions: requiredObjectValue(ctx.instance.suppressedPatternPositions, `${instanceId}.suppressedPatternPositions`, ctx)
  });

  const ownedObjectIds = unique(flattenIds(ctx.roles));
  const ownedObjectIdSet = new Set(ownedObjectIds);
  const activeOverrideIds = new Set([...ownedObjectIds, ...smartComponentDetachedObjectIds(ctx.instance)]);
  const fieldOverridesSource = requiredObjectValue(ctx.instance.fieldOverrides, `${instanceId}.fieldOverrides`, ctx);
  const fieldOverrides = Object.fromEntries(Object.entries(fieldOverridesSource).filter(([id]) => activeOverrideIds.has(id)));
  const generatedFieldOverrides = Object.fromEntries(Object.entries(fieldOverrides).filter(([id]) => ownedObjectIdSet.has(id)));
  applyFieldOverrides(ctx.model, generatedFieldOverrides);
  const diagnostics = [...ctx.diagnostics, ...prefixedChildDiagnostics(ctx), ...fieldOverrideDiagnostics(ctx.model, generatedFieldOverrides)];
  addDiagnosticDisplay(ctx.model, ownedObjectIds, diagnostics);
  if (ctx.zone) {
    const zone = ctx.model.connectionZones[ctx.zone.id];
    zone.objectIds = unique([...optionalStringArrayValue(ctx.zone.objectIds, [], `${ctx.zone.id}.objectIds`, ctx), ...ownedObjectIds]);
  }

  const existingParentPatch = requiredObjectValue(ctx.model.smartComponentInstances[instanceId], `${instanceId}.patch`, ctx);
  ctx.model.smartComponentInstances[instanceId] = {
    ...ctx.instance,
    ...existingParentPatch,
    id: instanceId,
    type: definition.type,
    kind: definition.kind,
    sourceComponent: { library: "smart-components", id: ctx.preset.id, version: ctx.preset.version },
    referenceParameters: clone(ctx.parameters),
    ownedObjectIds,
    objectRoles: clone(ctx.roles),
    outputs: clone(ctx.outputs),
    fieldOverrides: clone(fieldOverrides),
    status: "generated",
    definition: definition.type,
    version: definition.version,
    health: hasDiagnosticErrors(diagnostics) ? "error" : "ok",
    diagnostics: clone(diagnostics)
  };

  return { objectIndex: objectIndexFor(ctx.model), model: ctx.model };
}

function smartComponentOwnedTreeObjectIds(project, instanceId, visited = new Set()) {
  if (visited.has(instanceId)) fail(`${instanceId}: cyclic Smart Component ownership tree`);
  visited.add(instanceId);
  const instances = projectCollection(project, "smartComponentInstances");
  const instance = instances[instanceId];
  if (!instance) fail(`smart component not found: ${instanceId}`);
  const directIds = smartComponentOwnedObjectIds(instance);
  const childRoles = requiredObjectValue(instance.childComponentRoles, `${instanceId}.childComponentRoles`);
  const childIds = unique([
    ...objectStringValues(childRoles, `${instanceId}.childComponentRoles`),
    ...directIds.filter((objectId) => instances[objectId]?.parentInstanceId === instanceId)
  ]);
  return unique([
    ...directIds,
    ...childIds.flatMap((childId) => smartComponentOwnedTreeObjectIds(project, childId, visited))
  ]);
}

function managedBySmartComponent(project, objectId, instanceId) {
  const collection = indexedCollectionForObject(project, objectId);
  if (!collection) return false;
  const object = projectCollection(project, collection)[objectId];
  if (object?.authoring?.componentInstanceId === instanceId && ["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return true;
  return collection === "smartComponentInstances" && object?.parentInstanceId === instanceId;
}

function removedManagedObjectIds(project, patch) {
  const removed = [];
  const projectInstances = projectCollection(project, "smartComponentInstances");
  const patchModel = requiredObjectValue(requiredObjectValue(patch, "smart component patch").model, "smart component patch.model");
  const patchInstances = requiredObjectValue(patchModel.smartComponentInstances, "smart component patch.model.smartComponentInstances");
  for (const [instanceId, nextInstance] of Object.entries(patchInstances)) {
    const previousInstance = projectInstances[instanceId];
    if (!previousInstance) continue;
    const nextIds = new Set([...smartComponentOwnedObjectIds(nextInstance), ...smartComponentDetachedObjectIds(nextInstance), instanceId]);
    for (const objectId of smartComponentOwnedObjectIds(previousInstance)) {
      if (nextIds.has(objectId)) continue;
      if (managedBySmartComponent(project, objectId, instanceId)) {
        removed.push(objectId);
        if (projectInstances[objectId]) removed.push(...smartComponentOwnedTreeObjectIds(project, objectId), objectId);
      }
    }
  }
  return unique(removed);
}

function applySmartComponentPatch(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  const patchModel = requiredObjectValue(patch.model, "smart component patch.model");
  const next = removedIds.length ? clone(project) : {
    ...project,
    objectIndex: { ...projectObjectIndex(project) },
    model: { ...projectModel(project) }
  };
  projectObjectIndex(next);
  projectModel(next);
  Object.assign(next.objectIndex, requiredObjectValue(patch.objectIndex, "smart component patch.objectIndex"));
  for (const [collection, objects] of Object.entries(patchModel)) {
    next.model[collection] = {
      ...projectCollection(next, collection),
      ...objects
    };
  }
  removeProjectObjects(next, removedIds, { shouldPruneArray: SMART_COMPONENT_PRUNE_ARRAYS });
  return next;
}

function clonePatchableProject(project) {
  const next = clone(project);
  for (const collection of MODEL_COLLECTIONS) {
    projectCollection(next, collection);
  }
  return next;
}

function applySmartComponentPatchInPlace(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  const patchModel = requiredObjectValue(patch.model, "smart component patch.model");
  Object.assign(projectObjectIndex(project), requiredObjectValue(patch.objectIndex, "smart component patch.objectIndex"));
  for (const [collection, objects] of Object.entries(patchModel)) {
    Object.assign(projectCollection(project, collection), objects);
  }
  removeProjectObjects(project, removedIds, { shouldPruneArray: SMART_COMPONENT_PRUNE_ARRAYS });
  return project;
}

export function updateSmartComponent({ project, profiles, definition, catalog, fasteners, materials, instanceId, parameters }) {
  return applySmartComponentPatch(project, buildSmartComponentPatch({ project, profiles, definition, catalog, fasteners, materials, instanceId, parameters }));
}

export function updateSmartComponents({ project, profiles, definitionFor, catalog, fasteners, materials, instanceIds, parametersFor }) {
  const next = clonePatchableProject(project);
  for (const instanceId of instanceIds) {
    const patch = buildSmartComponentPatch({
      project: next,
      profiles,
      definition: definitionFor(next, instanceId),
      catalog,
      fasteners,
      materials,
      instanceId,
      parameters: parametersFor ? parametersFor(next, instanceId) : smartComponentById(next, instanceId).referenceParameters
    });
    applySmartComponentPatchInPlace(next, patch);
  }
  return next;
}

function partLabel(part) {
  return part.bim?.name || part.fabrication?.partMark || part.id;
}

export function smartComponentPlateOptions(project, definition, instanceId) {
  const instance = smartComponentById(project, instanceId);
  const roles = requiredObjectValue(instance.objectRoles, `${instanceId}.objectRoles`);
  const plates = projectCollection(project, "plates");
  const requiredPlateIds = unique(optionalStringArrayValue(definition.requiredPlateRoles, [], `${definition.type || "definition"}.requiredPlateRoles`).flatMap((role) => flattenIds(roles[role]))).filter((id) => plates[id]);
  const plateIds = unique([...requiredPlateIds, ...flattenIds(roles)]).filter((id) => plates[id]);
  const suppressedRoles = new Set(requiredStringArrayValue(instance.suppressedRoles, `${instanceId}.suppressedRoles`));
  return plateIds.map((id) => {
    const plate = plates[id];
    const role = Object.entries(roles).find(([, value]) => flattenIds(value).includes(id))?.[0];
    if (!role) fail(`${instanceId}: missing object role for plate ${id}`);
    return {
      id,
      label: partLabel(plate),
      role: requiredPlateIds.includes(id) ? "required" : role,
      included: !suppressedRoles.has(role) && plate.display?.visible !== false,
      required: requiredPlateIds.includes(id)
    };
  });
}

export function smartComponentRoleOptions(project, definition, instanceId) {
  const instance = smartComponentById(project, instanceId);
  const roles = requiredObjectValue(instance.objectRoles, `${instanceId}.objectRoles`);
  const objectIndex = projectObjectIndex(project);
  const suppressedRoles = new Set(requiredStringArrayValue(instance.suppressedRoles, `${instanceId}.suppressedRoles`));
  return componentEntries(definition).map((component, index) => {
    const role = requiredStringValue(component.role, `${definition.type || "definition"}.components[${index}].role`);
    const componentRoles = optionalStringArrayValue(component.objectRoles, [role], `${definition.type || "definition"}.components[${index}].objectRoles`);
    const objectIds = unique(flattenIds(componentRoles.map((objectRole) => roles[objectRole]))).filter((id) => objectIndex[id]);
    return {
      role,
      label: component.label || role,
      kind: component.kind || "object",
      objectIds,
      active: !suppressedRoles.has(role),
      defaultGhost: component.default === "ghost"
    };
  }).filter((component) => component.role && component.objectIds.length);
}

export function setSmartComponentPlateIncluded(project, definition, instanceId, plateId, included) {
  const next = clone(project);
  const instance = smartComponentById(next, instanceId);
  const options = smartComponentPlateOptions(next, definition, instanceId);
  const option = options.find((plate) => plate.id === plateId);
  if (!option) fail(`${instanceId}: plate is not a smart component plate: ${plateId}`);
  if (option.required && !included) fail(`${instanceId}: generated plate is required by ${definition.type}`);

  const plates = projectCollection(next, "plates");
  const plate = plates[plateId];
  if (!plate) fail(`plate not found: ${plateId}`);

  instance.suppressedRoles = setId(instance.suppressedRoles, option.role, !included);

  const zone = next.model.connectionZones?.[instanceConnectionZoneId(instance)];
  if (zone) zone.objectIds = setId(zone.objectIds, plateId, included);

  plate.display = { ...optionalObjectValue(plate.display, {}, `${plateId}.display`), visible: included };

  const assemblies = projectCollection(next, "assemblies");
  for (const [assemblyId, assembly] of Object.entries(assemblies)) {
    const ownsPlate = assemblyId === plate.assemblyId || assemblyId === instanceAssemblyId(instance) || assembly.partIds?.includes(plateId) || assembly.plateIds?.includes(plateId);
    if (ownsPlate) assemblies[assemblyId] = setAssemblyPlateIncluded(assembly, plateId, included);
  }

  return next;
}

export function setSmartComponentRoleActive(project, instanceId, role, active) {
  const next = clone(project);
  const instance = smartComponentById(next, instanceId);
  const roles = requiredObjectValue(instance.objectRoles, `${instanceId}.objectRoles`);
  if (!Object.hasOwn(roles, role)) fail(`${instanceId}: unknown smart component role ${role}`);
  instance.suppressedRoles = setId(instance.suppressedRoles, role, !active);
  return next;
}
