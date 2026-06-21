import { averageVec3, clamp, closestAxisSegmentPoints, finiteNumber, finiteNumberOr, projectedAxis as projectAxisToPlane, v } from "../../core/math.mjs";
import { arrayValues, objectById, truthyValues, uniqueValues } from "../../core/model.mjs";
import { activeTrimJointOperations, activeTrimJointParticipants, trimOperationReferencePlaneIds } from "../../api/project/trim-operations.mjs";
import { memberAxisData, memberPointAtEnd } from "../../api/project/members.mjs";
import { libraryProfileById } from "../../api/project/profiles.mjs";
import { CSG_EPSILON, ccwPoints, geometryError, projectCoincidentTolerance, requiredVector } from "../csg.mjs";
import { memberFrame, memberFrameAt, memberLength, sectionBounds } from "../member-geometry.mjs";
import { requiredReferencePlane } from "../reference-plane.mjs";

function sectionPoint(origin, frame, point, xOffset = 0) {
  return v.add(origin, v.add(v.mul(frame.x, xOffset), v.add(v.mul(frame.y, point[0]), v.mul(frame.z, point[1]))));
}

function memberStation(member, frame, point) {
  return v.dot(v.sub(point, member.start), frame.x);
}

function memberEndKeepDirection(member, frame, memberEnd) {
  if (memberEnd === "start") return frame.x;
  if (memberEnd === "end") return v.mul(frame.x, -1);
  geometryError(`${member.id}: trim operation must set memberEnd to start or end`);
}

function sectionMaxSpan(profile) {
  if (!profile) return 1;
  const bounds = sectionBounds(profile);
  return Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1);
}

function trimPlaneMarkerAxis(frame, normal) {
  return projectAxisToPlane(frame.y, normal, CSG_EPSILON)
    || projectAxisToPlane(frame.z, normal, CSG_EPSILON);
}

function trimPlaneWithAxes(profiles, member, frame, normal, origin, featureId) {
  const axisX = trimPlaneMarkerAxis(frame, normal);
  if (!axisX) geometryError(`${featureId}: trim plane cannot resolve plane axis`);
  const axisY = v.norm(v.cross(normal, axisX));
  const markerSpan = sectionMaxSpan(libraryProfileById(profiles, member.profile)) * 1.35;
  return {
    origin,
    normal,
    axisX,
    axisY,
    size: [markerSpan, markerSpan]
  };
}

function equalAngleMiterNormal(ownDirection, mateDirection) {
  if (!mateDirection) return ownDirection;
  let normal = v.norm(v.sub(mateDirection, ownDirection));
  if (v.len(normal) <= CSG_EPSILON) return ownDirection;
  if (v.dot(normal, ownDirection) < 0) normal = v.mul(normal, -1);
  return Math.abs(v.dot(normal, ownDirection)) <= CSG_EPSILON ? ownDirection : normal;
}

function profileSolidPoints(profile) {
  return arrayValues(profile?.section?.contours)
    .filter((contour) => contour.role === "solid")
    .flatMap((contour) => arrayValues(contour.points))
    .filter((point) => Array.isArray(point) && point.length >= 2 && point.every(finiteNumber));
}

function profileExtentAlong(profile, axis) {
  const axisLength = Math.hypot(axis[0], axis[1]);
  if (axisLength <= CSG_EPSILON) return sectionMaxSpan(profile);
  const unit = [axis[0] / axisLength, axis[1] / axisLength];
  const points = profileSolidPoints(profile);
  if (!points.length) return sectionMaxSpan(profile);
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projection = point[0] * unit[0] + point[1] * unit[1];
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  const extent = max - min;
  return extent > CSG_EPSILON ? extent : sectionMaxSpan(profile);
}

function profileCutLengthEstimate(profile, frame, normal, keepDirection) {
  const along = Math.abs(v.dot(normal, keepDirection));
  if (along <= 0.04) return Infinity;
  const sectionAxis = [v.dot(normal, frame.y), v.dot(normal, frame.z)];
  return profileExtentAlong(profile, sectionAxis) / along;
}

