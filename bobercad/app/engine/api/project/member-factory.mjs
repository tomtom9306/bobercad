import { finiteNumber, v } from "../../core/math.mjs";
import { nextObjectId } from "./objects.mjs";
import { vec3 } from "./members.mjs";

const EPSILON = 1e-9;
const definedObject = (fields) => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

function fail(message) {
  throw new Error(`member factory: ${message}`);
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function markPrefix(type) {
  return type === "column" ? "C" : "B";
}

function memberDefaultEntries(project) {
  project = requiredObject(project, "project");
  const modelDefaults = optionalObject(project.modelDefaults, {}, "modelDefaults");
  const collections = optionalObject(modelDefaults.collections, {}, "modelDefaults.collections");
  const defaults = optionalObject(collections.members, {}, "modelDefaults.collections.members");
  for (const [key, value] of Object.entries(defaults)) {
    requiredObject(value, `modelDefaults.collections.members.${key}`);
  }
  return defaults;
}

function typeDefaults(project, type) {
  const defaults = memberDefaultEntries(project);
  const preferredKeys = type === "column"
    ? ["column", "supporting-column", "primary-column"]
    : ["beam", "supported-beam", "supporting-beam", "primary-beam"];
  for (const key of preferredKeys) {
    if (defaults[key]) return defaults[key];
  }
  return {};
}

function projectDefaultMaterial(project) {
  const material = memberDefaultEntries(project)["*"]?.material;
  return optionalString(material, undefined, "modelDefaults.collections.members.*.material");
}

function defaultProfileId(project, type) {
  const typeDefault = typeDefaults(project, type);
  if (typeDefault.profile !== undefined) return optionalString(typeDefault.profile, undefined, `${type}: modelDefaults.collections.members profile`);
  fail(`${type}: modelDefaults.collections.members profile is required`);
}

function optionalFiniteNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!finiteNumber(value)) fail(`${label} must be a finite number`);
  return value;
}

