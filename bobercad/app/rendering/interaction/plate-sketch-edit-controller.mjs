import { v } from "../../engine/core/math.mjs?v=plate-sketch-edit-1";
import { arrayValues } from "../../engine/core/model.mjs?v=plate-sketch-selection-entities-1";
import { orderedSketchLoop, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdges, sketchLengthRelationMode, sketchPointDistance, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices } from "../../engine/api/project/plates.mjs?v=plate-relation-preflight-1";
import { linearDraftingDimension, formatDraftingNumber } from "../annotations/drafting-dimensions.mjs?v=unified-dimension-overlay-1";
import { snapPointOverlay } from "../scene/authoring/snap-overlays.mjs?v=unified-snap-manager-8";
import { adaptiveSnapGridStep, adaptiveSnapGridStepForHandle, snapScalarToGrid, snapSketchWorldTolerance } from "./snap-profiles.mjs?v=unified-snap-manager-10";

const EPSILON = 1e-6;
const DEFAULT_DIMENSION_OFFSET = 38;
const DEFAULT_CLEAN_DIMENSION_TICK_SIZE = 8;
const DEFAULT_CLEAN_DIMENSION_EXTENSION_OVERSHOOT = 6;
const DEFAULT_CLEAN_DIMENSION_LABEL_OFFSET = 10;
const DEFAULT_EDGE_SNAP_MAX_WORLD = 10;
const DEFAULT_VERTEX_RELATION_SNAP_MAX_WORLD = 8;
const DEFAULT_VERTEX_ANGLE_SNAP_MAX_WORLD = 12;
const DEFAULT_VERTEX_EQUAL_SNAP_MAX_WORLD = 20;
const DEFAULT_INSERT_VERTEX_DRAG_THRESHOLD_PX = 4;
const DEFAULT_NOTCH_SIZE = 10;
const DEFAULT_NOTCH_MAX_SIZE = 40;
const RELATION_ACTION_COLOR = "#2563eb";
const RELATION_SELECTION_COLOR = "#f59e0b";
const RELATION_ASSOCIATED_COLOR = "#2563eb";
const CONSTRUCTION_EDGE_COLOR = "#64748b";
const CONSTRUCTION_EDGE_SELECTED_COLOR = "#f59e0b";
const SKETCH_UNDER_DEFINED_COLOR = "#2563eb";
const SKETCH_FULLY_DEFINED_COLOR = "#111827";
const SKETCH_CONFLICT_COLOR = "#dc2626";

function activePlate(project, plateId) {
  return project.model?.plates?.[plateId] || null;
}

function platePoint(plate, point) {
  return v.add(
    plate.center,
    v.add(v.mul(plate.localAxisY, point[0]), v.mul(plate.localAxisZ, point[1]))
  );
}

function plateSketchPlane(plate) {
  if (!plate || !v.isVec3(plate.center)) return null;
  return {
    id: `${plate.id || "plate"}:sketch-plane`,
    label: `${plate.id || "plate"} sketch plane`,
    origin: [...plate.center],
    normal: v.safeNorm(plate.normal, [0, 0, 1]),
    axisX: v.safeNorm(plate.localAxisY, [1, 0, 0]),
    axisY: v.safeNorm(plate.localAxisZ, [0, 1, 0])
  };
}

