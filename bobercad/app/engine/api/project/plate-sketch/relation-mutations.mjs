import { finitePositiveNumber } from "../../../core/math.mjs";
import { arrayValues, uniqueTruthy } from "../../../core/model.mjs";
import {
  sketchConstructionVertices,
  sketchEdges,
  sketchRelationEdges,
  sketchRelationVertices,
  sketchRelations,
  sketchVertices
} from "./model-accessors.mjs";
import {
  isDrivingAngleRelation,
  isDrivingDimensionRelation,
  isDrivingDistanceRelation,
  isDrivingLengthRelation,
  isSketchAngleRelationDriven,
  isSketchDistanceRelationDriven,
  isSketchLengthRelationDriven,
  sketchRelationEdgeIds,
  sketchRelationKey,
  sketchRelationLabel,
  sketchRelationVertexIds
} from "./relation-metadata.mjs";
import { normalizePlate, normalizeSketchObject } from "./model-and-placement.mjs";
import {
  EPSILON,
  RAD_PER_DEG,
  dot2,
  edgeById,
  edgeEndpointIds,
  fail,
  finiteAngleDegrees,
  inferredSketchRelations,
  measuredSketchEdgeAngle,
  measuredSketchPointDistance,
  normalizeSketch,
  pointMoved,
  requiredIdPair,
  sketchAngleDeltaDegrees,
  sketchDimensionMode,
  sketchEdgeAngleFromVectors,
  sketchEdgePoints,
  sketchRelationVector,
  sketchVertexPointMap,
  vec2,
  withSketchRelations
} from "./sketch-geometry-and-relations.mjs";

import {
  relaxRelationsForDirectVertexMove,
  sketchSolverFixedVertexIds,
  solveSketchRelationsAfterVertexChange
} from './solver-core.mjs';
import {
  assertSketchRelationsSatisfied,
  plateSketchDefinitionStatus,
  plateSketchRelationHealth
} from './relation-analysis.mjs';

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalTargetId(value, ids, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || !ids.includes(value)) fail(`${label} must reference one of ${ids.join(", ")}`);
  return value;
}

function sketchRelationSolveVertexIds(sketch, relation) {
  if (!relation) return [];
  if (relation.type === "fixed") return [];
  if (relation.type === "length" && !isDrivingLengthRelation(relation)) return [];
  if (relation.type === "angle" && !isDrivingAngleRelation(relation)) return [];
  if (relation.type === "distance" && !isDrivingDistanceRelation(relation)) return [];
  if (relation.type === "horizontal-points" || relation.type === "vertical-points") return sketchRelationVertexIds(relation);
  if (relation.type === "distance") {
    const ids = sketchRelationVertexIds(relation);
    const targetVertexId = optionalTargetId(relation.targetVertexId, ids, `${relation.id || "distance relation"}.targetVertexId`) || ids[1];
    return [targetVertexId];
  }
  if (relation.type === "coincident") {
    const [firstId, secondId] = sketchRelationVertexIds(relation);
    const fixed = sketchSolverFixedVertexIds(sketch);
    if (fixed.has(firstId) && !fixed.has(secondId)) return [secondId];
    if (fixed.has(secondId) && !fixed.has(firstId)) return [firstId];
    return [firstId];
  }
  if (relation.type === "point-on-line") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? edgeEndpointIds(sketch, relation.edgeId) : [relation.vertexId];
  }
  if (relation.type === "midpoint") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? edgeEndpointIds(sketch, relation.edgeId) : [relation.vertexId];
  }
  if (relation.type === "symmetric") {
    const [firstId, secondId] = sketchRelationVertexIds(relation);
    const fixed = sketchSolverFixedVertexIds(sketch);
    if (fixed.has(firstId) && fixed.has(secondId)) return edgeEndpointIds(sketch, relation.edgeId);
    return [firstId, secondId];
  }
  if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
    return edgeEndpointIds(sketch, relation.edgeId);
  }
  if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length" || relation.type === "angle") {
    const edgeIds = sketchRelationEdgeIds(relation);
    const targetEdgeId = optionalTargetId(relation.targetEdgeId, edgeIds, `${relation.id || `${relation.type} relation`}.targetEdgeId`) || edgeIds[1];
    const referenceEdgeId = edgeIds.find((edgeId) => edgeId !== targetEdgeId);
    const referenceVertexIds = new Set(edgeEndpointIds(sketch, referenceEdgeId));
    const freeTargetVertexIds = edgeEndpointIds(sketch, targetEdgeId).filter((vertexId) => !referenceVertexIds.has(vertexId));
    return freeTargetVertexIds.length ? freeTargetVertexIds : edgeEndpointIds(sketch, targetEdgeId);
  }
  return [];
}

