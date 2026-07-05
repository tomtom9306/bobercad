import { actionFieldControl, actionListControl, actionRow, actionRowControl, axisTransformGridControl, button, checkboxInput, descriptorActions, diagnosticListControl, disclosureSection, messageControl, numberChoiceControl, numberListControl, numericControl, numericInput, objectRefControl, objectRefListControl, optionGridControl, previewImageControl, propertiesPanelShell, propertyButtonClass, readout, readoutListControl, segmentedFieldControl, selectInput, statusGroupTitleControl, statusListRowControl, statusRowControl, summaryCardControl, tabListControl, text, textInput, vectorControl } from "./panel-elements.mjs";
import { normalizeInspectorPropertySections } from "../../commands/inspector-property-metadata.mjs";

export function generatedPropertiesPanel({
  title = "Properties",
  context = null,
  sections = [],
  emptyMessage = "Select an object to inspect its properties."
} = {}) {
  const normalizedSections = normalizeInspectorPropertySections(sections)
    .filter((section) => section?.fields?.length);
  const children = propertySectionZones(normalizedSections);
  return propertiesPanelShell({
    title,
    context,
    emptyMessage,
    children
  });
}

function propertySectionZones(sections = []) {
  const zones = partitionPropertySections(sections);
  return PROPERTY_SECTION_ZONE_ORDER
    .map((placement) => propertySectionZone(placement, zones[placement]))
    .filter(Boolean);
}

function partitionPropertySections(sections = []) {
  const zones = Object.fromEntries(PROPERTY_SECTION_ZONE_ORDER.map((placement) => [placement, []]));
  for (const section of sections.slice().sort(comparePropertySections)) {
    const placement = PROPERTY_SECTION_ZONE_ORDER.includes(section.placement) ? section.placement : "main";
    zones[placement].push(section);
  }
  return zones;
}

function comparePropertySections(a = {}, b = {}) {
  const priority = finitePriority(a.priority) - finitePriority(b.priority);
  if (priority !== 0) return priority;
  return String(a.label || a.id || "").localeCompare(String(b.label || b.id || ""));
}

function finitePriority(value) {
  return Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER;
}

function propertySectionZone(placement, sections = []) {
  if (!sections?.length) return null;
  const zone = document.createElement("div");
  zone.className = "bc-properties-zone";
  zone.dataset.propertyZone = placement;
  zone.append(...sections.map((section) => renderPropertySection(section)));
  return zone;
}

function renderPropertySection(section) {
  const rows = (section.fields || []).map((field) => renderPropertyField(field)).filter(Boolean);
  const element = disclosureSection(section.label || "Properties", rows, {
    open: section.open !== false,
    className: "bc-disclosure-nested bc-property-section",
    sectionId: section.id
  });
  element.dataset.inspectorSectionLevel = section.level;
  element.dataset.inspectorSectionPlacement = section.placement;
  element.dataset.inspectorSectionPriority = String(section.priority);
  return element;
}

const PROPERTY_SECTION_ZONE_ORDER = ["main", "actions", "diagnostics", "reference"];

function renderPropertyField(field) {
  if (!field) return null;
  if (field.hidden) return null;
  return decoratePropertyField(field, renderPropertyFieldControl(field));
}

export function generatedPropertyField(field) {
  return renderPropertyField(field);
}

function renderPropertyFieldControl(field) {
  if (isReadOnlyField(field)) return readOnlyPropertyField(field);
  if (field.type === "number") return numericInput(field.label, field.value, field.onChange, field.options || {});
  if (field.type === "numberChoice") return numberChoiceField(field);
  if (field.type === "numberList") return numberListField(field);
  if (field.type === "vector3") return vectorField(field, ["X", "Y", "Z"]);
  if (field.type === "vector2") return vectorField(field, ["X", "Y"]);
  if (field.type === "axisTransformGrid") return axisTransformGridField(field);
  if (field.type === "select") return selectInput(field.label, field.options || [], field.value, field.onChange);
  if (field.type === "segmented") return segmentedField(field);
  if (field.type === "optionGrid") return optionGridField(field);
  if (field.type === "checkbox") return checkboxInput(field.label, field.value, field.onChange);
  if (field.type === "text") return textInput(field.label, field.value, field.onChange, field.options || {});
  if (field.type === "tabList") return tabListField(field);
  if (field.type === "readoutList") return readoutListField(field);
  if (field.type === "actionList") return actionListField(field);
  if (field.type === "actionRow") return actionRowField(field);
  if (field.type === "action") return actionField(field);
  if (field.type === "objectRef") return objectRefField(field);
  if (field.type === "memberSelectionBox") return memberSelectionBoxField(field);
  if (field.type === "objectRefList") return objectRefListField(field);
  if (field.type === "statusGroupTitle") return statusGroupTitleControl(field);
  if (field.type === "statusRow") return statusRowControl(field);
  if (field.type === "summaryCard") return summaryCardField(field);
  if (field.type === "statusListCard") return statusListCardField(field);
  if (field.type === "nestedFieldCard") return nestedFieldCardField(field);
  if (field.type === "diagnosticList") return diagnosticListField(field);
  if (field.type === "message") return messageControl(field);
  if (field.type === "previewImage") return previewImageControl(field);
  return readout(field.label, formatPropertyValue(field.value));
}

