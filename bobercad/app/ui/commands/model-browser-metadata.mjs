export const MODEL_BROWSER_PANEL_SPEC = Object.freeze({
  title: "Project",
  icon: "model-browser",
  searchPlaceholder: "Search model",
  searchLabel: "Search model browser",
  scopeLabel: "Model browser scope",
  emptyMessage: "No matching model items.",
  itemCountLabel: "model items",
  focusIcon: "zoom-fit",
  selectVerb: "Select",
  selectedVerb: "Selected",
  frameVerb: "Frame",
  selectionStatusVerb: "Selected",
  framedStatusVerb: "Framed",
  frameEmptyStatus: "Nothing visible to frame."
});

export const MODEL_BROWSER_DEFAULT_VISIBILITY = "primary";

export const MODEL_BROWSER_VISIBILITY_MODES = Object.freeze([
  mode("primary", "Primary", "Show primary model objects"),
  mode("advanced", "Advanced", "Show primary and advanced model data")
]);

const MODE_BY_ID = new Map(MODEL_BROWSER_VISIBILITY_MODES.map((entry) => [entry.id, entry]));

export function modelBrowserVisibilityModeSpec(modeId) {
  return MODE_BY_ID.get(modeId) || MODE_BY_ID.get(MODEL_BROWSER_DEFAULT_VISIBILITY);
}

export function modelBrowserVisibilityFilter(mode = MODEL_BROWSER_DEFAULT_VISIBILITY) {
  return mode === "advanced" ? ["primary", "advanced"] : "primary";
}

export function modelBrowserModeForCollectionVisibility(visibility) {
  return visibility === "advanced" ? "advanced" : MODEL_BROWSER_DEFAULT_VISIBILITY;
}

export function modelBrowserSelectLabel(label, { active = false } = {}) {
  return `${active ? MODEL_BROWSER_PANEL_SPEC.selectedVerb : MODEL_BROWSER_PANEL_SPEC.selectVerb} ${label}`;
}

export function modelBrowserFrameLabel(label) {
  return `${MODEL_BROWSER_PANEL_SPEC.frameVerb} ${label}`;
}

export function modelBrowserSelectionStatus(id) {
  return `${MODEL_BROWSER_PANEL_SPEC.selectionStatusVerb} ${id}.`;
}

export function modelBrowserFramedStatus(id) {
  return `${MODEL_BROWSER_PANEL_SPEC.framedStatusVerb} ${id}.`;
}

function mode(id, label, title) {
  return Object.freeze({ id, label, title });
}
