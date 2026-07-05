import { distance2, finitePositiveNumber, v } from "../../core/math.mjs";
import { arrayValues } from "../../core/model.mjs";
import { resolvePlateCornerReliefSpec } from "../../api/project/plate-sketch/corner-reliefs.mjs";
import { buildPlateSheetCharts, chartEndpointForSite, developedDistanceFromSite } from "./sheet-charts.mjs";
import {
  chartDomainBoundary2d,
  chartDomainBoundaryEdges,
  createSingleLoopPolygonSet2d,
  differenceSingleLoopChartDomainByCutoutRegions
} from "./chart-domain.mjs";
import { evaluateCornerReliefSites } from "./relief-sites.mjs";

const CLIP_MARGIN = 1e-4;

function circleSegmentCount(radius, options = {}) {
  if (!finitePositiveNumber(radius)) return 0;
  if (finitePositiveNumber(options.segmentLength)) {
    return Math.max(12, Math.ceil((Math.PI * 2 * radius) / options.segmentLength));
  }
  const maxChordError = finitePositiveNumber(options.maxChordError) ? options.maxChordError : 0.2;
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - maxChordError / radius)));
  return Math.max(12, Math.ceil((Math.PI * 2) / Math.max(angle, 1e-3)));
}

function reliefEffectiveRadius(spec) {
  return Math.max(0, (spec?.radius || 0) + (spec?.clearance || 0));
}

function reliefEffectiveDistance(value, spec) {
  return Math.max(0, (value || 0) + (spec?.clearance || 0));
}

function axisDevelopedDepth(spec, axisIndex = 0, fallback = 0) {
  const value = Array.isArray(spec?.axisDevelopedDepths)
    ? spec.axisDevelopedDepths[axisIndex]
    : null;
  return finitePositiveNumber(value) ? value : fallback;
}

function finitePoint2(point) {
  return Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value));
}

function finiteNumberOr(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function chartEndpointPoint2d(chart, endpoint) {
  const length = Math.max(0, finiteNumberOr(chart?.length, 0));
  return [endpoint === "end" ? length : 0, 0];
}

function point2Add(a, b, distance) {
  const length = distance2(a, b);
  if (length <= 1e-9) return [...a];
  return [
    a[0] + (b[0] - a[0]) / length * distance,
    a[1] + (b[1] - a[1]) / length * distance
  ];
}

function minorArcPoints(center, start, end, options = {}) {
  const radius = Math.max(distance2(center, start), distance2(center, end));
  if (radius <= 1e-9) return [start, end];
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0]);
  let delta = endAngle - startAngle;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  const segments = Math.max(2, Math.ceil(circleSegmentCount(radius, options) * Math.abs(delta) / (Math.PI * 2)));
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + delta * index / segments;
    points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]);
  }
  return points;
}

function unit2(point) {
  const length = Math.hypot(point?.[0] || 0, point?.[1] || 0);
  return length > 1e-9 ? [point[0] / length, point[1] / length] : [0, 0];
}

function addScaled2(origin, axis, distance) {
  return [
    origin[0] + (axis?.[0] || 0) * distance,
    origin[1] + (axis?.[1] || 0) * distance
  ];
}

function localSitePoint2(site, incomingDistance, outgoingDistance) {
  const base = site?.basePoint2d;
  if (!finitePoint2(base)) return null;
  const incoming = site.localAxes2d?.incoming || [0, 0];
  const outgoing = site.localAxes2d?.outgoing || [0, 0];
  return [
    base[0] + (incoming[0] || 0) * incomingDistance + (outgoing[0] || 0) * outgoingDistance,
    base[1] + (incoming[1] || 0) * incomingDistance + (outgoing[1] || 0) * outgoingDistance
  ];
}

function roundedEndRectangleReliefPoints(site, width, depth, radius, options = {}) {
  if (!site?.basePoint2d || width <= 0 || depth <= 0) return [];
  const cornerRadius = Math.max(0, Math.min(radius, width / 2, depth / 2));
  if (cornerRadius <= 1e-7) {
    return [
      localSitePoint2(site, width, 0),
      localSitePoint2(site, width, depth),
      localSitePoint2(site, 0, depth)
    ].filter(Boolean);
  }
  const points = [];
  const pushLocalPoint = (u, v) => {
    const point = localSitePoint2(site, u, v);
    if (!point) return;
    const previous = points[points.length - 1];
    if (!previous || distance2(previous, point) > 1e-7) points.push(point);
  };
  const pushLocalArc = (centerU, centerV, startAngle, endAngle) => {
    const segments = Math.max(3, Math.ceil(circleSegmentCount(cornerRadius, options) / 4));
    for (let index = 0; index <= segments; index += 1) {
      const angle = startAngle + (endAngle - startAngle) * index / segments;
      pushLocalPoint(
        centerU + Math.cos(angle) * cornerRadius,
        centerV + Math.sin(angle) * cornerRadius
      );
    }
  };
  pushLocalPoint(width, 0);
  pushLocalPoint(width, depth - cornerRadius);
  pushLocalArc(width - cornerRadius, depth - cornerRadius, 0, Math.PI / 2);
  pushLocalPoint(0, depth);
  return points;
}

function pointAtEndpointInset(chart, endpoint, inset, developedOffset = 0) {
  const s = endpoint === "end" ? chart.length - inset : inset;
  return [s, developedOffset];
}

function pointAtEndpointInsetClamped(chart, endpoint, inset, developedOffset = 0) {
  const requested = Math.max(0, inset || 0);
  const limit = Math.max(0, chart?.length || 0);
  const upper = limit > CLIP_MARGIN ? limit - CLIP_MARGIN : limit;
  const effective = Math.min(requested, upper);
  return {
    point: pointAtEndpointInset(chart, endpoint, effective, developedOffset),
    requested,
    effective,
    limit,
    clamped: requested > limit + 1e-7
  };
}

function developedSiteLocalCoords(point, site) {
  if (!finitePoint2(point) || !finitePoint2(site?.basePoint2d)) return null;
  const incoming = site?.localAxes2d?.incoming || [0, 0];
  const outgoing = site?.localAxes2d?.outgoing || [0, 0];
  const px = point[0] - site.basePoint2d[0];
  const py = point[1] - site.basePoint2d[1];
  const determinant = (incoming[0] || 0) * (outgoing[1] || 0) - (incoming[1] || 0) * (outgoing[0] || 0);
  if (Math.abs(determinant) <= 1e-9) return null;
  return [
    (px * (outgoing[1] || 0) - py * (outgoing[0] || 0)) / determinant,
    ((incoming[0] || 0) * py - (incoming[1] || 0) * px) / determinant
  ];
}

