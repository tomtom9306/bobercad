import { WORLD_AXIS_DIRECTIONS, WORLD_AXIS_IDS, bounds3, finiteNumber, finitePositiveNumber } from "../../../engine/core/math.mjs";
import { arrayValues, jsonClone as clone, truthyValues } from "../../../engine/core/model.mjs";
import { axisRelationLabel } from "../../../engine/api/project/axis-relations.mjs";
import { memberAxisData, memberCenter } from "../../../engine/api/project/members.mjs";
import { plateBends, plateOutline as sketchPlateOutline, plateSketchDefinitionStatus, sketchConstructionEdges, sketchDefinitionStatus, sketchEdges } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs";
import { trimOperationById, trimOperationReferencePlaneIds, trimOperationUsesMemberB, trimOperationUsesMemberEnd } from "../../../engine/api/project/trim-operations.mjs";
import { reconcilePlaneTrimRemovedRegionKeys } from "../../../engine/api/model/trim-region-keys.mjs";
import { setPath } from "../../../engine/modules/smart-components/smart-component-parameters-and-definition.mjs";
import { MODELING_TOOLBAR_COMMANDS } from "../../commands/command-registry.mjs";
import { trimOperationLabel, trimOperationSupportsGap } from "../../commands/trim-operation-metadata.mjs";
import {
  inspectorActiveToolContext,
  inspectorActiveToolSections,
  inspectorFormatNumber,
  inspectorMemberAdvancedSections,
  inspectorMemberContext,
  inspectorMemberEditSections,
  inspectorMemberIdentitySection,
  inspectorMetadataLabel,
  inspectorObjectContext,
  inspectorObjectGeneratedBySection,
  inspectorObjectIdentitySection,
  inspectorObjectPropertySections,
  inspectorViewContext,
  inspectorViewPropertySections,
  inspectorSmartComponentContext,
  inspectorSmartComponentDiagnosticsSummary,
  inspectorSmartComponentPropertySections,
  inspectorSupportObjectPropertySections
} from "../../commands/inspector-property-metadata.mjs";
import { createPanelMessageState } from "./panel-elements.mjs";
import { generatedPropertiesPanel } from "./generated-properties-panel.mjs";
import { bindGeneratedPropertySections } from "./generated-property-bindings.mjs";
import { createInspectorPropertyBindings } from "./inspector-property-bindings.mjs";
import { sceneCollectionCounts, sceneReferencePoints } from "./inspector-scene-metrics.mjs";
import { createPlateSketchInspector } from "./contributions/plate-sketch-inspector.mjs";
import { smartComponentQuickParameterFields } from "./contributions/smart-component-properties.mjs";

const MODELING_TOOL_COMMAND_BY_ID = new Map(MODELING_TOOLBAR_COMMANDS.map((command) => [command.id, command]));
const DEFAULT_CUSTOM_PROFILE_POINTS = "-50 -100\n50 -100\n50 100\n-50 100";

