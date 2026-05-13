import { objectById } from "../core/model.mjs";
import { resolveInterface } from "../geometry/member-geometry.mjs?v=weld-fitting-1";
import { createSemanticBuilders } from "./builders.mjs";
import { clone, requiredPath, validateConnectionParameters } from "./schema.mjs";

const MODEL_COLLECTIONS = ["groups", "interfaces", "connectionZones", "assemblies", "members", "plates", "holePatterns", "objectPatterns", "features", "fastenerGroups", "welds", "connections"];
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

function connectionPreset(connectionLibrary, connection) {
  const presetId = connection.sourcePreset?.id;
  return connectionPresetById(connectionLibrary, presetId, connection.id);
}

function connectionPresetById(connectionLibrary, presetId, label = "connection") {
  const preset = connectionLibrary.connections[presetId];
  if (!preset) fail(`${label}: preset not found: ${presetId}`);
  return preset;
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

function zoneAssemblyId(project, zone) {
  const matches = Object.values(project.model.assemblies || {}).filter((assembly) => (assembly.connectionZoneIds || []).includes(zone.id));
  if (matches.length > 1) fail(`${zone.id}: multiple assemblies reference the connection zone`);
  if (matches.length === 1) return matches[0].id;
  fail(`${zone.id}: no assembly references the connection zone`);
}

function nextConnectionId(project, zone, preset) {
  const type = preset.type.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const base = `connection_${zone.id}_${type}`;
  let id = base;
  let index = 2;
  while (project.objectIndex?.[id] || project.model.connections?.[id]) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}

export function createProjectConnectionFromPreset(project, connectionLibrary, presetId, memberIds) {
  if (!Array.isArray(memberIds) || memberIds.length !== 2) fail("select exactly two members");
  if (memberIds[0] === memberIds[1]) fail("selected members must be different");
  for (const memberId of memberIds) projectObject(project, "members", memberId);

  const preset = connectionPresetById(connectionLibrary, presetId, "new connection");
  const matches = matchingConnectionZones(project, memberIds);
  if (matches.length === 0) fail(`no stored connection zone for selected members: ${memberIds.join(", ")}`);
  if (matches.length > 1) fail(`multiple stored connection zones for selected members: ${memberIds.join(", ")}`);

  const { zone, mainMemberId, secondaryMemberId } = matches[0];
  if ((zone.connectionIds || []).length) fail(`${zone.id}: connection already exists`);

  const next = clone(project);
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
      notes: "Created from selected library preset and stored connection zone."
    },
    bim: {
      name: preset.name
    }
  };

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
  constructor({ project, profiles, definition, connectionLibrary, fasteners, connectionId, parameters }) {
    this.project = project;
    this.profiles = profiles;
    this.definition = definition;
    this.connectionLibrary = connectionLibrary;
    this.fasteners = fasteners;
    this.connection = connectionById(project, connectionId);
    this.connectionId = connectionId;
    this.preset = connectionPreset(connectionLibrary, this.connection);
    this.parameters = clone(parameters);
    this.roles = {};
    this.diagnostics = [];
    this.model = Object.fromEntries(MODEL_COLLECTIONS.map((collection) => [collection, {}]));
    this.zone = projectObject(project, "connectionZones", this.connection.connectionZoneId);
    this.model.connectionZones[this.zone.id] = clone(this.zone);
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
      ...(details.parameters ? { parameters: details.parameters } : {})
    });
  }

  error(code, message, details = {}) {
    this.diagnostic("error", code, message, details);
  }

  param(path) {
    return requiredPath(this.parameters, path, this.definition.type);
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
      if (secondaryInterfaceId) options.referencePoint = resolveInterface(this.project, this.profiles, secondaryInterfaceId).origin;
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

function buildConnectionPatch({ project, profiles, definition, connectionLibrary, fasteners, connectionId, parameters }) {
  const ctx = new ConnectionBuildContext({ project, profiles, definition, connectionLibrary, fasteners, connectionId, parameters });
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

export function updateConnection({ project, profiles, definition, connectionLibrary, fasteners, connectionId, parameters }) {
  return applyConnectionPatch(project, buildConnectionPatch({ project, profiles, definition, connectionLibrary, fasteners, connectionId, parameters }));
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
