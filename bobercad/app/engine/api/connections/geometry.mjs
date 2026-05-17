import { v } from "../../core/math.mjs";
import {
  memberFrame,
  memberFrameAt,
  memberLength,
  sectionBounds,
  sectionWebBounds
} from "../../geometry/member-geometry.mjs";

const EPSILON = 1e-9;

function finitePositive(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function projectPointToPlane(point, planeOrigin, normal) {
  return v.sub(point, v.mul(normal, v.dot(v.sub(point, planeOrigin), normal)));
}

function linePlaneIntersection(point, direction, planeOrigin, normal) {
  const denominator = v.dot(direction, normal);
  if (Math.abs(denominator) <= EPSILON) return null;
  return v.add(point, v.mul(direction, v.dot(v.sub(planeOrigin, point), normal) / denominator));
}

function projectedAxis(axis, normal) {
  const projected = v.sub(axis, v.mul(normal, v.dot(axis, normal)));
  return v.len(projected) > EPSILON ? v.norm(projected) : null;
}

function cleanOutline(outline) {
  const clean = [];
  for (const point of outline || []) {
    if (!Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || !Number.isFinite(value))) continue;
    const previous = clean[clean.length - 1];
    if (!previous || Math.hypot(previous[0] - point[0], previous[1] - point[1]) > EPSILON) clean.push([...point]);
  }
  if (clean.length > 1) {
    const first = clean[0];
    const last = clean[clean.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= EPSILON) clean.pop();
  }
  return clean;
}

function rectangleOutline(width, height) {
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2]
  ];
}

function platePoint(point, plateCenter, localAxisY, localAxisZ) {
  return v.add(plateCenter, v.add(v.mul(localAxisY, point[0]), v.mul(localAxisZ, point[1])));
}

function keepSign({ keepPoint, keepSide, planeOrigin, planeNormal }) {
  if (keepPoint) {
    const distance = v.dot(v.sub(keepPoint, planeOrigin), planeNormal);
    return Math.abs(distance) <= EPSILON ? 1 : Math.sign(distance);
  }
  return keepSide === "negative" ? -1 : 1;
}

function clipPlateOutlineByPlane({ outline, plateCenter, localAxisY, localAxisZ, planeOrigin, planeNormal, keepSide = "positive", keepPoint = null }) {
  const source = cleanOutline(outline);
  if (source.length < 3) return [];
  const normal = v.norm(planeNormal);
  const sign = keepSign({ keepPoint, keepSide, planeOrigin, planeNormal: normal });
  const distance = (point) => sign * v.dot(v.sub(platePoint(point, plateCenter, localAxisY, localAxisZ), planeOrigin), normal);
  const intersection = (a, b, da, db) => {
    const t = Math.abs(da - db) <= EPSILON ? 0 : da / (da - db);
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t
    ];
  };

  const clipped = [];
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[(index + 1) % source.length];
    const currentDistance = distance(current);
    const nextDistance = distance(next);
    const currentInside = currentDistance >= -EPSILON;
    const nextInside = nextDistance >= -EPSILON;

    if (currentInside && nextInside) {
      clipped.push(next);
    } else if (currentInside && !nextInside) {
      clipped.push(intersection(current, next, currentDistance, nextDistance));
    } else if (!currentInside && nextInside) {
      clipped.push(intersection(current, next, currentDistance, nextDistance), next);
    }
  }
  return cleanOutline(clipped);
}

function outlineArea(outline) {
  const points = cleanOutline(outline);
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(point, outline) {
  const polygon = cleanOutline(outline);
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previousIndex];
    const intersects = (a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(point, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const lengthSq = ab[0] * ab[0] + ab[1] * ab[1];
  const t = lengthSq <= EPSILON ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * ab[0] + (point[1] - a[1]) * ab[1]) / lengthSq));
  const closest = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return Math.hypot(point[0] - closest[0], point[1] - closest[1]);
}

function circleFitsPolygon(point, radius, outline) {
  const polygon = cleanOutline(outline);
  if (polygon.length < 3 || !pointInPolygon(point, polygon)) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointSegmentDistance(point, polygon[index], polygon[(index + 1) % polygon.length]) < radius - EPSILON) return false;
  }
  return true;
}

