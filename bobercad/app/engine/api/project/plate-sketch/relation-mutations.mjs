import { finitePositiveNumber } from "../../../core/math.mjs";
import { arrayValues, uniqueTruthy } from "../../../core/model.mjs";
import {
  sketchConstructionEdges,
  sketchConstructionVertices,
  sketchEdges,
  sketchRelationEdges,
  sketchRelationVertices,
  sketchRelations,
  sketchVertices
} from "./model-accessors.mjs";
import {
  isDrivingAngleRelation,
  isDrivingDistanceRelation,
  isDrivingLengthRelation,
  isDrivingRadiusRelation,
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
  measuredSketchEdgeRadius,
  measuredSketchPointDistance,
  normalizeSketch,
  pointMoved,
  requiredIdPair,
  sketchAngleDeltaDegrees,
  sketchDimensionMode,
  sketchEdgeAngleFromVectors,
  sketchEdgeTangentAtVertex,
  sketchEdgePoints,
  sketchRadiusDimensionDisplay,
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
  plateSketchRelationHealth,
  sketchRelationHealth
} from './relation-analysis.mjs';
import { SKETCH_EDGE_CIRCULAR_ARC } from "./edge-geometry.mjs";

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
  if (relation.type === "radius") return [];
  if (relation.type === "tangent" || relation.type === "concentric" || relation.type === "equal-radius") return [];
  if (relation.type === "horizontal-points" || relation.type === "vertical-points") return sketchRelationVertexIds(relation);
  if (relation.type === "distance") {
    const ids = sketchRelationVertexIds(relation);
    const targetVertexId = optionalTargetId(relation.targetVertexId, ids, `${relation.id || "distance relation"}.targetVertexId`) || ids[1];
    return [targetVertexId];
  }
  if (relation.type === "coincident") {
    const ids = sketchRelationVertexIds(relation);
    const [firstId, secondId] = ids;
    const targetVertexId = optionalTargetId(relation.targetVertexId, ids, `${relation.id || "coincident relation"}.targetVertexId`);
    if (targetVertexId) return [targetVertexId];
    const fixed = sketchSolverFixedVertexIds(sketch);
    if (fixed.has(firstId) && !fixed.has(secondId)) return [secondId];
    if (fixed.has(secondId) && !fixed.has(firstId)) return [firstId];
    return [firstId];
  }
  if (relation.type === "point-on-line") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? edgeEndpointIds(sketch, relation.edgeId) : [relation.vertexId];
  }
  if (relation.type === "point-on-circle") {
    const fixed = sketchSolverFixedVertexIds(sketch);
    return fixed.has(relation.vertexId) ? [] : [relation.vertexId];
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

export function upsertSketchRelation(sketchObject, relation) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return upsertSketchRelationFromHost(sketchObject, relation, normalizeSketchObject);
}

export function removeSketchRelation(sketchObject, relationId) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return removeSketchRelationFromHost(sketchObject, relationId, normalizeSketchObject);
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
  const adjustedMovedSketch = sketchWithAdjustedCircularArcsAfterVertexMove({ ...sketch, vertices, constructionVertices }, sketch);
  const concentricMovedSketch = sketchWithConcentricAfterVertexMove(adjustedMovedSketch, sketch);
  const movedSketch = sketchWithEqualRadiusAfterVertexMove(concentricMovedSketch, sketch);
  const pointOnCircleMovedSketch = sketchWithPointOnCircleAfterArcMove(movedSketch, sketch, changedVertexIds);
  const editableSketch = relaxRelationsForDirectVertexMove(pointOnCircleMovedSketch, changedVertexIds);
  const solvedSketch = solveSketchRelationsAfterVertexChange(editableSketch, changedVertexIds);
  const adjustedSketch = sketchWithAdjustedCircularArcsAfterVertexMove(solvedSketch, pointOnCircleMovedSketch);
  assertSketchRelationsSatisfied(adjustedSketch);
  return normalizePlate({ ...plate, sketch: adjustedSketch });
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

export function setSketchEdgeLength(sketchObject, edgeId, length, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  if (!finitePositiveNumber(length)) fail("sketch edge length must be a positive number");
  const sketch = normalizeSketch(sketchObject.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  const mode = sketchDimensionMode(options.mode, "sketch edge length mode");
  const nextSketchObject = upsertSketchRelationFromHost({
    ...sketchObject,
    sketch
  }, {
    type: "length",
    edgeId,
    value: length,
    mode
  }, normalizeSketchObject);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const relation = sketchRelations(nextSketchObject.sketch).find((item) => item.type === "length" && item.edgeId === edgeId);
    const health = relation ? sketchRelationHealth(nextSketchObject.sketch)[relation.id] : null;
    if (health?.status === "redundant") {
      return setSketchEdgeLength(nextSketchObject, edgeId, sketchRelationVector(nextSketchObject.sketch, edgeId).length, { mode: "driven" });
    }
  }
  return nextSketchObject;
}

