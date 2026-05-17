import { v } from "../../core/math.mjs";

const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`member api: ${message}`);
}

export function vec3(value, label = "point") {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    fail(`${label} must be a finite [x, y, z] point`);
  }
  return [...value];
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function almostSamePoint(a, b, tolerance = EPSILON) {
  return Array.isArray(a) && Array.isArray(b) && v.len(v.sub(a, b)) <= tolerance;
}

export function memberCenter(member) {
  return v.mul(v.add(member.start, member.end), 0.5);
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
