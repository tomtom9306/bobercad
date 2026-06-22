import { smartComponentOwnedObjectIds } from "../../engine/api/project/dependencies.mjs";
import { smartComponentPreviewContextsForPreset } from "../../engine/modules/smart-components/smart-component-preview-contexts.mjs";
import { createProjectStore } from "../../engine/store/project-command-store.mjs";
import { smartComponentGeneratedHelperIds } from "../../engine/store/project-store-smart-component-helpers.mjs";
import { buildScene } from "../../rendering/scene/scene-geometry-builder.mjs";
import { renderSceneThumbnailDataUrl, sceneRenderableCounts } from "../../rendering/preview/scene-thumbnail-renderer.mjs";

const PREVIEW_PROJECT_BASE_URL = new URL("../../../data/projects/", import.meta.url);

export function createSmartComponentPreviewService({
  api,
  profiles,
  fasteners,
  materials,
  smartComponentCatalog,
  viewerSettings
} = {}) {
  const contextProjects = new Map();

  return {
    async resolveSmartComponentInstancePreview({ smartComponentId } = {}) {
      const project = api?.project?.();
      const smartComponent = project?.model?.smartComponentInstances?.[smartComponentId];
      if (!smartComponent) return unavailable("", "Smart Component instance not found.", { smartComponentId });
      const ownedObjectIds = smartComponentOwnedObjectIds(smartComponent);
      const helperObjectIds = safeGeneratedHelperIds(project, smartComponent);
      const memberIds = smartComponentInputMemberIds(smartComponent);
      return renderPreview({
        project,
        presetId: smartComponent.sourceComponent?.id || "",
        smartComponentId,
        memberIds,
        ownedObjectIds,
        helperObjectIds,
        focusObjectIds: unique([...(api?.smartComponentObjectIds?.(smartComponentId) || []), ...memberIds, ...helperObjectIds, smartComponentId]),
        diagnostics: Array.isArray(smartComponent.diagnostics) ? smartComponent.diagnostics : [],
        source: "current-project",
        reason: "Rendered from current Smart Component."
      });
    },

    async resolvePresetPreview({ presetId, selectedObjectIds = [], includeThumbnail = true } = {}) {
      const preset = smartComponentCatalog?.smartComponents?.[presetId];
      if (!preset) return unavailable(presetId, "Smart Component preset not found.");

      const currentProject = api?.project?.();
      const selectedMemberIds = memberSelection(currentProject, selectedObjectIds);
      if (selectedMemberIds.length) {
        const pairResult = await tryStorePairs({
          store: api,
          presetId,
          pairs: candidatePairs(currentProject, selectedMemberIds),
          source: selectedMemberIds.length >= 2 ? "selection-pair" : "selection-member",
          includeThumbnail
        });
        return pairResult || unavailable(presetId, selectedMemberIds.length >= 2
          ? "Not available for the selected members."
          : "No available connection found for the selected member.", { selectionActive: true });
      }

      for (const context of smartComponentPreviewContextsForPreset(preset)) {
        const project = await loadContextProject(context);
        const store = createContextPreviewStore(project, presetId);
        const pairs = mergePairs(context.memberPairs, candidatePairs(store.project(), []), candidatePairs(project, []));
        const result = await tryStorePairs({ store, presetId, pairs, source: context.id, includeThumbnail });
        if (result?.state === "available") return result;
        const existingResult = existingPresetPreview(project, presetId, context.id, { includeThumbnail });
        if (existingResult?.state === "available") return existingResult;
      }

      return unavailable(presetId, "No preview context can generate this connection yet.");
    }
  };

  async function loadContextProject(context) {
    if (contextProjects.has(context.id)) return contextProjects.get(context.id);
    const url = new URL(context.projectPath, PREVIEW_PROJECT_BASE_URL);
    const promise = loadJson(url);
    contextProjects.set(context.id, promise);
    return promise;
  }

  function createContextPreviewStore(project, presetId) {
    const store = createProjectStore({
      project,
      profiles,
      smartComponentCatalog,
      fasteners,
      materials
    });
    for (const instance of Object.values(store.project()?.model?.smartComponentInstances || {})) {
      if (instance?.sourceComponent?.id !== presetId) continue;
      try {
        store.deleteSmartComponent(instance.id);
      } catch {
        // If cleanup fails, the subsequent dry-run will report the real incompatibility.
      }
    }
    return store;
  }

  async function tryStorePairs({ store, presetId, pairs, source, includeThumbnail = true }) {
    let noPreview = null;
    let lastReason = "";
    for (const pair of pairs) {
      try {
        const preview = store.previewSmartComponentFromPreset(presetId, pair);
        const result = renderPreview({
          ...preview,
          source,
          generationMode: "dry-run",
          includeThumbnail,
          reason: source === "selection-pair"
            ? "Available for the selected members."
            : source === "selection-member"
              ? "Available with the selected member."
              : "Generated from preview context."
        });
        if (result.state === "available") return result;
        noPreview = noPreview || result;
      } catch (error) {
        lastReason = error?.message || "Connection is not available.";
      }
    }
    return noPreview || unavailable(presetId, lastReason || "Connection is not available.", {
      source,
      selectionActive: source.startsWith("selection")
    });
  }

  function existingPresetPreview(project, presetId, source, { includeThumbnail = true } = {}) {
    const instance = Object.values(project?.model?.smartComponentInstances || {})
      .find((smartComponent) => smartComponent?.sourceComponent?.id === presetId);
    if (!instance) return null;
    const previewProject = regeneratedContextProject(project, instance) || project;
    const previewInstance = previewProject?.model?.smartComponentInstances?.[instance.id] || instance;
    const ownedObjectIds = smartComponentOwnedObjectIds(previewInstance);
    const helperObjectIds = safeGeneratedHelperIds(previewProject, previewInstance);
    return renderPreview({
      project: previewProject,
      presetId,
      smartComponentId: previewInstance.id,
      memberIds: smartComponentInputMemberIds(previewInstance),
      ownedObjectIds,
      helperObjectIds,
      focusObjectIds: unique([...smartComponentInputMemberIds(previewInstance), ...ownedObjectIds, ...helperObjectIds, previewInstance.id]),
      diagnostics: Array.isArray(previewInstance.diagnostics) ? previewInstance.diagnostics : [],
      source,
      generationMode: previewProject === project ? "stored-context-instance" : "context-regenerate",
      includeThumbnail,
      reason: previewProject === project ? "Rendered from preview context." : "Regenerated from preview context."
    });
  }

  function regeneratedContextProject(project, instance) {
    if (!instance?.id) return null;
    try {
      const store = createProjectStore({
        project,
        profiles,
        smartComponentCatalog,
        fasteners,
        materials
      });
      store.updateSmartComponent(instance.id, instance.referenceParameters || {});
      return store.project();
    } catch {
      return null;
    }
  }

  function renderPreview({
    project,
    presetId,
    smartComponentId,
    memberIds = [],
    ownedObjectIds = [],
    helperObjectIds = [],
    focusObjectIds = [],
    diagnostics = [],
    source = "",
    generationMode = "",
    includeThumbnail = true,
    reason = ""
  }) {
    const generatedObjectIds = unique([...ownedObjectIds, ...helperObjectIds]);
    const renderObjectIds = unique([...focusObjectIds, ...memberIds, ...generatedObjectIds, smartComponentId]);
    const scene = buildScene(project, profiles, fasteners, viewerSettings, {
      activeSmartComponentId: smartComponentId,
      renderObjectIds
    });
    const generatedCounts = sceneRenderableCounts(scene, generatedObjectIds);
    if (!generatedCounts.faces && !generatedCounts.lines) {
      return noPreview(presetId, "Generated connection has no renderable preview geometry.", {
        memberIds,
        source,
        diagnostics
      });
    }
    let dataUrl = "";
    if (includeThumbnail) {
      dataUrl = renderSceneThumbnailDataUrl(scene, {
        objectIds: renderObjectIds,
        frameObjectIds: generatedObjectIds,
        framePadding: 0.22
      });
      if (!dataUrl) {
        return noPreview(presetId, "Preview renderer produced no thumbnail.", {
          memberIds,
          source,
          diagnostics
        });
      }
    }
    return {
      state: "available",
      presetId,
      smartComponentId,
      memberIds,
      source,
      generationMode,
      reason,
      selectionActive: source.startsWith("selection"),
      dataUrl,
      generatedCounts,
      diagnostics,
      sortRank: 0
    };
  }
}

