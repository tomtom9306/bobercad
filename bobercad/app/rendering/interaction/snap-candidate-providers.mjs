import { WORLD_AXIS_ENTRIES, closestAxisPoints, closestPointOnSegment, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs";
import { arrayValues, objectById, truthyValues, uniqueTruthy } from "../../engine/core/model.mjs";
import { memberCenter, memberLayoutAxis } from "../../engine/api/project/members.mjs";
import { allGridIntersectionPoints, allGridLineSegments, projectLevels } from "../../engine/api/project/datums.mjs";
import {
  orderedSketchLoop,
  sketchEdgeCenterPoint,
  sketchEdgeIsCircularArc,
  sketchEdgeMidpoint,
  sketchEdgeQuadrantPoints,
  sketchEdgeSamplePoints
} from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { libraryProfileById } from "../../engine/api/project/profiles.mjs";
import { memberFrameAt } from "../../engine/geometry/member-evaluator.mjs";

const EPSILON = 1e-9;
const VISIBLE_OBJECT_SNAP = "visible-object";
const VISIBLE_POINT_SNAP = "visible-point";
const VISIBLE_EDGE_SNAP = "visible-edge";
const VISIBLE_SURFACE_SNAP = "visible-surface";
const SNAP_PROVIDER_INDEX = new WeakMap();

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function projectSnapProviderIndex(project) {
  if (!project || typeof project !== "object") return null;
  let cached = SNAP_PROVIDER_INDEX.get(project);
  if (cached) return cached;
  const model = project.model || {};
  cached = {
    members: Object.values(model.members || {}),
    plates: Object.values(model.plates || {}),
    fastenerGroups: Object.values(model.fastenerGroups || {}),
    features: model.features || {},
    holePatterns: model.holePatterns || {},
    workPoints: Object.values(model.workPoints || {}),
    levels: Object.values(projectLevels(project)),
    gridLineSegments: allGridLineSegments(project),
    gridIntersectionPoints: allGridIntersectionPoints(project),
    referencePlanes: Object.values(model.referencePlanes || {}),
    membersById: model.members || {}
  };
  SNAP_PROVIDER_INDEX.set(project, cached);
  return cached;
}

function persistentReference(data = {}, kind = null) {
  if (plainObject(data.reference)) return data.reference;
  if (data.type === "global-axis" && typeof data.axis === "string") {
    return { type: "global-axis", axis: data.axis };
  }
  if ((data.type === "member-axis" || data.type === "layout-axis") && typeof data.objectId === "string") {
    return { type: data.type, memberId: data.objectId };
  }
  if (data.type === "reference-plane-axis" && typeof data.objectId === "string" && typeof data.axis === "string") {
    return { type: "reference-plane-axis", referencePlaneId: data.objectId, axis: data.axis };
  }
  if (data.type === "reference-plane-origin" && typeof data.objectId === "string") {
    return { type: "reference-plane-origin", referencePlaneId: data.objectId };
  }
  if (data.target?.collection && data.target?.objectId) {
    return {
      type: kind || data.kind || "snap",
      collection: data.target.collection,
      objectId: data.target.objectId,
      subId: data.target.subId || null,
      semanticRole: data.target.semanticRole || null
    };
  }
  return null;
}

function candidateContract(kind, data = {}, geometry = {}, defaultPriority = 0) {
  const providerId = data.providerId || "model";
  const priority = finiteNumber(data.priority) ? data.priority : defaultPriority;
  const objectId = data.objectId || data.target?.objectId || null;
  const reference = persistentReference(data, kind);
  return {
    geometry: { kind, ...geometry },
    identity: {
      providerId,
      type: data.type || null,
      objectId,
      target: data.target || null,
      candidateId: data.candidateId || null
    },
    visibility: {
      policy: data.visibilityPolicy || null,
      objectIds: uniqueTruthy([objectId])
    },
    ranking: {
      priority,
      screenTolerance: finiteNumber(data.screenTolerance) ? data.screenTolerance : null
    },
    reference,
    hints: {
      relationHints: Array.isArray(data.relationHints) ? data.relationHints : []
    },
    preview: plainObject(data.preview) ? data.preview : null
  };
}

function defaultVisibilityPolicy(data = {}, kind = null) {
  if (data.visibilityPolicy === false || data.visibilityPolicy === null) return null;
  if (typeof data.visibilityPolicy === "string") return data.visibilityPolicy;
  if (!["model.members", "model.plates", "model.fasteners"].includes(data.providerId)) return null;
  if (kind === "point") return VISIBLE_POINT_SNAP;
  if (kind === "line") return VISIBLE_EDGE_SNAP;
  if (kind === "plane") return VISIBLE_SURFACE_SNAP;
  return VISIBLE_OBJECT_SNAP;
}

function candidateData(data = {}, kind = null) {
  const visibilityPolicy = defaultVisibilityPolicy(data, kind);
  return visibilityPolicy ? { visibilityPolicy, ...data } : data;
}

function pushPoint(candidates, point, data = {}) {
  if (!v.isVec3(point)) return;
  const extra = candidateData(data, "point");
  candidates.push({
    kind: "point",
    point: [...point],
    priority: 100,
    providerId: extra.providerId || "model",
    target: extra.target || null,
    ...extra,
    ...candidateContract("point", extra, { point: [...point] }, 100)
  });
}

function pushLine(candidates, a, b, data = {}) {
  if (!v.isVec3(a) || !v.isVec3(b) || v.len(v.sub(b, a)) <= EPSILON) return;
  const extra = candidateData(data, "line");
  candidates.push({
    kind: "line",
    a: [...a],
    b: [...b],
    point: v.isVec3(extra.point) ? [...extra.point] : [...a],
    priority: 60,
    providerId: extra.providerId || "model",
    target: extra.target || null,
    ...extra,
    ...candidateContract("line", extra, { a: [...a], b: [...b], point: v.isVec3(extra.point) ? [...extra.point] : [...a] }, 60)
  });
}

function pushPlane(candidates, points, data = {}) {
  const cleanPoints = arrayValues(points).filter(v.isVec3);
  if (cleanPoints.length < 3) return;
  const extra = candidateData(data, "plane");
  const origin = v.isVec3(extra.origin) ? extra.origin : cleanPoints[0];
  const axisU = v.safeNorm(extra.axisU, [0, 0, 0]);
  const axisV = v.safeNorm(extra.axisV, [0, 0, 0]);
  const normal = v.safeNorm(extra.normal || v.cross(axisU, axisV), [0, 0, 0]);
  if (v.len(axisU) <= EPSILON || v.len(axisV) <= EPSILON || v.len(normal) <= EPSILON) return;
  candidates.push({
    kind: "plane",
    points: cleanPoints.map((point) => [...point]),
    origin: [...origin],
    axisU,
    axisV,
    normal,
    point: v.isVec3(extra.point) ? [...extra.point] : [...origin],
    priority: 48,
    providerId: extra.providerId || "model",
    target: extra.target || null,
    ...extra,
    ...candidateContract("plane", extra, {
      points: cleanPoints.map((point) => [...point]),
      origin: [...origin],
      axisU,
      axisV,
      normal
    }, 48)
  });
}

function target(collection, objectId, subId = null, semanticRole = null) {
  return {
    collection,
    objectId,
    ...(subId ? { subId } : {}),
    ...(semanticRole ? { semanticRole } : {})
  };
}

function inRange(point, options) {
  if (!v.isVec3(options.center) || !(options.radius > 0)) return true;
  if (!v.isVec3(point)) return false;
  return v.len(v.sub(point, options.center)) <= options.radius;
}

function sphereInRange(center, radius, options) {
  if (!v.isVec3(options.center) || !(options.radius > 0)) return true;
  if (!v.isVec3(center)) return false;
  return v.len(v.sub(center, options.center)) <= options.radius + Math.max(0, radius || 0);
}

function memberSnapDistance(member, options) {
  if (!v.isVec3(options.center) || !(options.radius > 0)) return true;
  const closest = closestPointOnSegment(member.start, member.end, options.center).point;
  return v.len(v.sub(closest, options.center));
}

function membersInRange(project, options) {
  const members = projectSnapProviderIndex(project)?.members || [];
  const maxMemberCandidates = finiteNumber(options.maxMemberCandidates)
    ? Math.max(0, Math.floor(options.maxMemberCandidates))
    : null;
  if (maxMemberCandidates === null) return members.filter((member) => memberSnapDistance(member, options) === true || memberSnapDistance(member, options) <= options.radius);
  const scored = [];
  for (const member of members) {
    const distance = memberSnapDistance(member, options);
    if (distance !== true && options.radius > 0 && distance > options.radius) continue;
    scored.push({ member, distance: distance === true ? 0 : distance });
  }
  scored.sort((left, right) => left.distance - right.distance);
  return scored.slice(0, maxMemberCandidates).map((item) => item.member);
}

function profileContours(profile) {
  return arrayValues(profile?.section?.contours)
    .filter((contour) => contour.role === "solid")
    .map((contour) => arrayValues(contour.points)
      .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])));
}