function endPlateAxes(mainInterface, secondaryInterface) {
  const normal = v.norm(mainInterface.normal);
  const secondaryZ = projectedAxis(secondaryInterface.localAxisZ, normal);
  let localAxisZ = secondaryZ || projectedAxis(mainInterface.localAxisZ, normal);
  if (!localAxisZ) localAxisZ = projectedAxis([0, 0, 1], normal) || projectedAxis([0, 1, 0], normal);
  const secondaryY = projectedAxis(secondaryInterface.localAxisY, normal);
  let localAxisY = v.norm(v.cross(localAxisZ, normal));
  if (secondaryY && v.dot(localAxisY, secondaryY) < 0) localAxisY = v.mul(localAxisY, -1);
  localAxisZ = v.norm(v.cross(normal, localAxisY));
  return { localAxisY, localAxisZ };
}

function secondaryBeamDirection(member, beamInterface) {
  const frame = memberFrame(member);
  if (beamInterface.memberEnd === "start") return frame.x;
  if (beamInterface.memberEnd === "end") return v.mul(frame.x, -1);
  return v.mul(v.norm(beamInterface.normal), -1);
}

function webHeight(profile) {
  const bounds = sectionWebBounds(profile);
  return bounds.maxZ - bounds.minZ;
}

function webThickness(profile) {
  const bounds = sectionWebBounds(profile);
  return bounds.maxY - bounds.minY;
}

function plateAxes({ webNormal, beamDirection, defaultAxisZ, preferredAxisZ = null }) {
  if (!preferredAxisZ) return { localAxisY: beamDirection, localAxisZ: defaultAxisZ };
  const projectedZ = projectedAxis(preferredAxisZ, webNormal);
  if (!projectedZ) return { localAxisY: beamDirection, localAxisZ: defaultAxisZ };
  let localAxisZ = projectedZ;
  if (v.dot(localAxisZ, preferredAxisZ) < 0) localAxisZ = v.mul(localAxisZ, -1);
  let localAxisY = v.norm(v.cross(webNormal, localAxisZ));
  if (v.dot(localAxisY, beamDirection) < 0) localAxisY = v.mul(localAxisY, -1);
  return { localAxisY, localAxisZ };
}

function secondaryWebReference({ member, profile, supportInterface, beamInterface, plateLength, plateThickness, edgeOffset = 0, startReferencePoint = null }) {
  const frame = memberFrame(member);
  const beamDirection = secondaryBeamDirection(member, beamInterface);
  const webBounds = sectionWebBounds(profile);
  const explicitWebSide = beamInterface.faceRef === "web-center-plane" || beamInterface.type === "member-web";
  const side = explicitWebSide && v.dot(beamInterface.normal, frame.y) < 0 ? -1 : 1;
  const webNormal = v.mul(frame.y, side);
  const localAxisY = beamDirection;
  const localAxisZ = frame.z;
  const supportEdge = startReferencePoint || v.add(supportInterface.origin, v.mul(supportInterface.normal, edgeOffset));
  const startOnWebCenter = projectPointToPlane(supportEdge, beamInterface.origin, frame.y);
  const startOnWebFace = v.add(startOnWebCenter, v.mul(frame.y, side > 0 ? webBounds.maxY : webBounds.minY));
  const webFaceOrigin = v.add(startOnWebFace, v.mul(localAxisY, plateLength / 2));
  return {
    origin: v.add(webFaceOrigin, v.mul(webNormal, plateThickness / 2)),
    webFaceOrigin,
    normal: webNormal,
    localAxisY,
    localAxisZ,
    beamDirection,
    webThickness: webBounds.maxY - webBounds.minY,
    extents: {
      length: beamInterface.extents?.length || v.len(v.sub(member.end, member.start)),
      height: webHeight(profile),
      thickness: webBounds.maxY - webBounds.minY
    }
  };
}

export function createGeometryApi() {
  return {
    v,
    finitePositive,
    circleFitsPolygon,
    cleanOutline,
    clipPlateOutlineByPlane,
    outlineArea,
    platePoint,
    linePlaneIntersection,
    projectPointToPlane,
    projectedAxis,
    rectangleOutline,
    endPlateAxes,
    plateAxes,
    memberFrame,
    memberFrameAt,
    memberLength,
    sectionBounds,
    sectionWebBounds,
    secondaryBeamDirection,
    secondaryWebReference,
    webHeight,
    webThickness
  };
}
