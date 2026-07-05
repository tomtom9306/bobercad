import { clamp, distance2, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs";
import { plateBends, plateOutline, sketchEdgePoints, sketchEdges, sketchVertexPointMap } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { signedArea2d } from "../../engine/geometry/polygon.mjs";

function bendTargetKey(target) {
  if (target?.parentBendId) return `bend:${target.parentBendId}:${target.parentEdge || "outer"}`;
  return `sketch:${target?.edgeId || target?.edge?.id || ""}`;
}

function pushUniquePolygonVertex(vertices, vertex, tolerance = 1e-7) {
  if (!vertex?.point) return;
  const previous = vertices[vertices.length - 1];
  if (previous && distance2(previous.point, vertex.point) <= tolerance) return;
  vertices.push(vertex);
}

function clipPolygonVerticesByHalfPlane(vertices, linePoint, outward, tolerance = 1e-7) {
  if (!vertices.length) return [];
  const signedDistance = (point) => (
    (point[0] - linePoint[0]) * outward[0]
      + (point[1] - linePoint[1]) * outward[1]
  );
  const clipped = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const previous = vertices[(index + vertices.length - 1) % vertices.length];
    const currentDistance = signedDistance(current.point);
    const previousDistance = signedDistance(previous.point);
    const currentInside = currentDistance <= tolerance;
    const previousInside = previousDistance <= tolerance;
    if (currentInside !== previousInside) {
      const denominator = previousDistance - currentDistance;
      if (Math.abs(denominator) > 1e-9) {
        const t = previousDistance / denominator;
        pushUniquePolygonVertex(clipped, {
          point: [
            previous.point[0] + (current.point[0] - previous.point[0]) * t,
            previous.point[1] + (current.point[1] - previous.point[1]) * t
          ],
          sourceIndex: null
        });
      }
    }
    if (currentInside) pushUniquePolygonVertex(clipped, current);
  }
  if (clipped.length > 1 && distance2(clipped[0].point, clipped[clipped.length - 1].point) <= tolerance) {
    clipped.pop();
  }
  return clipped;
}

function clipBaseOutlineForBendInsets(baseOutline, clipSpecs = []) {
  let vertices = (baseOutline.points || []).map((point, index) => ({ point, sourceIndex: index }));
  for (const clip of clipSpecs) {
    if (!vertices.length || !(clip.offset > 1e-6)) continue;
    const linePoint = [
      clip.start[0] - clip.outward[0] * clip.offset,
      clip.start[1] - clip.outward[1] * clip.offset
    ];
    vertices = clipPolygonVerticesByHalfPlane(vertices, linePoint, clip.outward);
  }
  const smoothSourceIndices = new Set(baseOutline.smoothVertexIndices || []);
  const smoothVertexIndices = [];
  vertices.forEach((vertex, index) => {
    if (smoothSourceIndices.has(vertex.sourceIndex)) smoothVertexIndices.push(index);
  });
  return {
    points: vertices.map((vertex) => vertex.point),
    smoothVertexIndices
  };
}

function shrinkEdge(start, end, startAmount = 0, endAmount = startAmount) {
  const tangent = v.sub(end, start);
  const length = v.len(tangent);
  if (length <= 1e-6) return null;
  const startCapped = clamp(startAmount, 0, length * 0.45);
  const endCapped = clamp(endAmount, 0, length * 0.45);
  const axis = v.mul(tangent, 1 / length);
  return {
    start: v.add(start, v.mul(axis, startCapped)),
    end: v.add(end, v.mul(axis, -endCapped)),
    tangent: axis,
    length: length - startCapped - endCapped
  };
}

function bendEndpointGap(bend, endpoint, plate) {
  const endpointKey = endpoint === "end" ? "endGap" : "startGap";
  return finiteNumberOr(
    bend?.[endpointKey],
    finiteNumberOr(bend?.gap, finiteNumberOr(plate?.fabrication?.bendGap, 0))
  );
}

function bendAngleRadians(bend) {
  return Math.abs(finiteNumberOr(bend?.angle, 90)) * Math.PI / 180;
}

function bendOutwardLimitOffset(radius, angle, thickness = 0) {
  const bendRadius = Math.max(0, finiteNumberOr(radius, 0));
  const bendAngle = Math.max(0, finiteNumberOr(angle, 0));
  if (bendRadius <= 1e-6 || bendAngle <= 1e-6) return 0;
  if (bendAngle >= Math.PI / 2) return bendRadius;
  return bendRadius * Math.sin(bendAngle);
}

function bendCurveRadiusForTarget(radius, thickness, target) {
  const bendRadius = Math.max(0, finiteNumberOr(radius, 0));
  if (target?.edgeRole === "sketch") return bendRadius;
  return Math.max(0, bendRadius - Math.max(0, finiteNumberOr(thickness, 0)) / 2);
}

