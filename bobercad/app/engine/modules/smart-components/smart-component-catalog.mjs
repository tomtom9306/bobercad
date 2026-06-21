import { jsonClone as clone } from "../../core/model.mjs";
import {
  fail,
  optionalObjectValue,
  optionalStringArrayValue,
  requiredArrayValue,
  requiredObjectValue,
  requiredStringValue
} from "./smart-component-runtime-validation.mjs";

export function componentEntries(definition, ctx = null) {
  return requiredArrayValue(definition.components, `${definition.type || "definition"}.components`, ctx)
    .map((component, index) => requiredObjectValue(component, `${definition.type || "definition"}.components[${index}]`, ctx));
}

export function catalogPresets(catalog) {
  return requiredObjectValue(requiredObjectValue(catalog, "smart component catalog").smartComponents, "smart component catalog.smartComponents");
}

export function catalogDefinitions(catalog) {
  return requiredObjectValue(requiredObjectValue(catalog, "smart component catalog").definitions, "smart component catalog.definitions");
}

export function smartComponentPreset(catalog, instance) {
  const label = instance.id || "smart component";
  const sourceComponent = requiredObjectValue(instance.sourceComponent, `${label}.sourceComponent`);
  const presetId = requiredStringValue(sourceComponent.id, `${label}.sourceComponent.id`);
  return smartComponentPresetById(catalog, presetId, instance.id);
}

export function smartComponentPresetById(catalog, presetId, label = "smart component") {
  requiredStringValue(presetId, `${label}.presetId`);
  const preset = catalogPresets(catalog)[presetId];
  if (!preset) fail(`${label}: preset not found: ${presetId}`);
  return preset;
}

export function smartComponentDefinitionForPreset(catalog, preset, label) {
  const definition = catalogDefinitions(catalog)[preset.type];
  if (!definition) fail(`${label}: definition not found for ${preset.type}`);
  return definition;
}

export function smartComponentPresetName(preset, label) {
  return requiredStringValue(preset.name, `${label}.name`);
}

export function objectStringValues(object, label, ctx = null) {
  return Object.entries(requiredObjectValue(object, label, ctx)).map(([key, value]) => (
    requiredStringValue(value, `${label}.${key}`, ctx)
  ));
}

export function smartComponentDefinitionForInstance(catalog, instance) {
  const preset = smartComponentPreset(catalog, instance);
  return smartComponentDefinitionForPreset(catalog, preset, instance.id);
}

export function defaultGhostComponentRoles(definition) {
  return componentEntries(definition).flatMap((component, index) => {
    const role = requiredStringValue(component.role, `${definition.type || "definition"}.components[${index}].role`);
    return component.default === "ghost" ? [role] : [];
  });
}

export function smartComponentSourceComponent(preset, version = preset.version) {
  return { library: "smart-components", id: preset.id, version };
}

export function smartComponentInstanceRecord({
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
