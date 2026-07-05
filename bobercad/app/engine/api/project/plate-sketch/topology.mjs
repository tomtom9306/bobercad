import { finitePositiveNumber } from "../../../core/math.mjs";
import {
  plateBends,
  sketchConstructionEdges,
  sketchConstructionVertices,
  sketchEdges,
  sketchRelationEdges,
  sketchRelationVertices,
  sketchRelations,
  sketchVertices
} from "./model-accessors.mjs";
import { bendDescendantIds } from "./bend-normalization.mjs";
import { cleanPlateCornerReliefFabrication } from "./corner-reliefs.mjs";
import { normalizePlate, normalizeSketchObject } from "./model-and-placement.mjs";
import {
  DEFAULT_SKETCH_NOTCH_MAX_SIZE,
  DEFAULT_SKETCH_NOTCH_SIZE,
  EPSILON,
  dot2,
  fail,
  normalizeSketch,
  optionalObject,
  optionalString,
  orderedSketchLoop,
  sketchEdgeMidpoint,
  sketchFromCenterArc,
  sketchFromCircle,
  sketchFromOutline,
  sketchFromRectangle,
  sketchFromRoundedRectangle,
  sketchFromSlot,
  sketchFromSlotCenters,
  vec2,
  withSketchRelations
} from "./sketch-geometry-and-relations.mjs";
import {
  edgeLengthDimensionInheritance,
  edgeRelationInheritance,
  relationsForTopologyChange
} from "./solver-and-relations.mjs";
import {
  sketchRelationEdgeIds,
  sketchRelationVertexIds
} from "./relation-metadata.mjs";
import {
  SKETCH_EDGE_LINE,
  SKETCH_EDGE_CIRCULAR_ARC,
  sketchEdgeKind
} from "./edge-geometry.mjs";

const DEFAULT_SKETCH_FILLET_RADIUS = 10;
const EDGE_ARC_DROPPED_RELATION_TYPES = new Set([
  "horizontal",
  "vertical",
  "point-on-line",
  "midpoint",
  "symmetric",
  "perpendicular",
  "parallel",
  "collinear",
  "equal-length",
  "tangent",
  "concentric",
  "equal-radius",
  "length",
  "angle",
  "radius"
]);
const ARC_FLIP_DROPPED_RELATION_TYPES = new Set(["tangent", "concentric"]);

export function addPlateSketchConstructionLine(plate, fromPoint, toPoint, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  return normalizePlate({
    ...plate,
    sketch: sketchWithConstructionLine(plate.sketch, fromPoint, toPoint, options)
  });
}

export function addSketchConstructionLine(sketchObject, fromPoint, toPoint, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchWithConstructionLine(sketchObject.sketch, fromPoint, toPoint, options)
  });
}

export function addPlateSketchConstructionArc(plate, centerPoint, startPoint, endPoint, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  return normalizePlate({
    ...plate,
    sketch: sketchWithConstructionArc(plate.sketch, centerPoint, startPoint, endPoint, options)
  });
}

export function addSketchConstructionArc(sketchObject, centerPoint, startPoint, endPoint, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchWithConstructionArc(sketchObject.sketch, centerPoint, startPoint, endPoint, options)
  });
}

export function setPlateSketchOutline(plate, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  return normalizePlate({
    ...plate,
    sketch: sketchFromOutline(options.outline, options.idPrefix || plate.id || "plate")
  });
}

export function setSketchOutline(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchFromOutline(options.outline, options.idPrefix || sketchObject.id || "sketch")
  });
}

export function removePlateSketchConstructionLine(plate, edgeId) {
  if (!plate?.sketch) fail("plate sketch is required");
  return normalizePlate({
    ...plate,
    sketch: sketchWithRemovedConstructionLine(plate.sketch, edgeId, plate.id || "plate")
  });
}

export function removeSketchConstructionLine(sketchObject, edgeId) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchWithRemovedConstructionLine(sketchObject.sketch, edgeId, sketchObject.id || "sketch")
  });
}

function sketchWithConstructionLine(sourceSketch, fromPoint, toPoint, options = {}) {
  const sketch = normalizeSketch(sourceSketch);
  const from = vec2(fromPoint, "plate sketch construction line start");
  const to = vec2(toPoint, "plate sketch construction line end");
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= EPSILON) {
    fail("plate sketch construction line must have non-zero length");
  }
  const usedIds = new Set([
    ...sketchRelationVertices(sketch).map((vertex) => vertex.id),
    ...sketchRelationEdges(sketch).map((edge) => edge.id)
  ]);
  const firstVertexId = optionalString(options.fromVertexId, nextSketchItemId(sketch, "cv"), "plate sketch construction line fromVertexId");
  if (usedIds.has(firstVertexId)) fail(`plate sketch construction line duplicates id ${firstVertexId}`);
  usedIds.add(firstVertexId);
  const sketchWithFirst = {
    ...sketch,
    constructionVertices: [
      ...sketchConstructionVertices(sketch),
      { id: firstVertexId, point: from, construction: true }
    ]
  };
  const secondVertexId = optionalString(options.toVertexId, nextSketchItemId(sketchWithFirst, "cv"), "plate sketch construction line toVertexId");
  if (usedIds.has(secondVertexId)) fail(`plate sketch construction line duplicates id ${secondVertexId}`);
  usedIds.add(secondVertexId);
  const sketchWithVertices = {
    ...sketchWithFirst,
    constructionVertices: [
      ...sketchConstructionVertices(sketchWithFirst),
      { id: secondVertexId, point: to, construction: true }
    ]
  };
  const edgeId = optionalString(options.edgeId, nextSketchItemId(sketchWithVertices, "ce"), "plate sketch construction line edgeId");
  if (usedIds.has(edgeId)) fail(`plate sketch construction line duplicates id ${edgeId}`);
  return withSketchRelations({
    ...sketchWithVertices,
    constructionEdges: [
      ...sketchConstructionEdges(sketchWithVertices),
      { id: edgeId, from: firstVertexId, to: secondVertexId, construction: true }
    ]
  }, sketchRelations(sketch));
}

function sketchWithConstructionArc(sourceSketch, centerPoint, startPoint, endPoint, options = {}) {
  const sketch = normalizeSketch(sourceSketch);
  const center = vec2(centerPoint, "plate sketch construction arc center");
  const from = vec2(startPoint, "plate sketch construction arc start");
  const rawEnd = vec2(endPoint, "plate sketch construction arc end");
  const startVector = pointSubtract(from, center);
  const endVector = pointSubtract(rawEnd, center);
  const radius = Math.hypot(startVector[0], startVector[1]);
  const endLength = Math.hypot(endVector[0], endVector[1]);
  if (radius <= EPSILON) fail("plate sketch construction arc radius must be positive");
  if (endLength <= EPSILON) fail("plate sketch construction arc end must not be at the center");
  const to = [
    center[0] + endVector[0] / endLength * radius,
    center[1] + endVector[1] / endLength * radius
  ];
  if (pointDistance(from, to) <= EPSILON) fail("plate sketch construction arc sweep cannot be zero");
  const cross = cross2(startVector, endVector);
  const direction = options.direction === "cw" || options.direction === "ccw"
    ? options.direction
    : cross < 0 ? "cw" : "ccw";
  const usedIds = new Set([
    ...sketchRelationVertices(sketch).map((vertex) => vertex.id),
    ...sketchRelationEdges(sketch).map((edge) => edge.id)
  ]);
  const firstVertexId = optionalString(options.fromVertexId, nextSketchItemId(sketch, "cv"), "plate sketch construction arc fromVertexId");
  if (usedIds.has(firstVertexId)) fail(`plate sketch construction arc duplicates id ${firstVertexId}`);
  usedIds.add(firstVertexId);
  const sketchWithFirst = {
    ...sketch,
    constructionVertices: [
      ...sketchConstructionVertices(sketch),
      { id: firstVertexId, point: from, construction: true }
    ]
  };
  const secondVertexId = optionalString(options.toVertexId, nextSketchItemId(sketchWithFirst, "cv"), "plate sketch construction arc toVertexId");
  if (usedIds.has(secondVertexId)) fail(`plate sketch construction arc duplicates id ${secondVertexId}`);
  usedIds.add(secondVertexId);
  const sketchWithVertices = {
    ...sketchWithFirst,
    constructionVertices: [
      ...sketchConstructionVertices(sketchWithFirst),
      { id: secondVertexId, point: to, construction: true }
    ]
  };
  const edgeId = optionalString(options.edgeId, nextSketchItemId(sketchWithVertices, "ce"), "plate sketch construction arc edgeId");
  if (usedIds.has(edgeId)) fail(`plate sketch construction arc duplicates id ${edgeId}`);
  return withSketchRelations({
    ...sketchWithVertices,
    constructionEdges: [
      ...sketchConstructionEdges(sketchWithVertices),
      {
        id: edgeId,
        from: firstVertexId,
        to: secondVertexId,
        kind: SKETCH_EDGE_CIRCULAR_ARC,
        center,
        radius,
        direction,
        construction: true
      }
    ]
  }, sketchRelations(sketch));
}

