import { arrayValues, flattenIds, isPlainObject as plainObject, jsonClone as clone, mergeObjectPatch as mergePatch, normalizedIndexList, objectById, truthyValues, uniqueTruthy as unique } from "../core/model.mjs";
import { averageVec3, finiteInteger, finiteNonNegativeNumber, finiteNumber, finitePositiveNumber, finiteVec3, v } from "../core/math.mjs";
import { requiredReferencePlane } from "../geometry/reference-plane.mjs";
import { resolveInterface } from "../geometry/member-geometry.mjs";
import { addIndexedObject, appendUniqueId, cleanId, nextObjectId, objectCollection, removeIndexedObject, removeProjectObjects } from "../api/project/objects.mjs";
import { projectProfileCatalog, requiredProfileById } from "../api/project/profiles.mjs";
import { createMemberObject } from "../api/project/member-factory.mjs";
import {
  addPlate as addPlateObject,
  addSketch as addSketchObject,
  plateFromSketchObject,
  profileFromSectionSketch
} from "../api/project/plate-sketch-relations-and-bends.mjs";
import { activeTrimJointOperations, trimOperationReferencePlaneIds } from "../api/project/trim-operations.mjs";
import {
  axisRelationFromSnap,
  memberAlignRelation,
  memberAxisRelations,
  relationUpsertKey
} from "../api/project/axis-relations.mjs";
import {
  affectedSmartComponentsForMember,
  affectedSmartComponentIdsForMember,
  smartComponentForObject as projectSmartComponentForObject,
  smartComponentObjectIds,
  smartComponentOwnedObjectIds,
  smartComponentReferencesObject,
  smartComponentRoot,
  smartComponentRootForObject as projectSmartComponentRootForObject,
  featureDependencyObjectIds as projectFeatureDependencyObjectIds,
  memberDependencyObjectIds as projectMemberDependencyObjectIds,
  referencePlaneDependencyObjectIds as projectReferencePlaneDependencyObjectIds,
  smartComponentConnectionZoneId,
  smartComponentSecondaryMemberId,
  trimJointDependencyObjectIds as projectTrimJointDependencyObjectIds
} from "../api/project/dependencies.mjs";
import {
  almostSamePoint as almostSamePointData,
  memberAxisData,
  memberCenter,
  memberPointAtEnd,
  moveMemberWithLayout as moveMemberWithLayoutData,
  setMemberLayoutEndpoint as setMemberLayoutEndpointData,
  setMemberPhysicalEndpoint as setMemberPhysicalEndpointData
} from "../api/project/members.mjs";
import {
  optionalPath,
  setPath
} from "../modules/smart-components/smart-component-parameters-and-definition.mjs";
import {
  smartComponentById,
  smartComponentRoleOptions as projectSmartComponentRoleOptions,
  smartComponentPlateOptions as projectSmartComponentPlateOptions,
  createProjectSmartComponentFromPreset,
  setSmartComponentPlateIncluded as setProjectSmartComponentPlateIncluded,
  updateSmartComponent,
  updateSmartComponents
} from "../modules/smart-components/smart-component-runtime.mjs";
import { smartComponentDefinition, supportedSmartComponentPresets, supportedSmartComponents } from "../modules/smart-components/smart-component-registry.mjs";
import { trimRegionSelectorMap } from "../api/model/trim-region-keys.mjs";
import { createProjectCommandResult } from "./project-command-results.mjs";
import { createProjectTransaction } from "./project-transaction.mjs";
import { createProjectCommand, deriveProjectCommandObjectIds, executeProjectCommand } from "./project-command-registry.mjs";
import {
  FIT_EPSILON,
  assemblyById,
  assertOptionalNumber,
  cloneProjectForModelCollection,
  connectionZoneById,
  defaultGridAxis,
  fail,
  fastenerCatalogEntries,
  fastenerGroupById,
  featureById,
  finiteVec2,
  gridAxisIsReferenced,
  gridSystemById,
  groupById,
  holePatternById,
  interfaceById,
  levelById,
  memberById,
  nextGridAxisId,
  objectPatternById,
  optionalObject,
  optionalStringList,
  plateById,
  projectCollection,
  projectModel,
  projectObjectIndex,
  referencePlaneById,
  removeObjects,
  requiredArray,
  requiredObject,
  requiredStringList,
  setIndexedModelObject,
  sketchById,
  trimJointById,
  trimJointHasParticipant,
  trimParticipantEnd,
  validateAssembly,
  validateConnectionZone,
  validateFastenerGroup,
  validateGridAxis,
  validateGridAxisGroup,
  validateGridSystem,
  validateGroup,
  validateHolePattern,
  validateInterface,
  validateInterfaceExtents,
  validateLevel,
  validateObjectPattern,
  validateObjectPatternTransform,
  validateOptionalNonZeroVec3,
  validateOptionalString,
  validateOptionalStringArray,
  validateOptionalTracking,
  validateOptionalVec3,
  validateReferencePlane,
  validateReferencePlaneExtents,
  validateRequiredString,
  validateTrimRegionKeys,
  validateUpdatedModelObject,
  validateWeld,
  validateWorkPoint,
  validateWorkPointGridRefs,
  vec3,
  weldById,
  workPointById
} from "./project-store-model-helpers.mjs";
import {
  smartComponentGeneratedHelperIds,
  recordSmartComponentFieldOverride,
  appendMemberToDefaultGroup,
  upsertRelationObject,
  addMemberSnapRelations,
  setIndexIncluded,
  setRoleInList,
  smartComponentAssemblyId,
  componentFromFace,
  lockSmartComponentZoneFaces,
  roundedDimension
} from "./project-store-smart-component-helpers.mjs";
import { createPlateSketchStoreMethods } from "./project-store-plate-sketch-methods.mjs";
import { createSmartComponentStoreMethods } from "./project-store-smart-component-methods.mjs";
import { createTrimStoreMethods } from "./project-store-trim-methods.mjs";

const DIAGNOSTIC_DISPLAY = {
  color: "#dc2626",
  edgeColor: "#7f1d1d",
  diagnosticState: "error"
};