function developedReliefProfile(spec, options = {}) {
  if (!spec) return null;
  if (spec.type === "circular") {
    const radius = reliefEffectiveRadius(spec);
    if (radius <= 0) return null;
    return {
      type: "circular",
      nominalRadius: spec.radius,
      effectiveRadius: radius,
      axisLimit() {
        return radius;
      },
      edgeInsetAt(developedDistance) {
        return developedDistance <= radius + 1e-7
          ? Math.sqrt(Math.max(0, radius * radius - developedDistance * developedDistance))
          : 0;
      },
      sampleDevelopedDistances(start, end) {
        const span = Math.max(0, end - start);
        const segments = Math.max(2, Math.ceil(circleSegmentCount(radius, options) * (span / radius) / 4));
        const distances = [];
        for (let index = 0; index <= segments; index += 1) {
          distances.push(start + span * index / segments);
        }
        return distances;
      },
      basePoints(site) {
        if (!site?.basePoint2d) return [];
        const incoming = unit2(site.localAxes2d?.incoming || [0, 0]);
        const outgoing = unit2(site.localAxes2d?.outgoing || [0, 0]);
        if (Math.hypot(incoming[0], incoming[1]) <= 1e-9 || Math.hypot(outgoing[0], outgoing[1]) <= 1e-9) return [];
        return minorArcPoints(
          site.basePoint2d,
          addScaled2(site.basePoint2d, incoming, radius),
          addScaled2(site.basePoint2d, outgoing, radius),
          options
        );
      }
    };
  }
  if (spec.type === "rectangular") {
    const width = reliefEffectiveDistance(spec?.width, spec);
    const depth = reliefEffectiveDistance(spec?.depth, spec);
    if (width <= 0 || depth <= 0) return null;
    const sLimitForAxis = (axisIndex = 0) => (axisIndex === 1 ? depth : width);
    const developedLimitForAxis = (axisIndex = 0) => axisDevelopedDepth(spec, axisIndex, axisIndex === 1 ? width : depth);
    return {
      type: "rectangular",
      nominalWidth: spec?.width || 0,
      nominalDepth: spec?.depth || 0,
      effectiveWidth: width,
      effectiveDepth: depth,
      effectiveDevelopedDepths: [developedLimitForAxis(0), developedLimitForAxis(1)],
      axisLimit(axisIndex = 0) {
        return developedLimitForAxis(axisIndex);
      },
      edgeInsetAt(developedDistance, axisIndex = 0) {
        return developedDistance <= developedLimitForAxis(axisIndex) + 1e-7
          ? sLimitForAxis(axisIndex)
          : 0;
      },
      sampleDevelopedDistances(start, end, axisIndex = 0, height = Infinity) {
        const limit = developedLimitForAxis(axisIndex);
        const clampedEnd = Math.max(start, Math.min(end, limit));
        return [start, clampedEnd].filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 1e-7);
      },
      basePoints(site) {
        if (!site?.basePoint2d) return [];
        const incoming = site.localAxes2d?.incoming || [0, 0];
        const outgoing = site.localAxes2d?.outgoing || [0, 0];
        const start = [
          site.basePoint2d[0] + incoming[0] * width,
          site.basePoint2d[1] + incoming[1] * width
        ];
        const end = [
          site.basePoint2d[0] + outgoing[0] * depth,
          site.basePoint2d[1] + outgoing[1] * depth
        ];
        const inner = [
          start[0] + (end[0] - site.basePoint2d[0]),
          start[1] + (end[1] - site.basePoint2d[1])
        ];
        return [start, inner, end];
      }
    };
  }
  if (spec.type === "obround") {
    const width = reliefEffectiveDistance(spec?.width, spec);
    const depth = reliefEffectiveDistance(spec?.depth, spec);
    if (width <= 0 || depth <= 0) return null;
    const requestedRadius = finiteNumberOr(spec?.radius, Math.min(width, depth) / 4);
    const radius = Math.max(0, Math.min(requestedRadius, width / 4, depth / 4));
    const axisSideLimit = (axisIndex = 0) => (axisIndex === 1 ? depth : width);
    const axisDevelopedLimit = (axisIndex = 0) => axisDevelopedDepth(spec, axisIndex, axisIndex === 1 ? width : depth);
    const axisRadius = (axisIndex = 0) => Math.min(radius, axisSideLimit(axisIndex) / 2, axisDevelopedLimit(axisIndex) / 2);
    const insetAt = (developedDistance, axisIndex = 0) => {
      const sideLimit = axisSideLimit(axisIndex);
      const developedLimit = axisDevelopedLimit(axisIndex);
      const cornerRadius = axisRadius(axisIndex);
      if (developedDistance < -1e-7 || developedDistance > developedLimit + 1e-7) return 0;
      if (cornerRadius <= 1e-7) return sideLimit;
      const roundedInset = (center) => (
        sideLimit - cornerRadius + Math.sqrt(Math.max(0, cornerRadius * cornerRadius - (developedDistance - center) * (developedDistance - center)))
      );
      if (developedDistance >= developedLimit - cornerRadius - 1e-7) return roundedInset(developedLimit - cornerRadius);
      return sideLimit;
    };
    const endpointInsetAt = (developedDistance, axisIndex = 0) => {
      const developedLimit = axisDevelopedLimit(axisIndex);
      if (developedDistance < -1e-7 || developedDistance > developedLimit + 1e-7) return 0;
      return axisSideLimit(axisIndex);
    };
    const sampleDistances = (start, end, axisIndex = 0) => {
      const developedLimit = axisDevelopedLimit(axisIndex);
      const cornerRadius = axisRadius(axisIndex);
      const min = Math.max(0, Math.min(start, end));
      const max = Math.max(min, Math.min(Math.max(start, end), developedLimit));
      const values = new Set([min, max]);
      if (cornerRadius > 1e-7) {
        const ranges = [[developedLimit - cornerRadius, developedLimit]];
        for (const [arcStart, arcEnd] of ranges) {
          if (arcStart > min + 1e-7 && arcStart < max - 1e-7) values.add(arcStart);
          if (arcEnd > min + 1e-7 && arcEnd < max - 1e-7) values.add(arcEnd);
          const localStart = Math.max(min, arcStart);
          const localEnd = Math.min(max, arcEnd);
          if (localEnd > localStart + 1e-7) {
            const segments = Math.max(3, Math.ceil(circleSegmentCount(cornerRadius, options) * ((localEnd - localStart) / cornerRadius) / 4));
            for (let index = 0; index <= segments; index += 1) {
              values.add(localStart + (localEnd - localStart) * index / segments);
            }
          }
        }
      }
      return [...values].sort((a, b) => a - b);
    };
    const endpointSampleDistances = (start, end, axisIndex = 0) => {
      const limit = axisDevelopedLimit(axisIndex);
      const min = Math.max(0, Math.min(start, end));
      const max = Math.max(min, Math.min(Math.max(start, end), limit));
      return [min, max].filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > 1e-7);
    };
    return {
      type: "obround",
      nominalWidth: spec?.width || 0,
      nominalDepth: spec?.depth || 0,
      nominalRadius: spec?.radius || (spec?.width || 0) / 2,
      effectiveWidth: width,
      effectiveDepth: depth,
      effectiveRadius: radius,
      effectiveDevelopedDepths: [axisDevelopedLimit(0), axisDevelopedLimit(1)],
      axisLimit(axisIndex = 0) {
        return axisDevelopedLimit(axisIndex);
      },
      edgeInsetAt(developedDistance, axisIndex = 0) {
        return insetAt(developedDistance, axisIndex);
      },
      endpointEdgeInsetAt(developedDistance, axisIndex = 0) {
        return endpointInsetAt(developedDistance, axisIndex);
      },
      sampleDevelopedDistances(start, end, axisIndex = 0) {
        return sampleDistances(start, end, axisIndex);
      },
      endpointSampleDevelopedDistances(start, end, axisIndex = 0) {
        return endpointSampleDistances(start, end, axisIndex);
      },
      basePoints(site) {
        return roundedEndRectangleReliefPoints(site, width, depth, radius, options);
      }
    };
  }
  return null;
}

