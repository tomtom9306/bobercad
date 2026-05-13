import { objectById } from "../core/model.mjs";
import { v } from "../core/math.mjs";
import { resolveInterface } from "../geometry/member-geometry.mjs?v=weld-fitting-1";
import {
  clone,
  connectionById,
  connectionOptionalObjectIds,
  connectionPlateOptions as projectConnectionPlateOptions,
  createProjectConnectionFromPreset,
  setConnectionPlateIncluded as setProjectConnectionPlateIncluded,
  updateConnection
} from "../connections/engine.mjs";
import { connectionDefinition, supportedConnectionPresets, supportedConnections } from "../connections/registry.mjs";

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

function affectedConnections(project, memberId) {
  return Object.values(project.model.connections || {}).filter((connection) => {
    return connection.mainMemberId === memberId || connection.secondaryMemberId === memberId;
  });
}

function connectionReferencesObject(connection, objectId) {
  if (connection.id === objectId) return true;
  return connectionOwnedObjectIds(connection).includes(objectId) || connectionOptionalObjectIds(connection).includes(objectId);
}

function interfaceReferencePoint(project, profiles, zone, interfaceId) {
  const otherId = (zone.interfaceIds || []).find((id) => id !== interfaceId);
  return otherId ? resolveInterface(project, profiles, otherId).origin : null;
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
    const resolved = resolveInterface(next, profiles, interfaceId, referencePoint ? { referencePoint } : {});
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

export function createProjectStore({ project, profiles, connectionLibrary, fasteners }) {
  let currentProject = lockGeneratedConnectionFaces(clone(project), profiles);
  const subscribers = new Set();

  const definitionFor = (projectState, connectionId) => connectionDefinition(connectionLibrary, connectionById(projectState, connectionId));
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
    connectionLibrary,
    fasteners,
    connectionId,
    parameters: connectionById(projectState, connectionId).referenceParameters
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
  const replaceMember = (memberId, update) => {
    const next = clone(currentProject);
    const member = memberById(next, memberId);
    next.model.members[memberId] = update(member);
    return setProject(reconcileGeneratedConnections(regenerateMemberConnections(next, memberId)));
  };

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

    connectionObjectIds(connectionId) {
      return connectionObjectIds(currentProject, connectionById(currentProject, connectionId));
    },

    definition(connectionId) {
      return definitionFor(currentProject, connectionId);
    },

    supportedConnections() {
      return supportedConnections(currentProject, connectionLibrary);
    },

    connectionPresets() {
      return supportedConnectionPresets(connectionLibrary);
    },

    createConnectionFromPreset(presetId, memberIds) {
      const created = createProjectConnectionFromPreset(currentProject, connectionLibrary, presetId, memberIds);
      const locked = lockConnectionZoneFaces(created.project, profiles, created.connectionId);
      const next = reconcileGeneratedConnections(regenerateConnection(locked, created.connectionId));
      setProject(next);
      return { project: currentProject, connectionId: created.connectionId };
    },

    deleteConnection(connectionId) {
      const connection = connectionById(currentProject, connectionId);
      const ownedIds = connectionOwnedObjectIds(connection);
      return setProject(removeObjects(currentProject, [...ownedIds, connectionId]));
    },

    connectionPlateOptions(connectionId) {
      return projectConnectionPlateOptions(currentProject, definitionFor(currentProject, connectionId), connectionId);
    },

    setConnectionPlateIncluded(connectionId, plateId, included) {
      return setProject(setProjectConnectionPlateIncluded(currentProject, definitionFor(currentProject, connectionId), connectionId, plateId, included));
    },

    updateConnection(connectionId, parameters) {
      return setProject(reconcileGeneratedConnections(updateConnection({
        project: currentProject,
        profiles,
        definition: definitionFor(currentProject, connectionId),
        connectionLibrary,
        fasteners,
        connectionId,
        parameters
      })));
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
