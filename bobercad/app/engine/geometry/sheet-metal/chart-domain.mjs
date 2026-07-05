import { distance2 } from "../../core/math.mjs";
import { signedArea2d } from "../polygon.mjs";

const EPSILON = 1e-7;

function finitePoint2(point) {
  return Array.isArray(point)
    && point.length === 2
    && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function samePoint2(a, b, tolerance = EPSILON) {
  return finitePoint2(a) && finitePoint2(b) && distance2(a, b) <= tolerance;
}

function clonePoint2(point) {
  return [point[0], point[1]];
}

function cleanLoop2d(points = []) {
  const clean = [];
  for (const point of points || []) {
    if (!finitePoint2(point)) continue;
    const previous = clean[clean.length - 1];
    if (!previous || !samePoint2(previous, point)) clean.push(clonePoint2(point));
  }
  if (clean.length > 1 && samePoint2(clean[0], clean[clean.length - 1])) clean.pop();
  return clean;
}

function cross2(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointOnSegment2(point, a, b, tolerance = EPSILON) {
  if (Math.abs(cross2(a, b, point)) > tolerance) return false;
  return point[0] >= Math.min(a[0], b[0]) - tolerance
    && point[0] <= Math.max(a[0], b[0]) + tolerance
    && point[1] >= Math.min(a[1], b[1]) - tolerance
    && point[1] <= Math.max(a[1], b[1]) + tolerance;
}

function segmentInteriorsIntersect2(a, b, c, d, tolerance = EPSILON) {
  if (samePoint2(a, c, tolerance) || samePoint2(a, d, tolerance) || samePoint2(b, c, tolerance) || samePoint2(b, d, tolerance)) return false;
  const abC = cross2(a, b, c);
  const abD = cross2(a, b, d);
  const cdA = cross2(c, d, a);
  const cdB = cross2(c, d, b);
  if ((abC > tolerance && abD < -tolerance || abC < -tolerance && abD > tolerance)
      && (cdA > tolerance && cdB < -tolerance || cdA < -tolerance && cdB > tolerance)) {
    return true;
  }
  return (Math.abs(abC) <= tolerance && pointOnSegment2(c, a, b, tolerance))
    || (Math.abs(abD) <= tolerance && pointOnSegment2(d, a, b, tolerance))
    || (Math.abs(cdA) <= tolerance && pointOnSegment2(a, c, d, tolerance))
    || (Math.abs(cdB) <= tolerance && pointOnSegment2(b, c, d, tolerance));
}

function selfIntersectionSegmentIndexes(points) {
  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    for (let second = first + 1; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (first === 0 && secondNext === 0) continue;
      if (segmentInteriorsIntersect2(points[first], points[firstNext], points[second], points[secondNext])) {
        return [first, second];
      }
    }
  }
  return null;
}

function normalizeBoundaryEdges(edges = [], pointCount = 0) {
  if (!Array.isArray(edges)) return [];
  return edges
    .filter((edge) => Number.isInteger(edge?.startIndex)
      && Number.isInteger(edge?.endIndex)
      && edge.startIndex >= 0
      && edge.endIndex >= 0
      && edge.startIndex < pointCount
      && edge.endIndex < pointCount)
    .map((edge) => ({ ...edge }));
}

function cutoutRegionDiagnostics(application, message, code = "sheet-metal.chart-domain.cutout-region-invalid") {
  const region = application?.cutoutRegion2d || application?.region || application;
  return {
    severity: "error",
    code,
    message,
    cutoutRegionId: application?.id || region?.metadata?.id || "",
    reliefSiteKey: application?.siteKey || region?.metadata?.siteKey || "",
    reliefVertexId: application?.cornerReliefVertexId || region?.metadata?.cornerReliefVertexId || ""
  };
}

function pointOnLoopBoundary2(point, loop, tolerance = EPSILON) {
  if (!finitePoint2(point) || !Array.isArray(loop) || loop.length < 2) return false;
  for (let index = 0; index < loop.length; index += 1) {
    if (pointOnSegment2(point, loop[index], loop[(index + 1) % loop.length], tolerance)) return true;
  }
  return false;
}

function pointInLoop2(point, loop, tolerance = EPSILON) {
  if (!finitePoint2(point) || !Array.isArray(loop) || loop.length < 3) return false;
  if (pointOnLoopBoundary2(point, loop, tolerance)) return true;
  let inside = false;
  for (let index = 0, previous = loop.length - 1; index < loop.length; previous = index, index += 1) {
    const currentPoint = loop[index];
    const previousPoint = loop[previous];
    const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
      && point[0] < (previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]) / ((previousPoint[1] - currentPoint[1]) || EPSILON) + currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function segmentIntersectionPoints2(a, b, c, d, tolerance = EPSILON) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const denominator = r[0] * s[1] - r[1] * s[0];
  const cMinusA = [c[0] - a[0], c[1] - a[1]];
  if (Math.abs(denominator) > tolerance) {
    const t = (cMinusA[0] * s[1] - cMinusA[1] * s[0]) / denominator;
    const u = (cMinusA[0] * r[1] - cMinusA[1] * r[0]) / denominator;
    if (t >= -tolerance && t <= 1 + tolerance && u >= -tolerance && u <= 1 + tolerance) {
      return [[
        a[0] + r[0] * Math.max(0, Math.min(1, t)),
        a[1] + r[1] * Math.max(0, Math.min(1, t))
      ]];
    }
    return [];
  }
  if (Math.abs(cross2(a, b, c)) > tolerance || Math.abs(cross2(a, b, d)) > tolerance) return [];
  const points = [];
  for (const point of [a, b, c, d]) {
    if (pointOnSegment2(point, a, b, tolerance) && pointOnSegment2(point, c, d, tolerance)) {
      if (!points.some((candidate) => samePoint2(candidate, point, tolerance))) points.push(clonePoint2(point));
    }
  }
  return points;
}

function segmentParam2(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denominator = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  if (Math.abs(denominator) <= EPSILON) return 0;
  return Math.abs(dx) >= Math.abs(dy)
    ? (point[0] - a[0]) / denominator
    : (point[1] - a[1]) / denominator;
}

function uniqueSortedParams(values = []) {
  return values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, Math.min(1, value)))
    .sort((a, b) => a - b)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > EPSILON);
}

