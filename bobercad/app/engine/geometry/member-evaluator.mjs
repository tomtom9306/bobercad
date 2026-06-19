import { finiteNumber, projectPointToPlane, v } from "../core/math.mjs";
import { uniqueValues } from "../core/model.mjs";

const UP = [0, 0, 1];
const EPSILON = 1e-9;
const CONNECTION_FACING_FACE = "connection-secondary-facing-section-face";
const SECTION_FACE_REFS = new Set([
  "section.y-plus",
  "section.y-minus",
  "section.z-plus",
  "section.z-minus",
  "web.left",
  "web.right",
  "web-center-plane"
]);

function fail(message) {
  throw new Error(`member evaluator: ${message}`);
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requiredVec3(value, label) {
  if (!v.isVec3(value)) fail(`${label} must be a finite [x, y, z] point`);
  return value;
}

function requiredVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    fail(`${label} must be a finite [y, z] point`);
  }
  return value;
}

function optionalObject(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function optionalVec3(value, label) {
  if (value === undefined) return undefined;
  return requiredVec3(value, label);
}

function optionReferencePoint(options, label) {
  const point = options.referencePoint;
  if (point === undefined) return undefined;
  return requiredVec3(point, label);
}

function sectionSolidPoints(profile) {
  const points = [];
  for (const [contourIndex, source] of requiredArray(profile.section?.contours, `${profile.id}.section.contours`).entries()) {
    const contour = requiredObject(source, `${profile.id}.section.contours[${contourIndex}]`);
    if (contour.role !== "solid") continue;
    const contourId = contour.id || contour.role;
    for (const [pointIndex, point] of requiredArray(contour.points, `${profile.id}.${contourId}.points`).entries()) {
      points.push(requiredVec2(point, `${profile.id}.${contourId}.points[${pointIndex}]`));
    }
  }
  if (!points.length) fail(`${profile.id}: profile must contain solid contour points`);
  return points;
}

function scaleBounds(bounds, transform) {
  return {
    minY: bounds.minY * transform.scaleY,
    maxY: bounds.maxY * transform.scaleY,
    minZ: bounds.minZ * transform.scaleZ,
    maxZ: bounds.maxZ * transform.scaleZ
  };
}

function orderedBounds(bounds) {
  return {
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY),
    minZ: Math.min(bounds.minZ, bounds.maxZ),
    maxZ: Math.max(bounds.minZ, bounds.maxZ)
  };
}

function lineValue(spec, stationRatio, fallback, label) {
  if (spec === undefined) return fallback;
  if (finiteNumber(spec)) return spec;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) fail(`${label} must be a number or station value object`);
  if (spec.type && spec.type !== "linear" && spec.type !== "constant") fail(`${label}: unsupported value type ${spec.type}`);
  if (spec.type === "constant") {
    if (!finiteNumber(spec.value)) fail(`${label}.value must be a finite number`);
    return spec.value;
  }
  if (!finiteNumber(spec.start) || !finiteNumber(spec.end)) fail(`${label}.start/end must be finite numbers`);
  return spec.start + (spec.end - spec.start) * stationRatio;
}

function memberRotation(member) {
  if (!finiteNumber(member.rotation)) fail(`${member.id}: rotation must be a finite number`);
  return member.rotation;
}

function memberLine(member) {
  return {
    start: requiredVec3(member.start, `${member.id}.start`),
    end: requiredVec3(member.end, `${member.id}.end`)
  };
}

function checkedMemberStation(station, length, label) {
  if (!finiteNumber(station)) fail(`${label} must be a finite station`);
  if (station < -EPSILON || station > length + EPSILON) fail(`${label} must be between 0 and ${length}`);
  return Math.min(length, Math.max(0, station));
}

