export const BOTTOM_STRIP_ITEM_SPECS = Object.freeze([
  {
    id: "selection",
    label: "Selection",
    description: "Current object selection count.",
    icon: "selection"
  },
  {
    id: "scope",
    label: "Scope",
    description: "Selection and snap target scope.",
    icon: "selection"
  },
  {
    id: "snap",
    label: "Snap",
    description: "Snap strength and target filters.",
    icon: "snap"
  },
  {
    id: "relations",
    label: "Relations",
    description: "Automatic axis and sketch relation helpers.",
    icon: "relation"
  },
  {
    id: "units",
    label: "Units",
    description: "Active project length units.",
    icon: "units"
  }
]);

export const BOTTOM_STRIP_DEFAULT_ITEM_IDS = Object.freeze(BOTTOM_STRIP_ITEM_SPECS.map((item) => item.id));

export function bottomStripItemSpec(itemId) {
  return BOTTOM_STRIP_ITEM_SPECS.find((item) => item.id === itemId) || null;
}

export function normalizeBottomStripItemIds(values, fallback = BOTTOM_STRIP_DEFAULT_ITEM_IDS) {
  const known = new Set(BOTTOM_STRIP_DEFAULT_ITEM_IDS);
  const normalized = (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && known.has(value))
    .filter((value, index, all) => all.indexOf(value) === index);
  return normalized.length ? normalized : fallback.slice();
}

export function normalizeBottomStripHiddenItemIds(values, itemIds = BOTTOM_STRIP_DEFAULT_ITEM_IDS) {
  const visibleSet = new Set(itemIds);
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === "string" && visibleSet.has(value))
    .filter((value, index, all) => all.indexOf(value) === index);
}