function loopSegments2d(points = [], edgeMetadata = []) {
  return points.map((start, index) => ({
    index,
    start,
    end: points[(index + 1) % points.length],
    metadata: edgeMetadata[index] || {},
    params: [0, 1]
  })).filter((segment) => finitePoint2(segment.start)
    && finitePoint2(segment.end)
    && !samePoint2(segment.start, segment.end));
}

function addSegmentSplitPoint(segment, point) {
  if (!segment || !finitePoint2(point)) return;
  if (!pointOnSegment2(point, segment.start, segment.end)) return;
  segment.params.push(segmentParam2(point, segment.start, segment.end));
}

function splitSegmentsAtIntersections(firstSegments = [], secondSegments = []) {
  let intersectionCount = 0;
  for (const first of firstSegments) {
    for (const second of secondSegments) {
      const points = segmentIntersectionPoints2(first.start, first.end, second.start, second.end);
      if (!points.length) continue;
      intersectionCount += points.length;
      for (const point of points) {
        addSegmentSplitPoint(first, point);
        addSegmentSplitPoint(second, point);
      }
    }
  }
  return intersectionCount;
}

function pointAtSegmentParam(segment, t) {
  return [
    segment.start[0] + (segment.end[0] - segment.start[0]) * t,
    segment.start[1] + (segment.end[1] - segment.start[1]) * t
  ];
}

function splitSegmentPieces(segment) {
  const params = uniqueSortedParams(segment.params);
  const pieces = [];
  for (let index = 0; index + 1 < params.length; index += 1) {
    const startT = params[index];
    const endT = params[index + 1];
    if (endT - startT <= EPSILON) continue;
    const start = pointAtSegmentParam(segment, startT);
    const end = pointAtSegmentParam(segment, endT);
    if (samePoint2(start, end)) continue;
    pieces.push({
      start,
      end,
      metadata: segment.metadata || {}
    });
  }
  return pieces;
}

