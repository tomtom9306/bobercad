import { averageVec3, clamp, v } from "../../core/math.mjs";
import { arrayValues, objectById, truthyValues } from "../../core/model.mjs";
import { smartComponentOwnedObjectIds, smartComponentReferencesObject } from "../../api/project/dependencies.mjs";
import { plateOutline } from "../../api/project/plate-sketch-relations-and-bends.mjs";
import { CSG_EPSILON, geometryError, requiredNumber, requiredVector } from "../csg.mjs";
import { clearanceCutGeometry } from "../cut-features.mjs";
import { memberFrame, resolveInterfaceWithConnectionReference } from "../member-geometry.mjs";
import { requiredReferencePlane } from "../reference-plane.mjs";

function sectionPoint(origin, frame, point, xOffset = 0) {
  return v.add(origin, v.add(v.mul(frame.x, xOffset), v.add(v.mul(frame.y, point[0]), v.mul(frame.z, point[1]))));
}

function objectFeatures(project, object) {
  return arrayValues(object.featureIds)
    .map((id) => objectById(project, id))
    .filter((feature) => feature.ownerId === object.id && feature.operationEnabled !== false);
}

function resolvedSupportInterface(project, profiles, weld) {
  const ref = weld.reference;
  const options = {};
  if (ref.stationReferenceInterfaceRef) {
    options.referencePoint = resolveInterfaceWithConnectionReference(project, profiles, ref.stationReferenceInterfaceRef).origin;
    options.preferReferencePoint = true;
  }
  return resolveInterfaceWithConnectionReference(project, profiles, ref.supportInterfaceId, options);
}

function plateSupportEdge(project, profiles, weld, plate, supportInterface, plateAxes, outline) {
  const { plateCenter, plateAxisY, plateAxisZ } = plateAxes;
  const supportNormal = v.norm(requiredVector(supportInterface, "normal", supportInterface.id));
  const minY = Math.min(...outline.map((point) => point[0]));
  const maxY = Math.max(...outline.map((point) => point[0]));
  const minZ = Math.min(...outline.map((point) => point[1]));
  const maxZ = Math.max(...outline.map((point) => point[1]));
  const width = maxY - minY;
  const height = maxZ - minZ;
  const edgeSide = v.dot(plateAxisY, supportNormal) >= 0 ? -1 : 1;
  const edgeY = edgeSide > 0 ? maxY : minY;
  const edgeCenter = v.add(plateCenter, v.add(v.mul(plateAxisY, edgeY), v.mul(plateAxisZ, (minZ + maxZ) / 2)));
  const rectangularSupportEdge = {
    a: v.add(edgeCenter, v.mul(plateAxisZ, -height / 2)),
    b: v.add(edgeCenter, v.mul(plateAxisZ, height / 2)),
    inward: v.mul(plateAxisY, -edgeSide),
    beadLimit: width / 5
  };

  const points = outline.map((point) => v.add(plateCenter, v.add(v.mul(plateAxisY, point[0]), v.mul(plateAxisZ, point[1]))));
  const centroid = averageVec3(points, plateCenter);
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const score = Math.abs(v.dot(v.sub(a, supportInterface.origin), supportNormal)) + Math.abs(v.dot(v.sub(b, supportInterface.origin), supportNormal));
    if (!best || score < best.score) best = { a, b, score };
  }
  if (!best) return rectangularSupportEdge;
  const center = v.mul(v.add(best.a, best.b), 0.5);
  const inwardRaw = v.sub(centroid, center);
  const inward = v.len(inwardRaw) > CSG_EPSILON ? v.norm(inwardRaw) : rectangularSupportEdge.inward;
  return { ...best, inward, beadLimit: Math.max(1, v.len(v.sub(best.b, best.a)) / 5) };
}

function clearanceCutInterval(geometry, a, b) {
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
  return [clamp(t0, 0, 1), clamp(t1, 0, 1)];
}

function smartComponentClearanceCuts(project, profiles, weld, plate) {
  const features = new Map();
  const addFeature = (id) => {
    const entry = project.objectIndex?.[id];
    if (entry?.collection !== "features") return;
    const feature = objectById(project, id);
    if (feature.type === "clearance-cut" && feature.operationEnabled !== false) features.set(feature.id, feature);
  };

  for (const feature of objectFeatures(project, plate)) addFeature(feature.id);
  for (const smartComponent of Object.values(project.model.smartComponentInstances || {})) {
    if (!smartComponentReferencesObject(smartComponent, weld.id)) continue;
    for (const id of smartComponentOwnedObjectIds(smartComponent)) addFeature(id);
  }

  return truthyValues([...features.values()]
    .map((feature) => clearanceCutGeometry(project, profiles, feature)));
}

function mergeIntervals(intervals) {
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
}

function supportEdgeSegments(supportEdge, clearanceCuts, bead) {
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
}