function sketchWithRemovedConstructionLine(sourceSketch, edgeId, label = "plate sketch") {
  const sketch = normalizeSketch(sourceSketch);
  const edge = sketchConstructionEdges(sketch).find((item) => item.id === edgeId);
  if (!edge) fail(`${label}: construction line not found: ${edgeId}`);
  const remainingConstructionEdges = sketchConstructionEdges(sketch).filter((item) => item.id !== edgeId);
  const remainingConstructionVertexIds = new Set(remainingConstructionEdges.flatMap((item) => [item.from, item.to]));
  const removedVertexIds = new Set([edge.from, edge.to].filter((vertexId) => !remainingConstructionVertexIds.has(vertexId)));
  const removedEdgeIds = new Set([edge.id]);
  const relations = sketchRelations(sketch).filter((relation) => {
    const relationEdgeIds = sketchRelationEdgeIds(relation);
    const relationVertexIds = sketchRelationVertexIds(relation);
    return !relationEdgeIds.some((id) => removedEdgeIds.has(id))
      && !relationVertexIds.some((id) => removedVertexIds.has(id));
  });
  return withSketchRelations({
    ...sketch,
    constructionVertices: sketchConstructionVertices(sketch).filter((vertex) => !removedVertexIds.has(vertex.id)),
    constructionEdges: remainingConstructionEdges
  }, relations);
}


function nextSketchItemId(sketch, kind) {
  const ids = new Set([
    ...sketchRelationVertices(sketch).map((vertex) => vertex.id),
    ...sketchRelationEdges(sketch).map((edge) => edge.id)
  ]);
  for (let index = ids.size + 1; index < ids.size + 10000; index += 1) {
    const id = `${kind}${index}`;
    if (!ids.has(id)) return id;
  }
  fail("could not allocate sketch id");
}

function sketchEdgeBetween(sketch, from, to) {
  return sketchEdges(sketch).find((edge) => edge.from === from && edge.to === to) || null;
}

function sketchEdgeById(sketch, edgeId, label = "sketch edge") {
  const edge = sketchEdges(sketch).find((item) => item.id === edgeId);
  if (!edge) fail(`${label} not found: ${edgeId}`);
  return edge;
}

function assertLineSketchEdge(sketch, edgeId, label = "sketch edge") {
  const edge = sketchEdgeById(sketch, edgeId, label);
  if (sketchEdgeKind(edge) !== SKETCH_EDGE_LINE) fail(`${label} must be a straight line edge`);
  return edge;
}

function assertCircularSketchEdge(sketch, edgeId, label = "sketch edge") {
  const edge = sketchEdgeById(sketch, edgeId, label);
  if (sketchEdgeKind(edge) !== SKETCH_EDGE_CIRCULAR_ARC) fail(`${label} must be a circular arc edge`);
  return edge;
}

function assertLineOrCircularSketchEdge(sketch, edgeId, label = "sketch edge") {
  const edge = sketchEdgeById(sketch, edgeId, label);
  const kind = sketchEdgeKind(edge);
  if (kind !== SKETCH_EDGE_LINE && kind !== SKETCH_EDGE_CIRCULAR_ARC) fail(`${label} must be a line or circular arc edge`);
  return edge;
}

function sketchEdgeLoopFromVertices(sketch, vertices) {
  const used = new Set();
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const existing = sketchEdgeBetween(sketch, vertex.id, next.id);
    if (existing && !used.has(existing.id)) {
      used.add(existing.id);
      return existing;
    }
    const id = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), ...[...used].map((edgeId) => ({ id: edgeId }))] }, "e");
    used.add(id);
    return { id, from: vertex.id, to: next.id };
  });
}

function plateWithSketchTopologyChange(plate, sketch, removedEdgeIds = []) {
  const existingBends = plateBends(plate);
  const removedBendIds = bendDescendantIds(
    existingBends,
    existingBends.filter((bend) => removedEdgeIds.includes(bend.edgeId)).map((bend) => bend.id)
  );
  const bends = existingBends.filter((bend) => !removedBendIds.has(bend.id));
  const hasFabrication = plate.fabrication !== undefined || existingBends.length;
  const fabrication = hasFabrication
    ? cleanPlateCornerReliefFabrication({ ...plate, sketch }, { ...optionalObject(plate.fabrication, {}, `${plate.id}.fabrication`), bends })
    : null;
  return normalizePlate({
    ...plate,
    type: bends.length ? "bent-plate" : "plate",
    sketch,
    ...(hasFabrication ? { fabrication } : {})
  });
}