function midpoint2(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function loopBoundsScale(loop = []) {
  if (!loop.length) return 1;
  const xs = loop.map((point) => point[0]);
  const ys = loop.map((point) => point[1]);
  return Math.max(
    1,
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys)
  );
}

function pointInLoopStrict2(point, loop, tolerance = EPSILON) {
  return pointInLoop2(point, loop, tolerance) && !pointOnLoopBoundary2(point, loop, tolerance);
}

function domainInwardProbePoint(start, end, domainArea, scale) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return midpoint2(start, end);
  const distance = Math.max(scale * 1e-8, EPSILON * 10);
  const left = [-dy / length, dx / length];
  const normal = domainArea >= 0 ? left : [-left[0], -left[1]];
  const mid = midpoint2(start, end);
  return [mid[0] + normal[0] * distance, mid[1] + normal[1] * distance];
}

function domainPieceInsideCutout(piece, cutoutLoop, domainArea, scale) {
  const mid = midpoint2(piece.start, piece.end);
  if (pointInLoopStrict2(mid, cutoutLoop)) return true;
  if (!pointOnLoopBoundary2(mid, cutoutLoop)) return false;
  return pointInLoop2(domainInwardProbePoint(piece.start, piece.end, domainArea, scale), cutoutLoop);
}

function cutoutPieceInsideDomain(piece, domainLoop) {
  const mid = midpoint2(piece.start, piece.end);
  return pointInLoopStrict2(mid, domainLoop);
}

function orientedCutoutLoopForDifference(regionLoop, domainArea) {
  const loop = cleanLoop2d(regionLoop);
  if (loop.length < 3) return [];
  const ccw = signedArea2d(loop) >= 0 ? loop : [...loop].reverse();
  return domainArea >= 0 ? [...ccw].reverse() : ccw;
}

function canonicalNodeId(nodes, point) {
  const existing = nodes.findIndex((candidate) => samePoint2(candidate, point));
  if (existing >= 0) return existing;
  nodes.push(clonePoint2(point));
  return nodes.length - 1;
}

function addDirectedGraphEdge(graph, start, end, source, metadata = {}) {
  if (!finitePoint2(start) || !finitePoint2(end) || samePoint2(start, end)) return;
  const startId = canonicalNodeId(graph.nodes, start);
  const endId = canonicalNodeId(graph.nodes, end);
  if (startId === endId) return;
  graph.edges.push({
    startId,
    endId,
    source,
    metadata,
    used: false
  });
}

function edgeAngle(graph, edge) {
  const start = graph.nodes[edge.startId];
  const end = graph.nodes[edge.endId];
  return Math.atan2(end[1] - start[1], end[0] - start[0]);
}

function turnDelta(previousAngle, nextAngle, domainArea) {
  let delta = nextAngle - previousAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return domainArea >= 0 ? delta : -delta;
}

function chooseNextGraphEdge(graph, currentEdge, candidates, domainArea) {
  if (candidates.length <= 1) return candidates[0] || null;
  const previousAngle = edgeAngle(graph, currentEdge);
  return candidates
    .map((edge) => ({ edge, delta: turnDelta(previousAngle, edgeAngle(graph, edge), domainArea) }))
    .sort((a, b) => {
      const aBacktrack = a.edge.endId === currentEdge.startId ? 1 : 0;
      const bBacktrack = b.edge.endId === currentEdge.startId ? 1 : 0;
      if (aBacktrack !== bBacktrack) return aBacktrack - bBacktrack;
      return a.delta - b.delta;
    })[0]?.edge || null;
}