function sketchWithVertexPoint(sketch, vertexId, point) {
  const nextPoint = vec2(point, `plate sketch vertex ${vertexId}`);
  let found = false;
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    return { ...vertex, point: nextPoint };
  });
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    return { ...vertex, point: nextPoint };
  });
  if (!found) fail(`plate sketch vertex not found: ${vertexId}`);
  return { ...sketch, vertices, constructionVertices };
}

function pointOnLineProjection(sketch, vertexId, edgeId) {
  const vertexMap = sketchVertexPointMap(sketch);
  const pointValue = vertexMap.get(vertexId);
  const { a, b } = sketchEdgePoints(sketch, edgeId, vertexMap);
  if (!pointValue) fail(`plate sketch vertex not found: ${vertexId}`);
  const axis = [b[0] - a[0], b[1] - a[1]];
  const length = Math.hypot(axis[0], axis[1]);
  if (length <= EPSILON) fail(`plate sketch edge ${edgeId} has zero length`);
  const unit = [axis[0] / length, axis[1] / length];
  const station = dot2([pointValue[0] - a[0], pointValue[1] - a[1]], unit);
  return [a[0] + unit[0] * station, a[1] + unit[1] * station];
}

function midpointProjection(sketch, edgeId) {
  const { a, b } = sketchEdgePoints(sketch, edgeId);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function seedSketchForRelationSolve(sketch, relation) {
  if (relation?.type === "point-on-line" && relation.vertexId && relation.edgeId) {
    return sketchWithVertexPoint(sketch, relation.vertexId, pointOnLineProjection(sketch, relation.vertexId, relation.edgeId));
  }
  if (relation?.type === "midpoint" && relation.vertexId && relation.edgeId) {
    return sketchWithVertexPoint(sketch, relation.vertexId, midpointProjection(sketch, relation.edgeId));
  }
  return sketch;
}

export function solveSketchAfterRelationUpsert(sketch, relation) {
  const fixed = sketchSolverFixedVertexIds(sketch);
  const solvedVertexIds = sketchRelationSolveVertexIds(sketch, relation).filter((vertexId) => !fixed.has(vertexId));
  if (!solvedVertexIds.length) {
    assertSketchRelationsSatisfied(sketch);
    return sketch;
  }
  const seededSketch = seedSketchForRelationSolve(sketch, relation);
  const solvedSketch = solveSketchRelationsAfterVertexChange(seededSketch, solvedVertexIds);
  assertSketchRelationsSatisfied(solvedSketch);
  return solvedSketch;
}

export function edgeRelationInheritance(oldSketch, oldEdgeId, nextEdgeIds, options = {}) {
  const ids = uniqueTruthy(nextEdgeIds);
  if (!ids.length) return [];
  const inherited = [];
  for (const relation of sketchRelations(oldSketch)) {
    const relationEdgeIds = sketchRelationEdgeIds(relation);
    if (!relationEdgeIds.includes(oldEdgeId)) continue;
    if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "fixed") {
      if ((relation.type === "horizontal" || relation.type === "vertical") && options.inheritAxisRelations === false) continue;
      inherited.push(...ids.map((edgeId) => ({ type: relation.type, edgeId })));
    } else if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear") {
      if (options.inheritDirectionalRelations === false) continue;
      const otherEdgeId = relationEdgeIds.find((edgeId) => edgeId !== oldEdgeId);
      inherited.push(...ids.map((edgeId) => ({ type: relation.type, edgeIds: [edgeId, otherEdgeId] })));
    }
  }
  return inherited;
}

