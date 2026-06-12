import { matchesShortcut, shortcutSetting } from "../../../rendering/interaction/keyboard-shortcuts.mjs?v=truthy-values-dry-1";
import { formatNumber } from "../../../engine/core/format.mjs?v=format-number-dry-1";
import { arrayValues } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";
import { button, hidePanel, parseNumericControlValue, text as element } from "./panel-elements.mjs?v=panel-controls-dry-1";

const AXES = [
  { id: "x", label: "X", index: 0 },
  { id: "y", label: "Y", index: 1 },
  { id: "z", label: "Z", index: 2 }
];
const POSITION_FORMAT = { digits: 3, trimTrailingZeros: true };

function formatDelta(value) {
  const text = formatNumber(value, POSITION_FORMAT);
  if (!text || value < 0) return text;
  return `+${text}`;
}

function pointText(point) {
  if (!Array.isArray(point)) return "";
  return AXES.map((axis) => `${axis.label} ${formatNumber(point[axis.index], POSITION_FORMAT)}`).join("  ");
}

function input(className, value, label, shortcuts, onApply, onConfirm, onCancel) {
  const node = document.createElement("input");
  node.type = "text";
  node.inputMode = "decimal";
  node.className = className;
  node.value = value;
  node.setAttribute("aria-label", label);

  const apply = () => {
    const parsed = parseNumericControlValue(node);
    if (parsed === null) return false;
    return onApply(parsed) !== false;
  };

  node.addEventListener("change", apply);
  node.addEventListener("keydown", (event) => {
    if (matchesShortcut(event, shortcutSetting(shortcuts, "confirmTransform", "Enter"))) {
      event.preventDefault();
      event.stopPropagation();
      if (apply()) onConfirm();
    } else if (matchesShortcut(event, shortcutSetting(shortcuts, "cancelTransform", "Escape"))) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  });
  return node;
}

function pointRow(point) {
  const row = element("div", "member-transform-point");
  row.append(
    element("span", "member-transform-point-label", point.label),
    element("span", "member-transform-point-before", pointText(point.before)),
    element("span", "member-transform-point-arrow", "->"),
    element("span", "member-transform-point-after", pointText(point.after))
  );
  return row;
}

export function mountMemberTransformPanel({
  panel,
  onDeltaChange,
  onResultChange,
  onNudge,
  onIncrementChange,
  onConfirm,
  onCancel,
  shortcuts = {}
}) {
  let state = null;

  function render() {
    if (!state) {
      hidePanel(panel);
      return;
    }

    const title = element("div", "member-transform-title", state.title || "Move member");
    const object = element("div", "member-transform-object", state.memberId || "");
    const space = element("div", "member-transform-space", state.coordinateSpace === "local" ? "Local axes" : "Global axes");
    const header = element("header", "member-transform-header");
    header.append(title, object, space);

    const target = element("div", "member-transform-target");
    target.append(
      element("span", "member-transform-target-label", state.targetLabel || "Reference point"),
      element("span", "member-transform-target-value", pointText(state.currentPoint))
    );

    const grid = element("div", "member-transform-grid");
    grid.append(
      element("span", "member-transform-grid-heading", "Axis"),
      element("span", "member-transform-grid-heading", "Before"),
      element("span", "member-transform-grid-heading", state.coordinateSpace === "local" ? "Local Move" : "Move"),
      element("span", "member-transform-grid-heading", "After"),
      element("span", "member-transform-grid-heading", "")
    );

    for (const axis of AXES) {
      const before = state.basePoint?.[axis.index] ?? 0;
      const delta = state.delta?.[axis.index] ?? 0;
      const after = state.currentPoint?.[axis.index] ?? before + delta;
      const deltaInput = input(
        "member-transform-input",
        formatDelta(delta),
        `${axis.label} move`,
        shortcuts,
        (value) => onDeltaChange(axis.id, value),
        onConfirm,
        onCancel
      );
      const resultInput = input(
        "member-transform-input",
        formatNumber(after, POSITION_FORMAT),
        `${axis.label} coordinate`,
        shortcuts,
        (value) => onResultChange(axis.id, value),
        onConfirm,
        onCancel
      );
      const nudge = element("span", "member-transform-nudge");
      nudge.append(
        button("-", "member-transform-step", () => onNudge(axis.id, -1), { title: `${axis.label} minus step` }),
        button("+", "member-transform-step", () => onNudge(axis.id, 1), { title: `${axis.label} plus step` })
      );

      grid.append(
        element("span", "member-transform-axis", axis.label),
        element("span", "member-transform-before", formatNumber(before, POSITION_FORMAT)),
        deltaInput,
        resultInput,
        nudge
      );
    }

    const stepRow = element("label", "member-transform-step-row");
    stepRow.append(
      element("span", "member-transform-step-label", "Step"),
      input(
        "member-transform-step-input",
        formatNumber(state.increment, POSITION_FORMAT),
        "Move step",
        shortcuts,
        (value) => onIncrementChange(value),
        onConfirm,
        onCancel
      )
    );

    const points = element("div", "member-transform-points");
    for (const point of arrayValues(state.affectedPoints)) points.append(pointRow(point));

    const hint = state.committed
      ? "Applied. Enter or check closes. Esc or x undoes."
      : "Release applies. Esc or x cancels.";
    const message = element("div", "member-transform-message", state.error || hint);
    message.dataset.state = state.error ? "error" : "hint";

    const actions = element("footer", "member-transform-actions");
    actions.append(
      button("✓", "member-transform-action confirm", onConfirm, { title: "Close move panel" }),
      button("x", "member-transform-action cancel", onCancel, { title: state.committed ? "Undo move" : "Cancel move" })
    );

    panel.hidden = false;
    panel.replaceChildren(header, target, grid, stepRow, points, message, actions);
  }

  render();
  return {
    update(nextState) {
      state = nextState;
      render();
    }
  };
}
