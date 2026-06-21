import {
  dataPanelEmpty,
  dataPanelHeader,
  dataPanelRow,
  dataPanelSearch,
  dataPanelSection
} from "../design-system/ui-elements.mjs";
import { MODEL_COLLECTION_SPECS } from "../commands/model-collection-metadata.mjs";

const PROJECT_PROPERTIES_PANEL_SPEC = Object.freeze({
  title: "Project",
  icon: "file",
  searchPlaceholder: "Search project",
  searchLabel: "Search project properties",
  emptySearchMessage: "No matching project properties.",
  emptySectionMessage: "No project properties available."
});

const PROJECT_IDENTITY_FIELDS = Object.freeze([
  propertyField("Project name", ["name"], ["name"], { required: true }),
  propertyField("Project ID", ["id"], ["id"], { required: true }),
  propertyField("Project No.", ["projectNumber", "projectNo", "projectNumberCode", "number"], ["bim", "propertySets", "Identity", "projectNumber"]),
  propertyField("Revision", ["revision", "revisionCode", "rev"], ["bim", "propertySets", "Project", "revision"]),
  propertyField("Customer", ["customer", "client", "owner"], ["bim", "propertySets", "Project", "customer"]),
  propertyField("Draughtsman", ["draughtsman", "draftsman", "drawnBy", "detailer"], ["bim", "propertySets", "Drawing", "draughtsman"]),
  propertyField("Checked by", ["checkedBy", "checker", "checked"], ["bim", "propertySets", "Drawing", "checkedBy"]),
  propertyField("Status", ["status"], ["bim", "propertySets", "Identity", "status"])
]);

const PROJECT_DESCRIPTION_FIELDS = Object.freeze([
  propertyField("Description", ["description"], ["description"], { multiline: true }),
  propertyField("Created with", ["createdWith"], ["createdWith"]),
  propertyField("BIM name", ["name"], ["bim", "name"])
]);

export function mountProjectPropertiesPanel({
  root,
  app = null
} = {}) {
  if (!root) return null;
  const state = {
    query: "",
    project: app?.project?.() || null
  };
  const unsubscribe = app?.subscribe?.((project) => {
    state.project = project || app?.project?.() || null;
    render();
  }) || (() => {});

  root.classList.add("bc-project-properties-panel", "bc-data-panel");
  render();

  return {
    refresh() {
      state.project = app?.project?.() || state.project;
      render();
    },
    destroy() {
      unsubscribe();
    }
  };

  function render(options = {}) {
    const project = state.project || {};
    const sections = filterSections(projectSections(project, app), state.query);
    const empty = sections.length ? null : emptyState(PROJECT_PROPERTIES_PANEL_SPEC.emptySearchMessage);
    root.replaceChildren(
      header(project),
      renderSearch(),
      ...sections.map((item) => section(item.label, item.children)),
      ...[empty].filter(Boolean)
    );
    if (options.focusSearch) {
      const input = root.querySelector("[data-project-properties-search]");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    }
  }

  function renderSearch() {
    return dataPanelSearch({
      namespace: "bc-project-properties",
      value: state.query,
      placeholder: PROJECT_PROPERTIES_PANEL_SPEC.searchPlaceholder,
      label: PROJECT_PROPERTIES_PANEL_SPEC.searchLabel,
      datasetKey: "projectPropertiesSearch",
      onInput: (value) => {
        state.query = value;
        render({ focusSearch: true });
      }
    });
  }
}

function header(project) {
  const info = project?.project || {};
  return dataPanelHeader({
    namespace: "bc-project-properties",
    icon: PROJECT_PROPERTIES_PANEL_SPEC.icon,
    title: PROJECT_PROPERTIES_PANEL_SPEC.title,
    meta: info.name || info.id || "Project properties"
  });
}

function section(label, rows = []) {
  return dataPanelSection({
    namespace: "bc-project-properties",
    label,
    children: rows,
    emptyMessage: PROJECT_PROPERTIES_PANEL_SPEC.emptySectionMessage,
    list: true
  });
}

function emptyState(message = PROJECT_PROPERTIES_PANEL_SPEC.emptySectionMessage) {
  return dataPanelEmpty({ namespace: "bc-project-properties", message });
}

function row({
  icon = "file",
  label,
  value,
  meta = "",
  id = ""
} = {}) {
  if (!label) return null;
  return dataPanelRow({
    namespace: "bc-project-properties",
    icon,
    label,
    value: displayValue(value),
    meta,
    dataset: { projectPropertiesId: id || slug(label) }
  });
}

function projectSections(project, app = null) {
  const info = project?.project || {};
  const identity = propertySet(info, "Identity");
  const projectSet = propertySet(info, "Project");
  const drawingSet = propertySet(info, "Drawing");
  const allSets = { ...identity, ...projectSet, ...drawingSet };
  const units = project?.settings?.units || {};
  return [
    {
      label: "Identity",
      children: PROJECT_IDENTITY_FIELDS.map((field) => editableField({
        field,
        value: fieldValue(field, info, allSets),
        app
      }))
    },
    {
      label: "Description",
      children: PROJECT_DESCRIPTION_FIELDS.map((field) => editableField({
        field,
        value: fieldValue(field, info, allSets),
        app
      }))
    },
    {
      label: "Units",
      children: [
        row({ id: "project-units-length", icon: "settings", label: "Length", value: units.length }),
        row({ id: "project-units-angle", icon: "settings", label: "Angle", value: units.angle }),
        row({ id: "project-units-mass", icon: "settings", label: "Mass", value: units.mass })
      ]
    },
    {
      label: "Model",
      children: [
        row({ id: "project-schema", icon: "database", label: "Schema", value: project?.schema, meta: project?.schemaVersion || "" }),
        row({ id: "project-object-index", icon: "database", label: "Object index", value: `${entryCount(project?.objectIndex)} ids` }),
        row({ id: "project-model-items", icon: "model-browser", label: "Model items", value: `${modelItemCount(project)} items` })
      ]
    }
  ];
}

