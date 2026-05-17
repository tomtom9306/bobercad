import { createSemanticBuilders } from "../../api/connections/builders.mjs";
import { createCheckApi } from "../../api/connections/checks.mjs";
import { createGeometryApi } from "../../api/connections/geometry.mjs";
import { v } from "../../core/math.mjs";
import { objectById } from "../../core/model.mjs";
import { resolveInterface } from "../../geometry/member-geometry.mjs";
import { clone, optionalPath, requiredPath, validateConnectionParameters } from "./connection-schema.mjs";

const MODEL_COLLECTIONS = ["groups", "interfaces", "connectionZones", "assemblies", "members", "plates", "holePatterns", "objectPatterns", "features", "fastenerGroups", "welds", "connections"];
const AXIS_EPSILON = 1e-9;
const DEFAULT_CONNECTION_TOLERANCE = 25;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

function fail(message) {
  throw new Error(`connection engine: ${message}`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x, y, z] point`);
  }
  return [...value];
}

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

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  fail(`unsupported role id value ${value}`);
}

function setId(list = [], id, included) {
  return included ? unique([...list, id]) : list.filter((value) => value !== id);
}

function setAssemblyPlateIncluded(assembly, plateId, included) {
  return {
    ...assembly,
    partIds: setId(assembly.partIds || [], plateId, included),
    plateIds: setId(assembly.plateIds || [], plateId, included)
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

function generatedManualParts(model) {
  return {
    plateIds: Object.keys(model.plates || {}),
    featureIds: Object.keys(model.features || {}),
    fastenerGroupIds: Object.keys(model.fastenerGroups || {}),
    weldIds: Object.keys(model.welds || {})
  };
}

function mergeManualParts(existing = {}, generated = {}) {
  return {
    plateIds: unique([...(generated.plateIds || []), ...(existing.plateIds || [])]),
    featureIds: unique([...(generated.featureIds || []), ...(existing.featureIds || [])]),
    fastenerGroupIds: unique([...(generated.fastenerGroupIds || []), ...(existing.fastenerGroupIds || [])]),
    weldIds: unique([...(generated.weldIds || []), ...(existing.weldIds || [])])
  };
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

function connectionPreset(connectionCatalog, connection) {
  const presetId = connection.sourcePreset?.id;
  return connectionPresetById(connectionCatalog, presetId, connection.id);
}

function connectionPresetById(connectionCatalog, presetId, label = "connection") {
  const preset = connectionCatalog.connections[presetId];
  if (!preset) fail(`${label}: preset not found: ${presetId}`);
  return preset;
}

function connectionTolerance(project) {
  const tolerances = project.settings?.tolerances || {};
  return Math.max(
    tolerances.connectionGap || 0,
    tolerances.snap || 0,
    tolerances.coincident || 0
  ) || DEFAULT_CONNECTION_TOLERANCE;
}

function layoutAxis(member) {
  const axis = member.layoutAxis || {};
  return {
    start: vec3(axis.start || member.start, `${member.id}.layoutAxis.start`),
    end: vec3(axis.end || member.end, `${member.id}.layoutAxis.end`)
  };
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

function closestLayoutAxisPoints(main, secondary) {
  const a = layoutAxis(main);
  const b = layoutAxis(secondary);
  const u = v.sub(a.end, a.start);
  const w = v.sub(b.end, b.start);
  const aLength = v.len(u);
  const bLength = v.len(w);
  if (aLength <= AXIS_EPSILON) fail(`${main.id}: zero-length layout axis`);
  if (bLength <= AXIS_EPSILON) fail(`${secondary.id}: zero-length layout axis`);

  const d1 = v.mul(u, 1 / aLength);
  const d2 = v.mul(w, 1 / bLength);
  const r = v.sub(a.start, b.start);
  const dot = v.dot(d1, d2);
  const denom = 1 - dot * dot;
  let stationA;
  let stationB;

  if (Math.abs(denom) <= AXIS_EPSILON) {
    stationA = stationOnLine(b.start, a);
    stationB = 0;
  } else {
    stationA = (dot * v.dot(d2, r) - v.dot(d1, r)) / denom;
    stationB = (v.dot(d2, r) - dot * v.dot(d1, r)) / denom;
  }

  stationA = Math.min(aLength, Math.max(0, stationA));
  stationB = Math.min(bLength, Math.max(0, stationB));
  const pointA = v.add(a.start, v.mul(d1, stationA));
  const pointB = v.add(b.start, v.mul(d2, stationB));
  return { pointA, pointB, stationA, stationB, lengthA: aLength, lengthB: bLength };
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
      secondaryMember: second,
      secondaryEnd: secondEnd,
      intersection,
      mainStation: stationOnLine(intersection, memberLine(first))
    };
  }
  if (firstEnd) {
    return {
      mainMember: second,
      secondaryMember: first,
      secondaryEnd: firstEnd,
      intersection,
      mainStation: stationOnLine(intersection, memberLine(second))
    };
  }

  fail(`selected member layout axes intersect away from a member end: ${memberIds.join(", ")}`);
}

function collectionForObject(project, objectId) {
  const indexed = project.objectIndex?.[objectId]?.collection;
  if (indexed && project.model[indexed]?.[objectId]) return indexed;
  for (const collection of MODEL_COLLECTIONS) {
    if (project.model[collection]?.[objectId]) return collection;
  }
  fail(`object not found: ${objectId}`);
}

function hasDiagnosticErrors(diagnostics) {
  return diagnostics.some((entry) => entry.severity === "error");
}

function addDiagnosticDisplay(model, objectIds, diagnostics) {
  if (!hasDiagnosticErrors(diagnostics)) return;
  for (const id of objectIds) {
    for (const collection of ["plates", "fastenerGroups", "welds", "features"]) {
      const object = model[collection]?.[id];
      if (object) object.display = { ...(object.display || {}), ...DIAGNOSTIC_DISPLAY };
    }
  }
}

export { clone };

export function connectionById(project, connectionId) {
  const connection = project.model.connections?.[connectionId];
  if (!connection) fail(`connection not found: ${connectionId}`);
  return connection;
}

export function connectionOptionalObjectIds(connection) {
  const ids = connection.generator?.manualObjectIds;
  if (ids === undefined) return [];
  if (!Array.isArray(ids)) fail(`${connection.id}: generator.manualObjectIds must be an array`);
  return ids;
}

function matchingConnectionZones(project, memberIds) {
  return Object.values(project.model.connectionZones || {}).flatMap((zone) => {
    const secondaryIds = zone.secondaryObjectIds || [];
    if (zone.mainObjectId === memberIds[0] && secondaryIds.includes(memberIds[1])) {
      return [{ zone, mainMemberId: memberIds[0], secondaryMemberId: memberIds[1] }];
    }
    if (zone.mainObjectId === memberIds[1] && secondaryIds.includes(memberIds[0])) {
      return [{ zone, mainMemberId: memberIds[1], secondaryMemberId: memberIds[0] }];
    }
    return [];
  });
}

function generatedConnectionHelperAuthoring(connectionId = null) {
  return {
    source: "connection-api",
    lifecycle: "delete-with-connection",
    status: "generated",
    ...(connectionId ? { generatedBy: connectionId } : {})
  };
}

function connectionInterfaceDefinitions(definition) {
  const interfaces = definition?.interfaces;
  return Array.isArray(interfaces) && interfaces.length ? interfaces : [{ role: "main" }, { role: "secondary" }];
}

function autoInterfaceSpec(definition, preset, role) {
  const spec = connectionInterfaceDefinitions(definition).find((entry) => entry.role === role)?.auto || {};
  if (Object.keys(spec).length) return spec;
  if (role === "secondary" && (definition?.type || preset.type) === "fin-plate") return { type: "member-web", faceRef: "web-center-plane" };
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
  const authoring = generatedConnectionHelperAuthoring();
  const generatedInterfaces = {
    main: {
      id: mainInterfaceId,
      type: mainSpec.type || "planar-face",
      ownerId: roles.mainMember.id,
      role: "connection-main",
      faceRef: mainSpec.faceRef || "connection-secondary-facing-section-face",
      stationReference: mainSpec.stationReference || "connection-secondary-interface-origin",
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
    interfaceIds,
    connectionIds: [],
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
    connectionIds: [],
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

function markAutoConnectionObjects(project, auto, connectionId) {
  for (const { collection, id } of [
    ...auto.interfaces.map((iface) => ({ collection: "interfaces", id: iface.id })),
    { collection: "connectionZones", id: auto.zone.id },
    { collection: "assemblies", id: auto.assembly.id }
  ]) {
    const object = project.model[collection]?.[id];
    if (object) object.authoring = generatedConnectionHelperAuthoring(connectionId);
  }
}

function zoneAssemblyId(project, zone) {
  const matches = Object.values(project.model.assemblies || {}).filter((assembly) => (assembly.connectionZoneIds || []).includes(zone.id));
  if (matches.length > 1) fail(`${zone.id}: multiple assemblies reference the connection zone`);
  if (matches.length === 1) return matches[0].id;
  fail(`${zone.id}: no assembly references the connection zone`);
}

function nextConnectionId(project, zone, preset) {
  const type = safeId(preset.type);
  const base = `connection_${zone.id}_${type}`;
  let id = base;
  let index = 2;
  while (project.objectIndex?.[id] || project.model.connections?.[id]) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

export function createProjectConnectionFromPreset(project, connectionCatalog, presetId, memberIds, options = {}) {
  if (!Array.isArray(memberIds) || memberIds.length !== 2) fail("select exactly two members");
  if (memberIds[0] === memberIds[1]) fail("selected members must be different");
  for (const memberId of memberIds) projectObject(project, "members", memberId);

  const preset = connectionPresetById(connectionCatalog, presetId, "new connection");
  const matches = matchingConnectionZones(project, memberIds);
  if (matches.length > 1) fail(`multiple stored connection zones for selected members: ${memberIds.join(", ")}`);

  const auto = matches.length ? null : autoConnectionObjects(project, memberIds, options.definition, preset);
  const { zone, mainMemberId, secondaryMemberId } = matches[0] || {
    zone: auto.zone,
    mainMemberId: auto.roles.mainMember.id,
    secondaryMemberId: auto.roles.secondaryMember.id
  };
  if ((zone.connectionIds || []).length) fail(`${zone.id}: connection already exists`);

  const next = clone(project);
  if (auto) addAutoConnectionObjects(next, auto);
  const connectionId = nextConnectionId(next, zone, preset);
  const sourcePreset = { library: "connections", id: preset.id, version: preset.version };
  next.model.connections ||= {};
  next.model.connections[connectionId] = {
    id: connectionId,
    type: preset.type,
    mainMemberId,
    secondaryMemberId,
    connectionZoneId: zone.id,
    assemblyId: zoneAssemblyId(next, zone),
    sourcePreset,
    referenceParameters: clone(preset.parameters),
    manualParts: {
      plateIds: [],
      featureIds: [],
      fastenerGroupIds: [],
      weldIds: []
    },
    generator: {
      status: "generated",
      definition: preset.type,
      ownedObjectIds: [],
      manualObjectIds: [],
      objectRoles: {},
      health: "ok",
      diagnostics: []
    },
    authoring: {
      source: "connection-library",
      sourcePreset,
      notes: auto
        ? "Created from selected library preset and an automatically generated connection zone."
        : "Created from selected library preset and stored connection zone."
    },
    bim: {
      name: preset.name
    }
  };

  if (auto) markAutoConnectionObjects(next, auto, connectionId);
  next.objectIndex[connectionId] = { collection: "connections", type: preset.type };
  next.model.connectionZones[zone.id] = {
    ...next.model.connectionZones[zone.id],
    connectionIds: unique([...(next.model.connectionZones[zone.id].connectionIds || []), connectionId])
  };

  const assembly = next.model.assemblies[next.model.connections[connectionId].assemblyId];
  assembly.connectionIds = unique([...(assembly.connectionIds || []), connectionId]);
  return { project: next, connectionId };
}

class ConnectionBuildContext {
  constructor({ project, profiles, definition, connectionCatalog, fasteners, connectionId, parameters }) {
    this.project = project;
    this.profiles = profiles;
    this.definition = definition;
    this.connectionCatalog = connectionCatalog;
    this.fasteners = fasteners;
    this.connection = connectionById(project, connectionId);
    this.connectionId = connectionId;
    this.preset = connectionPreset(connectionCatalog, this.connection);
    this.parameters = clone(parameters);
    this.roles = {};
    this.diagnostics = [];
    this.model = Object.fromEntries(MODEL_COLLECTIONS.map((collection) => [collection, {}]));
    this.zone = projectObject(project, "connectionZones", this.connection.connectionZoneId);
    this.model.connectionZones[this.zone.id] = clone(this.zone);
    this.geometry = createGeometryApi();
    this.check = createCheckApi(this);
    Object.assign(this, createSemanticBuilders(this));
  }

  fail(message) {
    fail(`${this.connectionId}: ${message}`);
  }

  diagnostic(severity, code, message, details = {}) {
    if (!["error", "warning"].includes(severity)) this.fail(`unsupported diagnostic severity ${severity}`);
    this.diagnostics.push({
      severity,
      code,
      message,
      ...(details.objectRoles ? { objectRoles: details.objectRoles } : {}),
      ...(details.parameters ? { parameters: details.parameters } : {}),
      ...(details.resolve ? { resolve: details.resolve } : {})
    });
  }

  error(code, message, details = {}) {
    this.diagnostic("error", code, message, details);
  }

  param(path) {
    return requiredPath(this.parameters, path, this.definition.type);
  }

  optionalParam(path, fallback = undefined) {
    return optionalPath(this.parameters, path, fallback);
  }

  params(paths) {
    return Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, this.param(path)]));
  }

  member(role) {
    if (role === "main") return resolvedProjectObject(this.project, "members", this.connection.mainMemberId);
    if (role === "secondary") return resolvedProjectObject(this.project, "members", this.connection.secondaryMemberId);
    this.fail(`unknown member role ${role}`);
  }

  profile(role) {
    const member = this.member(role);
    const profile = this.profiles?.[member.profile] || this.profiles?.profiles?.[member.profile];
    if (!profile) this.fail(`${member.id}: profile not found: ${member.profile}`);
    return profile;
  }

  interface(role) {
    const index = this.definition.interfaces.findIndex((entry) => entry.role === role);
    if (index < 0) this.fail(`unknown interface role ${role}`);
    const interfaceId = this.zone.interfaceIds?.[index];
    if (!interfaceId) this.fail(`connection zone missing ${role} interface`);
    const options = {};
    if (role === "main") {
      const secondaryIndex = this.definition.interfaces.findIndex((entry) => entry.role === "secondary");
      const secondaryInterfaceId = this.zone.interfaceIds?.[secondaryIndex];
      if (secondaryInterfaceId) {
        options.referencePoint = resolveInterface(this.project, this.profiles, secondaryInterfaceId).origin;
        options.preferReferencePoint = true;
      }
    }
    return resolveInterface(this.project, this.profiles, interfaceId, options);
  }

  id(role) {
    const existing = this.connection.generator?.objectRoles?.[role];
    if (existing) {
      if (typeof existing !== "string") this.fail(`generator.objectRoles.${role} must be a string id`);
      return existing;
    }
    const suffix = this.definition.roles?.[role];
    if (!suffix) this.fail(`definition missing role suffix for ${role}`);
    return `${this.connectionId}${suffix}`;
  }

  role(role, id) {
    if (this.roles[role] && this.roles[role] !== id) this.fail(`role ${role} already assigned to ${this.roles[role]}`);
    this.roles[role] = id;
  }

  add(collection, id, object) {
    if (!this.model[collection]) this.fail(`unsupported output collection ${collection}`);
    if (!object?.type) this.fail(`${collection}.${id} missing type`);
    this.model[collection][id] = object;
  }

  attachFeature(ownerId, featureId) {
    const collection = this.model.plates[ownerId] ? "plates" : collectionForObject(this.project, ownerId);
    if (!["members", "plates"].includes(collection)) this.fail(`${ownerId}: features can only attach to members or plates`);
    const owner = this.model[collection][ownerId] || clone(projectObject(this.project, collection, ownerId));
    owner.featureIds = unique([...(owner.featureIds || []), featureId]);
    this.model[collection][ownerId] = owner;
  }
}

function buildConnectionPatch({ project, profiles, definition, connectionCatalog, fasteners, connectionId, parameters }) {
  const ctx = new ConnectionBuildContext({ project, profiles, definition, connectionCatalog, fasteners, connectionId, parameters });
  if (ctx.preset.type !== definition.type) fail(`${connectionId}: preset type ${ctx.preset.type} does not match ${definition.type}`);
  validateConnectionParameters(definition, ctx.parameters, { fasteners });
  definition.build(ctx);

  const ownedObjectIds = unique(flattenIds(ctx.roles));
  addDiagnosticDisplay(ctx.model, ownedObjectIds, ctx.diagnostics);
  const zone = ctx.model.connectionZones[ctx.zone.id];
  zone.objectIds = unique([...(ctx.zone.objectIds || []), ...ownedObjectIds]);

  ctx.model.connections[connectionId] = {
    ...ctx.connection,
    id: connectionId,
    type: definition.type,
    sourcePreset: { library: "connections", id: ctx.preset.id, version: ctx.preset.version },
    referenceParameters: clone(ctx.parameters),
    manualParts: mergeManualParts(ctx.connection.manualParts, generatedManualParts(ctx.model)),
    generator: {
      ...ctx.connection.generator,
      status: "generated",
      definition: definition.type,
      version: definition.version,
      ownedObjectIds,
      manualObjectIds: connectionOptionalObjectIds(ctx.connection),
      objectRoles: clone(ctx.roles),
      health: hasDiagnosticErrors(ctx.diagnostics) ? "error" : "ok",
      diagnostics: clone(ctx.diagnostics)
    }
  };

  return { objectIndex: objectIndexFor(ctx.model), model: ctx.model };
}

export function applyConnectionPatch(project, patch) {
  const next = clone(project);
  Object.assign(next.objectIndex, patch.objectIndex);
  for (const [collection, objects] of Object.entries(patch.model)) {
    next.model[collection] ||= {};
    Object.assign(next.model[collection], objects);
  }
  return next;
}

export function updateConnection({ project, profiles, definition, connectionCatalog, fasteners, connectionId, parameters }) {
  return applyConnectionPatch(project, buildConnectionPatch({ project, profiles, definition, connectionCatalog, fasteners, connectionId, parameters }));
}

function partLabel(part) {
  return part.bim?.name || part.fabrication?.partMark || part.id;
}

export function connectionPlateOptions(project, definition, connectionId) {
  const connection = connectionById(project, connectionId);
  const roles = connection.generator?.objectRoles || {};
  const requiredPlateIds = unique((definition.requiredPlateRoles || []).flatMap((role) => flattenIds(roles[role]))).filter((id) => project.model.plates?.[id]);
  const plateIds = unique([...requiredPlateIds, ...connectionOptionalObjectIds(connection)]).filter((id) => project.model.plates?.[id]);
  return plateIds.map((id) => {
    const plate = project.model.plates[id];
    return {
      id,
      label: partLabel(plate),
      role: requiredPlateIds.includes(id) ? "required" : plate.placementIntent?.role,
      included: (connection.manualParts?.plateIds || []).includes(id) && plate.display?.visible !== false,
      required: requiredPlateIds.includes(id)
    };
  });
}

export function setConnectionPlateIncluded(project, definition, connectionId, plateId, included) {
  const next = clone(project);
  const connection = connectionById(next, connectionId);
  const requiredPlateIds = connectionPlateOptions(next, definition, connectionId).filter((plate) => plate.required).map((plate) => plate.id);
  if (requiredPlateIds.includes(plateId) && !included) fail(`${connectionId}: generated plate is required by ${definition.type}`);
  if (!connectionOptionalObjectIds(connection).includes(plateId) && !requiredPlateIds.includes(plateId)) fail(`${connectionId}: plate is not a connection plate: ${plateId}`);

  const plate = next.model.plates?.[plateId];
  if (!plate) fail(`plate not found: ${plateId}`);

  connection.manualParts ||= {};
  connection.manualParts.plateIds = setId(connection.manualParts.plateIds || [], plateId, included);

  const zone = next.model.connectionZones?.[connection.connectionZoneId];
  if (zone) zone.objectIds = setId(zone.objectIds || [], plateId, included);

  plate.display = { ...(plate.display || {}), visible: included };

  for (const [assemblyId, assembly] of Object.entries(next.model.assemblies || {})) {
    const ownsPlate = assemblyId === plate.assemblyId || assemblyId === connection.assemblyId || assembly.partIds?.includes(plateId) || assembly.plateIds?.includes(plateId);
    if (ownsPlate) next.model.assemblies[assemblyId] = setAssemblyPlateIncluded(assembly, plateId, included);
  }

  return next;
}
