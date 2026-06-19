export const COMMAND_PALETTE_SHORTCUT = "Ctrl+K";

export const COMMAND_PALETTE_SPEC = Object.freeze({
  title: "Search",
  placeholder: "Search commands, model, and data",
  triggerLabel: "Search",
  triggerTitle: `Search commands, model, and data (${COMMAND_PALETTE_SHORTCUT})`,
  triggerAriaLabel: "Search commands, model, and data",
  closeLabel: "Close command palette",
  resultsLabel: "Command and data results",
  emptyMessage: "No matching commands or data.",
  activeLabel: "Active",
  recentGroupLabel: "Recent",
  unavailableMessage: "Command unavailable."
});

export const COMMAND_PALETTE_RESULT_KIND_LABELS = Object.freeze({
  "source-file": "File",
  "project-data-row": "Data row",
  "model-collection": "Collection",
  "model-object": "Object",
  "smart-component-preset": "Preset"
});

export function commandPaletteResultKindLabel(kind) {
  return COMMAND_PALETTE_RESULT_KIND_LABELS[kind] || "";
}
