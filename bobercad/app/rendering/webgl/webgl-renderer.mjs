import { v } from "../../engine/core/math.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { createCamera } from "./camera.mjs";
import { createDimensionOverlayUi } from "./dimension-overlay-ui.mjs";
import { createTextLabelRenderer } from "./text-label-renderer.mjs";

export function createWebglViewer(canvas, reset, settings) {
  const gl = canvas.getContext("webgl", { antialias: true });
  let scene = null;
  const camera = createCamera(settings);
  let drag = null;
  let renderer = null;
  let pickHandler = null;
  let clickHandler = null;
  let doubleClickHandler = null;
  let authoringHandler = null;
  let commandHandler = null;
  let authoringOverlay = { lines: [], handles: [] };
  let dimensionOverlay = { lines: [], labels: [] };
  let projectedSceneTriangles = null;
  const dimensionTextRenderer = gl ? createTextLabelRenderer(gl, canvas, settings) : null;
  const dimensionUi = createDimensionOverlayUi({
    canvas,
    settings,
    projectPoint,
    screenScale: () => camera.screenScale(),
    requestDraw: () => draw()
  });
  const authoringLabelLayer = document.createElement("div");
  authoringLabelLayer.className = "authoring-label-layer";
  document.body.appendChild(authoringLabelLayer);
  let highlightedObjectIds = new Set();
  const highlight = {
    fill: "#f59e0b",
    edge: "#facc15"
  };


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

  function hexToRgba(color, opacity = 1) {
    const rgb = hexToRgb(color);
    return [rgb[0], rgb[1], rgb[2], Math.round(255 * opacity)];
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

  function invalidateScenePickCache() {
    projectedSceneTriangles = null;
  }

  function scenePickTriangles() {
    if (projectedSceneTriangles) return projectedSceneTriangles;
    if (!scene) return [];
    projectedSceneTriangles = [];
    for (const face of scene.faces) {
      for (const triangle of triangulateFace(face.points)) {
        const projected = triangle.map((point) => camera.projectPoint(point, scene, canvas));
        const xs = projected.map((point) => point.x);
        const ys = projected.map((point) => point.y);
        projectedSceneTriangles.push({
          face,
          triangle,
          projected,
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys)
        });
      }
    }
    return projectedSceneTriangles;
  }

  function pickScene(x, y, options = {}) {
    if (!scene) return null;
    const cursor = { x, y };
    let best = null;
    for (const item of scenePickTriangles()) {
      const { face, projected, triangle } = item;
      if (options.includeTransparent === false && (face.opacity ?? 1) < 1) continue;
      if (x < item.minX || x > item.maxX || y < item.minY || y > item.maxY) continue;
      const weights = barycentric(cursor, projected[0], projected[1], projected[2]);
      if (!weights) continue;
      const depth = projected[0].depth * weights[0] + projected[1].depth * weights[1] + projected[2].depth * weights[2];
      if (!best || depth < best.depth) best = { depth, point: interpolatePoint(triangle, weights), face };
    }
    return best;
  }

  function projectPoint(point) {
    return scene ? camera.projectPoint(point, scene, canvas) : null;
  }

  function hideDimensionsBehindGeometry() {
    return settings.render.dimensions?.hideBehindGeometry !== false;
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
    if (!scene || !dimensionUi.hasClickHandler()) return null;
    const labelHit = dimensionTextRenderer?.hitTest(x, y);
    if (labelHit) return labelHit;
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

  function updateDimensionHover(event) {
    if (!scene || drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      dimensionUi.setHoveredDimensionId(null, event);
      return;
    }
    dimensionUi.setHoveredDimensionId(pickDimension(x, y)?.dimensionId || null, event);
  }

  function renderAuthoringLabels() {
    authoringLabelLayer.replaceChildren();
    for (const label of authoringOverlay?.labels || []) {
      const projected = projectPoint(label.point);
      if (!projected) continue;
      const node = document.createElement("div");
      node.className = `authoring-label ${label.className || ""}`.trim();
      node.textContent = label.text;
      if (label.color) node.style.color = label.color;
      node.style.left = `${projected.x}px`;
      node.style.top = `${projected.y}px`;
      authoringLabelLayer.appendChild(node);
    }
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

  function draw() {
    if (!scene || !gl) return;
    invalidateScenePickCache();
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
    const edgeColor = settings.render.edges.defaultColor;

    for (const face of scene.faces) {
      if (face.hideEdges) continue;
      const rgba = hexToRgba(edgeColor, face.opacity ?? 1);
      for (let i = 0; i < face.points.length; i += 1) {
        pushVertex(linePositions, lineColors, clipPoint(face.points[i]), rgba);
        pushVertex(linePositions, lineColors, clipPoint(face.points[(i + 1) % face.points.length]), rgba);
      }
    }

    for (const line of scene.lines) {
      const rgba = hexToRgba(isHighlighted(line) ? highlight.edge : line.color, line.opacity ?? 1);
      pushVertex(linePositions, lineColors, clipPoint(line.points[0]), rgba);
      pushVertex(linePositions, lineColors, clipPoint(line.points[1]), rgba);
    }

    for (const line of authoringOverlay.lines || []) {
      const rgba = hexToRgba(line.color);
      pushVertex(linePositions, lineColors, clipPoint(line.points[0]), rgba);
      pushVertex(linePositions, lineColors, clipPoint(line.points[1]), rgba);
    }

    gl.lineWidth(settings.render.edges.lineWidth);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawArrays(gl.LINES, linePositions, lineColors);
    gl.disable(gl.BLEND);

    const dimensionPositions = [];
    const dimensionColors = [];
    for (const line of dimensionOverlay.lines || []) {
      const rgba = hexToRgba(dimensionUi.isHovered(line) ? dimensionUi.hoverColor : line.color);
      pushVertex(dimensionPositions, dimensionColors, clipPoint(line.points[0]), rgba);
      pushVertex(dimensionPositions, dimensionColors, clipPoint(line.points[1]), rgba);
    }
    if (dimensionPositions.length) {
      if (hideDimensionsBehindGeometry()) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);
      drawArrays(gl.LINES, dimensionPositions, dimensionColors);
      gl.enable(gl.DEPTH_TEST);
    }
    dimensionTextRenderer?.draw({
      labels: dimensionOverlay.labels || [],
      projectPoint,
      screenScale: () => camera.screenScale(),
      isHovered: (label) => dimensionUi.isHovered(label),
      hideBehindGeometry: hideDimensionsBehindGeometry()
    });

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
    dimensionUi.renderLabels();
    renderAuthoringLabels();
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

    const capturePointer = (event) => {
      try {
        if (event.pointerId !== undefined && canvas.isConnected) canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can be rejected after focus/control handoff; active drags still use received events.
      }
    };

    canvas.addEventListener("pointerdown", (event) => {
      if (!scene) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const mode = event.button === 1 || event.button === 2 || event.shiftKey ? "pan" : "pending-orbit";
      const hitResult = pickScene(x, y);
      if (commandHandler?.active?.() && event.button === 0) {
        commandHandler.pointerDown?.({ event, screen: { x, y }, hit: hitResult });
        return;
      }
      if (pickHandler && event.button === 0 && !event.shiftKey) {
        pickHandler(hitResult?.face || null);
        return;
      }
      const dimension = event.button === 0 && !event.shiftKey ? pickDimension(x, y) : null;
      if (dimension) {
        dimensionUi.clickDimension(dimension);
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
        capturePointer(event);
        return;
      }
      if (mode === "pending-orbit") {
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
      capturePointer(event);
    });

    canvas.addEventListener("dblclick", (event) => {
      if (!scene || pickHandler || !doubleClickHandler || event.shiftKey) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (pickDimension(x, y)) return;
      doubleClickHandler(pickScene(x, y)?.face || null);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drag) {
        if (commandHandler?.active?.()) {
          const rect = canvas.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const hitResult = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? pickScene(x, y) : null;
          commandHandler.pointerMove?.({ event, screen: { x, y }, hit: hitResult });
          return;
        }
        updateDimensionHover(event);
        return;
      }
      dimensionUi.setHoveredDimensionId(null, event);
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
      if (event.target === canvas || dimensionUi.contains(event.target)) return;
      dimensionUi.setHoveredDimensionId(null, event);
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
    setDoubleClickHandler(handler) {
      doubleClickHandler = handler;
    },
    setAuthoringHandler(handler) {
      authoringHandler = handler;
    },
    setCommandHandler(handler) {
      commandHandler = handler;
    },
    setAuthoringOverlay(overlay = { lines: [], handles: [] }) {
      authoringOverlay = overlay || { lines: [], handles: [], labels: [] };
      draw();
    },
    setDimensionOverlay(overlay = { lines: [], labels: [] }) {
      dimensionOverlay = overlay || { lines: [], labels: [] };
      dimensionUi.setOverlay(dimensionOverlay);
      draw();
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
    setHighlightedObjects(objectIds = []) {
      highlightedObjectIds = new Set(objectIds);
      draw();
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