function createCutoutRegion2d(points = [], coordinateSystem = "chart-2d", metadata = {}) {
  const region = createSingleLoopPolygonSet2d(points, [], {
    coordinateSystem,
    operation: "cutout-region",
    strategy: metadata.strategy || "relief-cutout-region",
    purpose: "cutout",
    ...metadata
  });
  return chartDomainBoundary2d(region).length >= 3 ? region : null;
}

function developedCutoutRegionPoints(site, type, points2d = []) {
  const points = points2d.filter(finitePoint2);
  if (!points.length) return [];
  return finitePoint2(site?.basePoint2d)
    ? [site.basePoint2d, ...points]
    : points;
}

function chartCutoutRegionFromPoints(points2d = [], metadata = {}) {
  return createCutoutRegion2d(points2d.filter(finitePoint2), "chart-2d", metadata);
}

function endpointCutoutRegionPoints(chart, endpoint, curve = [], endpointExtension = 0) {
  const points = curve.filter(finitePoint2);
  if (points.length < 2) return [];
  const extension = Math.max(0, finiteNumberOr(endpointExtension, 0));
  const length = Math.max(0, chart?.length || 0);
  const endpointX = endpoint === "end" ? length + extension : -extension;
  const first = points[0];
  const last = points[points.length - 1];
  if (!finitePoint2(first) || !finitePoint2(last) || Math.abs(last[1] - first[1]) <= 1e-7) return [];
  return endpoint === "end"
    ? [[endpointX, first[1]], [endpointX, last[1]], ...points.slice().reverse()]
    : [[endpointX, first[1]], ...points, [endpointX, last[1]]];
}

export function buildReliefCutout2d(site, spec, options = {}) {
  const profile = developedReliefProfile(spec, options);
  if (!profile || !site) return null;
  const points2d = profile.basePoints(site);
  const cutoutRegion2d = createCutoutRegion2d(
    developedCutoutRegionPoints(site, profile.type, points2d),
    "developed-site",
    {
      strategy: `${profile.type}-developed-cutout`,
      siteKey: site.key || "",
      cornerReliefVertexId: site.legacyVertexId || site.target?.vertexId || "",
      cornerReliefType: profile.type
    }
  );
  return {
    siteKey: site.key,
    cornerReliefVertexId: site.legacyVertexId || site.target?.vertexId || "",
    type: profile.type,
    coordinateSystem: "developed-site",
    profile,
    flangeGap: finiteNumberOr(spec?.flangeGap, 0),
    flangeGapExplicit: spec?.flangeGapExplicit === true,
    flangeGapMode: spec?.flangeGapMode || "symmetric",
    flangeGapSwapped: spec?.flangeGapSwapped === true,
    points2d,
    cutoutRegion2d,
    ...(profile.nominalRadius !== undefined ? { nominalRadius: profile.nominalRadius } : {}),
    ...(profile.effectiveRadius !== undefined ? { effectiveRadius: profile.effectiveRadius } : {}),
    ...(profile.nominalWidth !== undefined ? { nominalWidth: profile.nominalWidth } : {}),
    ...(profile.nominalDepth !== undefined ? { nominalDepth: profile.nominalDepth } : {}),
    ...(profile.effectiveWidth !== undefined ? { effectiveWidth: profile.effectiveWidth } : {}),
    ...(profile.effectiveDepth !== undefined ? { effectiveDepth: profile.effectiveDepth } : {}),
    ...(profile.effectiveDevelopedDepths !== undefined ? { effectiveDevelopedDepths: profile.effectiveDevelopedDepths } : {}),
    ...(["rectangular", "obround"].includes(profile.type) ? {
      basePreviousDistance: profile.effectiveWidth,
      baseNextDistance: profile.effectiveDepth
    } : {})
  };
}

function chartCutoutFromDevelopedCutout(chart, developedCutout) {
  const points2d = developedCutout.points2d || [];
  const developedRegionPoints = chartDomainBoundary2d(developedCutout.cutoutRegion2d);
  return {
    ...developedCutout,
    chartId: chart.id,
    chartKind: chart.kind,
    cutoutRegion2d: chartCutoutRegionFromPoints(developedRegionPoints.length ? developedRegionPoints : points2d, {
      strategy: `${developedCutout.type || "relief"}-${chart.kind || "chart"}-cutout`,
      siteKey: developedCutout.siteKey || "",
      chartId: chart.id || "",
      chartKind: chart.kind || "",
      cornerReliefVertexId: developedCutout.cornerReliefVertexId || "",
      cornerReliefType: developedCutout.type || ""
    }),
    points2d,
    points3d: points2d.map((point) => chart.mapTo3d(point)).filter(Boolean)
  };
}

function profiledEndpointCurve(chart, endpoint, developedCutout, axisIndex, baseOffset, height, site, diagnostics = []) {
  const profile = developedCutout?.profile;
  if (!profile || !endpoint || height <= 0) return [];
  const maxDeveloped = profile.axisLimit(axisIndex);
  const remaining = maxDeveloped - baseOffset;
  if (remaining <= 1e-7) return [];
  const localDepth = Math.min(height, remaining);
  const sampleDevelopedDistances = profile.endpointSampleDevelopedDistances || profile.sampleDevelopedDistances;
  const edgeInsetAt = profile.endpointEdgeInsetAt || profile.edgeInsetAt;
  const distances = sampleDevelopedDistances(baseOffset, baseOffset + localDepth, axisIndex, height);
  let clamped = false;
  let requestedMax = 0;
  const points = distances.map((developedDistance) => {
    const inset = pointAtEndpointInsetClamped(chart, endpoint, edgeInsetAt(developedDistance, axisIndex), developedDistance - baseOffset);
    if (inset.clamped) {
      clamped = true;
      requestedMax = Math.max(requestedMax, inset.requested);
    }
    return inset.point;
  });
  if (clamped) {
    appendCornerCutoutClampDiagnostic(
      diagnostics,
      { ...developedCutout, chartId: chart.id, chartKind: chart.kind },
      site,
      `${chart.kind}:${endpoint}`,
      requestedMax,
      Math.min(requestedMax, Math.max(0, chart.length || 0)),
      Math.max(0, chart.length || 0)
    );
  }
  const last = points[points.length - 1];
  if (last && Math.abs(chart.distanceFromEndpoint(last, endpoint)) > 1e-7 && localDepth < height - 1e-7) {
    points.push(pointAtEndpointInset(chart, endpoint, 0, localDepth));
  }
  return points;
}

