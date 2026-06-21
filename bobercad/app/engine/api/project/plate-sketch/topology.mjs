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
import { normalizePlate } from "./model-and-placement.mjs";
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
  vec2,
  withSketchRelations
} from "./sketch-geometry-and-relations.mjs";
import {
  edgeLengthDimensionInheritance,
  edgeRelationInheritance,
  relationsForTopologyChange
} from "./solver-and-relations.mjs";

export function addPlateSketchConstructionLine(plate, fromPoint, toPoint, options = {}) {
  if (!plate?.sketch) fail("plate sketch is required");
  const sketch = normalizeSketch(plate.sketch);
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
  return normalizePlate({
    ...plate,
    sketch: withSketchRelations({
      ...sketchWithVertices,
      constructionEdges: [
        ...sketchConstructionEdges(sketchWithVertices),
        { id: edgeId, from: firstVertexId, to: secondVertexId, construction: true }
      ]
    }, sketchRelations(sketch))
  });
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
  return normalizePlate({
    ...plate,
    type: bends.length ? "bent-plate" : "plate",
    sketch,
    ...(hasFabrication ? { fabrication: { ...optionalObject(plate.fabrication, {}, `${plate.id}.fabrication`), bends } } : {})
  });
}

export function insertPlateSketchVertex(plate, edgeId, point, options = {}) {
  const sketch = plate.sketch;
  const edge = sketchEdges(sketch).find((item) => item.id === edgeId);
  if (!edge) fail(`${plate.id}: sketch edge not found: ${edgeId}`);
  const vertexId = nextSketchItemId(sketch, "v");
  const firstEdgeId = nextSketchItemId(sketch, "e");
  const secondEdgeId = nextSketchItemId({ ...sketch, edges: [...sketchEdges(sketch), { id: firstEdgeId }] }, "e");
  const vertex = { id: vertexId, point: vec2(point, "inserted plate sketch vertex") };
  const vertices = [...sketchVertices(sketch), vertex];
  const edges = sketchEdges(sketch).flatMap((item) => item.id === edgeId
    ? [
      { id: firstEdgeId, from: edge.from, to: vertexId },
      { id: secondEdgeId, from: vertexId, to: edge.to }
    ]
    : [item]);
  const topologySketch = { ...sketch, vertices, edges };
  const extraRelations = [
    ...(options.addSplitCollinear === false ? [] : [{ type: "collinear", edgeIds: [firstEdgeId, secondEdgeId] }]),
    ...edgeRelationInheritance(sketch, edgeId, [firstEdgeId, secondEdgeId], options),
    ...edgeLengthDimensionInheritance(sketch, edgeId, topologySketch, [firstEdgeId, secondEdgeId])
  ];
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [edgeId], extraRelations, options);
  return {
    plate: plateWithSketchTopologyChange(plate, nextSketch, [edgeId]),
    vertexId
  };
}

export function removePlateSketchVertex(plate, vertexId) {
  const sketch = plate.sketch;
  const loop = orderedSketchLoop(sketch);
  if (loop.length <= 3) fail("plate sketch requires at least three vertices");
  const removedIndex = loop.findIndex((item) => item.vertexId === vertexId);
  const removed = loop[removedIndex];
  if (!removed) fail(`${plate.id}: sketch vertex not found: ${vertexId}`);
  const previous = loop[(removedIndex + loop.length - 1) % loop.length];
  const next = loop[(removedIndex + 1) % loop.length];
  const vertexById = new Map(sketchVertices(sketch).map((vertex) => [vertex.id, vertex]));
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
  const edges = sketchEdgeLoopFromVertices(sketch, vertices);
  const topologySketch = { ...sketch, vertices, edges };
  const replacementEdge = removesIntermediateLinePoint ? sketchEdgeBetween(topologySketch, previous.vertexId, next.vertexId) : null;
  const extraRelations = replacementEdge
    ? [
      ...edgeRelationInheritance(sketch, removed.incomingEdgeId, [replacementEdge.id]),
      ...edgeRelationInheritance(sketch, removed.outgoingEdgeId, [replacementEdge.id])
    ]
    : [];
  const nextSketch = relationsForTopologyChange(sketch, topologySketch, [removed.incomingEdgeId, removed.outgoingEdgeId], extraRelations);
  return plateWithSketchTopologyChange(plate, nextSketch, [removed.incomingEdgeId, removed.outgoingEdgeId]);
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
