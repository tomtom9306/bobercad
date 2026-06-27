const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(ROOT, "bobercad/data/projects");
const INDEXED_MODEL_COLLECTIONS = new Set([
  "assemblies",
  "connectionZones",
  "fastenerGroups",
  "features",
  "gridSystems",
  "groups",
  "holePatterns",
  "interfaces",
  "levels",
  "members",
  "objectPatterns",
  "plates",
  "referencePlanes",
  "relations",
  "sketches",
  "smartComponentInstances",
  "trimJoints",
  "welds",
  "workPoints"
]);

function repoPath(filePath) {
  return path.relative(ROOT, filePath).replaceAll("\\", "/");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(errors, message) {
  errors.push(message);
}

function objectIndex(project) {
  return isRecord(project.objectIndex) ? project.objectIndex : {};
}

function model(project) {
  return isRecord(project.model) ? project.model : {};
}

function collection(project, collectionName) {
  const value = model(project)[collectionName];
  return isRecord(value) ? value : {};
}

function indexedObject(project, objectId) {
  const entry = objectIndex(project)[objectId];
  if (!entry?.collection) return null;
  return collection(project, entry.collection)[objectId] || null;
}

function requireIndexedObject(errors, relative, project, objectId, context, expectedCollections = null) {
  if (typeof objectId !== "string" || !objectId) {
    fail(errors, `${relative}: ${context} must be a non-empty object id`);
    return null;
  }
  const entry = objectIndex(project)[objectId];
  if (!entry?.collection) {
    fail(errors, `${relative}: ${context} points to unindexed object ${objectId}`);
    return null;
  }
  if (expectedCollections && !expectedCollections.includes(entry.collection)) {
    fail(errors, `${relative}: ${context} points to ${entry.collection}.${objectId}; expected ${expectedCollections.join(" or ")}`);
    return null;
  }
  const object = collection(project, entry.collection)[objectId];
  if (!object) {
    fail(errors, `${relative}: ${context} points to missing model.${entry.collection}.${objectId}`);
    return null;
  }
  return object;
}

function requireCollectionObject(errors, relative, project, collectionName, objectId, context) {
  if (typeof objectId !== "string" || !objectId) {
    fail(errors, `${relative}: ${context} must be a non-empty ${collectionName} id`);
    return null;
  }
  const object = collection(project, collectionName)[objectId];
  if (!object) {
    fail(errors, `${relative}: ${context} points to missing model.${collectionName}.${objectId}`);
    return null;
  }
  const entry = objectIndex(project)[objectId];
  if (!entry) {
    fail(errors, `${relative}: ${context} points to unindexed model.${collectionName}.${objectId}`);
  } else if (entry.collection !== collectionName) {
    fail(errors, `${relative}: ${context} is indexed as ${entry.collection}.${objectId}, expected ${collectionName}`);
  }
  return object;
}

function requireUniqueIds(errors, relative, ids, context) {
  if (!Array.isArray(ids)) return;
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== "string" || !id) {
      fail(errors, `${relative}: ${context} contains a non-empty id violation`);
      continue;
    }
    if (seen.has(id)) fail(errors, `${relative}: ${context} contains duplicate id ${id}`);
    seen.add(id);
  }
}

function objectTrimRegionKeyParts(regionKeyValue) {
  if (typeof regionKeyValue !== "string" || !regionKeyValue.trim()) return null;
  const parts = regionKeyValue.split(":");
  if (parts.length !== 3 || parts[0] !== "object-trim") return null;
  const partMatch = /^part_(\d+)$/.exec(parts[2]);
  if (!partMatch) return null;
  try {
    const featureId = decodeURIComponent(parts[1]);
    return featureId ? { featureId, partIndex: Number(partMatch[1]) } : null;
  } catch {
    return null;
  }
}

function valuesAsIds(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(valuesAsIds);
}

