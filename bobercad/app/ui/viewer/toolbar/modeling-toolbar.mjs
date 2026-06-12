import { shortcutLabel, shortcutSetting } from "../../../rendering/interaction/keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { button } from "../panels/panel-elements.mjs?v=panel-controls-dry-1";

export function mountModelingToolbar({
  toolbar,
  status,
  shortcuts = {},
  onBeam,
  onColumn,
  onPlate,
  onSketch,
  onWorkPlane,
  onPlateBend,
  onTrim,
  onCancel,
  autoRelationsEnabled = false,
  onAutoRelationsChange,
  onSketchRelationsToggle,
  snapSettings = {},
  snapScope = {},
  onSnapStrengthChange,
  onSnapScopeChange
}) {
  const commandShortcuts = shortcuts.commands || {};
  let currentAutoRelationsEnabled = Boolean(autoRelationsEnabled);
  let sketchRelationsAvailable = false;
  let sketchRelationsVisible = false;
  const commandButtons = [
    { command: "beam", shortcut: "createBeam", keyFallback: "B", onClick: onBeam, title: "Create beam" },
    { command: "column", shortcut: "createColumn", keyFallback: "C", onClick: onColumn, title: "Create column" },
    { command: "plate", shortcut: "createPlate", keyFallback: "P", onClick: onPlate, title: "Create plate" },
    { command: "sketch", shortcut: "createSketch", keyFallback: "S", onClick: onSketch, title: "Create sketch" },
    { command: "workPlane", shortcut: "setWorkPlane", keyFallback: "W", onClick: onWorkPlane, title: "Set work plane from 3 points" },
    { command: "plateBend", shortcut: "addPlateBend", keyFallback: "F", onClick: onPlateBend, title: "Add plate bend" },
    { command: "trim", shortcut: "createTrim", keyFallback: "T", onClick: onTrim, title: "Create trim" }
  ].map((spec) => ({
    command: spec.command,
    node: button(shortcutLabel(shortcutSetting(commandShortcuts, spec.shortcut, spec.keyFallback), spec.title), "", spec.onClick, { title: spec.title })
  }));
  const cancel = button(shortcutLabel(shortcutSetting(commandShortcuts, "cancel", "Escape"), "Cancel"), "", onCancel, { title: "Cancel command" });
  const autoRelations = button("Rel", "", () => {
    if (sketchRelationsAvailable && onSketchRelationsToggle?.()) return;
    setAutoRelations(!currentAutoRelationsEnabled, { notify: true });
  }, { title: "Automatic axis relations" });
  const snapPanel = createSnapPanel({ snapSettings, snapScope, onSnapStrengthChange, onSnapScopeChange });
  toolbar.replaceChildren(...commandButtons.map((item) => item.node), snapPanel, autoRelations, cancel);

  function setActive(command) {
    for (const item of commandButtons) item.node.classList.toggle("active", item.command === command);
  }

  function setAutoRelations(enabled, options = {}) {
    currentAutoRelationsEnabled = Boolean(enabled);
    syncRelationsButton();
    if (options.notify) onAutoRelationsChange?.(currentAutoRelationsEnabled);
  }

  function setSketchRelationsState({ available = false, visible = false } = {}) {
    sketchRelationsAvailable = Boolean(available);
    sketchRelationsVisible = Boolean(visible);
    syncRelationsButton();
  }

  function syncRelationsButton() {
    const active = sketchRelationsAvailable ? sketchRelationsVisible : currentAutoRelationsEnabled;
    autoRelations.classList.toggle("active", active);
    autoRelations.setAttribute("aria-pressed", active ? "true" : "false");
    autoRelations.title = sketchRelationsAvailable
      ? sketchRelationsVisible
        ? "Hide plate sketch relations (R)"
        : "Show plate sketch relations (R)"
      : "Automatic axis relations";
  }

  function setStatus(text) {
    status.textContent = text || "Ready";
  }

  setStatus("Ready");
  setAutoRelations(autoRelationsEnabled);
  return { setActive, setAutoRelations, setSketchRelationsState, setStatus };
}

function createSnapPanel({ snapSettings = {}, snapScope = {}, onSnapStrengthChange, onSnapScopeChange } = {}) {
  const panel = document.createElement("details");
  panel.className = "snap-manager";
  const summary = document.createElement("summary");
  summary.textContent = "Snap";
  summary.title = "Snap manager";
  panel.append(summary);

  const body = document.createElement("div");
  body.className = "snap-manager-body";
  const strength = document.createElement("select");
  strength.title = "Snap strength";
  for (const value of ["off", "light", "normal", "strong", "training"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value[0].toUpperCase() + value.slice(1);
    strength.append(option);
  }
  strength.value = snapSettings.strength || "normal";
  strength.addEventListener("change", () => onSnapStrengthChange?.(strength.value));
  body.append(labelWrap("Strength", strength));

  const filters = [
    ["members", "Members"],
    ["plates", "Plates"],
    ["features", "Features"],
    ["fasteners", "Bolts"],
    ["workPoints", "Points"],
    ["referencePlanes", "Planes"],
    ["grids", "Grids"],
    ["activeSketch", "Sketch"],
    ["constructionGuides", "Guides"],
    ["selectedObjectsOnly", "Selected"],
    ["currentSmartComponentOnly", "Component"]
  ];
  const grid = document.createElement("div");
  grid.className = "snap-manager-filter-grid";
  for (const [key, label] of filters) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = snapScope[key] !== false;
    input.addEventListener("change", () => onSnapScopeChange?.({ [key]: input.checked }));
    grid.append(labelWrap(label, input, "checkbox"));
  }
  body.append(grid);
  panel.append(body);
  return panel;
}

function labelWrap(text, control, kind = "field") {
  const label = document.createElement("label");
  label.className = `snap-manager-${kind}`;
  if (kind === "checkbox") {
    label.append(control, document.createTextNode(text));
  } else {
    const span = document.createElement("span");
    span.textContent = text;
    label.append(span, control);
  }
  return label;
}
