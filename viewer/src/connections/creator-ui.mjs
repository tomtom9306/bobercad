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

export function mountConnectionCreator({ panel, api, selection, onProjectChange, onConnectionCreated }) {
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
  panel.replaceChildren(title, select, actions, pickedText, status);
}
