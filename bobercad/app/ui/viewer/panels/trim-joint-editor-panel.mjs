import { finiteNumberOr, v } from "../../../engine/core/math.mjs";
import { arrayValues, jsonClone, uniqueTruthy } from "../../../engine/core/model.mjs";
import { defaultPlaneTrimRemovedRegionKeys, isObjectTrimRegionKey, objectTrimRegionKeyParts, planeTrimRegionKeys, reconcileObjectTrimRemovedRegionKeys, reconcilePlaneTrimRemovedRegionKeys, regionKey } from "../../../engine/api/model/trim-region-keys.mjs";
import { trimJointOperations, trimJointParticipants, trimOperationById, trimOperationMemberIds, trimOperationReferencePlaneIds, trimOperationUsesMemberB, trimOperationUsesMemberEnd, trimPlaneOperationsForMember } from "../../../engine/api/project/trim-operations.mjs";
import { trimOperationIcon, trimOperationLabel, trimOperationSupportsGap } from "../../commands/trim-operation-metadata.mjs";
import { button, createPanelMessageState, hidePanel, renderEditorPanel, text } from "./panel-elements.mjs";
import { bindGeneratedPropertySections } from "./generated-property-bindings.mjs";
import { generatedPropertyField } from "./generated-properties-panel.mjs";
import { defaultTrimJointOperation, defaultTrimJointParticipant } from "../../../engine/store/project-store-model-helpers.mjs";

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
const END_TRIM_TARGET_OPTIONS = [
  { id: "plane-trim", label: "Plane" },
  { id: "profile-cope", label: "Member" }
];
const TRIM_MEMBER_ROLE_COLORS = Object.freeze({
  memberA: "var(--bc-color-accent)",
  memberB: "var(--bc-color-warning)"
});
const TRIM_MEMBER_SWATCH_FALLBACK = "var(--bc-color-guide)";
const PREVIEW_TRIM_JOINT_ID = "__trim_preview_joint";
const PREVIEW_TRIM_OPERATION_ID = "__trim_preview_operation";
const isValidMemberEnd = (value) => value === "start" || value === "end";
const isEndTrimType = (type) => type === "plane-trim" || type === "profile-cope";
const isButtTrimType = (type) => type === "end-butt-1" || type === "end-butt-2" || type === "end-butt-both";
const trimEditorOperationLabel = (type) => isButtTrimType(type) ? "Butt trim" : isEndTrimType(type) ? "Object trim" : trimOperationLabel(type);
const trimMemberRoleColor = (role) => TRIM_MEMBER_ROLE_COLORS[role] || TRIM_MEMBER_SWATCH_FALLBACK;

const trimOperationTypeCleanupPatch = (type) => {
  const patch = {};
  if (!trimOperationUsesMemberEnd(type, "memberA")) patch.memberAEnd = undefined;
  if (!trimOperationUsesMemberEnd(type, "memberB")) patch.memberBEnd = undefined;
  if (!trimOperationUsesMemberB(type)) patch.memberBId = undefined;
  if (type !== "profile-cope") {
    patch.memberAIds = undefined;
    patch.memberBIds = undefined;
  }
  if (type !== "plane-trim") {
    patch.referencePlaneId = undefined;
    patch.referencePlaneIds = undefined;
    if (type !== "profile-cope") patch.removedRegionKeys = undefined;
  }
  if (type !== "end-miter") patch.miterMode = undefined;
  if (!isEndTrimType(type)) patch.allowExtension = undefined;
  return patch;
};

function titleCaseLabel(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function compactEntityLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const spaced = raw.replace(/^connection_/, "");
  if (!spaced.includes("_")) return spaced;
  let parts = spaced.split("_").filter(Boolean);
  const projectIndex = parts.findIndex((part, index) => /^\d+$/.test(part) && index >= 3 && index < parts.length - 1);
  if (projectIndex >= 0) parts = parts.slice(projectIndex + 1);
  return titleCaseLabel(parts.join(" "));
}

function memberName(api, memberId) {
  if (!memberId) return "Pick member";
  const member = api.member(memberId);
  const label = compactEntityLabel(memberId);
  const descriptor = member.type || member.profile || "";
  if (!descriptor) return label;
  const descriptorLabel = titleCaseLabel(descriptor);
  return descriptorLabel === label ? label : `${label} (${descriptorLabel})`;
}

const draftMemberIds = (draft, role) => uniqueTruthy([
  ...arrayValues(draft[`${role}Ids`]),
  draft[`${role}Id`]
]);

const isTrimMemberRole = (role) => role === "memberA" || role === "memberB";

const CREATE_TRIM_DRAFT_TYPES = new Set(["profile-cope", "plane-trim", "end-miter", "end-butt-1", "end-butt-2", "end-butt-both"]);
const createTrimDraft = (pickedMemberIds = []) => {
  const memberIds = uniqueTruthy(pickedMemberIds);
  return {
    type: "profile-cope",
    memberAId: memberIds[0] || null,
    memberBId: memberIds[1] || null,
    memberAIds: memberIds[0] ? [memberIds[0]] : [],
    memberBIds: memberIds[1] ? [memberIds[1]] : [],
    referencePlaneIds: [],
    gap: 0,
    allowExtension: false,
    miterMode: "equal-angle",
    memberAEnd: "end",
    memberBEnd: "end"
  };
};

const normalizeCreateDraftRemovedRegionKeys = (draft, type, referencePlaneIds) => {
  if (type === "profile-cope") return arrayValues(draft.removedRegionKeys).filter(isObjectTrimRegionKey);
  if (type !== "plane-trim") return [];
  if (!referencePlaneIds.length) return [];
  if (!Array.isArray(draft.removedRegionKeys)) return defaultPlaneTrimRemovedRegionKeys(referencePlaneIds);
  return reconcilePlaneTrimRemovedRegionKeys({ removedRegionKeys: draft.removedRegionKeys }, referencePlaneIds);
};

const normalizeCreateTrimDraft = (draft = {}) => {
  const type = CREATE_TRIM_DRAFT_TYPES.has(draft.type) ? draft.type : "profile-cope";
  const memberAIds = draftMemberIds(draft, "memberA");
  const rawMemberBIds = trimOperationUsesMemberB(type) ? draftMemberIds(draft, "memberB") : [];
  const normalizedMemberAIds = type === "profile-cope" ? memberAIds : memberAIds.slice(0, 1);
  const normalizedMemberBIds = type === "profile-cope" ? rawMemberBIds : rawMemberBIds.slice(0, 1);
  const referencePlaneIds = type === "plane-trim" ? uniqueTruthy(draft.referencePlaneIds || []) : [];
  return {
    type,
    memberAId: normalizedMemberAIds[0] || null,
    memberBId: normalizedMemberBIds[0] || null,
    memberAIds: normalizedMemberAIds,
    memberBIds: normalizedMemberBIds,
    referencePlaneIds,
    removedRegionKeys: normalizeCreateDraftRemovedRegionKeys(draft, type, referencePlaneIds),
    gap: trimOperationSupportsGap(type) ? finiteNumberOr(draft.gap, 0) : 0,
    allowExtension: isEndTrimType(type) && draft.allowExtension === true,
    miterMode: draft.miterMode === "profile-balanced" ? "profile-balanced" : "equal-angle",
    memberAEnd: isValidMemberEnd(draft.memberAEnd) ? draft.memberAEnd : "end",
    memberBEnd: isValidMemberEnd(draft.memberBEnd) ? draft.memberBEnd : "end"
  };
};

