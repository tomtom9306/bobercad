import { v } from "../../engine/core/math.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapAngle(value) {
  const fullTurn = Math.PI * 2;
  return ((value + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function viewportSize(viewport) {
  return { width: viewport.width, height: viewport.height };
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pointsBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], point[i]);
      max[i] = Math.max(max[i], point[i]);
    }
  }
  return { min, max, center: v.mul(v.add(min, max), 0.5) };
}

export function createCamera(settings) {
  let state = home();

  function home() {
    const homeSettings = settings.camera.home;
    return {
      yaw: homeSettings.yaw,
      pitch: homeSettings.pitch,
      scale: homeSettings.scale,
      panX: homeSettings.pan[0],
      panY: homeSettings.pan[1],
      pivot: [0, 0, 0]
    };
  }

  function reset() {
    state = home();
  }

  function rotate(point, scene) {
    const p = v.sub(point, state.pivot);
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const x = cy * p[0] - sy * p[1];
    const y = sy * p[0] + cy * p[1];
    const z = p[2];
    return [x, cp * y - sp * z, sp * y + cp * z];
  }

  function unrotateVector(vector) {
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const y1 = cp * vector[1] + sp * vector[2];
    const z = -sp * vector[1] + cp * vector[2];
    return [
      cy * vector[0] + sy * y1,
      -sy * vector[0] + cy * y1,
      z
    ];
  }

  function fit(scene, viewport) {
    state.pivot = [...scene.bounds.center];
    const projected = scene.vertices.map((point) => {
      const r = rotate(point, scene);
      return [r[0], r[1]];
    });
    const min = [Infinity, Infinity];
    const max = [-Infinity, -Infinity];
    for (const point of projected) {
      min[0] = Math.min(min[0], point[0]);
      min[1] = Math.min(min[1], point[1]);
      max[0] = Math.max(max[0], point[0]);
      max[1] = Math.max(max[1], point[1]);
    }
    const { width: viewportWidth, height: viewportHeight } = viewportSize(viewport);
    const width = Math.max(1, max[0] - min[0]);
    const height = Math.max(1, max[1] - min[1]);
    state.scale = Math.min(viewportWidth * settings.camera.fit.padding / width, viewportHeight * settings.camera.fit.padding / height);
    state.panX = settings.camera.home.pan[0];
    state.panY = settings.camera.home.pan[1];
  }

  function fitPoints(points, viewport, options = {}) {
    const validPoints = (points || []).filter((point) => Array.isArray(point) && point.length === 3 && point.every(finiteNumber));
    if (!validPoints.length) return false;
    if (finiteNumber(options.yaw)) state.yaw = wrapAngle(options.yaw);
    if (finiteNumber(options.pitch)) state.pitch = wrapAngle(options.pitch);

    const bounds = pointsBounds(validPoints);
    state.pivot = [...bounds.center];
    const projected = validPoints.map((point) => {
      const r = rotate(point);
      return [r[0], r[1]];
    });
    const min = [Infinity, Infinity];
    const max = [-Infinity, -Infinity];
    for (const point of projected) {
      min[0] = Math.min(min[0], point[0]);
      min[1] = Math.min(min[1], point[1]);
      max[0] = Math.max(max[0], point[0]);
      max[1] = Math.max(max[1], point[1]);
    }
    const minSpan = Math.max(1, options.minSpan || 1);
    const width = Math.max(minSpan, max[0] - min[0]);
    const height = Math.max(minSpan, max[1] - min[1]);
    const { width: viewportWidth, height: viewportHeight } = viewportSize(viewport);
    const padding = finiteNumber(options.padding) ? options.padding : settings.camera.fit.padding;
    state.scale = Math.min(viewportWidth * padding / width, viewportHeight * padding / height);
    state.panX = 0;
    state.panY = 0;
    return true;
  }

  function orbit(dx, dy) {
    const controls = settings.controls;
    state.yaw = wrapAngle(state.yaw + dx * controls.orbitSpeed);
    state.pitch = wrapAngle(state.pitch + dy * controls.orbitSpeed);
  }

  function pan(dx, dy) {
    const speed = settings.controls.panSpeed ?? 1;
    state.panX += dx * speed;
    state.panY += dy * speed;
  }

  function zoomAt(deltaY, x, y, viewport) {
    const factor = deltaY > 0 ? settings.controls.zoomOutFactor : settings.controls.zoomInFactor;
    const { width, height } = viewportSize(viewport);
    const relX = x - width / 2;
    const relY = y - height / 2;
    state.panX += (relX - state.panX) * (1 - factor);
    state.panY += (relY - state.panY) * (1 - factor);
    state.scale *= factor;
  }

  function projectPoint(point, scene, viewport) {
    const r = rotate(point, scene);
    const { width, height } = viewportSize(viewport);
    const x = width / 2 + state.panX + r[0] * state.scale;
    const y = height / 2 + state.panY - r[1] * state.scale;
    const pivotOffset = scene.bounds.center ? v.len(v.sub(state.pivot, scene.bounds.center)) : 0;
    const depthHalf = Math.max(settings.camera.fit.minDepthHalf, (scene.bounds.depthHalf || 1) + pivotOffset);
    return {
      x,
      y,
      depth: clamp(-r[2] / depthHalf, -1, 1)
    };
  }

  function clipPoint(point, scene, viewport) {
    const projected = projectPoint(point, scene, viewport);
    const { width, height } = viewportSize(viewport);
    return [
      projected.x / width * 2 - 1,
      1 - projected.y / height * 2,
      projected.depth
    ];
  }

  function viewUniforms(scene, viewport) {
    const { width, height } = viewportSize(viewport);
    const pivotOffset = scene.bounds.center ? v.len(v.sub(state.pivot, scene.bounds.center)) : 0;
    return {
      yaw: state.yaw,
      pitch: state.pitch,
      scale: state.scale,
      pan: [state.panX, state.panY],
      pivot: [...state.pivot],
      viewport: [width, height],
      depthHalf: Math.max(settings.camera.fit.minDepthHalf, (scene.bounds.depthHalf || 1) + pivotOffset)
    };
  }

  function setOrbitPivot(point, scene, viewport, screenAnchor = null) {
    const anchor = screenAnchor || projectPoint(point, scene, viewport);
    state.pivot = [...point];
    const projected = projectPoint(point, scene, viewport);
    state.panX += anchor.x - projected.x;
    state.panY += anchor.y - projected.y;
  }

  function screenDeltaToWorld(dx, dy) {
    return unrotateVector([dx / state.scale, -dy / state.scale, 0]);
  }

  function screenRay(x, y, viewport) {
    const { width, height } = viewportSize(viewport);
    const viewX = (x - width / 2 - state.panX) / state.scale;
    const viewY = -(y - height / 2 - state.panY) / state.scale;
    return {
      origin: v.add(state.pivot, unrotateVector([viewX, viewY, 0])),
      direction: v.norm(unrotateVector([0, 0, -1]))
    };
  }

  function screenScale() {
    return state.scale;
  }

  return { clipPoint, fit, fitPoints, orbit, pan, projectPoint, reset, screenDeltaToWorld, screenRay, screenScale, setOrbitPivot, viewUniforms, zoomAt };
}
