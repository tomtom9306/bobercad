function text(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function button(label, className, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function numericInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "text";
  input.inputMode = "decimal";
  input.value = Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    input.classList.toggle("invalid", !Number.isFinite(next));
    if (Number.isFinite(next)) onChange(next);
  });
  row.append(text("span", "editor-label", label), input);
  return row;
}

function selectInput(label, options, value, onChange) {
  const row = document.createElement("label");
  const select = document.createElement("select");
  row.className = "editor-field";
  select.setAttribute("aria-label", label);
  for (const option of options) {
    const item = document.createElement("option");
    item.value = option.id;
    item.textContent = option.label;
    select.append(item);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  row.append(text("span", "editor-label", label), select);
  return row;
}

function textInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "text";
  input.value = value || "";
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => onChange(input.value));
  row.append(text("span", "editor-label", label), input);
  return row;
}

function checkboxInput(label, value, onChange) {
  const row = document.createElement("label");
  const input = document.createElement("input");
  row.className = "editor-field";
  input.type = "checkbox";
  input.checked = Boolean(value);
  input.setAttribute("aria-label", label);
  input.addEventListener("change", () => onChange(input.checked));
  row.append(text("span", "editor-label", label), input);
  return row;
}

function readout(label, value) {
  const row = document.createElement("div");
  row.className = "editor-readout";
  row.append(text("span", "editor-label", label), text("span", "editor-value", value));
  return row;
}

function arrayInput(label, labels, value, onChange) {
  const rows = [text("div", "editor-subtitle", label)];
  const current = labels.map((_, index) => Array.isArray(value) && Number.isFinite(value[index]) ? value[index] : NaN);
  labels.forEach((item, index) => {
    rows.push(numericInput(item, current[index], (nextValue) => {
      const next = [...current];
      next[index] = nextValue;
      if (next.every(Number.isFinite)) onChange(next);
    }));
  });
  return rows;
}

function vectorInput(label, value, onChange) {
  return arrayInput(label, ["X", "Y", "Z"], value, onChange);
}

function vector2Input(label, value, onChange) {
  return arrayInput(label, ["Y", "Z"], value, onChange);
}

const BOOLEAN_TYPE_OPTIONS = [
  { id: "BOOLEAN_CUT", label: "Cut" },
  { id: "BOOLEAN_ADD", label: "Add" },
  { id: "BOOLEAN_WELDPREP", label: "Weld prep" }
];

const SOURCE_KIND_OPTIONS = [
  { id: "member-profile", label: "Member profile" }
];

