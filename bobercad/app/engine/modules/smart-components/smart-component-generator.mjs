import { createSemanticBuilders } from "../../api/model/builders.mjs?v=placement-metadata-dry-1";
import { createCheckApi } from "../../api/model/checks.mjs";
import { createGeometryApi } from "../../api/model/geometry.mjs?v=plate-placement-vertex-dry-1";
import { modelOperationBuilder } from "../../api/model/connection-primitives.mjs?v=member-end-point-dry-1";
import { createMemberObject } from "../../api/project/member-factory.mjs?v=member-snap-ref-defined-object-dry-1";
import { removeProjectObjects } from "../../api/project/objects.mjs?v=array-values-dry-1";
import { smartComponentDetachedObjectIds, smartComponentOwnedObjectIds } from "../../api/project/dependencies.mjs?v=array-values-dry-1";
import { libraryProfileById } from "../../api/project/profiles.mjs?v=profile-lookup-dry-1";
import { closestAxisSegmentPoints, finiteVec3, v } from "../../core/math.mjs?v=smart-axis-closest-dry-1";
import { arrayValues, flattenIds, isPlainObject as plainObject, jsonClone as clone, mergeObjectPatch, normalizedIndexList, objectById, truthyValues, uniqueTruthy as unique } from "../../core/model.mjs?v=array-values-dry-1";
import { resolveInterface } from "../../geometry/member-geometry.mjs?v=geometry-api-array-values-dry-1";
import { optionalPath, requiredPath, validateSmartComponentParameters } from "./parameters.mjs?v=smart-config-array-values-dry-1";

const MODEL_COLLECTIONS = ["groups", "interfaces", "connectionZones", "assemblies", "members", "plates", "holePatterns", "objectPatterns", "workPoints", "referencePlanes", "features", "trimJoints", "fastenerGroups", "welds", "smartComponentInstances"];
const AXIS_EPSILON = 1e-9;
const DEFAULT_CONNECTION_TOLERANCE = 25;
const DEFAULT_GHOST_OPACITY = 0.01;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

function fail(message) {
  throw new Error(`smart component engine: ${message}`);
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const vec3 = (value, label) => finiteVec3(value, label, fail);

function nextId(project, base, collections = MODEL_COLLECTIONS) {
  const cleanBase = safeId(base);
  let id = cleanBase;
  let index = 2;
  while (project.objectIndex?.[id] || collections.some((collection) => project.model?.[collection]?.[id])) {
    id = `${cleanBase}_${index}`;
    index += 1;
  }
  return id;
}

function setId(list, id, included) {
  const values = arrayValues(list);
  return included ? unique([...values, id]) : values.filter((value) => value !== id);
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
  for (const [collection, objects] of Object.entries(model)) {
    for (const [key, object] of Object.entries(objects || {})) {
      if (!object?.id) fail(`${collection}.${key} missing id`);
      if (!object?.type) fail(`${collection}.${key} missing type`);
      if (object.id !== key) fail(`${collection}.${key} id mismatch: ${object.id}`);
      objectIndex[key] = { collection, type: object.type };
    }
  }
  return objectIndex;
}

function projectObject(project, collection, id) {
  const object = project.model?.[collection]?.[id];
  if (!object) fail(`missing ${collection}.${id}`);
  return object;
}

function resolvedProjectObject(project, collection, id) {
  projectObject(project, collection, id);
  return objectById(project, id);
}

function smartComponentPreset(catalog, instance) {
  const presetId = instance.sourceComponent?.id;
  return smartComponentPresetById(catalog, presetId, instance.id);
}

function smartComponentPresetById(catalog, presetId, label = "smart component") {
  const preset = catalog.smartComponents?.[presetId];
  if (!preset) fail(`${label}: preset not found: ${presetId}`);
  return preset;
}

function smartComponentPresetByRef(catalog, ref, label = "smart component") {
  const direct = catalog.smartComponents?.[ref];
  if (direct) return direct;
  const matches = Object.values(catalog.smartComponents || {}).filter((preset) => preset.type === ref);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) fail(`${label}: component type ${ref} has multiple presets; use a preset id`);
  fail(`${label}: preset or component type not found: ${ref}`);
}

function smartComponentDefinitionForInstance(catalog, instance) {
  const preset = smartComponentPreset(catalog, instance);
  const definition = catalog.definitions?.[preset.type || instance.type];
  if (!definition) fail(`${instance.id}: definition not found for ${preset.type || instance.type}`);
  return definition;
}

function mergedProjectView(project, modelPatch) {
  const next = {
    ...project,
    objectIndex: { ...(project.objectIndex || {}), ...objectIndexFor(modelPatch) },
    model: { ...(project.model || {}) }
  };
  for (const [collection, objects] of Object.entries(modelPatch)) {
    next.model[collection] = { ...(next.model[collection] || {}), ...objects };
  }
  return next;
}