function baseFrameFromAxis(member, x) {
  if (v.len(x) <= EPSILON) fail(`${member.id}: zero-length member`);
  let y;
  let z;
  if (Math.abs(v.dot(x, UP)) > 0.95) {
    y = v.norm(v.sub([0, 1, 0], v.mul(x, v.dot([0, 1, 0], x))));
    z = v.norm(v.cross(x, y));
  } else {
    z = v.norm(v.sub(UP, v.mul(x, v.dot(UP, x))));
    y = v.norm(v.cross(z, x));
  }
  return { x, y, z };
}

function sectionTransformAt(member, station, length) {
  const ratio = length > EPSILON ? station / length : 0;
  const placement = member.sectionPlacement === undefined ? {} : member.sectionPlacement;
  if (!placement || typeof placement !== "object" || Array.isArray(placement)) fail(`${member.id}.sectionPlacement must be an object`);
  const shapeModifiers = member.shapeModifiers === undefined ? {} : member.shapeModifiers;
  if (!shapeModifiers || typeof shapeModifiers !== "object" || Array.isArray(shapeModifiers)) fail(`${member.id}.shapeModifiers must be an object`);
  const taper = shapeModifiers.taper === undefined ? {} : shapeModifiers.taper;
  if (!taper || typeof taper !== "object" || Array.isArray(taper)) fail(`${member.id}.shapeModifiers.taper must be an object`);
  const offset = optionalObject(placement.offset, `${member.id}.sectionPlacement.offset`);
  const roll = memberRotation(member) + lineValue(placement.roll, ratio, 0, `${member.id}.sectionPlacement.roll`);
  const scaleY = lineValue(taper.scaleY, ratio, 1, `${member.id}.shapeModifiers.taper.scaleY`);
  const scaleZ = lineValue(taper.scaleZ, ratio, 1, `${member.id}.shapeModifiers.taper.scaleZ`);
  if (Math.abs(scaleY) <= EPSILON || Math.abs(scaleZ) <= EPSILON) fail(`${member.id}: section scale cannot be zero`);
  return {
    roll,
    scaleY,
    scaleZ,
    offsetY: lineValue(offset.y, ratio, 0, `${member.id}.sectionPlacement.offset.y`),
    offsetZ: lineValue(offset.z, ratio, 0, `${member.id}.sectionPlacement.offset.z`)
  };
}

export function sectionBounds(profile) {
  const points = sectionSolidPoints(profile);
  return {
    minY: Math.min(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[0])),
    minZ: Math.min(...points.map((point) => point[1])),
    maxZ: Math.max(...points.map((point) => point[1]))
  };
}

function iSectionWebMetrics(profile) {
  if (profile.profileType !== "i-section") fail(`${profile.id}: web face references require an i-section profile`);
  const points = sectionSolidPoints(profile);
  const positiveY = uniqueValues(points.map((point) => Math.abs(point[0])).filter((value) => value > EPSILON)).sort((a, b) => a - b);
  if (positiveY.length < 2) fail(`${profile.id}: cannot resolve i-section web thickness from contour points`);
  const webHalfThickness = positiveY[0];
  const webPoints = points.filter((point) => Math.abs(point[0]) <= webHalfThickness + EPSILON);
  if (!webPoints.length) fail(`${profile.id}: cannot resolve i-section web points`);
  return {
    leftY: -webHalfThickness,
    rightY: webHalfThickness,
    minZ: Math.min(...webPoints.map((point) => point[1])),
    maxZ: Math.max(...webPoints.map((point) => point[1]))
  };
}

export function sectionWebBounds(profile) {
  if (profile.profileType === "i-section") {
    const web = iSectionWebMetrics(profile);
    return { minY: web.leftY, maxY: web.rightY, minZ: web.minZ, maxZ: web.maxZ };
  }
  const bounds = sectionBounds(profile);
  return { minY: bounds.minY, maxY: bounds.maxY, minZ: bounds.minZ, maxZ: bounds.maxZ };
}

function sectionBoundsAt(member, profile, station, length) {
  return orderedBounds(scaleBounds(sectionBounds(profile), sectionTransformAt(member, station, length)));
}

