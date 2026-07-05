import { distance2, finiteNumberOr, v } from "../../core/math.mjs";
import { plateBends, sketchEdges } from "../../api/project/plate-sketch/model-accessors.mjs";
import { plateOutline, sketchEdgePoints, sketchVertexPointMap } from "../../api/project/plate-sketch/sketch-geometry-and-relations.mjs";
import { signedArea2d } from "../polygon.mjs";
import { createSingleLoopChartDomain } from "./chart-domain.mjs";

function bendAngleRadians(bend) {
  return Math.abs(finiteNumberOr(bend?.angle, 90)) * Math.PI / 180;
}

function point2Direction(a, b) {
  const length = distance2(a, b);
  if (length <= 1e-9) return [0, 0];
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}

function defaultVec3(value, fallback) {
  return v.isVec3(value) ? value : fallback;
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

function bendCurveTangent(outward, sourceNormal, direction, theta) {
  return v.norm(v.add(v.mul(outward, Math.cos(theta)), v.mul(sourceNormal, direction * Math.sin(theta))));
}

function chartPointFinite(point) {
  return Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function baseChart(outline, basis) {
  const domain2d = outline.map((point) => [...point]);
  return {
    id: "base",
    kind: "base",
    domain2d,
    chartDomain2d: createSingleLoopChartDomain(domain2d, [], {
      operation: "identity",
      strategy: "base-domain"
    }),
    mapTo3d(point, sideOffset = 0) {
      if (!chartPointFinite(point)) return null;
      return v.add(
        basis.center,
        v.add(
          v.add(v.mul(basis.y, point[0]), v.mul(basis.z, point[1])),
          v.mul(basis.normal, sideOffset)
        )
      );
    },
    normalAt() {
      return basis.normal;
    }
  };
}

function rootBendCharts(plate, bend, edge, edgePoints, outlineArea, basis) {
  const edgeLength = distance2(edgePoints.a, edgePoints.b);
  if (edgeLength <= 1e-9) return [];
  const tangent2 = point2Direction(edgePoints.a, edgePoints.b);
  const outward2 = outlineArea >= 0 ? [tangent2[1], -tangent2[0]] : [-tangent2[1], tangent2[0]];
  const edgeStart3d = basis.toWorld(edgePoints.a);
  const edgeEnd3d = basis.toWorld(edgePoints.b);
  const tangent3d = v.norm(v.sub(edgeEnd3d, edgeStart3d));
  const outward3d = v.norm(v.add(v.mul(basis.y, outward2[0]), v.mul(basis.z, outward2[1])));
  const angle = bendAngleRadians(bend);
  const radius = Math.max(0, finiteNumberOr(bend.radius, 0));
  const direction = bend.direction === "down" ? -1 : 1;
  const developedWidth = radius * angle;
  const flangeLength = Math.max(0, finiteNumberOr(bend.flangeLength, 0));
  const bendDomain2d = [[0, 0], [edgeLength, 0], [edgeLength, developedWidth], [0, developedWidth]];
  const flangeDomain2d = [[0, 0], [edgeLength, 0], [edgeLength, flangeLength], [0, flangeLength]];
  const bendEndPoint = (s) => {
    const basePoint = v.add(edgeStart3d, v.mul(tangent3d, s));
    return radius > 1e-9
      ? bendCurvePoint(basePoint, outward3d, basis.normal, direction, radius, angle)
      : basePoint;
  };
  const flangeDir = v.norm(v.add(v.mul(outward3d, Math.cos(angle)), v.mul(basis.normal, direction * Math.sin(angle))));
  const bendChart = {
    id: `bend:${bend.id}`,
    kind: "bend",
    ownerBendId: bend.id,
    edgeId: bend.edgeId,
    edgeStartVertexId: edge.from,
    edgeEndVertexId: edge.to,
    edgeStart2d: [...edgePoints.a],
    edgeEnd2d: [...edgePoints.b],
    tangent2d: tangent2,
    outward2d: outward2,
    length: edgeLength,
    radius,
    angle,
    developedWidth,
    direction,
    domain2d: bendDomain2d,
    chartDomain2d: createSingleLoopChartDomain(bendDomain2d, [], {
      operation: "identity",
      strategy: "bend-domain"
    }),
    endpointS(endpoint) {
      return endpoint === "end" ? edgeLength : 0;
    },
    distanceFromEndpoint(point, endpoint) {
      if (!chartPointFinite(point)) return 0;
      return endpoint === "end" ? edgeLength - point[0] : point[0];
    },
    mapTo3d(point, sideOffset = 0) {
      if (!chartPointFinite(point)) return null;
      const theta = radius > 1e-9 ? point[1] / radius : 0;
      const basePoint = v.add(edgeStart3d, v.mul(tangent3d, point[0]));
      const mapped = radius > 1e-9
        ? bendCurvePoint(basePoint, outward3d, basis.normal, direction, radius, theta)
        : basePoint;
      return sideOffset ? v.add(mapped, v.mul(this.normalAt(point), sideOffset)) : mapped;
    },
    normalAt(point) {
      const theta = radius > 1e-9 && chartPointFinite(point) ? point[1] / radius : 0;
      return v.norm(v.cross(tangent3d, bendCurveTangent(outward3d, basis.normal, direction, theta)));
    }
  };
  const flangeChart = {
    id: `flange:${bend.id}`,
    kind: "flange",
    ownerBendId: bend.id,
    edgeId: bend.edgeId,
    edgeStartVertexId: edge.from,
    edgeEndVertexId: edge.to,
    edgeStart2d: [...edgePoints.a],
    edgeEnd2d: [...edgePoints.b],
    tangent2d: tangent2,
    outward2d: outward2,
    length: edgeLength,
    bendDevelopedWidth: developedWidth,
    flangeLength,
    domain2d: flangeDomain2d,
    chartDomain2d: createSingleLoopChartDomain(flangeDomain2d, [], {
      operation: "identity",
      strategy: "flange-domain"
    }),
    endpointS(endpoint) {
      return endpoint === "end" ? edgeLength : 0;
    },
    distanceFromEndpoint(point, endpoint) {
      if (!chartPointFinite(point)) return 0;
      return endpoint === "end" ? edgeLength - point[0] : point[0];
    },
    mapTo3d(point, sideOffset = 0) {
      if (!chartPointFinite(point)) return null;
      const mapped = v.add(bendEndPoint(point[0]), v.mul(flangeDir, point[1]));
      return sideOffset ? v.add(mapped, v.mul(this.normalAt(), sideOffset)) : mapped;
    },
    normalAt() {
      return v.norm(v.cross(tangent3d, flangeDir));
    }
  };
  return [bendChart, flangeChart];
}

function childSourceEdge(parentFlangeChart, parentEdge) {
  const length = Math.max(0, parentFlangeChart?.length || 0);
  const flangeLength = Math.max(0, parentFlangeChart?.flangeLength || 0);
  if (parentEdge === "start") {
    return {
      start: [0, 0],
      end: [0, flangeLength],
      outward: [-1, 0]
    };
  }
  if (parentEdge === "end") {
    return {
      start: [length, 0],
      end: [length, flangeLength],
      outward: [1, 0]
    };
  }
  if (parentEdge === "outer") {
    return {
      start: [0, flangeLength],
      end: [length, flangeLength],
      outward: [0, 1]
    };
  }
  return null;
}

function childBendCharts(bend, parentFlangeChart) {
  const sourceEdge = childSourceEdge(parentFlangeChart, bend?.parentEdge);
  if (!sourceEdge) return [];
  const edgeLength = distance2(sourceEdge.start, sourceEdge.end);
  if (edgeLength <= 1e-9) return [];
  const sourceStart3d = parentFlangeChart.mapTo3d(sourceEdge.start);
  const sourceEnd3d = parentFlangeChart.mapTo3d(sourceEdge.end);
  const sourceOutward3d = parentFlangeChart.mapTo3d([
    sourceEdge.start[0] + sourceEdge.outward[0],
    sourceEdge.start[1] + sourceEdge.outward[1]
  ]);
  if (!sourceStart3d || !sourceEnd3d || !sourceOutward3d) return [];
  const tangent3d = v.norm(v.sub(sourceEnd3d, sourceStart3d));
  const outward3d = v.norm(v.sub(sourceOutward3d, sourceStart3d));
  const sourceNormal = parentFlangeChart.normalAt(sourceEdge.start);
  const angle = bendAngleRadians(bend);
  const radius = Math.max(0, finiteNumberOr(bend.radius, 0));
  const direction = bend.direction === "down" ? -1 : 1;
  const developedWidth = radius * angle;
  const flangeLength = Math.max(0, finiteNumberOr(bend.flangeLength, 0));
  const bendDomain2d = [[0, 0], [edgeLength, 0], [edgeLength, developedWidth], [0, developedWidth]];
  const flangeDomain2d = [[0, 0], [edgeLength, 0], [edgeLength, flangeLength], [0, flangeLength]];
  const sourcePointAt = (s) => parentFlangeChart.mapTo3d([
    sourceEdge.start[0] + (sourceEdge.end[0] - sourceEdge.start[0]) * (s / edgeLength),
    sourceEdge.start[1] + (sourceEdge.end[1] - sourceEdge.start[1]) * (s / edgeLength)
  ]);
  const bendEndPoint = (s) => {
    const basePoint = sourcePointAt(s);
    return radius > 1e-9
      ? bendCurvePoint(basePoint, outward3d, sourceNormal, direction, radius, angle)
      : basePoint;
  };
  const flangeDir = v.norm(v.add(v.mul(outward3d, Math.cos(angle)), v.mul(sourceNormal, direction * Math.sin(angle))));
  const baseMeta = {
    parentBendId: bend.parentBendId,
    parentEdge: bend.parentEdge,
    sourceChartId: parentFlangeChart.id,
    sourceEdgeStart2d: sourceEdge.start,
    sourceEdgeEnd2d: sourceEdge.end,
    sourceOutward2d: sourceEdge.outward
  };
  const bendChart = {
    id: `bend:${bend.id}`,
    kind: "bend",
    ownerBendId: bend.id,
    length: edgeLength,
    radius,
    angle,
    developedWidth,
    direction,
    domain2d: bendDomain2d,
    chartDomain2d: createSingleLoopChartDomain(bendDomain2d, [], {
      operation: "identity",
      strategy: "child-bend-domain"
    }),
    ...baseMeta,
    endpointS(endpoint) {
      return endpoint === "end" ? edgeLength : 0;
    },
    distanceFromEndpoint(point, endpoint) {
      if (!chartPointFinite(point)) return 0;
      return endpoint === "end" ? edgeLength - point[0] : point[0];
    },
    mapTo3d(point, sideOffset = 0) {
      if (!chartPointFinite(point)) return null;
      const theta = radius > 1e-9 ? point[1] / radius : 0;
      const basePoint = sourcePointAt(point[0]);
      const mapped = radius > 1e-9
        ? bendCurvePoint(basePoint, outward3d, sourceNormal, direction, radius, theta)
        : basePoint;
      return sideOffset ? v.add(mapped, v.mul(this.normalAt(point), sideOffset)) : mapped;
    },
    normalAt(point) {
      const theta = radius > 1e-9 && chartPointFinite(point) ? point[1] / radius : 0;
      return v.norm(v.cross(tangent3d, bendCurveTangent(outward3d, sourceNormal, direction, theta)));
    }
  };
  const flangeChart = {
    id: `flange:${bend.id}`,
    kind: "flange",
    ownerBendId: bend.id,
    length: edgeLength,
    bendDevelopedWidth: developedWidth,
    flangeLength,
    domain2d: flangeDomain2d,
    chartDomain2d: createSingleLoopChartDomain(flangeDomain2d, [], {
      operation: "identity",
      strategy: "child-flange-domain"
    }),
    ...baseMeta,
    endpointS(endpoint) {
      return endpoint === "end" ? edgeLength : 0;
    },
    distanceFromEndpoint(point, endpoint) {
      if (!chartPointFinite(point)) return 0;
      return endpoint === "end" ? edgeLength - point[0] : point[0];
    },
    mapTo3d(point, sideOffset = 0) {
      if (!chartPointFinite(point)) return null;
      const mapped = v.add(bendEndPoint(point[0]), v.mul(flangeDir, point[1]));
      return sideOffset ? v.add(mapped, v.mul(this.normalAt(), sideOffset)) : mapped;
    },
    normalAt() {
      return v.norm(v.cross(tangent3d, flangeDir));
    }
  };
  return [bendChart, flangeChart];
}

export function buildPlateSheetCharts(plate, options = {}) {
  const basis = {
    center: defaultVec3(plate?.center, [0, 0, 0]),
    y: v.norm(defaultVec3(plate?.localAxisY, [1, 0, 0])),
    z: v.norm(defaultVec3(plate?.localAxisZ, [0, 1, 0])),
    normal: v.norm(defaultVec3(plate?.normal, [0, 0, 1])),
    toWorld(point) {
      return v.add(this.center, v.add(v.mul(this.y, point[0]), v.mul(this.z, point[1])));
    }
  };
  const outline = plateOutline(plate, options);
  const charts = [baseChart(outline, basis)];
  const chartById = new Map(charts.map((chart) => [chart.id, chart]));
  const outlineArea = signedArea2d(outline);
  const vertexMap = sketchVertexPointMap(plate?.sketch);
  const edgeById = new Map(sketchEdges(plate?.sketch).map((edge) => [edge.id, edge]));
  const bends = plateBends(plate);
  for (const bend of bends.filter((item) => !item.parentBendId && item.edgeId)) {
    const edge = edgeById.get(bend.edgeId);
    if (!edge) continue;
    for (const chart of rootBendCharts(plate, bend, edge, sketchEdgePoints(plate.sketch, edge, vertexMap), outlineArea, basis)) {
      charts.push(chart);
      chartById.set(chart.id, chart);
    }
  }
  const diagnostics = [];
  const unresolvedChildren = bends.filter((item) => item.parentBendId);
  for (let guard = 0; unresolvedChildren.length && guard < bends.length + 1; guard += 1) {
    let progressed = false;
    for (let index = unresolvedChildren.length - 1; index >= 0; index -= 1) {
      const bend = unresolvedChildren[index];
      const parentFlangeChart = chartById.get(`flange:${bend.parentBendId}`);
      if (!parentFlangeChart) continue;
      const childCharts = childBendCharts(bend, parentFlangeChart);
      if (!childCharts.length) {
        diagnostics.push({
          severity: "error",
          code: "sheet-metal.child-bend-chart.unsupported",
          message: `Child bend ${bend.id} could not derive charts from ${bend.parentBendId}:${bend.parentEdge || ""}.`,
          bendId: bend.id,
          parentBendId: bend.parentBendId,
          parentEdge: bend.parentEdge || ""
        });
      }
      for (const chart of childCharts) {
        charts.push(chart);
        chartById.set(chart.id, chart);
      }
      unresolvedChildren.splice(index, 1);
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const bend of unresolvedChildren) {
    diagnostics.push({
      severity: "error",
      code: "sheet-metal.child-bend-chart.parent-missing",
      message: `Child bend ${bend.id} references missing parent bend chart ${bend.parentBendId}.`,
      bendId: bend.id,
      parentBendId: bend.parentBendId || "",
      parentEdge: bend.parentEdge || ""
    });
  }
  return {
    thickness: Math.max(0, finiteNumberOr(plate?.thickness, 0)),
    charts,
    chartById,
    diagnostics
  };
}

export function chartEndpointForSite(chart, site) {
  if (!chart?.ownerBendId || !Array.isArray(site?.bends)) return "";
  return site.bends.find((bend) => bend.bendId === chart.ownerBendId)?.endpoint || "";
}

export function developedDistanceFromSite(chart, point, site) {
  const endpoint = chartEndpointForSite(chart, site);
  if (!endpoint || !chartPointFinite(point)) return null;
  if (chart.kind === "bend") return [chart.distanceFromEndpoint(point, endpoint), point[1]];
  if (chart.kind === "flange") return [chart.distanceFromEndpoint(point, endpoint), chart.bendDevelopedWidth + point[1]];
  return null;
}