function validateObjectIndex(errors, relative, project) {
  const projectModel = model(project);
  for (const [objectId, entry] of Object.entries(objectIndex(project))) {
    if (!entry?.collection) {
      fail(errors, `${relative}: objectIndex.${objectId} must store a collection`);
      continue;
    }
    if (!INDEXED_MODEL_COLLECTIONS.has(entry.collection)) {
      fail(errors, `${relative}: objectIndex.${objectId} points to unsupported indexed collection ${entry.collection}`);
      continue;
    }
    if (entry.collection === "patterns") {
      fail(errors, `${relative}: objectIndex.${objectId} still points to old patterns collection`);
      continue;
    }
    if (!isRecord(projectModel[entry.collection])) {
      fail(errors, `${relative}: objectIndex.${objectId} points to missing collection ${entry.collection}`);
      continue;
    }
    const object = projectModel[entry.collection][objectId];
    if (!object) {
      fail(errors, `${relative}: objectIndex.${objectId} does not match model.${entry.collection}`);
      continue;
    }
    if (object.id !== undefined && object.id !== objectId) {
      fail(errors, `${relative}: model.${entry.collection}.${objectId}.id must match objectIndex key`);
    }
  }

  for (const [collectionName, objects] of Object.entries(projectModel)) {
    if (!INDEXED_MODEL_COLLECTIONS.has(collectionName)) continue;
    if (!isRecord(objects)) continue;
    for (const objectId of Object.keys(objects)) {
      const entry = objectIndex(project)[objectId];
      if (!entry) {
        fail(errors, `${relative}: model.${collectionName}.${objectId} is missing from objectIndex`);
      } else if (entry.collection !== collectionName) {
        fail(errors, `${relative}: model.${collectionName}.${objectId} is indexed as ${entry.collection}`);
      }
    }
  }
}

