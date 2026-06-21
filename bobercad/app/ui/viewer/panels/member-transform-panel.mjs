import { disclosureSection, hidePanel, text as element } from "./panel-elements.mjs";
import { bindGeneratedPropertyField } from "./generated-property-bindings.mjs";
import { generatedPropertyField } from "./generated-properties-panel.mjs";

const AXES = [
  { id: "x", label: "X", index: 0 },
  { id: "y", label: "Y", index: 1 },
  { id: "z", label: "Z", index: 2 }
];
const POSITION_FORMAT = { digits: 3, trimTrailingZeros: true };

function finiteInteger(value) {
  return Number.isFinite(value) && Number.isInteger(value);
}

function formatNumber(value, options = {}) {
  if (!Number.isFinite(value)) return options.invalid ?? "";
  const digits = finiteInteger(options.digits) && options.digits >= 0 ? options.digits : 2;
  const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
  if (finiteInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(digits);
  return options.trimTrailingZeros
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;
}

function arrayValues(values) {
  return Array.isArray(values) ? values : [];
}

function formatDelta(value) {
  const text = formatNumber(value, POSITION_FORMAT);
  if (!text || value < 0) return text;
  return `+${text}`;
}

function pointText(point) {
  if (!Array.isArray(point)) return "";
  return AXES.map((axis) => `${axis.label} ${formatNumber(point[axis.index], POSITION_FORMAT)}`).join("  ");
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
  const generatedTransformBindings = () => ({
    actions: {
      "transform.confirm": () => onConfirm(),
      "transform.cancel": () => onCancel(),
      "transform.nudge": (field = {}) => {
        const axisId = field.payload?.axisId;
        const direction = field.payload?.direction;
        if (axisId && Number.isFinite(direction)) onNudge(axisId, direction);
      }
    },
    commits: {
      "transform.delta.set": (value, commit = {}) => {
        if (commit.axisId) onDeltaChange(commit.axisId, value);
      },
      "transform.result.set": (value, commit = {}) => {
        if (commit.axisId) onResultChange(commit.axisId, value);
      },
      "transform.increment.set": (value) => onIncrementChange(value)
    }
  });

  const transformField = (field) => generatedPropertyField(bindGeneratedPropertyField(field, generatedTransformBindings()));

  const affectedPointField = (point) => transformField({
    label: point.label,
    value: `${pointText(point.before)} -> ${pointText(point.after)}`,
    className: "member-transform-affected-row"
  });

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

    const target = transformField({
      label: state.targetLabel || "Reference point",
      value: pointText(state.currentPoint),
      className: "member-transform-reference-row"
    });

    const transformGrid = transformField({
      type: "axisTransformGrid",
      label: "Move",
      className: "member-transform-axis-grid",
      columns: {
        delta: state.coordinateSpace === "local" ? "Local Move" : "Move"
      },
      shortcuts,
      confirmAction: { action: "transform.confirm" },
      cancelAction: { action: "transform.cancel" },
      rows: AXES.map((axis) => {
        const before = state.basePoint?.[axis.index] ?? 0;
        const delta = state.delta?.[axis.index] ?? 0;
        const after = state.currentPoint?.[axis.index] ?? before + delta;
        return {
          axisId: axis.id,
          label: axis.label,
          before: formatNumber(before, POSITION_FORMAT),
          delta: {
            label: `${axis.label} move`,
            value: formatDelta(delta),
            commit: { action: "transform.delta.set", axisId: axis.id }
          },
          result: {
            label: `${axis.label} coordinate`,
            value: formatNumber(after, POSITION_FORMAT),
            commit: { action: "transform.result.set", axisId: axis.id }
          },
          actions: [
            { label: "Decrease", icon: "minus", title: `${axis.label} minus step`, action: "transform.nudge", payload: { axisId: axis.id, direction: -1 } },
            { label: "Increase", icon: "add", title: `${axis.label} plus step`, action: "transform.nudge", payload: { axisId: axis.id, direction: 1 } }
          ]
        };
      }),
      increment: {
        label: "Step",
        value: formatNumber(state.increment, POSITION_FORMAT),
        commit: { action: "transform.increment.set" }
      }
    });

    const affectedPoints = arrayValues(state.affectedPoints);
    const points = element("div", "member-transform-affected-list");
    for (const point of affectedPoints) points.append(affectedPointField(point));
    if (!affectedPoints.length) points.append(element("div", "bc-empty", "No dependent points."));

    const hint = state.committed
      ? "Applied. Enter or check closes. Esc or x undoes."
      : "Release applies. Esc or x cancels.";
    const message = element("div", "member-transform-message", state.error || hint);
    message.dataset.state = state.error ? "error" : "hint";

    const actions = transformField({
      type: "actionRow",
      label: "Move actions",
      className: "member-transform-command-row",
      actions: [
        { label: "OK", action: "transform.confirm", icon: "check", primary: true, title: "Close move panel" },
        { label: "Cancel", action: "transform.cancel", icon: "cancel", danger: true, title: state.committed ? "Undo move" : "Cancel move" }
      ]
    });

    panel.classList.add("bc-inspector");
    panel.hidden = false;
    panel.replaceChildren(
      header,
      disclosureSection("Reference", [target], { open: true, className: "member-transform-disclosure", sectionId: "transform.reference" }),
      transformGrid,
      disclosureSection(`Affected points (${affectedPoints.length})`, [points], { className: "member-transform-disclosure", sectionId: "transform.affectedPoints" }),
      message,
      actions
    );
  }

  render();
  return {
    update(nextState) {
      state = nextState;
      render();
    }
  };
}
