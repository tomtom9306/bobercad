import { createProjectCommandResult } from "./project-command-results.mjs";

function commandType(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("project command: type must be a non-empty string");
  }
  return value;
}

function idList(value, label) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`project command: ${label} must be an array of ids`);
  }
  return [...new Set(value)];
}

function indexedObject(project, objectId) {
  const entry = project?.objectIndex?.[objectId];
  const object = entry?.collection ? project?.model?.[entry.collection]?.[objectId] : null;
  return object === undefined ? null : object;
}

function objectChanged(previousProject, nextProject, objectId) {
  return JSON.stringify(indexedObject(previousProject, objectId)) !== JSON.stringify(indexedObject(nextProject, objectId));
}

export function deriveProjectCommandObjectIds(previousProject, nextProject, metadata = {}) {
  const hasExplicitChangeSet = metadata.changedObjectIds !== undefined && metadata.changedObjectIds !== null
    || metadata.removedObjectIds !== undefined && metadata.removedObjectIds !== null
    || metadata.regeneratedObjectIds !== undefined && metadata.regeneratedObjectIds !== null;
  if (hasExplicitChangeSet) {
    const removed = idList(metadata.removedObjectIds, "removedObjectIds") || [];
    const changed = (idList(metadata.changedObjectIds, "changedObjectIds") || []).filter((objectId) => !removed.includes(objectId));
    return {
      changedObjectIds: changed,
      removedObjectIds: removed,
      regeneratedObjectIds: idList(metadata.regeneratedObjectIds, "regeneratedObjectIds") || []
    };
  }
  const previousIds = new Set(Object.keys(previousProject?.objectIndex || {}));
  const nextIds = new Set(Object.keys(nextProject?.objectIndex || {}));
  const removed = [...previousIds].filter((objectId) => !nextIds.has(objectId));
  const changed = new Set();
  for (const objectId of nextIds) {
    if (!previousIds.has(objectId) || objectChanged(previousProject, nextProject, objectId)) changed.add(objectId);
  }
  for (const objectId of removed) changed.delete(objectId);
  return {
    changedObjectIds: [...changed],
    removedObjectIds: [...new Set(removed)],
    regeneratedObjectIds: []
  };
}

export function createProjectCommand({
  type,
  apply,
  changedObjectIds,
  removedObjectIds,
  regeneratedObjectIds,
  diagnostics,
  recordHistory = true
} = {}) {
  if (typeof apply !== "function") throw new Error("project command: apply must be a function");
  return Object.freeze({
    type: commandType(type),
    apply,
    changedObjectIds: idList(changedObjectIds, "changedObjectIds"),
    removedObjectIds: idList(removedObjectIds, "removedObjectIds"),
    regeneratedObjectIds: idList(regeneratedObjectIds, "regeneratedObjectIds"),
    diagnostics: Array.isArray(diagnostics) ? diagnostics.slice() : [],
    recordHistory: recordHistory !== false
  });
}

export function executeProjectCommand(command, previousProject) {
  const nextProject = command.apply(previousProject);
  if (!nextProject || typeof nextProject !== "object" || Array.isArray(nextProject)) {
    throw new Error(`project command ${command.type}: apply must return a project object`);
  }
  const derived = deriveProjectCommandObjectIds(previousProject, nextProject, command);
  return createProjectCommandResult({
    project: nextProject,
    commandType: command.type,
    changedObjectIds: derived.changedObjectIds,
    removedObjectIds: derived.removedObjectIds,
    regeneratedObjectIds: derived.regeneratedObjectIds,
    diagnostics: command.diagnostics
  });
}
