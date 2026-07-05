import { distance2, finitePositiveNumber, v } from "../../core/math.mjs";
import { signedArea2d, triangulateFace } from "../polygon.mjs";
import { buildClippedReliefChartDomains } from "./relief-cutouts.mjs";
import {
  chartDomainBoundary2d,
  chartDomainBoundaryEdges,
  chartDomainDiagnostics
} from "./chart-domain.mjs";

const EPSILON = 1e-7;

function finitePoint2(point) {
  return Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function finitePoint3(point) {
  return v.isVec3(point);
}

function samePoint2(a, b, tolerance = EPSILON) {
  return finitePoint2(a) && finitePoint2(b) && distance2(a, b) <= tolerance;
}

function cleanLoop2d(points = []) {
  const clean = [];
  for (const point of points) {
    if (!finitePoint2(point)) continue;
    const previous = clean[clean.length - 1];
    if (!previous || !samePoint2(previous, point)) clean.push([...point]);
  }
  if (clean.length > 1 && samePoint2(clean[0], clean[clean.length - 1])) clean.pop();
  return clean;
}

function chartRuntimeDomain(chart) {
  return chart?.chartDomain2d || null;
}

function chartBoundary2d(chart) {
  return cleanLoop2d(chartDomainBoundary2d(chartRuntimeDomain(chart)));
}

function chartBoundaryEdges(chart) {
  return chartDomainBoundaryEdges(chartRuntimeDomain(chart));
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

function uniqueSortedNumbers(values, tolerance = EPSILON) {
  return values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b)
    .filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > tolerance);
}

function horizontalBoundaryIntervals(boundary, u, length) {
  const intersections = [];
  for (let index = 0; index < boundary.length; index += 1) {
    const a = boundary[index];
    const b = boundary[(index + 1) % boundary.length];
    if (!finitePoint2(a) || !finitePoint2(b)) continue;
    const dy = b[1] - a[1];
    if (Math.abs(dy) <= EPSILON) {
      if (Math.abs(u - a[1]) <= EPSILON) intersections.push(a[0], b[0]);
      continue;
    }
    const minY = Math.min(a[1], b[1]);
    const maxY = Math.max(a[1], b[1]);
    if (u < minY - EPSILON || u >= maxY - EPSILON) continue;
    const t = (u - a[1]) / dy;
    if (t < -EPSILON || t > 1 + EPSILON) continue;
    intersections.push(a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, t)));
  }
  const xs = uniqueSortedNumbers(
    intersections.map((value) => Math.max(0, Math.min(length, value)))
  );
  const intervals = [];
  for (let index = 0; index + 1 < xs.length; index += 2) {
    if (xs[index + 1] - xs[index] > EPSILON) {
      intervals.push({ minS: xs[index], maxS: xs[index + 1] });
    }
  }
  return {
    intersections: xs,
    intervals,
    oddIntersectionCount: xs.length % 2 !== 0
  };
}

function bendHorizontalIntervalDiagnostics(chart, boundary) {
  if (chart?.kind !== "bend") return [];
  const length = Math.max(0, chart.length || 0);
  const height = Math.max(0, chart.developedWidth || 0);
  if (length <= EPSILON || height <= EPSILON || boundary.length < 3) return [];
  const yValues = uniqueSortedNumbers([
    0,
    height,
    ...boundary.map((point) => Math.max(0, Math.min(height, point[1])))
  ]);
  const samples = new Set();
  for (let index = 0; index + 1 < yValues.length; index += 1) {
    const midpoint = (yValues[index] + yValues[index + 1]) / 2;
    if (midpoint > EPSILON && midpoint < height - EPSILON) samples.add(midpoint);
  }
  for (const u of [...samples].sort((a, b) => a - b)) {
    const { intervals, oddIntersectionCount } = horizontalBoundaryIntervals(boundary, u, length);
    if (oddIntersectionCount) {
      return [{
        severity: "error",
        code: "sheet-metal.chart-domain.odd-horizontal-intersections",
        message: `Sheet bend chart ${chart?.id || "(unknown)"} has an odd number of horizontal boundary intersections at u=${u}.`
      }];
    }
  }
  return [];
}

function chartBoundaryDiagnostics(chart) {
  const domain = chartRuntimeDomain(chart);
  const clean = chartBoundary2d(chart);
  const diagnostics = chartDomainDiagnostics(domain, chart);
  diagnostics.push(...bendHorizontalIntervalDiagnostics(chart, clean));
  return diagnostics;
}

