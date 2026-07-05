import { v } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { addPlateSketchConstructionLine as addPlateSketchConstructionLineData, insertPlateSketchVertex as insertPlateSketchVertexData, notchPlateSketchCorner as notchPlateSketchCornerData, orderedSketchLoop, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, removePlateSketchRelation as removePlateSketchRelationData, removePlateSketchVertex as removePlateSketchVertexData, setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData, setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData, setPlateSketchEdgeLength as setPlateSketchEdgeLengthData, setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData, setPlateSketchPointDistance as setPlateSketchPointDistanceData, setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData, setPlateSketchVertex as setPlateSketchVertexData, setPlateSketchVertices as setPlateSketchVerticesData, sketchDefinitionStatus, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdgeIsCircularArc, sketchEdges, sketchFromOutline, sketchLengthRelationMode, sketchPointDistance, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationHealth, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices, upsertPlateSketchRelation as upsertPlateSketchRelationData, upsertSketchRelation } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { snapPointOverlay } from "../../scene/authoring/snap-overlays.mjs";
import { adaptiveSnapGridStep, adaptiveSnapGridStepForHandle, snapScalarToGrid, snapSketchWorldTolerance } from "../snap-profiles.mjs";
import { dimensionOverlayForPlate } from "./dimension-overlay.mjs";
import { relationHealthClass, relationHealthColor, relationHealthStatus, sketchEntityColor, sketchStatusColor } from "./relation-display.mjs";
import { EPSILON, add2, cross2, dot2, edgeById, edgeOutwardNormal, edgePointPair, len2, midpoint, mul2, norm2, platePoint, requiredPoint2, signedArea, sub2 } from "./sketch-edit-geometry.mjs";

import { finitePositive } from './drag-edit-targets.mjs';

export function samePoint2(a, b, tolerance = 1e-6) {
  return Array.isArray(a) && Array.isArray(b)
    && Math.abs(a[0] - b[0]) <= tolerance
    && Math.abs(a[1] - b[1]) <= tolerance;
}

export function isConvexPolygon(points) {
  if (!Array.isArray(points) || points.length < 3) return false;
  if (Math.abs(signedArea(points)) <= EPSILON || hasSelfIntersection(points)) return false;
  let sign = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    const cross = cross2(sub2(b, a), sub2(c, b));
    if (Math.abs(cross) <= EPSILON) continue;
    const nextSign = Math.sign(cross);
    if (!sign) sign = nextSign;
    else if (nextSign !== sign) return false;
  }
  return true;
}

export function axisOrientation(a, b) {
  const delta = sub2(b, a);
  return Math.abs(delta[0]) >= Math.abs(delta[1]) ? "y" : "z";
}

export function relationTangent(a, b, relation) {
  if (relation?.type === "horizontal") return [Math.sign(b[0] - a[0]) || 1, 0];
  if (relation?.type === "vertical") return [0, Math.sign(b[1] - a[1]) || 1];
  return norm2(sub2(b, a));
}

export function edgeTangentFromPair(pair) {
  return pair ? norm2(sub2(pair.to, pair.from)) : [0, 0];
}

export function relationCanDriveDrag(relation, relationHealth = {}) {
  if (!relation) return false;
  const status = relationHealth[relation.id]?.status;
  return status !== "conflicted";
}

