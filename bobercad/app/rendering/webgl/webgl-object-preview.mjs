import { finiteNumber, finiteNumberOr, v } from "../../engine/core/math.mjs";
import { arrayValues, sameIdSet, uniqueTruthy } from "../../engine/core/model.mjs";
import { memberFrame } from "../../engine/geometry/member-geometry.mjs";
import { cloneSceneItem } from "./webgl-view-state.mjs";

export function createWebglObjectPreviewController({
  getScene,
  invalidateRenderableCaches,
  invalidateMemberInstanceLookup,
  invalidateScenePickCache,
  requestDraw
}) {
  let objectPreview = null;

  function get() {
    return objectPreview;
  }

  function reset() {
    objectPreview = null;
  }

  function isPreviewed(item) {
    return Boolean(item?.objectId && objectPreview?.objectIds?.has(item.objectId));
  }

  function previewDelta() {
    return objectPreview?.delta || [0, 0, 0];
  }

  function previewOpacity(fallback = 1) {
    return finiteNumberOr(objectPreview?.opacity, fallback);
  }

  function previewPoint(point) {
    return v.add(point, previewDelta());
  }

  function clonePreviewMember(member) {
    if (!member?.id || !v.isVec3(member.start) || !v.isVec3(member.end)) return null;
    return {
      ...member,
      start: [...member.start],
      end: [...member.end]
    };
  }

  function memberPreviewTransform(baseMember, draftMember) {
    if (!baseMember || !draftMember) return null;
    const baseLength = v.len(v.sub(baseMember.end, baseMember.start));
    const draftLength = v.len(v.sub(draftMember.end, draftMember.start));
    if (!finiteNumber(baseLength) || !finiteNumber(draftLength) || baseLength <= 1e-6 || draftLength <= 1e-6) return null;
    return {
      baseStart: baseMember.start,
      baseFrame: memberFrame(baseMember),
      baseLength,
      draftStart: draftMember.start,
      draftFrame: memberFrame(draftMember),
      draftLength
    };
  }

  function transformMemberPreviewPoint(point, transform) {
    if (!transform || !v.isVec3(point)) return null;
    const offset = v.sub(point, transform.baseStart);
    const baseStation = v.dot(offset, transform.baseFrame.x);
    const station = baseStation / transform.baseLength * transform.draftLength;
    const y = v.dot(offset, transform.baseFrame.y);
    const z = v.dot(offset, transform.baseFrame.z);
    return v.add(transform.draftStart, v.add(
      v.mul(transform.draftFrame.x, station),
      v.add(v.mul(transform.draftFrame.y, y), v.mul(transform.draftFrame.z, z))
    ));
  }

  function previewPointForItem(item, point) {
    const transform = item?.objectId ? objectPreview?.memberTransforms?.get(item.objectId) : null;
    return transformMemberPreviewPoint(point, transform) || previewPoint(point);
  }

  function transformedPreviewInstance(instance) {
    const draft = objectPreview?.memberDrafts?.get(instance.objectId);
    if (draft) {
      const length = v.len(v.sub(draft.end, draft.start));
      if (finiteNumber(length) && length > 1e-6) {
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

  function captureItems() {
    if (!objectPreview) return [];
    const transformedFaces = objectPreview.faces.map((face) => ({
      ...face,
      points: face.points.map((point) => previewPointForItem(face, point))
    }));
    const transformedLines = objectPreview.lines.map((line) => ({
      ...line,
      points: line.points.map((point) => previewPointForItem(line, point))
    }));
    const transformedInstances = objectPreview.memberInstances.map(transformedPreviewInstance);
    return [...transformedFaces, ...transformedLines, ...transformedInstances];
  }

  function begin(objectIds = []) {
    const scene = getScene();
    if (!scene) return false;
    const ids = new Set(uniqueTruthy([...objectIds]));
    if (!ids.size) return false;
    if (sameIdSet(objectPreview?.objectIds, ids)) return true;
    const isPreviewItem = (item) => item?.objectId && ids.has(item.objectId);
    const memberBases = new Map();
    for (const id of ids) {
      const member = clonePreviewMember(scene.project?.model?.members?.[id]);
      if (member) memberBases.set(id, member);
    }
    objectPreview = {
      objectIds: ids,
      delta: [0, 0, 0],
      opacity: null,
      faces: arrayValues(scene.faces).filter(isPreviewItem).map(cloneSceneItem),
      lines: arrayValues(scene.lines).filter(isPreviewItem).map(cloneSceneItem),
      memberInstances: arrayValues(scene.memberInstances).filter(isPreviewItem).map(cloneSceneItem),
      memberBases,
      memberDrafts: new Map(),
      memberTransforms: new Map()
    };
    invalidateRenderableCaches();
    requestDraw();
    return true;
  }

  function updateMemberMove(member, options = {}) {
    if (!member?.id) return false;
    const ids = new Set(uniqueTruthy([member.id, ...arrayValues(options.objectIds)]));
    if (!begin(ids)) return false;
    const delta = v.isVec3(options.delta)
      ? options.delta
      : [0, 0, 0];
    objectPreview.delta = [...delta];
    objectPreview.opacity = finiteNumberOr(options.opacity, null);
    const draftMember = {
      ...member,
      start: [...member.start],
      end: [...member.end]
    };
    objectPreview.memberDrafts.set(member.id, draftMember);
    const transform = memberPreviewTransform(objectPreview.memberBases.get(member.id), draftMember);
    if (transform) objectPreview.memberTransforms.set(member.id, transform);
    else objectPreview.memberTransforms.delete(member.id);
    requestDraw();
    return true;
  }

  function clear() {
    if (!objectPreview) return;
    objectPreview = null;
    invalidateRenderableCaches();
    requestDraw();
  }

  function translateSceneObjects(objectIds = [], delta = null) {
    const scene = getScene();
    if (!scene || !objectIds.length || !v.isVec3(delta)) return false;
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
    for (const item of [...arrayValues(scene.faces), ...arrayValues(scene.lines)]) {
      if (!ids.has(item.objectId)) continue;
      for (const point of arrayValues(item.points)) movePoint(point);
    }
    for (const instance of arrayValues(scene.memberInstances)) {
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
    const scene = getScene();
    if (!scene || !member?.id) return false;
    const translateObjectIds = arrayValues(options.translateObjectIds);
    const translatedObjects = translateSceneObjects(translateObjectIds, options.delta);
    const translatedMemberDetail = translatedObjects && translateObjectIds.includes(member.id);
    const instance = arrayValues(scene.memberInstances).find((item) => item.objectId === member.id);
    if (!instance) {
      if (translatedObjects) {
        invalidateRenderableCaches();
        requestDraw();
      }
      return translatedObjects;
    }
    const length = v.len(v.sub(member.end, member.start));
    if (!finiteNumber(length) || length <= 1e-6) return false;
    const frame = memberFrame(member);
    if (options.project) scene.project = options.project;
    if (scene.project?.model?.members?.[member.id]) scene.project.model.members[member.id] = member;
    instance.start = [...member.start];
    instance.axisX = frame.x;
    instance.axisY = frame.y;
    instance.axisZ = frame.z;
    instance.length = length;
    if (scene.lodDetails && !translatedMemberDetail) delete scene.lodDetails[member.id];
    invalidateRenderableCaches();
    requestDraw();
    return true;
  }

  function replaceSceneObjects(patchScene, objectIds = []) {
    const scene = getScene();
    const idValues = objectIds && typeof objectIds[Symbol.iterator] === "function" ? [...objectIds] : [];
    if (!scene || !patchScene || !idValues.length) return false;
    const ids = new Set(uniqueTruthy(idValues));
    if (!ids.size) return false;
    const isPatchedObject = (item) => item?.objectId && ids.has(item.objectId);
    const appendPatched = (target, source = []) => {
      for (const item of source) {
        if (isPatchedObject(item)) target.push(item);
      }
    };
    scene.faces = arrayValues(scene.faces).filter((item) => !isPatchedObject(item));
    scene.lines = arrayValues(scene.lines).filter((item) => !isPatchedObject(item));
    scene.callouts = arrayValues(scene.callouts).filter((item) => !isPatchedObject(item));
    scene.memberInstances = arrayValues(scene.memberInstances).filter((item) => !isPatchedObject(item));
    appendPatched(scene.faces, patchScene.faces);
    appendPatched(scene.lines, patchScene.lines);
    appendPatched(scene.callouts, patchScene.callouts);
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
    scene.emptyLodDetailObjectIds = scene.emptyLodDetailObjectIds || new Set();
    for (const objectId of ids) scene.emptyLodDetailObjectIds.delete(objectId);
    const patchEmptyLodDetailObjectIds = patchScene.emptyLodDetailObjectIds || new Set();
    for (const objectId of patchEmptyLodDetailObjectIds) {
      if (ids.has(objectId)) scene.emptyLodDetailObjectIds.add(objectId);
    }
    scene.project = patchScene.project || scene.project;
    scene.activeSmartComponentId = patchScene.activeSmartComponentId ?? scene.activeSmartComponentId;
    scene.activeTrimJointId = patchScene.activeTrimJointId ?? scene.activeTrimJointId;
    scene.activeTrimOperationId = patchScene.activeTrimOperationId ?? scene.activeTrimOperationId;
    scene.activeSmartComponentObjectIds = patchScene.activeSmartComponentObjectIds || scene.activeSmartComponentObjectIds;
    scene.generatedSmartComponentObjectIds = patchScene.generatedSmartComponentObjectIds || scene.generatedSmartComponentObjectIds;
    invalidateScenePickCache();
    invalidateRenderableCaches();
    requestDraw();
    return true;
  }

  return {
    get,
    reset,
    isPreviewed,
    previewOpacity,
    previewPointForItem,
    transformedPreviewInstance,
    captureItems,
    begin,
    updateMemberMove,
    clear,
    updateMemberInstance,
    replaceSceneObjects
  };
}
