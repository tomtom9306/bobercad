import { arrayValues, uniqueTruthy } from "../../engine/core/model.mjs";
import { averageVec3, distance2, finiteNumber, v } from "../../engine/core/math.mjs";
import { memberCenter } from "../../engine/api/project/members.mjs";
import { projectProfileCatalog } from "../../engine/api/project/profiles.mjs";
import { plateOutline as sketchPlateOutline } from "../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { objectCollection } from "../../engine/api/project/objects.mjs";
import { memberDependencyObjectIds } from "../../engine/api/project/dependencies.mjs";
import { buildScene } from "../../rendering/scene/scene-geometry-builder.mjs";

const { sub, len } = v;

function requiredVec3(value, label) {
  if (!v.isVec3(value)) throw new Error(`viewer: ${label} must be a finite [x, y, z] vector`);
  return value;
}

export function projectObjectCount(project) {
  return Object.values(project.model || {})
    .filter((collection) => collection && typeof collection === "object" && !Array.isArray(collection))
    .reduce((sum, collection) => sum + Object.keys(collection).length, 0);
}

export function shouldUseProgressiveDetails(project) {
  return projectObjectCount(project) > 5000;
}

function lodDetailBucket(scale) {
  if (!finiteNumber(scale) || scale <= 0) return null;
  return Math.floor(Math.log2(scale) * 4);
}

export function profileRadius(profile) {
  const points = arrayValues(profile?.section?.contours).flatMap((contour) => arrayValues(contour.points));
  if (!points.length) return 1;
  return Math.max(...points.map((point) => distance2(point, [0, 0])), 1);
}

function plateRadius(plate) {
  if (!finiteNumber(plate.thickness) || plate.thickness <= 0) throw new Error(`${plate.id}: plate thickness must be positive`);
  const outline = sketchPlateOutline(plate);
  const y = Math.max(...outline.map((point) => Math.abs(point[0] || 0)), 1);
  const z = Math.max(...outline.map((point) => Math.abs(point[1] || 0)), 1);
  return Math.hypot(y, z, plate.thickness / 2);
}

function memberRadius(profiles, member) {
  const profile = profiles[member.profile];
  if (!profile) throw new Error(`${member.id}: profile not found: ${member.profile}`);
  const axisLength = len(sub(requiredVec3(member.end, `${member.id}.end`), requiredVec3(member.start, `${member.id}.start`)));
  return axisLength / 2 + profileRadius(profile);
}

function estimateObjectRadius(project, profiles, settings, objectId, seen = new Set()) {
  if (!objectId || seen.has(objectId)) return 1;
  seen.add(objectId);
  const collection = objectCollection(project, objectId);
  const object = collection ? project.model?.[collection]?.[objectId] : null;
  if (!object) return 1;

  if (collection === "members") return memberRadius(profiles, object);
  if (collection === "plates") return plateRadius(object);
  if (collection === "fastenerGroups") {
    const pattern = project.model.holePatterns?.[object.holePatternRef];
    const feature = project.model.features?.[object.through?.fromFeatureId];
    if (!Array.isArray(pattern?.positions)) throw new Error(`${object.id}: fastener group hole pattern not found: ${object.holePatternRef}`);
    const patternRadius = Math.max(...pattern.positions.map((point) => distance2([point[0] || 0, point[1] || 0], [0, 0])), 1);
    return patternRadius + Math.max(object.assembly?.length || settings.render.fasteners.length || 1, estimateObjectRadius(project, profiles, settings, feature?.ownerId, seen) * 0.25);
  }
  if (collection === "features") return Math.max(1, estimateObjectRadius(project, profiles, settings, object.ownerId, seen) * 0.25);
  if (collection === "welds") {
    return Math.max(1, ...arrayValues(object.participants).map((id) => estimateObjectRadius(project, profiles, settings, id, seen) * 0.25));
  }
  if (collection === "connectionZones") return 750;
  return 1;
}

