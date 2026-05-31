function button(label, title, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.title = title;
  node.addEventListener("click", onClick);
  return node;
}

export function mountModelingToolbar({ toolbar, status, onBeam, onColumn, onTrim, onCancel, autoRelationsEnabled = false, onAutoRelationsChange }) {
  const beam = button("B", "Create beam", onBeam);
  const column = button("C", "Create column", onColumn);
  const trim = button("T", "Create trim", onTrim);
  const cancel = button("Esc", "Cancel command", onCancel);
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
