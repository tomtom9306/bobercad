import { mergeObjectPatch } from "../../../engine/core/model.mjs?v=inspector-property-bindings-1";

export function createInspectorPropertyBindings({
  getSelection = () => ({}),
  definition = () => null,
  refs = {},
  selectionActions = {},
  activeTool = {},
  members = {},
  support = {},
  smartComponents = {},
  objects = {}
} = {}) {
  const selection = () => getSelection() || {};
  const selectedMemberId = () => selection().memberId || "";
  const selectedSmartComponentId = () => selection().smartComponentId || "";
  const selectedObjectId = () => selection().objectId || "";
  const selectedObjectDetail = () => selection().objectDetail || {};

  const generatedReferenceBindings = () => ({
    actions: {
      "objectRef.select": (field) => {
        const payload = field.payload || {};
        if (payload.smartComponentId) return refs.selectSmartComponent?.(payload.smartComponentId);
        return refs.selectObjectReference?.(payload.objectId);
      },
      "objectRef.fit": (field) => refs.focusObjectReference?.(field.payload?.objectId)
    }
  });

  const quickActionBindings = () => ({
    "inspector.pickMember": () => selectionActions.pickMember?.(),
    "inspector.pickSmartComponent": () => selectionActions.pickSmartComponent?.(),
    "inspector.pickObject": () => selectionActions.pickObject?.(),
    "selection.fit": () => selectionActions.fit?.(),
    "selection.smartComponent.open": (action) => {
      const payload = action.payload || {};
      selectionActions.selectSmartComponent?.(payload.smartComponentId || selectedSmartComponentId());
    },
    "selection.feature.open": (action) => {
      const payload = action.payload || {};
      selectionActions.openFeatureEditor?.(payload.objectId || selectedObjectId());
    },
    "selection.trim.open": (action) => {
      const payload = action.payload || {};
      selectionActions.openTrimEditor?.(payload.objectId || selectedObjectId(), payload.detail || selectedObjectDetail());
    },
    "selection.plateRelations.toggle": (action) => {
      const payload = action.payload || {};
      selectionActions.selectObjectDetail?.(payload.objectId || selectedObjectId(), payload.detail || {});
    },
    "selection.clear": () => selectionActions.clear?.()
  });

  const bindActionDescriptors = (actions = []) => {
    const bindings = quickActionBindings();
    return actions.map((action) => {
      if (!action?.action || !bindings[action.action]) return action;
      return {
        ...action,
        onClick: () => bindings[action.action](action)
      };
    });
  };
  const bindQuickActions = bindActionDescriptors;
  const bindActionButtons = bindActionDescriptors;

  const supportObjectCommitBindings = () => ({
    "supportObject.workPoint.update": (value, commit) => support.updateWorkPoint?.(propertyPatch(value, commit)),
    "supportObject.referencePlane.update": (value, commit) => support.updateReferencePlane?.(propertyPatch(value, commit)),
    "supportObject.interface.update": (value, commit) => support.updateInterface?.(propertyPatch(value, commit)),
    "supportObject.connectionZone.update": (value, commit) => support.updateConnectionZone?.(propertyPatch(value, commit)),
    "supportObject.assembly.update": (value, commit) => support.updateAssembly?.(propertyPatch(value, commit)),
    "supportObject.group.update": (value, commit) => support.updateGroup?.(propertyPatch(value, commit)),
    "supportObject.holePattern.update": (value, commit) => support.updateHolePattern?.(propertyPatch(value, commit)),
    "supportObject.objectPattern.update": (value, commit) => support.updateObjectPattern?.(propertyPatch(value, commit))
  });

  const generatedSupportObjectBindings = () => ({
    ...generatedReferenceBindings(),
    commits: supportObjectCommitBindings()
  });

  const generatedActiveToolBindings = () => ({
    runCommand: (commandId, field) => activeTool.runCommand?.(commandId, field),
    actions: {
      "activeTool.cycleSnap": (field) => activeTool.cycleSnap?.(field),
      "activeTool.cancel": (field) => activeTool.cancel?.(field)
    },
    commits: {
      "snapStrength.set": (strength, commit, field) => activeTool.setSnapStrength?.(strength, commit, field),
      "selectionScope.set": (mode, commit, field) => activeTool.setSelectionScope?.(mode, commit, field),
      "snapTarget.set": (enabled, commit = {}, field) => activeTool.setSnapTarget?.(commit.target, enabled, commit, field)
    }
  });

  const generatedMemberBindings = () => ({
    commits: {
      "member.profile.set": (profileId, commit = {}) => members.setProfile?.(commit.memberId || selectedMemberId(), profileId),
      "member.material.set": (materialId, commit = {}) => members.setMaterial?.(commit.memberId || selectedMemberId(), materialId),
      "member.rotation.set": (rotation, commit = {}) => members.setRotation?.(commit.memberId || selectedMemberId(), rotation),
      "member.centerCoordinate.set": (value, commit = {}) => members.setCenterCoordinate?.(commit.memberId || selectedMemberId(), commit.axisIndex, value),
      "member.endpointCoordinate.set": (value, commit = {}) => members.setEndpointCoordinate?.(commit.memberId || selectedMemberId(), commit.endpoint, commit.axisIndex, value),
      "member.customProfileDraft.set": (value, commit = {}) => members.setCustomProfileDraft?.(commit.memberId || selectedMemberId(), value)
    },
    actions: {
      "member.alignment.setGlobalAxis": (field) => {
        const payload = field.payload || {};
        members.setAlignmentGlobalAxis?.(payload.memberId || selectedMemberId(), payload.axisId);
      },
      "member.alignment.pickAxis": (field) => members.pickAlignmentAxis?.(field.payload?.memberId || selectedMemberId()),
      "member.alignment.clear": (field) => members.clearAlignment?.(field.payload?.memberId || selectedMemberId()),
      "member.customProfile.create": (field) => members.createCustomProfile?.(field.payload?.memberId || selectedMemberId()),
      "member.relation.remove": (field) => members.removeRelation?.(field.payload?.relationId, field.payload?.memberId || selectedMemberId())
    }
  });

  const generatedSmartComponentBindings = () => ({
    ...generatedReferenceBindings(),
    commits: {
      "smartComponent.parameter.set": (value, commit = {}) => {
        const smartComponentId = commit.smartComponentId || selectedSmartComponentId();
        smartComponents.updateParameter?.(smartComponentId, definition(smartComponentId), commit.parameterPath, value);
      },
      "smartComponent.roleActive.set": (active, commit = {}) => {
        smartComponents.setRoleActive?.(commit.smartComponentId || selectedSmartComponentId(), commit.role, active);
      }
    },
    actions: {
      ...generatedReferenceBindings().actions,
      "smartComponent.objectOverrides.reset": (field) => {
        const payload = field.payload || {};
        smartComponents.resetObjectOverrides?.(payload.smartComponentId || selectedSmartComponentId(), payload.objectId);
      },
      "smartComponent.object.detach": (field) => {
        const payload = field.payload || {};
        smartComponents.detachObject?.(payload.smartComponentId || selectedSmartComponentId(), payload.objectId);
      },
      "smartComponent.object.reattach": (field) => {
        const payload = field.payload || {};
        smartComponents.reattachObject?.(payload.smartComponentId || selectedSmartComponentId(), payload.objectId);
      },
      "smartComponent.diagnostics.resolve": (field) => smartComponents.resolveDiagnostics?.(field.payload?.smartComponentId || selectedSmartComponentId()),
      "smartComponent.parameters.open": (field) => smartComponents.openParameters?.(field.payload?.smartComponentId || selectedSmartComponentId()),
      "smartComponent.delete": (field) => smartComponents.deleteSmartComponent?.(field.payload?.smartComponentId || selectedSmartComponentId())
    }
  });

  const objectPropertyCommitBindings = () => ({
    "object.fastenerGroup.update": (value, commit) => objects.updateFastenerGroup?.(objectPropertyPatch(value, commit)),
    "object.plate.update": (value, commit) => objects.updatePlatePatch?.(objectPropertyPatch(value, commit)),
    "object.plate.bend.update": (value, commit = {}) => objects.upsertPlateBend?.(mergeObjectPatch(commit.bend || {}, objectPropertyPatch(value, commit))),
    "object.plate.sketchRelation.value.set": (value, commit = {}) => objects.setPlateSketchRelationValue?.(value, commit),
    "object.trimJoint.operation.update": (value, commit = {}) => {
      if (!commit.operationId) return;
      objects.updateTrimOperation?.(commit.operationId, objectPropertyPatch(value, commit));
    },
    "object.trimJoint.operation.select": (operationId) => objects.selectTrimOperation?.(operationId),
    "object.trimJoint.operation.type.set": (type, commit = {}) => {
      if (!commit.operationId) return;
      objects.setTrimOperationType?.(commit.operationId, type);
    },
    "object.feature.operationEnabled.set": (enabled) => objects.setFeatureOperationEnabled?.(enabled),
    "object.feature.update": (value, commit) => objects.updateFeaturePatch?.(objectPropertyPatch(value, commit)),
    "object.feature.body.update": (value, commit) => objects.updateFeatureBody?.(objectPropertyPatch(value, commit)),
    "object.weld.update": (value, commit) => objects.updateWeld?.(objectPropertyPatch(value, commit))
  });

  const objectPropertyActionBindings = () => ({
    "object.plate.relations.toggle": (field) => {
      const payload = field.payload || {};
      objects.selectObjectDetail?.(payload.objectId || selectedObjectId(), payload.detail || {});
    },
    "object.plate.relations.infer": (field) => objects.inferPlateSketchRelations?.(field.payload?.objectId || selectedObjectId()),
    "object.plate.sketchRelation.select": (field) => objects.selectPlateSketchRelation?.(field.payload || {}),
    "object.plate.sketchRelation.mode.set": (field) => objects.setPlateSketchRelationMode?.(field.payload || {}),
    "object.plate.sketchRelation.resolve": (field) => objects.resolvePlateSketchRelation?.(field.payload || {}),
    "object.plate.sketchRelation.remove": (field) => objects.removePlateSketchRelation?.(field.payload || {}),
    "object.plate.sketchRelation.add": (field) => objects.addPlateSketchRelation?.(field.payload || {}),
    "object.plate.sketchConstructionLine.add": (field) => objects.addPlateSketchConstructionLine?.(field.payload || {}),
    "object.plate.sketchUnderDefined.fixRemaining": (field) => objects.fixPlateSketchUnderDefinedEntities?.(field.payload || {}),
    "object.plate.sketchRelations.unfixAll": (field) => objects.removePlateSketchFixedRelations?.(field.payload || {}),
    "object.plate.bend.remove": (field) => objects.removePlateBend?.(field.payload?.bendId),
    "object.sketch.createPlate": (field) => objects.createPlateFromSketch?.(field.payload?.objectId || selectedObjectId()),
    "object.trim.openEditor": (field) => objects.openTrimEditor?.(field.payload?.objectId || selectedObjectId(), field.payload?.detail || selectedObjectDetail()),
    "object.feature.openEditor": (field) => objects.openFeatureEditor?.(field.payload?.objectId || selectedObjectId())
  });

  const generatedObjectBindings = () => {
    const smartComponentBindings = generatedSmartComponentBindings();
    return {
      ...smartComponentBindings,
      commits: {
        ...smartComponentBindings.commits,
        ...objectPropertyCommitBindings()
      },
      actions: {
        ...smartComponentBindings.actions,
        ...objectPropertyActionBindings()
      }
    };
  };

  return {
    bindActionButtons,
    bindQuickActions,
    generatedReferenceBindings,
    generatedActiveToolBindings,
    generatedMemberBindings,
    generatedSupportObjectBindings,
    generatedSmartComponentBindings,
    generatedObjectBindings
  };
}

