import { arrayInput, checkboxInput, createPanelMessageState, hidePanel, numericInput, readout, renderEditorPanel, selectInput, text, textInput, vectorInput } from "./panel-elements.mjs?v=panel-controls-dry-1";
import { arrayValues } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";

const BOOLEAN_TYPE_OPTIONS = [
  { id: "BOOLEAN_CUT", label: "Cut" },
  { id: "BOOLEAN_ADD", label: "Add" },
  { id: "BOOLEAN_WELDPREP", label: "Weld prep" }
];

const SOURCE_KIND_OPTIONS = [
  { id: "member-profile", label: "Member profile" }
];
const BODY_AXIS_TYPES = new Set(["box", "cylinder", "polygonal-prism"]);

export function mountFeatureEditorPanel({ panel, api, selection, onLocalObjectProjectChange }) {
  let selectedFeatureId = null;
  const panelMessage = createPanelMessageState(() => render());
  const setMessage = panelMessage.set;

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
    } else if (body.type === "cylinder") {
      rows.push(numericInput("Radius", body.radius, (radius) => updateFeature((featureId) => api.setFeatureBody(featureId, { radius }))));
      rows.push(numericInput("Depth", body.depth, (depth) => updateFeature((featureId) => api.setFeatureBody(featureId, { depth }))));
    } else if (body.type === "polygonal-prism") {
      rows.push(numericInput("Depth", body.depth, (depth) => updateFeature((featureId) => api.setFeatureBody(featureId, { depth }))));
    }
    if (BODY_AXIS_TYPES.has(body.type)) rows.push(...bodyAxesEditor(body));
    if (body.type === "polygonal-prism") {
      arrayValues(body.outline).forEach((point, index) => {
        rows.push(...arrayInput(`Point ${index + 1}`, ["Y", "Z"], point, (nextPoint) => {
          const outline = [...arrayValues(body.outline)];
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
      text("div", "editor-subtitle", "Feature"),
      checkboxInput("Enabled", feature.operationEnabled !== false, (enabled) => updateFeature((featureId) => api.setFeatureOperationEnabled(featureId, enabled)))
    ];
    rows.push(...sourceEditor(feature));
    if (feature.type === "boolean-part" || feature.body) rows.push(...bodyEditor(feature));
    return rows;
  };

  function render() {
    const feature = selectedFeature();
    if (!feature) {
      hidePanel(panel);
      return;
    }

    renderEditorPanel(panel, "Feature Editor", clear, editorRows(feature), panelMessage.element());
  }

  function clear() {
    selectedFeatureId = null;
    panelMessage.clear({ render: false });
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
      panelMessage.clear({ render: false });
      selection.select([featureId]);
      render();
    },
    clear
  };
}
