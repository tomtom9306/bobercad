import {
  dataPanelActionRow,
  dataPanelCollection,
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelRow,
  dataPanelSearch,
  dataPanelSection
} from "../design-system/ui-elements.mjs?v=smart-component-browser-1";
import {
  SMART_COMPONENT_BROWSER_PANEL_SPEC,
  smartComponentCreatedStatus,
  smartComponentKindIcon,
  smartComponentKindLabel,
  smartComponentPickStatus,
  smartComponentPresetActionIcon,
  smartComponentPresetActionLabel,
  smartComponentPresetActionSpec,
  smartComponentSelectedStatus,
  smartComponentSelectionStatus,
  smartComponentStatusIcon,
  smartComponentStatusValue,
  smartComponentTitleCase
} from "../commands/smart-component-browser-metadata.mjs?v=smart-component-browser-metadata-1";

export function mountSmartComponentBrowser({
  root,
  app = null,
  api = null,
  selection = null,
  smartComponentCatalog = null,
  onProjectChange,
  onSmartComponentCreated,
  onStatusChange
} = {}) {
  if (!root || !api) return null;
  const state = {
    query: "",
    selectedPresetId: "",
    activePickPresetId: "",
    pickedMemberIds: [],
    status: "",
    statusState: "",
    project: app?.project?.() || null
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
      cancelPick({ renderPanel: false });
      unsubscribe();
    }
  };

  function render(options = {}) {
    const items = smartComponentItems(api, smartComponentCatalog);
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
      icon: SMART_COMPONENT_BROWSER_PANEL_SPEC.icon,
      title: SMART_COMPONENT_BROWSER_PANEL_SPEC.title,
      meta: `${items.length} ${SMART_COMPONENT_BROWSER_PANEL_SPEC.itemCountLabel}`
    });
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-smart-component-browser",
      value: state.query,
      placeholder: SMART_COMPONENT_BROWSER_PANEL_SPEC.searchPlaceholder,
      label: SMART_COMPONENT_BROWSER_PANEL_SPEC.searchLabel,
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
      value: smartComponentStatusValue(state.pickedMemberIds),
      meta: state.statusState || SMART_COMPONENT_BROWSER_PANEL_SPEC.statusMetaFallback,
      state: state.statusState
    });
  }

  function renderGroup(group) {
    if (!group.items.length) return null;
    return dataPanelSection({
      namespace: "bc-smart-component-browser",
      suffix: "group",
      label: group.label,
      children: dataPanelCollection({
        namespace: "bc-smart-component-browser",
        icon: group.icon,
        label: SMART_COMPONENT_BROWSER_PANEL_SPEC.collectionLabel,
        count: group.items.length,
        rows: group.items.map(renderPresetRow),
        open: true
      })
    });
  }

  function renderPresetRow(item) {
    const active = state.activePickPresetId === item.id;
    const disabled = Boolean(state.activePickPresetId && !active);
    const labelText = smartComponentPresetActionLabel(item, { active });
    return dataPanelActionRow({
      namespace: "bc-smart-component-browser",
      icon: item.icon,
      label: item.name,
      value: [item.definitionTitle, item.version ? `v${item.version}` : ""].filter(Boolean).join(" - "),
      active: item.id === state.selectedPresetId,
      rowDataset: { smartComponentPresetId: item.id },
      mainLabel: `Select ${item.name}`,
      mainTitle: `Select ${item.name}`,
      actionIcon: smartComponentPresetActionIcon(item, { active }),
      actionLabel: labelText,
      actionTitle: labelText,
      actionDisabled: disabled,
      onMain: () => selectPreset(item),
      onAction: () => {
        if (active) cancelPick();
        else createOrPickPreset(item);
      }
    });
  }

  function emptyState() {
    return dataPanelEmpty({ namespace: "bc-smart-component-browser", message: SMART_COMPONENT_BROWSER_PANEL_SPEC.emptyMessage });
  }

  function selectPreset(item) {
    state.selectedPresetId = item.id;
    state.status = smartComponentSelectionStatus(item);
    state.statusState = item.kind;
    onStatusChange?.(smartComponentSelectedStatus(item));
    render();
  }

  function createOrPickPreset(item) {
    state.selectedPresetId = item.id;
    if (smartComponentPresetActionSpec(item.kind).mode === "member-pick") {
      startMemberPick(item);
      return;
    }
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

  function startMemberPick(item) {
    if (!selection?.beginMemberPick) {
      state.status = SMART_COMPONENT_BROWSER_PANEL_SPEC.memberPickUnavailableStatus;
      state.statusState = "error";
      render();
      return;
    }
    cancelPick({ renderPanel: false });
    state.activePickPresetId = item.id;
    state.pickedMemberIds = [];
    state.status = smartComponentPickStatus(item);
    state.statusState = "pick";
    selection.beginMemberPick({
      count: 2,
      onPick: (memberIds) => {
        state.pickedMemberIds = Array.isArray(memberIds) ? memberIds : [];
        state.status = state.pickedMemberIds.length === 1 ? SMART_COMPONENT_BROWSER_PANEL_SPEC.secondMemberPickStatus : smartComponentPickStatus(item);
        render();
      },
      onComplete: (memberIds) => createConnectionPreset(item, memberIds),
      onError: (message) => {
        state.status = message;
        state.statusState = "error";
        render();
      }
    });
    onStatusChange?.(smartComponentPickStatus(item));
    render();
  }

  function createConnectionPreset(item, memberIds) {
    if (state.activePickPresetId !== item.id) return;
    state.pickedMemberIds = Array.isArray(memberIds) ? memberIds : [];
    try {
      const result = api.createSmartComponentFromPreset(item.id, state.pickedMemberIds);
      onProjectChange?.(result.project);
      onSmartComponentCreated?.(result.smartComponentId);
      state.activePickPresetId = "";
      state.pickedMemberIds = [];
      state.status = smartComponentCreatedStatus(result.smartComponentId);
      state.statusState = "created";
      onStatusChange?.(smartComponentCreatedStatus(result.smartComponentId));
    } catch (error) {
      state.pickedMemberIds = [];
      selection?.clear?.();
      state.status = error.message;
      state.statusState = "error";
      onStatusChange?.(error.message);
    }
    render();
  }

  function cancelPick({ renderPanel = true } = {}) {
    if (!state.activePickPresetId) return false;
    selection?.cancelPick?.();
    state.activePickPresetId = "";
    state.pickedMemberIds = [];
    state.status = SMART_COMPONENT_BROWSER_PANEL_SPEC.cancelPickStatus;
    state.statusState = "cancelled";
    onStatusChange?.(SMART_COMPONENT_BROWSER_PANEL_SPEC.cancelPickStatus);
    if (renderPanel) render();
    return true;
  }

  function showPreset(presetId) {
    const id = String(presetId || "").trim();
    if (!id) return false;
    const item = smartComponentItems(api, smartComponentCatalog).find((candidate) => candidate.id === id);
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

function smartComponentItems(api, catalog) {
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
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function filterItems(items, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => item.searchText.includes(needle));
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
