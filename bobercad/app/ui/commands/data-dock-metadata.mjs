export const DATA_DOCK_PANEL_ID = "library";
export const DATA_DOCK_PANEL_LABEL = "Data";
export const DATA_DOCK_PANEL_DESCRIPTION = "Project, files, reference import, data, model browser, connections, and Smart Component library dock.";
export const DATA_DOCK_PANEL_ICON = "database";
export const DATA_DOCK_PANEL_DOCK = "left";
export const DATA_DOCK_PANEL_DEFAULT_WIDTH = 300;
export const DATA_DOCK_PANEL_MIN_WIDTH = 220;
export const DATA_DOCK_PANEL_MAX_WIDTH = 520;
export const DATA_DOCK_PANEL_DEFAULT_VISIBLE = true;
export const DATA_DOCK_PANEL_DEFAULT_PINNED = true;
export const DATA_DOCK_COMMAND_LABEL = "Data Dock";
export const DATA_DOCK_COMMAND_TITLE = "Toggle data dock";
export const DATA_DOCK_COMMAND_DESCRIPTION = "Show or hide the Project, Files, Import, Data, Model, Connections, and Components dock.";
export const DATA_DOCK_COMMAND_ICON = DATA_DOCK_PANEL_ICON;
export const DATA_DOCK_DEFAULT_TAB = "model";

export const DATA_DOCK_TABS = Object.freeze([
  {
    id: "project",
    label: "Project",
    icon: "file",
    panelElementId: "project-properties-panel",
    commandId: "data.dock.showProject",
    action: "onDataDockShowProject",
    title: "Show project properties",
    description: "Show project identity, revision, client, and project metadata."
  },
  {
    id: "files",
    label: "Files",
    icon: "file",
    panelElementId: "project-files-panel",
    commandId: "data.dock.showFiles",
    action: "onDataDockShowFiles",
    title: "Show files tab",
    description: "Show project JSON, viewer workspace, and declared library config files in the Data Dock."
  },
  {
    id: "reference-import",
    label: "Import",
    icon: "reference-plane",
    panelElementId: "reference-import-panel",
    commandId: "data.dock.showReferenceImport",
    action: "onDataDockShowReferenceImport",
    title: "Show reference import tab",
    description: "Show isolated reference geometry import session state in the Data Dock."
  },
  {
    id: "data",
    label: "Data",
    icon: "database",
    panelElementId: "project-data-panel",
    commandId: "data.dock.showData",
    action: "onDataDockShowData",
    title: "Show data tab",
    description: "Show library packs, model contents, and project settings in the Data Dock."
  },
  {
    id: "model",
    label: "Model",
    icon: "model-browser",
    panelElementId: "model-browser",
    commandId: "data.dock.showModel",
    action: "onDataDockShowModel",
    title: "Show model tab",
    description: "Show the searchable project model browser in the Data Dock."
  },
  {
    id: "connections",
    label: "Connections",
    icon: "interface",
    panelElementId: "connection-component-library",
    commandId: "data.dock.showConnections",
    action: "onDataDockShowConnections",
    title: "Show connections tab",
    description: "Show connection Smart Component presets in the Data Dock."
  },
  {
    id: "components",
    label: "Components",
    icon: "smart-component",
    panelElementId: "smart-component-library",
    commandId: "data.dock.showComponents",
    action: "onDataDockShowComponents",
    title: "Show components tab",
    description: "Show the Smart Component library in the Data Dock."
  }
]);

export function dataDockTabLabel(tabId) {
  return DATA_DOCK_TABS.find((tab) => tab.id === tabId)?.label || String(tabId || "");
}
