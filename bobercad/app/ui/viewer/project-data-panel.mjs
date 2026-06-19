import {
  dataPanelActionRow,
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelRow,
  dataPanelSearch,
  dataPanelSection
} from "../design-system/ui-elements.mjs?v=project-data-panel-1";
import {
  DATA_LIBRARY_DEFAULT_IDS,
  dataLibraryDescriptor,
  dataLibraryFallbackSpec,
  sortDataLibraryEntries
} from "../commands/data-surface-metadata.mjs?v=data-surface-metadata-1";
import { MODEL_COLLECTION_SPECS } from "../commands/model-collection-metadata.mjs?v=model-collection-metadata-1";
import {
  PROJECT_DATA_PANEL_SPEC,
  PROJECT_DATA_SETTING_ROW_SPECS,
  projectDataActionTitle,
  projectDataRowActionSpec,
  projectDataSectionLabel
} from "../commands/project-data-metadata.mjs?v=project-data-metadata-1";

export function mountProjectDataPanel({
  root,
  app = null,
  libraries = {},
  smartComponentCatalog = null,
  onRowAction = null
} = {}) {
  if (!root) return null;
  const state = {
    query: "",
    project: app?.project?.() || null
  };
  const unsubscribe = app?.subscribe?.((project) => {
    state.project = project || app?.project?.() || null;
    render();
  }) || (() => {});

  root.classList.add("bc-project-data-panel", "bc-data-panel");
  render();

  return {
    refresh() {
      state.project = app?.project?.() || state.project;
      render();
    },
    showRow(rowId, query = rowId) {
      return showRow(rowId, query);
    },
    destroy() {
      unsubscribe();
    }
  };

  function render(options = {}) {
    const project = state.project || {};
    const modelCount = modelItemCount(project);
    const sections = filterSections([
      { label: projectDataSectionLabel("libraries"), rows: libraryRows(project, libraries, smartComponentCatalog, { onRowAction }) },
      { label: projectDataSectionLabel("model"), rows: modelRows(project, { onRowAction }) },
      { label: projectDataSectionLabel("settings"), rows: projectRows(project) }
    ], state.query);
    const empty = sections.length ? null : emptyState(PROJECT_DATA_PANEL_SPEC.emptySearchMessage);
    root.replaceChildren(
      header(project, modelCount),
      renderSearch(),
      ...sections.map((item) => section(item.label, item.rows)),
      ...[empty].filter(Boolean)
    );
    if (options.focusSearch) {
      const input = root.querySelector("[data-project-data-search]");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    } else if (options.focusRow) {
      focusRow(options.focusRow);
    }
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-project-data",
      value: state.query,
      placeholder: PROJECT_DATA_PANEL_SPEC.searchPlaceholder,
      label: PROJECT_DATA_PANEL_SPEC.searchLabel,
      datasetKey: "projectDataSearch",
      onInput: (value) => {
        state.query = value;
        render({ focusSearch: true });
      }
    });
  }

  function showRow(rowId, query = rowId) {
    const id = String(rowId || "").trim();
    if (!id) return false;
    state.query = String(query || id);
    render({ focusRow: id });
    return Boolean(findRow(id));
  }

  function focusRow(rowId) {
    const rowNode = findRow(rowId);
    const focusTarget = rowNode?.querySelector?.("button, a, input, [tabindex]") || rowNode;
    focusTarget?.focus?.();
    return Boolean(rowNode);
  }

  function findRow(rowId) {
    return Array.from(root.querySelectorAll("[data-project-data-id]"))
      .find((node) => node.dataset.projectDataId === rowId) || null;
  }
}

function header(project, modelCount) {
  return dataPanelHeader({
    namespace: "bc-project-data",
    icon: PROJECT_DATA_PANEL_SPEC.icon,
    title: PROJECT_DATA_PANEL_SPEC.title,
    meta: `${modelCount} ${PROJECT_DATA_PANEL_SPEC.modelItemLabel} - ${project?.schemaVersion || PROJECT_DATA_PANEL_SPEC.schemaFallback}`
  });
}

function section(label, rows = []) {
  return dataPanelSection({
    namespace: "bc-project-data",
    label,
    children: rows,
    emptyMessage: PROJECT_DATA_PANEL_SPEC.emptySectionMessage,
    list: true
  });
}

function emptyState(message = PROJECT_DATA_PANEL_SPEC.emptySectionMessage) {
  return dataPanelEmpty({ namespace: "bc-project-data", message });
}

function row({
  icon = "file",
  label,
  value,
  meta = "",
  id = "",
  onAction = null,
  action = "",
  target = "",
  actionLabel = "Open",
  actionIcon = "model-browser",
  actionTitle = actionLabel
} = {}) {
  if (!label) return null;
  if (typeof onAction === "function") return actionRow({ icon, label, value, meta, id, onAction, action, target, actionLabel, actionIcon, actionTitle });
  return dataPanelRow({
    namespace: "bc-project-data",
    icon,
    label,
    value: value || "-",
    meta,
    dataset: { projectDataId: id }
  });
}

function actionRow({ icon, label, value, meta = "", id = "", onAction, action = "", target = "", actionLabel, actionIcon, actionTitle } = {}) {
  const runAction = () => onAction?.({ action, target, id, label, value, meta });
  return dataPanelActionRow({
    namespace: "bc-project-data",
    icon,
    label,
    value: rowValue(value, meta),
    rowDataset: projectDataRowDataset(id, action, target),
    mainDataset: projectDataActionDataset(action, target),
    actionDataset: projectDataActionDataset(action, target),
    mainLabel: actionTitle || actionLabel || label,
    mainTitle: actionTitle || actionLabel || label,
    actionLabel,
    actionTitle: actionTitle || actionLabel || label,
    actionIcon,
    onMain: runAction,
    onAction: runAction
  });
}