function mergePatchModel(target, patch) {
  for (const [collection, objects] of Object.entries(patch.model || {})) {
    target[collection] ||= {};
    Object.assign(target[collection], objects);
  }
}

function connectionTolerance(project) {
  const tolerances = project.settings?.tolerances || {};
  return Math.max(
    tolerances.connectionGap || 0,
    tolerances.snap || 0,
    tolerances.coincident || 0
  ) || DEFAULT_CONNECTION_TOLERANCE;
}

function memberLine(member) {
  return {
    start: vec3(member.start, `${member.id}.start`),
    end: vec3(member.end, `${member.id}.end`)
  };
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
  const a = lineAxisSegment(memberLine({ ...main, start: main.layoutAxis?.start || main.start, end: main.layoutAxis?.end || main.end }), main.id);
  const b = lineAxisSegment(memberLine({ ...secondary, start: secondary.layoutAxis?.start || secondary.start, end: secondary.layoutAxis?.end || secondary.end }), secondary.id);
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
  const indexed = project.objectIndex?.[objectId]?.collection;
  return indexed && project.model[indexed]?.[objectId] ? indexed : null;
}

function optionalCollectionForObject(project, objectId) {
  return indexedCollectionForObject(project, objectId) || collectionObjectById(project.model, objectId)?.collection || null;
}

function collectionForObject(project, objectId) {
  const collection = optionalCollectionForObject(project, objectId);
  if (collection) return collection;
  fail(`object not found: ${objectId}`);
}

function hasDiagnosticErrors(diagnostics) {
  return diagnostics.some((entry) => entry.severity === "error");
}

function prefixedChildDiagnostics(ctx) {
  const parentPatch = ctx.model.smartComponentInstances[ctx.instanceId];
  const childIds = unique(Object.values(parentPatch?.childComponentRoles || {}));
  return childIds.flatMap((childId) => {
    const child = ctx.model.smartComponentInstances?.[childId];
    return arrayValues(child?.diagnostics).map((diagnostic) => ({
      ...clone(diagnostic),
      source: {
        ...(diagnostic.source || {}),
        componentInstanceId: childId,
        componentType: child.type,
        parentInstanceId: ctx.instanceId
      }
    }));
  });
}

