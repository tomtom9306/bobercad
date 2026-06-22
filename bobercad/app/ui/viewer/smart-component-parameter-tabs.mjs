function baseSmartComponentTabs(definition = {}) {
  return Array.isArray(definition.ui?.tabs) && definition.ui.tabs.length
    ? definition.ui.tabs.map((tab) => ({ ...tab, items: Array.isArray(tab.items) ? tab.items : [] }))
    : [{ id: "parameters", label: "Parameters", items: Object.keys(definition.parameters || {}) }];
}

function normalizedText(value) {
  return String(value || "").trim().toLowerCase();
}

export function uiItemParameterPaths(item) {
  if (typeof item === "string") return [item];
  if (item?.kind === "parameter") return [item.path];
  if (item?.kind === "section") return (item.items || []).flatMap(uiItemParameterPaths);
  return [];
}

function connectionPropertyTabCandidate(tab = {}) {
  const id = normalizedText(tab.id);
  const label = normalizedText(tab.label);
  return ["properties", "parts", "design", "connections", "hardware", "parameters"].includes(id)
    || ["properties", "parts", "design", "splice", "hardware", "parameters"].includes(label);
}

function connectionDesignTab(tab = {}) {
  const id = normalizedText(tab.id);
  const label = normalizedText(tab.label);
  return id === "design" || label === "design";
}

function connectionFastenerParameter(path, definition = {}) {
  const spec = definition.parameters?.[path] || {};
  const text = normalizedText(`${path} ${spec.label || ""}`);
  return [
    "anchor",
    "bolt",
    "fastener",
    "grip",
    "hole",
    "nut",
    "washer"
  ].some((needle) => text.includes(needle));
}

function connectionFastenerUiItem(item, definition = {}) {
  if (typeof item === "string") return connectionFastenerParameter(item, definition);
  if (item?.kind === "parameter") return connectionFastenerParameter(item.path, definition);
  if (item?.kind === "section") {
    const sectionText = normalizedText(`${item.id || ""} ${item.label || ""}`);
    if (["anchor", "bolt", "fastener", "hole", "washer"].some((needle) => sectionText.includes(needle))) return true;
    const paths = uiItemParameterPaths(item);
    return paths.length > 0 && paths.every((path) => connectionFastenerParameter(path, definition));
  }
  return false;
}

function splitConnectionPropertyItems(items = [], definition = {}) {
  const primary = [];
  const fasteners = [];
  for (const item of items) {
    if (connectionFastenerUiItem(item, definition)) fasteners.push(item);
    else primary.push(item);
  }
  return { primary, fasteners };
}

function connectionFastenerTabLabel(items = [], definition = {}) {
  const text = items.flatMap(uiItemParameterPaths)
    .map((path) => `${path} ${definition.parameters?.[path]?.label || ""}`)
    .join(" ")
    .toLowerCase();
  return text.includes("anchor") ? "Anchors" : "Bolts";
}

export function smartComponentParameterTabs(definition = {}) {
  const sourceTabs = baseSmartComponentTabs(definition);
  if (definition.kind !== "connection") return sourceTabs;

  const propertyTabs = sourceTabs.filter(connectionPropertyTabCandidate);
  if (!propertyTabs.length) return sourceTabs;

  const properties = [];
  const fastenerFallbackItems = [];
  for (const tab of propertyTabs.filter((entry) => !connectionDesignTab(entry))) {
    const split = splitConnectionPropertyItems(tab.items, definition);
    properties.push(...split.primary);
    fastenerFallbackItems.push(...split.fasteners);
  }

  const designItems = propertyTabs
    .filter(connectionDesignTab)
    .flatMap((tab) => tab.items || []);
  if (designItems.length) {
    properties.push({
      kind: "section",
      id: "design-status",
      label: "Design status",
      items: designItems
    });
  }

  const detailTabs = sourceTabs.filter((tab) => !connectionPropertyTabCandidate(tab));
  if (fastenerFallbackItems.length && !detailTabs.some((tab) => ["bolts", "anchors"].includes(normalizedText(tab.id)))) {
    detailTabs.unshift({
      id: "bolts",
      label: connectionFastenerTabLabel(fastenerFallbackItems, definition),
      items: fastenerFallbackItems
    });
  }

  return [
    {
      id: "properties",
      label: "Properties",
      items: properties
    },
    ...detailTabs
  ];
}