function memberSelection(project, selectedObjectIds = []) {
  return unique(arrayValues(selectedObjectIds).filter((objectId) => project?.objectIndex?.[objectId]?.collection === "members")).slice(0, 2);
}

function candidatePairs(project, selectedMemberIds = []) {
  const selected = unique(selectedMemberIds);
  if (selected.length >= 2) return [[selected[0], selected[1]]];
  const members = Object.keys(project?.model?.members || {});
  const zonePairs = Object.values(project?.model?.connectionZones || {}).flatMap((zone) => (
    arrayValues(zone.secondaryObjectIds).map((secondaryId) => [zone.mainObjectId, secondaryId])
  )).filter((pair) => pair.every((id) => members.includes(id)));
  if (selected.length === 1) {
    const selectedId = selected[0];
    const zoneMatches = zonePairs.filter((pair) => pair.includes(selectedId));
    const allMatches = members.filter((memberId) => memberId !== selectedId).map((memberId) => [selectedId, memberId]);
    return mergePairs(zoneMatches, allMatches);
  }
  const allPairs = [];
  for (let first = 0; first < members.length; first += 1) {
    for (let second = first + 1; second < members.length; second += 1) allPairs.push([members[first], members[second]]);
  }
  return mergePairs(zonePairs, allPairs);
}