function validateCommonReferences(errors, relative, project) {
  for (const [assemblyId, assembly] of Object.entries(collection(project, "assemblies"))) {
    for (const [key, collectionName] of [
      ["childAssemblyIds", "assemblies"],
      ["connectionZoneIds", "connectionZones"],
      ["fastenerGroupIds", "fastenerGroups"],
      ["featureIds", "features"],
      ["holePatternIds", "holePatterns"],
      ["memberIds", "members"],
      ["plateIds", "plates"],
      ["smartComponentInstanceIds", "smartComponentInstances"],
      ["weldIds", "welds"]
    ]) {
      requireUniqueIds(errors, relative, assembly[key], `assemblies.${assemblyId}.${key}`);
      for (const id of assembly[key] || []) {
        requireCollectionObject(errors, relative, project, collectionName, id, `assemblies.${assemblyId}.${key}`);
      }
    }
    for (const key of ["mainPartId", "parentAssemblyId"]) {
      if (assembly[key]) requireIndexedObject(errors, relative, project, assembly[key], `assemblies.${assemblyId}.${key}`);
    }
    for (const id of assembly.partIds || []) {
      requireIndexedObject(errors, relative, project, id, `assemblies.${assemblyId}.partIds`);
    }
  }

  for (const [zoneId, zone] of Object.entries(collection(project, "connectionZones"))) {
    if (zone.mainObjectId) requireIndexedObject(errors, relative, project, zone.mainObjectId, `connectionZones.${zoneId}.mainObjectId`);
    for (const key of ["objectIds", "secondaryObjectIds"]) {
      requireUniqueIds(errors, relative, zone[key], `connectionZones.${zoneId}.${key}`);
      for (const id of zone[key] || []) requireIndexedObject(errors, relative, project, id, `connectionZones.${zoneId}.${key}`);
    }
    requireUniqueIds(errors, relative, zone.interfaceIds, `connectionZones.${zoneId}.interfaceIds`);
    for (const id of zone.interfaceIds || []) {
      requireCollectionObject(errors, relative, project, "interfaces", id, `connectionZones.${zoneId}.interfaceIds`);
    }
    requireUniqueIds(errors, relative, zone.smartComponentInstanceIds, `connectionZones.${zoneId}.smartComponentInstanceIds`);
    for (const id of zone.smartComponentInstanceIds || []) {
      requireCollectionObject(errors, relative, project, "smartComponentInstances", id, `connectionZones.${zoneId}.smartComponentInstanceIds`);
    }
  }

  for (const [interfaceId, iface] of Object.entries(collection(project, "interfaces"))) {
    if (iface.ownerId) requireIndexedObject(errors, relative, project, iface.ownerId, `interfaces.${interfaceId}.ownerId`);
  }

  for (const [memberId, member] of Object.entries(collection(project, "members"))) {
    if (member.assemblyId) requireCollectionObject(errors, relative, project, "assemblies", member.assemblyId, `members.${memberId}.assemblyId`);
    if (member.referencePlaneId) requireCollectionObject(errors, relative, project, "referencePlanes", member.referencePlaneId, `members.${memberId}.referencePlaneId`);
    for (const key of ["startPointRef", "endPointRef"]) {
      if (member[key]) requireCollectionObject(errors, relative, project, "workPoints", member[key], `members.${memberId}.${key}`);
    }
    requireUniqueIds(errors, relative, member.featureIds, `members.${memberId}.featureIds`);
    for (const id of member.featureIds || []) requireCollectionObject(errors, relative, project, "features", id, `members.${memberId}.featureIds`);
  }

  for (const [plateId, plate] of Object.entries(collection(project, "plates"))) {
    if (plate.assemblyId) requireCollectionObject(errors, relative, project, "assemblies", plate.assemblyId, `plates.${plateId}.assemblyId`);
    if (plate.referencePlaneId) requireCollectionObject(errors, relative, project, "referencePlanes", plate.referencePlaneId, `plates.${plateId}.referencePlaneId`);
    requireUniqueIds(errors, relative, plate.featureIds, `plates.${plateId}.featureIds`);
    for (const id of plate.featureIds || []) requireCollectionObject(errors, relative, project, "features", id, `plates.${plateId}.featureIds`);
    validatePlateSketch(errors, relative, plateId, plate.sketch);
  }

  for (const [featureId, feature] of Object.entries(collection(project, "features"))) {
    if (feature.ownerId) requireIndexedObject(errors, relative, project, feature.ownerId, `features.${featureId}.ownerId`);
    if (feature.holePatternRef) {
      requireCollectionObject(errors, relative, project, "holePatterns", feature.holePatternRef, `features.${featureId}.holePatternRef`);
    }
  }

  for (const [gridId, grid] of Object.entries(collection(project, "gridSystems"))) {
    requireUniqueIds(errors, relative, grid.levelIds, `gridSystems.${gridId}.levelIds`);
    for (const id of grid.levelIds || []) requireCollectionObject(errors, relative, project, "levels", id, `gridSystems.${gridId}.levelIds`);
  }

  for (const [groupId, group] of Object.entries(collection(project, "groups"))) {
    requireUniqueIds(errors, relative, group.memberIds, `groups.${groupId}.memberIds`);
    for (const id of group.memberIds || []) requireCollectionObject(errors, relative, project, "members", id, `groups.${groupId}.memberIds`);
    requireUniqueIds(errors, relative, group.objectIds, `groups.${groupId}.objectIds`);
    for (const id of group.objectIds || []) requireIndexedObject(errors, relative, project, id, `groups.${groupId}.objectIds`);
  }

  for (const [patternId, pattern] of Object.entries(collection(project, "objectPatterns"))) {
    for (const key of ["sourceObjectIds", "generatedObjectIds", "detachedObjectIds"]) {
      requireUniqueIds(errors, relative, pattern[key], `objectPatterns.${patternId}.${key}`);
      for (const id of pattern[key] || []) requireIndexedObject(errors, relative, project, id, `objectPatterns.${patternId}.${key}`);
    }
  }

  for (const [workPointId, workPoint] of Object.entries(collection(project, "workPoints"))) {
    if (workPoint.referencePlaneId) {
      requireCollectionObject(errors, relative, project, "referencePlanes", workPoint.referencePlaneId, `workPoints.${workPointId}.referencePlaneId`);
    }
  }
}

