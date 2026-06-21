import { finiteNumberOr, v } from "../../../engine/core/math.mjs";
import { arrayValues, uniqueTruthy } from "../../../engine/core/model.mjs";
import { defaultPlaneTrimRemovedRegionKeys, planeTrimRegionKeys, reconcilePlaneTrimRemovedRegionKeys, regionKey } from "../../../engine/api/model/trim-region-keys.mjs";
import { libraryProfileById } from "../../../engine/api/project/profiles.mjs";
import { trimJointOperations, trimJointParticipants, trimOperationById, trimOperationReferencePlaneIds, trimOperationUsesMemberB, trimOperationUsesMemberEnd, trimPlaneOperationsForMember } from "../../../engine/api/project/trim-operations.mjs";
import { TRIM_OPERATION_TYPES, trimOperationIcon, trimOperationLabel, trimOperationSupportsGap } from "../../commands/trim-operation-metadata.mjs";
import { button, createPanelMessageState, disclosureSection, field, hidePanel, renderEditorPanel, text } from "./panel-elements.mjs";
import { bindGeneratedPropertySections } from "./generated-property-bindings.mjs";
import { generatedPropertyField } from "./generated-properties-panel.mjs";

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
const TRIM_MEMBER_SWATCH_FALLBACK = "var(--bc-color-guide)";

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

