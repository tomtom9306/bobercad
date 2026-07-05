import { clamp, finiteNumber, v } from "../../engine/core/math.mjs";
import { arrayValues, objectById } from "../../engine/core/model.mjs";
import { CSG_EPSILON, ccwPoints, csgCleanPoints, csgExtrudedRingPolygons, csgIntersect, csgSubtract, csgUnion, cutBodyPolygons, geometryError, prismPolygons, projectCoincidentTolerance, requiredNumber, requiredVector } from "../../engine/geometry/csg.mjs";
import { cutBodiesForFeature } from "../../engine/geometry/cut-features.mjs";
import { evaluateTrimJointPlaneTrimFeature } from "../../engine/geometry/evaluators/trim-evaluator.mjs";
import { memberFrame, memberLength, sectionBounds } from "../../engine/geometry/member-geometry.mjs";
import { normalizePath, samplePath } from "../../engine/api/geometry/paths.mjs";
import { planeTrimRegionKeys, trimRegionSelectorMap } from "../../engine/api/model/trim-region-keys.mjs";
import { DEFAULT_GHOST_OPACITY } from "./scene-object-visibility.mjs";
import { detailMeta, featureCutterShared, memberContourSurfaceRefs, objectDisplayColor, trimPlaneSurfaceRefs } from "./scene-annotation-metadata.mjs";
import { holeOrSlotCut, memberFeatures } from "./scene-feature-cutters.mjs";
import { addCsgFaces, addMeshCreaseEdges, addPolyline, instanceGeometryForProfile, sectionPoint } from "./scene-line-face-assembly.mjs";

function endCutFeatures(project, member, scene = null) {
  const cuts = { start: null, end: null };
  for (const feature of memberFeatures(project, member, scene)) {
    if (!["saw-cut", "miter-cut", "end-cut"].includes(feature.type)) continue;
    if (!feature.reference) geometryError(`${feature.id}: end cut missing reference`);
    const memberEnd = feature.reference.memberEnd;
    if (memberEnd !== "start" && memberEnd !== "end") geometryError(`${feature.id}: end cut must set reference.memberEnd`);
    cuts[memberEnd] = feature;
  }
  return cuts;
}

function endCutOffset(cut, point, side) {
  if (!cut) return 0;
  if (!cut.cut) geometryError(`${cut.id}: end cut missing cut angles`);
  const angleY = requiredNumber(cut.cut, "angleY", cut.id) * Math.PI / 180;
  const angleZ = requiredNumber(cut.cut, "angleZ", cut.id) * Math.PI / 180;
  const offset = point[0] * Math.tan(angleY) + point[1] * Math.tan(angleZ);
  return side === "start" ? offset : -offset;
}

function memberStation(member, frame, point) {
  return v.dot(v.sub(point, member.start), frame.x);
}

function sectionMaxSpan(profile) {
  if (!profile) return 1;
  const bounds = sectionBounds(profile);
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
}

function memberTrimPlaneExtension(project, member, frame, profile, length, scene = null) {
  const sectionSpan = sectionMaxSpan(profile);
  const extension = sectionSpan * 2 + projectCoincidentTolerance(project) * 10;
  const range = { start: 0, end: length };

  for (const feature of memberFeatures(project, member, scene)) {
    const planes = feature.type === "member-trim-plane"
      ? [feature.runtimePlane]
      : feature.type === "member-trim-region"
        ? arrayValues(feature.runtimePlanes)
        : [];
    for (const plane of planes) {
      const normal = v.norm(requiredVector(plane, "normal", feature.id));
      const station = memberStation(member, frame, requiredVector(plane, "origin", feature.id));
      const along = v.dot(normal, frame.x);
      if (along > 0.02) range.start = Math.min(range.start, station - extension);
      if (along < -0.02) range.end = Math.max(range.end, station + extension);
    }
  }

  return range;
}

