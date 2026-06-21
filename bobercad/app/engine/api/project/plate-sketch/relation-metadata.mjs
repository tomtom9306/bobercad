import { arrayValues } from "../../../core/model.mjs";

export const SKETCH_RELATION_TYPES = new Set(["horizontal", "vertical", "horizontal-points", "vertical-points", "coincident", "point-on-line", "midpoint", "symmetric", "perpendicular", "parallel", "collinear", "equal-length", "fixed", "length", "angle", "distance"]);
export const SKETCH_DIMENSION_RELATION_MODES = new Set(["driving", "driven"]);

export function sketchRelationKey(relation) {
  if (relation?.type === "horizontal" || relation?.type === "vertical") return `${relation.type}|${relation.edgeId}`;
  if (relation?.type === "horizontal-points" || relation?.type === "vertical-points" || relation?.type === "coincident" || relation?.type === "distance") return `${relation.type}|${arrayValues(relation.vertexIds).sort().join("|")}`;
  if (relation?.type === "point-on-line" || relation?.type === "midpoint") return `${relation.type}|${relation.vertexId}|${relation.edgeId}`;
  if (relation?.type === "symmetric") return `${relation.type}|${arrayValues(relation.vertexIds).sort().join("|")}|${relation.edgeId}`;
  if (relation?.type === "length") return `${relation.type}|${relation.edgeId}`;
  if (relation?.type === "angle") return `${relation.type}|${arrayValues(relation.edgeIds).sort().join("|")}`;
  if (relation?.type === "fixed") return `${relation.type}|${relation.vertexId !== undefined ? relation.vertexId : relation.edgeId}`;
  if (relation?.type === "perpendicular" || relation?.type === "parallel" || relation?.type === "collinear" || relation?.type === "equal-length") {
    return `${relation.type}|${arrayValues(relation.edgeIds).sort().join("|")}`;
  }
  return `${relation?.type || ""}|${relation?.id || ""}`;
}

export function sketchRelationEdgeIds(relation) {
  if (!relation) return [];
  if (relation.edgeId) return [relation.edgeId];
  return arrayValues(relation.edgeIds);
}

export function sketchRelationVertexIds(relation) {
  return relation?.vertexId ? [relation.vertexId] : arrayValues(relation?.vertexIds);
}

export function sketchRelationLabel(relation) {
  if (!relation) return "Relation";
  if (relation.type === "horizontal") return "Horizontal";
  if (relation.type === "vertical") return "Vertical";
  if (relation.type === "horizontal-points") return "Horizontal points";
  if (relation.type === "vertical-points") return "Vertical points";
  if (relation.type === "coincident") return "Coincident";
  if (relation.type === "point-on-line") return "Point on line";
  if (relation.type === "midpoint") return "Midpoint";
  if (relation.type === "symmetric") return "Symmetric";
  if (relation.type === "perpendicular") return "Perpendicular";
  if (relation.type === "parallel") return "Parallel";
  if (relation.type === "collinear") return "Collinear";
  if (relation.type === "equal-length") return "Equal length";
  if (relation.type === "length") return "Length";
  if (relation.type === "angle") return "Angle";
  if (relation.type === "distance") return "Distance";
  if (relation.type === "fixed") return "Fixed";
  return relation.label || relation.type || "Relation";
}

export function sketchDimensionRelationMode(relation) {
  if (relation?.type !== "length" && relation?.type !== "angle" && relation?.type !== "distance") return null;
  return SKETCH_DIMENSION_RELATION_MODES.has(relation.mode) ? relation.mode : "driving";
}

export function sketchLengthRelationMode(relation) {
  if (relation?.type !== "length") return null;
  return sketchDimensionRelationMode(relation);
}

export function sketchAngleRelationMode(relation) {
  if (relation?.type !== "angle") return null;
  return sketchDimensionRelationMode(relation);
}

export function sketchDistanceRelationMode(relation) {
  if (relation?.type !== "distance") return null;
  return sketchDimensionRelationMode(relation);
}

export function isSketchLengthRelationDriven(relation) {
  return relation?.type === "length" && sketchLengthRelationMode(relation) === "driven";
}

export function isSketchAngleRelationDriven(relation) {
  return relation?.type === "angle" && sketchAngleRelationMode(relation) === "driven";
}

export function isSketchDistanceRelationDriven(relation) {
  return relation?.type === "distance" && sketchDistanceRelationMode(relation) === "driven";
}

export function isDrivingLengthRelation(relation) {
  return relation?.type === "length" && sketchLengthRelationMode(relation) === "driving";
}

export function isDrivingAngleRelation(relation) {
  return relation?.type === "angle" && sketchAngleRelationMode(relation) === "driving";
}

export function isDrivingDistanceRelation(relation) {
  return relation?.type === "distance" && sketchDistanceRelationMode(relation) === "driving";
}

export function isDrivingDimensionRelation(relation) {
  return isDrivingLengthRelation(relation) || isDrivingAngleRelation(relation) || isDrivingDistanceRelation(relation);
}

export function sketchRelationBadge(relation) {
  if (relation?.type === "horizontal") return "H";
  if (relation?.type === "vertical") return "V";
  if (relation?.type === "horizontal-points") return "H";
  if (relation?.type === "vertical-points") return "V";
  if (relation?.type === "coincident") return "CO";
  if (relation?.type === "point-on-line") return "ON";
  if (relation?.type === "midpoint") return "MID";
  if (relation?.type === "symmetric") return "SYM";
  if (relation?.type === "perpendicular") return "PERP";
  if (relation?.type === "parallel") return "PAR";
  if (relation?.type === "collinear") return "COL";
  if (relation?.type === "equal-length") return "EQ";
  if (relation?.type === "length") return isSketchLengthRelationDriven(relation) ? "REF" : "DIM";
  if (relation?.type === "angle") return isSketchAngleRelationDriven(relation) ? "REF" : "ANG";
  if (relation?.type === "distance") return isSketchDistanceRelationDriven(relation) ? "REF" : "DIST";
  if (relation?.type === "fixed") return "FIX";
  return "R";
}