function propertyField(label, keys = [], path = [], options = {}) {
  return Object.freeze({ label, keys, path, ...options });
}

function fieldValue(field, info = {}, values = {}) {
  const pathValue = valueByPath(info, field.path);
  if (hasValue(pathValue)) return pathValue;
  for (const source of [info, info.bim || {}, values]) {
    const value = valueByKeys(source, field.keys);
    if (hasValue(value)) return value;
  }
  return "-";
}

function editableField({
  field,
  value = "",
  app = null
} = {}) {
  if (!field?.label) return null;
  const currentValue = displayEditValue(value);
  const label = document.createElement("label");
  label.className = `bc-project-properties-field bc-field${field.multiline ? " bc-field-stack" : ""}`;
  label.dataset.projectPropertiesId = `project-${slug(field.label)}`;
  label.dataset.projectPropertiesSearchText = `${field.label} ${currentValue}`;

  const labelNode = document.createElement("span");
  labelNode.className = "bc-field-label";
  labelNode.textContent = field.label;

  const input = document.createElement(field.multiline ? "textarea" : "input");
  if (!field.multiline) input.type = "text";
  input.className = "bc-input";
  input.value = currentValue;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", field.label);
  input.dataset.projectPropertiesField = slug(field.label);
  if (field.multiline) input.rows = 3;
  if (typeof app?.updateProjectMetadata !== "function") {
    input.readOnly = true;
    label.dataset.readOnly = "true";
  }

  const validation = document.createElement("span");
  validation.className = "bc-field-validation";
  validation.hidden = true;

  const commit = () => {
    const nextValue = input.value.trim();
    if (field.required && !nextValue) {
      input.classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
      validation.textContent = `${field.label} cannot be empty.`;
      validation.hidden = false;
      return false;
    }
    input.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
    validation.hidden = true;
    try {
      app?.updateProjectMetadata?.(patchForPath(field.path, nextValue));
      return true;
    } catch (error) {
      input.classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
      validation.textContent = error?.message || "Could not update project property.";
      validation.hidden = false;
      return false;
    }
  };

  input.addEventListener("change", commit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      input.value = currentValue;
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
      validation.hidden = true;
      input.blur();
    }
    if (event.key === "Enter" && !field.multiline) {
      event.preventDefault();
      input.blur();
    }
  });

  label.append(labelNode, input, validation);
  return label;
}

function valueByKeys(source = {}, keys = []) {
  if (!source || typeof source !== "object") return undefined;
  for (const key of keys) {
    if (hasValue(source[key])) return source[key];
  }
  const normalized = Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = normalized[normalizeKey(key)];
    if (hasValue(value)) return value;
  }
  return undefined;
}

function valueByPath(source = {}, path = []) {
  let value = source;
  for (const key of path || []) {
    if (!value || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

function patchForPath(path = [], value = "") {
  if (!Array.isArray(path) || !path.length) return {};
  const [key, ...rest] = path;
  if (!rest.length) return { [key]: value };
  return { [key]: patchForPath(rest, value) };
}

function propertySet(info = {}, name = "") {
  const sets = info.bim?.propertySets || {};
  if (!sets || typeof sets !== "object" || Array.isArray(sets)) return {};
  const exact = sets[name];
  if (exact && typeof exact === "object" && !Array.isArray(exact)) return exact;
  const normalizedName = normalizeKey(name);
  const match = Object.entries(sets)
    .find(([key, value]) => normalizeKey(key) === normalizedName && value && typeof value === "object" && !Array.isArray(value));
  return match?.[1] || {};
}

function filterSections(sections, query) {
  const terms = searchTerms(query);
  if (!terms.length) return sections;
  return sections
    .map((sectionEntry) => ({
      ...sectionEntry,
      children: sectionEntry.children.filter((item) => rowMatchesQuery(item, terms, sectionEntry.label))
    }))
    .filter((sectionEntry) => sectionEntry.children.length);
}

function rowMatchesQuery(item, terms, sectionLabel = "") {
  const datasetText = Object.values(item?.dataset || {}).join(" ");
  const haystack = `${sectionLabel} ${item?.textContent || ""} ${datasetText}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function searchTerms(query) {
  return String(query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  if (hasValue(value)) return String(value);
  return "-";
}

function displayEditValue(value) {
  return hasValue(value) && value !== "-" ? String(value) : "";
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function modelItemCount(project) {
  const model = project?.model || {};
  return MODEL_COLLECTION_SPECS.reduce((total, spec) => total + entryCount(model[spec.id]), 0);
}

function entryCount(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
}

function normalizeKey(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slug(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "property";
}