function bendSegmentCount(angle, radius, options = {}) {
  if (finiteNumber(options.segmentLength) && options.segmentLength > 0 && finiteNumber(radius) && radius > 0) {
    return Math.max(2, Math.ceil(Math.abs(angle) * radius / options.segmentLength));
  }
  const fullCircleSegments = Number.isInteger(options.circleSegments) && options.circleSegments >= 3
    ? options.circleSegments
    : 32;
  return Math.max(2, Math.ceil(Math.abs(angle) / (Math.PI * 2) * fullCircleSegments));
}

function bendCurveTangent(outward, sourceNormal, direction, theta) {
  return v.norm(v.add(v.mul(outward, Math.cos(theta)), v.mul(sourceNormal, direction * Math.sin(theta))));
}

function bendCurvePoint(basePoint, outward, sourceNormal, direction, radius, theta) {
  return v.add(
    basePoint,
    v.add(
      v.mul(outward, radius * Math.sin(theta)),
      v.mul(sourceNormal, direction * radius * (1 - Math.cos(theta)))
    )
  );
}

function bendSurfaceSegments(edge, target, bend, angle, direction, radius, options = {}) {
  if (!finiteNumber(radius) || radius <= 1e-6 || Math.abs(angle) <= 1e-6) {
    return {
      start: edge.start,
      end: edge.end,
      unadjustedStart: edge.start,
      unadjustedEnd: edge.end,
      surfaces: []
    };
  }
  const segments = bendSegmentCount(angle, radius, options);
  const samples = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = index / segments * angle;
    const tangent = bendCurveTangent(target.outward, target.sourceNormal, direction, theta);
    const sampleNormal = v.norm(v.cross(edge.tangent, tangent));
    const unadjustedStart = bendCurvePoint(edge.start, target.outward, target.sourceNormal, direction, radius, theta);
    const unadjustedEnd = bendCurvePoint(edge.end, target.outward, target.sourceNormal, direction, radius, theta);
    samples.push({
      start: unadjustedStart,
      end: unadjustedEnd,
      unadjustedStart,
      unadjustedEnd,
      normal: sampleNormal
    });
  }

  const surfaces = [];
  for (let index = 0; index < segments; index += 1) {
    const theta = (index + 0.5) / segments * angle;
    const tangent = bendCurveTangent(target.outward, target.sourceNormal, direction, theta);
    surfaces.push({
      bend,
      segmentIndex: index,
      radius,
      angle,
      edgeStart: samples[index].start,
      edgeEnd: samples[index].end,
      points: [
        samples[index].start,
        samples[index].end,
        samples[index + 1].end,
        samples[index + 1].start
      ],
      normal: v.norm(v.cross(edge.tangent, tangent)),
      startNormal: samples[index].normal,
      endNormal: samples[index + 1].normal
    });
  }
  return {
    start: samples[segments].start,
    end: samples[segments].end,
    unadjustedStart: samples[segments].unadjustedStart,
    unadjustedEnd: samples[segments].unadjustedEnd,
    surfaces,
    strip: {
      bend,
      radius,
      angle,
      edgeTangent: edge.tangent,
      samples
    }
  };
}