function sketchLoopSignedArea(loop) {
  let area = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const a = loop[index].point;
    const b = loop[(index + 1) % loop.length].point;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function pointSubtract(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function pointAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function pointScale(a, scalar) {
  return [a[0] * scalar, a[1] * scalar];
}

function unit2(vector, label) {
  const length = Math.hypot(vector[0], vector[1]);
  if (length <= EPSILON) fail(`${label} must have non-zero length`);
  return { length, unit: [vector[0] / length, vector[1] / length] };
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function pointDistance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function reflectPointAcrossLine(point, lineStart, lineEnd) {
  const line = pointSubtract(lineEnd, lineStart);
  const lengthSq = line[0] * line[0] + line[1] * line[1];
  if (lengthSq <= EPSILON) fail("arc flip requires a non-zero chord");
  const relative = pointSubtract(point, lineStart);
  const t = dot2(relative, line) / lengthSq;
  const projection = pointAdd(lineStart, pointScale(line, t));
  return [
    projection[0] * 2 - point[0],
    projection[1] * 2 - point[1]
  ];
}

function positiveAngle(angle) {
  const tau = Math.PI * 2;
  const value = angle % tau;
  return value < 0 ? value + tau : value;
}

function angleOf(center, point) {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function ccwArcContainsAngle(startAngle, throughAngle, endAngle) {
  const sweep = positiveAngle(endAngle - startAngle);
  const throughSweep = positiveAngle(throughAngle - startAngle);
  return throughSweep > EPSILON && throughSweep < sweep - EPSILON;
}

function circularArcContainsPoint(sketch, edge, point) {
  if (sketchEdgeKind(edge) !== SKETCH_EDGE_CIRCULAR_ARC || !point) return false;
  const vertexById = new Map(sketchRelationVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const from = vertexById.get(edge.from)?.point;
  const to = vertexById.get(edge.to)?.point;
  if (!from || !to) return false;
  const center = vec2(edge.center, "circular arc center");
  const radius = edge.radius;
  const tolerance = Math.max(EPSILON, radius * 1e-6);
  if (Math.abs(pointDistance(point, center) - radius) > tolerance) return false;
  if (pointDistance(point, from) <= tolerance || pointDistance(point, to) <= tolerance) return true;
  const startAngle = angleOf(center, from);
  const endAngle = angleOf(center, to);
  const pointAngle = angleOf(center, point);
  const sweep = edge.direction === "cw"
    ? positiveAngle(startAngle - endAngle)
    : positiveAngle(endAngle - startAngle);
  const pointSweep = edge.direction === "cw"
    ? positiveAngle(startAngle - pointAngle)
    : positiveAngle(pointAngle - startAngle);
  return pointSweep <= sweep + Math.max(1e-9, tolerance / Math.max(radius, EPSILON));
}

function pointOnRadius(center, sourcePoint, radius) {
  const angle = Math.atan2(sourcePoint[1] - center[1], sourcePoint[0] - center[0]);
  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + Math.sin(angle) * radius
  ];
}

function sketchWithPointOnCircleVerticesProjected(sketch, edgeId, edge) {
  const pointById = new Map(sketchRelationVertices(sketch).map((vertex) => [vertex.id, vertex.point]));
  const center = vec2(edge.center, `circular arc ${edge.id} center`);
  const updates = new Map();
  for (const relation of sketchRelations(sketch)) {
    if (relation.type !== "point-on-circle" || relation.edgeId !== edgeId) continue;
    const point = pointById.get(relation.vertexId);
    if (!point) continue;
    updates.set(relation.vertexId, pointOnRadius(center, point, edge.radius));
  }
  if (!updates.size) return sketch;
  return {
    ...sketch,
    vertices: sketchVertices(sketch).map((vertex) => (
      updates.has(vertex.id) ? { ...vertex, point: updates.get(vertex.id) } : vertex
    )),
    ...(sketch.constructionVertices !== undefined
      ? {
          constructionVertices: sketchConstructionVertices(sketch).map((vertex) => (
            updates.has(vertex.id) ? { ...vertex, point: updates.get(vertex.id) } : vertex
          ))
        }
      : {})
  };
}

function pointOnCircleRelationsForSplitArc(sketch, topologySketch, sourceEdgeId, firstEdge, secondEdge) {
  const pointById = new Map(sketchRelationVertices(topologySketch).map((vertex) => [vertex.id, vertex.point]));
  return sketchRelations(sketch)
    .filter((relation) => relation.type === "point-on-circle" && relation.edgeId === sourceEdgeId)
    .map((relation) => {
      const point = pointById.get(relation.vertexId);
      const targetEdge = circularArcContainsPoint(topologySketch, secondEdge, point) && !circularArcContainsPoint(topologySketch, firstEdge, point)
        ? secondEdge
        : firstEdge;
      return { type: "point-on-circle", vertexId: relation.vertexId, edgeId: targetEdge.id };
    });
}

function circleThroughThreePoints(start, through, end) {
  const d = 2 * (
    start[0] * (through[1] - end[1])
    + through[0] * (end[1] - start[1])
    + end[0] * (start[1] - through[1])
  );
  if (Math.abs(d) <= EPSILON) fail("three point arc requires non-collinear vertices");
  const startSq = start[0] * start[0] + start[1] * start[1];
  const throughSq = through[0] * through[0] + through[1] * through[1];
  const endSq = end[0] * end[0] + end[1] * end[1];
  const center = [
    (startSq * (through[1] - end[1]) + throughSq * (end[1] - start[1]) + endSq * (start[1] - through[1])) / d,
    (startSq * (end[0] - through[0]) + throughSq * (start[0] - end[0]) + endSq * (through[0] - start[0])) / d
  ];
  const radius = Math.hypot(start[0] - center[0], start[1] - center[1]);
  if (!finitePositiveNumber(radius)) fail("three point arc radius could not be resolved");
  const startAngle = angleOf(center, start);
  const throughAngle = angleOf(center, through);
  const endAngle = angleOf(center, end);
  return {
    center,
    radius,
    direction: ccwArcContainsAngle(startAngle, throughAngle, endAngle) ? "ccw" : "cw"
  };
}

function edgeArcRadius(chordLength, radius) {
  const fallback = Math.max(DEFAULT_SKETCH_FILLET_RADIUS, chordLength);
  const value = finitePositiveNumber(radius) ? radius : fallback;
  if (value <= chordLength / 2 + EPSILON) {
    fail("edge arc radius must be greater than half the selected edge length");
  }
  return value;
}

function lineEdgeAsCircularArc(sketch, edge, options = {}) {
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const from = vertexById.get(edge.from)?.point;
  const to = vertexById.get(edge.to)?.point;
  if (!from || !to) fail("edge arc conversion requires edge endpoint vertices");
  const chord = [to[0] - from[0], to[1] - from[1]];
  const chordLength = Math.hypot(chord[0], chord[1]);
  if (chordLength <= EPSILON) fail("edge arc conversion requires a non-zero edge length");
  if (options.throughPoint !== undefined) {
    const through = vec2(options.throughPoint, "edge arc through point");
    const arc = circleThroughThreePoints(from, through, to);
    return {
      ...edge,
      kind: SKETCH_EDGE_CIRCULAR_ARC,
      center: arc.center,
      radius: arc.radius,
      direction: arc.direction,
      authoring: {
        ...optionalObject(edge.authoring, {}, "sketch edge authoring"),
        operation: "edge-arc",
        throughPoint: through
      }
    };
  }
  const radius = edgeArcRadius(chordLength, options.radius);
  const halfChord = chordLength / 2;
  const centerDistance = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  const unit = [chord[0] / chordLength, chord[1] / chordLength];
  const leftNormal = [-unit[1], unit[0]];
  const bulgeSign = options.side === "right" ? -1 : 1;
  const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const center = [
    midpoint[0] - leftNormal[0] * bulgeSign * centerDistance,
    midpoint[1] - leftNormal[1] * bulgeSign * centerDistance
  ];
  const defaultDirection = bulgeSign > 0 ? "cw" : "ccw";
  const direction = options.direction === "cw" || options.direction === "ccw"
    ? options.direction
    : defaultDirection;
  return {
    ...edge,
    kind: SKETCH_EDGE_CIRCULAR_ARC,
    center,
    radius,
    direction,
    authoring: {
      ...optionalObject(edge.authoring, {}, "sketch edge authoring"),
      operation: "edge-arc"
    }
  };
}

function relationsForEdgeArcConversion(sketch, edgeId, radius, mode = "driven") {
  const keptRelations = sketchRelations(sketch).filter((relation) => {
    if (!sketchRelationEdgeIds(relation).includes(edgeId)) return true;
    return !EDGE_ARC_DROPPED_RELATION_TYPES.has(relation.type);
  });
  return [
    ...keptRelations,
    { type: "radius", edgeId, value: radius, mode }
  ];
}

function sketchWithEdgeArc(sketch, edgeId, options = {}) {
  const normalized = normalizeSketch(sketch);
  const edge = assertLineOrCircularSketchEdge(normalized, edgeId, "edge arc");
  const arcEdge = lineEdgeAsCircularArc(normalized, edge, options);
  const edges = sketchEdges(normalized).map((item) => item.id === edgeId ? arcEdge : item);
  const nextSketch = sketchWithPointOnCircleVerticesProjected({ ...normalized, edges }, edgeId, arcEdge);
  return withSketchRelations(
    nextSketch,
    relationsForEdgeArcConversion(nextSketch, edgeId, arcEdge.radius, options.mode || "driven")
  );
}

function sketchWithFlippedArc(sketch, edgeId) {
  const normalized = normalizeSketch(sketch);
  const edge = assertCircularSketchEdge(normalized, edgeId, "flip arc");
  const vertexById = new Map(sketchVertices(normalized).map((vertex) => [vertex.id, vertex]));
  const from = vertexById.get(edge.from)?.point;
  const to = vertexById.get(edge.to)?.point;
  if (!from || !to) fail("flip arc requires edge endpoint vertices");
  const center = vec2(edge.center, "flip arc center");
  const reflectedCenter = reflectPointAcrossLine(center, from, to);
  const nextCenter = pointDistance(center, reflectedCenter) <= EPSILON ? center : reflectedCenter;
  const flippedEdge = {
    ...edge,
    center: nextCenter,
    direction: edge.direction === "ccw" ? "cw" : "ccw",
    authoring: {
      ...optionalObject(edge.authoring, {}, "sketch edge authoring"),
      flipped: true
    }
  };
  const nextSketch = sketchWithPointOnCircleVerticesProjected({
    ...normalized,
    edges: sketchEdges(normalized).map((item) => item.id === edgeId ? flippedEdge : item)
  }, edgeId, flippedEdge);
  return withSketchRelations(
    nextSketch,
    sketchRelations(normalized).filter((relation) => (
      !sketchRelationEdgeIds(relation).includes(edgeId)
      || !ARC_FLIP_DROPPED_RELATION_TYPES.has(relation.type)
    ))
  );
}

function sketchWithSplitArc(sketch, edgeId, options = {}) {
  const normalized = normalizeSketch(sketch);
  const edge = assertCircularSketchEdge(normalized, edgeId, "split arc");
  const vertexId = optionalString(options.vertexId, nextSketchItemId(normalized, "v"), "split arc vertexId");
  const firstEdgeId = optionalString(options.firstEdgeId, nextSketchItemId(normalized, "e"), "split arc firstEdgeId");
  const secondEdgeId = optionalString(
    options.secondEdgeId,
    nextSketchItemId({ ...normalized, edges: [...sketchEdges(normalized), { id: firstEdgeId }] }, "e"),
    "split arc secondEdgeId"
  );
  const splitPoint = options.point === undefined
    ? sketchEdgeMidpoint(normalized, edge)
    : vec2(options.point, "split arc point");
  const vertexById = new Map(sketchVertices(normalized).map((vertex) => [vertex.id, vertex]));
  const from = vertexById.get(edge.from)?.point;
  const to = vertexById.get(edge.to)?.point;
  if (!from || !to) fail("split arc requires edge endpoint vertices");
  if (pointDistance(splitPoint, from) <= EPSILON || pointDistance(splitPoint, to) <= EPSILON) {
    fail("split arc point must be between the arc endpoints");
  }
  if (Math.abs(pointDistance(splitPoint, vec2(edge.center, "split arc center")) - edge.radius) > Math.max(1e-6, edge.radius * 1e-6)) {
    fail("split arc point must lie on the selected arc radius");
  }
  if (!circularArcContainsPoint(normalized, edge, splitPoint)) {
    fail("split arc point must lie between the arc endpoints");
  }
  const splitVertex = { id: vertexId, point: splitPoint };
  const firstEdge = {
    ...edge,
    id: firstEdgeId,
    from: edge.from,
    to: vertexId,
    authoring: {
      ...optionalObject(edge.authoring, {}, "sketch edge authoring"),
      operation: "split-arc",
      sourceEdgeId: edge.id
    }
  };
  const secondEdge = {
    ...edge,
    id: secondEdgeId,
    from: vertexId,
    to: edge.to,
    authoring: {
      ...optionalObject(edge.authoring, {}, "sketch edge authoring"),
      operation: "split-arc",
      sourceEdgeId: edge.id
    }
  };
  const topologySketch = {
    ...normalized,
    vertices: [...sketchVertices(normalized), splitVertex],
    edges: sketchEdges(normalized).flatMap((item) => item.id === edgeId ? [firstEdge, secondEdge] : [item])
  };
  return {
    sketch: relationsForTopologyChange(
      normalized,
      topologySketch,
      [edgeId],
      [
        { type: "radius", edgeId: firstEdgeId, value: edge.radius, mode: options.mode || "driven" },
        { type: "radius", edgeId: secondEdgeId, value: edge.radius, mode: options.mode || "driven" },
        { type: "tangent", edgeIds: [firstEdgeId, secondEdgeId] },
        ...pointOnCircleRelationsForSplitArc(normalized, topologySketch, edgeId, firstEdge, secondEdge)
      ],
      { ...options, inferNewRelations: false }
    ),
    vertexId,
    edgeIds: [firstEdgeId, secondEdgeId]
  };
}

function consecutiveThreePointArcContext(sketch, vertexIds) {
  const ids = Array.isArray(vertexIds) ? vertexIds.filter((id) => typeof id === "string" && id) : [];
  if (ids.length !== 3 || new Set(ids).size !== 3) fail("three point arc requires three selected vertices");
  const selected = new Set(ids);
  const loop = orderedSketchLoop(sketch);
  for (let index = 0; index < loop.length; index += 1) {
    const previous = loop[(index + loop.length - 1) % loop.length];
    const through = loop[index];
    const next = loop[(index + 1) % loop.length];
    if (selected.has(previous.vertexId) && selected.has(through.vertexId) && selected.has(next.vertexId)) {
      return {
        start: previous,
        through,
        end: next,
        incomingEdgeId: through.incomingEdgeId,
        outgoingEdgeId: through.outgoingEdgeId
      };
    }
  }
  fail("three point arc requires three consecutive outline vertices");
}

function sketchWithThreePointArc(sketch, vertexIds, options = {}) {
  const normalized = normalizeSketch(sketch);
  const context = consecutiveThreePointArcContext(normalized, vertexIds);
  assertLineSketchEdge(normalized, context.incomingEdgeId, "three point arc incoming edge");
  assertLineSketchEdge(normalized, context.outgoingEdgeId, "three point arc outgoing edge");
  const arc = circleThroughThreePoints(context.start.point, context.through.point, context.end.point);
  const arcEdgeId = optionalString(options.edgeId, nextSketchItemId(normalized, "e"), "three point arc edgeId");
  const arcEdge = {
    id: arcEdgeId,
    from: context.start.vertexId,
    to: context.end.vertexId,
    kind: SKETCH_EDGE_CIRCULAR_ARC,
    center: arc.center,
    radius: arc.radius,
    direction: arc.direction,
    authoring: {
      operation: "three-point-arc",
      sourceVertexId: context.through.vertexId
    }
  };
  const topologySketch = {
    ...normalized,
    vertices: sketchVertices(normalized).filter((vertex) => vertex.id !== context.through.vertexId),
    edges: sketchEdges(normalized).flatMap((edge) => {
      if (edge.id === context.incomingEdgeId) return [arcEdge];
      if (edge.id === context.outgoingEdgeId) return [];
      return [edge];
    })
  };
  return {
    sketch: relationsForTopologyChange(
      normalized,
      topologySketch,
      [context.incomingEdgeId, context.outgoingEdgeId],
      [{ type: "radius", edgeId: arcEdgeId, value: arc.radius, mode: options.mode || "driven" }],
      { ...options, inferNewRelations: false }
    ),
    edgeId: arcEdgeId,
    removedEdgeIds: [context.incomingEdgeId, context.outgoingEdgeId]
  };
}

function sameCircularArcBasis(firstEdge, secondEdge) {
  if (sketchEdgeKind(firstEdge) !== SKETCH_EDGE_CIRCULAR_ARC || sketchEdgeKind(secondEdge) !== SKETCH_EDGE_CIRCULAR_ARC) return false;
  if (firstEdge.direction !== secondEdge.direction) return false;
  const firstCenter = vec2(firstEdge.center, "first circular arc center");
  const secondCenter = vec2(secondEdge.center, "second circular arc center");
  const tolerance = Math.max(EPSILON, Math.max(firstEdge.radius || 0, secondEdge.radius || 0) * 1e-6);
  return Math.abs(firstCenter[0] - secondCenter[0]) <= tolerance
    && Math.abs(firstCenter[1] - secondCenter[1]) <= tolerance
    && Math.abs(firstEdge.radius - secondEdge.radius) <= tolerance;
}

function mergedCircularArcEdgeId(sketch, incomingEdge, outgoingEdge, remainingEdges) {
  const incomingSource = optionalObject(incomingEdge.authoring, {}, "incoming sketch edge authoring").sourceEdgeId;
  const outgoingSource = optionalObject(outgoingEdge.authoring, {}, "outgoing sketch edge authoring").sourceEdgeId;
  const remainingIds = new Set(remainingEdges.map((edge) => edge.id));
  if (typeof incomingSource === "string" && incomingSource && incomingSource === outgoingSource && !remainingIds.has(incomingSource)) {
    return incomingSource;
  }
  return nextSketchItemId({ ...sketch, edges: remainingEdges }, "e");
}

function mergedCircularArcRelations(sketch, removedEdgeIds, mergedEdge) {
  const removed = new Set(removedEdgeIds);
  const relations = [];
  const radiusRelations = sketchRelations(sketch).filter((relation) => relation.type === "radius" && removed.has(relation.edgeId));
  const preferredRadius = radiusRelations.find((relation) => relation.mode === "driving") || radiusRelations[0];
  relations.push({
    type: "radius",
    edgeId: mergedEdge.id,
    value: finitePositiveNumber(preferredRadius?.value) ? preferredRadius.value : mergedEdge.radius,
    mode: preferredRadius?.mode || "driven"
  });
  for (const relation of sketchRelations(sketch)) {
    if (relation.type === "fixed" && removed.has(relation.edgeId)) {
      relations.push({ type: "fixed", edgeId: mergedEdge.id });
      continue;
    }
    if (relation.type === "point-on-circle" && removed.has(relation.edgeId)) {
      relations.push({ type: "point-on-circle", vertexId: relation.vertexId, edgeId: mergedEdge.id });
      continue;
    }
    if (relation.type !== "tangent" && relation.type !== "concentric" && relation.type !== "equal-radius") continue;
    const ids = sketchRelationEdgeIds(relation);
    if (!ids.some((edgeId) => removed.has(edgeId))) continue;
    const nextIds = ids.map((edgeId) => removed.has(edgeId) ? mergedEdge.id : edgeId);
    if (new Set(nextIds).size !== 2) continue;
    relations.push({ type: relation.type, edgeIds: nextIds });
  }
  return relations;
}

function sketchWithMergedCircularArcsAtVertex(sketch, vertexId, loop, removedIndex, vertexById) {
  const removed = loop[removedIndex];
  const previous = loop[(removedIndex + loop.length - 1) % loop.length];
  const next = loop[(removedIndex + 1) % loop.length];
  const incomingEdge = sketchEdgeById(sketch, removed.incomingEdgeId, "remove vertex incoming edge");
  const outgoingEdge = sketchEdgeById(sketch, removed.outgoingEdgeId, "remove vertex outgoing edge");
  if (incomingEdge.to !== vertexId || outgoingEdge.from !== vertexId) return null;
  if (!sameCircularArcBasis(incomingEdge, outgoingEdge)) return null;
  const vertices = loop
    .filter((item) => item.vertexId !== vertexId)
    .map((item) => vertexById.get(item.vertexId));
  const removedEdgeIds = [incomingEdge.id, outgoingEdge.id];
  const remainingEdges = sketchEdges(sketch).filter((edge) => !removedEdgeIds.includes(edge.id));
  const mergedEdge = {
    id: mergedCircularArcEdgeId(sketch, incomingEdge, outgoingEdge, remainingEdges),
    from: previous.vertexId,
    to: next.vertexId,
    kind: SKETCH_EDGE_CIRCULAR_ARC,
    center: vec2(incomingEdge.center, "merged circular arc center"),
    radius: incomingEdge.radius,
    direction: incomingEdge.direction,
    authoring: {
      operation: "merge-arc",
      sourceEdgeIds: removedEdgeIds
    }
  };
  const edges = sketchEdges(sketch).flatMap((edge) => {
    if (edge.id === incomingEdge.id) return [mergedEdge];
    if (edge.id === outgoingEdge.id) return [];
    return [edge];
  });
  const topologySketch = { ...sketch, vertices, edges };
  return {
    sketch: relationsForTopologyChange(
      sketch,
      topologySketch,
      removedEdgeIds,
      mergedCircularArcRelations(sketch, removedEdgeIds, mergedEdge),
      { inferNewRelations: false }
    ),
    removedEdgeIds
  };
}

function sketchWithRemovedVertex(sketch, vertexId, label = "plate") {
  const normalized = normalizeSketch(sketch);
  const loop = orderedSketchLoop(normalized);
  if (loop.length <= 3) fail("plate sketch requires at least three vertices");
  const removedIndex = loop.findIndex((item) => item.vertexId === vertexId);
  const removed = loop[removedIndex];
  if (!removed) fail(`${label}: sketch vertex not found: ${vertexId}`);
  const previous = loop[(removedIndex + loop.length - 1) % loop.length];
  const next = loop[(removedIndex + 1) % loop.length];
  const vertexById = new Map(sketchVertices(normalized).map((vertex) => [vertex.id, vertex]));
  const mergedArcs = sketchWithMergedCircularArcsAtVertex(normalized, vertexId, loop, removedIndex, vertexById);
  if (mergedArcs) return mergedArcs;
  const previousPoint = vertexById.get(previous.vertexId)?.point;
  const removedPoint = vertexById.get(removed.vertexId)?.point;
  const nextPoint = vertexById.get(next.vertexId)?.point;
  const incoming = previousPoint && removedPoint ? [removedPoint[0] - previousPoint[0], removedPoint[1] - previousPoint[1]] : null;
  const outgoing = removedPoint && nextPoint ? [nextPoint[0] - removedPoint[0], nextPoint[1] - removedPoint[1]] : null;
  const incomingLength = incoming ? Math.hypot(incoming[0], incoming[1]) : 0;
  const outgoingLength = outgoing ? Math.hypot(outgoing[0], outgoing[1]) : 0;
  const removesIntermediateLinePoint = incomingLength > EPSILON
    && outgoingLength > EPSILON
    && Math.abs(incoming[0] * outgoing[1] - incoming[1] * outgoing[0]) <= EPSILON * incomingLength * outgoingLength
    && dot2(incoming, outgoing) > 0;
  const vertices = loop
    .filter((item) => item.vertexId !== vertexId)
    .map((item) => vertexById.get(item.vertexId));
  const edges = sketchEdgeLoopFromVertices(normalized, vertices);
  const topologySketch = { ...normalized, vertices, edges };
  const replacementEdge = removesIntermediateLinePoint ? sketchEdgeBetween(topologySketch, previous.vertexId, next.vertexId) : null;
  const extraRelations = replacementEdge
    ? [
      ...edgeRelationInheritance(normalized, removed.incomingEdgeId, [replacementEdge.id]),
      ...edgeRelationInheritance(normalized, removed.outgoingEdgeId, [replacementEdge.id])
    ]
    : [];
  return {
    sketch: relationsForTopologyChange(normalized, topologySketch, [removed.incomingEdgeId, removed.outgoingEdgeId], extraRelations),
    removedEdgeIds: [removed.incomingEdgeId, removed.outgoingEdgeId]
  };
}

function sketchWithInsertedVertex(sketch, edgeId, point, options = {}, label = "plate") {
  const normalized = normalizeSketch(sketch);
  const edge = sketchEdges(normalized).find((item) => item.id === edgeId);
  if (!edge) fail(`${label}: sketch edge not found: ${edgeId}`);
  if (sketchEdgeKind(edge) === SKETCH_EDGE_CIRCULAR_ARC) {
    return sketchWithSplitArc(normalized, edgeId, {
      ...options,
      point
    });
  }
  if (sketchEdgeKind(edge) !== SKETCH_EDGE_LINE) fail("insert vertex requires a line or circular arc edge");
  const vertexId = nextSketchItemId(normalized, "v");
  const firstEdgeId = nextSketchItemId(normalized, "e");
  const secondEdgeId = nextSketchItemId({ ...normalized, edges: [...sketchEdges(normalized), { id: firstEdgeId }] }, "e");
  const vertex = { id: vertexId, point: vec2(point, "inserted plate sketch vertex") };
  const vertices = [...sketchVertices(normalized), vertex];
  const edges = sketchEdges(normalized).flatMap((item) => item.id === edgeId
    ? [
      { id: firstEdgeId, from: edge.from, to: vertexId },
      { id: secondEdgeId, from: vertexId, to: edge.to }
    ]
    : [item]);
  const topologySketch = { ...normalized, vertices, edges };
  const extraRelations = [
    ...(options.addSplitCollinear === false ? [] : [{ type: "collinear", edgeIds: [firstEdgeId, secondEdgeId] }]),
    ...edgeRelationInheritance(normalized, edgeId, [firstEdgeId, secondEdgeId], options),
    ...edgeLengthDimensionInheritance(normalized, edgeId, topologySketch, [firstEdgeId, secondEdgeId])
  ];
  return {
    sketch: relationsForTopologyChange(normalized, topologySketch, [edgeId], extraRelations, options),
    vertexId
  };
}

export function insertPlateSketchVertex(plate, edgeId, point, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const result = sketchWithInsertedVertex(plate.sketch, edgeId, point, options, plate.id || "plate");
  return {
    plate: plateWithSketchTopologyChange(plate, result.sketch, [edgeId]),
    vertexId: result.vertexId
  };
}

export function insertSketchVertex(sketchObject, edgeId, point, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const result = sketchWithInsertedVertex(sketchObject.sketch, edgeId, point, options, sketchObject.id || "sketch");
  return {
    sketch: normalizeSketchObject({
      ...sketchObject,
      sketch: result.sketch
    }),
    vertexId: result.vertexId
  };
}

export function setPlateSketchCircle(plate, options = {}) {
  const sketch = plate?.sketch;
  if (!sketch) fail("plate sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "plate sketch circle center");
  const idPrefix = optionalString(options.idPrefix, `${plate.id || "plate"}_circle`, "plate sketch circle idPrefix");
  const nextSketch = sketchFromCircle(radius, idPrefix, center);
  return plateWithSketchTopologyChange(plate, nextSketch, sketchEdges(sketch).map((edge) => edge.id));
}

export function setSketchCircle(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "sketch circle center");
  const idPrefix = optionalString(options.idPrefix, `${sketchObject.id || "sketch"}_circle`, "sketch circle idPrefix");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchFromCircle(radius, idPrefix, center)
  });
}

export function setPlateSketchCenterRectangle(plate, options = {}) {
  const sketch = plate?.sketch;
  if (!sketch) fail("plate sketch is required");
  const width = finitePositiveNumber(options.width) ? options.width : DEFAULT_SKETCH_FILLET_RADIUS * 6;
  const height = finitePositiveNumber(options.height) ? options.height : DEFAULT_SKETCH_FILLET_RADIUS * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "plate sketch center rectangle center");
  const idPrefix = optionalString(options.idPrefix, `${plate.id || "plate"}_center_rect`, "plate sketch center rectangle idPrefix");
  const nextSketch = sketchFromRectangle(width, height, idPrefix, center);
  return plateWithSketchTopologyChange(plate, nextSketch, sketchEdges(sketch).map((edge) => edge.id));
}

export function setSketchCenterRectangle(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const width = finitePositiveNumber(options.width) ? options.width : DEFAULT_SKETCH_FILLET_RADIUS * 6;
  const height = finitePositiveNumber(options.height) ? options.height : DEFAULT_SKETCH_FILLET_RADIUS * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "sketch center rectangle center");
  const idPrefix = optionalString(options.idPrefix, `${sketchObject.id || "sketch"}_center_rect`, "sketch center rectangle idPrefix");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchFromRectangle(width, height, idPrefix, center)
  });
}

