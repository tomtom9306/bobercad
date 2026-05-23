import { v } from "../../engine/core/math.mjs";
import { collectionObjects, objectById } from "../../engine/core/model.mjs";
import { CSG_EPSILON, ccwPoints, csgCleanPoints, csgPolygon, csgSubtract, csgUnion, cutBodyPolygons, geometryError, prismPolygons, projectCoincidentTolerance, requiredArray, requiredNumber, requiredVector, setGeometrySettings, slotOutline2d } from "../../engine/geometry/csg.mjs";
import { clearanceCutGeometry, cutBodyForFeature } from "../../engine/geometry/cut-features.mjs";
import { memberFrame, resolveInterfaceWithConnectionReference, sectionBounds } from "../../engine/geometry/member-geometry.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { DEFAULT_GHOST_OPACITY, activeConnectionObjectIds, isActiveConnectionObject, shouldRenderObject } from "./scene-object-visibility.mjs";

let settings = null;

function sectionPoint(origin, frame, point, xOffset = 0) {
  return v.add(origin, v.add(v.mul(frame.x, xOffset), v.add(v.mul(frame.y, point[0]), v.mul(frame.z, point[1]))));
}

function addLine(scene, a, b, color, meta = {}) {
  scene.lines.push({ points: [a, b], color, ...meta });
}

function detailMeta(objectId) {
  return objectId ? { lodDetailObjectId: objectId } : {};
}

function flattenIds(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenIds);
  if (typeof value === "object") return Object.values(value).flatMap(flattenIds);
  return [];
}

function generatedConnectionObjectIds(project) {
  return new Set(Object.values(project.model.connections || {}).flatMap((connection) => [
    ...flattenIds(connection.generator?.objectRoles),
    ...(connection.generator?.ownedObjectIds || [])
  ]));
}

function renderCollectionObjects(project, collection, renderObjectIds = null) {
  if (!renderObjectIds) return collectionObjects(project, collection);
  return [...renderObjectIds]
    .filter((objectId) => project.objectIndex?.[objectId]?.collection === collection)
    .map((objectId) => project.model?.[collection]?.[objectId])
    .filter(Boolean);
}

function shouldApplyMemberFeature(scene, feature) {
  if (feature.type !== "hole-pattern") return true;
  if (!scene?.generatedConnectionObjectIds?.has(feature.id)) return true;
  return isActiveConnectionObject(scene, feature.id);
}

function shouldBuildLodDetail(scene, objectId) {
  if (!objectId) return true;
  if (isActiveConnectionObject(scene, objectId)) return true;
  return typeof scene?.lodDetailFilter === "function" ? scene.lodDetailFilter(objectId) : true;
}

function addInstanceTriangle(geometry, a, b, c) {
  const normal = faceNormal([a, b, c]);
  for (const point of [a, b, c]) {
    geometry.positions.push(point[0], point[1], point[2]);
    geometry.normals.push(normal[0], normal[1], normal[2]);
  }
}

function addInstanceFace(geometry, points) {
  for (const triangle of triangulateFace(points)) addInstanceTriangle(geometry, triangle[0], triangle[1], triangle[2]);
}

function signedArea2d(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index][0] * next[1] - next[0] * points[index][1];
  }
  return area / 2;
}

function axisAlignedRectangle(points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const ys = [...new Set(points.map((point) => point[0]))].sort((a, b) => a - b);
  const zs = [...new Set(points.map((point) => point[1]))].sort((a, b) => a - b);
  if (ys.length !== 2 || zs.length !== 2) return null;
  const hasCorner = (y, z) => points.some((point) => Math.abs(point[0] - y) <= CSG_EPSILON && Math.abs(point[1] - z) <= CSG_EPSILON);
  if (!ys.every((y) => zs.every((z) => hasCorner(y, z)))) return null;
  return { minY: ys[0], maxY: ys[1], minZ: zs[0], maxZ: zs[1] };
}

function addCapFace2d(geometry, points, x, normalSign) {
  const area = signedArea2d(points);
  const oriented = area * normalSign >= 0 ? points : [...points].reverse();
  addInstanceFace(geometry, oriented.map((point) => [x, point[0], point[1]]));
}

function addContourSides(geometry, contour, reverse = false) {
  const points = reverse ? [...contour].reverse() : contour;
  const start = points.map((point) => [0, point[0], point[1]]);
  const end = points.map((point) => [1, point[0], point[1]]);

  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    addInstanceFace(geometry, [start[index], start[next], end[next], end[index]]);
  }
}

function addSimpleContourPrism(geometry, points) {
  const contour = ccwPoints(points);
  const start = contour.map((point) => [0, point[0], point[1]]);
  const end = contour.map((point) => [1, point[0], point[1]]);

  addInstanceFace(geometry, [...start].reverse());
  addInstanceFace(geometry, end);
  addContourSides(geometry, contour);
}

function addRectangularTubePrism(geometry, solidContour, voidContour) {
  const outer = axisAlignedRectangle(solidContour.points || []);
  const inner = axisAlignedRectangle(voidContour.points || []);
  if (!outer || !inner) return false;
  if (inner.minY <= outer.minY || inner.maxY >= outer.maxY || inner.minZ <= outer.minZ || inner.maxZ >= outer.maxZ) return false;

  const capStrips = [
    [[outer.minY, outer.minZ], [outer.maxY, outer.minZ], [inner.maxY, inner.minZ], [inner.minY, inner.minZ]],
    [[outer.maxY, outer.minZ], [outer.maxY, outer.maxZ], [inner.maxY, inner.maxZ], [inner.maxY, inner.minZ]],
    [[outer.maxY, outer.maxZ], [outer.minY, outer.maxZ], [inner.minY, inner.maxZ], [inner.maxY, inner.maxZ]],
    [[outer.minY, outer.maxZ], [outer.minY, outer.minZ], [inner.minY, inner.minZ], [inner.minY, inner.maxZ]]
  ];

  for (const strip of capStrips) {
    addCapFace2d(geometry, strip, 0, -1);
    addCapFace2d(geometry, strip, 1, 1);
  }

  addContourSides(geometry, ccwPoints(solidContour.points || []));
  addContourSides(geometry, ccwPoints(voidContour.points || []), true);
  return true;
}

function profileInstanceGeometry(profile) {
  const geometry = { positions: [], normals: [] };
  const contours = profile.section?.contours || [];
  const solidContours = contours.filter((contour) => contour.role === "solid");
  const voidContours = contours.filter((contour) => contour.role === "void");

  if (voidContours.length) {
    if (solidContours.length !== 1 || voidContours.length !== 1) return null;
    if (!addRectangularTubePrism(geometry, solidContours[0], voidContours[0])) return null;
  } else {
    for (const contour of solidContours) {
      const points = ccwPoints(contour.points || []);
      if (points.length < 3) continue;
      addSimpleContourPrism(geometry, points);
    }
  }

  return geometry.positions.length ? geometry : null;
}

function instanceGeometryForProfile(scene, profile) {
  if (!scene.memberInstanceGeometries[profile.id]) {
    scene.memberInstanceGeometries[profile.id] = profileInstanceGeometry(profile);
  }
  return scene.memberInstanceGeometries[profile.id];
}

function addAxisHead(scene, axis, sideA, sideB, length, headSize, color) {
  const end = v.mul(axis, length);
  const base = v.mul(axis, length - headSize);
  const wing = headSize * 0.42;
  addLine(scene, end, v.add(base, v.mul(sideA, wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideA, -wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideB, wing)), color);
  addLine(scene, end, v.add(base, v.mul(sideB, -wing)), color);
}

function addViewerAxis(scene, axis, sideA, sideB, color, length, headSize) {
  const origin = [0, 0, 0];
  addLine(scene, v.mul(axis, -length), origin, settings.render.axes.negativeColor);
  addLine(scene, origin, v.mul(axis, length), color);
  addAxisHead(scene, axis, sideA, sideB, length, headSize, color);
}

function addViewerAxes(scene) {
  const axes = settings.render.axes;
  if (!axes?.visible) return;
  const maxCoordinate = Math.max(...scene.bounds.min.map(Math.abs), ...scene.bounds.max.map(Math.abs), 1);
  const length = Math.max(axes.minLength, maxCoordinate * axes.padding);
  const headSize = axes.headSize || length * 0.035;
  addViewerAxis(scene, [1, 0, 0], [0, 1, 0], [0, 0, 1], axes.xColor, length, headSize);
  addViewerAxis(scene, [0, 1, 0], [1, 0, 0], [0, 0, 1], axes.yColor, length, headSize);
  addViewerAxis(scene, [0, 0, 1], [1, 0, 0], [0, 1, 0], axes.zColor, length, headSize);
}