function memberContourPoint(member, frame, point, station, length, cuts) {
  let x = station;
  if (Math.abs(station) < 0.001) x += endCutOffset(cuts.start, point, "start");
  if (Math.abs(station - length) < 0.001) x += endCutOffset(cuts.end, point, "end");
  return sectionPoint(member.start, frame, point, x);
}

function memberContourPolygons(member, frame, contour, contourIndex, startStation, endStation, length, cuts, shared = {}) {
  const points = ccwPoints(arrayValues(contour.points));
  const start = points.map((point) => memberContourPoint(member, frame, point, startStation, length, cuts));
  const end = points.map((point) => memberContourPoint(member, frame, point, endStation, length, cuts));
  return csgExtrudedRingPolygons(start, end, {
    ...shared,
    surfaceRefs: memberContourSurfaceRefs(member, contour, contourIndex)
  });
}

function memberBasePolygons(project, member, frame, profile, color, startStation, endStation, length, scene = null) {
  const cuts = endCutFeatures(project, member, scene);
  const overlap = projectCoincidentTolerance(project) * 2;
  let polygons = [];
  const shared = { color };

  for (const [contourIndex, contour] of arrayValues(profile.section.contours).entries()) {
    if (contour.role !== "solid") continue;
    polygons = polygons.concat(memberContourPolygons(member, frame, contour, contourIndex, startStation, endStation, length, cuts, shared));
  }

  for (const [contourIndex, contour] of arrayValues(profile.section.contours).entries()) {
    if (contour.role !== "void") continue;
    const voidPolygons = memberContourPolygons(member, frame, contour, contourIndex, startStation - overlap, endStation + overlap, length, { start: null, end: null }, shared);
    polygons = csgSubtract(polygons, voidPolygons);
  }

  return polygons;
}

function planeTrimDiscardPolygons(member, frame, profile, plane, shared = {}) {
  if (!plane) geometryError("plane trim missing plane");
  const length = memberLength(member);
  const sectionSpan = sectionMaxSpan(profile);
  const span = Math.max(length, sectionSpan) * 4 + 1000;
  const depth = span * 2;
  const keepNormal = v.norm(requiredVector(plane, "normal", "plane trim"));
  const discardAxis = v.mul(keepNormal, -1);
  let axisY = v.norm(requiredVector(plane, "axisX", "plane trim"));
  axisY = v.norm(v.sub(axisY, v.mul(discardAxis, v.dot(axisY, discardAxis))));
  if (v.len(axisY) <= CSG_EPSILON) geometryError("plane trim axisX cannot be parallel to normal");
  const axisZ = v.norm(v.cross(discardAxis, axisY));
  const center = v.add(requiredVector(plane, "origin", "plane trim"), v.mul(discardAxis, depth / 2));

  return prismPolygons(center, discardAxis, axisY, axisZ, depth, [
    [-span, -span],
    [span, -span],
    [span, span],
    [-span, span]
  ], shared);
}

function flippedPlane(plane) {
  return {
    ...plane,
    normal: v.mul(v.norm(requiredVector(plane, "normal", "plane trim region")), -1)
  };
}

function trimRegionBoxPolygons(scene, project, member, frame, profile, shared = {}) {
  const length = memberLength(member);
  const sectionSpan = sectionMaxSpan(profile);
  const padding = Math.max(sectionSpan * 5, projectCoincidentTolerance(project) * 100, 100);
  return cutBodyPolygons({
    type: "box",
    center: sectionPoint(member.start, frame, [0, 0], length / 2),
    axisX: frame.x,
    axisY: frame.y,
    axisZ: frame.z,
    size: [length + padding * 2, sectionSpan + padding * 2, sectionSpan + padding * 2]
  }, shared, scene.tessellation);
}

