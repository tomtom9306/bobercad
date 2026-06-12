import { finiteNumberOr, v } from "../../../engine/core/math.mjs?v=panel-number-or-dry-1";
import { arrayValues, uniqueTruthy } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";
import { defaultPlaneTrimRemovedRegionKeys, planeTrimRegionKeys, reconcilePlaneTrimRemovedRegionKeys } from "../../../engine/api/model/trim-region-keys.mjs?v=geometry-api-array-values-dry-1";
import { libraryProfileById } from "../../../engine/api/project/profiles.mjs?v=profile-api-dry-1";
import { trimJointOperations, trimJointParticipants, trimOperationById, trimOperationReferencePlaneIds, trimOperationUsesMemberB, trimOperationUsesMemberEnd, trimPlaneOperationsForMember } from "../../../engine/api/project/trim-operations.mjs?v=geometry-api-array-values-dry-1";
import { TRIM_OPERATION_TYPES, trimOperationIconMarkup, trimOperationLabel, trimOperationSupportsGap } from "../../../rendering/trim-operation-icons.mjs?v=color-helpers-dry-1";
import { button, checkboxControl, createPanelMessageState, field, hidePanel, numericControl, readout, renderEditorPanel, text } from "./panel-elements.mjs?v=panel-controls-dry-1";

const { add, sub, mul, dot } = v;
const norm = (point) => v.safeNorm(point, [0, 0, 1]);

const MEMBER_END_OPTIONS = [
  { id: "start", label: "Start" },
  { id: "end", label: "End" }
];

const MITER_MODE_OPTIONS = [
  { id: "equal-angle", label: "Equal angle" },
  { id: "profile-balanced", label: "Balanced profile" }
];

function profileLabel(profiles, member) {
  const profile = libraryProfileById(profiles, member.profile);
  return profile?.designation || member.profile || "-";
}

function memberName(api, memberId) {
  if (!memberId) return "Pick member";
  const member = api.member(memberId);
  return `${memberId} (${member.type || member.profile || "member"})`;
}

function memberColor(api, memberId, fallback) {
  if (!memberId) return fallback;
  return api.member(memberId)?.display?.color || fallback;
}

function colorSwatch(color) {
  const swatch = document.createElement("span");
  swatch.className = "trim-member-swatch";
  swatch.style.backgroundColor = color;
  return swatch;
}

function memberButton(label, color, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.append(colorSwatch(color), text("span", "trim-member-name", label));
  element.addEventListener("click", onClick);
  return element;
}

function trimOptionGroup({ options, value, ariaLabel, role, itemRole = null, ariaSelected, onChange }) {
  const group = document.createElement("div");
  group.className = "trim-member-end-toggle";
  group.setAttribute("role", role);
  group.setAttribute("aria-label", ariaLabel);
  for (const option of options) {
    const selected = option.id === value;
    const item = button(option.label, "trim-end-option", () => {
      if (!selected) onChange(option.id, option.label);
    });
    item.dataset.selected = selected ? "true" : "false";
    if (itemRole) item.setAttribute("role", itemRole);
    item.setAttribute(ariaSelected, selected ? "true" : "false");
    group.append(item);
  }
  return group;
}

function trimTypeIcon(type, colors = {}) {
  const template = document.createElement("template");
  template.innerHTML = trimOperationIconMarkup(type, colors).trim();
  return template.content.firstElementChild;
}

