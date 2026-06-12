import { arrayValues, objectById } from "../core/model.mjs?v=geometry-api-array-values-dry-1";
import { clamp, finiteNonNegativeNumberOr, finiteNumber, v } from "../core/math.mjs?v=cut-feature-number-or-dry-1";
import { libraryProfileById } from "../api/project/profiles.mjs?v=profile-lookup-dry-1";
import { memberFrame, memberFrameAt, memberLength, resolveInterfaceWithConnectionReference, sectionBounds, sectionWebBounds } from "./member-geometry.mjs?v=geometry-api-array-values-dry-1";

const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`cut feature: ${message}`);
}

function profileForMember(profiles, member) {
  const profile = libraryProfileById(profiles, member.profile);
  if (!profile) fail(`${member.id}: profile not found ${member.profile}`);
  return profile;
}

function clearanceIntent(feature) {
  if (feature?.type === "clearance-cut") return feature;
  if (feature?.cut?.type === "clearance-cut") {
    return {
      ...feature.cut,
      id: feature.id,
      ownerId: feature.ownerId,
      operationEnabled: feature.operationEnabled
    };
  }
  return null;
}

function profileCutIntent(feature) {
  const source = feature?.source || feature?.cut?.source;
  if (source?.kind === "member-profile") return { ...feature, source };
  return null;
}

function solidProfileOutlines(profile, featureId) {
  const outlines = arrayValues(profile.section?.contours)
    .filter((contour) => contour.role === "solid")
    .map((contour) => contour.points);
  if (!outlines.length) fail(`${featureId}: source profile must contain at least one solid contour`);
  return outlines;
}

function cutStation(project, profiles, intent, sourceMember, sourceFrame) {
  if (finiteNumber(intent.source?.station)) {
    return clamp(intent.source.station, 0, memberLength(sourceMember));
  }
  if (intent.source?.interfaceId) {
    const iface = resolveInterfaceWithConnectionReference(project, profiles, intent.source.interfaceId);
    return clamp(v.dot(v.sub(iface.origin, sourceMember.start), sourceFrame.x), 0, memberLength(sourceMember));
  }
  return 0;
}

function cutOffsets(intent) {
  const offsets = intent.offsets || {};
  return {
    xMinus: finiteNonNegativeNumberOr(offsets.xMinus, 0),
    xPlus: finiteNonNegativeNumberOr(offsets.xPlus, 0),
    yMinus: finiteNonNegativeNumberOr(offsets.yMinus, 0),
    yPlus: finiteNonNegativeNumberOr(offsets.yPlus, 0),
    zMinus: finiteNonNegativeNumberOr(offsets.zMinus, 0),
    zPlus: finiteNonNegativeNumberOr(offsets.zPlus, 0)
  };
}

function regionZRange(intent, sourceBounds, sourceWeb) {
  if (intent.source?.region === "top-flange") {
    return { min: sourceWeb.maxZ, max: sourceBounds.maxZ };
  }
  if (intent.source?.region === "bottom-flange") {
    return { min: sourceBounds.minZ, max: sourceWeb.minZ };
  }
  fail(`${intent.id || "clearance-cut"}: unsupported source region ${intent.source?.region || "missing"}`);
}

function pointAt(basis, x, y, z) {
  return v.add(basis.origin, v.add(v.mul(basis.x, x), v.add(v.mul(basis.y, y), v.mul(basis.z, z))));
}

function memberProfileCutGeometry(project, profiles, feature) {
  const intent = profileCutIntent(feature);
  if (!intent) return null;
  if (!intent.source?.memberId) fail(`${feature.id}: member-profile cut missing source.memberId`);
  const sourceMember = objectById(project, intent.source.memberId);
  const sourceProfile = profileForMember(profiles, sourceMember);
  const length = memberLength(sourceMember);
  const sourceFrame = memberFrameAt(sourceMember, 0);
  const offsets = cutOffsets(intent);
  if ([offsets.yMinus, offsets.yPlus, offsets.zMinus, offsets.zPlus].some((offset) => offset > EPSILON)) {
    fail(`${feature.id}: member-profile cut supports source-axis extension only; profile offsetting is not implemented`);
  }
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
    outline
  }));
  return { bodies, offsets };
}

export function clearanceCutGeometry(project, profiles, feature) {
  const intent = clearanceIntent(feature);
  if (!intent) return null;
  if (intent.kind !== "support-flange-notch") fail(`${feature.id}: unsupported clearance cut kind ${intent.kind || "missing"}`);
  if (!intent.source?.memberId) fail(`${feature.id}: clearance cut missing source.memberId`);

  const sourceMember = objectById(project, intent.source.memberId);
  const targetMember = objectById(project, intent.target?.memberId || intent.ownerId || feature.ownerId);
  const sourceProfile = profileForMember(profiles, sourceMember);
  const targetProfile = profileForMember(profiles, targetMember);
  const sourceFrame = memberFrame(sourceMember);
  const station = cutStation(project, profiles, intent, sourceMember, sourceFrame);
  const sourceAt = memberFrameAt(sourceMember, station);
  const targetEnd = intent.target?.end === "start" ? "start" : "end";
  const targetAt = memberFrameAt(targetMember, targetEnd === "end" ? memberLength(targetMember) : 0);
  const targetDirection = targetEnd === "end" ? v.mul(targetAt.x, -1) : targetAt.x;
  const sourceBounds = sectionBounds(sourceProfile);
  const sourceWeb = sectionWebBounds(sourceProfile);
  const targetBounds = sectionBounds(targetProfile);
  const region = regionZRange(intent, sourceBounds, sourceWeb);
  const offsets = cutOffsets(intent);

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
  if (feature?.body) return [feature.body];
  const memberProfileCut = memberProfileCutGeometry(project, profiles, feature);
  if (memberProfileCut) return memberProfileCut.bodies;
  const clearanceCut = clearanceCutGeometry(project, profiles, feature);
  return clearanceCut ? [clearanceCut.body] : [];
}
