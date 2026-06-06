import { createMemberObject } from "../project/member-factory.mjs?v=smart-components-1";
import { addIndexedObject } from "../project/objects.mjs";
import { createSemanticBuilders } from "./builders.mjs";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function fail(message) {
  throw new Error(`authoring context: ${message}`);
}

export function createAuthoringContext({ project, profiles, source = "authoring-api", commit = true, idPrefix = "", onAdd = null }) {
  const next = commit ? clone(project) : project;
  const roles = {};
  const ctx = {
    project: next,
    profiles,
    roles,
    id(role) {
      return role.includes(":") || role.includes("_") ? role : `${idPrefix}${role}`;
    },
    role(role, id) {
      if (roles[role] && roles[role] !== id) fail(`role ${role} already assigned to ${roles[role]}`);
      roles[role] = id;
    },
    add(collection, id, object) {
      const stored = { ...object, id };
      addIndexedObject(next, collection, stored);
      onAdd?.(collection, id, stored);
      return stored;
    },
    createMember(role, data) {
      const member = createMemberObject(next, profiles, {
        ...data,
        source: data.source || source
      });
      ctx.add("members", member.id, member);
      ctx.role(role, member.id);
      return member;
    },
    attachFeature(ownerId, featureId) {
      const entry = next.objectIndex?.[ownerId];
      const collection = entry?.collection;
      if (!["members", "plates"].includes(collection)) fail(`${ownerId}: features can only attach to members or plates`);
      const owner = next.model[collection]?.[ownerId];
      if (!owner) fail(`${ownerId}: feature owner not found`);
      owner.featureIds = [...new Set([...(owner.featureIds || []), featureId])];
    },
    fail
  };
  Object.assign(ctx, createSemanticBuilders(ctx));
  return {
    ctx,
    project: () => next,
    roles: () => ({ ...roles })
  };
}
