import { clamp, finiteNumber, finiteNumberOr, screenDistance, v } from "../../engine/core/math.mjs";
import { arrayValues, sameIdSet } from "../../engine/core/model.mjs";
import { createCamera } from "./camera.mjs";
import { createWebglPicker } from "./webgl-picker.mjs";
import { memberOnlyHighlightChange as isMemberOnlyHighlightChange } from "./webgl-highlight-policy.mjs";
import { cameraAnglesForOrientation, cameraStateFor, cloneSceneItem, cloneScenePoint, normalizeDisplayMode } from "./webgl-view-state.mjs";
import { createWebglObjectPreviewController } from "./webgl-object-preview.mjs";
import { createWebglPickColorState } from "./webgl-pick-color-state.mjs";
import { createWebglRenderOrchestrator } from "./webgl-render-orchestrator.mjs";
import { attachWebglViewerControls } from "./webgl-viewer-controls.mjs";
import { isActiveSmartComponentObject } from "../scene/scene-object-visibility.mjs";
export function createWebglViewer(canvas, reset, settings, options = {}) {
  const domRuntime = options.domRuntime;
  const createDimensionOverlayUi = options.dimensionOverlayFactory;
  if (!domRuntime || typeof createDimensionOverlayUi !== "function") {
    throw new Error("createWebglViewer requires UI-owned domRuntime and dimensionOverlayFactory ports");
  }
  const WORLD_ORIGIN = Object.freeze([0, 0, 0]);
  const qaCapture = !!options.qaCapture;
  const gl = canvas.getContext("webgl", { antialias: true, preserveDrawingBuffer: qaCapture });
  const currentPointerMaxAgeMs = Math.max(0, finiteNumberOr(settings.authoring?.currentPointerMaxAgeMs, 15000));
  let scene = null;
  const camera = createCamera(settings);
  let drag = null;
  let authoringAutoPanFrame = null;
  let pickHandler = null;
  let pickHandlerOptions = {};
  let clickHandler = null;
  let doubleClickHandler = null;
  let authoringHandler = null;
  let commandHandler = null;
  let detailScaleChangeHandler = null;
  let cameraChangeHandler = null;
  let detailScaleChangeTimer = null;
  let wheelZoomFramePending = false;
  let pendingWheelZoom = null;
  let authoringOverlay = { lines: [], handles: [] };
  let authoringHoveredHandle = null;
  let lastCanvasPointer = null;
  let dimensionOverlay = { lines: [], labels: [] };
  let dimensionPlacementHandler = null;
  let authoringPreviewScene = null;
  let frameDrawPending = false;
  let displayMode = normalizeDisplayMode(settings.render?.displayMode);
  let viewOrientation = "iso";
  let pickerApi = null;
  let renderRuntime = null;
  const pickColors = createWebglPickColorState();
  function invalidateScenePickCache() {
    pickerApi?.invalidateScenePickCache();
  }
  function invalidateMemberInstanceLookup() {
    pickerApi?.invalidateMemberInstanceLookup();
  }
  function invalidateStaticSceneCache() {
    renderRuntime?.invalidateStaticSceneCache();
  }
  function invalidateMemberInstanceCache() {
    renderRuntime?.invalidateMemberInstanceCache();
  }
  function invalidateRenderableCaches() {
    renderRuntime?.invalidateRenderableCaches();
  }
  function draw() {
    renderRuntime?.draw();
  }
  function pickSceneGpu(...args) {
    return renderRuntime?.pickSceneGpu(...args) || null;
  }
  function hitTestDimensionLabel(x, y) {
    return renderRuntime?.hitTestDimensionLabel(x, y) || null;
  }
  function requestDraw() {
    if (frameDrawPending) return;
    frameDrawPending = true;
    requestAnimationFrame(() => {
      frameDrawPending = false;
      draw();
    });
  }
  function notifyDetailScaleChange() {
    if (!detailScaleChangeHandler) return;
    detailScaleChangeHandler(camera.screenScale());
  }
  function clearPendingDetailScaleChange() {
    if (!detailScaleChangeTimer) return;
    domRuntime.clearTimer(detailScaleChangeTimer);
    detailScaleChangeTimer = null;
  }
  function scheduleDetailScaleChange(delayMs = 0) {
    clearPendingDetailScaleChange();
    if (!detailScaleChangeHandler) return;
    if (delayMs <= 0) {
      notifyDetailScaleChange();
      return;
    }
    detailScaleChangeTimer = domRuntime.setTimer(() => {
      detailScaleChangeTimer = null;
      if (drag) {
        scheduleDetailScaleChange(delayMs);
        return;
      }
      notifyDetailScaleChange();
    }, delayMs);
  }
  function requestWheelZoom(deltaY, x, y) {
    const direction = Math.sign(deltaY) || 1;
    if (!pendingWheelZoom || Math.sign(pendingWheelZoom.deltaY) !== direction) {
      pendingWheelZoom = { deltaY: direction, x, y, steps: 1 };
    } else {
      pendingWheelZoom.deltaY += direction;
      pendingWheelZoom.x = x;
      pendingWheelZoom.y = y;
      pendingWheelZoom.steps += 1;
    }
    if (wheelZoomFramePending) return;
    wheelZoomFramePending = true;
    requestAnimationFrame(() => {
      wheelZoomFramePending = false;
      const zoom = pendingWheelZoom;
      pendingWheelZoom = null;
      if (!scene || !zoom) return;
      const steps = clamp(zoom.steps, 1, 12);
      for (let index = 0; index < steps; index += 1) {
        camera.zoomAt(zoom.deltaY, zoom.x, zoom.y, canvas);
      }
      scheduleDetailScaleChange(900);
      draw();
    });
  }
  const dimensionUi = createDimensionOverlayUi({
    canvas,
    settings,
    projectPoint,
    screenScale: () => camera.screenScale(),
    requestDraw
  });
  let highlightedObjectIds = new Set();
  const detailPixelThreshold = finiteNumber(settings.render.lod?.detailPixelThreshold)
    ? settings.render.lod.detailPixelThreshold
    : 24;
  const objectPreviewController = createWebglObjectPreviewController({
    getScene: () => scene,
    invalidateRenderableCaches,
    invalidateMemberInstanceLookup,
    invalidateScenePickCache,
    requestDraw
  });
  pickerApi = createWebglPicker({
    canvas,
    camera,
    getScene: () => scene,
    lodDetailVisible,
    shouldDrawSceneItem,
    shouldUseGpuPick,
    pickSceneGpu,
    hasWebgl: () => Boolean(gl)
  });
  const {
    pickScene,
    fastClickPick,
    preciseOrbitAnchor,
    pickCursorDepth,
    snapVisibilityAt
  } = pickerApi;
  renderRuntime = createWebglRenderOrchestrator({
    gl,
    canvas,
    settings,
    camera,
    getScene: () => scene,
    getDisplayMode: () => displayMode,
    getHighlightedObjectIds: () => highlightedObjectIds,
    getAuthoringOverlay: () => authoringOverlay,
    getAuthoringHoveredHandle: () => authoringHoveredHandle,
    getDimensionOverlay: () => dimensionOverlay,
    getAuthoringPreviewScene: () => authoringPreviewScene,
    objectPreview: objectPreviewController,
    dimensionUi,
    pickColorForItem: pickColors.colorForItem,
    pickObjectFromPixel: pickColors.objectFromPixel,
    invalidateScenePickCache,
    shouldDrawSceneItem,
    lodDetailVisible,
    useHighlightOverlay,
    projectPoint,
    projectOffsetPoint,
    isAuthoringHovered,
    axisHandleSegment,
    projectedRotationArc,
    renderAuthoringLabels,
    renderSceneCallouts
  });
  function lodDetailVisible(objectId) {
    if (!objectId) return true;
    const detail = scene?.lodDetails?.[objectId];
    if (!detail) return false;
    if (isActiveSmartComponentObject(scene, objectId) || highlightedObjectIds.has(objectId)) return true;
    return detail.radius * camera.screenScale() >= detailPixelThreshold;
  }
  function isObjectPreviewed(item) {
    return objectPreviewController.isPreviewed(item);
  }
  function shouldDrawSceneItem(item) {
    if (isObjectPreviewed(item)) return false;
    return !item?.lodDetailObjectId || lodDetailVisible(item.lodDetailObjectId);
  }
  function shouldUseGpuPick() {
    return (scene?.faces?.length || 0) + (scene?.memberInstances?.length || 0) > 25000;
  }
  function useHighlightOverlay() {
    return highlightedObjectIds.size > 0;
  }
  function cameraState(reason = "camera") {
    return cameraStateFor(camera, viewOrientation, reason);
  }
  function notifyCameraChange(reason = "camera") {
    cameraChangeHandler?.(cameraState(reason));
  }
  function canvasPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const screen = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    return {
      rect,
      screen,
      inside: screen.x >= 0 && screen.y >= 0 && screen.x <= rect.width && screen.y <= rect.height
    };
  }
  function authoringPointerState() {
    if (!drag || drag.mode !== "authoring") return null;
    const { rect, screen } = canvasPointer(drag.x, drag.y);
    return { rect, screen };
  }
  function authoringEdgePan(screen, rect) {
    const margin = settings.authoring?.autoPanEdgePx || 72;
    const maxStep = settings.authoring?.autoPanMaxStepPx || 18;
    const edgeStep = (distance) => {
      const t = clamp((margin - distance) / margin, 0, 1);
      return maxStep * t * t;
    };
    const dx = screen.x < margin
      ? edgeStep(screen.x)
      : screen.x > rect.width - margin ? -edgeStep(rect.width - screen.x) : 0;
    const dy = screen.y < margin
      ? edgeStep(screen.y)
      : screen.y > rect.height - margin ? -edgeStep(rect.height - screen.y) : 0;
    return Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 ? { dx, dy } : null;
  }
  function authoringHitAt(screen, rect) {
    if (screen.x < 0 || screen.y < 0 || screen.x > rect.width || screen.y > rect.height) return null;
    return pickCursorDepth(screen.x, screen.y);
  }
  function pointerStateFromEvent(event, options = {}) {
    const { rect, screen, inside } = canvasPointer(event.clientX, event.clientY);
    if (inside) lastCanvasPointer = { screen, time: Date.now() };
    const includeHit = options.includeHit !== false;
    const forceCpu = options.forceCpuHit === true;
    return {
      rect,
      screen,
      hit: inside && includeHit
        ? pickCursorDepth(screen.x, screen.y, { forceGpu: !forceCpu && options.forceGpuHit === true })
        : null
    };
  }
  function currentPointerState() {
    if (!scene || !lastCanvasPointer?.screen) return null;
    if (currentPointerMaxAgeMs > 0 && Date.now() - (lastCanvasPointer.time || 0) > currentPointerMaxAgeMs) return null;
    const rect = canvas.getBoundingClientRect();
    const screen = { ...lastCanvasPointer.screen };
    if (screen.x < 0 || screen.y < 0 || screen.x > rect.width || screen.y > rect.height) return null;
    return {
      screen,
      hit: pickCursorDepth(screen.x, screen.y)
    };
  }
  function stopAuthoringAutoPan() {
    if (authoringAutoPanFrame === null) return;
    cancelAnimationFrame(authoringAutoPanFrame);
    authoringAutoPanFrame = null;
  }
  function scheduleAuthoringAutoPan() {
    if (authoringAutoPanFrame !== null) return;
    authoringAutoPanFrame = requestAnimationFrame(() => {
      authoringAutoPanFrame = null;
      const state = authoringPointerState();
      if (!state) return;
      const pan = authoringEdgePan(state.screen, state.rect);
      if (!pan) return;
      camera.pan(pan.dx, pan.dy);
      authoringHandler?.drag?.({
        handle: drag.handle,
        dx: 0,
        dy: 0,
        totalDx: drag.x - drag.startX,
        totalDy: drag.y - drag.startY,
        screen: state.screen,
        hit: authoringHandler?.needsDragHit?.({ handle: drag.handle }) === false
          ? null
          : authoringHitAt(state.screen, state.rect),
        autoPan: true
      });
      requestDraw();
      scheduleAuthoringAutoPan();
    });
  }
  function authoringPanGesture(event) {
    return Boolean(event.shiftKey || (event.buttons & 2) || (event.buttons & 4));
  }
  function projectPoint(point) {
    return scene ? camera.projectPoint(point, scene, canvas) : null;
  }
  function pointInCaptureRange(point, options = {}) {
    if (!v.isVec3(options.center) || !finiteNumber(options.radius)) return true;
    return v.len(v.sub(point, options.center)) <= options.radius;
  }
  function captureItemPoints(item, options = {}) {
    const itemPoints = arrayValues(item.points);
    const points = itemPoints.length || Array.isArray(item.points)
      ? itemPoints
      : (item.start && item.axisX && item.length ? [item.start, v.add(item.start, v.mul(item.axisX, item.length))] : []);
    if (!points.length) return [];
    if (!options.clipMembers || item.collection !== "members") return points;
    const filtered = points.filter((point) => pointInCaptureRange(point, options));
    return filtered.length ? points : [];
  }
  function objectPoints(objectIds = [], options = {}) {
    if (!scene) return [];
    const ids = new Set(objectIds);
    const points = [];
    for (const item of [...arrayValues(scene.faces), ...arrayValues(scene.lines), ...arrayValues(scene.memberInstances)]) {
      if (isObjectPreviewed(item)) continue;
      if (!ids.has(item.objectId)) continue;
      points.push(...captureItemPoints(item, options));
    }
    if (objectPreviewController.get()) {
      for (const item of objectPreviewController.captureItems()) {
        if (!ids.has(item.objectId)) continue;
        points.push(...captureItemPoints(item, options));
      }
    }
    return points;
  }
  function evaluatedSnapEdges(options = {}) {
    if (!scene) return [];
    const ids = new Set(arrayValues(options.objectIds).map(String).filter(Boolean));
    return arrayValues(scene.lines)
      .filter((line) => line.snapRole === "member-evaluated-edge")
      .filter((line) => !ids.size || ids.has(line.objectId))
      .filter((line) => !isObjectPreviewed(line) && shouldDrawSceneItem(line))
      .map(cloneSceneItem);
  }
  function authoringOverlaySnapshot() {
    return {
      faceCount: arrayValues(authoringOverlay?.faces).length,
      lineCount: arrayValues(authoringOverlay?.lines).length,
      handleCount: arrayValues(authoringOverlay?.handles).length,
      labelCount: arrayValues(authoringOverlay?.labels).length,
      quickListCount: arrayValues(authoringOverlay?.quickLists).length,
      labels: arrayValues(authoringOverlay?.labels).map((label) => ({
        text: label.text || "",
        className: label.className || "",
        title: label.title || "",
        point: cloneScenePoint(label.point),
        screenOffsetPx: label.screenOffsetPx ? { ...label.screenOffsetPx } : null
      })),
      handleKinds: arrayValues(authoringOverlay?.handles).map((handle) => handle.kind || handle.type || ""),
      lines: arrayValues(authoringOverlay?.lines).map((line) => ({
        kind: line.kind || "",
        objectId: line.objectId || "",
        edgeId: line.edgeId || "",
        parentBendId: line.parentBendId || "",
        parentEdge: line.parentEdge || "",
        points: arrayValues(line.points).map(cloneScenePoint)
      })),
      handles: arrayValues(authoringOverlay?.handles).map((handle) => {
        const screen = projectOffsetPoint(handle.point, handle.screenOffsetPx);
        return {
          kind: handle.kind || "",
          type: handle.type || "",
          target: handle.target || "",
          objectId: handle.objectId || "",
          plateId: handle.plateId || "",
          vertexId: handle.vertexId || "",
          edgeId: handle.edgeId || "",
          cornerReliefId: handle.cornerReliefId || "",
          cornerReliefVertexId: handle.cornerReliefVertexId || "",
          point: cloneScenePoint(handle.point),
          screen: screen ? { ...screen } : null,
          screenOffsetPx: handle.screenOffsetPx ? { ...handle.screenOffsetPx } : null
        };
      }),
      quickLists: arrayValues(authoringOverlay?.quickLists).map((quickList) => ({
        id: quickList.id || "",
        title: quickList.title || "",
        items: arrayValues(quickList.items).map((item) => item.label || item.text || item.id || "")
      }))
    };
  }
  function authoringHandleAtClientPoint(clientX, clientY) {
    const { screen, inside } = canvasPointer(clientX, clientY);
    const handle = inside ? pickAuthoringHandle(screen.x, screen.y) : null;
    if (!handle) return { screen, inside, handle: null };
    return {
      screen,
      inside,
      handle: {
        kind: handle.kind || "",
        type: handle.type || "",
        target: handle.target || "",
        objectId: handle.objectId || "",
        plateId: handle.plateId || "",
        edgeId: handle.edgeId || "",
        vertexId: handle.vertexId || "",
        relationId: handle.relationId || "",
        displayOnlySamplePointCount: Array.isArray(handle.displayOnlySamplePoints) ? handle.displayOnlySamplePoints.length : 0,
        distance: Number.isFinite(handle.distance) ? handle.distance : null,
        pickScore: Number.isFinite(handle.pickScore) ? handle.pickScore : null,
        screen: handle.screen ? { ...handle.screen } : null
      }
    };
  }
  function updateAuthoringOverlayDebugState() {
    domRuntime.setAuthoringOverlayDebugState(authoringOverlaySnapshot());
  }
  function hasDimensionOverlay() {
    return Boolean(arrayValues(dimensionOverlay.lines).length || arrayValues(dimensionOverlay.labels).length);
  }
  function fallbackAxisScreen(axisId) {
    if (axisId === "z") return { x: 0, y: -1 };
    if (axisId === "y") return { x: 0.62, y: -0.78 };
    return { x: 1, y: 0 };
  }
  function projectedAxisHandle(handle) {
    const origin = projectPoint(handle.point);
    if (!origin) return null;
    const axis = v.norm(handle.axis || [1, 0, 0]);
    const probe = Math.max(10, 42 / Math.max(camera.screenScale(), 1e-9));
    const projectedEnd = projectPoint(v.add(handle.point, v.mul(axis, probe)));
    let dx = projectedEnd ? projectedEnd.x - origin.x : 0;
    let dy = projectedEnd ? projectedEnd.y - origin.y : 0;
    let length = Math.hypot(dx, dy);
    let scalePxPerWorld = length > 1e-6 ? length / probe : camera.screenScale();
    if (length <= 1e-6) {
      const fallback = fallbackAxisScreen(handle.axisId);
      dx = fallback.x;
      dy = fallback.y;
      length = 1;
      scalePxPerWorld = camera.screenScale();
    }
    return {
      origin,
      unit: { x: dx / length, y: dy / length },
      scalePxPerWorld
    };
  }
  function projectedDragAxes(handle) {
    if (!handle?.dragAxes) return null;
    const xAxis = projectedAxisHandle({ point: handle.point, axis: handle.dragAxes.x, axisId: "x" });
    const yAxis = projectedAxisHandle({ point: handle.point, axis: handle.dragAxes.y, axisId: "y" });
    if (!xAxis || !yAxis) return null;
    return {
      x: { unit: xAxis.unit, scalePxPerWorld: xAxis.scalePxPerWorld },
      y: { unit: yAxis.unit, scalePxPerWorld: yAxis.scalePxPerWorld }
    };
  }
  function axisHandleSegment(handle) {
    const projected = projectedAxisHandle(handle);
    if (!projected) return null;
    const length = handle.axisLengthPx || 58;
    const offset = handle.axisStartOffsetPx || 0;
    return {
      ...projected,
      start: {
        x: projected.origin.x + projected.unit.x * offset,
        y: projected.origin.y + projected.unit.y * offset
      },
      end: {
        x: projected.origin.x + projected.unit.x * length,
        y: projected.origin.y + projected.unit.y * length
      }
    };
  }
  function rotationPlaneBasis(axis) {
    const normal = v.norm(axis || [0, 0, 1]);
    let seed = Math.abs(v.dot(normal, [0, 0, 1])) > 0.92 ? [0, 1, 0] : [0, 0, 1];
    let u = v.cross(normal, seed);
    if (v.len(u) <= 1e-6) {
      seed = [1, 0, 0];
      u = v.cross(normal, seed);
    }
    u = v.norm(u);
    return {
      u,
      w: v.norm(v.cross(normal, u))
    };
  }
  function rotationArcAngles(handle) {
    const axisOffset = handle.axisId === "x" ? -0.55 : handle.axisId === "y" ? 0.2 : 0.95;
    const arc = Math.PI * 1.55;
    return { startAngle: axisOffset, endAngle: axisOffset + arc, arc };
  }
  function rotationHandleCenter(handle) {
    const projected = projectedAxisHandle(handle);
    if (!projected) return null;
    const axis = v.norm(handle.axis || [1, 0, 0]);
    const axisLength = handle.axisLengthPx || 58;
    const axisStartOffset = handle.axisStartOffsetPx || 0;
    const centerOffsetPx = handle.ringCenterOffsetPx ?? (axisStartOffset + axisLength) / 2;
    const centerPoint = v.add(handle.point, v.mul(axis, centerOffsetPx / Math.max(projected.scalePxPerWorld, 1e-9)));
    const screen = projectPoint(centerPoint);
    return screen ? { point: centerPoint, screen } : null;
  }
  function projectedRotationArc(handle, segments = 36) {
    const center = rotationHandleCenter(handle);
    if (!center) return null;
    const basis = rotationPlaneBasis(handle.axis);
    const radiusWorld = (handle.radiusPx || 40) / Math.max(camera.screenScale(), 1e-9);
    const { startAngle, arc } = rotationArcAngles(handle);
    const points = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = startAngle + index / segments * arc;
      const world = v.add(
        center.point,
        v.add(v.mul(basis.u, Math.cos(angle) * radiusWorld), v.mul(basis.w, Math.sin(angle) * radiusWorld))
      );
      const screen = projectPoint(world);
      if (screen) points.push(screen);
    }
    return points.length >= 2 ? { center: center.screen, points } : null;
  }
  function screenPolylineDistance(point, points) {
    return screenPolylineClosest(point, points).distance;
  }
  function screenPolylineClosest(point, points) {
    let best = Infinity;
    let screen = null;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const t = screenLineParameter(point, start, end);
      const candidate = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      };
      const distance = screenDistance(point, candidate);
      if (distance < best) {
        best = distance;
        screen = candidate;
      }
    }
    return { distance: best, screen };
  }
  function screenPointNearAny(point, points, tolerancePx) {
    if (!Array.isArray(points) || points.length === 0 || !(tolerancePx > 0)) return false;
    return points.some((candidate) => screenDistance(point, candidate) <= tolerancePx);
  }
  function authoringHandleKey(handle) {
    if (!handle) return "";
    return [
      handle.type || "point",
      handle.kind || "",
      handle.memberId || "",
      handle.objectId || "",
      handle.referencePlaneId || "",
      handle.corner || "",
      handle.target || "",
      handle.axisId || "",
      handle.coordinateSpace || ""
    ].join(":");
  }
  function isAuthoringHovered(handle) {
    return authoringHandleKey(handle) === authoringHandleKey(authoringHoveredHandle);
  }
  function updateAuthoringHover(event) {
    if (!scene || drag) return false;
    const { screen, inside } = canvasPointer(event.clientX, event.clientY);
    const next = inside
      ? pickAuthoringHandle(screen.x, screen.y)
      : null;
    if (authoringHandleKey(next) === authoringHandleKey(authoringHoveredHandle)) return Boolean(next);
    authoringHoveredHandle = next;
    canvas.classList.toggle("authoring-hover", Boolean(next));
    requestDraw();
    return Boolean(next);
  }
  function clearAuthoringHover() {
    if (!authoringHoveredHandle) return;
    authoringHoveredHandle = null;
    canvas.classList.remove("authoring-hover");
    requestDraw();
  }
  function pickAuthoringHandle(x, y) {
    if (!scene || !authoringOverlay?.handles?.length) return null;
    const cursor = { x, y };
    let best = null;
    for (const handle of authoringOverlay.handles) {
      if (handle.type === "axis") {
        const segment = axisHandleSegment(handle);
        if (!segment) continue;
        const distance = screenLineDistance(cursor, segment.start, segment.end);
        if (distance > (handle.hitTolerancePx || 10)) continue;
        if (!best || distance < best.distance) {
          best = {
            ...handle,
            distance,
            screen: segment.start,
            axisScreen: segment.unit,
            screenScalePxPerWorld: segment.scalePxPerWorld
          };
        }
        continue;
      }
      if (handle.type === "rotation-ring") {
        const arc = projectedRotationArc(handle);
        if (!arc) continue;
        const distance = screenPolylineDistance(cursor, arc.points);
        if (distance > (handle.hitTolerancePx || 10)) continue;
        if (!best || distance < best.distance) best = { ...handle, distance, screen: arc.center };
        continue;
      }
      if ((handle.kind === "plate-sketch-edge" || handle.kind === "plate-sketch-construction-edge") && Array.isArray(handle.points) && handle.points.length >= 2) {
        const projectedPoints = handle.points.map((point) => projectPoint(point)).filter(Boolean);
        if (projectedPoints.length < 2) continue;
        const displayOnlyTolerance = Number.isFinite(handle.displayOnlySampleHitTolerancePx)
          ? handle.displayOnlySampleHitTolerancePx
          : 0;
        if (displayOnlyTolerance > 0 && Array.isArray(handle.displayOnlySamplePoints) && handle.displayOnlySamplePoints.length) {
          const projectedDisplayOnlyPoints = handle.displayOnlySamplePoints.map((point) => projectPoint(point)).filter(Boolean);
          if (screenPointNearAny(cursor, projectedDisplayOnlyPoints, displayOnlyTolerance)) continue;
        }
        const closest = screenPolylineClosest(cursor, projectedPoints);
        const distance = closest.distance;
        if (distance > (handle.hitTolerancePx || 12)) continue;
        const pickPriority = Number.isFinite(handle.pickPriority) ? handle.pickPriority : 8;
        const pickScore = distance - pickPriority;
        if (!best || pickScore < best.pickScore) {
          const dragAxes = projectedDragAxes(handle);
          best = { ...handle, distance, pickScore, screen: closest.screen, ...(dragAxes ? { dragAxesScreen: dragAxes } : {}) };
        }
        continue;
      }
      const projected = projectOffsetPoint(handle.point, handle.screenOffsetPx);
      if (!projected) continue;
      const distance = screenDistance(projected, cursor);
      if (distance > (handle.hitTolerancePx || handle.radius || 10)) continue;
      const pickPriority = Number.isFinite(handle.pickPriority) ? handle.pickPriority : 0;
      const pickScore = distance - pickPriority;
      if (!best || pickScore < best.pickScore) {
        const dragAxes = projectedDragAxes(handle);
        best = { ...handle, distance, pickScore, screen: projected, ...(dragAxes ? { dragAxesScreen: dragAxes } : {}) };
      }
    }
    return best;
  }
  function screenLineParameter(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby;
    return lengthSq <= 0.000001
      ? 0
      : clamp(((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq, 0, 1);
  }
  function screenLineDistance(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const t = screenLineParameter(point, a, b);
    return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
  }
  function pickDimension(x, y) {
    if (!scene || !dimensionUi.hasClickHandler()) return null;
    if (!hasDimensionOverlay()) return null;
    const labelHit = hitTestDimensionLabel(x, y);
    if (labelHit?.smartComponentId) return labelHit;
    const cursor = { x, y };
    let best = null;
    for (const line of arrayValues(dimensionOverlay.lines)) {
      const a = projectPoint(line.points[0]);
      const b = projectPoint(line.points[1]);
      if (!a || !b) continue;
      const distance = screenLineDistance(cursor, a, b);
      if (distance > 8) continue;
      if (!best || distance < best.distance) best = { ...line, distance };
    }
    return best;
  }
  function dimensionPlacementDelta(dimension, totalDx, totalDy) {
    if (!Array.isArray(dimension?.labelUpAxis)) return 0;
    const anchor = Array.isArray(dimension.point)
      ? dimension.point
      : Array.isArray(dimension.dimensionStart) && Array.isArray(dimension.dimensionEnd)
        ? v.mul(v.add(dimension.dimensionStart, dimension.dimensionEnd), 0.5)
        : Array.isArray(dimension.points?.[0]) && Array.isArray(dimension.points?.[1])
          ? v.mul(v.add(dimension.points[0], dimension.points[1]), 0.5)
          : null;
    if (!anchor) return 0;
    const origin = projectPoint(anchor);
    const axisPoint = projectPoint(v.add(anchor, v.norm(dimension.labelUpAxis)));
    if (!origin || !axisPoint) return 0;
    const axis = { x: axisPoint.x - origin.x, y: axisPoint.y - origin.y };
    const scale = Math.hypot(axis.x, axis.y);
    if (scale <= 1e-6) return 0;
    const unit = { x: axis.x / scale, y: axis.y / scale };
    return (totalDx * unit.x + totalDy * unit.y) / scale;
  }
  function clearDimensionHover(event) {
    dimensionUi.setHoveredDimensionId(null, event);
  }
  function updateDimensionHover(event) {
    if (!scene || drag) return;
    if (!hasDimensionOverlay()) return clearDimensionHover(event);
    const { screen, inside } = canvasPointer(event.clientX, event.clientY);
    if (!inside) return clearDimensionHover(event);
    dimensionUi.setHoveredDimensionId(pickDimension(screen.x, screen.y)?.dimensionId || null, event);
  }
  function renderAuthoringLabels() {
    domRuntime.renderAuthoringLabels({
      authoringOverlay,
      hoveredHandle: authoringHoveredHandle,
      projectOffsetPoint,
      projectPoint,
      onQuickListAction: ({ quickList, item, event }) => authoringHandler?.quickListAction?.({ quickList, item, event }),
      onQuickListHandled: () => {
        authoringHoveredHandle = null;
        canvas.classList.remove("authoring-hover");
        requestDraw();
      }
    });
  }
  function renderSceneCallouts() {
    domRuntime.renderSceneCallouts({
      scene,
      shouldDrawSceneItem,
      projectPoint,
      onClick: (hit) => clickHandler?.(hit)
    });
  }
  function projectOffsetPoint(point, offset = null) {
    const projected = projectPoint(point);
    if (!projected) return null;
    return {
      x: projected.x + (offset?.x || 0),
      y: projected.y + (offset?.y || 0)
    };
  }
  function resizeCanvas() {
    const size = domRuntime.viewportSize();
    canvas.width = size.width;
    canvas.height = size.height;
  }
  function resize() {
    resizeCanvas();
    draw();
  }
  function resetView() {
    if (!scene) return false;
    camera.reset();
    camera.fit(scene, canvas);
    viewOrientation = "iso";
    invalidateRenderableCaches();
    scheduleDetailScaleChange();
    notifyCameraChange("reset");
    draw();
    return true;
  }
  const controlState = {
    get scene() {
      return scene;
    },
    get drag() {
      return drag;
    },
    set drag(value) {
      drag = value;
    },
    get pickHandler() {
      return pickHandler;
    },
    get pickHandlerOptions() {
      return pickHandlerOptions;
    },
    get clickHandler() {
      return clickHandler;
    },
    get doubleClickHandler() {
      return doubleClickHandler;
    },
    get authoringHandler() {
      return authoringHandler;
    },
    get commandHandler() {
      return commandHandler;
    },
    get dimensionPlacementHandler() {
      return dimensionPlacementHandler;
    },
    set authoringHoveredHandle(value) {
      authoringHoveredHandle = value;
    }
  };
  attachWebglViewerControls({
    canvas,
    domRuntime,
    dimensionUi,
    camera,
    state: controlState,
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
    markCustomViewOrientation: () => {
      viewOrientation = "custom";
    },
    resetView
  });
  return {
    setScene(nextScene, options = {}) {
      const preserveCamera = options.preserveCamera && scene;
      invalidateRenderableCaches();
      invalidateMemberInstanceLookup();
      clearPendingDetailScaleChange();
      pickColors.reset();
      objectPreviewController.reset();
      scene = nextScene;
      resizeCanvas();
      if (!preserveCamera) {
        camera.reset();
        camera.fit(scene, canvas);
        viewOrientation = "iso";
      }
      draw();
      notifyCameraChange("scene");
    },
    setPickHandler(handler, options = {}) {
      pickHandler = handler;
      pickHandlerOptions = handler ? { ...options } : {};
    },
    setClickHandler(handler) {
      clickHandler = handler;
    },
    setDoubleClickHandler(handler) {
      doubleClickHandler = handler;
    },
    setAuthoringHandler(handler) {
      authoringHandler = handler;
    },
    setCommandHandler(handler) {
      commandHandler = handler;
    },
    setDetailScaleChangeHandler(handler) {
      clearPendingDetailScaleChange();
      detailScaleChangeHandler = handler;
    },
    setCameraChangeHandler(handler) {
      cameraChangeHandler = handler;
      notifyCameraChange("attach");
    },
    setDisplayMode(mode) {
      const nextMode = normalizeDisplayMode(mode);
      if (displayMode === nextMode) return displayMode;
      displayMode = nextMode;
      draw();
      return displayMode;
    },
    setViewOrientation(orientation = "iso", options = {}) {
      if (!scene) return false;
      const nextOrientation = ["front", "back", "right", "left", "top", "bottom", "iso"].includes(orientation) ? orientation : "iso";
      viewOrientation = nextOrientation;
      camera.setViewAngles(cameraAnglesForOrientation(nextOrientation), scene, canvas, { fit: options.fit !== false });
      invalidateRenderableCaches();
      scheduleDetailScaleChange();
      notifyCameraChange("orientation");
      draw();
      return true;
    },
    viewOrientation() {
      return viewOrientation;
    },
    viewCamera() {
      return cameraState("read");
    },
    orbitView(dx = 0, dy = 0, options = {}) {
      if (!scene) return false;
      if (options.pivot === "origin") camera.setOrbitPivot(WORLD_ORIGIN, scene, canvas);
      camera.orbit(dx, dy);
      viewOrientation = "custom";
      notifyCameraChange("nav-cube");
      requestDraw();
      return true;
    },
    renderMode() {
      return displayMode;
    },
    snapVisibilityMode() {
      return displayMode === "wireframe" ? "wireframe" : "solid";
    },
    screenScale() {
      return camera.screenScale();
    },
    viewportSize() {
      return { width: canvas.width, height: canvas.height };
    },
    currentPointer() {
      return currentPointerState();
    },
    authoringHandleAtClientPoint,
    snapVisibilityAt,
    authoringOverlaySnapshot,
    setAuthoringOverlay(overlay = { lines: [], handles: [] }) {
      authoringOverlay = overlay || { lines: [], handles: [], labels: [] };
      updateAuthoringOverlayDebugState();
      if (!authoringOverlay.handles?.some((handle) => authoringHandleKey(handle) === authoringHandleKey(authoringHoveredHandle))) {
        clearAuthoringHover();
      }
      renderAuthoringLabels();
      requestDraw();
    },
    setAuthoringPreviewScene(nextScene = null) {
      const hasPreview = arrayValues(nextScene?.faces).length
        || arrayValues(nextScene?.lines).length
        || arrayValues(nextScene?.memberInstances).length;
      authoringPreviewScene = hasPreview ? nextScene : null;
      requestDraw();
    },
    setDimensionOverlay(overlay = { lines: [], labels: [] }) {
      dimensionOverlay = overlay || { lines: [], labels: [] };
      dimensionUi.setOverlay(dimensionOverlay);
      requestDraw();
    },
    setDimensionClickHandler(handler) {
      dimensionUi.setClickHandler(handler);
    },
    setDimensionValueHandler(handler) {
      dimensionUi.setValueHandler(handler);
    },
    setDimensionModeHandler(handler) {
      dimensionUi.setModeHandler(handler);
    },
    setDimensionCancelHandler(handler) {
      dimensionUi.setCancelHandler(handler);
    },
    setDimensionRepairHandler(handler) {
      dimensionUi.setRepairHandler(handler);
    },
    setDimensionPlacementHandler(handler) {
      dimensionPlacementHandler = handler;
    },
    setHighlightedObjects(objectIds = []) {
      if (sameIdSet(highlightedObjectIds, objectIds)) return;
      const memberOnlyHighlight = isMemberOnlyHighlightChange(scene, highlightedObjectIds, objectIds);
      highlightedObjectIds = new Set(objectIds);
      if (!memberOnlyHighlight) {
        invalidateMemberInstanceCache();
        invalidateStaticSceneCache();
      }
      requestDraw();
    },
    objectPoints,
    evaluatedSnapEdges,
    beginObjectPreview: objectPreviewController.begin,
    updateMemberMovePreview: objectPreviewController.updateMemberMove,
    clearObjectPreview: objectPreviewController.clear,
    updateMemberInstance: objectPreviewController.updateMemberInstance,
    replaceSceneObjects: objectPreviewController.replaceSceneObjects,
    fitPoints(points, options = {}) {
      if (camera.fitPoints(points, canvas, options)) {
        if (finiteNumber(options.yaw) || finiteNumber(options.pitch)) viewOrientation = "custom";
        invalidateRenderableCaches();
        scheduleDetailScaleChange();
        notifyCameraChange("fit");
        draw();
      }
    },
    resetView,
    canvasDataUrl(type = "image/png") {
      draw();
      return canvas.toDataURL(type);
    },
    projectPoint,
    screenRay(x, y) {
      return camera.screenRay(x, y, canvas);
    },
    screenDeltaToWorld(dx, dy) {
      return camera.screenDeltaToWorld(dx, dy);
    },
    resize,
    draw
  };
}