function candidateMiterNormal(ownKeep, mateKeep, alpha) {
  const own = v.norm(ownKeep);
  const mateBack = v.mul(v.norm(mateKeep), -1);
  const dot = clamp(v.dot(own, mateBack), -1, 1);
  const tangent = v.norm(v.sub(mateBack, v.mul(own, dot)));
  if (v.len(tangent) <= CSG_EPSILON) return own;
  return v.norm(v.add(v.mul(own, Math.cos(alpha)), v.mul(tangent, Math.sin(alpha))));
}

function profileBalancedMiterNormal(profiles, owner, frame, ownKeep, mate, mateFrame, mateKeep) {
  const ownerProfile = libraryProfileById(profiles, owner.profile);
  const mateProfile = libraryProfileById(profiles, mate.profile);
  if (!ownerProfile || !mateProfile) return equalAngleMiterNormal(ownKeep, mateKeep);

  const own = v.norm(ownKeep);
  const mateBack = v.mul(v.norm(mateKeep), -1);
  const beta = Math.acos(clamp(v.dot(own, mateBack), -1, 1));
  if (beta <= 0.5 * Math.PI / 180 || Math.PI - beta <= 0.5 * Math.PI / 180) {
    return equalAngleMiterNormal(ownKeep, mateKeep);
  }

  const samples = 72;
  let best = null;
  for (let index = 0; index <= samples; index += 1) {
    const alpha = beta * index / samples;
    const normal = candidateMiterNormal(own, mateKeep, alpha);
    const ownAlong = Math.abs(v.dot(normal, own));
    const mateAlong = Math.abs(v.dot(v.mul(normal, -1), v.norm(mateKeep)));
    if (ownAlong <= 0.04 || mateAlong <= 0.04) continue;

    const ownerCut = profileCutLengthEstimate(ownerProfile, frame, normal, own);
    const mateCut = profileCutLengthEstimate(mateProfile, mateFrame, v.mul(normal, -1), v.norm(mateKeep));
    if (!finiteNumber(ownerCut) || !finiteNumber(mateCut)) continue;
    const relativeDifference = Math.abs(ownerCut - mateCut) / Math.max(ownerCut, mateCut, 1);
    const equalAngleBias = Math.abs(alpha - beta / 2) / Math.max(beta, CSG_EPSILON) * 0.0001;
    const score = relativeDifference + equalAngleBias;
    if (!best || score < best.score) best = { score, normal };
  }

  return best?.normal || equalAngleMiterNormal(ownKeep, mateKeep);
}

function participantMember(project, participant, trimJointId) {
  if (!participant?.memberId) geometryError(`${trimJointId}: trim participant missing memberId`);
  return objectById(project, participant.memberId);
}

function memberAxis(member, trimJointId) {
  const axis = memberAxisData(member);
  if (!axis) geometryError(`${trimJointId}: trim participant member has zero length: ${member.id}`);
  return { start: axis.start, x: axis.direction, length: axis.length };
}

function trimJointPoint(project, trimJoint) {
  const axes = activeTrimJointParticipants(trimJoint).map((participant) => (
    memberAxis(participantMember(project, participant, trimJoint.id), trimJoint.id)
  ));
  if (axes.length < 2) geometryError(`${trimJoint.id}: corner trim requires at least two enabled participants`);

  const pairs = [];
  for (let i = 0; i < axes.length; i += 1) {
    for (let j = i + 1; j < axes.length; j += 1) {
      const closest = closestAxisSegmentPoints(axes[i], axes[j], CSG_EPSILON);
      if (closest) pairs.push(closest);
    }
  }
  if (!pairs.length) geometryError(`${trimJoint.id}: corner trim cannot resolve participant intersection`);

  const bestDistance = Math.min(...pairs.map((pair) => pair.distance));
  const tolerance = Math.max(projectCoincidentTolerance(project), CSG_EPSILON, 0.001);
  const usableDistance = Math.max(bestDistance + tolerance, tolerance * 20);
  const points = pairs
    .filter((pair) => pair.distance <= usableDistance)
    .flatMap((pair) => [pair.a, pair.b]);
  return averageVec3(points) || geometryError("cannot average empty point set");
}

