import { v } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { addPlateSketchConstructionLine as addPlateSketchConstructionLineData, insertPlateSketchVertex as insertPlateSketchVertexData, notchPlateSketchCorner as notchPlateSketchCornerData, orderedSketchLoop, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, removePlateSketchRelation as removePlateSketchRelationData, removePlateSketchVertex as removePlateSketchVertexData, setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData, setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData, setPlateSketchEdgeLength as setPlateSketchEdgeLengthData, setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData, setPlateSketchPointDistance as setPlateSketchPointDistanceData, setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData, setPlateSketchVertex as setPlateSketchVertexData, setPlateSketchVertices as setPlateSketchVerticesData, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdges, sketchFromOutline, sketchLengthRelationMode, sketchPointDistance, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices, upsertPlateSketchRelation as upsertPlateSketchRelationData } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { snapPointOverlay } from "../../scene/authoring/snap-overlays.mjs";
import { adaptiveSnapGridStep, adaptiveSnapGridStepForHandle, snapScalarToGrid, snapSketchWorldTolerance } from "../snap-profiles.mjs";
import { dimensionOverlayForPlate } from "./dimension-overlay.mjs";
import { relationHealthClass, relationHealthColor, relationHealthStatus, sketchEntityColor, sketchStatusColor } from "./relation-display.mjs";
import { EPSILON, add2, cross2, dot2, edgeOutwardNormal, edgePointPair, len2, midpoint, mul2, norm2, platePoint, requiredPoint2, signedArea, sub2 } from "./sketch-edit-geometry.mjs";

import {
  DEFAULT_EDGE_SNAP_MAX_WORLD,
  DEFAULT_NOTCH_MAX_SIZE,
  DEFAULT_NOTCH_SIZE,
  DEFAULT_VERTEX_ANGLE_SNAP_MAX_WORLD,
  DEFAULT_VERTEX_EQUAL_SNAP_MAX_WORLD,
  DEFAULT_VERTEX_RELATION_SNAP_MAX_WORLD
} from './drag-edit-constants.mjs';
import {
  axisOrientation,
  edgeTangentConstraint,
  equalLengthSnapTargets,
  equalLengthTarget,
  formatMm,
  hasSelfIntersection,
  positiveSetting
} from './drag-edit-geometry.mjs';

export function edgeDragContext(plate, edgeId, settings = {}, options = {}) {
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

export function shiftedEdgePoints(drag, delta) {
  const offset = mul2(drag.normal, delta);
  return {
    from: add2(drag.baseFrom, offset),
    to: add2(drag.baseTo, offset),
    midpoint: add2(drag.baseMidpoint, offset)
  };
}

export function validEdgeDelta(drag, delta) {
  const shifted = shiftedEdgePoints(drag, delta);
  const fromProjectionGap = (dot2(shifted.from, drag.normal) - dot2(drag.previousPoint, drag.normal)) * drag.fromProjectionSide;
  const toProjectionGap = (dot2(shifted.to, drag.normal) - dot2(drag.nextPoint, drag.normal)) * drag.toProjectionSide;
  return len2(sub2(shifted.from, drag.previousPoint)) > drag.minAdjacentLength
    && len2(sub2(shifted.to, drag.nextPoint)) > drag.minAdjacentLength
    && fromProjectionGap > drag.minAdjacentLength
    && toProjectionGap > drag.minAdjacentLength;
}

export function edgeSnapCandidates(drag, rawDelta, handle, settings = {}, input = {}, options = {}) {
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

export function snappedEdgeDelta(drag, rawDelta, handle, settings = {}, input = {}, options = {}) {
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

export function vertexDragContext(plate, vertexId, settings = {}) {
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

export function constructionVertexDragContext(plate, vertexId) {
  const vertex = sketchConstructionVertices(plate.sketch).find((item) => item.id === vertexId);
  if (!vertex) return null;
  return {
    vertexId,
    basePoint: [...requiredPoint2(vertex.point, `${vertex.id}.point`)]
  };
}

export function snappedFreeSketchPoint(drag, rawPoint, handle, settings = {}, input = {}) {
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

export function freeSketchPointSnapCandidates(drag, rawPoint, handle, settings = {}, input = {}, options = {}) {
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

export function pointsWithUpdates(drag, updates) {
  const updateMap = new Map(updates.map((item) => [item.vertexId, item.point]));
  return drag.points.map((point, index) => updateMap.get(drag.vertexIds[index]) || point);
}

export function validUpdatedPoints(drag, points) {
  for (let index = 0; index < points.length; index += 1) {
    if (len2(sub2(points[index], points[(index + 1) % points.length])) <= drag.minAdjacentLength) return false;
  }
  const area = signedArea(points);
  if (Math.abs(area) <= EPSILON) return false;
  if ((Math.sign(area) || drag.baseAreaSign) !== drag.baseAreaSign) return false;
  return !hasSelfIntersection(points);
}

export function validVertexPoint(drag, point) {
  return validUpdatedPoints(drag, pointsWithUpdates(drag, [{ vertexId: drag.vertexId, point }]));
}

export function adjacentPointForLockedCorner(adjacent, point, orientation) {
  return orientation === "y"
    ? [adjacent[0], point[1]]
    : [point[0], adjacent[1]];
}

export function adjacentPointForConstraint(adjacent, point, constraint, fallbackOrientation) {
  const tangent = constraint?.tangent;
  if (Array.isArray(tangent) && len2(tangent) > EPSILON) {
    const projection = dot2(sub2(adjacent, point), tangent);
    return add2(point, mul2(tangent, projection));
  }
  return adjacentPointForLockedCorner(adjacent, point, fallbackOrientation);
}

export function lockedVertexResult(drag, rawPoint, handle, settings = {}, input = {}) {
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

export function snappedNotchSize(plate, vertexId, settings = {}, viewer = null) {
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

export function pushVertexSnapCandidate(candidates, point, label, priority = 0, options = {}) {
  if (!Array.isArray(point) || point.length !== 2 || point.some((value) => !Number.isFinite(value))) return;
  candidates.push({
    point,
    label,
    priority,
    relations: Array.isArray(options.relations) ? options.relations.filter(Boolean) : [],
    maxWorldDistance: Number.isFinite(options.maxWorldDistance) && options.maxWorldDistance > 0 ? options.maxWorldDistance : null
  });
}

export function pushEqualLengthCandidate(candidates, edgeId, anchor, rawPoint, target, label, priority = 45, maxWorldDistance = DEFAULT_VERTEX_EQUAL_SNAP_MAX_WORLD) {
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

export function pushAxisRelationCandidate(candidates, edgeId, anchor, rawPoint, relationType, label, priority = 38, maxWorldDistance = DEFAULT_VERTEX_RELATION_SNAP_MAX_WORLD) {
  if (!edgeId) return;
  const point = relationType === "horizontal"
    ? [rawPoint[0], anchor[1]]
    : [anchor[0], rawPoint[1]];
  pushVertexSnapCandidate(candidates, point, label, priority, {
    relations: [{ type: relationType, edgeId }],
    maxWorldDistance
  });
}

export function vertexSnapCandidates(drag, rawPoint, handle, settings = {}, input = {}) {
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

export function snappedVertexPoint(drag, rawPoint, handle, settings = {}, input = {}) {
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
