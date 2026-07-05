import { clamp, finiteNumber, finiteNumberOr, screenDistance, v } from "../../engine/core/math.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";

function pickableFaceTriangles(points) {
  try {
    return triangulateFace(points);
  } catch {
    return [];
  }
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

function memberInstancePoint(instance, x, y, z) {
  return v.add(instance.start, v.add(
    v.mul(instance.axisX, x * instance.length),
    v.add(v.mul(instance.axisY, y), v.mul(instance.axisZ, z))
  ));
}

export function createWebglPicker({
  canvas,
  camera,
  getScene,
  lodDetailVisible,
  shouldDrawSceneItem,
  shouldUseGpuPick,
  pickSceneGpu,
  hasWebgl
}) {
  let projectedSceneTriangles = null;
  let memberInstanceLookup = null;

  function scene() {
    return getScene();
  }

  function clipPoint(point) {
    return camera.clipPoint(point, scene(), canvas);
  }

  function invalidateScenePickCache() {
    projectedSceneTriangles = null;
  }

  function invalidateMemberInstanceLookup() {
    memberInstanceLookup = null;
  }

  function memberInstancesForPick(objectIds = null) {
    const currentScene = scene();
    if (!currentScene?.memberInstances?.length) return [];
    if (!objectIds) return currentScene.memberInstances;
    if (!memberInstanceLookup) {
      memberInstanceLookup = new Map();
      for (const instance of currentScene.memberInstances) {
        const bucket = memberInstanceLookup.get(instance.objectId) || [];
        bucket.push(instance);
        memberInstanceLookup.set(instance.objectId, bucket);
      }
    }
    const instances = [];
    for (const objectId of objectIds) instances.push(...(memberInstanceLookup.get(objectId) || []));
    return instances;
  }

  function scenePickTriangles(options = {}) {
    const currentScene = scene();
    const filteredIds = options.objectIds ? new Set(options.objectIds) : null;
    const componentKind = options.componentKind || null;
    const cacheable = !filteredIds && !componentKind;
    if (cacheable && projectedSceneTriangles) return projectedSceneTriangles;
    if (!currentScene) return [];
    const triangles = [];
    for (const face of currentScene.faces) {
      if (filteredIds && !filteredIds.has(face.objectId)) continue;
      if (componentKind && face.componentKind !== componentKind) continue;
      if (!shouldDrawSceneItem(face)) continue;
      for (const triangle of pickableFaceTriangles(face.points)) {
        const projected = triangle.map((point) => camera.projectPoint(point, currentScene, canvas));
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
    if (cacheable) projectedSceneTriangles = triangles;
    return triangles;
  }

  function screenLineParameter(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-9) return 0;
    return clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  }

  function pickMemberInstance(x, y, options = {}) {
    const currentScene = scene();
    if (!currentScene?.memberInstances?.length) return null;
    const cursor = { x, y };
    const objectIds = options.objectIds ? new Set(options.objectIds) : null;
    let best = null;

    for (const instance of memberInstancesForPick(objectIds)) {
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      const a = camera.projectPoint(instance.start, currentScene, canvas);
      const b = camera.projectPoint(v.add(instance.start, v.mul(instance.axisX, instance.length)), currentScene, canvas);
      const t = screenLineParameter(cursor, a, b);
      const closestScreen = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const distance = screenDistance(cursor, closestScreen);
      const radiusPx = instance.profileRadius * camera.screenScale();
      const threshold = clamp(radiusPx, 6, 16);
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

  function pickMemberInstanceGeometry(x, y, options = {}) {
    const currentScene = scene();
    if (!currentScene?.memberInstances?.length) return null;
    const cursor = { x, y };
    const objectIds = options.objectIds ? new Set(options.objectIds) : null;
    let best = null;

    for (const instance of memberInstancesForPick(objectIds)) {
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      const positions = currentScene.memberInstanceGeometries?.[instance.profileId]?.positions;
      if (!Array.isArray(positions) || positions.length < 9) continue;
      for (let index = 0; index <= positions.length - 9; index += 9) {
        const triangle = [
          memberInstancePoint(instance, positions[index], positions[index + 1], positions[index + 2]),
          memberInstancePoint(instance, positions[index + 3], positions[index + 4], positions[index + 5]),
          memberInstancePoint(instance, positions[index + 6], positions[index + 7], positions[index + 8])
        ];
        const projected = triangle.map((point) => camera.projectPoint(point, currentScene, canvas));
        const minX = Math.min(projected[0].x, projected[1].x, projected[2].x);
        const maxX = Math.max(projected[0].x, projected[1].x, projected[2].x);
        const minY = Math.min(projected[0].y, projected[1].y, projected[2].y);
        const maxY = Math.max(projected[0].y, projected[1].y, projected[2].y);
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        const weights = barycentric(cursor, projected[0], projected[1], projected[2]);
        if (!weights) continue;
        const depth = projected[0].depth * weights[0] + projected[1].depth * weights[1] + projected[2].depth * weights[2];
        if (!best || depth < best.depth) {
          const normal = faceNormal(triangle);
          best = {
            depth,
            point: interpolatePoint(triangle, weights),
            normal,
            triangle,
            face: {
              collection: instance.collection,
              objectId: instance.objectId,
              normal
            }
          };
        }
      }
    }

    return best;
  }

  function pickScene(x, y, options = {}) {
    const currentScene = scene();
    if (!currentScene) return null;
    const filteredPick = Boolean(options.objectIds || options.componentKind);
    if (!options.forceCpu && shouldUseGpuPick() && !filteredPick) return pickSceneGpu(x, y, options);
    const cursor = { x, y };
    const objectIds = options.objectIds ? new Set(options.objectIds) : null;
    let best = null;
    for (const item of scenePickTriangles({ objectIds, componentKind: options.componentKind })) {
      const { face, projected, triangle } = item;
      if (options.includeTransparent === false && (face.opacity ?? 1) < 1) continue;
      if (x < item.minX || x > item.maxX || y < item.minY || y > item.maxY) continue;
      const weights = barycentric(cursor, projected[0], projected[1], projected[2]);
      if (!weights) continue;
      const depth = projected[0].depth * weights[0] + projected[1].depth * weights[1] + projected[2].depth * weights[2];
      if (!best || depth < best.depth) {
        const normal = faceNormal(triangle);
        best = {
          depth,
          point: interpolatePoint(triangle, weights),
          normal,
          triangle,
          face: {
            ...face,
            normal
          }
        };
      }
    }
    if (options.includeInstances === false) return best;
    const memberHit = options.preciseInstances === true
      ? pickMemberInstanceGeometry(x, y, { objectIds })
      : pickMemberInstance(x, y, { objectIds });
    if (!memberHit) return best;
    if (!best || memberHit.depth < best.depth) return memberHit;
    return best;
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

  function pickCursorDepth(x, y, options = {}) {
    if (options.forceGpu !== true && !shouldUseGpuPick()) {
      return pickScene(x, y, { forceCpu: true, includeTransparent: false });
    }
    const coarse = hasWebgl() ? pickSceneGpu(x, y, { includeTransparent: false }) : null;
    if (options.forceGpu === true) return coarse || null;
    if (!coarse?.face?.objectId) return pickScene(x, y, { forceCpu: true, includeTransparent: false });
    const precise = pickScene(x, y, {
      forceCpu: true,
      includeTransparent: false,
      objectIds: [coarse.face.objectId],
      preciseInstances: true
    });
    return precise || coarse;
  }

  function preciseVisibilityHit(hit, screen) {
    return hit?.face?.objectId && v.isVec3(hit.point)
      ? { ...hit, screen }
      : null;
  }

  function snapVisibilityAt(screen, options = {}) {
    const currentScene = scene();
    if (!currentScene || !finiteNumber(screen?.x) || !finiteNumber(screen?.y)) return null;
    const radiusPx = clamp(Math.floor(finiteNumberOr(options.radiusPx, 0)), 0, 4);
    const requirePrecise = options.requirePrecise === true;
    const offsets = radiusPx > 0
      ? [[0, 0], [-radiusPx, 0], [radiusPx, 0], [0, -radiusPx], [0, radiusPx]]
      : [[0, 0]];
    for (const [dx, dy] of offsets) {
      const sample = { x: screen.x + dx, y: screen.y + dy };
      if (hasWebgl() && options.forceCpu !== true) {
        const gpuHit = pickSceneGpu(sample.x, sample.y, {
          includeTransparent: options.includeTransparent !== false,
          includeInstances: options.includeInstances !== false
        });
        if (gpuHit?.face?.objectId) {
          if (!requirePrecise) return { ...gpuHit, screen: sample };
          const preciseHit = pickScene(sample.x, sample.y, {
            forceCpu: true,
            includeTransparent: options.includeTransparent !== false,
            includeInstances: options.includeInstances !== false,
            objectIds: [gpuHit.face.objectId],
            preciseInstances: true
          });
          const precise = preciseVisibilityHit(preciseHit, sample);
          if (precise) return precise;
          if (!requirePrecise) return { ...gpuHit, screen: sample };
        }
      }
      const staticHit = pickScene(sample.x, sample.y, {
        forceCpu: true,
        includeTransparent: options.includeTransparent !== false,
        includeInstances: false
      });
      const preciseStatic = preciseVisibilityHit(staticHit, sample);
      if (preciseStatic) return preciseStatic;
      if (options.includeInstances === false) continue;
      const instanceHit = pickScene(sample.x, sample.y, {
        forceCpu: true,
        includeTransparent: options.includeTransparent !== false,
        includeInstances: true,
        preciseInstances: true
      });
      const preciseInstance = preciseVisibilityHit(instanceHit, sample);
      if (preciseInstance) return preciseInstance;
    }
    return null;
  }

  return {
    clipPoint,
    invalidateScenePickCache,
    invalidateMemberInstanceLookup,
    pickScene,
    pickOrbitAnchor,
    fastClickPick,
    preciseOrbitAnchor,
    pickCursorDepth,
    snapVisibilityAt
  };
}