function endpointCutoutFromDevelopedCutout(chart, site, developedCutout) {
  const endpoint = chartEndpointForSite(chart, site);
  const axisIndex = siteBendIndex(chart, site);
  const height = chart.kind === "bend"
    ? Math.max(0, chart.developedWidth || 0)
    : Math.max(0, chart.flangeLength || 0);
  const baseOffset = chart.kind === "flange" ? Math.max(0, chart.bendDevelopedWidth || 0) : 0;
  if (!endpoint || axisIndex < 0 || height <= 0) return null;
  const diagnostics = [];
  const profile = developedCutout.profile;
  const points2d = profiledEndpointCurve(chart, endpoint, developedCutout, axisIndex, baseOffset, height, site, diagnostics);
  const edgeInsetAt = profile.endpointEdgeInsetAt || profile.edgeInsetAt;
  const cutoutRegion2d = points2d.length >= 2
    ? chartCutoutRegionFromPoints(endpointCutoutRegionPoints(chart, endpoint, points2d), {
      strategy: `${developedCutout?.type || "relief"}-${chart.kind || "chart"}-endpoint-cutout`,
      siteKey: developedCutout?.siteKey || "",
      chartId: chart.id || "",
      chartKind: chart.kind || "",
      endpoint,
      cornerReliefVertexId: developedCutout?.cornerReliefVertexId || "",
      cornerReliefType: developedCutout?.type || ""
    })
    : null;
  return {
    ...developedCutout,
    chartId: chart.id,
    chartKind: chart.kind,
    endpoint,
    axisIndex,
    developedBaseOffset: baseOffset,
    chartDepthLimit: Math.min(Math.max(0, profile.axisLimit(axisIndex) - baseOffset), height),
    sLimit: edgeInsetAt(baseOffset, axisIndex),
    developedLimit: profile.axisLimit(axisIndex),
    diagnostics,
    cutoutRegion2d,
    points2d,
    points3d: points2d.map((point) => chart.mapTo3d(point)).filter(Boolean)
  };
}

function siteBendIndex(chart, site) {
  return Array.isArray(site?.bends)
    ? site.bends.findIndex((bend) => bend.bendId === chart?.ownerBendId)
    : -1;
}

function endpointExtensionDirection(chart, endpoint) {
  const tangent = Array.isArray(chart?.tangent2d) ? chart.tangent2d : null;
  if (!tangent || tangent.length !== 2) return null;
  return endpoint === "end"
    ? [finiteNumberOr(tangent[0], 0), finiteNumberOr(tangent[1], 0)]
    : [-finiteNumberOr(tangent[0], 0), -finiteNumberOr(tangent[1], 0)];
}

function endpointExtensionDirection3d(chart, endpoint) {
  if (!chart?.mapTo3d) return null;
  const basePoint = chartEndpointPoint2d(chart, endpoint);
  const direction = endpoint === "end" ? 1 : -1;
  const base = chart.mapTo3d(basePoint);
  const next = chart.mapTo3d([basePoint[0] + direction, basePoint[1]]);
  if (!v.isVec3(base) || !v.isVec3(next)) return null;
  const tangent = v.sub(next, base);
  return v.len(tangent) > 1e-9 ? v.norm(tangent) : null;
}

function chartNormal3d(chart, endpoint) {
  if (!chart?.normalAt) return null;
  const normal = chart.normalAt(chartEndpointPoint2d(chart, endpoint));
  return v.isVec3(normal) && v.len(normal) > 1e-9 ? v.norm(normal) : null;
}

function bendProjectedOffset2d(chart) {
  const outward = Array.isArray(chart?.outward2d) ? chart.outward2d : null;
  if (!outward || outward.length !== 2) return [0, 0];
  const radius = Math.max(0, finiteNumberOr(chart.radius, 0));
  const angle = Math.max(0, finiteNumberOr(chart.angle, 0));
  const offset = radius * Math.sin(angle);
  return [
    finiteNumberOr(outward[0], 0) * offset,
    finiteNumberOr(outward[1], 0) * offset
  ];
}

function thicknessDirection2d(chart) {
  const outward = Array.isArray(chart?.outward2d) ? chart.outward2d : null;
  if (!outward || outward.length !== 2) return [0, 0];
  const length = Math.hypot(finiteNumberOr(outward[0], 0), finiteNumberOr(outward[1], 0));
  if (length <= 1e-9) return [0, 0];
  return [finiteNumberOr(outward[0], 0) / length, finiteNumberOr(outward[1], 0) / length];
}

function solvePhysicalFlangeContactOffsets(first, second, thickness = 0) {
  const a = endpointExtensionDirection(first.chart, first.endpoint);
  const b = endpointExtensionDirection(second.chart, second.endpoint);
  if (!a || !b) return null;
  const offsetA = bendProjectedOffset2d(first.chart);
  const offsetB = bendProjectedOffset2d(second.chart);
  const baseRhs = [offsetB[0] - offsetA[0], offsetB[1] - offsetA[1]];
  const thicknessA = thicknessDirection2d(first.chart);
  const thicknessB = thicknessDirection2d(second.chart);
  const half = Math.max(0, finiteNumberOr(thickness, 0)) / 2;
  const m00 = a[0];
  const m10 = a[1];
  const m01 = -b[0];
  const m11 = -b[1];
  const det = m00 * m11 - m01 * m10;
  if (Math.abs(det) <= 1e-9) return null;
  let best = null;
  const sideChoices = half > 1e-9 ? [-1, 1] : [0];
  for (const firstSide of sideChoices) {
    for (const secondSide of sideChoices) {
      const rhs = [
        baseRhs[0] + thicknessB[0] * secondSide * half - thicknessA[0] * firstSide * half,
        baseRhs[1] + thicknessB[1] * secondSide * half - thicknessA[1] * firstSide * half
      ];
      const firstOffset = (rhs[0] * m11 - m01 * rhs[1]) / det;
      const secondOffset = (m00 * rhs[1] - rhs[0] * m10) / det;
      if (!Number.isFinite(firstOffset) || !Number.isFinite(secondOffset)) continue;
      if (firstOffset < -1e-7 || secondOffset < -1e-7) continue;
      const candidate = {
        firstOffset: Math.max(0, firstOffset),
        secondOffset: Math.max(0, secondOffset),
        score: Math.max(0, firstOffset) + Math.max(0, secondOffset)
      };
      if (!best || candidate.score < best.score) best = candidate;
    }
  }
  if (!best) return null;
  return {
    [first.bendId]: best.firstOffset,
    [second.bendId]: best.secondOffset
  };
}

