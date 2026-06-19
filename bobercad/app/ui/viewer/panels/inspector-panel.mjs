import { WORLD_AXIS_DIRECTIONS, WORLD_AXIS_IDS, finiteNumber, finitePositiveNumber } from "../../../engine/core/math.mjs?v=world-axis-dry-1";
import { arrayValues, jsonClone as clone, truthyValues } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";
import { axisRelationLabel } from "../../../engine/api/project/axis-relations.mjs?v=array-values-dry-1";
import { memberAxisData, memberCenter } from "../../../engine/api/project/members.mjs?v=generated-properties-1";
import { plateBends, plateOutline as sketchPlateOutline, plateSketchDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDefinitionStatus, sketchDistanceRelationMode, sketchEdges, sketchLengthRelationMode, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchVertices } from "../../../engine/api/project/plate-sketch-relations-and-bends.mjs?v=plate-relation-preflight-1";
import { trimOperationById, trimOperationReferencePlaneIds, trimOperationUsesMemberB, trimOperationUsesMemberEnd } from "../../../engine/api/project/trim-operations.mjs?v=generated-trim-properties-1";
import { reconcilePlaneTrimRemovedRegionKeys } from "../../../engine/api/model/trim-region-keys.mjs?v=generated-trim-properties-1";
import { setPath } from "../../../engine/modules/smart-components/smart-component-parameters-and-definition.mjs?v=smart-component-quick-properties-1";
import { parameterFieldDescriptor, uiQuickParameterEntries } from "../../../../data/libraries/smart-components/parameter-values.mjs?v=smart-component-generated-fields-1";
import { MODELING_TOOLBAR_COMMANDS } from "../../commands/command-registry.mjs?v=top-nav-commands-1";
import { trimOperationLabel, trimOperationSupportsGap } from "../../commands/trim-operation-metadata.mjs?v=generated-trim-properties-1";
import {
  inspectorActiveToolContext,
  inspectorActiveToolSections,
  inspectorEmptySelectionContext,
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
  inspectorPrimaryActions,
  inspectorSelectionQuickActions,
  inspectorSmartComponentContext,
  inspectorSmartComponentDiagnosticsSummary,
  inspectorSmartComponentPropertySections,
  inspectorSupportObjectPropertySections
} from "../../commands/inspector-property-metadata.mjs?v=inspector-property-metadata-1";
import { button, createPanelMessageState, quickActions, text } from "./panel-elements.mjs?v=panel-primitives-1";
import { generatedPropertiesPanel } from "./generated-properties-panel.mjs?v=generic-status-fields-1";
import { bindGeneratedPropertySections } from "./generated-property-bindings.mjs?v=generated-property-bindings-1";
import { createInspectorPropertyBindings } from "./inspector-property-bindings.mjs?v=plate-relation-fields-1";

const SMART_COMPONENT_QUICK_PARAMETER_LIMIT = 6;
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

function sameSketchPoint(a, b, tolerance = 1e-6) {
  return Array.isArray(a) && Array.isArray(b)
    && Math.abs((a[0] || 0) - (b[0] || 0)) <= tolerance
    && Math.abs((a[1] || 0) - (b[1] || 0)) <= tolerance;
}

function sketchVertexPointMap(sketch) {
  return new Map([...sketchVertices(sketch), ...sketchConstructionVertices(sketch)].map((vertex) => [vertex.id, vertex.point]));
}

