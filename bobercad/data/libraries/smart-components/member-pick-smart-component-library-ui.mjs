import { createIcon } from "../../../app/ui/icons/icon-registry.mjs?v=smart-component-library-1";

const STYLE_ID = "bobercad-connection-library-ui";
const STYLE = `
.connection-library-ui .connection-command-title {
  display: flex;
  align-items: center;
  gap: var(--bc-space-3, 6px);
  min-width: 0;
  color: var(--bc-color-text, #172033);
  font-weight: var(--bc-font-weight-bold, 700);
}
.connection-library-ui .connection-command-title .bc-icon {
  width: 18px;
  height: 18px;
  color: var(--bc-color-accent-strong, #1d4ed8);
}
.connection-library-ui .connection-library-select {
  min-width: 0;
  height: 28px;
  border: 1px solid var(--bc-color-border-strong, #aeb9c9);
  border-radius: var(--bc-radius-1, 2px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-4, 8px);
  font: inherit;
}
.connection-library-ui .connection-command-actions {
  display: flex;
  gap: var(--bc-space-3, 6px);
}
.connection-library-ui .connection-command-button {
  min-height: 28px;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-5, 10px);
  font: var(--bc-font-weight-medium, 600) var(--bc-font-size-12, 12px) / 1 var(--bc-font-family, inherit);
  cursor: pointer;
}
.connection-library-ui .connection-command-button.primary {
  border-color: var(--bc-color-border-strong, #9fb0c3);
  background: var(--bc-color-hover, #e8eef5);
  color: var(--bc-color-accent-strong, #1d4ed8);
}
.connection-library-ui .connection-command-picked,
.connection-library-ui .connection-command-message {
  color: var(--bc-color-text-muted, #475569);
  line-height: 1.35;
}
.connection-library-ui .connection-command-message[data-state="ok"] {
  color: var(--bc-color-success, #166534);
}
.connection-library-ui .connection-command-message[data-state="error"] {
  color: var(--bc-color-danger, #b91c1c);
}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}

function text(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function classNames(...values) {
  return values
    .flatMap((value) => String(value || "").split(/\s+/))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" ");
}

function button(label, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = classNames(
    className,
    className.includes("connection-command-button") ? "bc-button" : "",
    className.includes("primary") ? "bc-button-primary" : ""
  );
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

export function mountSmartComponentLibraryUi({ panel, api, selection, onProjectChange, onSmartComponentCreated }) {
  ensureStyle();
  const presets = api.smartComponentPresets();
  if (!presets.length) {
    panel.hidden = true;
    return;
  }

  const title = text("div", "connection-command-title", "");
  title.append(createIcon("smart-component"), document.createTextNode("Smart Components"));
  const select = document.createElement("select");
  const status = text("div", "connection-command-message", "Choose a connection and pick two members.");
  const pickedText = text("div", "connection-command-picked", "");
  let active = false;
  let picked = [];

  select.className = "connection-library-select bc-select";
  select.setAttribute("aria-label", "Smart component preset");
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    select.append(option);
  }

  const setStatus = (message, state = "") => {
    status.textContent = message;
    status.dataset.state = state;
    pickedText.textContent = picked.length ? `Picked: ${picked.join(", ")}` : "";
  };

  const stopPick = (message = "Choose a connection and pick two members.", state = "") => {
    active = false;
    picked = [];
    select.disabled = false;
    selection.cancelPick();
    panel.dataset.mode = "";
    setStatus(message, state);
  };

  const createPickedSmartComponent = (memberIds) => {
    if (!active) return;
    picked = memberIds;
    try {
      const result = api.createSmartComponentFromPreset(select.value, picked);
      onProjectChange(result.project);
      onSmartComponentCreated(result.smartComponentId);
      stopPick(`Created ${result.smartComponentId}.`, "ok");
    } catch (error) {
      picked = [];
      selection.clear();
      setStatus(error.message, "error");
    }
  };

  const updatePickedMembers = (memberIds) => {
    picked = memberIds;
    setStatus(picked.length === 1 ? "Pick the second member." : "Creating smart component.", "ok");
  };

  const startPick = () => {
    active = true;
    picked = [];
    select.disabled = true;
    panel.dataset.mode = "pick";
    selection.beginMemberPick({
      count: 2,
      onPick: updatePickedMembers,
      onComplete: createPickedSmartComponent,
      onError: (message) => setStatus(message, "error")
    });
    setStatus("Pick first member.", "ok");
  };

  const actions = document.createElement("div");
  actions.className = "connection-command-actions";
  actions.append(
    button("Pick Members", "connection-command-button primary", startPick),
    button("Cancel", "connection-command-button", () => stopPick())
  );

  panel.hidden = false;
  panel.classList.add("connection-library-ui", "bc-inspector");
  panel.replaceChildren(title, select, actions, pickedText, status);
}
