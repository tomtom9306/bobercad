export const PROJECT_DATA_PANEL_SPEC = Object.freeze({
  title: "Data",
  icon: "database",
  searchPlaceholder: "Search data",
  searchLabel: "Search project data",
  emptySearchMessage: "No matching data.",
  emptySectionMessage: "No data available.",
  modelItemLabel: "model items",
  schemaFallback: "schema n/a"
});

export const PROJECT_DATA_SECTION_SPECS = Object.freeze([
  section("libraries", "Libraries"),
  section("model", "Model Contents"),
  section("settings", "Project Settings")
]);

export const PROJECT_DATA_ROW_ACTIONS = Object.freeze({
  openSource: action("openSource", "file", "Open Source", "Open"),
  showCollection: action("showCollection", "model-browser", "Show Model", "Show"),
  showComponents: action("showComponents", "smart-component", "Show Components", "Show")
});

export const PROJECT_DATA_SETTING_ROW_SPECS = Object.freeze([
  setting("project-schema", "file", "Project schema"),
  setting("project-units-length", "units", "Length units", { meta: "units" }),
  setting("project-units-angle", "units", "Angle units", { meta: "units" }),
  setting("project-object-index", "database", "Object index", { valueLabel: "Stored authoritative index", metaUnit: "ids" })
]);

const SECTION_BY_ID = new Map(PROJECT_DATA_SECTION_SPECS.map((spec) => [spec.id, spec]));
const ACTION_BY_ID = new Map(Object.values(PROJECT_DATA_ROW_ACTIONS).map((spec) => [spec.id, spec]));

export function projectDataSectionLabel(sectionId) {
  return SECTION_BY_ID.get(sectionId)?.label || titleCase(sectionId);
}

export function projectDataRowActionSpec(actionId) {
  return ACTION_BY_ID.get(actionId) || null;
}

export function projectDataActionTitle(actionId, targetLabel = "") {
  const spec = projectDataRowActionSpec(actionId);
  if (!spec) return targetLabel || "";
  const label = String(targetLabel || "").trim();
  return label ? `${spec.titleVerb} ${label}` : spec.label;
}

function section(id, label) {
  return Object.freeze({ id, label });
}

function action(id, icon, label, titleVerb) {
  return Object.freeze({ id, icon, label, titleVerb });
}

function setting(id, icon, label, options = {}) {
  return Object.freeze({
    id,
    icon,
    label,
    meta: options.meta || "",
    valueLabel: options.valueLabel || "",
    metaUnit: options.metaUnit || ""
  });
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