function traceGraphLoop(graph, startEdge, domainArea) {
  const loop = [];
  let current = startEdge;
  const startId = startEdge.startId;
  for (let guard = 0; guard <= graph.edges.length + 1; guard += 1) {
    if (!current || current.used) return null;
    current.used = true;
    loop.push(current);
    if (current.endId === startId) return loop;
    const candidates = graph.edges.filter((edge) => !edge.used && edge.startId === current.endId);
    current = chooseNextGraphEdge(graph, current, candidates, domainArea);
  }
  return null;
}

function traceGraphLoops(graph, domainArea) {
  const loops = [];
  for (const edge of graph.edges) {
    if (edge.used) continue;
    const loop = traceGraphLoop(graph, edge, domainArea);
    if (loop?.length) loops.push(loop);
  }
  return loops;
}

function graphLoopToDomain(loopEdges, graph) {
  const points = loopEdges.map((edge) => clonePoint2(graph.nodes[edge.startId]));
  return {
    points,
    edges: loopEdges.map((edge, index) => {
      const reliefEdge = edge.source === "relief" && edge.metadata?.reliefSiteKey;
      return {
        startIndex: index,
        endIndex: (index + 1) % loopEdges.length,
        source: reliefEdge ? "relief" : "domain",
        ...(reliefEdge ? {
          reliefSiteKey: edge.metadata.reliefSiteKey,
          reliefVertexId: edge.metadata.reliefVertexId || "",
          cornerReliefRole: edge.metadata.cornerReliefRole || "cut-boundary"
        } : {})
      };
    })
  };
}

function reverseDomainLoop(loop) {
  const points = [...loop.points].reverse();
  const oldEdges = loop.edges || [];
  const edges = points.map((point, index) => {
    const oldEdge = oldEdges[(oldEdges.length - index - 2 + oldEdges.length) % oldEdges.length] || {};
    return {
      ...oldEdge,
      startIndex: index,
      endIndex: (index + 1) % points.length
    };
  });
  return { points, edges };
}

function differenceSingleLoopByOneCutoutRegion(domain, application, region, metadata = {}) {
  const diagnostics = [];
  const domainLoop = chartDomainBoundary2d(domain);
  const regionLoop = chartDomainBoundary2d(region);
  const domainArea = signedArea2d(domainLoop);
  const scale = Math.max(loopBoundsScale(domainLoop), loopBoundsScale(regionLoop));
  const regionMetadata = {
    reliefSiteKey: application?.siteKey || region?.metadata?.siteKey || "",
    reliefVertexId: application?.cornerReliefVertexId || region?.metadata?.cornerReliefVertexId || "",
    cornerReliefRole: "cut-boundary"
  };
  const unchanged = () => ({ domain, diagnostics, applied: false });

  if (domainLoop.length < 3 || Math.abs(domainArea) <= EPSILON || regionLoop.length < 3) return unchanged();

  const cutoutLoop = orientedCutoutLoopForDifference(regionLoop, domainArea);
  const domainEdges = chartDomainBoundaryEdges(domain);
  const domainSegments = loopSegments2d(domainLoop, domainEdges);
  const cutoutSegments = loopSegments2d(cutoutLoop, cutoutLoop.map(() => regionMetadata));
  const intersectionCount = splitSegmentsAtIntersections(domainSegments, cutoutSegments);
  const domainPointInsideCutout = domainLoop.some((point) => pointInLoopStrict2(point, cutoutLoop));
  const cutoutPointInsideDomain = cutoutLoop.some((point) => pointInLoopStrict2(point, domainLoop));

  if (!intersectionCount) {
    if (cutoutPointInsideDomain) {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region is fully inside the chart domain; hole topology is not implemented by the current chart renderer.", "sheet-metal.chart-domain.cutout-hole-unsupported"));
      return unchanged();
    }
    if (domainPointInsideCutout) {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region removes the entire chart domain.", "sheet-metal.chart-domain.cutout-removes-domain"));
      return unchanged();
    }
    return unchanged();
  }

  const graph = { nodes: [], edges: [] };
  for (const segment of domainSegments) {
    for (const piece of splitSegmentPieces(segment)) {
      if (domainPieceInsideCutout(piece, cutoutLoop, domainArea, scale)) continue;
      addDirectedGraphEdge(graph, piece.start, piece.end, piece.metadata?.source || "domain", piece.metadata || {});
    }
  }
  for (const segment of cutoutSegments) {
    for (const piece of splitSegmentPieces(segment)) {
      if (!cutoutPieceInsideDomain(piece, domainLoop)) continue;
      addDirectedGraphEdge(graph, piece.start, piece.end, "relief", regionMetadata);
    }
  }

  const loops = traceGraphLoops(graph, domainArea)
    .map((loopEdges) => graphLoopToDomain(loopEdges, graph))
    .filter((loop) => loop.points.length >= 3 && Math.abs(signedArea2d(loop.points)) > EPSILON);
  if (!loops.length) {
    diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region produced no supported remaining chart boundary.", "sheet-metal.chart-domain.cutout-empty-result"));
    return unchanged();
  }
  const orientedLoops = loops.map((loop) => (
    Math.sign(signedArea2d(loop.points)) === Math.sign(domainArea) ? loop : reverseDomainLoop(loop)
  ));
  orientedLoops.sort((a, b) => Math.abs(signedArea2d(b.points)) - Math.abs(signedArea2d(a.points)));
  if (orientedLoops.length > 1) {
    diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region produced multiple remaining loops; multi-loop topology is not implemented by the current chart renderer.", "sheet-metal.chart-domain.multi-loop-unsupported"));
    return unchanged();
  }
  return {
    domain: createSingleLoopChartDomain(orientedLoops[0].points, orientedLoops[0].edges, {
      ...metadata,
      intervalCount: 0
    }),
    diagnostics,
    applied: true
  };
}