export function setPlateSketchRoundedRectangle(plate, options = {}) {
  const sketch = plate?.sketch;
  if (!sketch) fail("plate sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const width = finitePositiveNumber(options.width) ? options.width : radius * 6;
  const height = finitePositiveNumber(options.height) ? options.height : radius * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "plate sketch rounded rectangle center");
  const idPrefix = optionalString(options.idPrefix, `${plate.id || "plate"}_rounded_rect`, "plate sketch rounded rectangle idPrefix");
  const nextSketch = sketchFromRoundedRectangle(width, height, radius, idPrefix, center);
  return plateWithSketchTopologyChange(plate, nextSketch, sketchEdges(sketch).map((edge) => edge.id));
}

export function setSketchRoundedRectangle(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const width = finitePositiveNumber(options.width) ? options.width : radius * 6;
  const height = finitePositiveNumber(options.height) ? options.height : radius * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "sketch rounded rectangle center");
  const idPrefix = optionalString(options.idPrefix, `${sketchObject.id || "sketch"}_rounded_rect`, "sketch rounded rectangle idPrefix");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchFromRoundedRectangle(width, height, radius, idPrefix, center)
  });
}

export function setPlateSketchSlot(plate, options = {}) {
  const sketch = plate?.sketch;
  if (!sketch) fail("plate sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const length = finitePositiveNumber(options.length) ? options.length : radius * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "plate sketch slot center");
  const idPrefix = optionalString(options.idPrefix, `${plate.id || "plate"}_slot`, "plate sketch slot idPrefix");
  const nextSketch = options.startCenter !== undefined || options.endCenter !== undefined
    ? sketchFromSlotCenters(options.startCenter, options.endCenter, radius, idPrefix)
    : sketchFromSlot(length, radius, idPrefix, center);
  return plateWithSketchTopologyChange(plate, nextSketch, sketchEdges(sketch).map((edge) => edge.id));
}

export function setSketchSlot(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const length = finitePositiveNumber(options.length) ? options.length : radius * 4;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "sketch slot center");
  const idPrefix = optionalString(options.idPrefix, `${sketchObject.id || "sketch"}_slot`, "sketch slot idPrefix");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: options.startCenter !== undefined || options.endCenter !== undefined
      ? sketchFromSlotCenters(options.startCenter, options.endCenter, radius, idPrefix)
      : sketchFromSlot(length, radius, idPrefix, center)
  });
}

