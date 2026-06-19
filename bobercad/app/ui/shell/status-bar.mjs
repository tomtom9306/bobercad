import { applyTooltip, segmentedControl } from "../design-system/ui-elements.mjs?v=bottom-interaction-strip-1";
import { createIcon } from "../icons/icon-registry.mjs?v=bottom-interaction-strip-1";
import { BOTTOM_STRIP_DEFAULT_ITEM_IDS, BOTTOM_STRIP_ITEM_SPECS, normalizeBottomStripHiddenItemIds, normalizeBottomStripItemIds } from "../commands/bottom-strip-metadata.mjs?v=bottom-strip-metadata-1";
import { SNAP_SCOPE_MODES, normalizeSnapStrength, snapStrengthLabel } from "../commands/snap-metadata.mjs?v=snap-metadata-1";
import { createSnapSettingsControl } from "../controls/snap-settings-control.mjs?v=snap-settings-control-1";

export function mountStatusBar({
  root,
  prompt,
  app = null,
  snapStrength = "normal",
  snapScope = {},
  relations = null,
  bottomStrip = null,
  units = "mm",
  onSnapSettings = null,
  onSnapStrengthChange = null,
  onSnapScopeChange = null,
  onRelationsToggle = null
} = {}) {
  if (!root) return null;
  const projectSummary = root.querySelector("#hud");
  const promptNode = prompt || document.createElement("div");
  promptNode.id = promptNode.id || "modeling-status";
  promptNode.classList.add("bc-statusbar-prompt");
  promptNode.setAttribute("role", "status");
  promptNode.setAttribute("aria-live", "polite");
  if (!promptNode.textContent.trim()) promptNode.textContent = "Ready";

  const context = document.createElement("div");
  context.className = "bc-statusbar-context";
  const controls = bottomStripControls({ onSnapSettings, onSnapStrengthChange, onSnapScopeChange, onRelationsToggle });
  const selection = controls.selection;
  const scopeControl = controls.scope;
  const snap = controls.snap;
  const relation = controls.relations;
  const unit = controls.units;
  root.replaceChildren(promptNode, context, ...(projectSummary ? [projectSummary] : []));

  const state = {
    selectionCount: selectedCount(app),
    snapStrength: normalizeSnapStrength(snapStrength),
    snapScope: normalizeScope(snapScope),
    relations: normalizeRelationsState(relations),
    bottomStrip: normalizeBottomStrip(bottomStrip),
    units: normalizeUnits(units)
  };
  render();

  return {
    setPrompt(message = "Ready") {
      promptNode.textContent = message || "Ready";
    },
    update(patch = {}) {
      if (Number.isFinite(Number(patch.selectionCount))) state.selectionCount = Math.max(0, Math.floor(Number(patch.selectionCount)));
      if (patch.snapStrength !== undefined) state.snapStrength = normalizeSnapStrength(patch.snapStrength);
      if (patch.snapScope !== undefined) state.snapScope = normalizeScope(patch.snapScope);
      if (patch.relations !== undefined) state.relations = normalizeRelationsState(patch.relations);
      if (patch.bottomStrip !== undefined) state.bottomStrip = normalizeBottomStrip(patch.bottomStrip);
      if (patch.units !== undefined) state.units = normalizeUnits(patch.units);
      render();
    },
    setWorkspace(workspace = {}) {
      state.bottomStrip = normalizeBottomStrip(workspace);
      render();
    },
    toggleSnapSettings() {
      return snap?.toggleOpen?.() ?? null;
    },
    setSnapSettingsOpen(open = true) {
      return snap?.setOpen?.(open) ?? null;
    },
    refresh() {
      state.selectionCount = selectedCount(app);
      state.snapScope = normalizeScope(app?.selectionState?.().scope || state.snapScope);
      render();
    }
  };

  function render() {
    const hidden = new Set(state.bottomStrip.hiddenItemIds);
    context.replaceChildren(...state.bottomStrip.itemIds
      .filter((itemId) => !hidden.has(itemId) && controls[itemId]?.node)
      .map((itemId) => controls[itemId].node));
    selection?.update?.(state.selectionCount);
    scopeControl?.update?.(state.snapScope);
    snap?.update?.({ strength: state.snapStrength, scope: state.snapScope });
    relation?.update?.(state.relations);
    unit?.update?.(state.units);
  }
}

