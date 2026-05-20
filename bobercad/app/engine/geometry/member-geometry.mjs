import { objectById } from "../core/model.mjs";
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

function profileById(profiles, profileId) {
  const profile = profiles?.[profileId] || profiles?.profiles?.[profileId];
  if (!profile) fail(`profile not found: ${profileId}`);
  return profile;
}

export { memberFrame, memberFrameAt, memberLength, resolveMemberFaceRef, sectionBounds, sectionWebBounds };

export function resolveMemberInterface(iface, member, profile, options = {}) {
  return evaluateMemberInterface(iface, member, profile, options);
}

function stationReferenceError(error) {
  return String(error?.message || "").includes("stationReference requires a connection reference point");
}

function rawInterface(project, interfaceOrId) {
  return typeof interfaceOrId === "string" ? objectById(project, interfaceOrId) : interfaceOrId;
}

export function connectionZoneForInterface(project, interfaceId) {
  return Object.values(project.model.connectionZones || {}).find((zone) => (zone.interfaceIds || []).includes(interfaceId)) || null;
}

export function connectionReferencePointForInterface(project, profiles, interfaceOrId) {
  const iface = rawInterface(project, interfaceOrId);
  const zone = connectionZoneForInterface(project, iface.id);
  if (!zone) return null;
  for (const otherId of (zone.interfaceIds || []).filter((id) => id !== iface.id)) {
    try {
      return resolveInterface(project, profiles, otherId).origin;
    } catch (error) {
      if (!stationReferenceError(error)) throw error;
    }
  }
  return Array.isArray(zone.origin) ? zone.origin : null;
}

export function resolveInterfaceWithConnectionReference(project, profiles, interfaceOrId, options = {}) {
  const iface = rawInterface(project, interfaceOrId);
  const needsReference = iface.stationReference === "connection-secondary-interface-origin"
    || iface.faceRef === "connection-secondary-facing-section-face"
    || options.preferConnectionReference;
  if (!needsReference || Array.isArray(options.referencePoint)) return resolveInterface(project, profiles, iface, options);
  const referencePoint = connectionReferencePointForInterface(project, profiles, iface);
  return resolveInterface(project, profiles, iface, referencePoint ? {
    ...options,
    referencePoint,
    preferReferencePoint: true
  } : options);
}

export function resolveInterface(project, profiles, interfaceOrId, options = {}) {
  const iface = rawInterface(project, interfaceOrId);
  const ownerEntry = project.objectIndex?.[iface.ownerId];
  if (ownerEntry?.collection === "members") {
    const member = objectById(project, iface.ownerId);
    return resolveMemberInterface(iface, member, profileById(profiles, member.profile), options);
  }

  for (const key of ["origin", "normal", "localAxisY", "localAxisZ"]) {
    if (!Array.isArray(iface[key])) fail(`${iface.id}: non-member interface missing ${key}`);
  }
  return iface;
}