export function setPlateSketchCenterArc(plate, options = {}) {
  const sketch = plate?.sketch;
  if (!sketch) fail("plate sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const sweepDegrees = options.sweepDegrees === undefined ? 120 : options.sweepDegrees;
  const startAngleDegrees = options.startAngleDegrees === undefined ? 0 : options.startAngleDegrees;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "plate sketch center arc center");
  const idPrefix = optionalString(options.idPrefix, `${plate.id || "plate"}_arc`, "plate sketch center arc idPrefix");
  const nextSketch = sketchFromCenterArc(radius, sweepDegrees, idPrefix, center, startAngleDegrees);
  return plateWithSketchTopologyChange(plate, nextSketch, sketchEdges(sketch).map((edge) => edge.id));
}

export function setSketchCenterArc(sketchObject, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const radius = finitePositiveNumber(options.radius) ? options.radius : DEFAULT_SKETCH_FILLET_RADIUS;
  const sweepDegrees = options.sweepDegrees === undefined ? 120 : options.sweepDegrees;
  const startAngleDegrees = options.startAngleDegrees === undefined ? 0 : options.startAngleDegrees;
  const center = options.center === undefined ? [0, 0] : vec2(options.center, "sketch center arc center");
  const idPrefix = optionalString(options.idPrefix, `${sketchObject.id || "sketch"}_arc`, "sketch center arc idPrefix");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchFromCenterArc(radius, sweepDegrees, idPrefix, center, startAngleDegrees)
  });
}

