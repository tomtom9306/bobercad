export const MODEL_COLLECTION_GROUP_SPECS = Object.freeze([
  {
    id: "model",
    label: "Model",
    description: "Primary editable model objects."
  },
  {
    id: "connections",
    label: "Connections",
    description: "Connection components, welds, bolt groups, bolts, and automatic connection zones."
  },
  {
    id: "fabrication",
    label: "Fabrication",
    description: "Fabrication objects with scene-backed geometry."
  },
  {
    id: "components",
    label: "Components",
    description: "Generated and reusable authoring components."
  },
  {
    id: "references",
    label: "References",
    description: "Authoring references used to build and review the model."
  },
  {
    id: "connectionData",
    label: "Connection Data",
    description: "Stored connection locations and interface metadata."
  },
  {
    id: "organization",
    label: "Organization",
    description: "Assembly and grouping metadata."
  },
  {
    id: "authoringData",
    label: "Authoring Data",
    description: "Pattern and relation records used by authoring tools."
  }
]);

export const MODEL_COLLECTION_SPECS = Object.freeze([
  collection("members", "Members", "Member", "beam", "model", { defaultOpen: true }),
  collection("plates", "Plates", "Plate", "plate", "model", { defaultOpen: true }),
  collection("sketches", "Sketches", "Sketch", "sketch", "model"),
  collection("smartComponentInstances", "Connection Components", "Connection Component", "smart-component", "connections", {
    defaultOpen: true,
    showWhenEmpty: true,
    selectionKind: "smartComponent"
  }),
  collection("welds", "Welds", "Weld", "weld", "connections", { showWhenEmpty: true }),
  collection("fastenerGroups", "Bolt Groups", "Bolt Group", "fastener", "connections", { showWhenEmpty: true }),
  collection("holePatterns", "Bolts", "Bolt", "hole-pattern", "connections", { focusable: false, showWhenEmpty: true }),
  collection("connectionZones", "Auto Connections", "Auto Connection", "connection-zone", "connections", { focusable: false, showWhenEmpty: true }),
  collection("features", "Features", "Feature", "feature", "fabrication"),
  collection("trimJoints", "Trim Joints", "Trim Joint", "trim", "fabrication"),
  collection("gridSystems", "Grid Systems", "Grid System", "grid", "references", { defaultOpen: true, focusable: false }),
  collection("levels", "Levels", "Level", "reference-plane", "references", { defaultOpen: true, focusable: false }),
  collection("workPoints", "Work Points", "Work Point", "work-point", "references", { focusable: false }),
  collection("referencePlanes", "Reference Planes", "Reference Plane", "reference-plane", "references", { focusable: false }),
  collection("interfaces", "Interfaces", "Interface", "interface", "connectionData", { browserVisibility: "advanced", focusable: false }),
  collection("assemblies", "Assemblies", "Assembly", "assembly", "organization", { browserVisibility: "advanced", focusable: false }),
  collection("groups", "Groups", "Group", "group", "organization", { browserVisibility: "advanced", focusable: false }),
  collection("objectPatterns", "Object Patterns", "Object Pattern", "object-pattern", "authoringData", { browserVisibility: "advanced", focusable: false }),
  collection("relations", "Relations", "Relation", "relation", "authoringData", { browserVisibility: "advanced", focusable: false })
]);

export const MODEL_COLLECTION_IDS = Object.freeze(MODEL_COLLECTION_SPECS.map((spec) => spec.id));

const COLLECTION_BY_ID = new Map(MODEL_COLLECTION_SPECS.map((spec) => [spec.id, spec]));
const GROUP_BY_ID = new Map(MODEL_COLLECTION_GROUP_SPECS.map((spec) => [spec.id, spec]));

export function modelCollectionSpec(collectionId) {
  return COLLECTION_BY_ID.get(collectionId) || null;
}

export function modelCollectionGroupSpec(groupId) {
  return GROUP_BY_ID.get(groupId) || null;
}

export function groupedModelCollections({ browserVisibility = null } = {}) {
  return MODEL_COLLECTION_GROUP_SPECS
    .map((group) => ({
      ...group,
      collections: MODEL_COLLECTION_SPECS.filter((collectionSpec) => (
        collectionSpec.group === group.id && collectionMatchesBrowserVisibility(collectionSpec, browserVisibility)
      ))
    }))
    .filter((group) => group.collections.length);
}

export function modelCollectionLabel(collectionId, { singular = false } = {}) {
  const spec = modelCollectionSpec(collectionId);
  if (!spec) return titleCase(collectionId);
  return singular ? spec.singularLabel : spec.label;
}

