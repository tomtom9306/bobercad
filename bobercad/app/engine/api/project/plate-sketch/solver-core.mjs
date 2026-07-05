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
  measuredSketchEdgeRadius,
  measuredSketchPointDistance,
  normalizeSketch,
  pointMoved,
  requiredIdPair,
  sketchAngleDeltaDegrees,
  sketchDimensionMode,
  sketchEdgeAngleFromVectors,
  sketchEdgeCenterPoint,
  sketchEdgeIsCircularArc,
  sketchEdgePoints,
  sketchEdgeTangentAtVertex,
  sketchRelationVector,
  sketchVertexPointMap,
  vec2,
  withSketchRelations
} from "./sketch-geometry-and-relations.mjs";

export function sketchSolverFixedVertexIds(sketch) {
  const fixed = new Set();
  for (const relation of sketchRelations(sketch)) {
    if (relation.type !== "fixed") continue;
    if (relation.vertexId) fixed.add(relation.vertexId);
    for (const edgeId of sketchRelationEdgeIds(relation)) {
      for (const vertexId of edgeEndpointIds(sketch, edgeId)) fixed.add(vertexId);
    }
  }
  return fixed;
}

export function solveSketchRelationsAfterVertexChange(sketch, changedVertexIds = []) {
  const changed = new Set(uniqueTruthy(changedVertexIds));
  const drivers = new Set(changed);
  const fixed = sketchSolverFixedVertexIds(sketch);
  for (const vertexId of changed) {
    if (fixed.has(vertexId)) fail(`plate sketch vertex ${vertexId} is fixed`);
  }

  const vertices = sketchRelationVertices(sketch).map((vertex) => ({ ...vertex, point: vec2(vertex.point, `plate sketch vertex ${vertex.id}`) }));
  const vertexMap = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const point = (vertexId) => vertexMap.get(vertexId)?.point || null;
  const setPoint = (vertexId, nextPoint) => {
    if (fixed.has(vertexId)) return false;
    const vertex = vertexMap.get(vertexId);
    if (!vertex) return false;
    vertex.point = vec2(nextPoint, `plate sketch vertex ${vertexId}`);
    changed.add(vertexId);
    return true;
  };
  const edgeVector = (edgeId) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const a = point(from);
    const b = point(to);
    return a && b ? [b[0] - a[0], b[1] - a[1]] : null;
  };
  const edgeLength = (edgeId) => {
    const vector = edgeVector(edgeId);
    return vector ? Math.hypot(vector[0], vector[1]) : 0;
  };
  const edgeChanged = (edgeId) => edgeEndpointIds(sketch, edgeId).some((vertexId) => changed.has(vertexId));
  const vertexConstraintWeight = (vertexId, currentEdgeId) => {
    if (fixed.has(vertexId)) return Infinity;
    let weight = 0;
    for (const relation of sketchRelations(sketch)) {
      for (const edgeId of sketchRelationEdgeIds(relation)) {
        if (edgeId === currentEdgeId) continue;
        if (edgeEndpointIds(sketch, edgeId).includes(vertexId)) weight += 1;
      }
      if (sketchRelationVertexIds(relation).includes(vertexId)) weight += 1;
    }
    return weight;
  };
  const edgeFreeEndpoint = (edgeId) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const candidates = [
      { moving: to, anchor: from, changed: changed.has(to), weight: vertexConstraintWeight(to, edgeId), order: 0 },
      { moving: from, anchor: to, changed: changed.has(from), weight: vertexConstraintWeight(from, edgeId), order: 1 }
    ].filter((candidate) => candidate.moving && candidate.anchor && Number.isFinite(candidate.weight));
    if (!candidates.length) return null;
    const pool = candidates.some((candidate) => candidate.changed)
      ? candidates.filter((candidate) => candidate.changed)
      : candidates;
    pool.sort((a, b) => a.weight - b.weight || a.order - b.order);
    return { moving: pool[0].moving, anchor: pool[0].anchor };
  };
  const addAxisLock = (locks, coord, value, label) => {
    if (!Number.isFinite(value)) return;
    if (locks.has(coord) && Math.abs(locks.get(coord) - value) > EPSILON) {
      fail(`plate sketch ${label} has conflicting axis relations`);
    }
    locks.set(coord, value);
  };
  const axisLocksForVertex = (vertexId) => {
    const locks = new Map();
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal" || relation.type === "vertical") {
        const coord = relation.type === "horizontal" ? 1 : 0;
        const [from, to] = edgeEndpointIds(sketch, relation.edgeId);
        if (from !== vertexId && to !== vertexId) continue;
        const other = point(from === vertexId ? to : from);
        addAxisLock(locks, coord, other?.[coord], vertexId);
      }
      if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
        const coord = relation.type === "horizontal-points" ? 1 : 0;
        const ids = sketchRelationVertexIds(relation);
        if (!ids.includes(vertexId)) continue;
        const otherId = ids.find((id) => id !== vertexId);
        const other = point(otherId);
        addAxisLock(locks, coord, other?.[coord], vertexId);
      }
    }
    return locks;
  };
  const constrainedPointOnLineProjection = (vertexId, vertexPoint, lineStart, lineVector, fallbackProjected) => {
    const locks = axisLocksForVertex(vertexId);
    if (!locks.size) return fallbackProjected;
    if (locks.has(0) && locks.has(1)) return [locks.get(0), locks.get(1)];
    const coord = locks.has(0) ? 0 : 1;
    const lockedValue = locks.get(coord);
    const denom = lineVector[coord];
    if (Math.abs(denom) > EPSILON) {
      const station = (lockedValue - lineStart[coord]) / denom;
      return [lineStart[0] + lineVector[0] * station, lineStart[1] + lineVector[1] * station];
    }
    if (Math.abs(lineStart[coord] - lockedValue) <= EPSILON) {
      const next = [...fallbackProjected];
      next[coord] = lockedValue;
      return next;
    }
    return vertexPoint;
  };
  const setAxisRelation = (edgeId, axis) => {
    const [from, to] = edgeEndpointIds(sketch, edgeId);
    const a = point(from);
    const b = point(to);
    if (!a || !b) return;
    const coord = axis === "z" ? 1 : 0;
    const target = fixed.has(from)
      ? a[coord]
      : fixed.has(to)
        ? b[coord]
        : drivers.has(from) && !drivers.has(to)
          ? a[coord]
          : drivers.has(to) && !drivers.has(from)
            ? b[coord]
            : changed.has(from) && !changed.has(to)
              ? a[coord]
              : changed.has(to) && !changed.has(from)
                ? b[coord]
                : (a[coord] + b[coord]) / 2;
    if (fixed.has(from) && Math.abs(a[coord] - target) > EPSILON) fail(`fixed vertex ${from} conflicts with ${axis === "z" ? "horizontal" : "vertical"} relation`);
    if (fixed.has(to) && Math.abs(b[coord] - target) > EPSILON) fail(`fixed vertex ${to} conflicts with ${axis === "z" ? "horizontal" : "vertical"} relation`);
    if (!fixed.has(from) && Math.abs(a[coord] - target) > EPSILON) {
      const next = [...a];
      next[coord] = target;
      setPoint(from, next);
    }
    if (!fixed.has(to) && Math.abs(b[coord] - target) > EPSILON) {
      const next = [...b];
      next[coord] = target;
      setPoint(to, next);
    }
  };
  const setPointAxisRelation = (vertexIds, axis) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second) return;
    const coord = axis === "z" ? 1 : 0;
    const target = fixed.has(firstId)
      ? first[coord]
      : fixed.has(secondId)
        ? second[coord]
        : drivers.has(firstId) && !drivers.has(secondId)
          ? first[coord]
          : drivers.has(secondId) && !drivers.has(firstId)
            ? second[coord]
            : changed.has(firstId) && !changed.has(secondId)
              ? first[coord]
              : changed.has(secondId) && !changed.has(firstId)
                ? second[coord]
                : (first[coord] + second[coord]) / 2;
    if (fixed.has(firstId) && Math.abs(first[coord] - target) > EPSILON) fail(`fixed vertex ${firstId} conflicts with point alignment relation`);
    if (fixed.has(secondId) && Math.abs(second[coord] - target) > EPSILON) fail(`fixed vertex ${secondId} conflicts with point alignment relation`);
    if (!fixed.has(firstId) && Math.abs(first[coord] - target) > EPSILON) {
      const next = [...first];
      next[coord] = target;
      setPoint(firstId, next);
    }
    if (!fixed.has(secondId) && Math.abs(second[coord] - target) > EPSILON) {
      const next = [...second];
      next[coord] = target;
      setPoint(secondId, next);
    }
  };
  const applyCoincidentRelation = (vertexIds) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second) return;
    const target = fixed.has(firstId)
      ? first
      : fixed.has(secondId)
        ? second
        : drivers.has(firstId) && !drivers.has(secondId)
          ? first
          : drivers.has(secondId) && !drivers.has(firstId)
            ? second
            : changed.has(firstId) && !changed.has(secondId)
              ? first
              : changed.has(secondId) && !changed.has(firstId)
                ? second
                : [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    if (fixed.has(firstId) && Math.hypot(first[0] - target[0], first[1] - target[1]) > EPSILON) fail(`fixed vertex ${firstId} conflicts with coincident relation`);
    if (fixed.has(secondId) && Math.hypot(second[0] - target[0], second[1] - target[1]) > EPSILON) fail(`fixed vertex ${secondId} conflicts with coincident relation`);
    if (!fixed.has(firstId) && Math.hypot(first[0] - target[0], first[1] - target[1]) > EPSILON) setPoint(firstId, target);
    if (!fixed.has(secondId) && Math.hypot(second[0] - target[0], second[1] - target[1]) > EPSILON) setPoint(secondId, target);
  };
  const applyDirectionalRelation = (targetEdgeId, referenceEdgeId, relationType) => {
    const target = edgeVector(targetEdgeId);
    const reference = edgeVector(referenceEdgeId);
    const length = edgeLength(targetEdgeId);
    if (!target || !reference || length <= EPSILON) return;
    const referenceLength = Math.hypot(reference[0], reference[1]);
    if (referenceLength <= EPSILON) return;
    let unit = [reference[0] / referenceLength, reference[1] / referenceLength];
    if (relationType === "perpendicular") unit = [-unit[1], unit[0]];
    if (unit[0] * target[0] + unit[1] * target[1] < 0) unit = [-unit[0], -unit[1]];
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    const sign = endpoint.moving === edgeById(sketch, targetEdgeId)?.to ? 1 : -1;
    setPoint(endpoint.moving, [anchor[0] + unit[0] * length * sign, anchor[1] + unit[1] * length * sign]);
  };
  const rotateUnit = (unit, radians) => {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [unit[0] * cos - unit[1] * sin, unit[0] * sin + unit[1] * cos];
  };
  const applyAngleRelation = (targetEdgeId, referenceEdgeId, angleDegrees) => {
    const target = edgeVector(targetEdgeId);
    const reference = edgeVector(referenceEdgeId);
    const length = edgeLength(targetEdgeId);
    if (!target || !reference || length <= EPSILON) return;
    const targetLength = Math.hypot(target[0], target[1]);
    const referenceLength = Math.hypot(reference[0], reference[1]);
    if (targetLength <= EPSILON || referenceLength <= EPSILON) return;
    const targetUnit = [target[0] / targetLength, target[1] / targetLength];
    const referenceUnit = [reference[0] / referenceLength, reference[1] / referenceLength];
    const radians = finiteAngleDegrees(angleDegrees) * RAD_PER_DEG;
    const candidates = [
      rotateUnit(referenceUnit, radians),
      rotateUnit(referenceUnit, -radians)
    ];
    let unit = candidates[0];
    if (dot2(candidates[1], targetUnit) > dot2(unit, targetUnit)) unit = candidates[1];
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    const sign = endpoint.moving === edgeById(sketch, targetEdgeId)?.to ? 1 : -1;
    setPoint(endpoint.moving, [anchor[0] + unit[0] * length * sign, anchor[1] + unit[1] * length * sign]);
  };
  const applyCollinearRelation = (targetEdgeId, referenceEdgeId) => {
    const targetEdge = edgeById(sketch, targetEdgeId);
    const referenceEdge = edgeById(sketch, referenceEdgeId);
    if (!targetEdge || !referenceEdge) return;
    const referenceVector = edgeVector(referenceEdgeId);
    const targetVector = edgeVector(targetEdgeId);
    const targetLength = edgeLength(targetEdgeId);
    const referenceStart = point(referenceEdge.from);
    const targetStart = point(targetEdge.from);
    const targetEnd = point(targetEdge.to);
    if (!referenceVector || !targetVector || !referenceStart || !targetStart || !targetEnd || targetLength <= EPSILON) return;
    const referenceLength = Math.hypot(referenceVector[0], referenceVector[1]);
    if (referenceLength <= EPSILON) return;
    let unit = [referenceVector[0] / referenceLength, referenceVector[1] / referenceLength];
    if (unit[0] * targetVector[0] + unit[1] * targetVector[1] < 0) unit = [-unit[0], -unit[1]];
    const projectedPoint = (item) => {
      const station = dot2([item[0] - referenceStart[0], item[1] - referenceStart[1]], unit);
      return [referenceStart[0] + unit[0] * station, referenceStart[1] + unit[1] * station];
    };
    if (fixed.has(targetEdge.from) && !fixed.has(targetEdge.to)) {
      const anchor = point(targetEdge.from);
      setPoint(targetEdge.to, [anchor[0] + unit[0] * targetLength, anchor[1] + unit[1] * targetLength]);
      return;
    }
    if (fixed.has(targetEdge.to) && !fixed.has(targetEdge.from)) {
      const anchor = point(targetEdge.to);
      setPoint(targetEdge.from, [anchor[0] - unit[0] * targetLength, anchor[1] - unit[1] * targetLength]);
      return;
    }
    if (fixed.has(targetEdge.from) && fixed.has(targetEdge.to)) return;
    const midpointOnLine = projectedPoint([(targetStart[0] + targetEnd[0]) / 2, (targetStart[1] + targetEnd[1]) / 2]);
    setPoint(targetEdge.from, [midpointOnLine[0] - unit[0] * targetLength / 2, midpointOnLine[1] - unit[1] * targetLength / 2]);
    setPoint(targetEdge.to, [midpointOnLine[0] + unit[0] * targetLength / 2, midpointOnLine[1] + unit[1] * targetLength / 2]);
  };
  const applyPointOnLineRelation = (vertexId, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const vertexPoint = point(vertexId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const edgeVectorValue = edgeVector(edgeId);
    if (!edge || !vertexPoint || !from || !to || !edgeVectorValue) return;
    const length = Math.hypot(edgeVectorValue[0], edgeVectorValue[1]);
    if (length <= EPSILON) return;
    const unit = [edgeVectorValue[0] / length, edgeVectorValue[1] / length];
    const station = dot2([vertexPoint[0] - from[0], vertexPoint[1] - from[1]], unit);
    const projected = [from[0] + unit[0] * station, from[1] + unit[1] * station];
    const constrainedProjected = fixed.has(vertexId)
      ? projected
      : constrainedPointOnLineProjection(vertexId, vertexPoint, from, edgeVectorValue, projected);
    const targetPoint = constrainedProjected || projected;
    const offset = [vertexPoint[0] - targetPoint[0], vertexPoint[1] - targetPoint[1]];
    if (Math.hypot(offset[0], offset[1]) <= EPSILON) return;
    if (!fixed.has(vertexId)) {
      setPoint(vertexId, targetPoint);
      return;
    }
    if (fixed.has(edge.from) && fixed.has(edge.to)) return;
    if (!fixed.has(edge.from)) setPoint(edge.from, [from[0] + offset[0], from[1] + offset[1]]);
    if (!fixed.has(edge.to)) setPoint(edge.to, [to[0] + offset[0], to[1] + offset[1]]);
  };
  const applyPointOnCircleRelation = (vertexId, edgeId) => {
    const vertexPoint = point(vertexId);
    if (!vertexPoint || fixed.has(vertexId) || !sketchEdgeIsCircularArc(sketch, edgeId)) return;
    const center = sketchEdgeCenterPoint(sketch, edgeId);
    const radius = measuredSketchEdgeRadius(sketch, edgeId);
    const vector = [vertexPoint[0] - center[0], vertexPoint[1] - center[1]];
    const distance = Math.hypot(vector[0], vector[1]);
    const unit = distance > EPSILON ? [vector[0] / distance, vector[1] / distance] : [1, 0];
    const projected = [center[0] + unit[0] * radius, center[1] + unit[1] * radius];
    setPoint(vertexId, projected);
  };
  const applyMidpointRelation = (vertexId, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const vertexPoint = point(vertexId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    if (!edge || !vertexPoint || !from || !to) return;
    const midpointPoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const offset = [vertexPoint[0] - midpointPoint[0], vertexPoint[1] - midpointPoint[1]];
    if (Math.hypot(offset[0], offset[1]) <= EPSILON) return;
    if (!fixed.has(vertexId)) {
      setPoint(vertexId, midpointPoint);
      return;
    }
    if (fixed.has(edge.from) && fixed.has(edge.to)) return;
    if (fixed.has(edge.from) && !fixed.has(edge.to)) {
      setPoint(edge.to, [vertexPoint[0] * 2 - from[0], vertexPoint[1] * 2 - from[1]]);
      return;
    }
    if (fixed.has(edge.to) && !fixed.has(edge.from)) {
      setPoint(edge.from, [vertexPoint[0] * 2 - to[0], vertexPoint[1] * 2 - to[1]]);
      return;
    }
    setPoint(edge.from, [from[0] + offset[0], from[1] + offset[1]]);
    setPoint(edge.to, [to[0] + offset[0], to[1] + offset[1]]);
  };
  const reflectedPointAcrossEdge = (item, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const axis = edgeVector(edgeId);
    if (!edge || !from || !to || !axis) return null;
    const length = Math.hypot(axis[0], axis[1]);
    if (length <= EPSILON) return null;
    const unit = [axis[0] / length, axis[1] / length];
    const station = dot2([item[0] - from[0], item[1] - from[1]], unit);
    const projected = [from[0] + unit[0] * station, from[1] + unit[1] * station];
    return [projected[0] * 2 - item[0], projected[1] * 2 - item[1]];
  };
  const alignSymmetryEdgeToFixedPoints = (first, second, edgeId) => {
    const edge = edgeById(sketch, edgeId);
    const from = edge ? point(edge.from) : null;
    const to = edge ? point(edge.to) : null;
    const axis = edgeVector(edgeId);
    if (!edge || !from || !to || !axis || fixed.has(edge.from) || fixed.has(edge.to)) return;
    const pair = [second[0] - first[0], second[1] - first[1]];
    const pairLength = Math.hypot(pair[0], pair[1]);
    const edgeLengthValue = Math.hypot(axis[0], axis[1]);
    if (pairLength <= EPSILON || edgeLengthValue <= EPSILON) return;
    let unit = [-pair[1] / pairLength, pair[0] / pairLength];
    if (unit[0] * axis[0] + unit[1] * axis[1] < 0) unit = [-unit[0], -unit[1]];
    const center = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    setPoint(edge.from, [center[0] - unit[0] * edgeLengthValue / 2, center[1] - unit[1] * edgeLengthValue / 2]);
    setPoint(edge.to, [center[0] + unit[0] * edgeLengthValue / 2, center[1] + unit[1] * edgeLengthValue / 2]);
  };
  const applySymmetricRelation = (vertexIds, edgeId) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second || !edgeById(sketch, edgeId)) return;
    if (fixed.has(firstId) && fixed.has(secondId)) {
      alignSymmetryEdgeToFixedPoints(first, second, edgeId);
      return;
    }
    if (fixed.has(firstId) && !fixed.has(secondId)) {
      const reflected = reflectedPointAcrossEdge(first, edgeId);
      if (reflected) setPoint(secondId, reflected);
      return;
    }
    if (fixed.has(secondId) && !fixed.has(firstId)) {
      const reflected = reflectedPointAcrossEdge(second, edgeId);
      if (reflected) setPoint(firstId, reflected);
      return;
    }
    const useFirstAsDriver = drivers.has(firstId) || changed.has(firstId) || (!drivers.has(secondId) && !changed.has(secondId));
    const source = useFirstAsDriver ? first : second;
    const targetId = useFirstAsDriver ? secondId : firstId;
    const reflected = reflectedPointAcrossEdge(source, edgeId);
    if (reflected) setPoint(targetId, reflected);
  };
  const applyEqualLengthRelation = (targetEdgeId, referenceEdgeId) => {
    const targetLength = edgeLength(referenceEdgeId);
    applyLengthRelation(targetEdgeId, targetLength);
  };
  const applyLengthRelation = (targetEdgeId, targetLength) => {
    const vector = edgeVector(targetEdgeId);
    const currentLength = vector ? Math.hypot(vector[0], vector[1]) : 0;
    if (targetLength <= EPSILON || currentLength <= EPSILON) return;
    const endpoint = edgeFreeEndpoint(targetEdgeId);
    if (!endpoint) return;
    const anchor = point(endpoint.anchor);
    if (!anchor) return;
    let unit = [vector[0] / currentLength, vector[1] / currentLength];
    if (endpoint.moving === edgeById(sketch, targetEdgeId)?.from) unit = [-unit[0], -unit[1]];
    setPoint(endpoint.moving, [anchor[0] + unit[0] * targetLength, anchor[1] + unit[1] * targetLength]);
  };
  const applyDistanceRelation = (vertexIds, targetDistance) => {
    const [firstId, secondId] = uniqueTruthy(vertexIds);
    const first = point(firstId);
    const second = point(secondId);
    if (!first || !second || targetDistance <= EPSILON) return;
    let movingId = null;
    let anchorId = null;
    if (fixed.has(firstId) && !fixed.has(secondId)) {
      movingId = secondId;
      anchorId = firstId;
    } else if (fixed.has(secondId) && !fixed.has(firstId)) {
      movingId = firstId;
      anchorId = secondId;
    } else if (fixed.has(firstId) && fixed.has(secondId)) {
      return;
    } else if ((drivers.has(firstId) || changed.has(firstId)) && !drivers.has(secondId) && !changed.has(secondId)) {
      movingId = firstId;
      anchorId = secondId;
    } else if ((drivers.has(secondId) || changed.has(secondId)) && !drivers.has(firstId) && !changed.has(firstId)) {
      movingId = secondId;
      anchorId = firstId;
    } else {
      movingId = secondId;
      anchorId = firstId;
    }
    const moving = point(movingId);
    const anchor = point(anchorId);
    if (!moving || !anchor) return;
    const vector = [moving[0] - anchor[0], moving[1] - anchor[1]];
    const currentDistance = Math.hypot(vector[0], vector[1]);
    const unit = currentDistance > EPSILON
      ? [vector[0] / currentDistance, vector[1] / currentDistance]
      : [1, 0];
    setPoint(movingId, [anchor[0] + unit[0] * targetDistance, anchor[1] + unit[1] * targetDistance]);
  };

  for (let iteration = 0; iteration < 4; iteration += 1) {
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal") setAxisRelation(relation.edgeId, "z");
      if (relation.type === "vertical") setAxisRelation(relation.edgeId, "y");
      if (relation.type === "horizontal-points") setPointAxisRelation(relation.vertexIds, "z");
      if (relation.type === "vertical-points") setPointAxisRelation(relation.vertexIds, "y");
      if (relation.type === "coincident") applyCoincidentRelation(relation.vertexIds);
      if (relation.type === "point-on-line") applyPointOnLineRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "point-on-circle") applyPointOnCircleRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "midpoint") applyMidpointRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "symmetric") applySymmetricRelation(relation.vertexIds, relation.edgeId);
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "parallel" && relation.type !== "perpendicular" && relation.type !== "collinear") continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) {
        if (relation.type === "collinear") applyCollinearRelation(firstEdgeId, secondEdgeId);
        else applyDirectionalRelation(firstEdgeId, secondEdgeId, relation.type);
      } else if (secondChanged && !firstChanged) {
        if (relation.type === "collinear") applyCollinearRelation(secondEdgeId, firstEdgeId);
        else applyDirectionalRelation(secondEdgeId, firstEdgeId, relation.type);
      }
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type !== "equal-length") continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) applyEqualLengthRelation(firstEdgeId, secondEdgeId);
      else if (secondChanged && !firstChanged) applyEqualLengthRelation(secondEdgeId, firstEdgeId);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingAngleRelation(relation)) continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const firstChanged = edgeChanged(firstEdgeId);
      const secondChanged = edgeChanged(secondEdgeId);
      if (firstChanged && !secondChanged) applyAngleRelation(firstEdgeId, secondEdgeId, relation.value);
      else if (secondChanged && !firstChanged) applyAngleRelation(secondEdgeId, firstEdgeId, relation.value);
      else applyAngleRelation(secondEdgeId, firstEdgeId, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingLengthRelation(relation)) continue;
      applyLengthRelation(relation.edgeId, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (!isDrivingDistanceRelation(relation)) continue;
      applyDistanceRelation(relation.vertexIds, relation.value);
    }
    for (const relation of sketchRelations(sketch)) {
      if (relation.type === "horizontal") setAxisRelation(relation.edgeId, "z");
      if (relation.type === "vertical") setAxisRelation(relation.edgeId, "y");
      if (relation.type === "horizontal-points") setPointAxisRelation(relation.vertexIds, "z");
      if (relation.type === "vertical-points") setPointAxisRelation(relation.vertexIds, "y");
      if (relation.type === "coincident") applyCoincidentRelation(relation.vertexIds);
      if (relation.type === "point-on-line") applyPointOnLineRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "point-on-circle") applyPointOnCircleRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "midpoint") applyMidpointRelation(relation.vertexId, relation.edgeId);
      if (relation.type === "symmetric") applySymmetricRelation(relation.vertexIds, relation.edgeId);
    }
  }

  const outlineVertexIds = new Set(sketchVertices(sketch).map((vertex) => vertex.id));
  const solvedVertexMap = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  return {
    ...sketch,
    vertices: vertices.filter((vertex) => outlineVertexIds.has(vertex.id)),
    constructionVertices: sketchConstructionVertices(sketch).map((vertex) => solvedVertexMap.get(vertex.id) || vertex)
  };
}

