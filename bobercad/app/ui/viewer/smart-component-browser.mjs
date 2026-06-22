import {
  applyTooltip,
  dataPanelActionRow,
  dataPanelCollection,
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelRow,
  dataPanelSearch,
  dataPanelSection
} from "../design-system/ui-elements.mjs";
import { createIcon } from "../icons/icon-registry.mjs";
import {
  SMART_COMPONENT_BROWSER_PANEL_SPEC,
  smartComponentCreatedStatus,
  smartComponentKindIcon,
  smartComponentKindLabel,
  smartComponentPresetActionIcon,
  smartComponentPresetActionLabel,
  smartComponentPresetActionSpec,
  smartComponentSelectedStatus,
  smartComponentSelectionStatus,
  smartComponentStatusIcon,
  smartComponentTitleCase
} from "../commands/smart-component-browser-metadata.mjs";

const CONNECTION_ARTWORK_BY_VARIANT = Object.freeze({
  "apex-gusset": "./assets/connection-artwork/apex-gusset.png",
  "base-plate": "./assets/connection-artwork/base-plate.png",
  "end-plate": "./assets/connection-artwork/end-plate.png",
  "fin-plate": "./assets/connection-artwork/fin-plate.png",
  "member-splice": "./assets/connection-artwork/member-splice.png",
  "moment-end-plate": "./assets/connection-artwork/moment-end-plate.png",
  hardware: "./assets/connection-artwork/hardware.png",
  connection: "./assets/connection-artwork/end-plate.png"
});

