const fs = require("fs");
const path = require("path");
const { validateFile, formatError } = require("./validate_json_schema");

const ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(ROOT, "bobercad/data/projects");
const REFERENCE_GEOMETRY_DIR = path.join(ROOT, "bobercad/data/references");
const REFERENCE_GEOMETRY_SCHEMA_VERSION = "0.1.0";
const POINT_CLOUD_CHUNK_SCHEMA_VERSION = "0.1.0";
const REFERENCE_METADATA_MAX_JSON_LENGTH = 8192;
const REFERENCE_METADATA_MAX_DEPTH = 3;
const REFERENCE_METADATA_MAX_ENTRY_COUNT = 32;
const REFERENCE_METADATA_MAX_ARRAY_LENGTH = 128;
const REFERENCE_METADATA_MAX_STRING_LENGTH = 512;
const REFERENCE_METADATA_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const REFERENCE_METADATA_ALLOWED_SLASH_STRINGS = new Set([
  "tools/reference-geometry/translate_reference_geometry.mjs"
]);
const REFERENCE_METADATA_FORBIDDEN_NORMALIZED_KEYS = new Set([
  "absolutepath",
  "adapterlogpath",
  "adapterstderrpath",
  "adapterstdoutpath",
  "chunkpath",
  "filecontents",
  "filepath",
  "inputpath",
  "localpath",
  "outputpath",
  "payload",
  "raw",
  "rawcontents",
  "rawpayload",
  "requestpath",
  "resolvedpath",
  "scratchpath",
  "sourcedirectory",
  "sourcepath",
  "stagepath"
]);
const RESERVED_REFERENCE_IDS = new Set(["__proto__", "prototype", "constructor"]);
const REFERENCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
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
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function isSubpath(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function samePoint(a, b) {
  return finiteVec3(a) && finiteVec3(b) && a.every((value, index) => Math.abs(value - b[index]) <= 1e-9);
}

function boundsFor(points) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const point of points) {
    if (!finiteVec3(point)) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
    }
  }
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite) ? bounds : null;
}

function sameBounds(a, b) {
  return samePoint(a?.min, b?.min) && samePoint(a?.max, b?.max);
}

function unionBounds(boundsList) {
  const validBounds = boundsList.filter((bounds) => finiteVec3(bounds?.min) && finiteVec3(bounds?.max));
  if (!validBounds.length) return null;
  const min = [...validBounds[0].min];
  const max = [...validBounds[0].max];
  for (const bounds of validBounds.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], bounds.min[axis]);
      max[axis] = Math.max(max[axis], bounds.max[axis]);
    }
  }
  return { min, max };
}

function completeUnionBounds(boundsList) {
  const values = boundsList || [];
  if (!values.length) return null;
  if (values.some((bounds) => !finiteVec3(bounds?.min) || !finiteVec3(bounds?.max))) return null;
  return unionBounds(values);
}

function payloadBoundsForReferenceObject(referenceObject, chunks = {}) {
  if (referenceObject?.kind === "line-set" || referenceObject?.kind === "mesh") {
    return Array.isArray(referenceObject.vertices) && referenceObject.vertices.length ? boundsFor(referenceObject.vertices) : null;
  }
  if (referenceObject?.kind === "point-cloud") {
    if (Array.isArray(referenceObject.points) && referenceObject.points.length) return boundsFor(referenceObject.points);
    if (Array.isArray(referenceObject.chunkIds) && referenceObject.chunkIds.length) {
      return completeUnionBounds(referenceObject.chunkIds.map((chunkId) => chunks[chunkId]?.bounds));
    }
  }
  return null;
}

function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function fail(errors, message) {
  errors.push(message);
}

function objectIndex(project) {
  return isRecord(project.objectIndex) ? project.objectIndex : {};
}

function isReferenceGeometryId(value) {
  return typeof value === "string" && REFERENCE_ID_PATTERN.test(value) && !RESERVED_REFERENCE_IDS.has(value);
}

function model(project) {
  return isRecord(project.model) ? project.model : {};
}

function collection(project, collectionName) {
  const value = model(project)[collectionName];
  return isRecord(value) ? value : {};
}

