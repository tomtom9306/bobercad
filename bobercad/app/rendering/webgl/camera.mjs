import { bounds2, bounds3, clamp, finiteNumber, finiteNumberOr, validVec3Points, v } from "../../engine/core/math.mjs?v=camera-bounds2-dry-2";

function wrapAngle(value) {
  const fullTurn = Math.PI * 2;
  return ((value + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
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
    const { min, max } = bounds2(projected);
    const { width: viewportWidth, height: viewportHeight } = viewport;
    const width = Math.max(1, max[0] - min[0]);
    const height = Math.max(1, max[1] - min[1]);
    state.scale = Math.min(viewportWidth * settings.camera.fit.padding / width, viewportHeight * settings.camera.fit.padding / height);
    state.panX = settings.camera.home.pan[0];
    state.panY = settings.camera.home.pan[1];
  }

  function fitPoints(points, viewport, options = {}) {
    const validPoints = validVec3Points(points);
    if (!validPoints.length) return false;
    if (finiteNumber(options.yaw)) state.yaw = wrapAngle(options.yaw);
    if (finiteNumber(options.pitch)) state.pitch = wrapAngle(options.pitch);

    const bounds = bounds3(validPoints);
    state.pivot = [...bounds.center];
    const projected = validPoints.map((point) => {
      const r = rotate(point);
      return [r[0], r[1]];
    });
    const { min, max } = bounds2(projected);
    const minSpan = Math.max(1, options.minSpan || 1);
    const width = Math.max(minSpan, max[0] - min[0]);
    const height = Math.max(minSpan, max[1] - min[1]);
    const { width: viewportWidth, height: viewportHeight } = viewport;
    const padding = finiteNumberOr(options.padding, settings.camera.fit.padding);
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
    const { width, height } = viewport;
    const relX = x - width / 2;
    const relY = y - height / 2;
    state.panX += (relX - state.panX) * (1 - factor);
    state.panY += (relY - state.panY) * (1 - factor);
    state.scale *= factor;
  }

  function projectPoint(point, scene, viewport) {
    const r = rotate(point, scene);
    const { width, height } = viewport;
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
    const { width, height } = viewport;
    return [
      projected.x / width * 2 - 1,
      1 - projected.y / height * 2,
      projected.depth
    ];
  }

  function viewUniforms(scene, viewport) {
    const { width, height } = viewport;
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
    const { width, height } = viewport;
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
