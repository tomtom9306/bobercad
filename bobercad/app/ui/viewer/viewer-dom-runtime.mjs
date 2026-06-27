import { trimOperationIconMarkup, trimOperationLabel } from "../../rendering/trim-operation-icons.mjs";
import { labelRotation } from "../../rendering/webgl/label-rotation.mjs";

export function createViewerDomRuntime({ canvas, reset }) {
  const page = canvas.ownerDocument;
  const view = page.defaultView;
  const authoringLabelLayer = page.createElement("div");
  const calloutLayer = page.createElement("div");
  const orbitCursor = page.createElement("div");

  authoringLabelLayer.className = "authoring-label-layer";
  calloutLayer.className = "scene-callout-layer";
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

  page.body.appendChild(authoringLabelLayer);
  page.body.appendChild(calloutLayer);
  page.body.appendChild(orbitCursor);

  function setAuthoringOverlayDebugState(snapshot = {}) {
    if (!page.documentElement) return;
    page.documentElement.dataset.authoringOverlay = JSON.stringify({
      lines: snapshot.lineCount || 0,
      faces: snapshot.faceCount || 0,
      handles: snapshot.handleCount || 0,
      labels: snapshot.labelCount || 0,
      quickLists: snapshot.quickListCount || 0,
      handleKinds: snapshot.handleKinds || [],
      labelTexts: (snapshot.labels || []).map((label) => label.text),
      quickListItems: (snapshot.quickLists || []).flatMap((quickList) => quickList.items || [])
    });
  }

  function renderAuthoringLabels({
    authoringOverlay,
    hoveredHandle,
    projectOffsetPoint,
    projectPoint,
    onQuickListAction,
    onQuickListHandled
  }) {
    authoringLabelLayer.replaceChildren();
    for (const label of Array.isArray(authoringOverlay?.labels) ? authoringOverlay.labels : []) {
      if (label.draftingDimension) continue;
      const projected = projectOffsetPoint(label.point, label.screenOffsetPx);
      if (!projected) continue;
      const node = page.createElement("div");
      node.className = `authoring-label ${label.className || ""}`.trim();
      node.textContent = label.text;
      if (label.title) node.title = label.title;
      if (label.color) node.style.color = label.color;
      node.style.left = `${projected.x}px`;
      node.style.top = `${projected.y}px`;
      if (label.rotateWithLine || label.labelLine || label.labelAxis) {
        node.style.transformOrigin = "50% 50%";
        node.style.transform = `${label.transform || "translate(-50%, -50%)"} rotate(${labelRotation(label, projectPoint)}rad)`;
      } else if (label.transform) {
        node.style.transform = label.transform;
      }
      authoringLabelLayer.appendChild(node);
    }

    for (const quickList of Array.isArray(authoringOverlay?.quickLists) ? authoringOverlay.quickLists : []) {
      const projected = projectOffsetPoint(quickList.point, quickList.screenOffsetPx);
      const items = Array.isArray(quickList.items) ? quickList.items : [];
      if (!projected || !items.length) continue;
      const node = page.createElement("div");
      node.className = `authoring-quick-list ${quickList.className || ""}`.trim();
      node.style.left = `${projected.x}px`;
      node.style.top = `${projected.y}px`;
      if (quickList.title) {
        const title = page.createElement("div");
        title.className = "authoring-quick-list-title";
        title.textContent = quickList.title;
        node.appendChild(title);
      }
      const buttonRow = page.createElement("div");
      buttonRow.className = "authoring-quick-list-items";
      for (const item of items) {
        const button = page.createElement("button");
        button.type = "button";
        button.className = `authoring-quick-list-item ${item.tone || ""}${item.disabled ? " disabled" : ""}`.trim();
        button.disabled = Boolean(item.disabled);
        button.title = item.title || item.label || item.text || "";
        if (item.badge) {
          const badge = page.createElement("span");
          badge.className = "authoring-quick-list-badge";
          badge.textContent = item.badge;
          button.appendChild(badge);
        }
        const labelNode = page.createElement("span");
        labelNode.className = "authoring-quick-list-label";
        labelNode.textContent = item.label || item.text || item.id || "Action";
        button.appendChild(labelNode);
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (button.disabled) return;
          const handled = onQuickListAction?.({ quickList, item, event });
          if (handled !== false) onQuickListHandled?.();
        });
        buttonRow.appendChild(button);
      }
      node.appendChild(buttonRow);
      authoringLabelLayer.appendChild(node);
    }

    if (!hoveredHandle?.point) return;
    const projected = hoveredHandle.screen || projectOffsetPoint(hoveredHandle.point, hoveredHandle.screenOffsetPx);
    if (!projected) return;
    const node = page.createElement("div");
    const axis = hoveredHandle.axisLabel || String(hoveredHandle.axisId || "").toUpperCase();
    const space = hoveredHandle.spaceLabel ? `${hoveredHandle.spaceLabel} ` : "";
    const action = hoveredHandle.type === "rotation-ring" ? "rotate" : hoveredHandle.type === "axis" ? "move" : "edit";
    node.className = "authoring-label manipulator-hover";
    node.textContent = hoveredHandle.hoverLabel || (axis ? `${space}${axis} ${action}` : action);
    node.style.left = `${projected.x}px`;
    node.style.top = `${projected.y}px`;
    authoringLabelLayer.appendChild(node);
  }

  function renderSceneCallouts({ scene, shouldDrawSceneItem, projectPoint, onClick, interactive = true }) {
    calloutLayer.replaceChildren();
    if (!scene?.callouts?.length) return;
    for (const callout of scene.callouts) {
      if (!shouldDrawSceneItem(callout)) continue;
      const projected = projectPoint(callout.point);
      if (!projected) continue;
      const node = page.createElement("button");
      node.type = "button";
      node.className = "scene-callout trim-callout";
      if (callout.operationId) node.dataset.operationId = callout.operationId;
      node.style.left = `${projected.x}px`;
      node.style.top = `${projected.y}px`;
      if (!interactive) node.style.pointerEvents = "none";
      node.title = callout.label || trimOperationLabel(callout.iconType);
      node.innerHTML = trimOperationIconMarkup(callout.iconType, callout.colors, { class: "trim-callout-icon" });
      node.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      node.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.({
          collection: callout.collection,
          objectId: callout.objectId,
          ...(callout.operationId ? { operationId: callout.operationId } : {}),
          ...(callout.regionKey ? { regionKey: callout.regionKey } : {})
        });
      });
      calloutLayer.appendChild(node);
    }
  }

  return {
    setTimer: view.setTimeout.bind(view),
    clearTimer: view.clearTimeout.bind(view),
    viewportSize: () => ({ width: view.innerWidth, height: view.innerHeight }),
    resetAction: reset,
    setAuthoringOverlayDebugState,
    renderAuthoringLabels,
    renderSceneCallouts,
    moveOrbitCursor(x, y) {
      orbitCursor.style.left = `${x}px`;
      orbitCursor.style.top = `${y}px`;
    },
    showOrbitCursor() {
      orbitCursor.classList.add("visible");
    },
    hideOrbitCursor() {
      orbitCursor.classList.remove("visible");
    },
    isPointerLocked: () => page.pointerLockElement === canvas,
    exitPointerLock: () => page.exitPointerLock?.(),
    onPointerLockChange: (listener) => page.addEventListener("pointerlockchange", listener),
    onPointerLockError: (listener) => page.addEventListener("pointerlockerror", listener),
    onPointerMove: (listener) => page.addEventListener("pointermove", listener)
  };
}