function decoratePropertyField(field, row) {
  if (!row) return null;
  if (field.className) row.classList.add(...classTokens(field.className));
  if (field.parameterPath) row.dataset.parameterPath = field.parameterPath;
  if (field.path) row.dataset.path = field.path;
  if (field.focused) row.classList.add("focused");
  if (field.disabled) {
    row.classList.add("disabled");
    row.dataset.disabled = "true";
  }
  if (field.readOnly) {
    row.classList.add("read-only");
    row.dataset.readOnly = "true";
  }
  const validation = validationState(field);
  if (validation.state) {
    row.dataset.validationState = validation.state;
    row.classList.toggle("invalid", validation.state === "error");
  }
  applyControlState(field, row, validation);
  appendFieldNotes(field, row, validation);
  return row;
}

function classTokens(className) {
  return String(className || "").split(/\s+/).filter(Boolean);
}

function numberChoiceField(field) {
  if (typeof field.onChange !== "function") return readout(field.label, formatPropertyValue(field.value));
  return numberChoiceControl(field);
}

function segmentedField(field) {
  if (typeof field.onChange !== "function") return readout(field.label, formatPropertyValue(field.value));
  return segmentedFieldControl(field);
}

function optionGridField(field) {
  if (typeof field.onChange !== "function") return readout(field.label, formatPropertyValue(field.value));
  return optionGridControl(field);
}

function tabListField(field) {
  if (typeof field.onChange !== "function") return readout(field.label, formatPropertyValue(field.value));
  return tabListControl(field);
}

function numberListField(field) {
  if (typeof field.onChange !== "function") return readout(field.label, formatPropertyValue(field.value));
  return numberListControl(field);
}

function vectorField(field, axisLabels) {
  return vectorControl({ ...field, fallbackValue: formatPropertyValue(field.value) }, axisLabels);
}

function axisTransformGridField(field) {
  return axisTransformGridControl(field);
}

function objectRefField(field) {
  return objectRefControl(field);
}

function memberSelectionBoxField(field) {
  const root = document.createElement("div");
  root.className = "bc-selection-box";
  if (field.selectionGroup) root.dataset.selectionGroup = field.selectionGroup;
  const label = field.label || "Selections";
  if (label) root.append(text("div", "bc-selection-box-label", label));
  const frame = document.createElement("div");
  frame.className = "bc-selection-box-frame";
  frame.append(text("div", "bc-selection-box-rail", ""));
  const list = document.createElement("div");
  list.className = "bc-selection-box-list";
  const items = Array.isArray(field.items) ? field.items : [];
  if (!items.length) {
    list.append(text("div", "bc-selection-box-empty", field.emptyLabel || "No members selected."));
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "bc-selection-box-item";
    const copy = document.createElement("div");
    copy.className = "bc-selection-box-copy";
    copy.append(text("div", "bc-selection-box-role", item.role || item.label || "Member"));
    copy.append(text("div", "bc-selection-box-title", formatPropertyValue(item.value)));
    if (item.status) copy.append(text("div", "bc-selection-box-id", item.status));
    row.append(copy);
    const controls = actionRow(descriptorActions(item), {
      className: "bc-selection-box-row-actions",
      buttonClassName: propertyButtonClass
    });
    if (controls) row.append(controls);
    list.append(row);
  }
  frame.append(list);
  root.append(frame);
  const controls = actionRow(descriptorActions(field), {
    className: "bc-selection-box-actions",
    buttonClassName: propertyButtonClass
  });
  if (controls) root.append(controls);
  return root;
}

function objectRefListField(field) {
  return objectRefListControl(field);
}

function readoutListField(field) {
  return readoutListControl(field, { formatValue: formatPropertyValue });
}

function actionField(field) {
  return actionFieldControl(field);
}

function actionRowField(field) {
  return actionRowControl(field);
}

function actionListField(field) {
  return actionListControl(field);
}

function summaryCardField(field) {
  const card = summaryCardControl(field, { includeOkStatus: false });
  for (const item of Array.isArray(field.readouts) ? field.readouts : []) {
    if (item?.label) card.append(readout(item.label, formatPropertyValue(item.value)));
  }
  if (field.diagnostic) {
    card.append(messageControl({
      state: field.status === "conflicted" ? "error" : "warning",
      value: field.diagnostic
    }));
  }
  if (field.value !== undefined && typeof field.onChange === "function") {
    const row = document.createElement("label");
    row.className = "bc-field";
    const input = numericControl(field.valueLabel || field.label || "Value", field.value, field.onChange, field.options || {});
    input.className = "bc-status-value-input";
    if (field.valueTitle || field.title) input.title = field.valueTitle || field.title;
    row.append(text("span", "bc-label", field.valueFieldLabel || "Value"), input);
    card.append(row);
  }
  for (const group of Array.isArray(field.actionGroups) ? field.actionGroups : []) {
    const actions = descriptorActions({ actions: group.actions });
    if (!actions.length) continue;
    if (group.label) card.append(readout(group.label, formatPropertyValue(group.value ?? actions.length)));
    const row = actionRow(actions, { className: "bc-action-row", buttonClassName: propertyButtonClass });
    if (row) card.append(row);
  }
  return card;
}