function physicalFlangeContactOffsetsForSite(site, chartById, thickness) {
  if (!site || !chartById || !Array.isArray(site.bends) || site.bends.length !== 2) return null;
  const entries = site.bends.map((bend) => ({
    bendId: bend.bendId,
    endpoint: bend.endpoint,
    chart: chartById.get(`bend:${bend.bendId}`)
  }));
  if (entries.some((entry) => !entry.bendId || !entry.endpoint || !entry.chart)) return null;
  return solvePhysicalFlangeContactOffsets(entries[0], entries[1], thickness);
}

function physicalFlangeContactOffsetForChart(chart, site, chartById, thickness) {
  if (!chart) return 0;
  const offsets = physicalFlangeContactOffsetsForSite(site, chartById, thickness);
  return Math.max(0, finiteNumberOr(offsets?.[chart.ownerBendId], 0));
}

function pairedFlangeChartForSite(chart, site, chartById) {
  if (!chart?.ownerBendId || !Array.isArray(site?.bends) || site.bends.length !== 2 || !chartById) return null;
  const other = site.bends.find((bend) => bend.bendId && bend.bendId !== chart.ownerBendId);
  return other?.bendId ? chartById.get(`flange:${other.bendId}`) || null : null;
}

function chartEndpointForBendId(site, bendId) {
  return Array.isArray(site?.bends)
    ? site.bends.find((bend) => bend.bendId === bendId)?.endpoint || ""
    : "";
}

function physicalButtFlangeSpanForChart(chart, site, chartById, thickness) {
  const activeEndpoint = chartEndpointForBendId(site, chart?.ownerBendId);
  const activeDirection = endpointExtensionDirection3d(chart, activeEndpoint);
  const passiveChart = pairedFlangeChartForSite(chart, site, chartById);
  const passiveEndpoint = chartEndpointForBendId(site, passiveChart?.ownerBendId);
  const passiveNormal = chartNormal3d(passiveChart, passiveEndpoint);
  if (!activeDirection || !passiveNormal) return 0;
  return Math.max(0, Math.abs(v.dot(activeDirection, passiveNormal)) * Math.max(0, finiteNumberOr(thickness, 0)));
}

function flangeGapRoleForChart(chart, site) {
  if (!chart?.ownerBendId || !Array.isArray(site?.bends)) return "";
  const index = site.bends.findIndex((bend) => bend.bendId === chart.ownerBendId);
  if (index === 0) return "incoming";
  if (index === 1) return "outgoing";
  return "";
}

function flangeGapUserOffsetForRole(flangeGap, flangeGapMode, flangeGapSwapped, role, flangeButtSpan = 0) {
  if (flangeGapMode !== "butt") return flangeGap / 2;
  const activeRole = flangeGapSwapped ? "outgoing" : "incoming";
  return role === activeRole ? flangeGap - Math.max(0, finiteNumberOr(flangeButtSpan, 0)) : 0;
}

function flangeGapOffsetForChart(flangeGap, flangeGapMode, flangeGapSwapped, role, flangeContactOffset = 0, flangeButtSpan = 0) {
  const contactOffset = Math.max(0, finiteNumberOr(flangeContactOffset, 0));
  return flangeGapUserOffsetForRole(flangeGap, flangeGapMode, flangeGapSwapped, role, flangeButtSpan) - contactOffset;
}

export function buildReliefCutoutForChart(chart, site, spec, options = {}) {
  if (!chart || !site || !spec) return null;
  if (spec.type === "circular" || spec.type === "rectangular" || spec.type === "obround") {
    const developedCutout = buildReliefCutout2d(site, spec, options);
    if (!developedCutout) return null;
    if (chart.kind === "base") return chartCutoutFromDevelopedCutout(chart, developedCutout);
    if (chart.kind === "bend" || chart.kind === "flange") return endpointCutoutFromDevelopedCutout(chart, site, developedCutout);
    return null;
  }
  {
    return {
      siteKey: site.key,
      chartId: chart.id,
      chartKind: chart.kind,
      type: spec.type,
      status: "not-implemented",
      points2d: [],
      points3d: []
    };
  }
}

function buildFlangeSpacingForChart(chart, site, spec, chartById, thickness = 0) {
  if (!chart || !site || chart.kind !== "flange") return null;
  if (spec?.flangeGapExplicit !== true) return null;
  const flangeGap = finiteNumberOr(spec?.flangeGap, 0);
  const flangeGapMode = spec?.flangeGapMode || "symmetric";
  const flangeGapSwapped = spec?.flangeGapSwapped === true;
  const endpoint = chartEndpointForSite(chart, site);
  if (!endpoint) return null;
  const flangeGapRole = flangeGapRoleForChart(chart, site);
  const flangeContactOffset = physicalFlangeContactOffsetForChart(chart, site, chartById, thickness);
  const flangeButtSpan = flangeGapMode === "butt"
    ? physicalButtFlangeSpanForChart(chart, site, chartById, thickness)
    : 0;
  const endpointOffset = flangeGapOffsetForChart(flangeGap, flangeGapMode, flangeGapSwapped, flangeGapRole, flangeContactOffset, flangeButtSpan);
  if (Math.abs(endpointOffset) <= 1e-7) return null;
  return {
    type: "flange-spacing",
    siteKey: site.key || "",
    chartId: chart.id || "",
    chartKind: chart.kind || "",
    endpoint,
    cornerReliefVertexId: site.legacyVertexId || site.target?.vertexId || "",
    flangeGap,
    flangeGapExplicit: true,
    flangeGapMode,
    flangeGapSwapped,
    flangeGapRole,
    flangeContactOffset,
    flangeButtSpan,
    endpointOffset
  };
}

function cutoutByChart(cutouts = []) {
  const result = new Map();
  for (const cutout of cutouts) {
    if (!result.has(cutout.chartId)) result.set(cutout.chartId, []);
    result.get(cutout.chartId).push(cutout);
  }
  return result;
}

