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
  isDrivingRadiusRelation,
  isSketchAngleRelationDriven,
  isSketchDistanceRelationDriven,
  isSketchLengthRelationDriven,
  isSketchRadiusRelationDriven,
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

function sketchCollinearDistance(first, second) {
  const offset = [second.a[0] - first.a[0], second.a[1] - first.a[1]];
  return Math.abs(first.delta[0] * offset[1] - first.delta[1] * offset[0]) / Math.max(first.length, EPSILON);
}

function sketchPointOnLineDistance(sketch, vertexId, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const vertex = vertexMap.get(vertexId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  const offset = [vertex?.[0] - edge.a[0], vertex?.[1] - edge.a[1]];
  return Math.abs(edge.delta[0] * offset[1] - edge.delta[1] * offset[0]) / Math.max(edge.length, EPSILON);
}

function sketchPointOnCircleDistance(sketch, vertexId, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  if (!sketchEdgeIsCircularArc(sketch, edgeId)) return Infinity;
  const vertex = vertexMap.get(vertexId);
  if (!vertex) return Infinity;
  const center = sketchEdgeCenterPoint(sketch, edgeId);
  const radius = measuredSketchEdgeRadius(sketch, edgeId);
  return Math.abs(Math.hypot(vertex[0] - center[0], vertex[1] - center[1]) - radius);
}

function sketchMidpointDistance(sketch, vertexId, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const vertex = vertexMap.get(vertexId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  const midpointPoint = [(edge.a[0] + edge.b[0]) / 2, (edge.a[1] + edge.b[1]) / 2];
  return vertex ? Math.hypot(vertex[0] - midpointPoint[0], vertex[1] - midpointPoint[1]) : Infinity;
}

function sketchSymmetricResidual(sketch, vertexIds, edgeId, vertexMap = sketchVertexPointMap(sketch)) {
  const [firstId, secondId] = sketchRelationVertexIds({ vertexIds });
  const first = vertexMap.get(firstId);
  const second = vertexMap.get(secondId);
  const edge = sketchRelationVector(sketch, edgeId, vertexMap);
  if (!first || !second) return Infinity;
  const pair = [second[0] - first[0], second[1] - first[1]];
  const pairMidpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
  const midpointOffset = [pairMidpoint[0] - edge.a[0], pairMidpoint[1] - edge.a[1]];
  const midpointDistance = Math.abs(edge.delta[0] * midpointOffset[1] - edge.delta[1] * midpointOffset[0]) / Math.max(edge.length, EPSILON);
  const perpendicularResidual = Math.abs(edge.unit[0] * pair[0] + edge.unit[1] * pair[1]);
  return Math.max(midpointDistance, perpendicularResidual);
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

function sketchArcCenterDistance(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  if (!sketchEdgeIsCircularArc(sketch, firstEdgeId) || !sketchEdgeIsCircularArc(sketch, secondEdgeId)) return Infinity;
  const first = sketchEdgeCenterPoint(sketch, firstEdgeId);
  const second = sketchEdgeCenterPoint(sketch, secondEdgeId);
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function sketchArcRadiusDelta(sketch, edgeIds) {
  const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds({ edgeIds });
  if (!sketchEdgeIsCircularArc(sketch, firstEdgeId) || !sketchEdgeIsCircularArc(sketch, secondEdgeId)) return Infinity;
  return Math.abs(measuredSketchEdgeRadius(sketch, firstEdgeId) - measuredSketchEdgeRadius(sketch, secondEdgeId));
}

export function assertSketchRelationsSatisfied(sketch) {
  const vertexMap = sketchVertexPointMap(sketch);
  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "fixed") continue;
    if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const first = vertexMap.get(firstId);
      const second = vertexMap.get(secondId);
      if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
      const coord = relation.type === "horizontal-points" ? 1 : 0;
      if (Math.abs(first[coord] - second[coord]) > 1e-6) {
        fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${firstId}/${secondId}`);
      }
      continue;
    }
    if (relation.type === "coincident") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const first = vertexMap.get(firstId);
      const second = vertexMap.get(secondId);
      if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
      if (Math.hypot(first[0] - second[0], first[1] - second[1]) > 1e-6) {
        fail(`Coincident relation is not satisfied on ${firstId}/${secondId}`);
      }
      continue;
    }
    if (relation.type === "point-on-line") {
      if (sketchPointOnLineDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Point on line relation is not satisfied on ${relation.vertexId}/${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "point-on-circle") {
      if (sketchPointOnCircleDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Point on circle relation is not satisfied on ${relation.vertexId}/${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "midpoint") {
      if (sketchMidpointDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Midpoint relation is not satisfied on ${relation.vertexId}/${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "symmetric") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      if (sketchSymmetricResidual(sketch, relation.vertexIds, relation.edgeId, vertexMap) > 1e-6) {
        fail(`Symmetric relation is not satisfied on ${firstId}/${secondId} about ${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "distance") {
      if (!isDrivingDistanceRelation(relation)) continue;
      const actual = measuredSketchPointDistance(sketch, relation.vertexIds, vertexMap);
      if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
        fail(`Distance relation is not satisfied on ${sketchRelationVertexIds(relation).join("/")}`);
      }
      continue;
    }
    if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
      if (relation.type === "length" && !isDrivingLengthRelation(relation)) continue;
      const edge = sketchRelationVector(sketch, relation.edgeId, vertexMap);
      if (relation.type === "length") {
        if (Math.abs(edge.length - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
          fail(`Length relation is not satisfied on ${relation.edgeId}`);
        }
        continue;
      }
      const distance = relation.type === "horizontal"
        ? Math.abs(edge.delta[1])
        : Math.abs(edge.delta[0]);
      if (distance > 1e-6) fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${relation.edgeId}`);
      continue;
    }
    if (relation.type === "angle") {
      if (!isDrivingAngleRelation(relation)) continue;
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
      const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
      const actual = sketchEdgeAngleFromVectors(first, second);
      if (sketchAngleDeltaDegrees(actual, relation.value) > 1e-6) {
        fail(`Angle relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      continue;
    }
    if (relation.type === "radius") {
      if (!isDrivingRadiusRelation(relation)) continue;
      const actual = measuredSketchEdgeRadius(sketch, relation.edgeId);
      if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
        fail(`Radius relation is not satisfied on ${relation.edgeId}`);
      }
      continue;
    }
    if (relation.type === "tangent") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      if (sketchTangentResidual(sketch, relation.edgeIds) > 1e-6) {
        fail(`Tangent relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      continue;
    }
    if (relation.type === "concentric") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      if (sketchArcCenterDistance(sketch, relation.edgeIds) > 1e-6) {
        fail(`Concentric relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      continue;
    }
    if (relation.type === "equal-radius") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      if (sketchArcRadiusDelta(sketch, relation.edgeIds) > 1e-6) {
        fail(`Equal radius relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      continue;
    }
    if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
      const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
      if ((relation.type === "parallel" || relation.type === "collinear") && Math.abs(Math.abs(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]) - 1) > 1e-6) {
        fail(`${sketchRelationLabel(relation)} relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "collinear" && sketchCollinearDistance(first, second) > 1e-6) {
        fail(`Collinear relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "perpendicular" && Math.abs(first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1]) > 1e-6) {
        fail(`Perpendicular relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
      if (relation.type === "equal-length" && Math.abs(first.length - second.length) > Math.max(1e-6, Math.max(first.length, second.length) * 1e-9)) {
        fail(`Equal length relation is not satisfied on ${firstEdgeId}/${secondEdgeId}`);
      }
    }
  }
}

export function sketchRelationSatisfactionIssues(sketch) {
  const vertexMap = sketchVertexPointMap(sketch);
  const issues = [];
  const pushIssue = (relation, message) => {
    issues.push({
      severity: "error",
      code: `sketch-relation-${relation?.type || "unknown"}-unsatisfied`,
      relationId: relation?.id || null,
      message
    });
  };
  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "fixed") continue;
    try {
      if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        const first = vertexMap.get(firstId);
        const second = vertexMap.get(secondId);
        if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
        const coord = relation.type === "horizontal-points" ? 1 : 0;
        if (Math.abs(first[coord] - second[coord]) > 1e-6) {
          pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${firstId}/${secondId}.`);
        }
        continue;
      }
      if (relation.type === "coincident") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        const first = vertexMap.get(firstId);
        const second = vertexMap.get(secondId);
        if (!first || !second) fail(`${sketchRelationLabel(relation)} relation references missing vertex`);
        if (Math.hypot(first[0] - second[0], first[1] - second[1]) > 1e-6) {
          pushIssue(relation, `Coincident relation is not satisfied on ${firstId}/${secondId}.`);
        }
        continue;
      }
      if (relation.type === "point-on-line") {
        if (sketchPointOnLineDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Point on line relation is not satisfied on ${relation.vertexId}/${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "point-on-circle") {
        if (sketchPointOnCircleDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Point on circle relation is not satisfied on ${relation.vertexId}/${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "midpoint") {
        if (sketchMidpointDistance(sketch, relation.vertexId, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Midpoint relation is not satisfied on ${relation.vertexId}/${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "symmetric") {
        const [firstId, secondId] = sketchRelationVertexIds(relation);
        if (sketchSymmetricResidual(sketch, relation.vertexIds, relation.edgeId, vertexMap) > 1e-6) {
          pushIssue(relation, `Symmetric relation is not satisfied on ${firstId}/${secondId} about ${relation.edgeId}.`);
        }
        continue;
      }
      if (relation.type === "distance") {
        if (!isDrivingDistanceRelation(relation)) continue;
        const actual = measuredSketchPointDistance(sketch, relation.vertexIds, vertexMap);
        if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
          pushIssue(relation, `Distance relation on ${sketchRelationVertexIds(relation).join("/")} expects ${relation.value} mm but reads ${actual.toFixed(3)} mm.`);
        }
        continue;
      }
      if (relation.type === "horizontal" || relation.type === "vertical" || relation.type === "length") {
        if (relation.type === "length" && !isDrivingLengthRelation(relation)) continue;
        const edge = sketchRelationVector(sketch, relation.edgeId, vertexMap);
        if (relation.type === "length") {
          if (Math.abs(edge.length - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
            pushIssue(relation, `Length relation on ${relation.edgeId} expects ${relation.value} mm but reads ${edge.length.toFixed(3)} mm.`);
          }
          continue;
        }
        const distance = relation.type === "horizontal"
          ? Math.abs(edge.delta[1])
          : Math.abs(edge.delta[0]);
        if (distance > 1e-6) pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${relation.edgeId}.`);
        continue;
      }
      if (relation.type === "angle") {
        if (!isDrivingAngleRelation(relation)) continue;
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
        const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
        const actual = sketchEdgeAngleFromVectors(first, second);
        if (sketchAngleDeltaDegrees(actual, relation.value) > 1e-6) {
          pushIssue(relation, `Angle relation on ${firstEdgeId}/${secondEdgeId} expects ${relation.value} deg but reads ${actual.toFixed(3)} deg.`);
        }
        continue;
      }
      if (relation.type === "radius") {
        if (!isDrivingRadiusRelation(relation)) continue;
        const actual = measuredSketchEdgeRadius(sketch, relation.edgeId);
        if (Math.abs(actual - relation.value) > Math.max(1e-6, relation.value * 1e-9)) {
          pushIssue(relation, `Radius relation on ${relation.edgeId} expects ${relation.value} mm but reads ${actual.toFixed(3)} mm.`);
        }
        continue;
      }
      if (relation.type === "tangent") {
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        if (sketchTangentResidual(sketch, relation.edgeIds) > 1e-6) {
          pushIssue(relation, `Tangent relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        continue;
      }
      if (relation.type === "concentric") {
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        if (sketchArcCenterDistance(sketch, relation.edgeIds) > 1e-6) {
          pushIssue(relation, `Concentric relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        continue;
      }
      if (relation.type === "equal-radius") {
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        if (sketchArcRadiusDelta(sketch, relation.edgeIds) > 1e-6) {
          pushIssue(relation, `Equal radius relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        continue;
      }
      if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
        const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
        const first = sketchRelationVector(sketch, firstEdgeId, vertexMap);
        const second = sketchRelationVector(sketch, secondEdgeId, vertexMap);
        const dot = first.unit[0] * second.unit[0] + first.unit[1] * second.unit[1];
        if ((relation.type === "parallel" || relation.type === "collinear") && Math.abs(Math.abs(dot) - 1) > 1e-6) {
          pushIssue(relation, `${sketchRelationLabel(relation)} relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "collinear" && sketchCollinearDistance(first, second) > 1e-6) {
          pushIssue(relation, `Collinear relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "perpendicular" && Math.abs(dot) > 1e-6) {
          pushIssue(relation, `Perpendicular relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
        if (relation.type === "equal-length" && Math.abs(first.length - second.length) > Math.max(1e-6, Math.max(first.length, second.length) * 1e-9)) {
          pushIssue(relation, `Equal length relation is not satisfied on ${firstEdgeId}/${secondEdgeId}.`);
        }
      }
    } catch (error) {
      pushIssue(relation, error?.message || `${sketchRelationLabel(relation)} relation could not be evaluated.`);
    }
  }
  return issues;
}

export function sketchConstraintSystem(sketch) {
  const vertices = sketchRelationVertices(sketch);
  const vertexIndex = new Map(vertices.map((vertex, index) => [vertex.id, index]));
  const edges = new Map(sketchRelationEdges(sketch).map((edge) => [edge.id, edge]));
  const baseCoords = vertices.flatMap((vertex) => vec2(vertex.point, `plate sketch vertex ${vertex.id}`));
  const pointAt = (coords, vertexId) => {
    const index = vertexIndex.get(vertexId);
    if (index === undefined) fail(`plate sketch vertex not found: ${vertexId}`);
    return [coords[index * 2], coords[index * 2 + 1]];
  };
  const edgePointsAt = (coords, edgeId) => {
    const edge = edges.get(edgeId);
    if (!edge) fail(`plate sketch edge not found: ${edgeId}`);
    return {
      edge,
      a: pointAt(coords, edge.from),
      b: pointAt(coords, edge.to)
    };
  };
  const edgeVectorAt = (coords, edgeId) => {
    const { a, b } = edgePointsAt(coords, edgeId);
    return [b[0] - a[0], b[1] - a[1]];
  };
  const edgeLengthAt = (coords, edgeId) => {
    const delta = edgeVectorAt(coords, edgeId);
    return Math.hypot(delta[0], delta[1]);
  };
  const equations = [];
  const pushEquation = (relation, label, fn) => {
    equations.push({
      relation,
      relationId: relation?.id || null,
      type: relation?.type || "unknown",
      label,
      fn
    });
  };

  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "horizontal") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeVectorAt(coords, relation.edgeId)[1]);
    } else if (relation.type === "vertical") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeVectorAt(coords, relation.edgeId)[0]);
    } else if (relation.type === "horizontal-points" || relation.type === "vertical-points") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      const coord = relation.type === "horizontal-points" ? 1 : 0;
      pushEquation(relation, sketchRelationLabel(relation), (coords) => pointAt(coords, firstId)[coord] - pointAt(coords, secondId)[coord]);
    } else if (relation.type === "coincident") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => pointAt(coords, firstId)[0] - pointAt(coords, secondId)[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => pointAt(coords, firstId)[1] - pointAt(coords, secondId)[1]);
    } else if (relation.type === "point-on-line") {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        const edgeVector = [edgePoints.b[0] - edgePoints.a[0], edgePoints.b[1] - edgePoints.a[1]];
        const offset = [point[0] - edgePoints.a[0], point[1] - edgePoints.a[1]];
        return edgeVector[0] * offset[1] - edgeVector[1] * offset[0];
      });
    } else if (relation.type === "point-on-circle") {
      const edge = edges.get(relation.edgeId);
      if (!edge || edge.kind !== "circular-arc") fail("point-on-circle relation requires a circular arc edge");
      const center = vec2(edge.center, `plate sketch edge ${relation.edgeId} center`);
      const radius = finitePositiveNumber(edge.radius) ? edge.radius : measuredSketchEdgeRadius(sketch, relation.edgeId);
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const point = pointAt(coords, relation.vertexId);
        return Math.hypot(point[0] - center[0], point[1] - center[1]) - radius;
      });
    } else if (relation.type === "midpoint") {
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        return point[0] - (edgePoints.a[0] + edgePoints.b[0]) / 2;
      });
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => {
        const point = pointAt(coords, relation.vertexId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        return point[1] - (edgePoints.a[1] + edgePoints.b[1]) / 2;
      });
    } else if (relation.type === "symmetric") {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, `${sketchRelationLabel(relation)} midpoint`, (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        const edgePoints = edgePointsAt(coords, relation.edgeId);
        const edgeVector = [edgePoints.b[0] - edgePoints.a[0], edgePoints.b[1] - edgePoints.a[1]];
        const pairMidpoint = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
        const offset = [pairMidpoint[0] - edgePoints.a[0], pairMidpoint[1] - edgePoints.a[1]];
        return edgeVector[0] * offset[1] - edgeVector[1] * offset[0];
      });
      pushEquation(relation, `${sketchRelationLabel(relation)} perpendicular`, (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        const edgeVector = edgeVectorAt(coords, relation.edgeId);
        const pair = [second[0] - first[0], second[1] - first[1]];
        return edgeVector[0] * pair[0] + edgeVector[1] * pair[1];
      });
    } else if (isDrivingLengthRelation(relation)) {
      pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeLengthAt(coords, relation.edgeId) - relation.value);
    } else if (isDrivingDistanceRelation(relation)) {
      const [firstId, secondId] = sketchRelationVertexIds(relation);
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const first = pointAt(coords, firstId);
        const second = pointAt(coords, secondId);
        return Math.hypot(second[0] - first[0], second[1] - first[1]) - relation.value;
      });
    } else if (isDrivingAngleRelation(relation)) {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      const targetCos = Math.cos(finiteAngleDegrees(relation.value) * RAD_PER_DEG);
      pushEquation(relation, sketchRelationLabel(relation), (coords) => {
        const first = edgeVectorAt(coords, firstEdgeId);
        const second = edgeVectorAt(coords, secondEdgeId);
        const firstLength = Math.hypot(first[0], first[1]);
        const secondLength = Math.hypot(second[0], second[1]);
        return first[0] * second[0] + first[1] * second[1] - firstLength * secondLength * targetCos;
      });
    } else if (relation.type === "fixed" && relation.vertexId) {
      const target = pointAt(baseCoords, relation.vertexId);
      pushEquation(relation, `${sketchRelationLabel(relation)} Y`, (coords) => pointAt(coords, relation.vertexId)[0] - target[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} Z`, (coords) => pointAt(coords, relation.vertexId)[1] - target[1]);
    } else if (relation.type === "fixed" && relation.edgeId) {
      const edge = edges.get(relation.edgeId);
      const fromTarget = pointAt(baseCoords, edge.from);
      const toTarget = pointAt(baseCoords, edge.to);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.from} Y`, (coords) => pointAt(coords, edge.from)[0] - fromTarget[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.from} Z`, (coords) => pointAt(coords, edge.from)[1] - fromTarget[1]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.to} Y`, (coords) => pointAt(coords, edge.to)[0] - toTarget[0]);
      pushEquation(relation, `${sketchRelationLabel(relation)} ${edge.to} Z`, (coords) => pointAt(coords, edge.to)[1] - toTarget[1]);
    } else if (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear" || relation.type === "equal-length") {
      const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
      if (relation.type === "equal-length") {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => edgeLengthAt(coords, firstEdgeId) - edgeLengthAt(coords, secondEdgeId));
      } else if (relation.type === "parallel" || relation.type === "collinear") {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => {
          const first = edgeVectorAt(coords, firstEdgeId);
          const second = edgeVectorAt(coords, secondEdgeId);
          return first[0] * second[1] - first[1] * second[0];
        });
        if (relation.type === "collinear") {
          pushEquation(relation, `${sketchRelationLabel(relation)} offset`, (coords) => {
            const first = edgeVectorAt(coords, firstEdgeId);
            const firstPoints = edgePointsAt(coords, firstEdgeId);
            const secondPoints = edgePointsAt(coords, secondEdgeId);
            const offset = [secondPoints.a[0] - firstPoints.a[0], secondPoints.a[1] - firstPoints.a[1]];
            return first[0] * offset[1] - first[1] * offset[0];
          });
        }
      } else {
        pushEquation(relation, sketchRelationLabel(relation), (coords) => {
          const first = edgeVectorAt(coords, firstEdgeId);
          const second = edgeVectorAt(coords, secondEdgeId);
          return first[0] * second[0] + first[1] * second[1];
        });
      }
    }
  }

  return {
    vertices,
    edges: [...edges.values()],
    vertexIndex,
    baseCoords,
    variableCount: vertices.length * 2,
    equations
  };
}