function modelReferenceAssetLocations(project, assetId) {
  const projectModel = model(project);
  const locations = [];
  if (Object.prototype.hasOwnProperty.call(projectModel, assetId)) {
    locations.push(`model.${assetId}`);
  }
  for (const collectionName of INDEXED_MODEL_COLLECTIONS) {
    const objects = projectModel[collectionName];
    if (isRecord(objects) && Object.prototype.hasOwnProperty.call(objects, assetId)) {
      locations.push(`model.${collectionName}.${assetId}`);
    }
  }
  if (isRecord(projectModel.addonData) && Object.prototype.hasOwnProperty.call(projectModel.addonData, assetId)) {
    locations.push(`model.addonData.${assetId}`);
  }
  return locations;
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
      requireUniqueIds(errors, relative, operation?.referencePlaneIds, `trimJoints.${trimJointId}.operations.${operation?.id || index}.referencePlaneIds`);
      for (const id of operation?.referencePlaneIds || []) {
        requireCollectionObject(errors, relative, project, "referencePlanes", id, `trimJoints.${trimJointId}.operations.${operation.id || index}.referencePlaneIds`);
      }
    }
  }
}

function validateSchemaBackedJson(errors, filePath) {
  let result;
  try {
    result = validateFile(filePath);
  } catch (error) {
    fail(errors, `${repoPath(filePath)}: ${error.message}`);
    return false;
  }
  for (const error of result.errors) fail(errors, formatError(result, error));
  return result.errors.length === 0;
}

function chunkById(referenceData) {
  const chunks = {};
  for (const chunk of referenceData.chunks || []) {
    if (!chunk?.id) continue;
    chunks[chunk.id] = chunk;
  }
  return chunks;
}

const POINT_ATTRIBUTE_KEYS = ["colors", "intensities", "classifications", "normals"];

function validatePointAttributeLengths(errors, relative, pointAttributes, pointCount, context) {
  if (pointAttributes === undefined) return;
  if (!isRecord(pointAttributes)) {
    fail(errors, `${relative}: ${context}.pointAttributes must be an object`);
    return;
  }
  for (const key of POINT_ATTRIBUTE_KEYS) {
    const values = pointAttributes[key];
    if (!Array.isArray(values)) continue;
    if (values.length !== pointCount) {
      fail(errors, `${relative}: ${context}.pointAttributes.${key} has ${values.length} item(s), expected ${pointCount}`);
    }
  }
}

function validateReferenceIndex(errors, relative, index, count, context) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    fail(errors, `${relative}: ${context} index ${index} is outside 0..${Math.max(0, count - 1)}`);
  }
}

function validateReferenceObjectGeometry(errors, relative, objectId, referenceObject) {
  if (referenceObject?.kind !== "line-set" && referenceObject?.kind !== "mesh") return;
  const vertices = Array.isArray(referenceObject.vertices) ? referenceObject.vertices : [];
  if (referenceObject.kind === "line-set") {
    const lineSegments = Array.isArray(referenceObject.lineSegments) ? referenceObject.lineSegments : [];
    if (!lineSegments.length) fail(errors, `${relative}: line-set ${objectId}.lineSegments must contain at least one segment`);
    for (const [segmentIndex, segment] of lineSegments.entries()) {
      validateReferenceIndex(errors, relative, segment?.[0], vertices.length, `line-set ${objectId}.lineSegments[${segmentIndex}][0]`);
      validateReferenceIndex(errors, relative, segment?.[1], vertices.length, `line-set ${objectId}.lineSegments[${segmentIndex}][1]`);
      if (segment?.[0] === segment?.[1]) {
        fail(errors, `${relative}: line-set ${objectId}.lineSegments[${segmentIndex}] must reference two distinct vertices`);
      }
    }
  } else if (referenceObject.kind === "mesh") {
    const faces = Array.isArray(referenceObject.faces) ? referenceObject.faces : [];
    if (!faces.length) fail(errors, `${relative}: mesh ${objectId}.faces must contain at least one face`);
    for (const [faceIndex, face] of faces.entries()) {
      for (const [indexIndex, vertexIndex] of (face || []).entries()) {
        validateReferenceIndex(errors, relative, vertexIndex, vertices.length, `mesh ${objectId}.faces[${faceIndex}][${indexIndex}]`);
      }
      if (new Set(face || []).size < 3) {
        fail(errors, `${relative}: mesh ${objectId}.faces[${faceIndex}] must reference at least three distinct vertices`);
      }
    }
  }
}