function addLoopLines(scene, points, color, meta = {}) {
  for (let i = 0; i < points.length; i += 1) addLine(scene, points[i], points[(i + 1) % points.length], color, meta);
}

function addPlaneMarker(scene, plane, display = {}, meta = {}) {
  const x = v.norm(requiredVector(plane, "axisX", "plane marker"));
  const y = v.norm(requiredVector(plane, "axisY", "plane marker"));
  const origin = requiredVector(plane, "origin", "plane marker");
  const size = requiredArray(plane, "size", "plane marker");
  if (size.length !== 2 || size.some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0)) {
    geometryError("plane marker size must contain two positive numbers");
  }
  const color = display.color || "#ef4444";
  const opacity = display.transparent ? display.opacity ?? 0.18 : 0.18;
  const points = [
    v.add(origin, v.add(v.mul(x, -size[0] / 2), v.mul(y, -size[1] / 2))),
    v.add(origin, v.add(v.mul(x, size[0] / 2), v.mul(y, -size[1] / 2))),
    v.add(origin, v.add(v.mul(x, size[0] / 2), v.mul(y, size[1] / 2))),
    v.add(origin, v.add(v.mul(x, -size[0] / 2), v.mul(y, size[1] / 2)))
  ];

  scene.faces.push({ points, color, opacity, ...meta });
  addLoopLines(scene, points, color, meta);
}

function memberFeatures(project, member, scene = null) {
  return (member.featureIds || [])
    .map((id) => objectById(project, id))
    .filter((feature) => feature.ownerId === member.id && feature.operationEnabled !== false && shouldApplyMemberFeature(scene, feature));
}

function objectFeatures(project, object) {
  return (object.featureIds || [])
    .map((id) => objectById(project, id))
    .filter((feature) => feature.ownerId === object.id && feature.operationEnabled !== false);
}

function holePatternCutters(project, profiles, feature, depth, shared = {}) {
  if (feature.type !== "hole-pattern") return [];
  if (!feature.holePatternRef) geometryError(`${feature.id}: hole-pattern missing holePatternRef`);
  const cutterDepth = feature.depth === undefined ? depth : requiredNumber(feature, "depth", feature.id);
  if (typeof cutterDepth !== "number" || !Number.isFinite(cutterDepth) || cutterDepth <= 0) geometryError(`${feature.id}: hole-pattern depth must be positive`);
  const pattern = objectById(project, feature.holePatternRef);
  const diameter = requiredNumber(pattern, "holeDiameter", `${pattern.id} hole pattern`);
  const positions = requiredArray(pattern, "positions", `${pattern.id} hole pattern`);
  const basis = featureOrigin(project, profiles, feature);
  const radius = diameter / 2;
  if (radius <= 0) geometryError(`${pattern.id}: holeDiameter must be positive`);
  const suppressed = new Set(pattern.suppressedPositionIndices || []);
  let cutters = [];

  for (const [index, position] of positions.entries()) {
    if (suppressed.has(index)) continue;
    if (!Array.isArray(position) || position.length !== 2 || position.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      geometryError(`${pattern.id}: hole position must be [y, z]`);
    }
    const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
    cutters = cutters.concat(cutBodyPolygons({
      type: "cylinder",
      center,
      axisX: basis.normal,
      axisY: basis.y,
      axisZ: basis.z,
      radius,
      depth: cutterDepth
    }, shared));
  }

  return cutters;
}

function slotCutters(project, profiles, feature, depth, shared = {}) {
  if (feature.type !== "slot-hole") return [];
  if (!feature.reference) geometryError(`${feature.id}: slot-hole missing reference`);
  const cutterDepth = feature.depth === undefined ? depth : requiredNumber(feature, "depth", feature.id);
  if (typeof cutterDepth !== "number" || !Number.isFinite(cutterDepth) || cutterDepth <= 0) geometryError(`${feature.id}: slot-hole depth must be positive`);
  const basis = featureOrigin(project, profiles, feature);
  const position = requiredArray(feature, "position", `${feature.id} slot-hole`);
  if (position.length !== 2 || position.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    geometryError(`${feature.id}: slot-hole position must be [y, z]`);
  }
  const slot = feature.slot || geometryError(`${feature.id}: slot-hole missing slot`);
  const length = requiredNumber(slot, "length", `${feature.id} slot`);
  const width = requiredNumber(slot, "width", `${feature.id} slot`);
  const orientation = requiredNumber(slot, "orientation", `${feature.id} slot`);
  const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
  const outline = slotOutline2d(length, width, orientation * Math.PI / 180);
  return prismPolygons(center, basis.normal, basis.y, basis.z, cutterDepth, outline, shared);
}

function holeOrSlotCut(project, profiles, polygons, feature, depth, shared) {
  if (feature.type === "hole-pattern") return csgSubtract(polygons, holePatternCutters(project, profiles, feature, depth, shared));
  if (feature.type === "slot-hole") return csgSubtract(polygons, slotCutters(project, profiles, feature, depth, shared));
  return null;
}

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

function projectedAxis(axis, normal) {
  if (!Array.isArray(axis)) return null;
  const projected = v.sub(axis, v.mul(normal, v.dot(axis, normal)));
  return v.len(projected) <= CSG_EPSILON ? null : v.norm(projected);
}

function memberEndPoint(member, memberEnd) {
  if (memberEnd === "start") return member.start;
  if (memberEnd === "end") return member.end;
  return null;
}

function memberEndKeepDirection(member, frame, memberEnd) {
  if (memberEnd === "start") return frame.x;
  if (memberEnd === "end") return v.mul(frame.x, -1);
  geometryError(`${member.id}: member-trim must set memberEnd to start or end`);
}

function sectionMaxSpan(profile) {
  if (!profile) return 1;
  const bounds = sectionBounds(profile);
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
}

function mateTrimDirection(project, trim) {
  const mateId = trim?.mateMemberId;
  const mate = mateId ? project.model?.members?.[mateId] : null;
  if (!mate) return null;
  const frame = memberFrame(mate);
  let memberEnd = trim.mateMemberEnd;
  if (memberEnd !== "start" && memberEnd !== "end" && Array.isArray(trim.jointPoint)) {
    const toStart = v.len(v.sub(trim.jointPoint, mate.start));
    const toEnd = v.len(v.sub(trim.jointPoint, mate.end));
    memberEnd = toStart <= toEnd ? "start" : "end";
  }
  if (memberEnd !== "start" && memberEnd !== "end") return null;
  return memberEndKeepDirection(mate, frame, memberEnd);
}

function equalAngleMiterNormal(ownDirection, mateDirection) {
  if (!mateDirection) return ownDirection;
  let normal = v.norm(v.sub(mateDirection, ownDirection));
  if (v.len(normal) <= CSG_EPSILON) return ownDirection;
  if (v.dot(normal, ownDirection) < 0) normal = v.mul(normal, -1);
  return Math.abs(v.dot(normal, ownDirection)) <= CSG_EPSILON ? ownDirection : normal;
}

function matchedEdgeLengthNormal(project, profiles, member, ownDirection, miterNormal, trim) {
  const profile = profiles?.[member.profile];
  const ownSpan = sectionMaxSpan(profile);
  const mate = trim?.mateMemberId ? project.model?.members?.[trim.mateMemberId] : null;
  const mateSpan = mate ? sectionMaxSpan(profiles?.[mate.profile]) : ownSpan;
  const targetCutLength = typeof trim?.targetCutLength === "number" && Number.isFinite(trim.targetCutLength)
    ? Math.max(trim.targetCutLength, ownSpan)
    : Math.max(ownSpan, mateSpan);
  if (targetCutLength <= ownSpan + CSG_EPSILON) return ownDirection;

  const towardMiter = projectedAxis(miterNormal, ownDirection);
  if (!towardMiter) return ownDirection;
  const miterDot = Math.max(Math.abs(v.dot(miterNormal, ownDirection)), 0.05);
  const targetDot = Math.max(Math.min(ownSpan / targetCutLength, 1), miterDot);
  const side = Math.sqrt(Math.max(0, 1 - targetDot * targetDot));
  const normal = v.norm(v.add(v.mul(ownDirection, targetDot), v.mul(towardMiter, side)));
  return v.dot(normal, ownDirection) < 0 ? v.mul(normal, -1) : normal;
}

