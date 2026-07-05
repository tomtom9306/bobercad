import { v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { measuredSketchEdgeRadius, sketchAngleRelationMode, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeCenterPoint, sketchEdgeIsCircularArc, sketchEdgeMidpoint, sketchEdgePoints, sketchEdges, sketchEdgeTangentAtVertex, sketchPointDistance, sketchRelationKey, sketchRelationLabel, sketchRelations, sketchRelationsForEdge, sketchVertices } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { snapPointOverlay } from "../scene/authoring/snap-overlays.mjs";
import { DEFAULT_INSERT_VERTEX_DRAG_THRESHOLD_PX } from "./plate-sketch/drag-edit-constants.mjs";
import { createPlateSketchDimensionActions } from "./plate-sketch/drag-edit-dimensions.mjs";
import { createPlateSketchMutationApi } from "./plate-sketch/drag-edit-mutations.mjs";
import { EPSILON, add2, dot2, edgePointPair, mul2, platePoint } from "./plate-sketch/sketch-edit-geometry.mjs";
import { pointerPlanePoint } from "./pointer-plane-point.mjs";

import {
  activePlate,
  activeSketchTarget,
  adjacentPointForConstraint,
  adjacentPointForLockedCorner,
  axisOrientation,
  constructionVertexDragContext,
  cutBodyOutline,
  edgeDragContext,
  edgeSnapCandidates,
  fixedRelationForEdge,
  fixedRelationForVertex,
  formatDeg,
  formatMm,
  freeSketchPointSnapCandidates,
  lockedVertexResult,
  overlayForPlate,
  plateSketchPlane,
  plateSketchPointFromWorld,
  relationSelectionEntityIds,
  samePoint2,
  screenDeltaToSketch,
  lineIntersectionPoint,
  segmentIntersectionPoint,
  shiftedEdgePoints,
  sketchEntityMaps,
  snappedEdgeDelta,
  snappedFreeSketchPoint,
  snappedNotchSize,
  snappedVertexPoint,
  vertexDragContext,
  vertexSnapCandidates
} from "./plate-sketch/drag-edit-helpers.mjs";

const TAU = Math.PI * 2;
const DEG_PER_RAD = 180 / Math.PI;
const POINT_BACKTRACK_SKETCH_TOOL_TYPES = new Set([
  "circle",
  "diameterCircle",
  "threePointCircle",
  "slot",
  "centerSlot",
  "centerRectangle",
  "roundedRectangle",
  "centerArc",
  "threePointArc",
  "line"
]);

function positiveAngle(angle) {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
}

function vertexTouchesOtherCircularArc(sketch, vertexId, targetEdgeId) {
  if (!vertexId || !targetEdgeId) return false;
  const { edges, constructionEdges } = sketchEntityMaps(sketch);
  return [...edges, ...constructionEdges].some((edge) => (
    edge?.id
    && edge.id !== targetEdgeId
    && (edge.from === vertexId || edge.to === vertexId)
    && sketchEdgeIsCircularArc(sketch, edge.id)
  ));
}

function sameCircularArcBasis(firstEdge, secondEdge) {
  if (firstEdge?.kind !== "circular-arc" || secondEdge?.kind !== "circular-arc") return false;
  if (firstEdge.direction !== secondEdge.direction) return false;
  const firstCenter = Array.isArray(firstEdge.center) ? firstEdge.center : null;
  const secondCenter = Array.isArray(secondEdge.center) ? secondEdge.center : null;
  const firstRadius = Number(firstEdge.radius);
  const secondRadius = Number(secondEdge.radius);
  if (!firstCenter || !secondCenter || !Number.isFinite(firstRadius) || !Number.isFinite(secondRadius)) return false;
  const tolerance = Math.max(EPSILON, Math.max(firstRadius, secondRadius) * 1e-6);
  return Math.abs(firstCenter[0] - secondCenter[0]) <= tolerance
    && Math.abs(firstCenter[1] - secondCenter[1]) <= tolerance
    && Math.abs(firstRadius - secondRadius) <= tolerance;
}

function pointOnCircleEndpointConflictMessage() {
  return "Plate sketch: Point On Circle cannot move a point that is already an endpoint of another circular arc";
}

function centerArcParameters(center, start, end) {
  const startVector = [start[0] - center[0], start[1] - center[1]];
  const endVector = [end[0] - center[0], end[1] - center[1]];
  const radius = Math.hypot(startVector[0], startVector[1]);
  const endLength = Math.hypot(endVector[0], endVector[1]);
  if (radius <= EPSILON || endLength <= EPSILON) return null;
  const startAngle = Math.atan2(startVector[1], startVector[0]);
  const endAngle = Math.atan2(endVector[1], endVector[0]);
  const ccwSweep = positiveAngle(endAngle - startAngle);
  const cross = startVector[0] * endVector[1] - startVector[1] * endVector[0];
  const dot = startVector[0] * endVector[0] + startVector[1] * endVector[1];
  if (Math.abs(cross) <= EPSILON && dot > 0) return null;
  const sweep = cross < 0 ? ccwSweep - TAU : ccwSweep;
  if (Math.abs(sweep) <= EPSILON || Math.abs(sweep) >= TAU - EPSILON) return null;
  return {
    center: [...center],
    radius,
    startAngleDegrees: startAngle * DEG_PER_RAD,
    sweepDegrees: sweep * DEG_PER_RAD
  };
}

function circleThroughThreeSketchPoints(start, through, end) {
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
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
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

function reflectedPointAcrossSketchLine(point, lineStart, lineEnd) {
  const line = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]];
  const lengthSq = line[0] * line[0] + line[1] * line[1];
  if (lengthSq <= EPSILON) return [...point];
  const relative = [point[0] - lineStart[0], point[1] - lineStart[1]];
  const t = (relative[0] * line[0] + relative[1] * line[1]) / lengthSq;
  const projection = [lineStart[0] + line[0] * t, lineStart[1] + line[1] * t];
  return [
    projection[0] * 2 - point[0],
    projection[1] * 2 - point[1]
  ];
}

function pointProjectedToSketchLineSegment(point, lineStart, lineEnd) {
  const line = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]];
  const lengthSq = line[0] * line[0] + line[1] * line[1];
  if (lengthSq <= EPSILON) return [...lineStart];
  const relative = [point[0] - lineStart[0], point[1] - lineStart[1]];
  const t = Math.max(0, Math.min(1, (relative[0] * line[0] + relative[1] * line[1]) / lengthSq));
  return [
    lineStart[0] + line[0] * t,
    lineStart[1] + line[1] * t
  ];
}

function threePointArcContourParameters(start, through, end) {
  const arc = circleThroughThreeSketchPoints(start, through, end);
  if (!arc) return null;
  const startAngle = Math.atan2(start[1] - arc.center[1], start[0] - arc.center[0]);
  const endAngle = Math.atan2(end[1] - arc.center[1], end[0] - arc.center[0]);
  const sweep = arc.direction === "ccw"
    ? positiveAngle(endAngle - startAngle)
    : -positiveAngle(startAngle - endAngle);
  if (Math.abs(sweep) <= EPSILON || Math.abs(sweep) >= TAU - EPSILON) return null;
  return {
    center: [...arc.center],
    radius: arc.radius,
    startAngleDegrees: startAngle * DEG_PER_RAD,
    sweepDegrees: sweep * DEG_PER_RAD
  };
}

function angleInsideArc(startAngle, endAngle, direction, angle) {
  const sweep = direction === "ccw"
    ? positiveAngle(endAngle - startAngle)
    : positiveAngle(startAngle - endAngle);
  const distance = direction === "ccw"
    ? positiveAngle(angle - startAngle)
    : positiveAngle(startAngle - angle);
  return distance > EPSILON && distance < sweep - EPSILON;
}

function pointIsOnCircularArc(edge, arcPair, point) {
  if (!edge?.center || !Number.isFinite(edge.radius) || edge.radius <= EPSILON) return false;
  const center = edge.center;
  const radiusDelta = Math.abs(Math.hypot(point[0] - center[0], point[1] - center[1]) - edge.radius);
  if (radiusDelta > Math.max(1e-6, edge.radius * 1e-6)) return false;
  const startAngle = Math.atan2(arcPair.from[1] - center[1], arcPair.from[0] - center[0]);
  const endAngle = Math.atan2(arcPair.to[1] - center[1], arcPair.to[0] - center[0]);
  const angle = Math.atan2(point[1] - center[1], point[0] - center[0]);
  return angleInsideArc(startAngle, endAngle, edge.direction === "cw" ? "cw" : "ccw", angle);
}

function lineCircleIntersections(lineFrom, lineTo, arcEdge) {
  if (!arcEdge?.center || !Number.isFinite(arcEdge.radius) || arcEdge.radius <= EPSILON) return [];
  const delta = [lineTo[0] - lineFrom[0], lineTo[1] - lineFrom[1]];
  const a = dot2(delta, delta);
  if (a <= EPSILON) return [];
  const relative = [lineFrom[0] - arcEdge.center[0], lineFrom[1] - arcEdge.center[1]];
  const b = 2 * dot2(relative, delta);
  const c = dot2(relative, relative) - arcEdge.radius * arcEdge.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -EPSILON) return [];
  const roots = Math.abs(discriminant) <= EPSILON
    ? [-b / (2 * a)]
    : [
      (-b - Math.sqrt(discriminant)) / (2 * a),
      (-b + Math.sqrt(discriminant)) / (2 * a)
    ];
  return roots
    .map((t) => ({
      t,
      point: [lineFrom[0] + delta[0] * t, lineFrom[1] + delta[1] * t]
    }))
    .filter((candidate, index, candidates) => (
      Number.isFinite(candidate.t)
        && candidates.findIndex((other) => Math.abs(other.t - candidate.t) <= EPSILON) === index
    ));
}

function lineCircularArcIntersections(lineFrom, lineTo, arcEdge, arcPair) {
  return lineCircleIntersections(lineFrom, lineTo, arcEdge)
    .filter((candidate) => pointIsOnCircularArc(arcEdge, arcPair, candidate.point));
}

function circularArcCircleIntersections(firstEdge, secondEdge) {
  if (!firstEdge?.center || !secondEdge?.center) return [];
  const firstRadius = Number(firstEdge.radius);
  const secondRadius = Number(secondEdge.radius);
  if (!Number.isFinite(firstRadius) || firstRadius <= EPSILON || !Number.isFinite(secondRadius) || secondRadius <= EPSILON) return [];
  const centerDelta = [secondEdge.center[0] - firstEdge.center[0], secondEdge.center[1] - firstEdge.center[1]];
  const centerDistance = Math.hypot(centerDelta[0], centerDelta[1]);
  if (centerDistance <= EPSILON) return [];
  const tolerance = Math.max(1e-6, Math.max(firstRadius, secondRadius) * 1e-6);
  if (centerDistance > firstRadius + secondRadius + tolerance) return [];
  if (centerDistance < Math.abs(firstRadius - secondRadius) - tolerance) return [];
  const firstAlong = (firstRadius * firstRadius - secondRadius * secondRadius + centerDistance * centerDistance) / (2 * centerDistance);
  const heightSq = firstRadius * firstRadius - firstAlong * firstAlong;
  if (heightSq < -tolerance) return [];
  const unit = [centerDelta[0] / centerDistance, centerDelta[1] / centerDistance];
  const base = [
    firstEdge.center[0] + unit[0] * firstAlong,
    firstEdge.center[1] + unit[1] * firstAlong
  ];
  const height = Math.sqrt(Math.max(0, heightSq));
  const normal = [-unit[1], unit[0]];
  const rawCandidates = height <= tolerance
    ? [base]
    : [
      [base[0] + normal[0] * height, base[1] + normal[1] * height],
      [base[0] - normal[0] * height, base[1] - normal[1] * height]
    ];
  return rawCandidates.filter((point, index, candidates) => (
    candidates.findIndex((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) <= tolerance) === index
  ));
}

function circularArcIntersections(firstEdge, firstPair, secondEdge, secondPair) {
  const tolerance = Math.max(1e-6, Math.max(firstEdge?.radius || 0, secondEdge?.radius || 0) * 1e-6);
  return circularArcCircleIntersections(firstEdge, secondEdge).filter((point, index, candidates) => (
    pointIsOnCircularArc(firstEdge, firstPair, point)
      && pointIsOnCircularArc(secondEdge, secondPair, point)
      && candidates.findIndex((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) <= tolerance) === index
  ));
}

function circularArcAngleParameters(edge, arcPair) {
  if (!edge?.center || !arcPair?.from || !arcPair?.to) return null;
  const startAngle = Math.atan2(arcPair.from[1] - edge.center[1], arcPair.from[0] - edge.center[0]);
  const endAngle = Math.atan2(arcPair.to[1] - edge.center[1], arcPair.to[0] - edge.center[0]);
  const direction = edge.direction === "cw" ? "cw" : "ccw";
  const sweep = direction === "ccw"
    ? positiveAngle(endAngle - startAngle)
    : positiveAngle(startAngle - endAngle);
  if (sweep <= EPSILON || sweep >= TAU - EPSILON) return null;
  return { center: edge.center, startAngle, endAngle, direction, sweep };
}

function circularArcExtensionDistance(parameters, point, endpointKey) {
  const angle = Math.atan2(point[1] - parameters.center[1], point[0] - parameters.center[0]);
  if (endpointKey === "from") {
    return parameters.direction === "ccw"
      ? positiveAngle(parameters.startAngle - angle)
      : positiveAngle(angle - parameters.startAngle);
  }
  return parameters.direction === "ccw"
    ? positiveAngle(angle - parameters.endAngle)
    : positiveAngle(parameters.endAngle - angle);
}

function circularArcEndpointExtensionCandidate(trimEdge, trimPair, point, endpointId = null) {
  const parameters = circularArcAngleParameters(trimEdge, trimPair);
  if (!parameters || pointIsOnCircularArc(trimEdge, trimPair, point)) return null;
  const complementSweep = TAU - parameters.sweep;
  const candidates = [
    {
      endpointId: trimEdge.from,
      distance: circularArcExtensionDistance(parameters, point, "from"),
      point
    },
    {
      endpointId: trimEdge.to,
      distance: circularArcExtensionDistance(parameters, point, "to"),
      point
    }
  ].filter((candidate) => (
    candidate.distance > EPSILON
      && candidate.distance < complementSweep - EPSILON
  ));
  if (!candidates.length) return null;
  const naturalCandidate = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (endpointId && naturalCandidate.endpointId !== endpointId) return null;
  return naturalCandidate;
}

function circularArcExtensionCandidates(trimEdge, trimPair, cutEdge, cutPair, endpointId = null) {
  const tolerance = Math.max(1e-6, Math.max(trimEdge?.radius || 0, cutEdge?.radius || 0) * 1e-6);
  return circularArcCircleIntersections(trimEdge, cutEdge)
    .filter((point, index, candidates) => (
      pointIsOnCircularArc(cutEdge, cutPair, point)
        && candidates.findIndex((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) <= tolerance) === index
    ))
    .map((point) => circularArcEndpointExtensionCandidate(trimEdge, trimPair, point, endpointId))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
}

