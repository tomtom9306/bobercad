import { DATA_DOCK_TABS } from "./data-dock-metadata.mjs";
import { dataLibraryDescriptor, dataSourceDescriptor, projectReferenceGeometryFileSources, sortDataLibraryEntries } from "./data-surface-metadata.mjs";
import { MODEL_COLLECTION_SPECS, modelCollectionSelectionKind, modelObjectSearchDescriptor } from "./model-collection-metadata.mjs";
import { smartComponentKindIcon, smartComponentTitleCase } from "./smart-component-browser-metadata.mjs";
import { commandPaletteResultKindLabel } from "./command-palette-metadata.mjs";

export const LEFT_DOCK_RESULT_GROUP_LABELS = Object.freeze({
  files: "Files",
  data: "Data",
  model: "Model",
  connections: "Connections",
  components: "Components"
});

export const LEFT_DOCK_RESULT_KINDS = Object.freeze([
  "source-file",
  "project-data-row",
  "model-collection",
  "model-object",
  "smart-component-preset"
]);

const DATA_DOCK_TAB_IDS = new Set(DATA_DOCK_TABS.map((tab) => tab.id));

export function leftDockResultSpecs({
  project = null,
  sources = [],
  smartComponentPresets = [],
  smartComponentCatalog = null
} = {}) {
  return [
    ...projectFileResults(project, sources),
    ...projectDataResults(project),
    ...modelResults(project),
    ...smartComponentPresetResults(smartComponentPresets, smartComponentCatalog)
  ];
}

export function validLeftDockResultAction(action = {}) {
  if (!action.type || !DATA_DOCK_TAB_IDS.has(action.tab)) return false;
  if (action.type === "showFileRow") return Boolean(action.rowId);
  if (action.type === "showDataRow") return Boolean(action.rowId);
  if (action.type === "showModelCollection") return Boolean(action.collectionId);
  if (action.type === "selectModelObject") return Boolean(action.collectionId && action.objectId);
  if (action.type === "selectSmartComponent") return Boolean(action.collectionId && (action.smartComponentId || action.objectId));
  if (action.type === "showSmartComponentPreset") return Boolean(action.presetId);
  return false;
}

function projectFileResults(project, sources = []) {
  const explicitSources = Array.isArray(sources) ? sources : [];
  const sourceResults = explicitSources
    .filter((source) => source?.label)
    .map((source) => {
      const descriptor = dataSourceDescriptor(source);
      return fileResult({
        id: `leftDock.files.source.${safeId(descriptor.id)}`,
        title: descriptor.label,
        description: descriptor.description,
        icon: descriptor.icon,
        rowId: `source-${descriptor.id}`,
        keywords: descriptor.keywords
      });
    });
  const explicitSourceIds = new Set(explicitSources.map((source) => source?.id).filter(Boolean));
  const referenceSourceResults = projectReferenceGeometryFileSources(project)
    .filter((source) => !explicitSourceIds.has(source.id))
    .map((source) => {
      const descriptor = dataSourceDescriptor(source);
      return fileResult({
        id: `leftDock.files.source.${safeId(descriptor.id)}`,
        title: descriptor.label,
        description: descriptor.description,
        icon: descriptor.icon,
        rowId: `source-${descriptor.id}`,
        keywords: descriptor.keywords
      });
    });
  const libraries = project?.libraries && typeof project.libraries === "object" && !Array.isArray(project.libraries)
    ? project.libraries
    : {};
  const librarySourceResults = sortDataLibraryEntries(Object.entries(libraries).map(([id, config]) => ({ id, config: config || {} })))
    .filter((entry) => !explicitSourceIds.has(`library-${entry.id}`))
    .map((entry) => {
      const descriptor = dataLibraryDescriptor(entry.id, entry.config);
      const sourceDescriptor = dataSourceDescriptor({
        id: `library-${entry.id}`,
        icon: descriptor.icon,
        label: descriptor.sourceLabel,
        kind: descriptor.sourceKind,
        path: descriptor.path
      });
      return fileResult({
        id: `leftDock.files.source.library.${safeId(entry.id)}`,
        title: `${descriptor.label} library source`,
        description: sourceDescriptor.description,
        icon: descriptor.icon,
        rowId: `source-${sourceDescriptor.id}`,
        keywords: [...descriptor.keywords, ...sourceDescriptor.keywords]
      });
    });
  return [...sourceResults, ...referenceSourceResults, ...librarySourceResults];
}