function relationTouchesVertices(sketch, relation, vertexIds) {
  const ids = new Set(vertexIds);
  if (!ids.size) return false;
  if (sketchRelationVertexIds(relation).some((vertexId) => ids.has(vertexId))) return true;
  return sketchRelationEdgeIds(relation).some((edgeId) => edgeEndpointIds(sketch, edgeId).some((vertexId) => ids.has(vertexId)));
}

function sharedEdgeVertexIds(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  const first = edgeById(sketch, firstEdgeId);
  const second = edgeById(sketch, secondEdgeId);
  if (!first || !second) return [];
  return [first.from, first.to].filter((vertexId) => vertexId === second.from || vertexId === second.to);
}

function sketchTangentResidual(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  const shared = sharedEdgeVertexIds(sketch, edgeIds);
  if (!shared.length) return Infinity;
  const vertexId = shared[0];
  const first = sketchEdgeTangentAtVertex(sketch, firstEdgeId, vertexId);
  const second = sketchEdgeTangentAtVertex(sketch, secondEdgeId, vertexId);
  return Math.abs(Math.abs(first[0] * second[0] + first[1] * second[1]) - 1);
}

function sketchEqualRadiusResidual(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  try {
    const first = measuredSketchEdgeRadius(sketch, firstEdgeId);
    const second = measuredSketchEdgeRadius(sketch, secondEdgeId);
    return Math.abs(first - second);
  } catch {
    return Infinity;
  }
}

