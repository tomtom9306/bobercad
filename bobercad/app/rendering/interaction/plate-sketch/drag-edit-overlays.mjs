import { v } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { addPlateSketchConstructionLine as addPlateSketchConstructionLineData, insertPlateSketchVertex as insertPlateSketchVertexData, measuredSketchEdgeRadius, notchPlateSketchCorner as notchPlateSketchCornerData, orderedSketchLoop, plateCornerReliefs, plateOutline, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, removePlateSketchRelation as removePlateSketchRelationData, removePlateSketchVertex as removePlateSketchVertexData, setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData, setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData, setPlateSketchEdgeLength as setPlateSketchEdgeLengthData, setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData, setPlateSketchPointDistance as setPlateSketchPointDistanceData, setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData, setPlateSketchVertex as setPlateSketchVertexData, setPlateSketchVertices as setPlateSketchVerticesData, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdgeIsCircularArc, sketchEdgeMidpoint, sketchEdgeSamplePoints, sketchEdges, sketchFromOutline, sketchLengthRelationMode, sketchPointDistance, sketchRadiusRelationDisplay, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices, upsertPlateSketchRelation as upsertPlateSketchRelationData } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { plateBendGeometry } from "../../scene/plate-bend-geometry.mjs";
import { snapPointOverlay } from "../../scene/authoring/snap-overlays.mjs";
import { adaptiveSnapGridStep, adaptiveSnapGridStepForHandle, snapScalarToGrid, snapSketchWorldTolerance } from "../snap-profiles.mjs";
import { dimensionOverlayForPlate } from "./dimension-overlay.mjs";
import { relationHealthClass, relationHealthColor, relationHealthStatus, sketchEntityColor, sketchStatusColor } from "./relation-display.mjs";
import { EPSILON, add2, cross2, dot2, edgeOutwardNormal, edgePointPair, len2, midpoint, mul2, norm2, platePoint, requiredPoint2, signedArea, sub2 } from "./sketch-edit-geometry.mjs";

import {
  CONSTRUCTION_EDGE_COLOR,
  CONSTRUCTION_EDGE_SELECTED_COLOR,
  RELATION_ACTION_COLOR,
  RELATION_ASSOCIATED_COLOR,
  RELATION_SELECTION_COLOR
} from './drag-edit-constants.mjs';
import {
  edgeLength,
  existingRelationForAction,
  fixedRelationForVertex,
  isConvexPolygon,
  relationActionBadge,
  relationActionPreview,
  relationPointForSketchRelation,
  relationSelectionEntityIds,
  relationTouchesManualSelection,
  sketchEntityMaps
} from './drag-edit-geometry.mjs';

const TAU = Math.PI * 2;

function positiveAngle(angle) {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
}

function curveCircleSegments(options, fallback = 32) {
  if (Number.isInteger(options) && options >= 3) return options;
  if (Number.isInteger(options?.circleSegments) && options.circleSegments >= 3) return options.circleSegments;
  return fallback;
}

function curveSegmentLength(options) {
  const value = typeof options === "object" && options ? options.segmentLength : null;
  return Number.isFinite(value) && value > EPSILON ? value : null;
}

function fullCircleSegmentCount(radius, options = 32, minimum = 12) {
  const segmentLength = curveSegmentLength(options);
  if (segmentLength && Number.isFinite(radius) && radius > EPSILON) {
    return Math.max(minimum, Math.ceil(TAU * radius / segmentLength));
  }
  return Math.max(minimum, curveCircleSegments(options));
}

function arcSegmentCount(radius, sweep, options = 32, minimum = 2) {
  const segmentLength = curveSegmentLength(options);
  if (segmentLength && Number.isFinite(radius) && radius > EPSILON) {
    return Math.max(minimum, Math.ceil(Math.abs(sweep) * radius / segmentLength));
  }
  return Math.max(minimum, Math.ceil(curveCircleSegments(options) * Math.abs(sweep) / TAU));
}

function vertexTouchesOtherCircularArc(sketch, edges, vertexId, targetEdgeId) {
  if (!vertexId || !targetEdgeId) return false;
  return arrayValues(edges).some((edge) => (
    edge?.id
    && edge.id !== targetEdgeId
    && (edge.from === vertexId || edge.to === vertexId)
    && sketchEdgeIsCircularArc(sketch, edge.id)
  ));
}

