import { createSemanticBuilders } from "../../api/model/semantic-builders.mjs";
import { createCheckApi } from "../../api/model/checks.mjs";
import { createGeometryApi } from "../../api/model/geometry.mjs";
import { modelOperationBuilder, validateModelOperationInput } from "../../api/model/connection-primitive-registry.mjs";
import { createSection, estimateObjects, splitByMaxWeight, sectionSchedule } from "../../api/model/transport-sectioning.mjs";
import { createMemberObject } from "../../api/project/member-factory.mjs";
import { smartComponentDetachedObjectIds } from "../../api/project/dependencies.mjs";
import { libraryProfileById } from "../../api/project/profiles.mjs";
import { v } from "../../core/math.mjs";
import { arrayValues, flattenIds, jsonClone as clone, objectById, uniqueTruthy as unique } from "../../core/model.mjs";
import { resolveInterface } from "../../geometry/member-geometry.mjs";
import { optionalPath, requiredPath, validateSmartComponentParameters } from "./smart-component-parameters-and-definition.mjs";
import {
  applyNestedConnectionInterfaceReference,
  connectionInterfaceDefinitions,
  generatedSmartComponentHelperAuthoring,
  nestedConnectionInterfaceType
} from "./smart-component-creation.mjs";
import {
  defaultGhostComponentRoles,
  objectStringValues,
  smartComponentDefinitionForInstance,
  smartComponentDefinitionForPreset,
  smartComponentInstanceRecord,
  smartComponentPreset,
  smartComponentPresetById,
  smartComponentPresetName,
  smartComponentSourceComponent
} from "./smart-component-catalog.mjs";
import {
  instanceAssemblyId,
  instanceConnectionZoneId,
  instanceMainMemberId,
  instanceSecondaryMemberId
} from "./smart-component-instance-helpers.mjs";
import {
  collectionForObject,
  mergedProjectView,
  mergePatchModel,
  MODEL_COLLECTIONS,
  nextId,
  objectIndexFor,
  projectCollection,
  projectObject,
  projectObjectIndex,
  resolvedProjectObject,
  smartComponentById
} from "./smart-component-model-helpers.mjs";
import {
  applySmartComponentPatch,
  applySmartComponentPatchInPlace,
  clonePatchableProject
} from "./smart-component-patch-application.mjs";
import {
  addDiagnosticDisplay,
  applyComponentOverrides,
  applyFieldOverrides,
  fieldOverrideDiagnostics,
  hasDiagnosticErrors,
  outputContractIssue,
  prefixedChildDiagnostics,
  setNestedOutput
} from "./smart-component-overrides.mjs";
import {
  fail,
  optionalNullableStringValue,
  optionalObjectValue,
  optionalStringArrayValue,
  optionalStringValue,
  plainObject,
  requiredObjectValue,
  requiredStringArrayValue,
  requiredStringValue,
  safeId
} from "./smart-component-runtime-validation.mjs";

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

  componentInstance(id) {
    if (typeof id !== "string" || !id) return null;
    const instance = mergedProjectView(this.project, this.model).model?.smartComponentInstances?.[id];
    return instance ? clone(instance) : null;
  }

  componentOutput(componentId, path) {
    const instance = this.componentInstance(componentId);
    if (!instance) return undefined;
    const outputPath = String(path || "");
    const value = outputPath.includes(".") ? optionalPath(instance.outputs, outputPath) : instance.outputs?.[outputPath];
    return value === undefined ? undefined : clone(value);
  }

  objectCollection(id) {
    if (typeof id !== "string" || !id) return "";
    return mergedProjectView(this.project, this.model).objectIndex?.[id]?.collection || "";
  }

  modelObject(id, collection = "") {
    if (typeof id !== "string" || !id) return null;
    const projectView = mergedProjectView(this.project, this.model);
    const actualCollection = projectView.objectIndex?.[id]?.collection || "";
    if (!actualCollection || (collection && actualCollection !== collection)) return null;
    return clone(objectById(projectView, id));
  }

  transportSections(objectIds, options = {}) {
    const projectView = mergedProjectView(this.project, this.model);
    const libraries = { profiles: this.profiles, materials: this.materials };
    if (options.strategy === "max-weight") {
      return splitByMaxWeight(projectView, libraries, objectIds, {
        maxWeightKg: options.maxWeightKg,
        idPrefix: options.idPrefix
      });
    }
    const estimates = estimateObjects(projectView, libraries, objectIds);
    const count = Math.max(1, Math.min(Number(options.sectionCount) || 1, estimates.length));
    return Array.from({ length: count }, (_, index) => {
      const start = Math.floor(estimates.length * index / count);
      const end = Math.floor(estimates.length * (index + 1) / count);
      return createSection(`${options.idPrefix}_${index + 1}`, estimates.slice(start, end), options.metadata || {});
    });
  }

  transportSectionSchedule(sections) {
    return sectionSchedule(sections);
  }

  operation(type, input) {
    input = requiredObjectValue(input, `${type}: operation input`, this);
    validateModelOperationInput(type, input, { runtimeKeys: ["recipeContext"], fail: (message) => this.fail(message) });
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
    const projectView = mergedProjectView(this.project, this.model);
    const interfaces = connectionInterfaceDefinitions(definition);
    const interfaceIds = interfaces.map((entry, index) => {
      const interfaceRole = requiredStringValue(entry.role, `${definition.type}.interfaces[${index}].role`, this);
      const auto = requiredObjectValue(entry.auto, `${definition.type}.interfaces[${index}].auto`, this);
      const ownerId = interfaceRole === "secondary"
        ? secondaryObjectIds[0]
        : mainObjectId;
      const type = nestedConnectionInterfaceType(projectView, ownerId, auto, `${definition.type}.interfaces[${index}].auto`, this);
      const id = nextId(mergedProjectView(this.project, this.model), `${interfaceIdPrefix}_${safeId(interfaceRole)}_interface`);
      const iface = {
        id,
        type,
        ownerId,
        role: `connection-${interfaceRole}`,
        origin: connection.origin,
        notes: optionalStringValue(connection.notes, `${preset.type} nested connection interface`, `${role}: connection.notes`, this),
        authoring: generatedSmartComponentHelperAuthoring(childId)
      };
      applyNestedConnectionInterfaceReference(iface, type, auto, `${definition.type}.interfaces[${index}].auto`, this);
      this.model.interfaces[id] = iface;
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
