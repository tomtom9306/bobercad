import { v } from "../../core/math.mjs";
import { memberLayoutAxis, vec3 } from "./members.mjs";
import { cleanId } from "./objects.mjs";

const AXIS_SNAP_TYPES = new Set(["member-axis", "layout-axis", "grid-line", "global-axis"]);
const RELATION_TYPES = new Set(["point-on-axis", "member-align-axis"]);
const AXIS_SOURCE_TYPES = new Set(["fixed-axis", "global-axis", "layout-axis", "member-axis"]);

function fail(message) {
  throw new Error(`axis relation: ${message}`);
}

function optionalObject(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function optionalString(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function axisSourceType(source, label) {
  const type = optionalString(source.type, undefined, `${label}.type`);
  if (!AXIS_SOURCE_TYPES.has(type)) fail(`${label}.type is unsupported: ${type}`);
  return type;
}

function relationEndpoint(value, label) {
  const endpoint = optionalString(value, undefined, label);
  if (endpoint !== "start" && endpoint !== "end") fail(`${label} must be start or end`);
  return endpoint;
}

function globalDirection(axis) {
  if (axis === "x") return [1, 0, 0];
  if (axis === "y") return [0, 1, 0];
  if (axis === "z") return [0, 0, 1];
  return null;
}

function axisPointFromSnap(snap) {
  if (Array.isArray(snap?.point)) return vec3(snap.point, "snap point");
  fail("global axis snap requires a point");
}

function relationId(memberId, endpoint, source) {
  const owner = source.memberId || source.objectId || source.gridId || source.axis || source.label || "axis";
  const target = endpoint || "axis";
  return cleanId(`rel_${memberId}_${target}_on_${source.type || "axis"}_${owner}`);
}

function alignRelationId(memberId, source) {
  const owner = source.memberId || source.objectId || source.gridId || source.axis || source.label || "axis";
  return cleanId(`rel_${memberId}_align_to_${source.type || "axis"}_${owner}`);
}

function relationCollection(project) {
  const model = requiredObject(requiredObject(project, "project").model, "project.model");
  return requiredObject(model.relations, "project.model.relations");
}

function storedRelation(value, id) {
  const relation = requiredObject(value, `relation ${id}`);
  if (relation.id !== id) fail(`relation key ${id} does not match id ${relation.id || "missing"}`);
  optionalString(relation.type, undefined, `${id}.type`);
  if (!RELATION_TYPES.has(relation.type)) fail(`${id}: unsupported relation type ${relation.type}`);
  optionalString(relation.memberId, undefined, `${id}.memberId`);
  if (relation.type === "point-on-axis") relationEndpoint(relation.endpoint, `${id}.endpoint`);
  axisSourceType(requiredObject(relation.source, `${id}.source`), `${id}.source`);
  return relation;
}

function axisSourceFromSnap(snap) {
  if (!snap || snap.kind !== "line" || !AXIS_SNAP_TYPES.has(snap.type)) return null;
  if (snap.type === "global-axis") {
    const axis = optionalString(snap.axis, undefined, "global axis snap axis");
    if (!axis) fail("global axis snap requires axis");
    const direction = globalDirection(snap.axis);
    if (!direction) fail(`unsupported global axis ${axis}`);
    return {
      type: "global-axis",
      axis,
      direction,
      origin: axisPointFromSnap(snap),
      label: optionalString(snap.label, `Global ${axis.toUpperCase()} axis`, "global axis snap label")
    };
  }
  if (snap.type === "member-axis" || snap.type === "layout-axis") {
    const objectId = optionalString(snap.objectId, undefined, `${snap.type} snap objectId`);
    if (!objectId) fail(`${snap.type} snap requires objectId`);
    return {
      type: snap.type,
      memberId: objectId,
      label: optionalString(snap.label, objectId, `${snap.type} snap label`)
    };
  }
  return {
    type: "fixed-axis",
    a: vec3(snap.a, "snap axis start"),
    b: vec3(snap.b, "snap axis end"),
    axis: optionalString(snap.axis, undefined, "fixed axis snap axis"),
    label: optionalString(snap.label, "Axis", "fixed axis snap label")
  };
}

export function axisRelationFromSnap(memberId, endpoint, snap, options = {}) {
  options = optionalObject(options, "axis relation options");
  if (typeof memberId !== "string" || !memberId) fail("relation memberId must be a non-empty string");
  if (endpoint !== "start" && endpoint !== "end") fail("relation endpoint must be start or end");
  const source = axisSourceFromSnap(snap);
  if (!source) return null;
  const label = optionalString(snap.label, source.label || "Axis", "snap label");
  return {
    id: optionalString(options.id, relationId(memberId, endpoint, source), "relation id"),
    type: "point-on-axis",
    memberId,
    endpoint,
    source,
    createdBy: optionalString(options.createdBy, "auto-snap", "relation createdBy"),
    label
  };
}

export function memberAlignRelation(memberId, source, options = {}) {
  options = optionalObject(options, "alignment relation options");
  if (typeof memberId !== "string" || !memberId) fail("alignment relation memberId must be a non-empty string");
  source = requiredObject(source, "alignment relation source");
  if (source.type === undefined) fail("alignment relation source type is required");
  axisSourceType(source, "alignment relation source");
  return {
    id: optionalString(options.id, alignRelationId(memberId, source), "alignment relation id"),
    type: "member-align-axis",
    memberId,
    source,
    createdBy: optionalString(options.createdBy, "member-editor", "alignment relation createdBy"),
    label: optionalString(options.label, optionalString(source.label, "Axis", "alignment relation source label"), "alignment relation label")
  };
}

export function memberAxisRelations(project, memberId) {
  if (typeof memberId !== "string" || !memberId) fail("memberId must be a non-empty string");
  return Object.entries(relationCollection(project))
    .map(([id, relation]) => storedRelation(relation, id))
    .filter((relation) => relation.memberId === memberId)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function axisRelationForEndpoint(project, memberId, endpoint) {
  const targetEndpoint = relationEndpoint(endpoint, "relation endpoint");
  const relations = memberAxisRelations(project, memberId);
  return relations.find((relation) => relation.type === "point-on-axis" && relation.endpoint === targetEndpoint) || null;
}

export function memberAlignmentRelation(project, memberId) {
  return memberAxisRelations(project, memberId).find((relation) => relation.type === "member-align-axis") || null;
}

export function relationUpsertKey(relation) {
  relation = requiredObject(relation, "relation");
  const type = optionalString(relation.type, undefined, `${relation.id || "relation"}.type`);
  const memberId = optionalString(relation.memberId, undefined, `${relation.id || "relation"}.memberId`);
  if (type === "member-align-axis") return `${memberId}|member-align-axis`;
  if (type === "point-on-axis") return `${memberId}|point-on-axis|${relationEndpoint(relation.endpoint, `${relation.id || "relation"}.endpoint`)}`;
  fail(`${relation.id || "relation"} has unsupported type ${type}`);
}

function axisForSource(project, source, origin = null) {
  source = requiredObject(source, "axis source");
  if (source.type === "global-axis") {
    const direction = vec3(source.direction, "global axis direction");
    const unit = v.norm(direction);
    if (v.len(unit) <= 1e-9) fail("global axis source direction cannot be zero");
    const base = source.origin !== undefined
      ? vec3(source.origin, "global axis origin")
      : origin ? vec3(origin, "global axis origin") : fail("global axis source requires origin");
    return {
      a: v.sub(base, v.mul(unit, 100000)),
      b: v.add(base, v.mul(unit, 100000))
    };
  }
  if (source.type === "member-axis" || source.type === "layout-axis") {
    const members = requiredObject(requiredObject(requiredObject(project, "project").model, "project.model").members, "project.model.members");
    const member = members[source.memberId];
    if (!member) fail(`source member not found: ${source.memberId}`);
    const axis = source.type === "layout-axis" ? memberLayoutAxis(member) : member;
    return {
      a: vec3(axis.start, "source axis start"),
      b: vec3(axis.end, "source axis end")
    };
  }
  if (source.type === "fixed-axis") {
    return {
      a: vec3(source.a, "source axis start"),
      b: vec3(source.b, "source axis end")
    };
  }
  fail(`unsupported source ${source.type || "missing"}`);
}

export function axisForRelation(project, relation, member = null, endpoint = null) {
  if (relation?.type === "member-align-axis") {
    const origin = member && endpoint === "start" ? member.end : member && endpoint === "end" ? member.start : null;
    const source = relation.source?.type === "global-axis" && origin !== null
      ? { ...relation.source, origin }
      : relation.source;
    return axisForSource(project, source, origin);
  }
  if (relation?.type === "point-on-axis") return axisForSource(project, relation.source);
  fail(`${relation?.id || "relation"} has unsupported type ${relation?.type || "missing"}`);
}

export function projectPointToAxis(axis, point) {
  const a = vec3(axis.a, "axis start");
  const b = vec3(axis.b, "axis end");
  const p = vec3(point, "point");
  const ab = v.sub(b, a);
  const lengthSq = v.dot(ab, ab);
  if (lengthSq <= 1e-12) fail("axis cannot have zero length");
  return v.add(a, v.mul(ab, v.dot(v.sub(p, a), ab) / lengthSq));
}

export function axisRelationLabel(relation) {
  relation = requiredObject(relation, "relation");
  if (relation.type === "member-align-axis") {
    const source = requiredObject(relation.source, `${relation.id || "relation"}.source`);
    const axis = source.axis ? source.axis.toUpperCase() : "";
    return `Member aligned to ${axis ? `Global ${axis}` : relation.label || "axis"}`;
  }
  if (relation.type !== "point-on-axis") fail(`${relation.id || "relation"} has unsupported type ${relation.type || "missing"}`);
  const endpoint = relationEndpoint(relation.endpoint, `${relation.id || "relation"}.endpoint`) === "start" ? "Start" : "End";
  const source = requiredObject(relation.source, `${relation.id || "relation"}.source`);
  const sourceLabel = relation.label || source.label || source.memberId || "axis";
  return `${endpoint} on ${sourceLabel}`;
}