function sectionEdgeContactPlanes(member, profile, station, featureId) {
  const at = memberFrameAt(member, station);
  const planes = [];
  for (const contour of arrayValues(profile.section?.contours)) {
    if (contour.role !== "solid") continue;
    const points = ccwPoints(arrayValues(contour.points));
    if (points.length < 2) continue;
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const dy = b[0] - a[0];
      const dz = b[1] - a[1];
      const localNormal = [dz, -dy];
      const normalLength = Math.hypot(localNormal[0], localNormal[1]);
      if (normalLength <= CSG_EPSILON) continue;
      const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const normal = v.norm(v.add(v.mul(at.y, localNormal[0]), v.mul(at.z, localNormal[1])));
      if (v.len(normal) <= CSG_EPSILON) continue;
      planes.push({
        origin: sectionPoint(at.origin, at, center),
        normal,
        edgeAxis: v.norm(v.add(v.mul(at.y, dy), v.mul(at.z, dz)))
      });
    }
  }
  if (!planes.length) geometryError(`${featureId}: butt trim mate profile has no usable contact faces`);
  return planes;
}

function trimJointMemberContactPlane(project, profiles, trimJointId, memberId, keepDirection, jointPoint, side = "far") {
  if (!memberId) geometryError(`${trimJointId}: trim operation missing cutter member`);
  const cutter = objectById(project, memberId);
  const profile = libraryProfileById(profiles, cutter.profile);
  if (!profile) geometryError(`${trimJointId}: trim operation cutter profile not found: ${cutter.profile}`);
  const frame = memberFrame(cutter);
  const station = clamp(v.dot(v.sub(jointPoint, cutter.start), frame.x), 0, memberLength(cutter));
  const contactPlanes = sectionEdgeContactPlanes(cutter, profile, station, trimJointId);
  const direction = v.norm(keepDirection);
  const aligned = contactPlanes
    .map((plane) => ({
      ...plane,
      alignment: Math.abs(v.dot(plane.normal, direction)),
      projection: v.dot(plane.origin, direction)
    }))
    .filter((plane) => plane.alignment > 0.08);
  const candidates = aligned.length ? aligned : contactPlanes.map((plane) => ({
    ...plane,
    alignment: Math.abs(v.dot(plane.normal, direction)),
    projection: v.dot(plane.origin, direction)
  }));
  candidates.sort((left, right) => {
    const projectionOrder = side === "near"
      ? left.projection - right.projection
      : right.projection - left.projection;
    if (Math.abs(projectionOrder) > CSG_EPSILON) return projectionOrder;
    return right.alignment - left.alignment;
  });
  const plane = candidates[0];
  const normal = v.dot(plane.normal, direction) >= 0 ? plane.normal : v.mul(plane.normal, -1);
  return { origin: plane.origin, normal, axisX: plane.edgeAxis };
}

function trimJointOperationEnd(project, trimJoint, member, explicitEnd) {
  if (explicitEnd === "start" || explicitEnd === "end") return explicitEnd;
  const frame = memberFrame(member);
  const station = memberStation(member, frame, trimJointPoint(project, trimJoint));
  return station <= memberLength(member) / 2 ? "start" : "end";
}

function trimJointButtFeature(project, profiles, trimJoint, id, owner, ownerEnd, mateId, gap, operation, contactSide = "far") {
  const frame = memberFrame(owner);
  const normal = memberEndKeepDirection(owner, frame, ownerEnd);
  const jointPoint = trimJointPoint(project, trimJoint);
  const contact = trimJointMemberContactPlane(project, profiles, trimJoint.id, mateId, normal, jointPoint, contactSide);
  if (!contact) return null;
  return {
    id,
    type: "member-trim-plane",
    ownerId: owner.id,
    trimJointId: trimJoint.id,
    runtimePlane: trimPlaneWithAxes(
      profiles,
      owner,
      frame,
      contact.normal,
      v.add(contact.origin, v.mul(contact.normal, Math.max(0, gap))),
      trimJoint.id
    ),
    display: trimJoint.display || {},
    fabrication: trimJoint.fabrication
  };
}