export function plateBendGeometry(plate, options = {}) {
  const bends = plateBends(plate);
  const y = v.norm(plate.localAxisY);
  const z = v.norm(plate.localAxisZ);
  const n = v.norm(plate.normal);
  const outline = plateOutline(plate);
  const area = signedArea2d(outline);
  const toWorld = (point) => v.add(plate.center, v.add(v.mul(y, point[0]), v.mul(z, point[1])));
  const rootBendByEdgeId = new Map(
    bends
      .filter((bend) => !bend.parentBendId && bend.edgeId)
      .map((bend) => [bend.edgeId, bend])
  );
  const targetEdges = [];
  const baseClipSpecs = [];
  const panels = [];
  const bendSurfaces = [];
  const bendSurfaceStrips = [];
  const vertexMap = sketchVertexPointMap(plate.sketch);

  for (const edge of sketchEdges(plate.sketch)) {
    const { a, b } = sketchEdgePoints(plate.sketch, edge, vertexMap);
    const edge2 = [b[0] - a[0], b[1] - a[1]];
    const edgeLength = distance2(a, b);
    if (edgeLength <= 1e-6) continue;
    const tangent2 = [edge2[0] / edgeLength, edge2[1] / edgeLength];
    const outward2 = area >= 0 ? [tangent2[1], -tangent2[0]] : [-tangent2[1], tangent2[0]];
    const rootBend = rootBendByEdgeId.get(edge.id);
    const rootBendClipOffset = rootBend
      ? bendOutwardLimitOffset(rootBend.radius, bendAngleRadians(rootBend), plate.thickness)
      : 0;
    if (rootBendClipOffset > 1e-6) {
      baseClipSpecs.push({
        start: a,
        outward: outward2,
        offset: rootBendClipOffset
      });
    }
    targetEdges.push({
      id: `sketch:${edge.id}`,
      edgeId: edge.id,
      startVertexId: edge.from,
      endVertexId: edge.to,
      edgeRole: "sketch",
      start: toWorld(a),
      end: toWorld(b),
      sourceNormal: n,
      outward: v.norm(v.add(v.mul(y, outward2[0]), v.mul(z, outward2[1])))
    });
  }
  const baseOutline = clipBaseOutlineForBendInsets(
    { points: outline, smoothVertexIndices: [] },
    baseClipSpecs
  );
  const basePoints = baseOutline.points.map(toWorld);

  const unresolved = [...bends];
  for (let guard = 0; unresolved.length && guard < bends.length + 5; guard += 1) {
    let progressed = false;
    for (let index = unresolved.length - 1; index >= 0; index -= 1) {
      const bend = unresolved[index];
      const target = targetEdges.find((edge) => edge.id === bendTargetKey(bend));
      if (!target) continue;
      const angle = bendAngleRadians(bend);
      const bendRadius = finiteNumberOr(bend.radius, 0);
      const bendCurveRadius = bendCurveRadiusForTarget(bendRadius, plate.thickness, target);
      const bendLineInset = bendOutwardLimitOffset(bendCurveRadius, angle, plate.thickness);
      const bendLineStart = v.add(target.start, v.mul(target.outward, -bendLineInset));
      const bendLineEnd = v.add(target.end, v.mul(target.outward, -bendLineInset));
      const startGap = bendEndpointGap(bend, "start", plate);
      const endGap = bendEndpointGap(bend, "end", plate);
      const edge = shrinkEdge(
        bendLineStart,
        bendLineEnd,
        startGap,
        endGap
      );
      if (!edge || edge.length <= 1e-6) {
        unresolved.splice(index, 1);
        progressed = true;
        continue;
      }
      const direction = bend.direction === "down" ? -1 : 1;
      const flangeDir = v.norm(v.add(v.mul(target.outward, Math.cos(angle)), v.mul(target.sourceNormal, direction * Math.sin(angle))));
      const flangeNormal = v.norm(v.cross(edge.tangent, flangeDir));
      const flangeLength = finiteNumberOr(bend.flangeLength, 0);
      if (flangeLength <= 1e-6) {
        unresolved.splice(index, 1);
        progressed = true;
        continue;
      }
      const bendSurface = bendSurfaceSegments(edge, target, bend, angle, direction, bendCurveRadius, options);
      bendSurfaces.push(...bendSurface.surfaces);
      if (bendSurface.strip?.samples?.length >= 2) bendSurfaceStrips.push(bendSurface.strip);
      const flangeStart = bendSurface.unadjustedStart || bendSurface.start;
      const flangeEnd = bendSurface.unadjustedEnd || bendSurface.end;
      const outerStart = v.add(flangeStart, v.mul(flangeDir, flangeLength));
      const outerEnd = v.add(flangeEnd, v.mul(flangeDir, flangeLength));
      const panel = {
        bend,
        edgeStart: bendSurface.start,
        edgeEnd: bendSurface.end,
        edgeTangent: edge.tangent,
        flangeDir,
        normal: flangeNormal,
        points: [
          flangeStart,
          flangeEnd,
          outerEnd,
          outerStart
        ],
        smoothVertexIndices: [],
        cornerReliefs: []
      };
      panels.push(panel);
      targetEdges.push({
        id: `bend:${bend.id}:outer`,
        parentBendId: bend.id,
        parentEdge: "outer",
        edgeRole: "bend-outer",
        start: outerStart,
        end: outerEnd,
        sourceNormal: flangeNormal,
        outward: flangeDir
      });
      targetEdges.push({
        id: `bend:${bend.id}:start`,
        parentBendId: bend.id,
        parentEdge: "start",
        edgeRole: "bend-side-start",
        start: flangeStart,
        end: outerStart,
        sourceNormal: flangeNormal,
        outward: v.mul(edge.tangent, -1)
      });
      targetEdges.push({
        id: `bend:${bend.id}:end`,
        parentBendId: bend.id,
        parentEdge: "end",
        edgeRole: "bend-side-end",
        start: flangeEnd,
        end: outerEnd,
        sourceNormal: flangeNormal,
        outward: edge.tangent
      });
      unresolved.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  return { basePoints, baseSmoothVertexIndices: baseOutline.smoothVertexIndices, cornerReliefs: [], panels, bendSurfaces, bendSurfaceStrips, targetEdges, unresolved };
}