function chartCutoutApplications(cutouts = []) {
  return cutouts.map((cutout) => ({
    id: cutout.id || "",
    siteKey: cutout.siteKey || "",
    chartId: cutout.chartId || "",
    chartKind: cutout.chartKind || "",
    type: cutout.type || "",
    endpoint: cutout.endpoint || "",
    cornerReliefVertexId: cutout.cornerReliefVertexId || "",
    flangeGap: finiteNumberOr(cutout.flangeGap, 0),
    flangeGapExplicit: cutout.flangeGapExplicit === true,
    flangeGapMode: cutout.flangeGapMode || "symmetric",
    flangeGapSwapped: cutout.flangeGapSwapped === true,
    flangeGapRole: cutout.flangeGapRole || "",
    flangeContactOffset: finiteNumberOr(cutout.flangeContactOffset, 0),
    flangeButtSpan: finiteNumberOr(cutout.flangeButtSpan, 0),
    endpointOffset: finiteNumberOr(cutout.endpointOffset, 0),
    points2d: (cutout.points2d || []).map((point) => [...point]),
    points3d: (cutout.points3d || []).map((point) => [...point]),
    profile: cutout.profile || null,
    developedBaseOffset: cutout.developedBaseOffset || 0,
    axisIndex: cutout.axisIndex || 0,
    chartDepthLimit: cutout.chartDepthLimit || 0,
    sourceCutoutRegion2d: cutout.sourceCutoutRegion2d || cutout.cutoutRegion2d || null,
    cutoutRegion2d: cutout.cutoutRegion2d || null
  }));
}

function chartRuntimeDomain(chart, diagnostics, strategy) {
  if (chart?.chartDomain2d) return chart.chartDomain2d;
  diagnostics.push({
    severity: "error",
    code: "sheet-metal.chart-domain.missing",
    message: `Sheet chart ${chart?.id || "(unknown)"} is missing runtime chartDomain2d before ${strategy} clipping.`,
    chartId: chart?.id || "",
    chartKind: chart?.kind || "",
    strategy
  });
  return null;
}

function appendCornerCutoutClampDiagnostic(diagnostics, cutout, site, edgeRole, requested, effective, limit) {
  if (requested <= limit + 1e-7) return;
  diagnostics.push({
    severity: "warning",
    code: "corner-relief.cutout.clamped-by-edge",
    message: `Corner relief cutout at ${site?.legacyVertexId || site?.key || "(unknown)"} was clamped on the ${edgeRole} edge from ${requested} to ${effective}.`,
    siteKey: site?.key || "",
    cornerReliefVertexId: cutout?.cornerReliefVertexId || site?.legacyVertexId || "",
    chartId: cutout?.chartId || "",
    chartKind: cutout?.chartKind || "",
    edgeRole,
    requested,
    effective,
    limit
  });
}

function baseBoundaryWithCornerCutouts(chart, cutouts) {
  const diagnostics = [];
  const inputDomain = chartRuntimeDomain(chart, diagnostics, "base-corner-cutouts");
  if (!inputDomain) return { points: [], edges: [], chartDomain2d: null, diagnostics };
  const original = chartDomainBoundary2d(inputDomain);
  if (!original.length) return { points: [], edges: [], chartDomain2d: inputDomain, diagnostics };
  const cutoutApplications = cutouts
    .filter((cutout) => ["circular", "rectangular", "obround"].includes(cutout.type)
      && cutout?.cutoutRegion2d)
    .map((cutout) => ({
      id: `${cutout.siteKey || chart.id}:base`,
      siteKey: cutout.siteKey || "",
      chartId: chart.id || "",
      chartKind: chart.kind || "",
      type: cutout.type || "",
      endpoint: "",
      cornerReliefVertexId: cutout.cornerReliefVertexId || "",
      points2d: (cutout.points2d || []).map((point) => [...point]),
      points3d: (cutout.points3d || []).map((point) => [...point]),
      profile: cutout.profile || null,
      sourceCutoutRegion2d: cutout.cutoutRegion2d || null,
      cutoutRegion2d: cutout.cutoutRegion2d || null
    }));
  const difference = differenceSingleLoopChartDomainByCutoutRegions(
    inputDomain,
    cutoutApplications,
    {
      operation: "difference",
      strategy: "base-corner-cutouts",
      sourceStrategy: "base-corner-cutouts"
    }
  );
  diagnostics.push(...difference.diagnostics);
  return {
    points: chartDomainBoundary2d(difference.domain),
    edges: chartDomainBoundaryEdges(difference.domain),
    chartDomain2d: difference.domain,
    appliedCutoutApplications: chartCutoutApplications(cutoutApplications),
    diagnostics
  };
}

function endpointCutoutSelection(chart, cutouts) {
  const byEndpoint = new Map();
  const diagnostics = [];
  for (const cutout of cutouts) {
    if (!["circular", "rectangular", "obround"].includes(cutout.type)
      || !cutout.endpoint
      || !Array.isArray(cutout.points2d)
      || !cutout.points2d.length) {
      continue;
    }
    const existing = byEndpoint.get(cutout.endpoint);
    if (existing) {
      diagnostics.push({
        severity: "error",
        code: "corner-relief.endpoint-cutout.conflict",
        message: `Sheet chart ${chart?.id || cutout.chartId || "(unknown)"} has multiple corner relief cutouts at the ${cutout.endpoint} endpoint.`,
        chartId: chart?.id || cutout.chartId || "",
        chartKind: chart?.kind || cutout.chartKind || "",
        endpoint: cutout.endpoint,
        siteKeys: [existing.siteKey || "", cutout.siteKey || ""].filter(Boolean)
      });
      continue;
    }
    byEndpoint.set(cutout.endpoint, cutout);
  }
  return { byEndpoint, diagnostics };
}

function endpointSpacingSelection(chart, cutouts) {
  const byEndpoint = new Map();
  const diagnostics = [];
  for (const cutout of cutouts) {
    if (cutout?.type !== "flange-spacing" || !cutout.endpoint || Math.abs(finiteNumberOr(cutout.endpointOffset, 0)) <= 1e-7) continue;
    const existing = byEndpoint.get(cutout.endpoint);
    if (existing) {
      diagnostics.push({
        severity: "error",
        code: "corner-relief.flange-spacing.conflict",
        message: `Sheet chart ${chart?.id || cutout.chartId || "(unknown)"} has multiple flange gap/overlap controls at the ${cutout.endpoint} endpoint.`,
        chartId: chart?.id || cutout.chartId || "",
        chartKind: chart?.kind || cutout.chartKind || "",
        endpoint: cutout.endpoint,
        siteKeys: [existing.siteKey || "", cutout.siteKey || ""].filter(Boolean)
      });
      continue;
    }
    byEndpoint.set(cutout.endpoint, cutout);
  }
  return { byEndpoint, diagnostics };
}

function endpointDomainExtension(spacingByEndpoint, endpoint) {
  return Math.max(0, -finiteNumberOr(spacingByEndpoint.get(endpoint)?.endpointOffset, 0));
}

