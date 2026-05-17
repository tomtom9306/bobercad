const STYLE_ID = "bobercad-connection-library-ui";
const STYLE = `
.connection-library-ui .connection-command-title {
  font-weight: 700;
}
.connection-library-ui .connection-library-select {
  min-width: 0;
  height: 28px;
  border: 1px solid #aeb9c9;
  background: #ffffff;
  color: #172033;
  font: inherit;
}
.connection-library-ui .connection-command-actions {
  display: flex;
  gap: 6px;
}
.connection-library-ui .connection-command-button {
  border: 1px solid #9fb0c3;
  background: #ffffff;
  color: #172033;
  padding: 5px 8px;
  font: inherit;
  cursor: pointer;
}
.connection-library-ui .connection-command-button.primary {
  background: #e8eef5;
}
.connection-library-ui .connection-command-picked,
.connection-library-ui .connection-command-message {
  color: #475569;
  line-height: 1.35;
}
.connection-library-ui .connection-command-message[data-state="ok"] {
  color: #166534;
}
.connection-library-ui .connection-command-message[data-state="error"] {
  color: #b91c1c;
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

function button(label, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

export function mountConnectionLibraryUi({ panel, api, selection, onProjectChange, onConnectionCreated }) {
  ensureStyle();
  const presets = api.connectionPresets();
  if (!presets.length) {
    panel.hidden = true;
    return;
  }

  const title = text("div", "connection-command-title", "Connection Library");
  const select = document.createElement("select");
  const status = text("div", "connection-command-message", "Choose a connection and pick two members.");
  const pickedText = text("div", "connection-command-picked", "");
  let active = false;
  let picked = [];

  select.className = "connection-library-select";
  select.setAttribute("aria-label", "Connection preset");
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

  const createPickedConnection = (memberIds) => {
    if (!active) return;
    picked = memberIds;
    try {
      const result = api.createConnectionFromPreset(select.value, picked);
      onProjectChange(result.project);
      onConnectionCreated(result.connectionId);
      stopPick(`Created ${result.connectionId}.`, "ok");
    } catch (error) {
      picked = [];
      selection.clear();
      setStatus(error.message, "error");
    }
  };

  const updatePickedMembers = (memberIds) => {
    picked = memberIds;
    setStatus(picked.length === 1 ? "Pick the second member." : "Creating connection.", "ok");
  };

  const startPick = () => {
    active = true;
    picked = [];
    select.disabled = true;
    panel.dataset.mode = "pick";
    selection.beginMemberPick({
      count: 2,
      onPick: updatePickedMembers,
      onComplete: createPickedConnection,
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
  panel.classList.add("connection-library-ui");
  panel.replaceChildren(title, select, actions, pickedText, status);
}
