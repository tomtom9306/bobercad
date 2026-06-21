import {
  optionalObjectValue,
  optionalStringValue,
  requiredObjectValue
} from "./smart-component-runtime-validation.mjs";

export function instanceInput(instance, key) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalObjectValue(inputs[key], {}, `${instance.id}.inputs.${key}`);
}

export function instanceMainMemberId(instance) {
  return instanceInput(instance, "main").memberId;
}

export function instanceSecondaryMemberId(instance) {
  return instanceInput(instance, "secondary").memberId;
}

export function instanceConnectionZoneId(instance) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalStringValue(inputs.connectionZoneId, null, `${instance.id}.inputs.connectionZoneId`);
}

export function instanceAssemblyId(instance) {
  const inputs = requiredObjectValue(instance.inputs, `${instance.id}.inputs`);
  return optionalStringValue(inputs.assemblyId, null, `${instance.id}.inputs.assemblyId`);
}