export function constraintRows(system, equations = system.equations) {
  const rows = [];
  const epsilon = 1e-4;
  for (const equation of equations) {
    const row = [];
    for (let column = 0; column < system.variableCount; column += 1) {
      const plus = [...system.baseCoords];
      const minus = [...system.baseCoords];
      plus[column] += epsilon;
      minus[column] -= epsilon;
      row[column] = (equation.fn(plus) - equation.fn(minus)) / (2 * epsilon);
    }
    const length = Math.hypot(...row);
    if (length > 1e-9) rows.push(row.map((value) => value / length));
  }
  return rows;
}

export function matrixRank(rows, columnCount, tolerance = 1e-7) {
  const matrix = rows.map((row) => [...row]);
  let rank = 0;
  for (let column = 0; column < columnCount && rank < matrix.length; column += 1) {
    let pivot = rank;
    for (let row = rank + 1; row < matrix.length; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    }
    if (Math.abs(matrix[pivot][column]) <= tolerance) continue;
    [matrix[rank], matrix[pivot]] = [matrix[pivot], matrix[rank]];
    const divisor = matrix[rank][column];
    for (let col = column; col < columnCount; col += 1) matrix[rank][col] /= divisor;
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === rank) continue;
      const factor = matrix[row][column];
      if (Math.abs(factor) <= tolerance) continue;
      for (let col = column; col < columnCount; col += 1) matrix[row][col] -= factor * matrix[rank][col];
    }
    rank += 1;
  }
  return rank;
}

