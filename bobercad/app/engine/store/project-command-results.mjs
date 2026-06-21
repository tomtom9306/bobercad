function idList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`project command result: ${label} must be an array of ids`);
  }
  return [...new Set(value)];
}

function diagnostics(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("project command result: diagnostics must be an array");
  return value.slice();
}

export function createProjectCommandResult({
  project,
  commandType,
  changedObjectIds,
  removedObjectIds,
  regeneratedObjectIds,
  diagnostics: resultDiagnostics
}) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("project command result: project must be an object");
  }
  return Object.freeze({
    project,
    commandType: typeof commandType === "string" && commandType ? commandType : "project.update",
    changedObjectIds: Object.freeze(idList(changedObjectIds, "changedObjectIds")),
    removedObjectIds: Object.freeze(idList(removedObjectIds, "removedObjectIds")),
    regeneratedObjectIds: Object.freeze(idList(regeneratedObjectIds, "regeneratedObjectIds")),
    diagnostics: Object.freeze(diagnostics(resultDiagnostics))
  });
}