export function propertyPatch(value, commit = {}) {
  if (Array.isArray(commit.patchPath) && commit.patchPath.length) {
    return commit.patchPath.slice().reverse().reduce((patch, key) => ({ [key]: patch }), value);
  }
  if (Array.isArray(commit.arrayValue) && Number.isInteger(commit.itemIndex) && Number.isInteger(commit.axisIndex)) {
    const nextArray = commit.arrayValue.map((item) => Array.isArray(item) ? [...item] : item);
    const nextVector = Array.isArray(nextArray[commit.itemIndex]) ? [...nextArray[commit.itemIndex]] : [];
    nextVector[commit.axisIndex] = value;
    nextArray[commit.itemIndex] = nextVector;
    return { [commit.patchKey]: nextArray };
  }
  if (Array.isArray(commit.vectorValue) && Number.isInteger(commit.axisIndex)) {
    const nextVector = [...commit.vectorValue];
    nextVector[commit.axisIndex] = value;
    return { [commit.patchKey]: nextVector };
  }
  if (commit.objectValue && typeof commit.objectValue === "object" && commit.childKey) {
    return { [commit.patchKey]: { ...commit.objectValue, [commit.childKey]: value } };
  }
  return commit.patchKey ? { [commit.patchKey]: value } : {};
}

function objectPropertyPatch(value, commit = {}) {
  return propertyPatch(objectPropertyValue(value, commit), commit);
}

function objectPropertyValue(value, commit = {}) {
  if (commit.valueType === "number") return Number(value);
  if (commit.valueType === "string") return String(value ?? "");
  return value;
}