function projectDataResults(project) {
  const libraries = project?.libraries && typeof project.libraries === "object" && !Array.isArray(project.libraries)
    ? project.libraries
    : {};
  const libraryResults = sortDataLibraryEntries(Object.entries(libraries).map(([id, config]) => ({ id, config: config || {} })))
    .map((entry) => {
      const descriptor = dataLibraryDescriptor(entry.id, entry.config);
      return dataResult({
        id: `leftDock.data.library.${safeId(entry.id)}`,
        title: descriptor.label,
        description: descriptor.description,
        icon: descriptor.icon,
        rowId: `library-${entry.id}`,
        keywords: descriptor.keywords
      });
    });
  return libraryResults;
}

function modelResults(project) {
  const model = project?.model || {};
  const objectIndex = project?.objectIndex || {};
  return MODEL_COLLECTION_SPECS.flatMap((spec) => {
    const entries = Object.entries(model[spec.id] || {});
    if (!entries.length) return [];
    const collectionResult = result({
      id: `leftDock.model.collection.${safeId(spec.id)}`,
      kind: "model-collection",
      title: spec.label,
      description: `${entries.length} ${spec.singularLabel || spec.label}`,
      groupLabel: LEFT_DOCK_RESULT_GROUP_LABELS.model,
      icon: spec.icon,
      keywords: [spec.id, spec.group, spec.singularLabel],
      action: {
        type: "showModelCollection",
        tab: "model",
        collectionId: spec.id
      }
    });
    const objectResults = entries.map(([id, object]) => {
      const selectionKind = modelCollectionSelectionKind(spec.id);
      const descriptor = modelObjectSearchDescriptor(spec.id, id, object, objectIndex[id] || {});
      return result({
        id: `leftDock.model.object.${safeId(spec.id)}.${safeId(id)}`,
        kind: "model-object",
        title: descriptor.label,
        description: descriptor.description,
        groupLabel: LEFT_DOCK_RESULT_GROUP_LABELS.model,
        icon: spec.icon,
        keywords: descriptor.keywords,
        action: {
          type: selectionKind === "smartComponent" ? "selectSmartComponent" : "selectModelObject",
          tab: "model",
          collectionId: spec.id,
          objectId: id,
          smartComponentId: selectionKind === "smartComponent" ? id : "",
          selectionKind
        }
      });
    });
    return [collectionResult, ...objectResults];
  });
}

function smartComponentPresetResults(presets = [], catalog = null) {
  const definitions = catalog?.definitions || {};
  return (Array.isArray(presets) ? presets : [])
    .map((preset) => {
      const definition = definitions[preset?.type] || {};
      const kind = preset?.kind || definition.kind || "component";
      const tab = kind === "connection" ? "connections" : "components";
      return result({
        id: `leftDock.components.preset.${safeId(preset?.id || preset?.name)}`,
        kind: "smart-component-preset",
        title: preset?.name || preset?.id,
        description: [definition.title || smartComponentTitleCase(preset?.type || ""), kind, preset?.version ? `v${preset.version}` : ""].filter(Boolean).join(" - "),
        groupLabel: LEFT_DOCK_RESULT_GROUP_LABELS[tab],
        icon: smartComponentKindIcon(kind),
        keywords: [preset?.id, preset?.name, preset?.description, preset?.type, kind, definition.title],
        action: {
          type: "showSmartComponentPreset",
          tab,
          presetId: preset?.id
        }
      });
    })
    .filter((item) => item.title && item.action.presetId);
}

function fileResult({ id, title, description, icon, rowId, keywords = [] }) {
  return result({
    id,
    kind: "source-file",
    title,
    description,
    groupLabel: LEFT_DOCK_RESULT_GROUP_LABELS.files,
    icon,
    keywords,
    action: {
      type: "showFileRow",
      tab: "files",
      rowId
    }
  });
}

function dataResult({ id, title, description, icon, rowId, keywords = [] }) {
  return result({
    id,
    kind: "project-data-row",
    title,
    description,
    groupLabel: LEFT_DOCK_RESULT_GROUP_LABELS.data,
    icon,
    keywords,
    action: {
      type: "showDataRow",
      tab: "data",
      rowId
    }
  });
}

function result({ id, kind, title, description, groupLabel, icon, keywords = [], action }) {
  const kindLabel = commandPaletteResultKindLabel(kind);
  return Object.freeze({
    id,
    kind,
    label: title,
    title,
    description,
    group: "left-dock",
    groupLabel,
    kindLabel,
    icon,
    keywords: [kind, kindLabel, ...keywords].filter(Boolean).map(String),
    recent: false,
    toolbarPin: false,
    paletteDefault: false,
    action
  });
}

function safeId(value = "") {
  return String(value || "item").replace(/[^A-Za-z0-9.-]+/g, "-");
}
