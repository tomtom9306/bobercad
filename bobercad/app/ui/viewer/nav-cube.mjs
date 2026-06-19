import { applyTooltip } from "../design-system/ui-elements.mjs?v=nav-cube-1";
import { VIEW_ORIENTATION_FREE_ID, VIEW_ORIENTATION_NAV_ORDER, normalizeViewOrientation as normalizeViewOrientationValue, normalizeViewOrientationState, viewOrientationSpec } from "../commands/view-metadata.mjs?v=view-metadata-1";

export const VIEW_ORIENTATION_IDS = VIEW_ORIENTATION_NAV_ORDER.slice();

const ORIENTATION_SPECS = VIEW_ORIENTATION_NAV_ORDER.map((id) => viewOrientationSpec(id));
const VIEW_ORIENTATION_ID_SET = new Set(VIEW_ORIENTATION_IDS);
const CUBE_FACE_IDS = new Set(["front", "back", "left", "right", "top", "bottom"]);
const CUBE_FACE_SPECS = ORIENTATION_SPECS.filter((spec) => CUBE_FACE_IDS.has(spec.id));
const ISO_SPEC = viewOrientationSpec("iso");
const CUBE_FACE_SELECTOR = ".bc-nav-cube-face[data-view-orientation]";
const ORBIT_DRAG_THRESHOLD = 3;
const FACE_VISIBLE_NORMAL_EPSILON = 0.001;