function trimJointMiterFeature(project, profiles, trimJoint, id, owner, ownerEnd, mate, mateEnd, gap, operation) {
  const frame = memberFrame(owner);
  const mateFrame = memberFrame(mate);
  const jointPoint = trimJointPoint(project, trimJoint);
  const ownerKeep = memberEndKeepDirection(owner, frame, ownerEnd);
  const mateKeep = memberEndKeepDirection(mate, mateFrame, mateEnd);
  const normal = operation.miterMode === "profile-balanced"
    ? profileBalancedMiterNormal(profiles, owner, frame, ownerKeep, mate, mateFrame, mateKeep)
    : equalAngleMiterNormal(ownerKeep, mateKeep);
  return {
    id,
    type: "member-trim-plane",
    ownerId: owner.id,
    trimJointId: trimJoint.id,
    runtimePlane: trimPlaneWithAxes(profiles, owner, frame, normal, v.add(jointPoint, v.mul(normal, Math.max(0, gap))), trimJoint.id),
    display: trimJoint.display || {},
    fabrication: trimJoint.fabrication
  };
}

function trimJointOperationPlaneIds(trimJoint, operation) {
  const ids = trimOperationReferencePlaneIds(operation);
  if (!ids.length) geometryError(`${trimJoint.id}: plane trim operation requires referencePlaneIds`);
  const uniqueIds = uniqueValues(ids);
  if (uniqueIds.length !== ids.length) geometryError(`${trimJoint.id}: plane trim operation has duplicate referencePlaneIds`);
  return uniqueIds;
}

function trimJointReferencePlane(project, trimJoint, operation, referencePlaneId, gap = 0) {
  const plane = requiredReferencePlane(project, referencePlaneId, `${trimJoint.id}:${operation.id || "plane_trim"}`, geometryError);
  const normal = v.norm(requiredVector(plane, "normal", `${trimJoint.id} reference plane`));
  return {
    ...plane,
    id: referencePlaneId,
    origin: v.add(requiredVector(plane, "origin", `${trimJoint.id} reference plane`), v.mul(normal, Math.max(0, gap)))
  };
}

function trimJointReferencePlanes(project, trimJoint, operation, gap = 0) {
  return trimJointOperationPlaneIds(trimJoint, operation)
    .map((referencePlaneId) => trimJointReferencePlane(project, trimJoint, operation, referencePlaneId, gap));
}

function trimJointPlaneTrimFeature(project, trimJoint, id, owner, gap, operation) {
  return {
    id,
    type: "member-trim-region",
    ownerId: owner.id,
    trimJointId: trimJoint.id,
    runtimePlanes: trimJointReferencePlanes(project, trimJoint, operation, gap),
    removedRegionKeys: [...arrayValues(operation.removedRegionKeys)],
    display: trimJoint.display || {},
    fabrication: trimJoint.fabrication
  };
}

export function evaluateTrimJointPlaneTrimFeature(project, profiles, trimJoint, operation, options = {}) {
  if (!operation.memberAId) geometryError(`${trimJoint.id}: trim operation missing memberAId`);
  const memberA = objectById(project, operation.memberAId);
  const id = options.id || `${trimJoint.id}:${operation.id || "operation_1"}`;
  const gap = finiteNumberOr(operation.gap, 0);
  return trimJointPlaneTrimFeature(project, trimJoint, id, memberA, gap, operation);
}

