import { v } from "../../core/math.mjs";
import { memberLayoutAxis, vec3 } from "./members.mjs";

const AXIS_SNAP_TYPES = new Set(["member-axis", "layout-axis", "grid-line", "global-axis"]);
const RELATION_TYPES = new Set(["point-on-axis", "member-align-axis"]);

function fail(message) {
  throw new Error(`axis relation: ${message}`);
}

function cleanId(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function globalDirection(axis) {
  if (axis === "x") return [1, 0, 0];
  if (axis === "y") return [0, 1, 0];
  if (axis === "z") return [0, 0, 1];
  return null;
}

function axisPointFromSnap(snap) {
  if (Array.isArray(snap?.point)) return vec3(snap.point, "snap point");
  if (Array.isArray(snap?.a)) return vec3(snap.a, "snap axis point");
  return [0, 0, 0];
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

export function axisSourceFromSnap(snap) {
  if (!snap || snap.kind !== "line" || !AXIS_SNAP_TYPES.has(snap.type)) return null;
  if (snap.type === "global-axis" && snap.axis) {
    const direction = globalDirection(snap.axis);
    if (!direction) return null;
    return {
      type: "global-axis",
      axis: snap.axis,
      direction,
      origin: axisPointFromSnap(snap),
      label: snap.label || `Global ${snap.axis.toUpperCase()} axis`
    };
  }
  if ((snap.type === "member-axis" || snap.type === "layout-axis") && snap.objectId) {
    return {
      type: snap.type,
      memberId: snap.objectId,
      label: snap.label || snap.objectId
    };
  }
  return {
    type: "fixed-axis",
    a: vec3(snap.a, "snap axis start"),
    b: vec3(snap.b, "snap axis end"),
    axis: snap.axis || undefined,
    label: snap.label || "Axis"
  };
}

export function isAxisSnap(snap) {
  return Boolean(axisSourceFromSnap(snap));
}

export function axisRelationFromSnap(memberId, endpoint, snap, options = {}) {
  if (typeof memberId !== "string" || !memberId) fail("relation memberId must be a non-empty string");
  if (endpoint !== "start" && endpoint !== "end") fail("relation endpoint must be start or end");
  const source = axisSourceFromSnap(snap);
  if (!source) return null;
  return {
    id: options.id || relationId(memberId, endpoint, source),
    type: "point-on-axis",
    memberId,
    endpoint,
    source,
    createdBy: options.createdBy || "auto-snap",
    label: snap.label || source.label || "Axis"
  };
}

export function memberAlignRelation(memberId, source, options = {}) {
  if (typeof memberId !== "string" || !memberId) fail("alignment relation memberId must be a non-empty string");
  if (!source?.type) fail("alignment relation source is required");
  return {
    id: options.id || alignRelationId(memberId, source),
    type: "member-align-axis",
    memberId,
    source,
    createdBy: options.createdBy || "member-editor",
    label: options.label || source.label || "Axis"
  };
}

export function memberAxisRelations(project, memberId) {
  if (typeof memberId !== "string" || !memberId) return [];
  return Object.values(project.model?.relations || {})
    .filter((relation) => relation?.memberId === memberId && RELATION_TYPES.has(relation.type))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function axisRelationForEndpoint(project, memberId, endpoint) {
  const relations = memberAxisRelations(project, memberId);
  return relations.find((relation) => relation.type === "point-on-axis" && relation.endpoint === endpoint) || null;
}

export function memberAlignmentRelation(project, memberId) {
  return memberAxisRelations(project, memberId).find((relation) => relation.type === "member-align-axis") || null;
}

export function relationUpsertKey(relation) {
  if (relation?.type === "member-align-axis") return `${relation.memberId}|member-align-axis`;
  if (relation?.type === "point-on-axis") return `${relation.memberId}|point-on-axis|${relation.endpoint}`;
  fail(`${relation?.id || "relation"} has unsupported type ${relation?.type || "missing"}`);
}

export function axisForSource(project, source, origin = [0, 0, 0]) {
  if (source?.type === "global-axis") {
    const direction = source.direction || globalDirection(source.axis);
    if (!direction) fail("global axis source requires direction");
    const unit = v.norm(direction);
    const base = source.origin ? vec3(source.origin, "global axis origin") : origin;
    return {
      a: v.sub(base, v.mul(unit, 100000)),
      b: v.add(base, v.mul(unit, 100000))
    };
  }
  if (source?.type === "member-axis" || source?.type === "layout-axis") {
    const member = project.model?.members?.[source.memberId];
    if (!member) fail(`source member not found: ${source.memberId}`);
    const axis = source.type === "layout-axis" ? memberLayoutAxis(member) : member;
    return {
      a: vec3(axis.start, "source axis start"),
      b: vec3(axis.end, "source axis end")
    };
  }
  if (source?.type === "fixed-axis") {
    return {
      a: vec3(source.a, "source axis start"),
      b: vec3(source.b, "source axis end")
    };
  }
  fail(`unsupported source ${source?.type || "missing"}`);
}

export function axisForRelation(project, relation, member = null, endpoint = null) {
  if (relation?.type === "member-align-axis") {
    const origin = member && endpoint === "start" ? member.end : member && endpoint === "end" ? member.start : [0, 0, 0];
    const source = relation.source?.type === "global-axis"
      ? { ...relation.source, origin }
      : relation.source;
    return axisForSource(project, source, origin);
  }
  return axisForSource(project, relation?.source);
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
  if (relation.type === "member-align-axis") {
    const axis = relation.source?.axis ? relation.source.axis.toUpperCase() : "";
    return `Member aligned to ${axis ? `Global ${axis}` : relation.label || "axis"}`;
  }
  const endpoint = relation.endpoint === "start" ? "Start" : "End";
  const source = relation.source || {};
  const sourceLabel = relation.label || source.label || source.memberId || "axis";
  return `${endpoint} on ${sourceLabel}`;
}
