import { v } from "../../core/math.mjs";
import { nextObjectId } from "./objects.mjs";
import { vec3 } from "./members.mjs";

const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`member factory: ${message}`);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function markPrefix(type) {
  return type === "column" ? "C" : "B";
}

function typeDefaults(project, type) {
  const defaults = project.modelDefaults?.collections?.members || {};
  const preferredKeys = type === "column"
    ? ["column", "supporting-column", "primary-column"]
    : ["beam", "supported-beam", "supporting-beam", "primary-beam"];
  for (const key of preferredKeys) {
    if (defaults[key]) return { key, defaults: defaults[key] };
  }
  const entry = Object.entries(defaults).find(([key, value]) => key !== "*" && value?.profile);
  return entry ? { key: entry[0], defaults: entry[1] } : { key: type, defaults: {} };
}

function projectDefaultMaterial(project) {
  return project.modelDefaults?.collections?.members?.["*"]?.material || "S355";
}

function defaultProfileId(project, profiles, type) {
  const typeDefault = typeDefaults(project, type).defaults;
  if (typeDefault.profile) return typeDefault.profile;
  const ids = Object.keys(profiles || {});
  if (!ids.length) fail("no profiles are available");
  return ids[0];
}

function existingMemberNumber(project, type) {
  const prefix = type === "column" ? "column" : "beam";
  let max = 0;
  for (const id of Object.keys(project.model?.members || {})) {
    const match = id.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function snapRef(snap) {
  if (!snap) return null;
  const ref = {
    type: snap.type,
    objectId: snap.objectId || undefined,
    axis: snap.axis || undefined,
    endpoint: snap.endpoint || undefined,
    label: snap.label || undefined,
    sources: Array.isArray(snap.sources)
      ? snap.sources.map((source) => Object.fromEntries(Object.entries({
          type: source.type,
          objectId: source.objectId,
          axis: source.axis,
          label: source.label
        }).filter(([, value]) => value !== undefined)))
      : undefined
  };
  return Object.fromEntries(Object.entries(ref).filter(([, value]) => value !== undefined));
}

function authoringSnapRefs(startSnap, endSnap) {
  const refs = {};
  const start = snapRef(startSnap);
  const end = snapRef(endSnap);
  if (start) refs.start = start;
  if (end) refs.end = end;
  return Object.keys(refs).length ? refs : null;
}

export function createMemberObject(project, profiles, options = {}) {
  const type = options.type === "column" ? "column" : options.type === "beam" ? "beam" : null;
  if (!type) fail(`unsupported member type ${options.type}`);

  const start = vec3(options.start, `${type} start`);
  const end = vec3(options.end, `${type} end`);
  if (v.len(v.sub(end, start)) <= EPSILON) fail(`${type} cannot have zero length`);

  const number = options.number || existingMemberNumber(project, type);
  const id = options.id || nextObjectId(project, `${type}_${number}`);
  const mark = options.mark || `${markPrefix(type)}${number}`;
  const profile = options.profile || options.profileId || defaultProfileId(project, profiles, type);
  const material = options.material || projectDefaultMaterial(project);
  const modelType = options.memberType || type;
  const member = {
    id,
    type: modelType,
    profile,
    material,
    start,
    end,
    rotation: options.rotation || 0,
    cardinalPoint: options.cardinalPoint || "middle-center",
    fabrication: {
      partMark: mark
    },
    display: {
      color: type === "column" ? "#406b85" : "#3f657d",
      ...(options.display || {})
    },
    bim: {
      name: `${titleCase(type)} ${mark}`,
      propertySets: {
        Identity: {
          mark
        }
      }
    },
    authoring: {
      source: options.source || "viewer-command",
      command: type === "column" ? "create-column" : "create-beam"
    }
  };

  const snapRefs = authoringSnapRefs(options.startSnap, options.endSnap);
  if (snapRefs) member.authoring.snapRefs = snapRefs;
  if (options.startPointRef) member.startPointRef = options.startPointRef;
  if (options.endPointRef) member.endPointRef = options.endPointRef;
  if (options.layoutAxis) member.layoutAxis = options.layoutAxis;
  return member;
}

export function createPreviewMember(project, profiles, options = {}) {
  return createMemberObject(project, profiles, {
    ...options,
    id: `preview_${options.type === "column" ? "column" : "beam"}`,
    mark: "PREVIEW",
    display: {
      ...(options.display || {}),
      transparent: true,
      opacity: options.display?.opacity ?? 0.32,
      edgeColor: "#2563eb"
    },
    source: "viewer-command-preview"
  });
}
