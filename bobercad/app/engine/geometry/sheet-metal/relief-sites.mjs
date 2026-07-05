import { distance2 } from "../../core/math.mjs";
import { plateBends, sketchEdges } from "../../api/project/plate-sketch/model-accessors.mjs";
import { orderedSketchLoop } from "../../api/project/plate-sketch/sketch-geometry-and-relations.mjs";

const CHILD_CORNER_PARENT_EDGES = new Set(["start", "end"]);

function direction2(from, to) {
  const length = distance2(from, to);
  if (length <= 1e-9) return [0, 0];
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

function edgeEndpointForVertex(edge, vertexId) {
  if (edge?.from === vertexId) return "start";
  if (edge?.to === vertexId) return "end";
  return "";
}

function sketchCornerSite(loop, index, rootBendByEdgeId, edgeById) {
  const corner = loop[index];
  const previous = loop[(index + loop.length - 1) % loop.length];
  const next = loop[(index + 1) % loop.length];
  const incomingBend = rootBendByEdgeId.get(corner.incomingEdgeId);
  const outgoingBend = rootBendByEdgeId.get(corner.outgoingEdgeId);
  if (!incomingBend || !outgoingBend) return null;
  const incomingEdge = edgeById.get(corner.incomingEdgeId);
  const outgoingEdge = edgeById.get(corner.outgoingEdgeId);
  return {
    key: `sketch:${corner.vertexId}`,
    kind: "sketch-corner",
    target: {
      kind: "sketchVertex",
      vertexId: corner.vertexId
    },
    bends: [
      {
        bendId: incomingBend.id,
        endpoint: edgeEndpointForVertex(incomingEdge, corner.vertexId) || "end",
        edgeId: incomingBend.edgeId
      },
      {
        bendId: outgoingBend.id,
        endpoint: edgeEndpointForVertex(outgoingEdge, corner.vertexId) || "start",
        edgeId: outgoingBend.edgeId
      }
    ],
    basePoint2d: corner.point,
    localAxes2d: {
      incoming: direction2(corner.point, previous.point),
      outgoing: direction2(corner.point, next.point)
    },
    limits2d: {
      incoming: distance2(corner.point, previous.point),
      outgoing: distance2(corner.point, next.point),
      corner: Math.min(distance2(corner.point, previous.point), distance2(corner.point, next.point))
    },
    affectedChartIds: [
      "base",
      `bend:${incomingBend.id}`,
      `flange:${incomingBend.id}`,
      `bend:${outgoingBend.id}`,
      `flange:${outgoingBend.id}`
    ],
    legacyVertexId: corner.vertexId
  };
}

function generatedBendCornerSites(bends) {
  const bendIds = new Set(bends.map((bend) => bend.id));
  const sites = [];
  for (const bend of bends) {
    if (!bend.parentBendId || !CHILD_CORNER_PARENT_EDGES.has(bend.parentEdge) || !bendIds.has(bend.parentBendId)) continue;
    const parentEndpoint = bend.parentEdge === "end" ? "end" : "start";
    const childEndpoint = "start";
    sites.push({
      key: `bend:${bend.parentBendId}:${bend.parentEdge}:${bend.id}:${childEndpoint}`,
      kind: "bend-corner",
      target: {
        kind: "bendEndpoint",
        parentBendId: bend.parentBendId,
        parentEdge: bend.parentEdge,
        bendId: bend.id,
        endpoint: childEndpoint,
        parentEndpoint
      },
      bends: [
        {
          bendId: bend.parentBendId,
          parentEdge: bend.parentEdge,
          endpoint: parentEndpoint
        },
        {
          bendId: bend.id,
          endpoint: childEndpoint
        }
      ],
      basePoint2d: null,
      localAxes2d: null,
      affectedChartIds: [
        `bend:${bend.parentBendId}`,
        `flange:${bend.parentBendId}`,
        `bend:${bend.id}`,
        `flange:${bend.id}`
      ],
      legacyVertexId: `bend_corner_${bend.parentBendId}_${bend.parentEdge}_${bend.id}`
    });
  }
  return sites;
}

export function evaluateCornerReliefSites(plate) {
  const bends = plateBends(plate);
  const rootBendByEdgeId = new Map(
    bends
      .filter((bend) => !bend.parentBendId && bend.edgeId)
      .map((bend) => [bend.edgeId, bend])
  );
  const edgeById = new Map(sketchEdges(plate?.sketch).map((edge) => [edge.id, edge]));
  const loop = orderedSketchLoop(plate?.sketch);
  const sketchSites = loop
    .map((_, index) => sketchCornerSite(loop, index, rootBendByEdgeId, edgeById))
    .filter(Boolean);
  return [...sketchSites, ...generatedBendCornerSites(bends)];
}

export function cornerReliefSiteByLegacyVertexId(plate) {
  return new Map(
    evaluateCornerReliefSites(plate)
      .filter((site) => site.legacyVertexId)
      .map((site) => [site.legacyVertexId, site])
  );
}