function chartDomainWithEndpointExtensions(inputDomain, chart, height, spacingByEndpoint) {
  const startExtension = endpointDomainExtension(spacingByEndpoint, "start");
  const endExtension = endpointDomainExtension(spacingByEndpoint, "end");
  if (startExtension <= 1e-7 && endExtension <= 1e-7) return { domain: inputDomain, startExtension: 0, endExtension: 0 };
  const length = Math.max(0, chart?.length || 0);
  return {
    domain: createSingleLoopPolygonSet2d(
      [
        [-startExtension, 0],
        [length + endExtension, 0],
        [length + endExtension, height],
        [-startExtension, height]
      ],
      [],
      {
        coordinateSystem: "chart-2d",
        ...(inputDomain?.metadata || {}),
        operation: "identity",
        strategy: "endpoint-flange-overlap-domain",
        flangeStartExtension: startExtension,
        flangeEndExtension: endExtension
      }
    ),
    startExtension,
    endExtension
  };
}

function endpointCutoutApplicationFromCutout(chart, endpoint, cutout, endpointExtension = 0) {
  const curve = cutout?.points2d || [];
  if (!cutout || curve.length < 2) return null;
  return {
    id: `${cutout.siteKey || chart.id}:${endpoint}`,
    siteKey: cutout.siteKey || "",
    chartId: chart.id || "",
    chartKind: chart.kind || "",
    type: cutout.type || "",
    endpoint,
    cornerReliefVertexId: cutout.cornerReliefVertexId || "",
    points2d: (cutout.points2d || []).map((point) => [...point]),
    points3d: (cutout.points3d || []).map((point) => [...point]),
    profile: cutout.profile || null,
    developedBaseOffset: cutout.developedBaseOffset || 0,
    axisIndex: cutout.axisIndex || 0,
    chartDepthLimit: cutout.chartDepthLimit || 0,
    sourceCutoutRegion2d: cutout.cutoutRegion2d || null,
    cutoutRegion2d: chartCutoutRegionFromPoints(endpointCutoutRegionPoints(chart, endpoint, curve, endpointExtension), {
      strategy: `${cutout?.type || "relief"}-${chart.kind || "chart"}-endpoint-cutout`,
      coordinateSystem: "chart-2d",
      siteKey: cutout?.siteKey || "",
      chartId: chart.id || "",
      chartKind: chart.kind || "",
      endpoint,
      cornerReliefVertexId: cutout?.cornerReliefVertexId || "",
      cornerReliefType: cutout?.type || "",
      endpointExtension: Math.max(0, finiteNumberOr(endpointExtension, 0))
    })
  };
}

function endpointSpacingCutoutApplication(chart, endpoint, spacing) {
  const endpointOffset = finiteNumberOr(spacing?.endpointOffset, 0);
  if (endpointOffset <= 1e-7) return null;
  const length = Math.max(0, chart?.length || 0);
  const height = Math.max(0, chart?.kind === "bend" ? chart.developedWidth || 0 : chart.flangeLength || 0);
  if (length <= 0 || height <= 0) return null;
  const trim = Math.min(endpointOffset, Math.max(0, length - CLIP_MARGIN));
  if (trim <= 1e-7) return null;
  const points = endpoint === "end"
    ? [[length - trim, 0], [length, 0], [length, height], [length - trim, height]]
    : [[0, 0], [trim, 0], [trim, height], [0, height]];
  return {
    id: `${spacing?.siteKey || chart.id}:${endpoint}:flange-spacing`,
    siteKey: spacing?.siteKey || "",
    chartId: chart.id || "",
    chartKind: chart.kind || "",
    type: "flange-spacing",
    endpoint,
    cornerReliefVertexId: spacing?.cornerReliefVertexId || "",
    flangeGap: finiteNumberOr(spacing?.flangeGap, 0),
    flangeGapMode: spacing?.flangeGapMode || "symmetric",
    flangeGapSwapped: spacing?.flangeGapSwapped === true,
    flangeGapRole: spacing?.flangeGapRole || "",
    flangeContactOffset: finiteNumberOr(spacing?.flangeContactOffset, 0),
    flangeButtSpan: finiteNumberOr(spacing?.flangeButtSpan, 0),
    endpointOffset,
    cutoutRegion2d: chartCutoutRegionFromPoints(points, {
      strategy: "endpoint-flange-gap",
      siteKey: spacing?.siteKey || "",
      chartId: chart.id || "",
      chartKind: chart.kind || "",
      endpoint,
      flangeGapMode: spacing?.flangeGapMode || "symmetric",
      flangeGapSwapped: spacing?.flangeGapSwapped === true,
      flangeGapRole: spacing?.flangeGapRole || "",
      flangeContactOffset: finiteNumberOr(spacing?.flangeContactOffset, 0),
      flangeButtSpan: finiteNumberOr(spacing?.flangeButtSpan, 0),
      cornerReliefVertexId: spacing?.cornerReliefVertexId || "",
      cornerReliefType: "flange-spacing"
    })
  };
}

function chartBoundaryWithEndpointCutouts(chart, cutouts) {
  const length = Math.max(0, chart.length || 0);
  const height = Math.max(0, chart.kind === "bend" ? chart.developedWidth || 0 : chart.flangeLength || 0);
  const diagnostics = [];
  const inputDomain = chartRuntimeDomain(chart, diagnostics, "endpoint-cutouts");
  if (!inputDomain) {
    return {
      points: [],
      edges: [],
      chartDomain2d: null,
      diagnostics
    };
  }
  if (length <= 0 || height <= 0) {
    return {
      points: chartDomainBoundary2d(inputDomain),
      edges: chartDomainBoundaryEdges(inputDomain),
      chartDomain2d: inputDomain,
      diagnostics: []
    };
  }
  const selection = endpointCutoutSelection(chart, cutouts);
  diagnostics.push(...selection.diagnostics);
  const spacingSelection = endpointSpacingSelection(chart, cutouts);
  diagnostics.push(...spacingSelection.diagnostics);
  const { byEndpoint } = selection;
  const extensionDomain = chartDomainWithEndpointExtensions(inputDomain, chart, height, spacingSelection.byEndpoint);
  const workingDomain = extensionDomain.domain;
  const startCutout = byEndpoint.get("start");
  const endCutout = byEndpoint.get("end");
  const cutoutApplications = [];
  for (const endpoint of ["start", "end"]) {
    const application = endpointSpacingCutoutApplication(chart, endpoint, spacingSelection.byEndpoint.get(endpoint));
    if (application?.cutoutRegion2d) cutoutApplications.push(application);
  }
  const endApplication = endpointCutoutApplicationFromCutout(chart, "end", endCutout, extensionDomain.endExtension);
  if (endApplication?.cutoutRegion2d) cutoutApplications.push(endApplication);
  const startApplication = endpointCutoutApplicationFromCutout(chart, "start", startCutout, extensionDomain.startExtension);
  if (startApplication?.cutoutRegion2d) cutoutApplications.push(startApplication);
  const difference = differenceSingleLoopChartDomainByCutoutRegions(
    workingDomain,
    cutoutApplications,
    {
      operation: "difference",
      strategy: "endpoint-cutouts",
      sourceStrategy: "endpoint-cutouts"
    }
  );
  diagnostics.push(...difference.diagnostics);
  return {
    points: chartDomainBoundary2d(difference.domain),
    edges: chartDomainBoundaryEdges(difference.domain),
    chartDomain2d: difference.domain,
    appliedCutoutApplications: chartCutoutApplications(cutoutApplications),
    diagnostics
  };
}