export function mountSmartComponentBrowser({
  root,
  app = null,
  api = null,
  selection = null,
  smartComponentCatalog = null,
  kindFilter = null,
  excludeKindFilter = null,
  panelSpec = SMART_COMPONENT_BROWSER_PANEL_SPEC,
  previewService = null,
  onPresetSelected,
  onProjectChange,
  onSmartComponentCreated,
  onStatusChange
} = {}) {
  if (!root || !api) return null;
  const allowedKinds = normalizeKindFilter(kindFilter);
  const blockedKinds = normalizeKindFilter(excludeKindFilter);
  const spec = {
    ...SMART_COMPONENT_BROWSER_PANEL_SPEC,
    ...(panelSpec || {})
  };
  const state = {
    query: "",
    selectedPresetId: "",
    status: "",
    statusState: "",
    project: app?.project?.() || null,
    previewResults: new Map(),
    previewRequests: new Map()
  };
  const unsubscribe = app?.subscribe?.((project) => {
    state.project = project || app?.project?.() || null;
    render();
  }) || (() => {});

  root.hidden = false;
  root.classList.add("bc-smart-component-browser", "bc-data-panel");
  render();

  return {
    refresh() {
      state.project = app?.project?.() || state.project;
      render();
    },
    showPreset(presetId) {
      return showPreset(presetId);
    },
    destroy() {
      unsubscribe();
    }
  };

  function render(options = {}) {
    const selectionState = app?.selectionState?.() || {};
    const selectedObjectIds = Array.isArray(selectionState.selectedObjectIds) ? selectionState.selectedObjectIds : [];
    const items = sortPreviewItems(decoratePreviewItems(
      smartComponentItems(api, smartComponentCatalog, { allowedKinds, blockedKinds }),
      selectedObjectIds
    ), spec);
    const filtered = filterItems(items, state.query);
    const groups = groupItems(filtered).map(renderGroup).filter(Boolean);
    root.replaceChildren(
      renderHeader(items),
      renderSearch(),
      ...[renderStatus()].filter(Boolean),
      ...groups,
      ...[filtered.length ? null : emptyState()].filter(Boolean)
    );
    if (options.focusSearch) {
      const input = root.querySelector("[data-smart-component-search]");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    } else if (options.focusPresetId) {
      focusPreset(options.focusPresetId);
    }
  }

  function renderHeader(items) {
    return dataPanelHeader({
      namespace: "bc-smart-component-browser",
      icon: spec.icon,
      title: spec.title,
      meta: `${items.length} ${spec.itemCountLabel}`
    });
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-smart-component-browser",
      value: state.query,
      placeholder: spec.searchPlaceholder,
      label: spec.searchLabel,
      datasetKey: "smartComponentSearch",
      onInput: (value) => {
        state.query = value;
        render({ focusSearch: true });
      }
    });
  }

  function renderStatus() {
    if (!state.status) return null;
    return dataPanelRow({
      namespace: "bc-smart-component-browser",
      className: "bc-smart-component-browser-status",
      icon: smartComponentStatusIcon(state.statusState),
      label: state.status,
      value: spec.readyLabel,
      meta: state.statusState || spec.statusMetaFallback,
      state: state.statusState
    });
  }

  function decoratePreviewItems(items, selectedObjectIds = []) {
    if (spec.layout !== "tiles" || !previewService?.resolvePresetPreview) return items;
    return items.map((item) => {
      const key = previewCacheKey(item.id, selectedObjectIds);
      const preview = state.previewResults.get(key) || { state: "pending", reason: "Generating preview.", sortRank: 1 };
      if (!state.previewResults.has(key) && !state.previewRequests.has(key)) {
        state.previewRequests.set(key, true);
        previewService.resolvePresetPreview({
          presetId: item.id,
          selectedObjectIds,
          includeThumbnail: spec.showPreviewImages !== false
        })
          .then((result) => {
            state.previewResults.set(key, result || { state: "unavailable", reason: "Preview is unavailable.", sortRank: 2 });
            state.previewRequests.delete(key);
            render();
          })
          .catch((error) => {
            state.previewResults.set(key, {
              state: "unavailable",
              reason: error?.message || "Preview is unavailable.",
              sortRank: 2
            });
            state.previewRequests.delete(key);
            render();
          });
      }
      return { ...item, preview };
    });
  }

  function renderGroup(group) {
    if (!group.items.length) return null;
    const tileLayout = spec.layout === "tiles";
    const collection = dataPanelCollection({
      namespace: "bc-smart-component-browser",
      icon: group.icon,
      label: spec.collectionLabel,
      count: group.items.length,
      rows: group.items.map(tileLayout ? renderPresetTile : renderPresetRow),
      open: true
    });
    if (tileLayout) collection.dataset.layout = "tiles";
    return dataPanelSection({
      namespace: "bc-smart-component-browser",
      suffix: "group",
      label: group.label,
      children: collection
    });
  }

  function renderPresetRow(item) {
    const labelText = smartComponentPresetActionLabel(item);
    const actionSpec = smartComponentPresetActionSpec(item.kind);
    return dataPanelActionRow({
      namespace: "bc-smart-component-browser",
      icon: item.icon,
      label: item.name,
      value: [item.definitionTitle, item.version ? `v${item.version}` : ""].filter(Boolean).join(" - "),
      active: item.id === state.selectedPresetId,
      rowDataset: { smartComponentPresetId: item.id },
      mainLabel: `Select ${item.name}`,
      mainTitle: `Select ${item.name}`,
      actionIcon: smartComponentPresetActionIcon(item),
      actionLabel: labelText,
      actionTitle: labelText,
      onMain: () => selectPreset(item),
      onAction: () => {
        if (actionSpec.mode === "select") selectPreset(item);
        else createPreset(item);
      }
    });
  }

  function renderPresetTile(item) {
    const tile = document.createElement("div");
    tile.className = "bc-smart-component-browser-preset-tile";
    tile.dataset.smartComponentPresetId = item.id;
    tile.dataset.active = item.id === state.selectedPresetId ? "true" : "false";
    if (item.preview?.state) tile.dataset.previewState = item.preview.state;

    const main = document.createElement("button");
    main.type = "button";
    main.className = "bc-smart-component-browser-preset-tile-main";
    main.setAttribute("aria-label", `Select ${item.name}`);
    applyTooltip(main, item.preview?.reason || `Select ${item.name}`);
    main.addEventListener("click", () => selectPreset(item));

    const copy = document.createElement("span");
    copy.className = "bc-smart-component-browser-preset-tile-copy";
    const name = document.createElement("span");
    name.className = "bc-smart-component-browser-preset-tile-name";
    name.textContent = item.name;
    copy.append(name);

    const artworkUrl = smartComponentPresetArtworkUrl(item, spec);
    if (artworkUrl) {
      const preview = document.createElement("span");
      preview.className = "bc-smart-component-browser-preset-tile-preview";
      const image = document.createElement("img");
      image.className = "bc-smart-component-browser-preset-tile-image";
      image.src = artworkUrl;
      image.alt = "";
      image.loading = "lazy";
      preview.append(image);
      main.append(preview, copy);
    } else {
      const icon = document.createElement("span");
      icon.className = "bc-smart-component-browser-preset-tile-icon";
      icon.append(createIcon(item.icon));
      main.append(icon, copy);
    }

    tile.append(main);
    return tile;
  }

  function emptyState() {
    return dataPanelEmpty({ namespace: "bc-smart-component-browser", message: spec.emptyMessage });
  }

  function selectPreset(item) {
    state.selectedPresetId = item.id;
    state.status = item.preview?.reason || smartComponentSelectionStatus(item);
    state.statusState = item.preview?.state && item.preview.state !== "available" && item.preview.state !== "pending" ? "error" : item.kind;
    onPresetSelected?.(item);
    onStatusChange?.(smartComponentSelectedStatus(item));
    render();
  }

  function createPreset(item) {
    state.selectedPresetId = item.id;
    try {
      const result = api.createSmartComponentFromPreset(item.id, []);
      onProjectChange?.(result.project);
      onSmartComponentCreated?.(result.smartComponentId);
      state.status = smartComponentCreatedStatus(result.smartComponentId);
      state.statusState = "created";
      onStatusChange?.(smartComponentCreatedStatus(result.smartComponentId));
    } catch (error) {
      state.status = error.message;
      state.statusState = "error";
      onStatusChange?.(error.message);
    }
    render();
  }

  function showPreset(presetId) {
    const id = String(presetId || "").trim();
    if (!id) return false;
    const item = smartComponentItems(api, smartComponentCatalog, { allowedKinds, blockedKinds }).find((candidate) => candidate.id === id);
    if (!item) return false;
    state.query = id;
    state.selectedPresetId = id;
    state.status = smartComponentSelectionStatus(item);
    state.statusState = item.kind;
    render({ focusPresetId: id });
    return Boolean(findPresetRow(id));
  }

  function focusPreset(presetId) {
    const row = findPresetRow(presetId);
    const target = row?.querySelector?.("button, a, input, [tabindex]") || row;
    target?.focus?.();
    return Boolean(row);
  }

  function findPresetRow(presetId) {
    return Array.from(root.querySelectorAll("[data-smart-component-preset-id]"))
      .find((row) => row.dataset.smartComponentPresetId === presetId) || null;
  }

}