function sectionWebBoundsAt(member, profile, station, length) {
  return orderedBounds(scaleBounds(sectionWebBounds(profile), sectionTransformAt(member, station, length)));
}

export function memberLength(member) {
  const line = memberLine(member);
  return v.len(v.sub(line.end, line.start));
}

export function memberFrameAt(member, station = 0) {
  const line = memberLine(member);
  const axis = v.sub(line.end, line.start);
  const length = v.len(axis);
  if (length <= EPSILON) fail(`${member.id}: zero-length member`);
  const x = v.mul(axis, 1 / length);
  const base = baseFrameFromAxis(member, x);
  const transform = sectionTransformAt(member, station, length);
  const angle = transform.roll * Math.PI / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const y = v.add(v.mul(base.y, c), v.mul(base.z, s));
  const z = v.add(v.mul(base.z, c), v.mul(base.y, -s));
  const point = v.add(line.start, v.mul(x, station));
  return {
    x,
    y,
    z,
    origin: v.add(point, v.add(v.mul(y, transform.offsetY), v.mul(z, transform.offsetZ))),
    station,
    length,
    transform
  };
}

export function memberFrame(member) {
  const frame = memberFrameAt(member, 0);
  return { x: frame.x, y: frame.y, z: frame.z };
}

function canonicalFaceRef(faceRef, member) {
  if (faceRef === CONNECTION_FACING_FACE) return faceRef;
  if (SECTION_FACE_REFS.has(faceRef)) return faceRef;
  fail(`${member.id}: unsupported interface faceRef ${faceRef}`);
}

function secondaryFacingFace(iface, member, profile, frame, referencePoint) {
  if (!Array.isArray(referencePoint)) fail(`${iface.id}: ${CONNECTION_FACING_FACE} requires a connection reference point`);
  const direction = v.sub(referencePoint, frame.origin);
  const candidates = profile.profileType === "i-section"
    ? [
      ["web.right", frame.y],
      ["web.left", v.mul(frame.y, -1)],
      ["section.z-plus", frame.z],
      ["section.z-minus", v.mul(frame.z, -1)]
    ]
    : [
      ["section.y-plus", frame.y],
      ["section.y-minus", v.mul(frame.y, -1)],
      ["section.z-plus", frame.z],
      ["section.z-minus", v.mul(frame.z, -1)]
    ];
  const [face] = candidates.reduce((current, candidate) => {
    const score = v.dot(candidate[1], direction);
    return score > current[1] ? [candidate[0], score] : current;
  }, [null, -Infinity]);
  if (!face) fail(`${member.id}: cannot resolve secondary-facing face`);
  return face;
}

function stationForInterface(iface, member, options = {}) {
  const frame = memberFrameAt(member, 0);
  const referencePoint = optionReferencePoint(options, `${iface.id}: referencePoint`);
  if (iface.memberEnd === "start") return 0;
  if (iface.memberEnd === "end") return frame.length;
  if (iface.memberEnd !== undefined) fail(`${iface.id}: memberEnd must be start or end`);
  if (iface.stationReference === "connection-secondary-interface-origin") {
    if (!referencePoint) fail(`${iface.id}: stationReference requires a connection reference point`);
    return checkedMemberStation(v.dot(v.sub(referencePoint, memberLine(member).start), frame.x), frame.length, `${iface.id}.stationReference`);
  }
  if (iface.station !== undefined) return checkedMemberStation(iface.station, frame.length, `${iface.id}.station`);
  if (options.preferReferencePoint && referencePoint) {
    return checkedMemberStation(v.dot(v.sub(referencePoint, memberLine(member).start), frame.x), frame.length, `${iface.id}.referencePoint station`);
  }
  fail(`${iface.id}: member interface must define memberEnd or station`);
}