export function setPlateSketchEdgeArc(plate, edgeId, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  return plateWithSketchTopologyChange(plate, sketchWithEdgeArc(plate.sketch, edgeId, options), []);
}

export function setSketchEdgeArc(sketchObject, edgeId, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchWithEdgeArc(sketchObject.sketch, edgeId, options)
  });
}

export function flipPlateSketchEdgeArc(plate, edgeId) {
  if (!plate?.sketch) fail("plate sketch is required");
  return plateWithSketchTopologyChange(plate, sketchWithFlippedArc(plate.sketch, edgeId), []);
}

export function flipSketchEdgeArc(sketchObject, edgeId) {
  if (!sketchObject?.sketch) fail("sketch is required");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: sketchWithFlippedArc(sketchObject.sketch, edgeId)
  });
}

export function splitPlateSketchEdgeArc(plate, edgeId, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const result = sketchWithSplitArc(plate.sketch, edgeId, options);
  return {
    plate: plateWithSketchTopologyChange(plate, result.sketch, [edgeId]),
    vertexId: result.vertexId,
    edgeIds: result.edgeIds
  };
}

export function splitSketchEdgeArc(sketchObject, edgeId, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const result = sketchWithSplitArc(sketchObject.sketch, edgeId, options);
  return {
    sketch: normalizeSketchObject({
      ...sketchObject,
      sketch: result.sketch
    }),
    vertexId: result.vertexId,
    edgeIds: result.edgeIds
  };
}

