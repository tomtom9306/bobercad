import {
  addPlateSketchConstructionArc as addPlateSketchConstructionArcData,
  addPlateSketchConstructionLine as addPlateSketchConstructionLineData,
  addSketchConstructionArc as addSketchConstructionArcData,
  addSketchConstructionLine as addSketchConstructionLineData,
  flipPlateSketchEdgeArc as flipPlateSketchEdgeArcData,
  flipSketchEdgeArc as flipSketchEdgeArcData,
  filletPlateSketchCorner as filletPlateSketchCornerData,
  filletSketchCorner as filletSketchCornerData,
  fixPlateSketchUnderDefinedEntities as fixPlateSketchUnderDefinedEntitiesData,
  inferPlateSketchRelations as inferPlateSketchRelationsData,
  inferSketchRelationsForHost as inferSketchRelationsData,
  insertPlateSketchVertex as insertPlateSketchVertexData,
  insertSketchVertex as insertSketchVertexData,
  notchPlateSketchCorner as notchPlateSketchCornerData,
  removePlateSketchFixedRelations as removePlateSketchFixedRelationsData,
  removePlateSketchRelation as removePlateSketchRelationData,
  removeSketchRelation as removeSketchRelationData,
  removePlateBend as removePlateBendData,
  removePlateSketchConstructionLine as removePlateSketchConstructionLineData,
  removePlateSketchVertex as removePlateSketchVertexData,
  removeSketchConstructionLine as removeSketchConstructionLineData,
  removeSketchVertex as removeSketchVertexData,
  setPlateSketchCenterArc as setPlateSketchCenterArcData,
  setPlateSketchCenterRectangle as setPlateSketchCenterRectangleData,
  setPlateSketchCircle as setPlateSketchCircleData,
  setPlateSketchEdgeArc as setPlateSketchEdgeArcData,
  setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData,
  setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData,
  setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData,
  setPlateSketchEdgeRadius as setPlateSketchEdgeRadiusData,
  setPlateSketchEdgeRadiusMode as setPlateSketchEdgeRadiusModeData,
  setPlateSketchOutline as setPlateSketchOutlineData,
  setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData,
  setPlateSketchPointDistance as setPlateSketchPointDistanceData,
  setPlateSketchRoundedRectangle as setPlateSketchRoundedRectangleData,
  setPlateSketchSlot as setPlateSketchSlotData,
  setPlateSketchThreePointArc as setPlateSketchThreePointArcData,
  setSketchCenterArc as setSketchCenterArcData,
  setSketchCenterRectangle as setSketchCenterRectangleData,
  setSketchCircle as setSketchCircleData,
  setSketchEdgeAngle as setSketchEdgeAngleData,
  setSketchEdgeAngleMode as setSketchEdgeAngleModeData,
  setSketchEdgeArc as setSketchEdgeArcData,
  setSketchEdgeLength as setSketchEdgeLengthData,
  setSketchEdgeLengthMode as setSketchEdgeLengthModeData,
  setSketchEdgeRadius as setSketchEdgeRadiusData,
  setSketchEdgeRadiusMode as setSketchEdgeRadiusModeData,
  setSketchOutline as setSketchOutlineData,
  setSketchPointDistance as setSketchPointDistanceData,
  setSketchPointDistanceMode as setSketchPointDistanceModeData,
  setSketchRoundedRectangle as setSketchRoundedRectangleData,
  setSketchSlot as setSketchSlotData,
  setSketchThreePointArc as setSketchThreePointArcData,
  splitPlateSketchEdgeArc as splitPlateSketchEdgeArcData,
  splitSketchEdgeArc as splitSketchEdgeArcData,
  setSketchVertex as setSketchVertexData,
  setSketchVertices as setSketchVerticesData,
  normalizeSketchObject as normalizeSketchObjectData,
  setPlateSketchEdgeLength as setPlateSketchEdgeLengthData,
  setPlateSketchVertex as setPlateSketchVertexData,
  setPlateSketchVertices as setPlateSketchVerticesData,
  solvePlateSketchRelation as solvePlateSketchRelationData,
  upsertPlateBend as upsertPlateBendData,
  upsertPlateSketchRelation as upsertPlateSketchRelationData,
  upsertSketchRelation as upsertSketchRelationData
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

    addSketchConstructionLine(sketchId, fromPoint, toPoint, options = {}) {
      return replaceSketch(sketchId, (sketch) => addSketchConstructionLineData(sketch, fromPoint, toPoint, options));
    },

    addPlateSketchConstructionArc(plateId, centerPoint, startPoint, endPoint, options = {}) {
      return replacePlate(plateId, (plate) => addPlateSketchConstructionArcData(plate, centerPoint, startPoint, endPoint, options));
    },

    addSketchConstructionArc(sketchId, centerPoint, startPoint, endPoint, options = {}) {
      return replaceSketch(sketchId, (sketch) => addSketchConstructionArcData(sketch, centerPoint, startPoint, endPoint, options));
    },

    removePlateSketchConstructionLine(plateId, edgeId) {
      return replacePlate(plateId, (plate) => removePlateSketchConstructionLineData(plate, edgeId));
    },

    removeSketchConstructionLine(sketchId, edgeId) {
      return replaceSketch(sketchId, (sketch) => removeSketchConstructionLineData(sketch, edgeId));
    },

    setPlateSketchEdgeLength(plateId, edgeId, length, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthData(plate, edgeId, length, options));
    },

    setPlateSketchEdgeLengthMode(plateId, edgeId, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeLengthModeData(plate, edgeId, mode));
    },

    setPlateSketchEdgeRadius(plateId, edgeId, radius, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeRadiusData(plate, edgeId, radius, options));
    },

    setPlateSketchEdgeRadiusMode(plateId, edgeId, mode) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeRadiusModeData(plate, edgeId, mode));
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

    insertSketchVertex(sketchId, edgeId, point, options = {}) {
      let insertedVertexId = null;
      const project = replaceSketch(sketchId, (sketch) => {
        const result = insertSketchVertexData(sketch, edgeId, point, options);
        insertedVertexId = result.vertexId;
        return result.sketch;
      });
      return { project, vertexId: insertedVertexId };
    },

    removePlateSketchVertex(plateId, vertexId) {
      return replacePlate(plateId, (plate) => removePlateSketchVertexData(plate, vertexId));
    },

    removeSketchVertex(sketchId, vertexId) {
      return replaceSketch(sketchId, (sketch) => removeSketchVertexData(sketch, vertexId));
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

    filletPlateSketchCorner(plateId, vertexId, options = {}) {
      let filletVertexIds = [];
      let filletEdgeId = null;
      const project = replacePlate(plateId, (plate) => {
        const result = filletPlateSketchCornerData(plate, vertexId, options);
        filletVertexIds = result.vertexIds;
        filletEdgeId = result.edgeId;
        return result.plate;
      });
      return { project, vertexIds: filletVertexIds, edgeId: filletEdgeId };
    },

    filletSketchCorner(sketchId, vertexId, options = {}) {
      let filletVertexIds = [];
      let filletEdgeId = null;
      const project = replaceSketch(sketchId, (sketch) => {
        const result = filletSketchCornerData(sketch, vertexId, options);
        filletVertexIds = result.vertexIds;
        filletEdgeId = result.edgeId;
        return result.sketch;
      });
      return { project, vertexIds: filletVertexIds, edgeId: filletEdgeId };
    },

    setPlateSketchCircle(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchCircleData(plate, options));
    },

    setPlateSketchOutline(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchOutlineData(plate, options));
    },

    setPlateSketchCenterRectangle(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchCenterRectangleData(plate, options));
    },

    setPlateSketchRoundedRectangle(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchRoundedRectangleData(plate, options));
    },

    setPlateSketchSlot(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchSlotData(plate, options));
    },

    setPlateSketchCenterArc(plateId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchCenterArcData(plate, options));
    },

    setPlateSketchEdgeArc(plateId, edgeId, options = {}) {
      return replacePlate(plateId, (plate) => setPlateSketchEdgeArcData(plate, edgeId, options));
    },

    flipPlateSketchEdgeArc(plateId, edgeId) {
      return replacePlate(plateId, (plate) => flipPlateSketchEdgeArcData(plate, edgeId));
    },

    splitPlateSketchEdgeArc(plateId, edgeId, options = {}) {
      let vertexId = null;
      let edgeIds = [];
      const project = replacePlate(plateId, (plate) => {
        const result = splitPlateSketchEdgeArcData(plate, edgeId, options);
        vertexId = result.vertexId;
        edgeIds = result.edgeIds;
        return result.plate;
      });
      return { project, vertexId, edgeIds };
    },

    setPlateSketchThreePointArc(plateId, vertexIds, options = {}) {
      let arcEdgeId = null;
      const project = replacePlate(plateId, (plate) => {
        const result = setPlateSketchThreePointArcData(plate, vertexIds, options);
        arcEdgeId = result.edgeId;
        return result.plate;
      });
      return { project, edgeId: arcEdgeId };
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

    upsertSketchRelation(sketchId, relation) {
      return replaceSketch(sketchId, (sketch) => upsertSketchRelationData(sketch, relation));
    },

    fixPlateSketchUnderDefinedEntities(plateId, options = {}) {
      return replacePlate(plateId, (plate) => fixPlateSketchUnderDefinedEntitiesData(plate, options));
    },

    inferPlateSketchRelations(plateId) {
      return replacePlate(plateId, (plate) => inferPlateSketchRelationsData(plate));
    },

    inferSketchRelations(sketchId) {
      return replaceSketch(sketchId, (sketch) => inferSketchRelationsData(sketch, normalizeSketchObjectData));
    },

    setSketchVertex(sketchId, vertexId, point) {
      return replaceSketch(sketchId, (sketch) => setSketchVertexData(sketch, vertexId, point));
    },

    setSketchVertices(sketchId, vertexPoints) {
      return replaceSketch(sketchId, (sketch) => setSketchVerticesData(sketch, vertexPoints));
    },

    setSketchCircle(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchCircleData(sketch, options));
    },

    setSketchOutline(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchOutlineData(sketch, options));
    },

    setSketchCenterRectangle(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchCenterRectangleData(sketch, options));
    },

    setSketchRoundedRectangle(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchRoundedRectangleData(sketch, options));
    },

    setSketchSlot(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchSlotData(sketch, options));
    },

    setSketchCenterArc(sketchId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchCenterArcData(sketch, options));
    },

    setSketchEdgeArc(sketchId, edgeId, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeArcData(sketch, edgeId, options));
    },

    flipSketchEdgeArc(sketchId, edgeId) {
      return replaceSketch(sketchId, (sketch) => flipSketchEdgeArcData(sketch, edgeId));
    },

    splitSketchEdgeArc(sketchId, edgeId, options = {}) {
      let vertexId = null;
      let edgeIds = [];
      const project = replaceSketch(sketchId, (sketch) => {
        const result = splitSketchEdgeArcData(sketch, edgeId, options);
        vertexId = result.vertexId;
        edgeIds = result.edgeIds;
        return result.sketch;
      });
      return { project, vertexId, edgeIds };
    },

    setSketchThreePointArc(sketchId, vertexIds, options = {}) {
      let arcEdgeId = null;
      const project = replaceSketch(sketchId, (sketch) => {
        const result = setSketchThreePointArcData(sketch, vertexIds, options);
        arcEdgeId = result.edgeId;
        return result.sketch;
      });
      return { project, edgeId: arcEdgeId };
    },

    setSketchEdgeRadius(sketchId, edgeId, radius, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeRadiusData(sketch, edgeId, radius, options));
    },

    setSketchEdgeRadiusMode(sketchId, edgeId, mode) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeRadiusModeData(sketch, edgeId, mode));
    },

    setSketchEdgeAngle(sketchId, edgeIds, angle, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeAngleData(sketch, edgeIds, angle, options));
    },

    setSketchEdgeAngleMode(sketchId, edgeIds, mode) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeAngleModeData(sketch, edgeIds, mode));
    },

    setSketchEdgeLength(sketchId, edgeId, length, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeLengthData(sketch, edgeId, length, options));
    },

    setSketchEdgeLengthMode(sketchId, edgeId, mode) {
      return replaceSketch(sketchId, (sketch) => setSketchEdgeLengthModeData(sketch, edgeId, mode));
    },

    setSketchPointDistance(sketchId, vertexIds, distance, options = {}) {
      return replaceSketch(sketchId, (sketch) => setSketchPointDistanceData(sketch, vertexIds, distance, options));
    },

    setSketchPointDistanceMode(sketchId, vertexIds, mode) {
      return replaceSketch(sketchId, (sketch) => setSketchPointDistanceModeData(sketch, vertexIds, mode));
    },

    removeSketchRelation(sketchId, relationId) {
      return replaceSketch(sketchId, (sketch) => removeSketchRelationData(sketch, relationId));
    },

    upsertPlateBend(plateId, bend) {
      return replacePlate(plateId, (plate) => upsertPlateBendData(plate, bend));
    },

    removePlateBend(plateId, bendId) {
      return replacePlate(plateId, (plate) => removePlateBendData(plate, bendId));
    },
  };
}