function validatePlateSketch(errors, relative, plateId, sketch) {
  if (!sketch) return;
  if (!Array.isArray(sketch.vertices)) {
    fail(errors, `${relative}: plates.${plateId}.sketch.vertices must be an array`);
    return;
  }
  if (!Array.isArray(sketch.edges)) {
    fail(errors, `${relative}: plates.${plateId}.sketch.edges must be an array`);
    return;
  }
  const vertexIds = new Set();
  for (const vertex of sketch.vertices) {
    if (!vertex?.id) {
      fail(errors, `${relative}: plates.${plateId}.sketch.vertices contains a vertex without id`);
      continue;
    }
    if (vertexIds.has(vertex.id)) fail(errors, `${relative}: plates.${plateId}.sketch.vertices duplicate id ${vertex.id}`);
    vertexIds.add(vertex.id);
    if (!Array.isArray(vertex.point) || vertex.point.length !== 2 || vertex.point.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      fail(errors, `${relative}: plates.${plateId}.sketch.vertices.${vertex.id}.point must be [y,z] finite numbers`);
    }
  }
  const edgeIds = new Set();
  for (const edge of sketch.edges) {
    if (!edge?.id) {
      fail(errors, `${relative}: plates.${plateId}.sketch.edges contains an edge without id`);
      continue;
    }
    if (edgeIds.has(edge.id)) fail(errors, `${relative}: plates.${plateId}.sketch.edges duplicate id ${edge.id}`);
    edgeIds.add(edge.id);
    for (const key of ["from", "to"]) {
      if (!vertexIds.has(edge[key])) fail(errors, `${relative}: plates.${plateId}.sketch.edges.${edge.id}.${key} points to missing vertex ${edge[key]}`);
    }
  }
  for (const relation of sketch.relations || []) {
    if (!relation?.id) fail(errors, `${relative}: plates.${plateId}.sketch.relations contains a relation without id`);
    if (relation.edgeId && !edgeIds.has(relation.edgeId)) {
      fail(errors, `${relative}: plates.${plateId}.sketch.relations.${relation.id}.edgeId points to missing edge ${relation.edgeId}`);
    }
    for (const edgeId of relation.edgeIds || []) {
      if (!edgeIds.has(edgeId)) fail(errors, `${relative}: plates.${plateId}.sketch.relations.${relation.id}.edgeIds points to missing edge ${edgeId}`);
    }
    if (relation.vertexId && !vertexIds.has(relation.vertexId)) {
      fail(errors, `${relative}: plates.${plateId}.sketch.relations.${relation.id}.vertexId points to missing vertex ${relation.vertexId}`);
    }
    for (const vertexId of relation.vertexIds || []) {
      if (!vertexIds.has(vertexId)) fail(errors, `${relative}: plates.${plateId}.sketch.relations.${relation.id}.vertexIds points to missing vertex ${vertexId}`);
    }
  }
}

function validateFastenerGroups(errors, relative, project) {
  for (const [fastenerGroupId, fastenerGroup] of Object.entries(collection(project, "fastenerGroups"))) {
    if (fastenerGroup.holePatternRef) {
      requireCollectionObject(errors, relative, project, "holePatterns", fastenerGroup.holePatternRef, `fastenerGroups.${fastenerGroupId}.holePatternRef`);
    }
    const fromFeatureId = fastenerGroup.through?.fromFeatureId;
    if (!fromFeatureId) {
      fail(errors, `${relative}: fastenerGroups.${fastenerGroupId} must store through.fromFeatureId as its render basis`);
      continue;
    }
    const fromFeature = requireCollectionObject(errors, relative, project, "features", fromFeatureId, `fastenerGroups.${fastenerGroupId}.through.fromFeatureId`);
    if (!fromFeature) continue;
    if (!fromFeature.reference?.kind) {
      fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} must have feature.reference.kind`);
    }
    if (fastenerGroup.holePatternRef && fromFeature.holePatternRef && fromFeature.holePatternRef !== fastenerGroup.holePatternRef) {
      fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} must use holePatternRef ${fastenerGroup.holePatternRef}`);
    }
    if (fromFeature.ownerId && !indexedObject(project, fromFeature.ownerId)) {
      fail(errors, `${relative}: fastenerGroups.${fastenerGroupId}.through.fromFeatureId ${fromFeatureId} ownerId points to missing ${fromFeature.ownerId}`);
    }
    if (fastenerGroup.through?.toFeatureId) {
      requireCollectionObject(errors, relative, project, "features", fastenerGroup.through.toFeatureId, `fastenerGroups.${fastenerGroupId}.through.toFeatureId`);
    }
  }
}