export function edgeLengthDimensionInheritance(oldSketch, oldEdgeId, nextSketch, nextEdgeIds) {
  if (!sketchRelations(oldSketch).some((relation) => relation.type === "length" && relation.edgeId === oldEdgeId)) return [];
  return uniqueTruthy(nextEdgeIds).map((edgeId) => ({
    type: "length",
    edgeId,
    value: sketchRelationVector(nextSketch, edgeId).length,
    mode: "driven"
  }));
}

export function relationsForTopologyChange(oldSketch, nextSketch, removedEdgeIds = [], extraRelations = [], options = {}) {
  const removed = new Set(removedEdgeIds);
  const nextEdgeIds = new Set(sketchRelationEdges(nextSketch).map((edge) => edge.id));
  const nextVertexIds = new Set(sketchRelationVertices(nextSketch).map((vertex) => vertex.id));
  const oldEdgeIds = new Set(sketchEdges(oldSketch).map((edge) => edge.id));
  const newEdgeIds = new Set([...nextEdgeIds].filter((edgeId) => !oldEdgeIds.has(edgeId)));
  const preserved = sketchRelations(oldSketch).filter((relation) => {
    const ids = sketchRelationEdgeIds(relation);
    if (ids.length) return ids.every((edgeId) => nextEdgeIds.has(edgeId) && !removed.has(edgeId));
    const vertexIds = sketchRelationVertexIds(relation);
    return vertexIds.length && vertexIds.every((vertexId) => nextVertexIds.has(vertexId));
  });
  const validExtraRelations = extraRelations.filter((relation) => {
    const ids = sketchRelationEdgeIds(relation);
    if (ids.length) return ids.every((edgeId) => nextEdgeIds.has(edgeId));
    const vertexIds = sketchRelationVertexIds(relation);
    return !vertexIds.length || vertexIds.every((vertexId) => nextVertexIds.has(vertexId));
  });
  const inferred = options.inferNewRelations === false
    ? []
    : inferredSketchRelations(nextSketch).filter((relation) => (
      sketchRelationEdgeIds(relation).some((edgeId) => newEdgeIds.has(edgeId))
    ));
  return withSketchRelations(nextSketch, [...preserved, ...validExtraRelations, ...inferred]);
}

export function sketchEdgeAxisRelation(sketch, edgeId) {
  return sketchRelations(sketch).find((relation) => (
    (relation.type === "horizontal" || relation.type === "vertical") && relation.edgeId === edgeId
  )) || null;
}

export function sketchRelationsForEdge(sketch, edgeId) {
  return sketchRelations(sketch).filter((relation) => sketchRelationEdgeIds(relation).includes(edgeId));
}

export function sketchRelationsForVertex(sketch, vertexId) {
  return sketchRelations(sketch).filter((relation) => sketchRelationVertexIds(relation).includes(vertexId));
}


export function upsertSketchRelationFromHost(sketchHost, relation, normalize = normalizePlate) {
  if (!relation || typeof relation !== "object") fail("plate sketch relation is required");
  const sketch = normalizeSketch(sketchHost.sketch);
  const key = sketchRelationKey(relation);
  const nextSketch = withSketchRelations(sketch, [
    ...sketchRelations(sketch).filter((item) => sketchRelationKey(item) !== key),
    relation
  ]);
  const normalizedRelation = sketchRelations(nextSketch).find((item) => sketchRelationKey(item) === sketchRelationKey(relation));
  if (!normalizedRelation) fail(`${sketchHost.id || "plate"}: sketch relation was not retained after normalization`);
  const solvedSketch = solveSketchAfterRelationUpsert(nextSketch, {
    ...normalizedRelation,
    ...(relation.targetEdgeId ? { targetEdgeId: relation.targetEdgeId } : {}),
    ...(relation.targetVertexId ? { targetVertexId: relation.targetVertexId } : {})
  });
  return normalize({
    ...sketchHost,
    sketch: solvedSketch
  });
}