function projectDataRowDataset(id, action, target) {
  return {
    projectDataId: id,
    ...projectDataActionDataset(action, target)
  };
}

function projectDataActionDataset(action, target) {
  return {
    projectDataAction: action,
    projectDataTarget: target
  };
}

function rowValue(value, meta = "") {
  return [value || "-", meta].filter(Boolean).join(" - ");
}

function libraryRows(project, libraries, smartComponentCatalog, actions = {}) {
  const declared = projectLibraryEntries(project);
  const ids = declared.length ? declared.map((entry) => entry.id) : DATA_LIBRARY_DEFAULT_IDS;
  return ids
    .map((id) => libraryRow(id, project?.libraries?.[id], loadedLibrary(id, libraries, smartComponentCatalog), actions))
    .filter(Boolean);
}

function libraryRow(id, config = null, loaded = {}, actions = {}) {
  const descriptor = dataLibraryDescriptor(id, config, loaded);
  const actionSpec = projectDataRowActionSpec("showComponents");
  return row({
    id: `library-${id}`,
    icon: descriptor.icon,
    label: descriptor.label,
    value: descriptor.value,
    meta: descriptor.meta,
    onAction: id === "smartComponents" ? actions.onRowAction : null,
    action: actionSpec.id,
    target: id,
    actionIcon: actionSpec.icon,
    actionLabel: actionSpec.label,
    actionTitle: projectDataActionTitle(actionSpec.id, "Smart Components library")
  });
}

function modelRows(project, actions = {}) {
  const model = project?.model || {};
  const actionSpec = projectDataRowActionSpec("showCollection");
  return MODEL_COLLECTION_SPECS
    .map((spec) => {
      const count = entryCount(model[spec.id]);
      if (!count) return null;
      return row({
        id: `model-${spec.id}`,
        icon: spec.icon,
        label: spec.label,
        value: spec.id,
        meta: String(count),
        onAction: actions.onRowAction,
        action: actionSpec.id,
        target: spec.id,
        actionIcon: actionSpec.icon,
        actionLabel: actionSpec.label,
        actionTitle: projectDataActionTitle(actionSpec.id, `${spec.label} in Model browser`)
      });
    })
    .filter(Boolean);
}

function projectRows(project) {
  const settings = project?.settings || {};
  const units = settings.units || {};
  return PROJECT_DATA_SETTING_ROW_SPECS.map((spec) => row({
    id: spec.id,
    icon: spec.icon,
    label: spec.label,
    value: projectSettingValue(spec, project, units),
    meta: projectSettingMeta(spec, project)
  }));
}

function projectSettingValue(spec, project, units = {}) {
  if (spec.id === "project-schema") return project?.schema || "-";
  if (spec.id === "project-units-length") return units.length || "-";
  if (spec.id === "project-units-angle") return units.angle || "-";
  if (spec.valueLabel) return spec.valueLabel;
  return "-";
}

function projectSettingMeta(spec, project) {
  if (spec.id === "project-schema") return project?.schemaVersion || "";
  if (spec.id === "project-object-index") return `${entryCount(project?.objectIndex)} ${spec.metaUnit || ""}`.trim();
  return spec.meta || "";
}

function filterSections(sections, query) {
  const terms = searchTerms(query);
  if (!terms.length) return sections;
  return sections
    .map((sectionEntry) => ({
      ...sectionEntry,
      rows: sectionEntry.rows.filter((row) => rowMatchesQuery(row, terms, sectionEntry.label))
    }))
    .filter((sectionEntry) => sectionEntry.rows.length);
}

function rowMatchesQuery(row, terms, sectionLabel = "") {
  const nestedIntentElements = row?.querySelectorAll?.("[data-project-data-id], [data-project-data-action], [data-project-data-target]") || [];
  const datasetText = [
    ...Object.values(row?.dataset || {}),
    ...Array.from(nestedIntentElements)
      .flatMap((element) => Object.values(element.dataset || {}))
  ].join(" ");
  const haystack = `${sectionLabel} ${row?.textContent || ""} ${datasetText}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function searchTerms(query) {
  return String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function modelItemCount(project) {
  const model = project?.model || {};
  return MODEL_COLLECTION_SPECS.reduce((total, spec) => total + entryCount(model[spec.id]), 0);
}

function entryCount(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function smartComponentPresetCount(catalog) {
  return entryCount(catalog?.smartComponents);
}

function smartComponentCatalogName(catalog) {
  return catalog?.name || catalog?.id || "Registered Smart Component catalog";
}

function projectLibraryEntries(project) {
  const libraries = project?.libraries && typeof project.libraries === "object" && !Array.isArray(project.libraries)
    ? project.libraries
    : {};
  return sortDataLibraryEntries(Object.entries(libraries)
    .map(([id, config]) => ({ id, config: config || {} })));
}

function librarySpec(id) {
  return dataLibraryFallbackSpec(id);
}

function loadedLibrary(id, libraries = {}, smartComponentCatalog = null) {
  const spec = librarySpec(id);
  if (id === "smartComponents") {
    return {
      name: smartComponentCatalogName(smartComponentCatalog),
      count: smartComponentPresetCount(smartComponentCatalog),
      unit: "presets"
    };
  }
  const library = libraries?.[id];
  if (!library) return { name: "", count: null, unit: "entries" };
  return {
    name: library?.library?.name || library?.library?.id || "",
    count: entryCount(library?.[spec.entryKey]),
    unit: "entries"
  };
}