function faceHasArea(points, tolerance = 1e-8) {
  if (!Array.isArray(points) || points.length < 3 || points.some((point) => !finitePoint3(point))) return false;
  for (let index = 1; index + 1 < points.length; index += 1) {
    if (v.len(v.cross(v.sub(points[index], points[0]), v.sub(points[index + 1], points[0]))) > tolerance) return true;
  }
  return false;
}

function pushFace(faces, points, meta = {}) {
  if (faceHasArea(points)) faces.push({ points, ...meta });
}

function pushLine(lines, points, meta = {}) {
  const clean = points.filter(finitePoint3);
  if (clean.length >= 2 && clean.slice(1).some((point) => v.len(v.sub(point, clean[0])) > EPSILON)) {
    lines.push({ points: clean, ...meta });
  }
}

function sceneGeometryDiagnostics(result) {
  const diagnostics = [];
  for (const [index, face] of (result.faces || []).entries()) {
    if (!faceHasArea(face.points)) {
      diagnostics.push({
        severity: "error",
        code: "sheet-metal.chart-scene.degenerate-face",
        message: `Sheet chart scene face ${index} is non-finite or has zero area.`
      });
    }
  }
  for (const [index, line] of (result.lines || []).entries()) {
    const points = line.points || [];
    if (points.length < 2 || points.some((point) => !finitePoint3(point))) {
      diagnostics.push({
        severity: "error",
        code: "sheet-metal.chart-scene.invalid-line",
        message: `Sheet chart scene line ${index} is non-finite or has fewer than two points.`
      });
      continue;
    }
    if (points.every((point, pointIndex) => pointIndex === 0 || v.len(v.sub(point, points[0])) <= EPSILON)) {
      diagnostics.push({
        severity: "error",
        code: "sheet-metal.chart-scene.zero-length-line",
        message: `Sheet chart scene line ${index} has zero length.`
      });
    }
  }
  return diagnostics;
}

function chartMeta(chart) {
  return {
    sheetChartId: chart.id,
    sheetChartKind: chart.kind,
    ...(chart.ownerBendId ? { bendId: chart.ownerBendId } : {}),
    ...(chart.kind === "bend" ? { bendFaceRole: "radius" } : {}),
    ...(chart.kind === "flange" ? { bendFaceRole: "flange" } : {})
  };
}

function reliefBoundaryMeta(edge = {}) {
  if (edge.source !== "relief" || !edge.reliefSiteKey) return {};
  return {
    cornerReliefSiteKey: edge.reliefSiteKey,
    ...(edge.reliefVertexId ? { cornerReliefVertexId: edge.reliefVertexId } : {}),
    cornerReliefRole: "side",
    cornerReliefBoundaryRole: edge.cornerReliefRole || "cut-boundary",
    hideEdges: true
  };
}

function mapChartPoint(chart, point, sideOffset) {
  const mapped = chart.mapTo3d(point, sideOffset);
  return finitePoint3(mapped) ? mapped : null;
}

function triangulateBoundary2d(boundary) {
  const clean = cleanLoop2d(boundary);
  if (clean.length < 3 || Math.abs(signedArea2d(clean)) <= EPSILON) return [];
  const flat = clean.map((point) => [point[0], point[1], 0]);
  return triangulateFace(flat).map((triangle) => triangle.map((point) => [point[0], point[1]]));
}

