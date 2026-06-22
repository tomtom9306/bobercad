export const SMART_COMPONENT_BROWSER_PANEL_SPEC = Object.freeze({
  title: "Components",
  icon: "smart-component",
  searchPlaceholder: "Search components",
  searchLabel: "Search Smart Components",
  emptyMessage: "No matching components.",
  itemCountLabel: "presets",
  collectionLabel: "Presets",
  readyLabel: "Ready",
  statusMetaFallback: "status"
});

export const SMART_COMPONENT_CONNECTION_BROWSER_PANEL_SPEC = Object.freeze({
  ...SMART_COMPONENT_BROWSER_PANEL_SPEC,
  title: "Connections",
  icon: "interface",
  layout: "tiles",
  showPreviewImages: false,
  previewArtworkMode: "generated",
  searchPlaceholder: "Search connections",
  searchLabel: "Search connection components",
  emptyMessage: "No matching connection components."
});

export const SMART_COMPONENT_STATUS_SPECS = Object.freeze({
  default: status("default", "smart-component"),
  error: status("error", "cancel"),
  created: status("created", "smart-component"),
  cancelled: status("cancelled", "smart-component")
});

export const SMART_COMPONENT_PRESET_ACTIONS = Object.freeze({
  create: action("create", "smart-component", "Create"),
  select: action("select", "inspector", "Open")
});

export const SMART_COMPONENT_KIND_SPECS = Object.freeze([
  kind("connection", "Connection Components", "interface", { actionMode: "select" }),
  kind("frame", "Frame Components", "beam"),
  kind("building", "Building Components", "assembly"),
  kind("sectioning", "Sectioning Components", "work-plane"),
  kind("stair-system", "Stair System Components", "work-plane"),
  kind("stair-flight", "Stair Flight Components", "work-plane"),
  kind("stair-landing", "Stair Landing Components", "work-plane"),
  kind("stair-tread", "Stair Tread Components", "work-plane"),
  kind("stair-support", "Stair Support Components", "work-plane"),
  kind("stair-railing", "Stair Railing Components", "work-plane"),
  kind("component", "Components", "smart-component")
]);

const KIND_BY_ID = new Map(SMART_COMPONENT_KIND_SPECS.map((spec) => [spec.id, spec]));

export function smartComponentKindSpec(kindId = "component") {
  const id = String(kindId || "component");
  return KIND_BY_ID.get(id) || Object.freeze({
    id,
    label: `${smartComponentTitleCase(id)} Components`,
    icon: id.startsWith("stair-") ? "work-plane" : "smart-component",
    actionMode: "create"
  });
}

export function smartComponentKindIcon(kindId) {
  return smartComponentKindSpec(kindId).icon;
}

export function smartComponentKindLabel(kindId) {
  return smartComponentKindSpec(kindId).label;
}

export function smartComponentPresetActionSpec(kindId) {
  const actionMode = smartComponentKindSpec(kindId).actionMode;
  return Object.values(SMART_COMPONENT_PRESET_ACTIONS).find((spec) => spec.mode === actionMode) || SMART_COMPONENT_PRESET_ACTIONS.create;
}

export function smartComponentPresetActionLabel(item = {}, { active = false } = {}) {
  const actionSpec = smartComponentPresetActionSpec(item.kind);
  return `${actionSpec.verb} ${item.name || item.id || ""}`.trim();
}

export function smartComponentPresetActionIcon(item = {}, { active = false } = {}) {
  return active ? "cancel" : smartComponentPresetActionSpec(item.kind).icon;
}

export function smartComponentStatusIcon(statusState = "") {
  return (SMART_COMPONENT_STATUS_SPECS[statusState] || SMART_COMPONENT_STATUS_SPECS.default).icon;
}

export function smartComponentSelectionStatus(item = {}) {
  return item.description || smartComponentSelectedStatus(item);
}

export function smartComponentSelectedStatus(item = {}) {
  return `${item.name || item.id || "Component"} selected.`;
}

export function smartComponentCreatedStatus(smartComponentId) {
  return `Created ${smartComponentId}.`;
}

export function smartComponentTitleCase(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function kind(id, label, icon, options = {}) {
  return Object.freeze({
    id,
    label,
    icon,
    actionMode: options.actionMode || "create"
  });
}

function action(mode, icon, verb) {
  return Object.freeze({ mode, icon, verb });
}

function status(id, icon) {
  return Object.freeze({ id, icon });
}