function memberTrimPlane(project, profiles, member, frame, feature) {
  const trim = feature.trim || {};
  if (trim.mode === "cut-to-reference-plane" && feature.plane) return feature.plane;

  const memberEnd = feature.memberEnd || trim.memberEnd;
  const ownDirection = memberEndKeepDirection(member, frame, memberEnd);
  const mateDirection = mateTrimDirection(project, trim);
  const miterNormal = equalAngleMiterNormal(ownDirection, mateDirection);
  const mode = trim.mode || "matched-edge-length";
  let normal = ownDirection;
  if (mode === "equal-angle-miter") normal = miterNormal;
  else if (mode === "matched-edge-length") normal = matchedEdgeLengthNormal(project, profiles, member, ownDirection, miterNormal, trim);
  else if (mode === "square-to-own-axis") normal = ownDirection;
  else if (mode !== "cut-to-reference-plane") geometryError(`${feature.id}: unsupported member-trim mode ${mode}`);

  const jointPoint = Array.isArray(trim.jointPoint) ? requiredVector(trim, "jointPoint", feature.id) : memberEndPoint(member, memberEnd);
  if (!jointPoint) geometryError(`${feature.id}: member-trim missing jointPoint/memberEnd`);
  const gap = typeof trim.gap === "number" && Number.isFinite(trim.gap) ? trim.gap : 0;
  const origin = v.add(jointPoint, v.mul(normal, Math.max(0, gap)));
  const axisX = projectedAxis(feature.plane?.axisX || trim.axisX, normal)
    || projectedAxis(frame.y, normal)
    || projectedAxis(frame.z, normal)
    || projectedAxis([0, 0, 1], normal)
    || projectedAxis([0, 1, 0], normal);
  if (!axisX) geometryError(`${feature.id}: member-trim cannot resolve plane axis`);
  const axisY = v.norm(v.cross(normal, axisX));
  const markerSpan = sectionMaxSpan(profiles?.[member.profile]) * 1.35;
  return {
    ...(feature.plane || {}),
    origin,
    normal,
    axisX,
    axisY,
    size: feature.plane?.size || trim.size || [markerSpan, markerSpan]
  };
}

function cuttingPlaneForFeature(project, profiles, member, frame, feature) {
  if (feature.type === "member-trim") return memberTrimPlane(project, profiles, member, frame, feature);
  return feature.plane;
}

function memberTrimRange(project, member, frame, length, scene = null) {
  const range = { start: 0, end: length };

  for (const feature of memberFeatures(project, member, scene)) {
    if (feature.type !== "cut-plane") continue;
    if (!feature.plane) geometryError(`${feature.id}: ${feature.type} missing plane`);
    const normal = v.norm(requiredVector(feature.plane, "normal", feature.id));
    const station = memberStation(member, frame, requiredVector(feature.plane, "origin", feature.id));
    const along = v.dot(normal, frame.x);
    if (along > 0.5) range.start = Math.max(range.start, Math.min(length, station));
    if (along < -0.5) range.end = Math.min(range.end, Math.max(0, station));
  }

  return range;
}

function memberFittingExtension(project, member, frame, profile, length, scene = null) {
  const bounds = sectionBounds(profile);
  const sectionSpan = Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
  const extension = sectionSpan * 2 + projectCoincidentTolerance(project) * 10;
  const range = { start: 0, end: length };

  for (const feature of memberFeatures(project, member, scene)) {
    if (feature.type !== "fitting" && feature.type !== "member-trim") continue;
    const plane = cuttingPlaneForFeature(project, scene?.profiles || {}, member, frame, feature);
    if (!plane) geometryError(`${feature.id}: ${feature.type} missing plane`);
    const normal = v.norm(requiredVector(plane, "normal", feature.id));
    const station = memberStation(member, frame, requiredVector(plane, "origin", feature.id));
    const along = v.dot(normal, frame.x);
    if (along > 0.5) range.start = Math.min(range.start, station - extension);
    if (along < -0.5) range.end = Math.max(range.end, station + extension);
  }

  return range;
}

function memberContourPoint(member, frame, point, station, length, cuts) {
  let x = station;
  if (Math.abs(station) < 0.001) x += endCutOffset(cuts.start, point, "start");
  if (Math.abs(station - length) < 0.001) x += endCutOffset(cuts.end, point, "end");
  return sectionPoint(member.start, frame, point, x);
}

function memberContourPolygons(member, frame, contourPoints, startStation, endStation, length, cuts, shared = {}) {
  const points = ccwPoints(contourPoints);
  const start = points.map((point) => memberContourPoint(member, frame, point, startStation, length, cuts));
  const end = points.map((point) => memberContourPoint(member, frame, point, endStation, length, cuts));
  const polygons = [];
  const add = (vertices, triangulate = false) => {
    const faces = triangulate && vertices.length > 3 ? triangulateFace(vertices) : [vertices];
    for (const face of faces) {
      const polygon = csgPolygon(face, { ...shared });
      if (polygon) polygons.push(polygon);
    }
  };

  add([...start].reverse(), true);
  add(end, true);
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    add([start[i], start[j], end[j], end[i]]);
  }
  return polygons;
}

function memberBasePolygons(project, member, frame, profile, color, startStation, endStation, length, scene = null) {
  const cuts = endCutFeatures(project, member, scene);
  const overlap = projectCoincidentTolerance(project) * 2;
  let polygons = [];
  const shared = { color };

  for (const contour of profile.section.contours) {
    if (contour.role !== "solid") continue;
    polygons = polygons.concat(memberContourPolygons(member, frame, contour.points, startStation, endStation, length, cuts, shared));
  }

  for (const contour of profile.section.contours) {
    if (contour.role !== "void") continue;
    const voidPolygons = memberContourPolygons(member, frame, contour.points, startStation - overlap, endStation + overlap, length, { start: null, end: null }, shared);
    polygons = csgSubtract(polygons, voidPolygons);
  }

  return polygons;
}

function planeCutPolygons(member, frame, profile, plane, shared = {}) {
  if (!plane) geometryError("plane cut missing plane");
  const length = v.len(v.sub(member.end, member.start));
  const bounds = sectionBounds(profile);
  const sectionSpan = Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
  const span = Math.max(length, sectionSpan) * 4 + 1000;
  const depth = span * 2;
  const keepNormal = v.norm(requiredVector(plane, "normal", "plane cut"));
  const discardAxis = v.mul(keepNormal, -1);
  let axisY = v.norm(requiredVector(plane, "axisX", "plane cut"));
  axisY = v.norm(v.sub(axisY, v.mul(discardAxis, v.dot(axisY, discardAxis))));
  if (v.len(axisY) <= CSG_EPSILON) geometryError("plane cut axisX cannot be parallel to normal");
  const axisZ = v.norm(v.cross(discardAxis, axisY));
  const center = v.add(requiredVector(plane, "origin", "plane cut"), v.mul(discardAxis, depth / 2));

  return prismPolygons(center, discardAxis, axisY, axisZ, depth, [
    [-span, -span],
    [span, -span],
    [span, span],
    [-span, span]
  ], shared);
}

