import { objectById } from "../core/model.mjs";
import {
  evaluateMemberInterface,
  memberFrame,
  memberFrameAt,
  memberLength,
  resolveMemberFaceRef,
  sectionBounds,
  sectionWebBounds
} from "./member-evaluator.mjs?v=weld-fitting-1";

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

export function resolveInterface(project, profiles, interfaceOrId, options = {}) {
  const iface = typeof interfaceOrId === "string" ? objectById(project, interfaceOrId) : interfaceOrId;
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
