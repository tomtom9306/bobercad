import { objectById } from "../core/model.mjs";
import { finiteNonNegativeNumber, finiteNumber, v } from "../core/math.mjs";
import { libraryProfileById } from "../api/project/profiles.mjs";
import { memberFrame, memberFrameAt, memberLength, resolveInterfaceWithConnectionReference, sectionBounds, sectionWebBounds } from "./member-geometry.mjs";
import { ccwPoints } from "./csg.mjs";

const EPSILON = 1e-9;
const NON_CUT_FEATURE_TYPES = new Set(["hole-pattern", "saw-cut", "miter-cut", "cope", "slot-hole"]);

function fail(message) {
  throw new Error(`cut feature: ${message}`);
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function profileForMember(profiles, member) {
  const profile = libraryProfileById(profiles, member.profile);
  if (!profile) fail(`${member.id}: profile not found ${member.profile}`);
  return profile;
}

function stationInMemberRange(station, length, label) {
  if (!finiteNumber(station)) fail(`${label} must be a finite number`);
  if (station < -EPSILON || station > length + EPSILON) fail(`${label} must be within the source member length`);
  return Math.min(Math.max(station, 0), length);
}

function clearanceIntent(feature) {
  return feature?.type === "clearance-cut" ? feature : null;
}

function profileCutIntent(feature) {
  if (feature?.source?.kind !== "member-profile") return null;
  if (feature.type !== "boolean-part") fail(`${feature.id || "feature"}: member-profile source is only supported for boolean-part features`);
  return feature;
}

function solidProfileOutlines(profile, featureId) {
  const outlines = requiredArray(profile.section?.contours, `${profile.id}.section.contours`)
    .filter((contour) => contour.role === "solid")
    .map((contour) => requiredArray(contour.points, `${profile.id}.${contour.id || contour.role}.points`));
  if (!outlines.length) fail(`${featureId}: source profile must contain at least one solid contour`);
  return outlines;
}

function cross2(left, right) {
  return left[0] * right[1] - left[1] * right[0];
}

function sub2(left, right) {
  return [left[0] - right[0], left[1] - right[1]];
}

function add2(left, right) {
  return [left[0] + right[0], left[1] + right[1]];
}

function mul2(point, scalar) {
  return [point[0] * scalar, point[1] * scalar];
}

function norm2(point) {
  const length = Math.hypot(point[0], point[1]);
  return length > EPSILON ? [point[0] / length, point[1] / length] : null;
}

function lineIntersection2d(point, direction, nextPoint, nextDirection) {
  const denominator = cross2(direction, nextDirection);
  if (Math.abs(denominator) <= EPSILON) return null;
  const t = cross2(sub2(nextPoint, point), nextDirection) / denominator;
  return add2(point, mul2(direction, t));
}

function profileOffsetDistance(outward, offsets) {
  const lateralOffsets = [offsets.yMinus, offsets.yPlus, offsets.zMinus, offsets.zPlus];
  const min = Math.min(...lateralOffsets);
  const max = Math.max(...lateralOffsets);
  if (max <= EPSILON) return 0;
  if (max - min <= EPSILON) return max;
  return Math.max(0, outward[0]) * offsets.yPlus
    + Math.max(0, -outward[0]) * offsets.yMinus
    + Math.max(0, outward[1]) * offsets.zPlus
    + Math.max(0, -outward[1]) * offsets.zMinus;
}

function offsetProfileOutline(outline, offsets) {
  const points = ccwPoints(outline);
  const maxOffset = Math.max(offsets.yMinus, offsets.yPlus, offsets.zMinus, offsets.zPlus);
  if (maxOffset <= EPSILON) return points;

  const edges = [];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const direction = norm2(sub2(end, start));
    if (!direction) continue;
    const outward = [direction[1], -direction[0]];
    const distance = profileOffsetDistance(outward, offsets);
    edges.push({
      start: add2(start, mul2(outward, distance)),
      direction,
      distance
    });
  }
  if (edges.length < 3) fail("profile offset requires at least three usable edges");

  const result = [];
  const maxMiter = Math.max(maxOffset * 8, 1);
  for (let index = 0; index < edges.length; index += 1) {
    const previous = edges[(index + edges.length - 1) % edges.length];
    const current = edges[index];
    const vertex = points[index];
    const fallback = add2(vertex, mul2(add2(
      mul2([previous.direction[1], -previous.direction[0]], previous.distance),
      mul2([current.direction[1], -current.direction[0]], current.distance)
    ), 0.5));
    const intersection = lineIntersection2d(previous.start, previous.direction, current.start, current.direction);
    const point = intersection && Math.hypot(intersection[0] - fallback[0], intersection[1] - fallback[1]) <= maxMiter
      ? intersection
      : fallback;
    result.push(point);
  }
  return ccwPoints(result);
}