function memberCsgPolygons(project, profiles, member, profile, color, scene = null) {
  const frame = memberFrame(member);
  const length = v.len(v.sub(member.end, member.start));
  const range = memberTrimRange(project, member, frame, length, scene);
  const fittingRange = memberFittingExtension(project, member, frame, profile, length, scene);
  const shared = { color };
  let polygons = memberBasePolygons(project, member, frame, profile, color, Math.min(range.start, fittingRange.start), Math.max(range.end, fittingRange.end), length, scene);

  for (const feature of memberFeatures(project, member, scene)) {
    const cutPolygons = holeOrSlotCut(project, profiles, polygons, feature, null, shared);
    if (cutPolygons) {
      polygons = cutPolygons;
      continue;
    }

    if (feature.type === "clearance-cut") {
      const body = cutBodyForFeature(project, profiles, feature);
      if (!body) geometryError(`${feature.id}: clearance-cut missing derivable body`);
      polygons = csgSubtract(polygons, cutBodyPolygons(body, shared));
      continue;
    }

    if (feature.type === "boolean-part") {
      if (!["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) geometryError(`${feature.id}: unsupported booleanType ${feature.booleanType}`);
      const bodyDefinition = cutBodyForFeature(project, profiles, feature);
      if (!bodyDefinition) geometryError(`${feature.id}: boolean-part missing derivable body`);
      const body = cutBodyPolygons(bodyDefinition, shared);
      polygons = feature.booleanType === "BOOLEAN_ADD" ? csgUnion(polygons, body) : csgSubtract(polygons, body);
      continue;
    }

    if (feature.type === "cut-plane" || feature.type === "fitting" || feature.type === "member-trim") {
      const plane = cuttingPlaneForFeature(project, scene?.profiles || {}, member, frame, feature);
      polygons = csgSubtract(polygons, planeCutPolygons(member, frame, profile, plane, shared));
      continue;
    }

    if (["saw-cut", "miter-cut", "end-cut"].includes(feature.type)) continue;
    geometryError(`${member.id}/${feature.id}: unsupported member feature type ${feature.type}`);
  }

  return polygons;
}

function meshPointKey(point) {
  return point.map((value) => Math.round(value / 0.001)).join(",");
}

function meshEdgeKey(a, b) {
  const ka = meshPointKey(a);
  const kb = meshPointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function addMeshCreaseEdges(scene, polygons, edgeColor, meta = {}) {
  const edges = new Map();
  const creaseDot = Math.cos(15 * Math.PI / 180);

  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length < 3) continue;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const key = meshEdgeKey(a, b);
      const edge = edges.get(key) || { a, b, normals: [] };
      edge.normals.push(polygon.plane.normal);
      edges.set(key, edge);
    }
  }

  for (const edge of edges.values()) {
    const uniqueNormals = [];
    for (const normal of edge.normals) {
      if (!uniqueNormals.some((existing) => Math.abs(v.dot(existing, normal)) > 1 - 0.0001)) uniqueNormals.push(normal);
    }

    const isCrease = uniqueNormals.some((normal, index) => uniqueNormals.slice(index + 1).some((other) => v.dot(normal, other) < creaseDot));
    if (isCrease) addLine(scene, edge.a, edge.b, edgeColor, meta);
  }
}

function addMember(scene, project, member, profile, options = {}) {
  const color = member.display?.color || "#78909c";
  const edgeColor = member.display?.edgeColor || color || settings.render.edges.defaultColor;
  const opacity = member.display?.transparent ? member.display?.opacity ?? DEFAULT_GHOST_OPACITY : member.display?.opacity;
  const meta = { collection: "members", objectId: member.id, ...(options.lodDetail ? detailMeta(member.id) : {}) };
  const polygons = memberCsgPolygons(project, scene.profiles, member, profile, color, scene);

  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length >= 3) scene.faces.push({ points, color: polygon.shared?.color || color, opacity, hideEdges: true, ...meta });
  }
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

function canInstanceMember(scene, member, profile) {
  if (member.display?.transparent || member.display?.opacity !== undefined) return false;
  if (!instanceGeometryForProfile(scene, profile)) return false;
  return true;
}

function addInstancedMember(scene, member, profile, options = {}) {
  const frame = memberFrame(member);
  const length = v.len(v.sub(member.end, member.start));
  if (!Number.isFinite(length) || length <= CSG_EPSILON) return false;
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

function addPlateSolid(scene, midPoints, normal, thickness, color, edgeColor, meta = {}) {
  const n = v.norm(normal);
  const hx = thickness / 2;
  const back = midPoints.map((point) => v.add(point, v.mul(n, -hx)));
  const front = midPoints.map((point) => v.add(point, v.mul(n, hx)));

  scene.faces.push({ points: back, color, ...meta });
  scene.faces.push({ points: [...front].reverse(), color, ...meta });
  addLoopLines(scene, back, edgeColor, meta);
  addLoopLines(scene, front, edgeColor, meta);
  for (let i = 0; i < midPoints.length; i += 1) {
    const j = (i + 1) % midPoints.length;
    scene.faces.push({ points: [back[i], back[j], front[j], front[i]], color, ...meta });
    addLine(scene, back[i], front[i], edgeColor, meta);
  }
}

function addBentPlate(scene, plate) {
  const bend = plate.flatPattern?.bendLines?.[0];
  if (!bend) return false;

  const y = v.norm(plate.localAxisY);
  const z = v.norm(plate.localAxisZ);
  const n = v.norm(plate.normal);
  const color = plate.display?.color || "#a6a6a6";
  const edgeColor = plate.display?.edgeColor || settings.render.edges.plateColor;
  const meta = {
    collection: "plates",
    objectId: plate.id,
    ...detailMeta(plate.id),
    ...(plate.display?.transparent || plate.display?.suppressed || plate.display?.opacity !== undefined ? { opacity: plate.display?.opacity ?? DEFAULT_GHOST_OPACITY } : {}),
    ...(plate.display?.suppressed ? { suppressed: true } : {})
  };
  const outline = plate.flatPattern.outline;
  const minY = Math.min(...outline.map((point) => point[0]));
  const maxY = Math.max(...outline.map((point) => point[0]));
  const minZ = Math.min(...outline.map((point) => point[1]));
  const maxZ = Math.max(...outline.map((point) => point[1]));
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const direction = bend.direction === "down" ? -1 : 1;
  const angle = direction * requiredNumber(bend, "angle", `${plate.id} bend`) * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const flatPoint = (py, pz) => v.add(plate.center, v.add(v.mul(y, py - centerY), v.mul(z, pz - centerZ)));

  if (bend.start[0] === bend.end[0]) {
    const bendY = bend.start[0];
    const bentY = v.norm(v.add(v.mul(y, c), v.mul(n, s)));
    const bentNormal = v.norm(v.cross(bentY, z));
    const bentPoint = (py, pz) => py <= bendY ? flatPoint(py, pz) : v.add(flatPoint(bendY, pz), v.mul(bentY, py - bendY));
    const flatPanel = [
      flatPoint(minY, minZ),
      flatPoint(bendY, minZ),
      flatPoint(bendY, maxZ),
      flatPoint(minY, maxZ)
    ];
    const bentPanel = [
      bentPoint(bendY, minZ),
      bentPoint(maxY, minZ),
      bentPoint(maxY, maxZ),
      bentPoint(bendY, maxZ)
    ];

    addPlateSolid(scene, flatPanel, n, plate.thickness, color, edgeColor, meta);
    addPlateSolid(scene, bentPanel, bentNormal, plate.thickness, color, edgeColor, meta);
    addLine(scene, flatPoint(bendY, minZ), flatPoint(bendY, maxZ), "#111827", meta);
    return true;
  }

  if (bend.start[1] === bend.end[1]) {
    const bendZ = bend.start[1];
    const bentZ = v.norm(v.add(v.mul(z, c), v.mul(n, s)));
    const bentNormal = v.norm(v.cross(y, bentZ));
    const bentPoint = (py, pz) => pz <= bendZ ? flatPoint(py, pz) : v.add(flatPoint(py, bendZ), v.mul(bentZ, pz - bendZ));
    const flatPanel = [
      flatPoint(minY, minZ),
      flatPoint(maxY, minZ),
      flatPoint(maxY, bendZ),
      flatPoint(minY, bendZ)
    ];
    const bentPanel = [
      bentPoint(minY, bendZ),
      bentPoint(maxY, bendZ),
      bentPoint(maxY, maxZ),
      bentPoint(minY, maxZ)
    ];

    addPlateSolid(scene, flatPanel, n, plate.thickness, color, edgeColor, meta);
    addPlateSolid(scene, bentPanel, bentNormal, plate.thickness, color, edgeColor, meta);
    addLine(scene, flatPoint(minY, bendZ), flatPoint(maxY, bendZ), "#111827", meta);
    return true;
  }

  return false;
}

function plateOutline(plate) {
  if (plate.outline) return plate.outline;
  const width = requiredNumber(plate, "width", plate.id);
  const height = requiredNumber(plate, "height", plate.id);
  if (width <= 0 || height <= 0) geometryError(`${plate.id}: plate width and height must be positive`);
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2]
  ];
}