function sketchDefinitionLabel(status) {
  if (status === "under-defined") return "Under-defined";
  if (status === "fully-defined") return "Fully-defined";
  if (status === "over-defined") return "Over-defined";
  if (status === "conflicted") return "Conflicted";
  return "Invalid";
}

function sketchDefinitionSeverity(status) {
  if (status === "fully-defined") return "ok";
  if (status === "under-defined") return "warning";
  return "error";
}

function fixedCoordinateRows(system, vertexIds) {
  const rows = [];
  for (const vertexId of uniqueTruthy(vertexIds)) {
    const index = system.vertexIndex.get(vertexId);
    if (index === undefined) continue;
    const yRow = new Array(system.variableCount).fill(0);
    const zRow = new Array(system.variableCount).fill(0);
    yRow[index * 2] = 1;
    zRow[index * 2 + 1] = 1;
    rows.push(yRow, zRow);
  }
  return rows;
}

function entityDefinitionFromRank(system, baseRows, baseRank, vertexIds) {
  const rows = fixedCoordinateRows(system, vertexIds);
  if (!rows.length) return "invalid";
  const rankWithFixedEntity = matrixRank([...baseRows, ...rows], system.variableCount);
  return rankWithFixedEntity > baseRank ? "under-defined" : "fully-defined";
}

