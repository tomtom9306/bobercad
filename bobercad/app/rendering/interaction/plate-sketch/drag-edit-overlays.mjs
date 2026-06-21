import { v } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { addPlateSketchConstructionLine as addPlateSketchConstructionLineData, insertPlateSketchVertex as insertPlateSketchVertexData, notchPlateSketchCorner as notchPlateSketchCornerData, orderedSketchLoop, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, removePlateSketchRelation as removePlateSketchRelationData, removePlateSketchVertex as removePlateSketchVertexData, setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData, setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData, setPlateSketchEdgeLength as setPlateSketchEdgeLengthData, setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData, setPlateSketchPointDistance as setPlateSketchPointDistanceData, setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData, setPlateSketchVertex as setPlateSketchVertexData, setPlateSketchVertices as setPlateSketchVerticesData, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdges, sketchFromOutline, sketchLengthRelationMode, sketchPointDistance, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices, upsertPlateSketchRelation as upsertPlateSketchRelationData } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
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
  const lineSpecs = edges.length
    ? edges.map((edge) => ({ edge, from: vertexMap.get(edge.from), to: vertexMap.get(edge.to) }))
    : vertices.map((vertex, index) => ({ edge: null, from: vertex, to: vertices[(index + 1) % vertices.length] }));
  const facePoints = vertices.map((vertex) => requiredPoint2(vertex.point, `${vertex.id}.point`));
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
    const sketchPoint = midpoint(requiredPoint2(from.point, `${from.id}.point`), requiredPoint2(to.point, `${to.id}.point`));
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
    const sketchPoint = midpoint(requiredPoint2(from.point, `${from.id}.point`), requiredPoint2(to.point, `${to.id}.point`));
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

export function relationActionOverlayForSelection(plate, { edges, vertexMap, constructionEdgeIds = new Set(), selectedEdgeIds, selectedVertexIds, settings = {} }) {
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
    const firstPoint = requiredPoint2(first.point, `${first.id}.point`);
    const secondPoint = requiredPoint2(second.point, `${second.id}.point`);
    const basePoint = midpoint(firstPoint, secondPoint);
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
