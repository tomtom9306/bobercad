import { commandPaletteSpecs } from "../commands/command-registry.mjs?v=visibility-menu-1";
import { commandGroupLabel } from "../commands/command-group-metadata.mjs?v=command-groups-1";
import { DATA_DOCK_COMMAND_LABEL, DATA_DOCK_PANEL_ID } from "../commands/data-dock-metadata.mjs?v=data-dock-metadata-1";
import { INSPECTOR_COMMAND_LABEL, INSPECTOR_PANEL_ID } from "../commands/inspector-dock-metadata.mjs?v=inspector-dock-metadata-1";

export function createViewerCommandItems({
  app = null,
  actionHandlers = {},
  shortcutLabelFor = () => "",
  commandStateFor = () => ({}),
  includeState = true
} = {}) {
  return commandPaletteSpecs()
    .filter((command) => app?.canRunCommand?.(command.id) || typeof actionHandlers[command.action] === "function")
    .map((command) => {
      const groupLabel = command.groupLabel || commandGroupLabel(command.group);
      const runtimeState = includeState ? combinedCommandState(command, app, commandStateFor) : {};
      return {
        ...command,
        ...runtimeState,
        groupLabel,
        shortcutLabel: shortcutLabelFor(command),
        run: () => {
          const nextState = includeState ? combinedCommandState(command, app, commandStateFor) : {};
          if (nextState.enabled === false) return false;
          return app?.canRunCommand?.(command.id) ? app.runCommand(command.id) : actionHandlers[command.action]();
        }
      };
    });
}

function combinedCommandState(command, app, commandStateFor) {
  return {
    ...viewerCommandState(command, app),
    ...(commandStateFor?.(command) || {})
  };
}

function viewerCommandState(command, app) {
  const activeCommandId = app?.commandState?.().activeCommandId || null;
  const state = { enabled: true, active: activeCommandId === command.id };
  if (["view.fitSelection", "selection.clear"].includes(command.id) && !selectedObjectIds(app).length) {
    return {
      ...state,
      enabled: false,
      disabledReason: command.id === "selection.clear"
        ? "Select something to clear."
        : "Select an object to frame it."
    };
  }
  return state;
}

function selectedObjectIds(app) {
  const ids = app?.selectionState?.().selectedObjectIds;
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

export function createViewerPanelCommandActions({
  libraryPanel,
  inspectorPanel,
  toolbar,
  statusBar,
  getWorkspace = () => null,
  setStatus = () => {}
} = {}) {
  const toggleDockPanel = (panelId, panel, label) => {
    const workspace = getWorkspace?.();
    if (workspace?.togglePanel?.(panelId) !== undefined) return;
    if (!panel) return;
    panel.hidden = !panel.hidden;
    setStatus(`${label} ${panel.hidden ? "hidden" : "shown"}.`);
  };

  const toggleSnapSettings = () => {
    const bottomStripOpen = statusBar?.toggleSnapSettings?.();
    if (typeof bottomStripOpen === "boolean") {
      setStatus(`Snap settings ${bottomStripOpen ? "opened" : "closed"}.`);
      return bottomStripOpen;
    }
    const snapPanel = toolbar?.querySelector?.(".snap-manager");
    if (!snapPanel) return false;
    snapPanel.open = !snapPanel.open;
    setStatus(`Snap settings ${snapPanel.open ? "opened" : "closed"}.`);
    return snapPanel.open;
  };

  return {
    onLibraryToggle: () => toggleDockPanel(DATA_DOCK_PANEL_ID, libraryPanel, DATA_DOCK_COMMAND_LABEL),
    onInspectorToggle: () => toggleDockPanel(INSPECTOR_PANEL_ID, inspectorPanel, INSPECTOR_COMMAND_LABEL),
    onSnapSettingsToggle: () => toggleSnapSettings()
  };
}