function underDefinedEntityIds(system, baseRows, baseRank) {
  const vertices = system.vertices
    .filter((vertex) => entityDefinitionFromRank(system, baseRows, baseRank, [vertex.id]) === "under-defined")
    .map((vertex) => vertex.id);
  const edges = system.edges
    .filter((edge) => entityDefinitionFromRank(system, baseRows, baseRank, [edge.from, edge.to]) === "under-defined")
    .map((edge) => edge.id);
  return { vertices, edges };
}

function formatEntityList(ids, limit = 6) {
  if (!ids.length) return "none";
  const shown = ids.slice(0, limit);
  return `${shown.join(", ")}${ids.length > shown.length ? ` +${ids.length - shown.length} more` : ""}`;
}

export function sketchEntityDefinitionStatus(sketch) {
  try {
    const normalized = normalizeSketch(sketch);
    const definition = sketchDefinitionStatus(normalized);
    const system = sketchConstraintSystem(normalized);
    const vertices = {};
    const edges = {};
    if (definition.status === "conflicted" || definition.status === "over-defined" || definition.status === "invalid") {
      for (const vertex of system.vertices) vertices[vertex.id] = definition.status;
      for (const edge of system.edges) edges[edge.id] = definition.status;
      return { definition, vertices, edges };
    }
    const baseRows = constraintRows(system);
    const baseRank = matrixRank(baseRows, system.variableCount);
    for (const vertex of system.vertices) {
      vertices[vertex.id] = entityDefinitionFromRank(system, baseRows, baseRank, [vertex.id]);
    }
    for (const edge of system.edges) {
      edges[edge.id] = entityDefinitionFromRank(system, baseRows, baseRank, [edge.from, edge.to]);
    }
    return { definition, vertices, edges };
  } catch (error) {
    const definition = {
      status: "invalid",
      label: sketchDefinitionLabel("invalid"),
      severity: "error",
      diagnostics: [{
        severity: "error",
        code: "sketch-invalid",
        message: error?.message || "Sketch could not be evaluated."
      }]
    };
    return { definition, vertices: {}, edges: {} };
  }
}