function sketchConcentricResidual(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  try {
    const first = sketchEdgeCenterPoint(sketch, firstEdgeId);
    const second = sketchEdgeCenterPoint(sketch, secondEdgeId);
    if (!first || !second) return Infinity;
    return Math.hypot(second[0] - first[0], second[1] - first[1]);
  } catch {
    return Infinity;
  }
}

function shouldRelaxForDirectVertexMove(sketch, relation, changedVertexIds) {
  if (relation.type === "equal-length") return relationTouchesVertices(sketch, relation, changedVertexIds);
  if (relation.type === "tangent") {
    return relationTouchesVertices(sketch, relation, changedVertexIds) && sketchTangentResidual(sketch, relation.edgeIds) > 1e-6;
  }
  if (relation.type === "equal-radius") {
    return relationTouchesVertices(sketch, relation, changedVertexIds) && sketchEqualRadiusResidual(sketch, relation.edgeIds) > 1e-6;
  }
  if (relation.type === "concentric") {
    return relationTouchesVertices(sketch, relation, changedVertexIds) && sketchConcentricResidual(sketch, relation.edgeIds) > 1e-6;
  }
  return false;
}

export function relaxRelationsForDirectVertexMove(sketch, changedVertexIds = []) {
  if (!changedVertexIds.length) return sketch;
  const relations = sketchRelations(sketch).filter((relation) => {
    return !shouldRelaxForDirectVertexMove(sketch, relation, changedVertexIds);
  });
  return withSketchRelations(sketch, relations);
}