function validateSmartComponents(errors, relative, project) {
  for (const [smartComponentId, smartComponent] of Object.entries(collection(project, "smartComponentInstances"))) {
    for (const legacyKey of ["sourcePreset", "manualParts", "generator"]) {
      if (smartComponent[legacyKey] !== undefined) {
        fail(errors, `${relative}: smartComponentInstances.${smartComponentId} still uses legacy ${legacyKey}`);
      }
    }
    if (smartComponent.inputs?.connectionZoneId) {
      const zone = requireCollectionObject(errors, relative, project, "connectionZones", smartComponent.inputs.connectionZoneId, `smartComponentInstances.${smartComponentId}.inputs.connectionZoneId`);
      if (zone && !(zone.smartComponentInstanceIds || []).includes(smartComponentId)) {
        fail(errors, `${relative}: connectionZones.${zone.id || smartComponent.inputs.connectionZoneId}.smartComponentInstanceIds must include ${smartComponentId}`);
      }
    }
    if (smartComponent.inputs?.assemblyId) {
      const assembly = requireCollectionObject(errors, relative, project, "assemblies", smartComponent.inputs.assemblyId, `smartComponentInstances.${smartComponentId}.inputs.assemblyId`);
      if (assembly && !(assembly.smartComponentInstanceIds || []).includes(smartComponentId)) {
        fail(errors, `${relative}: assemblies.${assembly.id || smartComponent.inputs.assemblyId}.smartComponentInstanceIds must include ${smartComponentId}`);
      }
    }
    if (smartComponent.parentInstanceId) {
      requireCollectionObject(errors, relative, project, "smartComponentInstances", smartComponent.parentInstanceId, `smartComponentInstances.${smartComponentId}.parentInstanceId`);
    }
    for (const [role, objectId] of Object.entries(smartComponent.objectRoles || {})) {
      requireIndexedObject(errors, relative, project, objectId, `smartComponentInstances.${smartComponentId}.objectRoles.${role}`);
    }
    for (const [role, childId] of Object.entries(smartComponent.childComponentRoles || {})) {
      requireCollectionObject(errors, relative, project, "smartComponentInstances", childId, `smartComponentInstances.${smartComponentId}.childComponentRoles.${role}`);
    }
    for (const key of ["ownedObjectIds", "detachedObjectIds"]) {
      requireUniqueIds(errors, relative, smartComponent[key], `smartComponentInstances.${smartComponentId}.${key}`);
      for (const id of smartComponent[key] || []) {
        requireIndexedObject(errors, relative, project, id, `smartComponentInstances.${smartComponentId}.${key}`);
      }
    }
  }
}