export function createPlateSketchEditController({ viewer, api, snapManager, settings = {}, onProjectChange, onStatusChange, onSelectionChange, requestDimensionInput }) {
  if (typeof requestDimensionInput !== "function") throw new Error("createPlateSketchEditController requires requestDimensionInput");
  let activePlateId = null;
  let drag = null;
  let activeSnap = null;
  let sketchMode = "clean";
  let actionTarget = null;
  let selection = { edgeIds: [], vertexIds: [], relationId: null };
  let lastDragInput = null;
  let activeSketchTool = null;
  const dimensionPlacementOffsets = new Map();

  function plate() {
    return activePlate(api.project(), activePlateId);
  }

  function target() {
    return activeSketchTarget(api.project(), activePlateId);
  }

  function targetForId(objectId) {
    return activeSketchTarget(api.project(), objectId);
  }

  const {
    addSketchConstructionArc,
    addSketchConstructionLine,
    filletSketchCorner,
    flipSketchEdgeArc,
    inferSketchRelations,
    insertSketchVertex,
    notchSketchCorner,
    removeSketchConstructionLine,
    removeSketchRelation,
    removeSketchVertex,
    setSketchEdgeAngle,
    setSketchEdgeAngleMode,
    setSketchEdgeArc,
    setSketchEdgeLength,
    setSketchEdgeLengthMode,
    setSketchEdgeRadius,
    setSketchEdgeRadiusMode,
    setSketchPointDistance,
    setSketchPointDistanceMode,
    setSketchCircle,
    setSketchOutline,
    setSketchCenterRectangle,
    setSketchRoundedRectangle,
    setSketchSlot,
    setSketchCenterArc,
    setSketchThreePointArc,
    splitSketchArc,
    setSketchVertex,
    setSketchVertices,
    updateSketchCenter,
    upsertSketchRelation
  } = createPlateSketchMutationApi({ api, targetForId });

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
      vertexIds: selection.vertexIds.filter((vertexId) => vertexIds.has(vertexId)).slice(0, 3),
      relationId: relationIds.has(selection.relationId) ? selection.relationId : null
    };
    return selection;
  }

  function renderOverlay() {
    const current = plate();
    viewer.setAuthoringOverlay(current ? overlayForPlate(current, {
      settings,
      snap: activeSnap,
      toolPreview: sketchToolPreview(),
      selection: selectionForPlate(current),
      showRelations: sketchMode === "relations",
      actionTarget,
      dimensionPlacementOffsets: Object.fromEntries(dimensionPlacementOffsets)
    }) : null);
  }

  function sketchToolPreview() {
    if (!activeSketchTool) return null;
    if (activeSketchTool.type === "circle") {
      return {
        kind: "circle",
        centerPoint: activeSketchTool.centerPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "diameterCircle") {
      return {
        kind: "diameterCircle",
        firstPoint: activeSketchTool.firstPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "threePointCircle") {
      return {
        kind: "threePointCircle",
        firstPoint: activeSketchTool.firstPoint,
        secondPoint: activeSketchTool.secondPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "slot") {
      return {
        kind: "slot",
        startCenter: activeSketchTool.startCenter,
        endCenter: activeSketchTool.endCenter,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "centerSlot") {
      return {
        kind: "centerSlot",
        centerPoint: activeSketchTool.centerPoint,
        axisPoint: activeSketchTool.axisPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "centerRectangle") {
      return {
        kind: "centerRectangle",
        centerPoint: activeSketchTool.centerPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "roundedRectangle") {
      return {
        kind: "roundedRectangle",
        centerPoint: activeSketchTool.centerPoint,
        cornerPoint: activeSketchTool.cornerPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "centerArc") {
      return {
        kind: "centerArc",
        centerPoint: activeSketchTool.centerPoint,
        startPoint: activeSketchTool.startPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "threePointArc") {
      return {
        kind: "threePointArc",
        startPoint: activeSketchTool.startPoint,
        throughPoint: activeSketchTool.throughPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type === "edgeArc") {
      return {
        kind: "edgeArc",
        edgeId: activeSketchTool.edgeId,
        startPoint: activeSketchTool.startPoint,
        endPoint: activeSketchTool.endPoint,
        previewPoint: activeSketchTool.previewPoint
      };
    }
    if (activeSketchTool.type !== "line") return null;
    if (activeSketchTool.contour) {
      return {
        kind: "lineContour",
        points: activeSketchTool.points || [],
        previewPoint: activeSketchTool.previewPoint,
        arcPreviewPoint: activeSketchTool.arcPreviewPoint,
        arcPreviewFlipped: activeSketchTool.arcPreviewFlipped === true,
        pendingArcSegment: activeSketchTool.pendingArcSegment || null
      };
    }
    return {
      kind: "line",
      startPoint: activeSketchTool.startPoint,
      previewPoint: activeSketchTool.previewPoint
    };
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
    activeSketchTool = null;
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
    const current = plate();
    const currentTarget = target();
    const currentSelection = current ? selectionForPlate(current) : { ...selection };
    const activeSketchToolId = activeSketchTool?.type === "centerArc" && activeSketchTool.contour
      ? "centerArcContour"
      : activeSketchTool?.type === "line" && activeSketchTool.contour
        ? "lineContour"
        : activeSketchTool?.type === "threePointArc" && activeSketchTool.contour
          ? "threePointArcContour"
        : activeSketchTool?.type || null;
    const constructionEdgeIds = current
      ? new Set(sketchEntityMaps(current.sketch).constructionEdges.map((edge) => edge.id))
      : new Set();
    const constructionVertexIds = current
      ? new Set(sketchEntityMaps(current.sketch).constructionVertices.map((vertex) => vertex.id))
      : new Set();
    const selectedArcEdgeIds = current
      ? currentSelection.edgeIds.filter((edgeId) => {
        try {
          return sketchEdgeIsCircularArc(current.sketch, edgeId);
        } catch {
          return false;
        }
      })
      : [];
    const selectedFixedRelationIds = current
      ? [
        ...currentSelection.vertexIds.map((vertexId) => fixedRelationForVertex(current.sketch, vertexId)?.id).filter(Boolean),
        ...currentSelection.edgeIds.map((edgeId) => fixedRelationForEdge(current.sketch, edgeId)?.id).filter(Boolean)
      ]
      : [];
    return {
      plateId: activePlateId,
      collection: currentTarget?.collection || null,
      sketchMode,
      activeSketchTool: activeSketchToolId,
      selection: currentSelection,
      selectedConstructionEdgeIds: currentSelection.edgeIds.filter((edgeId) => constructionEdgeIds.has(edgeId)),
      selectedConstructionVertexIds: currentSelection.vertexIds.filter((vertexId) => constructionVertexIds.has(vertexId)),
      selectedArcEdgeIds,
      selectedFixedRelationIds
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
    activeSketchTool = null;
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
    if (!targetForId(objectId)) {
      clear({ overlay: true });
      return false;
    }
    if (activePlateId !== objectId) {
      activeSketchTool = null;
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
        vertexIds: selection.vertexIds.slice(0, 3),
        relationId: null
      };
      emitSelectionChange(options);
      return;
    }
    if (selection.edgeIds.includes(edgeId)) {
      selection = {
        edgeIds: selection.edgeIds,
        vertexIds: options.openActions ? selection.vertexIds.slice(0, 3) : [],
        relationId: null
      };
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
        : [...selection.vertexIds, vertexId].slice(-3);
      selection = {
        edgeIds: selection.edgeIds.slice(0, 2),
        vertexIds: nextVertexIds,
        relationId: null
      };
      emitSelectionChange(options);
      return;
    }
    if (selection.vertexIds.includes(vertexId)) {
      selection = {
        edgeIds: options.openActions ? selection.edgeIds.slice(0, 2) : [],
        vertexIds: selection.vertexIds,
        relationId: null
      };
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
      vertexIds: selection.vertexIds.length >= 3 ? [vertexId] : [...selection.vertexIds, vertexId],
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
      vertexIds: arrayValues(vertexIds).filter((vertexId) => validVertexIds.has(vertexId)).slice(0, 3),
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
    const hadTool = Boolean(activeSketchTool);
    if (!hadSelection && !hadTool && options.force !== true) return false;
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    activeSnap = null;
    activeSketchTool = null;
    sketchMode = "relations";
    actionTarget = null;
    if (options.render !== false) renderOverlay();
    emitSelectionChange(options);
    if (options.status !== false) {
      if (hadTool && !hadSelection) onStatusChange?.("Plate sketch: sketch tool cancelled");
      else if (hadSelection) onStatusChange?.("Plate sketch: selection cleared");
    }
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
      const nextProject = removeSketchRelation(current.id, relationId);
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

  function backtrackActiveLineContour() {
    if (activeSketchTool?.type !== "line" || !activeSketchTool.contour) return false;
    const current = plate();
    if (!current) return false;
    const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
    if (activeSketchTool.pendingArcSegment?.throughPoint) {
      activeSketchTool.pendingArcSegment = null;
      activeSketchTool.arcPreviewPoint = null;
      activeSketchTool.arcPreviewFlipped = false;
      activeSketchTool.previewPoint = null;
      activeSnap = null;
      onStatusChange?.("Plate sketch Line Contour: first segment arc unstaged; pick third point");
      renderOverlay();
      return true;
    }
    if (points.length > 0 && points.length < 3) {
      const nextPoints = points.slice(0, -1);
      const lastPoint = nextPoints[nextPoints.length - 1] || null;
      activeSketchTool.points = nextPoints;
      activeSketchTool.startPoint = lastPoint ? [...lastPoint] : null;
      activeSketchTool.previewPoint = null;
      activeSketchTool.arcPreviewPoint = null;
      activeSketchTool.arcPreviewFlipped = false;
      activeSnap = null;
      onStatusChange?.(lineToolStatus());
      renderOverlay();
      return true;
    }
    if (points.length >= 3) {
      const latestEdgeId = outlineEdgeBetweenPoints(api.project(), current.id, points[points.length - 2], points[points.length - 1]);
      if (latestEdgeId && sketchEdgeIsCircularArc(current.sketch, latestEdgeId)) {
        try {
          let nextProject = setSketchOutline(current.id, {
            outline: points,
            idPrefix: current.id
          });
          nextProject = restoreLineContourArcSegments(current.sketch, current.id, nextProject, { skipEdgeIds: [latestEdgeId] });
          const nextLatestEdgeId = outlineEdgeBetweenPoints(
            nextProject,
            current.id,
            points[points.length - 2],
            points[points.length - 1]
          );
          onProjectChange?.(nextProject);
          selectSketchDetail({ edgeIds: nextLatestEdgeId ? [nextLatestEdgeId] : [], sketchMode: "relations" });
          activeSketchTool = {
            type: "line",
            contour: true,
            points,
            startPoint: [...points[points.length - 1]],
            previewPoint: null,
            arcPreviewPoint: null,
            arcPreviewFlipped: false,
            pendingArcSegment: null,
            lastPointer: activeSketchTool.lastPointer || null
          };
          activeSnap = null;
          onStatusChange?.("Plate sketch Line Contour: latest arc reverted to line; pick next point");
          renderOverlay();
          return true;
        } catch (error) {
          activeSnap = null;
          onStatusChange?.(error.message || "Plate sketch Line Contour arc backtrack failed");
          renderOverlay();
          return true;
        }
      }
    }
    if (points.length === 3) {
      const nextPoints = points.slice(0, 2);
      const lastPoint = nextPoints[nextPoints.length - 1] || null;
      const pendingArcSegment = pendingLineContourArcSegmentFromStoredFirstEdge(current, points);
      activeSketchTool.points = nextPoints;
      activeSketchTool.startPoint = lastPoint ? [...lastPoint] : null;
      activeSketchTool.previewPoint = null;
      activeSketchTool.arcPreviewPoint = pendingArcSegment?.throughPoint || null;
      activeSketchTool.arcPreviewFlipped = false;
      activeSketchTool.pendingArcSegment = pendingArcSegment;
      activeSnap = null;
      selectSketchDetail({ sketchMode: "relations" });
      onStatusChange?.(`Plate sketch Line Contour: backtracked third point${pendingArcSegment ? " with first arc" : ""}; pick replacement third point`);
      renderOverlay();
      return true;
    }
    if (points.length > 3) {
      const nextPoints = points.slice(0, -1);
      const lastPoint = nextPoints[nextPoints.length - 1] || null;
      try {
        let nextProject = setSketchOutline(current.id, {
          outline: nextPoints,
          idPrefix: current.id
        });
        nextProject = restoreLineContourArcSegments(current.sketch, current.id, nextProject);
        const latestEdgeId = outlineEdgeBetweenPoints(
          nextProject,
          current.id,
          nextPoints[nextPoints.length - 2],
          nextPoints[nextPoints.length - 1]
        );
        onProjectChange?.(nextProject);
        selectSketchDetail({ edgeIds: latestEdgeId ? [latestEdgeId] : [], sketchMode: "relations" });
        activeSketchTool = {
          type: "line",
          contour: true,
          points: nextPoints,
          startPoint: lastPoint ? [...lastPoint] : null,
          previewPoint: null,
          arcPreviewPoint: null,
          arcPreviewFlipped: false,
          pendingArcSegment: null,
          lastPointer: activeSketchTool.lastPointer || null
        };
        activeSnap = null;
        onStatusChange?.(`Plate sketch Line Contour: reverted to ${nextPoints.length}-point contour; latest segment selected`);
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch Line Contour backtrack failed");
        renderOverlay();
        return true;
      }
    }
    if (points.length === 0) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Line Contour: cancelled");
      return true;
    }
    return false;
  }

  function applyLineContourPointChain(current, nextPoints, statusMessage) {
    const lastPoint = nextPoints[nextPoints.length - 1] || null;
    let nextProject = setSketchOutline(current.id, {
      outline: nextPoints,
      idPrefix: current.id
    });
    nextProject = restoreLineContourArcSegments(current.sketch, current.id, nextProject);
    const latestEdgeId = outlineEdgeBetweenPoints(
      nextProject,
      current.id,
      nextPoints[nextPoints.length - 2],
      nextPoints[nextPoints.length - 1]
    );
    onProjectChange?.(nextProject);
    selectSketchDetail({ edgeIds: latestEdgeId ? [latestEdgeId] : [], sketchMode: "relations" });
    activeSketchTool = {
      type: "line",
      contour: true,
      points: nextPoints,
      startPoint: lastPoint ? [...lastPoint] : null,
      previewPoint: null,
      arcPreviewPoint: null,
      arcPreviewFlipped: false,
      pendingArcSegment: null,
      lastPointer: activeSketchTool.lastPointer || null
    };
    activeSnap = null;
    onStatusChange?.(statusMessage);
    renderOverlay();
  }

  function replaceSelectedLineContourVertex(current, currentSelection, point) {
    if (activeSketchTool?.type !== "line" || !activeSketchTool.contour) return false;
    if (currentSelection.relationId || currentSelection.edgeIds.length || currentSelection.vertexIds.length !== 1) return false;
    const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
    if (points.length < 3) return false;
    const vertexId = currentSelection.vertexIds[0];
    const vertex = sketchVertices(current.sketch).find((item) => item.id === vertexId);
    if (!vertex?.point) return false;
    const pointIndex = points.findIndex((item) => samePoint2(item, vertex.point));
    if (pointIndex < 0) return false;
    const previousPoint = points[(pointIndex - 1 + points.length) % points.length];
    const nextPoint = points[(pointIndex + 1) % points.length];
    if (samePoint2(point, previousPoint) || samePoint2(point, nextPoint)) {
      onStatusChange?.("Plate sketch Line Contour: replacement point must differ from adjacent points");
      renderOverlay();
      return true;
    }
    if (points.some((item, index) => index !== pointIndex && samePoint2(point, item))) {
      onStatusChange?.("Plate sketch Line Contour: replacement point must differ from existing contour points");
      renderOverlay();
      return true;
    }
    const pointVertexIds = points.map((chainPoint) => (
      sketchVertices(current.sketch).find((item) => item?.point && samePoint2(item.point, chainPoint))?.id || null
    ));
    try {
      const nextProject = setSketchVertex(current.id, vertexId, point);
      const nextSketch = activePlate(nextProject, current.id)?.sketch || null;
      const nextVertexById = new Map((nextSketch ? sketchVertices(nextSketch) : []).map((item) => [item.id, item]));
      const nextPoints = points.map((item, index) => {
        const nextVertex = nextVertexById.get(pointVertexIds[index]);
        return Array.isArray(nextVertex?.point) ? [...nextVertex.point] : (index === pointIndex ? [...point] : [...item]);
      });
      const latestEdgeId = outlineEdgeBetweenPoints(
        nextProject,
        current.id,
        nextPoints[nextPoints.length - 2],
        nextPoints[nextPoints.length - 1]
      );
      const lastPoint = nextPoints[nextPoints.length - 1] || null;
      onProjectChange?.(nextProject);
      selectSketchDetail({ edgeIds: latestEdgeId ? [latestEdgeId] : [], sketchMode: "relations" });
      activeSketchTool = {
        type: "line",
        contour: true,
        points: nextPoints,
        startPoint: lastPoint ? [...lastPoint] : null,
        previewPoint: null,
        arcPreviewPoint: null,
        arcPreviewFlipped: false,
        pendingArcSegment: null,
        lastPointer: activeSketchTool.lastPointer || null
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch Line Contour: replaced selected point; ${nextPoints.length}-point contour active`);
      renderOverlay();
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch Line Contour point replace failed");
      renderOverlay();
      return true;
    }
  }

  function pointProjectedToSketchArcRadius(sketch, edgeId, point) {
    const edge = sketchEdges(sketch).find((item) => item.id === edgeId);
    const center = Array.isArray(edge?.center) ? edge.center : null;
    const radius = Number(edge?.radius);
    if (!center || !Number.isFinite(radius) || radius <= EPSILON) return null;
    const delta = [point[0] - center[0], point[1] - center[1]];
    const length = Math.hypot(delta[0], delta[1]);
    if (length <= EPSILON) return null;
    return [
      center[0] + delta[0] / length * radius,
      center[1] + delta[1] / length * radius
    ];
  }

  function splitSelectedLineContourArcAtPoint(current, edgeId, pair, point, points) {
    const splitPoint = pointProjectedToSketchArcRadius(current.sketch, edgeId, point);
    if (!splitPoint) {
      onStatusChange?.("Plate sketch Line Contour: split point must be away from the arc center");
      renderOverlay();
      return true;
    }
    try {
      const result = splitSketchArc(current.id, edgeId, { point: splitPoint, mode: "driven" });
      const nextSketch = activePlate(result.project, current.id)?.sketch;
      const splitVertex = nextSketch && result.vertexId
        ? sketchVertices(nextSketch).find((vertex) => vertex.id === result.vertexId)
        : null;
      const nextLineContourPoints = splitVertex
        ? lineContourPointsWithInsertedSplitPoint(points, pair.from, pair.to, splitVertex.point)
        : null;
      if (nextLineContourPoints) {
        activeSketchTool = lineContourResumeTool({
          ...activeSketchTool,
          points: nextLineContourPoints,
          startPoint: nextLineContourPoints[nextLineContourPoints.length - 1],
          lastPointer: activeSketchTool.lastPointer || null
        });
      }
      onProjectChange?.(result.project);
      selectSketchDetail({
        edgeIds: arrayValues(result.edgeIds).filter(Boolean).slice(0, 2),
        vertexIds: result.vertexId ? [result.vertexId] : [],
        sketchMode: "relations"
      });
      onStatusChange?.(`Plate sketch Line Contour: inserted point on selected arc; ${(nextLineContourPoints || points).length}-point contour active`);
      renderOverlay();
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch Line Contour arc insert failed");
      renderOverlay();
      return true;
    }
  }

  function insertPointOnSelectedLineContourEdge(current, currentSelection, point) {
    if (activeSketchTool?.type !== "line" || !activeSketchTool.contour) return false;
    if (currentSelection.relationId || currentSelection.vertexIds.length || currentSelection.edgeIds.length !== 1) return false;
    const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
    if (points.length < 3) return false;
    const edgeId = currentSelection.edgeIds[0];
    const { outlineEdges, vertexMap } = sketchEntityMaps(current.sketch);
    const edge = outlineEdges.find((item) => item.id === edgeId);
    const pair = edge ? edgePointPair(outlineEdges, vertexMap, edge.id) : null;
    if (!pair) return false;
    const fromIndex = points.findIndex((item) => samePoint2(item, pair.from));
    const toIndex = points.findIndex((item) => samePoint2(item, pair.to));
    if (fromIndex < 0 || toIndex < 0) return false;
    if (toIndex !== (fromIndex + 1) % points.length) return false;
    if (fromIndex === points.length - 2 && toIndex === points.length - 1) return false;
    if (sketchEdgeIsCircularArc(current.sketch, edgeId)) {
      return splitSelectedLineContourArcAtPoint(current, edgeId, pair, point, points);
    }
    const insertPoint = pointProjectedToSketchLineSegment(point, pair.from, pair.to);
    if (points.some((item) => samePoint2(item, insertPoint))) {
      onStatusChange?.("Plate sketch Line Contour: inserted point must differ from existing contour points");
      renderOverlay();
      return true;
    }
    const nextPoints = points.map((item) => [...item]);
    if (toIndex === 0) nextPoints.push([...insertPoint]);
    else nextPoints.splice(toIndex, 0, [...insertPoint]);
    try {
      applyLineContourPointChain(
        current,
        nextPoints,
        `Plate sketch Line Contour: inserted point on selected edge; ${nextPoints.length}-point contour active`
      );
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch Line Contour edge insert failed");
      renderOverlay();
      return true;
    }
  }

  function removeSelectedLineContourVertex(current, currentSelection) {
    if (activeSketchTool?.type !== "line" || !activeSketchTool.contour) return false;
    if (currentSelection.relationId || currentSelection.edgeIds.length || currentSelection.vertexIds.length !== 1) return false;
    const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
    if (points.length <= 3) return false;
    const vertexId = currentSelection.vertexIds[0];
    const vertex = sketchVertices(current.sketch).find((item) => item.id === vertexId);
    if (!vertex?.point) return false;
    const pointIndex = points.findIndex((point) => samePoint2(point, vertex.point));
    if (pointIndex < 0) return false;
    const previousPoint = points[(pointIndex - 1 + points.length) % points.length];
    const nextPoint = points[(pointIndex + 1) % points.length];
    const { outlineEdges } = sketchEntityMaps(current.sketch);
    const incomingEdgeId = outlineEdgeBetweenPoints(api.project(), current.id, previousPoint, vertex.point);
    const outgoingEdgeId = outlineEdgeBetweenPoints(api.project(), current.id, vertex.point, nextPoint);
    const incomingEdge = outlineEdges.find((edge) => edge.id === incomingEdgeId);
    const outgoingEdge = outlineEdges.find((edge) => edge.id === outgoingEdgeId);
    if (
      incomingEdge?.to === vertexId
        && outgoingEdge?.from === vertexId
        && sameCircularArcBasis(incomingEdge, outgoingEdge)
    ) {
      const nextPoints = points.filter((_, index) => index !== pointIndex);
      try {
        const nextProject = removeSketchVertex(current.id, vertexId);
        const mergedEdgeId = outlineEdgeBetweenPoints(nextProject, current.id, previousPoint, nextPoint);
        onProjectChange?.(nextProject);
        selectSketchDetail({ edgeIds: mergedEdgeId ? [mergedEdgeId] : [], sketchMode: "relations" });
        activeSketchTool = lineContourResumeTool({
          ...activeSketchTool,
          points: nextPoints,
          startPoint: nextPoints[nextPoints.length - 1],
          lastPointer: activeSketchTool.lastPointer || null
        });
        activeSnap = null;
        onStatusChange?.(`Plate sketch Line Contour: removed selected arc split point; ${nextPoints.length}-point contour active`);
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch Line Contour arc merge failed");
        renderOverlay();
        return true;
      }
    }
    if (pointIndex === points.length - 1) return false;
    const nextPoints = points.filter((_, index) => index !== pointIndex);
    try {
      applyLineContourPointChain(
        current,
        nextPoints,
        `Plate sketch Line Contour: removed selected point; ${nextPoints.length}-point contour active`
      );
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch Line Contour point delete failed");
      renderOverlay();
      return true;
    }
  }

  function removeSelectedLineContourEdge(current, currentSelection) {
    if (activeSketchTool?.type !== "line" || !activeSketchTool.contour) return false;
    if (currentSelection.relationId || currentSelection.vertexIds.length || currentSelection.edgeIds.length !== 1) return false;
    const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
    if (points.length <= 3) return false;
    const edgeId = currentSelection.edgeIds[0];
    const { outlineEdges, vertexMap } = sketchEntityMaps(current.sketch);
    const edge = outlineEdges.find((item) => item.id === edgeId);
    const pair = edge ? edgePointPair(outlineEdges, vertexMap, edge.id) : null;
    if (!pair) return false;
    const fromIndex = points.findIndex((point) => samePoint2(point, pair.from));
    const toIndex = points.findIndex((point) => samePoint2(point, pair.to));
    if (fromIndex < 0 || toIndex < 0) return false;
    if (toIndex !== (fromIndex + 1) % points.length) return false;
    if (fromIndex === points.length - 2 && toIndex === points.length - 1) return false;
    const edgeIsArc = sketchEdgeIsCircularArc(current.sketch, edgeId);
    const nextPoints = points.filter((_, index) => index !== toIndex);
    try {
      applyLineContourPointChain(
        current,
        nextPoints,
        `Plate sketch Line Contour: removed selected ${edgeIsArc ? "arc" : "edge"}; ${nextPoints.length}-point contour active`
      );
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch Line Contour edge delete failed");
      renderOverlay();
      return true;
    }
  }

  function removeSelectedSketchEntity() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const entityMaps = sketchEntityMaps(current.sketch);
    function removeConstructionEdge(edgeId) {
      try {
        const isArc = sketchEdgeIsCircularArc(current.sketch, edgeId);
        const nextProject = removeSketchConstructionLine(current.id, edgeId);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail();
        onStatusChange?.(isArc
          ? "Plate sketch: construction arc deleted"
          : "Plate sketch: construction line deleted");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch construction edge delete failed");
        renderOverlay();
        return true;
      }
    }
    function removeOutlineEdge(edge) {
      try {
        const isArc = sketchEdgeIsCircularArc(current.sketch, edge.id);
        const nextProject = removeSketchVertex(current.id, edge.to);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail();
        onStatusChange?.(isArc
          ? "Plate sketch: arc deleted"
          : "Plate sketch: edge deleted");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch outline edge delete failed");
        renderOverlay();
        return true;
      }
    }
    if (removeSelectedLineContourVertex(current, currentSelection)) return true;
    if (removeSelectedLineContourEdge(current, currentSelection)) return true;
    if (backtrackActiveLineContour()) return true;
    if (currentSelection.relationId) return removeSelectedRelation();
    if (currentSelection.edgeIds.length === 1 && currentSelection.vertexIds.length === 0) {
      const edgeId = currentSelection.edgeIds[0];
      const constructionEdge = entityMaps.constructionEdges.find((edge) => edge.id === edgeId);
      if (constructionEdge) return removeConstructionEdge(edgeId);
      const outlineEdge = entityMaps.outlineEdges.find((edge) => edge.id === edgeId);
      if (outlineEdge) return removeOutlineEdge(outlineEdge);
    }
    if (currentSelection.vertexIds.length === 1 && currentSelection.edgeIds.length === 0) {
      const vertexId = currentSelection.vertexIds[0];
      const constructionEdgesForVertex = entityMaps.constructionEdges.filter((edge) => edge.from === vertexId || edge.to === vertexId);
      if (constructionEdgesForVertex.length === 1) return removeConstructionEdge(constructionEdgesForVertex[0].id);
      if (constructionEdgesForVertex.length > 1) {
        onStatusChange?.("Plate sketch: select one construction edge before deleting a shared construction point.");
        renderOverlay();
        return true;
      }
      try {
        const nextProject = removeSketchVertex(current.id, vertexId);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail();
        onStatusChange?.("Plate sketch: corner removed");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch delete failed");
        renderOverlay();
        return true;
      }
    }
    if (currentSelection.edgeIds.length || currentSelection.vertexIds.length) {
      onStatusChange?.("Plate sketch: Delete supports one selected relation, one selected corner, one outline edge, or one construction edge.");
      renderOverlay();
      return true;
    }
    return false;
  }

  function trimSelectedIntersectingOutlineEdges(current, currentSelection, outlineEdges, options = {}) {
    const extendOnly = options.mode === "extend";
    const actionLabel = extendOnly ? "Extend" : "Trim";
    const alreadyIntersectsStatus = extendOnly
      ? "Plate sketch: selected outline edges already intersect; use Trim to remove a side."
      : null;
    let [trimEdgeId, cutEdgeId] = currentSelection.edgeIds;
    const outlineEdgeMap = new Map(outlineEdges.map((edge) => [edge.id, edge]));
    let trimEdge = outlineEdgeMap.get(trimEdgeId);
    let cutEdge = outlineEdgeMap.get(cutEdgeId);
    if (!trimEdge || !cutEdge) {
      onStatusChange?.(`Plate sketch: select two outline edges for intersection ${actionLabel}.`);
      renderOverlay();
      return true;
    }
    if (currentSelection.vertexIds.length > 1) {
      onStatusChange?.(`Plate sketch: intersection ${actionLabel} accepts at most one endpoint across the selected edges.`);
      renderOverlay();
      return true;
    }
    const selectedEndpointId = currentSelection.vertexIds[0] || null;
    let endpointId = selectedEndpointId && (selectedEndpointId === trimEdge.from || selectedEndpointId === trimEdge.to)
      ? selectedEndpointId
      : null;
    if (selectedEndpointId && !endpointId && (selectedEndpointId === cutEdge.from || selectedEndpointId === cutEdge.to)) {
      [trimEdgeId, cutEdgeId] = [cutEdgeId, trimEdgeId];
      [trimEdge, cutEdge] = [cutEdge, trimEdge];
      endpointId = selectedEndpointId;
    }
    if (selectedEndpointId && !endpointId) {
      onStatusChange?.(`Plate sketch: selected ${extendOnly ? "extend" : "trim"} point must be an endpoint of one selected edge.`);
      renderOverlay();
      return true;
    }
    const trimIsArc = sketchEdgeIsCircularArc(current.sketch, trimEdgeId);
    const cutIsArc = sketchEdgeIsCircularArc(current.sketch, cutEdgeId);
    const vertexMap = new Map(sketchVertices(current.sketch).map((vertex) => [vertex.id, vertex]));
    const trimPair = edgePointPair(outlineEdges, vertexMap, trimEdgeId);
    const cutPair = edgePointPair(outlineEdges, vertexMap, cutEdgeId);
    if (trimIsArc) {
      if (cutIsArc) {
        const arcIntersections = trimPair && cutPair
          ? circularArcIntersections(trimEdge, trimPair, cutEdge, cutPair)
          : [];
        if (arcIntersections.length) {
          if (extendOnly) {
            onStatusChange?.(alreadyIntersectsStatus);
            renderOverlay();
            return true;
          }
          const trimVertexId = endpointId || trimEdge.to;
          const trimEndpointPoint = trimVertexId === trimEdge.from ? trimPair.from : trimPair.to;
          const intersection = arcIntersections
            .sort((a, b) => {
              const aDistance = Math.hypot(a[0] - trimEndpointPoint[0], a[1] - trimEndpointPoint[1]);
              const bDistance = Math.hypot(b[0] - trimEndpointPoint[0], b[1] - trimEndpointPoint[1]);
              return aDistance - bDistance;
            })[0];
          try {
            const result = splitSketchArc(current.id, trimEdgeId, { point: intersection, mode: "driven" });
            const nextProject = removeSketchVertex(current.id, trimVertexId);
            onProjectChange?.(nextProject);
            activeSnap = null;
            selectSketchDetail({ vertexIds: result.vertexId ? [result.vertexId] : [], sketchMode });
            onStatusChange?.("Plate sketch: outline arc trimmed to arc");
            renderOverlay();
            return true;
          } catch (error) {
            activeSnap = null;
            onStatusChange?.(error.message || "Plate sketch arc-to-arc trim failed");
            renderOverlay();
            return true;
          }
        }
        const extensionCandidates = trimPair && cutPair
          ? circularArcExtensionCandidates(trimEdge, trimPair, cutEdge, cutPair, endpointId)
          : [];
        if (!extensionCandidates.length) {
          const unrestrictedExtensionCandidates = endpointId && trimPair && cutPair
            ? circularArcExtensionCandidates(trimEdge, trimPair, cutEdge, cutPair)
            : [];
          onStatusChange?.(unrestrictedExtensionCandidates.length
            ? "Plate sketch: selected endpoint is not on the side that extends to the second arc."
            : "Plate sketch: selected arcs do not cross or extend to a valid endpoint.");
          renderOverlay();
          return true;
        }
        const extension = extensionCandidates[0];
        try {
          const nextProject = setSketchVertex(current.id, extension.endpointId, extension.point);
          onProjectChange?.(nextProject);
          activeSnap = null;
          selectSketchDetail({ edgeIds: [trimEdgeId], vertexIds: [extension.endpointId], sketchMode });
          onStatusChange?.("Plate sketch: outline arc extended to arc");
          renderOverlay();
          return true;
        } catch (error) {
          activeSnap = null;
          onStatusChange?.(error.message || "Plate sketch arc-to-arc extend failed");
          renderOverlay();
          return true;
        }
      }
      const arcLineIntersections = trimPair && cutPair
        ? lineCircularArcIntersections(cutPair.from, cutPair.to, trimEdge, trimPair)
            .filter((candidate) => candidate.t > EPSILON && candidate.t < 1 - EPSILON)
        : [];
      if (extendOnly && arcLineIntersections.length) {
        onStatusChange?.(alreadyIntersectsStatus);
        renderOverlay();
        return true;
      }
      if (!arcLineIntersections.length) {
        const extensionCandidates = trimPair && cutPair
          ? lineCircleIntersections(cutPair.from, cutPair.to, trimEdge)
              .filter((candidate) => candidate.t > EPSILON && candidate.t < 1 - EPSILON)
              .map((candidate) => circularArcEndpointExtensionCandidate(trimEdge, trimPair, candidate.point, endpointId))
              .filter(Boolean)
              .sort((a, b) => a.distance - b.distance)
          : [];
        if (!extensionCandidates.length) {
          const unrestrictedExtensionCandidates = endpointId && trimPair && cutPair
            ? lineCircleIntersections(cutPair.from, cutPair.to, trimEdge)
                .filter((candidate) => candidate.t > EPSILON && candidate.t < 1 - EPSILON)
                .map((candidate) => circularArcEndpointExtensionCandidate(trimEdge, trimPair, candidate.point))
                .filter(Boolean)
            : [];
          onStatusChange?.(unrestrictedExtensionCandidates.length
            ? "Plate sketch: selected endpoint is not on the side that extends to the selected line."
            : "Plate sketch: selected arc does not cross or extend to the selected line segment.");
          renderOverlay();
          return true;
        }
        const extension = extensionCandidates[0];
        try {
          const nextProject = setSketchVertex(current.id, extension.endpointId, extension.point);
          onProjectChange?.(nextProject);
          activeSnap = null;
          selectSketchDetail({ edgeIds: [trimEdgeId], vertexIds: [extension.endpointId], sketchMode });
          onStatusChange?.("Plate sketch: outline arc extended to line");
          renderOverlay();
          return true;
        } catch (error) {
          activeSnap = null;
          onStatusChange?.(error.message || "Plate sketch arc-to-line extend failed");
          renderOverlay();
          return true;
        }
      }
      const trimVertexId = endpointId || trimEdge.to;
      const trimEndpointPoint = trimVertexId === trimEdge.from ? trimPair.from : trimPair.to;
      const intersection = arcLineIntersections
        .sort((a, b) => {
          const aDistance = Math.hypot(a.point[0] - trimEndpointPoint[0], a.point[1] - trimEndpointPoint[1]);
          const bDistance = Math.hypot(b.point[0] - trimEndpointPoint[0], b.point[1] - trimEndpointPoint[1]);
          return aDistance - bDistance;
        })[0];
      try {
        const result = splitSketchArc(current.id, trimEdgeId, { point: intersection.point, mode: "driven" });
        const nextProject = removeSketchVertex(current.id, trimVertexId);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail({ vertexIds: result.vertexId ? [result.vertexId] : [], sketchMode });
        onStatusChange?.("Plate sketch: outline arc trimmed to line");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch arc trim failed");
        renderOverlay();
        return true;
      }
    }
    if (cutIsArc) {
      const arcIntersections = trimPair && cutPair
        ? lineCircularArcIntersections(trimPair.from, trimPair.to, cutEdge, cutPair)
        : [];
      const trimVertexId = endpointId || trimEdge.to;
      const preferredEndpointT = trimVertexId === trimEdge.from ? 0 : 1;
      const segmentCandidates = arcIntersections
        .filter((candidate) => candidate.t > EPSILON && candidate.t < 1 - EPSILON)
        .sort((a, b) => Math.abs(a.t - preferredEndpointT) - Math.abs(b.t - preferredEndpointT));
      if (segmentCandidates.length) {
        if (extendOnly) {
          onStatusChange?.(alreadyIntersectsStatus);
          renderOverlay();
          return true;
        }
        try {
          insertSketchVertex(current.id, trimEdgeId, segmentCandidates[0].point, { addSplitCollinear: false });
          const nextProject = removeSketchVertex(current.id, trimVertexId);
          onProjectChange?.(nextProject);
          activeSnap = null;
          selectSketchDetail({ sketchMode });
          onStatusChange?.("Plate sketch: outline edge trimmed to arc");
          renderOverlay();
          return true;
        } catch (error) {
          activeSnap = null;
          onStatusChange?.(error.message || "Plate sketch arc trim failed");
          renderOverlay();
          return true;
        }
      }
      const extendedCandidates = arcIntersections
        .filter((candidate) => candidate.t < -EPSILON || candidate.t > 1 + EPSILON)
        .filter((candidate) => !endpointId || (endpointId === trimEdge.from ? candidate.t < -EPSILON : candidate.t > 1 + EPSILON))
        .sort((a, b) => {
          const aDistance = a.t < 0 ? Math.abs(a.t) : Math.abs(a.t - 1);
          const bDistance = b.t < 0 ? Math.abs(b.t) : Math.abs(b.t - 1);
          return aDistance - bDistance;
        });
      if (!extendedCandidates.length) {
        const unrestrictedExtendedCandidates = endpointId
          ? arcIntersections
              .filter((candidate) => candidate.t < -EPSILON || candidate.t > 1 + EPSILON)
          : [];
        onStatusChange?.(unrestrictedExtendedCandidates.length
          ? "Plate sketch: selected endpoint is not on the side that extends to the selected arc."
          : "Plate sketch: selected outline line does not cross or extend to the selected arc.");
        renderOverlay();
        return true;
      }
      const extendedIntersection = extendedCandidates[0];
      const naturalEndpointId = extendedIntersection.t < 0 ? trimEdge.from : trimEdge.to;
      try {
        const nextProject = setSketchVertex(current.id, naturalEndpointId, extendedIntersection.point);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail({ edgeIds: [trimEdgeId], vertexIds: [naturalEndpointId], sketchMode });
        onStatusChange?.("Plate sketch: outline edge extended to arc");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch arc extend failed");
        renderOverlay();
        return true;
      }
    }
    const intersection = trimPair && cutPair
      ? segmentIntersectionPoint(trimPair.from, trimPair.to, cutPair.from, cutPair.to)
      : null;
    if (intersection) {
      if (extendOnly) {
        onStatusChange?.(alreadyIntersectsStatus);
        renderOverlay();
        return true;
      }
      const trimVertexId = endpointId || trimEdge.to;
      try {
        insertSketchVertex(current.id, trimEdgeId, intersection, { addSplitCollinear: false });
        const nextProject = removeSketchVertex(current.id, trimVertexId);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail({ sketchMode });
        onStatusChange?.("Plate sketch: outline edge trimmed to intersection");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch intersection trim failed");
        renderOverlay();
        return true;
      }
    }
    const extendedIntersection = trimPair && cutPair
      ? lineIntersectionPoint(trimPair.from, trimPair.to, cutPair.from, cutPair.to)
      : null;
    const extendsFirstEdge = extendedIntersection
      && (extendedIntersection.t < -EPSILON || extendedIntersection.t > 1 + EPSILON)
      && extendedIntersection.u > EPSILON
      && extendedIntersection.u < 1 - EPSILON;
    if (!extendsFirstEdge) {
      onStatusChange?.("Plate sketch: selected outline edges do not cross or extend to a valid endpoint.");
      renderOverlay();
      return true;
    }
    const naturalEndpointId = extendedIntersection.t < 0 ? trimEdge.from : trimEdge.to;
    if (endpointId && endpointId !== naturalEndpointId) {
      onStatusChange?.("Plate sketch: selected endpoint is not on the side that extends to the second edge.");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchVertex(current.id, naturalEndpointId, extendedIntersection.point);
      onProjectChange?.(nextProject);
      activeSnap = null;
      selectSketchDetail({ edgeIds: [trimEdgeId], vertexIds: [naturalEndpointId], sketchMode });
      onStatusChange?.("Plate sketch: outline edge extended to intersection");
      renderOverlay();
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch extend failed");
      renderOverlay();
      return true;
    }
  }

  function trimSelectedSketchEntity() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const { constructionEdges, outlineEdges } = sketchEntityMaps(current.sketch);
    if (currentSelection.edgeIds.length === 2) {
      return trimSelectedIntersectingOutlineEdges(current, currentSelection, outlineEdges);
    }
    const edgeId = currentSelection.edgeIds.length === 1
      ? currentSelection.edgeIds[0]
      : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one sketch edge, line, or arc before using Trim.");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 1) {
      onStatusChange?.("Plate sketch: Trim accepts at most one endpoint on the selected edge.");
      renderOverlay();
      return true;
    }
    const constructionEdgeIds = new Set(constructionEdges.map((edge) => edge.id));
    if (!constructionEdgeIds.has(edgeId)) {
      const outlineEdge = outlineEdges.find((edge) => edge.id === edgeId);
      if (!outlineEdge) {
        onStatusChange?.("Plate sketch: selected sketch edge could not be trimmed.");
        renderOverlay();
        return false;
      }
      const endpointId = currentSelection.vertexIds.find((vertexId) => vertexId === outlineEdge.from || vertexId === outlineEdge.to) || null;
      if (currentSelection.vertexIds.length && !endpointId) {
        onStatusChange?.("Plate sketch: selected trim point must be an endpoint of the selected edge.");
        renderOverlay();
        return false;
      }
      const trimVertexId = endpointId || outlineEdge.to;
      const isArc = sketchEdgeIsCircularArc(current.sketch, edgeId);
      try {
        const nextProject = removeSketchVertex(current.id, trimVertexId);
        onProjectChange?.(nextProject);
        activeSnap = null;
        selectSketchDetail({ sketchMode });
        onStatusChange?.(isArc ? "Plate sketch: outline arc trimmed" : "Plate sketch: outline edge trimmed");
        renderOverlay();
        return true;
      } catch (error) {
        activeSnap = null;
        onStatusChange?.(error.message || "Plate sketch outline trim failed");
        renderOverlay();
        return true;
      }
    }
    try {
      const nextProject = removeSketchConstructionLine(current.id, edgeId);
      onProjectChange?.(nextProject);
      activeSnap = null;
      selectSketchDetail({ sketchMode });
      onStatusChange?.("Plate sketch: construction edge trimmed");
      renderOverlay();
      return true;
    } catch (error) {
      activeSnap = null;
      onStatusChange?.(error.message || "Plate sketch trim failed");
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
    if (handle.relationType === "point-on-line" || handle.relationType === "point-on-circle" || handle.relationType === "midpoint") {
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
    if (handle.relationType === "parallel" || handle.relationType === "collinear" || handle.relationType === "perpendicular" || handle.relationType === "equal-length" || handle.relationType === "tangent" || handle.relationType === "concentric" || handle.relationType === "equal-radius") {
      return { type: handle.relationType, edgeIds: handle.edgeIds, targetEdgeId: handle.targetEdgeId };
    }
    if (handle.relationType === "radius" || handle.relationType === "diameter") {
      return Number.isFinite(handle.radius)
        ? {
          type: "radius",
          edgeId: handle.edgeId,
          value: handle.radius,
          mode: "driven",
          display: handle.relationType === "diameter" ? "diameter" : "radius"
        }
        : null;
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
    return sketchRelations(activePlate(project, plateId)?.sketch)
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
      vertexIds: arrayValues(detail.vertexIds).filter(Boolean).slice(0, 3),
      relationId: detail.relationId || null
    };
    emitSelectionChange();
  }

  function outlineEdgeBetweenPoints(project, objectId, fromPoint, toPoint) {
    const nextSketch = activePlate(project, objectId)?.sketch;
    if (!nextSketch) return null;
    const { outlineEdges, vertexMap } = sketchEntityMaps(nextSketch);
    return [...outlineEdges].reverse().find((edge) => {
      const pair = edgePointPair(outlineEdges, vertexMap, edge.id);
      return pair && samePoint2(pair.from, fromPoint) && samePoint2(pair.to, toPoint);
    })?.id || null;
  }

  function pendingLineContourArcSegmentFromStoredFirstEdge(current, points) {
    if (!current?.sketch || !Array.isArray(points) || points.length < 2) return null;
    const { outlineEdges, vertexMap } = sketchEntityMaps(current.sketch);
    const edge = outlineEdges.find((item) => {
      const pair = edgePointPair(outlineEdges, vertexMap, item.id);
      return pair && samePoint2(pair.from, points[0]) && samePoint2(pair.to, points[1]);
    });
    if (!edge || !sketchEdgeIsCircularArc(current.sketch, edge.id)) return null;
    return {
      fromPoint: [...points[0]],
      toPoint: [...points[1]],
      throughPoint: sketchEdgeMidpoint(current.sketch, edge.id),
      flipped: false
    };
  }

  function restoreLineContourArcSegments(sourceSketch, objectId, project, options = {}) {
    const { outlineEdges, vertexMap } = sketchEntityMaps(sourceSketch);
    let nextProject = project;
    const skipEdgeIds = new Set(arrayValues(options.skipEdgeIds).filter(Boolean));
    for (const edge of outlineEdges) {
      if (skipEdgeIds.has(edge.id)) continue;
      if (!sketchEdgeIsCircularArc(sourceSketch, edge.id)) continue;
      const pair = edgePointPair(outlineEdges, vertexMap, edge.id);
      if (!pair) continue;
      const nextEdgeId = outlineEdgeBetweenPoints(nextProject, objectId, pair.from, pair.to);
      if (!nextEdgeId) continue;
      nextProject = setSketchEdgeArc(objectId, nextEdgeId, {
        throughPoint: sketchEdgeMidpoint(sourceSketch, edge.id),
        mode: "driven"
      });
    }
    return nextProject;
  }

  function lineContourPointsWithInsertedSplitPoint(points, fromPoint, toPoint, splitPoint) {
    if (!Array.isArray(points) || points.length < 3 || !splitPoint) return null;
    for (let index = 0; index < points.length; index += 1) {
      const nextIndex = (index + 1) % points.length;
      if (!samePoint2(points[index], fromPoint) || !samePoint2(points[nextIndex], toPoint)) continue;
      if (nextIndex === 0) {
        return [
          [...points[index]],
          [...splitPoint],
          ...points.slice(0, index).map((point) => [...point])
        ];
      }
      const nextPoints = points.map((point) => [...point]);
      nextPoints.splice(nextIndex, 0, [...splitPoint]);
      return nextPoints;
    }
    return null;
  }

  const {
    applyDimensionHandleForKind,
    applyDimensionModeToggle,
    beginDimensionPlacementDrag,
    requestEdgeAngle,
    requestPointDistance
  } = createPlateSketchDimensionActions({
    requestDimensionInput,
    setSketchEdgeLength,
    setSketchEdgeLengthMode,
    setSketchEdgeRadius,
    setSketchEdgeRadiusMode,
    setSketchEdgeAngle,
    setSketchEdgeAngleMode,
    setSketchPointDistance,
    setSketchPointDistanceMode,
    selectRelation,
    selectUpdatedRelation,
    onProjectChange,
    onStatusChange,
    renderOverlay,
    setActiveSnap: (nextSnap) => { activeSnap = nextSnap; },
    setDrag: (nextDrag) => { drag = nextDrag; },
    dimensionPlacementOffsets
  });

  function defaultFilletRadius() {
    const configuredRadius = Number(settings.plateSketchDefaultFilletRadius);
    if (Number.isFinite(configuredRadius) && configuredRadius > EPSILON) return configuredRadius;
    const notchSize = Number(settings.plateSketchDefaultNotchSize);
    if (Number.isFinite(notchSize) && notchSize > EPSILON) return notchSize;
    return 10;
  }

  function requestFilletRadius(handle) {
    const radius = defaultFilletRadius();
    const raw = requestDimensionInput({
      kind: "corner-fillet-radius",
      plateId: handle.plateId,
      vertexId: handle.vertexId,
      promptText: `Fillet radius mm (${formatMm(radius)})`,
      currentValue: radius,
      defaultValue: String(Math.round(radius * 1000) / 1000)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function defaultCircleRadius(current = plate()) {
    const configuredRadius = Number(settings.plateSketchDefaultCircleRadius);
    if (Number.isFinite(configuredRadius) && configuredRadius > EPSILON) return configuredRadius;
    const points = current?.sketch ? sketchVertices(current.sketch).map((vertex) => vertex.point).filter((point) => Array.isArray(point)) : [];
    if (points.length) {
      const yValues = points.map((point) => point[0]).filter(Number.isFinite);
      const zValues = points.map((point) => point[1]).filter(Number.isFinite);
      const spanY = yValues.length ? Math.max(...yValues) - Math.min(...yValues) : 0;
      const spanZ = zValues.length ? Math.max(...zValues) - Math.min(...zValues) : 0;
      const radius = Math.max(spanY, spanZ) * 0.25;
      if (radius > EPSILON) return Math.round(radius * 1000) / 1000;
    }
    return 50;
  }

  function requestCircleRadius(current = plate()) {
    const radius = defaultCircleRadius(current);
    const raw = requestDimensionInput({
      kind: "circle-radius",
      plateId: current?.id || activePlateId,
      promptText: `Circle radius mm (${formatMm(radius)})`,
      currentValue: radius,
      defaultValue: String(Math.round(radius * 1000) / 1000)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function sketchPointSpans(current = plate()) {
    const points = current?.sketch ? sketchVertices(current.sketch).map((vertex) => vertex.point).filter((point) => Array.isArray(point)) : [];
    if (!points.length) return { spanY: 0, spanZ: 0 };
    const yValues = points.map((point) => point[0]).filter(Number.isFinite);
    const zValues = points.map((point) => point[1]).filter(Number.isFinite);
    return {
      spanY: yValues.length ? Math.max(...yValues) - Math.min(...yValues) : 0,
      spanZ: zValues.length ? Math.max(...zValues) - Math.min(...zValues) : 0
    };
  }

  function defaultSlotRadius(current = plate()) {
    const { spanY, spanZ } = sketchPointSpans(current);
    const radius = Math.min(spanY || Infinity, spanZ || Infinity) * 0.25;
    if (Number.isFinite(radius) && radius > EPSILON) return Math.round(radius * 1000) / 1000;
    return Math.max(10, defaultCircleRadius(current) * 0.5);
  }

  function defaultSlotLength(current = plate(), radius = defaultSlotRadius(current)) {
    const { spanY } = sketchPointSpans(current);
    const length = Math.max(spanY || 0, radius * 4);
    return Math.round(length * 1000) / 1000;
  }

  function defaultCenterRectangleDimensions(current = plate()) {
    const { spanY, spanZ } = sketchPointSpans(current);
    const width = Math.max(spanY || 0, 160);
    const height = Math.max(spanZ || 0, 100);
    return {
      width: Math.round(width * 1000) / 1000,
      height: Math.round(height * 1000) / 1000
    };
  }

  function requestCenterRectangleDimensions(current = plate()) {
    const defaults = defaultCenterRectangleDimensions(current);
    const rawWidth = requestDimensionInput({
      kind: "center-rectangle-width",
      plateId: current?.id || activePlateId,
      promptText: `Center rectangle width mm (${formatMm(defaults.width)})`,
      currentValue: defaults.width,
      defaultValue: String(defaults.width)
    });
    if (rawWidth === null || rawWidth === undefined || rawWidth === "") return null;
    const width = Number.parseFloat(String(rawWidth).replace(",", "."));
    if (!Number.isFinite(width) || width <= EPSILON) return null;
    const rawHeight = requestDimensionInput({
      kind: "center-rectangle-height",
      plateId: current?.id || activePlateId,
      promptText: `Center rectangle height mm (${formatMm(defaults.height)})`,
      currentValue: defaults.height,
      defaultValue: String(defaults.height)
    });
    if (rawHeight === null || rawHeight === undefined || rawHeight === "") return null;
    const height = Number.parseFloat(String(rawHeight).replace(",", "."));
    if (!Number.isFinite(height) || height <= EPSILON) return null;
    return { width, height };
  }

  function defaultRoundedRectangleDimensions(current = plate()) {
    const dimensions = defaultCenterRectangleDimensions(current);
    const radius = Math.max(5, Math.min(dimensions.width, dimensions.height) * 0.15);
    return {
      ...dimensions,
      radius: Math.round(radius * 1000) / 1000
    };
  }

  function requestRoundedRectangleDimensions(current = plate()) {
    const defaults = defaultRoundedRectangleDimensions(current);
    const rawWidth = requestDimensionInput({
      kind: "rounded-rectangle-width",
      plateId: current?.id || activePlateId,
      promptText: `Rounded rectangle width mm (${formatMm(defaults.width)})`,
      currentValue: defaults.width,
      defaultValue: String(defaults.width)
    });
    if (rawWidth === null || rawWidth === undefined || rawWidth === "") return null;
    const width = Number.parseFloat(String(rawWidth).replace(",", "."));
    if (!Number.isFinite(width) || width <= EPSILON) return null;
    const rawHeight = requestDimensionInput({
      kind: "rounded-rectangle-height",
      plateId: current?.id || activePlateId,
      promptText: `Rounded rectangle height mm (${formatMm(defaults.height)})`,
      currentValue: defaults.height,
      defaultValue: String(defaults.height)
    });
    if (rawHeight === null || rawHeight === undefined || rawHeight === "") return null;
    const height = Number.parseFloat(String(rawHeight).replace(",", "."));
    if (!Number.isFinite(height) || height <= EPSILON) return null;
    const maxRadius = Math.min(width, height) / 2;
    const defaultRadius = Math.min(defaults.radius, Math.max(EPSILON, maxRadius - 1));
    const rawRadius = requestDimensionInput({
      kind: "rounded-rectangle-radius",
      plateId: current?.id || activePlateId,
      promptText: `Rounded rectangle radius mm (${formatMm(defaultRadius)}, max ${formatMm(maxRadius)})`,
      currentValue: defaultRadius,
      defaultValue: String(Math.round(defaultRadius * 1000) / 1000)
    });
    if (rawRadius === null || rawRadius === undefined || rawRadius === "") return null;
    const radius = Number.parseFloat(String(rawRadius).replace(",", "."));
    if (!Number.isFinite(radius) || radius <= EPSILON || radius * 2 >= Math.min(width, height) - EPSILON) return null;
    return { width, height, radius };
  }

  function requestSlotDimensions(current = plate()) {
    const radius = defaultSlotRadius(current);
    const rawRadius = requestDimensionInput({
      kind: "slot-radius",
      plateId: current?.id || activePlateId,
      promptText: `Slot radius mm (${formatMm(radius)})`,
      currentValue: radius,
      defaultValue: String(Math.round(radius * 1000) / 1000)
    });
    if (rawRadius === null || rawRadius === undefined || rawRadius === "") return null;
    const parsedRadius = Number.parseFloat(String(rawRadius).replace(",", "."));
    if (!Number.isFinite(parsedRadius) || parsedRadius <= EPSILON) return null;
    const length = Math.max(defaultSlotLength(current, parsedRadius), parsedRadius * 2 + 1);
    const rawLength = requestDimensionInput({
      kind: "slot-length",
      plateId: current?.id || activePlateId,
      promptText: `Slot length mm (${formatMm(length)}, min ${formatMm(parsedRadius * 2)})`,
      currentValue: length,
      defaultValue: String(Math.round(length * 1000) / 1000)
    });
    if (rawLength === null || rawLength === undefined || rawLength === "") return null;
    const parsedLength = Number.parseFloat(String(rawLength).replace(",", "."));
    if (!Number.isFinite(parsedLength) || parsedLength <= parsedRadius * 2 + EPSILON) return null;
    return { radius: parsedRadius, length: parsedLength };
  }

  function defaultCenterArcSweepDegrees() {
    const configuredSweep = Number(settings.plateSketchDefaultArcSweepDegrees);
    if (Number.isFinite(configuredSweep) && Math.abs(configuredSweep) > EPSILON && Math.abs(configuredSweep) < 360 - EPSILON) {
      return configuredSweep;
    }
    return 120;
  }

  function requestCenterArcRadius(current = plate()) {
    const radius = defaultCircleRadius(current);
    const sweep = defaultCenterArcSweepDegrees();
    const raw = requestDimensionInput({
      kind: "center-arc-radius",
      plateId: current?.id || activePlateId,
      promptText: `Center arc radius mm (${formatMm(radius)}), sweep ${formatDeg(sweep)}`,
      currentValue: radius,
      defaultValue: String(Math.round(radius * 1000) / 1000)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function defaultEdgeArcRadius(current, edgeId) {
    const pair = current?.sketch
      ? edgePointPair(
        sketchEdges(current.sketch),
        new Map(sketchVertices(current.sketch).map((vertex) => [vertex.id, vertex])),
        edgeId
      )
      : null;
    if (!pair) return defaultCircleRadius(current);
    const chordLength = Math.hypot(pair.to[0] - pair.from[0], pair.to[1] - pair.from[1]);
    const radius = Math.max(defaultCircleRadius(current), chordLength * 0.75, chordLength / 2 + 1);
    return Math.round(radius * 1000) / 1000;
  }

  function requestEdgeArcRadius(current, edgeId) {
    const pair = current?.sketch
      ? edgePointPair(
        sketchEdges(current.sketch),
        new Map(sketchVertices(current.sketch).map((vertex) => [vertex.id, vertex])),
        edgeId
      )
      : null;
    const chordLength = pair ? Math.hypot(pair.to[0] - pair.from[0], pair.to[1] - pair.from[1]) : 0;
    const radius = defaultEdgeArcRadius(current, edgeId);
    const minimumText = chordLength > EPSILON ? `, min ${formatMm(chordLength / 2)}` : "";
    const raw = requestDimensionInput({
      kind: "edge-arc-radius",
      plateId: current?.id || activePlateId,
      edgeId,
      promptText: `Edge arc radius mm (${formatMm(radius)}${minimumText})`,
      currentValue: radius,
      defaultValue: String(radius)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function createCircleSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "circle") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Circle: cancelled");
      return true;
    }
    return startCircleTool();
  }

  function createDiameterCircleSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "diameterCircle") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Diameter Circle: cancelled");
      return true;
    }
    return startDiameterCircleTool();
  }

  function createThreePointCircleSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "threePointCircle") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch 3 Point Circle: cancelled");
      return true;
    }
    return startThreePointCircleTool();
  }

  function createCenterRectangleSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "centerRectangle") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Center Rectangle: cancelled");
      return true;
    }
    return startCenterRectangleTool();
  }

  function createRoundedRectangleSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "roundedRectangle") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Rounded Rectangle: cancelled");
      return true;
    }
    return startRoundedRectangleTool();
  }

  function createSlotSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "slot") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Slot: cancelled");
      return true;
    }
    return startSlotTool();
  }

  function createCenterSlotSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "centerSlot") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Center Slot: cancelled");
      return true;
    }
    return startCenterSlotTool();
  }

  function createCenterArcSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "centerArc" && !activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Center Arc: cancelled");
      return true;
    }
    return startCenterArcTool({ contour: false });
  }

  function createCenterArcContourSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "centerArc" && activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Center Arc Contour: cancelled");
      return true;
    }
    return startCenterArcTool({ contour: true });
  }

  function convertSelectedEdgeToArc() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (activeSketchTool?.type === "edgeArc" && activeSketchTool.edgeId === edgeId) {
      activeSketchTool = null;
      activeSnap = null;
      onStatusChange?.("Plate sketch Edge Arc: cancelled");
      renderOverlay();
      return true;
    }
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one sketch edge before using Edge Arc");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Edge Arc");
      renderOverlay();
      return false;
    }
    const maps = sketchEntityMaps(current.sketch);
    if (maps.constructionEdges.some((edge) => edge.id === edgeId)) {
      onStatusChange?.("Plate sketch: Edge Arc works on outline sketch edges");
      renderOverlay();
      return false;
    }
    const updatingExistingArc = sketchEdgeIsCircularArc(current.sketch, edgeId);
    const pair = edgePointPair(maps.edges, maps.vertexMap, edgeId);
    if (!pair) {
      onStatusChange?.("Plate sketch Edge Arc: selected edge endpoints could not be resolved");
      renderOverlay();
      return false;
    }
    const resumeTool = activeSketchTool?.type === "line" && activeSketchTool.contour
      ? lineContourResumeTool(activeSketchTool)
      : null;
    return startEdgeArcTool(edgeId, pair.from, pair.to, { resumeTool, updatingExistingArc });
  }

  function createThreePointArcFromSelection() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "threePointArc" && !activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch 3 Point Arc: cancelled");
      return true;
    }
    const currentSelection = selectionForPlate(current);
    const vertexIds = currentSelection.vertexIds.length === 3 ? [...currentSelection.vertexIds] : [];
    if (vertexIds.length !== 3) {
      return startThreePointArcTool({ contour: false });
    }
    try {
      const result = setSketchThreePointArc(current.id, vertexIds, { mode: "driven" });
      onProjectChange?.(result.project);
      selectSketchDetail({ edgeIds: result.edgeId ? [result.edgeId] : [], sketchMode: "relations" });
      onStatusChange?.("Plate sketch: 3 point arc created");
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch 3 point arc failed");
      renderOverlay();
      return true;
    }
  }

  function createThreePointArcContourSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "threePointArc" && activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch 3 Point Arc Contour: cancelled");
      return true;
    }
    return startThreePointArcTool({ contour: true });
  }

  function flipSelectedArc() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one circular arc before using Flip Arc");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Flip Arc");
      renderOverlay();
      return false;
    }
    if (sketchEntityMaps(current.sketch).constructionEdges.some((edge) => edge.id === edgeId)) {
      onStatusChange?.("Plate sketch: Flip Arc works on outline circular arcs");
      renderOverlay();
      return false;
    }
    if (!sketchEdgeIsCircularArc(current.sketch, edgeId)) {
      onStatusChange?.("Plate sketch: Flip Arc works on circular arc edges");
      renderOverlay();
      return false;
    }
    const lineContourActive = activeSketchTool?.type === "line" && activeSketchTool.contour;
    try {
      const nextProject = flipSketchEdgeArc(current.id, edgeId);
      onProjectChange?.(nextProject);
      selectSketchDetail({ edgeIds: [edgeId], sketchMode: "relations" });
      onStatusChange?.(lineContourActive
        ? "Plate sketch Line Contour: arc flipped; pick next point"
        : "Plate sketch: arc flipped");
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch flip arc failed");
      renderOverlay();
      return true;
    }
  }

  function splitSelectedArc() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one circular arc before using Split Arc");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Split Arc");
      renderOverlay();
      return false;
    }
    if (sketchEntityMaps(current.sketch).constructionEdges.some((edge) => edge.id === edgeId)) {
      onStatusChange?.("Plate sketch: Split Arc works on outline circular arcs");
      renderOverlay();
      return false;
    }
    if (!sketchEdgeIsCircularArc(current.sketch, edgeId)) {
      onStatusChange?.("Plate sketch: Split Arc works on circular arc edges");
      renderOverlay();
      return false;
    }
    const currentMaps = sketchEntityMaps(current.sketch);
    const splitPair = edgePointPair(currentMaps.edges, currentMaps.vertexMap, edgeId);
    try {
      const result = splitSketchArc(current.id, edgeId, { mode: "driven" });
      const nextSketch = activePlate(result.project, current.id)?.sketch;
      const splitVertex = nextSketch && result.vertexId
        ? sketchVertices(nextSketch).find((vertex) => vertex.id === result.vertexId)
        : null;
      const lineContourActive = activeSketchTool?.type === "line" && activeSketchTool.contour;
      const nextLineContourPoints = lineContourActive && splitPair && splitVertex
        ? lineContourPointsWithInsertedSplitPoint(activeSketchTool.points, splitPair.from, splitPair.to, splitVertex.point)
        : null;
      if (nextLineContourPoints) {
        activeSketchTool = lineContourResumeTool({
          ...activeSketchTool,
          points: nextLineContourPoints,
          startPoint: nextLineContourPoints[nextLineContourPoints.length - 1],
          lastPointer: activeSketchTool.lastPointer || null
        });
      }
      onProjectChange?.(result.project);
      selectSketchDetail({
        edgeIds: arrayValues(result.edgeIds).filter(Boolean).slice(0, 2),
        vertexIds: result.vertexId ? [result.vertexId] : [],
        sketchMode: "relations"
      });
      onStatusChange?.(lineContourActive
        ? "Plate sketch Line Contour: arc split; pick next point"
        : "Plate sketch: arc split");
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch split arc failed");
      renderOverlay();
      return true;
    }
  }

  function applyFilletCorner(handle) {
    const radius = requestFilletRadius(handle);
    if (radius === null) {
      onStatusChange?.("Plate sketch: fillet cancelled");
      drag = null;
      renderOverlay();
      return true;
    }
    try {
      const result = filletSketchCorner(handle.plateId, handle.vertexId, { radius });
      onProjectChange?.(result.project);
      const newVertexIds = arrayValues(result.vertexIds).filter(Boolean);
      const newEdgeIds = result.edgeId ? [result.edgeId] : [];
      selectSketchDetail({ edgeIds: newEdgeIds, vertexIds: newVertexIds });
      onStatusChange?.(`Plate sketch: fillet radius ${formatMm(radius)} added`);
      renderOverlay();
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch fillet failed");
    }
    drag = null;
    return true;
  }

  function filletSelectedCorner() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    if (currentSelection.edgeIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch edges before using Fillet");
      renderOverlay();
      return false;
    }
    const vertexId = currentSelection.vertexIds.length === 1 ? currentSelection.vertexIds[0] : null;
    if (!vertexId) {
      onStatusChange?.("Plate sketch: select one corner before using Fillet");
      renderOverlay();
      return false;
    }
    if (sketchEntityMaps(current.sketch).constructionVertices.some((vertex) => vertex.id === vertexId)) {
      onStatusChange?.("Plate sketch: Fillet works on outline sketch corners");
      renderOverlay();
      return false;
    }
    return applyFilletCorner({
      kind: "plate-sketch-fillet-corner",
      target: `${vertexId}:fillet-toolbar`,
      objectId: current.id,
      plateId: current.id,
      vertexId
    });
  }

  function addRadiusDimensionForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one circular arc before using Radius");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Radius");
      renderOverlay();
      return false;
    }
    try {
      if (!sketchEdgeIsCircularArc(current.sketch, edgeId)) {
        onStatusChange?.("Plate sketch: Radius works on circular arc edges");
        renderOverlay();
        return false;
      }
      const radius = measuredSketchEdgeRadius(current.sketch, edgeId);
      const nextProject = setSketchEdgeRadius(current.id, edgeId, radius, { mode: "driven", display: "radius" });
      const nextPlate = activePlate(nextProject, current.id);
      const nextRelation = nextPlate
        ? sketchRelationsForEdge(nextPlate.sketch, edgeId).find((relation) => relation.type === "radius") || null
        : null;
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added reference radius ${formatMm(radius)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch radius dimension failed");
      renderOverlay();
      return true;
    }
  }

  function addDiameterDimensionForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one circular arc before using Diameter");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Diameter");
      renderOverlay();
      return false;
    }
    try {
      if (!sketchEdgeIsCircularArc(current.sketch, edgeId)) {
        onStatusChange?.("Plate sketch: Diameter works on circular arc edges");
        renderOverlay();
        return false;
      }
      const radius = measuredSketchEdgeRadius(current.sketch, edgeId);
      const nextProject = setSketchEdgeRadius(current.id, edgeId, radius, { mode: "driven", display: "diameter" });
      const nextPlate = activePlate(nextProject, current.id);
      const nextRelation = nextPlate
        ? sketchRelationsForEdge(nextPlate.sketch, edgeId).find((relation) => relation.type === "radius") || null
        : null;
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added reference diameter ${formatMm(radius * 2)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch diameter dimension failed");
      renderOverlay();
      return true;
    }
  }

  function addLengthDimensionForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!edgeId) {
      onStatusChange?.("Plate sketch: select one straight edge before using Length");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Length");
      renderOverlay();
      return false;
    }
    try {
      if (sketchEdgeIsCircularArc(current.sketch, edgeId)) {
        onStatusChange?.("Plate sketch: use Radius for circular arc edges");
        renderOverlay();
        return false;
      }
      const { a, b } = sketchEdgePoints(current.sketch, edgeId);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nextProject = setSketchEdgeLength(current.id, edgeId, length, { mode: "driven" });
      const nextRelation = relationFromProjectByKey(nextProject, current.id, { type: "length", edgeId });
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added reference length ${formatMm(length)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch length dimension failed");
      renderOverlay();
      return true;
    }
  }

  function addDistanceDimensionForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const vertexIds = currentSelection.vertexIds.length === 2 ? [...currentSelection.vertexIds] : [];
    if (vertexIds.length !== 2) {
      onStatusChange?.("Plate sketch: select two sketch points before using Distance");
      renderOverlay();
      return false;
    }
    if (currentSelection.edgeIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch edges before using Distance");
      renderOverlay();
      return false;
    }
    try {
      const distance = sketchPointDistance(current.sketch, vertexIds);
      const relationPatch = { type: "distance", vertexIds };
      const nextProject = setSketchPointDistance(current.id, vertexIds, distance, { mode: "driven" });
      const nextRelation = relationFromProjectByKey(nextProject, current.id, relationPatch);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added reference distance ${formatMm(distance)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch distance dimension failed");
      renderOverlay();
      return true;
    }
  }

  function addAngleDimensionForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeIds = currentSelection.edgeIds.length === 2 ? [...currentSelection.edgeIds] : [];
    if (edgeIds.length !== 2) {
      onStatusChange?.("Plate sketch: select two straight sketch edges before using Angle");
      renderOverlay();
      return false;
    }
    if (currentSelection.vertexIds.length > 0) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using Angle");
      renderOverlay();
      return false;
    }
    try {
      if (edgeIds.some((edgeId) => sketchEdgeIsCircularArc(current.sketch, edgeId))) {
        onStatusChange?.("Plate sketch: Angle currently works on straight sketch edges");
        renderOverlay();
        return false;
      }
      const angle = sketchEdgeAngleDegrees(current.sketch, edgeIds);
      const relationPatch = { type: "angle", edgeIds };
      const nextProject = setSketchEdgeAngle(current.id, edgeIds, angle, { mode: "driven" });
      const nextRelation = relationFromProjectByKey(nextProject, current.id, relationPatch);
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added reference angle ${formatDeg(angle)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch angle dimension failed");
      renderOverlay();
      return true;
    }
  }

  function edgeRelationCommandLabel(type) {
    if (type === "equal-radius") return "Equal Radius";
    return sketchRelationLabel({ type });
  }

  function edgeRelationSelectionIssue(sketch, currentSelection, type) {
    const label = edgeRelationCommandLabel(type);
    const selectedEdgeCount = currentSelection.edgeIds.length;
    const selectedVertexCount = currentSelection.vertexIds.length;
    const selectedArcEdgeCount = currentSelection.edgeIds
      .filter((edgeId) => sketchEdgeIsCircularArc(sketch, edgeId))
      .length;
    if (selectedVertexCount > 0) return `select only two sketch edges before using ${label}`;
    if (selectedEdgeCount > 2) return `select exactly two sketch edges before using ${label}`;
    if (type === "concentric" || type === "equal-radius") {
      if (selectedEdgeCount < 2 || selectedArcEdgeCount === 0) return `select two circular sketch edges before using ${label}`;
      if (selectedArcEdgeCount < 2) return `both selected sketch edges must be circular arcs before using ${label}`;
      return null;
    }
    if (type === "tangent") {
      if (selectedEdgeCount < 2) return `select two sketch edges, including at least one circular arc, before using ${label}`;
      if (selectedArcEdgeCount < 1) return `select at least one circular sketch edge before using ${label}`;
      return null;
    }
    return selectedEdgeCount === 2 ? null : `select two sketch edges before using ${label}`;
  }

  function edgeForRelation(sketch, edgeId) {
    const { edges, constructionEdges } = sketchEntityMaps(sketch);
    return [...edges, ...constructionEdges].find((edge) => edge?.id === edgeId) || null;
  }

  function sharedEdgeVertexId(sketch, edgeIds) {
    const [firstEdgeId, secondEdgeId] = edgeIds;
    const first = edgeForRelation(sketch, firstEdgeId);
    const second = edgeForRelation(sketch, secondEdgeId);
    if (!first || !second) return null;
    return [first.from, first.to].find((vertexId) => vertexId === second.from || vertexId === second.to) || null;
  }

  function edgeRelationSatisfactionIssue(sketch, edgeIds, type) {
    if (type === "tangent") {
      const sharedVertexId = sharedEdgeVertexId(sketch, edgeIds);
      if (!sharedVertexId) return "selected sketch edges are not tangent";
      try {
        const first = sketchEdgeTangentAtVertex(sketch, edgeIds[0], sharedVertexId);
        const second = sketchEdgeTangentAtVertex(sketch, edgeIds[1], sharedVertexId);
        const tangentResidual = Math.abs(Math.abs(first[0] * second[0] + first[1] * second[1]) - 1);
        return tangentResidual <= 1e-6 ? null : "selected sketch edges are not tangent";
      } catch {
        return "selected sketch edges are not tangent";
      }
    }
    if (type === "concentric") {
      try {
        const first = sketchEdgeCenterPoint(sketch, edgeIds[0]);
        const second = sketchEdgeCenterPoint(sketch, edgeIds[1]);
        return Math.hypot(second[0] - first[0], second[1] - first[1]) <= 1e-6
          ? null
          : "selected circular arcs are not concentric";
      } catch {
        return "selected circular arcs are not concentric";
      }
    }
    if (type === "equal-radius") {
      try {
        const firstRadius = measuredSketchEdgeRadius(sketch, edgeIds[0]);
        const secondRadius = measuredSketchEdgeRadius(sketch, edgeIds[1]);
        return Math.abs(firstRadius - secondRadius) <= 1e-6
          ? null
          : "selected circular arcs do not have equal radius";
      } catch {
        return "selected circular arcs do not have equal radius";
      }
    }
    return null;
  }

  function addEdgeRelationForSelection(type) {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const edgeIds = [...currentSelection.edgeIds];
    const relationIssue = edgeRelationSelectionIssue(current.sketch, currentSelection, type);
    if (relationIssue) {
      onStatusChange?.(`Plate sketch: ${relationIssue}`);
      renderOverlay();
      return false;
    }
    const satisfactionIssue = edgeRelationSatisfactionIssue(current.sketch, edgeIds, type);
    if (satisfactionIssue) {
      onStatusChange?.(`Plate sketch: ${satisfactionIssue}`);
      renderOverlay();
      return false;
    }
    try {
      const relation = { type, edgeIds };
      const nextProject = upsertSketchRelation(current.id, relation);
      const nextPlate = activePlate(nextProject, current.id);
      const relationKey = sketchRelationKey(relation);
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((item) => sketchRelationKey(item) === relationKey) || null
        : null;
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added ${sketchRelationLabel({ type }).toLowerCase()} relation`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || `Plate sketch ${sketchRelationLabel({ type }).toLowerCase()} relation failed`);
      renderOverlay();
      return true;
    }
  }

  function addPointRelationForSelection(type) {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const label = sketchRelationLabel({ type });
    if (currentSelection.edgeIds.length > 0) {
      onStatusChange?.(`Plate sketch: clear selected sketch edges before using ${label}`);
      renderOverlay();
      return false;
    }
    const vertexIds = currentSelection.vertexIds.length === 2 ? [...currentSelection.vertexIds] : [];
    if (vertexIds.length !== 2) {
      onStatusChange?.(`Plate sketch: select two sketch points before using ${label}`);
      renderOverlay();
      return false;
    }
    try {
      const constructionVertexIds = new Set(sketchEntityMaps(current.sketch).constructionVertices.map((vertex) => vertex.id));
      const targetVertexId = type === "coincident"
        ? vertexIds.find((vertexId) => !constructionVertexIds.has(vertexId)) || null
        : null;
      const relation = {
        type,
        vertexIds,
        ...(targetVertexId ? { targetVertexId } : {})
      };
      const nextProject = upsertSketchRelation(current.id, relation);
      const nextPlate = activePlate(nextProject, current.id);
      const relationKey = sketchRelationKey(relation);
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((item) => sketchRelationKey(item) === relationKey) || null
        : null;
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.(`Plate sketch: added ${label.toLowerCase()} relation`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || `Plate sketch ${label.toLowerCase()} relation failed`);
      renderOverlay();
      return true;
    }
  }

  function addPointOnCircleRelationForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    if (currentSelection.vertexIds.length > 1) {
      onStatusChange?.("Plate sketch: clear selected sketch points before using On Circle");
      renderOverlay();
      return false;
    }
    if (currentSelection.edgeIds.length > 1) {
      onStatusChange?.("Plate sketch: clear selected sketch edges before using On Circle");
      renderOverlay();
      return false;
    }
    const vertexId = currentSelection.vertexIds.length === 1 ? currentSelection.vertexIds[0] : null;
    const edgeId = currentSelection.edgeIds.length === 1 ? currentSelection.edgeIds[0] : null;
    if (!vertexId || !edgeId) {
      onStatusChange?.("Plate sketch: select one sketch point and one circular arc before using On Circle");
      renderOverlay();
      return false;
    }
    try {
      if (!sketchEdgeIsCircularArc(current.sketch, edgeId)) {
        onStatusChange?.("Plate sketch: On Circle works on circular arc edges");
        renderOverlay();
        return false;
      }
      if (vertexTouchesOtherCircularArc(current.sketch, vertexId, edgeId)) {
        onStatusChange?.(pointOnCircleEndpointConflictMessage());
        renderOverlay();
        return false;
      }
      const relation = { type: "point-on-circle", vertexId, edgeId };
      const nextProject = upsertSketchRelation(current.id, relation);
      const nextPlate = activePlate(nextProject, current.id);
      const relationKey = sketchRelationKey(relation);
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((item) => sketchRelationKey(item) === relationKey) || null
        : null;
      onProjectChange?.(nextProject);
      selectUpdatedRelation(nextRelation);
      onStatusChange?.("Plate sketch: added point on circle relation");
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch point on circle relation failed");
      renderOverlay();
      return true;
    }
  }

  const addCoincidentRelationForSelection = () => addPointRelationForSelection("coincident");
  const addTangentRelationForSelection = () => addEdgeRelationForSelection("tangent");
  const addConcentricRelationForSelection = () => addEdgeRelationForSelection("concentric");
  const addEqualRadiusRelationForSelection = () => addEdgeRelationForSelection("equal-radius");

  function fixedRelationTargetForSelection(current, currentSelection) {
    if (!current || !currentSelection) return null;
    const maps = sketchEntityMaps(current.sketch);
    if (currentSelection.vertexIds.length === 1 && currentSelection.edgeIds.length === 0) {
      const vertexId = currentSelection.vertexIds[0];
      const isConstructionVertex = maps.constructionVertices.some((vertex) => vertex.id === vertexId);
      return {
        entityLabel: isConstructionVertex ? "construction point" : "corner",
        relation: fixedRelationForVertex(current.sketch, vertexId),
        patch: { type: "fixed", vertexId },
        selection: { vertexIds: [vertexId], sketchMode: "relations" }
      };
    }
    if (currentSelection.edgeIds.length === 1 && currentSelection.vertexIds.length === 0) {
      const edgeId = currentSelection.edgeIds[0];
      const isConstructionEdge = maps.constructionEdges.some((edge) => edge.id === edgeId);
      return {
        entityLabel: isConstructionEdge ? "construction edge" : "edge",
        relation: fixedRelationForEdge(current.sketch, edgeId),
        patch: { type: "fixed", edgeId },
        selection: { edgeIds: [edgeId], sketchMode: "relations" }
      };
    }
    return null;
  }

  function toggleFixedRelationForSelection() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const fixedTarget = fixedRelationTargetForSelection(current, currentSelection);
    if (!fixedTarget) {
      onStatusChange?.("Plate sketch: select one sketch point or one sketch edge before using Fix.");
      renderOverlay();
      return false;
    }
    try {
      const nextProject = fixedTarget.relation
        ? removeSketchRelation(current.id, fixedTarget.relation.id)
        : upsertSketchRelation(current.id, fixedTarget.patch);
      onProjectChange?.(nextProject);
      if (fixedTarget.relation) {
        selectSketchDetail(fixedTarget.selection);
        onStatusChange?.(`Plate sketch: ${fixedTarget.entityLabel} unfixed`);
      } else {
        selectUpdatedRelation(relationFromProjectByKey(nextProject, current.id, fixedTarget.patch));
        onStatusChange?.(`Plate sketch: ${fixedTarget.entityLabel} fixed`);
      }
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch fixed relation failed");
      renderOverlay();
      return true;
    }
  }

  function inferRelations() {
    const current = plate();
    if (!current) return false;
    try {
      const nextProject = inferSketchRelations(current.id);
      onProjectChange?.(nextProject);
      activeSnap = null;
      actionTarget = null;
      onStatusChange?.("Plate sketch: inferred sketch relations");
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch relation inference failed");
      renderOverlay();
      return true;
    }
  }

  function addConstructionLineFromEndpoints(current, from, to, statusMessage = "Plate sketch: added construction line") {
    if (!current || !from || !to) return false;
    try {
      const nextProject = addSketchConstructionLine(current.id, from, to);
      const nextSketch = activePlate(nextProject, current.id)?.sketch;
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
      onStatusChange?.(statusMessage);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch construction line failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function extendSelectedSketchEntity() {
    const current = plate();
    if (!current) return false;
    const currentSelection = selectionForPlate(current);
    const { outlineEdges } = sketchEntityMaps(current.sketch);
    if (currentSelection.edgeIds.length !== 2) {
      onStatusChange?.("Plate sketch: select two outline sketch edges before using Extend.");
      renderOverlay();
      return false;
    }
    return trimSelectedIntersectingOutlineEdges(current, currentSelection, outlineEdges, { mode: "extend" });
  }

  function addConstructionArcFromPoints(current, center, start, end, statusMessage = "Plate sketch: added construction arc", options = {}) {
    if (!current || !center || !start || !end) return false;
    try {
      const nextProject = addSketchConstructionArc(current.id, center, start, end, options);
      const nextSketch = activePlate(nextProject, current.id)?.sketch;
      const { constructionEdges, vertexMap } = nextSketch
        ? sketchEntityMaps(nextSketch)
        : { constructionEdges: [], vertexMap: new Map() };
      const newEdge = [...constructionEdges].reverse().find((edge) => {
        const edgeFrom = vertexMap.get(edge.from)?.point;
        return edge.kind === "circular-arc"
          && samePoint2(edge.center, center)
          && samePoint2(edgeFrom, start);
      });
      onProjectChange?.(nextProject);
      selection = newEdge
        ? { edgeIds: [newEdge.id], vertexIds: [], relationId: null }
        : { edgeIds: [], vertexIds: [], relationId: null };
      emitSelectionChange();
      onStatusChange?.(statusMessage);
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch construction arc failed");
    }
    activeSnap = null;
    renderOverlay();
    return true;
  }

  function circleToolStatus() {
    if (activeSketchTool?.type !== "circle") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    return activeSketchTool.centerPoint
      ? `Plate sketch Circle: pick radius point${snap}`
      : `Plate sketch Circle: pick center point${snap}`;
  }

  function startCircleTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "circle",
      centerPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(circleToolStatus());
    renderOverlay();
    return true;
  }

  const resolveCircleToolPoint = (input = {}) => resolveSketchToolPoint(input, "circle-tool");

  function applyCircleToolPointer(input = {}) {
    if (activeSketchTool?.type !== "circle") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveCircleToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(circleToolStatus());
    renderOverlay();
    return true;
  }

  function handleCircleToolClick(input = {}) {
    if (activeSketchTool?.type !== "circle") return false;
    const current = plate();
    const result = resolveCircleToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(circleToolStatus());
      renderOverlay();
      return true;
    }
    const center = activeSketchTool.centerPoint;
    const radiusPoint = result.point;
    const radius = Math.hypot(radiusPoint[0] - center[0], radiusPoint[1] - center[1]);
    if (radius <= EPSILON) {
      onStatusChange?.("Plate sketch Circle: radius must be non-zero");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchCircle(current.id, {
        radius,
        center,
        idPrefix: `${current.id}_circle`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "circle",
        centerPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch Circle: circle radius ${formatMm(radius)} created; pick center point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch circle failed");
      renderOverlay();
      return true;
    }
  }

  function diameterCircleToolStatus() {
    if (activeSketchTool?.type !== "diameterCircle") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    return activeSketchTool.firstPoint
      ? `Plate sketch Diameter Circle: pick opposite diameter point${snap}`
      : `Plate sketch Diameter Circle: pick first diameter point${snap}`;
  }

  function startDiameterCircleTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "diameterCircle",
      firstPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(diameterCircleToolStatus());
    renderOverlay();
    return true;
  }

  const resolveDiameterCircleToolPoint = (input = {}) => resolveSketchToolPoint(input, "diameter-circle-tool");

  function applyDiameterCircleToolPointer(input = {}) {
    if (activeSketchTool?.type !== "diameterCircle") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveDiameterCircleToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Diameter Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(diameterCircleToolStatus());
    renderOverlay();
    return true;
  }

  function handleDiameterCircleToolClick(input = {}) {
    if (activeSketchTool?.type !== "diameterCircle") return false;
    const current = plate();
    const result = resolveDiameterCircleToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Diameter Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.firstPoint) {
      activeSketchTool.firstPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(diameterCircleToolStatus());
      renderOverlay();
      return true;
    }
    const firstPoint = activeSketchTool.firstPoint;
    const secondPoint = result.point;
    const diameter = Math.hypot(secondPoint[0] - firstPoint[0], secondPoint[1] - firstPoint[1]);
    if (diameter <= EPSILON) {
      onStatusChange?.("Plate sketch Diameter Circle: diameter must be non-zero");
      renderOverlay();
      return true;
    }
    const center = [
      (firstPoint[0] + secondPoint[0]) / 2,
      (firstPoint[1] + secondPoint[1]) / 2
    ];
    const radius = diameter / 2;
    try {
      const nextProject = setSketchCircle(current.id, {
        radius,
        center,
        idPrefix: `${current.id}_diameter_circle`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "diameterCircle",
        firstPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch Diameter Circle: circle diameter ${formatMm(diameter)} created; pick first diameter point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch diameter circle failed");
      renderOverlay();
      return true;
    }
  }

  function threePointCircleToolStatus() {
    if (activeSketchTool?.type !== "threePointCircle") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    if (!activeSketchTool.firstPoint) return `Plate sketch 3 Point Circle: pick first point${snap}`;
    if (!activeSketchTool.secondPoint) return `Plate sketch 3 Point Circle: pick second point${snap}`;
    return `Plate sketch 3 Point Circle: pick third point${snap}`;
  }

  function startThreePointCircleTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "threePointCircle",
      firstPoint: null,
      secondPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(threePointCircleToolStatus());
    renderOverlay();
    return true;
  }

  const resolveThreePointCircleToolPoint = (input = {}) => resolveSketchToolPoint(input, "three-point-circle-tool");

  function applyThreePointCircleToolPointer(input = {}) {
    if (activeSketchTool?.type !== "threePointCircle") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveThreePointCircleToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch 3 Point Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(threePointCircleToolStatus());
    renderOverlay();
    return true;
  }

  function handleThreePointCircleToolClick(input = {}) {
    if (activeSketchTool?.type !== "threePointCircle") return false;
    const current = plate();
    const result = resolveThreePointCircleToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch 3 Point Circle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.firstPoint) {
      activeSketchTool.firstPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(threePointCircleToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.secondPoint) {
      if (Math.hypot(result.point[0] - activeSketchTool.firstPoint[0], result.point[1] - activeSketchTool.firstPoint[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch 3 Point Circle: second point must differ from first point");
        renderOverlay();
        return true;
      }
      activeSketchTool.secondPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(threePointCircleToolStatus());
      renderOverlay();
      return true;
    }
    const circle = circleThroughThreeSketchPoints(activeSketchTool.firstPoint, activeSketchTool.secondPoint, result.point);
    if (!circle) {
      onStatusChange?.("Plate sketch 3 Point Circle: points must not be collinear");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchCircle(current.id, {
        radius: circle.radius,
        center: circle.center,
        idPrefix: `${current.id}_three_point_circle`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "threePointCircle",
        firstPoint: null,
        secondPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch 3 Point Circle: circle radius ${formatMm(circle.radius)} created; pick first point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch 3 Point Circle failed");
      renderOverlay();
      return true;
    }
  }

  function slotRadiusFromPoint(startCenter, endCenter, point) {
    const axis = [endCenter[0] - startCenter[0], endCenter[1] - startCenter[1]];
    const length = Math.hypot(axis[0], axis[1]);
    if (length <= EPSILON) return null;
    const relative = [point[0] - startCenter[0], point[1] - startCenter[1]];
    return Math.abs(axis[0] * relative[1] - axis[1] * relative[0]) / length;
  }

  function centerSlotCenters(centerPoint, axisPoint) {
    if (!Array.isArray(centerPoint) || !Array.isArray(axisPoint)) return null;
    const axis = [axisPoint[0] - centerPoint[0], axisPoint[1] - centerPoint[1]];
    if (Math.hypot(axis[0], axis[1]) <= EPSILON) return null;
    return {
      startCenter: [centerPoint[0] - axis[0], centerPoint[1] - axis[1]],
      endCenter: [centerPoint[0] + axis[0], centerPoint[1] + axis[1]]
    };
  }

  function slotToolStatus() {
    if (activeSketchTool?.type !== "slot") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    if (!activeSketchTool.startCenter) return `Plate sketch Slot: pick start center${snap}`;
    if (!activeSketchTool.endCenter) return `Plate sketch Slot: pick end center${snap}`;
    return `Plate sketch Slot: pick radius point${snap}`;
  }

  function startSlotTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "slot",
      startCenter: null,
      endCenter: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(slotToolStatus());
    renderOverlay();
    return true;
  }

  const resolveSlotToolPoint = (input = {}) => resolveSketchToolPoint(input, "slot-tool");

  function applySlotToolPointer(input = {}) {
    if (activeSketchTool?.type !== "slot") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveSlotToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Slot: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(slotToolStatus());
    renderOverlay();
    return true;
  }

  function handleSlotToolClick(input = {}) {
    if (activeSketchTool?.type !== "slot") return false;
    const current = plate();
    const result = resolveSlotToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Slot: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.startCenter) {
      activeSketchTool.startCenter = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(slotToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.endCenter) {
      const startCenter = activeSketchTool.startCenter;
      if (Math.hypot(result.point[0] - startCenter[0], result.point[1] - startCenter[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch Slot: centerline must have non-zero length");
        renderOverlay();
        return true;
      }
      activeSketchTool.endCenter = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(slotToolStatus());
      renderOverlay();
      return true;
    }
    const startCenter = activeSketchTool.startCenter;
    const endCenter = activeSketchTool.endCenter;
    const radius = slotRadiusFromPoint(startCenter, endCenter, result.point);
    if (!Number.isFinite(radius) || radius <= EPSILON) {
      onStatusChange?.("Plate sketch Slot: radius point must be off the centerline");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchSlot(current.id, {
        startCenter,
        endCenter,
        radius,
        idPrefix: `${current.id}_slot`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "slot",
        startCenter: null,
        endCenter: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      const length = Math.hypot(endCenter[0] - startCenter[0], endCenter[1] - startCenter[1]) + radius * 2;
      onStatusChange?.(`Plate sketch Slot: slot length ${formatMm(length)} radius ${formatMm(radius)} created; pick start center`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch slot failed");
      renderOverlay();
      return true;
    }
  }

  function centerSlotToolStatus() {
    if (activeSketchTool?.type !== "centerSlot") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    if (!activeSketchTool.centerPoint) return `Plate sketch Center Slot: pick center point${snap}`;
    if (!activeSketchTool.axisPoint) return `Plate sketch Center Slot: pick end-center point${snap}`;
    return `Plate sketch Center Slot: pick radius point${snap}`;
  }

  function startCenterSlotTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "centerSlot",
      centerPoint: null,
      axisPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(centerSlotToolStatus());
    renderOverlay();
    return true;
  }

  const resolveCenterSlotToolPoint = (input = {}) => resolveSketchToolPoint(input, "center-slot-tool");

  function applyCenterSlotToolPointer(input = {}) {
    if (activeSketchTool?.type !== "centerSlot") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveCenterSlotToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Center Slot: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(centerSlotToolStatus());
    renderOverlay();
    return true;
  }

  function handleCenterSlotToolClick(input = {}) {
    if (activeSketchTool?.type !== "centerSlot") return false;
    const current = plate();
    const result = resolveCenterSlotToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Center Slot: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(centerSlotToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.axisPoint) {
      const centerPoint = activeSketchTool.centerPoint;
      if (Math.hypot(result.point[0] - centerPoint[0], result.point[1] - centerPoint[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch Center Slot: centerline must have non-zero length");
        renderOverlay();
        return true;
      }
      activeSketchTool.axisPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(centerSlotToolStatus());
      renderOverlay();
      return true;
    }
    const centers = centerSlotCenters(activeSketchTool.centerPoint, activeSketchTool.axisPoint);
    if (!centers) {
      onStatusChange?.("Plate sketch Center Slot: centerline must have non-zero length");
      renderOverlay();
      return true;
    }
    const { startCenter, endCenter } = centers;
    const radius = slotRadiusFromPoint(startCenter, endCenter, result.point);
    if (!Number.isFinite(radius) || radius <= EPSILON) {
      onStatusChange?.("Plate sketch Center Slot: radius point must be off the centerline");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchSlot(current.id, {
        startCenter,
        endCenter,
        radius,
        idPrefix: `${current.id}_center_slot`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "centerSlot",
        centerPoint: null,
        axisPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      const length = Math.hypot(endCenter[0] - startCenter[0], endCenter[1] - startCenter[1]) + radius * 2;
      onStatusChange?.(`Plate sketch Center Slot: slot length ${formatMm(length)} radius ${formatMm(radius)} created; pick center point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch center slot failed");
      renderOverlay();
      return true;
    }
  }

  function centerRectangleToolStatus() {
    if (activeSketchTool?.type !== "centerRectangle") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    return activeSketchTool.centerPoint
      ? `Plate sketch Center Rectangle: pick corner point${snap}`
      : `Plate sketch Center Rectangle: pick center point${snap}`;
  }

  function startCenterRectangleTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "centerRectangle",
      centerPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(centerRectangleToolStatus());
    renderOverlay();
    return true;
  }

  const resolveCenterRectangleToolPoint = (input = {}) => resolveSketchToolPoint(input, "center-rectangle-tool");

  function applyCenterRectangleToolPointer(input = {}) {
    if (activeSketchTool?.type !== "centerRectangle") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveCenterRectangleToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Center Rectangle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(centerRectangleToolStatus());
    renderOverlay();
    return true;
  }

  function handleCenterRectangleToolClick(input = {}) {
    if (activeSketchTool?.type !== "centerRectangle") return false;
    const current = plate();
    const result = resolveCenterRectangleToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Center Rectangle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(centerRectangleToolStatus());
      renderOverlay();
      return true;
    }
    const center = activeSketchTool.centerPoint;
    const dimensions = roundedRectangleDimensionsFromCorner(center, result.point);
    if (dimensions.width <= EPSILON || dimensions.height <= EPSILON) {
      onStatusChange?.("Plate sketch Center Rectangle: corner must define non-zero width and height");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchCenterRectangle(current.id, {
        ...dimensions,
        center,
        idPrefix: `${current.id}_center_rect`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "centerRectangle",
        centerPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch Center Rectangle: ${formatMm(dimensions.width)} x ${formatMm(dimensions.height)} created; pick center point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch center rectangle failed");
      renderOverlay();
      return true;
    }
  }

  function roundedRectangleDimensionsFromCorner(center, corner) {
    const width = Math.abs(corner[0] - center[0]) * 2;
    const height = Math.abs(corner[1] - center[1]) * 2;
    return { width, height };
  }

  function roundedRectangleRadiusFromPoint(center, corner, point) {
    const { width, height } = roundedRectangleDimensionsFromCorner(center, corner);
    if (width <= EPSILON || height <= EPSILON) return null;
    const rawRadius = Math.max(Math.abs(point[0] - corner[0]), Math.abs(point[1] - corner[1]));
    const maxRadius = Math.min(width, height) / 2 - EPSILON * 10;
    if (!Number.isFinite(rawRadius) || rawRadius <= EPSILON || maxRadius <= EPSILON) return null;
    return Math.min(rawRadius, maxRadius);
  }

  function roundedRectangleToolStatus() {
    if (activeSketchTool?.type !== "roundedRectangle") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    if (!activeSketchTool.centerPoint) return `Plate sketch Rounded Rectangle: pick center point${snap}`;
    if (!activeSketchTool.cornerPoint) return `Plate sketch Rounded Rectangle: pick corner point${snap}`;
    return `Plate sketch Rounded Rectangle: pick radius point${snap}`;
  }

  function startRoundedRectangleTool() {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "roundedRectangle",
      centerPoint: null,
      cornerPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(roundedRectangleToolStatus());
    renderOverlay();
    return true;
  }

  const resolveRoundedRectangleToolPoint = (input = {}) => resolveSketchToolPoint(input, "rounded-rectangle-tool");

  function applyRoundedRectangleToolPointer(input = {}) {
    if (activeSketchTool?.type !== "roundedRectangle") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveRoundedRectangleToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Rounded Rectangle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(roundedRectangleToolStatus());
    renderOverlay();
    return true;
  }

  function handleRoundedRectangleToolClick(input = {}) {
    if (activeSketchTool?.type !== "roundedRectangle") return false;
    const current = plate();
    const result = resolveRoundedRectangleToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Rounded Rectangle: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(roundedRectangleToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.cornerPoint) {
      const dimensions = roundedRectangleDimensionsFromCorner(activeSketchTool.centerPoint, result.point);
      if (dimensions.width <= EPSILON || dimensions.height <= EPSILON) {
        onStatusChange?.("Plate sketch Rounded Rectangle: corner must define non-zero width and height");
        renderOverlay();
        return true;
      }
      activeSketchTool.cornerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(roundedRectangleToolStatus());
      renderOverlay();
      return true;
    }
    const center = activeSketchTool.centerPoint;
    const corner = activeSketchTool.cornerPoint;
    const dimensions = roundedRectangleDimensionsFromCorner(center, corner);
    const radius = roundedRectangleRadiusFromPoint(center, corner, result.point);
    if (!Number.isFinite(radius) || radius <= EPSILON) {
      onStatusChange?.("Plate sketch Rounded Rectangle: radius point must move away from the selected corner");
      renderOverlay();
      return true;
    }
    try {
      const nextProject = setSketchRoundedRectangle(current.id, {
        ...dimensions,
        radius,
        center,
        idPrefix: `${current.id}_rounded_rect`
      });
      onProjectChange?.(nextProject);
      selectSketchDetail({ sketchMode: "relations" });
      activeSketchTool = {
        type: "roundedRectangle",
        centerPoint: null,
        cornerPoint: null,
        previewPoint: null,
        lastPointer: input
      };
      activeSnap = null;
      onStatusChange?.(`Plate sketch Rounded Rectangle: ${formatMm(dimensions.width)} x ${formatMm(dimensions.height)} radius ${formatMm(radius)} created; pick center point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch rounded rectangle failed");
      renderOverlay();
      return true;
    }
  }

  function lineToolStatus() {
    if (activeSketchTool?.type !== "line") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    if (activeSketchTool.contour) {
      const pointCount = Array.isArray(activeSketchTool.points) ? activeSketchTool.points.length : 0;
      if (pointCount === 0) return `Plate sketch Line Contour: pick first point${snap}`;
      if (pointCount === 1) return `Plate sketch Line Contour: pick second point${snap}`;
      if (pointCount === 2 && activeSketchTool.pendingArcSegment?.throughPoint) {
        return `Plate sketch Line Contour: pick third point to create contour with first arc${snap}`;
      }
      if (pointCount === 2) return `Plate sketch Line Contour: pick third point to create contour, or Alt-click to stage first arc${snap}`;
      return `Plate sketch Line Contour: pick next point, Alt-click to arc, Shift+Alt to flip side${snap}`;
    }
    return activeSketchTool.startPoint
      ? `Plate sketch Line: pick end point${snap}`
      : `Plate sketch Line: pick start point${snap}`;
  }

  function startLineTool(options = {}) {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "line",
      contour: options.contour === true,
      points: options.contour === true ? [] : undefined,
      startPoint: null,
      previewPoint: null,
      arcPreviewPoint: null,
      arcPreviewFlipped: false,
      pendingArcSegment: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(lineToolStatus());
    renderOverlay();
    return true;
  }

  function lineContourResumeTool(tool) {
    const points = Array.isArray(tool?.points)
      ? tool.points.map((point) => [...point])
      : [];
    const lastPoint = points[points.length - 1] || (Array.isArray(tool?.startPoint) ? tool.startPoint : null);
    return {
      type: "line",
      contour: true,
      points,
      startPoint: lastPoint ? [...lastPoint] : null,
      previewPoint: null,
      arcPreviewPoint: null,
      arcPreviewFlipped: false,
      pendingArcSegment: null,
      lastPointer: tool?.lastPointer || null
    };
  }

  function sketchToolAltModifier(input = {}) {
    return Boolean(input?.modifiers?.altKey || input?.event?.altKey);
  }

  function sketchToolShiftModifier(input = {}) {
    return Boolean(input?.modifiers?.shiftKey || input?.event?.shiftKey);
  }

  function arcThroughPointForInput(startPoint, endPoint, throughPoint, input = {}) {
    return sketchToolShiftModifier(input)
      ? reflectedPointAcrossSketchLine(throughPoint, startPoint, endPoint)
      : throughPoint;
  }

  function stageLineContourInitialArcSegment(result, input = {}) {
    const points = Array.isArray(activeSketchTool?.points) ? activeSketchTool.points : [];
    if (points.length !== 2) return false;
    const startPoint = points[0];
    const endPoint = points[1];
    if (
      Math.hypot(result.point[0] - startPoint[0], result.point[1] - startPoint[1]) <= EPSILON
      || Math.hypot(result.point[0] - endPoint[0], result.point[1] - endPoint[1]) <= EPSILON
    ) {
      onStatusChange?.("Plate sketch Line Contour: arc point must differ from the first segment endpoints");
      renderOverlay();
      return true;
    }
    const throughPoint = arcThroughPointForInput(startPoint, endPoint, result.point, input);
    const arc = circleThroughThreeSketchPoints(startPoint, throughPoint, endPoint);
    if (!arc) {
      onStatusChange?.("Plate sketch Line Contour: arc point must be off the first segment");
      renderOverlay();
      return true;
    }
    activeSketchTool.pendingArcSegment = {
      fromPoint: [...startPoint],
      toPoint: [...endPoint],
      throughPoint,
      flipped: sketchToolShiftModifier(input)
    };
    activeSketchTool.previewPoint = null;
    activeSketchTool.arcPreviewPoint = throughPoint;
    activeSketchTool.arcPreviewFlipped = sketchToolShiftModifier(input);
    onStatusChange?.(`Plate sketch Line Contour: first segment arc staged radius ${formatMm(arc.radius)}${sketchToolShiftModifier(input) ? " flipped" : ""}; pick third point`);
    renderOverlay();
    return true;
  }

  function applyLineContourPendingArcSegment(objectId, project, pendingArcSegment) {
    if (!pendingArcSegment?.throughPoint) return project;
    const edgeId = outlineEdgeBetweenPoints(project, objectId, pendingArcSegment.fromPoint, pendingArcSegment.toPoint);
    if (!edgeId) return project;
    const nextSketch = activePlate(project, objectId)?.sketch;
    if (nextSketch && sketchEdgeIsCircularArc(nextSketch, edgeId)) return project;
    return setSketchEdgeArc(objectId, edgeId, {
      throughPoint: pendingArcSegment.throughPoint,
      mode: "driven"
    });
  }

  function convertLineContourLatestSegmentToArc(current, result, input = {}) {
    const points = Array.isArray(activeSketchTool?.points) ? activeSketchTool.points : [];
    if (points.length < 3) {
      onStatusChange?.("Plate sketch Line Contour: create the contour before adding an arc segment");
      renderOverlay();
      return true;
    }
    const startPoint = points[points.length - 2];
    const endPoint = points[points.length - 1];
    if (
      Math.hypot(result.point[0] - startPoint[0], result.point[1] - startPoint[1]) <= EPSILON
      || Math.hypot(result.point[0] - endPoint[0], result.point[1] - endPoint[1]) <= EPSILON
    ) {
      onStatusChange?.("Plate sketch Line Contour: arc point must differ from the latest segment endpoints");
      renderOverlay();
      return true;
    }
    const throughPoint = arcThroughPointForInput(startPoint, endPoint, result.point, input);
    const arc = circleThroughThreeSketchPoints(startPoint, throughPoint, endPoint);
    if (!arc) {
      onStatusChange?.("Plate sketch Line Contour: arc point must be off the latest segment");
      renderOverlay();
      return true;
    }
    const edgeId = outlineEdgeBetweenPoints(api.project(), current.id, startPoint, endPoint);
    if (!edgeId) {
      onStatusChange?.("Plate sketch Line Contour: latest segment could not be resolved");
      renderOverlay();
      return true;
    }
    const updatingExistingArc = sketchEdgeIsCircularArc(current.sketch, edgeId);
    try {
      const nextProject = setSketchEdgeArc(current.id, edgeId, {
        throughPoint,
        mode: "driven"
      });
      activeSketchTool = lineContourResumeTool({ ...activeSketchTool, lastPointer: input });
      activeSnap = null;
      onProjectChange?.(nextProject);
      selectSketchDetail({ edgeIds: [edgeId], sketchMode: "relations" });
      onStatusChange?.(`Plate sketch Line Contour: arc segment ${updatingExistingArc ? "updated" : "created"} radius ${formatMm(arc.radius)}${sketchToolShiftModifier(input) ? " flipped" : ""}; pick next point`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch Line Contour arc segment failed");
      renderOverlay();
      return true;
    }
  }

  function resolveSketchToolPoint(input = {}, phase = "sketch-tool") {
    const current = plate();
    if (!current) return null;
    const plane = plateSketchPlane(current);
    const rawWorldPoint = pointerPlanePoint(input, viewer, plane, { preferHit: false });
    if (!v.isVec3(rawWorldPoint)) return null;
    const rawPoint = plateSketchPointFromWorld(current, rawWorldPoint);
    if (!Array.isArray(rawPoint)) return null;
    const snap = sketchSnapEnabled(input)
      ? resolveSketchSnapCandidate(rawPoint, input, [], { phase })
      : null;
    const point = snap?.point || rawPoint;
    return {
      point,
      rawPoint,
      worldPoint: snap?.worldPoint || platePoint(current, point),
      rawWorldPoint: snap?.rawWorldPoint || rawWorldPoint,
      label: snap?.label || null,
      snapped: Boolean(snap?.point)
    };
  }

  function edgeArcToolStatus() {
    if (activeSketchTool?.type !== "edgeArc") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    return `Plate sketch Edge Arc: pick through point${snap}`;
  }

  function startEdgeArcTool(edgeId, startPoint, endPoint, options = {}) {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "edgeArc",
      edgeId,
      startPoint: [...startPoint],
      endPoint: [...endPoint],
      previewPoint: null,
      lastPointer: null,
      resumeTool: options.resumeTool || null,
      updatingExistingArc: options.updatingExistingArc === true
    };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(edgeArcToolStatus());
    renderOverlay();
    return true;
  }

  const resolveEdgeArcToolPoint = (input = {}) => resolveSketchToolPoint(input, "edge-arc-tool");

  function applyEdgeArcToolPointer(input = {}) {
    if (activeSketchTool?.type !== "edgeArc") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveEdgeArcToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Edge Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = arcThroughPointForInput(
      activeSketchTool.startPoint,
      activeSketchTool.endPoint,
      result.point,
      input
    );
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(edgeArcToolStatus());
    renderOverlay();
    return true;
  }

  function handleEdgeArcToolClick(input = {}) {
    if (activeSketchTool?.type !== "edgeArc") return false;
    const current = plate();
    const result = resolveEdgeArcToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Edge Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    const { edgeId, startPoint, endPoint } = activeSketchTool;
    const updatingExistingArc = activeSketchTool.updatingExistingArc === true;
    const throughPoint = arcThroughPointForInput(startPoint, endPoint, result.point, input);
    activeSketchTool.previewPoint = throughPoint;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (
      Math.hypot(throughPoint[0] - startPoint[0], throughPoint[1] - startPoint[1]) <= EPSILON
      || Math.hypot(throughPoint[0] - endPoint[0], throughPoint[1] - endPoint[1]) <= EPSILON
    ) {
      onStatusChange?.("Plate sketch Edge Arc: through point must differ from the edge endpoints");
      renderOverlay();
      return true;
    }
    const arc = circleThroughThreeSketchPoints(startPoint, throughPoint, endPoint);
    if (!arc) {
      onStatusChange?.("Plate sketch Edge Arc: through point must be off the selected edge");
      renderOverlay();
      return true;
    }
    const resumeTool = activeSketchTool.resumeTool
      ? lineContourResumeTool(activeSketchTool.resumeTool)
      : null;
    try {
      const nextProject = setSketchEdgeArc(current.id, edgeId, {
        throughPoint,
        mode: "driven"
      });
      activeSketchTool = resumeTool;
      activeSnap = null;
      onProjectChange?.(nextProject);
      selectSketchDetail({ edgeIds: [edgeId], sketchMode: "relations" });
      onStatusChange?.(resumeTool
        ? `Plate sketch Line Contour: arc segment ${updatingExistingArc ? "updated" : "created"} radius ${formatMm(arc.radius)}${sketchToolShiftModifier(input) ? " flipped" : ""}; pick next point`
        : `Plate sketch Edge Arc: edge ${updatingExistingArc ? "updated" : "converted"} through picked point radius ${formatMm(arc.radius)}${sketchToolShiftModifier(input) ? " flipped" : ""}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch Edge Arc failed");
      renderOverlay();
      return true;
    }
  }

  const resolveLineToolPoint = (input = {}) => resolveSketchToolPoint(input, "line-tool");

  function applyLineToolPointer(input = {}) {
    if (activeSketchTool?.type !== "line") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveLineToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      activeSketchTool.arcPreviewPoint = null;
      activeSketchTool.arcPreviewFlipped = false;
      onStatusChange?.("Plate sketch Line: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    if (activeSketchTool.contour) {
      const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
      if (sketchToolAltModifier(input) && points.length >= 2) {
        const startPoint = points[points.length - 2];
        const endPoint = points[points.length - 1];
        activeSketchTool.previewPoint = null;
        activeSketchTool.arcPreviewPoint = arcThroughPointForInput(startPoint, endPoint, result.point, input);
        activeSketchTool.arcPreviewFlipped = sketchToolShiftModifier(input);
      } else {
        activeSketchTool.previewPoint = result.point;
        if (points.length === 2 && activeSketchTool.pendingArcSegment?.throughPoint) {
          activeSketchTool.arcPreviewPoint = activeSketchTool.pendingArcSegment.throughPoint;
          activeSketchTool.arcPreviewFlipped = activeSketchTool.pendingArcSegment.flipped === true;
        } else {
          activeSketchTool.arcPreviewPoint = null;
          activeSketchTool.arcPreviewFlipped = false;
        }
      }
    } else {
      activeSketchTool.previewPoint = result.point;
      activeSketchTool.arcPreviewPoint = null;
      activeSketchTool.arcPreviewFlipped = false;
    }
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(lineToolStatus());
    renderOverlay();
    return true;
  }

  function handleLineToolClick(input = {}) {
    if (activeSketchTool?.type !== "line") return false;
    const current = plate();
    const result = resolveLineToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Line: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (activeSketchTool.contour) {
      const points = Array.isArray(activeSketchTool.points) ? activeSketchTool.points : [];
      const currentSelection = selectionForPlate(current);
      if (!sketchToolAltModifier(input) && replaceSelectedLineContourVertex(current, currentSelection, result.point)) return true;
      if (!sketchToolAltModifier(input) && insertPointOnSelectedLineContourEdge(current, currentSelection, result.point)) return true;
      const previous = points[points.length - 1] || null;
      if (previous && Math.hypot(result.point[0] - previous[0], result.point[1] - previous[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch Line Contour: point must differ from previous point");
        renderOverlay();
        return true;
      }
      if (sketchToolAltModifier(input)) {
        if (points.length === 2) return stageLineContourInitialArcSegment(result, input);
        return convertLineContourLatestSegmentToArc(current, result, input);
      }
      if (points.some((item) => samePoint2(item, result.point))) {
        onStatusChange?.("Plate sketch Line Contour: point must differ from existing contour points");
        renderOverlay();
        return true;
      }
      const pendingArcSegment = activeSketchTool.pendingArcSegment || null;
      const nextPoints = [...points, [...result.point]];
      activeSketchTool.points = nextPoints;
      activeSketchTool.startPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      activeSketchTool.arcPreviewPoint = null;
      activeSketchTool.arcPreviewFlipped = false;
      if (nextPoints.length < 3) {
        onStatusChange?.(lineToolStatus());
        renderOverlay();
        return true;
      }
      try {
        let nextProject = setSketchOutline(current.id, {
          outline: nextPoints,
          idPrefix: current.id
        });
        nextProject = restoreLineContourArcSegments(current.sketch, current.id, nextProject);
        nextProject = applyLineContourPendingArcSegment(current.id, nextProject, pendingArcSegment);
        const latestEdgeId = outlineEdgeBetweenPoints(
          nextProject,
          current.id,
          nextPoints[nextPoints.length - 2],
          nextPoints[nextPoints.length - 1]
        );
        onProjectChange?.(nextProject);
        selectSketchDetail({ edgeIds: latestEdgeId ? [latestEdgeId] : [], sketchMode: "relations" });
        activeSketchTool = {
          type: "line",
          contour: true,
          points: nextPoints,
          startPoint: [...result.point],
          previewPoint: null,
          arcPreviewPoint: null,
          arcPreviewFlipped: false,
          pendingArcSegment: null,
          lastPointer: input
        };
        activeSnap = null;
        onStatusChange?.(`Plate sketch Line Contour: ${nextPoints.length}-point contour created${pendingArcSegment ? " with first arc" : ""}; latest segment selected`);
        renderOverlay();
        return true;
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch Line Contour failed");
        renderOverlay();
        return true;
      }
    }
    if (!activeSketchTool.startPoint) {
      activeSketchTool.startPoint = [...result.point];
      onStatusChange?.(lineToolStatus());
      renderOverlay();
      return true;
    }
    const from = activeSketchTool.startPoint;
    const to = result.point;
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= EPSILON) {
      onStatusChange?.("Plate sketch Line: line must have non-zero length");
      renderOverlay();
      return true;
    }
    addConstructionLineFromEndpoints(current, from, to, "Plate sketch Line: added line");
    activeSketchTool = {
      type: "line",
      startPoint: [...to],
      previewPoint: null,
      lastPointer: input
    };
    activeSnap = null;
    onStatusChange?.("Plate sketch Line: added line; pick next point");
    renderOverlay();
    return true;
  }

  function centerArcToolStatus() {
    if (activeSketchTool?.type !== "centerArc") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    const label = activeSketchTool.contour ? "Plate sketch Center Arc Contour" : "Plate sketch Center Arc";
    if (!activeSketchTool.centerPoint) return `${label}: pick center point${snap}`;
    if (!activeSketchTool.startPoint) return `${label}: pick start point${snap}`;
    return `${label}: pick end point${snap}`;
  }

  function startCenterArcTool(options = {}) {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "centerArc",
      contour: options.contour === true,
      centerPoint: null,
      startPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(centerArcToolStatus());
    renderOverlay();
    return true;
  }

  const resolveCenterArcToolPoint = (input = {}) => resolveSketchToolPoint(input, "center-arc-tool");

  function applyCenterArcToolPointer(input = {}) {
    if (activeSketchTool?.type !== "centerArc") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveCenterArcToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch Center Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(centerArcToolStatus());
    renderOverlay();
    return true;
  }

  function handleCenterArcToolClick(input = {}) {
    if (activeSketchTool?.type !== "centerArc") return false;
    const current = plate();
    const result = resolveCenterArcToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch Center Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(centerArcToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.startPoint) {
      if (Math.hypot(result.point[0] - activeSketchTool.centerPoint[0], result.point[1] - activeSketchTool.centerPoint[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch Center Arc: radius must be non-zero");
        renderOverlay();
        return true;
      }
      activeSketchTool.startPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(centerArcToolStatus());
      renderOverlay();
      return true;
    }
    const center = activeSketchTool.centerPoint;
    const start = activeSketchTool.startPoint;
    const end = result.point;
    const startVector = [start[0] - center[0], start[1] - center[1]];
    const endVector = [end[0] - center[0], end[1] - center[1]];
    if (Math.hypot(endVector[0], endVector[1]) <= EPSILON) {
      onStatusChange?.("Plate sketch Center Arc: end point must not be at the center");
      renderOverlay();
      return true;
    }
    const cross = startVector[0] * endVector[1] - startVector[1] * endVector[0];
    const dot = startVector[0] * endVector[0] + startVector[1] * endVector[1];
    if (Math.abs(cross) <= EPSILON && dot > 0) {
      onStatusChange?.("Plate sketch Center Arc: sweep must be non-zero");
      renderOverlay();
      return true;
    }
    if (activeSketchTool.contour) {
      const arc = centerArcParameters(center, start, end);
      if (!arc) {
        onStatusChange?.("Plate sketch Center Arc Contour: sweep must be valid");
        renderOverlay();
        return true;
      }
      try {
        const nextProject = setSketchCenterArc(current.id, {
          center: arc.center,
          radius: arc.radius,
          startAngleDegrees: arc.startAngleDegrees,
          sweepDegrees: arc.sweepDegrees
        });
        const nextPlate = activePlate(nextProject, current.id);
        const edgeId = nextPlate ? sketchEdges(nextPlate.sketch).find((edge) => sketchEdgeIsCircularArc(nextPlate.sketch, edge.id))?.id || null : null;
        onProjectChange?.(nextProject);
        selectSketchDetail({ edgeIds: edgeId ? [edgeId] : [], sketchMode: "relations" });
        activeSketchTool = {
          type: "centerArc",
          contour: true,
          centerPoint: null,
          startPoint: null,
          previewPoint: null,
          lastPointer: input
        };
        activeSnap = null;
        onStatusChange?.(`Plate sketch Center Arc Contour: contour created radius ${formatMm(arc.radius)}; pick center point`);
        renderOverlay();
        return true;
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch Center Arc Contour failed");
        renderOverlay();
        return true;
      }
    }
    addConstructionArcFromPoints(current, center, start, end, "Plate sketch Center Arc: added arc");
    activeSketchTool = {
      type: "centerArc",
      contour: false,
      centerPoint: null,
      startPoint: null,
      previewPoint: null,
      lastPointer: input
    };
    activeSnap = null;
    onStatusChange?.("Plate sketch Center Arc: added arc; pick center point");
    renderOverlay();
    return true;
  }

  function threePointArcToolStatus() {
    if (activeSketchTool?.type !== "threePointArc") return "";
    const snap = activeSnap?.label ? ` | ${activeSnap.label}` : "";
    const label = activeSketchTool.contour ? "Plate sketch 3 Point Arc Contour" : "Plate sketch 3 Point Arc";
    if (!activeSketchTool.startPoint) return `${label}: pick start point${snap}`;
    if (!activeSketchTool.throughPoint) return `${label}: pick through point${snap}`;
    return `${label}: pick end point${snap}`;
  }

  function startThreePointArcTool(options = {}) {
    const current = plate();
    if (!current) return false;
    activeSketchTool = {
      type: "threePointArc",
      contour: options.contour === true,
      startPoint: null,
      throughPoint: null,
      previewPoint: null,
      lastPointer: null
    };
    selection = { edgeIds: [], vertexIds: [], relationId: null };
    sketchMode = "relations";
    actionTarget = null;
    activeSnap = null;
    emitSelectionChange();
    onStatusChange?.(threePointArcToolStatus());
    renderOverlay();
    return true;
  }

  const resolveThreePointArcToolPoint = (input = {}) => resolveSketchToolPoint(input, "three-point-arc-tool");

  function applyThreePointArcToolPointer(input = {}) {
    if (activeSketchTool?.type !== "threePointArc") return false;
    activeSketchTool.lastPointer = input;
    const result = resolveThreePointArcToolPoint(input);
    if (!result) {
      activeSnap = null;
      activeSketchTool.previewPoint = null;
      onStatusChange?.("Plate sketch 3 Point Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    onStatusChange?.(threePointArcToolStatus());
    renderOverlay();
    return true;
  }

  function handleThreePointArcToolClick(input = {}) {
    if (activeSketchTool?.type !== "threePointArc") return false;
    const current = plate();
    const result = resolveThreePointArcToolPoint(input);
    if (!current || !result) {
      onStatusChange?.("Plate sketch 3 Point Arc: could not resolve point on sketch plane");
      renderOverlay();
      return true;
    }
    activeSketchTool.lastPointer = input;
    activeSketchTool.previewPoint = result.point;
    activeSnap = result.snapped
      ? {
          point: result.worldPoint,
          rawPoint: result.rawWorldPoint,
          label: `Snap ${result.label}`
        }
      : null;
    if (!activeSketchTool.startPoint) {
      activeSketchTool.startPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(threePointArcToolStatus());
      renderOverlay();
      return true;
    }
    if (!activeSketchTool.throughPoint) {
      if (Math.hypot(result.point[0] - activeSketchTool.startPoint[0], result.point[1] - activeSketchTool.startPoint[1]) <= EPSILON) {
        onStatusChange?.("Plate sketch 3 Point Arc: through point must differ from start point");
        renderOverlay();
        return true;
      }
      activeSketchTool.throughPoint = [...result.point];
      activeSketchTool.previewPoint = null;
      onStatusChange?.(threePointArcToolStatus());
      renderOverlay();
      return true;
    }
    const start = activeSketchTool.startPoint;
    const through = activeSketchTool.throughPoint;
    const end = result.point;
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) <= EPSILON || Math.hypot(end[0] - through[0], end[1] - through[1]) <= EPSILON) {
      onStatusChange?.("Plate sketch 3 Point Arc: end point must differ from the first two points");
      renderOverlay();
      return true;
    }
    const arc = circleThroughThreeSketchPoints(start, through, end);
    if (!arc) {
      onStatusChange?.("Plate sketch 3 Point Arc: points must be non-collinear");
      renderOverlay();
      return true;
    }
    if (activeSketchTool.contour) {
      const contourArc = threePointArcContourParameters(start, through, end);
      if (!contourArc) {
        onStatusChange?.("Plate sketch 3 Point Arc Contour: sweep must be valid");
        renderOverlay();
        return true;
      }
      try {
        const nextProject = setSketchCenterArc(current.id, {
          center: contourArc.center,
          radius: contourArc.radius,
          startAngleDegrees: contourArc.startAngleDegrees,
          sweepDegrees: contourArc.sweepDegrees
        });
        const nextPlate = activePlate(nextProject, current.id);
        const edgeId = nextPlate ? sketchEdges(nextPlate.sketch).find((edge) => sketchEdgeIsCircularArc(nextPlate.sketch, edge.id))?.id || null : null;
        onProjectChange?.(nextProject);
        selectSketchDetail({ edgeIds: edgeId ? [edgeId] : [], sketchMode: "relations" });
        activeSketchTool = {
          type: "threePointArc",
          contour: true,
          startPoint: null,
          throughPoint: null,
          previewPoint: null,
          lastPointer: input
        };
        activeSnap = null;
        onStatusChange?.(`Plate sketch 3 Point Arc Contour: contour created radius ${formatMm(contourArc.radius)}; pick start point`);
        renderOverlay();
        return true;
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch 3 Point Arc Contour failed");
        renderOverlay();
        return true;
      }
    }
    addConstructionArcFromPoints(current, arc.center, start, end, "Plate sketch 3 Point Arc: added arc", { direction: arc.direction });
    activeSketchTool = {
      type: "threePointArc",
      contour: false,
      startPoint: null,
      throughPoint: null,
      previewPoint: null,
      lastPointer: input
    };
    activeSnap = null;
    onStatusChange?.("Plate sketch 3 Point Arc: added arc; pick start point");
    renderOverlay();
    return true;
  }

  function addLineForSelection() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "line" && !activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Line: cancelled");
      return true;
    }
    const currentSelection = selectionForPlate(current);
    const { edges, vertexMap } = sketchEntityMaps(current.sketch);
    let from = null;
    let to = null;
    if (currentSelection.edgeIds.length === 1 && currentSelection.vertexIds.length === 0) {
      const pair = edgePointPair(edges, vertexMap, currentSelection.edgeIds[0]);
      from = pair?.from || null;
      to = pair?.to || null;
    } else if (currentSelection.vertexIds.length === 2 && currentSelection.edgeIds.length === 0) {
      from = vertexMap.get(currentSelection.vertexIds[0])?.point || null;
      to = vertexMap.get(currentSelection.vertexIds[1])?.point || null;
    }
    if (!from || !to) {
      return startLineTool();
    }
    return addConstructionLineFromEndpoints(current, from, to, "Plate sketch: added line");
  }

  function createLineContourSketch() {
    const current = plate();
    if (!current) return false;
    if (activeSketchTool?.type === "line" && activeSketchTool.contour) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch Line Contour: cancelled");
      return true;
    }
    return startLineTool({ contour: true });
  }

  function defaultPlateThickness() {
    const value = Number(settings.plateSketchDefaultPlateThickness);
    return Number.isFinite(value) && value > 0 ? value : 8;
  }

  function requestPlateThickness() {
    const fallback = defaultPlateThickness();
    const raw = requestDimensionInput({
      kind: "convert-sketch-plate-thickness",
      promptText: `Plate thickness mm (${formatMm(fallback)})`,
      currentValue: fallback,
      defaultValue: String(fallback)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function convertSketchToPlate() {
    const current = plate();
    const currentTarget = target();
    if (!current) return false;
    if (currentTarget?.collection !== "sketches") {
      onStatusChange?.("Plate sketch: Convert To Plate is available for standalone sketches.");
      renderOverlay();
      return false;
    }
    if (typeof api.createPlateFromSketch !== "function") {
      onStatusChange?.("Plate sketch: Convert To Plate is not available in this project API.");
      renderOverlay();
      return false;
    }
    const thickness = requestPlateThickness();
    if (thickness === null) {
      onStatusChange?.("Plate sketch: Convert To Plate cancelled");
      renderOverlay();
      return true;
    }
    try {
      const result = api.createPlateFromSketch(current.id, {
        id: `${current.id}_plate`,
        thickness
      });
      onProjectChange?.(result.project);
      activePlateId = result.plateId;
      selection = { edgeIds: [], vertexIds: [], relationId: null };
      sketchMode = "relations";
      activeSnap = null;
      actionTarget = null;
      emitSelectionChange();
      onStatusChange?.(`Plate sketch: created plate ${result.plateId} thickness ${formatMm(thickness)}`);
      renderOverlay();
      return true;
    } catch (error) {
      onStatusChange?.(error.message || "Plate sketch Convert To Plate failed");
      renderOverlay();
      return true;
    }
  }

  function applyRelationAction(handle) {
    if (handle.existingRelationId) {
      selectRelation(handle.existingRelationId);
      onStatusChange?.("Plate sketch: selected existing relation");
      activeSnap = null;
      renderOverlay();
      return true;
    }
    if (handle.relationType === "flip-arc") {
      selectSketchDetail({ edgeIds: [handle.edgeId].filter(Boolean), sketchMode: "relations" });
      return flipSelectedArc();
    }
    if (handle.relationType === "split-arc") {
      selectSketchDetail({ edgeIds: [handle.edgeId].filter(Boolean), sketchMode: "relations" });
      return splitSelectedArc();
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
      return addConstructionLineFromEndpoints(current, from, to);
    }
    const relation = relationPatchFromAction(handle);
    if (!relation) {
      onStatusChange?.("Plate sketch: relation cancelled");
      activeSnap = null;
      renderOverlay();
      return true;
    }
    const currentForRelation = plate();
    if (
      currentForRelation
      && relation.type === "point-on-circle"
      && vertexTouchesOtherCircularArc(currentForRelation.sketch, relation.vertexId, relation.edgeId)
    ) {
      onStatusChange?.(pointOnCircleEndpointConflictMessage());
      activeSnap = null;
      renderOverlay();
      return true;
    }
    try {
      let nextProject = null;
      let nextRelation = null;
      let statusMessage = `Plate sketch: added ${sketchRelationLabel(relation).toLowerCase()} relation`;
      if (relation.type === "radius") {
        nextProject = setSketchEdgeRadius(handle.plateId, relation.edgeId, relation.value, {
          mode: "driven",
          display: relation.display || "radius"
        });
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
        statusMessage = relation.display === "diameter"
          ? `Plate sketch: added reference diameter ${formatMm(relation.value * 2)}`
          : `Plate sketch: added reference radius ${formatMm(relation.value)}`;
      } else if (relation.type === "angle") {
        nextProject = setSketchEdgeAngle(handle.plateId, relation.edgeIds, relation.value, {
          mode: "driving",
          targetEdgeId: relation.targetEdgeId
        });
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
        statusMessage = sketchAngleRelationMode(nextRelation) === "driven"
          ? `Plate sketch: redundant angle added as reference ${formatDeg(nextRelation?.value || relation.value)}`
          : `Plate sketch: added driving angle ${formatDeg(relation.value)}`;
      } else if (relation.type === "distance") {
        nextProject = setSketchPointDistance(handle.plateId, relation.vertexIds, relation.value, {
          mode: "driving",
          targetVertexId: relation.targetVertexId
        });
        nextRelation = relationFromProjectByKey(nextProject, handle.plateId, relation);
        statusMessage = sketchDistanceRelationMode(nextRelation) === "driven"
          ? `Plate sketch: redundant distance added as reference ${formatMm(nextRelation?.value || relation.value)}`
          : `Plate sketch: added driving distance ${formatMm(relation.value)}`;
      } else {
        nextProject = upsertSketchRelation(handle.plateId, relation);
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
    if (handle.kind === "plate-sketch-radius-dimension") {
      return beginDimensionPlacementDrag(handle, event);
    }
    if (handle.kind === "plate-sketch-center") {
      if (!current) return false;
      drag = {
        kind: "center",
        handle,
        plateId: handle.plateId,
        baseCenter: [...current.center],
        localAxisY: v.norm(current.localAxisY),
        localAxisZ: v.norm(current.localAxisZ)
      };
      activeSnap = null;
      onStatusChange?.("Plate sketch: drag center");
      return true;
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
          ? removeSketchRelation(handle.plateId, relation.id)
          : upsertSketchRelation(handle.plateId, { type: "fixed", vertexId: handle.vertexId });
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
        const nextProject = removeSketchVertex(handle.plateId, handle.vertexId);
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
        const result = notchSketchCorner(handle.plateId, handle.vertexId, notchOptions);
        onProjectChange?.(result.project);
        const nextPlate = activePlate(result.project, handle.plateId);
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
    if (handle.kind === "plate-sketch-fillet-corner") {
      return applyFilletCorner(handle);
    }
    if (handle.kind === "plate-sketch-arc-direction") {
      selectSketchDetail({ edgeIds: [handle.edgeId], sketchMode: "relations" });
      activeSnap = null;
      drag = null;
      return flipSelectedArc();
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

  function click(input = {}) {
    if (activeSketchTool?.type === "circle") return handleCircleToolClick(input);
    if (activeSketchTool?.type === "diameterCircle") return handleDiameterCircleToolClick(input);
    if (activeSketchTool?.type === "threePointCircle") return handleThreePointCircleToolClick(input);
    if (activeSketchTool?.type === "slot") return handleSlotToolClick(input);
    if (activeSketchTool?.type === "centerSlot") return handleCenterSlotToolClick(input);
    if (activeSketchTool?.type === "centerRectangle") return handleCenterRectangleToolClick(input);
    if (activeSketchTool?.type === "roundedRectangle") return handleRoundedRectangleToolClick(input);
    if (activeSketchTool?.type === "line") return handleLineToolClick(input);
    if (activeSketchTool?.type === "centerArc") return handleCenterArcToolClick(input);
    if (activeSketchTool?.type === "threePointArc") return handleThreePointArcToolClick(input);
    if (activeSketchTool?.type === "edgeArc") return handleEdgeArcToolClick(input);
    return false;
  }

  function pointerMove(input = {}) {
    if (activeSketchTool?.type === "circle") return applyCircleToolPointer(input);
    if (activeSketchTool?.type === "diameterCircle") return applyDiameterCircleToolPointer(input);
    if (activeSketchTool?.type === "threePointCircle") return applyThreePointCircleToolPointer(input);
    if (activeSketchTool?.type === "slot") return applySlotToolPointer(input);
    if (activeSketchTool?.type === "centerSlot") return applyCenterSlotToolPointer(input);
    if (activeSketchTool?.type === "centerRectangle") return applyCenterRectangleToolPointer(input);
    if (activeSketchTool?.type === "roundedRectangle") return applyRoundedRectangleToolPointer(input);
    if (activeSketchTool?.type === "line") return applyLineToolPointer(input);
    if (activeSketchTool?.type === "centerArc") return applyCenterArcToolPointer(input);
    if (activeSketchTool?.type === "threePointArc") return applyThreePointArcToolPointer(input);
    if (activeSketchTool?.type === "edgeArc") return applyEdgeArcToolPointer(input);
    return false;
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
    const current = plate();
    const edgeIsArc = current ? sketchEdgeIsCircularArc(current.sketch, drag.edgeId) : false;
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
      let nextProject = setSketchVertices(drag.plateId, [
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
      else {
        const snapLabel = result.snapped && result.label ? ` | Snap ${result.label}` : "";
        onStatusChange?.(`Plate sketch: ${edgeIsArc ? "arc edge" : "edge"} offset ${formatMm(result.delta)}${snapLabel}`);
      }
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
      nextProject = upsertSketchRelation(plateId, relation);
      const nextRelation = relationFromProjectByKey(nextProject, plateId, relation);
      if (nextRelation) appliedRelations.push(nextRelation);
    }
    return { project: nextProject, relations: appliedRelations };
  }

  function insertSketchVertexForDrag(handle) {
    try {
      const result = insertSketchVertex(handle.plateId, handle.edgeId, handle.sketchPoint, {
        addSplitCollinear: false,
        inferNewRelations: false,
        inheritAxisRelations: false,
        inheritDirectionalRelations: false
      });
      onProjectChange?.(result.project);
      selectSketchDetail({ vertexIds: [result.vertexId] });
      drag = null;
      onStatusChange?.("Plate sketch: point added");
      renderOverlay();
      return true;
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
    if (drag?.kind === "center") {
      const [dy, dz] = screenDeltaToSketch(drag.handle, input.totalDx || 0, input.totalDy || 0);
      const nextCenter = v.add(drag.baseCenter, v.add(v.mul(drag.localAxisY, dy), v.mul(drag.localAxisZ, dz)));
      try {
        const nextProject = updateSketchCenter(drag.plateId, nextCenter);
        onProjectChange?.(nextProject);
        renderOverlay();
      } catch (error) {
        onStatusChange?.(error.message || "Plate sketch center update failed");
      }
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
        const nextProject = setSketchVertex(drag.plateId, drag.vertexId, result.point);
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
        const nextProject = setSketchVertices(drag.plateId, result.updates);
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
      let nextProject = setSketchVertex(drag.plateId, drag.vertexId, result.point);
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

  function activeToolStatus() {
    if (!activeSketchTool?.type) return "Plate sketch: sketch tool cancelled";
    if (activeSketchTool.type === "circle") return circleToolStatus();
    if (activeSketchTool.type === "diameterCircle") return diameterCircleToolStatus();
    if (activeSketchTool.type === "threePointCircle") return threePointCircleToolStatus();
    if (activeSketchTool.type === "slot") return slotToolStatus();
    if (activeSketchTool.type === "centerSlot") return centerSlotToolStatus();
    if (activeSketchTool.type === "centerRectangle") return centerRectangleToolStatus();
    if (activeSketchTool.type === "roundedRectangle") return roundedRectangleToolStatus();
    if (activeSketchTool.type === "centerArc") return centerArcToolStatus();
    if (activeSketchTool.type === "threePointArc") return threePointArcToolStatus();
    if (activeSketchTool.type === "edgeArc") return edgeArcToolStatus();
    if (activeSketchTool.type === "line") return lineToolStatus();
    return "Plate sketch: sketch tool active";
  }

  function backtrackActiveToolPoint() {
    if (!activeSketchTool?.type) return false;
    const type = activeSketchTool.type;
    if (type === "line" && activeSketchTool.contour) return backtrackActiveLineContour();
    let changed = false;
    if (type === "line" && activeSketchTool.startPoint) {
      activeSketchTool.startPoint = null;
      changed = true;
    } else if (type === "circle" && activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = null;
      changed = true;
    } else if (type === "diameterCircle" && activeSketchTool.firstPoint) {
      activeSketchTool.firstPoint = null;
      changed = true;
    } else if (type === "threePointCircle") {
      if (activeSketchTool.secondPoint) {
        activeSketchTool.secondPoint = null;
        changed = true;
      } else if (activeSketchTool.firstPoint) {
        activeSketchTool.firstPoint = null;
        changed = true;
      }
    } else if (type === "slot") {
      if (activeSketchTool.endCenter) {
        activeSketchTool.endCenter = null;
        changed = true;
      } else if (activeSketchTool.startCenter) {
        activeSketchTool.startCenter = null;
        changed = true;
      }
    } else if (type === "centerSlot") {
      if (activeSketchTool.axisPoint) {
        activeSketchTool.axisPoint = null;
        changed = true;
      } else if (activeSketchTool.centerPoint) {
        activeSketchTool.centerPoint = null;
        changed = true;
      }
    } else if (type === "centerRectangle" && activeSketchTool.centerPoint) {
      activeSketchTool.centerPoint = null;
      changed = true;
    } else if (type === "roundedRectangle") {
      if (activeSketchTool.cornerPoint) {
        activeSketchTool.cornerPoint = null;
        changed = true;
      } else if (activeSketchTool.centerPoint) {
        activeSketchTool.centerPoint = null;
        changed = true;
      }
    } else if (type === "centerArc") {
      if (activeSketchTool.startPoint) {
        activeSketchTool.startPoint = null;
        changed = true;
      } else if (activeSketchTool.centerPoint) {
        activeSketchTool.centerPoint = null;
        changed = true;
      }
    } else if (type === "threePointArc") {
      if (activeSketchTool.throughPoint) {
        activeSketchTool.throughPoint = null;
        changed = true;
      } else if (activeSketchTool.startPoint) {
        activeSketchTool.startPoint = null;
        changed = true;
      }
    }
    if (!changed) {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch: sketch tool cancelled");
      return true;
    }
    activeSketchTool.previewPoint = null;
    activeSketchTool.arcPreviewPoint = null;
    activeSketchTool.pendingArcSegment = null;
    activeSnap = null;
    onStatusChange?.(activeToolStatus());
    renderOverlay();
    return true;
  }

  function commitActiveToolPreviewPoint() {
    const hasPreviewPoint = Array.isArray(activeSketchTool?.previewPoint) || Array.isArray(activeSketchTool?.arcPreviewPoint);
    if (!activeSketchTool?.type || !activeSketchTool.lastPointer || !hasPreviewPoint) return false;
    const input = {
      ...activeSketchTool.lastPointer,
      event: {
        ...(activeSketchTool.lastPointer.event || {}),
        button: 0,
        detail: 1
      }
    };
    if (activeSketchTool.type === "circle") return handleCircleToolClick(input);
    if (activeSketchTool.type === "diameterCircle") return handleDiameterCircleToolClick(input);
    if (activeSketchTool.type === "threePointCircle") return handleThreePointCircleToolClick(input);
    if (activeSketchTool.type === "slot") return handleSlotToolClick(input);
    if (activeSketchTool.type === "centerSlot") return handleCenterSlotToolClick(input);
    if (activeSketchTool.type === "centerRectangle") return handleCenterRectangleToolClick(input);
    if (activeSketchTool.type === "roundedRectangle") return handleRoundedRectangleToolClick(input);
    if (activeSketchTool.type === "centerArc") return handleCenterArcToolClick(input);
    if (activeSketchTool.type === "threePointArc") return handleThreePointArcToolClick(input);
    if (activeSketchTool.type === "edgeArc") return handleEdgeArcToolClick(input);
    if (activeSketchTool.type === "line") return handleLineToolClick(input);
    return false;
  }

  function handleKey(event) {
    if (!activeSketchTool?.type || event?.ctrlKey || event?.metaKey) return false;
    const key = String(event?.key || "").toLowerCase();
    const code = String(event?.code || "").toLowerCase();
    if (!event?.altKey && (key === "backspace" || code === "backspace" || key === "delete" || key === "del" || code === "delete")) {
      return POINT_BACKTRACK_SKETCH_TOOL_TYPES.has(activeSketchTool.type) ? backtrackActiveToolPoint() : false;
    }
    if (key === "enter" || code === "enter" || code === "numenter") return commitActiveToolPreviewPoint();
    if (key === "escape" || code === "escape") {
      clearSelection({ status: false });
      onStatusChange?.("Plate sketch: sketch tool cancelled");
      return true;
    }
    return false;
  }

  function cycleSnap() {
    if (activeSketchTool?.type === "circle" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyCircleToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "diameterCircle" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyDiameterCircleToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "threePointCircle" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyThreePointCircleToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "slot" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applySlotToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "centerSlot" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyCenterSlotToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "centerRectangle" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyCenterRectangleToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "roundedRectangle" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyRoundedRectangleToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "line" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyLineToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "centerArc" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyCenterArcToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "threePointArc" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyThreePointArcToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
    if (activeSketchTool?.type === "edgeArc" && activeSketchTool.lastPointer) {
      snapManager?.cycle?.();
      applyEdgeArcToolPointer({ ...activeSketchTool.lastPointer, cycleSnapRefresh: true });
      return true;
    }
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
    renderOverlay,
    selectObject,
    selectRelation,
    selectEntities,
    setSketchMode,
    toggleRelations,
    cycleSnap,
    clearSelection,
    removeSelectedRelation,
    removeSelectedSketchEntity,
    trimSelectedSketchEntity,
    extendSelectedSketchEntity,
    createCircleSketch,
    createDiameterCircleSketch,
    createThreePointCircleSketch,
    createCenterRectangleSketch,
    createRoundedRectangleSketch,
    createSlotSketch,
    createCenterSlotSketch,
    createCenterArcSketch,
    createCenterArcContourSketch,
    addLineForSelection,
    createLineContourSketch,
    convertSketchToPlate,
    convertSelectedEdgeToArc,
    createThreePointArcFromSelection,
    createThreePointArcContourSketch,
    flipSelectedArc,
    splitSelectedArc,
    addRadiusDimensionForSelection,
    addDiameterDimensionForSelection,
    addLengthDimensionForSelection,
    addAngleDimensionForSelection,
    addDistanceDimensionForSelection,
    addCoincidentRelationForSelection,
    addPointOnCircleRelationForSelection,
    addTangentRelationForSelection,
    addConcentricRelationForSelection,
    addEqualRadiusRelationForSelection,
    toggleFixedRelationForSelection,
    filletSelectedCorner,
    inferRelations,
    authoringHandler: {
      beginDrag,
      click,
      pointerMove,
      contextMenu,
      quickListAction,
      drag: applyDrag,
      end: endDrag,
      cancel: endDrag
    },
    handleKey
  };
}
