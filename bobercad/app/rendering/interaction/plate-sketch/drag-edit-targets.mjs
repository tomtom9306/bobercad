import { v } from "../../../engine/core/math.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { addPlateSketchConstructionLine as addPlateSketchConstructionLineData, insertPlateSketchVertex as insertPlateSketchVertexData, notchPlateSketchCorner as notchPlateSketchCornerData, orderedSketchLoop, plateSketchEntityDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, removePlateSketchRelation as removePlateSketchRelationData, removePlateSketchVertex as removePlateSketchVertexData, setPlateSketchEdgeAngle as setPlateSketchEdgeAngleData, setPlateSketchEdgeAngleMode as setPlateSketchEdgeAngleModeData, setPlateSketchEdgeLength as setPlateSketchEdgeLengthData, setPlateSketchEdgeLengthMode as setPlateSketchEdgeLengthModeData, setPlateSketchPointDistance as setPlateSketchPointDistanceData, setPlateSketchPointDistanceMode as setPlateSketchPointDistanceModeData, setPlateSketchVertex as setPlateSketchVertexData, setPlateSketchVertices as setPlateSketchVerticesData, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDistanceRelationMode, sketchEdgeAngleDegrees, sketchEdgeAxisRelation, sketchEdges, sketchFromOutline, sketchLengthRelationMode, sketchPointDistance, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchRelationsForEdge, sketchRelationsForVertex, sketchVertices, upsertPlateSketchRelation as upsertPlateSketchRelationData } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { snapPointOverlay } from "../../scene/authoring/snap-overlays.mjs";
import { adaptiveSnapGridStep, adaptiveSnapGridStepForHandle, snapScalarToGrid, snapSketchWorldTolerance } from "../snap-profiles.mjs";
import { dimensionOverlayForPlate } from "./dimension-overlay.mjs";
import { relationHealthClass, relationHealthColor, relationHealthStatus, sketchEntityColor, sketchStatusColor } from "./relation-display.mjs";
import { EPSILON, add2, cross2, dot2, edgeOutwardNormal, edgePointPair, len2, midpoint, mul2, norm2, platePoint, requiredPoint2, signedArea, sub2 } from "./sketch-edit-geometry.mjs";

export function finitePositive(value) {
  return Number.isFinite(value) && value > EPSILON;
}

export function rectangleOutlineFromSize(size) {
  return [
    [-size[1] / 2, -size[2] / 2],
    [size[1] / 2, -size[2] / 2],
    [size[1] / 2, size[2] / 2],
    [-size[1] / 2, size[2] / 2]
  ];
}

export function cutBodyOutline(body) {
  if (body?.type === "polygonal-prism") return arrayValues(body.outline);
  if (body?.type === "box" && Array.isArray(body.size) && body.size.length === 3 && body.size.every(finitePositive)) {
    return rectangleOutlineFromSize(body.size);
  }
  return [];
}

export function featureBodySketchPlate(feature) {
  const body = feature?.body;
  if (feature?.type !== "boolean-part" || !body || (body.type !== "polygonal-prism" && body.type !== "box")) return null;
  const center = body.center;
  const axisX = body.axisX;
  const axisY = body.axisY;
  const axisZ = body.axisZ;
  const thickness = body.type === "polygonal-prism" ? body.depth : body.size?.[0];
  const outline = cutBodyOutline(body);
  if (!v.isVec3(center) || !v.isVec3(axisX) || !v.isVec3(axisY) || !v.isVec3(axisZ) || !finitePositive(thickness) || outline.length < 3) return null;
  try {
    return {
      id: feature.id,
      type: "cutting-body-sketch",
      center: [...center],
      normal: v.safeNorm(axisX, [1, 0, 0]),
      localAxisY: v.safeNorm(axisY, [0, 1, 0]),
      localAxisZ: v.safeNorm(axisZ, [0, 0, 1]),
      thickness,
      sketch: sketchFromOutline(outline, `${feature.id}_body`),
      display: {
        ...(feature.display || {}),
        edgeColor: feature.display?.edgeColor || "#ef4444"
      }
    };
  } catch {
    return null;
  }
}

export function activeSketchTarget(project, objectId) {
  const entry = project?.objectIndex?.[objectId];
  if (entry?.collection === "plates") {
    const plate = project.model?.plates?.[objectId] || null;
    return plate ? { id: objectId, collection: "plates", plate } : null;
  }
  if (entry?.collection === "features") {
    const feature = project.model?.features?.[objectId] || null;
    const plate = featureBodySketchPlate(feature);
    return plate ? { id: objectId, collection: "features", feature, plate } : null;
  }
  return null;
}

export function activePlate(project, plateId) {
  return activeSketchTarget(project, plateId)?.plate || null;
}

export function featureBodySketchPatch(feature, nextPlate) {
  const body = feature?.body || {};
  const outline = orderedSketchLoop(nextPlate.sketch).map((item) => [...item.point]);
  if (body.type === "box") {
    return {
      type: "polygonal-prism",
      center: [...nextPlate.center],
      axisX: [...body.axisX],
      axisY: [...body.axisY],
      axisZ: [...body.axisZ],
      depth: body.size[0],
      outline
    };
  }
  return { outline };
}

export function plateSketchPlane(plate) {
  if (!plate || !v.isVec3(plate.center)) return null;
  return {
    id: `${plate.id || "plate"}:sketch-plane`,
    label: `${plate.id || "plate"} sketch plane`,
    origin: [...plate.center],
    normal: v.safeNorm(plate.normal, [0, 0, 1]),
    axisX: v.safeNorm(plate.localAxisY, [1, 0, 0]),
    axisY: v.safeNorm(plate.localAxisZ, [0, 1, 0])
  };
}

export function plateSketchPointFromWorld(plate, point) {
  if (!plate || !v.isVec3(point)) return null;
  const delta = v.sub(point, plate.center);
  return [
    v.dot(delta, v.safeNorm(plate.localAxisY, [1, 0, 0])),
    v.dot(delta, v.safeNorm(plate.localAxisZ, [0, 1, 0]))
  ];
}