function addPlanarChartGeometry(result, chart, thickness) {
  const boundary = chartBoundary2d(chart);
  if (boundary.length < 3) return;
  const half = thickness / 2;
  const baseMeta = chartMeta(chart);
  const triangles = triangulateBoundary2d(boundary);

  for (const triangle of triangles) {
    const back = triangle.map((point) => mapChartPoint(chart, point, -half));
    const front = triangle.map((point) => mapChartPoint(chart, point, half));
    if (back.every(Boolean)) pushFace(result.faces, back, { ...baseMeta, sheetChartFaceRole: "back", hideEdges: true });
    if (front.every(Boolean)) pushFace(result.faces, [...front].reverse(), { ...baseMeta, sheetChartFaceRole: "front", hideEdges: true });
  }

  const backBoundary = boundary.map((point) => mapChartPoint(chart, point, -half));
  const frontBoundary = boundary.map((point) => mapChartPoint(chart, point, half));
  const edges = chartBoundaryEdges(chart);
  for (let index = 0; index < boundary.length; index += 1) {
    const next = (index + 1) % boundary.length;
    const edge = edges.find((candidate) => candidate.startIndex === index && candidate.endIndex === next) || {};
    const edgeMeta = { ...baseMeta, ...reliefBoundaryMeta(edge), sheetChartBoundarySource: edge.source || "domain" };
    if (backBoundary[index] && backBoundary[next] && frontBoundary[index] && frontBoundary[next]) {
      pushFace(result.faces, [backBoundary[index], backBoundary[next], frontBoundary[next], frontBoundary[index]], {
        ...edgeMeta,
        sheetChartFaceRole: "thickness-side"
      });
      pushLine(result.lines, [backBoundary[index], backBoundary[next]], { ...edgeMeta, sheetChartLineRole: "back-boundary" });
      pushLine(result.lines, [frontBoundary[index], frontBoundary[next]], { ...edgeMeta, sheetChartLineRole: "front-boundary" });
      if (edge.source !== "relief") {
        pushLine(result.lines, [backBoundary[index], frontBoundary[index]], { ...edgeMeta, sheetChartLineRole: "thickness" });
      }
    }
  }
}

function endpointCutoutByEndpoint(chart) {
  const result = new Map();
  for (const cutout of chart?.cutoutApplications || []) {
    if (!["circular", "rectangular", "obround"].includes(cutout.type) || !cutout.endpoint) continue;
    if (!result.has(cutout.endpoint)) result.set(cutout.endpoint, cutout);
  }
  return result;
}

function bendChartRows(chart, cutouts, options = {}) {
  const height = Math.max(0, chart.developedWidth || 0);
  const length = Math.max(0, chart.length || 0);
  if (height <= EPSILON || length <= EPSILON) return [];
  const boundary = chartBoundary2d(chart);
  if (boundary.length < 3) return [];
  const segmentLength = finitePositiveNumber(options.segmentLength) ? options.segmentLength : Math.max(height / 12, 1);
  const uniformCount = Math.max(2, Math.ceil(height / segmentLength));
  const uValues = new Set([0, height]);
  for (let index = 1; index < uniformCount; index += 1) uValues.add(height * index / uniformCount);
  for (const point of boundary) uValues.add(Math.max(0, Math.min(height, point[1])));
  for (const cutout of cutouts.values()) {
    for (const point of cutout.points2d || []) {
      if (finitePoint2(point)) uValues.add(Math.max(0, Math.min(height, point[1])));
    }
    if (cutout.chartDepthLimit > 0) {
      uValues.add(Math.max(0, Math.min(height, cutout.chartDepthLimit)));
    }
  }
  const sorted = [...uValues].sort((a, b) => a - b);
  const rows = [];
  for (const u of sorted) {
    const { intervals, oddIntersectionCount } = horizontalBoundaryIntervals(boundary, u, length);
    if (oddIntersectionCount || !intervals.length) continue;
    const startCutout = cutouts.get("start");
    const endCutout = cutouts.get("end");
    const rowIntervals = intervals
      .filter((interval) => interval.maxS - interval.minS > EPSILON)
      .map((interval) => {
        const minS = interval.minS;
        const maxS = interval.maxS;
        return {
          minS,
          maxS,
          start: [minS, u],
          end: [maxS, u],
          startRelief: Boolean(startCutout) && minS > EPSILON,
          endRelief: Boolean(endCutout) && maxS < length - EPSILON,
          startSiteKey: startCutout?.siteKey || "",
          endSiteKey: endCutout?.siteKey || "",
          startReliefVertexId: startCutout?.cornerReliefVertexId || "",
          endReliefVertexId: endCutout?.cornerReliefVertexId || "",
          startReliefType: startCutout?.type || "",
          endReliefType: endCutout?.type || ""
        };
      });
    if (!rowIntervals.length) continue;
    rows.push({
      u,
      intervals: rowIntervals
    });
  }
  return rows;
}

function intervalOverlap(a, b) {
  return Math.min(a.maxS, b.maxS) - Math.max(a.minS, b.minS);
}

function intervalCenter(interval) {
  return (interval.minS + interval.maxS) / 2;
}