export function setSketchEdgeLengthMode(sketchObject, edgeId, mode) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const nextMode = sketchDimensionMode(mode, "sketch edge length mode");
  const sketch = normalizeSketch(sketchObject.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  const measuredLength = sketchRelationVector(sketch, edgeId).length;
  return setSketchEdgeLength(sketchObject, edgeId, measuredLength, {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

function sameSketchPoint(first, second, tolerance) {
  return Math.abs(first[0] - second[0]) <= tolerance && Math.abs(first[1] - second[1]) <= tolerance;
}

function pointDistance2(first, second) {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function pointDelta2(point, previousPoint) {
  return [point[0] - previousPoint[0], point[1] - previousPoint[1]];
}

function pointAdd2(point, delta) {
  return [point[0] + delta[0], point[1] + delta[1]];
}

function edgeTranslatedDelta(sketch, edgeId, vertexMap, previousVertexMap, tolerance) {
  const deltas = edgeEndpointIds(sketch, edgeId).map((vertexId) => {
    const point = vertexMap.get(vertexId);
    const previousPoint = previousVertexMap.get(vertexId);
    return point && previousPoint ? pointDelta2(point, previousPoint) : null;
  });
  if (deltas.some((delta) => !delta)) return null;
  const [firstDelta, secondDelta] = deltas;
  if (Math.hypot(firstDelta[0], firstDelta[1]) <= tolerance) return null;
  return sameSketchPoint(firstDelta, secondDelta, tolerance) ? firstDelta : null;
}

function circularArcCenterCandidates(a, b, radius) {
  const chordLength = pointDistance2(a, b);
  if (chordLength <= EPSILON) fail("plate sketch circular arc requires distinct endpoints");
  const halfChord = chordLength / 2;
  const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const heightSquared = radius * radius - halfChord * halfChord;
  if (heightSquared < -Math.max(EPSILON, radius * radius * 1e-9)) return [];
  const height = Math.sqrt(Math.max(0, heightSquared));
  const unitNormal = [-(b[1] - a[1]) / chordLength, (b[0] - a[0]) / chordLength];
  return [
    [midpoint[0] + unitNormal[0] * height, midpoint[1] + unitNormal[1] * height],
    [midpoint[0] - unitNormal[0] * height, midpoint[1] - unitNormal[1] * height]
  ];
}

function closestSketchPoint(points, target) {
  return points.reduce((best, point) => (
    !best || pointDistance2(point, target) < pointDistance2(best, target)
      ? point
      : best
  ), null);
}

function tangentArcCenterCandidatesAtEndpoint(movedPoint, otherPoint, tangent) {
  const chord = [otherPoint[0] - movedPoint[0], otherPoint[1] - movedPoint[1]];
  const chordLengthSq = chord[0] * chord[0] + chord[1] * chord[1];
  if (chordLengthSq <= EPSILON) return [];
  const tangentLength = Math.hypot(tangent[0], tangent[1]);
  if (tangentLength <= EPSILON) return [];
  const unit = [tangent[0] / tangentLength, tangent[1] / tangentLength];
  const normals = [[-unit[1], unit[0]], [unit[1], -unit[0]]];
  return normals.flatMap((normal) => {
    const denominator = 2 * (normal[0] * chord[0] + normal[1] * chord[1]);
    if (Math.abs(denominator) <= EPSILON) return [];
    const radius = chordLengthSq / denominator;
    if (!finitePositiveNumber(radius)) return [];
    return [{
      center: [movedPoint[0] + normal[0] * radius, movedPoint[1] + normal[1] * radius],
      radius
    }];
  });
}

function pointLineDistance(point, lineStart, lineEnd) {
  const axis = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]];
  const length = Math.hypot(axis[0], axis[1]);
  if (length <= EPSILON) return Infinity;
  const offset = [point[0] - lineStart[0], point[1] - lineStart[1]];
  return Math.abs(axis[0] * offset[1] - axis[1] * offset[0]) / length;
}

function tangentPreservingCircularArcCandidate(edge, movedPoint, otherPoint, tangent, previousCenter) {
  const candidates = tangentArcCenterCandidatesAtEndpoint(movedPoint, otherPoint, tangent);
  const candidate = closestSketchPoint(candidates.map((item) => item.center), previousCenter);
  if (!candidate) return null;
  const match = candidates.find((item) => sameSketchPoint(item.center, candidate, Math.max(1e-6, item.radius * 1e-6)));
  if (!match) return null;
  return {
    ...edge,
    center: match.center,
    radius: match.radius
  };
}

function tangentPreservingCircularArcForRelation(edge, sketch, previousSketch, vertexMap, previousVertexMap, movedEndpointId, movedPoint, otherPoint, tangentRelation, previousCenter, tolerance) {
  const tangentEdgeId = sketchRelationEdgeIds(tangentRelation).find((edgeId) => edgeId !== edge.id);
  const tangentEdge = edgeById(sketch, tangentEdgeId);
  if (!tangentEdge) return null;
  const previousTangentEdge = edgeById(previousSketch, tangentEdgeId);
  if (!previousTangentEdge) return null;
  if (tangentEdge.kind === SKETCH_EDGE_CIRCULAR_ARC) {
    if (previousTangentEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) return null;
    const translatedArcDelta = edgeTranslatedDelta(sketch, tangentEdgeId, vertexMap, previousVertexMap, tolerance);
    if (translatedArcDelta) {
      return tangentPreservingCircularArcCandidate(
        edge,
        movedPoint,
        otherPoint,
        sketchEdgeTangentAtVertex(previousSketch, tangentEdgeId, movedEndpointId),
        previousCenter
      );
    }
    const previousMovedPoint = previousVertexMap.get(movedEndpointId);
    if (!previousMovedPoint) return null;
    const previousTangent = sketchEdgeTangentAtVertex(previousSketch, tangentEdgeId, movedEndpointId);
    if (pointLineDistance(movedPoint, previousMovedPoint, pointAdd2(previousMovedPoint, previousTangent)) > tolerance) return null;
    return tangentPreservingCircularArcCandidate(edge, movedPoint, otherPoint, previousTangent, previousCenter);
  }
  const previousTangentPair = sketchEdgePoints(previousSketch, tangentEdgeId, previousVertexMap);
  const translatedLineDelta = edgeTranslatedDelta(sketch, tangentEdgeId, vertexMap, previousVertexMap, tolerance);
  if (!translatedLineDelta && pointLineDistance(movedPoint, previousTangentPair.a, previousTangentPair.b) > tolerance) return null;
  return tangentPreservingCircularArcCandidate(
    edge,
    movedPoint,
    otherPoint,
    sketchEdgeTangentAtVertex(sketch, tangentEdgeId, movedEndpointId),
    previousCenter
  );
}

function tangentPreservingCircularArcAfterVertexMove(edge, sketch, previousSketch, vertexMap, previousVertexMap, movedVertexIds, drivingRadiusIds, previousCenter, tolerance) {
  if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC || drivingRadiusIds.has(edge.id)) return null;
  const movedEndpointId = movedVertexIds.has(edge.from) && !movedVertexIds.has(edge.to)
    ? edge.from
    : movedVertexIds.has(edge.to) && !movedVertexIds.has(edge.from)
      ? edge.to
      : null;
  if (!movedEndpointId) return null;
  const movedPoint = vertexMap.get(movedEndpointId);
  const otherPoint = vertexMap.get(movedEndpointId === edge.from ? edge.to : edge.from);
  if (!movedPoint || !otherPoint) return null;
  const tangentRelations = sketchRelations(sketch).filter((relation) => (
    relation.type === "tangent"
      && sketchRelationEdgeIds(relation).includes(edge.id)
      && sketchRelationEdgeIds(relation).some((edgeId) => edgeId !== edge.id && edgeEndpointIds(sketch, edgeId).includes(movedEndpointId))
  ));
  for (const tangentRelation of tangentRelations) {
    const candidate = tangentPreservingCircularArcForRelation(edge, sketch, previousSketch, vertexMap, previousVertexMap, movedEndpointId, movedPoint, otherPoint, tangentRelation, previousCenter, tolerance);
    if (candidate) return candidate;
  }
  return null;
}

function tangentPreservingCircularArcAfterTangentLineMove(edge, sketch, previousSketch, vertexMap, movedVertexIds, drivingRadiusIds, previousCenter) {
  if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC || drivingRadiusIds.has(edge.id)) return null;
  const relations = sketchRelations(sketch).filter((relation) => (
    relation.type === "tangent" && sketchRelationEdgeIds(relation).includes(edge.id)
  ));
  for (const relation of relations) {
    const tangentEdgeId = sketchRelationEdgeIds(relation).find((edgeId) => edgeId !== edge.id);
    const tangentEdge = edgeById(sketch, tangentEdgeId);
    const previousTangentEdge = edgeById(previousSketch, tangentEdgeId);
    if (!tangentEdge || !previousTangentEdge || tangentEdge.kind === SKETCH_EDGE_CIRCULAR_ARC) continue;
    const sharedEndpointId = [edge.from, edge.to].find((vertexId) => edgeEndpointIds(sketch, tangentEdgeId).includes(vertexId));
    if (!sharedEndpointId || movedVertexIds.has(sharedEndpointId)) continue;
    const tangentMoved = edgeEndpointIds(sketch, tangentEdgeId).some((vertexId) => vertexId !== sharedEndpointId && movedVertexIds.has(vertexId));
    if (!tangentMoved) continue;
    const sharedPoint = vertexMap.get(sharedEndpointId);
    const otherPoint = vertexMap.get(sharedEndpointId === edge.from ? edge.to : edge.from);
    if (!sharedPoint || !otherPoint) continue;
    const tangent = sketchEdgeTangentAtVertex(sketch, tangentEdgeId, sharedEndpointId);
    const candidate = tangentPreservingCircularArcCandidate(edge, sharedPoint, otherPoint, tangent, previousCenter);
    if (candidate) return candidate;
  }
  return null;
}