function plateCsgPolygons(project, profiles, plate, color) {
  const shared = { color };
  const center = requiredVector(plate, "center", plate.id);
  const normal = requiredVector(plate, "normal", plate.id);
  const axisY = requiredVector(plate, "localAxisY", plate.id);
  const axisZ = requiredVector(plate, "localAxisZ", plate.id);
  const thickness = requiredNumber(plate, "thickness", plate.id);
  let polygons = prismPolygons(center, normal, axisY, axisZ, thickness, plateOutline(plate), shared);
  const cutterDepth = thickness + projectCoincidentTolerance(project) * 4;

  for (const feature of objectFeatures(project, plate)) {
    const cutPolygons = holeOrSlotCut(project, profiles, polygons, feature, cutterDepth, shared);
    if (cutPolygons) {
      polygons = cutPolygons;
      continue;
    }

    if (feature.type === "clearance-cut") {
      const body = cutBodyForFeature(project, profiles, feature);
      if (body) {
        polygons = csgSubtract(polygons, cutBodyPolygons(body, shared));
        continue;
      }
    }

    geometryError(`${plate.id}/${feature.id}: unsupported plate feature type ${feature.type}`);
  }

  return polygons;
}

function addPlate(scene, project, plate) {
  if (plate.flatPattern?.bendLines?.length) {
    if ((plate.featureIds || []).length) geometryError(`${plate.id}: bent plate features are not implemented in strict evaluator`);
    if (addBentPlate(scene, plate)) return;
    geometryError(`${plate.id}: bent plate geometry is unsupported`);
  }

  const color = plate.display?.color || "#a6a6a6";
  const edgeColor = plate.display?.edgeColor || settings.render.edges.plateColor;
  const meta = {
    collection: "plates",
    objectId: plate.id,
    ...detailMeta(plate.id),
    ...(plate.display?.transparent || plate.display?.suppressed || plate.display?.opacity !== undefined ? { opacity: plate.display?.opacity ?? DEFAULT_GHOST_OPACITY } : {}),
    ...(plate.display?.suppressed ? { suppressed: true } : {})
  };
  const polygons = plateCsgPolygons(project, scene.profiles, plate, color);

  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length >= 3) scene.faces.push({ points, color: polygon.shared?.color || color, hideEdges: true, ...meta });
  }
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

function addDisc(scene, center, axisY, axisZ, radius, color, edgeColor = settings.render.edges.fastenerHeadColor, meta = {}) {
  const points = [];
  const segments = settings.render.curves.discSegments;
  for (let i = 0; i < segments; i += 1) {
    const a = i / segments * Math.PI * 2;
    points.push(v.add(center, v.add(v.mul(axisY, Math.cos(a) * radius), v.mul(axisZ, Math.sin(a) * radius))));
  }
  scene.faces.push({ points, color, ...meta });
  addLoopLines(scene, points, edgeColor, meta);
}

function circleOutline(radius, segments, angleOffset = 0) {
  const points = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = angleOffset + i / segments * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return points;
}

function hexOutline(acrossFlats) {
  return circleOutline(acrossFlats / Math.sqrt(3), 6, Math.PI / 6);
}

function addPrism(scene, center, axis, axisY, axisZ, depth, outline, color, edgeColor, meta = {}) {
  const polygons = prismPolygons(center, axis, axisY, axisZ, depth, outline, { color });
  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length >= 3) scene.faces.push({ points, color, hideEdges: true, ...meta });
  }
  addMeshCreaseEdges(scene, polygons, edgeColor, meta);
}

function ringPoints(center, axisY, axisZ, radius, segments) {
  return circleOutline(radius, segments).map((point) => v.add(center, v.add(v.mul(axisY, point[0]), v.mul(axisZ, point[1]))));
}

function addWasher(scene, center, axis, axisY, axisZ, outerRadius, innerRadius, thickness, color, edgeColor, meta = {}) {
  if (outerRadius <= innerRadius || thickness <= 0) return;
  const segments = settings.render.curves.discSegments;
  const frontCenter = v.add(center, v.mul(axis, thickness / 2));
  const backCenter = v.add(center, v.mul(axis, -thickness / 2));
  const outerFront = ringPoints(frontCenter, axisY, axisZ, outerRadius, segments);
  const innerFront = ringPoints(frontCenter, axisY, axisZ, innerRadius, segments);
  const outerBack = ringPoints(backCenter, axisY, axisZ, outerRadius, segments);
  const innerBack = ringPoints(backCenter, axisY, axisZ, innerRadius, segments);

  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    scene.faces.push({ points: [outerBack[i], outerBack[j], outerFront[j], outerFront[i]], color, ...meta });
    scene.faces.push({ points: [innerBack[j], innerBack[i], innerFront[i], innerFront[j]], color, ...meta });
    scene.faces.push({ points: [outerFront[i], outerFront[j], innerFront[j], innerFront[i]], color, ...meta });
    scene.faces.push({ points: [outerBack[j], outerBack[i], innerBack[i], innerBack[j]], color, ...meta });
  }

  addLoopLines(scene, outerFront, edgeColor, meta);
  addLoopLines(scene, innerFront, edgeColor, meta);
  addLoopLines(scene, outerBack, edgeColor, meta);
  addLoopLines(scene, innerBack, edgeColor, meta);
}

function featureOrigin(project, profiles, feature) {
  const ref = feature.reference;
  if (!ref || !ref.kind) geometryError(`${feature.id}: feature missing reference.kind`);
  if (ref.kind === "plate-face") {
    const plate = objectById(project, feature.ownerId);
    const normal = v.norm(requiredVector(plate, "normal", plate.id));
    if (!["front", "back"].includes(ref.face)) geometryError(`${feature.id}: plate-face reference must set face to front or back`);
    const faceOffset = ref.face === "front" ? -plate.thickness / 2 : ref.face === "back" ? plate.thickness / 2 : 0;
    const origin = Array.isArray(ref.origin) ? requiredVector(ref, "origin", `${feature.id} reference`) : plate.center;
    return {
      origin: v.add(origin, v.mul(normal, faceOffset)),
      normal,
      y: v.norm(requiredVector(ref, "localAxisY", `${feature.id} reference`)),
      z: v.norm(requiredVector(ref, "localAxisZ", `${feature.id} reference`))
    };
  }
  if (ref.interfaceRef) {
    const options = {};
    if (ref.stationReferenceInterfaceRef) {
      options.referencePoint = resolveInterfaceWithConnectionReference(project, profiles, ref.stationReferenceInterfaceRef).origin;
      options.preferReferencePoint = true;
    }
    const iface = resolveInterfaceWithConnectionReference(project, profiles, ref.interfaceRef, options);
    return {
      origin: requiredVector(iface, "origin", `${feature.id} resolved interface`),
      normal: v.norm(requiredVector(iface, "normal", `${feature.id} resolved interface`)),
      y: v.norm(requiredVector(iface, "localAxisY", `${feature.id} resolved interface`)),
      z: v.norm(requiredVector(iface, "localAxisZ", `${feature.id} resolved interface`))
    };
  }
  if (!Array.isArray(ref.origin)) geometryError(`${feature.id}: non-plate feature reference must provide numeric origin`);
  return {
    origin: requiredVector(ref, "origin", `${feature.id} reference`),
    normal: v.norm(requiredVector(ref, "normal", `${feature.id} reference`)),
    y: v.norm(requiredVector(ref, "localAxisY", `${feature.id} reference`)),
    z: v.norm(requiredVector(ref, "localAxisZ", `${feature.id} reference`))
  };
}

function addCutBody(scene, project, profiles, feature) {
  if (feature.operationEnabled === false) return;
  if (!shouldRenderObject(scene, feature)) return;
  const meta = { collection: "features", objectId: feature.id, ...detailMeta(feature.id) };
  if (feature.type === "cut-plane" || feature.type === "fitting" || feature.type === "member-trim") {
    let plane = feature.plane;
    if (feature.type === "member-trim") {
      const member = objectById(project, feature.ownerId);
      plane = memberTrimPlane(project, profiles, member, memberFrame(member), feature);
    }
    if (!plane) geometryError(`${feature.id}: ${feature.type} missing plane`);
    addPlaneMarker(scene, plane, feature.display || {}, meta);
    return;
  }
  if (feature.type !== "boolean-part" && feature.type !== "clearance-cut") return;
  if (feature.type === "boolean-part" && !["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"].includes(feature.booleanType)) geometryError(`${feature.id}: unsupported booleanType ${feature.booleanType}`);
  const isCut = feature.type === "clearance-cut" || feature.booleanType === "BOOLEAN_CUT";
  const display = isCut
    ? { ...(feature.display || {}), color: feature.display?.color || "#ff3366", opacity: Math.min(feature.display?.opacity ?? 0.28, 0.06) }
    : { ...(feature.display || {}), color: feature.display?.color || "#f59e0b", opacity: feature.display?.opacity ?? 0.16 };
  const body = cutBodyForFeature(project, profiles, feature);
  if (!body) geometryError(`${feature.id}: feature missing derivable body`);
  const polygons = cutBodyPolygons(body, { color: display.color });
  for (const polygon of polygons) {
    const points = csgCleanPoints(polygon.vertices);
    if (points.length >= 3) scene.faces.push({ points, color: display.color, opacity: display.opacity, hideEdges: true, ...meta });
  }
  addMeshCreaseEdges(scene, polygons, display.edgeColor || display.color, meta);
}

