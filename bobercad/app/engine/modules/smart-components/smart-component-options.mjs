import { flattenIds, jsonClone as clone, uniqueTruthy as unique } from "../../core/model.mjs";
import { componentEntries } from "./smart-component-catalog.mjs";
import {
  instanceAssemblyId,
  instanceConnectionZoneId
} from "./smart-component-instance-helpers.mjs";
import {
  projectCollection,
  projectObjectIndex,
  setId,
  smartComponentById
} from "./smart-component-model-helpers.mjs";
import {
  fail,
  optionalObjectValue,
  optionalStringArrayValue,
  requiredObjectValue,
  requiredStringArrayValue,
  requiredStringValue
} from "./smart-component-runtime-validation.mjs";

function setAssemblyPlateIncluded(assembly, plateId, included) {
  return {
    ...assembly,
    partIds: setId(assembly.partIds, plateId, included),
    plateIds: setId(assembly.plateIds, plateId, included)
  };
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
