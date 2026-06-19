import { distance3, finiteVec3, sameVec3, v } from "../../core/math.mjs";

const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`member api: ${message}`);
}

export function vec3(value, label = "point") {
  return finiteVec3(value, label, fail);
}

export function almostSamePoint(a, b, tolerance = EPSILON) {
  return sameVec3(a, b, tolerance);
}

export function memberCenter(member) {
  return v.mul(
    v.add(vec3(member.start, `${member.id || "member"}.start`), vec3(member.end, `${member.id || "member"}.end`)),
    0.5
  );
}

export function memberPointAtEnd(member, memberEnd) {
  if (memberEnd === "start") return vec3(member.start, `${member.id || "member"}.start`);
  if (memberEnd === "end") return vec3(member.end, `${member.id || "member"}.end`);
  fail(`${member.id || "member"} memberEnd must be start or end`);
}

function stationReferenceAxis(member, source) {
  if (source === null || source === undefined) return { start: member.start, end: member.end };
  if (!source || typeof source !== "object" || Array.isArray(source)) fail(`${member.id || "member"} station source must be an object`);
  if (source.type === "member-axis") return { start: member.start, end: member.end };
  if (source.type === "layout-axis") return memberLayoutAxis(member);
  fail(`${member.id || "member"} station source type is unsupported: ${source.type || "missing"}`);
}

export function memberStationAtPoint(member, point, source = null) {
  const referenceAxis = stationReferenceAxis(member, source);
  const targetPoint = vec3(point, `${member.id || "member"} station point`);
  const axis = v.sub(referenceAxis.end, referenceAxis.start);
  const referenceLength = distance3(referenceAxis.start, referenceAxis.end);
  if (referenceLength <= EPSILON) fail(`${member.id || "member"} station reference axis cannot have zero length`);
  const physicalAxis = memberAxisData(member);
  if (!physicalAxis) fail(`${member.id || "member"} physical axis is required for stationing`);
  const ratio = v.dot(v.sub(targetPoint, referenceAxis.start), axis) / (referenceLength * referenceLength);
  if (ratio < -EPSILON || ratio > 1 + EPSILON) fail(`${member.id || "member"} station point is outside the reference axis`);
  return Math.min(1, Math.max(0, ratio)) * physicalAxis.length;
}

export function memberById(project, memberId) {
  return project?.model?.members?.[memberId] || null;
}

export function memberAxisData(member) {
  if (!member || !v.isVec3(member.start) || !v.isVec3(member.end)) return null;
  const axis = v.sub(member.end, member.start);
  const length = distance3(member.start, member.end);
  if (length <= EPSILON) return null;
  return {
    start: member.start,
    end: member.end,
    direction: v.mul(axis, 1 / length),
    length
  };
}

export function memberLayoutAxis(member) {
  if (member.layoutAxis === undefined) {
    return {
      start: vec3(member.start, `${member.id || "member"}.start`),
      end: vec3(member.end, `${member.id || "member"}.end`)
    };
  }
  if (!member.layoutAxis || typeof member.layoutAxis !== "object" || Array.isArray(member.layoutAxis)) {
    fail(`${member.id || "member"} layoutAxis must be an object`);
  }
  if (member.layoutAxis.start === undefined || member.layoutAxis.end === undefined) fail(`${member.id || "member"} layoutAxis must define start and end`);
  return {
    start: vec3(member.layoutAxis.start, `${member.id || "member"}.layoutAxis.start`),
    end: vec3(member.layoutAxis.end, `${member.id || "member"}.layoutAxis.end`)
  };
}

function endpointName(endpoint) {
  if (endpoint !== "start" && endpoint !== "end") fail(`unsupported endpoint ${endpoint}`);
  return endpoint;
}

function translatedAxis(axis, offset) {
  return {
    ...axis,
    start: v.add(axis.start, offset),
    end: v.add(axis.end, offset)
  };
}

export function moveMemberWithLayout(member, delta) {
  const offset = vec3(delta, "member move delta");
  const next = {
    ...member,
    start: v.add(member.start, offset),
    end: v.add(member.end, offset)
  };
  if (member.layoutAxis) next.layoutAxis = translatedAxis(memberLayoutAxis(member), offset);
  return next;
}

export function setMemberPhysicalEndpoint(member, endpoint, point) {
  const key = endpointName(endpoint);
  const nextPoint = vec3(point, `member ${key}`);
  const previousPoint = vec3(member[key], `member ${key}`);
  const next = { ...member, [key]: nextPoint };
  if (member.layoutAxis) {
    const layoutAxis = memberLayoutAxis(member);
    if (almostSamePoint(layoutAxis[key], previousPoint)) next.layoutAxis = { ...layoutAxis, [key]: nextPoint };
  }
  if (almostSamePoint(next.start, next.end)) fail(`${member.id || "member"} cannot have zero length`);
  return next;
}

export function setMemberLayoutEndpoint(member, endpoint, point) {
  const key = endpointName(endpoint);
  const axis = memberLayoutAxis(member);
  const nextAxis = { ...axis, [key]: vec3(point, `layout ${key}`) };
  if (almostSamePoint(nextAxis.start, nextAxis.end)) fail(`${member.id || "member"} layout axis cannot have zero length`);
  return { ...member, layoutAxis: nextAxis };
}

export function memberAuthoringPoints(member) {
  const axis = memberLayoutAxis(member);
  return {
    center: memberCenter(member),
    physicalStart: vec3(member.start, "member start"),
    physicalEnd: vec3(member.end, "member end"),
    layoutStart: axis.start,
    layoutEnd: axis.end
  };
}