function validateTrimJoints(errors, relative, project) {
  for (const [trimJointId, trimJoint] of Object.entries(collection(project, "trimJoints"))) {
    const participants = Array.isArray(trimJoint.participants) ? trimJoint.participants : [];
    const participantIds = new Set(participants.map((participant) => participant?.memberId).filter(Boolean));
    for (const [index, participant] of participants.entries()) {
      if (participant.memberId) {
        requireCollectionObject(errors, relative, project, "members", participant.memberId, `trimJoints.${trimJointId}.participants.${index}.memberId`);
      }
    }
    const operationIds = new Set();
    for (const [index, operation] of (trimJoint.operations || []).entries()) {
      if (!operation?.id) {
        fail(errors, `${relative}: trimJoints.${trimJointId}.operations.${index} must have id`);
      } else if (operationIds.has(operation.id)) {
        fail(errors, `${relative}: trimJoints.${trimJointId}.operations duplicate id ${operation.id}`);
      } else {
        operationIds.add(operation.id);
      }
      for (const key of ["memberAId", "memberBId", "memberId"]) {
        if (operation?.[key]) requireCollectionObject(errors, relative, project, "members", operation[key], `trimJoints.${trimJointId}.operations.${operation.id || index}.${key}`);
      }
      for (const key of ["memberAIds", "memberBIds"]) {
        requireUniqueIds(errors, relative, operation?.[key], `trimJoints.${trimJointId}.operations.${operation?.id || index}.${key}`);
        for (const id of operation?.[key] || []) {
          requireCollectionObject(errors, relative, project, "members", id, `trimJoints.${trimJointId}.operations.${operation.id || index}.${key}`);
          if (!participantIds.has(id)) fail(errors, `${relative}: trimJoints.${trimJointId}.operations.${operation.id || index}.${key} member ${id} is not a trim participant`);
        }
      }
      if (operation?.type === "profile-cope") {
        const memberAIds = Array.isArray(operation.memberAIds) ? operation.memberAIds : operation.memberAId ? [operation.memberAId] : [];
        const memberBIds = Array.isArray(operation.memberBIds) ? operation.memberBIds : operation.memberBId ? [operation.memberBId] : [];
        for (const id of memberAIds) if (memberBIds.includes(id)) fail(errors, `${relative}: trimJoints.${trimJointId}.operations.${operation.id || index} object trim cannot use ${id} as both object to trim and cutting object`);
        for (const regionKey of operation.removedRegionKeys || []) {
          if (!objectTrimRegionKeyParts(regionKey)) fail(errors, `${relative}: trimJoints.${trimJointId}.operations.${operation.id || index}.removedRegionKeys has invalid object trim key ${regionKey}`);
        }
      }
      requireUniqueIds(errors, relative, operation?.referencePlaneIds, `trimJoints.${trimJointId}.operations.${operation?.id || index}.referencePlaneIds`);
      for (const id of operation?.referencePlaneIds || []) {
        requireCollectionObject(errors, relative, project, "referencePlanes", id, `trimJoints.${trimJointId}.operations.${operation.id || index}.referencePlaneIds`);
      }
    }
  }
}

function validateProject(relative, project) {
  const errors = [];
  if (!isRecord(project)) {
    fail(errors, `${relative}: project must be an object`);
    return errors;
  }
  if (!isRecord(project.model)) fail(errors, `${relative}: project.model must be an object`);
  if (!isRecord(project.objectIndex)) fail(errors, `${relative}: project.objectIndex must be an object`);
  if (project.model?.patterns) fail(errors, `${relative}: use model.holePatterns, not model.patterns`);
  if (project.model?.connections) fail(errors, `${relative}: use model.smartComponentInstances, not model.connections`);

  validateObjectIndex(errors, relative, project);
  validateCommonReferences(errors, relative, project);
  validateFastenerGroups(errors, relative, project);
  validateSmartComponents(errors, relative, project);
  validateTrimJoints(errors, relative, project);

  return errors;
}

function validateAllProjects() {
  const errors = [];
  if (!fs.existsSync(PROJECTS_DIR)) {
    return { checked: 0, errors: [`missing projects directory: ${repoPath(PROJECTS_DIR)}`] };
  }
  let checked = 0;
  for (const name of fs.readdirSync(PROJECTS_DIR).filter((item) => item.endsWith(".json")).sort()) {
    const filePath = path.join(PROJECTS_DIR, name);
    const relative = repoPath(filePath);
    let project;
    try {
      project = readJson(filePath);
    } catch (error) {
      fail(errors, `${relative}: invalid JSON: ${error.message}`);
      continue;
    }
    checked += 1;
    errors.push(...validateProject(relative, project));
  }
  return { checked, errors };
}

if (require.main === module) {
  const { checked, errors } = validateAllProjects();
  if (errors.length) {
    console.error(`Domain model validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`OK: domain model validation passed for ${checked} project files`);
}

module.exports = {
  validateAllProjects,
  validateProject
};
