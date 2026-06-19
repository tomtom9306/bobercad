export const SNAP_STRENGTH_SPECS = Object.freeze([
  { id: "off", label: "Off", description: "Disable authoring snap assistance." },
  { id: "light", label: "Light", description: "Use light snap assistance for loose picking." },
  { id: "normal", label: "Normal", description: "Use balanced snap assistance for everyday modeling." },
  { id: "strong", label: "Strong", description: "Use stronger snap assistance for precise picks." },
  { id: "training", label: "Training", description: "Use expanded snap assistance while learning the model." }
]);

export const SNAP_SCOPE_MODES = Object.freeze([
  {
    id: "all",
    label: "All",
    title: "Select and snap across all visible objects",
    description: "Select and snap across all visible objects.",
    icon: "selection",
    patch: Object.freeze({ selectedObjectsOnly: false, currentSmartComponentOnly: false })
  },
  {
    id: "selected",
    label: "Selected",
    title: "Limit select and snap targets to the current selection",
    description: "Limit select and snap targets to the current selection.",
    icon: "selection",
    patch: Object.freeze({ selectedObjectsOnly: true, currentSmartComponentOnly: false })
  },
  {
    id: "component",
    label: "Component",
    title: "Limit select and snap targets to the active Smart Component",
    description: "Limit select and snap targets to the active Smart Component.",
    icon: "smart-component",
    patch: Object.freeze({ selectedObjectsOnly: false, currentSmartComponentOnly: true })
  }
]);

export const SNAP_TARGET_SPECS = Object.freeze([
  { key: "members", label: "Members", description: "Toggle member snap targets." },
  { key: "plates", label: "Plates", description: "Toggle plate snap targets." },
  { key: "features", label: "Features", description: "Toggle feature snap targets." },
  { key: "fasteners", label: "Bolts", description: "Toggle bolt and fastener snap targets." },
  { key: "workPoints", label: "Points", description: "Toggle work-point snap targets." },
  { key: "referencePlanes", label: "Planes", description: "Toggle reference-plane snap targets." },
  { key: "grids", label: "Grids", description: "Toggle grid snap targets." },
  { key: "activeSketch", label: "Sketch", description: "Toggle active-sketch snap targets." },
  { key: "constructionGuides", label: "Guides", description: "Toggle construction-guide snap targets." }
]);

export const SNAP_FILTER_SPECS = Object.freeze([
  ...SNAP_TARGET_SPECS,
  { key: "selectedObjectsOnly", label: "Selected", description: "Limit snap targets to the current selection." },
  { key: "currentSmartComponentOnly", label: "Component", description: "Limit snap targets to the active Smart Component." }
]);

export function normalizeSnapStrength(value, fallback = "normal") {
  const strength = String(value || fallback).trim().toLowerCase();
  return SNAP_STRENGTH_SPECS.some((spec) => spec.id === strength) ? strength : fallback;
}

export function snapStrengthLabel(value) {
  return SNAP_STRENGTH_SPECS.find((spec) => spec.id === value)?.label || snapTitleCase(value);
}

export function snapScopeMode(scope = {}) {
  return scope.selectedObjectsOnly ? "selected" : scope.currentSmartComponentOnly ? "component" : "all";
}

export function snapScopeModeLabel(mode) {
  return SNAP_SCOPE_MODES.find((entry) => entry.id === mode)?.label || snapTitleCase(mode);
}

export function snapTargetLabel(key) {
  return SNAP_FILTER_SPECS.find((entry) => entry.key === key)?.label || snapTitleCase(String(key || "Target").replace(/([a-z])([A-Z])/g, "$1 $2"));
}

function snapTitleCase(value = "") {
  const text = String(value || "");
  return text
    .replace(/[-.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