function smartComponentItems(api, catalog, { allowedKinds = null, blockedKinds = null } = {}) {
  const definitions = catalog?.definitions || {};
  return [...(api.smartComponentPresets?.() || [])]
    .map((preset) => {
      const definition = definitions[preset.type] || {};
      return {
        id: preset.id,
        name: preset.name || preset.id,
        description: preset.description || "",
        type: preset.type || "",
        kind: preset.kind || definition.kind || "component",
        version: preset.version || definition.version || "",
        definitionTitle: definition.title || smartComponentTitleCase(preset.type || ""),
        icon: smartComponentKindIcon(preset.kind || definition.kind),
        searchText: [
          preset.id,
          preset.name,
          preset.description,
          preset.type,
          preset.kind,
          definition.title
        ].filter(Boolean).join(" ").toLowerCase()
      };
    })
    .filter((item) => !allowedKinds || allowedKinds.has(item.kind))
    .filter((item) => !blockedKinds || !blockedKinds.has(item.kind))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function normalizeKindFilter(kindFilter) {
  const values = Array.isArray(kindFilter) ? kindFilter : kindFilter ? [kindFilter] : [];
  const normalized = values.map((value) => String(value || "").trim()).filter(Boolean);
  return normalized.length ? new Set(normalized) : null;
}

function filterItems(items, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => item.searchText.includes(needle));
}

function sortPreviewItems(items, spec = {}) {
  if (spec.layout !== "tiles") return items;
  return [...items].sort((a, b) => (
    previewRank(a.preview) - previewRank(b.preview)
    || a.kind.localeCompare(b.kind)
    || a.name.localeCompare(b.name)
    || a.id.localeCompare(b.id)
  ));
}

function previewRank(preview = {}) {
  if (preview.state === "available") return 0;
  if (preview.state === "pending") return 1;
  if (preview.state === "no-preview") return 2;
  if (preview.state === "unavailable") return 3;
  return Number.isFinite(Number(preview.sortRank)) ? Number(preview.sortRank) : 1;
}

function previewCacheKey(presetId, selectedObjectIds = []) {
  return `${presetId}|${selectedObjectIds.filter(Boolean).sort().join(",")}`;
}

function smartComponentPresetArtworkUrl(item = {}, spec = {}) {
  if (spec.previewArtworkMode !== "generated") return "";
  if (item.kind !== "connection") return "";
  const assetPath = CONNECTION_ARTWORK_BY_VARIANT[connectionArtworkVariant(item)] || CONNECTION_ARTWORK_BY_VARIANT.connection;
  return new URL(assetPath, import.meta.url).href;
}

function connectionArtworkVariant(item = {}) {
  const text = [item.id, item.type, item.name, item.definitionTitle].filter(Boolean).join(" ").toLowerCase();
  if (text.includes("apex") || text.includes("gusset")) return "apex-gusset";
  if (text.includes("base")) return "base-plate";
  if (text.includes("fin")) return "fin-plate";
  if (text.includes("splice")) return "member-splice";
  if (text.includes("hardware") || text.includes("bolt")) return "hardware";
  if (text.includes("moment")) return "moment-end-plate";
  if (text.includes("end")) return "end-plate";
  return "connection";
}

function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    const id = item.kind || "component";
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        label: smartComponentKindLabel(id),
        icon: smartComponentKindIcon(id),
        items: []
      });
    }
    groups.get(id).items.push(item);
  }
  return [...groups.values()];
}