function faceAxes(normal, frame) {
  const candidates = [frame.x, v.mul(frame.x, -1), frame.y, v.mul(frame.y, -1), frame.z, v.mul(frame.z, -1)]
    .filter((axis) => Math.abs(v.dot(axis, normal)) < 0.95);
  let localAxisZ = candidates.reduce((best, axis) => Math.abs(v.dot(axis, UP)) > Math.abs(v.dot(best, UP)) ? axis : best, candidates[0]);
  if (v.dot(localAxisZ, UP) < 0) localAxisZ = v.mul(localAxisZ, -1);

  let localAxisY = v.norm(v.cross(localAxisZ, normal));
  const preferred = candidates
    .filter((axis) => Math.abs(v.dot(axis, localAxisZ)) < 0.95)
    .reduce((best, axis) => Math.abs(v.dot(axis, localAxisY)) > Math.abs(v.dot(best, localAxisY)) ? axis : best, candidates[0]);
  if (v.dot(localAxisY, preferred) < 0) localAxisY = v.mul(localAxisY, -1);
  return { localAxisY, localAxisZ };
}

function sizeAlong(axis, dimensions) {
  const item = dimensions.reduce((best, candidate) => Math.abs(v.dot(axis, candidate.axis)) > Math.abs(v.dot(axis, best.axis)) ? candidate : best, dimensions[0]);
  return item.size;
}

function explicitPositiveExtent(iface, key) {
  const extents = iface.extents === undefined ? undefined : optionalObject(iface.extents, `${iface.id}.extents`);
  const value = extents?.[key];
  if (value === undefined) return undefined;
  if (!finiteNumber(value) || value <= EPSILON) fail(`${iface.id}.extents.${key} must be positive`);
  return value;
}

function sideFaceExtents(face, frame, bounds, web) {
  const ySize = bounds.maxY - bounds.minY;
  const zSize = bounds.maxZ - bounds.minZ;
  const webZSize = web.maxZ - web.minZ;
  const dimensions = face.startsWith("web.")
    ? [{ axis: frame.x, size: frame.length }, { axis: frame.z, size: webZSize }]
    : face.startsWith("section.y")
      ? [{ axis: frame.x, size: frame.length }, { axis: frame.z, size: zSize }]
      : [{ axis: frame.x, size: frame.length }, { axis: frame.y, size: ySize }];
  const axes = faceAxes(faceNormal(face, frame), frame);
  return {
    axes,
    extents: {
      width: sizeAlong(axes.localAxisY, dimensions),
      height: sizeAlong(axes.localAxisZ, dimensions),
      length: frame.length
    }
  };
}

function faceNormal(face, frame) {
  if (face === "section.y-plus" || face === "web.right") return frame.y;
  if (face === "section.y-minus" || face === "web.left") return v.mul(frame.y, -1);
  if (face === "section.z-plus") return frame.z;
  if (face === "section.z-minus") return v.mul(frame.z, -1);
  fail(`${face}: unsupported section face`);
}

function faceOrigin(face, frame, bounds, web) {
  if (face === "section.y-plus") return v.add(frame.origin, v.mul(frame.y, bounds.maxY));
  if (face === "section.y-minus") return v.add(frame.origin, v.mul(frame.y, bounds.minY));
  if (face === "web.right") return v.add(frame.origin, v.mul(frame.y, web.maxY));
  if (face === "web.left") return v.add(frame.origin, v.mul(frame.y, web.minY));
  if (face === "section.z-plus") return v.add(frame.origin, v.mul(frame.z, bounds.maxZ));
  if (face === "section.z-minus") return v.add(frame.origin, v.mul(frame.z, bounds.minZ));
  fail(`${face}: unsupported section face`);
}

export function resolveMemberFaceRef(iface, member, profile, options = {}) {
  const station = stationForInterface(iface, member, options);
  const frame = memberFrameAt(member, station);
  const canonical = canonicalFaceRef(iface.faceRef, member);
  return canonical === CONNECTION_FACING_FACE
    ? secondaryFacingFace(iface, member, profile, frame, options.referencePoint)
    : canonical;
}

