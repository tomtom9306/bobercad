import { v } from "../core/math.mjs";

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

function numericInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    input.classList.toggle("invalid", !Number.isFinite(next));
    if (Number.isFinite(next)) onChange(next);
  });
  row.append(text("span", "editor-label", label), input);
  return row;
}

function selectInput(label, options, value, onChange) {
  const row = document.createElement("label");
  const select = document.createElement("select");
  row.className = "editor-field";
  select.setAttribute("aria-label", label);
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    select.append(item);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  row.append(text("span", "editor-label", label), select);
  return row;
}

function readout(label, value) {
  const row = document.createElement("div");
  row.className = "editor-readout";
  row.append(text("span", "editor-label", label), text("span", "editor-value", value));
  return row;
}

function memberCenter(member) {
  return v.mul(v.add(member.start, member.end), 0.5);
}

function profileOptions(profiles) {
  return Object.values(profiles)
    .map((profile) => ({ id: profile.id, label: profile.designation || profile.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function objectIdFromFace(face) {
  return face?.objectId || null;
}

export function mountEditorUi({ panel, api, profiles, selection, onProjectChange, onConnectionSelected, onConnectionDeleted }) {
  let selectedMemberId = null;
  let selectedConnectionId = null;
  let messageText = "Pick a member or a connection part.";
  let messageState = "";

  const setMessage = (message, state = "") => {
    messageText = message;
    messageState = state;
    render();
  };

  const applyProjectChange = (nextProject) => {
    onProjectChange(nextProject);
  };

  const selectMember = (memberId) => {
    selectedMemberId = memberId;
    selectedConnectionId = null;
    selection.select([memberId]);
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const selectConnection = (connectionId) => {
    selectedMemberId = null;
    selectedConnectionId = connectionId;
    selection.select(api.connectionObjectIds(connectionId));
    onConnectionSelected(connectionId);
    setMessage(`Selected ${connectionId}.`, "ok");
  };

  const beginMemberPick = () => {
    selection.beginMemberPick({
      count: 1,
      onComplete: ([memberId]) => selectMember(memberId),
      onError: (message) => setMessage(message, "error")
    });
    setMessage("Pick a member.", "ok");
  };

  const beginConnectionPick = () => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => {
        const connection = api.connectionForObject(objectId);
        if (!connection) {
          selection.clear();
          setMessage("Picked object is not part of a generated connection.", "error");
          return;
        }
        selectConnection(connection.id);
      },
      onError: () => setMessage("Pick a connection plate or fastener.", "error")
    });
    setMessage("Pick a connection plate or fastener.", "ok");
  };

  const updateMember = (operation) => {
    if (!selectedMemberId) return;
    try {
      const nextProject = operation(selectedMemberId);
      applyProjectChange(nextProject);
      selection.select([selectedMemberId]);
      setMessage("Member updated.", "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const deleteSelectedConnection = () => {
    if (!selectedConnectionId) return;
    try {
      const deletedId = selectedConnectionId;
      const nextProject = api.deleteConnection(deletedId);
      selectedConnectionId = null;
      selection.clear();
      applyProjectChange(nextProject);
      onConnectionDeleted?.(deletedId);
      setMessage(`Deleted ${deletedId}.`, "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const memberEditor = () => {
    if (!selectedMemberId) return [text("div", "editor-empty", "No member selected.")];
    const member = api.member(selectedMemberId);
    const center = memberCenter(member);
    const centerDraft = [...center];

    const applyCenter = () => updateMember((memberId) => api.setMemberCenter(memberId, centerDraft));
    return [
      readout("Member", selectedMemberId),
      selectInput("Section", profileOptions(profiles), member.profile, (profileId) => updateMember((memberId) => api.setMemberProfile(memberId, profileId))),
      numericInput("Rotation", member.rotation || 0, (rotation) => updateMember((memberId) => api.setMemberRotation(memberId, rotation))),
      text("div", "editor-subtitle", "Center point"),
      numericInput("X", center[0], (value) => { centerDraft[0] = value; }),
      numericInput("Y", center[1], (value) => { centerDraft[1] = value; }),
      numericInput("Z", center[2], (value) => { centerDraft[2] = value; }),
      button("Apply Center", "editor-button primary", applyCenter)
    ];
  };

  const connectionEditor = () => {
    if (!selectedConnectionId) return [text("div", "editor-empty", "No connection selected.")];
    const connection = api.connection(selectedConnectionId);
    const health = connection.generator?.health || "ok";
    const firstError = (connection.generator?.diagnostics || []).find((item) => item.severity === "error");
    return [
      readout("Connection", selectedConnectionId),
      readout("Type", connection.type),
      readout("Health", health),
      firstError ? text("div", "editor-error", firstError.message) : text("div", "editor-empty", "Connection is valid."),
      button("Open Parameters", "editor-button", () => onConnectionSelected(selectedConnectionId)),
      button("Remove Connection", "editor-button danger", deleteSelectedConnection)
    ];
  };

  function render() {
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) selectedMemberId = null;
    if (selectedConnectionId && !api.project().model.connections?.[selectedConnectionId]) selectedConnectionId = null;

    const title = text("div", "editor-title", "Editor");
    const actions = document.createElement("div");
    const memberSection = document.createElement("section");
    const connectionSection = document.createElement("section");
    const message = text("div", "editor-message", messageText);

    actions.className = "editor-actions";
    memberSection.className = "editor-section";
    connectionSection.className = "editor-section";
    message.dataset.state = messageState;

    actions.append(
      button("Pick Member", "editor-button", beginMemberPick),
      button("Pick Connection", "editor-button", beginConnectionPick),
      button("Clear", "editor-button", () => {
        selectedMemberId = null;
        selectedConnectionId = null;
        selection.clear();
        setMessage("Selection cleared.");
      })
    );
    memberSection.append(text("div", "editor-section-title", "Member"), ...memberEditor());
    connectionSection.append(text("div", "editor-section-title", "Connection"), ...connectionEditor());

    panel.hidden = false;
    panel.replaceChildren(title, actions, memberSection, connectionSection, message);
  }

  api.subscribe(render);
  render();
}