function addDiagnosticDisplay(model, objectIds, diagnostics) {
  if (!hasDiagnosticErrors(diagnostics)) return;
  for (const id of objectIds) {
    for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
      const object = model[collection]?.[id];
      if (object) object.display = { ...(object.display || {}), ...DIAGNOSTIC_DISPLAY };
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
  object.display = {
    ...(object.display || {}),
    suppressed: true,
    transparent: true,
    opacity: object.display?.opacity ?? DEFAULT_GHOST_OPACITY
  };
}

function suppressHolePatternPositions(model, patternId, indices) {
  const pattern = typeof patternId === "string" ? model.holePatterns?.[patternId] : null;
  if (!pattern) return;
  const existing = arrayValues(pattern.suppressedPositionIndices);
  pattern.suppressedPositionIndices = normalizedIndexList([...existing, ...indices]).filter((index) => index < arrayValues(pattern.positions).length);
}

function suppressFastenerHoles(model, fastenerGroup) {
  const pattern = fastenerGroup?.holePatternRef ? model.holePatterns?.[fastenerGroup.holePatternRef] : null;
  if (!pattern) return;
  suppressHolePatternPositions(model, pattern.id, arrayValues(pattern.positions).map((_, index) => index));
}

function suppressParticipantWelds(model, objectIds) {
  for (const weld of Object.values(model.welds || {})) {
    if (arrayValues(weld.participants).some((id) => objectIds.has(id))) suppressObject(weld);
  }
}

function applyComponentOverrides(model, roles, overrides = {}) {
  const patternPositions = overrides.suppressedPatternPositions || {};
  for (const [role, indices] of Object.entries(patternPositions)) {
    const patternId = roles[role];
    suppressHolePatternPositions(model, patternId, indices);
  }

  const objectRoles = new Set([
    ...arrayValues(overrides.suppressedRoles).filter((role) => typeof role === "string")
  ]);
  const suppressedObjectIds = new Set();
  for (const role of objectRoles) {
    const objectIds = flattenIds(roles[role]);
    for (const objectId of objectIds) {
      const entry = collectionObjectById(model, objectId);
      if (!entry) continue;
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
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    if (!plainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = clone(value);
}

function outputContractIssue(path, value) {
  const key = path.split(".").at(-1);
  if (/Ids$/.test(key)) {
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? null
      : `${path} must be an array of object ids`;
  }
  if (/Id$/.test(key)) {
    return value === null || typeof value === "string"
      ? null
      : `${path} must be an object id or null`;
  }
  return null;
}

function applyFieldOverrides(model, fieldOverrides = {}) {
  if (!plainObject(fieldOverrides)) return;
  for (const [objectId, patch] of Object.entries(fieldOverrides)) {
    const entry = collectionObjectById(model, objectId);
    if (!entry || !plainObject(patch)) continue;
    const authoring = entry.object.authoring;
    const next = mergeObjectPatch(entry.object, patch, { skipKeys: ["id", "type"] });
    entry.object = {
      ...next,
      id: entry.object.id,
      type: entry.object.type,
      authoring: {
        ...(next.authoring || {}),
        ...(authoring || {}),
        componentStatus: "managed-with-overrides"
      }
    };
    model[entry.collection][objectId] = entry.object;
  }
}

function fieldOverrideDiagnostics(model, fieldOverrides = {}) {
  if (!plainObject(fieldOverrides)) return [];
  return Object.entries(fieldOverrides).flatMap(([objectId, patch]) => {
    const entry = collectionObjectById(model, objectId);
    const controls = entry?.object?.authoring?.controls;
    if (!entry || controls?.kind !== "component-driven-fastener-values") return [];
    return [{
      severity: "warning",
      code: "component-driven-fastener-overridden",
      message: `${objectId}: direct fastener override masks component-driven values.`,
      objectRoles: truthyValues([entry.object.authoring?.componentRole]),
      parameterPaths: truthyValues(Object.values(controls.parameterPaths || controls.valueBindings || {})),
      resolve: "Reset the direct fastener override or edit the parent component parameter that drives this fastener value.",
      measured: clone(patch)
    }];
  });
}

function defaultGhostComponentRoles(definition) {
  return arrayValues(definition.components)
    .filter((component) => component?.role && component.default === "ghost")
    .map((component) => component.role);
}

export function smartComponentById(project, instanceId) {
  const instance = project.model.smartComponentInstances?.[instanceId];
  if (!instance) fail(`smart component not found: ${instanceId}`);
  return instance;
}

function instanceInput(instance, key) {
  return instance.inputs?.[key] || {};
}

function instanceMainMemberId(instance) {
  return instanceInput(instance, "main").memberId || instance.mainMemberId;
}

function instanceSecondaryMemberId(instance) {
  return instanceInput(instance, "secondary").memberId || instance.secondaryMemberId;
}

function instanceConnectionZoneId(instance) {
  return instance.inputs?.connectionZoneId || instance.connectionZoneId;
}

function instanceAssemblyId(instance) {
  return instance.inputs?.assemblyId || instance.assemblyId;
}

function matchingConnectionZones(project, memberIds) {
  return Object.values(project.model.connectionZones || {}).flatMap((zone) => {
    const secondaryIds = arrayValues(zone.secondaryObjectIds);
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
  return Array.isArray(interfaces) && interfaces.length ? interfaces : [{ role: "main" }, { role: "secondary" }];
}

function autoInterfaceSpec(definition, preset, role) {
  const spec = connectionInterfaceDefinitions(definition).find((entry) => entry.role === role)?.auto || {};
  if (Object.keys(spec).length) return spec;
  if (role === "secondary") return { type: "member-end-face" };
  return { type: "planar-face", faceRef: "connection-secondary-facing-section-face" };
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
  const mainEnd = mainSpec.memberEnd || ((mainSpec.type || "").includes("end") ? roles.mainEnd : null);
  if ((mainSpec.type || "").includes("end") && !mainEnd) {
    fail(`${preset.type}: automatic main member-end interface requires the main member to meet at an end`);
  }
  const authoring = generatedSmartComponentHelperAuthoring();
  const generatedInterfaces = {
    main: {
      id: mainInterfaceId,
      type: mainSpec.type || "planar-face",
      ownerId: roles.mainMember.id,
      role: "connection-main",
      ...(mainEnd ? { memberEnd: mainEnd } : {}),
      ...(mainEnd ? {} : { faceRef: mainSpec.faceRef || "connection-secondary-facing-section-face" }),
      ...(mainEnd ? {} : { stationReference: mainSpec.stationReference || "connection-secondary-interface-origin" }),
      authoring
    },
    secondary: {
      id: secondaryInterfaceId,
      type: secondarySpec.type || "member-end-face",
      ownerId: roles.secondaryMember.id,
      role: "connection-secondary",
      ...(secondarySpec.faceRef ? { faceRef: secondarySpec.faceRef } : {}),
      memberEnd: roles.secondaryEnd,
      authoring
    }
  };

  const interfaceIds = interfaces.map((entry) => generatedInterfaces[entry.role].id);
  const zone = {
    id: zoneId,
    type: `${preset.type}-zone`,
    name: `${preset.name || preset.type} zone`,
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
    name: `${preset.name || preset.type} assembly`,
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
  project.model[collection] ||= {};
  project.model[collection][object.id] = clone(object);
  project.objectIndex ||= {};
  project.objectIndex[object.id] = { collection, type: object.type };
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
    const object = project.model[collection]?.[id];
    if (object) object.authoring = generatedSmartComponentHelperAuthoring(instanceId);
  }
}

function zoneAssemblyId(project, zone) {
  const matches = Object.values(project.model.assemblies || {}).filter((assembly) => arrayValues(assembly.connectionZoneIds).includes(zone.id));
  if (matches.length > 1) fail(`${zone.id}: multiple assemblies reference the connection zone`);
  if (matches.length === 1) return matches[0].id;
  fail(`${zone.id}: no assembly references the connection zone`);
}

function nextSmartComponentId(project, zone, preset) {
  const type = safeId(preset.type);
  const base = `sc_${zone.id}_${type}`;
  let id = base;
  let index = 2;
  while (project.objectIndex?.[id] || project.model.smartComponentInstances?.[id]) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

function smartComponentSourceComponent(preset, version = preset.version) {
  return { library: "smart-components", id: preset.id, version };
}

function addSmartComponentInstance(project, instanceId, preset, instance) {
  project.model.smartComponentInstances ||= {};
  project.model.smartComponentInstances[instanceId] = instance;
  project.objectIndex ||= {};
  project.objectIndex[instanceId] = { collection: "smartComponentInstances", type: preset.type };
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
  suppressedRoles = []
}) {
  return {
    id,
    type,
    kind,
    sourceComponent,
    inputs,
    referenceParameters: clone(parameters || {}),
    parameters: clone(parameters || {}),
    parentInstanceId,
    parentRole,
    childComponentRoles: {},
    objectRoles,
    outputs: {},
    ownedObjectIds,
    managedFields,
    fieldOverrides,
    detachedObjectIds,
    suppressedRoles,
    status: "generated",
    health: "ok",
    diagnostics: []
  };
}

export function createProjectSmartComponentFromPreset(project, catalog, presetId, memberIds = [], options = {}) {
  const preset = smartComponentPresetById(catalog, presetId, "new smart component");
  const initialSuppressedRoles = options.definition ? defaultGhostComponentRoles(options.definition) : [];
  if (preset.kind !== "connection") {
    const next = clone(project);
    const instanceId = nextId(next, `sc_${safeId(preset.type)}`);
    const sourceComponent = smartComponentSourceComponent(preset);
    addSmartComponentInstance(next, instanceId, preset, {
      ...smartComponentInstanceRecord({
        id: instanceId,
        type: preset.type,
        kind: preset.kind,
        sourceComponent,
        inputs: clone(options.inputs || preset.inputs || {}),
        parameters: preset.parameters || {},
        parentInstanceId: options.parentInstanceId || null,
        parentRole: options.parentRole || null,
        suppressedRoles: initialSuppressedRoles
      }),
      authoring: {
        source: "smart-component-library",
        sourceComponent
      },
      bim: { name: preset.name || preset.type }
    });
    return { project: next, smartComponentId: instanceId, instanceId };
  }

  if (!Array.isArray(memberIds) || memberIds.length !== 2) fail("select exactly two members");
  if (memberIds[0] === memberIds[1]) fail("selected members must be different");
  for (const memberId of memberIds) projectObject(project, "members", memberId);

  const matches = matchingConnectionZones(project, memberIds);
  if (matches.length > 1) fail(`multiple stored connection zones for selected members: ${memberIds.join(", ")}`);

  const auto = matches.length ? null : autoConnectionObjects(project, memberIds, options.definition, preset);
  const { zone, mainMemberId, secondaryMemberId } = matches[0] || {
    zone: auto.zone,
    mainMemberId: auto.roles.mainMember.id,
    secondaryMemberId: auto.roles.secondaryMember.id
  };
  if (arrayValues(zone.smartComponentInstanceIds).length) fail(`${zone.id}: smart component already exists`);

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
        ...(preset.inputs || {}),
        main: { memberId: mainMemberId },
        secondary: { memberId: secondaryMemberId },
        connectionZoneId: zone.id,
        assemblyId: zoneAssemblyId(next, zone)
      },
      parameters: preset.parameters,
      parentInstanceId: options.parentInstanceId || null,
      parentRole: options.parentRole || null,
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
      name: preset.name
    }
  });

  if (auto) markAutoConnectionObjects(next, auto, instanceId);
  next.model.connectionZones[zone.id] = {
    ...next.model.connectionZones[zone.id],
    smartComponentInstanceIds: unique([...arrayValues(next.model.connectionZones[zone.id].smartComponentInstanceIds), instanceId])
  };

  const assembly = next.model.assemblies[next.model.smartComponentInstances[instanceId].inputs.assemblyId];
  assembly.smartComponentInstanceIds = unique([...arrayValues(assembly.smartComponentInstanceIds), instanceId]);
  return { project: next, smartComponentId: instanceId, instanceId };
}

class SmartComponentBuildContext {
  constructor({ project, profiles, definition, catalog, fasteners, instanceId, parameters }) {
    this.project = project;
    this.profiles = profiles;
    this.definition = definition;
    this.catalog = catalog;
    this.fasteners = fasteners;
    this.instance = smartComponentById(project, instanceId);
    this.instanceId = instanceId;
    this.mainMemberId = instanceMainMemberId(this.instance);
    this.secondaryMemberId = instanceSecondaryMemberId(this.instance);
    this.connectionZoneId = instanceConnectionZoneId(this.instance);
    this.assemblyId = instanceAssemblyId(this.instance);
    this.preset = smartComponentPreset(catalog, this.instance);
    this.parameters = clone(parameters);
    this.inputs = clone(this.instance.inputs || {});
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
    this.member = Object.assign(memberAccessor, semanticBuilders.member || {});
    this.component = {
      create: (role, config = {}) => this.createChildComponent(role, config)
    };
  }

  fail(message) {
    fail(`${this.instanceId}: ${message}`);
  }

  diagnostic(severity, code, message, details = {}) {
    if (!["error", "warning"].includes(severity)) this.fail(`unsupported diagnostic severity ${severity}`);
    this.diagnostics.push({
      severity,
      code,
      message,
      ...(details.source ? { source: clone(details.source) } : {}),
      ...(details.ruleId ? { ruleId: details.ruleId } : {}),
      ...(details.clause ? { clause: details.clause } : {}),
      ...(details.objectRoles ? { objectRoles: details.objectRoles } : {}),
      ...(details.parameterPaths ? { parameterPaths: details.parameterPaths, parameters: details.parameterPaths } : {}),
      ...(details.parameters ? { parameters: details.parameters } : {}),
      ...(details.measured !== undefined ? { measured: clone(details.measured) } : {}),
      ...(details.allowed !== undefined ? { allowed: clone(details.allowed) } : {}),
      ...(details.resolve ? { resolve: details.resolve } : {})
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
      resolve: options.resolve || "Add the value to the component parameters or define a default in the component config."
    });
    return undefined;
  }

  optionalParam(path, fallback = undefined) {
    return optionalPath(this.parameters, path, fallback);
  }

  input(path, fallback = undefined) {
    return optionalPath(this.inputs, path, fallback);
  }

  requiredInput(path, options = {}) {
    const value = optionalPath(this.inputs, path);
    if (value !== undefined) return value;
    this.error(options.code || "missing-component-input", options.message || `${this.definition.type}: missing input ${path}`, {
      parameterPaths: [path],
      resolve: options.resolve || "Pass this value through the parent component inputs before generating dependent objects."
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
        measured: value,
        resolve: "Emit component outputs through the documented Id/Ids contract so parent components can consume them without role parsing."
      });
    }
    setNestedOutput(this.outputs, path, value);
    return value;
  }

  operation(type, input = {}) {
    const build = modelOperationBuilder(type);
    if (!build) this.fail(`model operation not found: ${type}`);
    return build(this, input) || {};
  }

  createChildComponent(role, config = {}) {
    const componentRef = config.componentRef || config.type;
    if (!componentRef) this.fail(`${role}: child component missing componentRef`);
    const preset = smartComponentPresetByRef(this.catalog, componentRef, `${role} child component`);
    const definition = this.catalog.definitions?.[preset.type];
    const childId = this.id(role);
    const previous = this.project.model?.smartComponentInstances?.[childId];
    const sameComponent = previous?.sourceComponent?.id === preset.id || previous?.type === preset.type;
    const kind = config.kind || preset.kind || "model";
    const inputs = kind === "connection"
      ? this.createNestedConnectionInputs(role, childId, preset, definition, config)
      : clone(config.inputs || {});
    this.roles[role] = childId;
    this.model.smartComponentInstances[childId] = {
      ...smartComponentInstanceRecord({
        id: childId,
        type: preset.type,
        kind,
        sourceComponent: smartComponentSourceComponent(preset, config.version || preset.version),
        inputs,
        parameters: config.parameters || {},
        parentInstanceId: this.instanceId,
        parentRole: role,
        objectRoles: sameComponent ? clone(previous.objectRoles || {}) : {},
        ownedObjectIds: sameComponent ? clone(arrayValues(previous.ownedObjectIds)) : [],
        managedFields: sameComponent ? clone(previous.managedFields || {}) : {},
        fieldOverrides: sameComponent ? clone(previous.fieldOverrides || {}) : {},
        detachedObjectIds: sameComponent ? clone(arrayValues(previous.detachedObjectIds)) : [],
        suppressedRoles: sameComponent ? clone(arrayValues(previous.suppressedRoles)) : definition ? defaultGhostComponentRoles(definition) : []
      })
    };
    this.childComponentRoles[role] = childId;
    const parent = this.model.smartComponentInstances[this.instanceId] || clone(this.instance);
    parent.childComponentRoles = clone(this.childComponentRoles);
    this.model.smartComponentInstances[this.instanceId] = parent;
    return this.model.smartComponentInstances[childId];
  }

  createNestedConnectionInputs(role, childId, preset, definition, config = {}) {
    const inputs = clone(config.inputs || {});
    if (inputs.connectionZoneId && inputs.assemblyId) return inputs;
    const connection = config.connection || config.connectionZone || {};
    const projectView = mergedProjectView(this.project, this.model);
    const componentObjectIds = flattenIds(inputs.components || {});
    const objectIds = unique([
      connection.mainObjectId,
      ...arrayValues(connection.secondaryObjectIds),
      ...flattenIds(connection.objectIds),
      ...componentObjectIds
    ]);
    const mainObjectId = connection.mainObjectId || objectIds[0] || this.instanceId;
    const secondaryObjectIds = unique(connection.secondaryObjectIds || objectIds.filter((id) => id !== mainObjectId));
    const base = `${childId}_${safeId(connection.role || role)}`;
    const zoneId = connection.id || inputs.connectionZoneId || nextId(projectView, `${base}_zone`);
    const assemblyId = inputs.assemblyId || nextId(projectView, `${base}_assembly`);
    const interfaces = connectionInterfaceDefinitions(definition);
    const interfaceIds = interfaces.map((entry, index) => {
      const ownerId = entry.role === "secondary"
        ? secondaryObjectIds[0] || mainObjectId
        : mainObjectId;
      const id = nextId(mergedProjectView(this.project, this.model), `${base}_${safeId(entry.role || `interface_${index + 1}`)}_interface`);
      this.model.interfaces[id] = {
        id,
        type: entry.auto?.type || "component-scope",
        ownerId,
        role: `connection-${entry.role || index + 1}`,
        origin: connection.origin,
        notes: connection.notes || `${preset.type} nested connection interface`,
        authoring: generatedSmartComponentHelperAuthoring(childId)
      };
      return id;
    });
    this.model.connectionZones[zoneId] = {
      id: zoneId,
      type: connection.type || `${preset.type}-zone`,
      name: connection.name || `${preset.name || preset.type} zone`,
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
      type: connection.assemblyType || "connection-assembly",
      name: connection.assemblyName || `${preset.name || preset.type} assembly`,
      parentAssemblyId: connection.parentAssemblyId || null,
      childAssemblyIds: arrayValues(connection.childAssemblyIds),
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
    const overrides = this.instance || {};
    if (arrayValues(overrides.suppressedRoles).includes(role)) return false;
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
    try {
      if (secondaryInterfaceId) return resolveInterface(this.project, this.profiles, secondaryInterfaceId).origin;
    } catch (error) {
      if (!String(error.message || "").includes("stationReference requires a connection reference point")) throw error;
    }
    return Array.isArray(this.zone.origin) ? this.zone.origin : null;
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
      if (referencePoint && secondaryInterfaceId) {
        const secondaryInterface = resolveInterface(this.project, this.profiles, secondaryInterfaceId);
        const ownerEntry = this.project.objectIndex?.[secondaryInterface.ownerId];
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
    const existing = this.instance.objectRoles?.[role];
    if (existing && !smartComponentDetachedObjectIds(this.instance).includes(existing)) {
      if (typeof existing !== "string") this.fail(`objectRoles.${role} must be a string id`);
      return existing;
    }
    const suffix = this.generatedRoleSuffixes[role] || this.definition.roles?.[role];
    if (!suffix) this.fail(`definition missing role suffix for ${role}`);
    const base = `${this.instanceId}${suffix}`;
    if (smartComponentDetachedObjectIds(this.instance).includes(base) || this.project.objectIndex?.[base] || MODEL_COLLECTIONS.some((collection) => this.model?.[collection]?.[base])) {
      return nextId(mergedProjectView(this.project, this.model), base);
    }
    return base;
  }

  role(role, id) {
    if (this.roles[role] && this.roles[role] !== id) this.fail(`role ${role} already assigned to ${this.roles[role]}`);
    this.roles[role] = id;
    const collection = Object.keys(this.model).find((name) => this.model[name]?.[id]);
    const object = collection ? this.model[collection][id] : null;
    if (object) object.authoring = { ...(object.authoring || {}), componentRole: role };
  }

  createMember(role, data) {
    const id = this.id(role);
    if (data.id && data.id !== id) this.fail(`${role}: generated member id must come from objectRoles, got ${data.id}`);
    const projectView = {
      ...this.project,
      objectIndex: { ...(this.project.objectIndex || {}), ...objectIndexFor(this.model) },
      model: { ...(this.project.model || {}) }
    };
    for (const [collection, objects] of Object.entries(this.model)) {
      projectView.model[collection] = { ...(projectView.model[collection] || {}), ...objects };
    }
    const member = createMemberObject(projectView, this.profiles, {
      ...data,
      id,
      source: data.source || "smart-component"
    });
    this.add("members", id, member);
    this.role(role, id);
    return member;
  }

  add(collection, id, object) {
    if (!this.model[collection]) this.fail(`unsupported output collection ${collection}`);
    if (!object?.type) this.fail(`${collection}.${id} missing type`);
    this.model[collection][id] = {
      ...object,
      authoring: {
        ...(object.authoring || {}),
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
  const parentPatch = ctx.model.smartComponentInstances[ctx.instanceId];
  const childIds = unique(Object.values(parentPatch?.childComponentRoles || {}));
  for (const childId of childIds) {
    const childInstance = ctx.model.smartComponentInstances[childId];
    if (!childInstance) ctx.fail(`child component instance not found: ${childId}`);
    const projectView = mergedProjectView(ctx.project, ctx.model);
    const childDefinition = smartComponentDefinitionForInstance(ctx.catalog, childInstance);
    const childPatch = buildSmartComponentPatch({
      project: projectView,
      profiles: ctx.profiles,
      definition: childDefinition,
      catalog: ctx.catalog,
      fasteners: ctx.fasteners,
      instanceId: childId,
      parameters: childInstance.referenceParameters || childInstance.parameters || {}
    });
    mergePatchModel(ctx.model, childPatch);
  }
}

function buildSmartComponentPatch({ project, profiles, definition, catalog, fasteners, instanceId, parameters }) {
  const ctx = new SmartComponentBuildContext({ project, profiles, definition, catalog, fasteners, instanceId, parameters });
  if (ctx.preset.type !== definition.type) fail(`${instanceId}: preset type ${ctx.preset.type} does not match ${definition.type}`);
  validateSmartComponentParameters(definition, ctx.parameters, { fasteners });
  definition.build(ctx);
  buildChildSmartComponents(ctx);
  applyComponentOverrides(ctx.model, ctx.roles, {
    suppressedRoles: arrayValues(ctx.instance.suppressedRoles),
    suppressedPatternPositions: ctx.instance.suppressedPatternPositions || {}
  });

  const ownedObjectIds = unique(flattenIds(ctx.roles));
  const activeOverrideIds = new Set([...ownedObjectIds, ...smartComponentDetachedObjectIds(ctx.instance)]);
  const fieldOverrides = Object.fromEntries(Object.entries(ctx.instance.fieldOverrides || {}).filter(([id]) => activeOverrideIds.has(id)));
  applyFieldOverrides(ctx.model, fieldOverrides);
  const diagnostics = [...ctx.diagnostics, ...prefixedChildDiagnostics(ctx), ...fieldOverrideDiagnostics(ctx.model, fieldOverrides)];
  addDiagnosticDisplay(ctx.model, ownedObjectIds, diagnostics);
  if (ctx.zone) {
    const zone = ctx.model.connectionZones[ctx.zone.id];
    zone.objectIds = unique([...arrayValues(ctx.zone.objectIds), ...ownedObjectIds]);
  }

  const existingParentPatch = ctx.model.smartComponentInstances[instanceId] || {};
  ctx.model.smartComponentInstances[instanceId] = {
    ...ctx.instance,
    ...existingParentPatch,
    id: instanceId,
    type: definition.type,
    kind: definition.kind,
    sourceComponent: { library: "smart-components", id: ctx.preset.id, version: ctx.preset.version },
    referenceParameters: clone(ctx.parameters),
    parameters: clone(ctx.parameters),
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
  if (visited.has(instanceId)) return [];
  visited.add(instanceId);
  const instance = project.model?.smartComponentInstances?.[instanceId];
  if (!instance) return [];
  const directIds = smartComponentOwnedObjectIds(instance);
  const childIds = unique([
    ...Object.values(instance.childComponentRoles || {}),
    ...directIds.filter((objectId) => project.model?.smartComponentInstances?.[objectId]?.parentInstanceId === instanceId)
  ]);
  return unique([
    ...directIds,
    ...childIds.flatMap((childId) => smartComponentOwnedTreeObjectIds(project, childId, visited))
  ]);
}

function managedBySmartComponent(project, objectId, instanceId) {
  const collection = optionalCollectionForObject(project, objectId);
  if (!collection) return false;
  const object = project.model[collection]?.[objectId];
  if (object?.authoring?.componentInstanceId === instanceId && ["managed", "managed-with-overrides"].includes(object.authoring?.componentStatus)) return true;
  return collection === "smartComponentInstances" && object?.parentInstanceId === instanceId;
}

function removedManagedObjectIds(project, patch) {
  const removed = [];
  for (const [instanceId, nextInstance] of Object.entries(patch.model.smartComponentInstances || {})) {
    const previousInstance = project.model?.smartComponentInstances?.[instanceId];
    if (!previousInstance) continue;
    const nextIds = new Set([...smartComponentOwnedObjectIds(nextInstance), ...smartComponentDetachedObjectIds(nextInstance), instanceId]);
    for (const objectId of smartComponentOwnedObjectIds(previousInstance)) {
      if (nextIds.has(objectId)) continue;
      if (managedBySmartComponent(project, objectId, instanceId)) {
        removed.push(objectId);
        if (project.model?.smartComponentInstances?.[objectId]) removed.push(...smartComponentOwnedTreeObjectIds(project, objectId), objectId);
      }
    }
  }
  return unique(removed);
}

function applySmartComponentPatch(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  const next = removedIds.length ? clone(project) : {
    ...project,
    objectIndex: { ...(project.objectIndex || {}) },
    model: { ...(project.model || {}) }
  };
  Object.assign(next.objectIndex, patch.objectIndex);
  for (const [collection, objects] of Object.entries(patch.model)) {
    next.model[collection] = {
      ...(next.model[collection] || {}),
      ...objects
    };
  }
  removeProjectObjects(next, removedIds);
  return next;
}

function clonePatchableProject(project) {
  const next = clone(project);
  for (const collection of MODEL_COLLECTIONS) {
    next.model[collection] = { ...(next.model[collection] || {}) };
  }
  return next;
}

function applySmartComponentPatchInPlace(project, patch) {
  const removedIds = removedManagedObjectIds(project, patch);
  Object.assign(project.objectIndex, patch.objectIndex);
  for (const [collection, objects] of Object.entries(patch.model)) {
    Object.assign(project.model[collection], objects);
  }
  removeProjectObjects(project, removedIds);
  return project;
}

export function updateSmartComponent({ project, profiles, definition, catalog, fasteners, instanceId, parameters }) {
  return applySmartComponentPatch(project, buildSmartComponentPatch({ project, profiles, definition, catalog, fasteners, instanceId, parameters }));
}

export function updateSmartComponents({ project, profiles, definitionFor, catalog, fasteners, instanceIds, parametersFor }) {
  const next = clonePatchableProject(project);
  for (const instanceId of instanceIds) {
    const patch = buildSmartComponentPatch({
      project: next,
      profiles,
      definition: definitionFor(next, instanceId),
      catalog,
      fasteners,
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
  const roles = instance.objectRoles || {};
  const requiredPlateIds = unique(arrayValues(definition.requiredPlateRoles).flatMap((role) => flattenIds(roles[role]))).filter((id) => project.model.plates?.[id]);
  const plateIds = unique([...requiredPlateIds, ...flattenIds(roles)]).filter((id) => project.model.plates?.[id]);
  const suppressedRoles = new Set(arrayValues(instance.suppressedRoles));
  return plateIds.map((id) => {
    const plate = project.model.plates[id];
    const role = Object.entries(roles).find(([, value]) => flattenIds(value).includes(id))?.[0] || plate.placementIntent?.role;
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
  const roles = instance.objectRoles || {};
  const suppressedRoles = new Set(arrayValues(instance.suppressedRoles));
  return arrayValues(definition.components).map((component) => {
    const objectIds = unique(flattenIds((component.objectRoles || [component.role]).map((role) => roles[role]))).filter((id) => project.objectIndex?.[id]);
    return {
      role: component.role,
      label: component.label || component.role,
      kind: component.kind || "object",
      objectIds,
      active: !suppressedRoles.has(component.role),
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

  const plate = next.model.plates?.[plateId];
  if (!plate) fail(`plate not found: ${plateId}`);

  instance.suppressedRoles = setId(instance.suppressedRoles, option.role, !included);

  const zone = next.model.connectionZones?.[instanceConnectionZoneId(instance)];
  if (zone) zone.objectIds = setId(zone.objectIds, plateId, included);

  plate.display = { ...(plate.display || {}), visible: included };

  for (const [assemblyId, assembly] of Object.entries(next.model.assemblies || {})) {
    const ownsPlate = assemblyId === plate.assemblyId || assemblyId === instanceAssemblyId(instance) || assembly.partIds?.includes(plateId) || assembly.plateIds?.includes(plateId);
    if (ownsPlate) next.model.assemblies[assemblyId] = setAssemblyPlateIncluded(assembly, plateId, included);
  }

  return next;
}

export function setSmartComponentRoleActive(project, instanceId, role, active) {
  const next = clone(project);
  const instance = smartComponentById(next, instanceId);
  instance.suppressedRoles = setId(instance.suppressedRoles, role, !active);
  return next;
}
