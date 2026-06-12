import { WORLD_AXIS_ENTRIES, closestAxisPoints, closestPointOnSegment, finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs?v=world-axis-dry-1";
import { arrayValues, objectById, truthyValues, uniqueTruthy } from "../../engine/core/model.mjs?v=final-array-values-dry-1";
import { memberCenter, memberLayoutAxis } from "../../engine/api/project/members.mjs?v=vec3-dry-1";
import { orderedSketchLoop } from "../../engine/api/project/plates.mjs?v=plate-relation-preflight-1";
import { libraryProfileById } from "../../engine/api/project/profiles.mjs?v=profile-api-dry-1";
import { memberFrameAt } from "../../engine/geometry/member-evaluator.mjs?v=geometry-api-array-values-dry-1";

const EPSILON = 1e-9;

function pushPoint(candidates, point, data) {
  if (!v.isVec3(point)) return;
  candidates.push({
    kind: "point",
    point: [...point],
    priority: 100,
    providerId: data.providerId || "model",
    target: data.target || null,
    ...data
  });
}

function pushLine(candidates, a, b, data) {
  if (!v.isVec3(a) || !v.isVec3(b) || v.len(v.sub(b, a)) <= EPSILON) return;
  candidates.push({
    kind: "line",
    a: [...a],
    b: [...b],
    point: v.isVec3(data.point) ? [...data.point] : [...a],
    priority: 60,
    providerId: data.providerId || "model",
    target: data.target || null,
    ...data
  });
}

function pushPlane(candidates, points, data) {
  const cleanPoints = arrayValues(points).filter(v.isVec3);
  if (cleanPoints.length < 3) return;
  const origin = v.isVec3(data.origin) ? data.origin : cleanPoints[0];
  const axisU = v.safeNorm(data.axisU, [0, 0, 0]);
  const axisV = v.safeNorm(data.axisV, [0, 0, 0]);
  const normal = v.safeNorm(data.normal || v.cross(axisU, axisV), [0, 0, 0]);
  if (v.len(axisU) <= EPSILON || v.len(axisV) <= EPSILON || v.len(normal) <= EPSILON) return;
  candidates.push({
    kind: "plane",
    points: cleanPoints.map((point) => [...point]),
    origin: [...origin],
    axisU,
    axisV,
    normal,
    point: v.isVec3(data.point) ? [...data.point] : [...origin],
    priority: 48,
    providerId: data.providerId || "model",
    target: data.target || null,
    ...data
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

function memberSnapDistance(member, options) {
  if (!v.isVec3(options.center) || !(options.radius > 0)) return true;
  const closest = closestPointOnSegment(member.start, member.end, options.center).point;
  return v.len(v.sub(closest, options.center));
}

function membersInRange(project, options) {
  const members = Object.values(project.model?.members || {});
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
          target: target("members", member.id, `profile-face-center-${index}@${Math.round(station)}`, "profile-face-center")
        });
      }
      if (includeFaces) {
        const faceStartA = sectionPoint(member, 0, point);
        const faceStartB = sectionPoint(member, 0, next);
        const faceEndA = sectionPoint(member, frame.length, point);
        const faceEndB = sectionPoint(member, frame.length, next);
        const faceWidth = v.len(v.sub(faceStartB, faceStartA));
        if (faceWidth > EPSILON) {
          const faceAxisV = v.mul(v.sub(faceStartB, faceStartA), 1 / faceWidth);
          const faceCenter = v.mul(v.add(v.add(faceStartA, faceStartB), v.add(faceEndA, faceEndB)), 0.25);
          pushPlane(candidates, [faceStartA, faceEndA, faceEndB, faceStartB], {
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
            target: target("members", member.id, `profile-face-${index}`, "profile-face")
          });
        }
        pushLine(candidates, sectionMidPoint(member, 0, point, next), sectionMidPoint(member, frame.length, point, next), {
          providerId,
          type: "member-profile-face-centerline",
          objectId: member.id,
          label: "Member face centerline",
          priority: 74,
          allowIntersections: false,
          target: target("members", member.id, `profile-face-centerline-${index}`, "profile-face-centerline")
        });
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

function gridDirections(grid) {
  const rotation = (grid.rotation || 0) * Math.PI / 180;
  return {
    xDir: [Math.cos(rotation), Math.sin(rotation), 0],
    yDir: [-Math.sin(rotation), Math.cos(rotation), 0]
  };
}

function gridPosition(origin, xDir, yDir, x, y, z) {
  return v.add(v.add([origin[0], origin[1], z], v.mul(xDir, x)), v.mul(yDir, y));
}

function axisSpan(values, fallback = 5000) {
  const positions = values.map((axis) => axis.position || 0);
  if (!positions.length) return [-fallback, fallback];
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  if (Math.abs(max - min) < EPSILON) return [min - fallback, max + fallback];
  const pad = Math.max((max - min) * 0.25, fallback * 0.2);
  return [min - pad, max + pad];
}

function addGridCandidates(candidates, project, options) {
  if (options.scope?.grids === false) return;
  const projectLevels = Object.values(project.levels || project.model?.levels || {});
  for (const grid of Object.values(project.gridSystems || project.model?.gridSystems || {})) {
    const origin = grid.origin || [0, 0, 0];
    const xAxes = arrayValues(grid.axes?.x);
    const yAxes = arrayValues(grid.axes?.y);
    const levels = grid.levels || (projectLevels.length ? projectLevels : [{ id: "base", elevation: origin[2] || 0 }]);
    const { xDir, yDir } = gridDirections(grid);
    const xSpan = axisSpan(xAxes);
    const ySpan = axisSpan(yAxes);
    for (const level of levels) {
      const z = level.elevation || 0;
      for (const xAxis of xAxes) {
        const x = xAxis.position || 0;
        pushLine(candidates, gridPosition(origin, xDir, yDir, x, ySpan[0], z), gridPosition(origin, xDir, yDir, x, ySpan[1], z), {
          providerId: "model.grids",
          type: "grid-line",
          objectId: grid.id,
          axis: "x",
          label: `Grid ${xAxis.id || "X"}`,
          priority: 55,
          target: target("gridSystems", grid.id, xAxis.id || "x", "grid-line")
        });
      }
      for (const yAxis of yAxes) {
        const y = yAxis.position || 0;
        pushLine(candidates, gridPosition(origin, xDir, yDir, xSpan[0], y, z), gridPosition(origin, xDir, yDir, xSpan[1], y, z), {
          providerId: "model.grids",
          type: "grid-line",
          objectId: grid.id,
          axis: "y",
          label: `Grid ${yAxis.id || "Y"}`,
          priority: 55,
          target: target("gridSystems", grid.id, yAxis.id || "y", "grid-line")
        });
      }
      for (const xAxis of xAxes) {
        for (const yAxis of yAxes) {
          pushPoint(candidates, gridPosition(origin, xDir, yDir, xAxis.position || 0, yAxis.position || 0, z), {
            providerId: "model.grids",
            type: "grid-intersection",
            objectId: grid.id,
            label: `Grid ${xAxis.id || "X"}/${yAxis.id || "Y"}`,
            priority: 130,
            target: target("gridSystems", grid.id, `${xAxis.id || "x"}/${yAxis.id || "y"}`, "grid-intersection")
          });
        }
      }
    }
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
  for (const plane of Object.values(project.model?.referencePlanes || {})) {
    if (!v.isVec3(plane.origin) || !inRange(plane.origin, options)) continue;
    const axisX = v.safeNorm(plane.axisX || plane.localAxisY, [1, 0, 0]);
    const axisY = v.safeNorm(plane.axisY || plane.localAxisZ, [0, 1, 0]);
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
  for (const point of Object.values(project.model?.workPoints || {})) {
    const position = point.point || point.position;
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

function addPlateSketchCandidates(candidates, plate, options) {
  if (!plate.sketch || !v.isVec3(plate.localAxisY) || !v.isVec3(plate.localAxisZ)) return;
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
    providerId: "model.plates",
    type: "plate-sketch-center",
    objectId: plate.id,
    label: "Plate sketch center",
    priority: 88,
    target: target("plates", plate.id, "sketch-center", "sketch-center")
  });
  for (const [index, item] of worldPoints.entries()) {
    pushPoint(candidates, item.world, {
      providerId: "model.plates",
      type: "plate-sketch-vertex",
      objectId: plate.id,
      label: "Plate corner",
      priority: 110,
      target: target("plates", plate.id, item.vertexId || `vertex-${index + 1}`, "sketch-vertex")
    });
    const next = worldPoints[(index + 1) % worldPoints.length];
    if (!next) continue;
    const midpoint = v.mul(v.add(item.world, next.world), 0.5);
    pushPoint(candidates, midpoint, {
      providerId: "model.plates",
      type: "plate-sketch-edge-midpoint",
      objectId: plate.id,
      label: "Plate edge midpoint",
      priority: 96,
      target: target("plates", plate.id, item.outgoingEdgeId || `edge-mid-${index + 1}`, "sketch-edge-midpoint")
    });
    if (options.includeLines !== false) {
      pushLine(candidates, item.world, next.world, {
        providerId: "model.plates",
        type: "plate-sketch-edge",
        objectId: plate.id,
        label: "Plate edge",
        priority: 72,
        target: target("plates", plate.id, item.outgoingEdgeId || `edge-${index + 1}`, "sketch-edge")
      });
    }
  }
}

function addPlateCandidates(candidates, project, options) {
  if (options.scope?.plates === false) return;
  for (const plate of Object.values(project.model?.plates || {})) {
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
    const plate = project.model?.plates?.[feature.ownerId];
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
  if (fromFeatureId && project.model?.features?.[fromFeatureId]) return project.model.features[fromFeatureId];
  return Object.values(project.model?.features || {}).find((feature) => (
    feature.type === "hole-pattern"
    && feature.holePatternRef === group?.holePatternRef
    && (!Array.isArray(group?.participants) || group.participants.includes(feature.ownerId))
  )) || null;
}

function addFastenerCandidates(candidates, project, options) {
  if (options.scope?.fasteners === false) return;
  for (const group of Object.values(project.model?.fastenerGroups || {})) {
    const pattern = project.model?.holePatterns?.[group.holePatternRef];
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

function memberCreateConstructionAxes(project, context, profile) {
  if (context.tool !== "member-create" || !v.isVec3(context.start) || context.memberType !== "beam") return [];
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
    referencePlaneSnapSpan: context.referencePlaneSnapSpan
  };
  const candidates = [];
  addMemberCandidates(candidates, project, profiles, options);
  addPlateCandidates(candidates, project, options);
  addFastenerCandidates(candidates, project, options);
  addWorkPointCandidates(candidates, project, options);
  addGridCandidates(candidates, project, options);
  addReferencePlaneCandidates(candidates, project, options);
  addGlobalAxisCandidates(candidates, options);
  addActiveSketchCandidates(candidates, context, options);
  addAdaptiveGridCandidates(candidates, context, options);
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
