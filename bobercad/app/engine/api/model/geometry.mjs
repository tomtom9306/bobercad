import { cleanVec2Loop, clamp, distancePointToSegment2, finiteNumber, linePlaneIntersection, projectedAxis, projectPointToPlane, v } from "../../core/math.mjs";
import { signedArea2d } from "../../geometry/polygon.mjs";
import { plateOutline as sketchPlateOutline, rectangleOutline as sketchRectangleOutline } from "../project/plate-sketch-relations-and-bends.mjs";
import { memberStationAtPoint } from "../project/members.mjs";
import {
  memberFrame,
  memberFrameAt,
  memberLength,
  sectionBounds,
  sectionWebBounds
} from "../../geometry/member-geometry.mjs";

const EPSILON = 1e-9;

const cleanOutline = (outline) => cleanVec2Loop(outline, { tolerance: EPSILON, label: "plate outline point" });

function requiredVec3(value, label) {
  if (!v.isVec3(value)) throw new Error(`${label} must be a finite [x, y, z] vector`);
  return value;
}

function requiredNonZeroVec3(value, label) {
  const vector = requiredVec3(value, label);
  if (v.len(vector) <= EPSILON) throw new Error(`${label} cannot be zero length`);
  return vector;
}

function requiredDirection(value, label) {
  const vector = requiredNonZeroVec3(value, label);
  return v.mul(vector, 1 / v.len(vector));
}

function optionalVec3(value, label) {
  if (value === undefined || value === null) return null;
  return requiredVec3(value, label);
}

function requiredVec2(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((item) => !finiteNumber(item))) {
    throw new Error(`${label} must be a finite [y, z] point`);
  }
  return value;
}

function platePoint(point, plateCenter, localAxisY, localAxisZ) {
  const localPoint = requiredVec2(point, "platePoint point");
  return v.add(plateCenter, v.add(v.mul(localAxisY, localPoint[0]), v.mul(localAxisZ, localPoint[1])));
}

function keepSign({ keepPoint, keepSide, planeOrigin, planeNormal }) {
  const point = optionalVec3(keepPoint, "clipPlateOutlineByPlane keepPoint");
  if (point) {
    const distance = v.dot(v.sub(point, planeOrigin), planeNormal);
    return Math.abs(distance) <= EPSILON ? 1 : Math.sign(distance);
  }
  if (keepSide !== "positive" && keepSide !== "negative") throw new Error("clipPlateOutlineByPlane keepSide must be positive or negative");
  return keepSide === "negative" ? -1 : 1;
}

function clipPlateOutlineByPlane({ outline, plateCenter, localAxisY, localAxisZ, planeOrigin, planeNormal, keepSide = "positive", keepPoint = null }) {
  const source = cleanOutline(outline);
  if (source.length < 3) throw new Error("clipPlateOutlineByPlane outline requires at least three points");
  const center = requiredVec3(plateCenter, "clipPlateOutlineByPlane plateCenter");
  const axisY = requiredNonZeroVec3(localAxisY, "clipPlateOutlineByPlane localAxisY");
  const axisZ = requiredNonZeroVec3(localAxisZ, "clipPlateOutlineByPlane localAxisZ");
  const origin = requiredVec3(planeOrigin, "clipPlateOutlineByPlane planeOrigin");
  const normal = requiredDirection(planeNormal, "clipPlateOutlineByPlane planeNormal");
  const sign = keepSign({ keepPoint, keepSide, planeOrigin: origin, planeNormal: normal });
  const distance = (point) => sign * v.dot(v.sub(platePoint(point, center, axisY, axisZ), origin), normal);
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
  return Math.abs(signedArea2d(points));
}

function pointInPolygon(point, outline) {
  const queryPoint = requiredVec2(point, "pointInPolygon point");
  const polygon = cleanOutline(outline);
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previousIndex];
    const intersects = (a[1] > queryPoint[1]) !== (b[1] > queryPoint[1])
      && queryPoint[0] < (b[0] - a[0]) * (queryPoint[1] - a[1]) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function circleFitsPolygon(point, radius, outline) {
  const center = requiredVec2(point, "circleFitsPolygon point");
  if (!finiteNumber(radius) || radius < 0) throw new Error("circleFitsPolygon radius must be a non-negative number");
  const polygon = cleanOutline(outline);
  if (polygon.length < 3 || !pointInPolygon(center, polygon)) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    if (distancePointToSegment2(center, polygon[index], polygon[(index + 1) % polygon.length]) < radius - EPSILON) return false;
  }
  return true;
}

function endPlateAxes(mainInterface) {
  const normal = requiredDirection(mainInterface.normal, `${mainInterface.id || "interface"} normal`);
  const mainZ = projectedAxis(mainInterface.localAxisZ, normal);
  let localAxisZ = mainZ;
  if (!localAxisZ) throw new Error(`${mainInterface.id || "interface"}: localAxisZ is parallel to interface normal`);
  const mainY = projectedAxis(mainInterface.localAxisY, normal);
  let localAxisY = v.norm(v.cross(localAxisZ, normal));
  if (mainY && v.dot(localAxisY, mainY) < 0) localAxisY = v.mul(localAxisY, -1);
  localAxisZ = v.norm(v.cross(normal, localAxisY));
  return { localAxisY, localAxisZ };
}