function smartComponentInputMemberIds(instance = {}) {
  return unique([
    instance.inputs?.main?.memberId,
    instance.inputs?.secondary?.memberId,
    ...arrayValues(instance.inputs?.memberIds)
  ]);
}

function safeGeneratedHelperIds(project, instance) {
  try {
    return smartComponentGeneratedHelperIds(project, instance);
  } catch {
    return [];
  }
}

function unavailable(presetId, reason, extras = {}) {
  return {
    state: "unavailable",
    presetId,
    reason: reason || "Connection is not available.",
    sortRank: 2,
    ...extras
  };
}

function noPreview(presetId, reason, extras = {}) {
  return {
    state: "no-preview",
    presetId,
    reason: reason || "No renderable preview is available.",
    selectionActive: String(extras.source || "").startsWith("selection"),
    sortRank: 1,
    ...extras
  };
}

function mergePairs(...groups) {
  const seen = new Set();
  const pairs = [];
  for (const group of groups) {
    for (const pair of arrayValues(group)) {
      if (!Array.isArray(pair) || pair.length < 2 || !pair[0] || !pair[1] || pair[0] === pair[1]) continue;
      const key = `${pair[0]}\u0000${pair[1]}`;
      const reverseKey = `${pair[1]}\u0000${pair[0]}`;
      if (seen.has(key) || seen.has(reverseKey)) continue;
      seen.add(key);
      pairs.push([pair[0], pair[1]]);
    }
  }
  return pairs;
}

function unique(values = []) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function arrayValues(value) {
  return Array.isArray(value) ? value : [];
}

async function loadJson(url) {
  if (url.protocol === "file:") {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url")
    ]);
    return JSON.parse(await readFile(fileURLToPath(url), "utf8"));
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url.pathname}: ${response.status}`);
  return response.json();
}
