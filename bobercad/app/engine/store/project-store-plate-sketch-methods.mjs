import {
  addPlateSketchConstructionLine as addPlateSketchConstructionLineData,
  fixPlateSketchUnderDefinedEntities as fixPlateSketchUnderDefinedEntitiesData,
  inferPlateSketchRelations as inferPlateSketchRelationsData,
  insertPlateSketchVertex as insertPlateSketchVertexData,
  notchPlateSketchCorner as notchPlateSketchCornerData,
  removePlateSketchFixedRelations as removePlateSketchFixedRelationsData,
  removePlateSketchRelation as removePlateSketchRelationData,
  removePlateBend as removePlateBendData,
  removePlateSketchVertex as removePlateSketchVertexData,
  setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData,
  setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData,
  setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData,
  setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData,
  setPlateSketchPointDistance as setPlateSketchPointDistanceData,
  setSketchVertex as setSketchVertexData,
  setPlateSketchEdgeLength as setPlateSketchEdgeLengthData,
  setPlateSketchVertex as setPlateSketchVertexData,
  setPlateSketchVertices as setPlateSketchVerticesData,
  solvePlateSketchRelation as solvePlateSketchRelationData,
  upsertPlateBend as upsertPlateBendData,
  upsertPlateSketchRelation as upsertPlateSketchRelationData
} from "../api/project/plate-sketch-relations-and-bends.mjs";

export function createPlateSketchStoreMethods({ replacePlate, replaceSketch }) {
  return {
    setPlateSketchVertex(plateId, vertexId, point) {
      return replacePlate(plateId, (plate) => setPlateSketchVertexData(plate, vertexId, point));
    },

    setPlateSketchVertices(plateId, vertexPoints) {
      return replacePlate(plateId, (plate) => setPlateSketchVerticesData(plate, vertexPoints));
    },

    addPlateSketchConstructionLine(plateId, fromPoint, toPoint, options = {}) {
      return replacePlate(plateId, (plate) => addPlateSketchConstructionLineData(plate, fromPoint, toPoint, options));
    },

    setPlateSketchEdgeLength(plateId, edgeId, length, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthData(plate, edgeId, length, options));
    },

    setPlateSketchEdgeLengthMode(plateId, edgeId, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthModeData(plate, edgeId, mode));
    },

    setPlateSketchEdgeAngle(plateId, edgeIds, angle, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeAngleData(plate, edgeIds, angle, options));
    },

    setPlateSketchEdgeAngleMode(plateId, edgeIds, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeAngleModeData(plate, edgeIds, mode));
    },

    setPlateSketchPointDistance(plateId, vertexIds, distance, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchPointDistanceData(plate, vertexIds, distance, options));
    },

    setPlateSketchPointDistanceMode(plateId, vertexIds, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchPointDistanceModeData(plate, vertexIds, mode));
    },

    insertPlateSketchVertex(plateId, edgeId, point, options = {}) {
      let insertedVertexId = null;
      const project = replacePlate(plateId, (plate) => {
        const result = insertPlateSketchVertexData(plate, edgeId, point, options);
        insertedVertexId = result.vertexId;
        return result.plate;
      });
      return { project, vertexId: insertedVertexId };
    },

    removePlateSketchVertex(plateId, vertexId) {
      return replacePlate(plateId, (plate) => removePlateSketchVertexData(plate, vertexId));
    },

    notchPlateSketchCorner(plateId, vertexId, options = {}) {
      let notchVertexIds = [];
      const project = replacePlate(plateId, (plate) => {
        const result = notchPlateSketchCornerData(plate, vertexId, options);
        notchVertexIds = result.vertexIds;
        return result.plate;
      });
      return { project, vertexIds: notchVertexIds };
    },

    removePlateSketchRelation(plateId, relationId) {
      return replacePlate(plateId, (plate) => removePlateSketchRelationData(plate, relationId));
    },

    removePlateSketchFixedRelations(plateId) {
      return replacePlate(plateId, (plate) => removePlateSketchFixedRelationsData(plate));
    },

    solvePlateSketchRelation(plateId, relationId) {
      return replacePlate(plateId, (plate) => solvePlateSketchRelationData(plate, relationId));
    },

    upsertPlateSketchRelation(plateId, relation) {
      return replacePlate(plateId, (plate) => upsertPlateSketchRelationData(plate, relation));
    },

    fixPlateSketchUnderDefinedEntities(plateId, options = {}) {
      return replacePlate(plateId, (plate) => fixPlateSketchUnderDefinedEntitiesData(plate, options));
    },

    inferPlateSketchRelations(plateId) {
      return replacePlate(plateId, (plate) => inferPlateSketchRelationsData(plate));
    },

    setSketchVertex(sketchId, vertexId, point) {
      return replaceSketch(sketchId, (sketch) => setSketchVertexData(sketch, vertexId, point));
    },

    upsertPlateBend(plateId, bend) {
      return replacePlate(plateId, (plate) => upsertPlateBendData(plate, bend));
    },

    removePlateBend(plateId, bendId) {
      return replacePlate(plateId, (plate) => removePlateBendData(plate, bendId));
    },
  };
}
