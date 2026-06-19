export const DATA_LIBRARY_SPECS = Object.freeze([
  library("profiles", "Profiles", "library", "profiles"),
  library("materials", "Materials", "library", "materials"),
  library("fasteners", "Fasteners", "library", "fasteners"),
  library("frames", "Frames", "library", "frames"),
  library("smartComponents", "Smart Components", "smart-component", "smartComponents")
]);

export const DATA_LIBRARY_DEFAULT_IDS = Object.freeze(DATA_LIBRARY_SPECS.map((spec) => spec.id));

const LIBRARY_BY_ID = new Map(DATA_LIBRARY_SPECS.map((spec) => [spec.id, spec]));
const LIBRARY_ORDER_BY_ID = new Map(DATA_LIBRARY_DEFAULT_IDS.map((id, index) => [id, index]));

export function dataLibrarySpec(libraryId) {
  return LIBRARY_BY_ID.get(libraryId) || null;
}

export function dataLibraryFallbackSpec(libraryId) {
  const spec = dataLibrarySpec(libraryId);
  if (spec) return spec;
  return Object.freeze({
    id: libraryId,
    label: titleCase(libraryId),
    icon: "library",
    entryKey: libraryId
  });
}

export function normalizeDataLibraryIds(ids = [], fallbackIds = DATA_LIBRARY_DEFAULT_IDS) {
  const normalized = [];
  const seen = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!LIBRARY_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized.length ? normalized : [...fallbackIds];
}

export function sortDataLibraryEntries(entries = []) {
  return [...entries].sort((a, b) => (
    dataLibraryOrder(a?.id) - dataLibraryOrder(b?.id)
    || String(a?.id || "").localeCompare(String(b?.id || ""))
  ));
}

export function dataSourceDescriptor(source = {}) {
  const label = cleanString(source.label);
  const path = cleanString(source.path);
  const displayPath = dataSourceDisplayPath(path);
  const kind = cleanString(source.kind || "JSON");
  const id = cleanString(source.id || label || path || "source");
  const keywords = uniqueStrings([id, label, kind, path, displayPath]);
  return Object.freeze({
    id,
    label,
    icon: cleanString(source.icon || "file"),
    kind,
    path,
    displayPath,
    description: [kind, displayPath].filter(Boolean).join(" - "),
    keywords,
    searchText: keywords.join(" ")
  });
}

export function dataLibraryDescriptor(libraryId, config = {}, loaded = {}) {
  const spec = dataLibraryFallbackSpec(libraryId);
  const count = finiteCount(loaded?.count);
  const unit = cleanString(loaded?.unit || "entries");
  const loadedName = cleanString(loaded?.name);
  const configuredLibraryId = cleanString(config?.libraryId);
  const libraryName = cleanString(loadedName || configuredLibraryId || "");
  const version = cleanString(config?.version);
  const path = cleanString(config?.path);
  const displayPath = dataSourceDisplayPath(path);
  const status = count !== null ? "loaded" : (config ? "declared" : "default");
  const meta = count !== null ? `${count} ${unit}` : (version || status);
  const keywords = uniqueStrings([
    spec.id,
    spec.label,
    spec.entryKey,
    libraryName,
    configuredLibraryId,
    version,
    path,
    displayPath,
    status,
    meta
  ]);
  return Object.freeze({
    id: spec.id,
    label: spec.label,
    icon: spec.icon,
    entryKey: spec.entryKey,
    value: libraryName || "-",
    meta,
    status,
    version,
    configuredLibraryId,
    path,
    displayPath,
    count,
    unit,
    keywords,
    description: [
      libraryName || `${spec.label} library`,
      configuredLibraryId && configuredLibraryId !== libraryName ? configuredLibraryId : "",
      meta,
      displayPath
    ].filter(Boolean).join(" - "),
    sourceLabel: `${spec.label} library`,
    sourceKind: "Library",
    searchText: keywords.join(" ")
  });
}

export function dataSourceDisplayPath(value = "") {
  const text = cleanString(value);
  if (!text) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return text;
  try {
    const url = new URL(text, "file:///viewer/");
    return decodeURIComponent(url.pathname).replace(/^\/+/, "") || text;
  } catch {
    return text;
  }
}

function library(id, label, icon, entryKey) {
  return Object.freeze({ id, label, icon, entryKey });
}

function dataLibraryOrder(id) {
  return LIBRARY_ORDER_BY_ID.get(id) ?? 1000;
}

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function cleanString(value = "") {
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
