import {
  addPlateSketchConstructionLine as addPlateSketchConstructionLineData,
  insertPlateSketchVertex as insertPlateSketchVertexData,
  notchPlateSketchCorner as notchPlateSketchCornerData,
  removePlateSketchRelation as removePlateSketchRelationData,
  removePlateSketchVertex as removePlateSketchVertexData,
  setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData,
  setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData,
  setPlateSketchEdgeLength as setPlateSketchEdgeLengthData,
  setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData,
  setPlateSketchPointDistance as setPlateSketchPointDistanceData,
  setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData,
  setPlateSketchVertex as setPlateSketchVertexData,
  setPlateSketchVertices as setPlateSketchVerticesData,
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
    return api.setPlateSketchVertex(objectId, vertexId, point);
  }

  function setSketchVertices(objectId, vertexPoints) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchVerticesData(currentPlate, vertexPoints));
    }
    return api.setPlateSketchVertices(objectId, vertexPoints);
  }

  function addSketchConstructionLine(objectId, fromPoint, toPoint, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => addPlateSketchConstructionLineData(currentPlate, fromPoint, toPoint, options));
    }
    return api.addPlateSketchConstructionLine(objectId, fromPoint, toPoint, options);
  }

  function setSketchEdgeLength(objectId, edgeId, length, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeLengthData(currentPlate, edgeId, length, options));
    }
    return api.setPlateSketchEdgeLength(objectId, edgeId, length, options);
  }

  function setSketchEdgeLengthMode(objectId, edgeId, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeLengthModeData(currentPlate, edgeId, mode));
    }
    return api.setPlateSketchEdgeLengthMode(objectId, edgeId, mode);
  }

  function setSketchEdgeAngle(objectId, edgeIds, angle, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeAngleData(currentPlate, edgeIds, angle, options));
    }
    return api.setPlateSketchEdgeAngle(objectId, edgeIds, angle, options);
  }

  function setSketchEdgeAngleMode(objectId, edgeIds, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchEdgeAngleModeData(currentPlate, edgeIds, mode));
    }
    return api.setPlateSketchEdgeAngleMode(objectId, edgeIds, mode);
  }

  function setSketchPointDistance(objectId, vertexIds, distance, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchPointDistanceData(currentPlate, vertexIds, distance, options));
    }
    return api.setPlateSketchPointDistance(objectId, vertexIds, distance, options);
  }

  function setSketchPointDistanceMode(objectId, vertexIds, mode) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => setPlateSketchPointDistanceModeData(currentPlate, vertexIds, mode));
    }
    return api.setPlateSketchPointDistanceMode(objectId, vertexIds, mode);
  }

  function insertSketchVertex(objectId, edgeId, point, options = {}) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketchResult(currentTarget, (currentPlate) => insertPlateSketchVertexData(currentPlate, edgeId, point, options));
    }
    return api.insertPlateSketchVertex(objectId, edgeId, point, options);
  }

  function removeSketchVertex(objectId, vertexId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => removePlateSketchVertexData(currentPlate, vertexId));
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

  function removeSketchRelation(objectId, relationId) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => removePlateSketchRelationData(currentPlate, relationId));
    }
    return api.removePlateSketchRelation(objectId, relationId);
  }

  function upsertSketchRelation(objectId, relation) {
    const currentTarget = targetForId(objectId);
    if (!currentTarget) throw new Error(`plate sketch editor: sketch target not found: ${objectId}`);
    if (currentTarget.collection === "features") {
      return updateFeatureSketch(currentTarget, (currentPlate) => upsertPlateSketchRelationData(currentPlate, relation));
    }
    return api.upsertPlateSketchRelation(objectId, relation);
  }


  return {
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
  };
}
