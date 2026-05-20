import { objectById } from "../core/model.mjs";
import { v } from "../core/math.mjs";
import { resolveInterface, sectionBounds } from "../geometry/member-geometry.mjs";
import { addIndexedObject, removeIndexedObject } from "../api/project/objects.mjs";
import { createMemberObject } from "../api/project/member-factory.mjs";
import {
  memberLayoutAxis,
  moveMemberWithLayout as moveMemberWithLayoutData,
  setMemberLayoutEndpoint as setMemberLayoutEndpointData,
  setMemberPhysicalEndpoint as setMemberPhysicalEndpointData
} from "../api/project/members.mjs";
import {
  optionalPath,
  setPath
} from "../modules/connections/connection-schema.mjs";
import {
  clone,
  connectionById,
  connectionComponentOptions as projectConnectionComponentOptions,
  connectionOptionalObjectIds,
  connectionPlateOptions as projectConnectionPlateOptions,
  createProjectConnectionFromPreset,
  setConnectionPlateIncluded as setProjectConnectionPlateIncluded,
  updateConnection
} from "../modules/connections/connection-generator.mjs";
import { connectionDefinition, supportedConnectionPresets, supportedConnections } from "../modules/connections/connection-registry.mjs";

const REF_ARRAY_KEYS = new Set([
  "objectIds",
  "partIds",
  "memberIds",
  "plateIds",
  "featureIds",
  "holePatternIds",
  "objectPatternIds",
  "fastenerGroupIds",
  "weldIds",
  "interfaceIds",
  "connectionZoneIds",
  "childAssemblyIds",
  "connectionIds"
]);
const FIT_EPSILON = 1e-6;
const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