export function plateSketchEntityDefinitionStatus(plate) {
  return sketchEntityDefinitionStatus(plate?.sketch);
}

function relationHealthRecord(status, message = "") {
  const severity = status === "ok"
    ? "ok"
    : status === "driven"
      ? "info"
      : status === "redundant"
        ? "warning"
        : "error";
  return {
    status,
    severity,
    ...(message ? { message } : {})
  };
}

export function sketchRelationHealth(sketch) {
  let relations = sketchRelations(sketch);
  try {
    const normalized = normalizeSketch(sketch);
    relations = sketchRelations(normalized);
    const health = Object.fromEntries(relations.map((relation) => [
      relation.id,
      isSketchLengthRelationDriven(relation) || isSketchAngleRelationDriven(relation) || isSketchDistanceRelationDriven(relation) || isSketchRadiusRelationDriven(relation)
        ? relationHealthRecord("driven", `Driven reference dimension; it reports the current ${relation.type} and does not solve sketch geometry.`)
        : relationHealthRecord("ok")
    ]));
    for (const issue of sketchRelationSatisfactionIssues(normalized)) {
      if (!issue.relationId) continue;
      health[issue.relationId] = relationHealthRecord("conflicted", issue.message);
    }

    const system = sketchConstraintSystem(normalized);
    for (const relation of relations) {
      if (health[relation.id]?.status === "conflicted") continue;
      if (relation.type !== "fixed" && !isDrivingDimensionRelation(relation)) continue;
      const relationEquations = system.equations.filter((equation) => equation.relationId === relation.id);
      if (!relationEquations.length) continue;
      const withoutEquations = system.equations.filter((equation) => equation.relationId !== relation.id);
      const withoutRows = constraintRows(system, withoutEquations);
      const withoutRank = matrixRank(withoutRows, system.variableCount);
      const withRows = [...withoutRows, ...constraintRows(system, relationEquations)];
      const withRank = matrixRank(withRows, system.variableCount);
      if (withRank === withoutRank) {
        health[relation.id] = relationHealthRecord("redundant", `${sketchRelationLabel(relation)} relation is redundant.`);
      }
    }
    return health;
  } catch (error) {
    const message = error?.message || "Sketch relation health could not be evaluated.";
    return Object.fromEntries(relations
      .filter((relation) => typeof relation?.id === "string" && relation.id)
      .map((relation) => [relation.id, relationHealthRecord("conflicted", message)]));
  }
}

