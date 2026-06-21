import { memberLayoutAxis } from "../../api/project/members.mjs";
import { closestAxisSegmentPoints, finitePositiveNumber, v } from "../../core/math.mjs";
import { jsonClone as clone, objectById, uniqueTruthy as unique } from "../../core/model.mjs";
import {
  addModelObject,
  nextId,
  projectCollection,
  projectObject,
  projectObjectIndex
} from "./smart-component-model-helpers.mjs";
import {
  defaultGhostComponentRoles,
  smartComponentInstanceRecord,
  smartComponentPresetById,
  smartComponentPresetName,
  smartComponentSourceComponent
} from "./smart-component-catalog.mjs";
import {
  fail,
  optionalMemberEndValue,
  optionalNullableStringValue,
  optionalObjectValue,
  optionalStringArrayValue,
  optionalStringValue,
  reject,
  requiredObjectValue,
  requiredStringValue,
  safeId,
  vec3
} from "./smart-component-runtime-validation.mjs";

const AXIS_EPSILON = 1e-9;

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

export function generatedSmartComponentHelperAuthoring(instanceId = null) {
  return {
    source: "smart-component-api",
    lifecycle: "delete-with-smart-component",
    status: "generated",
    ...(instanceId ? { componentInstanceId: instanceId, componentStatus: "managed" } : {})
  };
}

export function connectionInterfaceDefinitions(definition) {
  const interfaces = definition?.interfaces;
  if (!Array.isArray(interfaces) || !interfaces.length) fail(`${definition?.type || "definition"}: connection interfaces are required`);
  return interfaces;
}

function autoInterfaceSpec(definition, preset, role) {
  const entry = connectionInterfaceDefinitions(definition).find((item) => item.role === role);
  if (!entry) fail(`${preset.type}: missing ${role} interface`);
  return requiredObjectValue(entry.auto, `${preset.type}.${role}.auto`);
}

export function nestedConnectionInterfaceType(project, ownerId, auto, label, ctx) {
  const ownerEntry = projectObjectIndex(project)[ownerId];
  if (!ownerEntry) reject(ctx, `${ownerId}: nested connection interface owner missing from objectIndex`);
  if (ownerEntry.collection === "smartComponentInstances") return "component-scope";
  return requiredStringValue(auto.type, `${label}.type`, ctx);
}

export function applyNestedConnectionInterfaceReference(target, type, auto, label, ctx) {
  if (type === "component-scope") return;
  if (type === "member-end-face") {
    target.memberEnd = optionalMemberEndValue(auto.memberEnd, `${label}.memberEnd`, ctx);
    if (!target.memberEnd) reject(ctx, `${label}.memberEnd is required for member-end-face`);
    return;
  }
  if (type === "member-web") {
    const faceRef = requiredStringValue(auto.faceRef, `${label}.faceRef`, ctx);
    if (faceRef !== "web-center-plane") reject(ctx, `${label}.faceRef must be web-center-plane`);
    target.faceRef = faceRef;
    return;
  }
  if (type === "planar-face") {
    target.faceRef = requiredStringValue(auto.faceRef, `${label}.faceRef`, ctx);
    if (auto.stationReference !== undefined) target.stationReference = requiredStringValue(auto.stationReference, `${label}.stationReference`, ctx);
    return;
  }
  reject(ctx, `${label}.type is not supported for nested connection interfaces: ${type}`);
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

function addSmartComponentInstance(project, instanceId, preset, instance) {
  projectCollection(project, "smartComponentInstances")[instanceId] = instance;
  projectObjectIndex(project)[instanceId] = { collection: "smartComponentInstances", type: preset.type };
  return instance;
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