function secondaryBeamDirection(member, beamInterface) {
  const frame = memberFrame(member);
  if (beamInterface.memberEnd === "start") return frame.x;
  if (beamInterface.memberEnd === "end") return v.mul(frame.x, -1);
  throw new Error(`${beamInterface.id || "interface"} memberEnd must be start or end`);
}

function webHeight(profile) {
  const bounds = sectionWebBounds(profile);
  return bounds.maxZ - bounds.minZ;
}

function webThickness(profile) {
  const bounds = sectionWebBounds(profile);
  return bounds.maxY - bounds.minY;
}

function plateAxes({ webNormal, beamDirection, defaultAxisZ, preferredAxisZ }) {
  const normal = requiredDirection(webNormal, "plateAxes webNormal");
  const beamAxis = requiredNonZeroVec3(beamDirection, "plateAxes beamDirection");
  const fallbackZ = requiredNonZeroVec3(defaultAxisZ, "plateAxes defaultAxisZ");
  if (preferredAxisZ === undefined) return { localAxisY: beamAxis, localAxisZ: fallbackZ };
  if (!v.isVec3(preferredAxisZ)) throw new Error("plateAxes preferredAxisZ must be a finite vec3");
  const projectedZ = projectedAxis(preferredAxisZ, normal);
  if (!projectedZ) throw new Error("plateAxes preferredAxisZ is parallel to the web normal");
  let localAxisZ = projectedZ;
  if (v.dot(localAxisZ, preferredAxisZ) < 0) localAxisZ = v.mul(localAxisZ, -1);
  let localAxisY = v.norm(v.cross(normal, localAxisZ));
  if (v.dot(localAxisY, beamAxis) < 0) localAxisY = v.mul(localAxisY, -1);
  return { localAxisY, localAxisZ };
}

function secondaryWebReference({ member, profile, supportInterface, beamInterface, plateLength, plateThickness, edgeOffset, startReferencePoint }) {
  if (!finiteNumber(plateLength) || plateLength <= EPSILON) throw new Error("secondaryWebReference plateLength must be positive");
  if (!finiteNumber(plateThickness) || plateThickness <= EPSILON) throw new Error("secondaryWebReference plateThickness must be positive");
  if (startReferencePoint === undefined && !finiteNumber(edgeOffset)) throw new Error("secondaryWebReference edgeOffset must be a finite number");
  const frame = memberFrame(member);
  const beamDirection = secondaryBeamDirection(member, beamInterface);
  const webBounds = sectionWebBounds(profile);
  if (beamInterface.faceRef !== "web-center-plane") throw new Error("secondaryWebReference beamInterface.faceRef must be web-center-plane");
  const beamNormal = requiredVec3(beamInterface.normal, "secondaryWebReference beamInterface.normal");
  const beamOrigin = requiredVec3(beamInterface.origin, "secondaryWebReference beamInterface.origin");
  const supportOrigin = requiredVec3(supportInterface.origin, "secondaryWebReference supportInterface.origin");
  const supportNormal = requiredVec3(supportInterface.normal, "secondaryWebReference supportInterface.normal");
  const side = v.dot(beamNormal, frame.y) < 0 ? -1 : 1;
  const webNormal = v.mul(frame.y, side);
  const localAxisY = beamDirection;
  const localAxisZ = frame.z;
  if (startReferencePoint !== undefined && !v.isVec3(startReferencePoint)) throw new Error("secondaryWebReference startReferencePoint must be a finite vec3");
  const supportEdge = startReferencePoint === undefined ? v.add(supportOrigin, v.mul(supportNormal, edgeOffset)) : startReferencePoint;
  const startOnWebCenter = projectPointToPlane(supportEdge, beamOrigin, frame.y);
  const startOnWebFace = v.add(startOnWebCenter, v.mul(frame.y, side > 0 ? webBounds.maxY : webBounds.minY));
  const webFaceOrigin = v.add(startOnWebFace, v.mul(localAxisY, plateLength / 2));
  const referenceLength = beamInterface.extents?.length;
  if (!finiteNumber(referenceLength) || referenceLength <= EPSILON) throw new Error("secondaryWebReference extents.length must be positive");
  return {
    origin: v.add(webFaceOrigin, v.mul(webNormal, plateThickness / 2)),
    webFaceOrigin,
    normal: webNormal,
    localAxisY,
    localAxisZ,
    beamDirection,
    webThickness: webBounds.maxY - webBounds.minY,
    extents: {
      length: referenceLength,
      height: webHeight(profile),
      thickness: webBounds.maxY - webBounds.minY
    }
  };
}

export function createGeometryApi() {
  return {
    v,
    clamp,
    circleFitsPolygon,
    cleanOutline,
    plateOutline: sketchPlateOutline,
    clipPlateOutlineByPlane,
    outlineArea,
    platePoint,
    linePlaneIntersection,
    projectPointToPlane,
    projectedAxis,
    rectangleOutline: sketchRectangleOutline,
    endPlateAxes,
    plateAxes,
    memberFrame,
    memberFrameAt,
    memberLength,
    memberStationAtPoint,
    sectionBounds,
    sectionWebBounds,
    secondaryBeamDirection,
    secondaryWebReference,
    webHeight,
    webThickness
  };
}