function sampleCirclePreview(center, radius, curveOptions = 32) {
  if (!Array.isArray(center) || !Number.isFinite(radius) || radius <= EPSILON) return [];
  const count = fullCircleSegmentCount(radius, curveOptions);
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = TAU * index / count;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

function circleThroughPreviewPoints(first, second, third) {
  const d = 2 * (
    first[0] * (second[1] - third[1])
    + second[0] * (third[1] - first[1])
    + third[0] * (first[1] - second[1])
  );
  if (Math.abs(d) <= EPSILON) return null;
  const firstSq = first[0] * first[0] + first[1] * first[1];
  const secondSq = second[0] * second[0] + second[1] * second[1];
  const thirdSq = third[0] * third[0] + third[1] * third[1];
  const center = [
    (firstSq * (second[1] - third[1]) + secondSq * (third[1] - first[1]) + thirdSq * (first[1] - second[1])) / d,
    (firstSq * (third[0] - second[0]) + secondSq * (first[0] - third[0]) + thirdSq * (second[0] - first[0])) / d
  ];
  const radius = len2(sub2(first, center));
  return Number.isFinite(radius) && radius > EPSILON ? { center, radius } : null;
}

function sampleCcwArcPreview(center, start, end, curveOptions = 16) {
  const radius = len2(sub2(start, center));
  if (radius <= EPSILON) return [];
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  const sweep = positiveAngle(endAngle - startAngle);
  if (sweep <= EPSILON) return [];
  const count = arcSegmentCount(radius, sweep, curveOptions);
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = startAngle + sweep * index / count;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

function slotRadiusFromPreviewPoint(startCenter, endCenter, point) {
  const axis = sub2(endCenter, startCenter);
  const length = len2(axis);
  if (length <= EPSILON) return null;
  const relative = sub2(point, startCenter);
  return Math.abs(cross2(axis, relative)) / length;
}

function sampleSlotPreview(startCenter, endCenter, radius, curveOptions = 32) {
  const axis = sub2(endCenter, startCenter);
  const length = len2(axis);
  if (length <= EPSILON || !Number.isFinite(radius) || radius <= EPSILON) return [];
  const unit = mul2(axis, 1 / length);
  const normal = [-unit[1], unit[0]];
  const offset = mul2(normal, radius);
  const startLower = sub2(startCenter, offset);
  const endLower = sub2(endCenter, offset);
  const endUpper = add2(endCenter, offset);
  const startUpper = add2(startCenter, offset);
  const rightArc = sampleCcwArcPreview(endCenter, endLower, endUpper, curveOptions);
  const leftArc = sampleCcwArcPreview(startCenter, startUpper, startLower, curveOptions);
  return [
    startLower,
    endLower,
    ...rightArc.slice(1),
    startUpper,
    ...leftArc.slice(1)
  ];
}

function roundedRectangleDimensionsFromPreview(center, corner) {
  const width = Math.abs(corner[0] - center[0]) * 2;
  const height = Math.abs(corner[1] - center[1]) * 2;
  return { width, height };
}

function roundedRectangleRadiusFromPreviewPoint(center, corner, point) {
  const { width, height } = roundedRectangleDimensionsFromPreview(center, corner);
  if (width <= EPSILON || height <= EPSILON) return null;
  const rawRadius = Math.max(Math.abs(point[0] - corner[0]), Math.abs(point[1] - corner[1]));
  const maxRadius = Math.min(width, height) / 2 - EPSILON * 10;
  if (!Number.isFinite(rawRadius) || rawRadius <= EPSILON || maxRadius <= EPSILON) return null;
  return Math.min(rawRadius, maxRadius);
}

function rectanglePreviewPoints(center, corner) {
  const left = Math.min(center[0] * 2 - corner[0], corner[0]);
  const right = Math.max(center[0] * 2 - corner[0], corner[0]);
  const bottom = Math.min(center[1] * 2 - corner[1], corner[1]);
  const top = Math.max(center[1] * 2 - corner[1], corner[1]);
  return [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
}

function sampleRoundedRectanglePreview(center, corner, radius, curveOptions = 32) {
  const { width, height } = roundedRectangleDimensionsFromPreview(center, corner);
  if (width <= EPSILON || height <= EPSILON || !Number.isFinite(radius) || radius <= EPSILON) return [];
  const maxRadius = Math.min(width, height) / 2 - EPSILON * 10;
  const r = Math.min(radius, maxRadius);
  if (r <= EPSILON) return [];
  const left = Math.min(center[0] * 2 - corner[0], corner[0]);
  const right = Math.max(center[0] * 2 - corner[0], corner[0]);
  const bottom = Math.min(center[1] * 2 - corner[1], corner[1]);
  const top = Math.max(center[1] * 2 - corner[1], corner[1]);
  const v1 = [left + r, bottom];
  const v2 = [right - r, bottom];
  const v3 = [right, bottom + r];
  const v4 = [right, top - r];
  const v5 = [right - r, top];
  const v6 = [left + r, top];
  const v7 = [left, top - r];
  const v8 = [left, bottom + r];
  return [
    v1,
    v2,
    ...sampleCcwArcPreview([right - r, bottom + r], v2, v3, curveOptions).slice(1),
    v4,
    ...sampleCcwArcPreview([right - r, top - r], v4, v5, curveOptions).slice(1),
    v6,
    ...sampleCcwArcPreview([left + r, top - r], v6, v7, curveOptions).slice(1),
    v8,
    ...sampleCcwArcPreview([left + r, bottom + r], v8, v1, curveOptions).slice(1)
  ];
}

function sampleCenterArcPreview(center, start, end, curveOptions = 24) {
  const startVector = sub2(start, center);
  const endVector = sub2(end, center);
  const radius = len2(startVector);
  const endLength = len2(endVector);
  if (radius <= EPSILON || endLength <= EPSILON) return [];
  const projectedEnd = [
    center[0] + endVector[0] / endLength * radius,
    center[1] + endVector[1] / endLength * radius
  ];
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const endAngle = Math.atan2(projectedEnd[1] - center[1], projectedEnd[0] - center[0]);
  const cross = cross2(startVector, endVector);
  const sweep = cross < 0
    ? -positiveAngle(startAngle - endAngle)
    : positiveAngle(endAngle - startAngle);
  if (Math.abs(sweep) <= EPSILON) return [];
  const count = arcSegmentCount(radius, sweep, curveOptions);
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = startAngle + sweep * index / count;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

function circleThroughThreePreviewPoints(start, through, end) {
  const d = 2 * (
    start[0] * (through[1] - end[1])
    + through[0] * (end[1] - start[1])
    + end[0] * (start[1] - through[1])
  );
  if (Math.abs(d) <= EPSILON) return null;
  const startSq = start[0] * start[0] + start[1] * start[1];
  const throughSq = through[0] * through[0] + through[1] * through[1];
  const endSq = end[0] * end[0] + end[1] * end[1];
  const center = [
    (startSq * (through[1] - end[1]) + throughSq * (end[1] - start[1]) + endSq * (start[1] - through[1])) / d,
    (startSq * (end[0] - through[0]) + throughSq * (start[0] - end[0]) + endSq * (through[0] - start[0])) / d
  ];
  const radius = len2(sub2(start, center));
  if (!Number.isFinite(radius) || radius <= EPSILON) return null;
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const throughAngle = Math.atan2(through[1] - center[1], through[0] - center[0]);
  const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  const ccwSweep = positiveAngle(endAngle - startAngle);
  const throughCcw = positiveAngle(throughAngle - startAngle);
  return {
    center,
    radius,
    direction: throughCcw > EPSILON && throughCcw < ccwSweep - EPSILON ? "ccw" : "cw"
  };
}

function sampleThreePointArcPreview(start, through, end, curveOptions = 24) {
  const arc = circleThroughThreePreviewPoints(start, through, end);
  if (!arc) return [];
  const startAngle = Math.atan2(start[1] - arc.center[1], start[0] - arc.center[0]);
  const endAngle = Math.atan2(end[1] - arc.center[1], end[0] - arc.center[0]);
  const sweep = arc.direction === "ccw"
    ? positiveAngle(endAngle - startAngle)
    : -positiveAngle(startAngle - endAngle);
  if (Math.abs(sweep) <= EPSILON) return [];
  const count = arcSegmentCount(arc.radius, sweep, curveOptions);
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = startAngle + sweep * index / count;
    points.push([arc.center[0] + Math.cos(angle) * arc.radius, arc.center[1] + Math.sin(angle) * arc.radius]);
  }
  return points;
}

function cornerReliefMarkerPoint(plate, corner, options = {}) {
  const topOffset = Math.max(Number.isFinite(plate?.thickness) ? plate.thickness * 0.5 : 0, 0) + 1.5;
  if (Array.isArray(corner?.point) && corner.point.length >= 2 && corner.point.every(Number.isFinite)) {
    return v.add(platePoint(plate, corner.point), v.mul(v.safeNorm(plate.normal, [0, 0, 1]), topOffset));
  }
  if (corner?.scope !== "bend" || !corner.targetParentBendId || !corner.targetParentEdge) return null;
  const target = arrayValues(options.bendGeometry?.targetEdges).find((edge) => (
    edge.parentBendId === corner.targetParentBendId && edge.parentEdge === corner.targetParentEdge
  ));
  const point = corner.targetEndpoint === "end" ? target?.end : target?.start;
  if (!v.isVec3(point)) return null;
  return v.add(point, v.mul(v.safeNorm(target?.sourceNormal || plate.normal, [0, 0, 1]), topOffset));
}

export function overlayForPlate(plate, options = {}) {
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
  const worldPoint = (vertex) => platePoint(plate, requiredPoint2(vertex.point, `${vertex.id}.point`));
  const edges = sketchEdges(plate.sketch);
  const selectedRelation = selectedRelationId
    ? sketchRelations(plate.sketch).find((relation) => relation.id === selectedRelationId)
    : null;
  const relationSelection = relationSelectionEntityIds(selectedRelation, relationEdges);
  const selectedEdgeIds = new Set([...manualSelectedEdgeIds, ...relationSelection.edgeIds]);
  const selectedVertexIds = new Set([...manualSelectedVertexIds, ...relationSelection.vertexIds]);
  const curveOptions = {
    circleSegments: settings.plateSketchCircleSegments || settings.circleSegments || 32,
    segmentLength: settings.plateSketchCurveSegmentLength || settings.curveSegmentLength
  };
  const lineSpecs = edges.length
    ? edges.map((edge) => ({ edge, from: vertexMap.get(edge.from), to: vertexMap.get(edge.to) }))
    : vertices.map((vertex, index) => ({ edge: null, from: vertex, to: vertices[(index + 1) % vertices.length] }));
  const facePoints = plateOutline(plate, curveOptions);
  const faces = !showRelations && vertices.length >= 3 && isConvexPolygon(facePoints)
    ? [{
        points: facePoints.map((point) => platePoint(plate, point)),
        color: cleanFillColor,
        opacity: settings.plateSketchCleanFillOpacity ?? 0.24
      }]
    : [];
  const lines = lineSpecs
    .filter(({ from, to }) => from && to)
    .map(({ edge, from, to }) => {
      const selected = edge && selectedEdgeIds.has(edge.id);
      const localPoints = edge
        ? sketchEdgeSamplePoints(plate.sketch, edge, curveOptions)
        : [requiredPoint2(from.point, `${from.id}.point`), requiredPoint2(to.point, `${to.id}.point`)];
      return {
        points: localPoints.map((point) => platePoint(plate, point)),
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
    const localPoints = sketchEdgeSamplePoints(plate.sketch, edge, curveOptions);
    lines.push({
      points: localPoints.map((point) => platePoint(plate, point)),
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
  const handles = [{
    type: "square",
    kind: "plate-sketch-center",
    target: `${plate.id}:center`,
    objectId: plate.id,
    plateId: plate.id,
    point: [...plate.center],
    dragAxes: {
      x: v.norm(plate.localAxisY),
      y: v.norm(plate.localAxisZ)
    },
    color: settings.plateSketchCenterHandleColor || cleanOutlineColor,
    opacity: settings.plateSketchCenterHandleOpacity ?? 0.86,
    radius: !showRelations ? 5 : 7,
    hitTolerancePx: settings.plateSketchCenterHitTolerancePx ?? 16,
    pickPriority: settings.plateSketchCenterPickPriority ?? 12,
    hoverLabel: "Move sketch"
  }, ...vertices.map((vertex, index) => ({
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
  }))];
  const edgeLabels = [];
  const cornerReliefLabels = [];
  let bendGeometryForCornerReliefs = null;
  for (const [index, corner] of plateCornerReliefs(plate).entries()) {
    if (!corner.relief) continue;
    if (corner.scope === "bend" && !bendGeometryForCornerReliefs) {
      bendGeometryForCornerReliefs = plateBendGeometry(plate, curveOptions);
    }
    const point = cornerReliefMarkerPoint(plate, corner, { bendGeometry: bendGeometryForCornerReliefs });
    if (!point) continue;
    const selected = selectedVertexIds.has(corner.vertexId);
    const markerColor = selected
      ? settings.plateCornerReliefSelectedHandleColor || RELATION_SELECTION_COLOR
      : settings.plateCornerReliefHandleColor || "#f59e0b";
    handles.push({
      type: "square",
      kind: "plate-corner-relief",
      target: `${plate.id}:${corner.vertexId}:corner-relief`,
      objectId: plate.id,
      plateId: plate.id,
      cornerReliefId: corner.id,
      cornerReliefVertexId: corner.vertexId,
      vertexId: corner.vertexId,
      point,
      color: markerColor,
      hoverColor: settings.plateCornerReliefHoverColor || "#fef08a",
      opacity: settings.plateCornerReliefHandleOpacity ?? 0.95,
      radius: selected ? 11 : 8,
      hoverRadiusAddPx: 3,
      hitTolerancePx: settings.plateCornerReliefHitTolerancePx ?? 18,
      pickPriority: settings.plateCornerReliefPickPriority ?? 55,
      draggable: false,
      hoverLabel: `Edit relief corner ${index + 1}`
    });
    cornerReliefLabels.push({
      point,
      text: "R",
      color: markerColor,
      className: `plate-corner-relief${selected ? " selected" : ""}`,
      title: `Relief corner ${index + 1}; click to edit`,
      screenOffsetPx: { x: 10, y: -15 }
    });
  }
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
        id: "fillet-corner",
        label: "Add fillet",
        badge: "R",
        tone: "primary",
        title: "Add corner radius",
        handle: {
          kind: "plate-sketch-fillet-corner",
          target: `${vertex.id}:fillet`,
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
    const sketchPoint = sketchEdgeMidpoint(plate.sketch, edge);
    const edgePoints = sketchEdgeSamplePoints(plate.sketch, edge, curveOptions).map((point) => platePoint(plate, point));
    const displayOnlySamplePoints = sketchEdgeIsCircularArc(plate.sketch, edge.id) && edgePoints.length > 2
      ? edgePoints.slice(1, -1)
      : [];
    handles.push({
      kind: "plate-sketch-edge",
      target: `${edge.id}:edge`,
      objectId: plate.id,
      plateId: plate.id,
      edgeId: edge.id,
      fromVertexId: edge.from,
      toVertexId: edge.to,
      point: platePoint(plate, sketchPoint),
      points: edgePoints,
      displayOnlySamplePoints,
      displayOnlySampleHitTolerancePx: settings.plateSketchDisplayOnlySampleHitTolerancePx ?? 6,
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
    if (showRelations && selectedEdgeIds.has(edge.id) && sketchEdgeIsCircularArc(plate.sketch, edge.id)) {
      const directionLabel = edge.direction === "cw" ? "CW" : "CCW";
      const directionColor = settings.plateSketchArcDirectionColor || RELATION_SELECTION_COLOR;
      const screenOffsetPx = settings.plateSketchArcDirectionOffsetPx || { x: 0, y: -24 };
      handles.push({
        type: "circle",
        kind: "plate-sketch-arc-direction",
        target: `${edge.id}:arc-direction`,
        objectId: plate.id,
        plateId: plate.id,
        edgeId: edge.id,
        point: platePoint(plate, sketchPoint),
        screenOffsetPx,
        color: directionColor,
        hoverColor: settings.plateSketchArcDirectionHoverColor || "#fef08a",
        opacity: settings.plateSketchArcDirectionOpacity ?? 0.92,
        radius: settings.plateSketchArcDirectionRadiusPx ?? 7,
        hitTolerancePx: settings.plateSketchArcDirectionHitTolerancePx ?? 18,
        pickPriority: settings.plateSketchArcDirectionPickPriority ?? 42,
        draggable: false,
        direction: edge.direction === "cw" ? "cw" : "ccw",
        hoverLabel: `Flip arc direction (currently ${directionLabel})`
      });
      edgeLabels.push({
        point: platePoint(plate, sketchPoint),
        text: directionLabel,
        color: directionColor,
        className: "plate-sketch-arc-direction",
        title: `Arc direction ${directionLabel}; click to flip`,
        screenOffsetPx: {
          x: (screenOffsetPx.x || 0) + 11,
          y: screenOffsetPx.y || 0
        }
      });
    }
  }
  if (showRelations) for (const edge of constructionEdges) {
    const from = vertexMap.get(edge.from);
    const to = vertexMap.get(edge.to);
    if (!from || !to) continue;
    const sketchPoint = sketchEdgeMidpoint(plate.sketch, edge);
    const selected = selectedEdgeIds.has(edge.id);
    const constructionEdgePoints = sketchEdgeSamplePoints(plate.sketch, edge, curveOptions).map((point) => platePoint(plate, point));
    const displayOnlySamplePoints = sketchEdgeIsCircularArc(plate.sketch, edge.id) && constructionEdgePoints.length > 2
      ? constructionEdgePoints.slice(1, -1)
      : [];
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
      points: constructionEdgePoints,
      displayOnlySamplePoints,
      displayOnlySampleHitTolerancePx: settings.plateSketchDisplayOnlySampleHitTolerancePx ?? 6,
      color: selected ? CONSTRUCTION_EDGE_SELECTED_COLOR : settings.plateSketchConstructionEdgeColor || CONSTRUCTION_EDGE_COLOR,
      visible: false,
      radius: 0,
      hitTolerancePx: 14,
      hoverLabel: "Select construction edge"
    });
  }
  const labels = [
    ...dimensionOverlay.labels,
    ...edgeLabels,
    ...cornerReliefLabels,
    ...(showRelations && handles.length ? [{
      point: handles[0].point,
      text: "Sketch",
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
  if (options.toolPreview?.kind === "circle" && Array.isArray(options.toolPreview.centerPoint)) {
    const centerPoint = requiredPoint2(options.toolPreview.centerPoint, "sketch circle preview center");
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch circle preview radius point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:circle-preview-center`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, centerPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Circle center"
    });
    labels.push({
      point: platePoint(plate, centerPoint),
      text: "Circle center",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (preview && len2(sub2(preview, centerPoint)) > EPSILON) {
      const radius = len2(sub2(preview, centerPoint));
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      const circlePoints = sampleCirclePreview(centerPoint, radius, curveOptions);
      if (circlePoints.length) {
        lines.push({
          points: circlePoints.map((point) => platePoint(plate, point)),
          color: previewColor,
          collection: "authoring",
          kind: "plate-sketch-tool-preview",
          objectId: plate.id,
          lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
        });
      }
    }
  }
  if (options.toolPreview?.kind === "diameterCircle" && Array.isArray(options.toolPreview.firstPoint)) {
    const firstPoint = requiredPoint2(options.toolPreview.firstPoint, "sketch diameter circle preview first point");
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch diameter circle preview second point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:diameter-circle-preview-first`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, firstPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Diameter Circle first point"
    });
    labels.push({
      point: platePoint(plate, firstPoint),
      text: "Diameter start",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (preview && len2(sub2(preview, firstPoint)) > EPSILON) {
      const centerPoint = mul2(add2(firstPoint, preview), 0.5);
      const radius = len2(sub2(preview, firstPoint)) / 2;
      lines.push({
        points: [platePoint(plate, firstPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      const circlePoints = sampleCirclePreview(centerPoint, radius, curveOptions);
      if (circlePoints.length) {
        lines.push({
          points: circlePoints.map((point) => platePoint(plate, point)),
          color: previewColor,
          collection: "authoring",
          kind: "plate-sketch-tool-preview",
          objectId: plate.id,
          lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
        });
      }
    }
  }
  if (options.toolPreview?.kind === "threePointCircle" && Array.isArray(options.toolPreview.firstPoint)) {
    const firstPoint = requiredPoint2(options.toolPreview.firstPoint, "sketch 3 point circle preview first point");
    const secondPoint = Array.isArray(options.toolPreview.secondPoint)
      ? requiredPoint2(options.toolPreview.secondPoint, "sketch 3 point circle preview second point")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch 3 point circle preview third point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    labels.push({
      point: platePoint(plate, firstPoint),
      text: "Circle point 1",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!secondPoint && preview && len2(sub2(preview, firstPoint)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, firstPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (secondPoint) {
      lines.push({
        points: [platePoint(plate, firstPoint), platePoint(plate, secondPoint)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      if (preview) {
        const circle = circleThroughPreviewPoints(firstPoint, secondPoint, preview);
        const circlePoints = circle
          ? sampleCirclePreview(circle.center, circle.radius, curveOptions)
          : [];
        if (circlePoints.length) {
          lines.push({
            points: circlePoints.map((point) => platePoint(plate, point)),
            color: previewColor,
            collection: "authoring",
            kind: "plate-sketch-tool-preview",
            objectId: plate.id,
            lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
          });
        }
      }
    }
  }
  if (options.toolPreview?.kind === "slot" && Array.isArray(options.toolPreview.startCenter)) {
    const startCenter = requiredPoint2(options.toolPreview.startCenter, "sketch slot preview start center");
    const endCenter = Array.isArray(options.toolPreview.endCenter)
      ? requiredPoint2(options.toolPreview.endCenter, "sketch slot preview end center")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch slot preview radius point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:slot-preview-start`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, startCenter),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Slot start center"
    });
    labels.push({
      point: platePoint(plate, startCenter),
      text: "Slot start",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!endCenter && preview && len2(sub2(preview, startCenter)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, startCenter), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (endCenter) {
      handles.push({
        type: "square",
        kind: "plate-sketch-tool-preview-center",
        target: `${plate.id}:slot-preview-end`,
        objectId: plate.id,
        plateId: plate.id,
        point: platePoint(plate, endCenter),
        color: previewColor,
        radius: 7,
        draggable: false,
        hoverLabel: "Slot end center"
      });
      lines.push({
        points: [platePoint(plate, startCenter), platePoint(plate, endCenter)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      if (preview) {
        const radius = slotRadiusFromPreviewPoint(startCenter, endCenter, preview);
        const slotPoints = sampleSlotPreview(startCenter, endCenter, radius, curveOptions);
        if (slotPoints.length) {
          lines.push({
            points: slotPoints.map((point) => platePoint(plate, point)),
            color: previewColor,
            collection: "authoring",
            kind: "plate-sketch-tool-preview",
            objectId: plate.id,
            lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
          });
        }
      }
    }
  }
  if (options.toolPreview?.kind === "centerSlot" && Array.isArray(options.toolPreview.centerPoint)) {
    const centerPoint = requiredPoint2(options.toolPreview.centerPoint, "sketch center slot preview center");
    const axisPoint = Array.isArray(options.toolPreview.axisPoint)
      ? requiredPoint2(options.toolPreview.axisPoint, "sketch center slot preview axis")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch center slot preview point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:center-slot-preview-center`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, centerPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Center Slot center"
    });
    labels.push({
      point: platePoint(plate, centerPoint),
      text: "Slot center",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!axisPoint && preview && len2(sub2(preview, centerPoint)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (axisPoint) {
      const axis = sub2(axisPoint, centerPoint);
      const startCenter = sub2(centerPoint, axis);
      const endCenter = add2(centerPoint, axis);
      for (const [key, point, label] of [
        ["start", startCenter, "Slot start center"],
        ["end", endCenter, "Slot end center"]
      ]) {
        handles.push({
          type: "square",
          kind: "plate-sketch-tool-preview-center",
          target: `${plate.id}:center-slot-preview-${key}`,
          objectId: plate.id,
          plateId: plate.id,
          point: platePoint(plate, point),
          color: previewColor,
          radius: 6,
          draggable: false,
          hoverLabel: label
        });
      }
      lines.push({
        points: [platePoint(plate, startCenter), platePoint(plate, endCenter)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      if (preview) {
        const radius = slotRadiusFromPreviewPoint(startCenter, endCenter, preview);
        const slotPoints = sampleSlotPreview(startCenter, endCenter, radius, curveOptions);
        if (slotPoints.length) {
          lines.push({
            points: slotPoints.map((point) => platePoint(plate, point)),
            color: previewColor,
            collection: "authoring",
            kind: "plate-sketch-tool-preview",
            objectId: plate.id,
            lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
          });
        }
      }
    }
  }
  if (options.toolPreview?.kind === "centerRectangle" && Array.isArray(options.toolPreview.centerPoint)) {
    const centerPoint = requiredPoint2(options.toolPreview.centerPoint, "sketch center rectangle preview center");
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch center rectangle preview corner")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:center-rectangle-preview-center`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, centerPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Center Rectangle center"
    });
    labels.push({
      point: platePoint(plate, centerPoint),
      text: "Rect center",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (preview && Math.abs(preview[0] - centerPoint[0]) > EPSILON && Math.abs(preview[1] - centerPoint[1]) > EPSILON) {
      lines.push({
        points: rectanglePreviewPoints(centerPoint, preview).map((point) => platePoint(plate, point)),
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    } else if (preview && len2(sub2(preview, centerPoint)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
  }
  if (options.toolPreview?.kind === "roundedRectangle" && Array.isArray(options.toolPreview.centerPoint)) {
    const centerPoint = requiredPoint2(options.toolPreview.centerPoint, "sketch rounded rectangle preview center");
    const corner = Array.isArray(options.toolPreview.cornerPoint)
      ? requiredPoint2(options.toolPreview.cornerPoint, "sketch rounded rectangle preview corner")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch rounded rectangle preview radius point")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:rounded-rectangle-preview-center`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, centerPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Rounded Rectangle center"
    });
    labels.push({
      point: platePoint(plate, centerPoint),
      text: "Rounded rect center",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!corner && preview && len2(sub2(preview, centerPoint)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (corner) {
      const rectanglePoints = rectanglePreviewPoints(centerPoint, corner);
      const radius = preview ? roundedRectangleRadiusFromPreviewPoint(centerPoint, corner, preview) : null;
      const roundedPoints = radius
        ? sampleRoundedRectanglePreview(centerPoint, corner, radius, curveOptions)
        : [];
      lines.push({
        points: (roundedPoints.length ? roundedPoints : rectanglePoints).map((point) => platePoint(plate, point)),
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
  }
  if (options.toolPreview?.kind === "line" && Array.isArray(options.toolPreview.startPoint)) {
    const start = requiredPoint2(options.toolPreview.startPoint, "sketch line preview start");
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch line preview end")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    if (preview && len2(sub2(preview, start)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, start), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    labels.push({
      point: platePoint(plate, start),
      text: "Line start",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
  }
  if (options.toolPreview?.kind === "lineContour" && Array.isArray(options.toolPreview.points)) {
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    const contourPoints = options.toolPreview.points
      .filter((point) => Array.isArray(point))
      .map((point) => requiredPoint2(point, "sketch line contour preview point"));
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch line contour preview end")
      : null;
    const pendingArc = options.toolPreview.pendingArcSegment && Array.isArray(options.toolPreview.pendingArcSegment.throughPoint)
      ? options.toolPreview.pendingArcSegment
      : null;
    const arcPreview = Array.isArray(options.toolPreview.arcPreviewPoint)
      ? requiredPoint2(options.toolPreview.arcPreviewPoint, "sketch line contour arc preview through")
      : pendingArc
        ? requiredPoint2(pendingArc.throughPoint, "sketch line contour pending arc preview through")
      : null;
    const previewPoints = preview ? [...contourPoints, preview] : contourPoints;
    if (previewPoints.length >= 2) {
      lines.push({
        points: previewPoints.map((point) => platePoint(plate, point)),
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (previewPoints.length >= 3) {
      lines.push({
        points: [platePoint(plate, previewPoints[previewPoints.length - 1]), platePoint(plate, previewPoints[0])],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        opacity: settings.plateSketchToolPreviewClosureOpacity ?? 0.55,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (arcPreview && contourPoints.length >= 2) {
      const start = contourPoints[contourPoints.length - 2];
      const end = contourPoints[contourPoints.length - 1];
      const arcPoints = sampleThreePointArcPreview(start, arcPreview, end, curveOptions);
      if (arcPoints.length) {
        lines.push({
          points: arcPoints.map((point) => platePoint(plate, point)),
          color: previewColor,
          collection: "authoring",
          kind: "plate-sketch-tool-preview-arc",
          objectId: plate.id,
          lineWidth: (settings.plateSketchToolPreviewLineWidth ?? 2) + 1
        });
        labels.push({
          point: platePoint(plate, arcPreview),
          text: options.toolPreview.arcPreviewFlipped || pendingArc?.flipped ? "Arc preview flipped" : "Arc preview",
          color: previewColor,
          className: "plate-sketch-tool-preview",
          screenOffsetPx: { x: 10, y: -18 }
        });
      }
    }
    if (contourPoints.length) {
      labels.push({
        point: platePoint(plate, contourPoints[0]),
        text: "Contour start",
        color: previewColor,
        className: "plate-sketch-tool-preview",
        screenOffsetPx: { x: 10, y: -18 }
      });
    }
  }
  if (options.toolPreview?.kind === "centerArc" && Array.isArray(options.toolPreview.centerPoint)) {
    const centerPoint = requiredPoint2(options.toolPreview.centerPoint, "sketch center arc preview center");
    const start = Array.isArray(options.toolPreview.startPoint)
      ? requiredPoint2(options.toolPreview.startPoint, "sketch center arc preview start")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch center arc preview end")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    handles.push({
      type: "square",
      kind: "plate-sketch-tool-preview-center",
      target: `${plate.id}:center-arc-preview-center`,
      objectId: plate.id,
      plateId: plate.id,
      point: platePoint(plate, centerPoint),
      color: previewColor,
      radius: 7,
      draggable: false,
      hoverLabel: "Center Arc center"
    });
    labels.push({
      point: platePoint(plate, centerPoint),
      text: "Arc center",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!start && preview && len2(sub2(preview, centerPoint)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (start) {
      lines.push({
        points: [platePoint(plate, centerPoint), platePoint(plate, start)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
      if (preview) {
        const arcPoints = sampleCenterArcPreview(centerPoint, start, preview, curveOptions);
        if (arcPoints.length) {
          lines.push({
            points: arcPoints.map((point) => platePoint(plate, point)),
            color: previewColor,
            collection: "authoring",
            kind: "plate-sketch-tool-preview",
            objectId: plate.id,
            lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
          });
        }
      }
    }
  }
  if (options.toolPreview?.kind === "threePointArc" && Array.isArray(options.toolPreview.startPoint)) {
    const start = requiredPoint2(options.toolPreview.startPoint, "sketch 3 point arc preview start");
    const through = Array.isArray(options.toolPreview.throughPoint)
      ? requiredPoint2(options.toolPreview.throughPoint, "sketch 3 point arc preview through")
      : null;
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch 3 point arc preview end")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    labels.push({
      point: platePoint(plate, start),
      text: "Arc start",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    if (!through && preview && len2(sub2(preview, start)) > EPSILON) {
      lines.push({
        points: [platePoint(plate, start), platePoint(plate, preview)],
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
    if (through) {
      labels.push({
        point: platePoint(plate, through),
        text: "Arc through",
        color: previewColor,
        className: "plate-sketch-tool-preview",
        screenOffsetPx: { x: 10, y: -18 }
      });
      if (!preview || len2(sub2(preview, through)) <= EPSILON) {
        lines.push({
          points: [platePoint(plate, start), platePoint(plate, through)],
          color: previewColor,
          collection: "authoring",
          kind: "plate-sketch-tool-preview",
          objectId: plate.id,
          lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
        });
      } else {
        const arcPoints = sampleThreePointArcPreview(start, through, preview, curveOptions);
        lines.push({
          points: (arcPoints.length ? arcPoints : [start, through, preview]).map((point) => platePoint(plate, point)),
          color: previewColor,
          collection: "authoring",
          kind: "plate-sketch-tool-preview",
          objectId: plate.id,
          lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
        });
      }
    }
  }
  if (options.toolPreview?.kind === "edgeArc" && Array.isArray(options.toolPreview.startPoint) && Array.isArray(options.toolPreview.endPoint)) {
    const start = requiredPoint2(options.toolPreview.startPoint, "sketch edge arc preview start");
    const end = requiredPoint2(options.toolPreview.endPoint, "sketch edge arc preview end");
    const preview = Array.isArray(options.toolPreview.previewPoint)
      ? requiredPoint2(options.toolPreview.previewPoint, "sketch edge arc preview through")
      : null;
    const previewColor = settings.plateSketchToolPreviewColor || "#f97316";
    labels.push({
      point: platePoint(plate, start),
      text: "Edge Arc",
      color: previewColor,
      className: "plate-sketch-tool-preview",
      screenOffsetPx: { x: 10, y: -18 }
    });
    lines.push({
      points: [platePoint(plate, start), platePoint(plate, end)],
      color: previewColor,
      collection: "authoring",
      kind: "plate-sketch-tool-preview",
      objectId: plate.id,
      lineWidth: Math.max(1, (settings.plateSketchToolPreviewLineWidth ?? 2) - 1)
    });
    if (preview) {
      const arcPoints = sampleThreePointArcPreview(start, preview, end, curveOptions);
      lines.push({
        points: (arcPoints.length ? arcPoints : [start, preview, end]).map((point) => platePoint(plate, point)),
        color: previewColor,
        collection: "authoring",
        kind: "plate-sketch-tool-preview",
        objectId: plate.id,
        lineWidth: settings.plateSketchToolPreviewLineWidth ?? 2
      });
    }
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

export function relationActionOverlayForSelection(plate, { edges, vertexMap, constructionEdgeIds = new Set(), selectedEdgeIds, selectedVertexIds, settings = {} }) {
  const handles = [];
  const labels = [];
  const quickLists = [];
  const actionColor = settings.plateSketchRelationActionColor || RELATION_ACTION_COLOR;
  const actionLabel = (type, existingRelation = null) => {
    if (type === "clear") return "Clear selection";
    if (type === "construction-line") return "Construction line";
    if (type === "diameter") return existingRelation ? "Select Diameter" : "Diameter";
    if (type === "flip-arc") return "Flip Arc";
    if (type === "split-arc") return "Split Arc";
    const label = sketchRelationLabel(existingRelation || { type });
    return existingRelation ? `Select ${label}` : label;
  };
  const radiusDisplayForAction = (type) => type === "diameter" ? "diameter" : type === "radius" ? "radius" : null;
  const existingRelationForDisplayAction = (type, options = {}) => {
    const existingRelation = existingRelationForAction(plate.sketch, type, options);
    const display = radiusDisplayForAction(type);
    if (!display || !existingRelation || existingRelation.type !== "radius") return existingRelation;
    return sketchRadiusRelationDisplay(existingRelation) === display ? existingRelation : null;
  };
  const actionItem = (basePoint, type, index, options = {}) => {
    const existingAnyRelation = type === "clear" || type === "construction-line"
      ? null
      : type === "flip-arc" || type === "split-arc"
        ? null
        : existingRelationForAction(plate.sketch, type, options);
    const existingRelation = type === "clear" || type === "construction-line"
      ? null
      : type === "flip-arc" || type === "split-arc"
        ? null
        : existingRelationForDisplayAction(type, options);
    const radiusDisplaySwitch = radiusDisplayForAction(type) && existingAnyRelation && !existingRelation;
    const isSketchCommand = type === "flip-arc" || type === "split-arc";
    const preview = existingRelation || radiusDisplaySwitch || type === "clear" || type === "construction-line" || isSketchCommand
      ? null
      : relationActionPreview(plate, type, options);
    const previewStatus = radiusDisplaySwitch ? "ok" : relationHealthStatus(preview?.health);
    const previewMessage = String(preview?.health?.message || "").trim();
    const text = options.label || relationActionBadge(type);
    const color = type === "clear"
      ? "#64748b"
      : existingRelation
        ? RELATION_SELECTION_COLOR
        : isSketchCommand
          ? actionColor
        : preview?.health
        ? relationHealthColor(preview.health, actionColor)
        : actionColor;
    const title = options.hoverLabel || (
      type === "clear"
        ? "Clear sketch selection"
        : isSketchCommand
          ? (type === "flip-arc" ? "Flip selected circular arc" : "Split selected circular arc")
        : existingRelation
          ? `Select existing ${sketchRelationLabel(existingRelation).toLowerCase()} relation`
          : radiusDisplaySwitch
            ? `Switch ${sketchRelationLabel(existingAnyRelation).toLowerCase()} to ${radiusDisplayForAction(type)} display`
          : previewStatus === "conflicted"
            ? `Add ${text} relation - ${previewMessage || "will conflict"}`
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
        radius: options.radius ?? undefined,
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
    const firstPoint = requiredPoint2(first.point, `${first.id}.point`);
    const secondPoint = requiredPoint2(second.point, `${second.id}.point`);
    const basePoint = midpoint(firstPoint, secondPoint);
    if (selectedEdgeIds.length === 1) {
      const pair = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
      if (!pair) return { handles, labels, quickLists };
      const actionPoint = midpoint(basePoint, midpoint(pair.from, pair.to));
      const isCircularArc = sketchEdgeIsCircularArc(plate.sketch, selectedEdgeIds[0]);
      const actions = isCircularArc ? ["clear"] : ["symmetric", "clear"];
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
      distance: type === "distance" ? len2(sub2(secondPoint, firstPoint)) : undefined,
      label: type === "clear" ? "CLR" : relationActionBadge(type),
      hoverLabel: type === "clear" ? "Clear sketch selection" : `Add ${sketchRelationLabel({ type }).toLowerCase()} relation`
    }));
    return { handles, labels, quickLists };
  }

  if (selectedVertexIds.length === 1 && selectedEdgeIds.length === 1) {
    const vertex = vertexMap.get(selectedVertexIds[0]);
    const pair = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
    if (!vertex || !pair) return { handles, labels, quickLists };
    const basePoint = midpoint(requiredPoint2(vertex.point, `${vertex.id}.point`), midpoint(pair.from, pair.to));
    const pointLineAllowed = pair.edge.from !== selectedVertexIds[0] && pair.edge.to !== selectedVertexIds[0];
    const isCircularArc = sketchEdgeIsCircularArc(plate.sketch, selectedEdgeIds[0]);
    const canMovePointToCircle = pointLineAllowed
      && isCircularArc
      && !vertexTouchesOtherCircularArc(plate.sketch, edges, selectedVertexIds[0], selectedEdgeIds[0]);
    const actions = canMovePointToCircle
      ? ["point-on-circle", "clear"]
      : pointLineAllowed
        ? isCircularArc
          ? ["clear"]
          : ["point-on-line", "midpoint", "clear"]
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
    pushActionList(requiredPoint2(vertex.point, `${vertex.id}.point`), actions, (type) => ({
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
    const isCircularArc = sketchEdgeIsCircularArc(plate.sketch, edgeId);
    const isConstructionEdge = constructionEdgeIds.has(edgeId);
    const actions = isCircularArc && isConstructionEdge
      ? ["fixed", "radius", "diameter", "clear"]
      : isCircularArc
      ? ["flip-arc", "split-arc", "fixed", "radius", "diameter", "clear"]
      : isConstructionEdge
      ? ["horizontal", "vertical", "fixed", "clear"]
      : ["horizontal", "vertical", "fixed", "construction-line", "clear"];
    pushActionList(basePoint, actions, (type) => ({
      edgeId,
      radius: type === "radius" || type === "diameter" ? measuredSketchEdgeRadius(plate.sketch, edgeId) : undefined,
      label: type === "clear" ? "CLR" : undefined
    }));
    return { handles, labels, quickLists };
  }

  if (selectedEdgeIds.length === 2) {
    const first = edgePointPair(edges, vertexMap, selectedEdgeIds[0]);
    const second = edgePointPair(edges, vertexMap, selectedEdgeIds[1]);
    if (!first || !second) return { handles, labels, quickLists };
    const basePoint = midpoint(midpoint(first.from, first.to), midpoint(second.from, second.to));
    const firstArc = sketchEdgeIsCircularArc(plate.sketch, selectedEdgeIds[0]);
    const secondArc = sketchEdgeIsCircularArc(plate.sketch, selectedEdgeIds[1]);
    const actions = firstArc || secondArc
      ? [
        "tangent",
        ...(firstArc && secondArc ? ["concentric", "equal-radius"] : []),
        "clear"
      ]
      : [
        "parallel",
        "collinear",
        "perpendicular",
        "equal-length",
        "angle",
        "clear"
      ];
    pushActionList(basePoint, actions, (type) => ({
      edgeIds: selectedEdgeIds,
      targetEdgeId: selectedEdgeIds[1],
      angle: type === "angle" ? sketchEdgeAngleDegrees(plate.sketch, selectedEdgeIds) : undefined,
      label: type === "clear" ? "CLR" : undefined
    }));
  }

  return { handles, labels, quickLists };
}
