import { v } from "../core/math.mjs";
import { faceNormal, triangulateFace } from "../geometry/polygon.mjs";
import { createCamera } from "./camera.mjs";

export function createWebglViewer(canvas, reset, settings) {
  const gl = canvas.getContext("webgl", { antialias: true });
  let scene = null;
  const camera = createCamera(settings);
  let drag = null;
  let renderer = null;
  let pickHandler = null;
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

  function pickScenePoint(x, y) {
    return pickScene(x, y)?.point || null;
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

    gl.lineWidth(settings.render.edges.lineWidth);
    drawArrays(gl.LINES, linePositions, lineColors);
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
      const mode = event.button === 1 || event.button === 2 || event.shiftKey ? "pan" : "orbit";
      if (pickHandler && event.button === 0 && !event.shiftKey) {
        pickHandler(pickScene(x, y)?.face || null);
        return;
      }
      if (mode === "orbit") {
        const hit = pickScenePoint(x, y);
        camera.setOrbitPivot(hit || [0, 0, 0], scene, canvas, hit ? { x, y } : null);
      }
      drag = {
        x: event.clientX,
        y: event.clientY,
        mode,
        pointerId: event.pointerId
      };
      if (mode === "orbit") moveOrbitCursor(event.clientX, event.clientY);
      canvas.setPointerCapture(event.pointerId);
      if (mode === "orbit") requestOrbitLock();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
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

    const endDrag = ({ exitPointerLock = true } = {}) => {
      const pointerId = drag?.pointerId;
      const lockedOrbit = drag?.mode === "orbit" && document.pointerLockElement === canvas;
      drag = null;
      hideOrbitCursor();
      if (pointerId !== undefined && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
      if (exitPointerLock && lockedOrbit) document.exitPointerLock?.();
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
    setHighlightedObjects(objectIds = []) {
      highlightedObjectIds = new Set(objectIds);
      draw();
    },
    resize,
    draw
  };
}
