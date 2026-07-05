export function attachWebglViewerControls({
  canvas,
  domRuntime,
  dimensionUi,
  camera,
  state,
  canvasPointer,
  pointerStateFromEvent,
  pickAuthoringHandle,
  pickDimension,
  pickScene,
  fastClickPick,
  preciseOrbitAnchor,
  shouldUseGpuPick,
  authoringPanGesture,
  authoringHitAt,
  stopAuthoringAutoPan,
  scheduleAuthoringAutoPan,
  dimensionPlacementDelta,
  updateAuthoringHover,
  clearAuthoringHover,
  updateDimensionHover,
  clearDimensionHover,
  requestWheelZoom,
  requestDraw,
  notifyCameraChange,
  markCustomViewOrientation,
  resetView
}) {
  let orbitLockPending = false;
  const moveOrbitCursor = (x, y) => domRuntime.moveOrbitCursor(x, y);
  const showOrbitCursor = () => domRuntime.showOrbitCursor();
  const hideOrbitCursor = () => domRuntime.hideOrbitCursor();
  const requestOrbitLock = () => {
    if (domRuntime.isPointerLocked()) return;
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
  const capturePointer = (event) => {
    try {
      if (event.pointerId !== undefined && canvas.isConnected) canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be rejected after focus/control handoff; active drags still use received events.
    }
  };
  const pointerModifiers = (event) => ({
    altKey: Boolean(event.altKey),
    ctrlKey: Boolean(event.ctrlKey),
    metaKey: Boolean(event.metaKey),
    shiftKey: Boolean(event.shiftKey)
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.scene) return;
    event.preventDefault();
    const commandPointer = state.commandHandler?.active?.() && event.button === 0;
    const commandNeedsHit = state.commandHandler?.needsPointerHit?.() !== false;
    const commandNeedsPreciseHit = commandPointer && state.commandHandler?.needsPrecisePointerHit?.() === true;
    const pointer = pointerStateFromEvent(event, {
      forceCpuHit: commandNeedsPreciseHit,
      forceGpuHit: commandPointer && commandNeedsHit && !commandNeedsPreciseHit
    });
    const { x, y } = pointer.screen;
    const mode = event.button === 1 || event.button === 2 || event.shiftKey ? "pan" : "pending-orbit";
    const leftHandle = event.button === 0 && !event.shiftKey ? pickAuthoringHandle(x, y) : null;
    const contextHandle = event.button === 2 && !event.shiftKey ? pickAuthoringHandle(x, y) : null;
    const contextHandleKind = contextHandle?.kind || "";
    const contextAuthoringHandle = contextHandleKind === "plate-sketch-vertex"
      || contextHandleKind === "plate-sketch-edge";
    const handle = leftHandle || (
      contextAuthoringHandle
        ? contextHandle
        : null
    );
    if (commandPointer) {
      state.commandHandler.pointerDown?.({ event, screen: pointer.screen, hit: pointer.hit, handle });
      return;
    }
    if (event.button === 0 && !event.shiftKey) {
      const clickResult = state.authoringHandler?.click?.({
        handle,
        screen: { x, y },
        event,
        hit: pointer.hit,
        modifiers: pointerModifiers(event)
      });
      if (clickResult) {
        clearAuthoringHover();
        requestDraw();
        return;
      }
    }
    if (handle?.kind === "coordinate-space-toggle") {
      if (state.authoringHandler?.click?.({ handle, screen: { x, y } }) !== false) {
        clearAuthoringHover();
        requestDraw();
      }
      return;
    }
    if (handle) {
      const beginResult = state.authoringHandler?.beginDrag?.({
        handle,
        screen: { x, y },
        event,
        modifiers: pointerModifiers(event)
      });
      if (beginResult === false) {
        // Continue into normal scene picking/orbiting when the authoring handler explicitly declines the handle.
      } else if (handle.draggable === false || beginResult === "handled") {
        clearAuthoringHover();
        requestDraw();
        return;
      } else {
        state.authoringHoveredHandle = handle;
        state.drag = {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          mode: "authoring",
          handle,
          pointerId: event.pointerId
        };
        capturePointer(event);
        return;
      }
    }
    if (event.button === 2 && !event.shiftKey) {
      const contextResult = state.authoringHandler?.contextMenu?.({
        screen: { x, y },
        event,
        hit: pointer.hit,
        modifiers: pointerModifiers(event)
      });
      if (contextResult) {
        clearAuthoringHover();
        requestDraw();
        return;
      }
    }
    const dimension = event.button === 0 && !event.shiftKey ? pickDimension(x, y) : null;
    if (dimension) {
      state.drag = {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        mode: "dimension",
        dimension,
        moved: false,
        pointerId: event.pointerId
      };
      capturePointer(event);
      return;
    }
    if (state.pickHandler && event.button === 0 && !event.shiftKey) {
      const hitResult = pickScene(x, y, state.pickHandlerOptions);
      state.pickHandler(hitResult?.face || null);
      return;
    }
    if (mode === "pending-orbit") {
      const hitResult = fastClickPick(x, y);
      state.drag = {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        mode,
        face: hitResult?.face || null,
        hit: hitResult?.point || null,
        anchorResolved: Boolean(hitResult?.point),
        screen: { x, y },
        pointerId: event.pointerId
      };
    } else {
      state.drag = {
        x: event.clientX,
        y: event.clientY,
        mode,
        pointerId: event.pointerId
      };
    }
    if (mode === "orbit") moveOrbitCursor(event.clientX, event.clientY);
    capturePointer(event);
  });

  canvas.addEventListener("dblclick", (event) => {
    if (!state.scene || state.pickHandler || !state.doubleClickHandler || event.shiftKey) return;
    event.preventDefault();
    const { screen } = canvasPointer(event.clientX, event.clientY);
    if (pickDimension(screen.x, screen.y)) return;
    state.doubleClickHandler(pickScene(screen.x, screen.y)?.face || null);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.drag) {
      if (state.commandHandler?.active?.()) {
        const commandNeedsHit = state.commandHandler.needsPointerHit?.() !== false;
        const commandNeedsPreciseHit = state.commandHandler.needsPrecisePointerHit?.() === true;
        const pointer = pointerStateFromEvent(event, {
          includeHit: commandNeedsHit,
          forceCpuHit: commandNeedsPreciseHit,
          forceGpuHit: commandNeedsHit && !commandNeedsPreciseHit
        });
        state.commandHandler.pointerMove?.({ event, screen: pointer.screen, hit: pointer.hit });
        return;
      }
      const authoringPointer = pointerStateFromEvent(event, { includeHit: false });
      if (state.authoringHandler?.pointerMove?.({
        event,
        screen: authoringPointer.screen,
        hit: authoringPointer.hit,
        modifiers: pointerModifiers(event)
      })) {
        clearDimensionHover(event);
        requestDraw();
        return;
      }
      pointerStateFromEvent(event);
      if (updateAuthoringHover(event)) {
        clearDimensionHover(event);
        return;
      }
      clearAuthoringHover();
      updateDimensionHover(event);
      return;
    }
    clearDimensionHover(event);
    if (state.drag.mode === "dimension") {
      const totalDx = event.clientX - state.drag.startX;
      const totalDy = event.clientY - state.drag.startY;
      if (Math.hypot(totalDx, totalDy) > 2) state.drag.moved = true;
      state.dimensionPlacementHandler?.(state.drag.dimension, {
        totalDx,
        totalDy,
        offsetDelta: dimensionPlacementDelta(state.drag.dimension, totalDx, totalDy)
      });
      state.drag.x = event.clientX;
      state.drag.y = event.clientY;
      requestDraw();
      return;
    }
    if (state.drag.mode === "authoring") {
      if (authoringPanGesture(event)) {
        stopAuthoringAutoPan();
        const dx = event.clientX - state.drag.x;
        const dy = event.clientY - state.drag.y;
        camera.pan(dx, dy);
        state.drag.x = event.clientX;
        state.drag.y = event.clientY;
        state.drag.startX += dx;
        state.drag.startY += dy;
        requestDraw();
        return;
      }
      const { rect, screen } = canvasPointer(event.clientX, event.clientY);
      const hit = state.authoringHandler?.needsDragHit?.({ handle: state.drag.handle, event }) === false
        ? null
        : authoringHitAt(screen, rect);
      state.authoringHandler?.drag?.({
        handle: state.drag.handle,
        event,
        modifiers: {
          altKey: Boolean(event.altKey),
          ctrlKey: Boolean(event.ctrlKey),
          metaKey: Boolean(event.metaKey),
          shiftKey: Boolean(event.shiftKey)
        },
        dx: event.clientX - state.drag.x,
        dy: event.clientY - state.drag.y,
        totalDx: event.clientX - state.drag.startX,
        totalDy: event.clientY - state.drag.startY,
        screen,
        hit
      });
      state.drag.x = event.clientX;
      state.drag.y = event.clientY;
      scheduleAuthoringAutoPan();
      requestDraw();
      return;
    }
    if (state.drag.mode === "pending-orbit") {
      const totalDx = event.clientX - state.drag.startX;
      const totalDy = event.clientY - state.drag.startY;
      if (Math.hypot(totalDx, totalDy) < 4) return;
      if (!state.drag.anchorResolved) {
        const anchor = preciseOrbitAnchor(state.drag.screen.x, state.drag.screen.y, state.drag.face);
        state.drag.hit = anchor?.point || null;
        state.drag.anchorResolved = true;
      }
      if (state.drag.hit) camera.setOrbitPivot(state.drag.hit, state.scene, canvas, state.drag.screen);
      state.drag.mode = "orbit";
      moveOrbitCursor(event.clientX, event.clientY);
      requestOrbitLock();
    }
    const lockedOrbit = state.drag.mode === "orbit" && domRuntime.isPointerLocked();
    const dx = lockedOrbit ? event.movementX : event.clientX - state.drag.x;
    const dy = lockedOrbit ? event.movementY : event.clientY - state.drag.y;
    if (state.drag.mode === "pan") {
      camera.pan(dx, dy);
    } else {
      camera.orbit(dx, dy);
      markCustomViewOrientation();
      notifyCameraChange("orbit");
    }
    state.drag.x = event.clientX;
    state.drag.y = event.clientY;
    requestDraw();
  });

  const endDrag = (eventOrOptions = {}) => {
    const options = eventOrOptions?.type ? {} : eventOrOptions;
    const currentDrag = state.drag;
    const pointerId = currentDrag?.pointerId;
    const lockedOrbit = currentDrag?.mode === "orbit" && domRuntime.isPointerLocked();
    if (currentDrag?.mode === "authoring") {
      stopAuthoringAutoPan();
      const cancel = eventOrOptions?.type === "pointercancel" || eventOrOptions?.type === "lostpointercapture";
      (cancel ? state.authoringHandler?.cancel : state.authoringHandler?.end)?.({ handle: currentDrag.handle });
    }
    if (currentDrag?.mode === "dimension" && eventOrOptions?.type === "pointerup" && !currentDrag.moved) {
      dimensionUi.clickDimension(currentDrag.dimension);
    }
    if (currentDrag?.mode === "pending-orbit" && eventOrOptions?.type === "pointerup" && state.clickHandler) {
      const regionHit = pickScene(currentDrag.screen.x, currentDrag.screen.y, {
        forceCpu: true,
        includeInstances: false,
        componentKind: "trim-region"
      });
      if (regionHit?.face) {
        state.clickHandler({ ...regionHit.face, ...(regionHit.point ? { hitPoint: regionHit.point } : {}) });
      } else if (currentDrag.face) {
        const preciseClick = currentDrag.hit ? null : pickScene(currentDrag.screen.x, currentDrag.screen.y, {
          forceCpu: true,
          includeTransparent: false,
          objectIds: [currentDrag.face.objectId]
        });
        const hitPoint = currentDrag.hit || preciseClick?.point || null;
        state.clickHandler({ ...(preciseClick?.face || currentDrag.face), ...(hitPoint ? { hitPoint } : {}) });
      } else if (shouldUseGpuPick()) {
        state.clickHandler(null);
      } else {
        const { screen } = canvasPointer(eventOrOptions.clientX, eventOrOptions.clientY);
        const hit = pickScene(screen.x, screen.y);
        state.clickHandler(hit?.face ? { ...hit.face, ...(hit.point ? { hitPoint: hit.point } : {}) } : null);
      }
    }
    state.drag = null;
    hideOrbitCursor();
    if (pointerId !== undefined && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    if ((options.exitPointerLock ?? true) && lockedOrbit) domRuntime.exitPointerLock();
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("lostpointercapture", () => {
    if (state.drag?.mode === "orbit" && (orbitLockPending || domRuntime.isPointerLocked())) return;
    endDrag();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  domRuntime.onPointerLockChange(() => {
    orbitLockPending = false;
    if (domRuntime.isPointerLocked() && state.drag?.mode === "orbit") {
      showOrbitCursor();
      return;
    }
    hideOrbitCursor();
    if (!domRuntime.isPointerLocked() && state.drag?.mode === "orbit") endDrag({ exitPointerLock: false });
  });
  domRuntime.onPointerLockError(() => {
    orbitLockPending = false;
    hideOrbitCursor();
  });
  domRuntime.onPointerMove((event) => {
    if (event.target === canvas || dimensionUi.contains(event.target)) return;
    clearDimensionHover(event);
    clearAuthoringHover();
  });
  canvas.addEventListener("wheel", (event) => {
    if (!state.scene) return;
    event.preventDefault();
    requestWheelZoom(event.deltaY, event.clientX, event.clientY);
  }, { passive: false });
  domRuntime.resetAction?.addEventListener("click", () => resetView());
}
