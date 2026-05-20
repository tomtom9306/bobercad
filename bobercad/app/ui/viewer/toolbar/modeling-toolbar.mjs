function button(label, title, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.title = title;
  node.addEventListener("click", onClick);
  return node;
}

export function mountModelingToolbar({ toolbar, status, onBeam, onColumn, onCancel }) {
  const beam = button("B", "Create beam", onBeam);
  const column = button("C", "Create column", onColumn);
  const cancel = button("Esc", "Cancel command", onCancel);
  toolbar.replaceChildren(beam, column, cancel);

  function setActive(command) {
    for (const node of [beam, column, cancel]) node.classList.remove("active");
    if (command === "beam") beam.classList.add("active");
    if (command === "column") column.classList.add("active");
  }

  function setStatus(text) {
    status.textContent = text || "Ready";
  }

  setStatus("Ready");
  return { setActive, setStatus };
}
