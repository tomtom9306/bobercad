import {
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelLinkRow,
  dataPanelSearch,
  dataPanelSection
} from "../design-system/ui-elements.mjs";
import {
  dataLibraryDescriptor,
  dataLibraryFallbackSpec,
  dataSourceDescriptor,
  projectReferenceGeometryFileSources,
  sortDataLibraryEntries
} from "../commands/data-surface-metadata.mjs";
import {
  PROJECT_DATA_PANEL_SPEC,
  projectDataActionTitle,
  projectDataRowActionSpec
} from "../commands/project-data-metadata.mjs";

const PROJECT_FILES_PANEL_SPEC = Object.freeze({
  title: "Files",
  icon: "file",
  searchPlaceholder: "Search files",
  searchLabel: "Search project files",
  emptySearchMessage: "No matching files.",
  emptySectionMessage: "No files available.",
  sourceLabel: "Project Sources",
  referenceLabel: "Reference Geometry",
  libraryLabel: "Library Configs"
});

export function mountProjectFilesPanel({
  root,
  app = null,
  sources = [],
  sourceBaseUrl = ""
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

  root.classList.add("bc-project-files-panel", "bc-data-panel");
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
    const rows = fileRows(project, sources, { sourceBaseUrl });
    const sections = filterSections([
      { label: PROJECT_FILES_PANEL_SPEC.sourceLabel, rows: rows.sources },
      { label: PROJECT_FILES_PANEL_SPEC.referenceLabel, rows: rows.references },
      { label: PROJECT_FILES_PANEL_SPEC.libraryLabel, rows: rows.libraries }
    ], state.query);
    const empty = sections.length ? null : dataPanelEmpty({
      namespace: "bc-project-files",
      message: PROJECT_FILES_PANEL_SPEC.emptySearchMessage
    });
    root.replaceChildren(
      header(project, rows.sources.length + rows.references.length + rows.libraries.length),
      renderSearch(),
      ...sections.map((item) => section(item.label, item.rows)),
      ...[empty].filter(Boolean)
    );
    if (options.focusSearch) {
      const input = root.querySelector("[data-project-files-search]");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    } else if (options.focusRow) {
      focusRow(options.focusRow);
    }
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-project-files",
      value: state.query,
      placeholder: PROJECT_FILES_PANEL_SPEC.searchPlaceholder,
      label: PROJECT_FILES_PANEL_SPEC.searchLabel,
      datasetKey: "projectFilesSearch",
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
    return Array.from(root.querySelectorAll("[data-project-files-id]"))
      .find((node) => node.dataset.projectFilesId === rowId) || null;
  }
}

function header(project, count) {
  return dataPanelHeader({
    namespace: "bc-project-files",
    icon: PROJECT_FILES_PANEL_SPEC.icon,
    title: PROJECT_FILES_PANEL_SPEC.title,
    meta: `${count} files - ${project?.schemaVersion || PROJECT_DATA_PANEL_SPEC.schemaFallback}`
  });
}

function section(label, rows = []) {
  return dataPanelSection({
    namespace: "bc-project-files",
    label,
    children: rows,
    emptyMessage: PROJECT_FILES_PANEL_SPEC.emptySectionMessage,
    list: true
  });
}

function fileRows(project, sources = [], options = {}) {
  const explicitSources = Array.isArray(sources) ? sources : [];
  const explicitRows = explicitSources.map((source) => fileRow(source, options)).filter(Boolean);
  const explicitIds = new Set(explicitSources.map((source) => source?.id).filter(Boolean));
  const references = projectReferenceGeometryFileEntries(project)
    .filter((entry) => !explicitIds.has(entry.id))
    .map((entry) => fileRow(entry, options))
    .filter(Boolean);
  const libraries = projectLibraryEntries(project)
    .filter((entry) => !explicitIds.has(`library-${entry.id}`))
    .map((entry) => {
      const descriptor = dataLibraryDescriptor(entry.id, entry.config);
      return fileRow({
        id: `library-${entry.id}`,
        icon: dataLibraryFallbackSpec(entry.id).icon,
        label: descriptor.sourceLabel,
        kind: descriptor.sourceKind,
        path: descriptor.path
      }, options);
    })
    .filter(Boolean);
  return { sources: explicitRows, references, libraries };
}

export function projectReferenceGeometryFileEntries(project = {}) {
  return projectReferenceGeometryFileSources(project);
}

function fileRow(source, options = {}) {
  if (!source?.label) return null;
  const descriptor = dataSourceDescriptor(source);
  const href = resolvedHref(source.path, source.baseUrl || options.sourceBaseUrl);
  const actionSpec = projectDataRowActionSpec("openSource");
  if (!href) return null;
  return dataPanelLinkRow({
    namespace: "bc-project-files",
    icon: descriptor.icon,
    label: descriptor.label,
    value: rowValue(descriptor.displayPath, descriptor.statusMeta || descriptor.meta || descriptor.kind),
    href,
    rowDataset: projectFilesRowDataset(`source-${descriptor.id}`, actionSpec.id, href, descriptor.searchText),
    mainDataset: projectFilesActionDataset(actionSpec.id, href),
    actionDataset: projectFilesActionDataset(actionSpec.id, href),
    mainLabel: projectDataActionTitle(actionSpec.id, source.label),
    mainTitle: projectDataActionTitle(actionSpec.id, source.label),
    actionLabel: actionSpec.label,
    actionTitle: projectDataActionTitle(actionSpec.id, source.label),
    actionIcon: actionSpec.icon
  });
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
  const nestedIntentElements = row?.querySelectorAll?.("[data-project-files-id], [data-project-files-action], [data-project-files-target]") || [];
  const datasetText = [
    ...Object.values(row?.dataset || {}),
    ...Array.from(nestedIntentElements)
      .flatMap((element) => Object.values(element.dataset || {}))
  ].join(" ");
  const haystack = `${sectionLabel} ${row?.textContent || ""} ${datasetText}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function projectFilesRowDataset(id, action, target, searchText = "") {
  return {
    projectFilesId: id,
    projectFilesKeywords: searchText,
    ...projectFilesActionDataset(action, target)
  };
}

function projectFilesActionDataset(action, target) {
  return {
    projectFilesAction: action,
    projectFilesTarget: target
  };
}

function projectLibraryEntries(project) {
  const libraries = project?.libraries && typeof project.libraries === "object" && !Array.isArray(project.libraries)
    ? project.libraries
    : {};
  return sortDataLibraryEntries(Object.entries(libraries)
    .map(([id, config]) => ({ id, config: config || {} })));
}

function rowValue(value, meta = "") {
  return [value || "-", meta].filter(Boolean).join(" - ");
}

function resolvedHref(value, baseUrl = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return new URL(text, baseUrl || window.location.href).href;
  } catch {
    return "";
  }
}

function searchTerms(query) {
  return String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}
