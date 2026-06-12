import { cleanVec2Loop, clamp, distancePointToSegment2, finitePositiveNumber as finitePositive, linePlaneIntersection, projectedAxis, projectPointToPlane, v } from "../../core/math.mjs?v=distance2-dry-1";
import { signedArea2d } from "../../geometry/polygon.mjs?v=polygon-area-dry-1";
import { plateOutline as sketchPlateOutline, rectangleOutline as sketchRectangleOutline } from "../project/plates.mjs?v=plate-outline-relation-safety-1";
import { memberStationAtPoint } from "../project/members.mjs?v=member-station-api-dry-1";
import {
  memberFrame,
  memberFrameAt,
  memberLength,
  sectionBounds,
  sectionWebBounds
} from "../../geometry/member-geometry.mjs?v=geometry-api-array-values-dry-1";

const EPSILON = 1e-9;

const cleanOutline = (outline) => cleanVec2Loop(outline, { tolerance: EPSILON });

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
  return Math.abs(signedArea2d(points));
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

function circleFitsPolygon(point, radius, outline) {
  const polygon = cleanOutline(outline);
  if (polygon.length < 3 || !pointInPolygon(point, polygon)) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    if (distancePointToSegment2(point, polygon[index], polygon[(index + 1) % polygon.length]) < radius - EPSILON) return false;
  }
  return true;
}

function endPlateAxes(mainInterface) {
  const normal = v.norm(mainInterface.normal);
  const mainZ = projectedAxis(mainInterface.localAxisZ, normal);
  let localAxisZ = mainZ;
  if (!localAxisZ) localAxisZ = projectedAxis([0, 0, 1], normal) || projectedAxis([0, 1, 0], normal);
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
    clamp,
    finitePositive,
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