function optionalObject(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function optionalString(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function optionalEndpoint(value, fallback, label) {
  const endpoint = optionalString(value, fallback, label);
  if (endpoint !== undefined && endpoint !== "start" && endpoint !== "end") fail(`${label} must be start or end`);
  return endpoint;
}

function optionalPositiveInteger(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function setOptionalString(target, key, value, label) {
  if (value !== undefined) target[key] = optionalString(value, undefined, label);
}

function setOptionalObject(target, key, value, label) {
  if (value !== undefined) target[key] = requiredObject(value, label);
}

function existingMemberNumber(project, type) {
  const prefix = type === "column" ? "column" : "beam";
  let max = 0;
  const members = requiredObject(requiredObject(project, "project").model, "project.model").members;
  requiredObject(members, "project.model.members");
  for (const id of Object.keys(members)) {
    const match = id.match(new RegExp(`^${prefix}_(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function snapRef(snap) {
  if (snap === undefined || snap === null) return null;
  if (typeof snap !== "object" || Array.isArray(snap)) fail("snap reference must be an object");
  if (snap.sources !== undefined && !Array.isArray(snap.sources)) fail("snap reference sources must be an array");
  if (Array.isArray(snap.sources) && !snap.sources.length) fail("snap reference sources cannot be empty");
  const ref = {
    type: optionalString(snap.type, undefined, "snap reference type"),
    objectId: optionalString(snap.objectId, undefined, "snap reference objectId"),
    axis: optionalString(snap.axis, undefined, "snap reference axis"),
    endpoint: optionalEndpoint(snap.endpoint, undefined, "snap reference endpoint"),
    label: optionalString(snap.label, undefined, "snap reference label"),
    sources: Array.isArray(snap.sources)
      ? snap.sources.map((source) => {
        if (!source || typeof source !== "object" || Array.isArray(source)) fail("snap reference source must be an object");
        const next = definedObject({
          type: optionalString(source.type, undefined, "snap reference source type"),
          objectId: optionalString(source.objectId, undefined, "snap reference source objectId"),
          axis: optionalString(source.axis, undefined, "snap reference source axis"),
          label: optionalString(source.label, undefined, "snap reference source label")
        });
        if (!Object.keys(next).length) fail("snap reference source must include at least one field");
        return next;
      })
      : undefined
  };
  const next = definedObject(ref);
  if (!Object.keys(next).length) fail("snap reference must include at least one field");
  return next;
}

function authoringSnapRefs(startSnap, endSnap) {
  const refs = {};
  const start = snapRef(startSnap);
  const end = snapRef(endSnap);
  if (start) refs.start = start;
  if (end) refs.end = end;
  return Object.keys(refs).length ? refs : null;
}

function layoutAxisObject(value, start, end, label) {
  if (value === undefined) return { start, end };
  const axis = requiredObject(value, label);
  return {
    start: vec3(axis.start, `${label}.start`),
    end: vec3(axis.end, `${label}.end`)
  };
}

export function createMemberObject(project, options = {}) {
  options = optionalObject(options, {}, "member options");
  const type = options.type === "column" ? "column" : options.type === "beam" ? "beam" : null;
  if (!type) fail(`unsupported member type ${options.type}`);

  const start = vec3(options.start, `${type} start`);
  const end = vec3(options.end, `${type} end`);
  if (v.len(v.sub(end, start)) <= EPSILON) fail(`${type} cannot have zero length`);

  const number = options.number === undefined
    ? existingMemberNumber(project, type)
    : optionalPositiveInteger(options.number, undefined, `${type} number`);
  const id = options.id === undefined
    ? nextObjectId(project, `${type}_${number}`)
    : optionalString(options.id, undefined, `${type} id`);
  const mark = optionalString(options.mark, `${markPrefix(type)}${number}`, `${type} mark`);
  const profile = options.profile === undefined
    ? defaultProfileId(project, type)
    : optionalString(options.profile, undefined, `${type} profile`);
  const material = options.material === undefined
    ? projectDefaultMaterial(project)
    : optionalString(options.material, undefined, `${type} material`);
  const modelType = optionalString(options.memberType, type, `${type} memberType`);
  const fabrication = optionalObject(options.fabrication, {}, `${type} fabrication`);
  const display = optionalObject(options.display, {}, `${type} display`);
  const bim = optionalObject(options.bim, {}, `${type} bim`);
  const bimPropertySets = optionalObject(bim.propertySets, {}, `${type} bim.propertySets`);
  const defaultBim = {
    name: `${titleCase(type)} ${mark}`,
    propertySets: {
      Identity: {
        mark
      }
    }
  };
  const member = {
    id,
    type: modelType,
    profile,
    material,
    start,
    end,
    layoutAxis: layoutAxisObject(options.layoutAxis, start, end, `${type} layoutAxis`),
    rotation: optionalFiniteNumber(options.rotation, 0, `${type} rotation`),
    cardinalPoint: optionalString(options.cardinalPoint, "middle-center", `${type} cardinalPoint`),
    fabrication: {
      ...fabrication,
      partMark: optionalString(fabrication.partMark, mark, `${type} fabrication.partMark`)
    },
    display: {
      color: type === "column" ? "#406b85" : "#3f657d",
      ...display
    },
    bim: {
      ...defaultBim,
      ...bim,
      propertySets: {
        ...defaultBim.propertySets,
        ...bimPropertySets
      }
    },
    authoring: {
      source: optionalString(options.source, "viewer-command", `${type} source`),
      command: type === "column" ? "create-column" : "create-beam"
    }
  };

  const snapRefs = authoringSnapRefs(options.startSnap, options.endSnap);
  if (snapRefs) member.authoring.snapRefs = snapRefs;
  setOptionalString(member, "startPointRef", options.startPointRef, `${type} startPointRef`);
  setOptionalString(member, "endPointRef", options.endPointRef, `${type} endPointRef`);
  setOptionalObject(member, "centerline", options.centerline, `${type} centerline`);
  setOptionalObject(member, "sectionPlacement", options.sectionPlacement, `${type} sectionPlacement`);
  setOptionalObject(member, "shapeModifiers", options.shapeModifiers, `${type} shapeModifiers`);
  setOptionalObject(member, "placementIntent", options.placementIntent, `${type} placementIntent`);
  setOptionalString(member, "assemblyId", options.assemblyId, `${type} assemblyId`);
  return member;
}

export function createPreviewMember(project, profiles, options = {}) {
  options = optionalObject(options, {}, "preview member options");
  const display = optionalObject(options.display, {}, "preview member display");
  return createMemberObject(project, {
    ...options,
    id: `preview_${options.type === "column" ? "column" : "beam"}`,
    mark: "PREVIEW",
    display: {
      ...display,
      transparent: true,
      opacity: display.opacity ?? 0.32,
      edgeColor: "#2563eb"
    },
    source: "viewer-command-preview"
  });
}