function pairedRowIntervals(currentRow, nextRow) {
  const pairs = [];
  const used = new Set();
  for (const current of currentRow.intervals || []) {
    let bestIndex = -1;
    let bestOverlap = 0;
    for (const [index, next] of (nextRow.intervals || []).entries()) {
      if (used.has(index)) continue;
      const overlap = intervalOverlap(current, next);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIndex = index;
      }
    }
    if (bestIndex < 0 && currentRow.intervals?.length === nextRow.intervals?.length) {
      bestIndex = (currentRow.intervals || []).indexOf(current);
    }
    if (bestIndex < 0) {
      let bestDistance = Infinity;
      for (const [index, next] of (nextRow.intervals || []).entries()) {
        if (used.has(index)) continue;
        const distance = Math.abs(intervalCenter(current) - intervalCenter(next));
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      pairs.push([current, nextRow.intervals[bestIndex]]);
    }
  }
  return pairs;
}

function intervalSideMeta(chart, current, next, side) {
  const baseMeta = chartMeta(chart);
  const relief = side === "start"
    ? (current.startRelief || next.startRelief)
    : (current.endRelief || next.endRelief);
  const siteKey = side === "start"
    ? (current.startSiteKey || next.startSiteKey)
    : (current.endSiteKey || next.endSiteKey);
  const reliefVertexId = side === "start"
    ? (current.startReliefVertexId || next.startReliefVertexId)
    : (current.endReliefVertexId || next.endReliefVertexId);
  const reliefType = side === "start"
    ? (current.startReliefType || next.startReliefType)
    : (current.endReliefType || next.endReliefType);
  return {
    ...baseMeta,
    ...(relief && siteKey ? {
      cornerReliefSiteKey: siteKey,
      ...(reliefVertexId ? { cornerReliefVertexId: reliefVertexId } : {}),
      ...(reliefType ? { cornerReliefType: reliefType } : {}),
      cornerReliefRole: "side",
      cornerReliefBoundaryRole: "cut-boundary",
      hideEdges: true,
      sheetChartBoundarySource: "relief"
    } : { sheetChartBoundarySource: "domain" }),
    sheetChartBoundarySide: side
  };
}

function isCircularReliefSide(edgeMeta = {}) {
  return edgeMeta.sheetChartBoundarySource === "relief" && edgeMeta.cornerReliefType === "circular";
}

function addBendBoundarySide(result, chart, rows, side, thickness) {
  const half = thickness / 2;
  for (let index = 0; index + 1 < rows.length; index += 1) {
    for (const [current, next] of pairedRowIntervals(rows[index], rows[index + 1])) {
    const point = side === "start" ? "start" : "end";
    const edgeMeta = intervalSideMeta(chart, current, next, side);
    const circularReliefSide = isCircularReliefSide(edgeMeta);
    const aBack = mapChartPoint(chart, current[point], -half);
    const bBack = mapChartPoint(chart, next[point], -half);
    const aFront = mapChartPoint(chart, current[point], half);
    const bFront = mapChartPoint(chart, next[point], half);
    if (aBack && bBack && aFront && bFront) {
      pushFace(result.faces, side === "start"
        ? [aBack, bBack, bFront, aFront]
        : [aBack, aFront, bFront, bBack], {
        ...edgeMeta,
        sheetChartFaceRole: edgeMeta.cornerReliefSiteKey ? "relief-side" : "thickness-side",
        ...(circularReliefSide ? { unlit: true } : {})
      });
      if (!circularReliefSide) {
        pushLine(result.lines, [aBack, bBack], { ...edgeMeta, sheetChartLineRole: "back-boundary" });
        pushLine(result.lines, [aFront, bFront], { ...edgeMeta, sheetChartLineRole: "front-boundary" });
      }
    }
  }
  }
}