export function removeSketchRelationFromHost(sketchHost, relationId, normalize = normalizePlate) {
  if (typeof relationId !== "string" || !relationId) fail("plate sketch relation id is required");
  const relations = sketchRelations(sketchHost.sketch);
  const nextRelations = relations.filter((relation) => relation.id !== relationId);
  if (nextRelations.length === relations.length) fail(`${sketchHost.id}: sketch relation not found: ${relationId}`);
  return normalize({ ...sketchHost, sketch: { ...sketchHost.sketch, relations: nextRelations } });
}

export function inferSketchRelationsForHost(sketchHost, normalize = normalizePlate) {
  const sketch = sketchHost?.sketch;
  if (!sketch) fail("plate sketch is required");
  return normalize({
    ...sketchHost,
    sketch: withSketchRelations(sketch, [...sketchRelations(sketch), ...inferredSketchRelations(sketch)])
  });
}

export function setPlateSketchVertex(plate, vertexId, point) {
  return setPlateSketchVertices(plate, [{ vertexId, point }]);
}

function sketchVertexPointUpdates(vertexPoints) {
  const updates = new Map();
  const addUpdate = (vertexId, point, label) => {
    if (typeof vertexId !== "string" || !vertexId.trim()) fail(`${label} requires a vertex id`);
    if (updates.has(vertexId)) fail(`plate sketch vertex update duplicates vertex id ${vertexId}`);
    updates.set(vertexId, point);
  };
  if (vertexPoints instanceof Map) {
    for (const [vertexId, point] of vertexPoints) addUpdate(vertexId, point, "plate sketch vertex update");
    return updates;
  }
  if (Array.isArray(vertexPoints)) {
    for (const [index, item] of vertexPoints.entries()) {
      if (!plainObject(item)) fail(`plate sketch vertex update ${index + 1} must be an object`);
      const vertexId = item.vertexId === undefined ? item.id : item.vertexId;
      addUpdate(vertexId, item.point, `plate sketch vertex update ${index + 1}`);
    }
    return updates;
  }
  if (plainObject(vertexPoints)) {
    for (const [vertexId, point] of Object.entries(vertexPoints)) addUpdate(vertexId, point, "plate sketch vertex update");
    return updates;
  }
  fail("plate sketch vertex updates must be a Map, array, or object");
}

export function setPlateSketchVertices(plate, vertexPoints) {
  if (!plate?.sketch) fail("plate sketch is required");
  const updates = sketchVertexPointUpdates(vertexPoints);
  if (!updates.size) return normalizePlate(plate);
  const nextPoints = new Map([...updates.entries()].map(([vertexId, point]) => [vertexId, vec2(point, `plate sketch vertex ${vertexId}`)]));
  const sketch = normalizeSketch(plate.sketch);
  const found = new Set();
  const changedVertexIds = [];
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (pointMoved(point, vec2(vertex.point, `plate sketch vertex ${vertex.id}`))) changedVertexIds.push(vertex.id);
    return { ...vertex, point };
  });
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (pointMoved(point, vec2(vertex.point, `plate sketch construction vertex ${vertex.id}`))) changedVertexIds.push(vertex.id);
    return { ...vertex, point };
  });
  for (const vertexId of nextPoints.keys()) {
    if (!found.has(vertexId)) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  }
  if (!changedVertexIds.length) return normalizePlate(plate);
  const editableSketch = relaxRelationsForDirectVertexMove({ ...sketch, vertices, constructionVertices }, changedVertexIds);
  const solvedSketch = solveSketchRelationsAfterVertexChange(editableSketch, changedVertexIds);
  assertSketchRelationsSatisfied(solvedSketch);
  return normalizePlate({ ...plate, sketch: solvedSketch });
}