function tangentPreservingCircularArcAfterTangentArcMove(edge, sketch, previousSketch, vertexMap, movedVertexIds, drivingRadiusIds, previousCenter) {
  if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC || drivingRadiusIds.has(edge.id)) return null;
  const relations = sketchRelations(sketch).filter((relation) => (
    relation.type === "tangent" && sketchRelationEdgeIds(relation).includes(edge.id)
  ));
  for (const relation of relations) {
    const tangentEdgeId = sketchRelationEdgeIds(relation).find((edgeId) => edgeId !== edge.id);
    const tangentEdge = edgeById(sketch, tangentEdgeId);
    const previousTangentEdge = edgeById(previousSketch, tangentEdgeId);
    if (!tangentEdge || !previousTangentEdge || tangentEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC || previousTangentEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    const sharedEndpointId = [edge.from, edge.to].find((vertexId) => edgeEndpointIds(sketch, tangentEdgeId).includes(vertexId));
    if (!sharedEndpointId || movedVertexIds.has(sharedEndpointId)) continue;
    const tangentMoved = edgeEndpointIds(sketch, tangentEdgeId).some((vertexId) => vertexId !== sharedEndpointId && movedVertexIds.has(vertexId));
    if (!tangentMoved) continue;
    const sharedPoint = vertexMap.get(sharedEndpointId);
    const otherPoint = vertexMap.get(sharedEndpointId === edge.from ? edge.to : edge.from);
    if (!sharedPoint || !otherPoint) continue;
    const tangent = sketchEdgeTangentAtVertex(sketch, tangentEdgeId, sharedEndpointId);
    const candidate = tangentPreservingCircularArcCandidate(edge, sharedPoint, otherPoint, tangent, previousCenter);
    if (candidate) return candidate;
  }
  return null;
}

function movedSketchVertexIds(sketch, previousSketch) {
  const vertexMap = sketchVertexPointMap(sketch);
  const previousVertexMap = sketchVertexPointMap(previousSketch);
  const moved = new Set();
  for (const [vertexId, point] of vertexMap) {
    const previousPoint = previousVertexMap.get(vertexId);
    if (previousPoint && pointMoved(point, previousPoint)) moved.add(vertexId);
  }
  return moved;
}