function validateReferenceCoordinateSystem(errors, relative, coordinateSystem) {
  if (!isRecord(coordinateSystem)) {
    fail(errors, `${relative}: asset.coordinateSystem must be an object`);
    return;
  }
  if (!finiteVec3(coordinateSystem.origin)) fail(errors, `${relative}: asset.coordinateSystem.origin must be a finite vec3`);
  for (const key of ["axisX", "axisY", "axisZ"]) {
    const axis = coordinateSystem[key];
    if (!finiteVec3(axis)) {
      fail(errors, `${relative}: asset.coordinateSystem.${key} must be a finite vec3`);
      continue;
    }
    if (vecLength(axis) <= 1e-9) fail(errors, `${relative}: asset.coordinateSystem.${key} must be non-zero`);
  }
  if (finiteVec3(coordinateSystem.axisX) && finiteVec3(coordinateSystem.axisY) && finiteVec3(coordinateSystem.axisZ)) {
    const determinant = vecDot(vecCross(coordinateSystem.axisX, coordinateSystem.axisY), coordinateSystem.axisZ);
    if (Math.abs(determinant) <= 1e-9) {
      fail(errors, `${relative}: asset.coordinateSystem axes must form a non-degenerate 3D basis`);
    }
  }
}

function validateReferenceProjectTransform(errors, relative, assetId, transform) {
  if (transform === undefined) return;
  if (!isRecord(transform)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform must be an object`);
    return;
  }
  if (transform.origin !== undefined && !finiteVec3(transform.origin)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform.origin must be a finite vec3`);
  }
  if (transform.scale !== undefined && (!finiteNumber(transform.scale) || transform.scale <= 0)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform.scale must be greater than zero`);
  }

  const axes = {
    axisX: transform.axisX === undefined ? [1, 0, 0] : transform.axisX,
    axisY: transform.axisY === undefined ? [0, 1, 0] : transform.axisY,
    axisZ: transform.axisZ === undefined ? [0, 0, 1] : transform.axisZ
  };
  let axesAreFinite = true;
  for (const [key, axis] of Object.entries(axes)) {
    if (!finiteVec3(axis)) {
      fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform.${key} must be a finite vec3`);
      axesAreFinite = false;
      continue;
    }
    if (vecLength(axis) <= 1e-9) {
      fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform.${key} must be non-zero`);
      axesAreFinite = false;
    }
  }
  if (axesAreFinite) {
    const determinant = vecDot(vecCross(axes.axisX, axes.axisY), axes.axisZ);
    if (Math.abs(determinant) <= 1e-9) {
      fail(errors, `${relative}: referenceGeometry.assets.${assetId}.transform axes must form a non-degenerate 3D basis`);
    }
  }
}

function validateReferenceBounds(errors, relative, label, bounds) {
  if (bounds === undefined) return;
  if (!isRecord(bounds)) {
    fail(errors, `${relative}: ${label} must be an object`);
    return;
  }
  if (!finiteVec3(bounds.min)) fail(errors, `${relative}: ${label}.min must be a finite vec3`);
  if (!finiteVec3(bounds.max)) fail(errors, `${relative}: ${label}.max must be a finite vec3`);
  if (finiteVec3(bounds.min) && finiteVec3(bounds.max)) {
    for (let axis = 0; axis < 3; axis += 1) {
      if (bounds.min[axis] > bounds.max[axis]) {
        fail(errors, `${relative}: ${label}.min[${axis}] must be <= ${label}.max[${axis}]`);
      }
    }
  }
}

function referenceMetadataFailure(errors, relative, label) {
  fail(errors, `${relative}: ${label}.metadata must be bounded path-free canonical metadata`);
}

function normalizedReferenceMetadataKey(key) {
  return String(key || "").replace(/[_.-]/g, "").toLowerCase();
}

function safeReferenceMetadataKey(key) {
  if (typeof key !== "string" || !REFERENCE_METADATA_KEY_PATTERN.test(key) || RESERVED_REFERENCE_IDS.has(key)) return false;
  const normalized = normalizedReferenceMetadataKey(key);
  if (REFERENCE_METADATA_FORBIDDEN_NORMALIZED_KEYS.has(normalized)) return false;
  return !normalized.endsWith("path") && !normalized.endsWith("directory");
}

function safeReferenceMetadataString(value) {
  if (typeof value !== "string") return false;
  if (!value || value.length > REFERENCE_METADATA_MAX_STRING_LENGTH) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (REFERENCE_METADATA_ALLOWED_SLASH_STRINGS.has(value)) return true;
  if (value.includes("\\") || value.includes("/")) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return true;
}

function validateReferenceMetadataValue(errors, relative, label, value, depth = 0) {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) referenceMetadataFailure(errors, relative, label);
    return;
  }
  if (typeof value === "string") {
    if (!safeReferenceMetadataString(value)) referenceMetadataFailure(errors, relative, label);
    return;
  }
  if (Array.isArray(value)) {
    if (depth >= REFERENCE_METADATA_MAX_DEPTH || value.length > REFERENCE_METADATA_MAX_ARRAY_LENGTH) {
      referenceMetadataFailure(errors, relative, label);
      return;
    }
    for (const item of value) validateReferenceMetadataValue(errors, relative, label, item, depth + 1);
    return;
  }
  if (isRecord(value)) {
    if (depth >= REFERENCE_METADATA_MAX_DEPTH) {
      referenceMetadataFailure(errors, relative, label);
      return;
    }
    const entries = Object.entries(value);
    if (entries.length > REFERENCE_METADATA_MAX_ENTRY_COUNT) {
      referenceMetadataFailure(errors, relative, label);
      return;
    }
    for (const [key, child] of entries) {
      if (!safeReferenceMetadataKey(key)) {
        referenceMetadataFailure(errors, relative, label);
        continue;
      }
      validateReferenceMetadataValue(errors, relative, label, child, depth + 1);
    }
    return;
  }
  referenceMetadataFailure(errors, relative, label);
}

function validateReferenceMetadataRecord(errors, relative, label, metadata) {
  if (metadata === undefined) return;
  if (!isRecord(metadata)) {
    referenceMetadataFailure(errors, relative, label);
    return;
  }
  const encoded = JSON.stringify(metadata);
  if (typeof encoded !== "string" || encoded.length > REFERENCE_METADATA_MAX_JSON_LENGTH) {
    referenceMetadataFailure(errors, relative, label);
    return;
  }
  validateReferenceMetadataValue(errors, relative, label, metadata);
}

function validateReferencePointCloudChunk(errors, relative, assetId, chunk, chunkPath) {
  if (!validateSchemaBackedJson(errors, chunkPath)) return null;
  let chunkData;
  try {
    chunkData = readJson(chunkPath);
  } catch (error) {
    fail(errors, `${repoPath(chunkPath)}: invalid JSON: ${error.message}`);
    return null;
  }
  if (chunkData.schema !== "bobercad-reference-point-cloud-chunk") {
    fail(errors, `${repoPath(chunkPath)}: referenceGeometry.assets.${assetId} chunk ${chunk.id} must use bobercad-reference-point-cloud-chunk schema`);
  }
  if (chunkData.schemaVersion !== POINT_CLOUD_CHUNK_SCHEMA_VERSION) {
    fail(errors, `${repoPath(chunkPath)}: chunk ${chunk.id} schemaVersion must be ${POINT_CLOUD_CHUNK_SCHEMA_VERSION}, got ${chunkData.schemaVersion || "<missing>"}`);
  }
  if (chunkData.id !== chunk.id) {
    fail(errors, `${repoPath(chunkPath)}: chunk id ${chunkData.id || "<missing>"} must match manifest chunk ${chunk.id}`);
  }
  if (chunkData.objectId !== chunk.objectId) {
    fail(errors, `${repoPath(chunkPath)}: chunk ${chunk.id} objectId must match manifest objectId ${chunk.objectId}`);
  }
  validateReferenceBounds(errors, repoPath(chunkPath), `chunk ${chunk.id}.bounds`, chunkData.bounds);
  if (chunk.bounds && chunkData.bounds && !sameBounds(chunk.bounds, chunkData.bounds)) {
    fail(errors, `${repoPath(chunkPath)}: manifest chunk ${chunk.id}.bounds must match sidecar bounds`);
  }
  if (Array.isArray(chunkData.points) && Number.isInteger(chunkData.pointCount) && chunkData.points.length !== chunkData.pointCount) {
    fail(errors, `${repoPath(chunkPath)}: chunk ${chunk.id} pointCount ${chunkData.pointCount} must match ${chunkData.points.length} point(s)`);
  }
  if (Array.isArray(chunkData.points) && chunkData.bounds) {
    const payloadBounds = boundsFor(chunkData.points);
    if (payloadBounds && !sameBounds(chunkData.bounds, payloadBounds)) {
      fail(errors, `${repoPath(chunkPath)}: chunk ${chunk.id}.bounds must match point payload bounds`);
    }
  }
  const pointCount = Array.isArray(chunkData.points) ? chunkData.points.length : chunkData.pointCount;
  if (Number.isInteger(pointCount) && pointCount <= 0) {
    fail(errors, `${repoPath(chunkPath)}: point-cloud chunk ${chunk.id} must contain at least one point`);
  }
  if (Number.isInteger(chunk.pointCount) && Number.isInteger(pointCount) && chunk.pointCount !== pointCount) {
    fail(errors, `${repoPath(chunkPath)}: chunk ${chunk.id} manifest pointCount ${chunk.pointCount} must match sidecar point count ${pointCount}`);
  }
  if (Number.isInteger(pointCount)) {
    validatePointAttributeLengths(errors, repoPath(chunkPath), chunkData.pointAttributes, pointCount, `chunk ${chunk.id}`);
  }
  validateReferenceMetadataRecord(errors, repoPath(chunkPath), `chunk ${chunk.id}`, chunkData.metadata);
  return chunkData;
}

function validateReferenceGeometryAsset(errors, relative, project, projectPath, assetId, asset, referencesDir = REFERENCE_GEOMETRY_DIR) {
  if (objectIndex(project)[assetId]) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId} must not be stored in objectIndex`);
  }
  for (const location of modelReferenceAssetLocations(project, assetId)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId} must not be stored in ${location}`);
  }
  validateReferenceProjectTransform(errors, relative, assetId, asset?.transform);
  if (typeof asset?.path !== "string" || !asset.path) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.path must be a non-empty string`);
    return;
  }

  const referencePath = path.resolve(path.dirname(projectPath), asset.path);
  if (!isSubpath(referencesDir, referencePath)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.path must resolve under ${repoPath(referencesDir)}`);
    return;
  }
  if (!fs.existsSync(referencePath)) {
    fail(errors, `${relative}: referenceGeometry.assets.${assetId}.path points to missing file ${asset.path}`);
    return;
  }
  if (!validateSchemaBackedJson(errors, referencePath)) return;

  let referenceData;
  try {
    referenceData = readJson(referencePath);
  } catch (error) {
    fail(errors, `${repoPath(referencePath)}: invalid JSON: ${error.message}`);
    return;
  }
  if (referenceData.schema !== "bobercad-reference-geometry") {
    fail(errors, `${repoPath(referencePath)}: referenceGeometry.assets.${assetId} must point to bobercad-reference-geometry JSON`);
    return;
  }
  if (referenceData.schemaVersion !== REFERENCE_GEOMETRY_SCHEMA_VERSION) {
    fail(errors, `${repoPath(referencePath)}: referenceGeometry.assets.${assetId} schemaVersion must be ${REFERENCE_GEOMETRY_SCHEMA_VERSION}, got ${referenceData.schemaVersion || "<missing>"}`);
  }
  if (referenceData.asset?.id !== assetId) {
    fail(errors, `${repoPath(referencePath)}: referenceGeometry.assets.${assetId} must point to a reference manifest whose asset.id is ${assetId}, got ${referenceData.asset?.id || "<missing>"}`);
  }
  validateReferenceCoordinateSystem(errors, repoPath(referencePath), referenceData.asset?.coordinateSystem);
  validateReferenceBounds(errors, repoPath(referencePath), "asset.bounds", referenceData.asset?.bounds);

  const seenChunkIds = new Set();
  for (const chunk of referenceData.chunks || []) {
    if (!chunk?.id) continue;
    if (seenChunkIds.has(chunk.id)) {
      fail(errors, `${repoPath(referencePath)}: duplicate chunk id ${chunk.id}`);
    }
    if (Number.isInteger(chunk.pointCount) && chunk.pointCount <= 0) {
      fail(errors, `${repoPath(referencePath)}: chunk ${chunk.id}.pointCount must be greater than zero`);
    }
    validateReferenceBounds(errors, repoPath(referencePath), `chunk ${chunk.id}.bounds`, chunk.bounds);
    seenChunkIds.add(chunk.id);
  }
  const chunks = chunkById(referenceData);
  const referencedChunkIds = new Set();
  const layers = referenceData.layers || {};
  for (const [layerId, layer] of Object.entries(layers)) {
    if (layer?.id !== layerId) {
      fail(errors, `${repoPath(referencePath)}: reference layer key ${layerId} must match id ${layer?.id || "<missing>"}`);
    }
  }
  for (const [objectId, referenceObject] of Object.entries(referenceData.objects || {})) {
    if (referenceObject?.id !== objectId) {
      fail(errors, `${repoPath(referencePath)}: reference object key ${objectId} must match id ${referenceObject?.id || "<missing>"}`);
    }
    if (objectIndex(project)[objectId]) {
      fail(errors, `${relative}: reference object ${objectId} from ${assetId} collides with project.objectIndex`);
    }
    if (referenceObject?.layer && !layers[referenceObject.layer]) {
      fail(errors, `${repoPath(referencePath)}: reference object ${objectId} points to missing layer ${referenceObject.layer}`);
    }
    validateReferenceBounds(errors, repoPath(referencePath), `object ${objectId}.bounds`, referenceObject?.bounds);
    validateReferenceMetadataRecord(errors, repoPath(referencePath), `object ${objectId}`, referenceObject?.metadata);
    validateReferenceObjectGeometry(errors, repoPath(referencePath), objectId, referenceObject);
    const objectPayloadBounds = referenceObject?.kind === "line-set" || referenceObject?.kind === "mesh"
      ? payloadBoundsForReferenceObject(referenceObject, chunks)
      : null;
    if (referenceObject?.bounds && objectPayloadBounds && !sameBounds(referenceObject.bounds, objectPayloadBounds)) {
      fail(errors, `${repoPath(referencePath)}: object ${objectId}.bounds must match object payload bounds`);
    }
    if (referenceObject?.kind !== "point-cloud") continue;
    if (Array.isArray(referenceObject.points) && Array.isArray(referenceObject.chunkIds) && referenceObject.chunkIds.length) {
      fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId} must not mix inline points and chunkIds`);
    }
    if (Array.isArray(referenceObject.points) && !referenceObject.points.length) {
      fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.points must contain at least one point`);
    }
    if (!Array.isArray(referenceObject.points) && Array.isArray(referenceObject.chunkIds) && !referenceObject.chunkIds.length) {
      fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.chunkIds must contain at least one chunk id`);
    }
    if (Array.isArray(referenceObject.chunkIds)) {
      const objectChunkIds = new Set();
      for (const chunkId of referenceObject.chunkIds) {
        if (objectChunkIds.has(chunkId)) {
          fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.chunkIds contains duplicate chunk id ${chunkId}`);
        }
        objectChunkIds.add(chunkId);
        referencedChunkIds.add(chunkId);
      }
    }
    if (referenceObject.pointAttributes && !Array.isArray(referenceObject.points)) {
      fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId} stores pointAttributes without inline points; chunked attributes must live in point-cloud chunk sidecars`);
    }
    if (Array.isArray(referenceObject.points)) {
      validatePointAttributeLengths(errors, repoPath(referencePath), referenceObject.pointAttributes, referenceObject.points.length, `point-cloud ${objectId}`);
      if (referenceObject.bounds) {
        const payloadBounds = boundsFor(referenceObject.points);
        if (payloadBounds && !sameBounds(referenceObject.bounds, payloadBounds)) {
          fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.bounds must match point payload bounds`);
        }
      }
    }
    for (const chunkId of referenceObject.chunkIds || []) {
      const chunk = chunks[chunkId];
      if (!chunk) {
        fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId} references missing chunk ${chunkId}`);
        continue;
      }
      if (chunk.objectId !== objectId) {
        fail(errors, `${repoPath(referencePath)}: chunk ${chunkId}.objectId ${chunk.objectId} must match point-cloud object ${objectId}`);
      }
      if (typeof chunk.path !== "string" || !chunk.path) {
        fail(errors, `${repoPath(referencePath)}: chunk ${chunkId}.path must be a non-empty string`);
        continue;
      }
      const chunkPath = path.resolve(path.dirname(referencePath), chunk.path);
      if (!isSubpath(referencesDir, chunkPath)) {
        fail(errors, `${repoPath(referencePath)}: chunk ${chunkId}.path must resolve under ${repoPath(referencesDir)}`);
        continue;
      }
      if (!fs.existsSync(chunkPath)) {
        fail(errors, `${repoPath(referencePath)}: chunk ${chunkId}.path points to missing file ${chunk.path}`);
        continue;
      }
      validateReferencePointCloudChunk(errors, relative, assetId, chunk, chunkPath);
    }
    if (referenceObject.bounds && Array.isArray(referenceObject.chunkIds) && referenceObject.chunkIds.length) {
      const objectChunkBounds = completeUnionBounds(referenceObject.chunkIds.map((chunkId) => chunks[chunkId]?.bounds));
      if (!objectChunkBounds) {
        fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.bounds cannot be verified without complete referenced chunk bounds`);
      } else if (!sameBounds(referenceObject.bounds, objectChunkBounds)) {
        fail(errors, `${repoPath(referencePath)}: point-cloud ${objectId}.bounds must match referenced chunk bounds`);
      }
    }
  }
  for (const [diagnosticIndex, diagnostic] of (referenceData.diagnostics || []).entries()) {
    if (diagnostic?.objectId && !referenceData.objects?.[diagnostic.objectId]) {
      fail(errors, `${repoPath(referencePath)}: diagnostics[${diagnosticIndex}].objectId ${diagnostic.objectId} points to a missing reference object`);
    }
    for (const [objectRefIndex, objectRef] of (diagnostic?.objectRefs || []).entries()) {
      if (!referenceData.objects?.[objectRef]) {
        fail(errors, `${repoPath(referencePath)}: diagnostics[${diagnosticIndex}].objectRefs[${objectRefIndex}] ${objectRef} points to a missing reference object`);
      }
    }
  }

  for (const chunk of referenceData.chunks || []) {
    const chunkOwner = referenceData.objects?.[chunk.objectId];
    if (!chunkOwner) {
      fail(errors, `${repoPath(referencePath)}: chunk ${chunk.id} points to missing object ${chunk.objectId}`);
    } else if (chunkOwner.kind !== "point-cloud") {
      fail(errors, `${repoPath(referencePath)}: chunk ${chunk.id} points to non-point-cloud object ${chunk.objectId}`);
    }
    if (chunk?.id && !referencedChunkIds.has(chunk.id)) {
      fail(errors, `${repoPath(referencePath)}: chunk ${chunk.id} is not referenced by point-cloud ${chunk.objectId}.chunkIds`);
    }
  }
  if (referenceData.asset?.bounds) {
    const objectBounds = Object.values(referenceData.objects || {}).map((object) => payloadBoundsForReferenceObject(object, chunks));
    const assetPayloadBounds = completeUnionBounds(objectBounds);
    if (!assetPayloadBounds) {
      fail(errors, `${repoPath(referencePath)}: asset.bounds cannot be verified without complete reference object payload bounds`);
    } else if (!sameBounds(referenceData.asset.bounds, assetPayloadBounds)) {
      fail(errors, `${repoPath(referencePath)}: asset.bounds must match reference object payload bounds`);
    }
  }
}

function validateReferenceGeometry(errors, relative, project, projectPath, referencesDir = REFERENCE_GEOMETRY_DIR) {
  const assets = project.referenceGeometry?.assets;
  if (assets === undefined) return;
  if (!isRecord(assets)) {
    fail(errors, `${relative}: referenceGeometry.assets must be an object`);
    return;
  }
  for (const [assetId, asset] of Object.entries(assets)) {
    if (!isReferenceGeometryId(assetId)) {
      fail(errors, `${relative}: referenceGeometry.assets.${assetId} must use a safe canonical reference id`);
      continue;
    }
    validateReferenceGeometryAsset(errors, relative, project, projectPath, assetId, asset, referencesDir);
  }
}

function validateProject(relative, project, projectPath = null) {
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
  if (projectPath) validateReferenceGeometry(errors, relative, project, projectPath);

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
    errors.push(...validateProject(relative, project, filePath));
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
  validateProject,
  validateReferenceGeometry
};
