import {
  dataPanelActionRow,
  dataPanelCollection,
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelSearch,
  dataPanelSection,
  segmentedControl
} from "../design-system/ui-elements.mjs";
import {
  groupedModelCollections,
  modelCollectionBrowserVisibility,
  modelCollectionDefaultOpen,
  modelCollectionFocusable,
  modelObjectSearchDescriptor,
  modelCollectionSpec,
  modelCollectionSelectable,
  modelCollectionSelectionKind
} from "../commands/model-collection-metadata.mjs";
import {
  MODEL_BROWSER_DEFAULT_VISIBILITY,
  MODEL_BROWSER_PANEL_SPEC,
  MODEL_BROWSER_VISIBILITY_MODES,
  modelBrowserFrameLabel,
  modelBrowserFramedStatus,
  modelBrowserModeForCollectionVisibility,
  modelBrowserSelectLabel,
  modelBrowserSelectionStatus,
  modelBrowserVisibilityFilter
} from "../commands/model-browser-metadata.mjs";

export {
  MODEL_BROWSER_DEFAULT_VISIBILITY,
  MODEL_BROWSER_VISIBILITY_MODES,
  modelBrowserModeForCollectionVisibility,
  modelBrowserVisibilityFilter
};

export function mountModelBrowser({
  root,
  app = null,
  onSelectObject,
  onSelectSmartComponent,
  onFocusObject,
  onFocusSmartComponent,
  onStatusChange
} = {}) {
  if (!root) return null;
  const state = {
    query: "",
    visibilityMode: MODEL_BROWSER_DEFAULT_VISIBILITY,
    project: app?.project?.() || null,
    selection: app?.selectionState?.() || {}
  };
  const unsubscribe = app?.subscribe?.((project) => {
    state.project = project || app?.project?.() || null;
    render();
  }) || (() => {});

  root.classList.add("bc-model-browser", "bc-data-panel");
  render();

  return {
    refresh() {
      state.project = app?.project?.() || state.project;
      state.selection = app?.selectionState?.() || state.selection;
      render();
    },
    setSelectionState(selection = {}) {
      state.selection = selection;
      render();
    },
    showCollection(collectionId) {
      return showCollection(collectionId);
    },
    showObject(collectionId, objectId) {
      return showObject(collectionId, objectId);
    },
    destroy() {
      unsubscribe();
    }
  };

  function render(options = {}) {
    const visibilityFilter = modelBrowserVisibilityFilter(state.visibilityMode);
    const items = modelBrowserItems(state.project, visibilityFilter);
    const filtered = filterItems(items, state.query);
    const groups = groupedModelCollections({ browserVisibility: visibilityFilter })
      .map((group) => renderGroup(group, filtered))
      .filter(Boolean);
    const empty = filtered.length ? null : emptyState();
    root.dataset.modelBrowserVisibility = state.visibilityMode;
    root.replaceChildren(renderHeader(items), renderSearch(), renderVisibilityControl(), ...groups, ...[empty].filter(Boolean));
    if (options.focusSearch) {
      const input = root.querySelector("[data-model-browser-search]");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    } else if (options.focusScope) {
      const button = root.querySelector(`[data-model-browser-scope] [data-item-id="${options.focusScope}"]`);
      button?.focus?.();
    } else if (options.focusObjectId) {
      focusObjectRow(options.focusObjectId);
    }
  }

  function renderHeader(items) {
    return dataPanelHeader({
      namespace: "bc-model-browser",
      icon: MODEL_BROWSER_PANEL_SPEC.icon,
      title: MODEL_BROWSER_PANEL_SPEC.title,
      meta: `${items.length} ${MODEL_BROWSER_PANEL_SPEC.itemCountLabel}`
    });
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-model-browser",
      value: state.query,
      placeholder: MODEL_BROWSER_PANEL_SPEC.searchPlaceholder,
      label: MODEL_BROWSER_PANEL_SPEC.searchLabel,
      datasetKey: "modelBrowserSearch",
      onInput: (value) => {
        state.query = value;
        render({ focusSearch: true });
      }
    });
  }

  function renderVisibilityControl() {
    const control = segmentedControl({
      label: MODEL_BROWSER_PANEL_SPEC.scopeLabel,
      className: "bc-model-browser-scope bc-data-segment",
      items: MODEL_BROWSER_VISIBILITY_MODES.map((mode) => ({
        ...mode,
        active: state.visibilityMode === mode.id
      })),
      onSelect: (mode) => {
        state.visibilityMode = mode.id;
        render({ focusScope: mode.id });
      }
    });
    control.dataset.modelBrowserScope = "true";
    return control;
  }

  function renderGroup(group, items) {
    const groupItems = group.collections
      .map((spec) => renderCollection(spec, items))
      .filter(Boolean);
    if (!groupItems.length) return null;
    return dataPanelSection({
      namespace: "bc-model-browser",
      suffix: "group",
      label: group.label,
      children: groupItems
    });
  }

  function renderCollection(spec, items) {
    const collectionItems = items.filter((item) => item.collection === spec.id);
    if (!collectionItems.length) return null;
    return dataPanelCollection({
      namespace: "bc-model-browser",
      icon: spec.icon,
      label: spec.label,
      count: collectionItems.length,
      rows: collectionItems.map((item) => renderRow(item, spec)),
      open: state.query.trim() ? true : modelCollectionDefaultOpen(spec.id)
    });
  }

  function renderRow(item, spec) {
    const active = activeItem(item);
    return dataPanelActionRow({
      namespace: "bc-model-browser",
      icon: spec.icon,
      label: item.id,
      value: item.type || item.collection,
      active,
      rowDataset: {
        modelBrowserId: item.id,
        collection: item.collection
      },
      mainLabel: modelBrowserSelectLabel(item.label, { active }),
      mainDisabled: !selectableItem(item),
      actionIcon: MODEL_BROWSER_PANEL_SPEC.focusIcon,
      actionLabel: modelBrowserFrameLabel(item.label),
      actionTitle: modelBrowserFrameLabel(item.id),
      actionDisabled: !focusableItem(item),
      onMain: () => selectItem(item),
      onAction: () => focusItem(item)
    });
  }

  function emptyState() {
    return dataPanelEmpty({ namespace: "bc-model-browser", message: MODEL_BROWSER_PANEL_SPEC.emptyMessage });
  }

  function selectItem(item) {
    if (modelCollectionSelectionKind(item.collection) === "smartComponent") {
      onSelectSmartComponent?.(item.id);
    } else {
      onSelectObject?.(item.id);
    }
    onStatusChange?.(modelBrowserSelectionStatus(item.id));
    state.selection = app?.selectionState?.() || state.selection;
    render();
  }

  function focusItem(item) {
    const focused = modelCollectionSelectionKind(item.collection) === "smartComponent"
      ? onFocusSmartComponent?.(item.id)
      : onFocusObject?.(item.id);
    onStatusChange?.(focused === false ? MODEL_BROWSER_PANEL_SPEC.frameEmptyStatus : modelBrowserFramedStatus(item.id));
  }

  function selectableItem(item) {
    if (!modelCollectionSelectable(item.collection)) return false;
    return modelCollectionSelectionKind(item.collection) === "smartComponent" || Boolean(state.project?.objectIndex?.[item.id]);
  }

  function focusableItem(item) {
    if (!modelCollectionFocusable(item.collection)) return false;
    return modelCollectionSelectionKind(item.collection) === "smartComponent" || Boolean(state.project?.objectIndex?.[item.id]);
  }

  function activeItem(item) {
    const selectedIds = new Set(state.selection?.selectedObjectIds || []);
    return selectedIds.has(item.id) || state.selection?.selectedSmartComponentId === item.id;
  }

  function showCollection(collectionId) {
    const id = String(collectionId || "").trim();
    if (!modelCollectionSpec(id)) return false;
    state.visibilityMode = modelBrowserModeForCollectionVisibility(modelCollectionBrowserVisibility(id));
    state.query = id;
    render({ focusSearch: true });
    return true;
  }

  function showObject(collectionId, objectId) {
    const collection = String(collectionId || "").trim();
    const id = String(objectId || "").trim();
    if (!modelCollectionSpec(collection) || !id || !state.project?.model?.[collection]?.[id]) return false;
    state.visibilityMode = modelBrowserModeForCollectionVisibility(modelCollectionBrowserVisibility(collection));
    state.query = id;
    render({ focusObjectId: id });
    return Boolean(findObjectRow(id));
  }

  function focusObjectRow(objectId) {
    const row = findObjectRow(objectId);
    const target = row?.querySelector?.("button, a, input, [tabindex]") || row;
    target?.focus?.();
    return Boolean(row);
  }

  function findObjectRow(objectId) {
    return Array.from(root.querySelectorAll("[data-model-browser-id]"))
      .find((row) => row.dataset.modelBrowserId === objectId) || null;
  }
}

function modelBrowserItems(project, browserVisibility = modelBrowserVisibilityFilter(MODEL_BROWSER_DEFAULT_VISIBILITY)) {
  const model = project?.model || {};
  const objectIndex = project?.objectIndex || {};
  return groupedModelCollections({ browserVisibility }).flatMap((group) => group.collections).flatMap((spec) => {
    const objects = model[spec.id] || {};
    return Object.entries(objects)
      .map(([id, object]) => {
        const descriptor = modelObjectSearchDescriptor(spec.id, id, object, objectIndex[id] || {});
        return {
          id,
          collection: spec.id,
          type: descriptor.type,
          label: descriptor.label,
          description: descriptor.description,
          keywords: descriptor.keywords,
          searchText: descriptor.searchText
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  });
}

function filterItems(items, query) {
  const terms = String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return items;
  return items.filter((item) => {
    const haystack = String(item.searchText || `${item.id} ${item.type} ${item.collection}`).toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