function drivingRadiusEdgeIds(sketch) {
  return new Set(sketchRelations(sketch).filter(isDrivingRadiusRelation).map((relation) => relation.edgeId));
}

function adjustedCircularArcAfterVertexMove(edge, previousEdge, sketch, previousSketch, vertexMap, previousVertexMap, movedVertexIds, drivingRadiusIds) {
  if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC) return edge;
  const movedFrom = movedVertexIds.has(edge.from);
  const movedTo = movedVertexIds.has(edge.to);
  if (!previousEdge || previousEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) return edge;

  const a = vertexMap.get(edge.from);
  const b = vertexMap.get(edge.to);
  const previousA = previousVertexMap.get(edge.from);
  const previousB = previousVertexMap.get(edge.to);
  if (!a || !b || !previousA || !previousB) return edge;

  const previousCenter = vec2(previousEdge.center, `plate sketch edge ${edge.id} center`);
  const previousRadius = previousEdge.radius;
  if (!finitePositiveNumber(previousRadius)) fail(`plate sketch edge ${edge.id} radius must be positive`);
  const tolerance = Math.max(1e-6, previousRadius * 1e-6);

  if (!movedFrom && !movedTo) {
    const tangentLinePreserved = tangentPreservingCircularArcAfterTangentLineMove(edge, sketch, previousSketch, vertexMap, movedVertexIds, drivingRadiusIds, previousCenter);
    return tangentLinePreserved || edge;
  }

  const tangentPreserved = tangentPreservingCircularArcAfterVertexMove(edge, sketch, previousSketch, vertexMap, previousVertexMap, movedVertexIds, drivingRadiusIds, previousCenter, tolerance);
  if (tangentPreserved) return tangentPreserved;

  if (movedFrom && movedTo) {
    const fromDelta = pointDelta2(a, previousA);
    const toDelta = pointDelta2(b, previousB);
    if (sameSketchPoint(fromDelta, toDelta, tolerance)) {
      return {
        ...edge,
        center: pointAdd2(previousCenter, fromDelta),
        radius: previousRadius
      };
    }
  }

  let radius = previousRadius;
  const chordLength = pointDistance2(a, b);
  if (chordLength > radius * 2 + tolerance) {
    if (drivingRadiusIds.has(edge.id)) {
      fail(`plate sketch edge ${edge.id} radius is too small for moved endpoints`);
    }
    radius = chordLength / 2 + Math.max(1e-6, chordLength * 1e-9);
  }

  const candidates = circularArcCenterCandidates(a, b, radius);
  if (!candidates.length) fail(`plate sketch edge ${edge.id} cannot preserve circular-arc radius after vertex move`);
  return {
    ...edge,
    center: closestSketchPoint(candidates, previousCenter),
    radius
  };
}

function sketchWithAdjustedCircularArcsAfterVertexMove(sketch, previousSketch) {
  const movedVertexIds = movedSketchVertexIds(sketch, previousSketch);
  if (!movedVertexIds.size) return sketch;
  const vertexMap = sketchVertexPointMap(sketch);
  const previousVertexMap = sketchVertexPointMap(previousSketch);
  const previousEdgeMap = new Map(sketchRelationEdges(previousSketch).map((edge) => [edge.id, edge]));
  const drivingRadiusIds = drivingRadiusEdgeIds(previousSketch);
  const adjustEdge = (edge) => adjustedCircularArcAfterVertexMove(
    edge,
    previousEdgeMap.get(edge.id),
    sketch,
    previousSketch,
    vertexMap,
    previousVertexMap,
    movedVertexIds,
    drivingRadiusIds
  );
  const firstSketch = {
    ...sketch,
    edges: sketchEdges(sketch).map(adjustEdge),
    ...(sketch.constructionEdges !== undefined
      ? { constructionEdges: sketchConstructionEdges(sketch).map(adjustEdge) }
      : {})
  };
  const firstVertexMap = sketchVertexPointMap(firstSketch);
  const adjustTangentArcEdge = (edge) => {
    if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC || movedVertexIds.has(edge.from) || movedVertexIds.has(edge.to)) return edge;
    const previousEdge = previousEdgeMap.get(edge.id);
    if (!previousEdge || previousEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) return edge;
    const previousCenter = vec2(previousEdge.center, `plate sketch edge ${edge.id} center`);
    return tangentPreservingCircularArcAfterTangentArcMove(edge, firstSketch, previousSketch, firstVertexMap, movedVertexIds, drivingRadiusIds, previousCenter) || edge;
  };
  return {
    ...firstSketch,
    edges: sketchEdges(firstSketch).map(adjustTangentArcEdge),
    ...(firstSketch.constructionEdges !== undefined
      ? { constructionEdges: sketchConstructionEdges(firstSketch).map(adjustTangentArcEdge) }
      : {})
  };
}

function edgeCenterDelta(edge, previousEdge) {
  if (edge?.kind !== SKETCH_EDGE_CIRCULAR_ARC || previousEdge?.kind !== SKETCH_EDGE_CIRCULAR_ARC) return null;
  const center = vec2(edge.center, `plate sketch edge ${edge.id} center`);
  const previousCenter = vec2(previousEdge.center, `plate sketch edge ${previousEdge.id} center`);
  return pointDelta2(center, previousCenter);
}

function affectedConcentricEdgeIds(sketch, seedEdgeId) {
  const arcEdgeIds = new Set(sketchRelationEdges(sketch)
    .filter((edge) => edge.kind === SKETCH_EDGE_CIRCULAR_ARC)
    .map((edge) => edge.id));
  if (!arcEdgeIds.has(seedEdgeId)) fail(`plate sketch edge not found: ${seedEdgeId}`);
  const affected = new Set([seedEdgeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "concentric") continue;
      const ids = sketchRelationEdgeIds(relation).filter((id) => arcEdgeIds.has(id));
      if (!ids.some((id) => affected.has(id))) continue;
      for (const id of ids) {
        if (affected.has(id)) continue;
        affected.add(id);
        changed = true;
      }
    }
  }
  return affected;
}

