import { v } from "../core/math.mjs";

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
    const depthHalf = Math.max(settings.camera.fit.minDepthHalf, scene.bounds.depthHalf || 1);
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

  function setOrbitPivot(point, scene, viewport, screenAnchor = null) {
    const anchor = screenAnchor || projectPoint(point, scene, viewport);
    state.pivot = [...point];
    const projected = projectPoint(point, scene, viewport);
    state.panX += anchor.x - projected.x;
    state.panY += anchor.y - projected.y;
  }

  return { clipPoint, fit, orbit, pan, projectPoint, reset, setOrbitPivot, zoomAt };
}
