import { createPanelMessageState, disclosureSection, hidePanel, renderEditorPanel } from "./panel-elements.mjs?v=panel-primitives-1";
import { arrayValues } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";
import { inspectorFeatureEditorSections } from "../../commands/inspector-property-metadata.mjs?v=feature-editor-metadata-1";
import { bindGeneratedPropertySections } from "./generated-property-bindings.mjs?v=generated-property-bindings-1";
import { generatedPropertyField } from "./generated-properties-panel.mjs?v=feature-editor-generated-fields-1";

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

  const featureEditorBindings = () => ({
    commits: {
      "feature.operationEnabled.set": (enabled) => updateFeature((featureId) => api.setFeatureOperationEnabled(featureId, enabled)),
      "feature.update": (value, commit = {}) => {
        if (!commit.patchKey) return;
        updateFeature((featureId) => api.updateFeature(featureId, { [commit.patchKey]: value }));
      },
      "feature.body.update": (value, commit = {}) => {
        if (!commit.patchKey) return;
        updateFeature((featureId) => api.setFeatureBody(featureId, { [commit.patchKey]: value }));
      },
      "feature.body.outlinePoint.update": (point, commit = {}) => {
        const feature = selectedFeature();
        const outline = [...arrayValues(feature?.body?.outline)];
        if (!Number.isInteger(commit.pointIndex) || commit.pointIndex < 0 || commit.pointIndex >= outline.length) return;
        outline[commit.pointIndex] = point;
        updateFeature((featureId) => api.setFeatureBody(featureId, { outline }));
      },
      "feature.source.update": (value, commit = {}) => {
        if (!commit.patchKey) return;
        const nextValue = commit.patchKey === "memberId" ? String(value || "").trim() : value;
        if (commit.patchKey === "memberId" && !nextValue) {
          setMessage("Source member cannot be empty from this editor.", "error");
          return;
        }
        updateFeature((featureId) => api.setFeatureSource(featureId, { [commit.patchKey]: nextValue }));
      }
    }
  });

  const renderFeatureFields = (fields = []) => {
    const section = bindGeneratedPropertySections([{ id: "feature.editor.inline", fields }], featureEditorBindings())[0];
    return (section?.fields || []).map(generatedPropertyField).filter(Boolean);
  };

  const renderFeatureSection = (section) => {
    const rows = renderFeatureFields(section.fields);
    for (const nested of section.sections || []) {
      rows.push(disclosureSection(nested.label, renderFeatureFields(nested.fields), {
        className: "bc-disclosure-nested",
        sectionId: nested.id,
        open: nested.open
      }));
    }
    return disclosureSection(section.label, rows, { open: section.open, sectionId: section.id });
  };

  const editorRows = (feature) => {
    return inspectorFeatureEditorSections(feature).map(renderFeatureSection);
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
