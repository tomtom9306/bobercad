import { jsonClone as clone } from "../core/model.mjs";
import { createProjectCommandResult } from "./project-command-results.mjs";

function addIds(target, ids) {
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    if (typeof id !== "string" || !id) throw new Error("project transaction: object id must be a non-empty string");
    target.add(id);
  }
}

export function createProjectTransaction(project, { commandType = "project.update", cloneProject = true } = {}) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("project transaction: project must be an object");
  }
  const changedObjectIds = new Set();
  const removedObjectIds = new Set();
  const regeneratedObjectIds = new Set();
  const diagnostics = [];
  return {
    commandType,
    project: cloneProject ? clone(project) : project,

    changed(ids) {
      addIds(changedObjectIds, ids);
      return this;
    },

    removed(ids) {
      addIds(removedObjectIds, ids);
      return this;
    },

    regenerated(ids) {
      addIds(regeneratedObjectIds, ids);
      addIds(changedObjectIds, ids);
      return this;
    },

    diagnostic(diagnostic) {
      diagnostics.push(diagnostic);
      return this;
    },

    result(nextProject = this.project) {
      return createProjectCommandResult({
        project: nextProject,
        commandType,
        changedObjectIds: [...changedObjectIds],
        removedObjectIds: [...removedObjectIds],
        regeneratedObjectIds: [...regeneratedObjectIds],
        diagnostics
      });
    }
  };
}