function fail(message) {
  throw new Error(`project store: ${message}`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function appendUnique(values, id) {
  return unique([...(Array.isArray(values) ? values : []), id]);
}

function almostSamePoint(a, b, tolerance = FIT_EPSILON) {
  return Array.isArray(a) && Array.isArray(b) && v.len(v.sub(a, b)) <= tolerance;
}

function vec3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x, y, z] point`);
  }
  return [...value];
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  fail(`unsupported id reference ${value}`);
}

function profileById(profiles, profileId) {
  const profile = profiles?.[profileId] || profiles?.profiles?.[profileId];
  if (!profile) fail(`profile not found: ${profileId}`);
  return profile;
}

function memberById(project, memberId) {
  if (!project.model.members?.[memberId]) fail(`member not found: ${memberId}`);
  return project.model.members[memberId];
}

function objectCollection(project, objectId) {
  const indexed = project.objectIndex?.[objectId]?.collection;
  if (indexed && project.model[indexed]?.[objectId]) return indexed;
  for (const [collection, objects] of Object.entries(project.model || {})) {
    if (objects && typeof objects === "object" && !Array.isArray(objects) && objects[objectId]) return collection;
  }
  return null;
}

function removeReferences(value, deletedIds) {
  if (Array.isArray(value)) return value.filter((item) => !deletedIds.has(item)).map((item) => removeReferences(item, deletedIds));
  if (!value || typeof value !== "object") return value;
  for (const [key, child] of Object.entries(value)) {
    if (REF_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      value[key] = child.filter((id) => !deletedIds.has(id));
    } else {
      removeReferences(child, deletedIds);
    }
  }
  return value;
}

function removeObjects(project, objectIds) {
  const next = clone(project);
  const deletedIds = new Set(unique(objectIds));

  for (const id of deletedIds) {
    const collection = objectCollection(next, id);
    if (collection) delete next.model[collection][id];
    delete next.objectIndex[id];
  }
  removeReferences(next.model, deletedIds);
  return next;
}

function connectionOwnedObjectIds(connection) {
  const generator = connection.generator || {};
  const owned = Array.isArray(generator.ownedObjectIds) ? generator.ownedObjectIds : [];
  const manual = Array.isArray(generator.manualObjectIds) ? new Set(generator.manualObjectIds) : new Set();
  const manualParts = flattenIds(connection.manualParts).filter((id) => !manual.has(id));
  return unique([...owned, ...flattenIds(generator.objectRoles), ...manualParts]);
}

function connectionObjectIds(project, connection) {
  return unique([connection.id, ...connectionOwnedObjectIds(connection), ...connectionOptionalObjectIds(connection)])
    .filter((id) => project.objectIndex?.[id]);
}

function isConnectionGeneratedHelper(object, connectionId) {
  return object?.authoring?.generatedBy === connectionId && object.authoring?.lifecycle === "delete-with-connection";
}

function connectionGeneratedHelperIds(project, connection) {
  const ids = [];
  const zone = project.model.connectionZones?.[connection.connectionZoneId];
  if (isConnectionGeneratedHelper(zone, connection.id)) ids.push(zone.id);
  for (const interfaceId of zone?.interfaceIds || []) {
    if (isConnectionGeneratedHelper(project.model.interfaces?.[interfaceId], connection.id)) ids.push(interfaceId);
  }
  if (isConnectionGeneratedHelper(project.model.assemblies?.[connection.assemblyId], connection.id)) ids.push(connection.assemblyId);
  return unique(ids);
}

function affectedConnections(project, memberId) {
  return Object.values(project.model.connections || {}).filter((connection) => {
    return connection.mainMemberId === memberId || connection.secondaryMemberId === memberId;
  });
}

function connectionReferencesObject(connection, objectId) {
  if (connection.id === objectId) return true;
  return connectionOwnedObjectIds(connection).includes(objectId) || connectionOptionalObjectIds(connection).includes(objectId);
}

function connectionRoleForObject(connection, objectId) {
  for (const [role, value] of Object.entries(connection.generator?.objectRoles || {})) {
    if (flattenIds(value).includes(objectId)) return role;
  }
  return null;
}

function appendMemberToDefaultGroup(project, memberId) {
  const group = Object.values(project.model.groups || {}).find((item) => item.type === "member-group" || item.groupType === "members");
  if (!group) return;
  group.memberIds = appendUnique(group.memberIds, memberId);
  group.objectIds = appendUnique(group.objectIds, memberId);
}

function normalizedIndexList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b);
}

function setIndexIncluded(values, index, included) {
  const current = new Set(normalizedIndexList(values));
  if (included) current.delete(index);
  else current.add(index);
  return [...current].sort((a, b) => a - b);
}

function optionalComponentRole(definition, role) {
  return (definition.components || []).some((component) => component?.role === role && component.default === "ghost");
}

function setRoleInList(list = [], role, active) {
  const current = new Set((Array.isArray(list) ? list : []).filter((value) => typeof value === "string"));
  if (active) current.add(role);
  else current.delete(role);
  return [...current].sort();
}

function componentFromFace(project, face) {
  if (!face?.objectId) return null;
  const connection = Object.values(project.model.connections || {}).find((item) => connectionReferencesObject(item, face.objectId));
  if (!connection) return null;
  const collection = objectCollection(project, face.objectId);
  if (!collection) return null;

  const objectRole = connectionRoleForObject(connection, face.objectId);
  if (collection === "fastenerGroups" && Number.isInteger(face.positionIndex)) {
    const fastenerGroup = project.model.fastenerGroups?.[face.objectId];
    const patternRole = fastenerGroup?.holePatternRef ? connectionRoleForObject(connection, fastenerGroup.holePatternRef) : null;
    if (patternRole) {
      return {
        kind: "pattern-position",
        connectionId: connection.id,
        objectId: face.objectId,
        objectRole,
        patternRole,
        positionIndex: face.positionIndex
      };
    }
  }

  if (!objectRole) return null;
  return {
    kind: "object-role",
    connectionId: connection.id,
    objectId: face.objectId,
    objectRole
  };
}

function interfaceReferencePoint(project, profiles, zone, interfaceId) {
  const otherId = (zone.interfaceIds || []).find((id) => id !== interfaceId);
  try {
    if (otherId) return resolveInterface(project, profiles, otherId).origin;
  } catch (error) {
    if (!String(error.message || "").includes("stationReference requires a connection reference point")) throw error;
  }
  return Array.isArray(zone.origin) ? zone.origin : null;
}

function lockConnectionZoneFaces(project, profiles, connectionId) {
  const next = clone(project);
  const connection = connectionById(next, connectionId);
  const zone = next.model.connectionZones?.[connection.connectionZoneId];
  if (!zone) fail(`${connectionId}: connection zone not found: ${connection.connectionZoneId}`);

  for (const interfaceId of zone.interfaceIds || []) {
    const iface = next.model.interfaces?.[interfaceId];
    if (!iface || iface.faceRef !== "connection-secondary-facing-section-face") continue;
    const referencePoint = interfaceReferencePoint(next, profiles, zone, interfaceId);
    const resolved = resolveInterface(next, profiles, interfaceId, referencePoint ? { referencePoint, preferReferencePoint: true } : {});
    if (!resolved.faceRef || resolved.faceRef === iface.faceRef) continue;
    next.model.interfaces[interfaceId] = {
      ...iface,
      faceRef: resolved.faceRef,
      semanticIntent: {
        ...(iface.semanticIntent || {}),
        sourceFaceRef: iface.faceRef
      }
    };
  }
  return next;
}

function lockGeneratedConnectionFaces(project, profiles) {
  let next = project;
  for (const connection of Object.values(project.model.connections || {})) {
    if (connection.generator?.status === "generated") next = lockConnectionZoneFaces(next, profiles, connection.id);
  }
  return next;
}

function memberCenter(member) {
  return v.mul(v.add(member.start, member.end), 0.5);
}

function roundedDimension(value) {
  return Math.round(value * 1000) / 1000;
}

function connectionTolerance(project) {
  const tolerances = project.settings?.tolerances || {};
  return Math.max(
    tolerances.connectionGap || 0,
    tolerances.snap || 0,
    tolerances.coincident || 0
  ) || 25;
}

function axisGeometry(axis) {
  const vector = v.sub(axis.end, axis.start);
  const length = v.len(vector);
  if (length <= FIT_EPSILON) return null;
  return { ...axis, direction: v.mul(vector, 1 / length), length };
}

function projectedOnAxis(axisData, point) {
  const station = v.dot(v.sub(point, axisData.start), axisData.direction);
  const clampedStation = Math.min(axisData.length, Math.max(0, station));
  return {
    station,
    clampedStation,
    point: v.add(axisData.start, v.mul(axisData.direction, clampedStation))
  };
}

function memberSectionSpan(project, profiles, member) {
  const resolved = objectById(project, member.id);
  const profileId = resolved.profile || member.profile;
  if (!profileId) return 0;
  const bounds = sectionBounds(profileById(profiles, profileId));
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 0);
}

function layoutRepairTolerance(project, profiles, main, secondary) {
  return Math.max(
    connectionTolerance(project),
    memberSectionSpan(project, profiles, main),
    memberSectionSpan(project, profiles, secondary)
  ) * 1.25;
}

function canRepairLayoutAxis(member) {
  return member.authoring?.source === "viewer-command" || member.authoring?.command === "create-beam" || member.authoring?.command === "create-column";
}

function layoutRepairCandidate(project, profiles, main, secondary) {
  if (!canRepairLayoutAxis(secondary)) return null;
  const mainAxis = axisGeometry(memberLayoutAxis(main));
  const secondaryAxis = axisGeometry(memberLayoutAxis(secondary));
  if (!mainAxis || !secondaryAxis) return null;
  const tolerance = layoutRepairTolerance(project, profiles, main, secondary);
  let best = null;

  for (const endpoint of ["start", "end"]) {
    const point = secondaryAxis[endpoint];
    const projected = projectedOnAxis(mainAxis, point);
    if (projected.station < -tolerance || projected.station > mainAxis.length + tolerance) continue;
    const distance = v.len(v.sub(point, projected.point));
    if (distance > tolerance) continue;
    const offset = v.sub(projected.point, point);
    const candidate = {
      mainMemberId: main.id,
      secondaryMemberId: secondary.id,
      endpoint,
      offset,
      distance,
      station: projected.clampedStation,
      score: distance
    };
    if (!best || candidate.score < best.score) best = candidate;
  }

  return best;
}

function applyLayoutAxisRepair(project, repair) {
  const next = clone(project);
  const member = memberById(next, repair.secondaryMemberId);
  const axis = memberLayoutAxis(member);
  member.layoutAxis = {
    start: v.add(axis.start, repair.offset),
    end: v.add(axis.end, repair.offset)
  };
  member.authoring = {
    ...(member.authoring || {}),
    layoutAxisRepair: {
      source: "connection-create",
      mainMemberId: repair.mainMemberId,
      endpoint: repair.endpoint,
      offset: repair.offset.map(roundedDimension)
    }
  };
  return next;
}

function connectionSeedProjects(project, profiles, memberIds) {
  const [firstId, secondId] = memberIds || [];
  const first = project.model.members?.[firstId];
  const second = project.model.members?.[secondId];
  if (!first || !second) return [project];

  const repairs = [
    layoutRepairCandidate(project, profiles, first, second),
    layoutRepairCandidate(project, profiles, second, first)
  ]
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);

  return [project, ...repairs.map((repair) => applyLayoutAxisRepair(project, repair))];
}

export function createProjectStore({ project, profiles, connectionCatalog, fasteners }) {
  let currentProject = lockGeneratedConnectionFaces(clone(project), profiles);
  const subscribers = new Set();

  const definitionFor = (projectState, connectionId) => connectionDefinition(connectionCatalog, connectionById(projectState, connectionId));
  const emit = () => {
    for (const subscriber of subscribers) subscriber(currentProject);
  };
  const setProject = (nextProject) => {
    currentProject = nextProject;
    emit();
    return currentProject;
  };
  const regenerateConnection = (projectState, connectionId) => updateConnection({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, connectionId),
    connectionCatalog,
    fasteners,
    connectionId,
    parameters: connectionById(projectState, connectionId).referenceParameters
  });
  const updateConnectionParameters = (projectState, connectionId, parameters) => updateConnection({
    project: projectState,
    profiles,
    definition: definitionFor(projectState, connectionId),
    connectionCatalog,
    fasteners,
    connectionId,
    parameters
  });
  const regenerateMemberConnections = (projectState, memberId) => {
    let next = projectState;
    for (const connection of affectedConnections(projectState, memberId)) {
      if (connection.generator?.status === "generated") next = regenerateConnection(next, connection.id);
    }
    return next;
  };
  const generatedConnectionIds = (projectState) => Object.values(projectState.model.connections || {})
    .filter((connection) => connection.generator?.status === "generated")
    .map((connection) => connection.id);
  const secondaryInterface = (projectState, connectionId) => {
    const connection = connectionById(projectState, connectionId);
    const definition = definitionFor(projectState, connectionId);
    const secondaryIndex = definition.interfaces.findIndex((entry) => entry.role === "secondary");
    if (secondaryIndex < 0) fail(`${connectionId}: definition has no secondary interface`);
    const interfaceId = projectState.model.connectionZones?.[connection.connectionZoneId]?.interfaceIds?.[secondaryIndex];
    if (!interfaceId) fail(`${connectionId}: connection zone missing secondary interface`);
    return projectState.model.interfaces?.[interfaceId] || fail(`${connectionId}: secondary interface not found: ${interfaceId}`);
  };
  const fittingFeature = (projectState, connection) => {
    const roleId = connection.generator?.objectRoles?.beamFitting;
    if (roleId && projectState.model.features?.[roleId]?.type === "fitting") return projectState.model.features[roleId];
    return connectionOwnedObjectIds(connection)
      .map((id) => projectState.model.features?.[id])
      .find((feature) => feature?.type === "fitting" && feature.ownerId === connection.secondaryMemberId) || null;
  };
  const markConnectionError = (projectState, connectionId, code, message, objectRoles = []) => {
    const connection = projectState.model.connections?.[connectionId];
    if (!connection) return;
    const diagnostics = connection.generator?.diagnostics || [];
    connection.generator = {
      ...(connection.generator || {}),
      health: "error",
      diagnostics: diagnostics.some((entry) => entry.code === code)
        ? diagnostics
        : [...diagnostics, { severity: "error", code, message, objectRoles }]
    };
    for (const id of connectionOwnedObjectIds(connection)) {
      for (const collection of ["plates", "fastenerGroups", "welds", "features"]) {
        const object = projectState.model[collection]?.[id];
        if (object) object.display = { ...(object.display || {}), ...DIAGNOSTIC_DISPLAY };
      }
    }
  };
  const fitMemberEndToPlane = (projectState, connectionId) => {
    const connection = connectionById(projectState, connectionId);
    const feature = fittingFeature(projectState, connection);
    if (!feature?.plane) return false;
    if (feature.operationEnabled === false) return false;
    const iface = secondaryInterface(projectState, connectionId);
    const memberEnd = iface.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") return false;

    const member = projectState.model.members?.[connection.secondaryMemberId];
    if (!member) fail(`${connectionId}: secondary member not found: ${connection.secondaryMemberId}`);
    const normal = v.norm(vec3(feature.plane.normal, `${feature.id}.plane.normal`));
    const origin = vec3(feature.plane.origin, `${feature.id}.plane.origin`);
    const axis = v.sub(member.end, member.start);
    const denominator = v.dot(normal, axis);
    if (Math.abs(denominator) <= FIT_EPSILON) {
      markConnectionError(projectState, connectionId, "member-axis-parallel-to-fitting-plane", "Secondary member axis does not intersect the fitting plane.", ["beamFitting"]);
      return false;
    }

    const t = v.dot(normal, v.sub(origin, member.start)) / denominator;
    const fittedPoint = v.add(member.start, v.mul(axis, t));
    if (memberEnd === "start") {
      if (almostSamePoint(member.start, fittedPoint)) return false;
      member.start = fittedPoint;
      return true;
    }
    if (almostSamePoint(member.end, fittedPoint)) return false;
    member.end = fittedPoint;
    return true;
  };
  const reconcileGeneratedConnections = (projectState, iterations = 4) => {
    let next = projectState;
    const ids = generatedConnectionIds(next);
    for (let index = 0; index < iterations; index += 1) {
      for (const connectionId of ids) {
        if (next.model.connections?.[connectionId]) next = regenerateConnection(next, connectionId);
      }
      let changed = false;
      for (const connectionId of ids) {
        if (next.model.connections?.[connectionId]) changed = fitMemberEndToPlane(next, connectionId) || changed;
      }
      if (!changed) return next;
    }
    for (const connectionId of ids) {
      if (next.model.connections?.[connectionId]) next = regenerateConnection(next, connectionId);
    }
    return next;
  };
  const applyResolveHint = (parameters, hint) => {
    if (!hint?.path || typeof hint.value !== "number" || !Number.isFinite(hint.value)) return false;
    const current = optionalPath(parameters, hint.path);
    if (typeof current !== "number" || !Number.isFinite(current)) return false;
    const value = roundedDimension(hint.value);
    if (value <= 0) return false;
    if (hint.mode === "max" && current > value) {
      setPath(parameters, hint.path, value);
      return true;
    }
    if (hint.mode === "min" && current < value) {
      setPath(parameters, hint.path, value);
      return true;
    }
    if (hint.mode === "set" && Math.abs(current - value) > FIT_EPSILON) {
      setPath(parameters, hint.path, value);
      return true;
    }
    return false;
  };
  const resolveConnectionDiagnostics = (connectionId) => {
    let next = currentProject;
    let changed = false;
    for (let index = 0; index < 4; index += 1) {
      const connection = connectionById(next, connectionId);
      const diagnostics = connection.generator?.diagnostics || [];
      const parameters = clone(connection.referenceParameters);
      let iterationChanged = false;
      for (const diagnostic of diagnostics) {
        for (const hint of diagnostic.resolve || []) {
          iterationChanged = applyResolveHint(parameters, hint) || iterationChanged;
        }
      }
      if (!iterationChanged) break;
      next = reconcileGeneratedConnections(updateConnectionParameters(next, connectionId, parameters));
      changed = true;
      if (!(connectionById(next, connectionId).generator?.diagnostics || []).length) break;
    }
    if (!changed) fail(`${connectionId}: no automatic resolver is available for current diagnostics`);
    return setProject(next);
  };
  const replaceMember = (memberId, update) => {
    const next = clone(currentProject);
    const member = memberById(next, memberId);
    next.model.members[memberId] = update(member);
    return setProject(reconcileGeneratedConnections(regenerateMemberConnections(next, memberId)));
  };

  currentProject = reconcileGeneratedConnections(currentProject);

  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    project() {
      return currentProject;
    },

    object(objectId) {
      if (!currentProject.objectIndex?.[objectId]) fail(`object not found: ${objectId}`);
      return objectById(currentProject, objectId);
    },

    member(memberId) {
      memberById(currentProject, memberId);
      return objectById(currentProject, memberId);
    },

    connection(connectionId) {
      return connectionById(currentProject, connectionId);
    },

    connectionForObject(objectId) {
      return Object.values(currentProject.model.connections || {}).find((connection) => connectionReferencesObject(connection, objectId)) || null;
    },

    componentFromFace(face) {
      return componentFromFace(currentProject, face);
    },

    toggleConnectionComponentFromFace(face) {
      const component = componentFromFace(currentProject, face);
      if (!component) return null;
      const next = clone(currentProject);
      const connection = connectionById(next, component.connectionId);
      connection.componentOverrides ||= {};

      let included = true;
      if (component.kind === "pattern-position") {
        connection.componentOverrides.suppressedPatternPositions ||= {};
        const current = connection.componentOverrides.suppressedPatternPositions[component.patternRole] || [];
        included = current.includes(component.positionIndex);
        const nextList = setIndexIncluded(current, component.positionIndex, included);
        if (nextList.length) connection.componentOverrides.suppressedPatternPositions[component.patternRole] = nextList;
        else delete connection.componentOverrides.suppressedPatternPositions[component.patternRole];
      } else if (component.kind === "object-role") {
        const definition = definitionFor(next, component.connectionId);
        if (optionalComponentRole(definition, component.objectRole)) {
          const current = new Set(connection.componentOverrides.activeObjectRoles || []);
          included = !current.has(component.objectRole);
          if (included) current.add(component.objectRole);
          else current.delete(component.objectRole);
          connection.componentOverrides.activeObjectRoles = [...current].sort();
        } else {
          const current = new Set(connection.componentOverrides.suppressedObjectRoles || []);
          included = current.has(component.objectRole);
          if (included) current.delete(component.objectRole);
          else current.add(component.objectRole);
          connection.componentOverrides.suppressedObjectRoles = [...current].sort();
        }
      }

      const updated = setProject(reconcileGeneratedConnections(regenerateConnection(next, component.connectionId)));
      return { project: updated, component, included };
    },

    connectionObjectIds(connectionId) {
      return connectionObjectIds(currentProject, connectionById(currentProject, connectionId));
    },

    definition(connectionId) {
      return definitionFor(currentProject, connectionId);
    },

    supportedConnections() {
      return supportedConnections(currentProject, connectionCatalog);
    },

    connectionPresets() {
      return supportedConnectionPresets(connectionCatalog);
    },

    catalogEntries(catalog) {
      if (catalog === "fasteners") return fasteners.fasteners || {};
      return {};
    },

    createConnectionFromPreset(presetId, memberIds) {
      const preset = connectionCatalog.connections[presetId];
      if (!preset) fail(`connection preset not found: ${presetId}`);
      const definition = connectionDefinition(connectionCatalog, { type: preset.type, sourcePreset: { id: presetId } });
      let created = null;
      let firstError = null;
      for (const seedProject of connectionSeedProjects(currentProject, profiles, memberIds)) {
        try {
          created = createProjectConnectionFromPreset(seedProject, connectionCatalog, presetId, memberIds, { definition });
          break;
        } catch (error) {
          firstError ||= error;
          if (!String(firstError.message || "").includes("layout axes do not intersect")) break;
        }
      }
      if (!created) throw firstError;
      const locked = lockConnectionZoneFaces(created.project, profiles, created.connectionId);
      const next = reconcileGeneratedConnections(regenerateConnection(locked, created.connectionId));
      setProject(next);
      return { project: currentProject, connectionId: created.connectionId };
    },

    deleteConnection(connectionId) {
      const connection = connectionById(currentProject, connectionId);
      const ownedIds = connectionOwnedObjectIds(connection);
      const helperIds = connectionGeneratedHelperIds(currentProject, connection);
      return setProject(removeObjects(currentProject, [...ownedIds, ...helperIds, connectionId]));
    },

    connectionPlateOptions(connectionId) {
      return projectConnectionPlateOptions(currentProject, definitionFor(currentProject, connectionId), connectionId);
    },

    connectionComponentOptions(connectionId) {
      return projectConnectionComponentOptions(currentProject, definitionFor(currentProject, connectionId), connectionId);
    },

    setConnectionComponentActive(connectionId, role, active) {
      const next = clone(currentProject);
      const connection = connectionById(next, connectionId);
      const definition = definitionFor(next, connectionId);
      if (!(definition.components || []).some((component) => component?.role === role)) fail(`${connectionId}: unknown component role ${role}`);
      connection.componentOverrides ||= {};
      if (optionalComponentRole(definition, role)) {
        connection.componentOverrides.activeObjectRoles = setRoleInList(connection.componentOverrides.activeObjectRoles, role, active);
      } else {
        connection.componentOverrides.suppressedObjectRoles = setRoleInList(connection.componentOverrides.suppressedObjectRoles, role, !active);
      }
      return setProject(reconcileGeneratedConnections(regenerateConnection(next, connectionId)));
    },

    setConnectionPlateIncluded(connectionId, plateId, included) {
      return setProject(setProjectConnectionPlateIncluded(currentProject, definitionFor(currentProject, connectionId), connectionId, plateId, included));
    },

    resolveConnectionDiagnostics,

    updateConnection(connectionId, parameters) {
      return setProject(reconcileGeneratedConnections(updateConnection({
        project: currentProject,
        profiles,
        definition: definitionFor(currentProject, connectionId),
        connectionCatalog,
        fasteners,
        connectionId,
        parameters
      })));
    },

    createMember(options = {}) {
      const next = clone(currentProject);
      const member = createMemberObject(next, profiles, options);
      addIndexedObject(next, "members", member);
      appendMemberToDefaultGroup(next, member.id);
      const updated = setProject(reconcileGeneratedConnections(next));
      return { project: updated, memberId: member.id, member: updated.model.members[member.id] };
    },

    deleteMember(memberId) {
      if (!currentProject.model.members?.[memberId]) fail(`member not found: ${memberId}`);
      const next = clone(currentProject);
      removeIndexedObject(next, memberId);
      removeReferences(next.model, new Set([memberId]));
      return setProject(reconcileGeneratedConnections(next));
    },

    updateMember(memberId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("member patch must be an object");
      return replaceMember(memberId, (member) => ({ ...member, ...clone(patch) }));
    },

    setMemberProfile(memberId, profileId) {
      profileById(profiles, profileId);
      return replaceMember(memberId, (member) => ({ ...member, profile: profileId }));
    },

    setMemberRotation(memberId, rotation) {
      if (typeof rotation !== "number" || !Number.isFinite(rotation)) fail("member rotation must be a finite number");
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    rotateMember(memberId, deltaDegrees) {
      if (typeof deltaDegrees !== "number" || !Number.isFinite(deltaDegrees)) fail("rotation delta must be a finite number");
      const rotation = (objectById(currentProject, memberId).rotation || 0) + deltaDegrees;
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    setMemberEndpoints(memberId, start, end) {
      const nextStart = vec3(start, "member start");
      const nextEnd = vec3(end, "member end");
      if (v.len(v.sub(nextEnd, nextStart)) <= 1e-9) fail(`${memberId}: member cannot have zero length`);
      return replaceMember(memberId, (member) => ({ ...member, start: nextStart, end: nextEnd }));
    },

    moveMember(memberId, delta) {
      const offset = vec3(delta, "member move delta");
      return replaceMember(memberId, (member) => ({
        ...member,
        start: v.add(member.start, offset),
        end: v.add(member.end, offset)
      }));
    },

    moveMemberWithLayout(memberId, delta) {
      return replaceMember(memberId, (member) => moveMemberWithLayoutData(member, delta));
    },

    setMemberPhysicalEndpoint(memberId, endpoint, point) {
      return replaceMember(memberId, (member) => setMemberPhysicalEndpointData(member, endpoint, point));
    },

    setMemberLayoutEndpoint(memberId, endpoint, point) {
      return replaceMember(memberId, (member) => setMemberLayoutEndpointData(member, endpoint, point));
    },

    setMemberCenter(memberId, center) {
      const target = vec3(center, "member center");
      const member = memberById(currentProject, memberId);
      const offset = v.sub(target, memberCenter(member));
      return replaceMember(memberId, (storedMember) => ({
        ...storedMember,
        start: v.add(storedMember.start, offset),
        end: v.add(storedMember.end, offset)
      }));
    }
  };
}
