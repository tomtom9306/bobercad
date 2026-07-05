import { v } from "../../../engine/core/math.mjs";
import {
  orderedSketchLoop,
  measuredSketchEdgeRadius,
  sketchAngleRelationMode,
  sketchDistanceRelationMode,
  sketchEdgeCenterPoint,
  sketchEdgeIsCircularArc,
  sketchEdgeMidpoint,
  sketchEdgeAngleDegrees,
  sketchLengthRelationMode,
  sketchRadiusRelationDisplay,
  sketchRadiusRelationMode,
  sketchPointDistance,
  sketchRelationEdgeIds,
  sketchRelationVertexIds,
  sketchRelations,
  sketchRelationsForEdge
} from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { linearDraftingDimension, formatDraftingNumber } from "../../annotations/drafting-dimensions.mjs";
import {
  EPSILON,
  add2,
  edgeOutwardNormal,
  edgePointPair,
  len2,
  midpoint,
  mul2,
  norm2,
  platePoint,
  requiredPoint2,
  signedArea,
  sub2
} from "./sketch-edit-geometry.mjs";
import { relationHealthColor } from "./relation-display.mjs";

const DEFAULT_DIMENSION_OFFSET = 38;
const DEFAULT_CLEAN_DIMENSION_TICK_SIZE = 8;
const DEFAULT_CLEAN_DIMENSION_EXTENSION_OVERSHOOT = 6;
const DEFAULT_CLEAN_DIMENSION_LABEL_OFFSET = 10;

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
    const a = requiredPoint2(from.point, `${from.id}.point`);
    const b = requiredPoint2(to.point, `${to.id}.point`);
    if (len2(sub2(b, a)) <= EPSILON) continue;
    const key = cleanDimensionEdgeKey(a, b);
    const score = cleanDimensionEdgeScore(a, b);
    const current = bestByKey.get(key);
    if (!current || score > current.score) bestByKey.set(key, { edgeId: edge.id, score });
  }
  return new Set([...bestByKey.values()].map((item) => item.edgeId));
}

export function dimensionOverlayForPlate(plate, edges, vertexMap, settings = {}, relationHealth = {}, options = {}) {
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
    const radiusRelation = sketchRelationsForEdge(plate.sketch, edge.id).find((relation) => relation.type === "radius");
    if (sketchEdgeIsCircularArc(plate.sketch, edge.id)) {
      if (!radiusRelation && !plain) continue;
      const center = sketchEdgeCenterPoint(plate.sketch, edge.id);
      const arcMidpoint = sketchEdgeMidpoint(plate.sketch, edge.id);
      const radius = measuredSketchEdgeRadius(plate.sketch, edge.id);
      const relationMode = sketchRadiusRelationMode(radiusRelation);
      const relationDisplay = sketchRadiusRelationDisplay(radiusRelation);
      const isDiameter = relationDisplay === "diameter";
      const isReference = relationMode === "driven";
      const health = radiusRelation ? relationHealth[radiusRelation.id] : null;
      const color = relationHealthColor(health, radiusRelation ? (isReference ? referenceColor : drivenColor) : dimensionColor);
      const dimensionType = isDiameter ? "diameter" : "radius";
      const dimensionKind = isDiameter ? "plate-sketch-diameter-dimension" : "plate-sketch-radius-dimension";
      const dimensionLabel = isDiameter ? "diameter" : "radius";
      const measuredValue = isDiameter ? radius * 2 : radius;
      const displayText = `${isDiameter ? "\u00d8" : "R"}${formatDraftingNumber(measuredValue)}`;
      const dimensionId = `${plate.id}:${edge.id}:${dimensionType}`;
      const placementOffset = Number.isFinite(options.dimensionPlacementOffsets?.[dimensionId])
        ? options.dimensionPlacementOffsets[dimensionId]
        : 0;
      const radiusAxis = norm2(sub2(arcMidpoint, center));
      const diameterStart = add2(center, mul2(radiusAxis, -radius));
      const dimensionStart = isDiameter ? diameterStart : center;
      const labelPoint = add2(midpoint(dimensionStart, arcMidpoint), mul2(radiusAxis, DEFAULT_CLEAN_DIMENSION_LABEL_OFFSET + placementOffset));
      const worldStart = platePoint(plate, dimensionStart);
      const worldArc = platePoint(plate, arcMidpoint);
      const labelWorldPoint = platePoint(plate, labelPoint);
      lines.push({
        points: [worldStart, worldArc],
        color,
        kind: dimensionKind,
        objectId: plate.id,
        dimensionId
      });
      labels.push({
        point: labelWorldPoint,
        text: displayText,
        displayText,
        color,
        dimensionId,
        draftingDimension: true,
        labelAxis: v.norm(v.sub(worldArc, worldStart)),
        labelUpAxis: v.norm(plate.localAxisZ),
        screenOffsetPx: { x: 0, y: 0 }
      });
      handles.push({
        type: "circle",
        kind: dimensionKind,
        target: `${edge.id}:${dimensionType}`,
        objectId: plate.id,
        plateId: plate.id,
        edgeId: edge.id,
        edgeRadius: radius,
        diameter: radius * 2,
        relationId: radiusRelation?.id || null,
        relationMode,
        dimensionType,
        dimensionPlacementKey: dimensionId,
        dimensionLocalNormal: radiusAxis,
        dragAxes: {
          x: v.norm(plate.localAxisY),
          y: v.norm(plate.localAxisZ)
        },
        draggable: true,
        point: labelWorldPoint,
        color,
        radius: 0,
        hitTolerancePx: 30,
        visible: false,
        hoverLabel: health?.message || (isReference ? `Reference ${dimensionLabel}` : `${dimensionLabel[0].toUpperCase()}${dimensionLabel.slice(1)} dimension`)
      });
      if (showRelationControls && radiusRelation) {
        handles.push({
          type: "space-toggle",
          kind: "plate-sketch-dimension-mode-toggle",
          target: `${edge.id}:${dimensionType}:mode`,
          objectId: plate.id,
          plateId: plate.id,
          dimensionType,
          edgeId: edge.id,
          relationMode,
          draggable: false,
          point: labelWorldPoint,
          screenOffsetPx: { x: 36, y: -18 },
          color,
          radius: 8,
          hitTolerancePx: 22,
          hoverLabel: isReference ? `Make ${dimensionLabel} driving` : `Make ${dimensionLabel} reference`
        });
      }
      continue;
    }
    if (visibleLengthDimensionEdgeIds && !visibleLengthDimensionEdgeIds.has(edge.id)) continue;
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const a = requiredPoint2(from.point, `${from.id}.point`);
    const b = requiredPoint2(to.point, `${to.id}.point`);
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
    const a = requiredPoint2(first.point, `${first.id}.point`);
    const b = requiredPoint2(second.point, `${second.id}.point`);
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