export function evaluateTrimJointOperationFeatures(project, profiles, trimJoint, operation, index = 0) {
  if (!operation.memberAId) geometryError(`${trimJoint.id}: trim operation missing memberAId`);
  const memberA = objectById(project, operation.memberAId);
  const id = `${trimJoint.id}:${operation.id || `operation_${index + 1}`}`;
  const gap = finiteNumberOr(operation.gap, 0);
  const type = operation.type || "end-butt-1";

  if (type === "plane-trim") {
    return [trimJointPlaneTrimFeature(project, trimJoint, id, memberA, gap, operation)];
  }

  if (!operation.memberBId) geometryError(`${trimJoint.id}: trim operation missing memberBId`);
  const memberAEnd = trimJointOperationEnd(project, trimJoint, memberA, operation.memberAEnd);
  const memberB = objectById(project, operation.memberBId);
  const memberBEnd = trimJointOperationEnd(project, trimJoint, memberB, operation.memberBEnd);

  if (type === "profile-cope") {
    if (gap > CSG_EPSILON) geometryError(`${trimJoint.id}: profile cope clearance offsets are not implemented`);
    return [{
      id,
      type: "boolean-part",
      booleanType: "BOOLEAN_CUT",
      cutKind: "part-cut",
      ownerId: memberA.id,
      trimJointId: trimJoint.id,
      source: {
        kind: "member-profile",
        memberId: memberB.id
      },
      display: trimJoint.display || {},
      fabrication: trimJoint.fabrication
    }];
  }

  if (type === "end-butt-1") {
    return truthyValues([
      trimJointButtFeature(project, profiles, trimJoint, id, memberA, memberAEnd, memberB.id, gap, operation)
    ]);
  }

  if (type === "end-butt-2") {
    return truthyValues([
      trimJointButtFeature(project, profiles, trimJoint, id, memberB, memberBEnd, memberA.id, gap, operation)
    ]);
  }

  if (type === "end-butt-both") {
    return truthyValues([
      trimJointButtFeature(project, profiles, trimJoint, `${id}:a`, memberA, memberAEnd, memberB.id, gap, operation),
      trimJointButtFeature(project, profiles, trimJoint, `${id}:b`, memberB, memberBEnd, memberA.id, gap, operation, "near")
    ]);
  }

  if (type === "end-miter") {
    return truthyValues([
      trimJointMiterFeature(project, profiles, trimJoint, `${id}:a`, memberA, memberAEnd, memberB, memberBEnd, gap, operation),
      trimJointMiterFeature(project, profiles, trimJoint, `${id}:b`, memberB, memberBEnd, memberA, memberAEnd, gap, operation)
    ]);
  }

  geometryError(`${trimJoint.id}: unsupported trim operation type ${type}`);
}

export function evaluateTrimJointMemberFeatures(project, profiles, member) {
  return Object.values(project.model?.trimJoints || {})
    .flatMap((trimJoint) => activeTrimJointOperations(trimJoint)
      .flatMap((operation, index) => evaluateTrimJointOperationFeatures(project, profiles, trimJoint, operation, index))
      .filter((feature) => feature?.ownerId === member.id));
}

function trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, memberId, memberEnd) {
  if (!memberId) geometryError(`${trimJoint.id}: trim operation missing marker member`);
  const member = objectById(project, memberId);
  const frame = memberFrame(member);
  const operationEnd = trimJointOperationEnd(project, trimJoint, member, memberEnd);
  const origin = memberPointAtEnd(member, operationEnd);
  return {
    ...trimPlaneWithAxes(
      profiles,
      member,
      frame,
      memberEndKeepDirection(member, frame, operationEnd),
      origin,
      trimJoint.id
    ),
    memberId: member.id
  };
}

export function evaluateTrimJointOperationMarkerPlanes(project, profiles, trimJoint, operation) {
  const type = operation.type || "end-butt-1";
  if (type === "plane-trim") {
    const gap = finiteNumberOr(operation.gap, 0);
    return trimJointReferencePlanes(project, trimJoint, operation, gap);
  }
  if (type === "end-butt-1") {
    return [trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, operation.memberAId, operation.memberAEnd)];
  }
  if (type === "end-butt-2") {
    return [trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, operation.memberBId, operation.memberBEnd)];
  }
  if (type === "end-butt-both" || type === "end-miter") {
    return [
      trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, operation.memberAId, operation.memberAEnd),
      trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, operation.memberBId, operation.memberBEnd)
    ];
  }
  return [trimJointOperationMemberMarkerPlane(project, profiles, trimJoint, operation, operation.memberAId, operation.memberAEnd)];
}