function fastenerDefinition(scene, fastenerGroup) {
  if (!fastenerGroup.fastenerRef) throw new Error(`${fastenerGroup.id}: missing fastenerRef`);
  const fastener = scene.fasteners[fastenerGroup.fastenerRef];
  if (!fastener) throw new Error(`${fastenerGroup.id}: fastenerRef not found in fastener library: ${fastenerGroup.fastenerRef}`);
  return fastener;
}

function fastenerGripLength(project, fastenerGroup) {
  const assemblyGrip = fastenerGroup.assembly?.gripLength;
  if (typeof assemblyGrip === "number" && Number.isFinite(assemblyGrip) && assemblyGrip > 0) return assemblyGrip;
  const fromFeature = fastenerGroup.through?.fromFeatureId ? objectById(project, fastenerGroup.through.fromFeatureId) : null;
  const toFeature = fastenerGroup.through?.toFeatureId ? objectById(project, fastenerGroup.through.toFeatureId) : null;
  const owner = fromFeature?.ownerId ? objectById(project, fromFeature.ownerId) : null;
  const fromDepth = owner?.thickness || fromFeature?.depth || 0;
  const toDepth = toFeature?.depth || 0;
  return Math.max(fromDepth + toDepth, settings.render.fasteners.length * 0.45);
}

function addFastenerAssembly(scene, project, fastenerGroup, fastener, basis, position, color, edgeColor, meta) {
  const shankDiameter = requiredNumber(fastener.shank || {}, "diameter", fastener.id);
  const shankRadius = shankDiameter / 2;
  const axis = Array.isArray(fastenerGroup.orientation?.axis)
    ? v.norm(requiredVector(fastenerGroup.orientation, "axis", `${fastenerGroup.id} orientation`))
    : v.norm(basis.normal);
  const center = v.add(basis.origin, v.add(v.mul(basis.y, position[0]), v.mul(basis.z, position[1])));
  const gripLength = fastenerGripLength(project, fastenerGroup);
  const headHeight = fastener.head?.height || shankDiameter * 0.6;
  const headAcrossFlats = fastener.head?.acrossFlats || shankDiameter * 1.5;
  const nutHeight = fastener.nut?.height || headHeight;
  const nutAcrossFlats = fastener.nut?.acrossFlats || headAcrossFlats;
  const washer = fastener.washer || {};
  const washerThickness = washer.thickness || 0;
  const washerOuterRadius = (washer.outerDiameter || headAcrossFlats * 1.25) / 2;
  const washerInnerRadius = (washer.innerDiameter || fastener.hole?.defaultDiameter || shankDiameter + 2) / 2;
  const washers = fastenerGroup.assembly?.washers || {};
  const useHeadWasher = washers.head ?? Boolean(fastener.washer);
  const useNutWasher = washers.nut ?? Boolean(fastener.washer && fastener.nut);
  const nutEnd = gripLength + (useNutWasher ? washerThickness : 0) + (fastener.nut ? nutHeight : 0);
  const defaultLength = Math.max(settings.render.fasteners.length || 0, nutEnd + shankDiameter * 0.25);
  const requestedLength = fastenerGroup.assembly?.length;
  const boltLength = typeof requestedLength === "number" && Number.isFinite(requestedLength) && requestedLength > 0 ? requestedLength : defaultLength;
  const shankLength = Math.max(boltLength, gripLength + 1);
  const shankCenter = v.add(center, v.mul(axis, shankLength / 2));
  const shankColor = fastenerGroup.display?.shankColor || color;
  const componentColor = fastenerGroup.display?.headColor || color;
  const washerColor = fastenerGroup.display?.washerColor || "#d6b35a";

  addPrism(scene, shankCenter, axis, basis.y, basis.z, shankLength, circleOutline(shankRadius, settings.render.fasteners.sides), shankColor, edgeColor, meta);

  let headOffset = 0;
  if (useHeadWasher) {
    headOffset -= washerThickness / 2;
    addWasher(scene, v.add(center, v.mul(axis, headOffset)), axis, basis.y, basis.z, washerOuterRadius, washerInnerRadius, washerThickness, washerColor, edgeColor, meta);
    headOffset -= washerThickness / 2;
  }
  addPrism(scene, v.add(center, v.mul(axis, headOffset - headHeight / 2)), axis, basis.y, basis.z, headHeight, hexOutline(headAcrossFlats), componentColor, edgeColor, meta);

  const nutSurface = v.add(center, v.mul(axis, gripLength));
  const customNutOffset = fastenerGroup.assembly?.nutOffset;
  let nutStackOffset = typeof customNutOffset === "number" && Number.isFinite(customNutOffset) ? customNutOffset : 0;
  if (useNutWasher) {
    nutStackOffset += washerThickness / 2;
    addWasher(scene, v.add(nutSurface, v.mul(axis, nutStackOffset)), axis, basis.y, basis.z, washerOuterRadius, washerInnerRadius, washerThickness, washerColor, edgeColor, meta);
    nutStackOffset += washerThickness / 2;
  }
  if (fastener.nut) addPrism(scene, v.add(nutSurface, v.mul(axis, nutStackOffset + nutHeight / 2)), axis, basis.y, basis.z, nutHeight, hexOutline(nutAcrossFlats), componentColor, edgeColor, meta);
}

function addFastenerGroups(scene, project, fastenerGroups = collectionObjects(project, "fastenerGroups")) {
  for (const fastenerGroup of fastenerGroups) {
    if (!shouldRenderObject(scene, fastenerGroup)) continue;
    if (!shouldBuildLodDetail(scene, fastenerGroup.id)) continue;
    const pattern = objectById(project, fastenerGroup.holePatternRef);
    const feature = objectById(project, fastenerGroup.through.fromFeatureId);
    const basis = featureOrigin(project, scene.profiles, feature);
    const fastener = fastenerDefinition(scene, fastenerGroup);
    const color = fastenerGroup.display?.color || "#b7791f";
    const edgeColor = fastenerGroup.display?.edgeColor || settings.render.edges.fastenerHeadColor;
    const meta = { collection: "fastenerGroups", objectId: fastenerGroup.id, ...detailMeta(fastenerGroup.id) };
    const suppressedPositions = new Set(pattern.suppressedPositionIndices || []);
    const groupSuppressed = Boolean(fastenerGroup.display?.suppressed);

    for (const [positionIndex, position] of pattern.positions.entries()) {
      const suppressed = groupSuppressed || suppressedPositions.has(positionIndex);
      if (suppressed && !isActiveConnectionObject(scene, fastenerGroup.id) && !isActiveConnectionObject(scene, pattern.id)) continue;
      addFastenerAssembly(scene, project, fastenerGroup, fastener, basis, position, color, edgeColor, {
        ...meta,
        positionIndex,
        componentKind: "fastener-position",
        ...(suppressed ? { suppressed: true, opacity: fastenerGroup.display?.opacity ?? DEFAULT_GHOST_OPACITY } : {})
      });
    }
  }
}

