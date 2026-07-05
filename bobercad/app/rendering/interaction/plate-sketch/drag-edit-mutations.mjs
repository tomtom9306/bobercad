import {
  addPlateSketchConstructionArc as addPlateSketchConstructionArcData,
  addPlateSketchConstructionLine as addPlateSketchConstructionLineData,
  flipPlateSketchEdgeArc as flipPlateSketchEdgeArcData,
  filletPlateSketchCorner as filletPlateSketchCornerData,
  inferPlateSketchRelations as inferPlateSketchRelationsData,
  insertPlateSketchVertex as insertPlateSketchVertexData,
  notchPlateSketchCorner as notchPlateSketchCornerData,
  removePlateSketchConstructionLine as removePlateSketchConstructionLineData,
  removePlateSketchRelation as removePlateSketchRelationData,
  removePlateSketchVertex as removePlateSketchVertexData,
  setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData,
  setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData,
  setPlateSketchEdgeArc as setPlateSketchEdgeArcData,
  setPlateSketchEdgeLength as setPlateSketchEdgeLengthData,
  setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData,
  setPlateSketchEdgeRadius as setPlateSketchEdgeRadiusData,
  setPlateSketchEdgeRadiusMode as setPlateSketchEdgeRadiusModeData,
  setPlateSketchCenterRectangle as setPlateSketchCenterRectangleData,
  setPlateSketchPointDistance as setPlateSketchPointDistanceData,
  setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData,
  setPlateSketchThreePointArc as setPlateSketchThreePointArcData,
  setPlateSketchVertex as setPlateSketchVertexData,
  setPlateSketchVertices as setPlateSketchVerticesData,
  splitPlateSketchEdgeArc as splitPlateSketchEdgeArcData,
  upsertPlateSketchRelation as upsertPlateSketchRelationData
} from '../../../engine/api/project/plate-sketch-relations-and-bends.mjs';
import { featureBodySketchPatch } from './drag-edit-targets.mjs';