function clipChartDomainByCutouts(chart, sitesByKey, cutouts, options = {}) {
  const strategy = chart?.kind === "base" ? "base-corner-cutouts" : "endpoint-cutouts";
  const boundary = strategy === "base-corner-cutouts"
    ? baseBoundaryWithCornerCutouts(chart, cutouts)
    : chartBoundaryWithEndpointCutouts(chart, cutouts);
  const domainClip = {
    coordinateSystem: "chart-2d",
    operation: "difference",
    strategy,
    domainOperation: boundary.chartDomain2d?.metadata?.domainOperation || "cutout-region-difference",
    booleanBackend: boundary.chartDomain2d?.metadata?.booleanBackend || "simple-polygon-segment-graph",
    topology: "single-outer-loop",
    cutoutCount: cutouts.length,
    cutoutRegionCount: (boundary.appliedCutoutApplications || []).filter((cutout) => cutout?.cutoutRegion2d).length,
    reliefCutoutCount: cutouts.filter((cutout) => cutout?.siteKey).length
  };
  return {
    ...boundary,
    chartDomain2d: boundary.chartDomain2d || null,
    appliedCutoutApplications: boundary.appliedCutoutApplications || [],
    domainClip
  };
}

function clipReliefCutoutEvaluation(evaluation, options = {}) {
  const sitesByKey = new Map((evaluation?.sites || []).map((site) => [site.key, site]));
  const cutoutsForChart = cutoutByChart(evaluation?.cutouts || []);
  const diagnostics = [...(evaluation?.diagnostics || [])];
  const charts = (evaluation?.charts || []).map((chart) => {
    const cutouts = cutoutsForChart.get(chart.id) || [];
    const boundary = clipChartDomainByCutouts(chart, sitesByKey, cutouts, options);
    diagnostics.push(...(boundary.diagnostics || []));
    return {
      ...chart,
      cutoutApplications: boundary.appliedCutoutApplications || [],
      clippedBoundary2d: boundary.points,
      boundaryEdges: boundary.edges,
      chartDomain2d: boundary.chartDomain2d,
      domainClip: boundary.domainClip
    };
  });
  return {
    ...evaluation,
    diagnostics,
    charts,
    chartById: new Map(charts.map((chart) => [chart.id, chart]))
  };
}

function rawSpecForSite(plate, site) {
  const overrides = new Map(arrayValues(plate?.fabrication?.cornerReliefs).map((relief) => [relief.vertexId, relief]));
  return overrides.get(site.legacyVertexId) || plate?.fabrication?.reliefDefaults || null;
}

function siteReliefDiagnostics(site, spec) {
  return (spec?.diagnostics || []).map((diagnostic) => ({
    ...diagnostic,
    siteKey: site?.key || "",
    cornerReliefVertexId: site?.legacyVertexId || site?.target?.vertexId || ""
  }));
}

function reliefSpecBlocksCutouts(spec) {
  return spec?.status === "invalid"
    || spec?.status === "unsupported"
    || (spec?.diagnostics || []).some((diagnostic) => diagnostic.severity === "error");
}

export function resolveReliefSpecsForSites(plate, sites = []) {
  const specs = new Map();
  for (const site of sites) {
    const rawSpec = rawSpecForSite(plate, site);
    specs.set(site.key, resolvePlateCornerReliefSpec(rawSpec, plate, site));
  }
  return specs;
}

function reliefSpecDiagnosticsForSites(sites = [], specs = new Map()) {
  return sites.flatMap((site) => siteReliefDiagnostics(site, specs.get(site.key)));
}

function buildReliefCutoutEvaluation(chartResult, sites = [], specs = new Map(), options = {}) {
  const diagnostics = [
    ...(chartResult?.diagnostics || []),
    ...reliefSpecDiagnosticsForSites(sites, specs)
  ];
  const cutouts = [];
  for (const site of sites) {
    const spec = specs.get(site.key);
    if (reliefSpecBlocksCutouts(spec)) continue;
    for (const chartId of site.affectedChartIds || []) {
      const chart = chartResult.chartById.get(chartId);
      if (!chart) continue;
      const spacing = buildFlangeSpacingForChart(chart, site, spec, chartResult.chartById, chartResult.thickness);
      if (spacing) cutouts.push(spacing);
      const cutout = buildReliefCutoutForChart(chart, site, spec, options);
      if (cutout) {
        cutouts.push(cutout);
        diagnostics.push(...(cutout.diagnostics || []));
      }
    }
  }
  return {
    ...chartResult,
    sites,
    specs,
    cutouts,
    diagnostics,
    developedDistanceFromSite
  };
}

export function applyReliefCutoutsToCharts(chartResult, sites = [], specs = new Map(), options = {}) {
  const evaluation = buildReliefCutoutEvaluation(chartResult, sites, specs, options);
  return clipReliefCutoutEvaluation(evaluation, options);
}

export function buildReliefCutoutsForCharts(plate, options = {}) {
  const chartResult = buildPlateSheetCharts(plate, options);
  const sites = evaluateCornerReliefSites(plate);
  const specs = resolveReliefSpecsForSites(plate, sites);
  return buildReliefCutoutEvaluation(chartResult, sites, specs, options);
}

export function buildClippedReliefChartDomains(plate, options = {}) {
  const chartResult = buildPlateSheetCharts(plate, options);
  const sites = evaluateCornerReliefSites(plate);
  const specs = resolveReliefSpecsForSites(plate, sites);
  return applyReliefCutoutsToCharts(chartResult, sites, specs, options);
}

export function circularCutoutEquationError(cutout, chart, site) {
  if (!cutout || !chart || !site || cutout.type !== "circular") return [];
  if (chart.kind === "base") {
    return cutout.points2d.map((point) => Math.abs(distance2(point, site.basePoint2d) - cutout.effectiveRadius));
  }
  return cutout.points2d.map((point) => {
    const developed = developedDistanceFromSite(chart, point, site);
    if (!developed) return Infinity;
    return Math.abs(Math.hypot(developed[0], developed[1]) - cutout.effectiveRadius);
  });
}