function evaluatePlateSupportEdgeWeld(project, profiles, weld) {
  const ref = weld.reference;
  const plate = objectById(project, ref.plateId);
  const supportInterface = resolvedSupportInterface(project, profiles, weld);
  const plateCenter = requiredVector(plate, "center", plate.id);
  const plateNormal = v.norm(requiredVector(plate, "normal", plate.id));
  const plateAxisY = v.norm(requiredVector(plate, "localAxisY", plate.id));
  const plateAxisZ = v.norm(requiredVector(plate, "localAxisZ", plate.id));
  const plateAxes = { plateCenter, plateNormal, plateAxisY, plateAxisZ };
  const outline = plateOutline(plate);
  const thickness = requiredNumber(plate, "thickness", plate.id);
  const size = Math.max(requiredNumber(weld, "size", weld.id), 1);
  const runs = Array.isArray(ref.runs)
    ? ref.runs
    : [{ edge: "support", side: "front", size }, { edge: "support", side: "back", size }];
  const supportEdge = plateSupportEdge(project, profiles, weld, plate, supportInterface, plateAxes, outline);
  const clearanceCuts = smartComponentClearanceCuts(project, profiles, weld, plate);
  const faces = [];

  for (const run of runs) {
    const runSize = Math.max(run.size ?? size, 0);
    if (runSize <= 0) continue;
    const bead = Math.min(runSize, supportEdge.beadLimit);
    if (run.edge === "support") {
      const sides = run.side ? [run.side] : ["front", "back"];
      for (const edgeSegment of supportEdgeSegments(supportEdge, clearanceCuts, bead)) {
        const segmentBead = Math.min(runSize, edgeSegment.beadLimit);
        for (const sideName of sides) {
          const side = sideName === "back" ? -1 : 1;
          const faceOffset = v.mul(plateNormal, side * (thickness / 2 + 0.25));
          const bottom = v.add(edgeSegment.a, faceOffset);
          const top = v.add(edgeSegment.b, faceOffset);
          faces.push({
            edge: run.edge,
            side: sideName,
            size: runSize,
            points: [bottom, top, v.add(top, v.mul(edgeSegment.inward, segmentBead)), v.add(bottom, v.mul(edgeSegment.inward, segmentBead))]
          });
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
      faces.push({
        edge: run.edge,
        side: null,
        size: runSize,
        points: [front, back, v.add(back, v.mul(supportEdge.inward, bead)), v.add(front, v.mul(supportEdge.inward, bead))]
      });
    }
  }

  return {
    id: weld.id,
    kind: "plate-support-edge",
    source: weld,
    plateId: plate.id,
    supportInterfaceId: ref.supportInterfaceId,
    faces
  };
}

function memberProfilePointOnPlane(member, frame, planeOrigin, planeNormal, point) {
  const sectionOrigin = sectionPoint(member.start, frame, point, 0);
  const denominator = v.dot(planeNormal, frame.x);
  if (Math.abs(denominator) <= CSG_EPSILON) geometryError(`${member.id}: member axis does not intersect weld reference plane`);
  const station = v.dot(planeNormal, v.sub(planeOrigin, sectionOrigin)) / denominator;
  return sectionPoint(member.start, frame, point, station);
}

function memberWeldProfilePoints(project, weld, member, frame, contour) {
  if (weld.reference?.referencePlaneId) {
    const plane = requiredReferencePlane(project, weld.reference.referencePlaneId, weld.id, geometryError);
    const planeOrigin = requiredVector(plane, "origin", weld.id);
    const planeNormal = v.norm(requiredVector(plane, "normal", weld.id));
    return contour.points.map((point) => memberProfilePointOnPlane(member, frame, planeOrigin, planeNormal, point));
  }

  const origin = Array.isArray(weld.reference.origin) ? weld.reference.origin : weld.reference.end === "start" ? member.start : member.end;
  return contour.points.map((point) => sectionPoint(origin, frame, point));
}

function evaluateMemberProfileWeld(project, profiles, weld) {
  if (!weld.reference?.memberId) geometryError(`${weld.id}: unsupported weld reference ${weld.reference?.kind || "missing"}`);
  const member = objectById(project, weld.reference.memberId);
  const profile = profiles[member.profile];
  if (!profile) geometryError(`${weld.id}: missing profile for member ${member.id}: ${member.profile}`);
  const frame = memberFrame(member);
  return {
    id: weld.id,
    kind: "member-profile",
    source: weld,
    memberId: member.id,
    loops: arrayValues(profile.section?.contours)
      .filter((contour) => contour.role === "solid")
      .map((contour) => memberWeldProfilePoints(project, weld, member, frame, contour))
  };
}

export function evaluateWeld(project, profiles, weld) {
  if (weld.reference?.kind === "plate-support-edge") return evaluatePlateSupportEdgeWeld(project, profiles, weld);
  return evaluateMemberProfileWeld(project, profiles, weld);
}