export function mountFeatureEditorPanel({ panel, api, selection, onLocalObjectProjectChange }) {
  let selectedFeatureId = null;
  let messageText = "";
  let messageState = "";

  const setMessage = (message, state = "") => {
    messageText = message;
    messageState = state;
    render();
  };

  const selectedFeature = () => selectedFeatureId ? api.project().model.features?.[selectedFeatureId] || null : null;

  const applyProjectChange = (nextProject, primaryObjectId, objectIds) => {
    if (!selectedFeatureId) return;
    if (typeof onLocalObjectProjectChange !== "function") throw new Error("feature update requires affected-object scene patching");
    if (onLocalObjectProjectChange(nextProject, primaryObjectId || selectedFeatureId, objectIds) === false) {
      throw new Error("affected-object scene patch failed");
    }
  };

  const updateFeature = (operation) => {
    if (!selectedFeatureId) return;
    try {
      const nextProject = operation(selectedFeatureId);
      applyProjectChange(nextProject, selectedFeatureId, api.featureDependencyObjectIds(selectedFeatureId, { renderableOnly: true }));
      selection.select([selectedFeatureId]);
      setMessage("Feature updated.", "ok");
    } catch (error) {
      setMessage(error.message, "error");
    }
  };

  const commonEditor = (feature) => [
    text("div", "editor-subtitle", "Feature"),
    checkboxInput("Enabled", feature.operationEnabled !== false, (enabled) => updateFeature((featureId) => api.setFeatureOperationEnabled(featureId, enabled)))
  ];

  const bodyAxesEditor = (body) => [
    ...vectorInput("Axis X", body.axisX, (axisX) => updateFeature((featureId) => api.setFeatureBody(featureId, { axisX }))),
    ...vectorInput("Axis Y", body.axisY, (axisY) => updateFeature((featureId) => api.setFeatureBody(featureId, { axisY }))),
    ...vectorInput("Axis Z", body.axisZ, (axisZ) => updateFeature((featureId) => api.setFeatureBody(featureId, { axisZ })))
  ];

  const bodyEditor = (feature) => {
    const body = feature.body;
    if (!body) return [];
    const rows = [
      text("div", "editor-subtitle", "Cutting body"),
      readout("Body", body.type || "-"),
      ...vectorInput("Center", body.center, (center) => updateFeature((featureId) => api.setFeatureBody(featureId, { center })))
    ];
    if (feature.type === "boolean-part") {
      rows.push(selectInput("Boolean", BOOLEAN_TYPE_OPTIONS, feature.booleanType || "BOOLEAN_CUT", (booleanType) => updateFeature((featureId) => api.updateFeature(featureId, { booleanType }))));
    }
    if (body.type === "box") {
      rows.push(...vectorInput("Size", body.size, (size) => updateFeature((featureId) => api.setFeatureBody(featureId, { size }))));
      rows.push(...bodyAxesEditor(body));
    } else if (body.type === "cylinder") {
      rows.push(numericInput("Radius", body.radius, (radius) => updateFeature((featureId) => api.setFeatureBody(featureId, { radius }))));
      rows.push(numericInput("Depth", body.depth, (depth) => updateFeature((featureId) => api.setFeatureBody(featureId, { depth }))));
      rows.push(...bodyAxesEditor(body));
    } else if (body.type === "polygonal-prism") {
      rows.push(numericInput("Depth", body.depth, (depth) => updateFeature((featureId) => api.setFeatureBody(featureId, { depth }))));
      rows.push(...bodyAxesEditor(body));
      (body.outline || []).forEach((point, index) => {
        rows.push(...vector2Input(`Point ${index + 1}`, point, (nextPoint) => {
          const outline = [...(body.outline || [])];
          outline[index] = nextPoint;
          updateFeature((featureId) => api.setFeatureBody(featureId, { outline }));
        }));
      });
    }
    return rows;
  };

  const sourceEditor = (feature) => {
    if (!feature.source) return [];
    const source = feature.source;
    return [
      text("div", "editor-subtitle", "Source"),
      selectInput("Kind", SOURCE_KIND_OPTIONS, source.kind || "member-profile", (kind) => updateFeature((featureId) => api.setFeatureSource(featureId, { kind }))),
      textInput("Member", source.memberId || "", (memberId) => {
        if (!memberId.trim()) {
          setMessage("Source member cannot be empty from this editor.", "error");
          return;
        }
        updateFeature((featureId) => api.setFeatureSource(featureId, { memberId: memberId.trim() }));
      })
    ];
  };

  const editorRows = (feature) => {
    const rows = [
      readout("Feature", feature.id),
      readout("Type", feature.type),
      readout("Owner", feature.ownerId || "-"),
      ...commonEditor(feature)
    ];
    rows.push(...sourceEditor(feature));
    if (feature.type === "boolean-part" || feature.body) rows.push(...bodyEditor(feature));
    return rows;
  };

  function render() {
    const feature = selectedFeature();
    if (!feature) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    const header = document.createElement("div");
    header.className = "feature-editor-header";
    header.append(text("div", "editor-title", "Feature Editor"), button("Close", "editor-button", () => clear()));

    const body = document.createElement("section");
    body.className = "editor-section";
    body.append(...editorRows(feature));

    const message = text("div", "editor-message", messageText);
    message.dataset.state = messageState;

    panel.hidden = false;
    panel.replaceChildren(header, body, message);
  }

  function clear() {
    selectedFeatureId = null;
    messageText = "";
    messageState = "";
    render();
  }

  api.subscribe(() => {
    if (selectedFeatureId && !api.project().model.features?.[selectedFeatureId]) clear();
    else render();
  });
  render();

  return {
    selectFeature(featureId) {
      const feature = api.project().model.features?.[featureId];
      if (!feature) {
        clear();
        return;
      }
      selectedFeatureId = featureId;
      messageText = "";
      messageState = "";
      selection.select([featureId]);
      render();
    },
    clear
  };
}