function bottomStripControls({ onSnapSettings, onSnapStrengthChange, onSnapScopeChange, onRelationsToggle } = {}) {
  const factories = {
    selection: (item) => statusSegment(item, {
      update: ({ node, value }, count) => {
        value.textContent = selectionLabel(count);
        node.setAttribute("aria-label", `Selection: ${value.textContent}`);
      }
    }),
    scope: (item) => statusScopeControl(item, { onSnapScopeChange }),
    snap: (item) => statusSnapControl(item, { onSnapSettings, onSnapStrengthChange, onSnapScopeChange }),
    relations: (item) => statusRelationsControl(item, { onRelationsToggle }),
    units: (item) => statusSegment(item, {
      update: ({ node, value }, units) => {
        value.textContent = units;
        node.setAttribute("aria-label", `Units: ${units}`);
      }
    })
  };
  return Object.fromEntries(BOTTOM_STRIP_ITEM_SPECS
    .map((item) => [item.id, factories[item.id]?.(item)])
    .filter(([, control]) => control?.node));
}

function statusSegment(item, options = {}) {
  const interactive = typeof options.onClick === "function";
  const node = document.createElement(interactive ? "button" : "div");
  node.className = "bc-statusbar-segment";
  node.dataset.bottomStripItem = item.id;
  node.dataset.statusSegment = item.id;
  if (interactive) {
    node.type = "button";
    node.dataset.statusbarControl = options.control || item.id;
    node.dataset.interactive = "true";
    applyTooltip(node, options.title || item.label);
    node.addEventListener("click", () => options.onClick?.());
  }
  const value = document.createElement("span");
  value.className = "bc-statusbar-segment-value";
  const labelNode = document.createElement("span");
  labelNode.className = "bc-statusbar-segment-label";
  labelNode.textContent = item.label;
  node.append(createIcon(item.icon), labelNode, value);
  return {
    node,
    value,
    update(nextValue) {
      options.update?.({ node, value }, nextValue);
    }
  };
}

function statusScopeControl(item, { onSnapScopeChange } = {}) {
  const node = segmentedControl({
    label: item.label,
    className: "bc-statusbar-scope",
    buttonClassName: "bc-statusbar-scope-button",
    items: SNAP_SCOPE_MODES.map((mode) => ({
      id: mode.id,
      label: mode.label,
      title: mode.title,
      onClick: () => onSnapScopeChange?.(mode.patch, { source: "scopeMode", mode: mode.id, label: mode.label })
    }))
  });
  node.dataset.bottomStripItem = "scope";
  node.prepend(createIcon(item.icon));

  const buttons = SNAP_SCOPE_MODES
    .map((mode) => {
      const button = node.querySelector(`[data-item-id="${mode.id}"]`);
      if (button) button.dataset.statusbarScopeMode = mode.id;
      return { mode, button };
    })
    .filter(({ button }) => button);

  return {
    node,
    update(scope = {}) {
      const modeId = scope.selectedObjectsOnly ? "selected" : scope.currentSmartComponentOnly ? "component" : "all";
      for (const { mode, button } of buttons) {
        const active = mode.id === modeId;
        const unavailable = mode.id === "selected"
          ? !Array.isArray(scope.selectedObjectIds) || scope.selectedObjectIds.length === 0
          : mode.id === "component" && !scope.activeSmartComponentId;
        button.disabled = unavailable;
        applyTooltip(button, unavailable
          ? mode.id === "selected"
            ? "Select an object before using selected-only scope"
            : "Select a Smart Component before using component scope"
          : mode.title);
        button.setAttribute("aria-pressed", active ? "true" : "false");
        button.dataset.state = active ? "active" : "idle";
      }
    }
  };
}

