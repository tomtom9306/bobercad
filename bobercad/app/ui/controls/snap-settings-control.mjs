import { SNAP_STRENGTH_SPECS, SNAP_TARGET_SPECS, normalizeSnapStrength } from "../commands/snap-metadata.mjs?v=snap-metadata-1";
import { createIcon } from "../icons/icon-registry.mjs?v=snap-settings-control-1";

export function createSnapSettingsControl({
  snapSettings = {},
  snapScope = {},
  bodyClassName = "",
  strengthFieldClassName = "bc-field",
  strengthLabelClassName = "bc-field-label",
  strengthSelectClassName = "bc-select",
  filtersClassName = "",
  filtersSummaryClassName = "",
  filtersChevronClassName = "",
  filtersTitleClassName = "",
  filtersCountClassName = "",
  filterGridClassName = "",
  checkboxClassName = "",
  onSnapStrengthChange,
  onSnapScopeChange,
  strengthMeta,
  targetMeta
} = {}) {
  const body = document.createElement("div");
  body.className = bodyClassName;

  const strength = document.createElement("select");
  strength.className = strengthSelectClassName;
  strength.title = "Snap strength";
  strength.setAttribute("aria-label", "Snap strength");
  for (const { id: value, label } of SNAP_STRENGTH_SPECS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    strength.append(option);
  }
  strength.value = normalizeSnapStrength(snapSettings.strength);
  strength.addEventListener("change", () => {
    const meta = resolveSnapMeta(strengthMeta, { value: strength.value });
    if (meta === undefined) onSnapStrengthChange?.(strength.value);
    else onSnapStrengthChange?.(strength.value, meta);
  });
  body.append(snapField("Strength", strength, strengthFieldClassName, strengthLabelClassName));

  const filters = document.createElement("details");
  filters.className = filtersClassName;
  const filtersSummary = document.createElement("summary");
  filtersSummary.className = filtersSummaryClassName;
  const filterCount = textSpan("", filtersCountClassName);
  filtersSummary.append(
    createIcon("chevron-right", { className: filtersChevronClassName }),
    textSpan("Targets", filtersTitleClassName),
    filterCount
  );
  filters.append(filtersSummary);

  const filterGrid = document.createElement("div");
  filterGrid.className = filterGridClassName;
  const filterInputs = new Map();
  for (const { key, label } of SNAP_TARGET_SPECS) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.snapTarget = key;
    input.checked = snapScope[key] !== false;
    input.addEventListener("change", () => {
      syncFilterCount();
      const meta = resolveSnapMeta(targetMeta, { key, label, input, enabled: input.checked });
      const patch = { [key]: input.checked };
      if (meta === undefined) onSnapScopeChange?.(patch);
      else onSnapScopeChange?.(patch, meta);
    });
    filterInputs.set(key, input);
    filterGrid.append(snapCheckboxLabel(label, input, checkboxClassName));
  }
  filters.append(filterGrid);
  body.append(filters);

  function setStrength(value) {
    const normalized = normalizeSnapStrength(value);
    if ([...strength.options].some((option) => option.value === normalized)) strength.value = normalized;
  }

  function setScope(scope = {}) {
    for (const [key, input] of filterInputs) input.checked = scope[key] !== false;
    syncFilterCount();
  }

  function syncFilterCount() {
    const enabled = [...filterInputs.values()].filter((input) => input.checked).length;
    filterCount.textContent = `${enabled}/${filterInputs.size}`;
    filterCount.title = `${enabled} snap targets enabled`;
  }

  syncFilterCount();
  return { body, strength, filters, filterInputs, setStrength, setScope, syncFilterCount };
}

function snapField(labelText, control, className, labelClassName) {
  const label = document.createElement("label");
  label.className = className;
  label.append(textSpan(labelText, labelClassName), control);
  return label;
}

function snapCheckboxLabel(text, control, className) {
  const label = document.createElement("label");
  label.className = className;
  label.append(control, document.createTextNode(text));
  return label;
}

function textSpan(value, className = "") {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = value;
  return node;
}

function resolveSnapMeta(meta, context) {
  if (typeof meta === "function") return meta(context);
  return meta;
}