function cutStation(project, profiles, intent, sourceMember, sourceFrame) {
  const label = intent.id || intent.type || "cut";
  const source = requiredObject(intent.source, `${label}.source`);
  const station = source.station;
  if (station !== undefined) {
    return stationInMemberRange(station, memberLength(sourceMember), `${label}.source.station`);
  }
  const interfaceId = source.interfaceId;
  if (interfaceId !== undefined) {
    if (typeof interfaceId !== "string" || !interfaceId) fail(`${label}.source.interfaceId must be a non-empty string`);
    const iface = resolveInterfaceWithConnectionReference(project, profiles, interfaceId);
    return stationInMemberRange(v.dot(v.sub(iface.origin, sourceMember.start), sourceFrame.x), memberLength(sourceMember), `${label}.source.interfaceId station`);
  }
  fail(`${label}.source must define station or interfaceId`);
}

function cutOffset(intent, offsets, key, required) {
  const value = offsets[key];
  if (value === undefined) {
    if (required) fail(`${intent.id || intent.type || "cut"}.offsets.${key} is required`);
    return 0;
  }
  if (!finiteNonNegativeNumber(value)) fail(`${intent.id || intent.type || "cut"}.offsets.${key} must be zero or positive`);
  return value;
}

function cutOffsets(intent, required = false) {
  const offsets = intent.offsets === undefined ? {} : intent.offsets;
  if (required && intent.offsets === undefined) fail(`${intent.id || intent.type || "cut"}.offsets is required`);
  if (!offsets || typeof offsets !== "object" || Array.isArray(offsets)) fail(`${intent.id || intent.type || "cut"}.offsets must be an object`);
  return {
    xMinus: cutOffset(intent, offsets, "xMinus", required),
    xPlus: cutOffset(intent, offsets, "xPlus", required),
    yMinus: cutOffset(intent, offsets, "yMinus", required),
    yPlus: cutOffset(intent, offsets, "yPlus", required),
    zMinus: cutOffset(intent, offsets, "zMinus", required),
    zPlus: cutOffset(intent, offsets, "zPlus", required)
  };
}

function clearanceTargetEnd(intent) {
  const end = requiredObject(intent.target, `${intent.id || "clearance-cut"}.target`).end;
  if (end === "start" || end === "end") return end;
  fail(`${intent.id || "clearance-cut"}.target.end must be start or end`);
}

function clearanceTargetMemberId(intent) {
  return requiredString(requiredObject(intent.target, `${intent.id || "clearance-cut"}.target`).memberId, `${intent.id || "clearance-cut"}.target.memberId`);
}

function regionZRange(intent, sourceBounds, sourceWeb) {
  const source = requiredObject(intent.source, `${intent.id || "clearance-cut"}.source`);
  if (source.region === "top-flange") {
    return { min: sourceWeb.maxZ, max: sourceBounds.maxZ };
  }
  if (source.region === "bottom-flange") {
    return { min: sourceBounds.minZ, max: sourceWeb.minZ };
  }
  fail(`${intent.id || "clearance-cut"}: unsupported source region ${source.region || "missing"}`);
}

function pointAt(basis, x, y, z) {
  return v.add(basis.origin, v.add(v.mul(basis.x, x), v.add(v.mul(basis.y, y), v.mul(basis.z, z))));
}

function memberProfileCutGeometry(project, profiles, feature) {
  const intent = profileCutIntent(feature);
  if (!intent) return null;
  const sourceMember = objectById(project, requiredString(requiredObject(intent.source, `${feature.id}.source`).memberId, `${feature.id}.source.memberId`));
  const sourceProfile = profileForMember(profiles, sourceMember);
  const length = memberLength(sourceMember);
  const sourceFrame = memberFrameAt(sourceMember, 0);
  const offsets = cutOffsets(intent, true);
  const depth = length + offsets.xMinus + offsets.xPlus;
  if (depth <= EPSILON) fail(`${feature.id}: member-profile cut depth must be positive`);
  const center = v.add(sourceFrame.origin, v.mul(sourceFrame.x, (length + offsets.xPlus - offsets.xMinus) / 2));
  const bodies = solidProfileOutlines(sourceProfile, feature.id).map((outline) => ({
    type: "polygonal-prism",
    center,
    axisX: sourceFrame.x,
    axisY: sourceFrame.y,
    axisZ: sourceFrame.z,
    depth,
    outline: offsetProfileOutline(outline, offsets)
  }));
  return { bodies, offsets };
}