function statusSnapControl(item, { onSnapSettings, onSnapStrengthChange, onSnapScopeChange } = {}) {
  const node = document.createElement("details");
  node.className = "bc-statusbar-menu-control";
  node.dataset.bottomStripItem = item.id;
  node.dataset.statusbarControl = item.id;

  const summary = document.createElement("summary");
  summary.className = "bc-statusbar-segment bc-statusbar-menu-summary";
  summary.append(createIcon(item.icon), textSpan(item.label, "bc-statusbar-segment-label"), textSpan("", "bc-statusbar-segment-value"), createIcon("chevron-up"));
  applyTooltip(summary, item.description || "Snap settings");
  if (typeof onSnapSettings === "function") {
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      onSnapSettings();
    });
    summary.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onSnapSettings();
    });
  }
  node.append(summary);

  const settings = createSnapSettingsControl({
    bodyClassName: "bc-statusbar-popover",
    strengthFieldClassName: "bc-statusbar-field",
    strengthLabelClassName: "bc-statusbar-field-label",
    filtersClassName: "bc-statusbar-filter-details",
    filtersSummaryClassName: "bc-statusbar-filter-summary",
    filtersTitleClassName: "bc-statusbar-filter-title",
    filtersCountClassName: "bc-statusbar-filter-count",
    filterGridClassName: "bc-statusbar-filter-grid",
    checkboxClassName: "bc-statusbar-checkbox",
    onSnapStrengthChange,
    onSnapScopeChange,
    strengthMeta: { source: "statusbar" },
    targetMeta: ({ key, label, enabled }) => ({ source: "snapTarget", key, label, enabled })
  });
  node.append(settings.body);

  return {
    node,
    setOpen(open = true) {
      if (!node.isConnected) return null;
      node.open = Boolean(open);
      return node.open;
    },
    toggleOpen() {
      if (!node.isConnected) return null;
      node.open = !node.open;
      return node.open;
    },
    update({ strength: nextStrength = "normal", scope = {} } = {}) {
      const normalizedStrength = normalizeSnapStrength(nextStrength);
      settings.setStrength(normalizedStrength);
      const value = summary.querySelector(".bc-statusbar-segment-value");
      value.textContent = snapLabel(normalizedStrength);
      summary.setAttribute("aria-label", `Snap: ${normalizedStrength}`);
      node.dataset.state = normalizedStrength === "off" ? "muted" : "active";
      summary.dataset.state = node.dataset.state;
      settings.setScope(scope);
    }
  };
}

function statusRelationsControl(item, { onRelationsToggle } = {}) {
  return statusSegment(item, {
    control: "relations",
    title: item.description || item.label,
    onClick: () => onRelationsToggle?.(),
    update: ({ node, value }, state = {}) => {
      const normalized = normalizeRelationsState(state);
      const mode = normalized.available ? "Sketch" : "Auto";
      value.textContent = normalized.active ? `${mode} on` : `${mode} off`;
      node.dataset.state = normalized.active ? "active" : "muted";
      node.setAttribute("aria-pressed", normalized.active ? "true" : "false");
      node.setAttribute("aria-label", normalized.title || `Relations: ${value.textContent}`);
      applyTooltip(node, normalized.title || item.description || item.label);
    }
  });
}

function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function selectedCount(app) {
  const ids = app?.selectionState?.().selectedObjectIds;
  return Array.isArray(ids) ? ids.length : 0;
}

function selectionLabel(count) {
  if (count === 1) return "1 selected";
  return `${count} selected`;
}

function snapLabel(strength) {
  return snapStrengthLabel(strength);
}

function normalizeScope(scope = {}) {
  return { ...(scope || {}) };
}

function normalizeRelationsState(state = {}) {
  return {
    available: Boolean(state?.available),
    active: Boolean(state?.active),
    title: state?.title || ""
  };
}

function normalizeUnits(value) {
  return String(value || "mm").trim() || "mm";
}

function normalizeBottomStrip(workspace = {}) {
  const itemIds = normalizeBottomStripItemIds(workspace?.itemIds, BOTTOM_STRIP_DEFAULT_ITEM_IDS);
  return {
    itemIds,
    hiddenItemIds: normalizeBottomStripHiddenItemIds(workspace?.hiddenItemIds, itemIds)
  };
}