export function edgeTangentConstraint(sketch, edgeId, relationHealth = {}) {
  const edges = sketchEdges(sketch);
  const vertexMap = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const pair = edgePointPair(edges, vertexMap, edgeId);
  if (!pair) return null;
  const axisRelation = sketchEdgeAxisRelation(sketch, edgeId);
  if (relationCanDriveDrag(axisRelation, relationHealth)) {
    return {
      relation: axisRelation,
      tangent: relationTangent(pair.from, pair.to, axisRelation),
      label: sketchRelationLabel(axisRelation)
    };
  }
  const currentTangent = edgeTangentFromPair(pair);
  if (len2(currentTangent) <= EPSILON) return null;
  const directionalRelation = sketchRelationsForEdge(sketch, edgeId).find((relation) => (
    (relation.type === "parallel" || relation.type === "perpendicular" || relation.type === "collinear")
      && relationCanDriveDrag(relation, relationHealth)
  ));
  if (!directionalRelation) return null;
  const otherEdgeId = sketchRelationEdgeIds(directionalRelation).find((id) => id !== edgeId);
  const otherPair = edgePointPair(edges, vertexMap, otherEdgeId);
  const otherTangent = edgeTangentFromPair(otherPair);
  if (len2(otherTangent) <= EPSILON) return null;
  const candidates = directionalRelation.type === "perpendicular"
    ? [[-otherTangent[1], otherTangent[0]], [otherTangent[1], -otherTangent[0]]]
    : [otherTangent, mul2(otherTangent, -1)];
  const tangent = candidates
    .map((candidate) => ({ candidate, score: dot2(candidate, currentTangent) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;
  if (!tangent) return null;
  return {
    relation: directionalRelation,
    tangent,
    label: sketchRelationLabel(directionalRelation)
  };
}

export function fixedRelationForVertex(sketch, vertexId) {
  return sketchRelationsForVertex(sketch, vertexId).find((relation) => relation.type === "fixed") || null;
}

export function fixedRelationForEdge(sketch, edgeId) {
  return sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "fixed") || null;
}

export function edgeLength(edges, vertexMap, edgeId) {
  const pair = edgePointPair(edges, vertexMap, edgeId);
  return pair ? len2(sub2(pair.to, pair.from)) : null;
}

export function equalLengthTarget(sketch, edgeId) {
  if (sketchEdgeIsCircularArc(sketch, edgeId)) return null;
  const relation = sketchRelationsForEdge(sketch, edgeId).find((item) => item.type === "equal-length");
  if (!relation) return null;
  const otherEdgeId = sketchRelationEdgeIds(relation).find((id) => id !== edgeId);
  if (sketchEdgeIsCircularArc(sketch, otherEdgeId)) return null;
  const edges = sketchEdges(sketch);
  const vertexMap = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const length = edgeLength(edges, vertexMap, otherEdgeId);
  return Number.isFinite(length) && length > EPSILON ? { relation, length, otherEdgeId } : null;
}

export function equalLengthSnapTargets(sketch, excludeEdgeIds = []) {
  const excluded = new Set(excludeEdgeIds.filter(Boolean));
  const edges = sketchEdges(sketch);
  const vertexMap = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  return edges
    .filter((edge) => !excluded.has(edge.id) && !sketchEdgeIsCircularArc(sketch, edge.id))
    .map((edge) => ({ edgeId: edge.id, length: edgeLength(edges, vertexMap, edge.id) }))
    .filter((target) => Number.isFinite(target.length) && target.length > EPSILON);
}

export function formatMm(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const text = Math.abs(value - rounded) < 0.05 ? String(rounded) : value.toFixed(1);
  return `${text} mm`;
}

export function formatDeg(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const text = Math.abs(value - rounded) < 0.05 ? String(rounded) : value.toFixed(1);
  return `${text} deg`;
}

export function relationActionBadge(type) {
  if (type === "horizontal") return "H";
  if (type === "vertical") return "V";
  if (type === "horizontal-points") return "H";
  if (type === "vertical-points") return "V";
  if (type === "coincident") return "CO";
  if (type === "point-on-line") return "ON";
  if (type === "point-on-circle") return "ONC";
  if (type === "midpoint") return "MID";
  if (type === "symmetric") return "SYM";
  if (type === "parallel") return "PAR";
  if (type === "collinear") return "COL";
  if (type === "perpendicular") return "PERP";
  if (type === "equal-length") return "EQ";
  if (type === "tangent") return "TAN";
  if (type === "concentric") return "CON";
  if (type === "equal-radius") return "EQR";
  if (type === "angle") return "ANG";
  if (type === "distance") return "DIST";
  if (type === "radius") return "RAD";
  if (type === "diameter") return "DIA";
  if (type === "flip-arc") return "FLIP";
  if (type === "split-arc") return "SPLIT";
  if (type === "fixed") return "FIX";
  if (type === "construction-line") return "CL";
  return "REL";
}

export function relationPatchFromActionData(type, options = {}) {
  if (type === "horizontal" || type === "vertical") return { type, edgeId: options.edgeId };
  if (type === "horizontal-points" || type === "vertical-points" || type === "coincident") {
    return { type, vertexIds: options.vertexIds };
  }
  if (type === "point-on-line" || type === "point-on-circle" || type === "midpoint") {
    return { type, vertexId: options.vertexId, edgeId: options.edgeId };
  }
  if (type === "symmetric") return { type, vertexIds: options.vertexIds, edgeId: options.edgeId };
  if (type === "fixed") {
    return options.vertexId
      ? { type, vertexId: options.vertexId }
      : { type, edgeId: options.edgeId };
  }
  if (type === "parallel" || type === "collinear" || type === "perpendicular" || type === "equal-length" || type === "tangent" || type === "concentric" || type === "equal-radius") {
    return { type, edgeIds: options.edgeIds, targetEdgeId: options.targetEdgeId };
  }
  if (type === "angle" && Number.isFinite(options.angle)) {
    return { type, edgeIds: options.edgeIds, value: options.angle, mode: "driving", targetEdgeId: options.targetEdgeId };
  }
  if (type === "distance" && Number.isFinite(options.distance)) {
    return { type, vertexIds: options.vertexIds, value: options.distance, mode: "driving", targetVertexId: options.targetVertexId };
  }
  if (type === "radius" && Number.isFinite(options.radius)) {
    return { type, edgeId: options.edgeId, value: options.radius, mode: "driven", display: "radius" };
  }
  if (type === "diameter" && Number.isFinite(options.radius)) {
    return { type: "radius", edgeId: options.edgeId, value: options.radius, mode: "driven", display: "diameter" };
  }
  return null;
}

export function existingRelationForAction(sketch, type, options = {}) {
  const relationPatch = relationPatchFromActionData(type, options);
  if (!relationPatch) return null;
  const relationKey = sketchRelationKey(relationPatch);
  return sketchRelations(sketch).find((relation) => sketchRelationKey(relation) === relationKey) || null;
}

export function relationActionPreview(plate, type, options = {}) {
  const relationPatch = relationPatchFromActionData(type, options);
  if (!relationPatch) return null;
  try {
    if (plate?.type === "plate-sketch") {
      const nextSketchObject = upsertSketchRelation(plate, relationPatch);
      const relationKey = sketchRelationKey(relationPatch);
      const nextRelation = sketchRelations(nextSketchObject?.sketch)
        .find((relation) => sketchRelationKey(relation) === relationKey) || null;
      return {
        relation: nextRelation,
        health: nextRelation
          ? sketchRelationHealth(nextSketchObject.sketch)[nextRelation.id] || { status: "ok", severity: "ok" }
          : { status: "conflicted", severity: "error", message: "Relation could not be evaluated." },
        definition: sketchDefinitionStatus(nextSketchObject?.sketch)
      };
    }
    return plateSketchRelationActionPreview(plate, relationPatch);
  } catch (error) {
    return {
      relation: null,
      health: {
        status: "conflicted",
        severity: "error",
        message: error?.message || "Relation cannot be evaluated."
      },
      definition: null
    };
  }
}

export function positiveSetting(value, fallback) {
  return Number.isFinite(value) && value > EPSILON ? value : fallback;
}

export function screenDeltaToSketch(handle, totalDx, totalDy) {
  const axisY = handle.dragAxesScreen?.x;
  const axisZ = handle.dragAxesScreen?.y;
  if (!axisY || !axisZ) return [0, 0];
  const y = { x: axisY.unit.x * axisY.scalePxPerWorld, y: axisY.unit.y * axisY.scalePxPerWorld };
  const z = { x: axisZ.unit.x * axisZ.scalePxPerWorld, y: axisZ.unit.y * axisZ.scalePxPerWorld };
  const det = y.x * z.y - z.x * y.y;
  if (Math.abs(det) > 1e-6) {
    return [
      (totalDx * z.y - z.x * totalDy) / det,
      (y.x * totalDy - totalDx * y.y) / det
    ];
  }
  return [
    (totalDx * axisY.unit.x + totalDy * axisY.unit.y) / Math.max(axisY.scalePxPerWorld, 1e-9),
    (totalDx * axisZ.unit.x + totalDy * axisZ.unit.y) / Math.max(axisZ.scalePxPerWorld, 1e-9)
  ];
}

export function lineIntersectionPoint(a, b, c, d) {
  const ab = sub2(b, a);
  const cd = sub2(d, c);
  const ac = sub2(c, a);
  const denominator = cross2(ab, cd);
  if (Math.abs(denominator) <= EPSILON) return null;
  const t = cross2(ac, cd) / denominator;
  const u = cross2(ac, ab) / denominator;
  return {
    point: [a[0] + ab[0] * t, a[1] + ab[1] * t],
    t,
    u
  };
}

export function segmentIntersectionPoint(a, b, c, d) {
  const intersection = lineIntersectionPoint(a, b, c, d);
  if (!intersection) return null;
  if (intersection.t <= EPSILON || intersection.t >= 1 - EPSILON || intersection.u <= EPSILON || intersection.u >= 1 - EPSILON) return null;
  return intersection.point;
}

export function segmentIntersection(a, b, c, d) {
  return Boolean(segmentIntersectionPoint(a, b, c, d));
}

export function hasSelfIntersection(points) {
  for (let aIndex = 0; aIndex < points.length; aIndex += 1) {
    const a = points[aIndex];
    const b = points[(aIndex + 1) % points.length];
    for (let cIndex = aIndex + 1; cIndex < points.length; cIndex += 1) {
      if (cIndex === aIndex || cIndex === (aIndex + 1) % points.length) continue;
      if (aIndex === 0 && cIndex === points.length - 1) continue;
      const c = points[cIndex];
      const d = points[(cIndex + 1) % points.length];
      if (segmentIntersection(a, b, c, d)) return true;
    }
  }
  return false;
}

export function relationPointForSketchRelation(relation, edges, vertexMap) {
  if (relation?.type === "fixed") {
    const vertexId = sketchRelationVertexIds(relation)[0];
    const vertex = vertexId ? vertexMap.get(vertexId) : null;
    if (vertex) return requiredPoint2(vertex.point, `${vertex.id}.point`);
    const pair = edgePointPair(edges, vertexMap, relation.edgeId);
    return pair ? midpoint(pair.from, pair.to) : null;
  }
  if (relation?.type === "horizontal-points" || relation?.type === "vertical-points" || relation?.type === "coincident" || relation?.type === "distance") {
    const vertices = sketchRelationVertexIds(relation)
      .map((vertexId) => vertexMap.get(vertexId)?.point)
      .filter(Boolean);
    return vertices.length === 2 ? midpoint(vertices[0], vertices[1]) : null;
  }
  if (relation?.type === "point-on-line" || relation?.type === "midpoint") {
    const vertex = relation.vertexId ? vertexMap.get(relation.vertexId)?.point : null;
    const pair = edgePointPair(edges, vertexMap, relation.edgeId);
    return vertex && pair ? midpoint(vertex, midpoint(pair.from, pair.to)) : null;
  }
  if (relation?.type === "symmetric") {
    const vertices = sketchRelationVertexIds(relation)
      .map((vertexId) => vertexMap.get(vertexId)?.point)
      .filter(Boolean);
    const pair = edgePointPair(edges, vertexMap, relation.edgeId);
    return vertices.length === 2 && pair
      ? midpoint(midpoint(vertices[0], vertices[1]), midpoint(pair.from, pair.to))
      : null;
  }
  if (relation?.type === "horizontal" || relation?.type === "vertical") {
    const pair = edgePointPair(edges, vertexMap, relation.edgeId);
    return pair ? midpoint(pair.from, pair.to) : null;
  }
  if (relation?.type === "perpendicular" || relation?.type === "parallel" || relation?.type === "collinear" || relation?.type === "equal-length" || relation?.type === "angle") {
    const edgeIds = sketchRelationEdgeIds(relation);
    const first = edgeById(edges, edgeIds[0]);
    const second = edgeById(edges, edgeIds[1]);
    if (!first || !second) return null;
    const shared = [first.from, first.to].find((vertexId) => vertexId === second.from || vertexId === second.to);
    const vertex = shared ? vertexMap.get(shared) : null;
    if (relation.type === "perpendicular" && vertex) return requiredPoint2(vertex.point, `${vertex.id}.point`);
    const firstPair = edgePointPair(edges, vertexMap, first.id);
    const secondPair = edgePointPair(edges, vertexMap, second.id);
    return firstPair && secondPair
      ? midpoint(midpoint(firstPair.from, firstPair.to), midpoint(secondPair.from, secondPair.to))
      : null;
  }
  return null;
}

export function relationSelectionEntityIds(relation, edges = []) {
  if (!relation) return { edgeIds: [], vertexIds: [] };
  const edgeIds = new Set(sketchRelationEdgeIds(relation).filter(Boolean));
  const vertexIds = new Set(sketchRelationVertexIds(relation).filter(Boolean));
  const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  for (const edgeId of edgeIds) {
    const edge = edgeMap.get(edgeId);
    if (!edge) continue;
    if (edge.from) vertexIds.add(edge.from);
    if (edge.to) vertexIds.add(edge.to);
  }
  return { edgeIds: [...edgeIds], vertexIds: [...vertexIds] };
}

export function relationTouchesManualSelection(relation, manualSelectedEdgeIds, manualSelectedVertexIds, edges = []) {
  if (!relation || (!manualSelectedEdgeIds.size && !manualSelectedVertexIds.size)) return false;
  const entityIds = relationSelectionEntityIds(relation, edges);
  return entityIds.edgeIds.some((edgeId) => manualSelectedEdgeIds.has(edgeId))
    || entityIds.vertexIds.some((vertexId) => manualSelectedVertexIds.has(vertexId));
}

export function sketchEntityMaps(sketch) {
  const outlineVertices = sketchVertices(sketch);
  const constructionVertices = sketchConstructionVertices(sketch);
  const outlineEdges = sketchEdges(sketch);
  const constructionEdges = sketchConstructionEdges(sketch);
  return {
    outlineVertices,
    constructionVertices,
    vertices: [...outlineVertices, ...constructionVertices],
    vertexMap: new Map([...outlineVertices, ...constructionVertices].map((vertex) => [vertex.id, vertex])),
    outlineEdges,
    constructionEdges,
    edges: [...outlineEdges, ...constructionEdges]
  };
}