export function clearanceCutGeometry(project, profiles, feature) {
  const intent = clearanceIntent(feature);
  if (!intent) return null;
  if (intent.kind !== "support-flange-notch") fail(`${feature.id}: unsupported clearance cut kind ${intent.kind || "missing"}`);

  const sourceMember = objectById(project, requiredString(requiredObject(intent.source, `${feature.id}.source`).memberId, `${feature.id}.source.memberId`));
  const targetMember = objectById(project, clearanceTargetMemberId(intent));
  const sourceProfile = profileForMember(profiles, sourceMember);
  const targetProfile = profileForMember(profiles, targetMember);
  const sourceFrame = memberFrame(sourceMember);
  const station = cutStation(project, profiles, intent, sourceMember, sourceFrame);
  const sourceAt = memberFrameAt(sourceMember, station);
  const targetEnd = clearanceTargetEnd(intent);
  const targetAt = memberFrameAt(targetMember, targetEnd === "end" ? memberLength(targetMember) : 0);
  const targetDirection = targetEnd === "end" ? v.mul(targetAt.x, -1) : targetAt.x;
  const sourceBounds = sectionBounds(sourceProfile);
  const sourceWeb = sectionWebBounds(sourceProfile);
  const targetBounds = sectionBounds(targetProfile);
  const region = regionZRange(intent, sourceBounds, sourceWeb);
  const offsets = cutOffsets(intent, true);

  const baseYMin = sourceBounds.minY;
  const baseYMax = sourceBounds.maxY;
  const baseFlangeWidth = baseYMax - baseYMin;
  const targetWidth = targetBounds.maxY - targetBounds.minY;
  const projectedTargetWidth = Math.abs(v.dot(targetAt.y, sourceAt.x)) * targetWidth;
  const projectedFlangeSweep = Math.abs(v.dot(targetDirection, sourceAt.x)) * baseFlangeWidth;
  const baseXSpan = Math.max(projectedTargetWidth + projectedFlangeSweep, targetWidth, EPSILON);

  const baseRanges = {
    xMin: -baseXSpan / 2,
    xMax: baseXSpan / 2,
    yMin: baseYMin,
    yMax: baseYMax,
    zMin: region.min,
    zMax: region.max
  };
  const ranges = {
    xMin: baseRanges.xMin - offsets.xMinus,
    xMax: baseRanges.xMax + offsets.xPlus,
    yMin: baseRanges.yMin - offsets.yMinus,
    yMax: baseRanges.yMax + offsets.yPlus,
    zMin: baseRanges.zMin - offsets.zMinus,
    zMax: baseRanges.zMax + offsets.zPlus
  };
  const size = [
    ranges.xMax - ranges.xMin,
    ranges.yMax - ranges.yMin,
    ranges.zMax - ranges.zMin
  ];
  if (size.some((value) => !finiteNumber(value) || value <= EPSILON)) fail(`${feature.id}: invalid clearance cut size`);

  const basis = {
    origin: sourceAt.origin,
    x: sourceAt.x,
    y: sourceAt.y,
    z: sourceAt.z
  };
  return {
    basis,
    baseRanges,
    ranges,
    offsets,
    pointAt: (x, y, z) => pointAt(basis, x, y, z),
    body: {
      type: "box",
      center: pointAt(
        basis,
        (ranges.xMin + ranges.xMax) / 2,
        (ranges.yMin + ranges.yMax) / 2,
        (ranges.zMin + ranges.zMax) / 2
      ),
      axisX: basis.x,
      axisY: basis.y,
      axisZ: basis.z,
      size
    }
  };
}

export function cutBodiesForFeature(project, profiles, feature) {
  requiredObject(feature, "feature");
  if (feature.body !== undefined) {
    if (feature.type !== "boolean-part") fail(`${feature.id || "feature"}: body is only supported for boolean-part features`);
    return [requiredObject(feature.body, `${feature.id || "feature"}.body`)];
  }
  const memberProfileCut = memberProfileCutGeometry(project, profiles, feature);
  if (memberProfileCut) return memberProfileCut.bodies;
  const clearanceCut = clearanceCutGeometry(project, profiles, feature);
  if (clearanceCut) return [clearanceCut.body];
  if (NON_CUT_FEATURE_TYPES.has(feature.type)) return [];
  fail(`${feature.id || "feature"}: unsupported feature cut type ${feature.type || "missing"}`);
}