function sketchEdgePoints(sketch, edgeId) {
  const edge = [...sketchEdges(sketch), ...sketchConstructionEdges(sketch)].find((item) => item.id === edgeId);
  const vertexMap = sketchVertexPointMap(sketch);
  const from = edge ? vertexMap.get(edge.from) : null;
  const to = edge ? vertexMap.get(edge.to) : null;
  return from && to ? { from, to } : null;
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
  const memberCustomProfileDrafts = new Map();
  const panelMessage = createPanelMessageState(() => render(), "Pick a member, Smart Component, trim, or cut object.");
  const setMessage = panelMessage.set;
  const showError = (error) => setMessage(error.message, "error");

  const connectedMemberObjectIds = (memberId) => api.memberDependencyObjectIds(memberId, { renderableOnly: true });

  const clearObjectWindow = () => onObjectCleared?.();
  const clearMemberEditSilently = () => memberEdit?.clear({ notify: false });
  const clearCurrentSelection = (options = {}) => {
    setSelectedState();
    if (!options.fromMemberEdit) clearMemberEditSilently();
    selection.clear();
    clearObjectWindow();
    if (options.silent) render();
    else setMessage("Selection cleared.");
  };

  const setSelectedState = ({ memberId = null, smartComponentId = null, objectId = null, objectDetail = null } = {}) => {
    selectedMemberId = memberId;
    selectedSmartComponentId = smartComponentId;
    selectedObjectId = objectId;
    selectedObjectDetail = objectDetail;
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
    bindActionButtons,
    bindQuickActions,
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
      openTrimEditor: (objectId, detail) => onObjectSelected?.(objectId, { ...(detail || {}), inspectorPanel: "trim" }),
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
      openTrimEditor: (objectId, detail) => onObjectSelected?.(objectId, { ...(detail || {}), inspectorPanel: "trim" }),
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

  const selectionQuickActions = () => {
    const project = api.project();
    const actions = inspectorSelectionQuickActions({
      memberId: selectedMemberId,
      smartComponentId: selectedSmartComponentId,
      objectId: selectedObjectId,
      objectDetail: selectedObjectDetail || {},
      entry: selectedObjectId ? project.objectIndex?.[selectedObjectId] : null,
      rootSmartComponent: selectedObjectId ? api.smartComponentRootForObject(selectedObjectId) : null
    });
    return quickActions(bindQuickActions(actions), { label: "Selection quick actions" });
  };

  const inspectorActionButton = (action) => button(
    action.label,
    [
      "bc-button",
      action.primary ? "bc-button-primary" : "",
      action.danger ? "bc-button-danger" : ""
    ].filter(Boolean).join(" "),
    action.onClick,
    {
      icon: action.icon,
      title: action.title,
      pressed: action.pressed,
      disabled: action.disabled,
      disabledReason: action.disabledReason
    }
  );

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

  function inferPlateSketchRelations(plateId = selectedObjectId) {
    if (!plateId) return;
    try {
      applyProjectChange(api.inferPlateSketchRelations(plateId));
      selection.select([plateId]);
      setMessage("Plate updated.", "ok");
    } catch (error) {
      showError(error);
    }
  }

  function createPlateFromSketch(sketchId) {
    if (!sketchId) return;
    try {
      const result = api.createPlateFromSketch(sketchId, {
        id: `${sketchId}_plate`,
        thickness: 8
      });
      setSelectedState({ objectId: result.plateId, objectDetail: {} });
      applyProjectChange(result.project);
      selection.select([result.plateId]);
      setMessage(`Created ${result.plateId}.`, "ok");
    } catch (error) {
      showError(error);
    }
  }

  const updatePlateAndSelectRelation = (operation, relationId, message = "Plate updated.") => {
    if (!selectedObjectId) return;
    const plateId = selectedObjectId;
    try {
      const nextProject = operation(plateId);
      applyProjectChange(nextProject);
      const nextRelation = sketchRelations(nextProject.model?.plates?.[plateId]?.sketch)
        .find((relation) => relation.id === relationId);
      selectObject(plateId, nextRelation ? { relationId: nextRelation.id } : {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updatePlateAndSelectSketchDetail = (operation, detail = {}, message = "Plate updated.") => {
    if (!selectedObjectId) return;
    const plateId = selectedObjectId;
    try {
      const nextProject = operation(plateId);
      applyProjectChange(nextProject);
      selectObject(plateId, detail || {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updatePlateAndSelectRelationPatch = (operation, relationPatch, message = "Plate updated.", plateId = selectedObjectId) => {
    if (!plateId || !relationPatch) return;
    try {
      const nextProject = operation(plateId);
      applyProjectChange(nextProject);
      selection.select([plateId]);
      const nextPlate = nextProject.model?.plates?.[plateId];
      const relationKey = sketchRelationKey(relationPatch);
      const nextRelation = nextPlate
        ? sketchRelations(nextPlate.sketch).find((relation) => sketchRelationKey(relation) === relationKey)
        : null;
      selectObject(plateId, nextRelation ? { relationId: nextRelation.id } : {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const sketchRelationRemoveLabel = (relation) => (relation?.type === "fixed" ? "Unfix" : "Remove");
  const sketchRelationRemoveMessage = (relation) => (relation?.type === "fixed" ? "Sketch entity unfixed." : "Sketch relation removed.");

  const currentPlateSketchRelation = (plateId, relationId) => {
    if (!plateId || !relationId) return null;
    const plate = api.project().model?.plates?.[plateId];
    return sketchRelations(plate?.sketch).find((relation) => relation.id === relationId) || null;
  };

  const relationPayloadPlateId = (payload = {}) => payload.objectId || selectedObjectId;

  const relationFromPayload = (payload = {}) => (
    currentPlateSketchRelation(relationPayloadPlateId(payload), payload.relationId)
    || payload.relation
    || null
  );

  const setPlateSketchRelationValue = (value, commit = {}) => {
    const relation = relationFromPayload(commit);
    if (!relation) return;
    if (relation.type === "length") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchEdgeLength(plateId, relation.edgeId, value, { mode: "driving" }),
        relation.id,
        "Sketch dimension updated."
      );
    } else if (relation.type === "angle") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchEdgeAngle(plateId, relation.edgeIds, value, { mode: "driving", targetEdgeId: relation.edgeIds?.[1] }),
        relation.id,
        "Sketch dimension updated."
      );
    } else if (relation.type === "distance") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchPointDistance(plateId, relation.vertexIds, value, { mode: "driving", targetVertexId: relation.vertexIds?.[1] }),
        relation.id,
        "Sketch dimension updated."
      );
    }
  };

  const selectPlateSketchRelation = (payload = {}) => {
    const plateId = relationPayloadPlateId(payload);
    if (plateId && payload.relationId) selectObject(plateId, { relationId: payload.relationId });
  };

  const setPlateSketchRelationMode = (payload = {}) => {
    const relation = relationFromPayload(payload);
    const nextMode = payload.mode;
    if (!relation || !["driving", "driven"].includes(nextMode)) return;
    if (relation.type === "length") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchEdgeLengthMode(plateId, relation.edgeId, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    } else if (relation.type === "angle") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchEdgeAngleMode(plateId, relation.edgeIds, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    } else if (relation.type === "distance") {
      updatePlateAndSelectRelation(
        (plateId) => api.setPlateSketchPointDistanceMode(plateId, relation.vertexIds, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    }
  };

  const resolvePlateSketchRelation = (payload = {}) => {
    const relation = relationFromPayload(payload);
    if (!relation) return;
    resolveSketchRelation(
      relation,
      payload.relationMode || sketchRelationMode(relation),
      payload.healthStatus || sketchRelationHealthStatus(null),
      payload.detail || {}
    );
  };

  const removePlateSketchRelation = (payload = {}) => {
    const relation = relationFromPayload(payload);
    if (!relation) return;
    updatePlateAndSelectSketchDetail(
      (plateId) => api.removePlateSketchRelation(plateId, relation.id),
      payload.detail || {},
      sketchRelationRemoveMessage(relation)
    );
  };

  const addPlateSketchRelationFromPayload = (payload = {}) => {
    const relation = payload.relation;
    const plateId = payload.objectId || selectedObjectId;
    if (!plateId || !relation) return;
    if (relation.type === "length") {
      updatePlateAndSelectRelationPatch(
        (plateId) => api.setPlateSketchEdgeLengthMode(plateId, relation.edgeId, "driving"),
        { type: "length", edgeId: relation.edgeId },
        "Plate updated.",
        plateId
      );
      return;
    }
    if (relation.type === "angle") {
      updatePlateAndSelectRelationPatch(
        (plateId) => api.setPlateSketchEdgeAngleMode(plateId, relation.edgeIds, "driving"),
        { type: "angle", edgeIds: relation.edgeIds },
        "Plate updated.",
        plateId
      );
      return;
    }
    if (relation.type === "distance") {
      updatePlateAndSelectRelationPatch(
        (plateId) => api.setPlateSketchPointDistanceMode(plateId, relation.vertexIds, "driving"),
        { type: "distance", vertexIds: relation.vertexIds },
        "Plate updated.",
        plateId
      );
      return;
    }
    updatePlateAndSelectRelationPatch(
      (plateId) => api.upsertPlateSketchRelation(plateId, relation),
      relation,
      "Plate updated.",
      plateId
    );
  };

  const addPlateSketchConstructionLineFromPayload = (payload = {}) => {
    const plateId = payload.objectId || selectedObjectId;
    const { from, to } = payload;
    if (!plateId || !Array.isArray(from) || !Array.isArray(to)) return;
    try {
      const nextProject = api.addPlateSketchConstructionLine(plateId, from, to);
      applyProjectChange(nextProject);
      const nextEdges = sketchConstructionEdges(nextProject.model?.plates?.[plateId]?.sketch);
      const nextVertexMap = sketchVertexPointMap(nextProject.model?.plates?.[plateId]?.sketch);
      const newEdge = [...nextEdges].reverse().find((edge) => {
        const edgeFrom = nextVertexMap.get(edge.from);
        const edgeTo = nextVertexMap.get(edge.to);
        return (sameSketchPoint(edgeFrom, from) && sameSketchPoint(edgeTo, to))
          || (sameSketchPoint(edgeFrom, to) && sameSketchPoint(edgeTo, from));
      });
      selectObject(plateId, newEdge ? { edgeIds: [newEdge.id] } : {});
      setMessage("Plate updated.", "ok");
    } catch (error) {
      showError(error);
    }
  };

  const fixPlateSketchUnderDefinedEntities = (payload = {}) => {
    updatePlateAndSelectSketchDetail(
      (plateId) => api.fixPlateSketchUnderDefinedEntities(plateId),
      payload.detail || {},
      "Under-defined sketch entities fixed."
    );
  };

  const removePlateSketchFixedRelations = (payload = {}) => {
    updatePlateAndSelectSketchDetail(
      (plateId) => api.removePlateSketchFixedRelations(plateId),
      payload.detail || {},
      "Fixed sketch relations removed."
    );
  };

  const sketchRelationMode = (relation) => (
    relation.type === "angle"
      ? sketchAngleRelationMode(relation)
      : relation.type === "distance"
        ? sketchDistanceRelationMode(relation)
        : sketchLengthRelationMode(relation)
  );

  const sketchRelationHealthStatus = (health) => health?.status === "driven" ? "reference" : health?.status;

  const sketchRelationTargetText = (relation, relationMode = sketchRelationMode(relation)) => (
    relation.type === "length"
      ? `${relation.edgeId} (${relationMode === "driven" ? `reference ${relation.value} mm` : "driving"})`
      : relation.type === "angle"
        ? `${(relation.edgeIds || []).join(" + ")} (${relationMode === "driven" ? `reference ${relation.value} deg` : "driving"})`
      : relation.type === "distance"
        ? `${(relation.vertexIds || []).join(" + ")} (${relationMode === "driven" ? `reference ${relation.value} mm` : "driving"})`
      : relation.type === "point-on-line"
        ? `${relation.vertexId} on ${relation.edgeId}`
      : relation.type === "midpoint"
        ? `${relation.vertexId} midpoint ${relation.edgeId}`
      : relation.type === "symmetric"
        ? `${(relation.vertexIds || []).join(" + ")} about ${relation.edgeId}`
      : relation.edgeId || (relation.edgeIds || []).join(" + ") || (relation.vertexIds || []).join(" + ") || "-"
  );

  const sketchRelationEntityText = (relation) => {
    const vertices = sketchRelationVertexIds(relation);
    const edges = sketchRelationEdgeIds(relation);
    return [
      vertices.length ? `vertices ${vertices.join(", ")}` : "",
      edges.length ? `edges ${edges.join(", ")}` : ""
    ].filter(Boolean).join("; ") || "-";
  };

  const sketchRelationStatusText = (health, relationMode) => {
    const status = sketchRelationHealthStatus(health);
    if (status === "conflicted") return "Conflicted";
    if (status === "redundant") return "Redundant";
    if (status === "reference") return "Reference";
    if (relationMode === "driven") return "Reference";
    return "OK";
  };

  const sketchRelationSortWeight = (relation, relationHealth) => {
    const status = sketchRelationHealthStatus(relationHealth[relation.id]);
    if (status === "conflicted") return 0;
    if (status === "redundant") return 1;
    if (status === "reference") return 3;
    return 2;
  };

  const sketchRelationGroupStatus = (relation, relationHealth) => {
    const status = sketchRelationHealthStatus(relationHealth[relation.id]);
    if (status === "conflicted" || status === "redundant" || status === "reference") return status;
    return sketchRelationMode(relation) === "driven" ? "reference" : "driving";
  };

  const sketchRelationGroupLabel = (status) => {
    if (status === "conflicted") return "Conflicted relations";
    if (status === "redundant") return "Redundant relations";
    if (status === "reference") return "Reference dimensions";
    return "Driving / active relations";
  };

  const groupedSketchRelations = (relations, relationHealth) => {
    const buckets = new Map();
    for (const relation of sortedSketchRelations(relations, relationHealth)) {
      const status = sketchRelationGroupStatus(relation, relationHealth);
      if (!buckets.has(status)) buckets.set(status, []);
      buckets.get(status).push(relation);
    }
    return ["conflicted", "redundant", "driving", "reference"]
      .filter((status) => buckets.has(status))
      .map((status) => ({ status, label: sketchRelationGroupLabel(status), relations: buckets.get(status) }));
  };

  const sortedSketchRelations = (relations, relationHealth) => relations
    .map((relation, index) => ({ relation, index, weight: sketchRelationSortWeight(relation, relationHealth) }))
    .sort((a, b) => a.weight - b.weight || a.index - b.index)
    .map((item) => item.relation);

  const resolveSketchRelation = (relation, relationMode, healthStatus, relationDetail = {}) => {
    if (healthStatus === "conflicted") {
      updatePlateAndSelectRelation(
        (plateId) => api.solvePlateSketchRelation(plateId, relation.id),
        relation.id,
        "Sketch relation resolved."
      );
      return;
    }
    if (healthStatus === "redundant" && relationMode === "driving") {
      if (relation.type === "length") {
        updatePlateAndSelectRelation(
          (plateId) => api.setPlateSketchEdgeLengthMode(plateId, relation.edgeId, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
      if (relation.type === "angle") {
        updatePlateAndSelectRelation(
          (plateId) => api.setPlateSketchEdgeAngleMode(plateId, relation.edgeIds, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
      if (relation.type === "distance") {
        updatePlateAndSelectRelation(
          (plateId) => api.setPlateSketchPointDistanceMode(plateId, relation.vertexIds, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
    }
    updatePlateAndSelectSketchDetail(
      (plateId) => api.removePlateSketchRelation(plateId, relation.id),
      relationDetail,
      "Sketch relation removed."
    );
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

  const plateEditor = (plate) => {
    const definition = plateSketchDefinitionStatus(plate);
    const fields = [];
    const outlineEdges = sketchEdges(plate.sketch);
    const constructionEdges = sketchConstructionEdges(plate.sketch);
    const edgeById = new Map([...outlineEdges, ...constructionEdges].map((edge, index) => [edge.id, { edge, index }]));
    const relations = sketchRelations(plate.sketch);
    const fixedRelations = relations.filter((relation) => relation.type === "fixed");
    const relationHealth = plateSketchRelationHealth(plate);
    const activeRelationId = selectedObjectId === plate.id ? selectedObjectDetail?.relationId || null : null;
    const activeRelation = activeRelationId ? sketchRelations(plate.sketch).find((relation) => relation.id === activeRelationId) || null : null;
    const activeEdgeIds = selectedObjectId === plate.id ? arrayValues(selectedObjectDetail?.edgeIds).filter(Boolean).slice(0, 2) : [];
    const activeVertexIds = selectedObjectId === plate.id ? arrayValues(selectedObjectDetail?.vertexIds).filter(Boolean).slice(0, 2) : [];
    const constructionEdgeIds = new Set(constructionEdges.map((edge) => edge.id));
    const canConstrainVertexToEdge = (vertexId, edgeId) => {
      const edge = edgeById.get(edgeId)?.edge;
      return Boolean(edge && edge.from !== vertexId && edge.to !== vertexId);
    };

    const relationSelectionDetail = (relation) => {
      const edgeIds = sketchRelationEdgeIds(relation).filter(Boolean);
      const vertexIds = new Set(sketchRelationVertexIds(relation).filter(Boolean));
      for (const edgeId of edgeIds) {
        const edge = edgeById.get(edgeId)?.edge;
        if (!edge) continue;
        if (edge.from) vertexIds.add(edge.from);
        if (edge.to) vertexIds.add(edge.to);
      }
      return { edgeIds, vertexIds: [...vertexIds] };
    };

    const underDefinedInspector = () => {
      const underEdges = arrayValues(definition.underDefinedEdgeIds).filter(Boolean);
      const underVertices = arrayValues(definition.underDefinedVertexIds).filter(Boolean);
      if (!underEdges.length && !underVertices.length) return null;
      const rowDescriptor = (id, detail, relation) => ({
        id,
        label: id,
        actions: [
          {
            label: "Select",
            action: "object.plate.relations.toggle",
            title: `Select ${id} in the 3D sketch overlay.`,
            payload: { objectId: plate.id, detail }
          },
          {
            label: "Fix",
            action: "object.plate.sketchRelation.add",
            title: "Fix this entity at its current sketch position.",
            payload: { objectId: plate.id, relation }
          }
        ]
      });
      return {
        type: "statusListCard",
        title: "Under-defined entities",
        status: "redundant",
        actions: [{
          label: "Fix remaining",
          primary: true,
          action: "object.plate.sketchUnderDefined.fixRemaining",
          title: `Fix ${underEdges.length} edge${underEdges.length === 1 ? "" : "s"} and ${underVertices.length} ${underVertices.length === 1 ? "vertex" : "vertices"} at their current sketch positions.`,
          payload: { objectId: plate.id, detail: {} }
        }],
        groups: [
          underEdges.length ? {
            label: "Edges",
            value: underEdges.length,
            rows: underEdges.slice(0, 8).map((edgeId) => rowDescriptor(edgeId, { edgeIds: [edgeId] }, { type: "fixed", edgeId })),
            moreText: underEdges.length > 8 ? `+${underEdges.length - 8} more edges` : ""
          } : null,
          underVertices.length ? {
            label: "Vertices",
            value: underVertices.length,
            rows: underVertices.slice(0, 8).map((vertexId) => rowDescriptor(vertexId, { vertexIds: [vertexId] }, { type: "fixed", vertexId })),
            moreText: underVertices.length > 8 ? `+${underVertices.length - 8} more vertices` : ""
          } : null
        ].filter(Boolean),
        diagnostic: "Select an entity to inspect it, or Fix it at its current sketch position."
      };
    };

    const relationRemoveLabel = sketchRelationRemoveLabel;
    const relationRemoveMessage = sketchRelationRemoveMessage;

    const sketchRelationValueDescriptor = (relation, relationMode) => {
      if (!["length", "angle", "distance"].includes(relation.type) || relationMode === "driven") return {};
      const unit = relation.type === "angle" ? "deg" : "mm";
      return {
        value: relation.value,
        valueLabel: `${sketchRelationLabel(relation)} ${unit}`,
        valueTitle: `Driving ${sketchRelationLabel(relation).toLowerCase()} (${unit})`,
        options: { min: 0, minExclusive: true },
        commit: {
          action: "object.plate.sketchRelation.value.set",
          objectId: plate.id,
          relationId: relation.id,
          relation: clone(relation)
        }
      };
    };

    const relationModeToggleAction = (relation, relationMode) => {
      if (!["length", "angle", "distance"].includes(relation.type)) return null;
      const nextMode = relationMode === "driven" ? "driving" : "driven";
      return {
        label: relationMode === "driven" ? "Make Driving" : "Make Driven",
        action: "object.plate.sketchRelation.mode.set",
        payload: {
          objectId: plate.id,
          relationId: relation.id,
          relation: clone(relation),
          mode: nextMode
        }
      };
    };

    const relationResolveAction = (relation, relationMode, healthStatus) => (
      healthStatus === "conflicted" || healthStatus === "redundant"
        ? {
          label: "Resolve",
          primary: true,
          action: "object.plate.sketchRelation.resolve",
          title: healthStatus === "conflicted"
            ? "Try to move sketch geometry so this relation is satisfied."
            : healthStatus === "redundant" && relationMode === "driving" && ["length", "angle", "distance"].includes(relation.type)
              ? "Convert this redundant driving dimension to reference."
              : "Remove this relation to resolve the sketch issue.",
          payload: {
            objectId: plate.id,
            relationId: relation.id,
            relation: clone(relation),
            relationMode,
            healthStatus,
            detail: relationSelectionDetail(relation)
          }
        }
        : null
    );

    const relationStatusRowDescriptor = (relation, options = {}) => {
      const relationMode = sketchRelationMode(relation);
      const target = sketchRelationTargetText(relation, relationMode);
      const health = relationHealth[relation.id];
      const healthStatus = sketchRelationHealthStatus(health);
      const healthText = options.healthText === false || !healthStatus || healthStatus === "ok" ? "" : ` - ${healthStatus}`;
      const isSelectedRelation = relation.id === activeRelationId;
      const detail = relationSelectionDetail(relation);
      return {
        type: "statusRow",
        relationId: relation.id,
        label: `${sketchRelationBadge(relation)} ${sketchRelationLabel(relation)} ${target}${healthText}`,
        compact: options.compact === true,
        status: healthStatus,
        selected: isSelectedRelation,
        diagnostic: options.diagnostic === false ? "" : health?.message && healthStatus !== "ok" ? health.message : "",
        title: health?.message || "",
        ...(options.value === false ? {} : sketchRelationValueDescriptor(relation, relationMode)),
        actions: [
          {
            label: options.selectLabel || (isSelectedRelation ? "Selected" : "Select"),
            primary: isSelectedRelation,
            action: "object.plate.sketchRelation.select",
            title: "Select this relation in the 3D sketch overlay.",
            payload: { objectId: plate.id, relationId: relation.id }
          },
          options.modeToggle === false ? null : relationModeToggleAction(relation, relationMode),
          relationResolveAction(relation, relationMode, healthStatus),
          {
            label: relationRemoveLabel(relation),
            danger: true,
            action: "object.plate.sketchRelation.remove",
            payload: {
              objectId: plate.id,
              relationId: relation.id,
              relation: clone(relation),
              detail
            }
          }
        ].filter(Boolean)
      };
    };

    const relationStatusGroupFields = (relationGroups, rowDescriptor) => relationGroups.flatMap((group) => [
      { type: "statusGroupTitle", label: `${group.label} (${group.relations.length})`, status: group.status },
      ...group.relations.map(rowDescriptor)
    ]);

    const relationStatusListFields = () => relationStatusGroupFields(
      groupedSketchRelations(relations, relationHealth),
      (relation) => relationStatusRowDescriptor(relation)
    );

    const selectedEntityRelationStatusFields = (relationGroups) => relationStatusGroupFields(
      relationGroups,
      (relation) => relationStatusRowDescriptor(relation, {
        compact: true,
        value: false,
        modeToggle: false,
        healthText: false,
        diagnostic: false,
        selectLabel: "Select"
      })
    );

    const relationEntityActionGroups = (relation) => {
      const detail = relationSelectionDetail(relation);
      return [
        detail.edgeIds.length ? {
          label: "Edges",
          actions: detail.edgeIds.slice(0, 8).map((edgeId) => ({
            label: edgeId,
            action: "object.plate.relations.toggle",
            title: `Select ${edgeId} in the 3D sketch overlay.`,
            payload: { objectId: plate.id, detail: { edgeIds: [edgeId] } }
          }))
        } : null,
        detail.vertexIds.length ? {
          label: "Vertices",
          actions: detail.vertexIds.slice(0, 8).map((vertexId) => ({
            label: vertexId,
            action: "object.plate.relations.toggle",
            title: `Select ${vertexId} in the 3D sketch overlay.`,
            payload: { objectId: plate.id, detail: { vertexIds: [vertexId] } }
          }))
        } : null
      ].filter(Boolean);
    };

    const selectedRelationCardDescriptor = (relation) => {
      const relationMode = sketchRelationMode(relation);
      const health = relationHealth[relation.id];
      const healthStatus = sketchRelationHealthStatus(health);
      return {
        type: "summaryCard",
        title: `${sketchRelationBadge(relation)} ${sketchRelationLabel(relation)}`,
        status: healthStatus,
        diagnostic: health?.message || "",
        readouts: [
          { label: "Status", value: sketchRelationStatusText(health, relationMode) },
          { label: "Target", value: sketchRelationTargetText(relation, relationMode) },
          { label: "Entities", value: sketchRelationEntityText(relation) }
        ],
        ...sketchRelationValueDescriptor(relation, relationMode),
        actionGroups: [
          ...relationEntityActionGroups(relation),
          {
            actions: [
              {
                label: "Locate",
                action: "object.plate.sketchRelation.select",
                title: "Keep this relation selected in the 3D sketch overlay.",
                payload: { objectId: plate.id, relationId: relation.id }
              },
              relationModeToggleAction(relation, relationMode),
              relationResolveAction(relation, relationMode, healthStatus),
              {
                label: relationRemoveLabel(relation),
                danger: true,
                action: "object.plate.sketchRelation.remove",
                payload: {
                  objectId: plate.id,
                  relationId: relation.id,
                  relation: clone(relation),
                  detail: relationSelectionDetail(relation)
                }
              }
            ].filter(Boolean)
          }
        ]
      };
    };

    const selectedRelationInspector = (relation) => {
      if (!relation) return null;
      return selectedRelationCardDescriptor(relation);
    };

    const existingRelationForAction = (relation) => {
      const key = sketchRelationKey(relation);
      return relations.find((item) => sketchRelationKey(item) === key) || null;
    };

    const relationActionPreview = (relation) => {
      try {
        return plateSketchRelationActionPreview(plate, relation);
      } catch (error) {
        return {
          relation: null,
          health: {
            status: "conflicted",
            severity: "error",
            message: error?.message || "Relation cannot be evaluated."
          },
          definition: null
        };
      }
    };

    const relationActionStatusSuffix = (status) => {
      if (status === "conflicted") return "conflict";
      if (status === "redundant") return "redundant";
      if (status === "reference") return "reference";
      return "";
    };

    const relationActionDescriptor = (relation, label = null) => {
      const actionLabel = label || sketchRelationLabel(relation);
      const existingRelation = existingRelationForAction(relation);
      if (existingRelation) {
        return {
          label: `${actionLabel} (existing)`,
          status: "existing",
          action: "object.plate.sketchRelation.select",
          title: "This relation already exists. Select it to edit, resolve, convert, or remove it.",
          payload: { objectId: plate.id, relationId: existingRelation.id }
        };
      }
      const preview = relationActionPreview(relation);
      const previewStatus = sketchRelationHealthStatus(preview.health);
      const suffix = relationActionStatusSuffix(previewStatus);
      const title = preview.health?.message
        || (preview.definition?.status && preview.definition.status !== definition.status
          ? `Sketch will become ${preview.definition.label.toLowerCase()}.`
          : "");
      return {
        label: suffix ? `${actionLabel} (${suffix})` : actionLabel,
        status: previewStatus,
        action: "object.plate.sketchRelation.add",
        title,
        payload: { objectId: plate.id, relation: clone(relation) }
      };
    };

    const constructionLineActionDescriptor = (from, to) => ({
      label: "Construction line",
      action: "object.plate.sketchConstructionLine.add",
      payload: { objectId: plate.id, from: clone(from), to: clone(to) }
    });

    const selectedEntityRelationActions = () => {
      const actions = [];
      if (activeVertexIds.length === 2 && activeEdgeIds.length === 1) {
        actions.push(relationActionDescriptor({ type: "symmetric", vertexIds: activeVertexIds, edgeId: activeEdgeIds[0] }));
        return actions;
      }
      if (activeVertexIds.length === 2) {
        const vertexMap = sketchVertexPointMap(plate.sketch);
        const first = vertexMap.get(activeVertexIds[0]);
        const second = vertexMap.get(activeVertexIds[1]);
        actions.push(
          relationActionDescriptor({ type: "distance", vertexIds: activeVertexIds }, "Distance"),
          relationActionDescriptor({ type: "coincident", vertexIds: activeVertexIds }),
          relationActionDescriptor({ type: "horizontal-points", vertexIds: activeVertexIds }),
          relationActionDescriptor({ type: "vertical-points", vertexIds: activeVertexIds }),
          ...(first && second ? [constructionLineActionDescriptor(first, second)] : [])
        );
        return actions;
      }
      if (activeVertexIds.length === 1 && activeEdgeIds.length === 1) {
        if (canConstrainVertexToEdge(activeVertexIds[0], activeEdgeIds[0])) {
          actions.push(
            relationActionDescriptor({ type: "point-on-line", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] }),
            relationActionDescriptor({ type: "midpoint", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] })
          );
        }
        return actions;
      }
      if (activeVertexIds.length === 1) {
        actions.push(relationActionDescriptor({ type: "fixed", vertexId: activeVertexIds[0] }));
        return actions;
      }
      if (activeEdgeIds.length === 2) {
        actions.push(
          relationActionDescriptor({ type: "parallel", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionDescriptor({ type: "collinear", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionDescriptor({ type: "perpendicular", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionDescriptor({ type: "equal-length", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionDescriptor({ type: "angle", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }, "Angle")
        );
        return actions;
      }
      if (activeEdgeIds.length === 1) {
        const edgePoints = sketchEdgePoints(plate.sketch, activeEdgeIds[0]);
        actions.push(
          relationActionDescriptor({ type: "horizontal", edgeId: activeEdgeIds[0] }),
          relationActionDescriptor({ type: "vertical", edgeId: activeEdgeIds[0] }),
          relationActionDescriptor({ type: "fixed", edgeId: activeEdgeIds[0] }),
          relationActionDescriptor({ type: "length", edgeId: activeEdgeIds[0] }, "Length"),
          ...(constructionEdgeIds.has(activeEdgeIds[0]) || !edgePoints ? [] : [constructionLineActionDescriptor(edgePoints.from, edgePoints.to)])
        );
      }
      return actions;
    };

    const selectedEntityRelations = () => {
      const edgeIds = new Set(activeEdgeIds);
      const vertexIds = new Set(activeVertexIds);
      for (const edgeId of activeEdgeIds) {
        const edge = edgeById.get(edgeId)?.edge;
        if (!edge) continue;
        if (edge.from) vertexIds.add(edge.from);
        if (edge.to) vertexIds.add(edge.to);
      }
      if (activeVertexIds.length) {
        const activeVertexSet = new Set(activeVertexIds);
        for (const { edge } of edgeById.values()) {
          if (activeVertexSet.has(edge.from) || activeVertexSet.has(edge.to)) edgeIds.add(edge.id);
        }
      }
      if (!edgeIds.size && !vertexIds.size) return [];
      return sketchRelations(plate.sketch).filter((relation) => (
        sketchRelationEdgeIds(relation).some((edgeId) => edgeIds.has(edgeId))
        || sketchRelationVertexIds(relation).some((vertexId) => vertexIds.has(vertexId))
      ));
    };

    const selectedEntityInspector = () => {
      if (activeRelation || (!activeEdgeIds.length && !activeVertexIds.length)) return null;
      const actions = selectedEntityRelationActions();
      const existingRelations = selectedEntityRelations();
      const relationGroups = groupedSketchRelations(existingRelations, relationHealth);
      return {
        type: "nestedFieldCard",
        title: "Selected sketch entities",
        readouts: [
          { label: "Edges", value: activeEdgeIds.length ? activeEdgeIds.join(", ") : "-" },
          { label: "Vertices", value: activeVertexIds.length ? activeVertexIds.join(", ") : "-" }
        ],
        messages: [
          { value: actions.length ? "Add relation" : "No panel relation actions for this selection." },
          { value: existingRelations.length ? "Relations on selected entities" : "No existing relations on selected entities." }
        ],
        fields: [
          {
            type: "actionRow",
            label: "Add relation",
            actions: [
              ...actions,
              {
                label: "Clear selection",
                action: "object.plate.relations.toggle",
                payload: { objectId: plate.id, detail: { clearSketchSelection: true } }
              }
            ]
          },
          ...selectedEntityRelationStatusFields(relationGroups)
        ]
      };
    };

    const underDefined = underDefinedInspector();
    if (underDefined) fields.push(underDefined);
    const inspector = selectedRelationInspector(activeRelation);
    if (inspector) fields.push(inspector);
    const entityInspector = selectedEntityInspector();
    if (entityInspector) fields.push(entityInspector);
    if (fixedRelations.length) {
      fields.push({
        type: "action",
        label: `Unfix all (${fixedRelations.length})`,
        icon: "relation",
        action: "object.plate.sketchRelations.unfixAll",
        payload: { objectId: plate.id, detail: {} },
        title: "Remove every fixed sketch relation and leave dimensional/geometric relations intact."
      });
    }
    if (!relations.length) {
      fields.push({ type: "message", state: "help", value: "No sketch relations." });
    } else {
      fields.push(...relationStatusListFields());
    }

    fields.push({ label: "Outline vertices", value: String(sketchPlateOutline(plate).length) });
    return {
      id: "inspector.properties.object.plate.relations",
      label: "Sketch Relations",
      level: "advanced",
      open: true,
      fields
    };
  };

  const activePropertiesPanel = () => {
    if (selectedMemberId) return memberPropertiesPanel();
    if (selectedSmartComponentId) return smartComponentPropertiesPanel();
    if (selectedObjectId) return objectPropertiesPanel();
    const activeTool = activeToolPropertiesPanel();
    if (activeTool) return activeTool;
    return generatedPropertiesPanel({
      context: inspectorEmptySelectionContext(),
      emptyMessage: "Pick a member, Smart Component, trim, cut object, plate, fastener, or weld."
    });
  };

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

  const smartComponentQuickParameterField = (smartComponent, definition, path) => {
    const parameters = smartComponent.referenceParameters || {};
    return parameterFieldDescriptor(definition, parameters, path, {
      api,
      labelFor: inspectorMetadataLabel,
      catalogOptions: (spec, value) => spec.kind === "catalogRef"
        ? catalogOptions(api, spec.catalog, String(value || ""))
        : null,
      commit: { action: "smartComponent.parameter.set", smartComponentId: smartComponent.id }
    });
  };

  const smartComponentQuickParameterFields = (smartComponent, definition) => {
    const entries = uiQuickParameterEntries(definition, smartComponent.referenceParameters || {}, { limit: SMART_COMPONENT_QUICK_PARAMETER_LIMIT });
    return entries.map(({ path }) => smartComponentQuickParameterField(smartComponent, definition, path)).filter(Boolean);
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

  const smartComponentObjectIndex = () => api.project().objectIndex || {};

  const objectGeneratedByCapabilities = () => ({
    resetObjectOverrides: typeof api.resetSmartComponentObjectOverrides === "function",
    detachObject: typeof api.detachSmartComponentObject === "function",
    reattachObject: typeof api.reattachSmartComponentObject === "function"
  });

  const smartComponentPropertiesPanel = () => {
    const smartComponent = api.smartComponent(selectedSmartComponentId);
    if (!smartComponent) return generatedPropertiesPanel({ emptyMessage: "Selected Smart Component is no longer in the project." });
    const definition = api.definition(selectedSmartComponentId);
    const diagnosticsSummary = inspectorSmartComponentDiagnosticsSummary(smartComponent);
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
        quickParameterFields: smartComponentQuickParameterFields(smartComponent, definition),
        liveRoleOptions: smartComponentLiveRoleOptions(selectedSmartComponentId),
        objectIndex: smartComponentObjectIndex(),
        capabilities: smartComponentCapabilities()
      }), generatedSmartComponentBindings())
    });
  };

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
        objectIndex: api.project().objectIndex,
        updateWorkPoint,
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
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) setSelectedState();
    if (selectedSmartComponentId && !api.project().model.smartComponentInstances?.[selectedSmartComponentId]) setSelectedState();
    if (selectedObjectId && !api.project().objectIndex?.[selectedObjectId]) setSelectedState();

    const title = text("div", "bc-inspector-title", "Inspector");
    const actions = document.createElement("div");
    const message = panelMessage.element();

    panel.classList.add("bc-inspector");
    actions.className = "bc-action-row";

    actions.append(...bindActionButtons(inspectorPrimaryActions()).map(inspectorActionButton));
    const quickActionRow = selectionQuickActions();
    const properties = activePropertiesPanel();

    panel.hidden = false;
    panel.replaceChildren(...[title, actions, quickActionRow, properties, message].filter(Boolean));
  }

  api.subscribe(render);
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
    selectedState() {
      return {
        memberId: selectedMemberId,
        smartComponentId: selectedSmartComponentId,
        objectId: selectedObjectId,
        objectDetail: selectedObjectDetail
      };
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
