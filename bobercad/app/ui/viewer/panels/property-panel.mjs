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

function positiveNumericInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    const valid = Number.isFinite(next) && next > 0;
    input.classList.toggle("invalid", !valid);
    if (valid) onChange(next);
  });
  row.append(text("span", "editor-label", label), input);
  return row;
}

function nonNegativeNumericInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    const valid = Number.isFinite(next) && next >= 0;
    input.classList.toggle("invalid", !valid);
    if (valid) onChange(next);
  });
  row.append(text("span", "editor-label", label), input);
  return row;
}

function checkboxInput(label, checked, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "checkbox";
  input.checked = Boolean(checked);
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => onChange(input.checked));
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

function catalogOptionLabel(item) {
  return item.designation || item.name || item.id;
}

function catalogOptions(api, catalog, currentId = "") {
  const entries = api.catalogEntries?.(catalog) || {};
  const options = Object.values(entries)
    .filter((item) => item?.id)
    .map((item) => ({ id: item.id, label: catalogOptionLabel(item) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (currentId && !options.some((option) => option.id === currentId)) {
    options.unshift({ id: currentId, label: currentId });
  }
  return options;
}

function fastenerLengthOptions(api, fastenerRef, currentLength) {
  const fastener = api.catalogEntries?.("fasteners")?.[fastenerRef];
  const lengths = (fastener?.lengths || [])
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  const values = Number.isFinite(currentLength) && currentLength > 0 && !lengths.includes(currentLength)
    ? [currentLength, ...lengths]
    : lengths;
  return values.map((value) => ({ id: String(value), label: String(value) }));
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
  smartComponentHighlightObjectIds,
  onProjectChange,
  onLocalMemberProjectChange,
  onSmartComponentSelected,
  onSmartComponentDeleted,
  onObjectSelected,
  onObjectCleared
}) {
  let selectedMemberId = null;
  let selectedSmartComponentId = null;
  let selectedObjectId = null;
  let selectedObjectDetail = null;
  let messageText = "Pick a member, Smart Component, trim, or cut object.";
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
    selectedSmartComponentId = null;
    selectedObjectId = null;
    selectedObjectDetail = null;
    if (options.fromMemberEdit) selection.select([memberId]);
    else if (memberEdit) memberEdit.selectMember(memberId, { notify: false });
    else selection.select([memberId]);
    clearObjectWindow();
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const selectSmartComponent = (smartComponentId, options = {}) => {
    selectedMemberId = null;
    selectedSmartComponentId = smartComponentId;
    selectedObjectId = null;
    selectedObjectDetail = null;
    memberEdit?.clear({ notify: false });
    selection.select(typeof smartComponentHighlightObjectIds === "function"
      ? smartComponentHighlightObjectIds(smartComponentId)
      : api.smartComponentObjectIds(smartComponentId));
    clearObjectWindow();
    onSmartComponentSelected(smartComponentId, options);
    setMessage(`Selected ${smartComponentId}.`, "ok");
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
    selectedSmartComponentId = null;
    selectedObjectId = objectId;
    selectedObjectDetail = detail || null;
    memberEdit?.clear({ notify: false });
    selection.select([objectId]);
    onObjectSelected?.(objectId, selectedObjectDetail);
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

  const beginSmartComponentPick = () => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => {
        const smartComponent = api.smartComponentRootForObject(objectId);
        if (!smartComponent) {
          selection.clear();
          setMessage("Picked object is not part of a generated Smart Component.", "error");
          return;
        }
        selectSmartComponent(smartComponent.id);
      },
      onError: () => setMessage("Pick any generated Smart Component object.", "error")
    });
    setMessage("Pick any generated Smart Component object.", "ok");
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

  const updateFastenerGroup = (patch) => {
    if (!selectedObjectId) return;
    try {
      applyProjectChange(api.updateFastenerGroup(selectedObjectId, patch));
      selection.select([selectedObjectId]);
      setMessage("Fastener group updated.", "ok");
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

  const deleteSelectedSmartComponent = () => {
    if (!selectedSmartComponentId) return;
    try {
      const deletedId = selectedSmartComponentId;
      const nextProject = api.deleteSmartComponent(deletedId);
      selectedSmartComponentId = null;
      memberEdit?.clear({ notify: false });
      selection.clear();
      clearObjectWindow();
      applyProjectChange(nextProject);
      onSmartComponentDeleted?.(deletedId);
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

  const smartComponentEditor = () => {
    if (!selectedSmartComponentId) return [text("div", "editor-empty", "No Smart Component selected.")];
    const smartComponent = api.smartComponent(selectedSmartComponentId);
    const health = smartComponent.health || "ok";
    const firstError = (smartComponent.diagnostics || []).find((item) => item.severity === "error");
    return [
      readout("Smart Component", selectedSmartComponentId),
      readout("Type", smartComponent.type),
      readout("Kind", smartComponent.kind || "-"),
      readout("Health", health),
      firstError ? text("div", "editor-error", firstError.message) : text("div", "editor-empty", "Smart Component is valid."),
      button("Open Parameters", "editor-button", () => onSmartComponentSelected(selectedSmartComponentId)),
      button("Remove Smart Component", "editor-button danger", deleteSelectedSmartComponent)
    ];
  };

  const fastenerGroupEditor = (fastenerGroup) => {
    const assembly = fastenerGroup.assembly || {};
    const washers = assembly.washers || {};
    const lengthOptions = fastenerLengthOptions(api, fastenerGroup.fastenerRef, assembly.length);
    const rows = [
      text("div", "editor-subtitle", "Fasteners"),
      selectInput("Fastener", catalogOptions(api, "fasteners", fastenerGroup.fastenerRef), fastenerGroup.fastenerRef || "", (fastenerRef) => updateFastenerGroup({ fastenerRef })),
      lengthOptions.length
        ? selectInput("Length", lengthOptions, Number.isFinite(assembly.length) ? String(assembly.length) : lengthOptions[0].id, (length) => updateFastenerGroup({ assembly: { length: Number(length) } }))
        : positiveNumericInput("Length", assembly.length, (length) => updateFastenerGroup({ assembly: { length } })),
      positiveNumericInput("Grip length", assembly.gripLength, (gripLength) => updateFastenerGroup({ assembly: { gripLength } })),
      checkboxInput("Head washer", washers.head, (head) => updateFastenerGroup({ assembly: { washers: { head } } })),
      checkboxInput("Nut washer", washers.nut, (nut) => updateFastenerGroup({ assembly: { washers: { nut } } }))
    ];
    if (Number.isFinite(assembly.nutOffset)) {
      rows.push(nonNegativeNumericInput("Nut offset", assembly.nutOffset, (nutOffset) => updateFastenerGroup({ assembly: { nutOffset } })));
    }
    return rows;
  };

  const objectEditor = () => {
    if (!selectedObjectId) return [text("div", "editor-empty", "No object selected.")];
    const project = api.project();
    const entry = project.objectIndex?.[selectedObjectId];
    if (!entry?.collection) return [text("div", "editor-error", "Selected object is no longer in the project.")];
    const object = api.object(selectedObjectId);
    const smartComponent = api.smartComponentForObject(selectedObjectId);
    const rootSmartComponent = api.smartComponentRootForObject(selectedObjectId);
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
    if (entry.collection === "fastenerGroups") {
      if (object.holePatternRef) rows.push(readout("Hole pattern", object.holePatternRef));
      rows.push(readout("Participants", String((object.participants || []).length)));
      rows.push(...fastenerGroupEditor(object));
    }
    if (object.fabrication?.operation) rows.push(readout("Operation", object.fabrication.operation));
    if (object.operationEnabled === false) rows.push(text("div", "editor-error", "Operation is disabled."));
    if (rootSmartComponent) rows.push(button("Open Smart Component", "editor-button", () => selectSmartComponent(rootSmartComponent.id)));
    if (smartComponent && rootSmartComponent && smartComponent.id !== rootSmartComponent.id) {
      rows.push(button("Open Direct Component", "editor-button", () => selectSmartComponent(smartComponent.id)));
    }
    if (entry.collection === "features") rows.push(button("Open Feature Editor", "editor-button primary", () => onObjectSelected?.(selectedObjectId)));
    return rows;
  };

  function render() {
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) selectedMemberId = null;
    if (selectedSmartComponentId && !api.project().model.smartComponentInstances?.[selectedSmartComponentId]) selectedSmartComponentId = null;
    if (selectedObjectId && !api.project().objectIndex?.[selectedObjectId]) selectedObjectId = null;

    const title = text("div", "editor-title", "Editor");
    const actions = document.createElement("div");
    const memberSection = document.createElement("section");
    const smartComponentSection = document.createElement("section");
    const objectSection = document.createElement("section");
    const message = text("div", "editor-message", messageText);

    actions.className = "editor-actions";
    memberSection.className = "editor-section";
    smartComponentSection.className = "editor-section";
    objectSection.className = "editor-section";
    message.dataset.state = messageState;

    actions.append(
      button("Pick Member", "editor-button", beginMemberPick),
      button("Pick Smart Component", "editor-button", beginSmartComponentPick),
      button("Pick Object", "editor-button", beginObjectPick),
      button("Clear", "editor-button", () => {
        selectedMemberId = null;
        selectedSmartComponentId = null;
        selectedObjectId = null;
        selectedObjectDetail = null;
        memberEdit?.clear({ notify: false });
        selection.clear();
        clearObjectWindow();
        setMessage("Selection cleared.");
      })
    );
    memberSection.append(text("div", "editor-section-title", "Member"), ...memberEditor());
    smartComponentSection.append(text("div", "editor-section-title", "Smart Component"), ...smartComponentEditor());
    objectSection.append(text("div", "editor-section-title", "Object"), ...objectEditor());

    panel.hidden = false;
    panel.replaceChildren(title, actions, memberSection, smartComponentSection, objectSection, message);
  }

  api.subscribe(render);
  render();
  return {
    clearSelection(options = {}) {
      selectedMemberId = null;
      selectedSmartComponentId = null;
      selectedObjectId = null;
      selectedObjectDetail = null;
      if (!options.fromMemberEdit) memberEdit?.clear({ notify: false });
      selection.clear();
      clearObjectWindow();
      setMessage("Selection cleared.");
    },
    selectMember,
    selectSmartComponent,
    selectObject,
    selectedState() {
      return {
        memberId: selectedMemberId,
        smartComponentId: selectedSmartComponentId,
        objectId: selectedObjectId
      };
    }
  };
}