export function plateSketchRelationHealth(plate) {
  return sketchRelationHealth(plate?.sketch);
}

export function sketchDefinitionStatus(sketch) {
  try {
    const normalized = normalizeSketch(sketch);
    const system = sketchConstraintSystem(normalized);
    const rows = constraintRows(system);
    const rank = matrixRank(rows, system.variableCount);
    const freeDof = Math.max(0, system.variableCount - rank);
    const underDefined = freeDof > 0 ? underDefinedEntityIds(system, rows, rank) : { vertices: [], edges: [] };
    const issues = sketchRelationSatisfactionIssues(normalized);
    const drivingEquations = system.equations.filter((equation) => equation.type === "length" || equation.type === "angle" || equation.type === "distance" || equation.type === "fixed");
    const baseEquations = system.equations.filter((equation) => equation.type !== "length" && equation.type !== "angle" && equation.type !== "distance" && equation.type !== "fixed");
    const baseRank = matrixRank(constraintRows(system, baseEquations), system.variableCount);
    const drivenRankContribution = Math.max(0, rank - baseRank);
    const redundantDrivenEquations = Math.max(0, drivingEquations.length - drivenRankContribution);
    const redundantConstraintEstimate = Math.max(0, system.equations.length - rank);
    const diagnostics = [...issues];
    let status = "fully-defined";
    if (issues.length) {
      status = "conflicted";
    } else if (redundantDrivenEquations > 0) {
      status = "over-defined";
      diagnostics.push({
        severity: "error",
        code: "sketch-over-defined",
        message: `${redundantDrivenEquations} fixed or driving dimension equation${redundantDrivenEquations === 1 ? " is" : "s are"} redundant. Remove the extra fixed relation or convert the extra driving dimension to driven/reference.`
      });
      if (freeDof > 0) {
        diagnostics.push({
          severity: "warning",
          code: "sketch-under-defined",
          message: `${freeDof} sketch degree${freeDof === 1 ? "" : "s"} of freedom also remain after the redundant constraint.`
        });
        diagnostics.push({
          severity: "warning",
          code: "sketch-under-defined-entities",
          message: `Under-defined entities: vertices ${formatEntityList(underDefined.vertices)}; edges ${formatEntityList(underDefined.edges)}.`,
          vertexIds: underDefined.vertices,
          edgeIds: underDefined.edges
        });
      }
    } else if (freeDof > 0) {
      status = "under-defined";
      diagnostics.push({
        severity: "warning",
        code: "sketch-under-defined",
        message: `${freeDof} sketch degree${freeDof === 1 ? "" : "s"} of freedom remain. Add fixed relations or driving dimensions.`
      });
      diagnostics.push({
        severity: "warning",
        code: "sketch-under-defined-entities",
        message: `Under-defined entities: vertices ${formatEntityList(underDefined.vertices)}; edges ${formatEntityList(underDefined.edges)}.`,
        vertexIds: underDefined.vertices,
        edgeIds: underDefined.edges
      });
    }
    if (!issues.length && redundantConstraintEstimate > redundantDrivenEquations) {
      diagnostics.push({
        severity: "info",
        code: "sketch-redundant-inferred-relations",
        message: `${redundantConstraintEstimate - redundantDrivenEquations} inferred relation equation${redundantConstraintEstimate - redundantDrivenEquations === 1 ? "" : "s"} are redundant but consistent.`
      });
    }
    return {
      status,
      label: sketchDefinitionLabel(status),
      severity: sketchDefinitionSeverity(status),
      vertexCount: system.vertices.length,
      variableCount: system.variableCount,
      relationCount: sketchRelations(normalized).length,
      constraintEquationCount: system.equations.length,
      independentConstraintCount: rank,
      degreesOfFreedom: freeDof,
      underDefinedVertexIds: underDefined.vertices,
      underDefinedEdgeIds: underDefined.edges,
      redundantConstraintEstimate,
      redundantDrivenEquations,
      diagnostics
    };
  } catch (error) {
    return {
      status: "invalid",
      label: sketchDefinitionLabel("invalid"),
      severity: "error",
      vertexCount: 0,
      variableCount: 0,
      relationCount: 0,
      constraintEquationCount: 0,
      independentConstraintCount: 0,
      degreesOfFreedom: 0,
      underDefinedVertexIds: [],
      underDefinedEdgeIds: [],
      redundantConstraintEstimate: 0,
      redundantDrivenEquations: 0,
      diagnostics: [{
        severity: "error",
        code: "sketch-invalid",
        message: error?.message || "Sketch could not be evaluated."
      }]
    };
  }
}

export function plateSketchDefinitionStatus(plate) {
  return sketchDefinitionStatus(plate?.sketch);
}