function trimRegionPolygons(scene, project, member, frame, profile, planes, regionKey, shared = {}, feature = null) {
  if (typeof regionKey !== "string" || !regionKey) geometryError("plane trim region key must be a non-empty string");
  const parts = regionKey.split("|");
  const signs = trimRegionSelectorMap(regionKey);
  if (signs.size !== parts.length) geometryError(`invalid or duplicate plane trim region key: ${regionKey}`);
  if (signs.size !== planes.length) geometryError(`${regionKey}: trim region key does not match selected planes`);
  let polygons = trimRegionBoxPolygons(scene, project, member, frame, profile, shared);
  for (const plane of planes) {
    const side = signs.get(plane.id);
    if (!side) geometryError(`${regionKey}: missing side for reference plane ${plane.id}`);
    const cutterPlane = side === "+" ? plane : flippedPlane(plane);
    polygons = csgSubtract(polygons, planeTrimDiscardPolygons(member, frame, profile, cutterPlane, feature ? {
      ...shared,
      surfaceRefs: trimPlaneSurfaceRefs(feature, plane, side)
    } : shared));
  }
  return polygons;
}

function applyPlaneTrimRegionCuts(scene, project, member, frame, profile, polygons, feature, shared = {}) {
  const planes = arrayValues(feature.runtimePlanes);
  if (!planes.length) geometryError(`${feature.id}: plane trim missing runtime planes`);
  for (const regionKey of arrayValues(feature.removedRegionKeys)) {
    polygons = csgSubtract(polygons, trimRegionPolygons(scene, project, member, frame, profile, planes, regionKey, shared, feature));
  }
  return polygons;
}

function offsetPolygonPoints(polygon, distance) {
  const normal = v.norm(polygon.plane.normal);
  return csgCleanPoints(polygon.vertices).map((point) => v.add(point, v.mul(normal, distance)));
}

export function addPlaneTrimRegionHandles(scene, project, profiles, trimJoint, operation, operationMeta) {
  if (trimJoint.id !== scene.activeTrimJointId) return;
  if (scene.activeTrimOperationId && operation.id !== scene.activeTrimOperationId) return;
  if (operation.type !== "plane-trim") return;

  const member = objectById(project, operation.memberAId);
  const profile = profiles[member.profile];
  if (!profile) geometryError(`${trimJoint.id}: missing profile for ${member.id}`);
  const feature = evaluateTrimJointPlaneTrimFeature(project, profiles, trimJoint, operation, {
    id: `${trimJoint.id}:${operation.id}`
  });
  const planes = arrayValues(feature.runtimePlanes);
  const regionKeys = planeTrimRegionKeys(planes.map((plane) => plane.id));
  if (!regionKeys.length) return;

  const frame = memberFrame(member);
  const length = memberLength(member);
  const color = objectDisplayColor(project, member.id, member.display?.color || "#78909c");
  const edgeColor = trimJoint.display?.edgeColor || "#0ea5e9";
  const trimRange = memberTrimPlaneExtension(project, member, frame, profile, length, scene);
  const basePolygons = memberBasePolygons(project, member, frame, profile, color, trimRange.start, trimRange.end, length, scene);
  const removedRegionKeys = new Set(arrayValues(feature.removedRegionKeys));
  const overlayOffset = Math.min(0.75, projectCoincidentTolerance(project) * 0.25);

  for (const regionKeyValue of regionKeys) {
    const removed = removedRegionKeys.has(regionKeyValue);
    const polygons = csgIntersect(
      basePolygons,
      trimRegionPolygons(scene, project, member, frame, profile, planes, regionKeyValue, { color })
    );
    if (!polygons.length) continue;

    const meta = {
      ...operationMeta,
      componentKind: "trim-region",
      regionKey: regionKeyValue,
      memberId: member.id,
      ownerMemberId: member.id,
      regionRemoved: removed,
      opacity: removed ? 0.12 : 0.035,
      suppressed: removed
    };
    for (const polygon of polygons) {
      const points = offsetPolygonPoints(polygon, overlayOffset);
      if (points.length >= 3) scene.faces.push({ points, color, hideEdges: true, ...meta });
    }
    addMeshCreaseEdges(scene, polygons, edgeColor, { ...meta, opacity: removed ? 0.55 : 0.22 });
  }
}

