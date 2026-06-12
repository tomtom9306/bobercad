import { clamp, distance3, finiteVec3, sameVec3, v } from "../../core/math.mjs?v=distance3-dry-1";

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
  return v.mul(v.add(member.start, member.end), 0.5);
}

export function memberPointAtEnd(member, memberEnd, fallback = null) {
  if (memberEnd === "start") return member.start;
  if (memberEnd === "end") return member.end;
  return fallback;
}

export function memberStationAtPoint(member, point, source = null) {
  const referenceAxis = source?.type === "layout-axis" && member.layoutAxis
    ? memberLayoutAxis(member)
    : { start: member.start, end: member.end };
  const axis = v.sub(referenceAxis.end, referenceAxis.start);
  const referenceLength = distance3(referenceAxis.start, referenceAxis.end);
  const physicalLength = memberAxisData(member)?.length || 0;
  if (referenceLength <= EPSILON || physicalLength <= EPSILON) return 0;
  const ratio = clamp(v.dot(v.sub(point, referenceAxis.start), axis) / (referenceLength * referenceLength), 0, 1);
  return ratio * physicalLength;
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
  const axis = member.layoutAxis || {};
  return {
    start: vec3(axis.start || member.start, `${member.id || "member"}.layoutAxis.start`),
    end: vec3(axis.end || member.end, `${member.id || "member"}.layoutAxis.end`)
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
  if (member.layoutAxis && almostSamePoint(member.layoutAxis[key], previousPoint)) {
    next.layoutAxis = { ...memberLayoutAxis(member), [key]: nextPoint };
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
