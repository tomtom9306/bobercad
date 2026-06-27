import { finiteNumberOr, v } from "../../engine/core/math.mjs";
import { arrayValues } from "../../engine/core/model.mjs";
import { libraryProfileById } from "../../engine/api/project/profiles.mjs";
import { faceNormal, triangulateFace } from "../../engine/geometry/polygon.mjs";
import { hexToRgb, hexToRgba } from "./colors.mjs";
import { createTextLabelRenderer } from "./text-label-renderer.mjs";
import { createWebglDrawRuntime } from "./webgl-draw-utils.mjs";
import { createWebglProgramRegistry } from "./webgl-programs.mjs";
import { highlightedObjectIdsForOverlay as filteredHighlightedObjectIds } from "./webgl-highlight-policy.mjs";

export function createWebglRenderOrchestrator({
  gl,
  canvas,
  settings,
  camera,
  getScene,
  getDisplayMode,
  getHighlightedObjectIds,
  getHighlightedObjectColor,
  getAuthoringOverlay,
  getAuthoringHoveredHandle,
  getDimensionOverlay,
  getAuthoringPreviewScene,
  objectPreview,
  dimensionUi,
  pickColorForItem,
  pickObjectFromPixel,
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
}) {
  const programs = createWebglProgramRegistry(gl);
  const sceneTextRenderer = gl ? createTextLabelRenderer(gl, canvas, settings) : null;
  const dimensionTextRenderer = gl ? createTextLabelRenderer(gl, canvas, settings) : null;
  let scene = null;
  let staticSceneCache = null;
  let memberInstanceCache = null;

  function initRenderer() {
    return programs.initRenderer();
  }

  function initStaticSceneRenderer() {
    return programs.initStaticSceneRenderer();
  }

  function initMemberInstanceRenderer() {
    return programs.initMemberInstanceRenderer();
  }

  const drawRuntime = createWebglDrawRuntime({
    gl,
    canvas,
    initRenderer,
    initMemberInstanceRenderer
  });
  const {
    drawArrays,
    uploadBuffer,
    deleteRenderGroup,
    pushVertex,
    pushScreenLine,
    pushScreenSquare,
    pushScreenDiamond,
    pushScreenCircle
  } = drawRuntime;

  function refreshScene() {
    scene = getScene();
    return scene;
  }

  function clipPoint(point) {
    return scene ? camera.clipPoint(point, scene, canvas) : null;
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

  function hideDimensionsBehindGeometry() {
    return false;
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
    if (handle.visible === false) return;
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
    const hoverGrow = finiteNumberOr(handle.hoverRadiusAddPx, 3);
    const radius = (handle.radius || 10) + (hovered ? hoverGrow : 0);
    const color = hexToRgba(
      hovered ? handle.hoverColor || "#fef08a" : handle.color,
      hovered ? finiteNumberOr(handle.hoverOpacity, 1) : finiteNumberOr(handle.opacity, 1)
    );
    if (handle.type === "space-toggle") {
      pushScreenDiamond(positionData, colorData, projected, radius, color);
      return;
    }
    if (handle.type === "circle") {
      pushScreenCircle(positionData, colorData, projected, radius, color);
      return;
    }
    pushScreenSquare(positionData, colorData, projected, radius, color);
  }

  function invalidateStaticSceneCache() {
    if (!staticSceneCache) return;
    for (const group of [
      ...arrayValues(staticSceneCache.opaqueFaces),
      ...arrayValues(staticSceneCache.transparentFaces),
      ...arrayValues(staticSceneCache.lines),
      ...arrayValues(staticSceneCache.xrayLines)
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
    for (const group of arrayValues(memberInstanceCache.staticGroups)) {
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

  function invalidateRenderableCaches() {
    invalidateStaticSceneCache();
    invalidateMemberInstanceCache();
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
    const xrayLineGroups = new Map();
    const defaultEdgeColor = settings.render.edges.defaultColor;
    for (const face of scene.faces) {
      if (!shouldDrawSceneItem(face)) continue;
      const surfaceGroup = renderGroupBucket((face.opacity ?? 1) >= 1 ? opaqueFaces : transparentFaces);
      const rgba = shadedRgba(face.color, face.points, face.opacity ?? 1);
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
      const lineGroup = renderGroupBucket(line.depthTest === false ? xrayLineGroups : lineGroups);
      const rgba = hexToRgba(line.color, line.opacity ?? 1);
      appendWorldVertex(lineGroup, line.points[0], rgba);
      appendWorldVertex(lineGroup, line.points[1], rgba);
    }
    return {
      opaqueFaces: uploadRenderGroups(opaqueFaces, gl.TRIANGLES),
      transparentFaces: uploadRenderGroups(transparentFaces, gl.TRIANGLES),
      lines: uploadRenderGroups(lineGroups, gl.LINES),
      xrayLines: uploadRenderGroups(xrayLineGroups, gl.LINES)
    };
  }

  function drawStaticRenderGroups(groups) {
    if (!groups.length) return;
    const state = prepareStaticSceneRenderer();
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
    const state = prepareStaticSceneRenderer();
    if (!state.dynamicPositionBuffer) state.dynamicPositionBuffer = gl.createBuffer();
    if (!state.dynamicColorBuffer) state.dynamicColorBuffer = gl.createBuffer();
    drawRuntime.uploadDynamicAttribute(state.dynamicPositionBuffer, state.position, 3, positionData);
    drawRuntime.uploadDynamicAttribute(state.dynamicColorBuffer, state.color, 4, colorData);
    gl.drawArrays(mode, 0, positionData.length / 3);
  }

  function highlightColor(objectId, fallback = "#38bdf8") {
    return getHighlightedObjectColor?.(objectId) || fallback;
  }

  function instanceRgba(instance) {
    const rgba = hexToRgba(highlightColor(instance.objectId, instance.color), instance.opacity ?? 1);
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
      if (objectPreview.isPreviewed(instance)) continue;
      const geometry = scene.memberInstanceGeometries?.[instance.profileId];
      if (!geometry?.positions?.length) continue;
      if (instance.lodDetailObjectId && scene.emptyLodDetailObjectIds?.has?.(instance.lodDetailObjectId)) continue;
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

  function prepareStaticSceneRenderer() {
    const state = initStaticSceneRenderer();
    const view = camera.viewUniforms(scene, canvas);
    gl.useProgram(state.program);
    drawRuntime.resetInstancedAttribs(state.position, state.color);
    setViewUniforms(state, view);
    return state;
  }

  function setViewUniforms(state, view) {
    const { uniforms } = state;
    gl.uniform1f(uniforms.yaw, view.yaw);
    gl.uniform1f(uniforms.pitch, view.pitch);
    gl.uniform1f(uniforms.scale, view.scale);
    gl.uniform2fv(uniforms.pan, view.pan);
    gl.uniform2fv(uniforms.viewport, view.viewport);
    gl.uniform3fv(uniforms.pivot, view.pivot);
    gl.uniform1f(uniforms.depthHalf, view.depthHalf);
  }

  function setLightingUniforms(state, ambient, diffuse) {
    const { uniforms } = state;
    gl.uniform3fv(uniforms.light, settings.render.lighting.direction);
    gl.uniform1f(uniforms.ambient, ambient);
    gl.uniform1f(uniforms.diffuse, diffuse);
  }

  function memberInstanceAttributeLocations(state) {
    return [state.localPosition, state.localNormal, state.start, state.axisX, state.axisY, state.axisZ, state.length, state.color];
  }

  function bindMemberInstanceGroup(state, group, colorBuffer) {
    bindAttribute(state.localPosition, group.localPositionBuffer, 3);
    bindAttribute(state.localNormal, group.localNormalBuffer, 3);
    bindAttribute(state.start, group.startBuffer, 3, 1);
    bindAttribute(state.axisX, group.axisXBuffer, 3, 1);
    bindAttribute(state.axisY, group.axisYBuffer, 3, 1);
    bindAttribute(state.axisZ, group.axisZBuffer, 3, 1);
    bindAttribute(state.length, group.lengthBuffer, 1, 1);
    bindAttribute(state.color, colorBuffer, 4, 1);
  }

  function resetMemberInstanceDivisors(state) {
    for (const location of memberInstanceAttributeLocations(state)) {
      if (location >= 0) state.instancing.vertexAttribDivisorANGLE(location, 0);
    }
  }

  function preparedMemberInstanceGroups() {
    if (!scene?.memberInstances?.length) return null;
    const state = initMemberInstanceRenderer();
    if (!state) return null;
    if (!memberInstanceCache) memberInstanceCache = buildMemberInstanceCache();
    const groups = memberInstanceCache.staticGroups;
    return groups.length ? { state, groups } : null;
  }

  function prepareMemberInstanceDraw(ambient, diffuse) {
    const prepared = preparedMemberInstanceGroups();
    if (!prepared) return null;
    const view = camera.viewUniforms(scene, canvas);
    gl.useProgram(prepared.state.program);
    setViewUniforms(prepared.state, view);
    setLightingUniforms(prepared.state, ambient, diffuse);
    return prepared;
  }

  function drawMemberInstances() {
    const prepared = prepareMemberInstanceDraw(settings.render.lighting.ambient, settings.render.lighting.diffuse);
    if (!prepared) return;
    const { state, groups } = prepared;
    for (const group of groups) {
      if (!group.instanceCount) continue;
      bindMemberInstanceGroup(state, group, group.colorBuffer);
      state.instancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, group.vertexCount, group.instanceCount);
    }
    resetMemberInstanceDivisors(state);
  }

  function appendMemberInstanceSurface(positionData, colorData, instance, colorOverride = null, sourceScene = scene) {
    const geometry = sourceScene?.memberInstanceGeometries?.[instance.profileId];
    if (!geometry?.positions?.length) return;
    const base = hexToRgba(colorOverride || instance.color, instance.opacity ?? 1);
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

  function appendWorldLine(positionData, colorData, a, b, rgba) {
    appendWorldVertex(positionData, colorData, a, rgba);
    appendWorldVertex(positionData, colorData, b, rgba);
  }

  function memberInstancePoint(instance, x, y, z) {
    return v.add(instance.start, v.add(
      v.mul(instance.axisX, x * instance.length),
      v.add(v.mul(instance.axisY, y), v.mul(instance.axisZ, z))
    ));
  }

  function appendMemberInstanceOutline(positionData, colorData, instance, rgba, sourceScene = scene) {
    const contours = arrayValues(libraryProfileById(sourceScene?.profiles, instance.profileId)?.section?.contours);
    for (const contour of contours) {
      const points = arrayValues(contour.points);
      if (points.length < 2) continue;
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        appendWorldLine(positionData, colorData, memberInstancePoint(instance, 0, a[0], a[1]), memberInstancePoint(instance, 0, b[0], b[1]), rgba);
        appendWorldLine(positionData, colorData, memberInstancePoint(instance, 1, a[0], a[1]), memberInstancePoint(instance, 1, b[0], b[1]), rgba);
        appendWorldLine(positionData, colorData, memberInstancePoint(instance, 0, a[0], a[1]), memberInstancePoint(instance, 1, a[0], a[1]), rgba);
      }
    }
  }

  function drawObjectPreviewSurfaces(transparent = false) {
    const preview = objectPreview.get();
    if (!preview) return;
    const positions = [];
    const colors = [];
    for (const instance of preview.memberInstances) {
      const opacity = instance.opacity ?? 1;
      if ((opacity < 1) !== transparent) continue;
      appendMemberInstanceSurface(positions, colors, objectPreview.transformedPreviewInstance(instance));
    }
    for (const face of preview.faces) {
      const opacity = objectPreview.previewOpacity(face.opacity ?? 1);
      if ((opacity < 1) !== transparent) continue;
      const points = face.points.map((point) => objectPreview.previewPointForItem(face, point));
      const rgba = shadedRgba(face.color, points, opacity);
      for (const triangle of triangulateFace(points)) {
        for (const point of triangle) appendWorldVertex(positions, colors, point, rgba);
      }
    }
    drawWorldArrays(gl.TRIANGLES, positions, colors);
  }

  function drawAuthoringPreviewSurfaces(transparent = false) {
    const authoringPreviewScene = getAuthoringPreviewScene();
    if (!authoringPreviewScene) return;
    const positions = [];
    const colors = [];
    for (const instance of arrayValues(authoringPreviewScene.memberInstances)) {
      const opacity = instance.opacity ?? 1;
      if ((opacity < 1) !== transparent) continue;
      appendMemberInstanceSurface(positions, colors, instance, null, authoringPreviewScene);
    }
    for (const face of arrayValues(authoringPreviewScene.faces)) {
      const opacity = face.opacity ?? 1;
      if ((opacity < 1) !== transparent) continue;
      const rgba = shadedRgba(face.color, face.points, opacity);
      for (const triangle of triangulateFace(face.points)) {
        for (const point of triangle) appendWorldVertex(positions, colors, point, rgba);
      }
    }
    drawWorldArrays(gl.TRIANGLES, positions, colors);
  }

  function drawObjectPreviewLines() {
    const preview = objectPreview.get();
    if (!preview) return;
    const positions = [];
    const colors = [];
    const defaultEdgeColor = settings.render.edges.defaultColor;
    for (const face of preview.faces) {
      if (face.hideEdges) continue;
      const points = face.points.map((point) => objectPreview.previewPointForItem(face, point));
      const rgba = hexToRgba(defaultEdgeColor, objectPreview.previewOpacity(face.opacity ?? 1));
      for (let index = 0; index < points.length; index += 1) {
        appendWorldVertex(positions, colors, points[index], rgba);
        appendWorldVertex(positions, colors, points[(index + 1) % points.length], rgba);
      }
    }
    for (const line of preview.lines) {
      const rgba = hexToRgba(line.color, objectPreview.previewOpacity(line.opacity ?? 1));
      appendWorldVertex(positions, colors, objectPreview.previewPointForItem(line, line.points[0]), rgba);
      appendWorldVertex(positions, colors, objectPreview.previewPointForItem(line, line.points[1]), rgba);
    }
    drawWorldArrays(gl.LINES, positions, colors);
  }

  function drawAuthoringPreviewLines() {
    const authoringPreviewScene = getAuthoringPreviewScene();
    if (!authoringPreviewScene) return;
    const positions = [];
    const colors = [];
    const defaultEdgeColor = settings.render.edges.defaultColor;
    for (const instance of arrayValues(authoringPreviewScene.memberInstances)) {
      appendMemberInstanceOutline(positions, colors, instance, hexToRgba(instance.edgeColor || defaultEdgeColor, instance.opacity ?? 1), authoringPreviewScene);
    }
    for (const face of arrayValues(authoringPreviewScene.faces)) {
      if (face.hideEdges) continue;
      const rgba = hexToRgba(face.edgeColor || defaultEdgeColor, face.opacity ?? 1);
      for (let index = 0; index < face.points.length; index += 1) {
        appendWorldVertex(positions, colors, face.points[index], rgba);
        appendWorldVertex(positions, colors, face.points[(index + 1) % face.points.length], rgba);
      }
    }
    for (const line of arrayValues(authoringPreviewScene.lines)) {
      const rgba = hexToRgba(line.color, line.opacity ?? 1);
      appendWorldVertex(positions, colors, line.points[0], rgba);
      appendWorldVertex(positions, colors, line.points[1], rgba);
    }
    drawWorldArrays(gl.LINES, positions, colors);
  }

  function drawHighlightOverlayLines() {
    const visibleHighlightedObjectIds = filteredHighlightedObjectIds(getHighlightedObjectIds(), getAuthoringOverlay());
    if (!visibleHighlightedObjectIds.size || !useHighlightOverlay()) return;
    const positions = [];
    const colors = [];
    for (const instance of arrayValues(scene.memberInstances)) {
      if (!visibleHighlightedObjectIds.has(instance.objectId)) continue;
      if (instance.lodDetailObjectId && scene.emptyLodDetailObjectIds?.has?.(instance.lodDetailObjectId)) continue;
      if (instance.lodDetailObjectId && lodDetailVisible(instance.lodDetailObjectId)) continue;
      const rgba = hexToRgba(highlightColor(instance.objectId));
      appendMemberInstanceOutline(positions, colors, instance, rgba);
    }
    for (const face of arrayValues(scene.faces)) {
      if (!visibleHighlightedObjectIds.has(face.objectId) || face.hideEdges) continue;
      if (!shouldDrawSceneItem(face)) continue;
      const rgba = hexToRgba(highlightColor(face.objectId));
      for (let index = 0; index < face.points.length; index += 1) {
        appendWorldLine(positions, colors, face.points[index], face.points[(index + 1) % face.points.length], rgba);
      }
    }
    for (const line of arrayValues(scene.lines)) {
      if (!visibleHighlightedObjectIds.has(line.objectId)) continue;
      if (!shouldDrawSceneItem(line)) continue;
      const rgba = hexToRgba(highlightColor(line.objectId));
      appendWorldLine(positions, colors, line.points[0], line.points[1], rgba);
    }
    drawWorldArrays(gl.LINES, positions, colors);
  }

  function drawStaticPickGroups(groups) {
    if (!groups.length) return;
    const state = prepareStaticSceneRenderer();
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
    const prepared = prepareMemberInstanceDraw(1, 0);
    if (!prepared) return;
    const { state, groups } = prepared;
    for (const group of groups) {
      if (!group.instanceCount || !group.pickColorBuffer) continue;
      bindMemberInstanceGroup(state, group, group.pickColorBuffer);
      state.instancing.drawArraysInstancedANGLE(gl.TRIANGLES, 0, group.vertexCount, group.instanceCount);
    }
    resetMemberInstanceDivisors(state);
  }

  function pickSceneGpu(x, y, options = {}) {
    if (!refreshScene() || !gl) return null;
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
    const pixelX = Math.max(0, Math.min(Math.floor(x), canvas.width - 1));
    const pixelY = Math.max(0, Math.min(canvas.height - 1 - Math.floor(y), canvas.height - 1));
    gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const picked = pickObjectFromPixel(pixel);
    draw();
    return picked ? { depth: 0, point: null, face: picked } : null;
  }

  function draw() {
    if (!refreshScene() || !gl) return;
    invalidateScenePickCache();
    if (!staticSceneCache) staticSceneCache = buildStaticSceneCache();
    const background = hexToRgb(settings.render.background).map((value) => value / 255);
    const wireframeMode = getDisplayMode() === "wireframe";
    const authoringPreviewScene = getAuthoringPreviewScene();
    const activeObjectPreview = objectPreview.get();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    if (!wireframeMode) {
      drawMemberInstances();
      drawStaticRenderGroups(staticSceneCache.opaqueFaces);
      drawObjectPreviewSurfaces(false);
      drawAuthoringPreviewSurfaces(false);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    if (!wireframeMode && (staticSceneCache.transparentFaces.length || activeObjectPreview || authoringPreviewScene)) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawStaticRenderGroups(staticSceneCache.transparentFaces);
      drawObjectPreviewSurfaces(true);
      drawAuthoringPreviewSurfaces(true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.lineWidth(settings.render.edges.lineWidth);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    drawStaticRenderGroups(staticSceneCache.lines);
    if (staticSceneCache.xrayLines?.length) {
      gl.disable(gl.DEPTH_TEST);
      drawStaticRenderGroups(staticSceneCache.xrayLines);
      gl.enable(gl.DEPTH_TEST);
    }
    sceneTextRenderer?.draw({
      labels: arrayValues(scene.labels),
      projectPoint,
      screenScale: () => camera.screenScale(),
      isHovered: () => false,
      hideBehindGeometry: false
    });
    drawObjectPreviewLines();
    drawAuthoringPreviewLines();
    gl.lineWidth(Math.max(2, settings.render.edges.lineWidth));
    drawHighlightOverlayLines();
    gl.lineWidth(settings.render.edges.lineWidth);
    drawAuthoringFaces();
    drawAuthoringLines();
    gl.disable(gl.BLEND);
    drawDimensionLines();
    drawDimensionLabels();
    drawAuthoringHandles();
    dimensionUi.renderLabels();
    renderAuthoringLabels();
    renderSceneCallouts();
  }

  function drawAuthoringFaces() {
    const authoringOverlay = getAuthoringOverlay();
    const depthTestedAuthoringFacePositions = [];
    const depthTestedAuthoringFaceColors = [];
    const xrayAuthoringFacePositions = [];
    const xrayAuthoringFaceColors = [];
    for (const face of arrayValues(authoringOverlay.faces)) {
      const rgba = hexToRgba(face.color, face.opacity ?? 0.32);
      const positions = face.depthTest === true ? depthTestedAuthoringFacePositions : xrayAuthoringFacePositions;
      const colors = face.depthTest === true ? depthTestedAuthoringFaceColors : xrayAuthoringFaceColors;
      for (const triangle of triangulateFace(arrayValues(face.points))) {
        for (const point of triangle) appendWorldVertex(positions, colors, point, rgba);
      }
    }
    if (depthTestedAuthoringFacePositions.length) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -1);
      drawWorldArrays(gl.TRIANGLES, depthTestedAuthoringFacePositions, depthTestedAuthoringFaceColors);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true);
    }
    if (xrayAuthoringFacePositions.length) {
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      drawWorldArrays(gl.TRIANGLES, xrayAuthoringFacePositions, xrayAuthoringFaceColors);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    }
  }

  function drawAuthoringLines() {
    const authoringOverlay = getAuthoringOverlay();
    const hoveredHandle = getAuthoringHoveredHandle();
    const authoringLineGroups = new Map();
    const defaultAuthoringLineWidth = Math.max(settings.authoring?.lineWidth || 2, settings.render.edges.lineWidth);
    const authoringLineGroup = (lineWidth) => {
      const width = Number.isFinite(lineWidth) ? Math.max(1, lineWidth) : defaultAuthoringLineWidth;
      const key = String(width);
      if (!authoringLineGroups.has(key)) authoringLineGroups.set(key, { width, positions: [], colors: [] });
      return authoringLineGroups.get(key);
    };
    const isHoveredAuthoringLine = (line) => {
      if (!hoveredHandle?.edgeId || !line?.edgeId || hoveredHandle.edgeId !== line.edgeId) return false;
      return (hoveredHandle.kind === "plate-sketch-edge" && line.kind === "plate-sketch-edge")
        || (hoveredHandle.kind === "plate-sketch-construction-edge" && line.kind === "plate-sketch-construction-edge");
    };
    for (const line of arrayValues(authoringOverlay.lines)) {
      const hovered = isHoveredAuthoringLine(line);
      const rgba = hexToRgba(hovered ? settings.authoring?.hoverColor || "#fef08a" : line.color);
      const group = authoringLineGroup(hovered ? Math.max(line.lineWidth || defaultAuthoringLineWidth, settings.authoring?.hoverLineWidth || 6) : line.lineWidth);
      pushVertex(group.positions, group.colors, clipPoint(line.points[0]), rgba);
      pushVertex(group.positions, group.colors, clipPoint(line.points[1]), rgba);
    }
    if (authoringLineGroups.size) {
      gl.disable(gl.DEPTH_TEST);
      for (const group of authoringLineGroups.values()) {
        gl.lineWidth(group.width);
        drawArrays(gl.LINES, group.positions, group.colors);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.lineWidth(settings.render.edges.lineWidth);
    }
  }

  function drawDimensionLines() {
    const dimensionPositions = [];
    const dimensionColors = [];
    for (const line of arrayValues(getDimensionOverlay().lines)) {
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
  }

  function drawDimensionLabels() {
    const draftingAuthoringLabels = arrayValues(getAuthoringOverlay().labels).filter((label) => label.draftingDimension);
    dimensionTextRenderer?.draw({
      labels: [...arrayValues(getDimensionOverlay().labels), ...draftingAuthoringLabels],
      projectPoint,
      screenScale: () => camera.screenScale(),
      isHovered: (label) => dimensionUi.isHovered(label),
      hideBehindGeometry: hideDimensionsBehindGeometry()
    });
  }

  function drawAuthoringHandles() {
    const handlePositions = [];
    const handleColors = [];
    for (const handle of arrayValues(getAuthoringOverlay().handles)) {
      if (isAuthoringHovered(handle)) continue;
      pushAuthoringHandle(handlePositions, handleColors, handle);
    }
    const hoveredHandle = getAuthoringHoveredHandle();
    if (hoveredHandle) {
      pushAuthoringHandle(handlePositions, handleColors, hoveredHandle);
    }
    if (handlePositions.length) {
      gl.lineWidth(Math.max(settings.authoring?.handleLineWidth || 2, settings.render.edges.lineWidth));
      gl.disable(gl.DEPTH_TEST);
      drawArrays(gl.LINES, handlePositions, handleColors);
      gl.enable(gl.DEPTH_TEST);
      gl.lineWidth(settings.render.edges.lineWidth);
    }
  }

  return {
    draw,
    pickSceneGpu,
    invalidateStaticSceneCache,
    invalidateMemberInstanceCache,
    invalidateRenderableCaches,
    hitTestDimensionLabel: (x, y) => dimensionTextRenderer?.hitTest(x, y) || null
  };
}
