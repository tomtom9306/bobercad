import { v } from "../../engine/core/math.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { memberFrame } from "../../engine/geometry/member-geometry.mjs";
import { createCamera } from "./camera.mjs";
import { createDimensionOverlayUi } from "./dimension-overlay-ui.mjs";
import { createTextLabelRenderer } from "./text-label-renderer.mjs";

export function createWebglViewer(canvas, reset, settings) {
  const qaCapture = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("qaCapture");
  const gl = canvas.getContext("webgl", { antialias: true, preserveDrawingBuffer: qaCapture });
  let scene = null;
  const camera = createCamera(settings);
  let drag = null;
  let renderer = null;
  let staticSceneRenderer = null;
  let staticSceneCache = null;
  let memberInstanceRenderer = null;
  let memberInstanceCache = null;
  let memberInstanceLookup = null;
  let pickObjectByColorId = new Map();
  let pickColorIdByObjectKey = new Map();
  let nextPickColorId = 1;
  let pickHandler = null;
  let clickHandler = null;
  let doubleClickHandler = null;
  let authoringHandler = null;
  let commandHandler = null;
  let detailScaleChangeHandler = null;
  let detailScaleChangeTimer = null;
  let wheelZoomFramePending = false;
  let pendingWheelZoom = null;
  let authoringOverlay = { lines: [], handles: [] };
  let authoringHoveredHandle = null;
  let dimensionOverlay = { lines: [], labels: [] };
  let objectPreview = null;
  let projectedSceneTriangles = null;
  let frameDrawPending = false;
  const dimensionTextRenderer = gl ? createTextLabelRenderer(gl, canvas, settings) : null;

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
    window.clearTimeout(detailScaleChangeTimer);
    detailScaleChangeTimer = null;
  }

  function scheduleDetailScaleChange(delayMs = 0) {
    clearPendingDetailScaleChange();
    if (!detailScaleChangeHandler) return;
    if (delayMs <= 0) {
      notifyDetailScaleChange();
      return;
    }
    detailScaleChangeTimer = window.setTimeout(() => {
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
      const steps = Math.min(12, Math.max(1, zoom.steps));
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
  const authoringLabelLayer = document.createElement("div");
  authoringLabelLayer.className = "authoring-label-layer";
  document.body.appendChild(authoringLabelLayer);
  let highlightedObjectIds = new Set();
  const highlight = {
    fill: "#f59e0b",
    edge: "#facc15"
  };
  const detailPixelThreshold = Number.isFinite(settings.render.lod?.detailPixelThreshold)
    ? settings.render.lod.detailPixelThreshold
    : 24;


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

  function shouldBakeHighlight(item) {
    return isHighlighted(item) && !useHighlightOverlay();
  }

  function isActiveConnectionObject(objectId) {
    return Boolean(objectId && scene?.activeConnectionObjectIds?.has?.(objectId));
  }

  function lodDetailVisible(objectId) {
    if (!objectId) return true;
    const detail = scene?.lodDetails?.[objectId];
    if (!detail) return false;
    if (isActiveConnectionObject(objectId) || highlightedObjectIds.has(objectId)) return true;
    return detail.radius * camera.screenScale() >= detailPixelThreshold;
  }

  function isObjectPreviewed(item) {
    return Boolean(item?.objectId && objectPreview?.objectIds?.has(item.objectId));
  }

  function shouldDrawSceneItem(item) {
    if (isObjectPreviewed(item)) return false;
    return !item?.lodDetailObjectId || lodDetailVisible(item.lodDetailObjectId);
  }

  function sameObjectIdSet(a, values = []) {
    if (a.size !== values.length) return false;
    return values.every((id) => a.has(id));
  }

  function resetPickObjects() {
    pickObjectByColorId = new Map();
    pickColorIdByObjectKey = new Map();
    nextPickColorId = 1;
  }

  function pickObjectKey(item) {
    return item?.collection && item?.objectId ? `${item.collection}:${item.objectId}` : null;
  }

  function encodePickColorId(id) {
    return [
      ((id >> 16) & 255) / 255,
      ((id >> 8) & 255) / 255,
      (id & 255) / 255,
      1
    ];
  }

  function pickColorForItem(item) {
    const key = pickObjectKey(item);
    if (!key) return [0, 0, 0, 1];
    let id = pickColorIdByObjectKey.get(key);
    if (!id) {
      id = nextPickColorId;
      nextPickColorId += 1;
      pickColorIdByObjectKey.set(key, id);
      pickObjectByColorId.set(id, { collection: item.collection, objectId: item.objectId });
    }
    return encodePickColorId(id);
  }

  function pickObjectFromPixel(pixel) {
    const id = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    return id ? pickObjectByColorId.get(id) || null : null;
  }

  function shouldUseGpuPick() {
    return (scene?.faces?.length || 0) + (scene?.memberInstances?.length || 0) > 25000;
  }

  function isLargeScene() {
    return (scene?.faces?.length || 0) + (scene?.lines?.length || 0) + (scene?.memberInstances?.length || 0) > 25000;
  }

  function objectCollection(objectId) {
    return scene?.project?.objectIndex?.[objectId]?.collection || null;
  }

  function memberOnlyHighlightChange(nextObjectIds = []) {
    if (!isLargeScene()) return false;
    const ids = [...highlightedObjectIds, ...nextObjectIds].filter(Boolean);
    return ids.length > 0 && ids.every((id) => objectCollection(id) === "members");
  }

  function useHighlightOverlay() {
    return isLargeScene() && [...highlightedObjectIds].every((id) => objectCollection(id) === "members");
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

  function initStaticSceneRenderer() {
    if (staticSceneRenderer) return staticSceneRenderer;
    if (!gl) throw new Error("WebGL is required for scene rendering");

    const program = createProgram(`
      precision highp float;
      attribute vec3 aWorldPosition;
      attribute vec4 aColor;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uScale;
      uniform vec2 uPan;
      uniform vec2 uViewport;
      uniform vec3 uPivot;
      uniform float uDepthHalf;
      varying vec4 vColor;

      vec3 cameraRotate(vec3 point) {
        float cy = cos(uYaw);
        float sy = sin(uYaw);
        float cp = cos(uPitch);
        float sp = sin(uPitch);
        float x = cy * point.x - sy * point.y;
        float y = sy * point.x + cy * point.y;
        return vec3(x, cp * y - sp * point.z, sp * y + cp * point.z);
      }

      void main() {
        vec3 view = cameraRotate(aWorldPosition - uPivot);
        float screenX = uViewport.x * 0.5 + uPan.x + view.x * uScale;
        float screenY = uViewport.y * 0.5 + uPan.y - view.y * uScale;
        float depth = clamp(-view.z / uDepthHalf, -1.0, 1.0);
        gl_Position = vec4(screenX / uViewport.x * 2.0 - 1.0, 1.0 - screenY / uViewport.y * 2.0, depth, 1.0);
        vColor = aColor;
      }
    `, `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `);

    staticSceneRenderer = {
      program,
      position: gl.getAttribLocation(program, "aWorldPosition"),
      color: gl.getAttribLocation(program, "aColor"),
      uniforms: {
        yaw: gl.getUniformLocation(program, "uYaw"),
        pitch: gl.getUniformLocation(program, "uPitch"),
        scale: gl.getUniformLocation(program, "uScale"),
        pan: gl.getUniformLocation(program, "uPan"),
        viewport: gl.getUniformLocation(program, "uViewport"),
        pivot: gl.getUniformLocation(program, "uPivot"),
        depthHalf: gl.getUniformLocation(program, "uDepthHalf")
      }
    };
    return staticSceneRenderer;
  }

  function initMemberInstanceRenderer() {
    if (memberInstanceRenderer) return memberInstanceRenderer;
    if (!gl) throw new Error("WebGL is required for member instancing");
    const instancing = gl.getExtension("ANGLE_instanced_arrays");
    if (!instancing) return null;

    const program = createProgram(`
      precision highp float;
      attribute vec3 aLocalPosition;
      attribute vec3 aLocalNormal;
      attribute vec3 aStart;
      attribute vec3 aAxisX;
      attribute vec3 aAxisY;
      attribute vec3 aAxisZ;
      attribute float aLength;
      attribute vec4 aColor;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uScale;
      uniform vec2 uPan;
      uniform vec2 uViewport;
      uniform vec3 uPivot;
      uniform float uDepthHalf;
      uniform vec3 uLight;
      uniform float uAmbient;
      uniform float uDiffuse;
      varying vec4 vColor;

      vec3 cameraRotate(vec3 point) {
        float cy = cos(uYaw);
        float sy = sin(uYaw);
        float cp = cos(uPitch);
        float sp = sin(uPitch);
        float x = cy * point.x - sy * point.y;
        float y = sy * point.x + cy * point.y;
        return vec3(x, cp * y - sp * point.z, sp * y + cp * point.z);
      }

      void main() {
        vec3 world = aStart
          + aAxisX * (aLocalPosition.x * aLength)
          + aAxisY * aLocalPosition.y
          + aAxisZ * aLocalPosition.z;
        vec3 view = cameraRotate(world - uPivot);
        float screenX = uViewport.x * 0.5 + uPan.x + view.x * uScale;
        float screenY = uViewport.y * 0.5 + uPan.y - view.y * uScale;
        float depth = clamp(-view.z / uDepthHalf, -1.0, 1.0);
        vec3 normal = normalize(aAxisX * aLocalNormal.x + aAxisY * aLocalNormal.y + aAxisZ * aLocalNormal.z);
        float shade = uAmbient + max(0.0, dot(normal, normalize(uLight))) * uDiffuse;
        gl_Position = vec4(screenX / uViewport.x * 2.0 - 1.0, 1.0 - screenY / uViewport.y * 2.0, depth, 1.0);
        vColor = vec4(aColor.rgb * shade, aColor.a);
      }
    `, `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        gl_FragColor = vColor;
      }
    `);

    memberInstanceRenderer = {
      program,
      instancing,
      localPosition: gl.getAttribLocation(program, "aLocalPosition"),
      localNormal: gl.getAttribLocation(program, "aLocalNormal"),
      start: gl.getAttribLocation(program, "aStart"),
      axisX: gl.getAttribLocation(program, "aAxisX"),
      axisY: gl.getAttribLocation(program, "aAxisY"),
      axisZ: gl.getAttribLocation(program, "aAxisZ"),
      length: gl.getAttribLocation(program, "aLength"),
      color: gl.getAttribLocation(program, "aColor"),
      uniforms: {
        yaw: gl.getUniformLocation(program, "uYaw"),
        pitch: gl.getUniformLocation(program, "uPitch"),
        scale: gl.getUniformLocation(program, "uScale"),
        pan: gl.getUniformLocation(program, "uPan"),
        viewport: gl.getUniformLocation(program, "uViewport"),
        pivot: gl.getUniformLocation(program, "uPivot"),
        depthHalf: gl.getUniformLocation(program, "uDepthHalf"),
        light: gl.getUniformLocation(program, "uLight"),
        ambient: gl.getUniformLocation(program, "uAmbient"),
        diffuse: gl.getUniformLocation(program, "uDiffuse")
      }
    };
    return memberInstanceRenderer;
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

  function invalidateMemberInstanceLookup() {
    memberInstanceLookup = null;
  }

  function memberInstancesForPick(objectIds = null) {
    if (!scene?.memberInstances?.length) return [];
    if (!objectIds) return scene.memberInstances;
    if (!memberInstanceLookup) {
      memberInstanceLookup = new Map();
      for (const instance of scene.memberInstances) {
        const bucket = memberInstanceLookup.get(instance.objectId) || [];
        bucket.push(instance);
        memberInstanceLookup.set(instance.objectId, bucket);
      }
    }
    const instances = [];
    for (const objectId of objectIds) instances.push(...(memberInstanceLookup.get(objectId) || []));
    return instances;
  }

  function scenePickTriangles(objectIds = null) {
    const filteredIds = objectIds ? new Set(objectIds) : null;
    if (!filteredIds && projectedSceneTriangles) return projectedSceneTriangles;
    if (!scene) return [];
    const triangles = [];
    for (const face of scene.faces) {
      if (filteredIds && !filteredIds.has(face.objectId)) continue;
      if (!shouldDrawSceneItem(face)) continue;
      for (const triangle of triangulateFace(face.points)) {
        const projected = triangle.map((point) => camera.projectPoint(point, scene, canvas));
        const xs = projected.map((point) => point.x);
        const ys = projected.map((point) => point.y);
        triangles.push({
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
    if (!filteredIds) projectedSceneTriangles = triangles;
    return triangles;
  }

  function pickMemberInstance(x, y, options = {}) {
    if (!scene?.memberInstances?.length) return null;
    const cursor = { x, y };
    const objectIds = options.objectIds ? new Set(options.objectIds) : null;
    let best = null;

    for (const instance of memberInstancesForPick(objectIds)) {
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      const a = camera.projectPoint(instance.start, scene, canvas);
      const b = camera.projectPoint(v.add(instance.start, v.mul(instance.axisX, instance.length)), scene, canvas);
      const t = screenLineParameter(cursor, a, b);
      const closestScreen = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const distance = Math.hypot(cursor.x - closestScreen.x, cursor.y - closestScreen.y);
      const radiusPx = instance.profileRadius * camera.screenScale();
      const threshold = Math.max(6, Math.min(16, radiusPx));
      if (distance > threshold) continue;
      const depth = a.depth + (b.depth - a.depth) * t;
      if (!best || depth < best.depth || (depth === best.depth && distance < best.distance)) {
        best = {
          depth,
          distance,
          point: v.add(instance.start, v.mul(instance.axisX, instance.length * t)),
          face: {
            collection: instance.collection,
            objectId: instance.objectId
          }
        };
      }
    }

    return best;
  }

  function pickScene(x, y, options = {}) {
    if (!scene) return null;
    if (!options.forceCpu && shouldUseGpuPick()) return pickSceneGpu(x, y, options);
    const cursor = { x, y };
    const objectIds = options.objectIds ? new Set(options.objectIds) : null;
    let best = null;
    for (const item of scenePickTriangles(objectIds)) {
      const { face, projected, triangle } = item;
      if (options.includeTransparent === false && (face.opacity ?? 1) < 1) continue;
      if (x < item.minX || x > item.maxX || y < item.minY || y > item.maxY) continue;
      const weights = barycentric(cursor, projected[0], projected[1], projected[2]);
      if (!weights) continue;
      const depth = projected[0].depth * weights[0] + projected[1].depth * weights[1] + projected[2].depth * weights[2];
      if (!best || depth < best.depth) best = { depth, point: interpolatePoint(triangle, weights), face };
    }
    return best || (options.includeInstances === false ? null : pickMemberInstance(x, y, { objectIds }));
  }

  function pickOrbitAnchor(x, y) {
    const coarse = shouldUseGpuPick() ? pickSceneGpu(x, y, { includeTransparent: false }) : null;
    if (coarse?.face?.objectId) {
      const precise = pickScene(x, y, {
        forceCpu: true,
        includeTransparent: false,
        objectIds: [coarse.face.objectId]
      });
      return precise || coarse;
    }
    return pickScene(x, y, { forceCpu: true, includeTransparent: false });
  }

  function fastClickPick(x, y) {
    if (!shouldUseGpuPick()) return pickOrbitAnchor(x, y);
    return pickSceneGpu(x, y, { includeTransparent: false });
  }

  function preciseOrbitAnchor(x, y, coarseFace = null) {
    if (!shouldUseGpuPick()) return pickOrbitAnchor(x, y);
    if (coarseFace?.objectId) {
      const precise = pickScene(x, y, {
        forceCpu: true,
        includeTransparent: false,
        objectIds: [coarseFace.objectId]
      });
      return precise || { depth: 0, point: null, face: coarseFace };
    }
    return null;
  }

  function projectPoint(point) {
    return scene ? camera.projectPoint(point, scene, canvas) : null;
  }

  function pointInCaptureRange(point, options = {}) {
    if (!Array.isArray(options.center) || !Number.isFinite(options.radius)) return true;
    return v.len(v.sub(point, options.center)) <= options.radius;
  }

  function captureItemPoints(item, options = {}) {
    const points = item.points || (item.start && item.axisX && item.length ? [item.start, v.add(item.start, v.mul(item.axisX, item.length))] : []);
    if (!points.length) return [];
    if (!options.clipMembers || item.collection !== "members") return points;
    const filtered = points.filter((point) => pointInCaptureRange(point, options));
    return filtered.length ? points : [];
  }

  function objectPoints(objectIds = [], options = {}) {
    if (!scene) return [];
    const ids = new Set(objectIds);
    const points = [];
    for (const item of [...scene.faces, ...scene.lines, ...(scene.memberInstances || [])]) {
      if (isObjectPreviewed(item)) continue;
      if (!ids.has(item.objectId)) continue;
      points.push(...captureItemPoints(item, options));
    }
    if (objectPreview) {
      for (const item of previewCaptureItems()) {
        if (!ids.has(item.objectId)) continue;
        points.push(...captureItemPoints(item, options));
      }
    }
    return points;
  }

  function clonePoint(point) {
    return Array.isArray(point) ? [...point] : point;
  }

  function cloneSceneItem(item) {
    return {
      ...item,
      points: (item.points || []).map(clonePoint),
      start: clonePoint(item.start),
      axisX: clonePoint(item.axisX),
      axisY: clonePoint(item.axisY),
      axisZ: clonePoint(item.axisZ)
    };
  }

  function sameIdSet(left, right) {
    if (!left || left.size !== right.size) return false;
    for (const id of right) if (!left.has(id)) return false;
    return true;
  }

  function previewDelta() {
    return objectPreview?.delta || [0, 0, 0];
  }

  function previewOpacity(fallback = 1) {
    return Number.isFinite(objectPreview?.opacity) ? objectPreview.opacity : fallback;
  }

  function previewPoint(point) {
    return v.add(point, previewDelta());
  }

  function transformedPreviewInstance(instance) {
    const draft = objectPreview?.memberDrafts?.get(instance.objectId);
    if (draft) {
      const length = v.len(v.sub(draft.end, draft.start));
      if (Number.isFinite(length) && length > 1e-6) {
        const frame = memberFrame(draft);
        return {
          ...instance,
          start: [...draft.start],
          axisX: frame.x,
          axisY: frame.y,
          axisZ: frame.z,
          length,
          opacity: previewOpacity(instance.opacity ?? 1)
        };
      }
    }
    return { ...instance, start: previewPoint(instance.start), opacity: previewOpacity(instance.opacity ?? 1) };
  }

  function previewCaptureItems() {
    if (!objectPreview) return [];
    const transformedFaces = objectPreview.faces.map((face) => ({
      ...face,
      points: face.points.map(previewPoint)
    }));
    const transformedLines = objectPreview.lines.map((line) => ({
      ...line,
      points: line.points.map(previewPoint)
    }));
    const transformedInstances = objectPreview.memberInstances.map(transformedPreviewInstance);
    return [...transformedFaces, ...transformedLines, ...transformedInstances];
  }

  function beginObjectPreview(objectIds = []) {
    if (!scene) return false;
    const ids = new Set([...objectIds].filter(Boolean));
    if (!ids.size) return false;
    if (sameIdSet(objectPreview?.objectIds, ids)) return true;
    const isPreviewItem = (item) => item?.objectId && ids.has(item.objectId);
    objectPreview = {
      objectIds: ids,
      delta: [0, 0, 0],
      opacity: null,
      faces: (scene.faces || []).filter(isPreviewItem).map(cloneSceneItem),
      lines: (scene.lines || []).filter(isPreviewItem).map(cloneSceneItem),
      memberInstances: (scene.memberInstances || []).filter(isPreviewItem).map(cloneSceneItem),
      memberDrafts: new Map()
    };
    invalidateStaticSceneCache();
    invalidateMemberInstanceCache();
    requestDraw();
    return true;
  }

  function updateMemberMovePreview(member, options = {}) {
    if (!member?.id) return false;
    const ids = new Set([member.id, ...(options.objectIds || [])].filter(Boolean));
    if (!beginObjectPreview(ids)) return false;
    const delta = Array.isArray(options.delta) && options.delta.length === 3 && options.delta.every(Number.isFinite)
      ? options.delta
      : [0, 0, 0];
    objectPreview.delta = [...delta];
    objectPreview.opacity = Number.isFinite(options.opacity) ? options.opacity : null;
    objectPreview.memberDrafts.set(member.id, {
      ...member,
      start: [...member.start],
      end: [...member.end]
    });
    requestDraw();
    return true;
  }

  function clearObjectPreview() {
    if (!objectPreview) return;
    objectPreview = null;
    invalidateStaticSceneCache();
    invalidateMemberInstanceCache();
    requestDraw();
  }

  function translateSceneObjects(objectIds = [], delta = null) {
    if (!scene || !objectIds.length || !Array.isArray(delta) || delta.length !== 3 || delta.some((value) => !Number.isFinite(value))) return false;
    const ids = new Set(objectIds);
    const movedPoints = new WeakSet();
    let changed = false;
    const movePoint = (point) => {
      if (!Array.isArray(point) || movedPoints.has(point)) return;
      point[0] += delta[0];
      point[1] += delta[1];
      point[2] += delta[2];
      movedPoints.add(point);
      changed = true;
    };

    for (const item of [...scene.faces, ...scene.lines]) {
      if (!ids.has(item.objectId)) continue;
      for (const point of item.points || []) movePoint(point);
    }
    for (const instance of scene.memberInstances || []) {
      if (!ids.has(instance.objectId)) continue;
      movePoint(instance.start);
    }
    for (const objectId of ids) {
      const detail = scene.lodDetails?.[objectId];
      if (detail?.center) detail.center = v.add(detail.center, delta);
    }
    return changed;
  }

  function updateMemberInstance(member, options = {}) {
    if (!scene || !member?.id) return false;
    const translatedObjects = translateSceneObjects(options.translateObjectIds || [], options.delta);
    const translatedMemberDetail = translatedObjects && (options.translateObjectIds || []).includes(member.id);
    const instance = (scene.memberInstances || []).find((item) => item.objectId === member.id);
    if (!instance) {
      if (translatedObjects) {
        invalidateStaticSceneCache();
        invalidateMemberInstanceCache();
        requestDraw();
      }
      return translatedObjects;
    }
    const length = v.len(v.sub(member.end, member.start));
    if (!Number.isFinite(length) || length <= 1e-6) return false;
    const frame = memberFrame(member);

    if (options.project) scene.project = options.project;
    if (scene.project?.model?.members?.[member.id]) scene.project.model.members[member.id] = member;
    instance.start = [...member.start];
    instance.axisX = frame.x;
    instance.axisY = frame.y;
    instance.axisZ = frame.z;
    instance.length = length;
    if (scene.lodDetails && !translatedMemberDetail) delete scene.lodDetails[member.id];

    invalidateStaticSceneCache();
    invalidateMemberInstanceCache();
    requestDraw();
    return true;
  }

  function replaceSceneObjects(patchScene, objectIds = []) {
    const idValues = objectIds && typeof objectIds[Symbol.iterator] === "function" ? [...objectIds] : [];
    if (!scene || !patchScene || !idValues.length) return false;
    const ids = new Set(idValues.filter(Boolean));
    if (!ids.size) return false;
    const isPatchedObject = (item) => item?.objectId && ids.has(item.objectId);
    const appendPatched = (target, source = []) => {
      for (const item of source) {
        if (isPatchedObject(item)) target.push(item);
      }
    };

    scene.faces = (scene.faces || []).filter((item) => !isPatchedObject(item));
    scene.lines = (scene.lines || []).filter((item) => !isPatchedObject(item));
    scene.memberInstances = (scene.memberInstances || []).filter((item) => !isPatchedObject(item));

    appendPatched(scene.faces, patchScene.faces);
    appendPatched(scene.lines, patchScene.lines);
    appendPatched(scene.memberInstances, patchScene.memberInstances);
    invalidateMemberInstanceLookup();

    scene.memberInstanceGeometries = {
      ...(scene.memberInstanceGeometries || {}),
      ...(patchScene.memberInstanceGeometries || {})
    };
    scene.lodDetails = scene.lodDetails || {};
    for (const objectId of ids) delete scene.lodDetails[objectId];
    for (const [objectId, detail] of Object.entries(patchScene.lodDetails || {})) {
      if (ids.has(objectId)) scene.lodDetails[objectId] = detail;
    }

    scene.project = patchScene.project || scene.project;
    scene.activeConnectionId = patchScene.activeConnectionId ?? scene.activeConnectionId;
    scene.activeConnectionObjectIds = patchScene.activeConnectionObjectIds || scene.activeConnectionObjectIds;
    scene.generatedConnectionObjectIds = patchScene.generatedConnectionObjectIds || scene.generatedConnectionObjectIds;
    projectedSceneTriangles = null;
    invalidateStaticSceneCache();
    invalidateMemberInstanceCache();
    requestDraw();
    return true;
  }

  function hideDimensionsBehindGeometry() {
    return settings.render.dimensions?.hideBehindGeometry !== false;
  }

  function hasDimensionOverlay() {
    return Boolean((dimensionOverlay.lines || []).length || (dimensionOverlay.labels || []).length);
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
    let best = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      best = Math.min(best, screenLineDistance(point, points[index - 1], points[index]));
    }
    return best;
  }

  function authoringHandleKey(handle) {
    if (!handle) return "";
    return [
      handle.type || "point",
      handle.kind || "",
      handle.memberId || "",
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
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const next = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
      ? pickAuthoringHandle(x, y)
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

      const projected = projectOffsetPoint(handle.point, handle.screenOffsetPx);
      if (!projected) continue;
      const distance = Math.hypot(projected.x - x, projected.y - y);
      if (distance > (handle.radius || 10)) continue;
      if (!best || distance < best.distance) best = { ...handle, distance, screen: projected };
    }
    return best;
  }

  function screenLineParameter(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby;
    return lengthSq <= 0.000001
      ? 0
      : Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq));
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
    if (!hasDimensionOverlay()) {
      dimensionUi.setHoveredDimensionId(null, event);
      return;
    }
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
      const projected = projectOffsetPoint(label.point, label.screenOffsetPx);
      if (!projected) continue;
      const node = document.createElement("div");
      node.className = `authoring-label ${label.className || ""}`.trim();
      node.textContent = label.text;
      if (label.title) node.title = label.title;
      if (label.color) node.style.color = label.color;
      node.style.left = `${projected.x}px`;
      node.style.top = `${projected.y}px`;
      authoringLabelLayer.appendChild(node);
    }
    if (authoringHoveredHandle?.point) {
      const projected = authoringHoveredHandle.screen || projectOffsetPoint(authoringHoveredHandle.point, authoringHoveredHandle.screenOffsetPx);
      if (projected) {
        const node = document.createElement("div");
        const axis = authoringHoveredHandle.axisLabel || String(authoringHoveredHandle.axisId || "").toUpperCase();
        const space = authoringHoveredHandle.spaceLabel ? `${authoringHoveredHandle.spaceLabel} ` : "";
        const action = authoringHoveredHandle.type === "rotation-ring" ? "rotate" : authoringHoveredHandle.type === "axis" ? "move" : "edit";
        node.className = "authoring-label manipulator-hover";
        node.textContent = authoringHoveredHandle.hoverLabel || (axis ? `${space}${axis} ${action}` : action);
        node.style.left = `${projected.x}px`;
        node.style.top = `${projected.y}px`;
        authoringLabelLayer.appendChild(node);
      }
    }
  }

  function clipFromScreen(x, y, depth = -1) {
    return [
      x / canvas.width * 2 - 1,
      1 - y / canvas.height * 2,
      depth
    ];
  }

  function pushScreenLine(positionData, colorData, a, b, rgba, depth = -1) {
    pushVertex(positionData, colorData, clipFromScreen(a.x, a.y, depth), rgba);
    pushVertex(positionData, colorData, clipFromScreen(b.x, b.y, depth), rgba);
  }

  function pushScreenSquare(positionData, colorData, center, radius, rgba) {
    const left = center.x - radius;
    const right = center.x + radius;
    const top = center.y - radius;
    const bottom = center.y + radius;
    pushScreenLine(positionData, colorData, { x: left, y: center.y }, { x: right, y: center.y }, rgba);
    pushScreenLine(positionData, colorData, { x: center.x, y: top }, { x: center.x, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: left, y: top }, { x: right, y: top }, rgba);
    pushScreenLine(positionData, colorData, { x: right, y: top }, { x: right, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: right, y: bottom }, { x: left, y: bottom }, rgba);
    pushScreenLine(positionData, colorData, { x: left, y: bottom }, { x: left, y: top }, rgba);
  }

  function pushScreenDiamond(positionData, colorData, center, radius, rgba) {
    const top = { x: center.x, y: center.y - radius };
    const right = { x: center.x + radius, y: center.y };
    const bottom = { x: center.x, y: center.y + radius };
    const left = { x: center.x - radius, y: center.y };
    pushScreenLine(positionData, colorData, top, right, rgba);
    pushScreenLine(positionData, colorData, right, bottom, rgba);
    pushScreenLine(positionData, colorData, bottom, left, rgba);
    pushScreenLine(positionData, colorData, left, top, rgba);
  }

  function projectOffsetPoint(point, offset = null) {
    const projected = projectPoint(point);
    if (!projected) return null;
    return {
      x: projected.x + (offset?.x || 0),
      y: projected.y + (offset?.y || 0)
    };
  }

  function pushAxisHandle(positionData, colorData, handle) {
    const segment = axisHandleSegment(handle);
    if (!segment) return;
    const hovered = isAuthoringHovered(handle);
    const rgba = hexToRgba(hovered ? "#fef08a" : handle.color, hovered ? 1 : 0.92);
    pushScreenLine(positionData, colorData, segment.start, segment.end, rgba);

    const head = (handle.arrowHeadPx || 9) + (hovered ? 3 : 0);
    const back = {
      x: segment.end.x - segment.unit.x * head,
      y: segment.end.y - segment.unit.y * head
    };
    const normal = { x: -segment.unit.y, y: segment.unit.x };
    pushScreenLine(positionData, colorData, segment.end, {
      x: back.x + normal.x * head * 0.55,
      y: back.y + normal.y * head * 0.55
    }, rgba);
    pushScreenLine(positionData, colorData, segment.end, {
      x: back.x - normal.x * head * 0.55,
      y: back.y - normal.y * head * 0.55
    }, rgba);
  }

  function pushRotationRing(positionData, colorData, handle) {
    const arc = projectedRotationArc(handle);
    if (!arc) return;
    const hovered = isAuthoringHovered(handle);
    const rgba = hexToRgba(hovered ? "#fef08a" : handle.color, hovered ? 1 : 0.86);
    for (let index = 1; index < arc.points.length; index += 1) {
      pushScreenLine(positionData, colorData, arc.points[index - 1], arc.points[index], rgba);
    }
    const tip = arc.points[arc.points.length - 1];
    const previous = arc.points[arc.points.length - 2];
    const dx = tip.x - previous.x;
    const dy = tip.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-6) return;
    const head = (handle.arrowHeadPx || 6) + (hovered ? 2 : 0);
    const tangent = { x: dx / length, y: dy / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const back = {
      x: tip.x - tangent.x * head,
      y: tip.y - tangent.y * head
    };
    pushScreenLine(positionData, colorData, tip, {
      x: back.x + normal.x * head * 0.55,
      y: back.y + normal.y * head * 0.55
    }, rgba);
    pushScreenLine(positionData, colorData, tip, {
      x: back.x - normal.x * head * 0.55,
      y: back.y - normal.y * head * 0.55
    }, rgba);
  }

  function pushAuthoringHandle(positionData, colorData, handle) {
    if (handle.type === "axis") {
      pushAxisHandle(positionData, colorData, handle);
      return;
    }
    if (handle.type === "rotation-ring") {
      pushRotationRing(positionData, colorData, handle);
      return;
    }
    const projected = projectOffsetPoint(handle.point, handle.screenOffsetPx);
    if (!projected) return;
    const hovered = isAuthoringHovered(handle);
    const radius = (handle.radius || 10) + (hovered ? 3 : 0);
    const color = hexToRgba(hovered ? "#fef08a" : handle.color);
    if (handle.type === "space-toggle") {
      pushScreenDiamond(positionData, colorData, projected, radius, color);
      return;
    }
    pushScreenSquare(positionData, colorData, projected, radius, color);
  }

  function pushVertex(positionData, colorData, point, rgba) {
    positionData.push(point[0], point[1], point[2]);
    colorData.push(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255);
  }

  function drawArrays(mode, positionData, colorData) {
    if (!positionData.length) return;
    const state = initRenderer();

    gl.useProgram(state.program);
    resetInstancedAttribs(state.position, state.color);
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

  function uploadBuffer(data, usage = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), usage);
    return buffer;
  }

  function resetInstancedAttribs(...locations) {
    if (!memberInstanceRenderer?.instancing) return;
    for (const location of locations) {
      if (location >= 0) memberInstanceRenderer.instancing.vertexAttribDivisorANGLE(location, 0);
    }
  }

  function deleteRenderGroup(group) {
    if (!group) return;
    if (group.positionBuffer) gl.deleteBuffer(group.positionBuffer);
    if (group.colorBuffer) gl.deleteBuffer(group.colorBuffer);
    if (group.pickColorBuffer) gl.deleteBuffer(group.pickColorBuffer);
  }

  function invalidateStaticSceneCache() {
    if (!staticSceneCache) return;
    for (const group of [
      ...(staticSceneCache.opaqueFaces || []),
      ...(staticSceneCache.transparentFaces || []),
      ...(staticSceneCache.lines || [])
    ]) {
      deleteRenderGroup(group);
    }
    staticSceneCache = null;
  }

  function invalidateMemberInstanceCache() {
    if (!memberInstanceCache) return;
    const deleted = new Set();
    const deleteOnce = (buffer) => {
      if (!buffer || deleted.has(buffer)) return;
      gl.deleteBuffer(buffer);
      deleted.add(buffer);
    };
    for (const group of memberInstanceCache.staticGroups || []) {
      deleteOnce(group.localPositionBuffer);
      deleteOnce(group.localNormalBuffer);
      deleteOnce(group.startBuffer);
      deleteOnce(group.axisXBuffer);
      deleteOnce(group.axisYBuffer);
      deleteOnce(group.axisZBuffer);
      deleteOnce(group.lengthBuffer);
      deleteOnce(group.colorBuffer);
      deleteOnce(group.pickColorBuffer);
    }
    memberInstanceCache = null;
  }

  function appendWorldVertex(group, point, rgba, pickRgba = null) {
    if (Array.isArray(group) && Array.isArray(point) && Array.isArray(rgba)) {
      const positions = group;
      const colors = point;
      const worldPoint = rgba;
      const color = pickRgba;
      if (!Array.isArray(color)) return;
      positions.push(worldPoint[0], worldPoint[1], worldPoint[2]);
      colors.push(color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255);
      return;
    }
    group.positions.push(point[0], point[1], point[2]);
    group.colors.push(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255);
    if (pickRgba) group.pickColors.push(pickRgba[0], pickRgba[1], pickRgba[2], pickRgba[3]);
  }

  function renderGroupBucket(bucket, key = "__visible") {
    let group = bucket.get(key);
    if (!group) {
      group = { lodDetailObjectId: null, positions: [], colors: [], pickColors: [] };
      bucket.set(key, group);
    }
    return group;
  }

  function uploadRenderGroups(bucket, mode) {
    return [...bucket.values()]
      .filter((group) => group.positions.length)
      .map((group) => ({
        mode,
        lodDetailObjectId: group.lodDetailObjectId,
        vertexCount: group.positions.length / 3,
        positionBuffer: uploadBuffer(new Float32Array(group.positions)),
        colorBuffer: uploadBuffer(new Float32Array(group.colors)),
        pickColorBuffer: group.pickColors.length ? uploadBuffer(new Float32Array(group.pickColors)) : null
      }));
  }

  function buildStaticSceneCache() {
    const opaqueFaces = new Map();
    const transparentFaces = new Map();
    const lineGroups = new Map();
    const defaultEdgeColor = settings.render.edges.defaultColor;

    for (const face of scene.faces) {
      if (!shouldDrawSceneItem(face)) continue;
      const surfaceGroup = renderGroupBucket((face.opacity ?? 1) >= 1 ? opaqueFaces : transparentFaces);
      const rgba = shadedRgba(shouldBakeHighlight(face) ? highlight.fill : face.color, face.points, face.opacity ?? 1);
      const pickRgba = pickColorForItem(face);
      for (const triangle of triangulateFace(face.points)) {
        for (const point of triangle) appendWorldVertex(surfaceGroup, point, rgba, pickRgba);
      }

      if (face.hideEdges) continue;
      const edgeGroup = renderGroupBucket(lineGroups);
      const edgeRgba = hexToRgba(defaultEdgeColor, face.opacity ?? 1);
      for (let i = 0; i < face.points.length; i += 1) {
        appendWorldVertex(edgeGroup, face.points[i], edgeRgba);
        appendWorldVertex(edgeGroup, face.points[(i + 1) % face.points.length], edgeRgba);
      }
    }

    for (const line of scene.lines) {
      if (!shouldDrawSceneItem(line)) continue;
      const lineGroup = renderGroupBucket(lineGroups);
      const rgba = hexToRgba(shouldBakeHighlight(line) ? highlight.edge : line.color, line.opacity ?? 1);
      appendWorldVertex(lineGroup, line.points[0], rgba);
      appendWorldVertex(lineGroup, line.points[1], rgba);
    }

    return {
      opaqueFaces: uploadRenderGroups(opaqueFaces, gl.TRIANGLES),
      transparentFaces: uploadRenderGroups(transparentFaces, gl.TRIANGLES),
      lines: uploadRenderGroups(lineGroups, gl.LINES)
    };
  }

  function drawStaticRenderGroups(groups) {
    if (!groups.length) return;
    const state = initStaticSceneRenderer();
    const view = camera.viewUniforms(scene, canvas);

    gl.useProgram(state.program);
    resetInstancedAttribs(state.position, state.color);
    gl.uniform1f(state.uniforms.yaw, view.yaw);
    gl.uniform1f(state.uniforms.pitch, view.pitch);
    gl.uniform1f(state.uniforms.scale, view.scale);
    gl.uniform2fv(state.uniforms.pan, view.pan);
    gl.uniform2fv(state.uniforms.viewport, view.viewport);
    gl.uniform3fv(state.uniforms.pivot, view.pivot);
    gl.uniform1f(state.uniforms.depthHalf, view.depthHalf);

    for (const group of groups) {
      gl.bindBuffer(gl.ARRAY_BUFFER, group.positionBuffer);
      gl.enableVertexAttribArray(state.position);
      gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, group.colorBuffer);
      gl.enableVertexAttribArray(state.color);
      gl.vertexAttribPointer(state.color, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(group.mode, 0, group.vertexCount);
    }
  }

  function drawWorldArrays(mode, positionData, colorData) {
    if (!positionData.length) return;
    const state = initStaticSceneRenderer();
    const view = camera.viewUniforms(scene, canvas);

    gl.useProgram(state.program);
    resetInstancedAttribs(state.position, state.color);
    gl.uniform1f(state.uniforms.yaw, view.yaw);
    gl.uniform1f(state.uniforms.pitch, view.pitch);
    gl.uniform1f(state.uniforms.scale, view.scale);
    gl.uniform2fv(state.uniforms.pan, view.pan);
    gl.uniform2fv(state.uniforms.viewport, view.viewport);
    gl.uniform3fv(state.uniforms.pivot, view.pivot);
    gl.uniform1f(state.uniforms.depthHalf, view.depthHalf);

    if (!state.dynamicPositionBuffer) state.dynamicPositionBuffer = gl.createBuffer();
    if (!state.dynamicColorBuffer) state.dynamicColorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, state.dynamicPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionData), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.position);
    gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.dynamicColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(state.color);
    gl.vertexAttribPointer(state.color, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(mode, 0, positionData.length / 3);
  }

  function instanceRgba(instance) {
    const rgba = hexToRgba(shouldBakeHighlight(instance) ? highlight.fill : instance.color, instance.opacity ?? 1);
    return [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255];
  }

  function buildMemberInstanceCache() {
    if (!scene?.memberInstances?.length) return { staticGroups: [] };

    const geometryBuffers = new Map();
    const geometryBufferFor = (profileId, geometry) => {
      const existing = geometryBuffers.get(profileId);
      if (existing) return existing;
      const buffers = {
        vertexCount: geometry.positions.length / 3,
        localPositionBuffer: uploadBuffer(geometry.positions),
        localNormalBuffer: uploadBuffer(geometry.normals)
      };
      geometryBuffers.set(profileId, buffers);
      return buffers;
    };

    const appendInstanceData = (group, instance) => {
      group.starts.push(...instance.start);
      group.axesX.push(...instance.axisX);
      group.axesY.push(...instance.axisY);
      group.axesZ.push(...instance.axisZ);
      group.lengths.push(instance.length);
      group.colors.push(...instanceRgba(instance));
      group.pickColors.push(...pickColorForItem(instance));
    };

    const makeDataGroup = (geometry) => ({
      geometry,
      starts: [],
      axesX: [],
      axesY: [],
      axesZ: [],
      lengths: [],
      colors: [],
      pickColors: []
    });

    const staticGroups = new Map();

    for (const instance of scene.memberInstances) {
      if (isObjectPreviewed(instance)) continue;
      const geometry = scene.memberInstanceGeometries?.[instance.profileId];
      if (!geometry?.positions?.length) continue;
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      const group = staticGroups.get(instance.profileId) || makeDataGroup(geometry);
      appendInstanceData(group, instance);
      staticGroups.set(instance.profileId, group);
    }

    const staticCaches = [...staticGroups.entries()].map(([profileId, group]) => ({
      ...geometryBufferFor(profileId, group.geometry),
      instanceCount: group.lengths.length,
      startBuffer: uploadBuffer(group.starts),
      axisXBuffer: uploadBuffer(group.axesX),
      axisYBuffer: uploadBuffer(group.axesY),
      axisZBuffer: uploadBuffer(group.axesZ),
      lengthBuffer: uploadBuffer(group.lengths),
      colorBuffer: uploadBuffer(group.colors),
      pickColorBuffer: uploadBuffer(group.pickColors)
    }));

    return { staticGroups: staticCaches };
  }

  function bindAttribute(location, buffer, size, divisor = 0) {
    if (location < 0) return;
    const state = initMemberInstanceRenderer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    state.instancing.vertexAttribDivisorANGLE(location, divisor);
  }

  function drawMemberInstances() {
    if (!scene?.memberInstances?.length) return;
    const state = initMemberInstanceRenderer();
    if (!state) return;
    if (!memberInstanceCache) memberInstanceCache = buildMemberInstanceCache();
    const groups = memberInstanceCache.staticGroups;
    if (!groups.length) return;

    const view = camera.viewUniforms(scene, canvas);
    gl.useProgram(state.program);
    gl.uniform1f(state.uniforms.yaw, view.yaw);
    gl.uniform1f(state.uniforms.pitch, view.pitch);
    gl.uniform1f(state.uniforms.scale, view.scale);
    gl.uniform2fv(state.uniforms.pan, view.pan);
    gl.uniform2fv(state.uniforms.viewport, view.viewport);
    gl.uniform3fv(state.uniforms.pivot, view.pivot);
    gl.uniform1f(state.uniforms.depthHalf, view.depthHalf);
    gl.uniform3fv(state.uniforms.light, settings.render.lighting.direction);
    gl.uniform1f(state.uniforms.ambient, settings.render.lighting.ambient);
    gl.uniform1f(state.uniforms.diffuse, settings.render.lighting.diffuse);

    for (const group of groups) {
      if (!group.instanceCount) continue;
      bindAttribute(state.localPosition, group.localPositionBuffer, 3);
      bindAttribute(state.localNormal, group.localNormalBuffer, 3);
      bindAttribute(state.start, group.startBuffer, 3, 1);
      bindAttribute(state.axisX, group.axisXBuffer, 3, 1);
      bindAttribute(state.axisY, group.axisYBuffer, 3, 1);
      bindAttribute(state.axisZ, group.axisZBuffer, 3, 1);
      bindAttribute(state.length, group.lengthBuffer, 1, 1);
      bindAttribute(state.color, group.colorBuffer, 4, 1);
      state.instancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, group.vertexCount, group.instanceCount);
    }

    for (const location of [state.localPosition, state.localNormal, state.start, state.axisX, state.axisY, state.axisZ, state.length, state.color]) {
      if (location >= 0) state.instancing.vertexAttribDivisorANGLE(location, 0);
    }
  }

  function appendMemberInstanceSurface(positionData, colorData, instance, colorOverride = null) {
    const geometry = scene.memberInstanceGeometries?.[instance.profileId];
    if (!geometry?.positions?.length) return;
    const base = hexToRgba(colorOverride || (shouldBakeHighlight(instance) ? highlight.fill : instance.color), instance.opacity ?? 1);
    const light = v.norm(settings.render.lighting.direction);

    for (let index = 0; index < geometry.positions.length; index += 3) {
      const local = [geometry.positions[index], geometry.positions[index + 1], geometry.positions[index + 2]];
      const normalLocal = [geometry.normals[index], geometry.normals[index + 1], geometry.normals[index + 2]];
      const world = v.add(instance.start, v.add(
        v.mul(instance.axisX, local[0] * instance.length),
        v.add(v.mul(instance.axisY, local[1]), v.mul(instance.axisZ, local[2]))
      ));
      const normal = v.norm(v.add(
        v.mul(instance.axisX, normalLocal[0]),
        v.add(v.mul(instance.axisY, normalLocal[1]), v.mul(instance.axisZ, normalLocal[2]))
      ));
      const shade = settings.render.lighting.ambient + Math.max(0, v.dot(normal, light)) * settings.render.lighting.diffuse;
      appendWorldVertex(positionData, colorData, world, [
        Math.round(base[0] * shade),
        Math.round(base[1] * shade),
        Math.round(base[2] * shade),
        base[3]
      ]);
    }
  }

  function appendPreviewMemberInstance(positionData, colorData, instance) {
    appendMemberInstanceSurface(positionData, colorData, transformedPreviewInstance(instance));
  }

  function drawObjectPreviewSurfaces(transparent = false) {
    if (!objectPreview) return;
    const positions = [];
    const colors = [];
    for (const instance of objectPreview.memberInstances) {
      const opacity = instance.opacity ?? 1;
      if ((opacity < 1) !== transparent) continue;
      appendPreviewMemberInstance(positions, colors, instance);
    }
    for (const face of objectPreview.faces) {
      const opacity = previewOpacity(face.opacity ?? 1);
      if ((opacity < 1) !== transparent) continue;
      const points = face.points.map(previewPoint);
      const rgba = shadedRgba(isHighlighted(face) ? highlight.fill : face.color, points, opacity);
      for (const triangle of triangulateFace(points)) {
        for (const point of triangle) appendWorldVertex(positions, colors, point, rgba);
      }
    }
    drawWorldArrays(gl.TRIANGLES, positions, colors);
  }

  function drawObjectPreviewLines() {
    if (!objectPreview) return;
    const positions = [];
    const colors = [];
    const defaultEdgeColor = settings.render.edges.defaultColor;

    for (const face of objectPreview.faces) {
      if (face.hideEdges) continue;
      const points = face.points.map(previewPoint);
      const rgba = hexToRgba(defaultEdgeColor, previewOpacity(face.opacity ?? 1));
      for (let index = 0; index < points.length; index += 1) {
        appendWorldVertex(positions, colors, points[index], rgba);
        appendWorldVertex(positions, colors, points[(index + 1) % points.length], rgba);
      }
    }

    for (const line of objectPreview.lines) {
      const rgba = hexToRgba(isHighlighted(line) ? highlight.edge : line.color, previewOpacity(line.opacity ?? 1));
      appendWorldVertex(positions, colors, previewPoint(line.points[0]), rgba);
      appendWorldVertex(positions, colors, previewPoint(line.points[1]), rgba);
    }
    drawWorldArrays(gl.LINES, positions, colors);
  }

  function drawHighlightOverlaySurfaces() {
    if (!highlightedObjectIds.size || !useHighlightOverlay()) return;
    const positions = [];
    const colors = [];
    for (const instance of memberInstancesForPick(highlightedObjectIds)) {
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      appendMemberInstanceSurface(positions, colors, instance, highlight.fill);
    }
    for (const face of scene.faces || []) {
      if (!highlightedObjectIds.has(face.objectId)) continue;
      if (!shouldDrawSceneItem(face)) continue;
      const rgba = shadedRgba(highlight.fill, face.points, face.opacity ?? 1);
      for (const triangle of triangulateFace(face.points)) {
        for (const point of triangle) appendWorldVertex(positions, colors, point, rgba);
      }
    }
    drawWorldArrays(gl.TRIANGLES, positions, colors);
  }

  function drawHighlightOverlayLines() {
    if (!highlightedObjectIds.size || !useHighlightOverlay()) return;
    const positions = [];
    const colors = [];
    const rgba = hexToRgba(highlight.edge);
    for (const face of scene.faces || []) {
      if (!highlightedObjectIds.has(face.objectId) || face.hideEdges) continue;
      if (!shouldDrawSceneItem(face)) continue;
      for (let index = 0; index < face.points.length; index += 1) {
        appendWorldVertex(positions, colors, face.points[index], rgba);
        appendWorldVertex(positions, colors, face.points[(index + 1) % face.points.length], rgba);
      }
    }
    for (const line of scene.lines || []) {
      if (!highlightedObjectIds.has(line.objectId)) continue;
      if (!shouldDrawSceneItem(line)) continue;
      appendWorldVertex(positions, colors, line.points[0], rgba);
      appendWorldVertex(positions, colors, line.points[1], rgba);
    }
    drawWorldArrays(gl.LINES, positions, colors);
  }

  function drawStaticPickGroups(groups) {
    if (!groups.length) return;
    const state = initStaticSceneRenderer();
    const view = camera.viewUniforms(scene, canvas);

    gl.useProgram(state.program);
    resetInstancedAttribs(state.position, state.color);
    gl.uniform1f(state.uniforms.yaw, view.yaw);
    gl.uniform1f(state.uniforms.pitch, view.pitch);
    gl.uniform1f(state.uniforms.scale, view.scale);
    gl.uniform2fv(state.uniforms.pan, view.pan);
    gl.uniform2fv(state.uniforms.viewport, view.viewport);
    gl.uniform3fv(state.uniforms.pivot, view.pivot);
    gl.uniform1f(state.uniforms.depthHalf, view.depthHalf);

    for (const group of groups) {
      if (!group.pickColorBuffer) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, group.positionBuffer);
      gl.enableVertexAttribArray(state.position);
      gl.vertexAttribPointer(state.position, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, group.pickColorBuffer);
      gl.enableVertexAttribArray(state.color);
      gl.vertexAttribPointer(state.color, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(group.mode, 0, group.vertexCount);
    }
  }

  function drawMemberInstancePickGroups() {
    if (!scene?.memberInstances?.length) return;
    const state = initMemberInstanceRenderer();
    if (!state) return;
    if (!memberInstanceCache) memberInstanceCache = buildMemberInstanceCache();
    const groups = memberInstanceCache.staticGroups;
    if (!groups.length) return;

    const view = camera.viewUniforms(scene, canvas);
    gl.useProgram(state.program);
    gl.uniform1f(state.uniforms.yaw, view.yaw);
    gl.uniform1f(state.uniforms.pitch, view.pitch);
    gl.uniform1f(state.uniforms.scale, view.scale);
    gl.uniform2fv(state.uniforms.pan, view.pan);
    gl.uniform2fv(state.uniforms.viewport, view.viewport);
    gl.uniform3fv(state.uniforms.pivot, view.pivot);
    gl.uniform1f(state.uniforms.depthHalf, view.depthHalf);
    gl.uniform3fv(state.uniforms.light, settings.render.lighting.direction);
    gl.uniform1f(state.uniforms.ambient, 1);
    gl.uniform1f(state.uniforms.diffuse, 0);

    for (const group of groups) {
      if (!group.instanceCount || !group.pickColorBuffer) continue;
      bindAttribute(state.localPosition, group.localPositionBuffer, 3);
      bindAttribute(state.localNormal, group.localNormalBuffer, 3);
      bindAttribute(state.start, group.startBuffer, 3, 1);
      bindAttribute(state.axisX, group.axisXBuffer, 3, 1);
      bindAttribute(state.axisY, group.axisYBuffer, 3, 1);
      bindAttribute(state.axisZ, group.axisZBuffer, 3, 1);
      bindAttribute(state.length, group.lengthBuffer, 1, 1);
      bindAttribute(state.color, group.pickColorBuffer, 4, 1);
      state.instancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, group.vertexCount, group.instanceCount);
    }

    for (const location of [state.localPosition, state.localNormal, state.start, state.axisX, state.axisY, state.axisZ, state.length, state.color]) {
      if (location >= 0) state.instancing.vertexAttribDivisorANGLE(location, 0);
    }
  }

  function pickSceneGpu(x, y, options = {}) {
    if (!scene || !gl) return null;
    if (!staticSceneCache) staticSceneCache = buildStaticSceneCache();
    if (!memberInstanceCache) memberInstanceCache = buildMemberInstanceCache();

    const background = [0, 0, 0, 1];
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    if (options.includeInstances !== false) drawMemberInstancePickGroups();
    drawStaticPickGroups(staticSceneCache.opaqueFaces);
    if (options.includeTransparent !== false) drawStaticPickGroups(staticSceneCache.transparentFaces);
    gl.disable(gl.POLYGON_OFFSET_FILL);

    const pixel = new Uint8Array(4);
    const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
    const pixelY = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor(y)));
    gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const picked = pickObjectFromPixel(pixel);
    draw();
    return picked ? { depth: 0, point: null, face: picked } : null;
  }

  function draw() {
    if (!scene || !gl) return;
    invalidateScenePickCache();
    if (!staticSceneCache) staticSceneCache = buildStaticSceneCache();
    const background = hexToRgb(settings.render.background).map((value) => value / 255);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    drawMemberInstances();
    drawStaticRenderGroups(staticSceneCache.opaqueFaces);
    drawObjectPreviewSurfaces(false);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if (highlightedObjectIds.size && useHighlightOverlay()) {
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -1);
      drawHighlightOverlaySurfaces();
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    if (staticSceneCache.transparentFaces.length || objectPreview) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawStaticRenderGroups(staticSceneCache.transparentFaces);
      drawObjectPreviewSurfaces(true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    gl.lineWidth(settings.render.edges.lineWidth);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawStaticRenderGroups(staticSceneCache.lines);
    drawObjectPreviewLines();
    drawHighlightOverlayLines();

    const authoringLinePositions = [];
    const authoringLineColors = [];
    for (const line of authoringOverlay.lines || []) {
      const rgba = hexToRgba(line.color);
      pushVertex(authoringLinePositions, authoringLineColors, clipPoint(line.points[0]), rgba);
      pushVertex(authoringLinePositions, authoringLineColors, clipPoint(line.points[1]), rgba);
    }
    drawArrays(gl.LINES, authoringLinePositions, authoringLineColors);
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
      if (isAuthoringHovered(handle)) continue;
      pushAuthoringHandle(handlePositions, handleColors, handle);
    }
    if (authoringHoveredHandle) {
      pushAuthoringHandle(handlePositions, handleColors, authoringHoveredHandle);
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
      if (commandHandler?.active?.() && event.button === 0) {
        const hitResult = pickScene(x, y);
        commandHandler.pointerDown?.({ event, screen: { x, y }, hit: hitResult });
        return;
      }
      if (pickHandler && event.button === 0 && !event.shiftKey) {
        const hitResult = pickScene(x, y);
        pickHandler(hitResult?.face || null);
        return;
      }
      const dimension = event.button === 0 && !event.shiftKey ? pickDimension(x, y) : null;
      if (dimension) {
        dimensionUi.clickDimension(dimension);
        return;
      }
      const handle = event.button === 0 && !event.shiftKey ? pickAuthoringHandle(x, y) : null;
      if (handle?.kind === "coordinate-space-toggle") {
        if (authoringHandler?.click?.({ handle, screen: { x, y } }) !== false) {
          authoringHoveredHandle = null;
          canvas.classList.remove("authoring-hover");
          requestDraw();
        }
        return;
      }
      if (handle && authoringHandler?.beginDrag?.({ handle, screen: { x, y } }) !== false) {
        authoringHoveredHandle = handle;
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
        const hitResult = fastClickPick(x, y);
        drag = {
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
        if (updateAuthoringHover(event)) {
          dimensionUi.setHoveredDimensionId(null, event);
          return;
        }
        clearAuthoringHover();
        updateDimensionHover(event);
        return;
      }
      dimensionUi.setHoveredDimensionId(null, event);
      if (drag.mode === "authoring") {
        const rect = canvas.getBoundingClientRect();
        authoringHandler?.drag?.({
          handle: drag.handle,
          dx: event.clientX - drag.x,
          dy: event.clientY - drag.y,
          totalDx: event.clientX - drag.startX,
          totalDy: event.clientY - drag.startY,
          screen: {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          }
        });
        drag.x = event.clientX;
        drag.y = event.clientY;
        requestDraw();
        return;
      }
      if (drag.mode === "pending-orbit") {
        const totalDx = event.clientX - drag.startX;
        const totalDy = event.clientY - drag.startY;
        if (Math.hypot(totalDx, totalDy) < 4) return;
        if (!drag.anchorResolved) {
          const anchor = preciseOrbitAnchor(drag.screen.x, drag.screen.y, drag.face);
          drag.hit = anchor?.point || null;
          drag.anchorResolved = true;
        }
        if (drag.hit) camera.setOrbitPivot(drag.hit, scene, canvas, drag.screen);
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
      requestDraw();
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
      if (currentDrag?.mode === "pending-orbit" && eventOrOptions?.type === "pointerup" && clickHandler) {
        if (currentDrag.face) {
          clickHandler(currentDrag.face);
        } else if (shouldUseGpuPick()) {
          clickHandler(null);
        } else {
          const rect = canvas.getBoundingClientRect();
          const x = eventOrOptions.clientX - rect.left;
          const y = eventOrOptions.clientY - rect.top;
          clickHandler(pickScene(x, y)?.face || null);
        }
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
      clearAuthoringHover();
    });

    canvas.addEventListener("wheel", (event) => {
      if (!scene) return;
      requestWheelZoom(event.deltaY, event.clientX, event.clientY);
    }, { passive: true });

    reset.addEventListener("click", () => {
      if (!scene) return;
      camera.reset();
      camera.fit(scene, canvas);
      invalidateStaticSceneCache();
      invalidateMemberInstanceCache();
      scheduleDetailScaleChange();
      draw();
    });
  }

  attachControls();

  return {
    setScene(nextScene, options = {}) {
      const preserveCamera = options.preserveCamera && scene;
      invalidateStaticSceneCache();
      invalidateMemberInstanceCache();
      invalidateMemberInstanceLookup();
      clearPendingDetailScaleChange();
      resetPickObjects();
      objectPreview = null;
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
    setDetailScaleChangeHandler(handler) {
      clearPendingDetailScaleChange();
      detailScaleChangeHandler = handler;
    },
    screenScale() {
      return camera.screenScale();
    },
    viewportSize() {
      return { width: canvas.width, height: canvas.height };
    },
    setAuthoringOverlay(overlay = { lines: [], handles: [] }) {
      authoringOverlay = overlay || { lines: [], handles: [], labels: [] };
      if (!authoringOverlay.handles?.some((handle) => authoringHandleKey(handle) === authoringHandleKey(authoringHoveredHandle))) {
        clearAuthoringHover();
      }
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
    setHighlightedObjects(objectIds = []) {
      if (sameObjectIdSet(highlightedObjectIds, objectIds)) return;
      const memberOnlyHighlight = memberOnlyHighlightChange(objectIds);
      highlightedObjectIds = new Set(objectIds);
      if (!memberOnlyHighlight) {
        invalidateMemberInstanceCache();
        invalidateStaticSceneCache();
      }
      requestDraw();
    },
    objectPoints,
    beginObjectPreview,
    updateMemberMovePreview,
    clearObjectPreview,
    updateMemberInstance,
    replaceSceneObjects,
    fitPoints(points, options = {}) {
      if (camera.fitPoints(points, canvas, options)) {
        invalidateStaticSceneCache();
        invalidateMemberInstanceCache();
        scheduleDetailScaleChange();
        draw();
      }
    },
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
