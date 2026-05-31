import { v } from "../../../engine/core/math.mjs";
import { axisRelationLabel } from "../../../engine/api/project/axis-relations.mjs?v=relation-types-1";

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

function globalAxisSource(axis) {
  const normalized = String(axis || "").toLowerCase();
  const directions = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  return {
    type: "global-axis",
    axis: normalized,
    direction: directions[normalized],
    label: `Global ${normalized.toUpperCase()} axis`
  };
}

export function mountEditorUi({
  panel,
  api,
  profiles,
  selection,
  memberEdit,
  connectionHighlightObjectIds,
  onProjectChange,
  onLocalMemberProjectChange,
  onConnectionSelected,
  onConnectionDeleted,
  onObjectSelected,
  onObjectCleared
}) {
  let selectedMemberId = null;
  let selectedConnectionId = null;
  let selectedObjectId = null;
  let selectedObjectDetail = null;
  let messageText = "Pick a member, connection, trim, or cut object.";
  let messageState = "";

  const setMessage = (message, state = "") => {
    messageText = message;
    messageState = state;
    render();
  };

  const connectedMemberObjectIds = (memberId) => api.memberDependencyObjectIds(memberId, { renderableOnly: true });

  const clearObjectWindow = () => onObjectCleared?.();

  const applyProjectChange = (nextProject, options = {}) => {
    if (options.memberId) {
      if (typeof onLocalMemberProjectChange !== "function") throw new Error("member update requires affected-object scene patching");
      const objectIds = connectedMemberObjectIds(options.memberId);
      if (onLocalMemberProjectChange(nextProject, options.memberId, objectIds) === false) {
        throw new Error("affected-object scene patch failed");
      }
      return;
    }
    onProjectChange(nextProject);
  };

  const selectMember = (memberId, options = {}) => {
    selectedMemberId = memberId;
    selectedConnectionId = null;
    selectedObjectId = null;
    selectedObjectDetail = null;
    if (options.fromMemberEdit) selection.select([memberId]);
    else if (memberEdit) memberEdit.selectMember(memberId, { notify: false });
    else selection.select([memberId]);
    clearObjectWindow();
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const selectConnection = (connectionId, options = {}) => {
    selectedMemberId = null;
    selectedConnectionId = connectionId;
    selectedObjectId = null;
    selectedObjectDetail = null;
    memberEdit?.clear({ notify: false });
    selection.select(typeof connectionHighlightObjectIds === "function"
      ? connectionHighlightObjectIds(connectionId)
      : api.connectionObjectIds(connectionId));
    clearObjectWindow();
    onConnectionSelected(connectionId, options);
    setMessage(`Selected ${connectionId}.`, "ok");
  };

  const selectObject = (objectId, detail = {}) => {
    const entry = api.project().objectIndex?.[objectId];
    if (!entry?.collection) {
      setMessage(`Object not found: ${objectId}`, "error");
      return;
    }
    if (entry.collection === "members") {
      selectMember(objectId);
      return;
    }
    selectedMemberId = null;
    selectedConnectionId = null;
    selectedObjectId = objectId;
    selectedObjectDetail = detail || null;
    memberEdit?.clear({ notify: false });
    selection.select([objectId]);
    if (entry.collection === "features" || entry.collection === "trimJoints") onObjectSelected?.(objectId, selectedObjectDetail);
    else clearObjectWindow();
    setMessage(`Selected ${objectId}.`, "ok");
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

  const beginObjectPick = () => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => selectObject(objectId),
      onError: (message) => setMessage(message, "error")
    });
    setMessage("Pick a member, trim, cut, plate, fastener, or weld.", "ok");
  };

  const updateMember = (operation) => {
    if (!selectedMemberId) return;
    try {
      const nextProject = operation(selectedMemberId);
      applyProjectChange(nextProject, { memberId: selectedMemberId });
      if (memberEdit) memberEdit.selectMember(selectedMemberId, { notify: false });
      else selection.select([selectedMemberId]);
      setMessage("Member updated.", "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const removeMemberRelation = (relationId) => {
    updateMember(() => api.deleteRelation(relationId));
  };

  const setMemberAlignment = (source) => {
    updateMember((memberId) => api.setMemberAlignment(memberId, source));
  };

  const clearMemberAlignment = () => {
    updateMember((memberId) => api.clearMemberAlignment(memberId));
  };

  const beginAlignmentAxisPick = () => {
    if (!selectedMemberId) return;
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => {
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection !== "members") {
          setMessage("Pick a member axis.", "error");
          return;
        }
        if (objectId === selectedMemberId) {
          setMessage("Pick another member as the custom axis.", "error");
          return;
        }
        setMemberAlignment({ type: "member-axis", memberId: objectId, label: `Axis: ${objectId}` });
      },
      onError: () => setMessage("Pick a member axis.", "error")
    });
    setMessage("Pick a member axis for alignment.", "ok");
  };

  const relationRows = (relations, emptyText) => {
    if (!relations.length) return [text("div", "editor-empty", emptyText)];
    return relations.map((relation) => {
      const row = document.createElement("div");
      row.className = "editor-relation-row";
      row.append(
        text("span", "editor-value", axisRelationLabel(relation)),
        button("Remove", "editor-button danger", () => removeMemberRelation(relation.id))
      );
      return row;
    });
  };

  const memberRelationRows = (member) => {
    const relations = api.memberAxisRelations(member.id);
    const pointRelations = relations.filter((relation) => relation.type === "point-on-axis");
    const alignment = relations.find((relation) => relation.type === "member-align-axis");
    return [
      text("div", "editor-subtitle", "Point constraints"),
      ...relationRows(pointRelations, "No point constraints."),
      text("div", "editor-subtitle", "Member alignment"),
      alignment
        ? relationRows([alignment], "No member alignment.")[0]
        : text("div", "editor-empty", "No member alignment."),
      button("Align X", "editor-button", () => setMemberAlignment(globalAxisSource("x"))),
      button("Align Y", "editor-button", () => setMemberAlignment(globalAxisSource("y"))),
      button("Align Z", "editor-button", () => setMemberAlignment(globalAxisSource("z"))),
      button("Pick Custom Axis", "editor-button", beginAlignmentAxisPick),
      button("Remove Alignment", "editor-button danger", clearMemberAlignment)
    ];
  };

  const deleteSelectedConnection = () => {
    if (!selectedConnectionId) return;
    try {
      const deletedId = selectedConnectionId;
      const nextProject = api.deleteConnection(deletedId);
      selectedConnectionId = null;
      memberEdit?.clear({ notify: false });
      selection.clear();
      clearObjectWindow();
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
      button("Apply Center", "editor-button primary", applyCenter),
      ...memberRelationRows(member)
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

  const objectEditor = () => {
    if (!selectedObjectId) return [text("div", "editor-empty", "No object selected.")];
    const project = api.project();
    const entry = project.objectIndex?.[selectedObjectId];
    if (!entry?.collection) return [text("div", "editor-error", "Selected object is no longer in the project.")];
    const object = api.object(selectedObjectId);
    const connection = api.connectionForObject(selectedObjectId);
    const rows = [
      readout("Object", selectedObjectId),
      readout("Collection", entry.collection),
      readout("Type", object.type || entry.type || "-")
    ];
    if (object.ownerId) rows.push(readout("Owner", object.ownerId));
    if (object.memberEnd) rows.push(readout("Member end", object.memberEnd));
    if (object.cutKind) rows.push(readout("Cut kind", object.cutKind));
    if (object.booleanType) rows.push(readout("Boolean", object.booleanType));
    if (entry.collection === "trimJoints") rows.push(readout("Participants", String((object.participants || []).length)));
    if (entry.collection === "trimJoints" && selectedObjectDetail?.operationId) rows.push(readout("Selected cut", selectedObjectDetail.operationId));
    if (object.fabrication?.operation) rows.push(readout("Operation", object.fabrication.operation));
    if (object.operationEnabled === false) rows.push(text("div", "editor-error", "Operation is disabled."));
    if (connection) rows.push(button("Open Connection", "editor-button", () => selectConnection(connection.id)));
    if (entry.collection === "features") rows.push(button("Open Feature Editor", "editor-button primary", () => onObjectSelected?.(selectedObjectId)));
    return rows;
  };

  function render() {
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) selectedMemberId = null;
    if (selectedConnectionId && !api.project().model.connections?.[selectedConnectionId]) selectedConnectionId = null;
    if (selectedObjectId && !api.project().objectIndex?.[selectedObjectId]) selectedObjectId = null;

    const title = text("div", "editor-title", "Editor");
    const actions = document.createElement("div");
    const memberSection = document.createElement("section");
    const connectionSection = document.createElement("section");
    const objectSection = document.createElement("section");
    const message = text("div", "editor-message", messageText);

    actions.className = "editor-actions";
    memberSection.className = "editor-section";
    connectionSection.className = "editor-section";
    objectSection.className = "editor-section";
    message.dataset.state = messageState;

    actions.append(
      button("Pick Member", "editor-button", beginMemberPick),
      button("Pick Connection", "editor-button", beginConnectionPick),
      button("Pick Object", "editor-button", beginObjectPick),
      button("Clear", "editor-button", () => {
        selectedMemberId = null;
        selectedConnectionId = null;
        selectedObjectId = null;
        selectedObjectDetail = null;
        memberEdit?.clear({ notify: false });
        selection.clear();
        clearObjectWindow();
        setMessage("Selection cleared.");
      })
    );
    memberSection.append(text("div", "editor-section-title", "Member"), ...memberEditor());
    connectionSection.append(text("div", "editor-section-title", "Connection"), ...connectionEditor());
    objectSection.append(text("div", "editor-section-title", "Object"), ...objectEditor());

    panel.hidden = false;
    panel.replaceChildren(title, actions, memberSection, connectionSection, objectSection, message);
  }

  api.subscribe(render);
  render();
  return {
    clearSelection(options = {}) {
      selectedMemberId = null;
      selectedConnectionId = null;
      selectedObjectId = null;
      selectedObjectDetail = null;
      if (!options.fromMemberEdit) memberEdit?.clear({ notify: false });
      selection.clear();
      clearObjectWindow();
      setMessage("Selection cleared.");
    },
    selectMember,
    selectConnection,
    selectObject
  };
}