function sketchWithConcentricAfterVertexMove(sketch, previousSketch) {
  if (!sketchRelations(sketch).some((relation) => relation.type === "concentric")) return sketch;
  const movedVertexIds = movedSketchVertexIds(sketch, previousSketch);
  if (!movedVertexIds.size) return sketch;
  const previousEdgeMap = new Map(sketchRelationEdges(previousSketch).map((edge) => [edge.id, edge]));
  const edgeMap = new Map(sketchRelationEdges(sketch).map((edge) => [edge.id, edge]));
  const previousVertexMap = sketchVertexPointMap(previousSketch);
  const vertexUpdates = new Map();
  const centerUpdates = new Map();
  const proposalTolerance = 1e-6;
  const setTranslatedVertex = (vertexId, delta, message) => {
    const previousPoint = previousVertexMap.get(vertexId);
    if (!previousPoint) return;
    const nextPoint = pointAdd2(previousPoint, delta);
    const existingPoint = vertexUpdates.get(vertexId);
    if (existingPoint && !sameSketchPoint(existingPoint, nextPoint, proposalTolerance)) {
      fail(message);
    }
    vertexUpdates.set(vertexId, nextPoint);
  };
  for (const edge of sketchRelationEdges(sketch)) {
    if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    if (!movedVertexIds.has(edge.from) && !movedVertexIds.has(edge.to)) continue;
    const previousEdge = previousEdgeMap.get(edge.id);
    const delta = edgeCenterDelta(edge, previousEdge);
    if (!delta || Math.hypot(delta[0], delta[1]) <= proposalTolerance) continue;
    for (const edgeId of affectedConcentricEdgeIds(sketch, edge.id)) {
      const affectedEdge = edgeMap.get(edgeId);
      const affectedPreviousEdge = previousEdgeMap.get(edgeId);
      if (!affectedEdge || !affectedPreviousEdge || affectedEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC || affectedPreviousEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
      const previousCenter = vec2(affectedPreviousEdge.center, `plate sketch edge ${affectedPreviousEdge.id} center`);
      const nextCenter = pointAdd2(previousCenter, delta);
      const existingCenter = centerUpdates.get(edgeId);
      if (existingCenter && !sameSketchPoint(existingCenter, nextCenter, proposalTolerance)) {
        fail(`concentric drag would move edge ${edgeId} center inconsistently`);
      }
      centerUpdates.set(edgeId, nextCenter);
      if (edgeId === edge.id) continue;
      for (const vertexId of [affectedEdge.from, affectedEdge.to]) {
        setTranslatedVertex(vertexId, delta, `concentric drag would move shared vertex ${vertexId} inconsistently`);
      }
      for (const relation of sketchRelations(sketch)) {
        if (relation.type !== "point-on-circle" || relation.edgeId !== edgeId) continue;
        setTranslatedVertex(
          relation.vertexId,
          delta,
          `concentric drag would move point-on-circle vertex ${relation.vertexId} inconsistently`
        );
      }
    }
  }
  if (!centerUpdates.size) return sketch;
  const vertices = sketchVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  const updateEdge = (edge) => (
    centerUpdates.has(edge.id)
      ? { ...edge, center: centerUpdates.get(edge.id) }
      : edge
  );
  return normalizeSketch({
    ...sketch,
    vertices,
    ...(sketch.constructionVertices !== undefined ? { constructionVertices } : {}),
    edges: sketchEdges(sketch).map(updateEdge),
    ...(sketch.constructionEdges !== undefined ? { constructionEdges: sketchConstructionEdges(sketch).map(updateEdge) } : {})
  });
}

function sketchWithEqualRadiusAfterVertexMove(sketch, previousSketch) {
  if (!sketchRelations(sketch).some((relation) => relation.type === "equal-radius")) return sketch;
  let nextSketch = sketch;
  const movedVertexIds = movedSketchVertexIds(sketch, previousSketch);
  if (!movedVertexIds.size) return sketch;
  const previousEdgeMap = new Map(sketchRelationEdges(previousSketch).map((edge) => [edge.id, edge]));
  for (const edge of sketchRelationEdges(sketch)) {
    if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    if (!movedVertexIds.has(edge.from) && !movedVertexIds.has(edge.to)) continue;
    const previousEdge = previousEdgeMap.get(edge.id);
    if (!previousEdge || previousEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    if (Math.abs(edge.radius - previousEdge.radius) <= Math.max(1e-6, Math.max(edge.radius, previousEdge.radius) * 1e-6)) continue;
    nextSketch = sketchWithDrivingArcRadius(nextSketch, edge.id, edge.radius);
  }
  return nextSketch;
}

function pointOnRadius(center, sourcePoint, radius) {
  const angle = Math.atan2(sourcePoint[1] - center[1], sourcePoint[0] - center[0]);
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + Math.sin(angle) * radius
  ];
}

function sketchWithPointOnCircleAfterArcMove(sketch, previousSketch, movedVertexIds = []) {
  const pointOnCircleRelations = sketchRelations(sketch).filter((relation) => relation.type === "point-on-circle");
  if (!pointOnCircleRelations.length) return sketch;
  const previousEdgeMap = new Map(sketchRelationEdges(previousSketch).map((edge) => [edge.id, edge]));
  const edgeMap = new Map(sketchRelationEdges(sketch).map((edge) => [edge.id, edge]));
  const movedArcIds = new Set();
  for (const edge of sketchRelationEdges(sketch)) {
    if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    const previousEdge = previousEdgeMap.get(edge.id);
    if (!previousEdge || previousEdge.kind !== SKETCH_EDGE_CIRCULAR_ARC) continue;
    const radiusTolerance = Math.max(1e-6, Math.max(edge.radius, previousEdge.radius) * 1e-6);
    const centerDelta = edgeCenterDelta(edge, previousEdge);
    if ((centerDelta && Math.hypot(centerDelta[0], centerDelta[1]) > radiusTolerance) || Math.abs(edge.radius - previousEdge.radius) > radiusTolerance) {
      movedArcIds.add(edge.id);
    }
  }
  if (!movedArcIds.size) return sketch;
  const movedVertexSet = new Set(movedVertexIds);
  const fixedVertexIds = sketchSolverFixedVertexIds(sketch);
  const vertexMap = sketchVertexPointMap(sketch);
  const vertexUpdates = new Map();
  for (const relation of pointOnCircleRelations) {
    if (!movedArcIds.has(relation.edgeId) || movedVertexSet.has(relation.vertexId) || fixedVertexIds.has(relation.vertexId)) continue;
    const edge = edgeMap.get(relation.edgeId);
    const point = vertexMap.get(relation.vertexId);
    if (!edge || edge.kind !== SKETCH_EDGE_CIRCULAR_ARC || !point) continue;
    const center = vec2(edge.center, `plate sketch edge ${edge.id} center`);
    const nextPoint = pointOnRadius(center, point, edge.radius);
    const tolerance = Math.max(1e-6, edge.radius * 1e-6);
    const existingPoint = vertexUpdates.get(relation.vertexId);
    if (existingPoint && !sameSketchPoint(existingPoint, nextPoint, tolerance)) {
      fail(`arc move would move point-on-circle vertex ${relation.vertexId} inconsistently`);
    }
    if (!sameSketchPoint(point, nextPoint, tolerance)) vertexUpdates.set(relation.vertexId, nextPoint);
  }
  if (!vertexUpdates.size) return sketch;
  const vertices = sketchVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  return normalizeSketch({
    ...sketch,
    vertices,
    ...(sketch.constructionVertices !== undefined ? { constructionVertices } : {})
  });
}

function sameCircleArc(first, second, tolerance) {
  if (first.kind !== SKETCH_EDGE_CIRCULAR_ARC || second.kind !== SKETCH_EDGE_CIRCULAR_ARC) return false;
  const firstCenter = vec2(first.center, `plate sketch edge ${first.id} center`);
  const secondCenter = vec2(second.center, `plate sketch edge ${second.id} center`);
  return sameSketchPoint(firstCenter, secondCenter, tolerance) && Math.abs(first.radius - second.radius) <= tolerance;
}

function affectedRadiusEditEdgeIds(sketch, seedEdgeId) {
  const arcEdges = sketchRelationEdges(sketch).filter((item) => item.kind === SKETCH_EDGE_CIRCULAR_ARC);
  const arcEdgeById = new Map(arcEdges.map((item) => [item.id, item]));
  if (!arcEdgeById.has(seedEdgeId)) fail(`plate sketch edge not found: ${seedEdgeId}`);
  const affected = new Set([seedEdgeId]);
  let changed = true;
  while (changed) {
    changed = false;
    const currentEdges = [...affected].map((id) => arcEdgeById.get(id)).filter(Boolean);
    for (const edge of arcEdges) {
      if (affected.has(edge.id)) continue;
      const matchesCircle = currentEdges.some((current) => (
        sameCircleArc(edge, current, Math.max(1e-6, Math.max(edge.radius, current.radius) * 1e-6))
      ));
      if (matchesCircle) {
        affected.add(edge.id);
        changed = true;
      }
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "equal-radius") continue;
      const ids = sketchRelationEdgeIds(relation).filter((id) => arcEdgeById.has(id));
      if (!ids.some((id) => affected.has(id))) continue;
      for (const id of ids) {
        if (affected.has(id)) continue;
        affected.add(id);
        changed = true;
      }
    }
  }
  return affected;
}

