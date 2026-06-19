export function createViewerAppController({
  projectStore,
  selectionController,
  settings = {},
  commandHandlers = {},
  getCommandController = () => null,
  getTrimCreate = () => null,
  getEditorApi = () => null,
  getWorkspace = () => null,
  getActiveCommandId = () => null,
  focusObjectIds = () => false
} = {}) {
  const handlers = new Map(Object.entries(commandHandlers));
  const app = {
    project() {
      return projectStore?.project?.() || null;
    },

    subscribe(listener) {
      return projectStore?.subscribe?.(listener) || (() => {});
    },

    registerCommand(commandId, handler) {
      if (!commandId || typeof handler !== "function") return () => {};
      handlers.set(commandId, handler);
      return () => handlers.delete(commandId);
    },

    registerCommands(nextHandlers = {}) {
      const disposers = Object.entries(nextHandlers).map(([commandId, handler]) => app.registerCommand(commandId, handler));
      return () => disposers.forEach((dispose) => dispose());
    },

    canRunCommand(commandId) {
      return handlers.has(commandId);
    },

    runCommand(commandId, input) {
      const handler = handlers.get(commandId);
      if (!handler) throw new Error(`viewer app: command is not registered: ${commandId}`);
      return handler(input, app);
    },

    cancelCommand() {
      if (getTrimCreate()?.cancel?.()) return true;
      getCommandController()?.cancel?.();
      return true;
    },

    commandState() {
      const command = getCommandController()?.activeCommand?.() || null;
      const modelingActive = Boolean(command?.active?.() ?? command);
      const trimActive = Boolean(getTrimCreate()?.active?.());
      const storedCommandId = getActiveCommandId?.() || null;
      const activeCommandId = trimActive ? "model.trim.create" : storedCommandId;
      return {
        active: Boolean(activeCommandId || modelingActive || trimActive),
        activeCommand: activeCommandId || (modelingActive ? "modeling" : trimActive ? "trim" : null),
        activeCommandId
      };
    },

    activeToolState() {
      const command = getCommandController()?.activeCommand?.() || null;
      const trimCreate = getTrimCreate?.() || null;
      const commandActive = Boolean(command?.active?.());
      const trimActive = Boolean(trimCreate?.active?.());
      return {
        status: trimActive
          ? "Trim: pick two members"
          : typeof command?.status === "function"
            ? command.status()
            : commandActive ? "Use the canvas to complete the active tool." : "Idle",
        canCycleSnap: Boolean(commandActive && typeof command?.cycleSnap === "function"),
        needsPointerHit: typeof command?.needsPointerHit === "function" ? command.needsPointerHit() : true
      };
    },

    cycleActiveSnap() {
      const command = getCommandController()?.activeCommand?.() || null;
      if (typeof command?.cycleSnap !== "function") return false;
      return command.cycleSnap();
    },

    selectionState() {
      const editorState = getEditorApi()?.selectedState?.() || {};
      return {
        selectedObjectIds: selectedObjectIds(selectionController?.selectedIds?.(), editorState),
        selectedSmartComponentId: editorState.smartComponentId || null,
        scope: selectionController?.scope?.() || {},
        pickMode: selectionController?.pickMode?.() || null
      };
    },

    snapSettings() {
      return {
        ...(settings.authoring?.snap || {}),
        scope: selectionController?.scope?.() || {}
      };
    },

    selectObject(objectId, detail) {
      return getEditorApi()?.selectObject?.(objectId, detail);
    },

    selectSmartComponent(smartComponentId, options) {
      return getEditorApi()?.selectSmartComponent?.(smartComponentId, options);
    },

    clearSelection(options) {
      getEditorApi()?.clearSelection?.(options);
      return selectionController?.clear?.();
    },

    focusSelection(objectIds) {
      const ids = Array.isArray(objectIds) && objectIds.length
        ? objectIds
        : app.selectionState().selectedObjectIds;
      return focusObjectIds(ids);
    },

    setSnapSettings(patch = {}) {
      settings.authoring = settings.authoring || {};
      settings.authoring.snap = { ...(settings.authoring.snap || {}) };
      if (patch.scope && typeof selectionController?.setScope === "function") {
        settings.authoring.snap.scope = selectionController.setScope(patch.scope);
      }
      for (const [key, value] of Object.entries(patch)) {
        if (key !== "scope") settings.authoring.snap[key] = value;
      }
      return settings.authoring.snap;
    },

    setWorkspacePatch(patch = {}) {
      return getWorkspace()?.setWorkspacePatch?.(patch) || null;
    },

    resetWorkspace() {
      return getWorkspace()?.resetWorkspace?.() || null;
    }
  };

  return app;
}

function selectedObjectIds(selectionIds = [], editorState = {}) {
  const ids = Array.isArray(selectionIds) ? selectionIds : [];
  return uniqueTruthy([...ids, editorState.memberId, editorState.objectId]);
}

function uniqueTruthy(values = []) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}