function addBendChartGeometry(result, evaluation, chart, thickness, options = {}) {
  const cutouts = endpointCutoutByEndpoint(chart);
  const rows = bendChartRows(chart, cutouts, options);
  if (rows.length < 2) return;
  const half = thickness / 2;
  const baseMeta = chartMeta(chart);

  for (let index = 0; index + 1 < rows.length; index += 1) {
    for (const [current, next] of pairedRowIntervals(rows[index], rows[index + 1])) {
    const back = [
      mapChartPoint(chart, current.start, -half),
      mapChartPoint(chart, current.end, -half),
      mapChartPoint(chart, next.end, -half),
      mapChartPoint(chart, next.start, -half)
    ];
    const front = [
      mapChartPoint(chart, current.start, half),
      mapChartPoint(chart, next.start, half),
      mapChartPoint(chart, next.end, half),
      mapChartPoint(chart, current.end, half)
    ];
    if (back.every(Boolean)) pushFace(result.faces, back, { ...baseMeta, sheetChartFaceRole: "back", hideEdges: true });
    if (front.every(Boolean)) pushFace(result.faces, front, { ...baseMeta, sheetChartFaceRole: "front", hideEdges: true });
  }
  }

  addBendBoundarySide(result, chart, rows, "start", thickness);
  addBendBoundarySide(result, chart, rows, "end", thickness);

  for (const row of [rows[0], rows[rows.length - 1]]) {
    const side = row.u <= EPSILON ? "bend-start" : "bend-end";
    const edgeMeta = { ...baseMeta, sheetChartBoundarySource: "domain", sheetChartBoundarySide: side };
    for (const interval of row.intervals || []) {
    const backStart = mapChartPoint(chart, interval.start, -half);
    const backEnd = mapChartPoint(chart, interval.end, -half);
    const frontStart = mapChartPoint(chart, interval.start, half);
    const frontEnd = mapChartPoint(chart, interval.end, half);
    if (backStart && backEnd && frontStart && frontEnd) {
      pushFace(result.faces, [backStart, backEnd, frontEnd, frontStart], { ...edgeMeta, sheetChartFaceRole: "thickness-side" });
      pushLine(result.lines, [backStart, backEnd], { ...edgeMeta, sheetChartLineRole: "back-boundary" });
      pushLine(result.lines, [frontStart, frontEnd], { ...edgeMeta, sheetChartLineRole: "front-boundary" });
    }
  }
  }
}

function unsupportedChartReason(evaluation) {
  const evaluationErrors = (evaluation?.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
  if (evaluationErrors.length) {
    return evaluationErrors.map((diagnostic) => diagnostic.message).join("; ");
  }
  const unsupportedSpecs = [...(evaluation?.specs?.values?.() || [])].filter((spec) => spec && !["circular", "rectangular", "obround"].includes(spec.type));
  if (unsupportedSpecs.length) {
    return `unsupported corner relief types: ${[...new Set(unsupportedSpecs.map((spec) => spec.type))].join(", ")}`;
  }
  const boundaryErrors = (evaluation?.charts || [])
    .flatMap((chart) => chartBoundaryDiagnostics(chart))
    .filter((diagnostic) => diagnostic.severity === "error");
  if (boundaryErrors.length) {
    return boundaryErrors.map((diagnostic) => diagnostic.message).join("; ");
  }
  return "";
}

function chartSceneErrorReason(result) {
  const sceneErrors = (result?.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
  return sceneErrors.map((diagnostic) => diagnostic.message).join("; ");
}

export function evaluateBentPlateChartGeometryFromEvaluation(evaluation, plate, options = {}) {
  const result = {
    faces: [],
    lines: [],
    diagnostics: [...(evaluation.diagnostics || [])],
    evaluation
  };
  const unsupported = unsupportedChartReason(evaluation);
  if (unsupported) {
    result.diagnostics.push({ severity: "error", code: "sheet-metal.chart-relief.unsupported", message: unsupported });
  }
  const thickness = Math.max(0, plate?.thickness || 0);
  for (const chart of evaluation.charts || []) {
    const diagnostics = chartBoundaryDiagnostics(chart);
    result.diagnostics.push(...diagnostics);
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) continue;
    if (chart.kind === "bend") addBendChartGeometry(result, evaluation, chart, thickness, options);
    else addPlanarChartGeometry(result, chart, thickness);
  }
  result.diagnostics.push(...sceneGeometryDiagnostics(result));
  return result;
}

export function chartReliefGeometrySupport(plate, options = {}) {
  const evaluation = buildClippedReliefChartDomains(plate, options);
  const structuralReason = unsupportedChartReason(evaluation);
  const sceneReason = structuralReason ? "" : chartSceneErrorReason(evaluateBentPlateChartGeometryFromEvaluation(evaluation, plate, options));
  const reason = structuralReason || sceneReason;
  const bendOnBend = (evaluation.charts || []).some((chart) => chart.parentBendId);
  return {
    supported: !reason,
    reason,
    evaluation,
    bendOnBend
  };
}

export function evaluateBentPlateChartGeometry(plate, options = {}) {
  const evaluation = buildClippedReliefChartDomains(plate, options);
  return evaluateBentPlateChartGeometryFromEvaluation(evaluation, plate, options);
}