export function mountTrimJointEditorPanel({ panel, api, profiles, selection, onLocalObjectProjectChange, onFocusChange, onEmptyRender }) {
  let selectedTrimJointId = null;
  let activeOperationId = null;
  let activeRegionKey = null;
  let activeMemberId = null;
  let createMode = false;
  let createPickedMemberIds = [];
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

  const trimOperationCommit = (operation, patchKey) => ({
    action: "trim.operation.update",
    operationId: operation.id,
    patchKey
  });

  const trimOperationTypeCommit = (operation) => ({
    action: "trim.operation.type.set",
    operationId: operation.id
  });

  const trimMemberEndCommit = (operation, member) => ({
    action: "trim.operation.memberEnd.set",
    operationId: operation.id,
    role: member.role,
    messageLabel: member.messageLabel || member.label
  });

  const trimEditorAction = (action, payload = {}) => ({ action, payload });

  const trimEditorBindings = () => ({
    commits: {
      "trim.operation.type.set": (value, commit = {}) => {
        const operation = trimOperationById(selectedTrimJoint(), commit.operationId);
        if (!operation) return;
        updateOperationType(operation, value);
      },
      "trim.operation.update": (value, commit = {}) => {
        if (!commit.operationId || !commit.patchKey) return;
        const message = commit.patchKey === "miterMode"
          ? `${value === "profile-balanced" ? "Balanced profile" : "Equal angle"} miter selected.`
          : "Trim updated.";
        updateOperation(commit.operationId, { [commit.patchKey]: value }, message);
      },
      "trim.operation.memberEnd.set": (value, commit = {}) => {
        if (!commit.operationId || !commit.role) return;
        const option = MEMBER_END_OPTIONS.find((item) => item.id === value);
        const optionLabel = option?.label || value;
        updateOperation(
          commit.operationId,
          { [`${commit.role}End`]: value },
          `${commit.messageLabel || commit.role} ${String(optionLabel).toLowerCase()} end selected.`
        );
      }
    },
    actions: {
      "trim.plane.pick": (field = {}) => {
        const operation = trimOperationById(selectedTrimJoint(), field.payload?.operationId);
        if (operation) beginPickOperationPlane(operation);
      },
      "trim.plane.remove": (field = {}) => {
        const operation = trimOperationById(selectedTrimJoint(), field.payload?.operationId);
        const referencePlaneId = field.payload?.referencePlaneId;
        if (operation && referencePlaneId) removeOperationPlane(operation, referencePlaneId);
      },
      "trim.region.toggle": (field = {}) => {
        const operation = trimOperationById(selectedTrimJoint(), field.payload?.operationId);
        const regionKeyValue = field.payload?.regionKey;
        if (operation && regionKeyValue) toggleRegionRemoved(operation, regionKeyValue);
      }
    }
  });

  const renderTrimFields = (fields = []) => {
    const section = bindGeneratedPropertySections([{ id: "trim.editor.inline", fields }], trimEditorBindings())[0];
    return (section?.fields || []).map(generatedPropertyField).filter(Boolean);
  };

  const renderTrimField = (field) => renderTrimFields([field])[0] || null;

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

  const trimTypeOptions = (operation) => {
    return operation.typeOptions.map((option) => ({
      ...option,
      icon: trimOperationIcon(option.id)
    }));
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

  const trimMemberEndField = (operation, member) => renderTrimField({
    type: "segmented",
    label: "End",
    value: member.end || "end",
    options: MEMBER_END_OPTIONS,
    className: "trim-member-end-segment",
    buttonClassName: "trim-member-end-segment-button",
    commit: trimMemberEndCommit(operation, member)
  });

  const memberPicker = (operation, member) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-member-picker";
    const color = memberColor(api, member.id, TRIM_MEMBER_SWATCH_FALLBACK);
    wrap.append(memberButton(memberName(api, member.id), color, "trim-member-value", () => member.id && selectMember(member.id)));
    const endField = member.showEnd ? trimMemberEndField(operation, member) : null;
    if (endField) wrap.append(endField);
    if (member.canPick !== false) wrap.append(button("Pick", "bc-button", member.onPick));
    return wrap;
  };

  const planeLabel = (referencePlaneId) => api.project().model.referencePlanes?.[referencePlaneId]?.name || referencePlaneId;

  const regionLabel = (regionKeyValue) => regionKeyValue.split("|")
    .map((part) => {
      const index = part.lastIndexOf(":");
      return `${planeLabel(part.slice(0, index))} ${part.slice(index + 1)}`;
    })
    .join(", ");

  const planeTrimPlanesField = (operation) => ({
    type: "actionList",
    label: "Planes",
    emptyMessage: "No planes picked.",
    actions: [
      ...operation.referencePlaneIds.map((referencePlaneId) => ({
        label: `Remove ${planeLabel(referencePlaneId)}`,
        icon: "cancel",
        danger: true,
        title: `Remove ${planeLabel(referencePlaneId)} from this trim`,
        ...trimEditorAction("trim.plane.remove", { operationId: operation.id, referencePlaneId })
      })),
      {
        label: "Pick Plane",
        icon: "selection",
        primary: true,
        ...trimEditorAction("trim.plane.pick", { operationId: operation.id })
      }
    ]
  });

  const planeTrimRegionsField = (operation) => ({
    type: "actionList",
    label: "Regions",
    emptyMessage: "Pick planes to create removable regions.",
    actions: operation.regionKeys.map((regionKeyValue) => {
      const isRemoved = operation.removedRegionKeys.includes(regionKeyValue);
      return {
        label: `${isRemoved ? "Remove" : "Keep"}: ${regionLabel(regionKeyValue)}`,
        danger: isRemoved,
        pressed: regionKeyValue === activeRegionKey,
        title: isRemoved ? "Click to keep this region" : "Click to remove this region",
        ...trimEditorAction("trim.region.toggle", { operationId: operation.id, regionKey: regionKeyValue })
      };
    })
  });

  const operationCard = (operation, index) => {
    const card = document.createElement("div");
    card.className = "trim-cut-card";
    card.dataset.active = operation.id === activeOperationId ? "true" : "false";

    const header = document.createElement("div");
    header.className = "trim-cut-header";
    header.append(text("div", "bc-section-title", `Cut ${operation.cutNumber || index + 1}: ${trimOperationLabel(operation.type)}`));
    if (operation.onSwap) header.append(button("Swap", "bc-button", operation.onSwap));
    if (operation.onRemove) header.append(button("Remove", "bc-button bc-button-danger", operation.onRemove));

    const rows = renderTrimFields([{
      type: "checkbox",
      label: "Enabled",
      value: operation.enabled !== false,
      commit: trimOperationCommit(operation, "enabled")
    }]);
    rows.push(field(operation.memberA.label, memberPicker(operation, operation.memberA)));
    if (operation.memberB) rows.push(field(operation.memberB.label, memberPicker(operation, operation.memberB)));
    rows.push(...renderTrimFields([{
      type: "optionGrid",
      label: "Result",
      value: operation.type,
      options: trimTypeOptions(operation),
      commit: trimOperationTypeCommit(operation)
    }]));
    if (operation.referencePlane) {
      rows.push(...renderTrimFields([planeTrimPlanesField(operation), planeTrimRegionsField(operation)]));
    }
    if (operation.showGap) {
      rows.push(...renderTrimFields([{
        type: "number",
        label: "Gap",
        value: finiteNumberOr(operation.gap, 0),
        commit: trimOperationCommit(operation, "gap")
      }]));
    }
    if (operation.miterModeOptions) {
      rows.push(...renderTrimFields([{
        type: "segmented",
        label: "Miter",
        value: operation.miterMode,
        options: operation.miterModeOptions,
        commit: trimOperationCommit(operation, "miterMode")
      }]));
    }
    rows.push(...arrayValues(operation.extraRows));
    card.append(header, ...rows);
    return card;
  };

  const operationMemberRoleModel = (operation, type, role, label, messageLabel = label) => ({
    label,
    role,
    id: operation[`${role}Id`],
    showEnd: trimOperationUsesMemberEnd(type, role),
    end: operation[`${role}End`] || "end",
    messageLabel,
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
      onSwap: usesMemberB ? () => swapOperation(operation) : null,
      onRemove: () => removeOperation(operation.id)
    };
  };

  const operationList = ({ operations, canAdd = false, totalOperations = operations.length, activeCutNumber = null }) => {
    const section = document.createElement("div");
    section.className = "bc-trim-section";
    const toolbar = document.createElement("div");
    toolbar.className = "trim-section-toolbar";
    if (activeOperationId) toolbar.append(button("Show All", "bc-button", () => {
      activeOperationId = null;
      activeRegionKey = null;
      render();
      notifyFocusChange();
    }));
    if (canAdd && !activeOperationId) toolbar.append(button("New Cut", "bc-button bc-button-primary", addOperationFromToolbar));
    if (toolbar.childElementCount) section.append(toolbar);
    if (!operations.length) section.append(text("div", "bc-empty", "Add a cut, then pick the cut member and cutting member from the model."));
    else section.append(...operations.map(operationCard));
    return section;
  };

  const memberList = ({ participants, canAdd = false }) => {
    const section = document.createElement("div");
    section.className = "bc-trim-section";
    const toolbar = document.createElement("div");
    toolbar.className = "trim-section-toolbar";
    if (canAdd) toolbar.append(button("Add Member", "bc-button", beginAddParticipant));
    const list = document.createElement("div");
    list.className = "trim-member-list";
    for (const participant of participants) {
      const member = api.member(participant.memberId);
      const row = document.createElement("div");
      row.className = "trim-member-row";
      row.dataset.active = participant.memberId === activeMemberId ? "true" : "false";
      row.append(
        memberButton(participant.memberId, memberColor(api, participant.memberId, TRIM_MEMBER_SWATCH_FALLBACK), "trim-participant-member", () => selectMember(participant.memberId)),
        text("div", "trim-participant-profile", profileLabel(profiles, member))
      );
      if (participant.canRemove) row.append(button("Remove", "bc-button bc-button-danger", () => removeParticipant(participant.memberId)));
      list.append(row);
    }
    if (toolbar.childElementCount) section.append(toolbar);
    section.append(list);
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

  const editorRows = (model) => {
    const cutsLabel = model.activeCutNumber
      ? `Selected cut ${model.activeCutNumber} of ${model.totalOperations}`
      : `Cuts (${model.totalOperations})`;
    return [
      disclosureSection("Overview", renderTrimFields([
        { label: "Trim", value: model.id },
        { label: "Cuts", value: String(model.totalOperations) },
        { label: "Members", value: String(model.participants.length) }
      ]), { open: true, sectionId: "trim.overview" }),
      disclosureSection(cutsLabel, [operationList({
        operations: model.operations,
        canAdd: model.canAddOperations,
        totalOperations: model.totalOperations,
        activeCutNumber: model.activeCutNumber
      })], { open: true, sectionId: "trim.cuts" }),
      disclosureSection(`Members (${model.participants.length})`, [
        memberList({ participants: model.participants, canAdd: model.canAddParticipants })
      ], { open: Boolean(activeMemberId), sectionId: "trim.members" })
    ];
  };

  const createModeRows = () => {
    const picked = createPickedMemberIds.map((memberId, index) => field(
      index === 0 ? "First member" : "Second member",
      text("span", "bc-value", memberName(api, memberId))
    ));
    return [
      disclosureSection("Create Trim", [
        text("div", "bc-empty", "Pick two members in the model to create a trim joint."),
        ...picked,
        field("Next pick", text("span", "bc-value", createPickedMemberIds.length ? "Second member" : "First member"))
      ], { open: true, sectionId: "trim.create" })
    ];
  };

  function clear() {
    const hadFocus = Boolean(selectedTrimJointId || createMode);
    selectedTrimJointId = null;
    activeOperationId = null;
    activeRegionKey = null;
    activeMemberId = null;
    createMode = false;
    createPickedMemberIds = [];
    panelMessage.clear({ render: false });
    render();
    if (hadFocus) notifyFocusChange();
  }

  function render() {
    const trimJoint = selectedTrimJoint();
    const model = trimJoint ? trimJointEditorModel(trimJoint) : null;
    if (createMode) {
      renderEditorPanel(panel, "Trim Editor", clear, createModeRows(), panelMessage.element());
      return;
    }
    if (!model) {
      if (typeof onEmptyRender === "function") {
        onEmptyRender();
        return;
      }
      hidePanel(panel);
      return;
    }

    renderEditorPanel(panel, "Trim Editor", clear, editorRows(model), panelMessage.element());
  }

  const unsubscribe = api.subscribe(() => {
    if (selectedTrimJointId && !api.project().model.trimJoints?.[selectedTrimJointId]) clear();
    else render();
  });
  render();

  return {
    openCreateMode(options = {}) {
      selectedTrimJointId = null;
      activeOperationId = null;
      activeRegionKey = null;
      activeMemberId = null;
      createMode = true;
      createPickedMemberIds = uniqueTruthy(options.pickedMemberIds || []);
      const message = createPickedMemberIds.length
        ? "Pick second member."
        : "Pick first member.";
      panelMessage.set(message, "ok", { render: false });
      render();
      notifyFocusChange();
    },
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
      createMode = false;
      createPickedMemberIds = [];
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
    clear,
    destroy() {
      unsubscribe();
    }
  };
}
