import { v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { sketchAngleRelationMode, sketchDistanceRelationMode, sketchEdges, sketchRelationKey, sketchRelationLabel, sketchRelations } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { snapPointOverlay } from "../scene/authoring/snap-overlays.mjs";
import { DEFAULT_INSERT_VERTEX_DRAG_THRESHOLD_PX } from "./plate-sketch/drag-edit-constants.mjs";
import { createPlateSketchDimensionActions } from "./plate-sketch/drag-edit-dimensions.mjs";
import { createPlateSketchMutationApi } from "./plate-sketch/drag-edit-mutations.mjs";
import { EPSILON, add2, dot2, edgePointPair, mul2, platePoint } from "./plate-sketch/sketch-edit-geometry.mjs";

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
  shiftedEdgePoints,
  sketchEntityMaps,
  snappedEdgeDelta,
  snappedFreeSketchPoint,
  snappedNotchSize,
  snappedVertexPoint,
  vertexDragContext,
  vertexSnapCandidates
} from "./plate-sketch/drag-edit-helpers.mjs";

export function createPlateSketchEditController({ viewer, api, snapManager, settings = {}, onProjectChange, onStatusChange, onSelectionChange, requestDimensionInput }) {
  if (typeof requestDimensionInput !== "function") throw new Error("createPlateSketchEditController requires requestDimensionInput");
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

  function target() {
    return activeSketchTarget(api.project(), activePlateId);
  }

  function targetForId(objectId) {
    return activeSketchTarget(api.project(), objectId);
  }

  const {
    addSketchConstructionLine,
    insertSketchVertex,
    notchSketchCorner,
    removeSketchRelation,
    removeSketchVertex,
    setSketchEdgeAngle,
    setSketchEdgeAngleMode,
    setSketchEdgeLength,
    setSketchEdgeLengthMode,
    setSketchPointDistance,
    setSketchPointDistanceMode,
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
    if (!targetForId(objectId)) {
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
      vertexIds: arrayValues(detail.vertexIds).filter(Boolean).slice(0, 2),
      relationId: detail.relationId || null
    };
    emitSelectionChange();
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
        const nextProject = addSketchConstructionLine(handle.plateId, from, to);
        const nextSketch = activePlate(nextProject, handle.plateId)?.sketch;
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
      const updatedPlate = activePlate(api.project(), handle.plateId);
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