function sectionPoint(member, station, point) {
  const frame = memberFrameAt(member, station);
  const y = point[0] * (frame.transform?.scaleY || 1);
  const z = point[1] * (frame.transform?.scaleZ || 1);
  return v.add(frame.origin, v.add(v.mul(frame.y, y), v.mul(frame.z, z)));
}

function sectionMidPoint(member, station, a, b) {
  return sectionPoint(member, station, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
}

function addMemberProfileTargets(candidates, member, profile, options) {
  const surfaceMode = options.profile?.includeSurfaceTargets;
  if (!surfaceMode || surfaceMode === false) return;
  const contours = profileContours(profile);
  if (!contours.length) return;
  let frame;
  try {
    frame = memberFrameAt(member, 0);
  } catch {
    return;
  }
  const stations = [0, frame.length / 2, frame.length].filter((station, index, items) => index === 0 || Math.abs(station - items[index - 1]) > EPSILON);
  const providerId = "model.members";
  const cornerOnly = surfaceMode === "corners";
  const includeEdges = surfaceMode === "edges" || surfaceMode === "faces";
  const includeFaces = surfaceMode === "faces";

  for (const contour of contours) {
    for (let index = 0; index < contour.length; index += 1) {
      const point = contour[index];
      for (const station of stations) {
        pushPoint(candidates, sectionPoint(member, station, point), {
          providerId,
          type: "member-profile-corner",
          objectId: member.id,
          label: "Member corner",
          priority: 86,
          target: target("members", member.id, `profile-corner-${index}@${Math.round(station)}`, "profile-corner")
        });
      }
      if (includeEdges) {
        const start = sectionPoint(member, 0, point);
        const end = sectionPoint(member, frame.length, point);
        pushLine(candidates, start, end, {
          providerId,
          type: "member-profile-edge",
          objectId: member.id,
          label: "Member edge",
          priority: 76,
          allowIntersections: false,
          target: target("members", member.id, `profile-edge-${index}`, "profile-edge")
        });
        pushPoint(candidates, sectionPoint(member, frame.length / 2, point), {
          providerId,
          type: "member-profile-edge-midpoint",
          objectId: member.id,
          label: "Member edge midpoint",
          priority: 92,
          target: target("members", member.id, `profile-edge-mid-${index}`, "profile-edge-midpoint")
        });
      }
      if (cornerOnly) continue;
      const next = contour[(index + 1) % contour.length];
      if (!next) continue;
      const faceStartA = includeFaces ? sectionPoint(member, 0, point) : null;
      const faceStartB = includeFaces ? sectionPoint(member, 0, next) : null;
      const faceEndA = includeFaces ? sectionPoint(member, frame.length, point) : null;
      const faceEndB = includeFaces ? sectionPoint(member, frame.length, next) : null;
      const faceWidth = includeFaces ? v.len(v.sub(faceStartB, faceStartA)) : 0;
      const facePoints = faceWidth > EPSILON ? [faceStartA, faceEndA, faceEndB, faceStartB] : null;
      if (includeEdges) {
        for (const station of [0, frame.length]) {
          const edgeStart = sectionPoint(member, station, point);
          const edgeEnd = sectionPoint(member, station, next);
          const edgeMid = sectionMidPoint(member, station, point, next);
          pushLine(candidates, edgeStart, edgeEnd, {
            providerId,
            type: "member-profile-section-edge",
            objectId: member.id,
            label: "Member section edge",
            point: edgeMid,
            priority: 78,
            allowIntersections: false,
            target: target("members", member.id, `profile-section-edge-${index}@${Math.round(station)}`, "profile-section-edge")
          });
          pushPoint(candidates, edgeMid, {
            providerId,
            type: "member-profile-section-edge-midpoint",
            objectId: member.id,
            label: "Member section edge midpoint",
            priority: 90,
            target: target("members", member.id, `profile-section-edge-mid-${index}@${Math.round(station)}`, "profile-section-edge-midpoint")
          });
        }
      }
      for (const station of stations) {
        pushPoint(candidates, sectionMidPoint(member, station, point, next), {
          providerId,
          type: "member-profile-face-center",
          objectId: member.id,
          label: "Member face center",
          priority: 82,
          ...(facePoints ? { snapFacePoints: facePoints } : {}),
          ...(facePoints ? { visibilityPolicy: VISIBLE_SURFACE_SNAP } : {}),
          target: target("members", member.id, `profile-face-center-${index}@${Math.round(station)}`, "profile-face-center")
        });
      }
      if (includeFaces) {
        if (facePoints) {
          const faceAxisV = v.mul(v.sub(faceStartB, faceStartA), 1 / faceWidth);
          const faceCenter = v.mul(v.add(v.add(faceStartA, faceStartB), v.add(faceEndA, faceEndB)), 0.25);
          pushPlane(candidates, facePoints, {
            providerId,
            type: "member-profile-face",
            objectId: member.id,
            label: "Member face",
            origin: faceStartA,
            axisU: frame.x,
            axisV: faceAxisV,
            normal: v.cross(frame.x, faceAxisV),
            bounds: { minU: 0, maxU: frame.length, minV: 0, maxV: faceWidth },
            point: faceCenter,
            priority: 52,
            preferInteriorSnap: true,
            interiorSnapEdgeBiasPx: 3,
            target: target("members", member.id, `profile-face-${index}`, "profile-face")
          });
          pushLine(candidates, sectionMidPoint(member, 0, point, next), sectionMidPoint(member, frame.length, point, next), {
            providerId,
            type: "member-profile-face-centerline",
            objectId: member.id,
            label: "Member face centerline",
            origin: faceStartA,
            axisU: frame.x,
            axisV: faceAxisV,
            normal: v.cross(frame.x, faceAxisV),
            bounds: { minU: 0, maxU: frame.length, minV: 0, maxV: faceWidth },
            priority: 74,
            allowIntersections: false,
            visibilityPolicy: VISIBLE_SURFACE_SNAP,
            snapFacePoints: facePoints,
            target: target("members", member.id, `profile-face-centerline-${index}`, "profile-face-centerline")
          });
        }
      }
    }
  }
}

function addMemberCandidates(candidates, project, profiles, options) {
  if (options.scope?.members === false) return;
  const includeLines = options.includeLines !== false;
  const includeLayoutAxis = options.includeLayoutAxis !== false;
  const catalog = profiles?.profiles || profiles || {};
  for (const rawMember of membersInRange(project, options)) {
    const member = project.objectIndex?.[rawMember.id] ? objectById(project, rawMember.id) : rawMember;
    const providerId = "model.members";
    pushPoint(candidates, member.start, {
      providerId,
      type: "member-endpoint",
      objectId: member.id,
      endpoint: "start",
      label: "Endpoint",
      priority: 120,
      target: target("members", member.id, "start", "endpoint")
    });
    pushPoint(candidates, member.end, {
      providerId,
      type: "member-endpoint",
      objectId: member.id,
      endpoint: "end",
      label: "Endpoint",
      priority: 120,
      target: target("members", member.id, "end", "endpoint")
    });
    pushPoint(candidates, memberCenter(member), {
      providerId,
      type: "member-midpoint",
      objectId: member.id,
      label: "Member midpoint",
      priority: 95,
      target: target("members", member.id, "mid", "midpoint")
    });
    if (includeLines) {
      pushLine(candidates, member.start, member.end, {
        providerId,
        type: "member-axis",
        objectId: member.id,
        label: "Member axis",
        priority: 70,
        target: target("members", member.id, "axis", "axis")
      });
    }
    if (includeLayoutAxis && member.layoutAxis) {
      const axis = memberLayoutAxis(member);
      pushPoint(candidates, axis.start, {
        providerId,
        type: "layout-endpoint",
        objectId: member.id,
        endpoint: "start",
        label: "Layout endpoint",
        priority: 115,
        target: target("members", member.id, "layout-start", "layout-endpoint")
      });
      pushPoint(candidates, axis.end, {
        providerId,
        type: "layout-endpoint",
        objectId: member.id,
        endpoint: "end",
        label: "Layout endpoint",
        priority: 115,
        target: target("members", member.id, "layout-end", "layout-endpoint")
      });
      if (includeLines) {
        pushLine(candidates, axis.start, axis.end, {
          providerId,
          type: "layout-axis",
          objectId: member.id,
          label: "Layout axis",
          priority: 80,
          target: target("members", member.id, "layout-axis", "layout-axis")
        });
      }
    }
    const profile = libraryProfileById(catalog, member.profile);
    if (profile) addMemberProfileTargets(candidates, member, profile, options);
  }
}

function edgeRefTargetId(line, index) {
  return line.edgeKey || `evaluated-edge-${index}`;
}

function targetWithEdgeRef(collection, objectId, subId, semanticRole, edgeRef) {
  return {
    ...target(collection, objectId, subId, semanticRole),
    ...(edgeRef ? { edgeRef } : {})
  };
}

function addEvaluatedMemberEdgeCandidates(candidates, options) {
  if (options.scope?.members === false || options.includeLines === false) return;
  const surfaceMode = options.profile?.includeSurfaceTargets;
  if (surfaceMode !== "edges" && surfaceMode !== "faces") return;
  for (const [index, line] of arrayValues(options.evaluatedEdges).entries()) {
    if (line?.snapRole !== "member-evaluated-edge" || line.collection !== "members" || !line.objectId) continue;
    const points = arrayValues(line.points).filter(v.isVec3);
    if (points.length < 2) continue;
    const a = points[0];
    const b = points[1];
    const point = v.isVec3(options.center) ? closestPointOnSegment(options.center, a, b) : v.mul(v.add(a, b), 0.5);
    const subId = edgeRefTargetId(line, index);
    const base = {
      providerId: "model.members",
      objectId: line.objectId,
      edgeRef: line.edgeRef || null,
      edgeKey: line.edgeKey || null
    };
    pushLine(candidates, a, b, {
      ...base,
      type: "member-evaluated-edge",
      label: "Member edge",
      point,
      priority: 84,
      allowIntersections: false,
      target: targetWithEdgeRef("members", line.objectId, subId, "evaluated-edge", line.edgeRef)
    });
    pushPoint(candidates, point, {
      ...base,
      type: "member-evaluated-edge-midpoint",
      label: "Member edge midpoint",
      priority: 94,
      target: targetWithEdgeRef("members", line.objectId, `${subId}:mid`, "evaluated-edge-midpoint", line.edgeRef)
    });
    for (const [endpointIndex, endpoint] of [a, b].entries()) {
      pushPoint(candidates, endpoint, {
        ...base,
        type: "member-evaluated-edge-endpoint",
        label: "Member edge endpoint",
        priority: 98,
        target: targetWithEdgeRef("members", line.objectId, `${subId}:endpoint-${endpointIndex}`, "evaluated-edge-endpoint", line.edgeRef)
      });
    }
  }
}

function addGridCandidates(candidates, project, options) {
  if (options.scope?.grids === false) return;
  for (const segment of projectSnapProviderIndex(project)?.gridLineSegments || []) {
    pushLine(candidates, segment.a, segment.b, {
      providerId: "model.gridSystems",
      type: "grid-line",
      objectId: segment.grid.id,
      axis: segment.axisGroup,
      label: `Grid ${segment.axis.label || segment.axis.id || segment.axisGroup.toUpperCase()}`,
      priority: 55,
      reference: {
        type: "grid-line",
        gridSystemId: segment.grid.id,
        axisGroup: segment.axisGroup,
        axisId: segment.axis.id || null,
        levelId: segment.level?.id || null
      },
      target: target("gridSystems", segment.grid.id, segment.axis.id || segment.axisGroup, "grid-line")
    });
  }
  for (const intersection of projectSnapProviderIndex(project)?.gridIntersectionPoints || []) {
    pushPoint(candidates, intersection.point, {
      providerId: "model.gridSystems",
      type: "grid-intersection",
      objectId: intersection.grid.id,
      label: `Grid ${intersection.xAxis.label || intersection.xAxis.id || "X"}/${intersection.yAxis.label || intersection.yAxis.id || "Y"}`,
      priority: 130,
      reference: {
        type: "grid-intersection",
        gridSystemId: intersection.grid.id,
        xAxisId: intersection.xAxis.id || null,
        yAxisId: intersection.yAxis.id || null,
        levelId: intersection.level?.id || null
      },
      target: target("gridSystems", intersection.grid.id, `${intersection.xAxis.id || "x"}/${intersection.yAxis.id || "y"}/${intersection.level.id || "level"}`, "grid-intersection")
    });
  }
}

function addLevelCandidates(candidates, project, options) {
  if (options.scope?.grids === false) return;
  const span = Math.max(1, finiteNumberOr(options.levelSnapSpan, 5000));
  for (const level of projectSnapProviderIndex(project)?.levels || []) {
    const elevation = finiteNumber(level.elevation) ? level.elevation : 0;
    const origin = [0, 0, elevation];
    const points = [
      [-span, -span, elevation],
      [span, -span, elevation],
      [span, span, elevation],
      [-span, span, elevation]
    ];
    pushPlane(candidates, points, {
      providerId: "model.levels",
      type: "level-plane",
      objectId: level.id,
      origin,
      axisU: [1, 0, 0],
      axisV: [0, 1, 0],
      normal: [0, 0, 1],
      bounds: { minU: -span, maxU: span, minV: -span, maxV: span },
      label: `Level ${level.name || level.id}`,
      priority: 52,
      target: target("levels", level.id, "plane", "level-plane")
    });
  }
}

function planeAxisPoint(plane, axisX, axisY, x, y) {
  return v.add(v.add(plane.origin, v.mul(axisX, x)), v.mul(axisY, y));
}

function referencePlaneSpans(plane, fallback = 5000) {
  const extents = plane.extents || {};
  const xMin = finiteNumber(extents.xMin) ? extents.xMin : -fallback;
  const xMax = finiteNumber(extents.xMax) ? extents.xMax : fallback;
  const yMin = finiteNumber(extents.yMin) ? extents.yMin : -fallback;
  const yMax = finiteNumber(extents.yMax) ? extents.yMax : fallback;
  return {
    xMin: Math.min(xMin, xMax),
    xMax: Math.max(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    yMax: Math.max(yMin, yMax)
  };
}

function addReferencePlaneCandidates(candidates, project, options) {
  if (options.scope?.referencePlanes === false) return;
  const spanFallback = Math.max(1, finiteNumberOr(options.referencePlaneSnapSpan, 5000));
  for (const plane of projectSnapProviderIndex(project)?.referencePlanes || []) {
    if (!v.isVec3(plane.origin) || !inRange(plane.origin, options)) continue;
    const axisX = v.safeNorm(plane.axisX, [1, 0, 0]);
    const axisY = v.safeNorm(plane.axisY, [0, 1, 0]);
    const spans = referencePlaneSpans(plane, spanFallback);
    const label = plane.name || plane.id || "Reference plane";
    pushPoint(candidates, plane.origin, {
      providerId: "model.referencePlanes",
      type: "reference-plane-origin",
      objectId: plane.id,
      label: `${label} origin`,
      priority: 118,
      target: target("referencePlanes", plane.id, "origin", "origin")
    });
    const hasExtents = finiteNumber(plane.extents?.xMin)
      || finiteNumber(plane.extents?.xMax)
      || finiteNumber(plane.extents?.yMin)
      || finiteNumber(plane.extents?.yMax);
    const corners = hasExtents
      ? [
        [spans.xMin, spans.yMin],
        [spans.xMax, spans.yMin],
        [spans.xMax, spans.yMax],
        [spans.xMin, spans.yMax]
      ].map(([x, y]) => planeAxisPoint(plane, axisX, axisY, x, y))
      : [];
    for (const [index, point] of corners.entries()) {
      pushPoint(candidates, point, {
        providerId: "model.referencePlanes",
        type: "reference-plane-corner",
        objectId: plane.id,
        label: `${label} corner`,
        priority: 92,
        target: target("referencePlanes", plane.id, `corner-${index + 1}`, "corner")
      });
    }
    if (options.includeLines === false) continue;
    pushLine(candidates, planeAxisPoint(plane, axisX, axisY, spans.xMin, 0), planeAxisPoint(plane, axisX, axisY, spans.xMax, 0), {
      providerId: "model.referencePlanes",
      type: "reference-plane-axis",
      objectId: plane.id,
      axis: "x",
      label: `${label} X axis`,
      priority: 68,
      target: target("referencePlanes", plane.id, "axis-x", "axis")
    });
    pushLine(candidates, planeAxisPoint(plane, axisX, axisY, 0, spans.yMin), planeAxisPoint(plane, axisX, axisY, 0, spans.yMax), {
      providerId: "model.referencePlanes",
      type: "reference-plane-axis",
      objectId: plane.id,
      axis: "y",
      label: `${label} Y axis`,
      priority: 68,
      target: target("referencePlanes", plane.id, "axis-y", "axis")
    });
  }
}

function addWorkPointCandidates(candidates, project, options) {
  if (options.scope?.workPoints === false) return;
  for (const point of projectSnapProviderIndex(project)?.workPoints || []) {
    const position = point.point;
    if (!inRange(position, options)) continue;
    pushPoint(candidates, position, {
      providerId: "model.workPoints",
      type: "work-point",
      objectId: point.id,
      label: `Work point ${point.name || point.id}`,
      priority: 125,
      target: target("workPoints", point.id, "point", "work-point")
    });
  }
}

function platePoint(plate, point) {
  return v.add(
    plate.center,
    v.add(v.mul(plate.localAxisY, point[0]), v.mul(plate.localAxisZ, point[1]))
  );
}

function plateApproxRadius(plate) {
  const points = arrayValues(plate?.sketch?.vertices)
    .map((vertex) => vertex?.point)
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!points.length) return Math.max(1, finiteNumberOr(plate?.thickness, 1));
  return Math.max(
    1,
    ...points.map((point) => Math.hypot(point[0] || 0, point[1] || 0)),
    finiteNumberOr(plate?.thickness, 1) / 2
  );
}

function plateInRange(plate, options) {
  return sphereInRange(plate?.center, plateApproxRadius(plate), options);
}

function plateSnapDistance(plate, options) {
  if (!v.isVec3(options.center) || !(options.radius > 0)) return true;
  if (!v.isVec3(plate?.center)) return Infinity;
  return Math.max(0, v.len(v.sub(plate.center, options.center)) - plateApproxRadius(plate));
}

function platesInRange(project, options) {
  const plates = projectSnapProviderIndex(project)?.plates || [];
  const maxPlateCandidates = finiteNumber(options.maxPlateCandidates)
    ? Math.max(0, Math.floor(options.maxPlateCandidates))
    : null;
  if (maxPlateCandidates === null) return plates.filter((plate) => plateInRange(plate, options));
  const scored = [];
  for (const plate of plates) {
    const distance = plateSnapDistance(plate, options);
    if (distance !== true && options.radius > 0 && distance > options.radius) continue;
    scored.push({ plate, distance: distance === true ? 0 : distance });
  }
  scored.sort((left, right) => left.distance - right.distance);
  return scored.slice(0, maxPlateCandidates).map((item) => item.plate);
}

function plateSketchBounds(loop) {
  const points = arrayValues(loop).map((item) => item.point).filter((point) => Array.isArray(point) && point.length >= 2);
  if (!points.length) return null;
  const ys = points.map((point) => point[0]);
  const zs = points.map((point) => point[1]);
  return {
    minU: Math.min(...ys),
    maxU: Math.max(...ys),
    minV: Math.min(...zs),
    maxV: Math.max(...zs)
  };
}

function addPlateSurfaceCandidates(candidates, plate, loop, worldPoints, center) {
  const normal = v.safeNorm(plate.normal || v.cross(plate.localAxisY, plate.localAxisZ), [0, 0, 0]);
  const axisU = v.safeNorm(plate.localAxisY, [0, 0, 0]);
  const axisV = v.safeNorm(plate.localAxisZ, [0, 0, 0]);
  const bounds = plateSketchBounds(loop);
  if (v.len(normal) <= EPSILON || v.len(axisU) <= EPSILON || v.len(axisV) <= EPSILON || !bounds) return;

  const halfThickness = Math.max(0, finiteNumberOr(plate.thickness, 0) / 2);
  const providerId = "model.plates";
  const surfaces = halfThickness > EPSILON
    ? [
      { side: "back", offset: -halfThickness, points: worldPoints.map((item) => v.add(item.world, v.mul(normal, -halfThickness))) },
      { side: "front", offset: halfThickness, points: worldPoints.map((item) => v.add(item.world, v.mul(normal, halfThickness))).reverse() }
    ]
    : [{ side: "mid", offset: 0, points: worldPoints.map((item) => item.world) }];

  for (const surface of surfaces) {
    const surfaceCenter = v.add(center, v.mul(normal, surface.offset));
    pushPlane(candidates, surface.points, {
      providerId,
      type: "plate-face",
      objectId: plate.id,
      label: "Plate face",
      origin: v.add(plate.center, v.mul(normal, surface.offset)),
      axisU,
      axisV,
      normal,
      bounds,
      point: surfaceCenter,
      priority: 50,
      preferInteriorSnap: true,
      interiorSnapEdgeBiasPx: 3,
      visibilityPolicy: VISIBLE_SURFACE_SNAP,
      faceSide: surface.side,
      target: target("plates", plate.id, `face-${surface.side}`, "face")
    });
  }

  if (halfThickness <= EPSILON) return;
  for (let index = 0; index < worldPoints.length; index += 1) {
    const current = worldPoints[index];
    const next = worldPoints[(index + 1) % worldPoints.length];
    if (!next) continue;
    const backA = v.add(current.world, v.mul(normal, -halfThickness));
    const backB = v.add(next.world, v.mul(normal, -halfThickness));
    const frontB = v.add(next.world, v.mul(normal, halfThickness));
    const frontA = v.add(current.world, v.mul(normal, halfThickness));
    const edge = v.sub(backB, backA);
    const edgeLength = v.len(edge);
    if (edgeLength <= EPSILON) continue;
    const edgeAxis = v.mul(edge, 1 / edgeLength);
    pushPlane(candidates, [backA, backB, frontB, frontA], {
      providerId,
      type: "plate-face",
      objectId: plate.id,
      label: "Plate face",
      origin: backA,
      axisU: edgeAxis,
      axisV: normal,
      normal: v.cross(edgeAxis, normal),
      bounds: { minU: 0, maxU: edgeLength, minV: 0, maxV: halfThickness * 2 },
      point: v.mul(v.add(v.add(backA, backB), v.add(frontA, frontB)), 0.25),
      priority: 49,
      preferInteriorSnap: true,
      interiorSnapEdgeBiasPx: 3,
      visibilityPolicy: VISIBLE_SURFACE_SNAP,
      faceSide: current.outgoingEdgeId || `edge-${index + 1}`,
      target: target("plates", plate.id, current.outgoingEdgeId || `edge-face-${index + 1}`, "face")
    });
  }
}

function addSketchGeometryCandidates(candidates, plate, options, config = {}) {
  if (!plate.sketch || !v.isVec3(plate.localAxisY) || !v.isVec3(plate.localAxisZ)) return;
  const providerId = config.providerId || "model.plates";
  const targetCollection = config.targetCollection || "plates";
  const includeObjectId = config.includeObjectId !== false;
  const objectData = includeObjectId ? { objectId: plate.id } : {};
  let loop;
  try {
    loop = orderedSketchLoop(plate.sketch);
  } catch {
    return;
  }
  if (!loop.length) return;
  const worldPoints = loop.map((item) => ({
    ...item,
    world: platePoint(plate, item.point)
  }));
  const center = worldPoints.reduce((sum, item) => v.add(sum, item.world), [0, 0, 0]).map((value) => value / worldPoints.length);
  pushPoint(candidates, center, {
    providerId,
    type: "plate-sketch-center",
    ...objectData,
    localPoint: null,
    label: "Plate sketch center",
    priority: 88,
    target: target(targetCollection, plate.id, "sketch-center", "sketch-center")
  });
  if (config.includeSurfaceTargets !== false && options.profile?.includeSurfaceTargets === "faces") {
    addPlateSurfaceCandidates(candidates, plate, loop, worldPoints, center);
  }
  for (const [index, item] of worldPoints.entries()) {
    pushPoint(candidates, item.world, {
      providerId,
      type: "plate-sketch-vertex",
      ...objectData,
      localPoint: [...item.point],
      label: "Plate corner",
      priority: 110,
      target: target(targetCollection, plate.id, item.vertexId || `vertex-${index + 1}`, "sketch-vertex")
    });
    const next = worldPoints[(index + 1) % worldPoints.length];
    if (!next) continue;
    const edgeId = item.outgoingEdgeId || null;
    const isCircularArc = edgeId ? sketchEdgeIsCircularArc(plate.sketch, edgeId) : false;
    const midpointLocal = item.outgoingEdgeId ? sketchEdgeMidpoint(plate.sketch, item.outgoingEdgeId) : null;
    const midpoint = Array.isArray(midpointLocal) ? platePoint(plate, midpointLocal) : v.mul(v.add(item.world, next.world), 0.5);
    pushPoint(candidates, midpoint, {
      providerId,
      type: isCircularArc ? "plate-sketch-arc-midpoint" : "plate-sketch-edge-midpoint",
      ...objectData,
      localPoint: Array.isArray(midpointLocal) ? [...midpointLocal] : null,
      label: isCircularArc ? "Plate arc midpoint" : "Plate edge midpoint",
      priority: 96,
      target: target(targetCollection, plate.id, item.outgoingEdgeId || `edge-mid-${index + 1}`, isCircularArc ? "sketch-arc-midpoint" : "sketch-edge-midpoint")
    });
    if (isCircularArc) {
      const centerLocal = sketchEdgeCenterPoint(plate.sketch, edgeId);
      if (Array.isArray(centerLocal)) {
        pushPoint(candidates, platePoint(plate, centerLocal), {
          providerId,
          type: "plate-sketch-arc-center",
          ...objectData,
          localPoint: [...centerLocal],
          label: "Plate arc center",
          priority: 102,
          target: target(targetCollection, plate.id, `${edgeId}:arc-center`, "sketch-arc-center")
        });
      }
      for (const [quadrantIndex, quadrant] of sketchEdgeQuadrantPoints(plate.sketch, edgeId).entries()) {
        pushPoint(candidates, platePoint(plate, quadrant.point), {
          providerId,
          type: "plate-sketch-arc-quadrant",
          ...objectData,
          localPoint: [...quadrant.point],
          label: "Plate arc quadrant",
          priority: 100,
          target: target(targetCollection, plate.id, `${edgeId}:arc-quadrant-${quadrantIndex + 1}`, "sketch-arc-quadrant")
        });
      }
    }
    if (options.includeLines !== false) {
      const curveOptions = {
        circleSegments: options.circleSegments,
        segmentLength: options.curveSegmentLength || options.segmentLength
      };
      const samples = edgeId
        ? sketchEdgeSamplePoints(plate.sketch, edgeId, curveOptions).map((point) => platePoint(plate, point))
        : [item.world, next.world];
      for (let sampleIndex = 1; sampleIndex < samples.length; sampleIndex += 1) {
        const semanticSubId = edgeId || `edge-${index + 1}`;
        pushLine(candidates, samples[sampleIndex - 1], samples[sampleIndex], {
          providerId,
          type: isCircularArc ? "plate-sketch-arc" : "plate-sketch-edge",
          ...objectData,
          label: isCircularArc ? "Plate arc" : "Plate edge",
          priority: 72,
          target: target(targetCollection, plate.id, semanticSubId, isCircularArc ? "sketch-arc" : "sketch-edge")
        });
      }
    }
  }
}

function addPlateSketchCandidates(candidates, plate, options) {
  addSketchGeometryCandidates(candidates, plate, options, {
    providerId: "model.plates",
    targetCollection: "plates",
    includeObjectId: true,
    includeSurfaceTargets: true
  });
}

function addPlateCandidates(candidates, project, options) {
  if (options.scope?.plates === false) return;
  for (const plate of platesInRange(project, options)) {
    if (!v.isVec3(plate.center)) continue;
    pushPoint(candidates, plate.center, {
      providerId: "model.plates",
      type: "plate-center",
      objectId: plate.id,
      label: "Plate center",
      priority: 86,
      target: target("plates", plate.id, "center", "center")
    });
    addPlateSketchCandidates(candidates, plate, options);
  }
}

function referenceOrigin(project, feature) {
  const reference = feature?.reference || {};
  if (v.isVec3(reference.origin)) return reference.origin;
  if (reference.origin === "plate-center") {
    const plate = projectSnapProviderIndex(project)?.plates.find((item) => item.id === feature.ownerId);
    if (v.isVec3(plate?.center)) return plate.center;
  }
  if (v.isVec3(feature?.center)) return feature.center;
  return null;
}

function referencePatternPoint(reference, origin, position) {
  if (!v.isVec3(origin) || !Array.isArray(position) || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
  const axisY = v.safeNorm(reference?.localAxisY, [1, 0, 0]);
  const axisZ = v.safeNorm(reference?.localAxisZ, [0, 0, 1]);
  return v.add(origin, v.add(v.mul(axisY, position[0]), v.mul(axisZ, position[1])));
}

function featureForFastenerPattern(project, group) {
  const fromFeatureId = group?.through?.fromFeatureId || null;
  return fromFeatureId ? projectSnapProviderIndex(project)?.features?.[fromFeatureId] || null : null;
}

function addFastenerCandidates(candidates, project, options) {
  if (options.scope?.fasteners === false) return;
  const providerIndex = projectSnapProviderIndex(project);
  for (const group of providerIndex?.fastenerGroups || []) {
    const pattern = providerIndex?.holePatterns?.[group.holePatternRef];
    if (!Array.isArray(pattern?.positions) || !pattern.positions.length) continue;
    const feature = featureForFastenerPattern(project, group);
    const origin = referenceOrigin(project, feature);
    if (!origin) continue;
    const reference = feature?.reference || {};
    const axis = v.safeNorm(group.orientation?.axis || reference.normal, [0, 0, 1]);
    const halfLength = Math.max(20, finiteNumberOr(group.assembly?.length, 80) / 2);
    for (const [index, position] of pattern.positions.entries()) {
      const point = referencePatternPoint(reference, origin, position);
      if (!point || !inRange(point, options)) continue;
      const subId = `position-${index + 1}`;
      pushPoint(candidates, point, {
        providerId: "model.fasteners",
        type: "fastener-center",
        objectId: group.id,
        label: "Fastener center",
        priority: 122,
        target: target("fastenerGroups", group.id, subId, "fastener-center")
      });
      if (options.includeLines !== false) {
        pushLine(candidates, v.sub(point, v.mul(axis, halfLength)), v.add(point, v.mul(axis, halfLength)), {
          providerId: "model.fasteners",
          type: "fastener-axis",
          objectId: group.id,
          label: "Fastener axis",
          point,
          priority: 84,
          target: target("fastenerGroups", group.id, `${subId}-axis`, "fastener-axis")
        });
      }
    }
  }
}

function addGlobalAxisCandidates(candidates, options) {
  if (options.includeGlobalAxes === false || options.scope?.constructionGuides === false) return;
  const origin = v.isVec3(options.globalAxisOrigin) ? options.globalAxisOrigin : [0, 0, 0];
  const span = Math.max(1, finiteNumberOr(options.globalAxisSpan, 100000));
  pushPoint(candidates, origin, {
    providerId: "construction.globalAxes",
    type: "global-origin",
    label: "Global origin",
    priority: 260
  });
  for (const [axis, direction] of WORLD_AXIS_ENTRIES) {
    pushLine(candidates, v.sub(origin, v.mul(direction, span)), v.add(origin, v.mul(direction, span)), {
      providerId: "construction.globalAxes",
      type: "global-axis",
      axis,
      point: [...origin],
      label: `Global ${axis.toUpperCase()} axis`,
      priority: 240,
      screenTolerance: options.profile?.screenTolerancePx,
      screenIntersectionMode: "self"
    });
  }
}

function addActiveSketchCandidates(candidates, context, options) {
  if (options.scope?.activeSketch === false) return;
  const activeSketch = context.activeSketch || {};
  const plate = activeSketch.plate || null;
  if (!plate?.id || !v.isVec3(plate.center) || !v.isVec3(plate.localAxisY) || !v.isVec3(plate.localAxisZ)) return;
  for (const [index, candidate] of arrayValues(activeSketch.candidates).entries()) {
    if (!candidate || !Array.isArray(candidate.point) || candidate.point.some((value) => !Number.isFinite(value))) continue;
    const relations = Array.isArray(candidate.relations) ? candidate.relations.filter(Boolean) : [];
    pushPoint(candidates, platePoint(plate, candidate.point), {
      providerId: "sketch.active",
      type: candidate.type || "plate-sketch-snap",
      objectId: plate.id,
      localPoint: [...candidate.point],
      label: candidate.label || "Sketch snap",
      priority: candidate.priority ?? 40,
      relationHints: relations,
      relations,
      maxWorldDistance: Number.isFinite(candidate.maxWorldDistance) && candidate.maxWorldDistance > 0 ? candidate.maxWorldDistance : null,
      target: target(
        "activeSketch",
        plate.id,
        candidate.subId || `${candidate.type || "candidate"}-${index}`,
        candidate.semanticRole || "plate-sketch-snap"
      )
    });
  }
  addSketchGeometryCandidates(candidates, plate, options, {
    providerId: "sketch.active",
    targetCollection: "activeSketch",
    includeObjectId: false,
    includeSurfaceTargets: false
  });
}

function adaptiveGridCandidatePoint(spec) {
  if (v.isVec3(spec.point)) return spec.point;
  if (!v.isVec3(spec.origin) || !v.isVec3(spec.axis) || !finiteNumber(spec.length)) return null;
  const axis = v.safeNorm(spec.axis, [0, 0, 0]);
  const step = finiteNumber(spec.step) && spec.step > EPSILON ? spec.step : null;
  if (v.len(axis) <= EPSILON || !step) return null;
  const sign = spec.length < 0 ? -1 : 1;
  const minDistance = finiteNumber(spec.minDistance) ? Math.max(0, spec.minDistance) : EPSILON;
  let snapped = Math.round(Math.abs(spec.length) / step) * step;
  if (snapped <= minDistance && Math.abs(spec.length) > minDistance) snapped = step;
  if (snapped <= minDistance) return null;
  return v.add(spec.origin, v.mul(axis, sign * snapped));
}

function addAdaptiveGridCandidates(candidates, context, options) {
  const specs = Array.isArray(context.adaptiveGrid)
    ? context.adaptiveGrid
    : context.adaptiveGrid ? [context.adaptiveGrid] : [];
  for (const [index, spec] of specs.entries()) {
    if (!spec) continue;
    const point = adaptiveGridCandidatePoint(spec);
    if (!point) continue;
    pushPoint(candidates, point, {
      providerId: "precision.adaptiveGrid",
      type: spec.type || "adaptive-grid",
      objectId: spec.objectId || "active-command",
      label: spec.label || "Adaptive grid",
      priority: spec.priority ?? 6,
      target: spec.target || target(
        spec.collection || "activeCommand",
        spec.objectId || context.tool || "command",
        spec.subId || `${context.phase || "grid"}-${index}`,
        spec.semanticRole || "adaptive-grid"
      )
    });
  }
}

function axisFromLine(candidate) {
  if (candidate?.kind !== "line" || !v.isVec3(candidate.a) || !v.isVec3(candidate.b)) return null;
  const direction = v.norm(v.sub(candidate.b, candidate.a));
  if (v.len(direction) <= EPSILON) return null;
  return {
    origin: v.isVec3(candidate.point) ? candidate.point : candidate.a,
    direction,
    source: candidate
  };
}

function memberAxisSource(member, type, axis) {
  return {
    kind: "line",
    type,
    providerId: "construction.composite",
    objectId: member.id,
    a: axis.start,
    b: axis.end,
    point: axis.start,
    label: type === "layout-axis" ? "Layout axis" : "Member axis",
    target: target("members", member.id, type, type)
  };
}

function memberAxes(member) {
  const axes = [memberAxisSource(member, "member-axis", { start: member.start, end: member.end })];
  if (member.layoutAxis) axes.push(memberAxisSource(member, "layout-axis", memberLayoutAxis(member)));
  return axes;
}

function memberPoints(member) {
  const points = [
    { kind: "point", type: "member-endpoint", objectId: member.id, endpoint: "start", point: member.start, label: "Endpoint", target: target("members", member.id, "start", "endpoint") },
    { kind: "point", type: "member-endpoint", objectId: member.id, endpoint: "end", point: member.end, label: "Endpoint", target: target("members", member.id, "end", "endpoint") },
    { kind: "point", type: "member-midpoint", objectId: member.id, point: memberCenter(member), label: "Member midpoint", target: target("members", member.id, "mid", "midpoint") }
  ];
  if (member.layoutAxis) {
    const axis = memberLayoutAxis(member);
    points.push(
      { kind: "point", type: "layout-endpoint", objectId: member.id, endpoint: "start", point: axis.start, label: "Layout endpoint", target: target("members", member.id, "layout-start", "layout-endpoint") },
      { kind: "point", type: "layout-endpoint", objectId: member.id, endpoint: "end", point: axis.end, label: "Layout endpoint", target: target("members", member.id, "layout-end", "layout-endpoint") }
    );
  }
  return points.filter((point) => v.isVec3(point.point));
}

function pointOnAxis(axis, point) {
  return v.add(axis.origin, v.mul(axis.direction, v.dot(v.sub(point, axis.origin), axis.direction)));
}

function guideLine(sourcePoint, targetPoint, label) {
  if (!v.isVec3(sourcePoint) || !v.isVec3(targetPoint) || v.len(v.sub(targetPoint, sourcePoint)) <= EPSILON) return null;
  return {
    kind: "line",
    type: "composite-guide-axis",
    providerId: "construction.composite",
    a: sourcePoint,
    b: targetPoint,
    point: targetPoint,
    label
  };
}

function addUniquePoint(candidates, candidate, seen) {
  if (!v.isVec3(candidate.point)) return;
  const key = candidate.point.map((value) => Math.round(value * 1000) / 1000).join(",");
  const index = seen.get(key);
  if (index !== undefined) {
    if ((candidate.priority || 0) > (candidates[index].priority || 0)) candidates[index] = candidate;
    return;
  }
  seen.set(key, candidates.length);
  candidates.push(candidate);
}

function addCompositeCandidates(candidates, project, options) {
  const constructionAxes = truthyValues(arrayValues(options.constructionAxes).map(axisFromLine));
  const activeMemberIds = uniqueTruthy(options.activeMemberIds).slice(0, 2);
  if (!constructionAxes.length || !activeMemberIds.length) return;
  const members = truthyValues(activeMemberIds.map((memberId) => project.model?.members?.[memberId]));
  const seen = new Map();
  const composite = [];
  for (const constructionAxis of constructionAxes) {
    for (const member of members) {
      const axes = memberAxes(member);
      for (const memberPoint of memberPoints(member)) {
        const point = pointOnAxis(constructionAxis, memberPoint.point);
        const memberAxis = axes[0];
        const guide = guideLine(memberPoint.point, point, `${memberPoint.label || "Point"} projection`);
        addUniquePoint(composite, {
          kind: "point",
          type: "composite-point",
          providerId: "construction.composite",
          constraint: "point-projected-on-construction-axis",
          point,
          label: `${constructionAxis.source.label || "Axis"} x ${memberPoint.label || "Point"}`,
          priority: 145,
          screenTolerance: options.profile?.screenTolerancePx,
          sources: truthyValues([constructionAxis.source, memberPoint, memberAxis, guide])
        }, seen);
      }
      for (const axisSource of axes) {
        const memberAxis = axisFromLine(axisSource);
        if (!memberAxis) continue;
        const closest = closestAxisPoints(constructionAxis, memberAxis, { parallel: "null" });
        if (!closest) continue;
        const point = closest.pointA;
        const guide = guideLine(closest.pointB, point, `${axisSource.label || "Member axis"} projection`);
        addUniquePoint(composite, {
          kind: "point",
          type: "composite-point",
          providerId: "construction.composite",
          constraint: "axis-axis-nearest-point",
          point,
          label: `${constructionAxis.source.label || "Axis"} x ${axisSource.label || "Member axis"}`,
          priority: 150,
          screenTolerance: options.profile?.screenTolerancePx,
          sources: truthyValues([constructionAxis.source, axisSource, guide])
        }, seen);
      }
    }
  }
  candidates.push(...composite);
}

function memberCreateProfileAxes(project, context) {
  if (!v.isVec3(context.start) || context.memberType !== "beam" || !context.startReference?.memberId) return [];
  const member = project.model?.members?.[context.startReference.memberId];
  if (!member) return [];
  try {
    const frame = memberFrameAt(member, context.startReference.station || 0);
    return ["x", "y", "z"].map((axis) => ({
      axis,
      point: context.start,
      direction: v.norm(frame[axis]),
      label: `Profile ${axis.toUpperCase()} axis`,
      memberId: member.id
    }));
  } catch {
    return [];
  }
}

function visibleMemberUnderCursor(project, context) {
  const face = context.visibleHit?.face || {};
  const objectId = face.objectId || context.visibleHit?.objectId || face.memberId || face.ownerMemberId;
  return objectId && project.model?.members?.[objectId] ? objectId : null;
}

function memberCreateConstructionAxes(project, context, profile) {
  if (context.tool !== "member-create" || !v.isVec3(context.start) || context.memberType !== "beam") return [];
  if (context.suppressMemberCreateAxes === true) return [];
  if (visibleMemberUnderCursor(project, context)) return [];
  const span = Math.max(1, finiteNumberOr(context.globalAxisSpan, 100000));
  const localAxes = memberCreateProfileAxes(project, context);
  const useLocal = context.axisGuideMode === "local" && localAxes.length;
  if (useLocal) {
    return localAxes.map((axis) => worldAxisCandidate({
      providerId: "construction.memberCreateAxes",
      type: "profile-axis",
      objectId: axis.memberId,
      axis: axis.axis,
      origin: axis.point,
      direction: axis.direction,
      span,
      label: axis.label,
      profile
    }));
  }
  return WORLD_AXIS_ENTRIES.map(([axis, direction]) => worldAxisCandidate({
    providerId: "construction.memberCreateAxes",
    type: "creation-axis",
    axis,
    origin: context.start,
    direction,
    span,
    label: `Start ${axis.toUpperCase()} axis`,
    profile
  }));
}

function memberEditDragGuideAxes(context, profile) {
  if (context.tool !== "member-edit") return [];
  const origins = uniqueTruthy(arrayValues(context.dragGuideOrigins).filter((point) => v.isVec3(point)));
  if (!origins.length) return [];
  const span = Math.max(1, finiteNumberOr(context.globalAxisSpan, 100000));
  const axes = [];
  for (const origin of origins) {
    for (const [axis, direction] of WORLD_AXIS_ENTRIES) {
      axes.push(worldAxisCandidate({
        providerId: "construction.memberEditAxes",
        type: "drag-guide-axis",
        axis,
        origin,
        direction,
        span,
        label: `Drag ${axis.toUpperCase()} guide`,
        priority: 225,
        profile
      }));
    }
  }
  return axes;
}

function activeReferenceAxes(project, context, profile) {
  const axes = [];
  for (const memberId of uniqueTruthy(context.activeMemberIds).slice(0, 2)) {
    const member = project.model?.members?.[memberId];
    if (!member) continue;
    axes.push({
      kind: "line",
      providerId: "construction.activeReferenceAxes",
      type: "member-axis",
      objectId: member.id,
      a: member.start,
      b: member.end,
      point: member.start,
      label: "Member axis",
      priority: 90,
      screenTolerance: profile?.screenTolerancePx,
      screenIntersectionMode: "self",
      target: target("members", member.id, "axis", "axis")
    });
    if (member.layoutAxis) {
      const axis = memberLayoutAxis(member);
      axes.push({
        kind: "line",
        providerId: "construction.activeReferenceAxes",
        type: "layout-axis",
        objectId: member.id,
        a: axis.start,
        b: axis.end,
        point: axis.start,
        label: "Layout axis",
        priority: 95,
        screenTolerance: profile?.screenTolerancePx,
        screenIntersectionMode: "self",
        target: target("members", member.id, "layout-axis", "layout-axis")
      });
    }
  }
  return axes;
}

export function worldAxisCandidate({ type, origin, direction, span, label, objectId = null, axis = null, priority = 250, profile = null, providerId = "construction.guides" }) {
  return {
    kind: "line",
    providerId,
    type,
    ...(objectId ? { objectId } : {}),
    ...(axis ? { axis } : {}),
    a: v.sub(origin, v.mul(direction, span)),
    b: v.add(origin, v.mul(direction, span)),
    point: origin,
    label,
    priority,
    screenTolerance: profile?.screenTolerancePx,
    screenIntersectionMode: "self",
    target: objectId ? target("members", objectId, type, type) : null
  };
}

const SNAP_CANDIDATE_PROVIDERS = [
  {
    id: "model.members",
    capability: "physical-member-snaps",
    budget: "maxMemberCandidates",
    collect: ({ candidates, project, profiles, options }) => addMemberCandidates(candidates, project, profiles, options)
  },
  {
    id: "model.memberEdges",
    capability: "evaluated-member-edge-snaps",
    budget: "context.evaluatedMemberEdges",
    collect: ({ candidates, options }) => addEvaluatedMemberEdgeCandidates(candidates, options)
  },
  {
    id: "model.plates",
    capability: "physical-plate-snaps",
    budget: "maxPlateCandidates",
    collect: ({ candidates, project, options }) => addPlateCandidates(candidates, project, options)
  },
  {
    id: "model.fasteners",
    capability: "physical-fastener-snaps",
    budget: "holePattern.positions",
    collect: ({ candidates, project, options }) => addFastenerCandidates(candidates, project, options)
  },
  {
    id: "model.workPoints",
    capability: "datum-point-snaps",
    budget: "workPoints",
    collect: ({ candidates, project, options }) => addWorkPointCandidates(candidates, project, options)
  },
  {
    id: "model.gridSystems",
    capability: "grid-line-and-intersection-snaps",
    budget: "gridLineSegments",
    collect: ({ candidates, project, options }) => addGridCandidates(candidates, project, options)
  },
  {
    id: "model.levels",
    capability: "level-plane-snaps",
    budget: "levels",
    collect: ({ candidates, project, options }) => addLevelCandidates(candidates, project, options)
  },
  {
    id: "model.referencePlanes",
    capability: "reference-plane-snaps",
    budget: "referencePlanes",
    collect: ({ candidates, project, options }) => addReferencePlaneCandidates(candidates, project, options)
  },
  {
    id: "construction.globalAxes",
    capability: "global-axis-snaps",
    budget: "three-world-axes",
    collect: ({ candidates, options }) => addGlobalAxisCandidates(candidates, options)
  },
  {
    id: "sketch.active",
    capability: "active-sketch-snaps",
    budget: "context.activeSketch.candidates",
    collect: ({ candidates, context, options }) => addActiveSketchCandidates(candidates, context, options)
  },
  {
    id: "precision.adaptiveGrid",
    capability: "adaptive-grid-snaps",
    budget: "context.adaptiveGrid",
    collect: ({ candidates, context, options }) => addAdaptiveGridCandidates(candidates, context, options)
  }
];

function collectRegisteredSnapProviders(providerContext) {
  for (const provider of SNAP_CANDIDATE_PROVIDERS) provider.collect(providerContext);
}

export function collectSnapCandidates({ project, profiles = {}, context = {}, scope = {}, profile = {}, rawPoint = null } = {}) {
  if (!project) return [];
  const options = {
    ...context,
    scope,
    profile,
    center: context.center || rawPoint,
    radius: context.radius,
    maxMemberCandidates: context.maxMemberCandidates,
    includeLines: context.includeLines !== false,
    includeLayoutAxis: context.includeLayoutAxis !== false,
    includeGlobalAxes: context.includeGlobalAxes !== false,
    globalAxisOrigin: context.globalAxisOrigin || [0, 0, 0],
    globalAxisSpan: context.globalAxisSpan || 100000,
    referencePlaneSnapSpan: context.referencePlaneSnapSpan,
    maxPlateCandidates: context.maxPlateCandidates,
    circleSegments: context.circleSegments,
    curveSegmentLength: context.curveSegmentLength
  };
  const candidates = [];
  collectRegisteredSnapProviders({ candidates, project, profiles, context, options });
  const memberCreateAxes = memberCreateConstructionAxes(project, context, profile);
  const memberEditAxes = memberEditDragGuideAxes(context, profile);
  const referenceAxes = activeReferenceAxes(project, context, profile);
  const constructionAxes = [
    ...memberCreateAxes,
    ...memberEditAxes,
    ...arrayValues(context.constructionAxes)
  ];
  candidates.push(...constructionAxes, ...referenceAxes);
  if (Array.isArray(context.dragGuideAxes)) candidates.push(...context.dragGuideAxes);
  addCompositeCandidates(candidates, project, {
    constructionAxes,
    activeMemberIds: context.activeMemberIds,
    profile
  });
  return candidates;
}