export function setPlateSketchThreePointArc(plate, vertexIds, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const result = sketchWithThreePointArc(plate.sketch, vertexIds, options);
  return {
    plate: plateWithSketchTopologyChange(plate, result.sketch, result.removedEdgeIds),
    edgeId: result.edgeId
  };
}

export function setSketchThreePointArc(sketchObject, vertexIds, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const result = sketchWithThreePointArc(sketchObject.sketch, vertexIds, options);
  return {
    sketch: normalizeSketchObject({
      ...sketchObject,
      sketch: result.sketch
    }),
    edgeId: result.edgeId
  };
}

export function removePlateSketchVertex(plate, vertexId) {
  const result = sketchWithRemovedVertex(plate.sketch, vertexId, plate.id || "plate");
  return plateWithSketchTopologyChange(plate, result.sketch, result.removedEdgeIds);
}

export function removeSketchVertex(sketchObject, vertexId) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const result = sketchWithRemovedVertex(sketchObject.sketch, vertexId, sketchObject.id || "sketch");
  return normalizeSketchObject({
    ...sketchObject,
    sketch: result.sketch
  });
}

export function notchPlateSketchCorner(plate, vertexId, options = {}) {
  const sketch = plate.sketch;
  const loop = orderedSketchLoop(sketch);
  const cornerIndex = loop.findIndex((item) => item.vertexId === vertexId);
  if (cornerIndex < 0) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const previous = loop[(cornerIndex + loop.length - 1) % loop.length];
  const corner = loop[cornerIndex];
  const next = loop[(cornerIndex + 1) % loop.length];
  assertLineSketchEdge(sketch, corner.incomingEdgeId, "notch incoming edge");
  assertLineSketchEdge(sketch, corner.outgoingEdgeId, "notch outgoing edge");
  const cornerPoint = vertexById.get(corner.vertexId)?.point;
  const previousPoint = vertexById.get(previous.vertexId)?.point;
  const nextPoint = vertexById.get(next.vertexId)?.point;
  const previousVector = [previousPoint[0] - cornerPoint[0], previousPoint[1] - cornerPoint[1]];
  const nextVector = [nextPoint[0] - cornerPoint[0], nextPoint[1] - cornerPoint[1]];
  const previousLength = Math.hypot(previousVector[0], previousVector[1]);
  const nextLength = Math.hypot(nextVector[0], nextVector[1]);
  const size = finitePositiveNumber(options.size)
    ? options.size
    : Math.max(1, Math.min(DEFAULT_SKETCH_NOTCH_SIZE, DEFAULT_SKETCH_NOTCH_MAX_SIZE, previousLength * 0.2, nextLength * 0.2));
  if (previousLength <= EPSILON || nextLength <= EPSILON) fail("notch corner requires non-zero adjacent edges");
  const previousUnit = [previousVector[0] / previousLength, previousVector[1] / previousLength];
  let nextUnit = [nextVector[0] / nextLength, nextVector[1] / nextLength];
  const orthogonal = options.orthogonal !== false;
  if (orthogonal) {
    const perpendicularA = [-previousUnit[1], previousUnit[0]];
    const perpendicularB = [previousUnit[1], -previousUnit[0]];
    nextUnit = perpendicularA[0] * nextUnit[0] + perpendicularA[1] * nextUnit[1] >= perpendicularB[0] * nextUnit[0] + perpendicularB[1] * nextUnit[1]
      ? perpendicularA
      : perpendicularB;
  }
  const firstId = nextSketchItemId(sketch, "v");
  const secondId = nextSketchItemId({ ...sketch, vertices: [...sketchVertices(sketch), { id: firstId }] }, "v");
  const thirdId = nextSketchItemId({ ...sketch, vertices: [...sketchVertices(sketch), { id: firstId }, { id: secondId }] }, "v");
  const first = {
    id: firstId,
    point: [cornerPoint[0] + previousUnit[0] * size, cornerPoint[1] + previousUnit[1] * size]
  };
  const second = {
    id: secondId,
    point: [first.point[0] + nextUnit[0] * size, first.point[1] + nextUnit[1] * size]
  };
  const third = {
    id: thirdId,
    point: [cornerPoint[0] + nextUnit[0] * size, cornerPoint[1] + nextUnit[1] * size]
  };
  const vertices = loop.flatMap((item) => item.vertexId === vertexId
    ? [first, second, third]
    : [vertexById.get(item.vertexId)]);
  const edges = sketchEdgeLoopFromVertices(sketch, vertices);
  const topologySketch = { ...sketch, vertices, edges };
  const incomingOuter = sketchEdgeBetween(topologySketch, previous.vertexId, firstId);
  const outgoingInner = sketchEdgeBetween(topologySketch, firstId, secondId);
  const incomingInner = sketchEdgeBetween(topologySketch, secondId, thirdId);
  const outgoingOuter = sketchEdgeBetween(topologySketch, thirdId, next.vertexId);
  const extraRelations = [
    ...edgeRelationInheritance(sketch, corner.incomingEdgeId, [incomingOuter?.id, incomingInner?.id]),
    ...edgeRelationInheritance(sketch, corner.outgoingEdgeId, [outgoingInner?.id, outgoingOuter?.id]),
    ...edgeLengthDimensionInheritance(sketch, corner.incomingEdgeId, topologySketch, [incomingOuter?.id]),
    ...edgeLengthDimensionInheritance(sketch, corner.outgoingEdgeId, topologySketch, [outgoingOuter?.id])
  ];
  if (incomingOuter && incomingInner) extraRelations.push({ type: "parallel", edgeIds: [incomingOuter.id, incomingInner.id] });
  if (outgoingInner && outgoingOuter) extraRelations.push({ type: "parallel", edgeIds: [outgoingInner.id, outgoingOuter.id] });
  if (outgoingInner && incomingInner) extraRelations.push({ type: "equal-length", edgeIds: [outgoingInner.id, incomingInner.id] });
  if (orthogonal) {
    if (incomingOuter && outgoingInner) extraRelations.push({ type: "perpendicular", edgeIds: [incomingOuter.id, outgoingInner.id] });
    if (outgoingInner && incomingInner) extraRelations.push({ type: "perpendicular", edgeIds: [outgoingInner.id, incomingInner.id] });
    if (incomingInner && outgoingOuter) extraRelations.push({ type: "perpendicular", edgeIds: [incomingInner.id, outgoingOuter.id] });
  }
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [corner.incomingEdgeId, corner.outgoingEdgeId], extraRelations);
  return {
    plate: plateWithSketchTopologyChange(plate, nextSketch, [corner.incomingEdgeId, corner.outgoingEdgeId]),
    vertexIds: [firstId, secondId, thirdId]
  };
}