export function mountTrimJointEditorPanel({ panel, api, profiles, selection, onLocalObjectProjectChange, onFocusChange }) {
  let selectedTrimJointId = null;
  let activeOperationId = null;
  let activeRegionKey = null;
  let activeMemberId = null;
  const panelMessage = createPanelMessageState(() => render());
  const setMessage = panelMessage.set;

  const selectedTrimJoint = () => selectedTrimJointId ? api.project().model.trimJoints?.[selectedTrimJointId] || null : null;
  const selectedTrimJointParticipants = () => trimJointParticipants(selectedTrimJoint());

  const activeOperation = () => {
    const trimJoint = selectedTrimJoint();
    return trimOperationById(trimJoint, activeOperationId);
  };

  const trimObjectIds = () => {
    return selectedTrimJointId ? api.trimJointDependencyObjectIds(selectedTrimJointId, { renderableOnly: true }) : [];
  };

  const sceneFocus = () => selectedTrimJointId ? {
    activeTrimJointId: selectedTrimJointId,
    activeTrimOperationId: activeOperationId
  } : {};

  const notifyFocusChange = () => {
    if (typeof onFocusChange === "function") onFocusChange(sceneFocus());
  };

  const applyProjectChange = (nextProject, objectIds) => {
    if (!selectedTrimJointId) return;
    if (typeof onLocalObjectProjectChange !== "function") throw new Error("trim update requires affected-object scene patching");
    if (onLocalObjectProjectChange(nextProject, selectedTrimJointId, objectIds) === false) {
      throw new Error("affected-object scene patch failed");
    }
  };

  const updateTrimJoint = (operation, successMessage = "Trim updated.", highlightMemberId = activeMemberId) => {
    if (!selectedTrimJointId) return;
    try {
      const beforeObjectIds = trimObjectIds();
      const nextProject = operation(selectedTrimJointId);
      const affectedObjectIds = uniqueTruthy([...beforeObjectIds, ...trimObjectIds()]);
      applyProjectChange(nextProject, affectedObjectIds);
      if (highlightMemberId && nextProject.model.members?.[highlightMemberId]) selection.select([highlightMemberId]);
      else selection.select(affectedObjectIds);
      setMessage(successMessage, "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const selectMember = (memberId) => {
    activeMemberId = memberId;
    selection.select([memberId]);
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const beginAddParticipant = () => {
    if (!selectedTrimJointId) return;
    selection.beginMemberPick({
      count: 1,
      onComplete: ([memberId]) => {
        activeMemberId = memberId;
        if (selectedTrimJointParticipants().some((participant) => participant.memberId === memberId)) {
          selection.select([memberId]);
          setMessage(`${memberId} is already in this trim.`, "ok");
          return;
        }
        updateTrimJoint((trimJointId) => api.addTrimJointParticipant(trimJointId, memberId), `Added ${memberId}.`, memberId);
      },
      onError: (message) => setMessage(message, "error")
    });
    setMessage("Pick member to add.", "ok");
  };

  const removeParticipant = (memberId) => {
    const nextHighlight = activeMemberId === memberId ? null : activeMemberId;
    if (activeMemberId === memberId) activeMemberId = null;
    updateTrimJoint((trimJointId) => api.removeTrimJointParticipant(trimJointId, memberId), `Removed ${memberId}.`, nextHighlight);
  };

  const addOperation = (type = "end-butt-1") => {
    const participants = selectedTrimJointParticipants();
    const patch = { type, gap: 0 };
    if (participants.length < 2) {
      setMessage("Add plane trim by picking at least one plane from the model.", "error");
      return;
    }
    updateTrimJoint((trimJointId) => api.addTrimJointOperation(trimJointId, patch), `Added ${trimOperationLabel(patch.type)}.`);
  };

  const regionKeyForPoint = (operation, point) => {
    if (!v.isVec3(point)) return null;
    const gap = finiteNumberOr(operation.gap, 0);
    const items = [];
    for (const referencePlaneId of trimOperationReferencePlaneIds(operation)) {
      const plane = api.project().model.referencePlanes?.[referencePlaneId];
      if (!plane?.origin || !plane?.normal) return null;
      const normal = norm(plane.normal);
      const origin = add(plane.origin, mul(normal, Math.max(0, gap)));
      items.push({ planeId: referencePlaneId, side: dot(sub(point, origin), normal) >= 0 ? "+" : "-" });
    }
    return items.length ? regionKey(items) : null;
  };

  const activePlaneTrimOperationForMember = (memberId) => {
    const trimJoint = selectedTrimJoint();
    const operations = trimPlaneOperationsForMember(trimJoint, memberId);
    if (activeOperationId) return operations.find((operation) => operation.id === activeOperationId) || null;
    return operations.length === 1 ? operations[0] : null;
  };

  const referencePlaneIdFromFace = (face) => face?.referencePlaneId || (face?.collection === "referencePlanes" ? face.objectId : null);

  const beginReferencePlanePick = (onComplete, prompt) => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace: referencePlaneIdFromFace,
      onComplete: ([referencePlaneId]) => onComplete(referencePlaneId),
      onError: () => setMessage("Pick a reference plane in the model.", "error")
    });
    setMessage(prompt, "ok");
  };

  const beginPickOperationPlane = (operation) => {
    beginReferencePlanePick((referencePlaneId) => {
      const nextPlaneIds = uniqueTruthy([...trimOperationReferencePlaneIds(operation), referencePlaneId]);
      updateOperation(operation.id, {
        referencePlaneIds: nextPlaneIds,
        removedRegionKeys: reconcilePlaneTrimRemovedRegionKeys(operation, nextPlaneIds)
      }, `Added plane ${referencePlaneId}.`);
    }, "Pick a reference plane in the model.");
  };

  const removeOperationPlane = (operation, referencePlaneId) => {
    const nextPlaneIds = trimOperationReferencePlaneIds(operation).filter((id) => id !== referencePlaneId);
    if (!nextPlaneIds.length) {
      setMessage("Plane trim requires at least one plane.", "error");
      return;
    }
    updateOperation(operation.id, {
      referencePlaneIds: nextPlaneIds,
      removedRegionKeys: reconcilePlaneTrimRemovedRegionKeys(operation, nextPlaneIds)
    }, `Removed plane ${referencePlaneId}.`);
  };

  const toggleRegionRemoved = (operation, regionKeyValue) => {
    const removed = new Set(arrayValues(operation.removedRegionKeys));
    if (removed.has(regionKeyValue)) removed.delete(regionKeyValue);
    else removed.add(regionKeyValue);
    activeRegionKey = regionKeyValue;
    updateOperation(operation.id, { removedRegionKeys: [...removed] }, removed.has(regionKeyValue) ? "Region removed." : "Region kept.");
  };

  const addPlaneTrimOperation = () => {
    const memberId = selectedTrimJointParticipants()[0]?.memberId;
    if (!memberId) {
      setMessage("Plane trim requires a member.", "error");
      return;
    }
    beginReferencePlanePick((referencePlaneId) => {
      const patch = {
        type: "plane-trim",
        memberAId: memberId,
        referencePlaneIds: [referencePlaneId],
        removedRegionKeys: defaultPlaneTrimRemovedRegionKeys([referencePlaneId]),
        gap: 0
      };
      updateTrimJoint((trimJointId) => api.addTrimJointOperation(trimJointId, patch), "Added plane trim.");
    }, "Pick first plane for the new trim.");
  };

  const addOperationFromToolbar = () => {
    const participants = selectedTrimJointParticipants();
    if (participants.length < 2) {
      addPlaneTrimOperation();
      return;
    }
    addOperation();
  };

  const removeOperation = (operationId) => {
    if (activeOperationId === operationId) activeOperationId = null;
    updateTrimJoint((trimJointId) => api.removeTrimJointOperation(trimJointId, operationId), "Cut removed.");
  };

  const updateOperation = (operationId, patch, message = "Trim updated.") => {
    updateTrimJoint((trimJointId) => api.updateTrimJointOperation(trimJointId, operationId, patch), message);
  };

  const updateOperationType = (operation, type) => {
    const patch = trimOperationSupportsGap(type) ? { type } : { type, gap: 0 };
    if (type === "plane-trim") {
      const referencePlaneIds = trimOperationReferencePlaneIds(operation);
      if (!referencePlaneIds.length) {
        setMessage("Plane trim requires planes picked from the model.", "error");
        return;
      }
      patch.referencePlaneIds = referencePlaneIds;
      patch.removedRegionKeys = reconcilePlaneTrimRemovedRegionKeys(operation, referencePlaneIds);
    } else if (trimOperationUsesMemberB(type)) {
      const memberBId = operation.memberBId || selectedTrimJointParticipants().find((participant) => participant.memberId !== operation.memberAId)?.memberId;
      if (!memberBId) {
        setMessage(`${trimOperationLabel(type)} requires a second member.`, "error");
        return;
      }
      patch.memberBId = memberBId;
    }
    updateOperation(operation.id, patch, `${trimOperationLabel(type)} selected.`);
  };

  const swapOperation = (operation) => {
    updateOperation(operation.id, {
      memberAId: operation.memberBId,
      memberAEnd: operation.memberBEnd || "end",
      memberBId: operation.memberAId,
      memberBEnd: operation.memberAEnd || "end"
    }, "Members swapped.");
  };

  const pickOperationMember = (operation, role) => {
    selection.beginMemberPick({
      count: 1,
      onComplete: ([memberId]) => {
        activeMemberId = memberId;
        updateTrimJoint(
          (trimJointId) => api.setTrimJointOperationMember(trimJointId, operation.id, role, memberId),
          role === "memberA" ? `Member A set to ${memberId}.` : `Member B set to ${memberId}.`,
          memberId
        );
      },
      onError: (message) => setMessage(message, "error")
    });
    setMessage(role === "memberA" ? "Pick member A." : "Pick member B.", "ok");
  };

  const endToggle = (value, ariaLabel, onChange) => {
    return trimOptionGroup({
      options: MEMBER_END_OPTIONS,
      value,
      ariaLabel,
      role: "group",
      ariaSelected: "aria-pressed",
      onChange
    });
  };

  const memberPicker = (operation, member) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-member-picker";
    const color = memberColor(api, member.id, "#94a3b8");
    wrap.append(memberButton(memberName(api, member.id), color, "trim-member-value", () => member.id && selectMember(member.id)));
    if (member.showEnd) wrap.append(endToggle(member.end || "end", `${operation.id} ${member.label} end`, member.onEndChange));
    if (member.canPick !== false) wrap.append(button("Pick", "editor-button", member.onPick));
    return wrap;
  };

  const trimTypePicker = (operation) => {
    const group = document.createElement("div");
    group.className = "trim-type-grid";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", `${operation.id} cut result`);
    const colors = {
      memberA: memberColor(api, operation.memberA?.id, "#365f74"),
      memberB: memberColor(api, operation.memberB?.id, "#d99200")
    };
    for (const option of operation.typeOptions) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "trim-type-button";
      item.dataset.selected = option.id === operation.type ? "true" : "false";
      item.setAttribute("role", "radio");
      item.setAttribute("aria-checked", option.id === operation.type ? "true" : "false");
      item.setAttribute("aria-label", option.label);
      item.append(trimTypeIcon(option.id, colors), text("span", "trim-type-label", option.label));
      item.addEventListener("click", () => {
        if (option.id !== operation.type) operation.onTypeChange(option.id);
      });
      group.append(item);
    }
    return group;
  };

  const miterModePicker = (operation) => {
    return trimOptionGroup({
      options: operation.miterModeOptions,
      value: operation.miterMode,
      ariaLabel: `${operation.id} miter mode`,
      role: "radiogroup",
      itemRole: "radio",
      ariaSelected: "aria-checked",
      onChange: operation.onMiterModeChange
    });
  };

  const planeLabel = (referencePlaneId) => api.project().model.referencePlanes?.[referencePlaneId]?.name || referencePlaneId;

  const planeTrimPlanesRow = (operation) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-plane-list";
    for (const referencePlaneId of operation.referencePlaneIds) {
      const item = document.createElement("div");
      item.className = "trim-plane-chip";
      item.append(
        text("span", "trim-plane-name", planeLabel(referencePlaneId)),
        button("Remove", "editor-button danger", () => operation.onPlaneRemove(referencePlaneId))
      );
      wrap.append(item);
    }
    wrap.append(button("Pick Plane", "editor-button", operation.onPlanePick));
    return field("Planes", wrap);
  };

  const regionLabel = (regionKeyValue) => regionKeyValue.split("|")
    .map((part) => {
      const index = part.lastIndexOf(":");
      return `${planeLabel(part.slice(0, index))} ${part.slice(index + 1)}`;
    })
    .join(", ");

  const planeTrimRegionsRow = (operation) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-region-list";
    if (!operation.regionKeys.length) {
      wrap.append(text("div", "editor-empty", "Pick planes to create removable regions."));
      return field("Regions", wrap);
    }
    for (const regionKeyValue of operation.regionKeys) {
      const isRemoved = operation.removedRegionKeys.includes(regionKeyValue);
      const item = button(
        `${isRemoved ? "Remove" : "Keep"}: ${regionLabel(regionKeyValue)}`,
        "trim-region-button",
        () => operation.onRegionToggle(regionKeyValue)
      );
      item.dataset.removed = isRemoved ? "true" : "false";
      item.dataset.active = regionKeyValue === activeRegionKey ? "true" : "false";
      wrap.append(item);
    }
    return field("Regions", wrap);
  };

  const operationCard = (operation, index) => {
    const card = document.createElement("div");
    card.className = "trim-cut-card";
    card.dataset.active = operation.id === activeOperationId ? "true" : "false";

    const header = document.createElement("div");
    header.className = "trim-cut-header";
    header.append(
      text("div", "editor-section-title", `Cut ${operation.cutNumber || index + 1}: ${trimOperationLabel(operation.type)}`),
      checkboxControl(`${operation.id} enabled`, operation.enabled !== false, operation.onEnabledChange)
    );
    if (operation.onSwap) header.append(button("Swap", "editor-button", operation.onSwap));
    if (operation.onRemove) header.append(button("Remove", "editor-button danger", operation.onRemove));

    const rows = [field(operation.memberA.label, memberPicker(operation, operation.memberA))];
    if (operation.memberB) rows.push(field(operation.memberB.label, memberPicker(operation, operation.memberB)));
    rows.push(field("Result", trimTypePicker(operation)));
    if (operation.referencePlane) {
      rows.push(planeTrimPlanesRow(operation), planeTrimRegionsRow(operation));
    }
    if (operation.showGap) {
      rows.push(field("Gap", numericControl(`${operation.id} gap`, finiteNumberOr(operation.gap, 0), operation.onGapChange)));
    }
    if (operation.miterModeOptions) rows.push(field("Miter", miterModePicker(operation)));
    rows.push(...arrayValues(operation.extraRows));
    card.append(header, ...rows);
    return card;
  };

  const operationMemberRoleModel = (operation, type, role, label, messageLabel = label) => ({
    label,
    id: operation[`${role}Id`],
    showEnd: trimOperationUsesMemberEnd(type, role),
    end: operation[`${role}End`] || "end",
    onEndChange: (end, optionLabel) => updateOperation(operation.id, { [`${role}End`]: end }, `${messageLabel} ${optionLabel.toLowerCase()} end selected.`),
    onPick: () => pickOperationMember(operation, role)
  });

  const trimJointOperationModel = (operation, index) => {
    const type = operation.type || "end-butt-1";
    const usesMemberB = trimOperationUsesMemberB(type);
    return {
      id: operation.id,
      cutNumber: index + 1,
      type,
      typeOptions: TRIM_OPERATION_TYPES,
      enabled: operation.enabled !== false,
      memberA: operationMemberRoleModel(operation, type, "memberA", type === "plane-trim" ? "Cut member" : "Member A", "Member A"),
      memberB: usesMemberB ? operationMemberRoleModel(operation, type, "memberB", "Member B") : null,
      referencePlane: type === "plane-trim",
      referencePlaneIds: trimOperationReferencePlaneIds(operation),
      removedRegionKeys: arrayValues(operation.removedRegionKeys),
      regionKeys: type === "plane-trim" ? planeTrimRegionKeys(uniqueTruthy(trimOperationReferencePlaneIds(operation))) : [],
      showGap: trimOperationSupportsGap(type),
      gap: operation.gap,
      miterModeOptions: type === "end-miter" ? MITER_MODE_OPTIONS : null,
      miterMode: operation.miterMode || "equal-angle",
      onMiterModeChange: (miterMode) => updateOperation(operation.id, { miterMode }, `${miterMode === "profile-balanced" ? "Balanced profile" : "Equal angle"} miter selected.`),
      onEnabledChange: (enabled) => updateOperation(operation.id, { enabled }),
      onTypeChange: (nextType) => updateOperationType(operation, nextType),
      onGapChange: (gap) => updateOperation(operation.id, { gap }),
      onPlanePick: () => beginPickOperationPlane(operation),
      onPlaneRemove: (referencePlaneId) => removeOperationPlane(operation, referencePlaneId),
      onRegionToggle: (regionKeyValue) => toggleRegionRemoved(operation, regionKeyValue),
      onSwap: usesMemberB ? () => swapOperation(operation) : null,
      onRemove: () => removeOperation(operation.id)
    };
  };

  const operationList = ({ operations, canAdd = false, totalOperations = operations.length, activeCutNumber = null }) => {
    const section = document.createElement("div");
    section.className = "trim-editor-section";
    const toolbar = document.createElement("div");
    toolbar.className = "trim-section-toolbar";
    toolbar.append(text("div", "editor-section-title", activeOperationId ? `Selected cut ${activeCutNumber} of ${totalOperations}` : "Cuts"));
    if (activeOperationId) toolbar.append(button("Show All", "editor-button", () => {
      activeOperationId = null;
      activeRegionKey = null;
      render();
      notifyFocusChange();
    }));
    if (canAdd && !activeOperationId) toolbar.append(button("New Cut", "editor-button primary", addOperationFromToolbar));
    section.append(toolbar);
    if (!operations.length) section.append(text("div", "editor-empty", "Add a cut, then pick the cut member and cutting member from the model."));
    else section.append(...operations.map(operationCard));
    return section;
  };

  const memberList = ({ participants, canAdd = false }) => {
    const section = document.createElement("div");
    section.className = "trim-editor-section";
    const toolbar = document.createElement("div");
    toolbar.className = "trim-section-toolbar";
    toolbar.append(text("div", "editor-section-title", "Members"));
    if (canAdd) toolbar.append(button("Add Member", "editor-button", beginAddParticipant));
    const list = document.createElement("div");
    list.className = "trim-member-list";
    for (const participant of participants) {
      const member = api.member(participant.memberId);
      const row = document.createElement("div");
      row.className = "trim-member-row";
      row.dataset.active = participant.memberId === activeMemberId ? "true" : "false";
      row.append(
        memberButton(participant.memberId, memberColor(api, participant.memberId, "#94a3b8"), "trim-participant-member", () => selectMember(participant.memberId)),
        text("div", "trim-participant-profile", profileLabel(profiles, member))
      );
      if (participant.canRemove) row.append(button("Remove", "editor-button danger", () => removeParticipant(participant.memberId)));
      list.append(row);
    }
    section.append(toolbar, list);
    return section;
  };

  const trimJointEditorModel = (trimJoint) => {
    const sourceOperations = trimJointOperations(trimJoint);
    const activeIndex = activeOperationId ? sourceOperations.findIndex((operation) => operation.id === activeOperationId) : -1;
    if (activeOperationId && activeIndex < 0) activeOperationId = null;
    const visibleOperations = activeOperationId ? [sourceOperations[activeIndex]] : sourceOperations;
    return {
      id: trimJoint.id,
      operations: visibleOperations.map((operation) => trimJointOperationModel(operation, sourceOperations.indexOf(operation))),
      totalOperations: sourceOperations.length,
      activeCutNumber: activeOperationId ? activeIndex + 1 : null,
      participants: trimJointParticipants(trimJoint).map((participant) => ({ ...participant, canRemove: true })),
      canAddOperations: true,
      canAddParticipants: true
    };
  };

  const editorRows = (model) => [
    readout("Trim", model.id),
    operationList({
      operations: model.operations,
      canAdd: model.canAddOperations,
      totalOperations: model.totalOperations,
      activeCutNumber: model.activeCutNumber
    }),
    memberList({ participants: model.participants, canAdd: model.canAddParticipants })
  ];

  function clear() {
    const hadFocus = Boolean(selectedTrimJointId);
    selectedTrimJointId = null;
    activeOperationId = null;
    activeRegionKey = null;
    activeMemberId = null;
    panelMessage.clear({ render: false });
    render();
    if (hadFocus) notifyFocusChange();
  }

  function render() {
    const trimJoint = selectedTrimJoint();
    const model = trimJoint ? trimJointEditorModel(trimJoint) : null;
    if (!model) {
      hidePanel(panel);
      return;
    }

    renderEditorPanel(panel, "Trim Editor", clear, editorRows(model), panelMessage.element());
  }

  api.subscribe(() => {
    if (selectedTrimJointId && !api.project().model.trimJoints?.[selectedTrimJointId]) clear();
    else render();
  });
  render();

  return {
    selectTrimJoint(trimJointId, options = {}) {
      const trimJoint = api.project().model.trimJoints?.[trimJointId];
      if (!trimJoint) {
        clear();
        return;
      }
      selectedTrimJointId = trimJointId;
      activeOperationId = trimOperationById(trimJoint, options.operationId) ? options.operationId : null;
      activeRegionKey = activeOperationId && typeof options.regionKey === "string" ? options.regionKey : null;
      activeMemberId = null;
      const operation = activeOperation();
      panelMessage.set(activeRegionKey ? `Selected region ${activeRegionKey}.` : operation ? `Selected ${trimOperationLabel(operation.type)}.` : "", operation ? "ok" : "", { render: false });
      selection.select(trimObjectIds());
      render();
      notifyFocusChange();
    },
    toggleRegionFromFace(face) {
      let trimJoint = null;
      let operation = null;
      let regionKeyValue = null;
      if (face?.collection === "trimJoints" && face.componentKind === "trim-region" && face.objectId && face.operationId && face.regionKey) {
        trimJoint = api.project().model.trimJoints?.[face.objectId] || null;
        operation = trimOperationById(trimJoint, face.operationId);
        regionKeyValue = face.regionKey;
      } else if (face?.collection === "members" && selectedTrimJointId && Array.isArray(face.hitPoint)) {
        trimJoint = selectedTrimJoint();
        operation = activePlaneTrimOperationForMember(face.objectId);
        regionKeyValue = operation ? regionKeyForPoint(operation, face.hitPoint) : null;
      }
      if (!operation || operation.type !== "plane-trim") return false;
      const validRegions = planeTrimRegionKeys(uniqueTruthy(trimOperationReferencePlaneIds(operation)));
      if (!regionKeyValue || !validRegions.includes(regionKeyValue)) return false;
      selectedTrimJointId = trimJoint.id;
      activeOperationId = operation.id;
      activeRegionKey = regionKeyValue;
      activeMemberId = operation.memberAId || null;
      notifyFocusChange();
      toggleRegionRemoved(operation, regionKeyValue);
      return true;
    },
    sceneFocus() {
      return sceneFocus();
    },
    clear
  };
}
