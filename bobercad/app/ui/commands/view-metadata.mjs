export const DISPLAY_MODE_SPECS = [
  {
    id: "shaded",
    label: "Shaded",
    title: "Set display mode: Shaded",
    description: "Use shaded faces with model edges for everyday modeling.",
    icon: "display-shaded",
    settingsStripGroup: "display",
    settingsStripLabel: "Shaded",
    settingsStripOrder: 0
  },
  {
    id: "wireframe",
    label: "Wireframe",
    title: "Set display mode: Wireframe",
    description: "Use a line-focused display mode for inspecting structure and hidden edges.",
    icon: "display-wireframe",
    settingsStripGroup: "display",
    settingsStripLabel: "Wire",
    settingsStripOrder: 1
  },
  {
    id: "xray",
    label: "X-Ray",
    title: "Set display mode: X-Ray",
    description: "Use a transparent review display mode for seeing through modeled parts.",
    icon: "display-xray",
    settingsStripGroup: "display",
    settingsStripLabel: "X-Ray",
    settingsStripOrder: 2
  }
];

export const VIEW_ORIENTATION_SPECS = [
  {
    id: "iso",
    label: "Isometric",
    navLabel: "Iso",
    title: "Set view: Isometric",
    description: "Set the camera to an isometric modeling view.",
    primary: true,
    settingsStripGroup: "view",
    settingsStripLabel: "Iso",
    settingsStripOrder: 0
  },
  {
    id: "top",
    label: "Top",
    navLabel: "Top",
    title: "Set view: Top",
    description: "Set the camera to the top view.",
    settingsStripGroup: "view",
    settingsStripLabel: "Top",
    settingsStripOrder: 1
  },
  {
    id: "front",
    label: "Front",
    navLabel: "Front",
    title: "Set view: Front",
    description: "Set the camera to the front view.",
    settingsStripGroup: "view",
    settingsStripLabel: "Front",
    settingsStripOrder: 2
  },
  {
    id: "right",
    label: "Right",
    navLabel: "Right",
    title: "Set view: Right",
    description: "Set the camera to the right view.",
    settingsStripGroup: "view",
    settingsStripLabel: "Right",
    settingsStripOrder: 3
  },
  {
    id: "left",
    label: "Left",
    navLabel: "Left",
    title: "Set view: Left",
    description: "Set the camera to the left view."
  },
  {
    id: "back",
    label: "Back",
    navLabel: "Back",
    title: "Set view: Back",
    description: "Set the camera to the back view."
  },
  {
    id: "bottom",
    label: "Bottom",
    navLabel: "Bottom",
    title: "Set view: Bottom",
    description: "Set the camera to the bottom view."
  }
];

export const VIEW_ORIENTATION_NAV_ORDER = ["top", "left", "iso", "right", "front", "back", "bottom"];
export const VIEW_ORIENTATION_FREE_ID = "custom";

const DISPLAY_MODE_IDS = new Set(DISPLAY_MODE_SPECS.map((spec) => spec.id));
const VIEW_ORIENTATION_IDS = new Set(VIEW_ORIENTATION_SPECS.map((spec) => spec.id));

export function normalizeDisplayMode(mode) {
  const value = String(mode || "shaded").trim().toLowerCase();
  return DISPLAY_MODE_IDS.has(value) ? value : "shaded";
}

export function normalizeViewOrientation(orientation) {
  const value = String(orientation || "iso").trim().toLowerCase();
  return VIEW_ORIENTATION_IDS.has(value) ? value : "iso";
}

export function normalizeViewOrientationState(orientation) {
  const value = String(orientation ?? "").trim().toLowerCase();
  return VIEW_ORIENTATION_IDS.has(value) ? value : VIEW_ORIENTATION_FREE_ID;
}

export function activeViewOrientation(orientation) {
  const value = normalizeViewOrientationState(orientation);
  return VIEW_ORIENTATION_IDS.has(value) ? value : "";
}

export function displayModeSpec(mode) {
  const normalized = normalizeDisplayMode(mode);
  return DISPLAY_MODE_SPECS.find((spec) => spec.id === normalized) || DISPLAY_MODE_SPECS[0];
}

export function viewOrientationSpec(orientation) {
  const normalized = normalizeViewOrientation(orientation);
  return VIEW_ORIENTATION_SPECS.find((spec) => spec.id === normalized) || VIEW_ORIENTATION_SPECS[0];
}

export function displayModeLabel(mode) {
  return displayModeSpec(mode).label;
}

export function viewOrientationLabel(orientation) {
  return viewOrientationSpec(orientation).label;
}