function sketchWithFilletCorner(sourceSketch, vertexId, options = {}, label = "plate sketch") {
  const sketch = normalizeSketch(sourceSketch);
  const loop = orderedSketchLoop(sketch);
  const cornerIndex = loop.findIndex((item) => item.vertexId === vertexId);
  if (cornerIndex < 0) fail(`${label}: sketch vertex not found: ${vertexId}`);
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
  const previous = loop[(cornerIndex + loop.length - 1) % loop.length];
  const corner = loop[cornerIndex];
  const next = loop[(cornerIndex + 1) % loop.length];
  assertLineSketchEdge(sketch, corner.incomingEdgeId, "fillet incoming edge");
  assertLineSketchEdge(sketch, corner.outgoingEdgeId, "fillet outgoing edge");
  const cornerPoint = vertexById.get(corner.vertexId)?.point;
  const previousPoint = vertexById.get(previous.vertexId)?.point;
  const nextPoint = vertexById.get(next.vertexId)?.point;
  if (!cornerPoint || !previousPoint || !nextPoint) fail("fillet corner requires adjacent vertex points");

  const previousVector = pointSubtract(previousPoint, cornerPoint);
  const nextVector = pointSubtract(nextPoint, cornerPoint);
  const previousUnit = unit2(previousVector, "fillet incoming edge");
  const nextUnit = unit2(nextVector, "fillet outgoing edge");
  const angle = Math.acos(Math.max(-1, Math.min(1, dot2(previousUnit.unit, nextUnit.unit))));
  if (angle <= EPSILON || angle >= Math.PI - EPSILON) fail("fillet corner requires a non-collinear corner");

  const loopArea = sketchLoopSignedArea(loop);
  if (Math.abs(loopArea) <= EPSILON) fail("fillet corner requires a non-degenerate sketch loop");
  const edgeIntoCorner = pointSubtract(cornerPoint, previousPoint);
  const edgeOutOfCorner = pointSubtract(nextPoint, cornerPoint);
  const convexity = cross2(edgeIntoCorner, edgeOutOfCorner) * Math.sign(loopArea);
  if (convexity <= EPSILON) fail("fillet corner requires a convex sketch corner");

  const radius = finitePositiveNumber(options.radius)
    ? options.radius
    : Math.max(1, Math.min(DEFAULT_SKETCH_FILLET_RADIUS, previousUnit.length * 0.2, nextUnit.length * 0.2));
  const tangentDistance = radius / Math.tan(angle / 2);
  if (!Number.isFinite(tangentDistance) || tangentDistance <= EPSILON) fail("fillet radius could not be resolved");
  if (tangentDistance >= previousUnit.length - EPSILON || tangentDistance >= nextUnit.length - EPSILON) {
    fail("fillet radius is too large for adjacent edges");
  }

  const bisector = unit2(pointAdd(previousUnit.unit, nextUnit.unit), "fillet angle bisector").unit;
  const centerDistance = radius / Math.sin(angle / 2);
  const firstId = nextSketchItemId(sketch, "v");
  const secondId = nextSketchItemId({ ...sketch, vertices: [...sketchVertices(sketch), { id: firstId }] }, "v");
  const incomingOuterId = nextSketchItemId(sketch, "e");
  const arcEdgeId = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), { id: incomingOuterId }] }, "e");
  const outgoingOuterId = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), { id: incomingOuterId }, { id: arcEdgeId }] }, "e");
  const first = {
    id: firstId,
    point: pointAdd(cornerPoint, pointScale(previousUnit.unit, tangentDistance))
  };
  const second = {
    id: secondId,
    point: pointAdd(cornerPoint, pointScale(nextUnit.unit, tangentDistance))
  };
  const center = pointAdd(cornerPoint, pointScale(bisector, centerDistance));
  const direction = loopArea >= 0 ? "ccw" : "cw";
  const vertices = loop.flatMap((item) => item.vertexId === vertexId
    ? [first, second]
    : [vertexById.get(item.vertexId)]);
  const incomingOuter = { id: incomingOuterId, from: previous.vertexId, to: firstId };
  const filletArc = {
    id: arcEdgeId,
    from: firstId,
    to: secondId,
    kind: SKETCH_EDGE_CIRCULAR_ARC,
    center,
    radius,
    direction,
    authoring: {
      operation: "fillet",
      sourceVertexId: vertexId
    }
  };
  const outgoingOuter = { id: outgoingOuterId, from: secondId, to: next.vertexId };
  const edges = sketchEdges(sketch).flatMap((edge) => {
    if (edge.id === corner.incomingEdgeId) return [incomingOuter];
    if (edge.id === corner.outgoingEdgeId) return [filletArc, outgoingOuter];
    return [edge];
  });
  const topologySketch = { ...sketch, vertices, edges };
  const extraRelations = [
    ...edgeRelationInheritance(sketch, corner.incomingEdgeId, [incomingOuter.id], options),
    ...edgeRelationInheritance(sketch, corner.outgoingEdgeId, [outgoingOuter.id], options),
    ...edgeLengthDimensionInheritance(sketch, corner.incomingEdgeId, topologySketch, [incomingOuter.id]),
    ...edgeLengthDimensionInheritance(sketch, corner.outgoingEdgeId, topologySketch, [outgoingOuter.id]),
    { type: "radius", edgeId: arcEdgeId, value: radius, mode: "driven" },
    { type: "tangent", edgeIds: [incomingOuter.id, arcEdgeId] },
    { type: "tangent", edgeIds: [arcEdgeId, outgoingOuter.id] }
  ];
  const nextSketch = relationsForTopologyChange(
    sketch,
    topologySketch,
    [corner.incomingEdgeId, corner.outgoingEdgeId],
    extraRelations,
    options
  );
  return {
    sketch: nextSketch,
    removedEdgeIds: [corner.incomingEdgeId, corner.outgoingEdgeId],
    vertexIds: [firstId, secondId],
    edgeId: arcEdgeId
  };
}

export function filletPlateSketchCorner(plate, vertexId, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const result = sketchWithFilletCorner(plate.sketch, vertexId, options, plate.id || "plate");
  return {
    plate: plateWithSketchTopologyChange(plate, result.sketch, result.removedEdgeIds),
    vertexIds: result.vertexIds,
    edgeId: result.edgeId
  };
}

export function filletSketchCorner(sketchObject, vertexId, options = {}) {
  if (!sketchObject?.sketch) fail("sketch is required");
  const result = sketchWithFilletCorner(sketchObject.sketch, vertexId, options, sketchObject.id || "sketch");
  return {
    sketch: normalizeSketchObject({
      ...sketchObject,
      sketch: result.sketch
    }),
    vertexIds: result.vertexIds,
    edgeId: result.edgeId
  };
}