function sketchWithDrivingArcRadius(sketch, edgeId, radius) {
  const edge = edgeById(sketch, edgeId);
  if (!edge) fail(`plate sketch edge not found: ${edgeId}`);
  if (edge.kind !== SKETCH_EDGE_CIRCULAR_ARC) fail("plate sketch radius edits require a circular arc edge");
  const vertexMap = sketchVertexPointMap(sketch);
  const affectedEdgeIds = affectedRadiusEditEdgeIds(sketch, edgeId);
  const affectedEdges = sketchRelationEdges(sketch).filter((item) => affectedEdgeIds.has(item.id));
  if (!affectedEdges.length) fail(`plate sketch edge not found: ${edgeId}`);
  const vertexUpdates = new Map();
  const proposalTolerance = Math.max(1e-6, radius * 1e-6);
  for (const item of affectedEdges) {
    const itemCenter = vec2(item.center, `plate sketch edge ${item.id} center`);
    for (const vertexId of [item.from, item.to]) {
      const point = vertexMap.get(vertexId);
      if (!point) fail(`plate sketch edge ${item.id} has missing vertex ${vertexId}`);
      const nextPoint = pointOnRadius(itemCenter, point, radius);
      const current = vertexUpdates.get(vertexId);
      if (current && !sameSketchPoint(current, nextPoint, proposalTolerance)) {
        fail(`driving radius edit would move shared vertex ${vertexId} inconsistently`);
      }
      vertexUpdates.set(vertexId, nextPoint);
    }
  }
  for (const relation of sketchRelations(sketch)) {
    if (relation.type !== "point-on-circle" || !affectedEdgeIds.has(relation.edgeId)) continue;
    const item = edgeById(sketch, relation.edgeId);
    const point = vertexMap.get(relation.vertexId);
    if (!item || !point) continue;
    const itemCenter = vec2(item.center, `plate sketch edge ${item.id} center`);
    const nextPoint = pointOnRadius(itemCenter, point, radius);
    const current = vertexUpdates.get(relation.vertexId);
    if (current && !sameSketchPoint(current, nextPoint, proposalTolerance)) {
      fail(`driving radius edit would move point-on-circle vertex ${relation.vertexId} inconsistently`);
    }
    vertexUpdates.set(relation.vertexId, nextPoint);
  }
  const vertices = sketchVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => (
    vertexUpdates.has(vertex.id)
      ? { ...vertex, point: vertexUpdates.get(vertex.id) }
      : vertex
  ));
  const edges = sketchEdges(sketch).map((item) => (
    affectedEdgeIds.has(item.id)
      ? { ...item, radius }
      : item
  ));
  const constructionEdges = sketchConstructionEdges(sketch).map((item) => (
    affectedEdgeIds.has(item.id)
      ? { ...item, radius }
      : item
  ));
  const relations = sketchRelations(sketch).map((relation) => (
    relation.type === "radius" && affectedEdgeIds.has(relation.edgeId)
      ? { ...relation, value: radius }
      : relation
  ));
  return normalizeSketch({
    ...sketch,
    vertices,
    ...(sketch.constructionVertices !== undefined ? { constructionVertices } : {}),
    edges,
    ...(sketch.constructionEdges !== undefined ? { constructionEdges } : {}),
    relations
  });
}