export function memberSmartComponentDetailObjectIds(project, memberId) {
  return memberDependencyObjectIds(project, memberId, { includeMember: false, includeSmartComponentMembers: false, renderableOnly: true });
}

function objectCenter(project, objectId, seen = new Set()) {
  if (!objectId || seen.has(objectId)) return null;
  seen.add(objectId);
  const collection = objectCollection(project, objectId);
  const object = collection ? project.model?.[collection]?.[objectId] : null;
  if (!object) return null;

  if (collection === "members" && Array.isArray(object.start) && Array.isArray(object.end)) return memberCenter(object);
  if (collection === "plates" && Array.isArray(object.center)) return object.center;
  if (collection === "features") {
    if (Array.isArray(object.center)) return object.center;
    return objectCenter(project, object.ownerId, seen);
  }
  if (collection === "fastenerGroups") {
    const feature = project.model.features?.[object.through?.fromFeatureId];
    return objectCenter(project, feature?.ownerId, seen);
  }
  if (collection === "welds") {
    const centers = arrayValues(object.participants).map((id) => objectCenter(project, id, seen));
    return averageVec3(centers);
  }
  if (collection === "connectionZones" && Array.isArray(object.origin)) return object.origin;
  return null;
}

function projectedDetailScore(center, pixelRadius, detailContext = {}) {
  if (!center || typeof detailContext.projectPoint !== "function" || !detailContext.viewport) return pixelRadius;
  const projected = detailContext.projectPoint(center);
  const viewport = detailContext.viewport;
  if (!projected || !finiteNumber(projected.x) || !finiteNumber(projected.y)) return null;
  const margin = Math.max(120, pixelRadius * 2);
  if (projected.x < -margin || projected.x > viewport.width + margin || projected.y < -margin || projected.y > viewport.height + margin) return null;
  const dx = projected.x - viewport.width / 2;
  const dy = projected.y - viewport.height / 2;
  return pixelRadius - Math.hypot(dx, dy) * 0.015;
}

function createLodDetailFilter(project, profileMap, settings, scale, detailContext = {}) {
  const threshold = finiteNumber(settings.render.lod?.detailPixelThreshold)
    ? settings.render.lod.detailPixelThreshold
    : 24;
  const maxAutoDetails = finiteNumber(settings.render.lod?.maxAutoDetailObjects)
    ? Math.max(0, Math.floor(settings.render.lod.maxAutoDetailObjects))
    : 600;
  const forced = new Set(arrayValues(detailContext.forceDetailObjectIds));
  if (!maxAutoDetails && !forced.size) return () => false;

  const candidates = [];
  for (const objectId of Object.keys(project.objectIndex || {})) {
    if (forced.has(objectId)) continue;
    const pixelRadius = estimateObjectRadius(project, profileMap, settings, objectId) * scale;
    if (pixelRadius < threshold) continue;
    const score = projectedDetailScore(objectCenter(project, objectId), pixelRadius, detailContext);
    if (!finiteNumber(score)) continue;
    candidates.push({ objectId, score });
  }

  const selected = new Set(candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, maxAutoDetails)
    .map((entry) => entry.objectId));
  for (const objectId of forced) selected.add(objectId);
  return (objectId) => selected.has(objectId);
}

