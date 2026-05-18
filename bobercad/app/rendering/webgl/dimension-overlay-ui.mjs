import { v } from "../../engine/core/math.mjs";

const HOVER_COLOR = "#2563eb";

export function createDimensionOverlayUi({ canvas, settings, projectPoint, screenScale, requestDraw }) {
  let overlay = { lines: [], labels: [] };
  const handlers = {
    click: null,
    value: null,
    mode: null,
    cancel: null,
    repair: null
  };
  const inputDrafts = new Map();
  const pairDrafts = new Map();
  let hoveredId = null;
  let tooltipTimer = null;
  let tooltipAnchor = null;

  const labels = document.createElement("div");
  const tooltip = document.createElement("div");
  labels.className = "dimension-label-layer";
  tooltip.className = "dimension-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(labels);
  document.body.appendChild(tooltip);

  function dimensionTooltipSettings() {
    const dimensions = settings.render.dimensions || {};
    return {
      delayMs: dimensions.tooltipDelayMs ?? 80,
      offset: dimensions.tooltipOffsetPx ?? 14,
      fontFamily: dimensions.tooltipFontFamily || dimensions.fontFamily || "Arial, sans-serif",
      fontSize: dimensions.tooltipFontPx ?? 13,
      maxWidth: dimensions.tooltipMaxWidthPx ?? 320
    };
  }

  function dimensionHoverText(id) {
    if (!id) return "";
    const label = (overlay.labels || []).find((item) => item.dimensionId === id);
    if (label?.title) return label.title;
    if (label?.text) return label.text;
    const line = (overlay.lines || []).find((item) => item.dimensionId === id);
    return line?.issueMessage || "";
  }

  function positionTooltip(event) {
    if (!event || tooltip.hidden) return;
    const { offset } = dimensionTooltipSettings();
    const rect = tooltip.getBoundingClientRect();
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    if (left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - offset;
    if (top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - offset;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    tooltipAnchor = null;
    delete tooltip.dataset.dimensionId;
    tooltip.hidden = true;
    tooltip.textContent = "";
  }

  function showTooltip(id, event) {
    const text = dimensionHoverText(id);
    if (!text) {
      hideTooltip();
      return;
    }
    tooltipAnchor = event ? { clientX: event.clientX, clientY: event.clientY } : tooltipAnchor;
    if (tooltip.dataset.dimensionId === id) {
      if (!tooltip.hidden) positionTooltip(tooltipAnchor);
      return;
    }
    hideTooltip();
    tooltipAnchor = event ? { clientX: event.clientX, clientY: event.clientY } : null;
    const tooltipSettings = dimensionTooltipSettings();
    tooltip.dataset.dimensionId = id;
    tooltip.textContent = text;
    tooltip.style.fontFamily = tooltipSettings.fontFamily;
    tooltip.style.fontSize = `${tooltipSettings.fontSize}px`;
    tooltip.style.maxWidth = `${tooltipSettings.maxWidth}px`;
    const show = () => {
      tooltipTimer = null;
      tooltip.hidden = false;
      positionTooltip(tooltipAnchor);
    };
    const delay = tooltipSettings.delayMs;
    if (delay <= 0) show();
    else tooltipTimer = setTimeout(show, delay);
  }

  function hasEditingDimension() {
    return overlay.labels?.some((label) => label.editing);
  }

  function setHoveredDimensionId(nextId, event = null) {
    const id = nextId || null;
    if (hoveredId === id) {
      if (id) showTooltip(id, event);
      return;
    }
    hoveredId = id;
    canvas.classList.toggle("dimension-hover", Boolean(id));
    if (id) showTooltip(id, event);
    else hideTooltip();
    if (!hasEditingDimension()) requestDraw();
  }

  function editableLabelParts(label) {
    const text = label.displayText || label.text;
    if (label.editing && label.editKind === "positiveIntegerPair") return null;
    const match = label.editing ? text.match(/-?\d+(?:\.\d+)?/) : null;
    if (!match || text[match.index + match[0].length] === "x") return null;
    if (!Number.isFinite(Number(match[0]))) return null;
    return {
      before: text.slice(0, match.index),
      value: match[0],
      after: text.slice(match.index + match[0].length)
    };
  }

  function parsedLabelInput(label, value) {
    if (label.editKind === "positiveIntegerPair") {
      const match = String(value).trim().match(/^(\d+)\s*[xX\u00d7]\s*(\d+)$/);
      if (!match) return null;
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (!Number.isInteger(first) || first <= 0 || !Number.isInteger(second) || second <= 0) return null;
      return { first, second };
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function commitLabelInput(input, label) {
    const value = parsedLabelInput(label, input.value);
    input.classList.toggle("invalid", value === null);
    if (value === null) return false;
    const valid = handlers.value?.(label, value);
    input.classList.toggle("invalid", valid === false);
    return valid !== false;
  }

  function caretIndexFromPointer(input, event) {
    const rect = input.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 1;
    return Math.max(0, Math.min(input.value.length, Math.round(ratio * input.value.length)));
  }

  function appendLabelText(button, label) {
    const parts = editableLabelParts(label);
    if (!parts) {
      button.textContent = label.text;
      return null;
    }
    const input = document.createElement("input");
    input.className = "dimension-label-input";
    input.type = "text";
    input.inputMode = label.editKind === "positiveIntegerPair" ? "text" : "decimal";
    const draftKey = label.dimensionId;
    input.value = inputDrafts.has(draftKey) ? inputDrafts.get(draftKey) : parts.value;
    let committedValue = parts.value;
    input.setAttribute("aria-label", label.title || label.text);
    input.style.width = `${Math.max(2, input.value.length)}ch`;
    const updateWidth = () => {
      input.style.width = `${Math.max(2, input.value.length)}ch`;
    };
    const commit = () => {
      if (input.value === committedValue) {
        inputDrafts.delete(draftKey);
        return true;
      }
      if (commitLabelInput(input, label) === false) return false;
      inputDrafts.delete(draftKey);
      committedValue = input.value;
      return true;
    };
    const cancel = () => {
      inputDrafts.delete(draftKey);
      input.value = committedValue;
      updateWidth();
      input.classList.remove("invalid");
    };
    input.dimensionCommit = commit;
    input.dimensionCancel = cancel;
    input.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.focus({ preventScroll: true });
      const wholeValueSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length && input.value.length > 0;
      if (wholeValueSelected) {
        const index = caretIndexFromPointer(input, event);
        requestAnimationFrame(() => input.setSelectionRange(index, index));
      } else {
        requestAnimationFrame(() => input.select());
      }
    });
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      inputDrafts.set(draftKey, input.value);
      updateWidth();
      input.classList.toggle("invalid", parsedLabelInput(label, input.value) === null);
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        event.preventDefault();
        const index = event.key === "ArrowLeft" ? 0 : input.value.length;
        input.setSelectionRange(index, index);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (commit()) {
          handlers.cancel?.(label);
          input.blur();
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        handlers.cancel?.(label);
        input.blur();
      }
    });
    button.replaceChildren(document.createTextNode(parts.before), input, document.createTextNode(parts.after));
    return input;
  }

  function integerPairValue(value) {
    const match = String(value || "").trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    return Number.isInteger(first) && first > 0 && Number.isInteger(second) && second > 0
      ? { first, second }
      : null;
  }

  function appendPositiveIntegerPairEditor(menu, label) {
    const committed = integerPairValue(label.editValue || label.displayText || label.text);
    if (!committed) return null;
    menu.classList.add("pair-editor");
    const draftKey = label.dimensionId;
    const draft = pairDrafts.get(draftKey) || { first: String(committed.first), second: String(committed.second) };
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    const firstInput = document.createElement("input");
    const secondInput = document.createElement("input");
    wrapper.className = "dimension-pair-editor";
    title.className = "dimension-pair-title";
    title.textContent = label.editTitle || label.title?.split("\n")[0] || "Pattern";

    const storeDraft = () => {
      pairDrafts.set(draftKey, { first: firstInput.value, second: secondInput.value });
    };
    const markValid = () => {
      const firstValid = Number.isInteger(Number(firstInput.value)) && Number(firstInput.value) > 0;
      const secondValid = Number.isInteger(Number(secondInput.value)) && Number(secondInput.value) > 0;
      firstInput.classList.toggle("invalid", !firstValid);
      secondInput.classList.toggle("invalid", !secondValid);
      return firstValid && secondValid;
    };
    const commit = () => {
      if (!markValid()) return false;
      const value = { first: Number(firstInput.value), second: Number(secondInput.value) };
      if (value.first === committed.first && value.second === committed.second) {
        pairDrafts.delete(draftKey);
        return true;
      }
      const valid = handlers.value?.(label, value);
      if (valid === false) return false;
      pairDrafts.delete(draftKey);
      return true;
    };
    const cancel = () => {
      pairDrafts.delete(draftKey);
      firstInput.value = String(committed.first);
      secondInput.value = String(committed.second);
      firstInput.classList.remove("invalid");
      secondInput.classList.remove("invalid");
    };
    const step = (input, delta) => {
      const current = Number(input.value);
      input.value = String(Math.max(1, Number.isInteger(current) && current > 0 ? current + delta : 1));
      storeDraft();
      markValid();
    };
    const makeRow = (key, labelText, input) => {
      const row = document.createElement("label");
      const minus = document.createElement("button");
      const plus = document.createElement("button");
      const text = document.createElement("span");
      row.className = "dimension-pair-row";
      text.className = "dimension-pair-label";
      text.textContent = labelText;
      input.className = "dimension-pair-input";
      input.type = "text";
      input.inputMode = "numeric";
      input.value = draft[key];
      input.setAttribute("aria-label", labelText);
      minus.type = "button";
      plus.type = "button";
      minus.className = "dimension-pair-step";
      plus.className = "dimension-pair-step";
      minus.textContent = "-";
      plus.textContent = "+";
      for (const button of [minus, plus]) {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      }
      minus.addEventListener("click", () => step(input, -1));
      plus.addEventListener("click", () => step(input, 1));
      input.addEventListener("pointerdown", (event) => event.stopPropagation());
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("input", () => {
        storeDraft();
        markValid();
      });
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          if (commit()) handlers.cancel?.(label);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
          handlers.cancel?.(label);
        }
      });
      row.replaceChildren(text, minus, input, plus);
      return row;
    };
    wrapper.append(
      title,
      makeRow("first", label.editLabels?.first || "Rows", firstInput),
      makeRow("second", label.editLabels?.second || "Columns", secondInput)
    );
    menu.append(wrapper);
    requestAnimationFrame(() => {
      firstInput.focus({ preventScroll: true });
      firstInput.select();
    });
    return { dimensionCommit: commit, dimensionCancel: cancel };
  }

  function appendDimensionEditActions(menu, label, editor) {
    if (!editor && !label.issueResolvable) return;
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "dimension-label-action approve";
    approve.setAttribute("aria-label", "Apply dimension value");
    approve.textContent = "\u2713";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "dimension-label-action reject";
    reject.setAttribute("aria-label", "Cancel dimension edit");
    reject.textContent = "\u00d7";
    const repair = document.createElement("button");
    repair.type = "button";
    repair.className = "dimension-label-action repair";
    repair.setAttribute("aria-label", "Auto fix dimension issue");
    repair.title = label.issueMessage || "Auto fix dimension issue";
    repair.textContent = "\u2692";
    const actions = editor ? [approve, reject] : [];
    if (label.issueResolvable) actions.push(repair);
    for (const action of actions) {
      action.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      action.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
    if (editor) {
      approve.addEventListener("click", () => {
        if (editor.dimensionCommit?.()) handlers.cancel?.(label);
      });
      reject.addEventListener("click", () => {
        editor.dimensionCancel?.();
        handlers.cancel?.(label);
      });
    }
    repair.addEventListener("click", () => {
      handlers.repair?.(label);
    });
    const actionRow = document.createElement("span");
    actionRow.className = "dimension-menu-actions";
    actionRow.append(...actions);
    menu.append(actionRow);
  }

  function appendStaticLabelText(button, label) {
    const selecting = label.active && label.activeMode !== "cursor";
    const text = label.displayText || label.text;
    if (selecting && label.editKind === "positiveIntegerPair") {
      const value = document.createElement("span");
      value.className = "dimension-label-edit-value";
      value.textContent = text;
      button.replaceChildren(value);
      return;
    }
    const match = selecting ? text.match(/-?\d+(?:\.\d+)?/) : null;
    if (!match) {
      button.textContent = text;
      return;
    }
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const value = document.createElement("span");
    value.className = "dimension-label-edit-value";
    value.textContent = match[0];
    button.replaceChildren(document.createTextNode(before), value, document.createTextNode(after));
  }

  function labelRotation(label) {
    const axis = Array.isArray(label.labelLine) && label.labelLine.length === 2
      ? v.sub(label.labelLine[1], label.labelLine[0])
      : label.labelAxis;
    if (!Array.isArray(axis)) return 0;
    const a = projectPoint(label.point);
    const b = projectPoint(v.add(label.point, axis));
    if (!a || !b) return 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1) return 0;
    let angle = Math.atan2(dy, dx);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    return angle;
  }

  function labelScreenFontSize(label) {
    return (label.textHeight || settings.render.dimensions?.textHeight || 10) * screenScale();
  }

  function dimensionFontSettings(label) {
    const dimensions = settings.render.dimensions || {};
    return {
      family: dimensions.fontFamily || "Arial, sans-serif",
      weight: label.active ? dimensions.activeFontWeight || "700" : dimensions.fontWeight || "400",
      minSize: dimensions.minFontPx || 4
    };
  }

  function createDimensionModeMenu(label, projected, input = null) {
    const control = label.modeControl;
    const menu = document.createElement("div");
    const title = document.createElement("span");
    menu.className = "dimension-mode-menu";
    menu.style.left = `${projected.x}px`;
    menu.style.top = `${projected.y + 24}px`;
    menu.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    const pairEditor = label.editing && label.editKind === "positiveIntegerPair"
      ? appendPositiveIntegerPairEditor(menu, label)
      : null;
    appendDimensionEditActions(menu, label, pairEditor || input);
    if (control?.path && Array.isArray(control.options) && control.options.length) {
      title.className = "dimension-mode-title";
      title.textContent = control.label || "Mode";
      menu.append(title);
      for (const option of control.options) {
        const button = document.createElement("button");
        const selected = option.value === control.value;
        button.type = "button";
        button.className = `dimension-mode-option${selected ? " selected" : ""}`;
        button.textContent = option.label || String(option.value);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.addEventListener("click", () => {
          handlers.mode?.(label, control.path, option.value);
        });
        menu.append(button);
      }
    }
    return menu;
  }

  function renderLabels() {
    const visibleLabels = (overlay.labels || [])
      .filter((label) => {
        const font = dimensionFontSettings(label);
        return label.editing || label.issueSeverity || labelScreenFontSize(label) >= font.minSize || label.active || isHovered(label);
      });
    if (!visibleLabels.length) {
      labels.replaceChildren();
      return;
    }
    const nextLabels = [];
    const focusInputs = [];
    const projectedLabels = visibleLabels
      .map((label) => ({ label, projected: projectPoint(label.point) }))
      .filter((item) => item.projected)
      .sort((a, b) => a.projected.y - b.projected.y || a.projected.x - b.projected.x);
    for (const { label, projected } of projectedLabels) {
      if (projected.x < -80 || projected.x > canvas.width + 80 || projected.y < -40 || projected.y > canvas.height + 40) continue;
      const button = document.createElement(label.editing && handlers.value ? "span" : "button");
      if (button.tagName === "BUTTON") button.type = "button";
      button.className = `dimension-label${label.issueSeverity ? ` issue-${label.issueSeverity}` : ""}${label.active ? " active" : ""}${isHovered(label) ? " hovered" : ""}${label.active && label.activeMode !== "cursor" ? " selecting" : ""}`;
      const input = label.editing && handlers.value ? appendLabelText(button, label) : null;
      if (!input) appendStaticLabelText(button, label);
      else focusInputs.push({ input, mode: label.activeMode });
      button.setAttribute("aria-label", label.title || label.text);
      button.style.left = `${projected.x}px`;
      button.style.top = `${projected.y}px`;
      button.style.transform = `translate(-50%, -50%) rotate(${labelRotation(label)}rad)`;
      button.style.fontSize = `${Math.max(label.editing ? 12 : 1, labelScreenFontSize(label))}px`;
      button.style.fontFamily = dimensionFontSettings(label).family;
      button.style.fontWeight = dimensionFontSettings(label).weight;
      button.style.borderColor = isHovered(label) ? HOVER_COLOR : label.color;
      button.style.color = isHovered(label) ? HOVER_COLOR : label.color;
      button.dataset.parameter = label.parameter || "";
      button.addEventListener("pointerenter", (event) => setHoveredDimensionId(label.dimensionId, event));
      button.addEventListener("pointermove", (event) => setHoveredDimensionId(label.dimensionId, event));
      button.addEventListener("pointerleave", (event) => setHoveredDimensionId(null, event));
      button.addEventListener("pointerdown", (event) => {
        if (event.target?.classList?.contains("dimension-label-input")) return;
        event.preventDefault();
        event.stopPropagation();
        handlers.click?.(label);
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      nextLabels.push(button);
      const hasModeMenu = label.modeControl?.path && Array.isArray(label.modeControl.options) && label.modeControl.options.length;
      const hasPairEditor = label.editing && label.editKind === "positiveIntegerPair";
      if (label.active && (input || hasPairEditor || hasModeMenu || label.issueResolvable)) {
        nextLabels.push(createDimensionModeMenu(label, projected, input));
      }
    }
    labels.replaceChildren(...nextLabels);
    for (const { input, mode } of focusInputs) {
      input.focus();
      if (mode === "cursor") input.setSelectionRange(input.value.length, input.value.length);
      else input.select();
    }
  }

  function setOverlay(nextOverlay = { lines: [], labels: [] }) {
    overlay = nextOverlay || { lines: [], labels: [] };
    const editingDimensionIds = new Set((overlay.labels || [])
      .filter((label) => label.editing)
      .map((label) => label.dimensionId));
    for (const dimensionId of inputDrafts.keys()) {
      if (!editingDimensionIds.has(dimensionId)) inputDrafts.delete(dimensionId);
    }
    for (const dimensionId of pairDrafts.keys()) {
      if (!editingDimensionIds.has(dimensionId)) pairDrafts.delete(dimensionId);
    }
    const dimensionStillExists = hoveredId && (
      overlay.lines?.some((line) => line.dimensionId === hoveredId)
      || overlay.labels?.some((label) => label.dimensionId === hoveredId)
    );
    if (hoveredId && !dimensionStillExists) {
      hoveredId = null;
      canvas.classList.remove("dimension-hover");
      hideTooltip();
    }
  }

  function isHovered(item) {
    return item?.dimensionId && item.dimensionId === hoveredId;
  }

  return {
    hoverColor: HOVER_COLOR,
    contains: (target) => labels.contains(target),
    hasClickHandler: () => Boolean(handlers.click),
    clickDimension: (dimension) => handlers.click?.(dimension),
    isHovered,
    setHoveredDimensionId,
    setOverlay,
    renderLabels,
    setClickHandler: (handler) => { handlers.click = handler; },
    setValueHandler: (handler) => { handlers.value = handler; },
    setModeHandler: (handler) => { handlers.mode = handler; },
    setCancelHandler: (handler) => { handlers.cancel = handler; },
    setRepairHandler: (handler) => { handlers.repair = handler; }
  };
}
