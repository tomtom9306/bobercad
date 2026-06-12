import { arrayValues, objectById } from "../core/model.mjs?v=geometry-api-array-values-dry-1";
import { requiredProfileById } from "../api/project/profiles.mjs?v=profile-api-dry-1";
import {
  evaluateMemberInterface,
  memberFrame,
  memberFrameAt,
  memberLength,
  resolveMemberFaceRef,
  sectionBounds,
  sectionWebBounds
} from "./member-evaluator.mjs?v=geometry-api-array-values-dry-1";

function fail(message) {
  throw new Error(`member geometry: ${message}`);
}

export { memberFrame, memberFrameAt, memberLength, resolveMemberFaceRef, sectionBounds, sectionWebBounds };

function stationReferenceError(error) {
  return String(error?.message || "").includes("stationReference requires a connection reference point");
}

function rawInterface(project, interfaceOrId) {
  return typeof interfaceOrId === "string" ? objectById(project, interfaceOrId) : interfaceOrId;
}

function connectionReferencePointForInterface(project, profiles, interfaceOrId) {
  const iface = rawInterface(project, interfaceOrId);
  const zone = Object.values(project.model.connectionZones || {}).find((item) => arrayValues(item.interfaceIds).includes(iface.id)) || null;
  if (!zone) return null;
  for (const otherId of arrayValues(zone.interfaceIds).filter((id) => id !== iface.id)) {
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
    return evaluateMemberInterface(iface, member, requiredProfileById(profiles, member.profile, fail), options);
  }

  for (const key of ["origin", "normal", "localAxisY", "localAxisZ"]) {
    if (!Array.isArray(iface[key])) fail(`${iface.id}: non-member interface missing ${key}`);
  }
  return iface;
}
