import { v } from "../../engine/core/math.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { createCamera } from "./camera.mjs";

export function createWebglViewer(canvas, reset, settings) {
  const gl = canvas.getContext("webgl", { antialias: true });
  let scene = null;
  const camera = createCamera(settings);
  let drag = null;
  let renderer = null;
  let pickHandler = null;
  let clickHandler = null;
  let authoringHandler = null;
  let authoringOverlay = { lines: [], handles: [] };
  let dimensionOverlay = { lines: [], labels: [] };
  let dimensionClickHandler = null;
  let dimensionValueHandler = null;
  let dimensionModeHandler = null;
  let dimensionCancelHandler = null;
  let dimensionRepairHandler = null;
  const dimensionInputDrafts = new Map();
  const dimensionPairDrafts = new Map();
  let hoveredDimensionId = null;
  let tooltipTimer = null;
  let tooltipAnchor = null;
  let highlightedObjectIds = new Set();
  const dimensionLabels = document.createElement("div");
  const dimensionTooltip = document.createElement("div");
  const dimensionHoverColor = "#2563eb";
  const highlight = {
    fill: "#f59e0b",
    edge: "#facc15"
  };

  dimensionLabels.className = "dimension-label-layer";
  dimensionTooltip.className = "dimension-tooltip";
  dimensionTooltip.hidden = true;
  document.body.appendChild(dimensionLabels);
  document.body.appendChild(dimensionTooltip);

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function shadedRgba(color, points, opacity = 1) {
    const rgb = hexToRgb(color);
    const n = faceNormal(points);
    const light = v.norm(settings.render.lighting.direction);
    const shade = settings.render.lighting.ambient + Math.max(0, v.dot(n, light)) * settings.render.lighting.diffuse;
    return [
      Math.round(rgb[0] * shade),
      Math.round(rgb[1] * shade),
      Math.round(rgb[2] * shade),
      Math.round(255 * opacity)
    ];
  }

  function hexToRgba(color) {
    const rgb = hexToRgb(color);
    return [rgb[0], rgb[1], rgb[2], 255];
  }

  function isHighlighted(item) {
    return highlightedObjectIds.has(item.objectId);
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function initRenderer() {
    if (renderer) return renderer;
    if (!gl) throw new Error("WebGL is required for depth-correct viewing");

    const program = createProgram(`
      attribute vec3 aPosition;
      attribute vec4 aColor;
      varying vec4 vColor;
      void main() {
        gl_Position = vec4(aPosition, 1.0);
        vColor = aColor;
      }
    `, `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `);

    renderer = {
      program,
      position: gl.getAttribLocation(program, "aPosition"),
      color: gl.getAttribLocation(program, "aColor"),
      positionBuffer: gl.createBuffer(),
      colorBuffer: gl.createBuffer()
    };
    return renderer;
  }

  function clipPoint(point) {
    return camera.clipPoint(point, scene, canvas);
  }

  function barycentric(point, a, b, c) {
    const v0x = b.x - a.x;
    const v0y = b.y - a.y;
    const v1x = c.x - a.x;
    const v1y = c.y - a.y;
    const v2x = point.x - a.x;
    const v2y = point.y - a.y;
    const denominator = v0x * v1y - v1x * v0y;
    if (Math.abs(denominator) < 0.000001) return null;
    const u = (v2x * v1y - v1x * v2y) / denominator;
    const vValue = (v0x * v2y - v2x * v0y) / denominator;
    const w = 1 - u - vValue;
    return u >= -0.0001 && vValue >= -0.0001 && w >= -0.0001 ? [w, u, vValue] : null;
  }

  function interpolatePoint(points, weights) {
    return [
      points[0][0] * weights[0] + points[1][0] * weights[1] + points[2][0] * weights[2],
      points[0][1] * weights[0] + points[1][1] * weights[1] + points[2][1] * weights[2],
      points[0][2] * weights[0] + points[1][2] * weights[1] + points[2][2] * weights[2]
    ];
  }

  function pickScene(x, y) {
    const cursor = { x, y };
    let best = null;
    for (const face of scene.faces) {
      for (const triangle of triangulateFace(face.points)) {
        const projected = triangle.map((point) => camera.projectPoint(point, scene, canvas));
        const weights = barycentric(cursor, projected[0], projected[1], projected[2]);
        if (!weights) continue;
        const depth = projected[0].depth * weights[0] + projected[1].depth * weights[1] + projected[2].depth * weights[2];
        if (!best || depth < best.depth) best = { depth, point: interpolatePoint(triangle, weights), face };
      }
    }
    return best;
  }

  function projectPoint(point) {
    return scene ? camera.projectPoint(point, scene, canvas) : null;
  }

  function pickAuthoringHandle(x, y) {
    if (!scene || !authoringOverlay?.handles?.length) return null;
    let best = null;
    for (const handle of authoringOverlay.handles) {
      const projected = projectPoint(handle.point);
      if (!projected) continue;
      const distance = Math.hypot(projected.x - x, projected.y - y);
      if (distance > (handle.radius || 10)) continue;
      if (!best || distance < best.distance) best = { ...handle, distance, screen: projected };
    }
    return best;
  }

  function screenLineDistance(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby;
    const t = lengthSq <= 0.000001
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
    return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
  }

  function pickDimension(x, y) {
    if (!scene || !dimensionClickHandler) return null;
    const cursor = { x, y };
    let best = null;
    for (const line of dimensionOverlay.lines || []) {
      const a = projectPoint(line.points[0]);
      const b = projectPoint(line.points[1]);
      if (!a || !b) continue;
      const distance = screenLineDistance(cursor, a, b);
      if (distance > 8) continue;
      if (!best || distance < best.distance) best = { ...line, distance };
    }
    return best;
  }

  function isHoveredDimension(item) {
    return item?.dimensionId && item.dimensionId === hoveredDimensionId;
  }

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
    const label = (dimensionOverlay.labels || []).find((item) => item.dimensionId === id);
    if (label?.title) return label.title;
    if (label?.text) return label.text;
    const line = (dimensionOverlay.lines || []).find((item) => item.dimensionId === id);
    return line?.issueMessage || "";
  }

  function positionDimensionTooltip(event) {
    if (!event || dimensionTooltip.hidden) return;
    const { offset } = dimensionTooltipSettings();
    const rect = dimensionTooltip.getBoundingClientRect();
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    if (left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - offset;
    if (top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - offset;
    dimensionTooltip.style.left = `${Math.max(8, left)}px`;
    dimensionTooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideDimensionTooltip() {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    tooltipAnchor = null;
    delete dimensionTooltip.dataset.dimensionId;
    dimensionTooltip.hidden = true;
    dimensionTooltip.textContent = "";
  }

  function showDimensionTooltip(id, event) {
    const text = dimensionHoverText(id);
    if (!text) {
      hideDimensionTooltip();
      return;
    }
    tooltipAnchor = event ? { clientX: event.clientX, clientY: event.clientY } : tooltipAnchor;
    if (dimensionTooltip.dataset.dimensionId === id) {
      if (!dimensionTooltip.hidden) positionDimensionTooltip(tooltipAnchor);
      return;
    }
    hideDimensionTooltip();
    tooltipAnchor = event ? { clientX: event.clientX, clientY: event.clientY } : null;
    const tooltipSettings = dimensionTooltipSettings();
    dimensionTooltip.dataset.dimensionId = id;
    dimensionTooltip.textContent = text;
    dimensionTooltip.style.fontFamily = tooltipSettings.fontFamily;
    dimensionTooltip.style.fontSize = `${tooltipSettings.fontSize}px`;
    dimensionTooltip.style.maxWidth = `${tooltipSettings.maxWidth}px`;
    const show = () => {
      tooltipTimer = null;
      dimensionTooltip.hidden = false;
      positionDimensionTooltip(tooltipAnchor);
    };
    const delay = tooltipSettings.delayMs;
    if (delay <= 0) show();
    else tooltipTimer = setTimeout(show, delay);
  }

  function hasEditingDimension() {
    return dimensionOverlay.labels?.some((label) => label.editing);
  }

  function setHoveredDimensionId(nextId, event = null) {
    const id = nextId || null;
    if (hoveredDimensionId === id) {
      if (id) showDimensionTooltip(id, event);
      return;
    }
    hoveredDimensionId = id;
    canvas.classList.toggle("dimension-hover", Boolean(id));
    if (id) showDimensionTooltip(id, event);
    else hideDimensionTooltip();
    if (!hasEditingDimension()) draw();
  }

  function updateDimensionHover(event) {
    if (!scene || drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setHoveredDimensionId(null, event);
      return;
    }
    setHoveredDimensionId(pickDimension(x, y)?.dimensionId || null, event);
  }

  function clipFromScreen(x, y, depth = -1) {
    return [
      x / canvas.width * 2 - 1,
      1 - y / canvas.height * 2,
      depth
    ];
  }

  function pushVertex(positionData, colorData, point, rgba) {
    positionData.push(point[0], point[1], point[2]);
    colorData.push(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255);
  }

  function drawArrays(mode, positionData, colorData) {
    if (!positionData.length) return;
    const state = initRenderer();

    gl.useProgram(state.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionData), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.position);
    gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.color);
    gl.vertexAttribPointer(state.color, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(mode, 0, positionData.length / 3);
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
      const match = String(value).trim().match(/^(\d+)\s*[xXÃ—]\s*(\d+)$/);
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
    const valid = dimensionValueHandler?.(label, value);
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
    input.value = dimensionInputDrafts.has(draftKey) ? dimensionInputDrafts.get(draftKey) : parts.value;
    let committedValue = parts.value;
    input.setAttribute("aria-label", label.title || label.text);
    input.style.width = `${Math.max(2, input.value.length)}ch`;
    const updateWidth = () => {
      input.style.width = `${Math.max(2, input.value.length)}ch`;
    };
    const commit = () => {
      if (input.value === committedValue) {
        dimensionInputDrafts.delete(draftKey);
        return true;
      }
      if (commitLabelInput(input, label) === false) return false;
      dimensionInputDrafts.delete(draftKey);
      committedValue = input.value;
      return true;
    };
    const cancel = () => {
      dimensionInputDrafts.delete(draftKey);
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
      dimensionInputDrafts.set(draftKey, input.value);
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
          dimensionCancelHandler?.(label);
          input.blur();
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        dimensionCancelHandler?.(label);
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
    const draft = dimensionPairDrafts.get(draftKey) || { first: String(committed.first), second: String(committed.second) };
    const wrapper = document.createElement("div");
    const title = document.createElement("div");
    const firstInput = document.createElement("input");
    const secondInput = document.createElement("input");
    wrapper.className = "dimension-pair-editor";
    title.className = "dimension-pair-title";
    title.textContent = label.editTitle || label.title?.split("\n")[0] || "Pattern";

    const storeDraft = () => {
      dimensionPairDrafts.set(draftKey, { first: firstInput.value, second: secondInput.value });
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
        dimensionPairDrafts.delete(draftKey);
        return true;
      }
      const valid = dimensionValueHandler?.(label, value);
      if (valid === false) return false;
      dimensionPairDrafts.delete(draftKey);
      return true;
    };
    const cancel = () => {
      dimensionPairDrafts.delete(draftKey);
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
          if (commit()) dimensionCancelHandler?.(label);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
          dimensionCancelHandler?.(label);
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
        if (editor.dimensionCommit?.()) {
          dimensionCancelHandler?.(label);
        }
      });
      reject.addEventListener("click", () => {
        editor.dimensionCancel?.();
        dimensionCancelHandler?.(label);
      });
    }
    repair.addEventListener("click", () => {
      dimensionRepairHandler?.(label);
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
    return (label.textHeight || settings.render.dimensions?.textHeight || 10) * camera.screenScale();
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
          dimensionModeHandler?.(label, control.path, option.value);
        });
        menu.append(button);
      }
    }
    return menu;
  }

  function renderDimensionLabels() {
    if (!scene) {
      dimensionLabels.replaceChildren();
      return;
    }
    const visibleLabels = (dimensionOverlay.labels || [])
      .filter((label) => {
        const font = dimensionFontSettings(label);
        return label.editing || label.issueSeverity || labelScreenFontSize(label) >= font.minSize || label.active || isHoveredDimension(label);
      });
    if (!visibleLabels.length) {
      dimensionLabels.replaceChildren();
      return;
    }
    const labels = [];
    const focusInputs = [];
    const projectedLabels = visibleLabels
      .map((label) => ({ label, projected: projectPoint(label.point) }))
      .filter((item) => item.projected)
      .sort((a, b) => a.projected.y - b.projected.y || a.projected.x - b.projected.x);
    for (const { label, projected } of projectedLabels) {
      if (projected.x < -80 || projected.x > canvas.width + 80 || projected.y < -40 || projected.y > canvas.height + 40) continue;
      const button = document.createElement(label.editing && dimensionValueHandler ? "span" : "button");
      if (button.tagName === "BUTTON") button.type = "button";
      button.className = `dimension-label${label.issueSeverity ? ` issue-${label.issueSeverity}` : ""}${label.active ? " active" : ""}${isHoveredDimension(label) ? " hovered" : ""}${label.active && label.activeMode !== "cursor" ? " selecting" : ""}`;
      const input = label.editing && dimensionValueHandler ? appendLabelText(button, label) : null;
      if (!input) appendStaticLabelText(button, label);
      else focusInputs.push({ input, mode: label.activeMode });
      button.setAttribute("aria-label", label.title || label.text);
      button.style.left = `${projected.x}px`;
      button.style.top = `${projected.y}px`;
      button.style.transform = `translate(-50%, -50%) rotate(${labelRotation(label)}rad)`;
      button.style.fontSize = `${Math.max(label.editing ? 12 : 1, labelScreenFontSize(label))}px`;
      button.style.fontFamily = dimensionFontSettings(label).family;
      button.style.fontWeight = dimensionFontSettings(label).weight;
      button.style.borderColor = isHoveredDimension(label) ? dimensionHoverColor : label.color;
      button.style.color = isHoveredDimension(label) ? dimensionHoverColor : label.color;
      button.dataset.parameter = label.parameter || "";
      button.addEventListener("pointerenter", (event) => setHoveredDimensionId(label.dimensionId, event));
      button.addEventListener("pointermove", (event) => setHoveredDimensionId(label.dimensionId, event));
      button.addEventListener("pointerleave", (event) => setHoveredDimensionId(null, event));
      button.addEventListener("pointerdown", (event) => {
        if (event.target?.classList?.contains("dimension-label-input")) return;
        event.preventDefault();
        event.stopPropagation();
        dimensionClickHandler?.(label);
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      labels.push(button);
      const hasModeMenu = label.modeControl?.path && Array.isArray(label.modeControl.options) && label.modeControl.options.length;
      const hasPairEditor = label.editing && label.editKind === "positiveIntegerPair";
      if (label.active && (input || hasPairEditor || hasModeMenu || label.issueResolvable)) {
        labels.push(createDimensionModeMenu(label, projected, input));
      }
    }
    dimensionLabels.replaceChildren(...labels);
    for (const { input, mode } of focusInputs) {
      input.focus();
      if (mode === "cursor") input.setSelectionRange(input.value.length, input.value.length);
      else input.select();
    }
  }

  function draw() {
    if (!scene || !gl) return;
    const background = hexToRgb(settings.render.background).map((value) => value / 255);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const drawFaces = (faces) => {
      const trianglePositions = [];
      const triangleColors = [];
      for (const face of faces) {
        const rgba = shadedRgba(isHighlighted(face) ? highlight.fill : face.color, face.points, face.opacity ?? 1);
        for (const triangle of triangulateFace(face.points)) {
          for (const point of triangle) pushVertex(trianglePositions, triangleColors, clipPoint(point), rgba);
        }
      }
      drawArrays(gl.TRIANGLES, trianglePositions, triangleColors);
    };
    const opaqueFaces = scene.faces.filter((face) => (face.opacity ?? 1) >= 1);
    const transparentFaces = scene.faces.filter((face) => (face.opacity ?? 1) < 1);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    drawFaces(opaqueFaces);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if (transparentFaces.length) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawFaces(transparentFaces);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    const linePositions = [];
    const lineColors = [];
    const edgeColor = hexToRgba(settings.render.edges.defaultColor);

    for (const face of scene.faces) {
      if (face.hideEdges) continue;
      for (let i = 0; i < face.points.length; i += 1) {
        pushVertex(linePositions, lineColors, clipPoint(face.points[i]), edgeColor);
        pushVertex(linePositions, lineColors, clipPoint(face.points[(i + 1) % face.points.length]), edgeColor);
      }
    }

    for (const line of scene.lines) {
      const rgba = hexToRgba(isHighlighted(line) ? highlight.edge : line.color);
      pushVertex(linePositions, lineColors, clipPoint(line.points[0]), rgba);
      pushVertex(linePositions, lineColors, clipPoint(line.points[1]), rgba);
    }

    for (const line of authoringOverlay.lines || []) {
      const rgba = hexToRgba(line.color);
      pushVertex(linePositions, lineColors, clipPoint(line.points[0]), rgba);
      pushVertex(linePositions, lineColors, clipPoint(line.points[1]), rgba);
    }

    gl.lineWidth(settings.render.edges.lineWidth);
    drawArrays(gl.LINES, linePositions, lineColors);

    const dimensionPositions = [];
    const dimensionColors = [];
    for (const line of dimensionOverlay.lines || []) {
      const rgba = hexToRgba(isHoveredDimension(line) ? dimensionHoverColor : line.color);
      pushVertex(dimensionPositions, dimensionColors, clipPoint(line.points[0]), rgba);
      pushVertex(dimensionPositions, dimensionColors, clipPoint(line.points[1]), rgba);
    }
    if (dimensionPositions.length) {
      gl.disable(gl.DEPTH_TEST);
      drawArrays(gl.LINES, dimensionPositions, dimensionColors);
      gl.enable(gl.DEPTH_TEST);
    }

    const handlePositions = [];
    const handleColors = [];
    for (const handle of authoringOverlay.handles || []) {
      const projected = projectPoint(handle.point);
      if (!projected) continue;
      const radius = handle.radius || 10;
      const color = hexToRgba(handle.color);
      const left = projected.x - radius;
      const right = projected.x + radius;
      const top = projected.y - radius;
      const bottom = projected.y + radius;
      pushVertex(handlePositions, handleColors, clipFromScreen(left, projected.y), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(right, projected.y), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(projected.x, top), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(projected.x, bottom), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(left, top), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(right, top), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(right, top), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(right, bottom), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(right, bottom), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(left, bottom), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(left, bottom), color);
      pushVertex(handlePositions, handleColors, clipFromScreen(left, top), color);
    }
    if (handlePositions.length) {
      gl.disable(gl.DEPTH_TEST);
      drawArrays(gl.LINES, handlePositions, handleColors);
      gl.enable(gl.DEPTH_TEST);
    }
    renderDimensionLabels();
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function resize() {
    resizeCanvas();
    draw();
  }

  function attachControls() {
    let orbitLockPending = false;
    const orbitCursor = document.createElement("div");
    orbitCursor.className = "orbit-cursor";
    orbitCursor.innerHTML = `
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M9 12a9 9 0 0 1 15-4" />
        <path d="M23 7h5v5" />
        <path d="M23 20a9 9 0 0 1-15 4" />
        <path d="M9 25H4v-5" />
        <circle cx="16" cy="16" r="2.2" />
      </svg>
    `;
    document.body.appendChild(orbitCursor);

    const moveOrbitCursor = (x, y) => {
      orbitCursor.style.left = `${x}px`;
      orbitCursor.style.top = `${y}px`;
    };
    const showOrbitCursor = () => orbitCursor.classList.add("visible");
    const hideOrbitCursor = () => orbitCursor.classList.remove("visible");

    const requestOrbitLock = () => {
      if (document.pointerLockElement === canvas) return;
      if (!canvas.requestPointerLock) return;
      orbitLockPending = true;
      try {
        const lockRequest = canvas.requestPointerLock();
        lockRequest?.catch?.(() => {
          orbitLockPending = false;
        });
      } catch {
        orbitLockPending = false;
      }
    };

    canvas.addEventListener("pointerdown", (event) => {
      if (!scene) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const mode = event.button === 1 || event.button === 2 || event.shiftKey ? "pan" : "pending-orbit";
      if (pickHandler && event.button === 0 && !event.shiftKey) {
        pickHandler(pickScene(x, y)?.face || null);
        return;
      }
      const dimension = event.button === 0 && !event.shiftKey ? pickDimension(x, y) : null;
      if (dimension) {
        dimensionClickHandler(dimension);
        return;
      }
      const handle = event.button === 0 && !event.shiftKey ? pickAuthoringHandle(x, y) : null;
      if (handle && authoringHandler?.beginDrag?.({ handle, screen: { x, y } }) !== false) {
        drag = {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          mode: "authoring",
          handle,
          pointerId: event.pointerId
        };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (mode === "pending-orbit") {
        const hitResult = pickScene(x, y);
        const hit = hitResult?.point || null;
        clickHandler?.(hitResult?.face || null);
        drag = {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          mode,
          face: hitResult?.face || null,
          hit,
          screen: { x, y },
          pointerId: event.pointerId
        };
      } else {
        drag = {
          x: event.clientX,
          y: event.clientY,
          mode,
          pointerId: event.pointerId
        };
      }
      if (mode === "orbit") moveOrbitCursor(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drag) {
        updateDimensionHover(event);
        return;
      }
      setHoveredDimensionId(null, event);
      if (drag.mode === "authoring") {
        authoringHandler?.drag?.({
          handle: drag.handle,
          dx: event.clientX - drag.x,
          dy: event.clientY - drag.y,
          totalDx: event.clientX - drag.startX,
          totalDy: event.clientY - drag.startY
        });
        drag.x = event.clientX;
        drag.y = event.clientY;
        draw();
        return;
      }
      if (drag.mode === "pending-orbit") {
        const totalDx = event.clientX - drag.startX;
        const totalDy = event.clientY - drag.startY;
        if (Math.hypot(totalDx, totalDy) < 4) return;
        camera.setOrbitPivot(drag.hit || [0, 0, 0], scene, canvas, drag.hit ? drag.screen : null);
        drag.mode = "orbit";
        moveOrbitCursor(event.clientX, event.clientY);
        requestOrbitLock();
      }
      const lockedOrbit = drag.mode === "orbit" && document.pointerLockElement === canvas;
      const dx = lockedOrbit ? event.movementX : event.clientX - drag.x;
      const dy = lockedOrbit ? event.movementY : event.clientY - drag.y;
      if (drag.mode === "pan") {
        camera.pan(dx, dy);
      } else {
        camera.orbit(dx, dy);
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      draw();
    });

    const endDrag = (eventOrOptions = {}) => {
      const options = eventOrOptions?.type ? {} : eventOrOptions;
      const currentDrag = drag;
      const pointerId = currentDrag?.pointerId;
      const lockedOrbit = currentDrag?.mode === "orbit" && document.pointerLockElement === canvas;
      if (currentDrag?.mode === "authoring") {
        const cancel = eventOrOptions?.type === "pointercancel" || eventOrOptions?.type === "lostpointercapture";
        (cancel ? authoringHandler?.cancel : authoringHandler?.end)?.({ handle: currentDrag.handle });
      }
      drag = null;
      hideOrbitCursor();
      if (pointerId !== undefined && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
      if ((options.exitPointerLock ?? true) && lockedOrbit) document.exitPointerLock?.();
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("lostpointercapture", () => {
      if (drag?.mode === "orbit" && (orbitLockPending || document.pointerLockElement === canvas)) return;
      endDrag();
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      orbitLockPending = false;
      if (document.pointerLockElement === canvas && drag?.mode === "orbit") {
        showOrbitCursor();
        return;
      }
      hideOrbitCursor();
      if (document.pointerLockElement !== canvas && drag?.mode === "orbit") endDrag({ exitPointerLock: false });
    });
    document.addEventListener("pointerlockerror", () => {
      orbitLockPending = false;
      hideOrbitCursor();
    });
    document.addEventListener("pointermove", (event) => {
      if (event.target === canvas || dimensionLabels.contains(event.target)) return;
      setHoveredDimensionId(null, event);
    });

    canvas.addEventListener("wheel", (event) => {
      if (!scene) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      camera.zoomAt(event.deltaY, event.clientX - rect.left, event.clientY - rect.top, canvas);
      draw();
    }, { passive: false });

    reset.addEventListener("click", () => {
      if (!scene) return;
      camera.reset();
      camera.fit(scene, canvas);
      draw();
    });
  }

  attachControls();

  return {
    setScene(nextScene, options = {}) {
      const preserveCamera = options.preserveCamera && scene;
      scene = nextScene;
      resizeCanvas();
      if (!preserveCamera) {
        camera.reset();
        camera.fit(scene, canvas);
      }
      draw();
    },
    setPickHandler(handler) {
      pickHandler = handler;
    },
    setClickHandler(handler) {
      clickHandler = handler;
    },
    setAuthoringHandler(handler) {
      authoringHandler = handler;
    },
    setAuthoringOverlay(overlay = { lines: [], handles: [] }) {
      authoringOverlay = overlay || { lines: [], handles: [] };
      draw();
    },
    setDimensionOverlay(overlay = { lines: [], labels: [] }) {
      dimensionOverlay = overlay || { lines: [], labels: [] };
      const editingDimensionIds = new Set((dimensionOverlay.labels || [])
        .filter((label) => label.editing)
        .map((label) => label.dimensionId));
      for (const dimensionId of dimensionInputDrafts.keys()) {
        if (!editingDimensionIds.has(dimensionId)) dimensionInputDrafts.delete(dimensionId);
      }
      for (const dimensionId of dimensionPairDrafts.keys()) {
        if (!editingDimensionIds.has(dimensionId)) dimensionPairDrafts.delete(dimensionId);
      }
      const dimensionStillExists = hoveredDimensionId && (
        dimensionOverlay.lines?.some((line) => line.dimensionId === hoveredDimensionId)
        || dimensionOverlay.labels?.some((label) => label.dimensionId === hoveredDimensionId)
      );
      if (hoveredDimensionId && !dimensionStillExists) {
        hoveredDimensionId = null;
        canvas.classList.remove("dimension-hover");
        hideDimensionTooltip();
      }
      draw();
    },
    setDimensionClickHandler(handler) {
      dimensionClickHandler = handler;
    },
    setDimensionValueHandler(handler) {
      dimensionValueHandler = handler;
    },
    setDimensionModeHandler(handler) {
      dimensionModeHandler = handler;
    },
    setDimensionCancelHandler(handler) {
      dimensionCancelHandler = handler;
    },
    setDimensionRepairHandler(handler) {
      dimensionRepairHandler = handler;
    },
    setHighlightedObjects(objectIds = []) {
      highlightedObjectIds = new Set(objectIds);
      draw();
    },
    projectPoint,
    screenDeltaToWorld(dx, dy) {
      return camera.screenDeltaToWorld(dx, dy);
    },
    resize,
    draw
  };
}
