export const SMART_COMPONENT_PREVIEW_CONTEXTS = Object.freeze([
  context("beam-to-column-fin-plate", "sample_fin_plate_preview_seed.json", [
    ["preview_column", "preview_beam"]
  ]),
  context("connection-test-frame", "sample_connection_test_frame.json", [
    ["column_c1", "beam_b1_south"],
    ["column_c2", "beam_b2_east"]
  ]),
  context("beam-to-beam-fin-plate", "sample_beam_to_beam_fin_plate.json", [
    ["main_beam", "supported_beam"]
  ]),
  context("beam-to-beam-end-plate", "sample_beam_to_beam_end_plate.json", [
    ["main_beam", "supported_beam"]
  ]),
  context("warehouse-frame-connections", "sample_warehouse_12x24.json"),
  context("stair-hardware-basic", "sample_stair_straight_basic.json"),
  context("stair-member-splice", "sample_stair_manual_station_split.json")
]);

export function smartComponentPreviewContextsForPreset(preset = {}) {
  const contextIds = previewContextIds(preset.preview);
  if (contextIds.length) return orderContexts(contextIds);
  return SMART_COMPONENT_PREVIEW_CONTEXTS;
}

export function knownSmartComponentPreviewContextIds() {
  return SMART_COMPONENT_PREVIEW_CONTEXTS.map((context) => context.id);
}

function context(id, projectPath, memberPairs = []) {
  return Object.freeze({ id, projectPath, memberPairs });
}

function orderContexts(ids = []) {
  const wanted = new Set(ids);
  return [
    ...ids.map((id) => SMART_COMPONENT_PREVIEW_CONTEXTS.find((context) => context.id === id)).filter(Boolean),
    ...SMART_COMPONENT_PREVIEW_CONTEXTS.filter((context) => !wanted.has(context.id))
  ];
}

function previewContextIds(preview = {}) {
  if (!preview || typeof preview !== "object") return [];
  return Array.isArray(preview.contexts) ? preview.contexts.filter((id) => typeof id === "string" && id.trim()) : [];
}