function addPlateSupportEdgeWeld(scene, project, weld) {
  const ref = weld.reference;
  const plate = objectById(project, ref.plateId);
  const options = {};
  if (ref.stationReferenceInterfaceRef) {
    options.referencePoint = resolveInterfaceWithConnectionReference(project, scene.profiles, ref.stationReferenceInterfaceRef).origin;
    options.preferReferencePoint = true;
  }
  const supportInterface = resolveInterfaceWithConnectionReference(project, scene.profiles, ref.supportInterfaceId, options);
  const plateCenter = requiredVector(plate, "center", plate.id);
  const plateNormal = v.norm(requiredVector(plate, "normal", plate.id));
  const plateAxisY = v.norm(requiredVector(plate, "localAxisY", plate.id));
  const plateAxisZ = v.norm(requiredVector(plate, "localAxisZ", plate.id));
  const supportNormal = v.norm(requiredVector(supportInterface, "normal", supportInterface.id));
  const width = requiredNumber(plate, "width", plate.id);
  const height = requiredNumber(plate, "height", plate.id);
  const thickness = requiredNumber(plate, "thickness", plate.id);
  const size = Math.max(requiredNumber(weld, "size", weld.id), 1);
  const edgeSide = v.dot(plateAxisY, supportNormal) >= 0 ? -1 : 1;
  const edgeCenter = v.add(plateCenter, v.mul(plateAxisY, edgeSide * width / 2));
  const color = weld.display?.color || "#f6e05e";
  const weldOpacity = weld.display?.transparent || weld.display?.suppressed || weld.display?.opacity !== undefined ? weld.display?.opacity ?? DEFAULT_GHOST_OPACITY : 0.9;
  const meta = { collection: "welds", objectId: weld.id, ...detailMeta(weld.id), opacity: weldOpacity, ...(weld.display?.suppressed ? { suppressed: true } : {}) };
  const runs = Array.isArray(ref.runs)
    ? ref.runs
    : [{ edge: "support", side: "front", size }, { edge: "support", side: "back", size }];
  const rectangularSupportEdge = {
    a: v.add(edgeCenter, v.mul(plateAxisZ, -height / 2)),
    b: v.add(edgeCenter, v.mul(plateAxisZ, height / 2)),
    inward: v.mul(plateAxisY, -edgeSide),
    beadLimit: width / 5
  };

  const clippedSupportEdge = () => {
    if (!Array.isArray(plate.outline) || plate.outline.length < 3) return null;
    const points = plateOutline(plate).map((point) => v.add(plateCenter, v.add(v.mul(plateAxisY, point[0]), v.mul(plateAxisZ, point[1]))));
    const centroid = v.mul(points.reduce((sum, point) => v.add(sum, point), [0, 0, 0]), 1 / points.length);
    let best = null;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const score = Math.abs(v.dot(v.sub(a, supportInterface.origin), supportNormal)) + Math.abs(v.dot(v.sub(b, supportInterface.origin), supportNormal));
      if (!best || score < best.score) best = { a, b, score };
    }
    if (!best) return null;
    const center = v.mul(v.add(best.a, best.b), 0.5);
    const inwardRaw = v.sub(centroid, center);
    const inward = v.len(inwardRaw) > CSG_EPSILON ? v.norm(inwardRaw) : rectangularSupportEdge.inward;
    return { ...best, inward, beadLimit: Math.max(1, v.len(v.sub(best.b, best.a)) / 5) };
  };
  const supportEdge = clippedSupportEdge() || rectangularSupportEdge;

  const clearanceCutInterval = (geometry, a, b) => {
    const local = (point) => {
      const delta = v.sub(point, geometry.basis.origin);
      return {
        x: v.dot(delta, geometry.basis.x),
        y: v.dot(delta, geometry.basis.y),
        z: v.dot(delta, geometry.basis.z)
      };
    };
    const start = local(a);
    const end = local(b);
    let t0 = 0;
    let t1 = 1;

    for (const axis of ["x", "y", "z"]) {
      const min = geometry.ranges[`${axis}Min`] - CSG_EPSILON;
      const max = geometry.ranges[`${axis}Max`] + CSG_EPSILON;
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) <= CSG_EPSILON) {
        if (start[axis] < min || start[axis] > max) return null;
        continue;
      }
      let enter = (min - start[axis]) / delta;
      let exit = (max - start[axis]) / delta;
      if (enter > exit) [enter, exit] = [exit, enter];
      t0 = Math.max(t0, enter);
      t1 = Math.min(t1, exit);
      if (t0 > t1) return null;
    }

    if (t1 <= CSG_EPSILON || t0 >= 1 - CSG_EPSILON) return null;
    return [Math.max(0, t0), Math.min(1, t1)];
  };

  const connectionClearanceCuts = () => {
    const features = new Map();
    const addFeature = (id) => {
      const entry = project.objectIndex?.[id];
      if (entry?.collection !== "features") return;
      const feature = objectById(project, id);
      if (feature.type === "clearance-cut" && feature.operationEnabled !== false) features.set(feature.id, feature);
    };

    for (const feature of objectFeatures(project, plate)) addFeature(feature.id);
    for (const connection of collectionObjects(project, "connections")) {
      const manualParts = connection.manualParts || {};
      const generator = connection.generator || {};
      const ownsWeld = (manualParts.weldIds || []).includes(weld.id)
        || generator.objectRoles?.weld === weld.id
        || (generator.ownedObjectIds || []).includes(weld.id);
      if (!ownsWeld) continue;
      for (const id of manualParts.featureIds || []) addFeature(id);
      for (const id of generator.ownedObjectIds || []) addFeature(id);
    }

    return [...features.values()]
      .map((feature) => clearanceCutGeometry(project, scene.profiles, feature))
      .filter(Boolean);
  };
  const clearanceCuts = connectionClearanceCuts();

  const mergeIntervals = (intervals) => {
    const sorted = intervals
      .filter((interval) => interval && interval[1] - interval[0] > CSG_EPSILON)
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of sorted) {
      const last = merged[merged.length - 1];
      if (!last || interval[0] > last[1] + CSG_EPSILON) {
        merged.push([...interval]);
      } else {
        last[1] = Math.max(last[1], interval[1]);
      }
    }
    return merged;
  };

  const supportEdgeSegments = (bead) => {
    if (!clearanceCuts.length) return [supportEdge];
    const cutLines = [
      [supportEdge.a, supportEdge.b],
      [v.add(supportEdge.a, v.mul(supportEdge.inward, bead / 2)), v.add(supportEdge.b, v.mul(supportEdge.inward, bead / 2))],
      [v.add(supportEdge.a, v.mul(supportEdge.inward, bead)), v.add(supportEdge.b, v.mul(supportEdge.inward, bead))]
    ];
    const intervals = mergeIntervals(clearanceCuts.flatMap((geometry) => {
      return cutLines.map(([a, b]) => clearanceCutInterval(geometry, a, b));
    }));
    if (!intervals.length) return [supportEdge];

    const edgeVector = v.sub(supportEdge.b, supportEdge.a);
    const pointAt = (t) => v.add(supportEdge.a, v.mul(edgeVector, t));
    const segments = [];
    let cursor = 0;
    for (const [start, end] of intervals) {
      if (start > cursor + CSG_EPSILON) {
        const a = pointAt(cursor);
        const b = pointAt(start);
        segments.push({ ...supportEdge, a, b, beadLimit: Math.max(1, v.len(v.sub(b, a)) / 5) });
      }
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1 - CSG_EPSILON) {
      const a = pointAt(cursor);
      const b = supportEdge.b;
      segments.push({ ...supportEdge, a, b, beadLimit: Math.max(1, v.len(v.sub(b, a)) / 5) });
    }
    return segments.filter((segment) => v.len(v.sub(segment.b, segment.a)) > CSG_EPSILON);
  };

  const addWeldFace = (points, runColor = color) => {
    scene.faces.push({ points, color: runColor, opacity: weldOpacity, ...meta });
    addLoopLines(scene, points, runColor, meta);
  };

  for (const run of runs) {
    const runSize = Math.max(run.size ?? size, 0);
    if (runSize <= 0) continue;
    const bead = Math.min(runSize, supportEdge.beadLimit);
    if (run.edge === "support") {
      const sides = run.side ? [run.side] : ["front", "back"];
      for (const edgeSegment of supportEdgeSegments(bead)) {
        const segmentBead = Math.min(runSize, edgeSegment.beadLimit);
        for (const sideName of sides) {
          const side = sideName === "back" ? -1 : 1;
          const faceOffset = v.mul(plateNormal, side * (thickness / 2 + 0.25));
          const bottom = v.add(edgeSegment.a, faceOffset);
          const top = v.add(edgeSegment.b, faceOffset);
          addWeldFace([bottom, top, v.add(top, v.mul(edgeSegment.inward, segmentBead)), v.add(bottom, v.mul(edgeSegment.inward, segmentBead))]);
        }
      }
      continue;
    }

    if (run.edge === "top" || run.edge === "bottom") {
      const zSide = run.edge === "top" ? 1 : -1;
      const faceFront = v.mul(plateNormal, thickness / 2 + 0.25);
      const faceBack = v.mul(plateNormal, -thickness / 2 - 0.25);
      const edgePoint = v.dot(v.sub(supportEdge.a, plateCenter), plateAxisZ) * zSide > v.dot(v.sub(supportEdge.b, plateCenter), plateAxisZ) * zSide
        ? supportEdge.a
        : supportEdge.b;
      const front = v.add(edgePoint, faceFront);
      const back = v.add(edgePoint, faceBack);
      addWeldFace([front, back, v.add(back, v.mul(supportEdge.inward, bead)), v.add(front, v.mul(supportEdge.inward, bead))]);
    }
  }
}

