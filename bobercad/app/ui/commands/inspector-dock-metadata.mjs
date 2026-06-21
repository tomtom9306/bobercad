export const INSPECTOR_PANEL_ID = "inspector";
export const INSPECTOR_PANEL_LABEL = "Properties";
export const INSPECTOR_PANEL_DESCRIPTION = "Contextual properties and edit panels.";
export const INSPECTOR_PANEL_ICON = "inspector";
export const INSPECTOR_PANEL_DOCK = "right";
export const INSPECTOR_PANEL_DEFAULT_WIDTH = 380;
export const INSPECTOR_PANEL_MIN_WIDTH = 280;
export const INSPECTOR_PANEL_MAX_WIDTH = 720;
export const INSPECTOR_PANEL_DEFAULT_VISIBLE = true;
export const INSPECTOR_COMMAND_LABEL = "Properties";
export const INSPECTOR_COMMAND_TITLE = "Toggle properties";
export const INSPECTOR_COMMAND_DESCRIPTION = "Show or hide the contextual properties dock.";
export const INSPECTOR_COMMAND_ICON = "inspector";
export const INSPECTOR_DEFAULT_CONTEXT = "properties";

export const INSPECTOR_CONTEXTS = Object.freeze([
  {
    id: "properties",
    label: "Properties",
    commandId: "inspector.context.properties",
    action: "onInspectorContextProperties",
    title: "Show properties",
    description: "Generated properties for the current selection.",
    icon: "inspector",
    panelSlot: "properties"
  },
  {
    id: "feature",
    label: "Feature",
    commandId: "inspector.context.feature",
    action: "onInspectorContextFeature",
    title: "Show feature editor",
    description: "Advanced feature and cutting-body editor.",
    icon: "feature",
    panelSlot: "feature"
  },
  {
    id: "component",
    label: "Component",
    commandId: "inspector.context.component",
    action: "onInspectorContextComponent",
    title: "Show component parameters",
    description: "Smart Component parameters and diagnostics.",
    icon: "smart-component",
    panelSlot: "component"
  }
]);

export function inspectorContextSpec(contextId) {
  return INSPECTOR_CONTEXTS.find((context) => context.id === contextId) || null;
}

export function inspectorContextLabel(contextId) {
  return inspectorContextSpec(contextId)?.label || String(contextId || "");
}