export function modelCollectionIcon(collectionId) {
  return modelCollectionSpec(collectionId)?.icon || "database";
}

export function modelCollectionDefaultOpen(collectionId) {
  return modelCollectionSpec(collectionId)?.defaultOpen === true;
}

export function modelCollectionSelectable(collectionId) {
  return modelCollectionSpec(collectionId)?.selectable !== false;
}

export function modelCollectionFocusable(collectionId) {
  return modelCollectionSpec(collectionId)?.focusable !== false;
}

export function modelCollectionSelectionKind(collectionId) {
  return modelCollectionSpec(collectionId)?.selectionKind || "object";
}

export function modelCollectionBrowserVisibility(collectionId) {
  return modelCollectionSpec(collectionId)?.browserVisibility || "primary";
}

export function modelObjectSearchDescriptor(collectionId, objectId, object = {}, indexEntry = {}) {
  const spec = modelCollectionSpec(collectionId);
  const id = cleanString(objectId);
  const type = cleanString(object?.type || indexEntry?.type || spec?.singularLabel || collectionId);
  const collectionLabel = cleanString(spec?.label || titleCase(collectionId));
  const semanticFields = [
    semanticValue("Part", firstValue(object, indexEntry, [["fabrication", "partMark"], ["partMark"]])),
    semanticValue("Assembly", firstValue(object, indexEntry, [["fabrication", "assemblyMark"], ["assemblyMark"], ["assemblyId"]])),
    semanticValue("Numbering", firstValue(object, indexEntry, [["fabrication", "numberingStatus"], ["numberingStatus"]])),
    semanticValue("Profile", firstValue(object, indexEntry, [["profileRef"], ["profile"], ["sectionProfileRef"]])),
    semanticValue("Material", firstValue(object, indexEntry, [["materialRef"], ["material"]])),
    semanticValue("Fastener", firstValue(object, indexEntry, [["fastenerRef"], ["catalogRef"], ["catalogEntryRef"]])),
    semanticValue("Component", firstValue(object, indexEntry, [["componentRef"], ["definitionRef"], ["smartComponentRef"], ["smartComponentId"]])),
    semanticValue("Kind", firstValue(object, indexEntry, [["kind"]]))
  ].filter(Boolean);
  const semanticValues = semanticFields.map((field) => field.value);
  const keywords = uniqueStrings([
    id,
    collectionId,
    collectionLabel,
    spec?.singularLabel,
    spec?.group,
    type,
    indexEntry?.type,
    ...semanticValues
  ]);
  const description = [type, collectionLabel, ...semanticFields.map((field) => field.label)].filter(Boolean).join(" - ");
  return Object.freeze({
    id,
    label: id,
    type,
    collectionLabel,
    description,
    keywords,
    searchText: uniqueStrings([id, type, collectionId, collectionLabel, description, ...keywords]).join(" ")
  });
}

function collection(id, label, singularLabel, icon, group, options = {}) {
  return Object.freeze({
    id,
    label,
    singularLabel,
    icon,
    group,
    defaultOpen: options.defaultOpen === true,
    showWhenEmpty: options.showWhenEmpty === true,
    selectable: options.selectable !== false,
    focusable: options.focusable !== false,
    browserVisibility: options.browserVisibility || "primary",
    selectionKind: options.selectionKind || "object"
  });
}

function collectionMatchesBrowserVisibility(spec, browserVisibility) {
  if (!browserVisibility) return true;
  if (Array.isArray(browserVisibility)) return browserVisibility.includes(spec.browserVisibility);
  return spec.browserVisibility === browserVisibility;
}

function semanticValue(label, value) {
  const text = cleanString(value);
  return text ? { label: `${label}: ${text}`, value: text } : null;
}

function firstValue(object = {}, indexEntry = {}, paths = []) {
  for (const path of paths) {
    const objectValue = valueAtPath(object, path);
    if (hasSearchValue(objectValue)) return objectValue;
    const indexValue = valueAtPath(indexEntry, path);
    if (hasSearchValue(indexValue)) return indexValue;
  }
  return "";
}

function valueAtPath(source = {}, path = []) {
  return path.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), source);
}

function hasSearchValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function cleanString(value = "") {
  if (Array.isArray(value)) return value.map(cleanString).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return cleanString(value.id || value.ref || value.value || value.name || "");
  }
  return String(value ?? "").trim();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  return values
    .map(cleanString)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function titleCase(value = "") {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
