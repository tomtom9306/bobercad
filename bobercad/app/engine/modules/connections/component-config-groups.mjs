const CLEARANCE_OFFSET_KEYS = [
  ["xMinus", "along -"],
  ["xPlus", "along +"],
  ["yMinus", "side -"],
  ["yPlus", "side +"],
  ["zMinus", "below"],
  ["zPlus", "above"]
];

const CLEARANCE_DIMENSION_OFFSETS = {
  xMinus: { axis: "localAxisZ", value: 24, normal: 12, id: "along-minus" },
  xPlus: { axis: "localAxisZ", value: 34, normal: 12, id: "along-plus" },
  yMinus: { axis: "localAxisZ", value: 18, normal: 20, id: "side-minus" },
  yPlus: { axis: "localAxisZ", value: 28, normal: 20, id: "side-plus" },
  zMinus: { axis: "localAxisY", value: 24, normal: 16, id: "below" },
  zPlus: { axis: "localAxisY", value: 34, normal: 16, id: "above" }
};

function mergeRecord(scope, target = {}, source = {}) {
  const next = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    if (key in next && JSON.stringify(next[key]) !== JSON.stringify(value)) throw new Error(`${scope}: duplicate ${key}`);
    next[key] = value;
  }
  return next;
}

function clearanceCutOffsetParameters(group) {
  const prefix = group.path;
  if (!prefix) throw new Error("clearanceCutOffsets parameter group missing path");
  return Object.fromEntries(CLEARANCE_OFFSET_KEYS.map(([key, suffix]) => [
    `${prefix}.${key}`,
    {
      kind: "nonNegativeNumber",
      label: `${group.label || ""} ${suffix}`.trim(),
      unit: group.unit || "mm",
      required: false,
      default: group.default ?? 5
    }
  ]));
}

function clearanceCutOffsetDimensions(group) {
  const prefix = group.path;
  if (!prefix) throw new Error("clearanceCutOffsets dimension group missing path");
  const idPrefix = group.idPrefix || prefix.replaceAll(".", "-");
  const zSign = group.side === "bottom" ? -1 : 1;
  return Object.keys(CLEARANCE_DIMENSION_OFFSETS).map((key) => {
    const item = CLEARANCE_DIMENSION_OFFSETS[key];
    return {
      id: `${idPrefix}-${item.id}`,
      parameter: `${prefix}.${key}`,
      label: group.dimensionLabel || "notch",
      reference: {
        kind: "clearance-cut-offset",
        featureRole: group.featureRole,
        offsetKey: key,
        offset: {
          [item.axis]: item.axis === "localAxisZ" ? item.value * zSign : item.value,
          normal: item.normal
        }
      }
    };
  });
}

function clearanceCutOffsetUiSection(group) {
  const prefix = group.path;
  if (!prefix) throw new Error("clearanceCutOffsets UI group missing path");
  return {
    tab: group.tab || "parts",
    tabLabel: group.tabLabel || "Parts",
    section: {
      kind: "section",
      id: group.id || `${prefix.replaceAll(".", "-")}-section`,
      label: group.label || "Offsets",
      items: CLEARANCE_OFFSET_KEYS.map(([key]) => `${prefix}.${key}`)
    }
  };
}

function pushUiSection(ui, group) {
  const tabs = [...(ui?.tabs || [])].map((tab) => ({ ...tab, items: [...(tab.items || [])] }));
  const target = tabs.find((tab) => tab.id === group.tab);
  if (target) target.items.push(group.section);
  else tabs.push({ id: group.tab, label: group.tabLabel, items: [group.section] });
  return { ...(ui || {}), tabs };
}

export function expandComponentConfig(config) {
  let next = { ...config };
  for (const group of config.parameterGroups || []) {
    if (group.kind !== "clearanceCutOffsets") throw new Error(`${config.type}: unsupported parameter group ${group.kind}`);
    next.parameters = mergeRecord(`${config.type}.${group.path}.parameterGroups`, next.parameters, clearanceCutOffsetParameters(group));
  }
  for (const group of config.dimensionGroups || []) {
    if (group.kind !== "clearanceCutOffsets") throw new Error(`${config.type}: unsupported dimension group ${group.kind}`);
    next.dimensions = [...(next.dimensions || []), ...clearanceCutOffsetDimensions(group)];
  }
  for (const group of config.uiGroups || []) {
    if (group.kind !== "clearanceCutOffsets") throw new Error(`${config.type}: unsupported UI group ${group.kind}`);
    next.ui = pushUiSection(next.ui, clearanceCutOffsetUiSection(group));
  }
  return next;
}