function memberCsgPolygons(project, profiles, member, profile, color, scene = null) {
  const frame = memberFrame(member);
  const length = memberLength(member);
  const trimRange = memberTrimPlaneExtension(project, member, frame, profile, length, scene);
  const shared = { color };
  let polygons = memberBasePolygons(project, member, frame, profile, color, trimRange.start, trimRange.end, length, scene);

  for (const feature of memberFeatures(project, member, scene)) {
    const cutPolygons = holeOrSlotCut(scene, project, profiles, polygons, feature, null, shared);
    if (cutPolygons) {
      polygons = cutPolygons;
      continue;
    }

    if (feature.type === "clearance-cut") {
      const bodies = cutBodiesForFeature(project, profiles, feature, { tessellation: scene.tessellation });
      if (!bodies.length) geometryError(`${feature.id}: clearance-cut missing derivable body`);
      for (const [bodyIndex, body] of bodies.entries()) {
        polygons = csgSubtract(polygons, cutBodyPolygons(body, featureCutterShared(shared, feature, body, bodyIndex), scene.tessellation));
      }
      continue;
    }

    if (feature.type === "boolean-part") {
      if (!["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) geometryError(`${feature.id}: unsupported booleanType ${feature.booleanType}`);
      const bodies = cutBodiesForFeature(project, profiles, feature, { tessellation: scene.tessellation });
      if (!bodies.length) geometryError(`${feature.id}: boolean-part missing derivable body`);
      const bodyPolygons = bodies.flatMap((body, bodyIndex) => cutBodyPolygons(body, featureCutterShared(shared, feature, body, bodyIndex), scene.tessellation));
      polygons = feature.booleanType === "BOOLEAN_ADD" ? csgUnion(polygons, bodyPolygons) : csgSubtract(polygons, bodyPolygons);
      continue;
    }

    if (feature.type === "member-trim-plane") {
      const plane = feature.runtimePlane;
      polygons = csgSubtract(polygons, planeTrimDiscardPolygons(member, frame, profile, plane, {
        ...shared,
        surfaceRefs: trimPlaneSurfaceRefs(feature, plane)
      }));
      continue;
    }

    if (feature.type === "member-trim-region") {
      polygons = applyPlaneTrimRegionCuts(scene, project, member, frame, profile, polygons, feature, shared);
      continue;
    }

    if (["saw-cut", "miter-cut", "end-cut"].includes(feature.type)) continue;
    geometryError(`${member.id}/${feature.id}: unsupported member feature type ${feature.type}`);
  }

  return polygons;
}

export function addMember(scene, project, member, profile, options = {}) {
  const color = member.display?.color || "#78909c";
  const edgeColor = member.display?.edgeColor || color || scene.settings.render.edges.defaultColor;
  const opacity = member.display?.transparent ? member.display?.opacity ?? DEFAULT_GHOST_OPACITY : member.display?.opacity;
  const meta = { collection: "members", objectId: member.id, ...(options.lodDetail ? detailMeta(member.id) : {}) };
  const polygons = memberCsgPolygons(project, scene.profiles, member, profile, color, scene);

  addCsgFaces(scene, polygons, color, { opacity, ...meta });
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

export function curvedMemberPath(member) {
  const centerline = member.centerline;
  if (!centerline || !["arc", "helix", "spiral"].includes(centerline.type)) return null;
  return normalizePath(centerline);
}

function curvedMemberSampleCount(path, profile) {
  const sectionSpan = sectionMaxSpan(profile);
  return clamp(Math.ceil(path.length / Math.max(sectionSpan * 1.25, 120)) + 1, 24, 360);
}

function curvedMemberFrame(sample, member) {
  const baseY = v.mul(sample.frame.binormal, -1);
  const baseZ = sample.frame.normal;
  const angle = (member.rotation || 0) * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    origin: sample.point,
    x: sample.frame.tangent,
    y: v.add(v.mul(baseY, c), v.mul(baseZ, s)),
    z: v.add(v.mul(baseZ, c), v.mul(baseY, -s))
  };
}

function curvedSectionPoint(sample, member, point) {
  const frame = curvedMemberFrame(sample, member);
  return sectionPoint(frame.origin, frame, point);
}

export function addCurvedMember(scene, member, profile) {
  const path = curvedMemberPath(member);
  if (!path) return false;
  const color = member.display?.color || "#78909c";
  const edgeColor = member.display?.edgeColor || color || scene.settings.render.edges.defaultColor;
  const opacity = member.display?.transparent ? member.display?.opacity ?? DEFAULT_GHOST_OPACITY : member.display?.opacity;
  const meta = { collection: "members", objectId: member.id };
  const samples = samplePath(path, { count: curvedMemberSampleCount(path, profile), up: [0, 0, 1] });
  const hasVoidContour = arrayValues(profile.section?.contours).some((contour) => contour.role === "void");
  const centerlineMeta = { ...meta, analyticCenterline: true, centerlineType: member.centerline?.type || path.type };

  addPolyline(scene, samples.map((sample) => sample.point), edgeColor, centerlineMeta);

  for (const contour of arrayValues(profile.section?.contours)) {
    if (!["solid", "void"].includes(contour.role)) continue;
    const points = ccwPoints(arrayValues(contour.points));
    if (points.length < 2) continue;
    const rings = samples.map((sample) => points.map((point) => curvedSectionPoint(sample, member, point)));
    const reverse = contour.role === "void";

    for (let stationIndex = 0; stationIndex + 1 < rings.length; stationIndex += 1) {
      const current = rings[stationIndex];
      const nextRing = rings[stationIndex + 1];
      for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
        const nextPointIndex = (pointIndex + 1) % points.length;
        const facePoints = reverse
          ? [current[pointIndex], nextRing[pointIndex], nextRing[nextPointIndex], current[nextPointIndex]]
          : [current[pointIndex], current[nextPointIndex], nextRing[nextPointIndex], nextRing[pointIndex]];
        scene.faces.push({ points: facePoints, color, opacity, hideEdges: true, ...meta });
      }
    }

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      addPolyline(scene, rings.map((ring) => ring[pointIndex]), edgeColor, meta);
    }

    if (contour.role === "solid" && !hasVoidContour) {
      scene.faces.push({ points: [...rings[0]].reverse(), color, opacity, ...meta });
      scene.faces.push({ points: rings[rings.length - 1], color, opacity, ...meta });
    }
  }

  return true;
}

export function canInstanceMember(scene, member, profile) {
  if (curvedMemberPath(member)) return false;
  if (member.display?.forceDetail === true) return false;
  if (member.display?.transparent || member.display?.opacity !== undefined) return false;
  if (!instanceGeometryForProfile(scene, profile)) return false;
  return true;
}

export function addInstancedMember(scene, member, profile, options = {}) {
  const frame = memberFrame(member);
  const length = memberLength(member);
  if (!finiteNumber(length) || length <= CSG_EPSILON) return false;
  const color = member.display?.color || "#78909c";
  const opacity = member.display?.opacity ?? 1;
  const bounds = sectionBounds(profile);
  const profileRadius = Math.hypot(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ) / 2;

  scene.memberInstances.push({
    collection: "members",
    objectId: member.id,
    profileId: profile.id,
    start: [...member.start],
    axisX: frame.x,
    axisY: frame.y,
    axisZ: frame.z,
    length,
    color,
    opacity,
    profileRadius,
    lodDetailObjectId: options.lodDetail ? member.id : null
  });
  scene.vertices.push(member.start, member.end);
  return true;
}