export function setPlateSketchEdgeLength(plate, edgeId, length, options = {}) {
  if (!finitePositiveNumber(length)) fail("plate sketch edge length must be a positive number");
  const sketch = normalizeSketch(plate?.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const mode = sketchDimensionMode(options.mode, "plate sketch edge length mode");
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, {
    type: "length",
    edgeId,
    value: length,
    mode
  }, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "length" && item.edgeId === edgeId);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchEdgeLength(nextPlate, edgeId, sketchRelationVector(nextPlate.sketch, edgeId).length, { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchEdgeLengthMode(plate, edgeId, mode) {
  const nextMode = sketchDimensionMode(mode, "plate sketch edge length mode");
  const sketch = normalizeSketch(plate?.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const measuredLength = sketchRelationVector(sketch, edgeId).length;
  return setPlateSketchEdgeLength(plate, edgeId, measuredLength, {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setPlateSketchEdgeAngle(plate, edgeIds, angleDegrees, options = {}) {
  const ids = requiredIdPair(edgeIds, "plate sketch edge angle edgeIds");
  const angle = finiteAngleDegrees(angleDegrees, "plate sketch edge angle");
  const sketch = normalizeSketch(plate?.sketch);
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  }
  const mode = sketchDimensionMode(options.mode, "plate sketch edge angle mode");
  const targetEdgeId = optionalTargetId(options.targetEdgeId, ids, "plate sketch edge angle targetEdgeId");
  const relationPatch = {
    type: "angle",
    edgeIds: ids,
    value: angle,
    mode,
    ...(targetEdgeId ? { targetEdgeId } : {})
  };
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, relationPatch, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "angle", edgeIds: ids });
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "angle" && sketchRelationKey(item) === key);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchEdgeAngle(nextPlate, ids, measuredSketchEdgeAngle(nextPlate.sketch, ids), { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchEdgeAngleMode(plate, edgeIds, mode) {
  const nextMode = sketchDimensionMode(mode, "plate sketch edge angle mode");
  const sketch = normalizeSketch(plate?.sketch);
  const ids = requiredIdPair(edgeIds, "plate sketch edge angle edgeIds");
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  }
  return setPlateSketchEdgeAngle(plate, ids, measuredSketchEdgeAngle(sketch, ids), {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setPlateSketchPointDistance(plate, vertexIds, distance, options = {}) {
  const ids = requiredIdPair(vertexIds, "plate sketch point distance vertexIds");
  if (!finitePositiveNumber(distance)) fail("plate sketch point distance must be a positive number");
  const sketch = normalizeSketch(plate?.sketch);
  const sketchVertexIds = new Set(sketchVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${plate?.id || "plate"}: sketch vertex not found: ${vertexId}`);
  }
  const mode = sketchDimensionMode(options.mode, "plate sketch point distance mode");
  const targetVertexId = optionalTargetId(options.targetVertexId, ids, "plate sketch point distance targetVertexId");
  const nextPlate = upsertSketchRelationFromHost({
    ...plate,
    sketch
  }, {
    type: "distance",
    vertexIds: ids,
    value: distance,
    mode,
    ...(targetVertexId ? { targetVertexId } : {})
  }, normalizePlate);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "distance", vertexIds: ids });
    const relation = sketchRelations(nextPlate.sketch).find((item) => item.type === "distance" && sketchRelationKey(item) === key);
    const health = relation ? plateSketchRelationHealth(nextPlate)[relation.id] : null;
    if (health?.status === "redundant") {
      return setPlateSketchPointDistance(nextPlate, ids, measuredSketchPointDistance(nextPlate.sketch, ids), { mode: "driven" });
    }
  }
  return nextPlate;
}

export function setPlateSketchPointDistanceMode(plate, vertexIds, mode) {
  const nextMode = sketchDimensionMode(mode, "plate sketch point distance mode");
  const sketch = normalizeSketch(plate?.sketch);
  const ids = requiredIdPair(vertexIds, "plate sketch point distance vertexIds");
  const sketchVertexIds = new Set(sketchRelationVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${plate?.id || "plate"}: sketch vertex not found: ${vertexId}`);
  }
  return setPlateSketchPointDistance(plate, ids, measuredSketchPointDistance(sketch, ids), {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setSketchVertex(sketchObject, vertexId, point) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const sketch = normalizeSketch(sketchObject.sketch);
  const nextPoint = vec2(point, "sketch vertex");
  let found = false;
  let changed = false;
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (vertex.id !== vertexId) return vertex;
    found = true;
    changed = pointMoved(nextPoint, vec2(vertex.point, `sketch vertex ${vertex.id}`));
    return { ...vertex, point: nextPoint };
  });
  if (!found) fail(`${sketchObject.id}: sketch vertex not found: ${vertexId}`);
  if (!changed) return normalizeSketchObject(sketchObject);
  const solvedSketch = solveSketchRelationsAfterVertexChange({ ...sketch, vertices }, [vertexId]);
  assertSketchRelationsSatisfied(solvedSketch);
  return normalizeSketchObject({ ...sketchObject, sketch: solvedSketch });
}

export function removePlateSketchRelation(plate, relationId) {
  return removeSketchRelationFromHost(plate, relationId, normalizePlate);
}

export function removePlateSketchFixedRelations(plate) {
  if (!plate?.sketch) fail("plate sketch is required");
  const relations = sketchRelations(plate.sketch);
  const nextRelations = relations.filter((relation) => relation.type !== "fixed");
  if (nextRelations.length === relations.length) return normalizePlate(plate);
  return normalizePlate({ ...plate, sketch: { ...plate.sketch, relations: nextRelations } });
}

export function solvePlateSketchRelation(plate, relationId) {
  if (!plate?.sketch) fail("plate sketch is required");
  if (typeof relationId !== "string" || !relationId) fail("plate sketch relation id is required");
  const sketch = normalizeSketch(plate.sketch);
  const relation = sketchRelations(sketch).find((item) => item.id === relationId);
  if (!relation) fail(`${plate.id}: sketch relation not found: ${relationId}`);
  const solvedSketch = solveSketchAfterRelationUpsert(sketch, relation);
  return normalizePlate({ ...plate, sketch: solvedSketch });
}

export function upsertPlateSketchRelation(plate, relation) {
  return upsertSketchRelationFromHost(plate, relation, normalizePlate);
}

export function fixPlateSketchUnderDefinedEntities(plate, options = {}) {
  const definition = plateSketchDefinitionStatus(plate);
  const edgeIds = options.edges === false ? [] : arrayValues(definition.underDefinedEdgeIds).filter(Boolean);
  const vertexIds = options.vertices === false ? [] : arrayValues(definition.underDefinedVertexIds).filter(Boolean);
  let nextPlate = normalizePlate(plate);
  let nextDefinition = plateSketchDefinitionStatus(nextPlate);
  const candidates = [
    ...vertexIds.map((vertexId) => ({ type: "fixed", vertexId })),
    ...edgeIds.map((edgeId) => ({ type: "fixed", edgeId }))
  ];
  for (const relation of candidates) {
    if (nextDefinition.status === "fully-defined" || nextDefinition.degreesOfFreedom <= 0) break;
    const candidatePlate = upsertSketchRelationFromHost(nextPlate, relation, normalizePlate);
    const candidateDefinition = plateSketchDefinitionStatus(candidatePlate);
    if (candidateDefinition.status === "conflicted" || candidateDefinition.status === "over-defined" || candidateDefinition.status === "invalid") continue;
    if (candidateDefinition.degreesOfFreedom >= nextDefinition.degreesOfFreedom) continue;
    nextPlate = candidatePlate;
    nextDefinition = candidateDefinition;
  }
  return nextPlate;
}

export function inferPlateSketchRelations(plate) {
  return inferSketchRelationsForHost(plate, normalizePlate);
}
