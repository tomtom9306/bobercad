import {
  sketchAngleRelationMode,
  sketchDistanceRelationMode,
  sketchLengthRelationMode,
  sketchRelationEdgeIds,
  sketchRelationVertexIds,
  sketchRelations,
  sketchRelationsForEdge
} from '../../../engine/api/project/plate-sketch-relations-and-bends.mjs';
import { EPSILON } from './sketch-edit-geometry.mjs';
import { activePlate } from './drag-edit-targets.mjs';
import { formatDeg, formatMm } from './drag-edit-geometry.mjs';

export function createPlateSketchDimensionActions({
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
  setActiveSnap,
  setDrag,
  dimensionPlacementOffsets
}) {
  function requestEdgeLength(handle) {
    const currentLength = Number.isFinite(handle.length) ? handle.length : null;
    const promptText = currentLength === null
      ? "Edge length mm"
      : `Edge length mm (${formatMm(currentLength)})`;
    const raw = requestDimensionInput({
      kind: "edge-length",
      plateId: handle.plateId,
      edgeId: handle.edgeId,
      promptText,
      currentValue: currentLength,
      defaultValue: currentLength === null ? "" : String(Math.round(currentLength * 1000) / 1000)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON ? parsed : null;
  }

  function requestEdgeAngle(handle) {
    const currentAngle = Number.isFinite(handle.angle) ? handle.angle : null;
    const promptText = currentAngle === null
      ? "Edge angle degrees"
      : `Edge angle degrees (${formatDeg(currentAngle)})`;
    const raw = requestDimensionInput({
      kind: "edge-angle",
      plateId: handle.plateId,
      edgeId: handle.edgeId,
      promptText,
      currentValue: currentAngle,
      defaultValue: currentAngle === null ? "" : String(Math.round(currentAngle * 1000) / 1000)
    });
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(parsed) && parsed > EPSILON && parsed < 180 - EPSILON ? parsed : null;
  }

  function requestPointDistance(handle) {
    const currentDistance = Number.isFinite(handle.distance) ? handle.distance : null;
    const promptText = currentDistance === null
      ? "Point distance mm"
      : `Point distance mm (${formatMm(currentDistance)})`;
    const raw = requestDimensionInput({
      kind: "point-distance",
      plateId: handle.plateId,
      vertexIds: handle.vertexIds || [],
      promptText,
      currentValue: currentDistance,
      defaultValue: currentDistance === null ? "" : String(Math.round(currentDistance * 1000) / 1000)
    });
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
      const nextProject = setSketchEdgeLength(handle.plateId, handle.edgeId, length, { mode: "driving" });
      const nextPlate = activePlate(nextProject, handle.plateId);
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
    setActiveSnap(null);
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
      const nextProject = setSketchEdgeAngle(handle.plateId, handle.edgeIds, angle, {
        mode: "driving",
        targetEdgeId: handle.targetEdgeId || handle.edgeIds?.[1]
      });
      const nextPlate = activePlate(nextProject, handle.plateId);
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
    setActiveSnap(null);
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
      const nextProject = setSketchPointDistance(handle.plateId, handle.vertexIds, distance, {
        mode: "driving",
        targetVertexId: handle.targetVertexId || handle.vertexIds?.[1]
      });
      const nextPlate = activePlate(nextProject, handle.plateId);
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
    setActiveSnap(null);
    renderOverlay();
    return true;
  }

  function applyDimensionHandle(handle, event, editDimension) {
    const doubleClick = (event?.detail || 0) >= 2;
    if (handle.relationId && !doubleClick) {
      selectRelation(handle.relationId);
      onStatusChange?.("Plate sketch: selected dimension relation; double-click to edit value");
      setActiveSnap(null);
      renderOverlay();
      return true;
    }
    return editDimension(handle);
  }

  function dimensionRelationFromProject(project, handle) {
    const sketch = activePlate(project, handle.plateId)?.sketch;
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
        nextProject = setSketchEdgeLengthMode(handle.plateId, handle.edgeId, nextMode);
      } else if (handle.dimensionType === "angle") {
        nextProject = setSketchEdgeAngleMode(handle.plateId, handle.edgeIds, nextMode);
      } else if (handle.dimensionType === "distance") {
        nextProject = setSketchPointDistanceMode(handle.plateId, handle.vertexIds, nextMode);
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
    setActiveSnap(null);
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
      setDrag(null);
      return applyDimensionHandleForKind(handle, event);
    }
    setDrag({
      kind: "dimensionPlacement",
      handle,
      plateId: handle.plateId,
      placementKey: handle.dimensionPlacementKey || handle.dimensionId || handle.target,
      baseOffset: dimensionPlacementOffsets.get(handle.dimensionPlacementKey || handle.dimensionId || handle.target) || 0,
      normal: Array.isArray(handle.dimensionLocalNormal) ? handle.dimensionLocalNormal : [0, 1],
      moved: false
    });
    setActiveSnap(null);
    onStatusChange?.("Plate sketch: drag dimension to organize it; click without moving to select it");
    return true;
  }


  return {
    applyDimensionHandleForKind,
    applyDimensionModeToggle,
    beginDimensionPlacementDrag,
    requestEdgeAngle,
    requestPointDistance
  };
}