function plateSketchPointFromWorld(plate, point) {
  if (!plate || !v.isVec3(point)) return null;
  const delta = v.sub(point, plate.center);
  return [
    v.dot(delta, v.safeNorm(plate.localAxisY, [1, 0, 0])),
    v.dot(delta, v.safeNorm(plate.localAxisZ, [0, 1, 0]))
  ];
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function samePoint2(a, b, tolerance = 1e-6) {
  return Array.isArray(a) && Array.isArray(b)
    && Math.abs((a[0] || 0) - (b[0] || 0)) <= tolerance
    && Math.abs((a[1] || 0) - (b[1] || 0)) <= tolerance;
}

function add2(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub2(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function mul2(a, scale) {
  return [a[0] * scale, a[1] * scale];
}

function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function len2(a) {
  return Math.hypot(a[0], a[1]);
}

function norm2(a) {
  const length = len2(a);
  return length > EPSILON ? [a[0] / length, a[1] / length] : [0, 0];
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function isConvexPolygon(points) {
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

function edgeOutwardNormal(a, b, windingSign) {
  const tangent = norm2(sub2(b, a));
  if (len2(tangent) <= EPSILON) return [0, 0];
  return windingSign >= 0 ? [tangent[1], -tangent[0]] : [-tangent[1], tangent[0]];
}

function canonicalDimensionTangent(tangent) {
  const unit = norm2(tangent);
  if (unit[0] < -EPSILON || (Math.abs(unit[0]) <= EPSILON && unit[1] < 0)) return mul2(unit, -1);
  return unit;
}

function cleanDimensionEdgeKey(a, b) {
  const tangent = canonicalDimensionTangent(sub2(b, a));
  const length = len2(sub2(b, a));
  return [
    Math.round(tangent[0] * 1000),
    Math.round(tangent[1] * 1000),
    Math.round(length * 100)
  ].join(":");
}

function cleanDimensionEdgeScore(a, b) {
  const midpointPoint = midpoint(a, b);
  const tangent = canonicalDimensionTangent(sub2(b, a));
  return Math.abs(tangent[0]) >= Math.abs(tangent[1])
    ? midpointPoint[1]
    : -midpointPoint[0];
}

function cleanDimensionEdgeIds(edges, vertexMap) {
  const bestByKey = new Map();
  for (const edge of edges) {
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const a = from.point || [0, 0];
    const b = to.point || [0, 0];
    if (len2(sub2(b, a)) <= EPSILON) continue;
    const key = cleanDimensionEdgeKey(a, b);
    const score = cleanDimensionEdgeScore(a, b);
    const current = bestByKey.get(key);
    if (!current || score > current.score) bestByKey.set(key, { edgeId: edge.id, score });
  }
  return new Set([...bestByKey.values()].map((item) => item.edgeId));
}

function axisOrientation(a, b) {
  const delta = sub2(b, a);
  return Math.abs(delta[0]) >= Math.abs(delta[1]) ? "y" : "z";
}

function relationTangent(a, b, relation) {
  if (relation?.type === "horizontal") return [Math.sign(b[0] - a[0]) || 1, 0];
  if (relation?.type === "vertical") return [0, Math.sign(b[1] - a[1]) || 1];
  return norm2(sub2(b, a));
}

function edgeById(edges, edgeId) {
  return edges.find((edge) => edge.id === edgeId) || null;
}

function edgePointPair(edges, vertexMap, edgeId) {
  const edge = edgeById(edges, edgeId);
  const from = edge ? vertexMap.get(edge.from) : null;
  const to = edge ? vertexMap.get(edge.to) : null;
  return from && to ? { edge, from: from.point || [0, 0], to: to.point || [0, 0] } : null;
}

function edgeTangentFromPair(pair) {
  return pair ? norm2(sub2(pair.to, pair.from)) : [0, 0];
}

function relationCanDriveDrag(relation, relationHealth = {}) {
  if (!relation) return false;
  const status = relationHealth[relation.id]?.status;
  return status !== "conflicted";
}

function edgeTangentConstraint(sketch, edgeId, relationHealth = {}) {
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

function fixedRelationForVertex(sketch, vertexId) {
  return sketchRelationsForVertex(sketch, vertexId).find((relation) => relation.type === "fixed") || null;
}

function fixedRelationForEdge(sketch, edgeId) {
  return sketchRelationsForEdge(sketch, edgeId).find((relation) => relation.type === "fixed") || null;
}

function edgeLength(edges, vertexMap, edgeId) {
  const pair = edgePointPair(edges, vertexMap, edgeId);
  return pair ? len2(sub2(pair.to, pair.from)) : null;
}

function equalLengthTarget(sketch, edgeId) {
  const relation = sketchRelationsForEdge(sketch, edgeId).find((item) => item.type === "equal-length");
  if (!relation) return null;
  const otherEdgeId = sketchRelationEdgeIds(relation).find((id) => id !== edgeId);
  const edges = sketchEdges(sketch);
  const vertexMap = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const length = edgeLength(edges, vertexMap, otherEdgeId);
  return Number.isFinite(length) && length > EPSILON ? { relation, length, otherEdgeId } : null;
}

function equalLengthSnapTargets(sketch, excludeEdgeIds = []) {
  const excluded = new Set(excludeEdgeIds.filter(Boolean));
  const edges = sketchEdges(sketch);
  const vertexMap = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  return edges
    .filter((edge) => !excluded.has(edge.id))
    .map((edge) => ({ edgeId: edge.id, length: edgeLength(edges, vertexMap, edge.id) }))
    .filter((target) => Number.isFinite(target.length) && target.length > EPSILON);
}

function formatMm(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const text = Math.abs(value - rounded) < 0.05 ? String(rounded) : value.toFixed(1);
  return `${text} mm`;
}

function formatDeg(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  const text = Math.abs(value - rounded) < 0.05 ? String(rounded) : value.toFixed(1);
  return `${text} deg`;
}

function relationActionBadge(type) {
  if (type === "horizontal") return "H";
  if (type === "vertical") return "V";
  if (type === "horizontal-points") return "H";
  if (type === "vertical-points") return "V";
  if (type === "coincident") return "CO";
  if (type === "point-on-line") return "ON";
  if (type === "midpoint") return "MID";
  if (type === "symmetric") return "SYM";
  if (type === "parallel") return "PAR";
  if (type === "collinear") return "COL";
  if (type === "perpendicular") return "PERP";
  if (type === "equal-length") return "EQ";
  if (type === "angle") return "ANG";
  if (type === "distance") return "DIST";
  if (type === "fixed") return "FIX";
  if (type === "construction-line") return "CL";
  return "REL";
}

function relationPatchFromActionData(type, options = {}) {
  if (type === "horizontal" || type === "vertical") return { type, edgeId: options.edgeId };
  if (type === "horizontal-points" || type === "vertical-points" || type === "coincident") {
    return { type, vertexIds: options.vertexIds };
  }
  if (type === "point-on-line" || type === "midpoint") {
    return { type, vertexId: options.vertexId, edgeId: options.edgeId };
  }
  if (type === "symmetric") return { type, vertexIds: options.vertexIds, edgeId: options.edgeId };
  if (type === "fixed") {
    return options.vertexId
      ? { type, vertexId: options.vertexId }
      : { type, edgeId: options.edgeId };
  }
  if (type === "parallel" || type === "collinear" || type === "perpendicular" || type === "equal-length") {
    return { type, edgeIds: options.edgeIds, targetEdgeId: options.targetEdgeId };
  }
  if (type === "angle" && Number.isFinite(options.angle)) {
    return { type, edgeIds: options.edgeIds, value: options.angle, mode: "driving", targetEdgeId: options.targetEdgeId };
  }
  if (type === "distance" && Number.isFinite(options.distance)) {
    return { type, vertexIds: options.vertexIds, value: options.distance, mode: "driving", targetVertexId: options.targetVertexId };
  }
  return null;
}

function existingRelationForAction(sketch, type, options = {}) {
  const relationPatch = relationPatchFromActionData(type, options);
  if (!relationPatch) return null;
  const relationKey = sketchRelationKey(relationPatch);
  return sketchRelations(sketch).find((relation) => sketchRelationKey(relation) === relationKey) || null;
}

function relationActionPreview(plate, type, options = {}) {
  const relationPatch = relationPatchFromActionData(type, options);
  if (!relationPatch) return null;
  try {
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

function relationHealthStatus(health) {
  if (health?.status === "driven") return "reference";
  return health?.status || "ok";
}

function sketchStatusColor(status) {
  if (status === "fully-defined") return SKETCH_FULLY_DEFINED_COLOR;
  if (status === "under-defined") return SKETCH_UNDER_DEFINED_COLOR;
  return SKETCH_CONFLICT_COLOR;
}

function sketchEntityColor(definition, fallbackColor) {
  if (typeof definition === "string") return sketchStatusColor(definition);
  if (definition?.status) return sketchStatusColor(definition.status);
  return fallbackColor || SKETCH_UNDER_DEFINED_COLOR;
}

function relationHealthColor(health, fallbackColor) {
  if (health?.status === "conflicted") return SKETCH_CONFLICT_COLOR;
  if (health?.status === "redundant") return "#d97706";
  if (health?.status === "driven") return "#64748b";
  return fallbackColor;
}

function relationHealthClass(health) {
  if (!health?.status || health.status === "ok") return "";
  return health.status === "driven" ? " reference" : ` ${health.status}`;
}

function positiveSetting(value, fallback) {
  return Number.isFinite(value) && value > EPSILON ? value : fallback;
}

function screenDeltaToSketch(handle, totalDx, totalDy) {
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

function segmentIntersection(a, b, c, d) {
  const ab = sub2(b, a);
  const cd = sub2(d, c);
  const ac = sub2(c, a);
  const denominator = cross2(ab, cd);
  if (Math.abs(denominator) <= EPSILON) return false;
  const t = cross2(ac, cd) / denominator;
  const u = cross2(ac, ab) / denominator;
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

function hasSelfIntersection(points) {
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

function dimensionOverlayForPlate(plate, edges, vertexMap, settings = {}, relationHealth = {}, options = {}) {
  const plain = options.plain === true;
  const showRelationControls = options.showRelationControls === true;
  const dimensionOffset = settings.plateSketchDimensionOffset ?? DEFAULT_DIMENSION_OFFSET;
  const cleanTickSize = settings.plateSketchCleanDimensionTickSize ?? DEFAULT_CLEAN_DIMENSION_TICK_SIZE;
  const cleanExtensionOvershoot = settings.plateSketchCleanDimensionExtensionOvershoot ?? DEFAULT_CLEAN_DIMENSION_EXTENSION_OVERSHOOT;
  const cleanLabelOffset = settings.plateSketchCleanDimensionLabelOffset ?? DEFAULT_CLEAN_DIMENSION_LABEL_OFFSET;
  const cleanLineWidth = settings.plateSketchCleanDimensionLineWidth ?? 1;
  const cleanDimensionColor = settings.plateSketchCleanDimensionColor || "#111827";
  const dimensionColor = plain ? cleanDimensionColor : settings.plateSketchDimensionColor || "#475569";
  const drivenColor = plain ? cleanDimensionColor : settings.plateSketchDrivenDimensionColor || "#1d4ed8";
  const referenceColor = plain ? cleanDimensionColor : settings.plateSketchReferenceDimensionColor || "#64748b";
  const loop = orderedSketchLoop(plate.sketch);
  const windingSign = Math.sign(signedArea(loop.map((item) => item.point))) || 1;
  const lines = [];
  const labels = [];
  const handles = [];
  const visibleLengthDimensionEdgeIds = plain ? cleanDimensionEdgeIds(edges, vertexMap) : null;
  for (const edge of edges) {
    if (visibleLengthDimensionEdgeIds && !visibleLengthDimensionEdgeIds.has(edge.id)) continue;
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const a = from.point || [0, 0];
    const b = to.point || [0, 0];
    const length = len2(sub2(b, a));
    if (length <= EPSILON) continue;
    const normal = edgeOutwardNormal(a, b, windingSign);
    const lengthRelation = sketchRelationsForEdge(plate.sketch, edge.id).find((relation) => relation.type === "length");
    const relationMode = sketchLengthRelationMode(lengthRelation);
    const isReference = relationMode === "driven";
    const health = lengthRelation ? relationHealth[lengthRelation.id] : null;
    const color = relationHealthColor(health, lengthRelation ? (isReference ? referenceColor : drivenColor) : dimensionColor);
    const dimensionId = `${plate.id}:${edge.id}:length`;
    const placementOffset = Number.isFinite(options.dimensionPlacementOffsets?.[dimensionId])
      ? options.dimensionPlacementOffsets[dimensionId]
      : 0;
    const resolvedDimensionOffset = dimensionOffset + placementOffset;
    const start = add2(a, mul2(normal, resolvedDimensionOffset));
    const end = add2(b, mul2(normal, resolvedDimensionOffset));
    const worldA = platePoint(plate, a);
    const worldB = platePoint(plate, b);
    const worldStart = platePoint(plate, start);
    const worldEnd = platePoint(plate, end);
    const dimensionPart = linearDraftingDimension({
      base: {
        dimensionId,
        kind: "plate-sketch-dimension",
        objectId: plate.id,
        plateId: plate.id,
        edgeId: edge.id,
        relationId: lengthRelation?.id || null,
        relationMode,
        dimensionType: "length",
        dimensionPlacementKey: dimensionId,
        dimensionLocalNormal: normal
      },
      a: worldA,
      b: worldB,
      start: worldStart,
      end: worldEnd,
      extensionA: worldA,
      extensionB: worldB,
      dimensionAxis: v.norm(v.sub(worldB, worldA)),
      markerAxis: v.norm(v.sub(worldStart, worldA)),
      color,
      value: length,
      text: formatDraftingNumber(length),
      displayText: formatDraftingNumber(length),
      title: health?.message || (isReference ? `Reference length ${formatDraftingNumber(length)}` : `Length ${formatDraftingNumber(length)}`),
      lineWidth: cleanLineWidth,
      tickSize: cleanTickSize,
      extensionOverrun: cleanExtensionOvershoot,
      labelOffset: cleanLabelOffset,
      handles: [{
        type: "circle",
        kind: "plate-sketch-length-dimension",
        target: `${edge.id}:length`,
        objectId: plate.id,
        plateId: plate.id,
        edgeId: edge.id,
        length,
        relationId: lengthRelation?.id || null,
        relationMode,
        dimensionType: "length",
        dimensionPlacementKey: dimensionId,
        dimensionLocalNormal: normal,
        dragAxes: {
          x: v.norm(plate.localAxisY),
          y: v.norm(plate.localAxisZ)
        },
        draggable: true,
        radius: 0,
        hitTolerancePx: 30,
        visible: false,
        hoverLabel: health?.message || (isReference ? "Drag reference length dimension" : "Drag length dimension")
      }]
    });
    lines.push(...dimensionPart.lines);
    labels.push(...dimensionPart.labels);
    handles.push(...dimensionPart.handles);
    const labelPointWorld = dimensionPart.labels[0]?.point || platePoint(plate, midpoint(start, end));
    if (showRelationControls && lengthRelation) {
      handles.push({
        type: "space-toggle",
        kind: "plate-sketch-dimension-mode-toggle",
        target: `${edge.id}:length:mode`,
        objectId: plate.id,
        plateId: plate.id,
        dimensionType: "length",
        edgeId: edge.id,
        relationMode,
        draggable: false,
        point: labelPointWorld,
        screenOffsetPx: { x: 36, y: -18 },
        color,
        radius: 8,
        hitTolerancePx: 22,
        hoverLabel: isReference ? "Make length driving" : "Make length reference"
      });
    }
  }
  for (const relation of sketchRelations(plate.sketch)) {
    if (relation.type !== "angle") continue;
    const [firstEdgeId, secondEdgeId] = sketchRelationEdgeIds(relation);
    const firstPair = edgePointPair(edges, vertexMap, firstEdgeId);
    const secondPair = edgePointPair(edges, vertexMap, secondEdgeId);
    if (!firstPair || !secondPair) continue;
    const firstMid = midpoint(firstPair.from, firstPair.to);
    const secondMid = midpoint(secondPair.from, secondPair.to);
    const labelBasePoint = midpoint(firstMid, secondMid);
    const angle = sketchEdgeAngleDegrees(plate.sketch, [firstEdgeId, secondEdgeId]);
    const relationMode = sketchAngleRelationMode(relation);
    const isReference = relationMode === "driven";
    const health = relationHealth[relation.id] || null;
    const color = relationHealthColor(health, isReference ? referenceColor : drivenColor);
    const angleDimensionId = `${plate.id}:${firstEdgeId}:${secondEdgeId}:angle`;
    const angleAxis = norm2(sub2(secondMid, firstMid));
    const angleNormal = len2(angleAxis) <= EPSILON ? [0, 1] : [-angleAxis[1], angleAxis[0]];
    const anglePlacementOffset = Number.isFinite(options.dimensionPlacementOffsets?.[angleDimensionId])
      ? options.dimensionPlacementOffsets[angleDimensionId]
      : 0;
    const labelPoint = add2(labelBasePoint, mul2(angleNormal, anglePlacementOffset));
    const labelWorldPoint = platePoint(plate, labelPoint);
    const angleWorldUpAxis = v.norm(v.sub(platePoint(plate, add2(labelBasePoint, angleNormal)), platePoint(plate, labelBasePoint)));
    lines.push(
      { points: [platePoint(plate, firstMid), labelWorldPoint], color, kind: "plate-sketch-angle-dimension", objectId: plate.id, dimensionId: angleDimensionId },
      { points: [platePoint(plate, secondMid), labelWorldPoint], color, kind: "plate-sketch-angle-dimension", objectId: plate.id, dimensionId: angleDimensionId }
    );
    handles.push({
      type: "circle",
      kind: "plate-sketch-angle-dimension",
      target: `${firstEdgeId}:${secondEdgeId}:angle`,
      objectId: plate.id,
      plateId: plate.id,
      edgeIds: [firstEdgeId, secondEdgeId],
      targetEdgeId: secondEdgeId,
      angle,
      relationId: relation.id,
      relationMode,
      dimensionType: "angle",
      dimensionPlacementKey: angleDimensionId,
      dimensionLocalNormal: angleNormal,
      dragAxes: {
        x: v.norm(plate.localAxisY),
        y: v.norm(plate.localAxisZ)
      },
      draggable: true,
      point: labelWorldPoint,
      color,
      radius: 0,
      hitTolerancePx: 28,
      visible: false,
      hoverLabel: health?.message || (isReference ? "Reference angle" : "Edit edge angle")
    });
    if (showRelationControls) handles.push({
      type: "space-toggle",
      kind: "plate-sketch-dimension-mode-toggle",
      target: `${firstEdgeId}:${secondEdgeId}:angle:mode`,
      objectId: plate.id,
      plateId: plate.id,
      dimensionType: "angle",
      edgeIds: [firstEdgeId, secondEdgeId],
      relationMode,
      draggable: false,
      point: labelWorldPoint,
      screenOffsetPx: { x: 36, y: -18 },
      color,
      radius: 8,
      hitTolerancePx: 22,
      hoverLabel: isReference ? "Make angle driving" : "Make angle reference"
    });
    labels.push({
      point: labelWorldPoint,
      text: formatDraftingNumber(angle),
      displayText: formatDraftingNumber(angle),
      color,
      dimensionId: angleDimensionId,
      draftingDimension: true,
      labelAxis: v.norm(v.sub(platePoint(plate, secondMid), platePoint(plate, firstMid))),
      labelUpAxis: angleWorldUpAxis,
      screenOffsetPx: { x: 0, y: 0 }
    });
  }
  for (const relation of sketchRelations(plate.sketch)) {
    if (relation.type !== "distance") continue;
    const vertexIds = sketchRelationVertexIds(relation);
    if (vertexIds.length !== 2) continue;
    const first = vertexMap.get(vertexIds[0]);
    const second = vertexMap.get(vertexIds[1]);
    if (!first || !second) continue;
    const a = first.point || [0, 0];
    const b = second.point || [0, 0];
    const tangent = norm2(sub2(b, a));
    if (len2(tangent) <= EPSILON) continue;
    const normal = [-tangent[1], tangent[0]];
    const dimensionId = `${plate.id}:${vertexIds.join(":")}:distance`;
    const placementOffset = Number.isFinite(options.dimensionPlacementOffsets?.[dimensionId])
      ? options.dimensionPlacementOffsets[dimensionId]
      : 0;
    const start = add2(a, mul2(normal, dimensionOffset * 0.75 + placementOffset));
    const end = add2(b, mul2(normal, dimensionOffset * 0.75 + placementOffset));
    const distance = sketchPointDistance(plate.sketch, vertexIds);
    const relationMode = sketchDistanceRelationMode(relation);
    const isReference = relationMode === "driven";
    const health = relationHealth[relation.id] || null;
    const color = relationHealthColor(health, isReference ? referenceColor : drivenColor);
    const dimensionPart = linearDraftingDimension({
      base: {
        dimensionId,
        kind: "plate-sketch-distance-dimension",
        objectId: plate.id,
        plateId: plate.id,
        vertexIds,
        relationId: relation.id,
        relationMode,
        dimensionType: "distance",
        dimensionPlacementKey: dimensionId,
        dimensionLocalNormal: normal
      },
      a: platePoint(plate, a),
      b: platePoint(plate, b),
      start: platePoint(plate, start),
      end: platePoint(plate, end),
      extensionA: platePoint(plate, a),
      extensionB: platePoint(plate, b),
      dimensionAxis: v.norm(v.sub(platePoint(plate, b), platePoint(plate, a))),
      markerAxis: v.norm(v.sub(platePoint(plate, start), platePoint(plate, a))),
      color,
      value: distance,
      text: formatDraftingNumber(distance),
      displayText: formatDraftingNumber(distance),
      title: health?.message || (isReference ? `Reference point distance ${formatDraftingNumber(distance)}` : `Point distance ${formatDraftingNumber(distance)}`),
      lineWidth: cleanLineWidth,
      tickSize: cleanTickSize,
      extensionOverrun: cleanExtensionOvershoot,
      labelOffset: cleanLabelOffset,
      handles: [{
        type: "circle",
        kind: "plate-sketch-distance-dimension",
        target: `${vertexIds[0]}:${vertexIds[1]}:distance`,
        objectId: plate.id,
        plateId: plate.id,
        vertexIds,
        targetVertexId: vertexIds[1],
        distance,
        relationId: relation.id,
        relationMode,
        dimensionType: "distance",
        dimensionPlacementKey: dimensionId,
        dimensionLocalNormal: normal,
        dragAxes: {
          x: v.norm(plate.localAxisY),
          y: v.norm(plate.localAxisZ)
        },
        draggable: true,
        color,
        radius: 0,
        hitTolerancePx: 30,
        visible: false,
        hoverLabel: health?.message || (isReference ? "Reference point distance" : "Edit point distance")
      }]
    });
    lines.push(...dimensionPart.lines);
    labels.push(...dimensionPart.labels);
    handles.push(...dimensionPart.handles);
    const labelPoint = dimensionPart.labels[0]?.point || platePoint(plate, midpoint(start, end));
    if (showRelationControls) handles.push({
      type: "space-toggle",
      kind: "plate-sketch-dimension-mode-toggle",
      target: `${vertexIds[0]}:${vertexIds[1]}:distance:mode`,
      objectId: plate.id,
      plateId: plate.id,
      dimensionType: "distance",
      vertexIds,
      relationMode,
      draggable: false,
      point: labelPoint,
      screenOffsetPx: { x: 36, y: -18 },
      color,
      radius: 8,
      hitTolerancePx: 22,
      hoverLabel: isReference ? "Make distance driving" : "Make distance reference"
    });
  }
  return { lines, labels, handles };
}

function relationPointForSketchRelation(relation, edges, vertexMap) {
  if (relation?.type === "fixed") {
    const vertexId = sketchRelationVertexIds(relation)[0];
    const vertex = vertexId ? vertexMap.get(vertexId) : null;
    if (vertex) return vertex.point || [0, 0];
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
    if (relation.type === "perpendicular" && vertex) return vertex.point || [0, 0];
    const firstPair = edgePointPair(edges, vertexMap, first.id);
    const secondPair = edgePointPair(edges, vertexMap, second.id);
    return firstPair && secondPair
      ? midpoint(midpoint(firstPair.from, firstPair.to), midpoint(secondPair.from, secondPair.to))
      : null;
  }
  return null;
}

function relationSelectionEntityIds(relation, edges = []) {
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

function relationTouchesManualSelection(relation, manualSelectedEdgeIds, manualSelectedVertexIds, edges = []) {
  if (!relation || (!manualSelectedEdgeIds.size && !manualSelectedVertexIds.size)) return false;
  const entityIds = relationSelectionEntityIds(relation, edges);
  return entityIds.edgeIds.some((edgeId) => manualSelectedEdgeIds.has(edgeId))
    || entityIds.vertexIds.some((vertexId) => manualSelectedVertexIds.has(vertexId));
}

function sketchEntityMaps(sketch) {
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

function overlayForPlate(plate, options = {}) {
  const settings = options.settings || {};
  const color = plate.display?.edgeColor || "#0ea5e9";
  const showRelations = options.showRelations === true;
  const actionTarget = options.actionTarget || null;
  const actionVertexId = actionTarget?.kind === "vertex" ? actionTarget.vertexId : null;
  const actionEdgeId = actionTarget?.kind === "edge" ? actionTarget.edgeId : null;
  const cleanOutlineColor = settings.plateSketchCleanOutlineColor || "#111827";
  const cleanOutlineLineWidth = settings.plateSketchCleanOutlineLineWidth ?? 3;
  const cleanFillColor = settings.plateSketchCleanFillColor || "#8b8de8";
  const entityDefinition = plateSketchEntityDefinitionStatus(plate);
  const relationHealth = plateSketchRelationHealth(plate);
  const definition = entityDefinition.definition;
  const fallbackEntityColor = sketchEntityColor(definition, color);
  const selection = options.selection || {};
  const manualSelectedEdgeIds = new Set(selection.edgeIds || []);
  const manualSelectedVertexIds = new Set(selection.vertexIds || []);
  const selectedRelationId = selection.relationId || null;
  const {
    outlineVertices: vertices,
    constructionVertices,
    constructionEdges,
    edges: relationEdges,
    vertexMap
  } = sketchEntityMaps(plate.sketch);
  const worldPoint = (vertex) => platePoint(plate, vertex.point || [0, 0]);
  const edges = sketchEdges(plate.sketch);
  const selectedRelation = selectedRelationId
    ? sketchRelations(plate.sketch).find((relation) => relation.id === selectedRelationId)
    : null;
  const relationSelection = relationSelectionEntityIds(selectedRelation, relationEdges);
  const selectedEdgeIds = new Set([...manualSelectedEdgeIds, ...relationSelection.edgeIds]);
  const selectedVertexIds = new Set([...manualSelectedVertexIds, ...relationSelection.vertexIds]);
  const lineSpecs = edges.length
    ? edges.map((edge) => ({ edge, from: vertexMap.get(edge.from), to: vertexMap.get(edge.to) }))
    : vertices.map((vertex, index) => ({ edge: null, from: vertex, to: vertices[(index + 1) % vertices.length] }));
  const facePoints = vertices.map((vertex) => vertex.point || [0, 0]);
  const faces = !showRelations && vertices.length >= 3 && isConvexPolygon(facePoints)
    ? [{
        points: vertices.map(worldPoint),
        color: cleanFillColor,
        opacity: settings.plateSketchCleanFillOpacity ?? 0.24
      }]
    : [];
  const lines = lineSpecs
    .filter(({ from, to }) => from && to)
    .map(({ edge, from, to }) => {
      const selected = edge && selectedEdgeIds.has(edge.id);
      return {
        points: [worldPoint(from), worldPoint(to)],
        color: !showRelations
          ? cleanOutlineColor
          : selected
          ? RELATION_SELECTION_COLOR
          : sketchEntityColor(edge ? entityDefinition.edges[edge.id] : definition.status, fallbackEntityColor),
        collection: "authoring",
        kind: "plate-sketch-edge",
        objectId: plate.id,
        edgeId: edge?.id || null,
        lineWidth: !showRelations
          ? cleanOutlineLineWidth
          : selected
            ? settings.plateSketchSelectedRelationLineWidth ?? 5
            : undefined
      };
    });
  if (showRelations) for (const edge of constructionEdges) {
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const selected = selectedEdgeIds.has(edge.id);
    lines.push({
      points: [worldPoint(from), worldPoint(to)],
      color: selected ? CONSTRUCTION_EDGE_SELECTED_COLOR : settings.plateSketchConstructionEdgeColor || CONSTRUCTION_EDGE_COLOR,
      collection: "authoring",
      kind: "plate-sketch-construction-edge",
      objectId: plate.id,
      edgeId: edge.id,
      lineWidth: selected ? settings.plateSketchSelectedRelationLineWidth ?? 5 : undefined
    });
  }
  const dimensionOverlay = dimensionOverlayForPlate(plate, edges, vertexMap, settings, relationHealth, {
    plain: !showRelations,
    showRelationControls: false,
    dimensionPlacementOffsets: options.dimensionPlacementOffsets || {}
  });
  lines.push(...dimensionOverlay.lines);
  const quickLists = [];
  const handles = vertices.map((vertex, index) => ({
    type: !showRelations ? "circle" : undefined,
    kind: "plate-sketch-vertex",
    target: vertex.id,
    objectId: plate.id,
    plateId: plate.id,
    vertexId: vertex.id,
    vertexIndex: index,
    point: worldPoint(vertex),
    dragAxes: {
      x: v.norm(plate.localAxisY),
      y: v.norm(plate.localAxisZ)
    },
    color: !showRelations
      ? cleanOutlineColor
      : selectedVertexIds.has(vertex.id)
      ? RELATION_SELECTION_COLOR
      : sketchEntityColor(entityDefinition.vertices[vertex.id], fallbackEntityColor),
    radius: !showRelations ? 4 : selectedVertexIds.has(vertex.id) ? 11 : 9,
    hitTolerancePx: !showRelations ? 13 : undefined,
    pickPriority: settings.plateSketchVertexPickPriority ?? 30,
    hoverLabel: "Drag plate corner"
  }));
  if (showRelations) for (const vertex of constructionVertices) {
    const selected = selectedVertexIds.has(vertex.id);
    handles.push({
      type: "square",
      kind: "plate-sketch-construction-vertex",
      target: `${vertex.id}:construction-vertex`,
      objectId: plate.id,
      plateId: plate.id,
      vertexId: vertex.id,
      construction: true,
      point: worldPoint(vertex),
      dragAxes: {
        x: v.norm(plate.localAxisY),
        y: v.norm(plate.localAxisZ)
      },
      color: selected ? RELATION_SELECTION_COLOR : settings.plateSketchConstructionVertexColor || CONSTRUCTION_EDGE_COLOR,
      radius: selected ? 10 : 8,
      hoverLabel: "Drag construction point"
    });
  }
  for (const [index, vertex] of vertices.entries()) {
    const localActions = actionVertexId === vertex.id;
    if (!localActions) continue;
    const point = worldPoint(vertex);
    const fixedRelation = fixedRelationForVertex(plate.sketch, vertex.id);
    quickLists.push({
      id: `${plate.id}:${vertex.id}:corner-quick-list`,
      title: `Corner ${index + 1}`,
      point,
      screenOffsetPx: { x: 14, y: -18 },
      items: [{
        id: "delete-corner",
        label: "Delete corner",
        badge: "Del",
        tone: "danger",
        disabled: vertices.length <= 3,
        title: vertices.length > 3 ? "Remove this corner" : "Cannot remove below 3 corners",
        handle: {
          kind: "plate-sketch-remove-vertex",
          target: `${vertex.id}:remove`,
          objectId: plate.id,
          plateId: plate.id,
          vertexId: vertex.id
        }
      }, {
        id: "notch-corner",
        label: "Add notch",
        badge: "N",
        tone: "primary",
        title: "Add corner notch",
        handle: {
          kind: "plate-sketch-notch-corner",
          target: `${vertex.id}:notch`,
          objectId: plate.id,
          plateId: plate.id,
          vertexId: vertex.id
        }
      }, {
        id: "fix-corner",
        label: fixedRelation ? "Unfix corner" : "Fix corner",
        badge: fixedRelation ? "Unfix" : "Fix",
        tone: fixedRelation ? "muted" : "primary",
        title: fixedRelation ? "Remove fixed relation" : "Fix corner",
        handle: {
          kind: "plate-sketch-fixed-toggle",
          target: `${vertex.id}:fixed`,
          objectId: plate.id,
          plateId: plate.id,
          vertexId: vertex.id,
          relationId: fixedRelation?.id || null
        }
      }, {
        id: "clear-selection",
        label: "Clear selection",
        badge: "Esc",
        tone: "muted",
        handle: {
          kind: "plate-sketch-selection-clear",
          target: `${plate.id}:clear-selection`,
          objectId: plate.id,
          plateId: plate.id
        }
      }]
    });
  }
  for (const edge of edges) {
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const sketchPoint = midpoint(from.point || [0, 0], to.point || [0, 0]);
    handles.push({
      kind: "plate-sketch-edge",
      target: `${edge.id}:edge`,
      objectId: plate.id,
      plateId: plate.id,
      edgeId: edge.id,
      fromVertexId: edge.from,
      toVertexId: edge.to,
      point: platePoint(plate, sketchPoint),
      points: [worldPoint(from), worldPoint(to)],
      dragAxes: {
        x: v.norm(plate.localAxisY),
        y: v.norm(plate.localAxisZ)
      },
      color: !showRelations ? cleanOutlineColor : selectedEdgeIds.has(edge.id) ? RELATION_SELECTION_COLOR : settings.plateSketchEdgeHandleColor || "#f59e0b",
      visible: false,
      radius: 0,
      hitTolerancePx: settings.plateSketchEdgeHitTolerancePx ?? 14,
      hoverLabel: "Drag plate edge"
    });
    handles.push({
      type: "circle",
      kind: "plate-sketch-insert-vertex",
      target: `${edge.id}:insert`,
      objectId: plate.id,
      plateId: plate.id,
      edgeId: edge.id,
      sketchPoint,
      point: platePoint(plate, sketchPoint),
      dragAxes: {
        x: v.norm(plate.localAxisY),
        y: v.norm(plate.localAxisZ)
      },
      color: settings.plateSketchInsertPointColor || cleanOutlineColor,
      hoverColor: settings.plateSketchInsertPointHoverColor || cleanOutlineColor,
      opacity: settings.plateSketchInsertPointOpacity ?? 0.72,
      hoverOpacity: settings.plateSketchInsertPointHoverOpacity ?? 1,
      radius: settings.plateSketchInsertPointRadiusPx ?? 2.5,
      hoverRadiusAddPx: settings.plateSketchInsertPointHoverGrowPx ?? 1.5,
      hitTolerancePx: settings.plateSketchInsertPointHitTolerancePx ?? 14,
      pickPriority: 20,
      hoverLabel: "Drag to add point"
    });
  }
  if (showRelations) for (const edge of constructionEdges) {
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const sketchPoint = midpoint(from.point || [0, 0], to.point || [0, 0]);
    const selected = selectedEdgeIds.has(edge.id);
    handles.push({
      type: "square",
      kind: "plate-sketch-construction-edge",
      target: `${edge.id}:construction-edge`,
      objectId: plate.id,
      plateId: plate.id,
      edgeId: edge.id,
      fromVertexId: edge.from,
      toVertexId: edge.to,
      construction: true,
      point: platePoint(plate, sketchPoint),
      points: [worldPoint(from), worldPoint(to)],
      color: selected ? CONSTRUCTION_EDGE_SELECTED_COLOR : settings.plateSketchConstructionEdgeColor || CONSTRUCTION_EDGE_COLOR,
      visible: false,
      radius: 0,
      hitTolerancePx: 14,
      hoverLabel: "Select construction line"
    });
  }
  const labels = [
    ...dimensionOverlay.labels,
    ...(showRelations && handles.length ? [{
      point: handles[0].point,
      text: "Plate sketch",
      color: fallbackEntityColor,
      className: "creation-start",
      screenOffsetPx: { x: 8, y: -24 }
    }, {
      point: handles[0].point,
      text: `${definition.label}${definition.degreesOfFreedom ? `: ${definition.degreesOfFreedom} DOF` : ""}`,
      color: sketchStatusColor(definition.status),
      className: `plate-sketch-status ${definition.status}`,
      screenOffsetPx: { x: 8, y: -44 }
    }] : [])
  ];
  handles.push(...dimensionOverlay.handles);
  if (showRelations) for (const relation of sketchRelations(plate.sketch)) {
    const sketchPoint = relationPointForSketchRelation(relation, relationEdges, vertexMap);
    if (!sketchPoint) continue;
    const health = relationHealth[relation.id];
    const selected = relation.id === selectedRelationId;
    const associated = !selected && relationTouchesManualSelection(relation, selectedEdgeIds, selectedVertexIds, relationEdges);
    const relationScreenOffset = relation.type === "perpendicular" ? { x: 20, y: 12 } : { x: 9, y: -28 };
    const relationColor = selected
      ? RELATION_SELECTION_COLOR
      : associated
        ? RELATION_ASSOCIATED_COLOR
        : relationHealthColor(health, settings.snapColor || "#38bdf8");
    handles.push({
      kind: "plate-sketch-relation",
      target: `${relation.id}:relation`,
      objectId: plate.id,
      plateId: plate.id,
      relationId: relation.id,
      relationType: relation.type,
      point: platePoint(plate, sketchPoint),
      screenOffsetPx: relationScreenOffset,
      color: relationColor,
      visible: false,
      radius: selected ? 12 : associated ? 11 : 10,
      hitTolerancePx: 24,
      hoverLabel: health?.message || `Select ${sketchRelationLabel(relation).toLowerCase()} relation`
    });
    labels.push({
      point: platePoint(plate, sketchPoint),
      text: sketchRelationBadge(relation),
      color: relationColor,
      className: `snap plate-relation${selected ? " selected" : associated ? " associated" : ""}${relationHealthClass(health)}`,
      title: health?.message || `${sketchRelationLabel(relation)} - click to inspect, Delete to remove`,
      screenOffsetPx: relationScreenOffset
    });
  }
  if (showRelations && (actionVertexId || actionEdgeId)) {
    const localVertexQuickListOnly = actionVertexId && manualSelectedVertexIds.size === 1 && manualSelectedEdgeIds.size === 0;
    const actionOverlay = relationActionOverlayForSelection(plate, {
      edges: relationEdges,
      vertexMap,
      constructionEdgeIds: new Set(constructionEdges.map((edge) => edge.id)),
      selectedEdgeIds: [...manualSelectedEdgeIds],
      selectedVertexIds: [...manualSelectedVertexIds],
      settings
    });
    if (!localVertexQuickListOnly) {
      handles.push(...actionOverlay.handles);
      labels.push(...actionOverlay.labels);
      quickLists.push(...arrayValues(actionOverlay.quickLists));
    }
  }
  if (options.snap?.point) {
    const snapOverlay = snapPointOverlay({
      snap: options.snap,
      rawPoint: options.snap.rawPoint,
      settings,
      objectId: plate.id,
      handleRadius: 11
    });
    lines.push(...snapOverlay.lines);
    handles.push(...snapOverlay.handles);
    labels.push(...snapOverlay.labels);
  }
  return {
    faces,
    lines,
    handles,
    labels,
    quickLists,
    suppressHighlightObjectIds: !showRelations ? [plate.id] : []
  };
}

function relationActionOverlayForSelection(plate, { edges, vertexMap, constructionEdgeIds = new Set(), selectedEdgeIds, selectedVertexIds, settings = {} }) {
  const handles = [];
  const labels = [];
  const quickLists = [];
  const actionColor = settings.plateSketchRelationActionColor || RELATION_ACTION_COLOR;
  const actionLabel = (type, existingRelation = null) => {
    if (type === "clear") return "Clear selection";
    if (type === "construction-line") return "Construction line";
    const label = sketchRelationLabel(existingRelation || { type });
    return existingRelation ? `Select ${label}` : label;
  };
  const actionItem = (basePoint, type, index, options = {}) => {
    const existingRelation = type === "clear" || type === "construction-line"
      ? null
      : existingRelationForAction(plate.sketch, type, options);
    const preview = existingRelation || type === "clear" || type === "construction-line"
      ? null
      : relationActionPreview(plate, type, options);
    const previewStatus = relationHealthStatus(preview?.health);
    const text = options.label || relationActionBadge(type);
    const color = type === "clear"
      ? "#64748b"
      : existingRelation
        ? RELATION_SELECTION_COLOR
        : preview?.health
        ? relationHealthColor(preview.health, actionColor)
        : actionColor;
    const title = options.hoverLabel || (
      type === "clear"
        ? "Clear sketch selection"
        : existingRelation
          ? `Select existing ${sketchRelationLabel(existingRelation).toLowerCase()} relation`
          : previewStatus === "conflicted"
            ? `Add ${text} relation - will conflict`
            : previewStatus === "redundant"
              ? `Add ${text} relation - redundant`
              : previewStatus === "reference"
                ? `Add ${text} relation - reference`
                : `Add ${text} relation`
    );
    return {
      id: `${type}:${index}`,
      label: options.menuLabel || actionLabel(type, existingRelation),
      badge: text,
      tone: type === "clear"
        ? "muted"
        : existingRelation
          ? "existing"
          : previewStatus && previewStatus !== "ok"
            ? previewStatus
            : "primary",
      title,
      handle: {
        kind: type === "clear" ? "plate-sketch-selection-clear" : "plate-sketch-relation-action",
        target: `${plate.id}:${type}:${index}`,
        objectId: plate.id,
        plateId: plate.id,
        relationType: type,
        existingRelationId: existingRelation?.id || undefined,
        edgeId: options.edgeId || undefined,
        edgeIds: options.edgeIds || undefined,
        vertexId: options.vertexId || undefined,
        vertexIds: options.vertexIds || undefined,
        targetEdgeId: options.targetEdgeId || undefined,
        targetVertexId: options.targetVertexId || undefined,
        angle: options.angle ?? undefined,
        distance: options.distance ?? undefined,
        draggable: false,
        point: platePoint(plate, basePoint),
        color,
        hoverLabel: title
      }
    };
  };
  const pushActionList = (basePoint, actions, optionsForType = () => ({})) => {
    const items = actions.map((type, index) => actionItem(basePoint, type, index, optionsForType(type, index)));
    if (!items.length) return;
    quickLists.push({
      id: `${plate.id}:relation-actions:${quickLists.length}`,
      title: "Sketch options",
      point: platePoint(plate, basePoint),
      screenOffsetPx: { x: 14, y: -18 },
      items
    });
  };

  if (selectedVertexIds.length === 2) {
    const first = vertexMap.get(selectedVertexIds[0]);
    const second = vertexMap.get(selectedVertexIds[1]);
    if (!first || !second) return { handles, labels, quickLists };
    const basePoint = midpoint(first.point || [0, 0], second.point || [0, 0]);
    if (selectedEdgeIds.length === 1) {
      const pair = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
      if (!pair) return { handles, labels, quickLists };
      const actionPoint = midpoint(basePoint, midpoint(pair.from, pair.to));
      const actions = ["symmetric", "clear"];
      pushActionList(actionPoint, actions, (type) => ({
        vertexIds: selectedVertexIds,
        edgeId: selectedEdgeIds[0],
        label: type === "clear" ? "CLR" : relationActionBadge(type),
        hoverLabel: type === "clear" ? "Clear sketch selection" : `Add ${sketchRelationLabel({ type }).toLowerCase()} relation`
      }));
      return { handles, labels, quickLists };
    }
    const actions = ["distance", "coincident", "horizontal-points", "vertical-points", "construction-line", "clear"];
    pushActionList(basePoint, actions, (type) => ({
      vertexIds: selectedVertexIds,
      targetVertexId: selectedVertexIds[1],
      distance: type === "distance" ? len2(sub2(second.point || [0, 0], first.point || [0, 0])) : undefined,
      label: type === "clear" ? "CLR" : relationActionBadge(type),
      hoverLabel: type === "clear" ? "Clear sketch selection" : `Add ${sketchRelationLabel({ type }).toLowerCase()} relation`
    }));
    return { handles, labels, quickLists };
  }

  if (selectedVertexIds.length === 1 && selectedEdgeIds.length === 1) {
    const vertex = vertexMap.get(selectedVertexIds[0]);
    const pair = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
    if (!vertex || !pair) return { handles, labels, quickLists };
    const basePoint = midpoint(vertex.point || [0, 0], midpoint(pair.from, pair.to));
    const pointLineAllowed = pair.edge.from !== selectedVertexIds[0] && pair.edge.to !== selectedVertexIds[0];
    const actions = pointLineAllowed
      ? ["point-on-line", "midpoint", "clear"]
      : ["clear"];
    pushActionList(basePoint, actions, (type) => ({
      vertexId: selectedVertexIds[0],
      edgeId: selectedEdgeIds[0],
      label: type === "clear" ? "CLR" : relationActionBadge(type),
      hoverLabel: type === "clear" ? "Clear sketch selection" : `Add ${sketchRelationLabel({ type }).toLowerCase()} relation`
    }));
    return { handles, labels, quickLists };
  }

  if (selectedVertexIds.length === 1) {
    const vertex = vertexMap.get(selectedVertexIds[0]);
    if (!vertex) return { handles, labels, quickLists };
    const actions = ["fixed", "clear"];
    pushActionList(vertex.point || [0, 0], actions, (type) => ({
      vertexId: vertex.id,
      label: type === "clear" ? "CLR" : undefined
    }));
    return { handles, labels, quickLists };
  }

  if (selectedEdgeIds.length === 1) {
    const edgeId = selectedEdgeIds[0];
    const pair = edgePointPair(edges, vertexMap, edgeId);
    if (!pair) return { handles, labels, quickLists };
    const basePoint = midpoint(pair.from, pair.to);
    const actions = constructionEdgeIds.has(edgeId)
      ? ["horizontal", "vertical", "fixed", "clear"]
      : ["horizontal", "vertical", "fixed", "construction-line", "clear"];
    pushActionList(basePoint, actions, (type) => ({
      edgeId,
      label: type === "clear" ? "CLR" : undefined
    }));
    return { handles, labels, quickLists };
  }

  if (selectedEdgeIds.length === 2) {
    const first = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
    const second = edgePointPair(edges, vertexMap, selectedEdgeIds[1]);
    if (!first || !second) return { handles, labels, quickLists };
    const basePoint = midpoint(midpoint(first.from, first.to), midpoint(second.from, second.to));
    const actions = ["parallel", "collinear", "perpendicular", "equal-length", "angle", "clear"];
    pushActionList(basePoint, actions, (type) => ({
      edgeIds: selectedEdgeIds,
      targetEdgeId: selectedEdgeIds[1],
      angle: type === "angle" ? sketchEdgeAngleDegrees(plate.sketch, selectedEdgeIds) : undefined,
      label: type === "clear" ? "CLR" : undefined
    }));
  }

  return { handles, labels, quickLists };
}

function edgeDragContext(plate, edgeId, settings = {}, options = {}) {
  const edges = sketchEdges(plate.sketch);
  const edge = edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const loop = orderedSketchLoop(plate.sketch);
  const index = loop.findIndex((item) => item.outgoingEdgeId === edgeId);
  if (index < 0) return null;
  const from = loop[index];
  const to = loop[(index + 1) % loop.length];
  const previous = loop[(index + loop.length - 1) % loop.length];
  const next = loop[(index + 2) % loop.length];
  const baseFrom = [...from.point];
  const baseTo = [...to.point];
  const edgeConstraint = options.edgeConstraint || edgeTangentConstraint(plate.sketch, edgeId);
  const tangent = edgeConstraint ? edgeConstraint.tangent : norm2(sub2(baseTo, baseFrom));
  if (len2(tangent) <= EPSILON) return null;
  const windingSign = Math.sign(signedArea(loop.map((item) => item.point))) || 1;
  const normal = edgeConstraint ? edgeOutwardNormal([0, 0], tangent, windingSign) : edgeOutwardNormal(baseFrom, baseTo, windingSign);
  const baseMidpoint = midpoint(baseFrom, baseTo);
  const snapCandidates = [];
  const vertexIds = new Set([from.vertexId, to.vertexId]);
  for (const item of loop) {
    if (vertexIds.has(item.vertexId)) continue;
    snapCandidates.push({
      projection: dot2(item.point, normal),
      label: `Vertex ${item.vertexId}`
    });
  }
  for (const candidateEdge of edges) {
    if (candidateEdge.id === edgeId) continue;
    const candidateFrom = loop.find((item) => item.vertexId === candidateEdge.from);
    const candidateTo = loop.find((item) => item.vertexId === candidateEdge.to);
    if (!candidateFrom || !candidateTo) continue;
    const candidateTangent = norm2(sub2(candidateTo.point, candidateFrom.point));
    if (Math.abs(dot2(candidateTangent, tangent)) < 0.985) continue;
    snapCandidates.push({
      projection: dot2(midpoint(candidateFrom.point, candidateTo.point), normal),
      label: `Collinear ${candidateEdge.id}`,
      relations: [{ type: "collinear", edgeIds: [edgeId, candidateEdge.id], targetEdgeId: edgeId }]
    });
  }
  return {
    edgeId,
    fromVertexId: from.vertexId,
    toVertexId: to.vertexId,
    baseFrom,
    baseTo,
    previousPoint: previous.point,
    nextPoint: next.point,
    fromProjectionSide: Math.sign(dot2(baseFrom, normal) - dot2(previous.point, normal)) || 1,
    toProjectionSide: Math.sign(dot2(baseTo, normal) - dot2(next.point, normal)) || 1,
    normal,
    baseProjection: dot2(baseMidpoint, normal),
    baseMidpoint,
    snapCandidates,
    edgeConstraint,
    minAdjacentLength: settings.plateSketchMinEdgeLength ?? 1
  };
}

function shiftedEdgePoints(drag, delta) {
  const offset = mul2(drag.normal, delta);
  return {
    from: add2(drag.baseFrom, offset),
    to: add2(drag.baseTo, offset),
    midpoint: add2(drag.baseMidpoint, offset)
  };
}

function validEdgeDelta(drag, delta) {
  const shifted = shiftedEdgePoints(drag, delta);
  const fromProjectionGap = (dot2(shifted.from, drag.normal) - dot2(drag.previousPoint, drag.normal)) * drag.fromProjectionSide;
  const toProjectionGap = (dot2(shifted.to, drag.normal) - dot2(drag.nextPoint, drag.normal)) * drag.toProjectionSide;
  return len2(sub2(shifted.from, drag.previousPoint)) > drag.minAdjacentLength
    && len2(sub2(shifted.to, drag.nextPoint)) > drag.minAdjacentLength
    && fromProjectionGap > drag.minAdjacentLength
    && toProjectionGap > drag.minAdjacentLength;
}

function edgeSnapCandidates(drag, rawDelta, handle, settings = {}, input = {}, options = {}) {
  const candidates = drag.snapCandidates.map((candidate) => ({
    ...candidate,
    point: add2(drag.baseMidpoint, mul2(drag.normal, candidate.projection - drag.baseProjection)),
    type: candidate.type || "plate-sketch-edge-align",
    semanticRole: candidate.semanticRole || "edge-drag-alignment",
    priority: candidate.priority ?? 42
  }));
  const gridStep = adaptiveSnapGridStepForHandle(handle, settings, {
    direction: drag.normal,
    speedPx: Math.hypot(input.dx || 0, input.dy || 0),
    gridPrecision: options.axisLocked ? "micro" : "fine"
  });
  if (gridStep > EPSILON) {
    const delta = snapScalarToGrid(rawDelta, gridStep);
    candidates.push({
      point: add2(drag.baseMidpoint, mul2(drag.normal, delta)),
      projection: drag.baseProjection + delta,
      label: `${options.axisLocked ? drag.edgeConstraint?.label || "Relation" : "Plate grid"} ${formatMm(gridStep)}`,
      type: "plate-sketch-grid",
      semanticRole: "adaptive-grid",
      priority: 8
    });
  }
  return candidates;
}

function snappedEdgeDelta(drag, rawDelta, handle, settings = {}, input = {}, options = {}) {
  if (input.sketchSnapEnabled === false) {
    return validEdgeDelta(drag, rawDelta)
      ? { delta: rawDelta, label: null, relations: [], snapped: false }
      : { delta: null, label: null, relations: [], snapped: false };
  }
  if (input.snapCandidate?.point) {
    const point = input.snapCandidate.point;
    const delta = dot2(point, drag.normal) - drag.baseProjection;
    const maxWorld = snapSketchWorldTolerance(settings, "edge", DEFAULT_EDGE_SNAP_MAX_WORLD, { event: input.event });
    const rawPoint = add2(drag.baseMidpoint, mul2(drag.normal, rawDelta));
    if (
      validEdgeDelta(drag, delta)
      && Math.abs(delta - rawDelta) <= maxWorld
      && (!input.snapCandidate.maxWorldDistance || len2(sub2(point, rawPoint)) <= input.snapCandidate.maxWorldDistance)
    ) {
      return {
        delta,
        label: input.snapCandidate.label,
        relations: input.snapCandidate.relations || [],
        snapped: true
      };
    }
  }
  return validEdgeDelta(drag, rawDelta)
    ? { delta: rawDelta, label: null, relations: [], snapped: false }
    : { delta: null, label: null, snapped: false };
}

function vertexDragContext(plate, vertexId, settings = {}) {
  const loop = orderedSketchLoop(plate.sketch);
  const index = loop.findIndex((item) => item.vertexId === vertexId);
  if (index < 0) return null;
  const previous = loop[(index + loop.length - 1) % loop.length];
  const current = loop[index];
  const next = loop[(index + 1) % loop.length];
  const relationHealth = plateSketchRelationHealth(plate);
  const incomingConstraint = edgeTangentConstraint(plate.sketch, current.incomingEdgeId, relationHealth);
  const outgoingConstraint = edgeTangentConstraint(plate.sketch, current.outgoingEdgeId, relationHealth);
  const incomingRelation = incomingConstraint?.relation || null;
  const outgoingRelation = outgoingConstraint?.relation || null;
  return {
    vertexId,
    basePoint: [...current.point],
    previousPoint: [...previous.point],
    nextPoint: [...next.point],
    previousVertexId: previous.vertexId,
    nextVertexId: next.vertexId,
    incomingEdgeId: current.incomingEdgeId,
    outgoingEdgeId: current.outgoingEdgeId,
    incomingEqualLength: equalLengthTarget(plate.sketch, current.incomingEdgeId),
    outgoingEqualLength: equalLengthTarget(plate.sketch, current.outgoingEdgeId),
    equalLengthTargets: equalLengthSnapTargets(plate.sketch, [current.incomingEdgeId, current.outgoingEdgeId]),
    incomingConstraint,
    outgoingConstraint,
    incomingRelation,
    outgoingRelation,
    hasLockedAdjacentRelation: Boolean(incomingConstraint || outgoingConstraint),
    incomingOrientation: incomingRelation?.type === "horizontal" ? "y" : incomingRelation?.type === "vertical" ? "z" : axisOrientation(previous.point, current.point),
    outgoingOrientation: outgoingRelation?.type === "horizontal" ? "y" : outgoingRelation?.type === "vertical" ? "z" : axisOrientation(current.point, next.point),
    vertexIndex: index,
    vertexIds: loop.map((item) => item.vertexId),
    baseAreaSign: Math.sign(signedArea(loop.map((item) => item.point))) || 1,
    points: loop.map((item) => [...item.point]),
    otherVertices: loop
      .filter((item) => item.vertexId !== vertexId)
      .map((item) => ({ vertexId: item.vertexId, point: [...item.point] })),
    edgeMidpointTargets: sketchEdges(plate.sketch)
      .filter((edge) => edge.from !== vertexId && edge.to !== vertexId)
      .map((edge) => {
        const from = loop.find((item) => item.vertexId === edge.from);
        const to = loop.find((item) => item.vertexId === edge.to);
        return from && to ? { edgeId: edge.id, point: midpoint(from.point, to.point) } : null;
      })
      .filter(Boolean),
    minAdjacentLength: settings.plateSketchMinEdgeLength ?? 1
  };
}

function constructionVertexDragContext(plate, vertexId) {
  const vertex = sketchConstructionVertices(plate.sketch).find((item) => item.id === vertexId);
  if (!vertex) return null;
  return {
    vertexId,
    basePoint: [...(vertex.point || [0, 0])]
  };
}

function snappedFreeSketchPoint(drag, rawPoint, handle, settings = {}, input = {}) {
  if (input.sketchSnapEnabled === false) {
    return {
      point: rawPoint,
      label: null,
      snapped: false
    };
  }
  if (input.snapCandidate?.point) {
    return {
      point: input.snapCandidate.point,
      label: input.snapCandidate.label || "Snap",
      relations: input.snapCandidate.relations || [],
      snapped: true
    };
  }
  return {
    point: rawPoint,
    label: null,
    relations: [],
    snapped: false
  };
}

function freeSketchPointSnapCandidates(drag, rawPoint, handle, settings = {}, input = {}, options = {}) {
  const gridStep = adaptiveSnapGridStepForHandle(handle, settings, {
    speedPx: Math.hypot(input.dx || 0, input.dy || 0),
    gridPrecision: options.gridPrecision || "micro"
  });
  if (gridStep <= EPSILON) return [];
  const rawDelta = sub2(rawPoint, drag.basePoint);
  return [{
    point: [
      drag.basePoint[0] + snapScalarToGrid(rawDelta[0], gridStep),
      drag.basePoint[1] + snapScalarToGrid(rawDelta[1], gridStep)
    ],
    label: `Plate grid ${formatMm(gridStep)}`,
    type: "plate-sketch-grid",
    semanticRole: "adaptive-grid",
    priority: 8
  }];
}

function pointsWithUpdates(drag, updates) {
  const updateMap = new Map(updates.map((item) => [item.vertexId, item.point]));
  return drag.points.map((point, index) => updateMap.get(drag.vertexIds[index]) || point);
}

function validUpdatedPoints(drag, points) {
  for (let index = 0; index < points.length; index += 1) {
    if (len2(sub2(points[index], points[(index + 1) % points.length])) <= drag.minAdjacentLength) return false;
  }
  const area = signedArea(points);
  if (Math.abs(area) <= EPSILON) return false;
  if ((Math.sign(area) || drag.baseAreaSign) !== drag.baseAreaSign) return false;
  return !hasSelfIntersection(points);
}

function validVertexPoint(drag, point) {
  return validUpdatedPoints(drag, pointsWithUpdates(drag, [{ vertexId: drag.vertexId, point }]));
}

function adjacentPointForLockedCorner(adjacent, point, orientation) {
  return orientation === "y"
    ? [adjacent[0], point[1]]
    : [point[0], adjacent[1]];
}

function adjacentPointForConstraint(adjacent, point, constraint, fallbackOrientation) {
  const tangent = constraint?.tangent;
  if (Array.isArray(tangent) && len2(tangent) > EPSILON) {
    const projection = dot2(sub2(adjacent, point), tangent);
    return add2(point, mul2(tangent, projection));
  }
  return adjacentPointForLockedCorner(adjacent, point, fallbackOrientation);
}

function lockedVertexResult(drag, rawPoint, handle, settings = {}, input = {}) {
  if (input.sketchSnapEnabled === false) {
    const updateMap = new Map([[drag.vertexId, { vertexId: drag.vertexId, point: rawPoint }]]);
    if (drag.incomingConstraint) {
      updateMap.set(drag.previousVertexId, {
        vertexId: drag.previousVertexId,
        point: adjacentPointForConstraint(drag.previousPoint, rawPoint, drag.incomingConstraint, drag.incomingOrientation)
      });
    }
    if (drag.outgoingConstraint) {
      updateMap.set(drag.nextVertexId, {
        vertexId: drag.nextVertexId,
        point: adjacentPointForConstraint(drag.nextPoint, rawPoint, drag.outgoingConstraint, drag.outgoingOrientation)
      });
    }
    const updates = [...updateMap.values()];
    const points = pointsWithUpdates(drag, updates);
    return validUpdatedPoints(drag, points)
      ? { point: rawPoint, updates, label: null, snapped: false }
      : { point: null, updates: [], label: null, snapped: false, blocked: true };
  }
  const point = input.snapCandidate?.point || rawPoint;
  const label = input.snapCandidate?.label || null;
  const updateMap = new Map([[drag.vertexId, { vertexId: drag.vertexId, point }]]);
  if (drag.incomingConstraint) {
    updateMap.set(drag.previousVertexId, {
      vertexId: drag.previousVertexId,
      point: adjacentPointForConstraint(drag.previousPoint, point, drag.incomingConstraint, drag.incomingOrientation)
    });
  }
  if (drag.outgoingConstraint) {
    updateMap.set(drag.nextVertexId, {
      vertexId: drag.nextVertexId,
      point: adjacentPointForConstraint(drag.nextPoint, point, drag.outgoingConstraint, drag.outgoingOrientation)
    });
  }
  const updates = [...updateMap.values()];
  const points = pointsWithUpdates(drag, updates);
  return validUpdatedPoints(drag, points)
    ? { point, updates, label, snapped: Boolean(input.snapCandidate?.point) }
    : { point: null, updates: [], label: null, snapped: false, blocked: true };
}

function snappedNotchSize(plate, vertexId, settings = {}, viewer = null) {
  const loop = orderedSketchLoop(plate.sketch);
  const index = loop.findIndex((item) => item.vertexId === vertexId);
  if (index < 0) return undefined;
  const previous = loop[(index + loop.length - 1) % loop.length];
  const corner = loop[index];
  const next = loop[(index + 1) % loop.length];
  const previousLength = len2(sub2(previous.point, corner.point));
  const nextLength = len2(sub2(next.point, corner.point));
  if (previousLength <= EPSILON || nextLength <= EPSILON) return undefined;
  const preferredSize = positiveSetting(settings.plateSketchDefaultNotchSize, DEFAULT_NOTCH_SIZE);
  const maxSize = positiveSetting(settings.plateSketchDefaultNotchMaxSize, DEFAULT_NOTCH_MAX_SIZE);
  const rawSize = Math.max(1, Math.min(preferredSize, maxSize, previousLength * 0.2, nextLength * 0.2));
  const gridStep = adaptiveSnapGridStep(viewer?.screenScale?.() || 1, settings, {
    gridPrecision: "micro"
  });
  return Math.max(gridStep, snapScalarToGrid(rawSize, gridStep));
}

function pushVertexSnapCandidate(candidates, point, label, priority = 0, options = {}) {
  if (!Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value))) return;
  candidates.push({
    point,
    label,
    priority,
    relations: Array.isArray(options.relations) ? options.relations.filter(Boolean) : [],
    maxWorldDistance: Number.isFinite(options.maxWorldDistance) && options.maxWorldDistance > 0 ? options.maxWorldDistance : null
  });
}

function pushEqualLengthCandidate(candidates, edgeId, anchor, rawPoint, target, label, priority = 45, maxWorldDistance = DEFAULT_VERTEX_EQUAL_SNAP_MAX_WORLD) {
  if (!target?.length || target.length <= EPSILON) return;
  const otherEdgeId = target.otherEdgeId || target.edgeId;
  if (!edgeId || !otherEdgeId || edgeId === otherEdgeId) return;
  const direction = norm2(sub2(rawPoint, anchor));
  if (len2(direction) <= EPSILON) return;
  pushVertexSnapCandidate(candidates, add2(anchor, mul2(direction, target.length)), label, priority, {
    relations: [{ type: "equal-length", edgeIds: [edgeId, otherEdgeId] }],
    maxWorldDistance
  });
}

function pushAxisRelationCandidate(candidates, edgeId, anchor, rawPoint, relationType, label, priority = 38, maxWorldDistance = DEFAULT_VERTEX_RELATION_SNAP_MAX_WORLD) {
  if (!edgeId) return;
  const point = relationType === "horizontal"
    ? [rawPoint[0], anchor[1]]
    : [anchor[0], rawPoint[1]];
  pushVertexSnapCandidate(candidates, point, label, priority, {
    relations: [{ type: relationType, edgeId }],
    maxWorldDistance
  });
}

function vertexSnapCandidates(drag, rawPoint, handle, settings = {}, input = {}) {
  if (input.sketchSnapEnabled === false) return [];
  const candidates = [];
  const relationSnaps = drag.suppressRelationSnaps !== true;
  const axisRelationSnaps = relationSnaps && drag.suppressAxisRelationSnaps !== true;
  const angleRelationSnaps = relationSnaps && drag.suppressAngleRelationSnaps !== true;
  const equalLengthSnaps = relationSnaps && drag.suppressEqualLengthSnaps !== true;
  const relationMaxWorld = snapSketchWorldTolerance(settings, "relation", DEFAULT_VERTEX_RELATION_SNAP_MAX_WORLD, { event: input.event });
  const equalLengthMaxWorld = snapSketchWorldTolerance(settings, "equalLength", DEFAULT_VERTEX_EQUAL_SNAP_MAX_WORLD, { event: input.event });
  const angleMaxWorld = snapSketchWorldTolerance(settings, "angle", DEFAULT_VERTEX_ANGLE_SNAP_MAX_WORLD, { event: input.event });
  const gridStep = adaptiveSnapGridStepForHandle(handle, settings, {
    speedPx: Math.hypot(input.dx || 0, input.dy || 0),
    gridPrecision: "micro"
  });
  if (gridStep > EPSILON) {
    const gridDelta = sub2(rawPoint, drag.basePoint);
    pushVertexSnapCandidate(candidates, [
      drag.basePoint[0] + Math.round(gridDelta[0] / gridStep) * gridStep,
      drag.basePoint[1] + Math.round(gridDelta[1] / gridStep) * gridStep
    ], `Plate grid ${formatMm(gridStep)}`, 10);
  }
  const adjacentAxisRelation = (vertexId, relationType) => {
    if (vertexId === drag.previousVertexId) return { type: relationType, edgeId: drag.incomingEdgeId };
    if (vertexId === drag.nextVertexId) return { type: relationType, edgeId: drag.outgoingEdgeId };
    return null;
  };
  for (const item of drag.otherVertices) {
    if (relationSnaps) {
      pushVertexSnapCandidate(candidates, item.point, `Coincident ${item.vertexId}`, 72, {
        relations: [{ type: "coincident", vertexIds: [drag.vertexId, item.vertexId] }],
        maxWorldDistance: relationMaxWorld
      });
    }
    if (axisRelationSnaps) {
      pushVertexSnapCandidate(candidates, [item.point[0], rawPoint[1]], `Align Y ${item.vertexId}`, 30, {
        relations: [adjacentAxisRelation(item.vertexId, "vertical")],
        maxWorldDistance: relationMaxWorld
      });
      pushVertexSnapCandidate(candidates, [rawPoint[0], item.point[1]], `Align Z ${item.vertexId}`, 30, {
        relations: [adjacentAxisRelation(item.vertexId, "horizontal")],
        maxWorldDistance: relationMaxWorld
      });
    }
  }
  if (axisRelationSnaps) {
    pushAxisRelationCandidate(candidates, drag.incomingEdgeId, drag.previousPoint, rawPoint, "horizontal", `Horizontal ${drag.incomingEdgeId}`, 38, relationMaxWorld);
    pushAxisRelationCandidate(candidates, drag.incomingEdgeId, drag.previousPoint, rawPoint, "vertical", `Vertical ${drag.incomingEdgeId}`, 38, relationMaxWorld);
    pushAxisRelationCandidate(candidates, drag.outgoingEdgeId, drag.nextPoint, rawPoint, "horizontal", `Horizontal ${drag.outgoingEdgeId}`, 38, relationMaxWorld);
    pushAxisRelationCandidate(candidates, drag.outgoingEdgeId, drag.nextPoint, rawPoint, "vertical", `Vertical ${drag.outgoingEdgeId}`, 38, relationMaxWorld);
  }

  if (equalLengthSnaps) {
    pushEqualLengthCandidate(candidates, drag.incomingEdgeId, drag.previousPoint, rawPoint, drag.incomingEqualLength, `Equal ${drag.incomingEqualLength?.otherEdgeId || ""}`.trim(), 58, equalLengthMaxWorld);
    pushEqualLengthCandidate(candidates, drag.outgoingEdgeId, drag.nextPoint, rawPoint, drag.outgoingEqualLength, `Equal ${drag.outgoingEqualLength?.otherEdgeId || ""}`.trim(), 58, equalLengthMaxWorld);
    for (const target of drag.equalLengthTargets || []) {
      pushEqualLengthCandidate(candidates, drag.incomingEdgeId, drag.previousPoint, rawPoint, target, `Equal ${target.edgeId}`, 42, equalLengthMaxWorld);
      pushEqualLengthCandidate(candidates, drag.outgoingEdgeId, drag.nextPoint, rawPoint, target, `Equal ${target.edgeId}`, 42, equalLengthMaxWorld);
    }
  }

  const chord = sub2(drag.nextPoint, drag.previousPoint);
  const radius = angleRelationSnaps ? len2(chord) / 2 : 0;
  if (angleRelationSnaps && radius > EPSILON) {
    const center = midpoint(drag.previousPoint, drag.nextPoint);
    const fromCenter = sub2(rawPoint, center);
    const distance = len2(fromCenter);
    if (distance > EPSILON) {
      pushVertexSnapCandidate(candidates, add2(center, mul2(fromCenter, radius / distance)), "90 deg corner", 60, {
        relations: [{ type: "perpendicular", edgeIds: [drag.incomingEdgeId, drag.outgoingEdgeId] }],
        maxWorldDistance: angleMaxWorld
      });
    }
  }
  return candidates;
}

function snappedVertexPoint(drag, rawPoint, handle, settings = {}, input = {}) {
  const snap = input.snapCandidate;
  if (snap?.point && validVertexPoint(drag, snap.point)) {
    if (!snap.maxWorldDistance || len2(sub2(snap.point, rawPoint)) <= snap.maxWorldDistance) {
      return { point: snap.point, label: snap.label, relations: snap.relations || [], snapped: true };
    }
  }
  return validVertexPoint(drag, rawPoint)
    ? { point: rawPoint, label: null, relations: [], snapped: false }
    : { point: null, label: null, relations: [], snapped: false, blocked: true };
}

export function createPlateSketchEditController({ viewer, api, snapManager, settings = {}, onProjectChange, onStatusChange, onSelectionChange, requestEdgeLengthInput = null }) {
  let activePlateId = null;
  let drag = null;
  let activeSnap = null;
  let sketchMode = "clean";
  let actionTarget = null;
  let selection = { edgeIds: [], vertexIds: [], relationId: null };
  let lastDragInput = null;
  const dimensionPlacementOffsets = new Map();

  function plate() {
    return activePlate(api.project(), activePlateId);
  }

  function resolveSketchSnapCandidate(rawPoint, input = {}, localCandidates = [], options = {}) {
    const current = plate();
    if (!sketchSnapEnabled(input) || !current || !input?.screen || !snapManager || !Array.isArray(rawPoint)) return null;
    const plane = plateSketchPlane(current);
    const result = snapManager.resolve({
      screen: input.screen,
      rawPoint: platePoint(current, rawPoint),
      event: input.event,
      context: {
        tool: "plate-sketch",
        phase: options.phase || "edit",
        event: input.event,
        workPlane: plane,
        projectToPlane: true,
        includeLines: true,
        excludeObjectId: current.id,
        activeSketch: {
          plate: current,
          candidates: localCandidates
        }
      }
    });
    if (!result.accepted || !v.isVec3(result.pointWorld)) return null;
    const point = Array.isArray(result.snap?.localPoint)
      ? [...result.snap.localPoint]
      : plateSketchPointFromWorld(current, result.pointWorld);
    if (!Array.isArray(point) || point.some((value) => !Number.isFinite(value))) return null;
    return {
      point,
      worldPoint: result.pointWorld,
      rawWorldPoint: platePoint(current, rawPoint),
      label: result.label || result.snap?.label || "Snap",
      priority: result.snap?.priority || 88,
      relations: result.relationHints || result.snap?.relations || [],
      maxWorldDistance: result.snap?.maxWorldDistance || null,
      snap: result.snap
    };
  }

  function sketchSnapEnabled(input = {}) {
    if (!snapManager) return true;
    const profile = snapManager.profile?.({ event: input.event });
    if (profile && !profile.enabled) return false;
    const scope = snapManager.scope?.() || {};
    return scope.activeSketch !== false;
  }

  function selectionForPlate(current) {
    if (!current) return { edgeIds: [], vertexIds: [], relationId: null };
    const { edges, vertices } = sketchEntityMaps(current.sketch);
    const edgeIds = new Set(edges.map((edge) => edge.id));
    const vertexIds = new Set(vertices.map((vertex) => vertex.id));
    const relationIds = new Set(sketchRelations(current.sketch).map((relation) => relation.id));
    if (actionTarget?.kind === "edge" && !edgeIds.has(actionTarget.edgeId)) actionTarget = null;
    if (actionTarget?.kind === "vertex" && !vertexIds.has(actionTarget.vertexId)) actionTarget = null;
    selection = {
      edgeIds: selection.edgeIds.filter((edgeId) => edgeIds.has(edgeId)).slice(0, 2),
      vertexIds: selection.vertexIds.filter((vertexId) => vertexIds.has(vertexId)).slice(0, 2),
      relationId: relationIds.has(selection.relationId) ? selection.relationId : null
    };
    return selection;
  }

  function renderOverlay() {
    const current = plate();
    viewer.setAuthoringOverlay(current ? overlayForPlate(current, {
      settings,
      snap: activeSnap,
      selection: selectionForPlate(current),
      showRelations: sketchMode === "relations",
      actionTarget,
      dimensionPlacementOffsets: Object.fromEntries(dimensionPlacementOffsets)
    }) : null);
  }

  function emitSelectionChange(options = {}) {
    if (options.notify === false || typeof onSelectionChange !== "function") return;
    const current = plate();
    onSelectionChange({
      plateId: current?.id || activePlateId || null,
      selection: current ? { ...selectionForPlate(current), sketchMode } : { edgeIds: [], vertexIds: [], relationId: null, sketchMode }
    });
  }

  function clear(options = {}) {
    const hadActivePlate = Boolean(activePlateId);
    activePlateId = null;
    drag = null;
    lastDragInput = null;
    activeSnap = null;
    sketchMode = "clean";
    actionTarget = null;
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    if (options.overlay && hadActivePlate) viewer.setAuthoringOverlay(null);
    emitSelectionChange(options);
  }

  function defaultSketchMode(options = {}) {
    if (options.sketchMode) return options.sketchMode === "clean" ? "clean" : "relations";
    return "relations";
  }

  function activeState() {
    return {
      plateId: activePlateId,
      sketchMode
    };
  }

  function setSketchMode(mode, options = {}) {
    const current = plate();
    if (!current) return false;
    sketchMode = mode === "relations" ? "relations" : "clean";
    actionTarget = null;
    activeSnap = null;
    if (sketchMode === "clean" && options.keepSelection !== true) {
      selection = { edgeIds: [], vertexIds: [], relationId: null };
    }
    emitSelectionChange(options);
    if (options.render !== false) renderOverlay();
    if (options.status !== false) {
      onStatusChange?.(sketchMode === "relations"
        ? "Plate sketch: relations visible"
        : "Plate sketch: clean view");
    }
    return true;
  }

  function toggleRelations(options = {}) {
    return setSketchMode(sketchMode === "relations" ? "clean" : "relations", options);
  }

  function selectObject(objectId, options = {}) {
    if (api.project().objectIndex?.[objectId]?.collection !== "plates") {
      clear({ overlay: true });
      return false;
    }
    if (activePlateId !== objectId) {
      selection = { edgeIds: [], vertexIds: [], relationId: null };
      sketchMode = defaultSketchMode(options);
    } else if (options.sketchMode) {
      sketchMode = defaultSketchMode(options);
    } else {
      sketchMode = "relations";
    }
    actionTarget = null;
    activePlateId = objectId;
    renderOverlay();
    emitSelectionChange(options);
    return true;
  }

  function selectEdge(edgeId, options = {}) {
    if (!edgeId) return;
    sketchMode = options.sketchMode ? defaultSketchMode(options) : options.showRelations ? "relations" : sketchMode;
    actionTarget = options.openActions ? { kind: "edge", edgeId } : options.keepActions ? actionTarget : null;
    if (options.additive) {
      const nextEdgeIds = selection.edgeIds.includes(edgeId)
        ? selection.edgeIds.filter((id) => id !== edgeId)
        : [...selection.edgeIds, edgeId].slice(-2);
      selection = {
        edgeIds: nextEdgeIds,
        vertexIds: selection.vertexIds.slice(0, 2),
        relationId: null
      };
      emitSelectionChange(options);
      return;
    }
    if (selection.edgeIds.includes(edgeId)) {
      selection = { edgeIds: selection.edgeIds, vertexIds: [], relationId: null };
      emitSelectionChange(options);
      return;
    }
    if (selection.vertexIds.length === 1 && selection.edgeIds.length === 0) {
      selection = { edgeIds: [edgeId], vertexIds: selection.vertexIds, relationId: null };
      emitSelectionChange(options);
      return;
    }
    if (selection.vertexIds.length === 2 && selection.edgeIds.length === 0) {
      selection = { edgeIds: [edgeId], vertexIds: selection.vertexIds, relationId: null };
      emitSelectionChange(options);
      return;
    }
    selection = {
      edgeIds: selection.edgeIds.length >= 2 ? [edgeId] : [...selection.edgeIds, edgeId],
      vertexIds: [],
      relationId: null
    };
    emitSelectionChange(options);
  }

  function selectVertex(vertexId, options = {}) {
    if (!vertexId) return;
    sketchMode = options.sketchMode ? defaultSketchMode(options) : options.showRelations ? "relations" : sketchMode;
    actionTarget = options.openActions ? { kind: "vertex", vertexId } : options.keepActions ? actionTarget : null;
    if (options.additive) {
      const nextVertexIds = selection.vertexIds.includes(vertexId)
        ? selection.vertexIds.filter((id) => id !== vertexId)
        : [...selection.vertexIds, vertexId].slice(-2);
      selection = {
        edgeIds: selection.edgeIds.slice(0, 2),
        vertexIds: nextVertexIds,
        relationId: null
      };
      emitSelectionChange(options);
      return;
    }
    if (selection.vertexIds.includes(vertexId)) {
      selection = { edgeIds: [], vertexIds: selection.vertexIds, relationId: null };
      emitSelectionChange(options);
      return;
    }
    if (selection.edgeIds.length === 1 && selection.vertexIds.length === 0) {
      selection = { edgeIds: selection.edgeIds, vertexIds: [vertexId], relationId: null };
      emitSelectionChange(options);
      return;
    }
    if (selection.edgeIds.length === 1 && selection.vertexIds.length === 1) {
      selection = { edgeIds: selection.edgeIds, vertexIds: [...selection.vertexIds, vertexId], relationId: null };
      emitSelectionChange(options);
      return;
    }
    selection = {
      edgeIds: [],
      vertexIds: selection.vertexIds.length >= 2 ? [vertexId] : [...selection.vertexIds, vertexId],
      relationId: null
    };
    emitSelectionChange(options);
  }

  function selectRelation(relationId, options = {}) {
    if (!relationId) return false;
    const current = plate();
    if (!current || !sketchRelations(current.sketch).some((relation) => relation.id === relationId)) return false;
    sketchMode = "relations";
    actionTarget = null;
    selection = { edgeIds: [], vertexIds: [], relationId };
    activeSnap = null;
    if (options.render !== false) renderOverlay();
    emitSelectionChange(options);
    return true;
  }

  function selectEntities({ edgeIds = [], vertexIds = [] } = {}, options = {}) {
    const current = plate();
    if (!current) return false;
    sketchMode = options.sketchMode ? defaultSketchMode(options) : sketchMode;
    actionTarget = null;
    const { edges, vertices } = sketchEntityMaps(current.sketch);
    const validEdgeIds = new Set(edges.map((edge) => edge.id));
    const validVertexIds = new Set(vertices.map((vertex) => vertex.id));
    selection = {
      edgeIds: arrayValues(edgeIds).filter((edgeId) => validEdgeIds.has(edgeId)).slice(0, 2),
      vertexIds: arrayValues(vertexIds).filter((vertexId) => validVertexIds.has(vertexId)).slice(0, 2),
      relationId: null
    };
    activeSnap = null;
    if (options.render !== false) renderOverlay();
    emitSelectionChange(options);
    return true;
  }

  function openActionsForCurrentSelection(options = {}) {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const vertexId = currentSelection.vertexIds.length === 1 ? currentSelection.vertexIds[0] : null;
    const edgeId = !vertexId && currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!vertexId && !edgeId) return false;
    sketchMode = "relations";
    actionTarget = vertexId ? { kind: "vertex", vertexId } : { kind: "edge", edgeId };
    activeSnap = null;
    if (options.render !== false) renderOverlay();
    if (options.status !== false) {
      onStatusChange?.(vertexId ? "Plate sketch: corner tools" : "Plate sketch: edge tools");
    }
    return true;
  }

  function hasSketchSelection(current = plate()) {
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    return Boolean(
      currentSelection.relationId
        || currentSelection.edgeIds.length
        || currentSelection.vertexIds.length
    );
  }

  function clearSelection(options = {}) {
    const current = plate();
    const hadSelection = hasSketchSelection(current);
    if (!hadSelection && options.force !== true) return false;
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    activeSnap = null;
    sketchMode = "relations";
    actionTarget = null;
    if (options.render !== false) renderOverlay();
    emitSelectionChange(options);
    if (hadSelection && options.status !== false) onStatusChange?.("Plate sketch: selection cleared");
    return true;
  }

  function removeSelectedRelation() {
    const current = plate();
    const relationId = selectionForPlate(current).relationId;
    if (!current || !relationId) return false;
    const relation = sketchRelations(current.sketch).find((item) => item.id === relationId);
    const relationDetail = relation
      ? relationSelectionEntityIds(relation, sketchEntityMaps(current.sketch).edges)
      : {};
    try {
      const nextProject = api.removePlateSketchRelation(current.id, relationId);
      onProjectChange?.(nextProject);
      activeSnap = null;
      selectSketchDetail(relationDetail);
      onStatusChange?.(`Plate sketch: removed ${relation ? sketchRelationLabel(relation).toLowerCase() : "relation"} relation`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch relation remove failed");
      renderOverlay();
      return true;
    }
  }

  function relationPatchFromAction(handle) {
    if (handle.relationType === "horizontal" || handle.relationType === "vertical") {
      return { type: handle.relationType, edgeId: handle.edgeId };
    }
    if (handle.relationType === "horizontal-points" || handle.relationType === "vertical-points" || handle.relationType === "coincident") {
      return { type: handle.relationType, vertexIds: handle.vertexIds };
    }
    if (handle.relationType === "point-on-line" || handle.relationType === "midpoint") {
      return { type: handle.relationType, vertexId: handle.vertexId, edgeId: handle.edgeId };
    }
    if (handle.relationType === "symmetric") {
      return { type: handle.relationType, vertexIds: handle.vertexIds, edgeId: handle.edgeId };
    }
    if (handle.relationType === "fixed") {
      return handle.vertexId
        ? { type: "fixed", vertexId: handle.vertexId }
        : { type: "fixed", edgeId: handle.edgeId };
    }
    if (handle.relationType === "parallel" || handle.relationType === "collinear" || handle.relationType === "perpendicular" || handle.relationType === "equal-length") {
      return { type: handle.relationType, edgeIds: handle.edgeIds, targetEdgeId: handle.targetEdgeId };
    }
    if (handle.relationType === "angle") {
      const angle = requestEdgeAngle(handle);
      return angle === null
        ? null
        : { type: "angle", edgeIds: handle.edgeIds, value: angle, mode: "driving", targetEdgeId: handle.targetEdgeId };
    }
    if (handle.relationType === "distance") {
      const distance = requestPointDistance(handle);
      return distance === null
        ? null
        : { type: "distance", vertexIds: handle.vertexIds, value: distance, mode: "driving", targetVertexId: handle.targetVertexId };
    }
    return null;
  }

  function relationFromProjectByKey(project, plateId, relationPatch) {
    const relationKey = sketchRelationKey(relationPatch);
    return sketchRelations(project?.model?.plates?.[plateId]?.sketch)
      .find((relation) => sketchRelationKey(relation) === relationKey) || null;
  }

  function selectUpdatedRelation(nextRelation) {
    actionTarget = null;
    selection = nextRelation
      ? { edgeIds: [], vertexIds: [], relationId: nextRelation.id }
      : { edgeIds: [], vertexIds: [], relationId: null };
    emitSelectionChange();
  }

  function selectSketchDetail(detail = {}) {
    sketchMode = detail.sketchMode ? defaultSketchMode(detail) : "relations";
    actionTarget = null;
    selection = {
      edgeIds: arrayValues(detail.edgeIds).filter(Boolean).slice(0, 2),
      vertexIds: arrayValues(detail.vertexIds).filter(Boolean).slice(0, 2),
      relationId: detail.relationId || null
    };
    emitSelectionChange();
  }

  function requestEdgeLength(handle) {
    const currentLength = Number.isFinite(handle.length) ? handle.length : null;
    const promptText = currentLength === null
      ? "Edge length mm"
      : `Edge length mm (${formatMm(currentLength)})`;
    const raw = requestEdgeLengthInput
      ? requestEdgeLengthInput({ plateId: handle.plateId, edgeId: handle.edgeId, length: currentLength })
      : globalThis.window?.prompt?.(promptText, currentLength === null ? "" : String(Math.round(currentLength * 1000) / 1000));
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function requestEdgeAngle(handle) {
    const currentAngle = Number.isFinite(handle.angle) ? handle.angle : null;
    const promptText = currentAngle === null
      ? "Edge angle degrees"
      : `Edge angle degrees (${formatDeg(currentAngle)})`;
    const raw = globalThis.window?.prompt?.(promptText, currentAngle === null ? "" : String(Math.round(currentAngle * 1000) / 1000));
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON && parsed < 180 - EPSILON ? parsed : null;
  }

  function requestPointDistance(handle) {
    const currentDistance = Number.isFinite(handle.distance) ? handle.distance : null;
    const promptText = currentDistance === null
      ? "Point distance mm"
      : `Point distance mm (${formatMm(currentDistance)})`;
    const raw = globalThis.window?.prompt?.(promptText, currentDistance === null ? "" : String(Math.round(currentDistance * 1000) / 1000));
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function applyLengthDimension(handle) {
    if (handle.relationMode === "driven") {
      onStatusChange?.("Plate sketch: reference dimensions do not drive geometry; make it driving in Sketch relations first");
      return true;
    }
    const length = requestEdgeLength(handle);
    if (length === null) {
      onStatusChange?.("Plate sketch: length edit cancelled");
      return true;
    }
    try {
      const nextProject = api.setPlateSketchEdgeLength(handle.plateId, handle.edgeId, length, { mode: "driving" });
      const nextPlate = nextProject.model?.plates?.[handle.plateId];
      const nextRelation = nextPlate
        ? sketchRelationsForEdge(nextPlate.sketch, handle.edgeId).find((relation) => relation.type === "length")
        : null;
      const nextMode = sketchLengthRelationMode(nextRelation);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(nextMode === "driven"
        ? `Plate sketch: redundant length added as reference ${formatMm(nextRelation?.value || length)}`
        : `Plate sketch: edge length set to ${formatMm(length)}`);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch length update failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function applyAngleDimension(handle) {
    if (handle.relationMode === "driven") {
      onStatusChange?.("Plate sketch: reference dimensions do not drive geometry; make it driving in Sketch relations first");
      return true;
    }
    const angle = requestEdgeAngle(handle);
    if (angle === null) {
      onStatusChange?.("Plate sketch: angle edit cancelled");
      return true;
    }
    try {
      const nextProject = api.setPlateSketchEdgeAngle(handle.plateId, handle.edgeIds, angle, {
        mode: "driving",
        targetEdgeId: handle.targetEdgeId || handle.edgeIds?.[1]
      });
      const nextPlate = nextProject.model?.plates?.[handle.plateId];
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((relation) => relation.type === "angle"
          && sketchRelationEdgeIds(relation).every((edgeId) => handle.edgeIds?.includes(edgeId)))
        : null;
      const nextMode = sketchAngleRelationMode(nextRelation);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(nextMode === "driven"
        ? `Plate sketch: redundant angle added as reference ${formatDeg(nextRelation?.value || angle)}`
        : `Plate sketch: edge angle set to ${formatDeg(angle)}`);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch angle update failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function applyDistanceDimension(handle) {
    if (handle.relationMode === "driven") {
      onStatusChange?.("Plate sketch: reference dimensions do not drive geometry; make it driving in Sketch relations first");
      return true;
    }
    const distance = requestPointDistance(handle);
    if (distance === null) {
      onStatusChange?.("Plate sketch: distance edit cancelled");
      return true;
    }
    try {
      const nextProject = api.setPlateSketchPointDistance(handle.plateId, handle.vertexIds, distance, {
        mode: "driving",
        targetVertexId: handle.targetVertexId || handle.vertexIds?.[1]
      });
      const nextPlate = nextProject.model?.plates?.[handle.plateId];
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((relation) => relation.type === "distance"
          && sketchRelationVertexIds(relation).every((vertexId) => handle.vertexIds?.includes(vertexId)))
        : null;
      const nextMode = sketchDistanceRelationMode(nextRelation);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(nextMode === "driven"
        ? `Plate sketch: redundant distance added as reference ${formatMm(nextRelation?.value || distance)}`
        : `Plate sketch: point distance set to ${formatMm(distance)}`);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch distance update failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function applyDimensionHandle(handle, event, editDimension) {
    const doubleClick = (event?.detail || 0) >= 2;
    if (handle.relationId && !doubleClick) {
      selectRelation(handle.relationId);
      onStatusChange?.("Plate sketch: selected dimension relation; double-click to edit value");
      activeSnap = null;
      renderOverlay();
      return true;
    }
    return editDimension(handle);
  }

  function dimensionRelationFromProject(project, handle) {
    const sketch = project?.model?.plates?.[handle.plateId]?.sketch;
    if (!sketch) return null;
    if (handle.dimensionType === "length") {
      return sketchRelationsForEdge(sketch, handle.edgeId).find((relation) => relation.type === "length") || null;
    }
    if (handle.dimensionType === "angle") {
      return sketchRelations(sketch).find((relation) => relation.type === "angle"
        && sketchRelationEdgeIds(relation).every((edgeId) => handle.edgeIds?.includes(edgeId))) || null;
    }
    if (handle.dimensionType === "distance") {
      return sketchRelations(sketch).find((relation) => relation.type === "distance"
        && sketchRelationVertexIds(relation).every((vertexId) => handle.vertexIds?.includes(vertexId))) || null;
    }
    return null;
  }

  function applyDimensionModeToggle(handle) {
    const nextMode = handle.relationMode === "driven" ? "driving" : "driven";
    try {
      let nextProject = null;
      if (handle.dimensionType === "length") {
        nextProject = api.setPlateSketchEdgeLengthMode(handle.plateId, handle.edgeId, nextMode);
      } else if (handle.dimensionType === "angle") {
        nextProject = api.setPlateSketchEdgeAngleMode(handle.plateId, handle.edgeIds, nextMode);
      } else if (handle.dimensionType === "distance") {
        nextProject = api.setPlateSketchPointDistanceMode(handle.plateId, handle.vertexIds, nextMode);
      } else {
        onStatusChange?.("Plate sketch: unknown dimension mode");
        return true;
      }
      const nextRelation = dimensionRelationFromProject(nextProject, handle);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: dimension set ${nextMode === "driven" ? "reference" : "driving"}`);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch dimension mode failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function applyDimensionHandleForKind(handle, event) {
    if (handle.kind === "plate-sketch-length-dimension") return applyDimensionHandle(handle, event, applyLengthDimension);
    if (handle.kind === "plate-sketch-angle-dimension") return applyDimensionHandle(handle, event, applyAngleDimension);
    if (handle.kind === "plate-sketch-distance-dimension") return applyDimensionHandle(handle, event, applyDistanceDimension);
    return false;
  }

  function beginDimensionPlacementDrag(handle, event) {
    if ((event?.detail || 0) >= 2) {
      drag = null;
      return applyDimensionHandleForKind(handle, event);
    }
    drag = {
      kind: "dimensionPlacement",
      handle,
      plateId: handle.plateId,
      placementKey: handle.dimensionPlacementKey || handle.dimensionId || handle.target,
      baseOffset: dimensionPlacementOffsets.get(handle.dimensionPlacementKey || handle.dimensionId || handle.target) || 0,
      normal: Array.isArray(handle.dimensionLocalNormal) ? handle.dimensionLocalNormal : [0, 1],
      moved: false
    };
    activeSnap = null;
    onStatusChange?.("Plate sketch: drag dimension to organize it; click without moving to select it");
    return true;
  }

  function applyRelationAction(handle) {
    if (handle.existingRelationId) {
      selectRelation(handle.existingRelationId);
      onStatusChange?.("Plate sketch: selected existing relation");
      activeSnap = null;
      renderOverlay();
      return true;
    }
    if (handle.relationType === "construction-line") {
      const current = plate();
      if (!current) return true;
      const { edges, vertexMap } = sketchEntityMaps(current.sketch);
      let from = null;
      let to = null;
      if (handle.edgeId) {
        const pair = edgePointPair(edges, vertexMap, handle.edgeId);
        from = pair?.from || null;
        to = pair?.to || null;
      } else if (Array.isArray(handle.vertexIds) && handle.vertexIds.length === 2) {
        from = vertexMap.get(handle.vertexIds[0])?.point || null;
        to = vertexMap.get(handle.vertexIds[1])?.point || null;
      }
      if (!from || !to) {
        onStatusChange?.("Plate sketch: construction line requires one edge or two points");
        activeSnap = null;
        renderOverlay();
        return true;
      }
      try {
        const nextProject = api.addPlateSketchConstructionLine(handle.plateId, from, to);
        const nextSketch = nextProject.model?.plates?.[handle.plateId]?.sketch;
        const { constructionEdges, vertexMap } = nextSketch
          ? sketchEntityMaps(nextSketch)
          : { constructionEdges: [], vertexMap: new Map() };
        const newEdge = [...constructionEdges].reverse().find((edge) => {
          const edgeFrom = vertexMap.get(edge.from)?.point;
          const edgeTo = vertexMap.get(edge.to)?.point;
          return (samePoint2(edgeFrom, from) && samePoint2(edgeTo, to))
            || (samePoint2(edgeFrom, to) && samePoint2(edgeTo, from));
        });
        onProjectChange?.(nextProject);
        selection = newEdge
          ? { edgeIds: [newEdge.id], vertexIds: [], relationId: null }
          : { edgeIds: [], vertexIds: [], relationId: null };
        emitSelectionChange();
        onStatusChange?.("Plate sketch: added construction line");
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch construction line failed");
      }
      activeSnap = null;
      renderOverlay();
      return true;
    }
    const relation = relationPatchFromAction(handle);
    if (!relation) {
      onStatusChange?.("Plate sketch: relation cancelled");
      activeSnap = null;
      renderOverlay();
      return true;
    }
    try {
      let nextProject = null;
      let nextRelation = null;
      let statusMessage = `Plate sketch: added ${sketchRelationLabel(relation).toLowerCase()} relation`;
      if (relation.type === "angle") {
        nextProject = api.setPlateSketchEdgeAngle(handle.plateId, relation.edgeIds, relation.value, {
          mode: "driving",
          targetEdgeId: relation.targetEdgeId
        });
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
        statusMessage = sketchAngleRelationMode(nextRelation) === "driven"
          ? `Plate sketch: redundant angle added as reference ${formatDeg(nextRelation?.value || relation.value)}`
          : `Plate sketch: added driving angle ${formatDeg(relation.value)}`;
      } else if (relation.type === "distance") {
        nextProject = api.setPlateSketchPointDistance(handle.plateId, relation.vertexIds, relation.value, {
          mode: "driving",
          targetVertexId: relation.targetVertexId
        });
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
        statusMessage = sketchDistanceRelationMode(nextRelation) === "driven"
          ? `Plate sketch: redundant distance added as reference ${formatMm(nextRelation?.value || relation.value)}`
          : `Plate sketch: added driving distance ${formatMm(relation.value)}`;
      } else {
        nextProject = api.upsertPlateSketchRelation(handle.plateId, relation);
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
      }
      onProjectChange?.(nextProject);
      selection = nextRelation
        ? { edgeIds: [], vertexIds: [], relationId: nextRelation.id }
        : { edgeIds: [], vertexIds: [], relationId: null };
      emitSelectionChange();
      onStatusChange?.(statusMessage);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch relation failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function beginDrag({ handle, event, modifiers } = {}) {
    if (!handle?.kind?.startsWith("plate-sketch-") || !handle.plateId) return false;
    const current = activePlate(api.project(), handle.plateId);
    activePlateId = handle.plateId;
    const multiSelect = Boolean(modifiers?.ctrlKey || modifiers?.metaKey || event?.ctrlKey || event?.metaKey);
    const contextRequested = event?.button === 2 || Number(event?.detail || 0) >= 2 || modifiers?.contextMenu === true;
    if (handle.kind === "plate-sketch-dimension-mode-toggle") {
      drag = null;
      return applyDimensionModeToggle(handle);
    }
    if (handle.kind === "plate-sketch-length-dimension") {
      return beginDimensionPlacementDrag(handle, event);
    }
    if (handle.kind === "plate-sketch-angle-dimension") {
      return beginDimensionPlacementDrag(handle, event);
    }
    if (handle.kind === "plate-sketch-distance-dimension") {
      return beginDimensionPlacementDrag(handle, event);
    }
    if (handle.kind === "plate-sketch-selection-clear") {
      clearSelection();
      drag = null;
      return true;
    }
    if (handle.kind === "plate-sketch-relation-action") {
      drag = null;
      return applyRelationAction(handle);
    }
    if (handle.kind === "plate-sketch-relation") {
      selectRelation(handle.relationId);
      onStatusChange?.(`Plate sketch: selected ${handle.relationType || "relation"} relation. Press Delete to remove.`);
      activeSnap = null;
      drag = null;
      renderOverlay();
      return true;
    }
    if (handle.kind === "plate-sketch-relation-delete") {
      selectRelation(handle.relationId);
      removeSelectedRelation();
      activeSnap = null;
      drag = null;
      return true;
    }
    if (handle.kind === "plate-sketch-construction-edge") {
      selectEdge(handle.edgeId, { additive: multiSelect });
      activeSnap = null;
      drag = null;
      onStatusChange?.("Plate sketch: selected construction line");
      renderOverlay();
      return multiSelect ? "handled" : true;
    }
    if (handle.kind === "plate-sketch-construction-vertex") {
      selectVertex(handle.vertexId, { additive: multiSelect });
      if (multiSelect) {
        activeSnap = null;
        drag = null;
        onStatusChange?.("Plate sketch: selection updated");
        renderOverlay();
        return "handled";
      }
      if (current && fixedRelationForVertex(current.sketch, handle.vertexId)) {
        onStatusChange?.("Plate sketch: construction point is fixed");
        drag = null;
        renderOverlay();
        return true;
      }
      const context = current ? constructionVertexDragContext(current, handle.vertexId) : null;
      if (!context) return false;
      drag = {
        kind: "constructionVertex",
        handle,
        plateId: handle.plateId,
        ...context
      };
      activeSnap = null;
      onStatusChange?.("Plate sketch: drag construction point");
      return true;
    }
    if (handle.kind === "plate-sketch-fixed-toggle") {
      try {
        const relation = current ? fixedRelationForVertex(current.sketch, handle.vertexId) : null;
        const nextProject = relation
          ? api.removePlateSketchRelation(handle.plateId, relation.id)
          : api.upsertPlateSketchRelation(handle.plateId, { type: "fixed", vertexId: handle.vertexId });
        onProjectChange?.(nextProject);
        if (relation) {
          selectSketchDetail({ vertexIds: [handle.vertexId] });
        } else {
          selectUpdatedRelation(relationFromProjectByKey(nextProject, handle.plateId, { type: "fixed", vertexId: handle.vertexId }));
        }
        onStatusChange?.(relation ? "Plate sketch: fixed relation removed" : "Plate sketch: corner fixed");
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch fixed relation failed");
      }
      activeSnap = null;
      drag = null;
      renderOverlay();
      return true;
    }
    if (handle.kind === "plate-sketch-insert-vertex") {
      drag = {
        kind: "insertVertex",
        handle,
        plateId: handle.plateId
      };
      activeSnap = null;
      onStatusChange?.("Plate sketch: drag to add point");
      return true;
    }
    if (handle.kind === "plate-sketch-remove-vertex") {
      try {
        const nextProject = api.removePlateSketchVertex(handle.plateId, handle.vertexId);
        onProjectChange?.(nextProject);
        selectSketchDetail();
        onStatusChange?.("Plate sketch: corner removed");
        renderOverlay();
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch remove failed");
      }
      drag = null;
      return true;
    }
    if (handle.kind === "plate-sketch-notch-corner") {
      try {
        const notchSize = current ? snappedNotchSize(current, handle.vertexId, settings, viewer) : undefined;
        const notchOptions = {
          orthogonal: true,
          ...(Number.isFinite(notchSize) && notchSize > EPSILON ? { size: notchSize } : {})
        };
        const result = api.notchPlateSketchCorner(handle.plateId, handle.vertexId, notchOptions);
        onProjectChange?.(result.project);
        const nextPlate = result.project?.model?.plates?.[handle.plateId];
        const newVertexIds = arrayValues(result.vertexIds).filter(Boolean);
        const newVertexSet = new Set(newVertexIds);
        const newEdgeIds = nextPlate
          ? sketchEdges(nextPlate.sketch)
            .filter((edge) => newVertexSet.has(edge.from) || newVertexSet.has(edge.to))
            .map((edge) => edge.id)
          : [];
        selectSketchDetail({ edgeIds: newEdgeIds, vertexIds: newVertexIds });
        onStatusChange?.("Plate sketch: notch added");
        renderOverlay();
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch notch failed");
      }
      drag = null;
      return true;
    }
    if (handle.kind === "plate-sketch-edge") {
      if (contextRequested) {
        selectEdge(handle.edgeId, { openActions: true });
        activeSnap = null;
        drag = null;
        onStatusChange?.("Plate sketch: edge tools");
        renderOverlay();
        return "handled";
      }
      selectEdge(handle.edgeId, { additive: multiSelect });
      if (multiSelect) {
        activeSnap = null;
        drag = null;
        onStatusChange?.("Plate sketch: selection updated");
        renderOverlay();
        return "handled";
      }
      if (current && fixedRelationForEdge(current.sketch, handle.edgeId)) {
        onStatusChange?.("Plate sketch: edge is fixed");
        drag = null;
        return true;
      }
      const context = current ? edgeDragContext(current, handle.edgeId, settings) : null;
      if (!context) return false;
      drag = {
        kind: "edge",
        handle,
        plateId: handle.plateId,
        ...context
      };
      activeSnap = null;
      onStatusChange?.("Plate sketch: drag edge");
      return true;
    }
    if (handle.kind !== "plate-sketch-vertex" || !handle.vertexId) return false;
    if (contextRequested) {
      selectVertex(handle.vertexId, { openActions: true });
      activeSnap = null;
      drag = null;
      onStatusChange?.("Plate sketch: corner tools");
      renderOverlay();
      return "handled";
    }
    selectVertex(handle.vertexId, { additive: multiSelect });
    if (multiSelect) {
      activeSnap = null;
      drag = null;
      onStatusChange?.("Plate sketch: selection updated");
      renderOverlay();
      return "handled";
    }
    if (current && fixedRelationForVertex(current.sketch, handle.vertexId)) {
      onStatusChange?.("Plate sketch: corner is fixed");
      drag = null;
      return true;
    }
    const context = current ? vertexDragContext(current, handle.vertexId, settings) : null;
    if (!context) return false;
    drag = {
      kind: "vertex",
      handle,
      plateId: handle.plateId,
      ...context
    };
    activeSnap = null;
    onStatusChange?.("Plate sketch: drag vertex");
    return true;
  }

  function contextMenu() {
    return openActionsForCurrentSelection();
  }

  function quickListAction({ item } = {}) {
    if (!item || item.disabled) return true;
    const handle = item.handle;
    if (!handle?.kind?.startsWith("plate-sketch-")) return false;
    return beginDrag({
      handle,
      event: { button: 0, detail: 1 },
      modifiers: {}
    });
  }

  function applyEdgeDrag(input) {
    const [dy, dz] = screenDeltaToSketch(drag.handle, input.totalDx || 0, input.totalDy || 0);
    const rawDelta = dot2([dy, dz], drag.normal);
    const rawMidpoint = add2(drag.baseMidpoint, mul2(drag.normal, rawDelta));
    const snapEnabled = sketchSnapEnabled(input);
    const axisLocked = Boolean(drag.edgeConstraint);
    const snapInput = {
      ...input,
      sketchSnapEnabled: snapEnabled,
      snapCandidate: snapEnabled
        ? resolveSketchSnapCandidate(rawMidpoint, input, edgeSnapCandidates(drag, rawDelta, drag.handle, settings, input, { axisLocked }), { phase: "edge-drag" })
        : null
    };
    const result = snappedEdgeDelta(drag, rawDelta, drag.handle, settings, snapInput, { axisLocked });
    if (result.delta === null) {
      activeSnap = null;
      onStatusChange?.("Plate sketch: edge drag blocked before outline collapse");
      renderOverlay();
      return;
    }
    const shifted = shiftedEdgePoints(drag, result.delta);
    activeSnap = result.snapped ? {
      point: platePoint(plate(), shifted.midpoint),
      rawPoint: platePoint(plate(), add2(drag.baseMidpoint, mul2(drag.normal, rawDelta))),
      label: `Snap ${result.label}`
    } : null;
    try {
      let nextProject = api.setPlateSketchVertices(drag.plateId, [
        { vertexId: drag.fromVertexId, point: shifted.from },
        { vertexId: drag.toVertexId, point: shifted.to }
      ]);
      let addedSnapRelations = [];
      if (result.relations?.length) {
        const snapResult = applySnapRelations(drag.plateId, result.relations);
        nextProject = snapResult.project;
        addedSnapRelations = snapResult.relations;
        onStatusChange?.(`Plate sketch: added ${result.relations.length} snap relation${result.relations.length === 1 ? "" : "s"}`);
      }
      onProjectChange?.(nextProject);
      if (addedSnapRelations.length) selectUpdatedRelation(addedSnapRelations[addedSnapRelations.length - 1]);
      renderOverlay();
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch edge update failed");
    }
  }

  function applySnapRelations(plateId, relations = []) {
    let nextProject = api.project();
    const appliedRelations = [];
    for (const relation of relations) {
      nextProject = api.upsertPlateSketchRelation(plateId, relation);
      const nextRelation = relationFromProjectByKey(nextProject, plateId, relation);
      if (nextRelation) appliedRelations.push(nextRelation);
    }
    return { project: nextProject, relations: appliedRelations };
  }

  function insertSketchVertexForDrag(handle) {
    try {
      const result = api.insertPlateSketchVertex(handle.plateId, handle.edgeId, handle.sketchPoint, {
        addSplitCollinear: false,
        inferNewRelations: false,
        inheritAxisRelations: false,
        inheritDirectionalRelations: false
      });
      onProjectChange?.(result.project);
      selectSketchDetail({ vertexIds: [result.vertexId] });
      const updatedPlate = api.project().model?.plates?.[handle.plateId];
      const context = updatedPlate ? vertexDragContext(updatedPlate, result.vertexId, settings) : null;
      drag = context ? {
        kind: "vertex",
        handle: { ...handle, kind: "plate-sketch-vertex", vertexId: result.vertexId, target: result.vertexId },
        plateId: handle.plateId,
        suppressRelationSnaps: true,
        suppressAxisRelationSnaps: true,
        ...context
      } : null;
      onStatusChange?.("Plate sketch: point added");
      renderOverlay();
      return Boolean(drag);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch insert failed");
      drag = null;
      return false;
    }
  }

  function applyDrag(input) {
    if (!input?.cycleSnapRefresh) snapManager?.resetCycle?.();
    lastDragInput = input;
    if (drag?.kind === "dimensionPlacement") {
      const [dy, dz] = screenDeltaToSketch(drag.handle, input.totalDx || 0, input.totalDy || 0);
      const delta = dot2([dy, dz], drag.normal);
      const nextOffset = drag.baseOffset + delta;
      if (Math.abs(delta) > 0.5) drag.moved = true;
      dimensionPlacementOffsets.set(drag.placementKey, nextOffset);
      renderOverlay();
      return;
    }
    if (drag?.kind === "edge") {
      applyEdgeDrag(input);
      return;
    }
    if (drag?.kind === "insertVertex") {
      const totalDx = input.totalDx || 0;
      const totalDy = input.totalDy || 0;
      const threshold = settings.plateSketchInsertDragThresholdPx ?? DEFAULT_INSERT_VERTEX_DRAG_THRESHOLD_PX;
      if (Math.hypot(totalDx, totalDy) < threshold) return;
      const pendingHandle = drag.handle;
      if (!insertSketchVertexForDrag(pendingHandle)) return;
      applyDrag(input);
      return;
    }
    if (drag?.kind === "constructionVertex") {
      const [dy, dz] = screenDeltaToSketch(drag.handle, input.totalDx || 0, input.totalDy || 0);
      const rawPoint = [drag.basePoint[0] + dy, drag.basePoint[1] + dz];
      const snapEnabled = sketchSnapEnabled(input);
      const snapInput = {
        ...input,
        sketchSnapEnabled: snapEnabled,
        snapCandidate: snapEnabled
          ? resolveSketchSnapCandidate(rawPoint, input, freeSketchPointSnapCandidates(drag, rawPoint, drag.handle, settings, input), { phase: "construction-vertex-drag" })
          : null
      };
      const result = snappedFreeSketchPoint(drag, rawPoint, drag.handle, settings, snapInput);
      try {
        activeSnap = result.snapped ? {
          point: platePoint(plate(), result.point),
          rawPoint: platePoint(plate(), rawPoint),
          label: `Snap ${result.label}`
        } : null;
        const nextProject = api.setPlateSketchVertex(drag.plateId, drag.vertexId, result.point);
        onProjectChange?.(nextProject);
        renderOverlay();
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch construction point update failed");
      }
      return;
    }
    if (!drag?.vertexId) return;
    const [dy, dz] = screenDeltaToSketch(drag.handle, input.totalDx || 0, input.totalDy || 0);
    const rawPoint = [drag.basePoint[0] + dy, drag.basePoint[1] + dz];
    const snapEnabled = sketchSnapEnabled(input);
    const snapInput = {
      ...input,
      sketchSnapEnabled: snapEnabled,
      snapCandidate: null
    };
    snapInput.snapCandidate = snapEnabled
      ? resolveSketchSnapCandidate(rawPoint, input, drag.hasLockedAdjacentRelation
        ? freeSketchPointSnapCandidates(drag, rawPoint, drag.handle, settings, input, { gridPrecision: "micro" })
        : vertexSnapCandidates(drag, rawPoint, drag.handle, settings, snapInput), {
        phase: drag.hasLockedAdjacentRelation ? "relation-vertex-drag" : "vertex-drag"
      })
      : null;
    if (drag.hasLockedAdjacentRelation) {
      const result = lockedVertexResult(drag, rawPoint, drag.handle, settings, snapInput);
      if (result.blocked) {
        activeSnap = null;
        onStatusChange?.("Plate sketch: relation-locked corner drag blocked before outline collapse");
        renderOverlay();
        return;
      }
      try {
        activeSnap = result.snapped ? {
          point: platePoint(plate(), result.point),
          rawPoint: platePoint(plate(), rawPoint),
          label: `Snap ${result.label}`
        } : null;
        const nextProject = api.setPlateSketchVertices(drag.plateId, result.updates);
        onProjectChange?.(nextProject);
        renderOverlay();
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch relation update failed");
      }
      return;
    }
    const result = snappedVertexPoint(drag, rawPoint, drag.handle, settings, snapInput);
    if (result.blocked) {
      activeSnap = null;
      onStatusChange?.("Plate sketch: corner drag blocked before outline collapse");
      renderOverlay();
      return;
    }
    try {
      activeSnap = result.snapped ? {
        point: platePoint(plate(), result.point),
        rawPoint: platePoint(plate(), rawPoint),
        label: `Snap ${result.label}`
      } : null;
      let nextProject = api.setPlateSketchVertex(drag.plateId, drag.vertexId, result.point);
      let addedSnapRelations = [];
      if (result.relations?.length) {
        const snapResult = applySnapRelations(drag.plateId, result.relations);
        nextProject = snapResult.project;
        addedSnapRelations = snapResult.relations;
        onStatusChange?.(`Plate sketch: added ${result.relations.length} snap relation${result.relations.length === 1 ? "" : "s"}`);
      }
      onProjectChange?.(nextProject);
      if (addedSnapRelations.length) selectUpdatedRelation(addedSnapRelations[addedSnapRelations.length - 1]);
      renderOverlay();
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch update failed");
    }
  }

  function endDrag() {
    if (drag?.kind === "dimensionPlacement" && !drag.moved) {
      const handle = drag.handle;
      drag = null;
      lastDragInput = null;
      activeSnap = null;
      applyDimensionHandleForKind(handle, { detail: 1 });
      if (activePlateId) renderOverlay();
      return;
    }
    drag = null;
    lastDragInput = null;
    activeSnap = null;
    if (activePlateId) renderOverlay();
  }

  function cycleSnap() {
    if (!drag || !lastDragInput) return false;
    snapManager?.cycle?.();
    applyDrag({ ...lastDragInput, cycleSnapRefresh: true });
    return true;
  }

  api.subscribe(() => {
    if (!activePlateId) return;
    if (!plate()) {
      clear({ overlay: true });
      return;
    }
    renderOverlay();
  });

  return {
    clear,
    activeState,
    selectObject,
    selectRelation,
    selectEntities,
    setSketchMode,
    toggleRelations,
    cycleSnap,
    clearSelection,
    removeSelectedRelation,
    authoringHandler: {
      beginDrag,
      contextMenu,
      quickListAction,
      drag: applyDrag,
      end: endDrag,
      cancel: endDrag
    }
  };
}