function memberProfilePointOnPlane(member, frame, planeOrigin, planeNormal, point) {
  const sectionOrigin = sectionPoint(member.start, frame, point, 0);
  const denominator = v.dot(planeNormal, frame.x);
  if (Math.abs(denominator) <= CSG_EPSILON) geometryError(`${member.id}: member axis does not intersect weld fitting plane`);
  const station = v.dot(planeNormal, v.sub(planeOrigin, sectionOrigin)) / denominator;
  return sectionPoint(member.start, frame, point, station);
}

function memberWeldProfilePoints(project, profiles, weld, member, profile, frame, contour) {
  const trimOrFittingFeatureId = weld.reference?.trimFeatureId || weld.reference?.fittingFeatureId;
  if (trimOrFittingFeatureId) {
    const feature = objectById(project, trimOrFittingFeatureId);
    if (feature.type !== "fitting" && feature.type !== "member-trim") geometryError(`${weld.id}: trim/fitting reference must reference a fitting or member-trim feature`);
    const plane = cuttingPlaneForFeature(project, profiles, member, frame, feature);
    if (!plane) geometryError(`${weld.id}: trim/fitting reference missing plane`);
    const planeOrigin = requiredVector(plane, "origin", feature.id);
    const planeNormal = v.norm(requiredVector(plane, "normal", feature.id));
    return contour.points.map((point) => memberProfilePointOnPlane(member, frame, planeOrigin, planeNormal, point));
  }

  const origin = Array.isArray(weld.reference.origin) ? weld.reference.origin : weld.reference.end === "start" ? member.start : member.end;
  return contour.points.map((point) => sectionPoint(origin, frame, point));
}

function addWelds(scene, project, welds = collectionObjects(project, "welds")) {
  for (const weld of welds) {
    if (!shouldRenderObject(scene, weld)) continue;
    if (!shouldBuildLodDetail(scene, weld.id)) continue;
    if (weld.reference?.kind === "plate-support-edge") {
      addPlateSupportEdgeWeld(scene, project, weld);
      continue;
    }
    if (!weld.reference?.memberId) geometryError(`${weld.id}: unsupported weld reference ${weld.reference?.kind || "missing"}`);
    const member = objectById(project, weld.reference.memberId);
    const profile = scene.profiles[member.profile];
    const frame = memberFrame(member);
    const color = weld.display?.color || "#f6e05e";
    const meta = { collection: "welds", objectId: weld.id, ...detailMeta(weld.id) };

    for (const contour of profile.section.contours) {
      if (contour.role !== "solid") continue;
      addLoopLines(scene, memberWeldProfilePoints(project, scene.profiles, weld, member, profile, frame, contour), color, meta);
    }
  }
}

function buildLodDetails(scene) {
  const entries = new Map();
  const addPoint = (id, point) => {
    if (!id || !Array.isArray(point)) return;
    const entry = entries.get(id) || {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity]
    };
    for (let i = 0; i < 3; i += 1) {
      entry.min[i] = Math.min(entry.min[i], point[i]);
      entry.max[i] = Math.max(entry.max[i], point[i]);
    }
    entries.set(id, entry);
  };

  for (const face of scene.faces) {
    for (const point of face.points || []) addPoint(face.lodDetailObjectId, point);
  }
  for (const line of scene.lines) {
    for (const point of line.points || []) addPoint(line.lodDetailObjectId, point);
  }

  scene.lodDetails = {};
  for (const [id, entry] of entries) {
    if (entry.min.some((value) => !Number.isFinite(value)) || entry.max.some((value) => !Number.isFinite(value))) continue;
    const center = v.mul(v.add(entry.min, entry.max), 0.5);
    const radius = Math.max(v.len(v.sub(entry.max, entry.min)) / 2, 1);
    scene.lodDetails[id] = { center, radius };
  }
}

function addBoundsPoint(boundsData, point) {
  if (!Array.isArray(point)) return;
  for (let i = 0; i < 3; i += 1) {
    boundsData.min[i] = Math.min(boundsData.min[i], point[i]);
    boundsData.max[i] = Math.max(boundsData.max[i], point[i]);
  }
}

function sceneBounds(scene) {
  const boundsData = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  for (const face of scene.faces) {
    for (const point of face.points || []) addBoundsPoint(boundsData, point);
  }
  for (const line of scene.lines) {
    for (const point of line.points || []) addBoundsPoint(boundsData, point);
  }
  for (const instance of scene.memberInstances || []) {
    addBoundsPoint(boundsData, instance.start);
    addBoundsPoint(boundsData, v.add(instance.start, v.mul(instance.axisX, instance.length)));
  }
  return bounds(boundsData);
}

function boundsPoints(boundsData) {
  const { min, max } = boundsData;
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]]
  ];
}

export function buildScene(project, profiles, fasteners, viewerSettings, options = {}) {
  settings = viewerSettings;
  setGeometrySettings(viewerSettings);
  const renderObjectIds = options.renderObjectIds ? new Set(options.renderObjectIds) : null;
  const shouldRenderId = (objectId) => !renderObjectIds || renderObjectIds.has(objectId);
  const members = renderCollectionObjects(project, "members", renderObjectIds);
  const sceneData = {
    faces: [],
    lines: [],
    vertices: [],
    memberInstances: [],
    memberInstanceGeometries: {},
    lodDetails: {},
    profiles: profiles.profiles,
    fasteners: fasteners.fasteners,
    project,
    activeConnectionId: options.activeConnectionId || null,
    activeConnectionObjectIds: activeConnectionObjectIds(project, options.activeConnectionId),
    generatedConnectionObjectIds: generatedConnectionObjectIds(project),
    lodDetailFilter: options.lodDetailFilter || null,
    renderObjectIds
  };

  for (const member of members) {
    if (member.display?.visible === false) continue;
    if (!shouldRenderId(member.id)) continue;
    const profile = profiles.profiles[member.profile];
    const hasDetails = memberFeatures(project, member, sceneData).length > 0;
    const instanced = profile && canInstanceMember(sceneData, member, profile) && addInstancedMember(sceneData, member, profile, { lodDetail: hasDetails });
    if (!instanced || (hasDetails && shouldBuildLodDetail(sceneData, member.id))) {
      addMember(sceneData, project, member, profile, { lodDetail: instanced && hasDetails });
    }
  }
  for (const previewMember of options.previewMembers || []) {
    addMember(sceneData, project, previewMember, profiles.profiles[previewMember.profile]);
  }

  for (const plate of renderCollectionObjects(project, "plates", renderObjectIds)) {
    if (!shouldRenderId(plate.id)) continue;
    if (!shouldRenderObject(sceneData, plate)) continue;
    if (!shouldBuildLodDetail(sceneData, plate.id)) continue;
    addPlate(sceneData, project, plate);
  }

  for (const feature of renderCollectionObjects(project, "features", renderObjectIds)) {
    if (!shouldRenderId(feature.id)) continue;
    if (!shouldRenderObject(sceneData, feature)) continue;
    if (!shouldBuildLodDetail(sceneData, feature.id)) continue;
    addCutBody(sceneData, project, profiles.profiles, feature);
  }
  addFastenerGroups(sceneData, project, renderCollectionObjects(project, "fastenerGroups", renderObjectIds));
  addWelds(sceneData, project, renderCollectionObjects(project, "welds", renderObjectIds));

  sceneData.bounds = sceneBounds(sceneData);
  sceneData.vertices = boundsPoints(sceneData.bounds);
  buildLodDetails(sceneData);
  addViewerAxes(sceneData);
  return sceneData;
}

function bounds(boundsData) {
  const min = boundsData.min.some((value) => !Number.isFinite(value)) ? [0, 0, 0] : boundsData.min;
  const max = boundsData.max.some((value) => !Number.isFinite(value)) ? [0, 0, 0] : boundsData.max;
  const size = v.sub(max, min);
  return { min, max, center: v.mul(v.add(min, max), 0.5), depthHalf: Math.max(1, v.len(size) / 2) };
}
