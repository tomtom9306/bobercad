import { TRIM_OPERATION_TYPES, trimOperationIconMarkup, trimOperationLabel, trimOperationSpec, trimOperationSupportsGap } from "../../../rendering/trim-operation-icons.mjs?v=plane-region-hard-1";

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

function compactNumericInput(value, ariaLabel, onChange) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    input.classList.toggle("invalid", !Number.isFinite(next));
    if (Number.isFinite(next)) onChange(next);
  });
  return input;
}

function compactCheckboxInput(value, ariaLabel, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function compactSelectInput(options, value, ariaLabel, onChange) {
  const input = document.createElement("select");
  input.className = "editor-select";
  input.setAttribute("aria-label", ariaLabel);
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    input.append(item);
  }
  input.value = value || options[0]?.id || "";
  input.disabled = !options.length;
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function add(a, b) {
  return a.map((value, index) => value + b[index]);
}

function sub(a, b) {
  return a.map((value, index) => value - b[index]);
}

function mul(a, scalar) {
  return a.map((value) => value * scalar);
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function norm(a) {
  const length = Math.hypot(...a);
  return length > 1e-9 ? mul(a, 1 / length) : [0, 0, 1];
}

function readout(label, value) {
  const row = document.createElement("div");
  row.className = "editor-readout";
  row.append(text("span", "editor-label", label), text("span", "editor-value", value));
  return row;
}

function field(label, ...children) {
  const row = document.createElement("div");
  row.className = "editor-field";
  row.append(text("span", "editor-label", label), ...children);
  return row;
}

const MEMBER_END_OPTIONS = [
  { id: "start", label: "Start" },
  { id: "end", label: "End" }
];

function profileLabel(profiles, member) {
  const profile = profiles?.[member.profile];
  return profile?.designation || member.profile || "-";
}

function operationTypeSpec(type) {
  return trimOperationSpec(type);
}

function operationLabel(type) {
  return trimOperationLabel(type);
}

function operationSupportsGap(type) {
  return trimOperationSupportsGap(type);
}

function operationType(operation) {
  return operation.type || "end-butt-1";
}

function operationUsesMemberEnd(type, role) {
  if (type === "end-butt-1") return role === "memberA";
  if (type === "end-butt-2") return role === "memberB";
  if (type === "end-butt-both" || type === "end-miter") return true;
  return false;
}

function operationUsesMemberB(type) {
  return type !== "plane-trim";
}

function iconType(type) {
  return type;
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
  let messageText = "";
  let messageState = "";

  const setMessage = (message, state = "") => {
    messageText = message;
    messageState = state;
    render();
  };

  const selectedTrimJoint = () => selectedTrimJointId ? api.project().model.trimJoints?.[selectedTrimJointId] || null : null;

  const activeOperation = () => {
    const trimJoint = selectedTrimJoint();
    return activeOperationId ? (trimJoint?.operations || []).find((operation) => operation.id === activeOperationId) || null : null;
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
      const affectedObjectIds = [...new Set([...beforeObjectIds, ...trimObjectIds()])];
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
        const trimJoint = selectedTrimJoint();
        if ((trimJoint.participants || []).some((participant) => participant.memberId === memberId)) {
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
    const trimJoint = selectedTrimJoint();
    const participants = trimJoint?.participants || [];
    const patch = { type, gap: 0 };
    if (participants.length < 2) {
      setMessage("Add plane trim by picking at least one plane from the model.", "error");
      return;
    }
    updateTrimJoint((trimJointId) => api.addTrimJointOperation(trimJointId, patch), `Added ${operationLabel(patch.type)}.`);
  };

  const planeIds = (operation) => Array.isArray(operation.referencePlaneIds) ? operation.referencePlaneIds : [];

  const regionKey = (items) => items.map((item) => `${item.planeId}:${item.side}`).join("|");

  const regionKeysForPlaneIds = (referencePlaneIds) => {
    const ids = [...new Set(referencePlaneIds)];
    const keys = [];
    const walk = (index, items) => {
      if (index >= ids.length) {
        keys.push(regionKey(items));
        return;
      }
      walk(index + 1, [...items, { planeId: ids[index], side: "-" }]);
      walk(index + 1, [...items, { planeId: ids[index], side: "+" }]);
    };
    walk(0, []);
    return keys;
  };

  const regionSelectorMap = (regionKeyValue) => {
    const map = new Map();
    if (typeof regionKeyValue !== "string" || !regionKeyValue) return map;
    for (const part of regionKeyValue.split("|")) {
      const index = part.lastIndexOf(":");
      if (index <= 0) continue;
      const planeId = part.slice(0, index);
      const side = part.slice(index + 1);
      if (side === "+" || side === "-") map.set(planeId, side);
    }
    return map;
  };

  const regionMatchesSelector = (regionKeyValue, selector) => {
    const map = regionSelectorMap(regionKeyValue);
    for (const [planeId, side] of selector) {
      if (map.get(planeId) !== side) return false;
    }
    return true;
  };

  const ensurePlaneTrimRegionKeys = (operation, referencePlaneIds) => {
    const ids = new Set(referencePlaneIds);
    const keys = regionKeysForPlaneIds(referencePlaneIds);
    const removed = new Set();
    for (const regionKeyValue of operation.removedRegionKeys || []) {
      const selector = new Map([...regionSelectorMap(regionKeyValue)].filter(([planeId]) => ids.has(planeId)));
      if (!selector.size) continue;
      for (const key of keys) {
        if (regionMatchesSelector(key, selector)) removed.add(key);
      }
    }
    return [...removed];
  };

  const regionKeyForPoint = (operation, point) => {
    if (!Array.isArray(point) || point.length !== 3 || point.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
    const gap = typeof operation.gap === "number" && Number.isFinite(operation.gap) ? operation.gap : 0;
    const items = [];
    for (const referencePlaneId of planeIds(operation)) {
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
    const operations = (trimJoint?.operations || []).filter((operation) => operation.type === "plane-trim" && operation.memberAId === memberId);
    if (activeOperationId) return operations.find((operation) => operation.id === activeOperationId) || null;
    return operations.length === 1 ? operations[0] : null;
  };

  const beginPickOperationPlane = (operation) => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace: (face) => face?.referencePlaneId || (face?.collection === "referencePlanes" ? face.objectId : null),
      onComplete: ([referencePlaneId]) => {
        const nextPlaneIds = [...new Set([...planeIds(operation), referencePlaneId])];
        updateOperation(operation.id, {
          referencePlaneIds: nextPlaneIds,
          removedRegionKeys: ensurePlaneTrimRegionKeys(operation, nextPlaneIds)
        }, `Added plane ${referencePlaneId}.`);
      },
      onError: () => setMessage("Pick a reference plane in the model.", "error")
    });
    setMessage("Pick a reference plane in the model.", "ok");
  };

  const removeOperationPlane = (operation, referencePlaneId) => {
    const nextPlaneIds = planeIds(operation).filter((id) => id !== referencePlaneId);
    if (!nextPlaneIds.length) {
      setMessage("Plane trim requires at least one plane.", "error");
      return;
    }
    updateOperation(operation.id, {
      referencePlaneIds: nextPlaneIds,
      removedRegionKeys: ensurePlaneTrimRegionKeys(operation, nextPlaneIds)
    }, `Removed plane ${referencePlaneId}.`);
  };

  const toggleRegionRemoved = (operation, regionKeyValue) => {
    const removed = new Set(operation.removedRegionKeys || []);
    if (removed.has(regionKeyValue)) removed.delete(regionKeyValue);
    else removed.add(regionKeyValue);
    activeRegionKey = regionKeyValue;
    updateOperation(operation.id, { removedRegionKeys: [...removed] }, removed.has(regionKeyValue) ? "Region removed." : "Region kept.");
  };

  const addPlaneTrimOperation = () => {
    const trimJoint = selectedTrimJoint();
    const memberId = trimJoint?.participants?.[0]?.memberId;
    if (!memberId) {
      setMessage("Plane trim requires a member.", "error");
      return;
    }
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace: (face) => face?.referencePlaneId || (face?.collection === "referencePlanes" ? face.objectId : null),
      onComplete: ([referencePlaneId]) => {
        const patch = {
          type: "plane-trim",
          memberAId: memberId,
          referencePlaneIds: [referencePlaneId],
          removedRegionKeys: [`${referencePlaneId}:-`],
          gap: 0
        };
        updateTrimJoint((trimJointId) => api.addTrimJointOperation(trimJointId, patch), "Added plane trim.");
      },
      onError: () => setMessage("Pick a reference plane in the model.", "error")
    });
    setMessage("Pick first plane for the new trim.", "ok");
  };

  const addOperationFromToolbar = () => {
    const trimJoint = selectedTrimJoint();
    const participants = trimJoint?.participants || [];
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
    const patch = operationSupportsGap(type) ? { type } : { type, gap: 0 };
    if (type === "plane-trim") {
      const referencePlaneIds = planeIds(operation);
      if (!referencePlaneIds.length) {
        setMessage("Plane trim requires planes picked from the model.", "error");
        return;
      }
      patch.referencePlaneIds = referencePlaneIds;
      patch.removedRegionKeys = ensurePlaneTrimRegionKeys(operation, referencePlaneIds);
    } else if (operationUsesMemberB(type)) {
      const trimJoint = selectedTrimJoint();
      const memberBId = operation.memberBId || (trimJoint.participants || []).find((participant) => participant.memberId !== operation.memberAId)?.memberId;
      if (!memberBId) {
        setMessage(`${operationLabel(type)} requires a second member.`, "error");
        return;
      }
      patch.memberBId = memberBId;
    }
    updateOperation(operation.id, patch, `${operationLabel(type)} selected.`);
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
    const wrap = document.createElement("div");
    wrap.className = "trim-member-end-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", ariaLabel);
    for (const option of MEMBER_END_OPTIONS) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "trim-end-option";
      item.dataset.selected = option.id === value ? "true" : "false";
      item.textContent = option.label;
      item.setAttribute("aria-pressed", option.id === value ? "true" : "false");
      item.addEventListener("click", () => {
        if (option.id !== value) onChange(option.id, option.label);
      });
      wrap.append(item);
    }
    return wrap;
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
      item.append(trimTypeIcon(iconType(option.id), colors), text("span", "trim-type-label", option.label));
      item.addEventListener("click", () => {
        if (option.id !== operation.type) operation.onTypeChange(option.id);
      });
      group.append(item);
    }
    return group;
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
      text("div", "editor-section-title", `Cut ${operation.cutNumber || index + 1}: ${operationLabel(operation.type)}`),
      compactCheckboxInput(operation.enabled !== false, `${operation.id} enabled`, operation.onEnabledChange)
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
      rows.push(field("Gap", compactNumericInput(Number.isFinite(operation.gap) ? operation.gap : 0, `${operation.id} gap`, operation.onGapChange)));
    }
    rows.push(...(operation.extraRows || []));
    card.append(header, ...rows);
    return card;
  };

  const trimJointOperationModel = (operation, index) => {
    const type = operationType(operation);
    const usesMemberB = operationUsesMemberB(type);
    return {
      id: operation.id,
      cutNumber: index + 1,
      type,
      typeOptions: TRIM_OPERATION_TYPES,
      enabled: operation.enabled !== false,
      memberA: {
        label: type === "plane-trim" ? "Cut member" : "Member A",
        id: operation.memberAId,
        showEnd: operationUsesMemberEnd(type, "memberA"),
        end: operation.memberAEnd || "end",
        onEndChange: (end, label) => updateOperation(operation.id, { memberAEnd: end }, `Member A ${label.toLowerCase()} end selected.`),
        onPick: () => pickOperationMember(operation, "memberA")
      },
      memberB: usesMemberB ? {
        label: "Member B",
        id: operation.memberBId,
        showEnd: operationUsesMemberEnd(type, "memberB"),
        end: operation.memberBEnd || "end",
        onEndChange: (end, label) => updateOperation(operation.id, { memberBEnd: end }, `Member B ${label.toLowerCase()} end selected.`),
        onPick: () => pickOperationMember(operation, "memberB")
      } : null,
      referencePlane: type === "plane-trim",
      referencePlaneIds: planeIds(operation),
      removedRegionKeys: operation.removedRegionKeys || [],
      regionKeys: type === "plane-trim" ? regionKeysForPlaneIds(planeIds(operation)) : [],
      showGap: operationSupportsGap(type),
      gap: operation.gap,
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
    const sourceOperations = trimJoint.operations || [];
    const activeIndex = activeOperationId ? sourceOperations.findIndex((operation) => operation.id === activeOperationId) : -1;
    if (activeOperationId && activeIndex < 0) activeOperationId = null;
    const visibleOperations = activeOperationId ? [sourceOperations[activeIndex]] : sourceOperations;
    return {
      id: trimJoint.id,
      operations: visibleOperations.map((operation) => trimJointOperationModel(operation, sourceOperations.indexOf(operation))),
      totalOperations: sourceOperations.length,
      activeCutNumber: activeOperationId ? activeIndex + 1 : null,
      participants: (trimJoint.participants || []).map((participant) => ({ ...participant, canRemove: true })),
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
    messageText = "";
    messageState = "";
    render();
    if (hadFocus) notifyFocusChange();
  }

  function render() {
    const trimJoint = selectedTrimJoint();
    const model = trimJoint ? trimJointEditorModel(trimJoint) : null;
    if (!model) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    const header = document.createElement("div");
    header.className = "feature-editor-header";
    header.append(text("div", "editor-title", "Trim Editor"), button("Close", "editor-button", () => clear()));

    const body = document.createElement("section");
    body.className = "editor-section";
    body.append(...editorRows(model));

    const message = text("div", "editor-message", messageText);
    message.dataset.state = messageState;

    panel.hidden = false;
    panel.replaceChildren(header, body, message);
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
      activeOperationId = (trimJoint.operations || []).some((operation) => operation.id === options.operationId) ? options.operationId : null;
      activeRegionKey = activeOperationId && typeof options.regionKey === "string" ? options.regionKey : null;
      activeMemberId = null;
      const operation = activeOperation();
      messageText = activeRegionKey ? `Selected region ${activeRegionKey}.` : operation ? `Selected ${operationLabel(operation.type)}.` : "";
      messageState = operation ? "ok" : "";
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
        operation = (trimJoint?.operations || []).find((item) => item.id === face.operationId) || null;
        regionKeyValue = face.regionKey;
      } else if (face?.collection === "members" && selectedTrimJointId && Array.isArray(face.hitPoint)) {
        trimJoint = selectedTrimJoint();
        operation = activePlaneTrimOperationForMember(face.objectId);
        regionKeyValue = operation ? regionKeyForPoint(operation, face.hitPoint) : null;
      }
      if (!operation || operation.type !== "plane-trim") return false;
      const validRegions = regionKeysForPlaneIds(planeIds(operation));
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