export function createPlateSketchMutationApi({ api, targetForId }) {
  if (!api || typeof targetForId !== 'function') throw new Error('plate sketch mutations require api and targetForId');
  function updateFeatureSketch(featureTarget, updater) {
    const nextPlate = updater(featureTarget.plate);
    const patch = featureBodySketchPatch(featureTarget.feature, nextPlate);
    return api.setFeatureBody(featureTarget.id, patch);
  }

  function updateFeatureSketchResult(featureTarget, updater) {
    const result = updater(featureTarget.plate);
    return {
      ...result,
      project: api.setFeatureBody(featureTarget.id, featureBodySketchPatch(featureTarget.feature, result.plate))
    };
  }

  function updateSketchCenter(objectId, center) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") return api.setFeatureBody(objectId, { center });
    return api.updatePlate(objectId, { center });
  }

  function setSketchVertex(objectId, vertexId, point) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchVertexData(currentPlate, vertexId, point));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchVertex(objectId, vertexId, point);
    }
    return api.setPlateSketchVertex(objectId, vertexId, point);
  }

  function setSketchVertices(objectId, vertexPoints) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchVerticesData(currentPlate, vertexPoints));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchVertices(objectId, vertexPoints);
    }
    return api.setPlateSketchVertices(objectId, vertexPoints);
  }

  function setSketchCircle(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("circle sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchCircle(objectId, options);
    }
    return api.setPlateSketchCircle(objectId, options);
  }

  function setSketchOutline(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("line contour sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchOutline(objectId, options);
    }
    return api.setPlateSketchOutline(objectId, options);
  }

  function setSketchCenterRectangle(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("center rectangle sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchCenterRectangle(objectId, options);
    }
    return api.setPlateSketchCenterRectangle(objectId, options);
  }

  function setSketchRoundedRectangle(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("rounded rectangle sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchRoundedRectangle(objectId, options);
    }
    return api.setPlateSketchRoundedRectangle(objectId, options);
  }

  function setSketchSlot(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("slot sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchSlot(objectId, options);
    }
    return api.setPlateSketchSlot(objectId, options);
  }

  function setSketchCenterArc(objectId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      throw new Error("center arc sketch replacement is not supported for cutting-body feature sketches yet");
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchCenterArc(objectId, options);
    }
    return api.setPlateSketchCenterArc(objectId, options);
  }

  function setSketchEdgeArc(objectId, edgeId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeArcData(currentPlate, edgeId, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeArc(objectId, edgeId, options);
    }
    return api.setPlateSketchEdgeArc(objectId, edgeId, options);
  }

  function flipSketchEdgeArc(objectId, edgeId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => flipPlateSketchEdgeArcData(currentPlate, edgeId));
    }
    if (currentTarget.collection === "sketches") {
      return api.flipSketchEdgeArc(objectId, edgeId);
    }
    return api.flipPlateSketchEdgeArc(objectId, edgeId);
  }

  function splitSketchArc(objectId, edgeId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => splitPlateSketchEdgeArcData(currentPlate, edgeId, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.splitSketchEdgeArc(objectId, edgeId, options);
    }
    return api.splitPlateSketchEdgeArc(objectId, edgeId, options);
  }

  function setSketchThreePointArc(objectId, vertexIds, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => setPlateSketchThreePointArcData(currentPlate, vertexIds, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchThreePointArc(objectId, vertexIds, options);
    }
    return api.setPlateSketchThreePointArc(objectId, vertexIds, options);
  }

  function addSketchConstructionLine(objectId, fromPoint, toPoint, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => addPlateSketchConstructionLineData(currentPlate, fromPoint, toPoint, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.addSketchConstructionLine(objectId, fromPoint, toPoint, options);
    }
    return api.addPlateSketchConstructionLine(objectId, fromPoint, toPoint, options);
  }

  function addSketchConstructionArc(objectId, centerPoint, startPoint, endPoint, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => addPlateSketchConstructionArcData(currentPlate, centerPoint, startPoint, endPoint, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.addSketchConstructionArc(objectId, centerPoint, startPoint, endPoint, options);
    }
    return api.addPlateSketchConstructionArc(objectId, centerPoint, startPoint, endPoint, options);
  }

  function removeSketchConstructionLine(objectId, edgeId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => removePlateSketchConstructionLineData(currentPlate, edgeId));
    }
    if (currentTarget.collection === "sketches") {
      return api.removeSketchConstructionLine(objectId, edgeId);
    }
    return api.removePlateSketchConstructionLine(objectId, edgeId);
  }

  function setSketchEdgeLength(objectId, edgeId, length, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeLengthData(currentPlate, edgeId, length, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeLength(objectId, edgeId, length, options);
    }
    return api.setPlateSketchEdgeLength(objectId, edgeId, length, options);
  }

  function setSketchEdgeLengthMode(objectId, edgeId, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeLengthModeData(currentPlate, edgeId, mode));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeLengthMode(objectId, edgeId, mode);
    }
    return api.setPlateSketchEdgeLengthMode(objectId, edgeId, mode);
  }

  function setSketchEdgeRadius(objectId, edgeId, radius, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeRadiusData(currentPlate, edgeId, radius, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeRadius(objectId, edgeId, radius, options);
    }
    return api.setPlateSketchEdgeRadius(objectId, edgeId, radius, options);
  }

  function setSketchEdgeRadiusMode(objectId, edgeId, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeRadiusModeData(currentPlate, edgeId, mode));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeRadiusMode(objectId, edgeId, mode);
    }
    return api.setPlateSketchEdgeRadiusMode(objectId, edgeId, mode);
  }

  function setSketchEdgeAngle(objectId, edgeIds, angle, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeAngleData(currentPlate, edgeIds, angle, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeAngle(objectId, edgeIds, angle, options);
    }
    return api.setPlateSketchEdgeAngle(objectId, edgeIds, angle, options);
  }

  function setSketchEdgeAngleMode(objectId, edgeIds, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeAngleModeData(currentPlate, edgeIds, mode));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchEdgeAngleMode(objectId, edgeIds, mode);
    }
    return api.setPlateSketchEdgeAngleMode(objectId, edgeIds, mode);
  }

  function setSketchPointDistance(objectId, vertexIds, distance, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchPointDistanceData(currentPlate, vertexIds, distance, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchPointDistance(objectId, vertexIds, distance, options);
    }
    return api.setPlateSketchPointDistance(objectId, vertexIds, distance, options);
  }

  function setSketchPointDistanceMode(objectId, vertexIds, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchPointDistanceModeData(currentPlate, vertexIds, mode));
    }
    if (currentTarget.collection === "sketches") {
      return api.setSketchPointDistanceMode(objectId, vertexIds, mode);
    }
    return api.setPlateSketchPointDistanceMode(objectId, vertexIds, mode);
  }

  function insertSketchVertex(objectId, edgeId, point, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => insertPlateSketchVertexData(currentPlate, edgeId, point, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.insertSketchVertex(objectId, edgeId, point, options);
    }
    return api.insertPlateSketchVertex(objectId, edgeId, point, options);
  }

  function removeSketchVertex(objectId, vertexId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => removePlateSketchVertexData(currentPlate, vertexId));
    }
    if (currentTarget.collection === "sketches") {
      return api.removeSketchVertex(objectId, vertexId);
    }
    return api.removePlateSketchVertex(objectId, vertexId);
  }

  function notchSketchCorner(objectId, vertexId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => notchPlateSketchCornerData(currentPlate, vertexId, options));
    }
    return api.notchPlateSketchCorner(objectId, vertexId, options);
  }

  function filletSketchCorner(objectId, vertexId, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => filletPlateSketchCornerData(currentPlate, vertexId, options));
    }
    if (currentTarget.collection === "sketches") {
      return api.filletSketchCorner(objectId, vertexId, options);
    }
    return api.filletPlateSketchCorner(objectId, vertexId, options);
  }

  function inferSketchRelations(objectId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => inferPlateSketchRelationsData(currentPlate));
    }
    if (currentTarget.collection === "sketches") {
      return api.inferSketchRelations(objectId);
    }
    return api.inferPlateSketchRelations(objectId);
  }

  function removeSketchRelation(objectId, relationId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => removePlateSketchRelationData(currentPlate, relationId));
    }
    if (currentTarget.collection === "sketches") {
      return api.removeSketchRelation(objectId, relationId);
    }
    return api.removePlateSketchRelation(objectId, relationId);
  }

  function upsertSketchRelation(objectId, relation) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => upsertPlateSketchRelationData(currentPlate, relation));
    }
    if (currentTarget.collection === "sketches") {
      return api.upsertSketchRelation(objectId, relation);
    }
    return api.upsertPlateSketchRelation(objectId, relation);
  }


  return {
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
    setSketchCircle,
    setSketchOutline,
    setSketchCenterRectangle,
    setSketchRoundedRectangle,
    setSketchSlot,
    setSketchCenterArc,
    setSketchThreePointArc,
    splitSketchArc,
    setSketchPointDistance,
    setSketchPointDistanceMode,
    setSketchVertex,
    setSketchVertices,
    updateSketchCenter,
    upsertSketchRelation
  };
}
