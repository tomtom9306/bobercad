import { shortcutLabel, shortcutSetting } from "../../../rendering/interaction/keyboard-shortcuts.mjs?v=axis-guide-shortcuts-1";

function button(label, title, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.title = title;
  node.addEventListener("click", onClick);
  return node;
}

export function mountModelingToolbar({ toolbar, status, shortcuts = {}, onBeam, onColumn, onTrim, onCancel, autoRelationsEnabled = false, onAutoRelationsChange }) {
  const commandShortcuts = shortcuts.commands || {};
  const beam = button(shortcutLabel(shortcutSetting(commandShortcuts, "createBeam", "B"), "Beam"), "Create beam", onBeam);
  const column = button(shortcutLabel(shortcutSetting(commandShortcuts, "createColumn", "C"), "Column"), "Create column", onColumn);
  const trim = button(shortcutLabel(shortcutSetting(commandShortcuts, "createTrim", "T"), "Trim"), "Create trim", onTrim);
  const cancel = button(shortcutLabel(shortcutSetting(commandShortcuts, "cancel", "Escape"), "Cancel"), "Cancel command", onCancel);
  const autoRelations = button("Rel", "Automatic axis relations", () => setAutoRelations(!autoRelations.classList.contains("active"), { notify: true }));
  toolbar.replaceChildren(beam, column, trim, autoRelations, cancel);

  function setActive(command) {
    for (const node of [beam, column, trim, cancel]) node.classList.remove("active");
    if (command === "beam") beam.classList.add("active");
    if (command === "column") column.classList.add("active");
    if (command === "trim") trim.classList.add("active");
  }

  function setAutoRelations(enabled, options = {}) {
    autoRelations.classList.toggle("active", Boolean(enabled));
    autoRelations.setAttribute("aria-pressed", enabled ? "true" : "false");
    if (options.notify) onAutoRelationsChange?.(Boolean(enabled));
  }

  function setStatus(text) {
    status.textContent = text || "Ready";
  }

  setStatus("Ready");
  setAutoRelations(autoRelationsEnabled);
  return { setActive, setAutoRelations, setStatus };
}