function statusListCardField(field) {
  const card = summaryCardControl(field, { defaultStatus: "redundant", titleFallback: "Status list" });
  appendActionRow(card, descriptorActions(field));
  for (const group of Array.isArray(field.groups) ? field.groups : []) {
    const rows = Array.isArray(group.rows) ? group.rows : [];
    if (group.label) card.append(readout(group.label, formatPropertyValue(group.value ?? rows.length)));
    for (const row of rows) {
      card.append(statusListRowControl(row));
    }
    if (group.moreText) card.append(text("div", "bc-empty", group.moreText));
  }
  if (field.diagnostic) card.append(text("div", "bc-status-diagnostic", field.diagnostic));
  return card;
}

function nestedFieldCardField(field) {
  const card = summaryCardControl(field, { titleFallback: "Details" });
  for (const item of Array.isArray(field.readouts) ? field.readouts : []) {
    if (item?.label) card.append(readout(item.label, formatPropertyValue(item.value)));
  }
  for (const message of Array.isArray(field.messages) ? field.messages : []) {
    if (message?.value) card.append(text("div", message.className || "bc-status-diagnostic", message.value));
  }
  for (const child of Array.isArray(field.fields) ? field.fields : []) {
    const row = renderPropertyField(child);
    if (row) card.append(row);
  }
  return card;
}

function diagnosticListField(field) {
  return diagnosticListControl(field);
}

function appendActionRow(parent, actions = []) {
  const row = actionRow(actions, { className: "bc-action-row", buttonClassName: propertyButtonClass });
  if (row) parent.append(row);
}

function isReadOnlyField(field = {}) {
  if (field.readOnly === true) return true;
  if (["number", "numberChoice", "numberList", "vector3", "vector2", "select", "checkbox", "text"].includes(field.type)) {
    return typeof field.onChange !== "function" && field.disabled !== true;
  }
  return false;
}

function readOnlyPropertyField(field = {}) {
  const value = field.readOnlyValue !== undefined ? field.readOnlyValue : field.value;
  return readout(field.label || "Value", formatPropertyValue(value));
}

function fieldControls(row) {
  const selector = "input, select, textarea, button";
  const controls = [];
  if (row?.matches?.(selector)) controls.push(row);
  controls.push(...(row?.querySelectorAll?.(selector) || []));
  return controls;
}

function setFieldInvalidState(control, invalid) {
  control.classList.toggle("invalid", invalid);
  control.toggleAttribute("aria-invalid", invalid);
}

function applyControlState(field = {}, row, validation = {}) {
  for (const control of fieldControls(row)) {
    if (field.disabled) {
      control.disabled = true;
      control.setAttribute("aria-disabled", "true");
      if (field.disabledReason && !control.title) control.title = field.disabledReason;
    }
    if (field.readOnly && "readOnly" in control) {
      control.readOnly = true;
      control.setAttribute("aria-readonly", "true");
    }
    if (validation.state === "error") {
      setFieldInvalidState(control, true);
    }
  }
}

function appendFieldNotes(field = {}, row, validation = {}) {
  const notes = [
    field.disabled && field.disabledReason ? { state: "disabled", value: field.disabledReason } : null,
    field.help ? { state: "help", value: field.help } : null,
    validation.message ? { state: validation.state || "help", value: validation.message } : null
  ].filter((note) => note?.value);
  if (!notes.length) return;
  const describedBy = [];
  for (const [index, note] of notes.entries()) {
    const item = document.createElement("div");
    item.className = note.state === "help" || note.state === "disabled"
      ? "bc-field-help"
      : "bc-field-validation";
    item.dataset.state = note.state;
    item.textContent = note.value;
    item.id = fieldNoteId(field, index);
    describedBy.push(item.id);
    row.append(item);
  }
  if (describedBy.length) {
    for (const control of fieldControls(row)) {
      control.setAttribute("aria-describedby", describedBy.join(" "));
    }
  }
}

function fieldNoteId(field = {}, index = 0) {
  const source = field.path || field.parameterPath || field.label || "field";
  return `generated-property-note-${String(source).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "field"}-${index}`;
}

function validationState(field = {}) {
  const validation = field.validation && typeof field.validation === "object" && !Array.isArray(field.validation)
    ? field.validation
    : {};
  if (field.error) return { state: "error", message: field.error };
  if (field.warning) return { state: "warning", message: field.warning };
  if (field.valid === false) return { state: "error", message: field.validationMessage || validation.message || "Invalid value." };
  return {
    state: validation.state || "",
    message: validation.message || ""
  };
}

function formatPropertyValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map((item) => formatPropertyValue(item)).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