export function setPlateSketchEdgeRadius(plate, edgeId, radius, options = {}) {
  if (!finitePositiveNumber(radius)) fail("plate sketch edge radius must be a positive number");
  const sketch = normalizeSketch(plate?.sketch);
  const edge = edgeById(sketch, edgeId);
  if (!edge) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const measuredRadius = measuredSketchEdgeRadius(sketch, edgeId);
  const mode = sketchDimensionMode(options.mode, "plate sketch edge radius mode");
  const existingRelation = sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "radius");
  const display = sketchRadiusDimensionDisplay(options.display ?? existingRelation?.display, "plate sketch edge radius display");
  const nextSketch = mode === "driving" ? sketchWithDrivingArcRadius(sketch, edgeId, radius) : sketch;
  return upsertSketchRelationFromHost({
    ...plate,
    sketch: nextSketch
  }, {
    type: "radius",
    edgeId,
    value: mode === "driven" ? measuredRadius : radius,
    mode,
    ...(display ? { display } : {})
  }, normalizePlate);
}

export function setPlateSketchEdgeRadiusMode(plate, edgeId, mode) {
  const nextMode = sketchDimensionMode(mode, "plate sketch edge radius mode");
  const sketch = normalizeSketch(plate?.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${plate?.id || "plate"}: sketch edge not found: ${edgeId}`);
  const existingRelation = sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "radius");
  return setPlateSketchEdgeRadius(plate, edgeId, measuredSketchEdgeRadius(sketch, edgeId), {
    mode: nextMode,
    ...(existingRelation?.display ? { display: existingRelation.display } : {})
  });
}

export function setSketchEdgeRadius(sketchObject, edgeId, radius, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  if (!finitePositiveNumber(radius)) fail("sketch edge radius must be a positive number");
  const sketch = normalizeSketch(sketchObject.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  const measuredRadius = measuredSketchEdgeRadius(sketch, edgeId);
  const mode = sketchDimensionMode(options.mode, "sketch edge radius mode");
  const existingRelation = sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "radius");
  const display = sketchRadiusDimensionDisplay(options.display ?? existingRelation?.display, "sketch edge radius display");
  const nextSketch = mode === "driving" ? sketchWithDrivingArcRadius(sketch, edgeId, radius) : sketch;
  return upsertSketchRelationFromHost({
    ...sketchObject,
    sketch: nextSketch
  }, {
    type: "radius",
    edgeId,
    value: mode === "driven" ? measuredRadius : radius,
    mode,
    ...(display ? { display } : {})
  }, normalizeSketchObject);
}

export function setSketchEdgeRadiusMode(sketchObject, edgeId, mode) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const nextMode = sketchDimensionMode(mode, "sketch edge radius mode");
  const sketch = normalizeSketch(sketchObject.sketch);
  if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  const existingRelation = sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "radius");
  return setSketchEdgeRadius(sketchObject, edgeId, measuredSketchEdgeRadius(sketch, edgeId), {
    mode: nextMode,
    ...(existingRelation?.display ? { display: existingRelation.display } : {})
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

export function setSketchEdgeAngle(sketchObject, edgeIds, angleDegrees, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const ids = requiredIdPair(edgeIds, "sketch edge angle edgeIds");
  const angle = finiteAngleDegrees(angleDegrees, "sketch edge angle");
  const sketch = normalizeSketch(sketchObject.sketch);
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  }
  const mode = sketchDimensionMode(options.mode, "sketch edge angle mode");
  const targetEdgeId = optionalTargetId(options.targetEdgeId, ids, "sketch edge angle targetEdgeId");
  const relationPatch = {
    type: "angle",
    edgeIds: ids,
    value: angle,
    mode,
    ...(targetEdgeId ? { targetEdgeId } : {})
  };
  const nextSketchObject = upsertSketchRelationFromHost({
    ...sketchObject,
    sketch
  }, relationPatch, normalizeSketchObject);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "angle", edgeIds: ids });
    const relation = sketchRelations(nextSketchObject.sketch).find((item) => item.type === "angle" && sketchRelationKey(item) === key);
    const health = relation ? sketchRelationHealth(nextSketchObject.sketch)[relation.id] : null;
    if (health?.status === "redundant") {
      return setSketchEdgeAngle(nextSketchObject, ids, measuredSketchEdgeAngle(nextSketchObject.sketch, ids), { mode: "driven" });
    }
  }
  return nextSketchObject;
}

export function setSketchEdgeAngleMode(sketchObject, edgeIds, mode) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const nextMode = sketchDimensionMode(mode, "sketch edge angle mode");
  const sketch = normalizeSketch(sketchObject.sketch);
  const ids = requiredIdPair(edgeIds, "sketch edge angle edgeIds");
  for (const edgeId of ids) {
    if (!edgeById(sketch, edgeId)) fail(`${sketchObject.id || "sketch"}: sketch edge not found: ${edgeId}`);
  }
  return setSketchEdgeAngle(sketchObject, ids, measuredSketchEdgeAngle(sketch, ids), {
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

export function setSketchPointDistance(sketchObject, vertexIds, distance, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const ids = requiredIdPair(vertexIds, "sketch point distance vertexIds");
  if (!finitePositiveNumber(distance)) fail("sketch point distance must be a positive number");
  const sketch = normalizeSketch(sketchObject.sketch);
  const sketchVertexIds = new Set(sketchRelationVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${sketchObject.id || "sketch"}: sketch vertex not found: ${vertexId}`);
  }
  const mode = sketchDimensionMode(options.mode, "sketch point distance mode");
  const targetVertexId = optionalTargetId(options.targetVertexId, ids, "sketch point distance targetVertexId");
  const nextSketchObject = upsertSketchRelationFromHost({
    ...sketchObject,
    sketch
  }, {
    type: "distance",
    vertexIds: ids,
    value: distance,
    mode,
    ...(targetVertexId ? { targetVertexId } : {})
  }, normalizeSketchObject);
  if (mode === "driving" && options.allowRedundantDriving !== true) {
    const key = sketchRelationKey({ type: "distance", vertexIds: ids });
    const relation = sketchRelations(nextSketchObject.sketch).find((item) => item.type === "distance" && sketchRelationKey(item) === key);
    const health = relation ? sketchRelationHealth(nextSketchObject.sketch)[relation.id] : null;
    if (health?.status === "redundant") {
      return setSketchPointDistance(nextSketchObject, ids, measuredSketchPointDistance(nextSketchObject.sketch, ids), { mode: "driven" });
    }
  }
  return nextSketchObject;
}

