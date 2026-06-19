import { objectById } from "../core/model.mjs";
import { finiteVec3 } from "../core/math.mjs";
import { requiredProfileById } from "../api/project/profiles.mjs";
import {
  evaluateMemberInterface,
  memberFrame,
  memberFrameAt,
  memberLength,
  resolveMemberFaceRef,
  sectionBounds,
  sectionWebBounds
} from "./member-evaluator.mjs";

function fail(message) {
  throw new Error(`member geometry: ${message}`);
}

export { memberFrame, memberFrameAt, memberLength, resolveMemberFaceRef, sectionBounds, sectionWebBounds };

function requiredArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function requiredObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function optionalReferencePoint(value, label) {
  if (value === undefined) return undefined;
  return finiteVec3(value, label, fail);
}

function rawInterface(project, interfaceOrId) {
  const iface = typeof interfaceOrId === "string" ? objectById(project, interfaceOrId) : interfaceOrId;
  if (!iface?.id) fail("interface id is required");
  return iface;
}

function interfaceNeedsConnectionReference(iface) {
  return iface.stationReference === "connection-secondary-interface-origin"
    || iface.faceRef === "connection-secondary-facing-section-face";
}

function connectionReferencePointForInterface(project, profiles, interfaceOrId) {
  const iface = rawInterface(project, interfaceOrId);
  const zones = requiredObject(requiredObject(project.model, "model").connectionZones, "model.connectionZones");
  const zone = Object.values(zones).find((item) => requiredArray(item.interfaceIds, `${item.id}.interfaceIds`).includes(iface.id));
  if (!zone) fail(`${iface.id}: connection reference requires a connection zone`);
  const candidates = requiredArray(zone.interfaceIds, `${zone.id}.interfaceIds`)
    .filter((id) => id !== iface.id)
    .map((id) => rawInterface(project, id))
    .filter((other) => !interfaceNeedsConnectionReference(other));
  if (candidates.length !== 1) fail(`${iface.id}: connection reference requires exactly one paired reference interface`);
  return resolveInterface(project, profiles, candidates[0]).origin;
}

export function resolveInterfaceWithConnectionReference(project, profiles, interfaceOrId, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("resolve options must be an object");
  const explicitReferencePoint = optionalReferencePoint(options.referencePoint, "resolve options referencePoint");
  const iface = rawInterface(project, interfaceOrId);
  const needsReference = interfaceNeedsConnectionReference(iface) || options.preferConnectionReference;
  if (!needsReference || explicitReferencePoint) return resolveInterface(project, profiles, iface, options);
  const referencePoint = connectionReferencePointForInterface(project, profiles, iface);
  return resolveInterface(project, profiles, iface, {
    ...options,
    referencePoint,
    preferReferencePoint: true
  });
}

export function resolveInterface(project, profiles, interfaceOrId, options = {}) {
  const iface = rawInterface(project, interfaceOrId);
  const objectIndex = requiredObject(project.objectIndex, "objectIndex");
  const ownerEntry = requiredObject(objectIndex[iface.ownerId], `objectIndex.${iface.ownerId}`);
  if (typeof ownerEntry.collection !== "string" || !ownerEntry.collection) fail(`objectIndex.${iface.ownerId}.collection must be a non-empty string`);
  if (ownerEntry.collection === "members") {
    const member = objectById(project, iface.ownerId);
    return evaluateMemberInterface(iface, member, requiredProfileById(profiles, member.profile, fail), options);
  }

  if (iface.type === "component-scope") {
    if (ownerEntry.collection !== "smartComponentInstances") fail(`${iface.id}: component-scope owner must be a smart component instance`);
    fail(`${iface.id}: component-scope interfaces are not resolvable geometry`);
  }
  if (iface.type !== "plate-face") fail(`${iface.id}: unsupported non-member interface type ${iface.type || "missing"}`);
  if (ownerEntry.collection !== "plates") fail(`${iface.id}: plate-face owner must be a plate`);

  for (const key of ["origin", "normal", "localAxisY", "localAxisZ"]) {
    finiteVec3(iface[key], `${iface.id}.${key}`, fail);
  }
  return iface;
}