export function createProjectStore({ project, profiles, smartComponentCatalog, fasteners, materials, cloneOnLoad = true }) {
  const initialProject = cloneOnLoad ? clone(project) : project;
  const profilesFor = (projectState) => projectProfileCatalog(projectState, profiles);
  let currentProject = initialProject;
  const state = { currentProject };
  let lastCommandResult = createProjectCommandResult({ project: currentProject, commandType: "project.load" });
  const undoStack = [];
  const redoStack = [];
  const subscribers = new Set();

  const definitionFor = (projectState, smartComponentId) => smartComponentDefinition(smartComponentCatalog, smartComponentById(projectState, smartComponentId));
  const emit = (result) => {
    for (const subscriber of subscribers) subscriber(currentProject, result);
  };
  const commitResult = (result, { beforeProject = null, recordHistory = false, clearRedo = false } = {}) => {
    if (recordHistory && beforeProject && beforeProject !== result.project) {
      undoStack.push({
        commandType: result.commandType,
        beforeProject,
        afterProject: result.project
      });
      if (clearRedo) redoStack.length = 0;
    }
    lastCommandResult = result;
    currentProject = result.project;
    state.currentProject = currentProject;
    emit(result);
    return result.project;
  };
  const commitCommand = (command) => {
    const beforeProject = currentProject;
    const result = executeProjectCommand(command, beforeProject);
    return commitResult(result, {
      beforeProject,
      recordHistory: command.recordHistory,
      clearRedo: command.recordHistory
    });
  };
  const commitProject = (commandType, nextProject, metadata = {}) => commitCommand(createProjectCommand({
    type: commandType,
    apply: () => nextProject,
    ...metadata
  }));
  const historyResult = (commandType, nextProject, previousProject) => {
    const objectIds = deriveProjectCommandObjectIds(previousProject, nextProject);
    return createProjectCommandResult({
      project: nextProject,
      commandType,
      ...objectIds
    });
  };
  const commitHistoryProject = (commandType, nextProject, previousProject) => {
    const result = historyResult(commandType, nextProject, previousProject);
    return commitResult(result, { recordHistory: false });
  };
  const commitTransaction = (transaction, nextProject = transaction.project) => {
    const transactionResult = transaction.result(nextProject);
    return commitCommand(createProjectCommand({
      type: transactionResult.commandType,
      apply: () => transactionResult.project,
      changedObjectIds: transactionResult.changedObjectIds,
      removedObjectIds: transactionResult.removedObjectIds,
      regeneratedObjectIds: transactionResult.regeneratedObjectIds,
      diagnostics: transactionResult.diagnostics
    }));
  };
  const smartComponentUpdateContext = (projectState) => ({
    project: projectState,
    profiles: profilesFor(projectState),
    catalog: smartComponentCatalog,
    fasteners,
    materials
  });
  const regenerateSmartComponent = (projectState, smartComponentId) => updateSmartComponent({
    ...smartComponentUpdateContext(projectState),
    definition: definitionFor(projectState, smartComponentId),
    instanceId: smartComponentId,
    parameters: smartComponentById(projectState, smartComponentId).referenceParameters
  });
  const updateSmartComponentParameters = (projectState, smartComponentId, parameters) => updateSmartComponent({
    ...smartComponentUpdateContext(projectState),
    definition: definitionFor(projectState, smartComponentId),
    instanceId: smartComponentId,
    parameters
  });
  const generatedSmartComponentIdsForMember = (projectState, memberId) => affectedSmartComponentsForMember(projectState, memberId)
      .filter((smartComponent) => smartComponent.status === "generated")
      .map((smartComponent) => smartComponent.id);
  const smartComponentConnectionHelperObjectIds = (projectState, smartComponent) => {
    const zones = projectCollection(projectState, "connectionZones");
    const zoneIds = new Set();
    const inputZoneId = smartComponentConnectionZoneId(smartComponent);
    if (inputZoneId) zoneIds.add(inputZoneId);
    for (const zone of Object.values(zones)) {
      if (requiredStringList(zone.smartComponentInstanceIds || [], `${zone.id}.smartComponentInstanceIds`).includes(smartComponent.id)) {
        zoneIds.add(zone.id);
      }
    }
    const ids = [];
    for (const zoneId of zoneIds) {
      const zone = zones[zoneId];
      if (!zone) fail(`${smartComponent.id}: connection zone not found: ${zoneId}`);
      const componentIds = requiredStringList(zone.smartComponentInstanceIds || [], `${zone.id}.smartComponentInstanceIds`);
      if (componentIds.some((componentId) => componentId !== smartComponent.id)) continue;
      ids.push(zone.id, ...requiredStringList(zone.interfaceIds || [], `${zone.id}.interfaceIds`));
    }
    return unique(ids);
  };
  const smartComponentRemovalObjectIds = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    return unique([
      ...smartComponentObjectIds(projectState, smartComponent),
      ...smartComponentOwnedObjectIds(smartComponent),
      ...smartComponentGeneratedHelperIds(projectState, smartComponent),
      ...smartComponentConnectionHelperObjectIds(projectState, smartComponent),
      smartComponentId
    ]);
  };
  const memberRemovalObjectIds = (projectState, memberId) => {
    if (!projectCollection(projectState, "members")[memberId]) fail(`member not found: ${memberId}`);
    const relationIds = memberAxisRelations(projectState, memberId).map((relation) => relation.id);
    const affectedSmartComponents = affectedSmartComponentsForMember(projectState, memberId);
    const smartComponentIds = affectedSmartComponents.map((smartComponent) => smartComponent.id);
    const generatedIds = affectedSmartComponents.flatMap((smartComponent) => smartComponentOwnedObjectIds(smartComponent));
    const helperIds = affectedSmartComponents.flatMap((smartComponent) => smartComponentGeneratedHelperIds(projectState, smartComponent));
    return unique([memberId, ...relationIds, ...generatedIds, ...helperIds, ...smartComponentIds]);
  };
  const deletionObjectIds = (projectState, objectIds) => {
    const ids = new Set(unique(requiredStringList(objectIds, "object ids")));
    const queue = [...ids];
    for (let index = 0; index < queue.length; index += 1) {
      const objectId = queue[index];
      const collection = objectCollection(projectState, objectId);
      if (!collection) fail(`object not found: ${objectId}`);
      const expandedIds = collection === "members"
        ? memberRemovalObjectIds(projectState, objectId)
        : collection === "smartComponentInstances"
          ? smartComponentRemovalObjectIds(projectState, objectId)
          : [];
      for (const expandedId of expandedIds) {
        if (!ids.has(expandedId)) {
          ids.add(expandedId);
          queue.push(expandedId);
        }
      }
    }
    return [...ids];
  };
  const regenerateMemberSmartComponents = (projectState, memberId) => {
    const smartComponentIds = generatedSmartComponentIdsForMember(projectState, memberId);
    if (!smartComponentIds.length) return projectState;
    return updateSmartComponents({
      ...smartComponentUpdateContext(projectState),
      definitionFor,
      instanceIds: smartComponentIds,
      parametersFor: (state, smartComponentId) => smartComponentById(state, smartComponentId).referenceParameters
    });
  };
  const regenerateSmartComponentsBatch = (projectState, smartComponentIds) => {
    const instances = projectCollection(projectState, "smartComponentInstances");
    const ids = requiredStringList(smartComponentIds, "smart component id batch");
    for (const smartComponentId of ids) {
      if (!instances[smartComponentId]) fail(`smart component not found: ${smartComponentId}`);
    }
    if (!ids.length) return projectState;
    return updateSmartComponents({
      ...smartComponentUpdateContext(projectState),
      definitionFor,
      instanceIds: ids
    });
  };
  const generatedSmartComponentIds = (projectState) => Object.values(projectCollection(projectState, "smartComponentInstances"))
    .filter((smartComponent) => smartComponent.status === "generated")
    .map((smartComponent) => smartComponent.id);
  const secondaryInterface = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const definition = definitionFor(projectState, smartComponentId);
    const secondaryIndex = definition.interfaces.findIndex((entry) => entry.role === "secondary");
    if (secondaryIndex < 0) fail(`${smartComponentId}: definition has no secondary interface`);
    const zoneId = smartComponentConnectionZoneId(smartComponent);
    if (!zoneId) fail(`${smartComponentId}: connection zone id is required`);
    const zone = projectCollection(projectState, "connectionZones")[zoneId];
    if (!zone) fail(`${smartComponentId}: connection zone not found: ${zoneId}`);
    const interfaceId = requiredStringList(zone.interfaceIds, `${zoneId}.interfaceIds`)[secondaryIndex];
    if (!interfaceId) fail(`${smartComponentId}: connection zone missing secondary interface`);
    return projectCollection(projectState, "interfaces")[interfaceId] || fail(`${smartComponentId}: secondary interface not found: ${interfaceId}`);
  };
  const memberTrimJoint = (projectState, smartComponent) => {
    const roleId = requiredObject(smartComponent.objectRoles, `${smartComponent.id}.objectRoles`).beamTrim;
    if (roleId === undefined) return null;
    if (typeof roleId !== "string" || !roleId) fail(`${smartComponent.id}.objectRoles.beamTrim must be an id`);
    const trimJoints = projectCollection(projectState, "trimJoints");
    const trimJoint = trimJoints[roleId];
    if (!trimJoint) fail(`${smartComponent.id}.objectRoles.beamTrim not found: ${roleId}`);
    if (trimJoint.type !== "member-trim") fail(`${roleId}: beamTrim role must reference a member-trim`);
    return trimJoint;
  };
  const markSmartComponentError = (projectState, smartComponentId, code, message, objectRoles = []) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const diagnostics = requiredArray(smartComponent.diagnostics, `${smartComponentId}.diagnostics`);
    Object.assign(smartComponent, {
      health: "error",
      diagnostics: diagnostics.some((entry) => entry.code === code)
        ? diagnostics
        : [...diagnostics, { severity: "error", code, message, objectRoles }]
    });
    for (const id of smartComponentOwnedObjectIds(smartComponent)) {
      for (const collection of ["plates", "fastenerGroups", "welds", "features", "trimJoints"]) {
        const object = projectCollection(projectState, collection)[id];
        if (object) object.display = { ...optionalObject(object.display, `${id}.display`), ...DIAGNOSTIC_DISPLAY };
      }
    }
  };
  const fitMemberEndToTrimPlane = (projectState, smartComponentId) => {
    const smartComponent = smartComponentById(projectState, smartComponentId);
    const trimJoint = memberTrimJoint(projectState, smartComponent);
    const secondaryMemberId = smartComponentSecondaryMemberId(smartComponent);
    if (!trimJoint) return false;
    const operation = activeTrimJointOperations(trimJoint).find((item) => item.type === "plane-trim" && item.memberAId === secondaryMemberId);
    if (!operation) return false;
    const referencePlaneIds = trimOperationReferencePlaneIds(operation);
    if (referencePlaneIds.length !== 1) {
      markSmartComponentError(projectState, smartComponentId, "beam-trim-plane-count", "Generated member trim requires exactly one trim plane.", ["beamTrim"]);
      return false;
    }
    const iface = secondaryInterface(projectState, smartComponentId);
    const memberEnd = iface.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") fail(`${iface.id}: secondary interface memberEnd must be start or end`);

    const member = projectCollection(projectState, "members")[secondaryMemberId];
    if (!member) fail(`${smartComponentId}: secondary member not found: ${secondaryMemberId}`);
    const plane = requiredReferencePlane(projectState, referencePlaneIds[0], `${trimJoint.id}:${operation.id}`, fail);
    const normal = v.norm(vec3(plane.normal, `${trimJoint.id}.${operation.id}.referencePlane.normal`));
    const origin = vec3(plane.origin, `${trimJoint.id}.${operation.id}.referencePlane.origin`);
    const axis = memberAxisData(member);
    if (!axis) fail(`${smartComponentId}: secondary member axis is invalid`);
    const axisVector = v.mul(axis.direction, axis.length);
    const denominator = v.dot(normal, axisVector);
    if (Math.abs(denominator) <= FIT_EPSILON) {
      markSmartComponentError(projectState, smartComponentId, "member-axis-parallel-to-trim-plane", "Secondary member axis does not intersect the trim plane.", ["beamTrim"]);
      return false;
    }

    const t = v.dot(normal, v.sub(origin, axis.start)) / denominator;
    const fittedPoint = v.add(axis.start, v.mul(axisVector, t));
    if (memberEnd === "start") {
      if (almostSamePointData(member.start, fittedPoint, FIT_EPSILON)) return false;
      member.start = fittedPoint;
      return true;
    }
    if (almostSamePointData(member.end, fittedPoint, FIT_EPSILON)) return false;
    member.end = fittedPoint;
    return true;
  };
  const reconcileGeneratedSmartComponents = (projectState, iterations = 4) => {
    let next = projectState;
    const ids = generatedSmartComponentIds(next);
    for (let index = 0; index < iterations; index += 1) {
      next = regenerateSmartComponentsBatch(next, ids);
      let changed = false;
      for (const smartComponentId of ids) {
        if (!projectCollection(next, "smartComponentInstances")[smartComponentId]) fail(`smart component not found after regeneration: ${smartComponentId}`);
        changed = fitMemberEndToTrimPlane(next, smartComponentId) || changed;
      }
      if (!changed) return next;
    }
    return regenerateSmartComponentsBatch(next, ids);
  };
  const commitRegeneratedSmartComponent = (commandType, projectState, smartComponentId) => commitProject(
    commandType,
    reconcileGeneratedSmartComponents(regenerateSmartComponent(projectState, smartComponentId)),
    {
      changedObjectIds: [smartComponentId],
      regeneratedObjectIds: [smartComponentId]
    }
  );
  const updateRegeneratedSmartComponent = (smartComponentId, update) => {
    const next = clone(currentProject);
    const smartComponent = smartComponentById(next, smartComponentId);
    const updated = update(next, smartComponent);
    if (!updated || typeof updated !== "object" || Array.isArray(updated)) fail("smart component update must return a project object");
    return commitRegeneratedSmartComponent("smartComponent.regenerate", updated, smartComponentId);
  };
  const applyResolveHint = (parameters, hint) => {
    if (!plainObject(hint)) fail("resolve hint must be an object");
    if (typeof hint.path !== "string" || !hint.path) fail("resolve hint path must be a non-empty string");
    if (!finiteNumber(hint.value)) fail(`${hint.path}: resolve hint value must be finite`);
    if (hint.mode !== "max" && hint.mode !== "min" && hint.mode !== "set") fail(`${hint.path}: unsupported resolve hint mode ${hint.mode || "missing"}`);
    const current = optionalPath(parameters, hint.path);
    if (!finiteNumber(current)) fail(`${hint.path}: resolved parameter must be finite`);
    const value = roundedDimension(hint.value);
    if (value <= 0) fail(`${hint.path}: resolve hint value must be positive`);
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
  const replacementTransaction = (collection, objectId, commandType) => {
    const transaction = createProjectTransaction(currentProject, { commandType, cloneProject: false });
    transaction.project = cloneProjectForModelCollection(currentProject, collection);
    transaction.changed(objectId);
    return transaction;
  };
  const resolveSmartComponentDiagnostics = (smartComponentId) => {
    let next = currentProject;
    let changed = false;
    for (let index = 0; index < 4; index += 1) {
      const smartComponent = smartComponentById(next, smartComponentId);
      const diagnostics = arrayValues(smartComponent.diagnostics);
      const parameters = clone(smartComponent.referenceParameters);
      let iterationChanged = false;
      for (const diagnostic of diagnostics) {
        const resolveHints = diagnostic.resolve === undefined ? [] : diagnostic.resolve;
        if (!Array.isArray(resolveHints)) fail(`${diagnostic.code || "diagnostic"}.resolve must be an array`);
        for (const hint of resolveHints) {
          iterationChanged = applyResolveHint(parameters, hint) || iterationChanged;
        }
      }
      if (!iterationChanged) break;
      next = reconcileGeneratedSmartComponents(updateSmartComponentParameters(next, smartComponentId, parameters));
      changed = true;
      if (!arrayValues(smartComponentById(next, smartComponentId).diagnostics).length) break;
    }
    if (!changed) fail(`${smartComponentId}: no automatic resolver is available for current diagnostics`);
    return commitProject("smartComponent.diagnostics.resolve", next, {
      changedObjectIds: [smartComponentId],
      regeneratedObjectIds: [smartComponentId]
    });
  };
  const replaceMember = (memberId, update, options = {}) => {
    const transaction = replacementTransaction("members", memberId, "member.replace");
    const next = transaction.project;
    const member = memberById(next, memberId);
    const updated = update(member);
    next.model.members[memberId] = updated;
    recordSmartComponentFieldOverride(next, member, updated);
    if (options.regenerateSmartComponents === false) return commitTransaction(transaction);
    const regeneratedIds = generatedSmartComponentIdsForMember(next, memberId);
    if (regeneratedIds.length) transaction.regenerated(regeneratedIds);
    return commitTransaction(transaction, regenerateMemberSmartComponents(next, memberId));
  };
  const replaceFeature = (featureId, update) => {
    const transaction = replacementTransaction("features", featureId, "feature.replace");
    const next = transaction.project;
    const feature = featureById(next, featureId);
    const updated = validateUpdatedModelObject(update(feature), featureId, "feature");
    if (updated.ownerId !== feature.ownerId) fail("feature owner cannot be changed");
    if (updated.type !== feature.type) fail("feature type cannot be changed");
    setIndexedModelObject(next, "features", featureId, updated);
    return commitTransaction(transaction);
  };
  const replaceClonedIndexedObject = (collection, objectId, read, update, label) => {
    const transaction = createProjectTransaction(currentProject, { commandType: `${collection}.replace` });
    const next = transaction.project;
    const object = read(next, objectId);
    const updated = validateUpdatedModelObject(update(clone(object)), objectId, label);
    if (updated.type !== object.type) fail(`${label} type cannot be changed`);
    setIndexedModelObject(next, collection, objectId, updated);
    transaction.changed(objectId);
    return commitTransaction(transaction);
  };
  const plateTypeCanChange = (from, to) => {
    return from === to || (["plate", "bent-plate"].includes(from) && ["plate", "bent-plate"].includes(to));
  };
  const replacePlate = (plateId, update) => {
    const transaction = createProjectTransaction(currentProject, { commandType: "plates.replace" });
    const next = transaction.project;
    const plate = plateById(next, plateId);
    const updated = validateUpdatedModelObject(update(clone(plate)), plateId, "plate");
    if (!plateTypeCanChange(plate.type, updated.type)) fail("plate type cannot be changed");
    setIndexedModelObject(next, "plates", plateId, updated);
    transaction.changed(plateId);
    return commitTransaction(transaction);
  };
  const replaceSketch = (sketchId, update) => replaceClonedIndexedObject("sketches", sketchId, sketchById, update, "sketch");
  const replaceGridSystem = (gridSystemId, update) => {
    const transaction = replacementTransaction("gridSystems", gridSystemId, "gridSystem.replace");
    const next = transaction.project;
    const gridSystem = gridSystemById(next, gridSystemId);
    const updated = validateUpdatedModelObject(update(gridSystem), gridSystemId, "grid system");
    if (updated.type !== gridSystem.type) fail("grid system type cannot be changed");
    validateGridSystem(updated);
    setIndexedModelObject(next, "gridSystems", gridSystemId, updated);
    return commitTransaction(transaction);
  };
  const replaceLevel = (levelId, update) => {
    const transaction = replacementTransaction("levels", levelId, "level.replace");
    const next = transaction.project;
    const level = levelById(next, levelId);
    const updated = validateUpdatedModelObject(update(level), levelId, "level");
    if (updated.type !== level.type) fail("level type cannot be changed");
    validateLevel(updated);
    setIndexedModelObject(next, "levels", levelId, updated);
    return commitTransaction(transaction);
  };
  const replaceWorkPoint = (workPointId, update) => {
    const transaction = replacementTransaction("workPoints", workPointId, "workPoint.replace");
    const next = transaction.project;
    const workPoint = workPointById(next, workPointId);
    const updated = validateUpdatedModelObject(update(workPoint), workPointId, "work point");
    if (updated.type !== workPoint.type) fail("work point type cannot be changed");
    validateWorkPoint(updated);
    setIndexedModelObject(next, "workPoints", workPointId, updated);
    return commitTransaction(transaction);
  };
  const replaceReferencePlane = (referencePlaneId, update) => {
    const transaction = replacementTransaction("referencePlanes", referencePlaneId, "referencePlane.replace");
    const next = transaction.project;
    const plane = referencePlaneById(next, referencePlaneId);
    const updated = validateUpdatedModelObject(update(plane), referencePlaneId, "reference plane");
    if (updated.type !== plane.type) fail("reference plane type cannot be changed");
    validateReferencePlane(updated);
    setIndexedModelObject(next, "referencePlanes", referencePlaneId, updated);
    return commitTransaction(transaction);
  };
  const replaceHolePattern = (holePatternId, update) => {
    const transaction = replacementTransaction("holePatterns", holePatternId, "holePattern.replace");
    const next = transaction.project;
    const holePattern = holePatternById(next, holePatternId);
    const updated = validateUpdatedModelObject(update(holePattern), holePatternId, "hole pattern");
    if (updated.type !== holePattern.type) fail("hole pattern type cannot be changed");
    validateHolePattern(updated);
    setIndexedModelObject(next, "holePatterns", holePatternId, updated);
    return commitTransaction(transaction);
  };
  const replaceGroup = (groupId, update) => {
    const transaction = replacementTransaction("groups", groupId, "group.replace");
    const next = transaction.project;
    const group = groupById(next, groupId);
    const updated = validateUpdatedModelObject(update(group), groupId, "group");
    if (updated.type !== group.type) fail("group type cannot be changed");
    validateGroup(updated);
    setIndexedModelObject(next, "groups", groupId, updated);
    return commitTransaction(transaction);
  };
  const replaceAssembly = (assemblyId, update) => {
    const transaction = replacementTransaction("assemblies", assemblyId, "assembly.replace");
    const next = transaction.project;
    const assembly = assemblyById(next, assemblyId);
    const updated = validateUpdatedModelObject(update(assembly), assemblyId, "assembly");
    if (updated.type !== assembly.type) fail("assembly type cannot be changed");
    validateAssembly(updated);
    setIndexedModelObject(next, "assemblies", assemblyId, updated);
    return commitTransaction(transaction);
  };
  const replaceObjectPattern = (objectPatternId, update) => {
    const transaction = replacementTransaction("objectPatterns", objectPatternId, "objectPattern.replace");
    const next = transaction.project;
    const objectPattern = objectPatternById(next, objectPatternId);
    const updated = validateUpdatedModelObject(update(objectPattern), objectPatternId, "object pattern");
    if (updated.type !== objectPattern.type) fail("object pattern type cannot be changed");
    validateObjectPattern(updated);
    setIndexedModelObject(next, "objectPatterns", objectPatternId, updated);
    return commitTransaction(transaction);
  };
  const replaceInterface = (interfaceId, update) => {
    const transaction = replacementTransaction("interfaces", interfaceId, "interface.replace");
    const next = transaction.project;
    const iface = interfaceById(next, interfaceId);
    const updated = validateUpdatedModelObject(update(iface), interfaceId, "interface");
    if (updated.type !== iface.type) fail("interface type cannot be changed");
    if (updated.ownerId !== iface.ownerId) fail("interface owner cannot be changed");
    validateInterface(updated);
    setIndexedModelObject(next, "interfaces", interfaceId, updated);
    return commitTransaction(transaction);
  };
  const replaceConnectionZone = (connectionZoneId, update) => {
    const transaction = replacementTransaction("connectionZones", connectionZoneId, "connectionZone.replace");
    const next = transaction.project;
    const zone = connectionZoneById(next, connectionZoneId);
    const updated = validateUpdatedModelObject(update(zone), connectionZoneId, "connection zone");
    if (updated.type !== zone.type) fail("connection zone type cannot be changed");
    if (updated.mainObjectId !== zone.mainObjectId) fail("connection zone main object cannot be changed");
    validateConnectionZone(updated);
    setIndexedModelObject(next, "connectionZones", connectionZoneId, updated);
    return commitTransaction(transaction);
  };
  const replaceTrimJoint = (trimJointId, update) => {
    const transaction = replacementTransaction("trimJoints", trimJointId, "trimJoint.replace");
    const next = transaction.project;
    const trimJoint = trimJointById(next, trimJointId);
    const updated = validateUpdatedModelObject(update(trimJoint), trimJointId, "trim joint");
    if (updated.type !== trimJoint.type) fail("trim joint type cannot be changed");
    setIndexedModelObject(next, "trimJoints", trimJointId, updated);
    return commitTransaction(transaction);
  };
  const replaceFastenerGroup = (fastenerGroupId, update) => {
    const transaction = replacementTransaction("fastenerGroups", fastenerGroupId, "fastenerGroup.replace");
    const next = transaction.project;
    next.model.smartComponentInstances = Object.fromEntries(Object.entries(projectCollection(currentProject, "smartComponentInstances")).map(([id, instance]) => [id, clone(instance)]));
    const fastenerGroup = clone(fastenerGroupById(next, fastenerGroupId));
    const updated = validateUpdatedModelObject(update(clone(fastenerGroup)), fastenerGroupId, "fastener group");
    if (updated.type !== fastenerGroup.type) fail("fastener group type cannot be changed");
    validateFastenerGroup(fasteners, updated);
    setIndexedModelObject(next, "fastenerGroups", fastenerGroupId, updated);
    recordSmartComponentFieldOverride(next, fastenerGroup, updated);
    return commitTransaction(transaction);
  };
  const replaceWeld = (weldId, update) => {
    const transaction = replacementTransaction("welds", weldId, "weld.replace");
    const next = transaction.project;
    next.model.smartComponentInstances = Object.fromEntries(Object.entries(projectCollection(currentProject, "smartComponentInstances")).map(([id, instance]) => [id, clone(instance)]));
    const weld = clone(weldById(next, weldId));
    const updated = validateUpdatedModelObject(update(clone(weld)), weldId, "weld");
    if (updated.type !== weld.type) fail("weld type cannot be changed");
    validateWeld(updated);
    setIndexedModelObject(next, "welds", weldId, updated);
    recordSmartComponentFieldOverride(next, weld, updated);
    return commitTransaction(transaction);
  };
  const updateProjectMetadata = (patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("project metadata patch must be an object");
    const nextInfo = mergePatch(currentProject.project || {}, clone(patch));
    if (typeof nextInfo.id !== "string" || !nextInfo.id.trim()) fail("project id must be a non-empty string");
    if (typeof nextInfo.name !== "string" || !nextInfo.name.trim()) fail("project name must be a non-empty string");
    if (JSON.stringify(nextInfo) === JSON.stringify(currentProject.project || {})) return currentProject;
    const next = clone(currentProject);
    next.project = nextInfo;
    return commitProject("project.metadata.update", next, { changedObjectIds: [] });
  };

  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },

    project() {
      return currentProject;
    },

    lastCommandResult() {
      return lastCommandResult;
    },

    updateProjectMetadata,

    historyState() {
      return {
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        undoCount: undoStack.length,
        redoCount: redoStack.length,
        lastCommandType: lastCommandResult.commandType
      };
    },

    trimJoint(trimJointId) {
      return trimJointById(currentProject, trimJointId);
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return currentProject;
      redoStack.push(entry);
      return commitHistoryProject(`${entry.commandType}.undo`, entry.beforeProject, currentProject);
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return currentProject;
      undoStack.push(entry);
      return commitHistoryProject(`${entry.commandType}.redo`, entry.afterProject, currentProject);
    },

    ...createSmartComponentStoreMethods({
      state,
      affectedSmartComponentIdsForMember,
      addIndexedObject,
      arrayValues,
      clone,
      commitProject,
      commitRegeneratedSmartComponent,
      componentFromFace,
      createProjectSmartComponentFromPreset,
      definitionFor,
      fail,
      fastenerCatalogEntries,
      fasteners,
      featureById,
      finiteNumber,
      lockSmartComponentZoneFaces,
      materials,
      memberById,
      nextObjectId,
      objectById,
      objectCollection,
      optionalObject,
      profilesFor,
      projectCollection,
      projectFeatureDependencyObjectIds,
      projectMemberDependencyObjectIds,
      projectObjectIndex,
      projectReferencePlaneDependencyObjectIds,
      projectSmartComponentForObject,
      projectSmartComponentPlateOptions,
      projectSmartComponentRoleOptions,
      projectSmartComponentRootForObject,
      projectTrimJointDependencyObjectIds,
      reconcileGeneratedSmartComponents,
      referencePlaneById,
      regenerateSmartComponent,
      resolveSmartComponentDiagnostics,
      requiredArray,
      requiredObject,
      requiredStringList,
      setIndexIncluded,
      setProjectSmartComponentPlateIncluded,
      setRoleInList,
      smartComponentById,
      smartComponentCatalog,
      smartComponentGeneratedHelperIds,
      smartComponentDefinition,
      smartComponentObjectIds,
      smartComponentOwnedObjectIds,
      smartComponentRemovalObjectIds,
      smartComponentRootApi: smartComponentRoot,
      supportedSmartComponentsApi: supportedSmartComponents,
      supportedSmartComponentPresetsApi: supportedSmartComponentPresets,
      removeObjects,
      trimJointById,
      unique,
      updateRegeneratedSmartComponent,
      updateSmartComponentRuntime: updateSmartComponent,
      validateGridSystem,
      validateLevel
    }),

    createMember(options = {}) {
      const next = clone(currentProject);
      const member = createMemberObject(next, options);
      addIndexedObject(next, "members", member);
      addMemberSnapRelations(next, member.id, options);
      appendMemberToDefaultGroup(next, member.id);
      const updated = commitProject("member.create", reconcileGeneratedSmartComponents(next), { changedObjectIds: [member.id] });
      return { project: updated, memberId: member.id, member: updated.model.members[member.id] };
    },

    createPlate(options = {}) {
      const next = clone(currentProject);
      const plate = addPlateObject(next, options);
      const updated = commitProject("plate.create", next, { changedObjectIds: [plate.id] });
      return { project: updated, plateId: plate.id, plate: updated.model.plates[plate.id] };
    },

    createSketch(options = {}) {
      const next = clone(currentProject);
      const sketch = addSketchObject(next, options);
      const updated = commitProject("sketch.create", next, { changedObjectIds: [sketch.id] });
      return { project: updated, sketchId: sketch.id, sketch: updated.model.sketches[sketch.id] };
    },

    createPlateFromSketch(sketchId, options = {}) {
      const next = clone(currentProject);
      const source = sketchById(next, sketchId);
      const plate = plateFromSketchObject(next, source, options);
      addIndexedObject(next, "plates", plate);
      const updated = commitProject("plate.createFromSketch", next, { changedObjectIds: [plate.id] });
      return { project: updated, plateId: plate.id, plate: updated.model.plates[plate.id] };
    },

    ...createTrimStoreMethods({
      state,
      commitProject,
      replaceTrimJoint
    }),

    deleteMember(memberId) {
      const removedObjectIds = memberRemovalObjectIds(currentProject, memberId);
      return commitProject("member.delete", removeObjects(currentProject, removedObjectIds), { removedObjectIds });
    },

    deleteObjects(objectIds = []) {
      const removedObjectIds = deletionObjectIds(currentProject, objectIds);
      if (!removedObjectIds.length) return currentProject;
      return commitProject("object.delete", removeObjects(currentProject, removedObjectIds), { removedObjectIds });
    },

    updateMember(memberId, patch, options = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("member patch must be an object");
      return replaceMember(memberId, (member) => ({ ...member, ...clone(patch) }), options);
    },

    memberAxisRelations(memberId) {
      memberById(currentProject, memberId);
      return memberAxisRelations(currentProject, memberId);
    },

    setMemberAlignment(memberId, source) {
      memberById(currentProject, memberId);
      const next = clone(currentProject);
      const relation = memberAlignRelation(memberId, source);
      upsertRelationObject(next, relation);
      return commitProject("member.alignment.set", next, { changedObjectIds: [relation.id] });
    },

    clearMemberAlignment(memberId) {
      memberById(currentProject, memberId);
      const relation = memberAxisRelations(currentProject, memberId).find((item) => item.type === "member-align-axis");
      return relation ? commitProject("member.alignment.clear", removeObjects(currentProject, [relation.id]), { removedObjectIds: [relation.id] }) : currentProject;
    },

    upsertRelation(relation) {
      const next = clone(currentProject);
      upsertRelationObject(next, relation);
      return commitProject("relation.upsert", next, { changedObjectIds: [relation.id] });
    },

    deleteRelation(relationId) {
      if (typeof relationId !== "string" || !relationId) fail("relation id must be a non-empty string");
      if (!projectCollection(currentProject, "relations")[relationId]) fail(`relation not found: ${relationId}`);
      return commitProject("relation.delete", removeObjects(currentProject, [relationId]), { removedObjectIds: [relationId] });
    },

    updateFeature(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature patch must be an object");
      if ("id" in patch && patch.id !== featureId) fail("feature id cannot be changed");
      if ("ownerId" in patch) fail("feature owner cannot be changed");
      if ("type" in patch) fail("feature type cannot be changed");
      return replaceFeature(featureId, (feature) => mergePatch(feature, patch));
    },

    updateFastenerGroup(fastenerGroupId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("fastener group patch must be an object");
      if ("id" in patch && patch.id !== fastenerGroupId) fail("fastener group id cannot be changed");
      if ("type" in patch) fail("fastener group type cannot be changed");
      return replaceFastenerGroup(fastenerGroupId, (fastenerGroup) => mergePatch(fastenerGroup, patch));
    },

    updateWeld(weldId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("weld patch must be an object");
      if ("id" in patch && patch.id !== weldId) fail("weld id cannot be changed");
      if ("type" in patch) fail("weld type cannot be changed");
      return replaceWeld(weldId, (weld) => mergePatch(weld, patch));
    },

    updateGridSystem(gridSystemId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("grid system patch must be an object");
      if ("id" in patch && patch.id !== gridSystemId) fail("grid system id cannot be changed");
      if ("type" in patch) fail("grid system type cannot be changed");
      return replaceGridSystem(gridSystemId, (gridSystem) => mergePatch(gridSystem, patch));
    },

    addGridAxis(gridSystemId, axisGroup, patch = {}) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("grid axis patch must be an object");
      const group = validateGridAxisGroup(axisGroup);
      return replaceGridSystem(gridSystemId, (gridSystem) => {
        const axes = arrayValues(gridSystem.axes?.[group]);
        const axis = defaultGridAxis(gridSystem, group, patch);
        if (axes.some((item) => item.id === axis.id)) fail(`grid axis already exists: ${axis.id}`);
        validateGridAxis(axis, `grid system axes.${group}[${axes.length}]`);
        return {
          ...gridSystem,
          axes: {
            ...gridSystem.axes,
            [group]: [...axes, axis]
          }
        };
      });
    },

    removeGridAxis(gridSystemId, axisGroup, axisId) {
      const group = validateGridAxisGroup(axisGroup);
      validateRequiredString(axisId, "grid axis id");
      if (gridAxisIsReferenced(currentProject, gridSystemId, group, axisId)) fail(`grid axis is referenced by a work point: ${axisId}`);
      return replaceGridSystem(gridSystemId, (gridSystem) => {
        const axes = arrayValues(gridSystem.axes?.[group]);
        if (!axes.some((axis) => axis.id === axisId)) fail(`grid axis not found: ${axisId}`);
        if (axes.length <= 1) fail(`grid system axes.${group} must keep at least one axis`);
        return {
          ...gridSystem,
          axes: {
            ...gridSystem.axes,
            [group]: axes.filter((axis) => axis.id !== axisId)
          }
        };
      });
    },

    updateLevel(levelId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("level patch must be an object");
      if ("id" in patch && patch.id !== levelId) fail("level id cannot be changed");
      if ("type" in patch) fail("level type cannot be changed");
      return replaceLevel(levelId, (level) => mergePatch(level, patch));
    },

    updateWorkPoint(workPointId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("work point patch must be an object");
      if ("id" in patch && patch.id !== workPointId) fail("work point id cannot be changed");
      if ("type" in patch) fail("work point type cannot be changed");
      return replaceWorkPoint(workPointId, (workPoint) => mergePatch(workPoint, patch));
    },

    updateHolePattern(holePatternId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("hole pattern patch must be an object");
      if ("id" in patch && patch.id !== holePatternId) fail("hole pattern id cannot be changed");
      if ("type" in patch) fail("hole pattern type cannot be changed");
      return replaceHolePattern(holePatternId, (holePattern) => mergePatch(holePattern, patch));
    },

    updateGroup(groupId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("group patch must be an object");
      if ("id" in patch && patch.id !== groupId) fail("group id cannot be changed");
      if ("type" in patch) fail("group type cannot be changed");
      return replaceGroup(groupId, (group) => mergePatch(group, patch));
    },

    updateAssembly(assemblyId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("assembly patch must be an object");
      if ("id" in patch && patch.id !== assemblyId) fail("assembly id cannot be changed");
      if ("type" in patch) fail("assembly type cannot be changed");
      return replaceAssembly(assemblyId, (assembly) => mergePatch(assembly, patch));
    },

    updateObjectPattern(objectPatternId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("object pattern patch must be an object");
      if ("id" in patch && patch.id !== objectPatternId) fail("object pattern id cannot be changed");
      if ("type" in patch) fail("object pattern type cannot be changed");
      return replaceObjectPattern(objectPatternId, (objectPattern) => mergePatch(objectPattern, patch));
    },

    updateInterface(interfaceId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("interface patch must be an object");
      if ("id" in patch && patch.id !== interfaceId) fail("interface id cannot be changed");
      if ("type" in patch) fail("interface type cannot be changed");
      if ("ownerId" in patch) fail("interface owner cannot be changed");
      return replaceInterface(interfaceId, (iface) => mergePatch(iface, patch));
    },

    updateConnectionZone(connectionZoneId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("connection zone patch must be an object");
      if ("id" in patch && patch.id !== connectionZoneId) fail("connection zone id cannot be changed");
      if ("type" in patch) fail("connection zone type cannot be changed");
      if ("mainObjectId" in patch) fail("connection zone main object cannot be changed");
      return replaceConnectionZone(connectionZoneId, (zone) => mergePatch(zone, patch));
    },

    setFeatureOperationEnabled(featureId, enabled) {
      if (typeof enabled !== "boolean") fail("feature enabled state must be boolean");
      return replaceFeature(featureId, (feature) => ({ ...feature, operationEnabled: enabled }));
    },

    setReferencePlane(referencePlaneId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("reference plane patch must be an object");
      if ("id" in patch && patch.id !== referencePlaneId) fail("reference plane id cannot be changed");
      if ("type" in patch) fail("reference plane type cannot be changed");
      return replaceReferencePlane(referencePlaneId, (plane) => mergePatch(plane, patch));
    },

    setFeatureBody(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature body patch must be an object");
      return replaceFeature(featureId, (feature) => {
        if (feature.type !== "boolean-part") fail(`${featureId}: feature body is only supported for boolean-part features`);
        if (!feature.body || typeof feature.body !== "object" || Array.isArray(feature.body)) fail(`${featureId}: feature body must be an object`);
        const body = mergePatch(feature.body, patch);
        if (patch.sketch !== undefined && body.type === "polygonal-prism") delete body.outline;
        return { ...feature, body };
      });
    },

    setFeatureSource(featureId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("feature source patch must be an object");
      return replaceFeature(featureId, (feature) => {
        if (!feature.source || typeof feature.source !== "object" || Array.isArray(feature.source)) fail(`${featureId}: feature source must be an object`);
        return { ...feature, source: mergePatch(feature.source, patch) };
      });
    },

    updatePlate(plateId, patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) fail("plate patch must be an object");
      if ("id" in patch && patch.id !== plateId) fail("plate id cannot be changed");
      if ("type" in patch) fail("plate type cannot be changed directly");
      return replacePlate(plateId, (plate) => mergePatch(plate, patch));
    },

    ...createPlateSketchStoreMethods({ replacePlate, replaceSketch }),

    createCustomProfile(profile) {
      profile = requiredObject(profile, "profile");
      const id = profile.id === undefined ? nextObjectId(currentProject, "custom_profile") : cleanId(profile.id);
      if (!id) fail("profile id must be a non-empty string");
      if (profile.id !== undefined && id !== profile.id) fail("profile id must contain only id-safe characters");
      if (profilesFor(currentProject)[id]) fail(`profile already exists: ${id}`);
      const next = clone(currentProject);
      const profiles = requiredObject(requiredObject(next.model, "model").profiles, "model.profiles");
      const stored = profile.section
        ? { ...clone(profile), id }
        : profileFromSectionSketch({ ...profile, id });
      profiles[id] = stored;
      return commitProject("profile.createCustom", next);
    },

    setMemberProfile(memberId, profileId) {
      requiredProfileById(profilesFor(currentProject), profileId, fail);
      return replaceMember(memberId, (member) => ({ ...member, profile: profileId }));
    },

    setMemberRotation(memberId, rotation) {
      if (!finiteNumber(rotation)) fail("member rotation must be a finite number");
      return replaceMember(memberId, (member) => ({ ...member, rotation }));
    },

    rotateMember(memberId, deltaDegrees) {
      if (!finiteNumber(deltaDegrees)) fail("rotation delta must be a finite number");
      const currentRotation = objectById(currentProject, memberId).rotation;
      if (!finiteNumber(currentRotation)) fail(`${memberId}: member rotation must be a finite number`);
      const rotation = currentRotation + deltaDegrees;
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

    moveMemberWithLayout(memberId, delta, options = {}) {
      return replaceMember(memberId, (member) => moveMemberWithLayoutData(member, delta), options);
    },

    setMemberPhysicalEndpoint(memberId, endpoint, point, options = {}) {
      return replaceMember(memberId, (member) => setMemberPhysicalEndpointData(member, endpoint, point), options);
    },

    setMemberLayoutEndpoint(memberId, endpoint, point, options = {}) {
      return replaceMember(memberId, (member) => setMemberLayoutEndpointData(member, endpoint, point), options);
    },

    regenerateMemberSmartComponents(memberId) {
      memberById(currentProject, memberId);
      const regeneratedIds = generatedSmartComponentIdsForMember(currentProject, memberId);
      return commitProject("member.smartComponents.regenerate", regenerateMemberSmartComponents(currentProject, memberId), {
        changedObjectIds: [memberId, ...regeneratedIds],
        regeneratedObjectIds: regeneratedIds
      });
    },

    draftMemberProject(memberId, member, options = {}) {
      memberById(currentProject, memberId);
      const next = cloneProjectForModelCollection(currentProject, "members");
      next.model.members[memberId] = clone(member);
      if (options.regenerateSmartComponents === false) return next;
      return regenerateMemberSmartComponents(next, memberId);
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