export function setSketchPointDistanceMode(sketchObject, vertexIds, mode) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const nextMode = sketchDimensionMode(mode, "sketch point distance mode");
  const sketch = normalizeSketch(sketchObject.sketch);
  const ids = requiredIdPair(vertexIds, "sketch point distance vertexIds");
  const sketchVertexIds = new Set(sketchRelationVertices(sketch).map((vertex) => vertex.id));
  for (const vertexId of ids) {
    if (!sketchVertexIds.has(vertexId)) fail(`${sketchObject.id || "sketch"}: sketch vertex not found: ${vertexId}`);
  }
  return setSketchPointDistance(sketchObject, ids, measuredSketchPointDistance(sketch, ids), {
    mode: nextMode,
    allowRedundantDriving: nextMode === "driving"
  });
}

export function setSketchVertex(sketchObject, vertexId, point) {
  return setSketchVertices(sketchObject, [{ vertexId, point }]);
}

export function setSketchVertices(sketchObject, vertexPoints) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const updates = sketchVertexPointUpdates(vertexPoints);
  if (!updates.size) return normalizeSketchObject(sketchObject);
  const sketch = normalizeSketch(sketchObject.sketch);
  const nextPoints = new Map([...updates.entries()].map(([vertexId, point]) => [vertexId, vec2(point, `sketch vertex ${vertexId}`)]));
  const found = new Set();
  const changedVertexIds = [];
  const vertices = sketchVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (pointMoved(point, vec2(vertex.point, `sketch vertex ${vertex.id}`))) changedVertexIds.push(vertex.id);
    return { ...vertex, point };
  });
  const constructionVertices = sketchConstructionVertices(sketch).map((vertex) => {
    if (!nextPoints.has(vertex.id)) return vertex;
    found.add(vertex.id);
    const point = nextPoints.get(vertex.id);
    if (pointMoved(point, vec2(vertex.point, `sketch construction vertex ${vertex.id}`))) changedVertexIds.push(vertex.id);
    return { ...vertex, point };
  });
  for (const vertexId of nextPoints.keys()) {
    if (!found.has(vertexId)) fail(`${sketchObject.id}: sketch vertex not found: ${vertexId}`);
  }
  if (!changedVertexIds.length) return normalizeSketchObject(sketchObject);
  const adjustedMovedSketch = sketchWithAdjustedCircularArcsAfterVertexMove({ ...sketch, vertices, constructionVertices }, sketch);
  const concentricMovedSketch = sketchWithConcentricAfterVertexMove(adjustedMovedSketch, sketch);
  const movedSketch = sketchWithEqualRadiusAfterVertexMove(concentricMovedSketch, sketch);
  const pointOnCircleMovedSketch = sketchWithPointOnCircleAfterArcMove(movedSketch, sketch, changedVertexIds);
  const editableSketch = relaxRelationsForDirectVertexMove(pointOnCircleMovedSketch, changedVertexIds);
  const solvedSketch = solveSketchRelationsAfterVertexChange(editableSketch, changedVertexIds);
  const adjustedSketch = sketchWithAdjustedCircularArcsAfterVertexMove(solvedSketch, pointOnCircleMovedSketch);
  assertSketchRelationsSatisfied(adjustedSketch);
  return normalizeSketchObject({ ...sketchObject, sketch: adjustedSketch });
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