function resolveSectionFace(iface, member, profile, options = {}) {
  const station = stationForInterface(iface, member, options);
  const frame = memberFrameAt(member, station);
  const bounds = sectionBoundsAt(member, profile, station, frame.length);
  const web = sectionWebBoundsAt(member, profile, station, frame.length);
  const face = resolveMemberFaceRef(iface, member, profile, options);
  const normal = faceNormal(face, frame);
  const referencePoint = optionReferencePoint(options, `${iface.id}: referencePoint`);
  const ifaceOrigin = optionalVec3(iface.origin, `${iface.id}.origin`);
  let origin = faceOrigin(face, frame, bounds, web);
  if ((iface.stationReference === "connection-secondary-interface-origin" || options.preferReferencePoint) && referencePoint) {
    origin = projectPointToPlane(referencePoint, origin, normal);
  } else if (ifaceOrigin) {
    origin = projectPointToPlane(ifaceOrigin, origin, normal);
  }
  const { axes, extents } = sideFaceExtents(face, frame, bounds, web);
  return {
    ...iface,
    faceRef: face,
    origin,
    normal,
    localAxisY: axes.localAxisY,
    localAxisZ: axes.localAxisZ,
    extents
  };
}

function resolveMemberEndInterface(iface, member, profile) {
  const station = stationForInterface(iface, member);
  const frame = memberFrameAt(member, station);
  const bounds = sectionBoundsAt(member, profile, station, frame.length);
  const end = iface.memberEnd;
  if (end !== "start" && end !== "end") fail(`${iface.id}: member-end interface must set memberEnd`);
  const length = explicitPositiveExtent(iface, "length");
  return {
    ...iface,
    origin: frame.origin,
    normal: end === "start" ? v.mul(frame.x, -1) : frame.x,
    localAxisY: frame.y,
    localAxisZ: frame.z,
    extents: {
      ...(length === undefined ? {} : { length }),
      width: bounds.maxY - bounds.minY,
      height: bounds.maxZ - bounds.minZ
    }
  };
}

function resolveMemberWebInterface(iface, member, profile, options = {}) {
  const station = stationForInterface(iface, member, options);
  const frame = memberFrameAt(member, station);
  const web = sectionWebBoundsAt(member, profile, station, frame.length);
  const normal = frame.y;
  const referencePoint = optionReferencePoint(options, `${iface.id}: referencePoint`);
  const ifaceOrigin = optionalVec3(iface.origin, `${iface.id}.origin`);
  let origin = frame.origin;
  if ((iface.stationReference === "connection-secondary-interface-origin" || options.preferReferencePoint) && referencePoint) {
    origin = projectPointToPlane(referencePoint, origin, normal);
  } else if (ifaceOrigin && !iface.memberEnd) {
    origin = projectPointToPlane(ifaceOrigin, origin, normal);
  }
  return {
    ...iface,
    faceRef: "web-center-plane",
    origin,
    normal,
    localAxisY: frame.x,
    localAxisZ: frame.z,
    extents: {
      length: frame.length,
      height: web.maxZ - web.minZ
    }
  };
}

export function evaluateMemberInterface(iface, member, profile, options = {}) {
  if (iface.type === "member-end-face") return resolveMemberEndInterface(iface, member, profile);
  if (iface.type === "member-web") {
    if (iface.faceRef !== "web-center-plane") fail(`${iface.id}: member-web interface must use web-center-plane`);
    return resolveMemberWebInterface(iface, member, profile, options);
  }
  if (iface.type === "planar-face") {
    if (!iface.faceRef) fail(`${iface.id}: planar-face interface must define faceRef`);
    return resolveSectionFace(iface, member, profile, options);
  }
  fail(`${iface.id}: unsupported member interface type ${iface.type || "missing"}`);
}