export function createSingleLoopPolygonSet2d(points = [], edges = [], metadata = {}) {
  const cleanPoints = cleanLoop2d(points);
  const cleanEdges = normalizeBoundaryEdges(edges, cleanPoints.length);
  return {
    kind: "polygon-set",
    coordinateSystem: metadata.coordinateSystem || "chart-2d",
    supportedTopology: "single-outer-loop",
    operation: metadata.operation || "identity",
    strategy: metadata.strategy || "domain-loop",
    loops: [{
      role: "outer",
      points: cleanPoints,
      edges: cleanEdges
    }],
    holes: [],
    metadata: { ...metadata }
  };
}

export function createSingleLoopChartDomain(points = [], edges = [], metadata = {}) {
  return createSingleLoopPolygonSet2d(points, edges, {
    ...metadata,
    coordinateSystem: "chart-2d"
  });
}

export function differenceSingleLoopChartDomainByCutoutRegions(domain, cutoutApplications = [], metadata = {}) {
  const applications = Array.isArray(cutoutApplications) ? cutoutApplications : [];
  const diagnostics = [];
  const original = chartDomainBoundary2d(domain);
  let currentDomain = domain;
  let acceptedCutoutRegionCount = 0;
  let appliedCutoutRegionCount = 0;
  const operationMetadata = {
    ...metadata,
    operation: metadata.operation || "difference",
    domainOperation: "cutout-region-difference",
    booleanBackend: metadata.booleanBackend || "simple-polygon-segment-graph",
    cutoutRegionCount: applications.length,
    acceptedCutoutRegionCount: 0,
    appliedCutoutRegionCount: 0
  };
  for (const application of applications) {
    const region = application?.cutoutRegion2d || application?.region || application;
    if (!region || region.kind !== "polygon-set") {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout application does not carry a runtime polygon-set cutout region."));
      continue;
    }
    if (region.coordinateSystem !== "chart-2d") {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region must be expressed in chart-2d coordinates.", "sheet-metal.chart-domain.cutout-region-coordinate-system"));
      continue;
    }
    if (region.metadata?.purpose !== "cutout" && region.operation !== "cutout-region") {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region is not marked as a cutout.", "sheet-metal.chart-domain.cutout-region-purpose"));
      continue;
    }
    if (chartDomainBoundary2d(region).length < 3) {
      diagnostics.push(cutoutRegionDiagnostics(application, "Chart cutout region has fewer than three boundary points.", "sheet-metal.chart-domain.cutout-region-too-small"));
      continue;
    }
    acceptedCutoutRegionCount += 1;
    const difference = differenceSingleLoopByOneCutoutRegion(currentDomain, application, region, {
      ...operationMetadata,
      acceptedCutoutRegionCount,
      appliedCutoutRegionCount
    });
    diagnostics.push(...difference.diagnostics);
    if (!difference.diagnostics.some((diagnostic) => diagnostic.severity === "error") && difference.applied) {
      currentDomain = difference.domain;
      appliedCutoutRegionCount += 1;
    }
  }
  const finalMetadata = {
    ...operationMetadata,
    acceptedCutoutRegionCount,
    appliedCutoutRegionCount
  };
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      domain: createSingleLoopChartDomain(original, chartDomainBoundaryEdges(domain), {
        ...finalMetadata,
        status: "invalid"
      }),
      diagnostics
    };
  }
  return {
    domain: createSingleLoopChartDomain(chartDomainBoundary2d(currentDomain), chartDomainBoundaryEdges(currentDomain), {
      ...finalMetadata,
      intervalCount: 0
    }),
    diagnostics
  };
}