export function createViewerRenderScheduler({
  viewer,
  settings,
  profiles,
  fasteners,
  getProject = () => null,
  getPreviewMembers = () => [],
  getPreviewPlates = () => [],
  getActiveSmartComponentId = () => null,
  getForceDetailObjectIds = () => [],
  getActiveTrimRenderOptions = () => ({}),
  getReferenceGeometry = () => null,
  updateMeta = () => {},
  renderDimensionOverlay = () => {}
}) {
  let renderedLodDetailBucket = null;
  let progressiveDetailRenderToken = 0;
  let rerenderTimer = null;
  let rerenderIdle = null;
  let detailRefreshTimer = null;
  let detailRefreshIdle = null;

  const clearQueuedRerender = () => {
    window.clearTimeout(rerenderTimer);
    rerenderTimer = null;
    if (rerenderIdle !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(rerenderIdle);
    }
    rerenderIdle = null;
  };

  const clearDetailRefresh = () => {
    window.clearTimeout(detailRefreshTimer);
    detailRefreshTimer = null;
    if (detailRefreshIdle !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(detailRefreshIdle);
    }
    detailRefreshIdle = null;
  };

  const renderProject = (project, options = {}) => {
    const {
      activeSmartComponentId = null,
      activeTrimJointId = null,
      activeTrimOperationId = null,
      previewMembers = getPreviewMembers(),
      previewPlates = getPreviewPlates(),
      forceDetailObjectIds = [],
      ...viewerOptions
    } = options;
    const progressiveDetails = shouldUseProgressiveDetails(project);
    const profileMap = projectProfileCatalog(project, profiles);
    const detailContext = () => ({
      projectPoint: (point) => viewer.projectPoint(point),
      viewport: viewer.viewportSize(),
      forceDetailObjectIds
    });

    if (progressiveDetails && !viewerOptions.preserveCamera) {
      const detailToken = ++progressiveDetailRenderToken;
      const coarseScene = buildScene(project, profiles, fasteners, settings, {
        activeSmartComponentId,
        activeTrimJointId,
        activeTrimOperationId,
        previewMembers,
        previewPlates,
        referenceGeometry: getReferenceGeometry(),
        lodDetailFilter: () => false
      });
      viewer.setScene(coarseScene, viewerOptions);
      updateMeta(project);
      window.setTimeout(() => {
        const run = () => {
          if (detailToken !== progressiveDetailRenderToken) return;
          const scheduledScale = viewer.screenScale();
          renderedLodDetailBucket = lodDetailBucket(scheduledScale);
          viewer.setScene(buildScene(project, profiles, fasteners, settings, {
            activeSmartComponentId,
            activeTrimJointId,
            activeTrimOperationId,
            previewMembers,
            previewPlates,
            referenceGeometry: getReferenceGeometry(),
            lodDetailFilter: createLodDetailFilter(project, profileMap, settings, scheduledScale, detailContext())
          }), { ...viewerOptions, preserveCamera: true });
        };
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(run, { timeout: 1800 });
          return;
        }
        run();
      }, 500);
      return;
    }

    progressiveDetailRenderToken += 1;
    const detailScale = progressiveDetails ? viewer.screenScale() : null;
    renderedLodDetailBucket = progressiveDetails ? lodDetailBucket(detailScale) : null;
    const lodDetailFilter = progressiveDetails ? createLodDetailFilter(project, profileMap, settings, detailScale, detailContext()) : null;
    viewer.setScene(buildScene(project, profiles, fasteners, settings, {
      activeSmartComponentId,
      activeTrimJointId,
      activeTrimOperationId,
      previewMembers,
      previewPlates,
      referenceGeometry: getReferenceGeometry(),
      lodDetailFilter
    }), {
      ...viewerOptions,
      preserveCamera: progressiveDetails || viewerOptions.preserveCamera
    });
    updateMeta(project);
  };

  const renderProjectNow = (nextProject = getProject()) => {
    renderProject(nextProject, {
      preserveCamera: true,
      activeSmartComponentId: getActiveSmartComponentId(),
      forceDetailObjectIds: getForceDetailObjectIds(),
      ...getActiveTrimRenderOptions()
    });
    renderDimensionOverlay();
  };

  const queueLargeProjectRerender = () => {
    clearQueuedRerender();
    const run = () => {
      rerenderIdle = null;
      renderProjectNow(getProject());
    };
    rerenderTimer = window.setTimeout(() => {
      rerenderTimer = null;
      if (typeof window.requestIdleCallback === "function") {
        rerenderIdle = window.requestIdleCallback(run, { timeout: 1200 });
      } else {
        run();
      }
    }, 0);
  };

  const rerender = (nextProject = getProject()) => {
    if (shouldUseProgressiveDetails(nextProject)) {
      queueLargeProjectRerender();
      return;
    }
    clearQueuedRerender();
    renderProjectNow(nextProject);
  };

  const scheduleDetailRefresh = () => {
    clearDetailRefresh();
    const run = () => {
      detailRefreshIdle = null;
      rerender(getProject());
    };
    detailRefreshTimer = window.setTimeout(() => {
      detailRefreshTimer = null;
      if (typeof window.requestIdleCallback === "function") {
        detailRefreshIdle = window.requestIdleCallback(run, { timeout: 1000 });
      } else {
        run();
      }
    }, 0);
  };

  const hotSwapMemberDetails = (nextProject, memberId, objectIds = []) => {
    if (typeof viewer.replaceSceneObjects !== "function") throw new Error("viewer does not support affected-object scene patching");
    const renderIds = new Set(uniqueTruthy([memberId, ...objectIds]));
    if (!renderIds.size) return false;
    clearQueuedRerender();
    clearDetailRefresh();
    progressiveDetailRenderToken += 1;
    renderedLodDetailBucket = shouldUseProgressiveDetails(nextProject) ? lodDetailBucket(viewer.screenScale()) : null;

    const patchScene = buildScene(nextProject, profiles, fasteners, settings, {
      activeSmartComponentId: getActiveSmartComponentId(),
      ...getActiveTrimRenderOptions(),
      renderObjectIds: renderIds,
      lodDetailFilter: (objectId) => renderIds.has(objectId)
    });
    const replaced = viewer.replaceSceneObjects(patchScene, renderIds);
    if (!replaced) throw new Error("affected-object scene patch failed");
    updateMeta(nextProject);
    renderDimensionOverlay();
    return true;
  };

  const patchProjectObjects = (nextProject, objectIds = []) => {
    if (typeof viewer.replaceSceneObjects !== "function") return false;
    const renderIds = new Set(uniqueTruthy(objectIds));
    if (!renderIds.size) return false;
    clearQueuedRerender();
    clearDetailRefresh();
    progressiveDetailRenderToken += 1;
    renderedLodDetailBucket = shouldUseProgressiveDetails(nextProject) ? lodDetailBucket(viewer.screenScale()) : null;
    const patchScene = buildScene(nextProject, profiles, fasteners, settings, {
      activeSmartComponentId: getActiveSmartComponentId(),
      ...getActiveTrimRenderOptions(),
      renderObjectIds: renderIds,
      lodDetailFilter: (objectId) => renderIds.has(objectId)
    });
    const replaced = viewer.replaceSceneObjects(patchScene, renderIds);
    if (!replaced) return false;
    updateMeta(nextProject);
    renderDimensionOverlay();
    return true;
  };

  const applyProjectResult = (nextProject = getProject(), result = null) => {
    const commandType = result?.commandType || "";
    if (commandType === "project.load") {
      renderProject(nextProject, { preserveCamera: true });
      renderDimensionOverlay();
      return;
    }
    const affectedObjectIds = uniqueTruthy([
      ...arrayValues(result?.changedObjectIds),
      ...arrayValues(result?.removedObjectIds),
      ...arrayValues(result?.regeneratedObjectIds)
    ]);
    if (affectedObjectIds.length > 0 && affectedObjectIds.length <= 400 && patchProjectObjects(nextProject, affectedObjectIds)) return;
    rerender(nextProject);
  };

  const bindDetailScaleRefresh = () => {
    viewer.setDetailScaleChangeHandler((scale) => {
      const project = getProject();
      if (!shouldUseProgressiveDetails(project)) return;
      const bucket = lodDetailBucket(scale);
      if (bucket === null || bucket === renderedLodDetailBucket) return;
      scheduleDetailRefresh();
    });
  };

  return {
    renderProject,
    renderProjectNow,
    rerender,
    hotSwapMemberDetails,
    patchProjectObjects,
    applyProjectResult,
    bindDetailScaleRefresh,
    clearQueuedRerender,
    clearDetailRefresh
  };
}