function catalogOptions(api, catalog, currentId = "") {
  const entries = api.catalogEntries?.(catalog) || {};
  const options = Object.values(entries)
    .filter((item) => item?.id)
    .map((item) => ({ id: item.id, label: item.designation || item.name || item.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (currentId && !options.some((option) => option.id === currentId)) {
    options.unshift({ id: currentId, label: currentId });
  }
  return options;
}

function fastenerLengthOptions(api, fastenerRef, currentLength) {
  const fastener = api.catalogEntries?.("fasteners")?.[fastenerRef];
  const lengths = arrayValues(fastener?.lengths)
    .filter(finitePositiveNumber)
    .sort((a, b) => a - b);
  const values = finitePositiveNumber(currentLength) && !lengths.includes(currentLength)
    ? [currentLength, ...lengths]
    : lengths;
  return values.map((value) => ({ id: String(value), label: String(value) }));
}

function profileOptions(profiles) {
  return Object.values(profiles)
    .map((profile) => ({ id: profile.id, label: profile.designation || profile.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function materialOptions(materials, currentId = "") {
  const options = Object.values(materials)
    .filter((material) => material?.id)
    .map((material) => ({ id: material.id, label: material.name || material.id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (currentId && !options.some((option) => option.id === currentId)) {
    options.unshift({ id: currentId, label: currentId });
  }
  return options;
}

function objectIdFromFace(face) {
  return face?.objectId || null;
}

function globalAxisSource(axis) {
  const normalized = String(axis || "").toLowerCase();
  return {
    type: "global-axis",
    axis: normalized,
    direction: WORLD_AXIS_DIRECTIONS[normalized],
    label: `Global ${normalized.toUpperCase()} axis`
  };
}

export function mountEditorUi({
  panel,
  app = null,
  api,
  profiles,
  materials = {},
  selection,
  memberEdit,
  smartComponentHighlightObjectIds,
  previewService = null,
  onProjectChange,
  onLocalMemberProjectChange,
  onSmartComponentSelected,
  onSmartComponentDeleted,
  onObjectSelected,
  onObjectCleared
}) {
  let selectedMemberId = null;
  let selectedSmartComponentId = null;
  let selectedObjectId = null;
  let selectedObjectDetail = null;
  let sceneSelected = true;
  let gridEditorEmpty = false;
  const memberCustomProfileDrafts = new Map();
  const smartComponentPreviewResults = new Map();
  const smartComponentPreviewRequests = new Set();
  const panelMessage = createPanelMessageState(() => render());
  const setMessage = panelMessage.set;
  const showError = (error) => setMessage(error.message, "error");

  const connectedMemberObjectIds = (memberId) => api.memberDependencyObjectIds(memberId, { renderableOnly: true });

  const clearObjectWindow = () => onObjectCleared?.();
  const clearMemberEditSilently = () => memberEdit?.clear({ notify: false });
  const clearCurrentSelection = (options = {}) => {
    setSelectedState({ scene: true });
    gridEditorEmpty = false;
    if (!options.fromMemberEdit) clearMemberEditSilently();
    selection.clear();
    clearObjectWindow();
    panelMessage.clear({ render: false });
    render();
  };

  const setSelectedState = ({ memberId = null, smartComponentId = null, objectId = null, objectDetail = null, scene = false } = {}) => {
    selectedMemberId = memberId;
    selectedSmartComponentId = smartComponentId;
    selectedObjectId = objectId;
    selectedObjectDetail = objectDetail;
    sceneSelected = Boolean(scene);
    gridEditorEmpty = false;
  };

  const applyProjectChange = (nextProject, options = {}) => {
    if (options.memberId) {
      if (typeof onLocalMemberProjectChange !== "function") throw new Error("member update requires affected-object scene patching");
      const objectIds = connectedMemberObjectIds(options.memberId);
      if (onLocalMemberProjectChange(nextProject, options.memberId, objectIds) === false) {
        throw new Error("affected-object scene patch failed");
      }
      return;
    }
    onProjectChange(nextProject);
  };

  const selectMember = (memberId, options = {}) => {
    setSelectedState({ memberId });
    if (options.fromMemberEdit) selection.select([memberId]);
    else if (memberEdit) memberEdit.selectMember(memberId, { notify: false });
    else selection.select([memberId]);
    clearObjectWindow();
    setMessage(`Selected ${memberId}.`, "ok");
  };

  const selectScene = (options = {}) => {
    setSelectedState({ scene: true });
    clearMemberEditSilently();
    selection.clear();
    clearObjectWindow();
    panelMessage.clear({ render: false });
    if (options.render !== false) render();
  };

  const selectSmartComponent = (smartComponentId, options = {}) => {
    setSelectedState({ smartComponentId });
    clearMemberEditSilently();
    selection.select(typeof smartComponentHighlightObjectIds === "function"
      ? smartComponentHighlightObjectIds(smartComponentId)
      : api.smartComponentObjectIds(smartComponentId));
    clearObjectWindow();
    onSmartComponentSelected(smartComponentId, options);
    setMessage(`Selected ${smartComponentId}.`, "ok");
  };

  const selectObject = (objectId, detail = {}, options = {}) => {
    const entry = api.project().objectIndex?.[objectId];
    if (!entry?.collection) {
      setMessage(`Object not found: ${objectId}`, "error");
      return;
    }
    if (entry.collection === "members") {
      selectMember(objectId);
      return;
    }
    if (entry.collection === "smartComponentInstances") {
      selectSmartComponent(objectId);
      return;
    }
    setSelectedState({ objectId, objectDetail: detail || null });
    clearMemberEditSilently();
    selection.select([objectId]);
    if (options.notify !== false) onObjectSelected?.(objectId, detail || {});
    setMessage(`Selected ${objectId}.`, "ok");
  };

  const openGridEditor = () => {
    setSelectedState();
    clearMemberEditSilently();
    selection.clear();
    clearObjectWindow();
    gridEditorEmpty = true;
    setMessage("Grid editor opened.", "ok");
  };

  const beginMemberPick = () => {
    selection.beginMemberPick({
      count: 1,
      onComplete: ([memberId]) => selectMember(memberId),
      onError: (message) => setMessage(message, "error")
    });
    setMessage("Pick a member.", "ok");
  };

  const beginSmartComponentPick = () => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => {
        const smartComponent = api.smartComponentRootForObject(objectId);
        if (!smartComponent) {
          selection.clear();
          setMessage("Picked object is not part of a generated Smart Component.", "error");
          return;
        }
        selectSmartComponent(smartComponent.id);
      },
      onError: () => setMessage("Pick any generated Smart Component object.", "error")
    });
    setMessage("Pick any generated Smart Component object.", "ok");
  };

  const beginObjectPick = () => {
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => selectObject(objectId),
      onError: (message) => setMessage(message, "error")
    });
    setMessage("Pick a member, sketch, trim, cut, plate, fastener, or weld.", "ok");
  };

  const selectedFocusObjectIds = () => {
    if (selectedMemberId) return [selectedMemberId];
    if (selectedSmartComponentId) return typeof smartComponentHighlightObjectIds === "function"
      ? smartComponentHighlightObjectIds(selectedSmartComponentId)
      : api.smartComponentObjectIds(selectedSmartComponentId);
    if (selectedObjectId) return [selectedObjectId];
    return [];
  };

  const focusSelection = () => {
    const objectIds = selectedFocusObjectIds();
    if (!objectIds.length || !app?.focusSelection?.(objectIds)) {
      setMessage("Nothing visible to frame.", "error");
      return;
    }
    setMessage("Selection framed.", "ok");
  };

  const focusObjectReference = (objectId) => {
    const entry = api.project().objectIndex?.[objectId];
    if (!entry?.collection) {
      setMessage(`Object not found: ${objectId}`, "error");
      return;
    }
    const objectIds = entry.collection === "smartComponentInstances"
      ? typeof smartComponentHighlightObjectIds === "function" ? smartComponentHighlightObjectIds(objectId) : api.smartComponentObjectIds(objectId)
      : [objectId];
    if (!objectIds.length || !app?.focusSelection?.(objectIds)) {
      setMessage(`Nothing visible to frame for ${objectId}.`, "error");
      return;
    }
    setMessage(`Framed ${objectId}.`, "ok");
  };

  const selectObjectReference = (objectId) => {
    const entry = api.project().objectIndex?.[objectId];
    if (!entry?.collection) {
      setMessage(`Object not found: ${objectId}`, "error");
      return;
    }
    if (entry.collection === "smartComponentInstances") selectSmartComponent(objectId);
    else selectObject(objectId);
  };

  const {
    plateEditor,
    inferPlateSketchRelations,
    createPlateFromSketch,
    setPlateSketchRelationValue,
    selectPlateSketchRelation,
    setPlateSketchRelationMode,
    resolvePlateSketchRelation,
    removePlateSketchRelation,
    addPlateSketchRelationFromPayload,
    addPlateSketchConstructionLineFromPayload,
    fixPlateSketchUnderDefinedEntities,
    removePlateSketchFixedRelations
  } = createPlateSketchInspector({
    api,
    selection,
    applyProjectChange,
    selectObject,
    setSelectedObjectState: (objectId, objectDetail = {}) => setSelectedState({ objectId, objectDetail }),
    getSelectedObjectId: () => selectedObjectId,
    getSelectedObjectDetail: () => selectedObjectDetail,
    setMessage,
    showError
  });

  const {
    generatedReferenceBindings,
    generatedActiveToolBindings,
    generatedMemberBindings,
    generatedSupportObjectBindings,
    generatedSmartComponentBindings,
    generatedObjectBindings
  } = createInspectorPropertyBindings({
    getSelection: () => ({
      smartComponentId: selectedSmartComponentId,
      objectId: selectedObjectId,
      objectDetail: selectedObjectDetail || {}
    }),
    definition: (smartComponentId) => api.definition(smartComponentId),
    refs: {
      selectSmartComponent,
      selectObjectReference,
      focusObjectReference
    },
    selectionActions: {
      pickMember: () => beginMemberPick(),
      pickSmartComponent: () => beginSmartComponentPick(),
      pickObject: () => beginObjectPick(),
      fit: () => focusSelection(),
      clear: () => clearCurrentSelection(),
      selectSmartComponent: (smartComponentId) => selectSmartComponent(smartComponentId),
      openFeatureEditor: (objectId) => onObjectSelected?.(objectId, { inspectorPanel: "feature" }),
      openTrimEditor: (objectId, detail) => onObjectSelected?.(objectId, { ...(detail || {}), inspectorPanel: "properties" }),
      selectObjectDetail: (objectId, detail) => selectObject(objectId, detail)
    },
    activeTool: {
      runCommand: (commandId) => runActiveToolSetting(
        () => app?.runCommand?.(commandId),
        commandId === "settings.snap.toggle" ? "Snap settings opened." : ""
      ),
      cycleSnap: () => runActiveToolSetting(
        () => app?.cycleActiveSnap?.(),
        "Snap candidate cycled."
      ),
      cancel: () => {
        if (app?.canRunCommand?.("command.cancel")) app.runCommand("command.cancel");
        else app?.cancelCommand?.();
        setMessage("Command cancelled.", "ok");
        render();
      },
      setSnapStrength: (strength) => runActiveToolSetting(
        () => app?.runCommand?.(`settings.snapStrength.${strength}`),
        `Snap strength: ${strength}`
      ),
      setSelectionScope: (mode) => runActiveToolSetting(
        () => app?.runCommand?.(`selection.scope.${mode}`),
        "Selection scope updated."
      ),
      setSnapTarget: (target, enabled) => runActiveToolSetting(() => {
        const current = app?.snapSettings?.()?.scope || {};
        if ((current[target] !== false) !== enabled) app?.runCommand?.(`settings.snapTarget.${target}.toggle`);
      }, `${target} snap ${enabled ? "enabled" : "disabled"}.`)
    },
    members: {
      setProfile: (memberId, profileId) => updateMember(() => api.setMemberProfile(memberId, profileId)),
      setMaterial: (memberId, materialId) => updateMember(() => api.updateMember(memberId, { material: materialId })),
      setRotation: (memberId, rotation) => updateMember(() => api.setMemberRotation(memberId, rotation)),
      setCenterCoordinate: (memberId, axisIndex, value) => {
        const nextCenter = [...memberCenter(api.member(memberId))];
        nextCenter[axisIndex] = value;
        updateMember(() => api.setMemberCenter(memberId, nextCenter));
      },
      setEndpointCoordinate: (memberId, endpoint, axisIndex, value) => {
        const currentMember = api.member(memberId);
        const nextPoint = [...currentMember[endpoint]];
        nextPoint[axisIndex] = value;
        updateMember(() => api.setMemberPhysicalEndpoint(memberId, endpoint, nextPoint));
      },
      setCustomProfileDraft: (memberId, value) => setMemberCustomProfileDraft(memberId, value),
      createCustomProfile: (memberId) => createCustomProfile(memberId),
      removeRelation: (relationId) => removeMemberRelation(relationId),
      setAlignmentGlobalAxis: (_memberId, axisId) => setMemberAlignment(globalAxisSource(axisId)),
      pickAlignmentAxis: () => beginAlignmentAxisPick(),
      clearAlignment: () => clearMemberAlignment()
    },
    support: {
      addGridSystem: () => addGridSystem(),
      updateGridSystem: (patch) => updateGridSystem(patch),
      addGridAxis: (axisGroup) => addGridAxis(axisGroup),
      removeGridAxis: (axisGroup, axisId) => removeGridAxis(axisGroup, axisId),
      updateGridLevel: (levelId, patch) => updateGridLevel(levelId, patch),
      addGridLevel: (gridSystemId) => addGridLevel(gridSystemId),
      updateLevel: (patch) => updateLevel(patch),
      updateWorkPoint: (patch) => updateWorkPoint(patch),
      updateReferencePlane: (patch) => updateReferencePlane(patch),
      updateInterface: (patch) => updateInterface(patch),
      updateConnectionZone: (patch) => updateConnectionZone(patch),
      updateAssembly: (patch) => updateAssembly(patch),
      updateGroup: (patch) => updateGroup(patch),
      updateHolePattern: (patch) => updateHolePattern(patch),
      updateObjectPattern: (patch) => updateObjectPattern(patch)
    },
    smartComponents: {
      updateParameter: (smartComponentId, definition, path, value) => updateSmartComponentParameter(smartComponentId, definition, path, value),
      setRoleActive: (smartComponentId, role, active) => updateSmartComponentById(
        smartComponentId,
        (smartComponentId) => api.setSmartComponentRoleActive(smartComponentId, role, active),
        active ? "Component enabled." : "Component disabled."
      ),
      resetObjectOverrides: (smartComponentId, objectId) => resetSmartComponentObjectOverrides(smartComponentId, objectId),
      detachObject: (smartComponentId, objectId) => detachSmartComponentObject(smartComponentId, objectId),
      reattachObject: (smartComponentId, objectId) => reattachSmartComponentObject(smartComponentId, objectId),
      resolveDiagnostics: (smartComponentId) => resolveSmartComponentDiagnostics(smartComponentId),
      openParameters: (smartComponentId) => onSmartComponentSelected?.(smartComponentId, { inspectorPanel: "component" }),
      deleteSmartComponent: (smartComponentId) => deleteSmartComponent(smartComponentId)
    },
    objects: {
      updateFastenerGroup: (patch) => updateFastenerGroup(patch),
      updatePlatePatch: (patch) => updatePlate((plateId) => api.updatePlate(plateId, patch)),
      upsertPlateBend: (bend) => updatePlate((plateId) => api.upsertPlateBend(plateId, bend)),
      removePlateBend: (bendId) => updatePlate((plateId) => api.removePlateBend(plateId, bendId)),
      updateTrimOperation: (operationId, patch) => updateTrimOperation(operationId, patch),
      setFeatureOperationEnabled: (enabled) => updateFeature((featureId) => api.setFeatureOperationEnabled(featureId, enabled)),
      updateFeaturePatch: (patch) => updateFeaturePatch(patch),
      updateFeatureBody: (patch) => updateFeatureBody(patch),
      updateWeld: (patch) => updateWeld(patch),
      inferPlateSketchRelations: (plateId) => inferPlateSketchRelations(plateId),
      createPlateFromSketch: (sketchId) => createPlateFromSketch(sketchId),
      selectTrimOperation: (operationId) => selectObject(selectedObjectId, { operationId }),
      setTrimOperationType: (operationId, type) => setTrimOperationType(operationId, type),
      setPlateSketchRelationValue: (value, commit) => setPlateSketchRelationValue(value, commit),
      selectPlateSketchRelation: (payload) => selectPlateSketchRelation(payload),
      setPlateSketchRelationMode: (payload) => setPlateSketchRelationMode(payload),
      resolvePlateSketchRelation: (payload) => resolvePlateSketchRelation(payload),
      removePlateSketchRelation: (payload) => removePlateSketchRelation(payload),
      addPlateSketchRelation: (payload) => addPlateSketchRelationFromPayload(payload),
      addPlateSketchConstructionLine: (payload) => addPlateSketchConstructionLineFromPayload(payload),
      fixPlateSketchUnderDefinedEntities: (payload) => fixPlateSketchUnderDefinedEntities(payload),
      removePlateSketchFixedRelations: (payload) => removePlateSketchFixedRelations(payload),
      selectObjectDetail: (objectId, detail) => selectObject(objectId, detail),
      openTrimEditor: (objectId, detail) => onObjectSelected?.(objectId, { ...(detail || {}), inspectorPanel: "properties" }),
      openFeatureEditor: (objectId) => onObjectSelected?.(objectId, { inspectorPanel: "feature" })
    }
  });

  const runActiveToolSetting = (runner, message) => {
    try {
      const result = runner?.();
      if (message) setMessage(message, "ok");
      render();
      return result;
    } catch (error) {
      showError(error);
      return null;
    }
  };

  const updateMember = (operation) => {
    if (!selectedMemberId) return;
    try {
      const nextProject = operation(selectedMemberId);
      applyProjectChange(nextProject, { memberId: selectedMemberId });
      if (memberEdit) memberEdit.selectMember(selectedMemberId, { notify: false });
      else selection.select([selectedMemberId]);
      setMessage("Member updated.", "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateSelectedObject = (operation, message) => {
    if (!selectedObjectId) return;
    try {
      applyProjectChange(operation(selectedObjectId));
      selection.select([selectedObjectId]);
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateFastenerGroup = (patch) => updateSelectedObject((objectId) => api.updateFastenerGroup(objectId, patch), "Fastener group updated.");

  const updateWeld = (patch) => updateSelectedObject((objectId) => api.updateWeld(objectId, patch), "Weld updated.");

  const updateWorkPoint = (patch) => updateSelectedObject((objectId) => api.updateWorkPoint(objectId, patch), "Work point updated.");

  const addGridSystem = () => {
    try {
      const result = api.createGridSystem({ name: "Grid" });
      applyProjectChange(result.project);
      selectObject(result.gridSystemId);
      setMessage(`Grid system created: ${result.gridSystemId}.`, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateGridSystem = (patch) => updateSelectedObject((objectId) => api.updateGridSystem(objectId, patch), "Grid system updated.");

  const addGridAxis = (axisGroup) => updateSelectedObject((objectId) => api.addGridAxis(objectId, axisGroup), "Grid axis added.");

  const removeGridAxis = (axisGroup, axisId) => updateSelectedObject((objectId) => api.removeGridAxis(objectId, axisGroup, axisId), "Grid axis removed.");

  const updateLevel = (patch) => updateSelectedObject((objectId) => api.updateLevel(objectId, patch), "Level updated.");

  const updateGridLevel = (levelId, patch) => {
    if (!levelId) return;
    try {
      applyProjectChange(api.updateLevel(levelId, patch));
      if (selectedObjectId) selection.select([selectedObjectId]);
      setMessage("Level updated.", "ok");
    } catch (error) {
      showError(error);
    }
  };

  const addGridLevel = (gridSystemId = selectedObjectId) => {
    try {
      const elevations = Object.values(api.project().model?.levels || {})
        .map((level) => Number(level.elevation))
        .filter(Number.isFinite);
      const elevation = elevations.length ? Math.max(...elevations) + 3000 : 0;
      const result = api.createLevel({ name: "Level", elevation });
      applyProjectChange(result.project);
      if (gridSystemId && api.project().model?.gridSystems?.[gridSystemId]) {
        setSelectedState({ objectId: gridSystemId, objectDetail: selectedObjectDetail });
        selection.select([gridSystemId]);
      }
      setMessage(`Level created: ${result.levelId}.`, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateReferencePlane = (patch) => updateSelectedObject((objectId) => api.setReferencePlane(objectId, patch), "Reference plane updated.");

  const updateHolePattern = (patch) => updateSelectedObject((objectId) => api.updateHolePattern(objectId, patch), "Hole pattern updated.");

  const updateGroup = (patch) => updateSelectedObject((objectId) => api.updateGroup(objectId, patch), "Group updated.");

  const updateAssembly = (patch) => updateSelectedObject((objectId) => api.updateAssembly(objectId, patch), "Assembly updated.");

  const updateObjectPattern = (patch) => updateSelectedObject((objectId) => api.updateObjectPattern(objectId, patch), "Object pattern updated.");

  const updateInterface = (patch) => updateSelectedObject((objectId) => api.updateInterface(objectId, patch), "Interface updated.");

  const updateConnectionZone = (patch) => updateSelectedObject((objectId) => api.updateConnectionZone(objectId, patch), "Connection zone updated.");

  const updatePlate = (operation) => updateSelectedObject(operation, "Plate updated.");

  const updateFeature = (operation) => updateSelectedObject(operation, "Feature updated.");

  const updateFeaturePatch = (patch) => updateFeature((featureId) => api.updateFeature(featureId, patch));

  const updateFeatureBody = (patch) => updateFeature((featureId) => api.setFeatureBody(featureId, patch));

  const updateTrimOperation = (operationId, patch) => {
    updateSelectedObject((trimJointId) => api.updateTrimJointOperation(trimJointId, operationId, patch), "Trim operation updated.");
  };

  const setTrimOperationType = (operationId, type) => {
    if (!selectedObjectId || !operationId) return;
    const trimJoint = api.project().model.trimJoints?.[selectedObjectId];
    if (!trimJoint) {
      setMessage(`Trim joint not found: ${selectedObjectId}`, "error");
      return;
    }
    const operation = trimOperationById(trimJoint, operationId);
    if (!operation) {
      setMessage(`Trim operation not found: ${operationId}`, "error");
      return;
    }
    const patch = trimOperationSupportsGap(type) ? { type } : { type, gap: 0 };
    if (type === "plane-trim") {
      const referencePlaneIds = trimOperationReferencePlaneIds(operation);
      if (!referencePlaneIds.length) {
        setMessage("Plane trim requires planes picked from the Trim editor.", "error");
        return;
      }
      patch.memberBId = undefined;
      patch.memberBEnd = undefined;
      patch.miterMode = undefined;
      patch.referencePlaneIds = referencePlaneIds;
      patch.removedRegionKeys = reconcilePlaneTrimRemovedRegionKeys(operation, referencePlaneIds);
    } else {
      patch.referencePlaneIds = undefined;
      patch.removedRegionKeys = undefined;
      if (trimOperationUsesMemberB(type)) {
        const memberBId = operation.memberBId || arrayValues(trimJoint.participants).find((participant) => participant.memberId !== operation.memberAId)?.memberId;
        if (!memberBId) {
          setMessage(`${trimOperationLabel(type)} requires a second member.`, "error");
          return;
        }
        patch.memberBId = memberBId;
      } else {
        patch.memberBId = undefined;
      }
      patch.miterMode = type === "end-miter" ? operation.miterMode || "equal-angle" : undefined;
    }
    if (!trimOperationUsesMemberEnd(type, "memberA")) patch.memberAEnd = undefined;
    if (!trimOperationUsesMemberEnd(type, "memberB")) patch.memberBEnd = undefined;
    updateSelectedObject((trimJointId) => api.updateTrimJointOperation(trimJointId, operationId, patch), `${trimOperationLabel(type)} selected.`);
  };

  const removeMemberRelation = (relationId) => {
    updateMember(() => api.deleteRelation(relationId));
  };

  const memberCustomProfileDraft = (memberId) => memberCustomProfileDrafts.get(memberId) || DEFAULT_CUSTOM_PROFILE_POINTS;

  const setMemberCustomProfileDraft = (memberId, value) => {
    if (!memberId) return;
    memberCustomProfileDrafts.set(memberId, String(value || ""));
  };

  const createCustomProfile = (memberId = selectedMemberId) => {
    if (!memberId) return;
    const id = `custom_section_${Date.now()}`;
    const outline = parsePointList(memberCustomProfileDraft(memberId));
    if (outline.length < 3) {
      setMessage("Custom section needs at least three [y,z] points.", "error");
      return;
    }
    try {
      api.createCustomProfile({
        id,
        designation: id,
        outline
      });
      const nextProject = api.setMemberProfile(memberId, id);
      applyProjectChange(nextProject, { memberId });
      setMessage(`Created ${id}.`, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const setMemberAlignment = (source) => {
    updateMember((memberId) => api.setMemberAlignment(memberId, source));
  };

  const clearMemberAlignment = () => {
    updateMember((memberId) => api.clearMemberAlignment(memberId));
  };

  const beginAlignmentAxisPick = () => {
    if (!selectedMemberId) return;
    selection.beginObjectPick({
      count: 1,
      objectIdFromFace,
      onComplete: ([objectId]) => {
        const entry = api.project().objectIndex?.[objectId];
        if (entry?.collection !== "members") {
          setMessage("Pick a member axis.", "error");
          return;
        }
        if (objectId === selectedMemberId) {
          setMessage("Pick another member as the custom axis.", "error");
          return;
        }
        setMemberAlignment({ type: "member-axis", memberId: objectId, label: `Axis: ${objectId}` });
      },
      onError: () => setMessage("Pick a member axis.", "error")
    });
    setMessage("Pick a member axis for alignment.", "ok");
  };

  const deleteSmartComponent = (smartComponentId = selectedSmartComponentId) => {
    if (!smartComponentId) return;
    try {
      const deletedId = smartComponentId;
      const nextProject = api.deleteSmartComponent(deletedId);
      setSelectedState();
      clearMemberEditSilently();
      selection.clear();
      clearObjectWindow();
      applyProjectChange(nextProject);
      onSmartComponentDeleted?.(deletedId);
      setMessage(`Deleted ${deletedId}.`, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const activePropertiesPanel = () => {
    if (selectedMemberId) return memberPropertiesPanel();
    if (selectedSmartComponentId) return smartComponentPropertiesPanel();
    if (selectedObjectId) return objectPropertiesPanel();
    if (gridEditorEmpty) return gridEditorEmptyPropertiesPanel();
    const activeTool = activeToolPropertiesPanel();
    if (activeTool) return activeTool;
    if (sceneSelected) return viewPropertiesPanel();
    return null;
  };

  const viewPropertiesPanel = () => {
    const project = api.project();
    const points = sceneReferencePoints(project);
    const bounds = points.length ? bounds3(points) : null;
    return generatedPropertiesPanel({
      title: "View Properties",
      context: inspectorViewContext({ pointCount: points.length }),
      sections: bindGeneratedPropertySections(inspectorViewPropertySections({
        project,
        bounds,
        counts: sceneCollectionCounts(project),
        pointCount: points.length
      }), generatedReferenceBindings())
    });
  };

  const gridEditorEmptyPropertiesPanel = () => generatedPropertiesPanel({
    context: {
      title: "Grid Editor",
      subtitle: "No grid systems are defined in this project.",
      icon: "grid"
    },
    sections: bindGeneratedPropertySections([
      {
        id: "inspector.properties.gridEditor.empty",
        label: "Grid Systems",
        fields: [
          {
            type: "message",
            state: "help",
            value: "Create the first grid system here, then edit axes and levels in this panel."
          },
          {
            type: "action",
            label: "Add Grid System",
            icon: "grid",
            action: "gridSystem.add"
          }
        ]
      }
    ], generatedSupportObjectBindings()),
    emptyMessage: "No grid systems are defined in this project."
  });

  const activeToolPropertiesPanel = () => {
    const commandState = app?.commandState?.() || {};
    if (!commandState.activeCommandId) return null;
    const command = MODELING_TOOL_COMMAND_BY_ID.get(commandState.activeCommandId);
    if (!command) return null;
    const snapSettings = app?.snapSettings?.() || {};
    const activeToolSections = inspectorActiveToolSections({
      command,
      commandState,
      toolState: app?.activeToolState?.() || {},
      snapSettings,
      selectionState: app?.selectionState?.() || {},
      canCycleSnap: true,
      canOpenSnapSettings: true,
      canSnapStrengthChange: true,
      canSnapScopeChange: true,
      canSnapTargetChange: true,
      canCancel: true
    });
    return generatedPropertiesPanel({
      title: "Active Tool",
      context: inspectorActiveToolContext({ command }),
      sections: bindGeneratedPropertySections(activeToolSections, generatedActiveToolBindings()),
      emptyMessage: "Use the canvas to complete the active tool."
    });
  };

  const memberPropertiesPanel = () => {
    const member = api.member(selectedMemberId);
    if (!member) return generatedPropertiesPanel({ emptyMessage: "Selected member is no longer in the project." });
    const center = memberCenter(member);
    const axis = memberAxisData(member);
    const relations = api.memberAxisRelations(member.id);
    const pointRelations = relations
      .filter((relation) => relation.type === "point-on-axis")
      .map((relation) => ({ id: relation.id, label: axisRelationLabel(relation) }));
    const alignment = relations.find((relation) => relation.type === "member-align-axis");
    const alignmentLabel = alignment ? axisRelationLabel(alignment) : "None";
    return generatedPropertiesPanel({
      context: inspectorMemberContext({ memberId: selectedMemberId, member }),
      sections: bindGeneratedPropertySections([
        inspectorMemberIdentitySection({
          memberId: selectedMemberId,
          member,
          lengthText: axis ? `${inspectorFormatNumber(axis.length)} mm` : "-"
        }),
        ...inspectorMemberEditSections({
          memberId: selectedMemberId,
          member,
          profileOptions: profileOptions(api.profiles?.() || profiles),
          materialOptions: materialOptions(api.materials?.() || materials, member.material),
          center,
          alignmentLabel,
          hasAlignment: Boolean(alignment),
          worldAxisIds: WORLD_AXIS_IDS
        }),
        ...inspectorMemberAdvancedSections({
          memberId: selectedMemberId,
          customProfileValue: memberCustomProfileDraft(selectedMemberId),
          pointRelations,
          alignmentLabel
        })
      ], generatedMemberBindings())
    });
  };

  const updateSmartComponentParameter = (smartComponentId, definition, path, value) => {
    try {
      if (!definition) throw new Error(`Smart Component definition not found: ${smartComponentId}`);
      const smartComponent = api.smartComponent(smartComponentId);
      const parameters = clone(smartComponent.referenceParameters || {});
      setPath(parameters, path, value, definition.type);
      applyProjectChange(api.updateSmartComponent(smartComponentId, parameters));
      setMessage("Smart Component updated.", "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateSmartComponentById = (smartComponentId, update, message) => {
    if (!smartComponentId) return;
    try {
      applyProjectChange(update(smartComponentId));
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateSelectedSmartComponent = (update, message) => {
    updateSmartComponentById(selectedSmartComponentId, update, message);
  };

  const updateSmartComponentObjectLifecycle = (smartComponentId, objectId, update, message, options = {}) => {
    try {
      const nextProject = update(smartComponentId, objectId);
      applyProjectChange(nextProject);
      if (options.selectComponent || !nextProject.objectIndex?.[selectedObjectId]) {
        setSelectedState({ smartComponentId });
        selection.clear();
        clearObjectWindow();
        onSmartComponentSelected?.(smartComponentId, { inspectorPanel: "component" });
      }
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const resetSmartComponentObjectOverrides = (smartComponentId, objectId) => {
    updateSmartComponentObjectLifecycle(
      smartComponentId,
      objectId,
      (componentId, managedObjectId) => api.resetSmartComponentObjectOverrides(componentId, managedObjectId),
      "Overrides reset."
    );
  };

  const detachSmartComponentObject = (smartComponentId, objectId) => {
    updateSmartComponentObjectLifecycle(
      smartComponentId,
      objectId,
      (componentId, managedObjectId) => api.detachSmartComponentObject(componentId, managedObjectId),
      "Object detached."
    );
  };

  const reattachSmartComponentObject = (smartComponentId, objectId) => {
    updateSmartComponentObjectLifecycle(
      smartComponentId,
      objectId,
      (componentId, managedObjectId) => api.reattachSmartComponentObject(componentId, managedObjectId),
      "Object reattached.",
      { selectComponent: true }
    );
  };

  const resolveSmartComponentDiagnostics = (smartComponentId = selectedSmartComponentId) => {
    updateSmartComponentById(
      smartComponentId,
      (smartComponentId) => api.resolveSmartComponentDiagnostics(smartComponentId),
      "Diagnostics resolved."
    );
  };

  const smartComponentCapabilities = () => ({
    resetObjectOverrides: typeof api.resetSmartComponentObjectOverrides === "function",
    detachObject: typeof api.detachSmartComponentObject === "function",
    reattachObject: typeof api.reattachSmartComponentObject === "function",
    resolveDiagnostics: typeof api.resolveSmartComponentDiagnostics === "function",
    deleteSmartComponent: typeof api.deleteSmartComponent === "function"
  });

  const smartComponentLiveRoleOptions = (smartComponentId) => typeof api.smartComponentRoleOptions === "function"
    ? api.smartComponentRoleOptions(smartComponentId)
    : [];

  const smartComponentDefinitionOrNull = (smartComponentId) => {
    try {
      return api.definition(smartComponentId);
    } catch {
      return null;
    }
  };

  const smartComponentObjectIndex = () => api.project().objectIndex || {};

  const objectGeneratedByCapabilities = () => ({
    resetObjectOverrides: typeof api.resetSmartComponentObjectOverrides === "function",
    detachObject: typeof api.detachSmartComponentObject === "function",
    reattachObject: typeof api.reattachSmartComponentObject === "function"
  });

  const smartComponentPropertiesPanel = () => {
    const smartComponent = api.smartComponent(selectedSmartComponentId);
    if (!smartComponent) return generatedPropertiesPanel({ emptyMessage: "Selected Smart Component is no longer in the project." });
    const definition = smartComponentDefinitionOrNull(selectedSmartComponentId);
    const diagnosticsSummary = inspectorSmartComponentDiagnosticsSummary(smartComponent);
    const preview = definition
      ? smartComponentPreviewState(selectedSmartComponentId, smartComponent)
      : { state: "unavailable", reason: "Smart Component definition is not registered." };
    return generatedPropertiesPanel({
      context: inspectorSmartComponentContext({
        smartComponentId: selectedSmartComponentId,
        smartComponent,
        diagnosticsSummary
      }),
      sections: bindGeneratedPropertySections(inspectorSmartComponentPropertySections({
        smartComponentId: selectedSmartComponentId,
        smartComponent,
        definition,
        diagnosticsSummary,
        preview,
        quickParameterFields: definition ? smartComponentQuickParameterFields({
          api,
          smartComponent,
          definition,
          labelFor: inspectorMetadataLabel,
          catalogOptions: (catalog, currentId) => catalogOptions(api, catalog, String(currentId || ""))
        }) : [],
        liveRoleOptions: definition ? smartComponentLiveRoleOptions(selectedSmartComponentId) : [],
        objectIndex: smartComponentObjectIndex(),
        capabilities: { ...smartComponentCapabilities(), openParameters: Boolean(definition) }
      }), generatedSmartComponentBindings())
    });
  };

  const smartComponentPreviewState = (smartComponentId, smartComponent) => {
    const key = smartComponentPreviewKey(smartComponentId, smartComponent);
    if (smartComponentPreviewResults.has(key)) return smartComponentPreviewResults.get(key);
    if (!previewService?.resolveSmartComponentInstancePreview) {
      return { state: "unavailable", reason: "Preview service is unavailable." };
    }
    if (!smartComponentPreviewRequests.has(key)) {
      smartComponentPreviewRequests.add(key);
      previewService.resolveSmartComponentInstancePreview({ smartComponentId })
        .then((result) => {
          smartComponentPreviewResults.set(key, result || { state: "unavailable", reason: "Preview is unavailable." });
          smartComponentPreviewRequests.delete(key);
          if (selectedSmartComponentId === smartComponentId) render();
        })
        .catch((error) => {
          smartComponentPreviewResults.set(key, { state: "unavailable", reason: error?.message || "Preview is unavailable." });
          smartComponentPreviewRequests.delete(key);
          if (selectedSmartComponentId === smartComponentId) render();
        });
    }
    return { state: "pending", reason: "Generating preview." };
  };

  const smartComponentPreviewKey = (smartComponentId, smartComponent = {}) => JSON.stringify([
    smartComponentId,
    smartComponent?.sourceComponent?.id,
    smartComponent?.health,
    smartComponent?.ownedObjectIds,
    smartComponent?.objectRoles,
    smartComponent?.detachedObjectIds,
    smartComponent?.suppressedRoles,
    smartComponent?.suppressedPatternPositions,
    smartComponent?.referenceParameters,
    smartComponent?.diagnostics
  ]);

  const objectPropertiesPanel = () => {
    const project = api.project();
    const entry = project.objectIndex?.[selectedObjectId];
    if (!entry?.collection) return generatedPropertiesPanel({ emptyMessage: "Selected object is no longer in the project." });
    const object = api.object(selectedObjectId);
    const smartComponent = api.smartComponentForObject(selectedObjectId);
    const rootSmartComponent = api.smartComponentRootForObject(selectedObjectId);
    return generatedPropertiesPanel({
      context: inspectorObjectContext({ objectId: selectedObjectId, entry, object }),
      sections: bindGeneratedPropertySections([
        inspectorObjectIdentitySection({ objectId: selectedObjectId, entry, object }),
        inspectorObjectGeneratedBySection({
          smartComponent,
          rootSmartComponent,
          objectId: selectedObjectId,
          objectIndex: project.objectIndex || {},
          capabilities: objectGeneratedByCapabilities()
        }),
        ...objectPropertySections(entry, object),
      ].filter(Boolean), generatedObjectBindings())
    });
  };

  const objectPropertyState = (entry, object) => {
    if (entry.collection === "plates") {
      return {
        definition: plateSketchDefinitionStatus(object),
        outlineVertices: sketchPlateOutline(object).length,
        bends: plateBends(object).map((bend) => ({
          ...bend,
          targetLabel: generatedPlateBendTargetLabel(object, bend)
        }))
      };
    }
    if (entry.collection === "sketches") {
      return {
        definition: sketchDefinitionStatus(object.sketch),
        outlineVertices: sketchPlateOutline(object).length
      };
    }
    return {};
  };

  const generatedPlateBendTargetLabel = (plate, bend) => {
    if (!bend) return "-";
    if (bend.parentBendId) return `${bend.parentBendId} / ${bend.parentEdge || "outer"}`;
    const edges = [...sketchEdges(plate?.sketch), ...sketchConstructionEdges(plate?.sketch)];
    const index = edges.findIndex((edge) => edge.id === bend.edgeId);
    return index >= 0 ? `${index + 1}. ${bend.edgeId}` : bend.edgeId || "-";
  };

  const objectPropertySections = (entry, object) => {
    const objectSections = inspectorObjectPropertySections({
      collection: entry.collection,
      object,
      objectId: selectedObjectId,
      objectDetail: selectedObjectDetail,
      objectState: objectPropertyState(entry, object),
      catalogEntries: (catalog) => api.catalogEntries?.(catalog) || {},
      catalogOptions: (catalog, currentId) => catalogOptions(api, catalog, String(currentId || "")),
      fastenerLengthOptions: (fastenerRef, currentLength) => fastenerLengthOptions(api, fastenerRef, currentLength)
    });
    if (objectSections.length) {
      return entry.collection === "plates"
        ? [...objectSections, plateEditor(object)].filter(Boolean)
        : objectSections;
    }
    const supportSections = inspectorSupportObjectPropertySections({
      collection: entry.collection,
      object,
      actions: {
        project: api.project(),
        objectIndex: api.project().objectIndex,
        updateWorkPoint,
        addGridSystem,
        updateGridSystem,
        addGridAxis,
        removeGridAxis,
        updateGridLevel,
        addGridLevel,
        updateLevel,
        updateReferencePlane,
        updateInterface,
        updateConnectionZone,
        updateAssembly,
        updateGroup,
        updateHolePattern,
        updateObjectPattern,
        selectObjectReference,
        focusObjectReference
      }
    });
    if (supportSections.length) {
      return bindGeneratedPropertySections(supportSections, generatedSupportObjectBindings());
    }
    return [];
  };

  function render() {
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) setSelectedState({ scene: true });
    if (selectedSmartComponentId && !api.project().model.smartComponentInstances?.[selectedSmartComponentId]) setSelectedState({ scene: true });
    if (selectedObjectId && !api.project().objectIndex?.[selectedObjectId]) setSelectedState({ scene: true });

    const message = panelMessage.hasMessage() ? panelMessage.element() : null;

    panel.classList.add("bc-inspector");

    const properties = activePropertiesPanel();

    panel.hidden = false;
    panel.replaceChildren(...[properties, message].filter(Boolean));
  }

  const unsubscribe = api.subscribe(render);
  render();
  return {
    refresh() {
      render();
    },
    clearSelection(options = {}) {
      clearCurrentSelection(options);
    },
    selectMember,
    selectSmartComponent,
    selectObject,
    selectScene,
    openGridEditor,
    selectedState() {
      return {
        memberId: selectedMemberId,
        smartComponentId: selectedSmartComponentId,
        objectId: selectedObjectId,
        objectDetail: selectedObjectDetail,
        scene: sceneSelected
      };
    },
    destroy() {
      unsubscribe();
    }
  };
}

function parsePointList(value) {
  return truthyValues(String(value || "")
    .split(/\r?\n|;/)
    .map((line) => line.trim()))
    .map((line) => line.split(/[\s,]+/).map(Number))
    .filter((point) => point.length === 2 && point.every(finiteNumber));
}