export function mountTrimJointEditorPanel({ panel, api, selection, onProjectChange, onLocalObjectProjectChange, onDraftPreviewChange, onFocusChange, onEmptyRender, onCreateModeEnd }) {
  let selectedTrimJointId = null;
  let activeOperationId = null;
  let activeRegionKey = null;
  let activeMemberId = null;
  let createMode = false;
  let createDraft = createTrimDraft();
  let activeDraftPick = null;
  let activeProfileCopeListPick = null;
  let createDraftPreviewObjectIds = [];
  let createDraftPreviewActive = false;
  let consumeNextSceneClick = false;
  const panelMessage = createPanelMessageState(() => render());
  const setMessage = panelMessage.set;

  const selectedTrimJoint = () => selectedTrimJointId ? api.project().model.trimJoints?.[selectedTrimJointId] || null : null;
  const selectedTrimJointParticipants = () => trimJointParticipants(selectedTrimJoint());
  const operationMemberEndFallback = (operation, role) => {
    const operationEnd = operation?.[`${role}End`];
    if (isValidMemberEnd(operationEnd)) return operationEnd;
    const memberId = operation?.[`${role}Id`];
    const participantEnd = selectedTrimJointParticipants().find((participant) => participant.memberId === memberId)?.memberEnd;
    if (isValidMemberEnd(participantEnd)) return participantEnd;
    return role === "memberA" ? "start" : "end";
  };

  const activeOperation = () => {
    const trimJoint = selectedTrimJoint();
    return trimOperationById(trimJoint, activeOperationId);
  };

  const trimObjectIds = () => {
    return selectedTrimJointId ? api.trimJointDependencyObjectIds(selectedTrimJointId, { renderableOnly: true }) : [];
  };

  const trimRoleForMemberId = (memberId) => {
    if (!memberId) return null;
    if (createMode) {
      if (createDraft.memberAIds.includes(memberId)) return "memberA";
      if (createDraft.memberBIds.includes(memberId)) return "memberB";
    }
    const currentOperation = activeOperation();
    const operations = currentOperation ? [currentOperation] : trimJointOperations(selectedTrimJoint());
    for (const operation of operations) {
      if (trimOperationMemberIds(operation, "memberA").includes(memberId)) return "memberA";
      if (trimOperationMemberIds(operation, "memberB").includes(memberId)) return "memberB";
    }
    return null;
  };

  const trimHighlightOptions = (objectIds = [], forcedRoleByObjectId = {}) => {
    const highlightColorsByObjectId = {};
    for (const objectId of uniqueTruthy(objectIds)) {
      if (!api.project().model.members?.[objectId]) continue;
      const role = forcedRoleByObjectId[objectId] || trimRoleForMemberId(objectId);
      if (role) highlightColorsByObjectId[objectId] = trimMemberRoleColor(role);
    }
    return Object.keys(highlightColorsByObjectId).length ? { highlightColorsByObjectId } : {};
  };

  const selectTrimObjects = (objectIds = [], forcedRoleByObjectId = {}) => {
    const ids = uniqueTruthy(objectIds);
    return selection.select(ids, trimHighlightOptions(ids, forcedRoleByObjectId));
  };

  const selectTrimMember = (memberId, role = null) => {
    return selectTrimObjects([memberId], role ? { [memberId]: role } : {});
  };

  const sceneFocus = () => selectedTrimJointId ? {
    activeTrimJointId: selectedTrimJointId,
    activeTrimOperationId: activeOperationId
  } : createMode && createDraftPreviewActive ? {
    activeTrimJointId: PREVIEW_TRIM_JOINT_ID,
    activeTrimOperationId: PREVIEW_TRIM_OPERATION_ID
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

  const updateTrimJoint = (operation, successMessage = "Trim updated.", highlightMemberId = activeMemberId, highlightMemberRole = null, options = {}) => {
    if (!selectedTrimJointId) return;
    try {
      const beforeObjectIds = trimObjectIds();
      const nextProject = operation(selectedTrimJointId);
      const affectedObjectIds = uniqueTruthy([...beforeObjectIds, ...trimObjectIds()]);
      applyProjectChange(nextProject, affectedObjectIds);
      if (options.selectTrimJointOnly) selection.select([selectedTrimJointId]);
      else if (highlightMemberId && nextProject.model.members?.[highlightMemberId]) selectTrimMember(highlightMemberId, highlightMemberRole);
      else selectTrimObjects(affectedObjectIds);
      setMessage(successMessage, "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const selectMember = (memberId, role = null) => {
    activeMemberId = memberId;
    selectTrimMember(memberId, role);
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const draftObjectIds = () => uniqueTruthy([
    ...arrayValues(createDraft.memberAIds),
    ...arrayValues(createDraft.memberBIds),
    ...arrayValues(createDraft.referencePlaneIds)
  ]);

  const createDraftReadyStatus = () => {
    if (!createDraft.memberAIds.length) return { ready: false, message: "Pick object to trim." };
    if (createDraft.type === "plane-trim") {
      return createDraft.referencePlaneIds.length
        ? { ready: true }
        : { ready: false, message: "Pick trimming plane." };
    }
    if (!createDraft.memberBIds.length) {
      return {
        ready: false,
        message: createDraft.type === "profile-cope" ? "Pick cutting object." : "Pick second profile."
      };
    }
    const duplicateIds = createDraft.memberAIds.filter((memberId) => createDraft.memberBIds.includes(memberId));
    if (duplicateIds.length) return { ready: false, message: "Objects to trim and cutting objects must be different." };
    return { ready: true };
  };

  const createDraftOperationPatch = () => {
    const type = createDraft.type;
    const basePatch = { gap: finiteNumberOr(createDraft.gap, 0) };
    if (type === "profile-cope") {
      return {
        ...basePatch,
        memberAId: createDraft.memberAIds[0],
        memberBId: createDraft.memberBIds[0],
        memberAIds: uniqueTruthy(createDraft.memberAIds),
        memberBIds: uniqueTruthy(createDraft.memberBIds),
        removedRegionKeys: normalizeCreateDraftRemovedRegionKeys(createDraft, type, []),
        allowExtension: createDraft.allowExtension === true
      };
    }
    const patch = {
      ...basePatch,
      memberAId: createDraft.memberAId
    };
    if (trimOperationUsesMemberB(type)) patch.memberBId = createDraft.memberBId;
    if (trimOperationUsesMemberEnd(type, "memberA")) patch.memberAEnd = createDraft.memberAEnd;
    if (trimOperationUsesMemberEnd(type, "memberB")) patch.memberBEnd = createDraft.memberBEnd;
    if (type === "plane-trim") {
      patch.referencePlaneIds = uniqueTruthy(createDraft.referencePlaneIds);
      patch.removedRegionKeys = normalizeCreateDraftRemovedRegionKeys(createDraft, type, patch.referencePlaneIds);
    }
    if (type === "end-miter") patch.miterMode = createDraft.miterMode;
    if (isEndTrimType(type)) patch.allowExtension = createDraft.allowExtension === true;
    return patch;
  };

  const previewTrimObjectIds = () => uniqueTruthy([PREVIEW_TRIM_JOINT_ID, ...draftObjectIds()]);

  const clearCreateDraftPreview = () => {
    if (!createDraftPreviewObjectIds.length) return;
    const objectIds = createDraftPreviewObjectIds;
    createDraftPreviewObjectIds = [];
    createDraftPreviewActive = false;
    onDraftPreviewChange?.(null, objectIds);
  };

  const createDraftPreviewProject = () => {
    const status = createDraftReadyStatus();
    if (!status.ready) return null;
    const sourceProject = api.project();
    const previewProject = jsonClone(sourceProject);
    previewProject.model.trimJoints = { ...(previewProject.model.trimJoints || {}) };
    previewProject.objectIndex = { ...(previewProject.objectIndex || {}) };
    const memberIds = uniqueTruthy([
      ...arrayValues(createDraft.memberAIds),
      ...arrayValues(createDraft.memberBIds)
    ]);
    const trimJoint = {
      id: PREVIEW_TRIM_JOINT_ID,
      type: createDraft.type === "plane-trim" ? "member-trim" : "corner-trim",
      gap: 0,
      participants: [],
      operations: []
    };
    for (const memberId of memberIds) {
      trimJoint.participants.push(defaultTrimJointParticipant(previewProject, trimJoint, memberId));
    }
    trimJoint.operations.push(defaultTrimJointOperation(trimJoint, {
      ...createDraftOperationPatch(),
      type: createDraft.type,
      id: PREVIEW_TRIM_OPERATION_ID
    }));
    previewProject.model.trimJoints[PREVIEW_TRIM_JOINT_ID] = trimJoint;
    previewProject.objectIndex[PREVIEW_TRIM_JOINT_ID] = {
      collection: "trimJoints",
      type: trimJoint.type
    };
    return previewProject;
  };

  const updateCreateDraftPreview = () => {
    if (!createMode) {
      clearCreateDraftPreview();
      return;
    }
    const previousObjectIds = createDraftPreviewObjectIds;
    const status = createDraftReadyStatus();
    if (!status.ready) {
      clearCreateDraftPreview();
      return;
    }
    try {
      const previewProject = createDraftPreviewProject();
      if (!previewProject) {
        clearCreateDraftPreview();
        return;
      }
      const objectIds = uniqueTruthy([...previousObjectIds, ...previewTrimObjectIds()]);
      createDraftPreviewObjectIds = objectIds;
      createDraftPreviewActive = true;
      onDraftPreviewChange?.({ project: previewProject, objectIds }, objectIds);
    } catch (error) {
      clearCreateDraftPreview();
      setMessage(error.message, "error");
    }
  };

  const finishCreateMode = (detail = {}) => {
    if (typeof onCreateModeEnd === "function") onCreateModeEnd(detail);
  };

  const consumeCurrentSceneClick = () => {
    consumeNextSceneClick = true;
  };

  const tryCreateDraftTrim = (options = {}) => {
    const status = createDraftReadyStatus();
    if (!status.ready) {
      if (options.force) setMessage(status.message, "error");
      return false;
    }
    try {
      clearCreateDraftPreview();
      const operationPatch = createDraftOperationPatch();
      const result = api.createTrimJoint({
        memberIds: uniqueTruthy([
          ...arrayValues(createDraft.memberAIds),
          ...arrayValues(createDraft.memberBIds)
        ]),
        operationType: createDraft.type,
        operationPatch
      });
      selectedTrimJointId = result.trimJointId;
      const operation = trimJointOperations(result.trimJoint)[0] || null;
      activeOperationId = operation?.id || null;
      activeRegionKey = null;
      activeMemberId = createDraft.memberAId;
      createMode = false;
      createDraft = createTrimDraft();
      activeDraftPick = null;
      activeProfileCopeListPick = null;
      onProjectChange?.(result.project);
      selectTrimObjects(trimObjectIds());
      setMessage(`Trim created: ${result.trimJointId}.`, "ok");
      finishCreateMode({ created: true, trimJointId: result.trimJointId, operationId: operation?.id || null });
      notifyFocusChange();
      return true;
    } catch (error) {
      setMessage(error.message, "error");
      return false;
    }
  };

  const setCreateDraftPatch = (patch, message = "Trim draft updated.", options = {}) => {
    if (!createMode) return false;
    createDraft = normalizeCreateTrimDraft({ ...createDraft, ...patch });
    selectTrimObjects(draftObjectIds());
    setMessage(message, options.state || "ok");
    notifyFocusChange();
    updateCreateDraftPreview();
    return true;
  };

  const setCreateDraftType = (type) => {
    const nextType = CREATE_TRIM_DRAFT_TYPES.has(type) ? type : "profile-cope";
    activeDraftPick = null;
    activeProfileCopeListPick = null;
    const patch = {
      type: nextType,
      ...(isEndTrimType(nextType) ? {} : { allowExtension: false }),
      ...(nextType === "plane-trim" ? { memberBId: null, memberBIds: [] } : { referencePlaneIds: [] }),
      ...(nextType === "end-miter" ? {} : { miterMode: "equal-angle" })
    };
    setCreateDraftPatch(patch, `${trimEditorOperationLabel(nextType)} selected.`, { tryCreate: false });
  };

  const setCreateDraftMember = (role, memberId, options = {}) => {
    if (!api.project().model.members?.[memberId]) return false;
    const keepRoleFocus = createDraft.type === "profile-cope" && activeDraftPick === role;
    const otherRole = role === "memberA" ? "memberB" : "memberA";
    if (createDraft[`${otherRole}Ids`].includes(memberId)) {
      setMessage("Objects to trim and cutting objects must be different.", "error");
      return true;
    }
    const currentIds = createDraft[`${role}Ids`];
    if (createDraft.type === "profile-cope" && currentIds.includes(memberId)) {
      if (!keepRoleFocus) activeDraftPick = null;
      selectTrimMember(memberId, role);
      setMessage(`${memberId} is already selected.`, "ok");
      return true;
    }
    const nextIds = createDraft.type === "profile-cope" ? uniqueTruthy([...currentIds, memberId]) : [memberId];
    const patch = {
      [`${role}Id`]: nextIds[0] || null,
      [`${role}Ids`]: nextIds
    };
    if (!keepRoleFocus) activeDraftPick = null;
    activeMemberId = memberId;
    return setCreateDraftPatch(
      patch,
      role === "memberA" ? `Object to trim set to ${memberId}.` : `Cutting object set to ${memberId}.`,
      options
    );
  };

  const removeCreateDraftMember = (role, memberId) => {
    const nextIds = createDraft[`${role}Ids`].filter((id) => id !== memberId);
    setCreateDraftPatch({
      [`${role}Ids`]: nextIds,
      [`${role}Id`]: nextIds[0] || null
    }, `Removed ${memberId}.`, { tryCreate: false });
  };

  const nextDraftMemberRole = () => {
    if (!createDraft.memberAIds.length) return "memberA";
    if (trimOperationUsesMemberB(createDraft.type) && !createDraft.memberBIds.length) return "memberB";
    return null;
  };

  const focusedCreateDraftMemberRole = () => {
    if (isTrimMemberRole(activeDraftPick)) return activeDraftPick;
    return createMode && createDraft.type === "profile-cope" ? nextDraftMemberRole() : null;
  };

  const focusCreateDraftMemberList = (role) => {
    if (!createMode || !isTrimMemberRole(role)) return;
    activeDraftPick = role;
    activeProfileCopeListPick = null;
    selection.cancelPick?.({ clear: false });
    selectTrimObjects(draftObjectIds());
    setMessage(role === "memberA" ? "Objects to trim active. Click members to add them." : "Cutting objects active. Click members to add them.", "ok");
    render();
    notifyFocusChange();
  };

  const selectMemberFromSceneFace = (face) => {
    if (!(selectedTrimJointId || createMode)) return false;
    if (face?.collection !== "members" || !face.objectId) return false;
    if (!api.project().model.members?.[face.objectId]) return false;
    if (selection.pickMode?.()) return true;
    if (createMode) {
      const role = isTrimMemberRole(activeDraftPick) ? activeDraftPick : nextDraftMemberRole();
      if (role) return setCreateDraftMember(role, face.objectId);
      selectTrimObjects(draftObjectIds().length ? draftObjectIds() : [face.objectId]);
      setMessage(createDraft.type === "profile-cope" ? "Click Objects to trim or Cutting objects, then pick members." : "Use a Pick button to replace a trim object.", "ok");
      return true;
    }
    if (activeProfileCopeListPick) {
      const operation = trimOperationById(selectedTrimJoint(), activeProfileCopeListPick.operationId);
      if (operation?.type === "profile-cope") {
        addProfileCopeRoleMember(operation, activeProfileCopeListPick.role, face.objectId);
        return true;
      }
    }
    selectMember(face.objectId);
    notifyFocusChange();
    return true;
  };

  const selectObjectForActivePick = (objectId) => {
    const entry = api.project().objectIndex?.[objectId];
    if (!entry || !createMode) return false;
    if (entry.collection === "members") {
      const role = activeDraftPick === "memberA" || activeDraftPick === "memberB"
        ? activeDraftPick
        : nextDraftMemberRole();
      if (!role) return false;
      consumeCurrentSceneClick();
      selection.cancelPick({ clear: false });
      activeProfileCopeListPick = null;
      return setCreateDraftMember(role, objectId);
    }
    if (entry.collection === "referencePlanes") {
      consumeCurrentSceneClick();
      selection.cancelPick({ clear: false });
      activeDraftPick = null;
      activeProfileCopeListPick = null;
      return setCreateDraftPatch(
        { type: "plane-trim", referencePlaneIds: uniqueTruthy([...createDraft.referencePlaneIds, objectId]), memberBId: null },
        `Trimming plane set to ${objectId}.`
      );
    }
    return false;
  };

  const beginAddParticipant = () => {
    if (!selectedTrimJointId) return;
    activeProfileCopeListPick = null;
    selection.beginMemberPick({
      count: 1,
      ignoreScope: true,
      onComplete: ([memberId]) => {
        consumeCurrentSceneClick();
        activeMemberId = memberId;
        if (selectedTrimJointParticipants().some((participant) => participant.memberId === memberId)) {
          selectTrimMember(memberId);
          setMessage(`${memberId} is already in this trim.`, "ok");
          return;
        }
        updateTrimJoint((trimJointId) => api.addTrimJointParticipant(trimJointId, memberId), `Added ${memberId}.`, memberId);
      },
      onError: (message) => {
        consumeCurrentSceneClick();
        setMessage(message, "error");
      }
    });
    setMessage("Pick member to add.", "ok");
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

  const updateProfileCopeRoleIds = (operation, role, ids, message, highlightMemberId = null) => {
    const nextIds = uniqueTruthy(ids);
    if (!nextIds.length) {
      setMessage(role === "memberA" ? "Object trim needs at least one object to trim." : "Object trim needs at least one cutting object.", "error");
      return;
    }
    const otherRole = role === "memberA" ? "memberB" : "memberA";
    const otherIds = trimOperationMemberIds(operation, otherRole);
    const duplicateIds = nextIds.filter((memberId) => otherIds.includes(memberId));
    if (duplicateIds.length) {
      setMessage("Objects to trim and cutting objects must be different.", "error");
      return;
    }
    updateOperation(operation.id, {
      [`${role}Id`]: nextIds[0],
      [`${role}Ids`]: nextIds,
      removedRegionKeys: []
    }, message);
    const memberId = highlightMemberId || nextIds[0];
    if (memberId) selectTrimMember(memberId, role);
  };

  const removeProfileCopeRoleMember = (operation, role, memberId) => {
    const nextIds = trimOperationMemberIds(operation, role).filter((id) => id !== memberId);
    updateProfileCopeRoleIds(operation, role, nextIds, `Removed ${memberId}.`, nextIds[0] || null);
  };

  const addProfileCopeRoleMember = (operation, role, memberId) => {
    if (!selectedTrimJointId || operation.type !== "profile-cope") return;
    const addingObjectToTrim = role === "memberA";
    const memberAId = addingObjectToTrim ? memberId : operation.memberAId;
    const memberBId = addingObjectToTrim ? operation.memberBId : memberId;
    if (!memberAId || !memberBId || memberAId === memberBId) {
      setMessage("Objects to trim and cutting objects must be different.", "error");
      return;
    }
    if (trimOperationMemberIds(operation, role).includes(memberId)) {
      selectTrimMember(memberId, role);
      setMessage(`${memberId} is already selected.`, "ok");
      return;
    }
    updateTrimJoint((trimJointId) => {
      const currentTrimJoint = api.project().model.trimJoints?.[trimJointId];
      const hasParticipant = trimJointParticipants(currentTrimJoint).some((participant) => participant.memberId === memberId);
      if (!hasParticipant) api.addTrimJointParticipant(trimJointId, memberId);
      const nextIds = uniqueTruthy([...trimOperationMemberIds(operation, role), memberId]);
      return api.updateTrimJointOperation(trimJointId, operation.id, {
        [`${role}Id`]: nextIds[0],
        [`${role}Ids`]: nextIds,
        removedRegionKeys: []
      });
    }, addingObjectToTrim ? "Added object to trim." : "Added cutting object.", memberId, role);
  };

  const beginAddProfileCopeVariant = (operation, role) => {
    if (!selectedTrimJointId || operation.type !== "profile-cope") return;
    activeProfileCopeListPick = { operationId: operation.id, role };
    activeDraftPick = null;
    selection.cancelPick?.({ clear: false });
    selectTrimObjects(trimObjectIds());
    render();
    notifyFocusChange();
    const addingObjectToTrim = role === "memberA";
    setMessage(addingObjectToTrim ? "Pick object to trim." : "Pick cutting object.", "ok");
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
    activeProfileCopeListPick = null;
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace: referencePlaneIdFromFace,
      ignoreScope: true,
      onComplete: ([referencePlaneId]) => {
        consumeCurrentSceneClick();
        onComplete(referencePlaneId);
      },
      onError: () => {
        consumeCurrentSceneClick();
        setMessage("Pick a reference plane in the model.", "error");
      }
    });
    setMessage(prompt, "ok");
  };

  const beginCreateDraftMemberPick = (role) => {
    if (createDraft.type === "profile-cope") {
      focusCreateDraftMemberList(role);
      return;
    }
    activeDraftPick = role;
    activeProfileCopeListPick = null;
    selection.beginMemberPick({
      count: 1,
      ignoreScope: true,
      onComplete: ([memberId]) => {
        consumeCurrentSceneClick();
        setCreateDraftMember(role, memberId);
      },
      onError: (message) => {
        consumeCurrentSceneClick();
        setMessage(message, "error");
      }
    });
    const verb = createDraft.type === "profile-cope" ? "Add" : "Pick";
    setMessage(role === "memberA" ? `${verb} object to trim.` : `${verb} cutting object.`, "ok");
  };

  const beginCreateDraftPlanePick = () => {
    activeDraftPick = "referencePlane";
    activeProfileCopeListPick = null;
    beginReferencePlanePick((referencePlaneId) => {
      activeDraftPick = null;
      const nextPlaneIds = uniqueTruthy([...createDraft.referencePlaneIds, referencePlaneId]);
      setCreateDraftPatch(
        { type: "plane-trim", referencePlaneIds: nextPlaneIds, memberBId: null },
        `Trimming plane set to ${referencePlaneId}.`
      );
    }, "Pick trimming plane.");
  };

  const removeCreateDraftPlane = (referencePlaneId) => {
    const nextPlaneIds = createDraft.referencePlaneIds.filter((id) => id !== referencePlaneId);
    setCreateDraftPatch({ referencePlaneIds: nextPlaneIds }, `Removed plane ${referencePlaneId}.`, { tryCreate: false });
  };

  const toggleCreateDraftRegionRemoved = (regionKeyValue) => {
    if (!createMode) return false;
    if (createDraft.type === "plane-trim") {
      const validRegions = planeTrimRegionKeys(uniqueTruthy(createDraft.referencePlaneIds));
      if (!validRegions.includes(regionKeyValue)) return false;
    } else if (createDraft.type === "profile-cope") {
      if (!isObjectTrimRegionKey(regionKeyValue)) return false;
    } else {
      return false;
    }
    const removed = new Set(arrayValues(createDraft.removedRegionKeys));
    if (removed.has(regionKeyValue)) removed.delete(regionKeyValue);
    else removed.add(regionKeyValue);
    activeRegionKey = regionKeyValue;
    setCreateDraftPatch(
      { removedRegionKeys: [...removed] },
      removed.has(regionKeyValue) ? "Region removed." : "Region kept.",
      { tryCreate: false }
    );
    return true;
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
    updateOperation(
      operation.id,
      { removedRegionKeys: [...removed] },
      removed.has(regionKeyValue) ? "Region removed." : "Region kept.",
      { highlightMemberId: null, selectTrimJointOnly: true }
    );
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

  const updateOperation = (operationId, patch, message = "Trim updated.", options = {}) => {
    const highlightMemberId = Object.hasOwn(options, "highlightMemberId") ? options.highlightMemberId : activeMemberId;
    updateTrimJoint(
      (trimJointId) => api.updateTrimJointOperation(trimJointId, operationId, patch),
      message,
      highlightMemberId,
      options.highlightMemberRole || null,
      { selectTrimJointOnly: options.selectTrimJointOnly === true }
    );
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
      },
      "trim.create.type.set": (value) => {
        setCreateDraftType(value);
      },
      "trim.create.update": (value, commit = {}) => {
        if (!commit.patchKey) return;
        const message = commit.patchKey === "miterMode"
          ? `${value === "profile-balanced" ? "Balanced profile" : "Equal angle"} miter selected.`
          : "Trim draft updated.";
        setCreateDraftPatch({ [commit.patchKey]: value }, message, { tryCreate: false });
      },
      "trim.create.memberEnd.set": (value, commit = {}) => {
        if (!commit.role) return;
        const option = MEMBER_END_OPTIONS.find((item) => item.id === value);
        const optionLabel = option?.label || value;
        setCreateDraftPatch(
          { [`${commit.role}End`]: value },
          `${commit.messageLabel || commit.role} ${String(optionLabel).toLowerCase()} end selected.`,
          { tryCreate: false }
        );
      }
    }
  });

  const renderTrimFields = (fields = [], bindings = trimEditorBindings()) => {
    const section = bindGeneratedPropertySections([{ id: "trim.editor.inline", fields }], bindings)[0];
    return (section?.fields || []).map(generatedPropertyField).filter(Boolean);
  };

  const renderTrimField = (field) => renderTrimFields([field])[0] || null;

  const updateOperationType = (operation, type) => {
    const patch = {
      ...(trimOperationSupportsGap(type) ? { type } : { type, gap: 0 }),
      ...trimOperationTypeCleanupPatch(type)
    };
    if (trimOperationUsesMemberEnd(type, "memberA")) patch.memberAEnd = operationMemberEndFallback(operation, "memberA");
    if (trimOperationUsesMemberEnd(type, "memberB")) patch.memberBEnd = operationMemberEndFallback(operation, "memberB");
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
        setMessage(`${trimEditorOperationLabel(type)} requires a second member.`, "error");
        return;
      }
      patch.memberBId = memberBId;
      if (type === "profile-cope") {
        patch.memberAIds = trimOperationMemberIds(operation, "memberA").length ? trimOperationMemberIds(operation, "memberA") : [operation.memberAId];
        patch.memberBIds = trimOperationMemberIds(operation, "memberB").length ? trimOperationMemberIds(operation, "memberB") : [memberBId];
        patch.memberAId = patch.memberAIds[0];
        patch.memberBId = patch.memberBIds[0];
        patch.removedRegionKeys = reconcileObjectTrimRemovedRegionKeys(operation);
      }
    }
    updateOperation(operation.id, patch, `${trimEditorOperationLabel(type)} selected.`);
  };

  const preferredEndTrimType = (operation) => {
    if (operation.type === "plane-trim" || operation.type === "profile-cope") return operation.type;
    return operation.memberB?.id ? "profile-cope" : "plane-trim";
  };

  const preferredButtTrimType = (operation) => {
    return isButtTrimType(operation.type) ? operation.type : "end-butt-both";
  };

  const trimMenuTypeOptions = (operation) => [
    { id: preferredEndTrimType(operation), label: "Object trim", icon: trimOperationIcon("plane-trim") },
    { id: "end-miter", label: "Mitre trim", icon: trimOperationIcon("end-miter") },
    { id: preferredButtTrimType(operation), label: "Butt trim", icon: trimOperationIcon("end-butt-both") }
  ];

  const swapOperation = (operation) => {
    const profileCope = operation.type === "profile-cope";
    const memberAIds = profileCope ? trimOperationMemberIds(operation, "memberA") : [operation.memberAId];
    const memberBIds = profileCope ? trimOperationMemberIds(operation, "memberB") : [operation.memberBId];
    const patch = profileCope ? {
      memberAId: memberBIds[0],
      memberBId: memberAIds[0],
      memberAIds: memberBIds,
      memberBIds: memberAIds,
      removedRegionKeys: []
    } : {
      memberAId: operation.memberBId,
      memberBId: operation.memberAId
    };
    if (trimOperationUsesMemberEnd(operation.type, "memberA")) patch.memberAEnd = operation.memberBEnd || "end";
    if (trimOperationUsesMemberEnd(operation.type, "memberB")) patch.memberBEnd = operation.memberAEnd || "end";
    updateOperation(operation.id, patch, "Members swapped.");
  };

  const pickOperationMember = (operation, role) => {
    activeProfileCopeListPick = null;
    selection.beginMemberPick({
      count: 1,
      ignoreScope: true,
      onComplete: ([memberId]) => {
        consumeCurrentSceneClick();
        activeMemberId = memberId;
        updateTrimJoint(
          (trimJointId) => api.setTrimJointOperationMember(trimJointId, operation.id, role, memberId),
          role === "memberA" ? `Member A set to ${memberId}.` : `Member B set to ${memberId}.`,
          memberId,
          role
        );
      },
      onError: (message) => {
        consumeCurrentSceneClick();
        setMessage(message, "error");
      }
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
    commit: trimMemberEndCommit(operation, member),
    ...(member.endCommit ? { commit: member.endCommit } : {})
  });

  const trimFormSection = (title, children = [], options = {}) => {
    const section = document.createElement("div");
    section.className = ["trim-form-section", options.className].filter(Boolean).join(" ");
    section.append(text("div", "trim-form-title", title));
    const body = document.createElement("div");
    body.className = "trim-form-body";
    body.append(...children.filter(Boolean));
    section.append(body);
    return section;
  };

  const trimTargetRow = (operation, member, tone, placeholder) => {
    const row = document.createElement("div");
    row.className = "trim-target-row";
    row.dataset.tone = tone;
    if (member.role) row.dataset.role = member.role;
    row.style.setProperty("--trim-target-color", trimMemberRoleColor(member.role));
    if (member.picking) row.dataset.picking = "true";
    const stripe = document.createElement("span");
    stripe.className = "trim-target-stripe";
    const label = member.id ? memberName(api, member.id) : placeholder;
    const roleLabel = text("div", "trim-target-role", member.label);
    row.append(
      stripe,
      roleLabel,
      button(label, "trim-target-main", () => member.id ? selectMember(member.id, member.role) : member.onPick?.(), { title: member.id ? `Select ${member.id}` : placeholder }),
      button(member.actionLabel || "Pick", "bc-button trim-target-pick", member.onRemove || member.onPick, {
        icon: member.actionIcon || "selection",
        title: member.actionTitle || `Pick ${member.label}`
      })
    );
    const endField = member.showEnd ? trimMemberEndField(operation, member) : null;
    if (endField) {
      const endWrap = document.createElement("div");
      endWrap.className = "trim-target-end";
      endWrap.append(endField);
      row.append(endWrap);
    }
    return row;
  };

  const trimTargetList = (operation, list, tone, placeholder) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-target-list";
    wrap.dataset.tone = tone;
    wrap.dataset.role = list.role;
    wrap.style.setProperty("--trim-target-color", trimMemberRoleColor(list.role));
    if (list.picking) wrap.dataset.picking = "true";
    const header = document.createElement("div");
    header.className = "trim-target-list-header";
    header.addEventListener("click", () => list.onPick?.());
    header.append(text("div", "trim-target-role", list.label));
    const frame = document.createElement("div");
    frame.className = "trim-target-listbox";
    frame.setAttribute("role", "listbox");
    frame.setAttribute("aria-label", list.label);
    frame.tabIndex = 0;
    frame.addEventListener("click", (event) => {
      if (event.target === frame) list.onPick?.();
    });
    frame.addEventListener("focus", () => list.onPick?.());
    if (!list.ids.length) {
      frame.append(button(placeholder, "trim-target-listbox-empty", list.onPick, {
        title: placeholder
      }));
      wrap.append(header, frame);
      return wrap;
    }
    for (const memberId of list.ids) {
      const row = document.createElement("div");
      row.className = "trim-target-listbox-row trim-target-row";
      row.dataset.role = list.role;
      if (activeMemberId === memberId) row.dataset.active = "true";
      row.append(
        button(memberName(api, memberId), "trim-target-listbox-item", () => selectMember(memberId, list.role), {
          title: `Select ${memberId}`
        }),
        button("Remove", "bc-button trim-target-pick", () => list.onRemove?.(memberId), {
          icon: "cancel",
          title: `Remove ${memberId}`
        })
      );
      frame.append(row);
    }
    wrap.append(header, frame);
    return wrap;
  };

  const planeFullLabel = (referencePlaneId) => api.project().model.referencePlanes?.[referencePlaneId]?.name || referencePlaneId;
  const planeLabel = (referencePlaneId) => compactEntityLabel(planeFullLabel(referencePlaneId));

  const planePicker = (operation) => {
    const wrap = document.createElement("div");
    wrap.className = "trim-plane-picker";
    if (operation.planePicking) wrap.dataset.picking = "true";
    const firstPlaneId = operation.referencePlaneIds[0] || null;
    const firstPlaneFullLabel = firstPlaneId ? planeFullLabel(firstPlaneId) : null;
    const pickPlane = operation.onPickPlane || (() => beginPickOperationPlane(operation));
    const removePlane = operation.onRemovePlane || ((referencePlaneId) => removeOperationPlane(operation, referencePlaneId));
    wrap.append(
      button(firstPlaneId ? planeLabel(firstPlaneId) : "Pick reference plane", "trim-plane-main", pickPlane, {
        title: firstPlaneFullLabel ? `Selected plane: ${firstPlaneFullLabel}` : "Pick reference plane"
      }),
      button("Pick", "bc-button trim-target-pick", pickPlane, { icon: "reference-plane", title: "Pick reference plane" })
    );
    if (operation.referencePlaneIds.length > 1) {
      const list = document.createElement("div");
      list.className = "trim-plane-token-list";
      for (const referencePlaneId of operation.referencePlaneIds) {
        list.append(button(planeLabel(referencePlaneId), "trim-plane-token", () => removePlane(referencePlaneId), {
          title: `Remove ${planeFullLabel(referencePlaneId)}`
        }));
      }
      wrap.append(list);
    }
    return wrap;
  };

  const regionLabel = (regionKeyValue) => regionKeyValue.split("|")
    .map((part) => {
      if (isObjectTrimRegionKey(part)) {
        const { partIndex } = objectTrimRegionKeyParts(part);
        return `Part ${partIndex}`;
      }
      const index = part.lastIndexOf(":");
      return `${planeLabel(part.slice(0, index))} ${part.slice(index + 1)}`;
    })
    .join(", ");

  const segmentPicker = (operation) => {
    if (!operation.regionKeys.length) return text("div", "bc-empty", "Pick a plane to create trim segments.");
    const list = document.createElement("div");
    list.className = "trim-segment-list";
    for (const regionKeyValue of operation.regionKeys) {
      const isRemoved = operation.removedRegionKeys.includes(regionKeyValue);
      const item = button(
        `${isRemoved ? "Removed" : "Keep"} ${regionLabel(regionKeyValue)}`,
        "trim-segment-button",
        () => {
          if (operation.regionToggle) return operation.regionToggle(regionKeyValue);
          return toggleRegionRemoved(operation, regionKeyValue);
        },
        { title: isRemoved ? "Click to keep this segment" : "Click to remove this segment" }
      );
      item.dataset.removed = isRemoved ? "true" : "false";
      item.dataset.active = regionKeyValue === activeRegionKey ? "true" : "false";
      list.append(item);
    }
    return list;
  };

  const operationCard = (operation, index) => {
    const card = document.createElement("div");
    card.className = "trim-cut-card";
    card.dataset.active = operation.id === activeOperationId ? "true" : "false";
    const showCutHeader = operation.forceHeader || operation.totalOperations > 1 || Boolean(operation.onSwap);
    const objectTrimMode = isEndTrimType(operation.type);
    const memberAPlaceholder = objectTrimMode ? "Pick object to trim" : "Pick first profile";
    const memberBPlaceholder = operation.type === "profile-cope" ? "Pick cutting object" : "Pick second profile";

    const header = document.createElement("div");
    header.className = "trim-cut-header";
    header.append(text("div", "bc-section-title", `Cut ${operation.cutNumber || index + 1}: ${trimEditorOperationLabel(operation.type)}`));
    if (operation.onSwap) header.append(button("Swap", "bc-button", operation.onSwap));
    if (operation.onRemove) header.append(button("Remove", "bc-button bc-button-danger", operation.onRemove));

    const bodyRows = operation.memberAList
      ? [trimTargetList(operation, operation.memberAList, "primary", memberAPlaceholder)]
      : [trimTargetRow(operation, operation.memberA, "primary", memberAPlaceholder)];
    if (operation.memberBList) bodyRows.push(trimTargetList(operation, operation.memberBList, "secondary", memberBPlaceholder));
    else if (operation.memberB) bodyRows.push(trimTargetRow(operation, operation.memberB, "secondary", memberBPlaceholder));
    else if (trimOperationUsesMemberB(operation.type)) bodyRows.push(button(operation.type === "profile-cope" ? "Add cutting object" : "Add second profile", "bc-button trim-add-profile-button", beginAddParticipant, {
      icon: "selection",
      title: operation.type === "profile-cope" ? "Add the cutting object to this trim" : "Add another profile to this trim"
    }));

    const rows = [
      trimFormSection("Type", renderTrimFields([{
        type: "optionGrid",
        label: "Type",
        value: operation.type,
        options: trimMenuTypeOptions(operation),
        className: "trim-menu-type-grid",
        buttonClassName: "trim-menu-type-card",
        commit: trimOperationTypeCommit(operation),
        ...(operation.typeCommit ? { commit: operation.typeCommit } : {})
      }]), { className: "trim-type-section" })
    ];
    rows.push(trimFormSection(objectTrimMode ? "Objects" : "Bodies to be trimmed", bodyRows));
    if (isEndTrimType(operation.type)) {
      rows.push(trimFormSection("Trimming object", renderTrimFields([{
        type: "segmented",
        label: "Object",
        value: operation.type === "profile-cope" ? "profile-cope" : "plane-trim",
        options: END_TRIM_TARGET_OPTIONS,
        className: "trim-object-mode-segment",
        commit: trimOperationTypeCommit(operation),
        ...(operation.typeCommit ? { commit: operation.typeCommit } : {})
      }]), { className: "trim-object-section" }));
    }
    if (operation.referencePlane) {
      rows.push(trimFormSection("Plane", [planePicker(operation)]));
    }
    if (operation.miterModeOptions) {
      rows.push(trimFormSection("Direction", renderTrimFields([{
        type: "segmented",
        label: "Mitre mode",
        value: operation.miterMode,
        options: operation.miterModeOptions,
        commit: trimOperationCommit(operation, "miterMode"),
        ...(operation.updateCommit ? { commit: operation.updateCommit("miterMode") } : {})
      }])));
    }
    if (operation.allowExtensionOption) {
      rows.push(trimFormSection("Extend", renderTrimFields([{
        type: "checkbox",
        label: "Allow extension",
        value: operation.allowExtension,
        commit: trimOperationCommit(operation, "allowExtension"),
        ...(operation.updateCommit ? { commit: operation.updateCommit("allowExtension") } : {})
      }])));
    }
    if (operation.showSegments !== false && operation.regionKeys.length) {
      rows.push(trimFormSection("Segments to keep", [segmentPicker(operation)], { className: "trim-segments-section" }));
    }
    if (operation.showGap) {
      rows.push(trimFormSection("Weld gap", renderTrimFields([{
        type: "number",
        label: "Gap (mm)",
        value: finiteNumberOr(operation.gap, 0),
        commit: trimOperationCommit(operation, "gap"),
        ...(operation.updateCommit ? { commit: operation.updateCommit("gap") } : {})
      }])));
    }
    if (!showCutHeader && operation.onRemove) {
      rows.push(button("Remove cut", "bc-button bc-button-danger trim-remove-cut-button", operation.onRemove));
    }
    rows.push(...arrayValues(operation.extraRows));
    card.append(...(showCutHeader ? [header] : []), ...rows);
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

  const operationMemberListModel = (operation, role, label, addLabel, addTitle = addLabel) => ({
    label,
    role,
    ids: trimOperationMemberIds(operation, role),
    picking: activeProfileCopeListPick?.operationId === operation.id && activeProfileCopeListPick?.role === role,
    onPick: () => beginAddProfileCopeVariant(operation, role),
    onRemove: (memberId) => removeProfileCopeRoleMember(operation, role, memberId),
    addLabel,
    addTitle
  });

  const trimJointOperationModel = (operation, index, totalOperations) => {
    const type = operation.type || "end-butt-1";
    const usesMemberB = trimOperationUsesMemberB(type);
    const objectTrimMode = isEndTrimType(type);
    const profileCope = type === "profile-cope";
    return {
      id: operation.id,
      cutNumber: index + 1,
      totalOperations,
      type,
      enabled: operation.enabled !== false,
      memberA: profileCope ? null : operationMemberRoleModel(operation, type, "memberA", objectTrimMode ? "Object to trim" : "First profile", objectTrimMode ? "Object to trim" : "First profile"),
      memberB: usesMemberB && !profileCope ? operationMemberRoleModel(operation, type, "memberB", "Second profile") : null,
      memberAList: profileCope ? operationMemberListModel(operation, "memberA", "Objects to trim", "Add object to trim", "Add another object to trim") : null,
      memberBList: profileCope ? operationMemberListModel(operation, "memberB", "Cutting objects", "Add cutting object", "Add another cutting object") : null,
      referencePlane: type === "plane-trim",
      referencePlaneIds: trimOperationReferencePlaneIds(operation),
      removedRegionKeys: arrayValues(operation.removedRegionKeys),
      regionKeys: type === "plane-trim"
        ? planeTrimRegionKeys(uniqueTruthy(trimOperationReferencePlaneIds(operation)))
        : type === "profile-cope"
          ? uniqueTruthy([activeRegionKey, ...arrayValues(operation.removedRegionKeys)]).filter(isObjectTrimRegionKey)
          : [],
      showSegments: type === "plane-trim" || type === "profile-cope",
      showGap: trimOperationSupportsGap(type),
      gap: operation.gap,
      allowExtensionOption: isEndTrimType(type),
      allowExtension: operation.allowExtension === true,
      miterModeOptions: type === "end-miter" ? MITER_MODE_OPTIONS : null,
      miterMode: operation.miterMode || "equal-angle",
      onSwap: usesMemberB ? () => swapOperation(operation) : null,
      onRemove: () => removeOperation(operation.id),
      extraRows: []
    };
  };

  const createDraftMemberRoleModel = (type, role, label, messageLabel = label) => ({
    label,
    role,
    id: createDraft[`${role}Id`],
    showEnd: trimOperationUsesMemberEnd(type, role),
    end: createDraft[`${role}End`] || "end",
    messageLabel,
    picking: activeDraftPick === role,
    onPick: () => beginCreateDraftMemberPick(role),
    endCommit: { action: "trim.create.memberEnd.set", role, messageLabel }
  });

  const createDraftMemberListModel = (role, label, addLabel, addTitle = addLabel) => ({
    label,
    role,
    ids: createDraft[`${role}Ids`],
    picking: focusedCreateDraftMemberRole() === role,
    onPick: () => beginCreateDraftMemberPick(role),
    onRemove: (memberId) => removeCreateDraftMember(role, memberId),
    addLabel,
    addTitle
  });

  const createDraftOperationModel = () => {
    const type = createDraft.type || "profile-cope";
    const usesMemberB = trimOperationUsesMemberB(type);
    const objectTrimMode = isEndTrimType(type);
    const profileCopeDraft = type === "profile-cope";
    return {
      id: "create-trim-draft",
      cutNumber: 1,
      totalOperations: 1,
      forceHeader: true,
      type,
      enabled: true,
      memberA: profileCopeDraft ? null : createDraftMemberRoleModel(type, "memberA", objectTrimMode ? "Object to trim" : "First profile", objectTrimMode ? "Object to trim" : "First profile"),
      memberB: !usesMemberB || profileCopeDraft ? null : createDraftMemberRoleModel(type, "memberB", "Second profile"),
      memberAList: profileCopeDraft ? createDraftMemberListModel("memberA", "Objects to trim", "Add object to trim", "Add another object to trim") : null,
      memberBList: profileCopeDraft ? createDraftMemberListModel("memberB", "Cutting objects", "Add cutting object", "Add another cutting object") : null,
      referencePlane: type === "plane-trim",
      referencePlaneIds: createDraft.referencePlaneIds,
      removedRegionKeys: arrayValues(createDraft.removedRegionKeys),
      regionKeys: type === "plane-trim" && createDraft.referencePlaneIds.length
        ? planeTrimRegionKeys(uniqueTruthy(createDraft.referencePlaneIds))
        : type === "profile-cope"
          ? uniqueTruthy([activeRegionKey, ...arrayValues(createDraft.removedRegionKeys)]).filter(isObjectTrimRegionKey)
        : [],
      showSegments: type === "plane-trim" || type === "profile-cope",
      showGap: trimOperationSupportsGap(type),
      gap: createDraft.gap,
      allowExtensionOption: isEndTrimType(type),
      allowExtension: createDraft.allowExtension === true,
      miterModeOptions: type === "end-miter" ? MITER_MODE_OPTIONS : null,
      miterMode: createDraft.miterMode || "equal-angle",
      typeCommit: { action: "trim.create.type.set" },
      updateCommit: (patchKey) => ({ action: "trim.create.update", patchKey }),
      onPickPlane: beginCreateDraftPlanePick,
      onRemovePlane: removeCreateDraftPlane,
      regionToggle: toggleCreateDraftRegionRemoved,
      planePicking: activeDraftPick === "referencePlane",
      onRemove: null
    };
  };

  const operationList = ({ operations, canAdd = false, totalOperations = operations.length, activeCutNumber = null }) => {
    const section = document.createElement("div");
    section.className = "bc-trim-section";
    const toolbar = document.createElement("div");
    toolbar.className = "trim-section-toolbar";
    if (activeOperationId) toolbar.append(button("Show full trim", "bc-button", () => {
      activeOperationId = null;
      activeRegionKey = null;
      render();
      notifyFocusChange();
    }, { title: "Show every cut in this trim" }));
    if (toolbar.childElementCount) section.append(toolbar);
    if (!operations.length) section.append(text("div", "bc-empty", "Add a cut, then pick the cut member and cutting member from the model."));
    else section.append(...operations.map(operationCard));
    return section;
  };

  const trimJointEditorModel = (trimJoint) => {
    const sourceOperations = trimJointOperations(trimJoint);
    const activeIndex = activeOperationId ? sourceOperations.findIndex((operation) => operation.id === activeOperationId) : -1;
    if (activeOperationId && activeIndex < 0) activeOperationId = null;
    const visibleOperations = activeOperationId ? [sourceOperations[activeIndex]] : sourceOperations;
    return {
      id: trimJoint.id,
      operations: visibleOperations.map((operation) => trimJointOperationModel(operation, sourceOperations.indexOf(operation), sourceOperations.length)),
      totalOperations: sourceOperations.length,
      activeCutNumber: activeOperationId ? activeIndex + 1 : null,
      participants: trimJointParticipants(trimJoint).map((participant) => ({ ...participant, canRemove: true })),
      canAddOperations: true,
      canAddParticipants: true
    };
  };

  const editorRows = (model) => {
    return [
      operationList({
        operations: model.operations,
        canAdd: model.canAddOperations,
        totalOperations: model.totalOperations,
        activeCutNumber: model.activeCutNumber
      })
    ];
  };

  const createModeRows = () => {
    return [
      operationList({
        operations: [createDraftOperationModel()],
        totalOperations: 1,
        activeCutNumber: 1
      })
    ];
  };

  function clear() {
    const hadFocus = Boolean(selectedTrimJointId || createMode);
    const wasCreateMode = createMode;
    clearCreateDraftPreview();
    selectedTrimJointId = null;
    activeOperationId = null;
    activeRegionKey = null;
    activeMemberId = null;
    createMode = false;
    createDraft = createTrimDraft();
    activeDraftPick = null;
    activeProfileCopeListPick = null;
    panelMessage.clear({ render: false });
    render();
    if (wasCreateMode) finishCreateMode({ created: false });
    if (hadFocus) notifyFocusChange();
  }

  const decorateTrimEditorPanel = (model = null) => {
    panel.classList.add("trim-editor-panel");
    const header = panel.querySelector(".bc-editor-header");
    if (!header) return;
    const actions = document.createElement("div");
    actions.className = "trim-editor-header-actions";
    if (createMode) {
      const status = createDraftReadyStatus();
      const createButton = button("Create", "bc-button bc-button-primary", () => tryCreateDraftTrim({ force: true }), {
        icon: "check",
        title: status.ready ? "Create trim" : status.message,
        disabled: !status.ready,
        disabledReason: status.message
      });
      createButton.classList.add("trim-editor-action", "trim-editor-create-action");
      actions.append(createButton);
    } else if (model?.canAddOperations) {
      const addButton = button("New cut", "bc-button bc-button-primary", addOperationFromToolbar, {
        icon: "add",
        title: "New cut"
      });
      addButton.classList.add("trim-editor-action", "trim-editor-add-action");
      actions.append(addButton);
    }
    if (!createMode) {
      actions.append(button("Done", "bc-button trim-editor-action trim-editor-done-action", clear, {
        icon: "check",
        title: "Done"
      }));
    }
    actions.append(button("Close", "bc-button trim-editor-action trim-editor-close-action", clear, {
      icon: "cancel",
      title: "Close"
    }));
    header.replaceChildren(text("div", "bc-inspector-title", createMode ? "Create Trim" : "Trim"), actions);
  };

  function render() {
    const trimJoint = selectedTrimJoint();
    const model = trimJoint ? trimJointEditorModel(trimJoint) : null;
    if (createMode) {
      renderEditorPanel(panel, "Create Trim", clear, createModeRows(), panelMessage.element());
      decorateTrimEditorPanel();
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

    renderEditorPanel(panel, "Trim", clear, editorRows(model), panelMessage.element());
    decorateTrimEditorPanel(model);
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
      createDraft = normalizeCreateTrimDraft(createTrimDraft(options.pickedMemberIds || []));
      activeDraftPick = null;
      activeProfileCopeListPick = null;
      const status = createDraftReadyStatus();
      const message = status.ready
        ? "Choose type, then create trim."
        : status.message;
      panelMessage.set(message, "ok", { render: false });
      selectTrimObjects(draftObjectIds());
      render();
      notifyFocusChange();
      updateCreateDraftPreview();
    },
    selectTrimJoint(trimJointId, options = {}) {
      const trimJoint = api.project().model.trimJoints?.[trimJointId];
      if (!trimJoint) {
        clear();
        return;
      }
      const operations = trimJointOperations(trimJoint);
      const defaultOperationId = operations.length === 1 ? operations[0]?.id : null;
      const operationId = options.operationId || defaultOperationId;
      selectedTrimJointId = trimJointId;
      activeOperationId = trimOperationById(trimJoint, operationId) ? operationId : null;
      activeRegionKey = activeOperationId && typeof options.regionKey === "string" ? options.regionKey : null;
      activeMemberId = null;
      createMode = false;
      createDraft = createTrimDraft();
      activeDraftPick = null;
      activeProfileCopeListPick = null;
      clearCreateDraftPreview();
      const operation = activeOperation();
      panelMessage.set(activeRegionKey ? `Selected region ${activeRegionKey}.` : operation ? `Selected ${trimEditorOperationLabel(operation.type)}.` : "", operation ? "ok" : "", { render: false });
      selectTrimObjects(trimObjectIds());
      render();
      notifyFocusChange();
    },
    toggleRegionFromFace(face) {
      let trimJoint = null;
      let operation = null;
      let regionKeyValue = null;
      if (createMode && (createDraft.type === "plane-trim" || createDraft.type === "profile-cope")) {
        if (
          face?.collection === "trimJoints"
          && face.componentKind === "trim-region"
          && face.objectId === PREVIEW_TRIM_JOINT_ID
          && face.operationId === PREVIEW_TRIM_OPERATION_ID
          && face.regionKey
        ) {
          regionKeyValue = face.regionKey;
        } else if (
          face?.collection === "members"
          && createDraft.memberAIds.includes(face.objectId)
          && createDraft.referencePlaneIds.length
          && Array.isArray(face.hitPoint)
        ) {
          regionKeyValue = regionKeyForPoint(createDraftOperationPatch(), face.hitPoint);
        }
        if (regionKeyValue) {
          activeMemberId = face?.collection === "members" ? face.objectId : createDraft.memberAId;
          return toggleCreateDraftRegionRemoved(regionKeyValue);
        }
      }
      if (face?.collection === "trimJoints" && face.componentKind === "trim-region" && face.objectId && face.operationId && face.regionKey) {
        trimJoint = api.project().model.trimJoints?.[face.objectId] || null;
        operation = trimOperationById(trimJoint, face.operationId);
        regionKeyValue = face.regionKey;
      } else if (face?.collection === "members" && selectedTrimJointId && Array.isArray(face.hitPoint)) {
        trimJoint = selectedTrimJoint();
        operation = activePlaneTrimOperationForMember(face.objectId);
        regionKeyValue = operation ? regionKeyForPoint(operation, face.hitPoint) : null;
      }
      if (!operation || !regionKeyValue) return false;
      if (operation.type === "plane-trim") {
        const validRegions = planeTrimRegionKeys(uniqueTruthy(trimOperationReferencePlaneIds(operation)));
        if (!validRegions.includes(regionKeyValue)) return false;
      } else if (operation.type === "profile-cope") {
        if (!isObjectTrimRegionKey(regionKeyValue)) return false;
      } else {
        return false;
      }
      selectedTrimJointId = trimJoint.id;
      activeOperationId = operation.id;
      activeRegionKey = regionKeyValue;
      activeMemberId = face?.memberId || operation.memberAId || null;
      notifyFocusChange();
      toggleRegionRemoved(operation, regionKeyValue);
      return true;
    },
    selectMemberFromSceneFace,
    selectObjectForActivePick,
    consumePendingSceneClick() {
      if (!consumeNextSceneClick) return false;
      consumeNextSceneClick = false;
      return true;
    },
    keepsSceneFocus() {
      return Boolean(createMode || selectedTrimJointId || activeDraftPick || selection.pickMode?.());
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