export function mountNavCube({
  root,
  orientation = "iso",
  onOrientationChange,
  onOrbitDrag
} = {}) {
  if (!root) return null;
  let currentOrientation = normalizeNavOrientation(orientation);
  let drag = null;
  let suppressNextClick = false;
  let continuousYaw = null;
  let continuousPitch = null;

  root.classList.add("bc-nav-cube");
  root.replaceChildren(navCubeSurface());
  syncOrientation();

  return {
    setOrientation(nextOrientation) {
      currentOrientation = normalizeNavOrientation(nextOrientation);
      if (currentOrientation !== VIEW_ORIENTATION_FREE_ID) clearCameraRotation();
      syncOrientation();
    },
    setCameraState(state = {}) {
      const nextOrientation = normalizeNavOrientation(state.orientation);
      currentOrientation = nextOrientation;
      if (nextOrientation === VIEW_ORIENTATION_FREE_ID) {
        applyCameraRotation(state);
      } else {
        clearCameraRotation();
      }
      syncOrientation();
    },
    orientation() {
      return currentOrientation;
    }
  };

  function navCubeSurface() {
    const surface = document.createElement("div");
    surface.className = "bc-nav-cube-surface";
    surface.setAttribute("role", "group");
    surface.setAttribute("aria-label", "View orientation");

    const stage = document.createElement("div");
    stage.className = "bc-nav-cube-stage";
    stage.addEventListener("pointerdown", beginOrbitDrag);
    stage.addEventListener("click", commitStageFaceClick);

    const cube = document.createElement("div");
    cube.className = "bc-nav-cube-model";
    cube.setAttribute("role", "group");
    cube.setAttribute("aria-label", "Modeled view cube");
    for (const spec of CUBE_FACE_SPECS) {
      cube.append(orientationButton(spec, ["bc-nav-cube-face", `bc-nav-cube-face-${spec.id}`]));
    }

    stage.append(cube, orientationButton(ISO_SPEC, ["bc-nav-cube-iso-button"]));
    surface.append(stage);
    return surface;
  }

  function orientationButton(spec, extraClasses = []) {
    const isCubeFace = extraClasses.includes("bc-nav-cube-face");
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "bc-nav-cube-button",
      ...extraClasses,
      spec.primary ? "bc-nav-cube-button-primary" : ""
    ].filter(Boolean).join(" ");
    button.dataset.viewOrientation = spec.id;
    button.dataset.commandId = `view.orientation.${spec.id}`;
    const label = spec.navLabel || spec.label;
    button.setAttribute("aria-label", `${spec.label} view`);
    button.textContent = label;
    applyTooltip(button, `${spec.label} view`);
    button.addEventListener("click", (event) => {
      if (suppressNextClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const orientation = isCubeFace
        ? hitTestCubeFace(event) || spec.id
        : spec.id;
      commitOrientation(orientation);
      event.stopPropagation();
    });
    return button;
  }

  function commitStageFaceClick(event) {
    if (suppressNextClick || event.target.closest("[data-view-orientation]")) return;
    const orientation = hitTestCubeFace(event);
    if (orientation) commitOrientation(orientation);
  }

  function commitOrientation(orientation) {
    const nextOrientation = normalizeNavOrientation(orientation);
    if (nextOrientation === VIEW_ORIENTATION_FREE_ID) return;
    onOrientationChange?.(nextOrientation);
  }

  function hitTestCubeFace(event) {
    return cubeFaceFromPointer(root, event);
  }

  function syncOrientation() {
    root.dataset.viewOrientation = currentOrientation;
    for (const button of root.querySelectorAll("[data-view-orientation]")) {
      const active = currentOrientation !== VIEW_ORIENTATION_FREE_ID
        && normalizeNavOrientation(button.dataset.viewOrientation) === currentOrientation;
      button.classList.toggle("active", active);
      button.dataset.commandActive = active ? "true" : "false";
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function beginOrbitDrag(event) {
    if (event.button !== 0) return;
    const targetOrientation = event.target.closest("[data-view-orientation]")?.dataset.viewOrientation;
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      distance: 0,
      orientation: normalizeNavOrientation(targetOrientation)
    };
    suppressNextClick = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.addEventListener("pointermove", orbitDragMove);
    event.currentTarget.addEventListener("pointerup", endOrbitDrag);
    event.currentTarget.addEventListener("pointercancel", endOrbitDrag);
  }

  function orbitDragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (dx === 0 && dy === 0) return;
    drag.distance += Math.hypot(dx, dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.distance < ORBIT_DRAG_THRESHOLD) return;
    suppressNextClick = true;
    root.classList.add("dragging");
    event.preventDefault();
    onOrbitDrag?.({ dx, dy });
  }

  function endOrbitDrag(event) {
    const didDrag = suppressNextClick;
    const clickOrientation = event.type === "pointerup"
      ? drag?.orientation === "iso"
        ? drag.orientation
        : hitTestCubeFace(event) || drag?.orientation
      : "";
    event.currentTarget.removeEventListener("pointermove", orbitDragMove);
    event.currentTarget.removeEventListener("pointerup", endOrbitDrag);
    event.currentTarget.removeEventListener("pointercancel", endOrbitDrag);
    if (drag?.pointerId !== undefined) event.currentTarget.releasePointerCapture?.(drag.pointerId);
    drag = null;
    root.classList.remove("dragging");
    if (!didDrag && clickOrientation && clickOrientation !== VIEW_ORIENTATION_FREE_ID) {
      commitOrientation(clickOrientation);
      suppressNextClick = true;
    }
    if (didDrag) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (suppressNextClick) window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  }

  function applyCameraRotation({ yaw, pitch } = {}) {
    if (Number.isFinite(pitch)) {
      continuousPitch = unwrapAngle(pitch, continuousPitch);
      root.style.setProperty("--bc-nav-cube-rotate-x", `${continuousPitch}rad`);
    }
    if (Number.isFinite(yaw)) {
      continuousYaw = unwrapAngle(yaw, continuousYaw);
      root.style.setProperty("--bc-nav-cube-rotate-y", `${-continuousYaw}rad`);
    }
  }

  function clearCameraRotation() {
    continuousYaw = null;
    continuousPitch = null;
    root.style.removeProperty("--bc-nav-cube-rotate-x");
    root.style.removeProperty("--bc-nav-cube-rotate-y");
  }
}