export function chartDomainBoundary2d(domain) {
  const loop = domain?.loops?.find?.((candidate) => candidate.role === "outer") || domain?.loops?.[0];
  return Array.isArray(loop?.points) ? loop.points.map(clonePoint2) : [];
}

export function chartDomainBoundaryEdges(domain) {
  const loop = domain?.loops?.find?.((candidate) => candidate.role === "outer") || domain?.loops?.[0];
  return Array.isArray(loop?.edges) ? loop.edges.map((edge) => ({ ...edge })) : [];
}

export function chartDomainDiagnostics(domain, chart = {}) {
  const diagnostics = [];
  if (!domain || domain.kind !== "polygon-set") {
    return [{
      severity: "error",
      code: "sheet-metal.chart-domain.invalid",
      message: `Sheet chart ${chart?.id || "(unknown)"} domain is not a runtime polygon-set.`
    }];
  }
  if (domain.coordinateSystem !== "chart-2d") {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.coordinate-system",
      message: `Sheet chart ${chart?.id || "(unknown)"} domain is not in chart-2d coordinates.`
    });
  }
  if (domain.supportedTopology !== "single-outer-loop" || (domain.holes || []).length) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.unsupported-topology",
      message: `Sheet chart ${chart?.id || "(unknown)"} requires polygon boolean topology that is not implemented by the current chart renderer.`
    });
  }
  const boundary = chartDomainBoundary2d(domain);
  const invalidIndex = boundary.findIndex((point) => !finitePoint2(point));
  if (invalidIndex >= 0) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.non-finite-point",
      message: `Sheet chart ${chart?.id || "(unknown)"} boundary contains a non-finite point at index ${invalidIndex}.`
    });
  }
  if (boundary.length < 3) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.too-few-points",
      message: `Sheet chart ${chart?.id || "(unknown)"} boundary has fewer than three usable points.`
    });
  } else if (Math.abs(signedArea2d(boundary)) <= EPSILON) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.zero-area",
      message: `Sheet chart ${chart?.id || "(unknown)"} boundary has zero or near-zero developed area.`
    });
  }
  const duplicateIndex = boundary.findIndex((point, index) => index > 0 && samePoint2(boundary[index - 1], point));
  if (duplicateIndex >= 0) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.duplicate-point",
      message: `Sheet chart ${chart?.id || "(unknown)"} boundary has duplicate consecutive points.`
    });
  }
  const selfIntersection = boundary.length >= 4 ? selfIntersectionSegmentIndexes(boundary) : null;
  if (selfIntersection) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.chart-domain.self-intersection",
      message: `Sheet chart ${chart?.id || "(unknown)"} boundary self-intersects between segments ${selfIntersection[0]} and ${selfIntersection[1]}.`
    });
  }
  return diagnostics;
}