export function normalizeViewOrientation(orientation) {
  return normalizeViewOrientationValue(orientation);
}

function normalizeNavOrientation(orientation) {
  const value = normalizeViewOrientationState(orientation);
  return VIEW_ORIENTATION_ID_SET.has(value) ? value : VIEW_ORIENTATION_FREE_ID;
}

function unwrapAngle(value, previousValue) {
  if (!Number.isFinite(previousValue)) return value;
  const fullTurn = Math.PI * 2;
  let nextValue = value;
  while (nextValue - previousValue > Math.PI) nextValue -= fullTurn;
  while (nextValue - previousValue < -Math.PI) nextValue += fullTurn;
  return nextValue;
}

function cubeFaceFromPointer(root, event) {
  if (
    !root
    || !Number.isFinite(event?.clientX)
    || !Number.isFinite(event?.clientY)
    || typeof DOMMatrixReadOnly === "undefined"
    || typeof DOMPointReadOnly === "undefined"
  ) {
    return "";
  }
  const stage = root.querySelector(".bc-nav-cube-stage");
  const model = root.querySelector(".bc-nav-cube-model");
  if (!stage || !model) return "";

  const stageRect = stage.getBoundingClientRect();
  const modelStyle = getComputedStyle(model);
  const halfSize = parseFloat(modelStyle.width) / 2;
  if (!Number.isFinite(halfSize) || halfSize <= 0) return "";

  const origin = {
    x: stageRect.left + stageRect.width / 2,
    y: stageRect.top + stageRect.height / 2
  };
  const point = { x: event.clientX, y: event.clientY };
  const modelMatrix = matrixFromTransform(modelStyle.transform);
  const hits = [];

  for (const face of root.querySelectorAll(CUBE_FACE_SELECTOR)) {
    const id = normalizeNavOrientation(face.dataset.viewOrientation);
    if (id === VIEW_ORIENTATION_FREE_ID) continue;
    const faceMatrix = matrixFromTransform(getComputedStyle(face).transform);
    const matrix = modelMatrix.multiply(faceMatrix);
    const normal = transformVector(matrix, [0, 0, 1]);
    if (normal[2] <= FACE_VISIBLE_NORMAL_EPSILON) continue;

    const polygon = [
      [-halfSize, -halfSize, 0],
      [halfSize, -halfSize, 0],
      [halfSize, halfSize, 0],
      [-halfSize, halfSize, 0]
    ].map((corner) => projectCubePoint(matrix, corner, origin));
    if (!pointInPolygon(point, polygon)) continue;

    hits.push({
      id,
      depth: polygon.reduce((sum, corner) => sum + corner.z, 0) / polygon.length
    });
  }

  hits.sort((a, b) => b.depth - a.depth);
  return hits[0]?.id || "";
}

function matrixFromTransform(transform) {
  return !transform || transform === "none"
    ? new DOMMatrixReadOnly()
    : new DOMMatrixReadOnly(transform);
}

function projectCubePoint(matrix, point, origin) {
  const transformed = new DOMPointReadOnly(point[0], point[1], point[2], 1).matrixTransform(matrix);
  return {
    x: origin.x + transformed.x,
    y: origin.y + transformed.y,
    z: transformed.z
  };
}

function transformVector(matrix, vector) {
  const origin = new DOMPointReadOnly(0, 0, 0, 1).matrixTransform(matrix);
  const transformed = new DOMPointReadOnly(vector[0], vector[1], vector[2], 1).matrixTransform(matrix);
  return [
    transformed.x - origin.x,
    transformed.y - origin.y,
    transformed.z - origin.z
  ];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if (pointOnSegment(point, a, b)) return true;
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (!crosses) continue;
    const x = (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return false;
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  if (t < 0 || t > 1) return false;
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(point.x - x, point.y - y) <= 0.75;
}
