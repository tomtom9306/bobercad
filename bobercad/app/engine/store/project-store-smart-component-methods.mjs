export function createSmartComponentStoreMethods({
  state,
  affectedSmartComponentIdsForMember,
  addIndexedObject,
  arrayValues,
  clone,
  commitProject,
  commitRegeneratedSmartComponent,
  componentFromFace,
  createProjectSmartComponentFromPreset,
  definitionFor,
  fail,
  fastenerCatalogEntries,
  fasteners,
  featureById,
  finiteNumber,
  lockSmartComponentZoneFaces,
  materials,
  memberById,
  nextObjectId,
  objectById,
  objectCollection,
  optionalObject,
  profilesFor,
  projectCollection,
  projectFeatureDependencyObjectIds,
  projectMemberDependencyObjectIds,
  projectObjectIndex,
  projectReferencePlaneDependencyObjectIds,
  projectSmartComponentForObject,
  projectSmartComponentPlateOptions,
  projectSmartComponentRoleOptions,
  projectSmartComponentRootForObject,
  projectTrimJointDependencyObjectIds,
  reconcileGeneratedSmartComponents,
  referencePlaneById,
  regenerateSmartComponent,
  resolveSmartComponentDiagnostics,
  requiredArray,
  requiredObject,
  requiredStringList,
  setIndexIncluded,
  setProjectSmartComponentPlateIncluded,
  setRoleInList,
  smartComponentById,
  smartComponentCatalog,
  smartComponentGeneratedHelperIds,
  smartComponentDefinition,
  smartComponentObjectIds,
  smartComponentOwnedObjectIds,
  smartComponentRootApi,
  supportedSmartComponentsApi,
  supportedSmartComponentPresetsApi,
  removeObjects,
  trimJointById,
  unique,
  updateRegeneratedSmartComponent,
  updateSmartComponentRuntime,
  validateGridSystem,
  validateLevel
}) {
  return {
    object(objectId) {
      if (!projectObjectIndex(state.currentProject)[objectId]) fail(`object not found: ${objectId}`);
      return objectById(state.currentProject, objectId);
    },

    member(memberId) {
      memberById(state.currentProject, memberId);
      return objectById(state.currentProject, memberId);
    },

    smartComponent(smartComponentId) {
      return smartComponentById(state.currentProject, smartComponentId);
    },

    smartComponentForObject(objectId) {
      return projectSmartComponentForObject(state.currentProject, objectId);
    },

    smartComponentRoot(smartComponentId) {
      return smartComponentRootApi(state.currentProject, smartComponentById(state.currentProject, smartComponentId));
    },

    smartComponentRootForObject(objectId) {
      return projectSmartComponentRootForObject(state.currentProject, objectId);
    },

    toggleSmartComponentRoleFromFace(face) {
      const component = componentFromFace(state.currentProject, face);
      if (!component) return null;
      const next = clone(state.currentProject);
      const smartComponent = smartComponentById(next, component.smartComponentId);

      let included = true;
      if (component.kind === "pattern-position") {
        const suppressedPatternPositions = requiredObject(smartComponent.suppressedPatternPositions, `${component.smartComponentId}.suppressedPatternPositions`);
        const current = arrayValues(suppressedPatternPositions[component.patternRole]);
        included = current.includes(component.positionIndex);
        const nextList = setIndexIncluded(current, component.positionIndex, included);
        if (nextList.length) suppressedPatternPositions[component.patternRole] = nextList;
        else delete suppressedPatternPositions[component.patternRole];
      } else if (component.kind === "object-role") {
        const definition = definitionFor(next, component.smartComponentId);
        if (!requiredArray(definition.components, `${definition.type}.components`).some((entry) => entry?.role === component.objectRole)) fail(`${component.smartComponentId}: unknown component role ${component.objectRole}`);
        const current = new Set(requiredStringList(smartComponent.suppressedRoles, `${component.smartComponentId}.suppressedRoles`));
        included = current.has(component.objectRole);
        if (included) current.delete(component.objectRole);
        else current.add(component.objectRole);
        smartComponent.suppressedRoles = [...current].sort();
      }

      const updated = commitRegeneratedSmartComponent("smartComponent.role.toggleFromFace", next, component.smartComponentId);
      return { project: updated, component, included };
    },

    smartComponentObjectIds(smartComponentId) {
      return smartComponentObjectIds(state.currentProject, smartComponentById(state.currentProject, smartComponentId));
    },

    resetSmartComponentObjectOverrides(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        delete requiredObject(smartComponent.fieldOverrides, `${smartComponentId}.fieldOverrides`)[objectId];
        delete requiredObject(smartComponent.managedFields, `${smartComponentId}.managedFields`)[objectId];
        return next;
      });
    },

    detachSmartComponentObject(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        if (!smartComponentOwnedObjectIds(smartComponent).includes(objectId)) fail(`${objectId}: object is not owned by ${smartComponentId}`);
        const collection = objectCollection(next, objectId);
        const object = collection ? projectCollection(next, collection)[objectId] : null;
        if (!object) fail(`object not found: ${objectId}`);
        smartComponent.detachedObjectIds = unique([...requiredStringList(smartComponent.detachedObjectIds, `${smartComponentId}.detachedObjectIds`), objectId]);
        object.authoring = { ...optionalObject(object.authoring, `${objectId}.authoring`), componentStatus: "detached" };
        return next;
      });
    },

    reattachSmartComponentObject(smartComponentId, objectId) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        smartComponent.detachedObjectIds = requiredStringList(smartComponent.detachedObjectIds, `${smartComponentId}.detachedObjectIds`).filter((id) => id !== objectId);
        delete requiredObject(smartComponent.fieldOverrides, `${smartComponentId}.fieldOverrides`)[objectId];
        delete requiredObject(smartComponent.managedFields, `${smartComponentId}.managedFields`)[objectId];
        return removeObjects(next, [objectId]);
      });
    },

    affectedSmartComponentIds(memberId) {
      memberById(state.currentProject, memberId);
      return affectedSmartComponentIdsForMember(state.currentProject, memberId);
    },

    memberDependencyObjectIds(memberId, options = {}) {
      memberById(state.currentProject, memberId);
      return projectMemberDependencyObjectIds(state.currentProject, memberId, options);
    },

    featureDependencyObjectIds(featureId, options = {}) {
      featureById(state.currentProject, featureId);
      return projectFeatureDependencyObjectIds(state.currentProject, featureId, options);
    },

    referencePlaneDependencyObjectIds(referencePlaneId, options = {}) {
      referencePlaneById(state.currentProject, referencePlaneId);
      return projectReferencePlaneDependencyObjectIds(state.currentProject, referencePlaneId, options);
    },

    trimJointDependencyObjectIds(trimJointId, options = {}) {
      trimJointById(state.currentProject, trimJointId);
      return projectTrimJointDependencyObjectIds(state.currentProject, trimJointId, options);
    },

    definition(smartComponentId) {
      return definitionFor(state.currentProject, smartComponentId);
    },

    supportedSmartComponents() {
      return supportedSmartComponentsApi(state.currentProject, smartComponentCatalog);
    },

    smartComponentPresets() {
      return supportedSmartComponentPresetsApi(smartComponentCatalog);
    },

    catalogEntries(catalog) {
      if (catalog === "fasteners") return fastenerCatalogEntries(fasteners);
      if (catalog === "profiles") return profilesFor(state.currentProject);
      fail(`unsupported catalog ${catalog}`);
    },

    profiles() {
      return profilesFor(state.currentProject);
    },

    createSmartComponentFromPreset(presetId, memberIds) {
      const preset = smartComponentCatalog.smartComponents[presetId];
      if (!preset) fail(`smart component preset not found: ${presetId}`);
      const definition = smartComponentDefinition(smartComponentCatalog, { type: preset.type, sourceComponent: { id: presetId } });
      if (preset.kind !== "connection") {
        const created = createProjectSmartComponentFromPreset(state.currentProject, smartComponentCatalog, presetId, [], { definition });
        const next = regenerateSmartComponent(created.project, created.smartComponentId);
        const updated = commitProject("smartComponent.createFromPreset", next, {
          changedObjectIds: [created.smartComponentId],
          regeneratedObjectIds: [created.smartComponentId]
        });
        return { project: updated, smartComponentId: created.smartComponentId };
      }
      const created = createProjectSmartComponentFromPreset(state.currentProject, smartComponentCatalog, presetId, memberIds, { definition });
      const locked = lockSmartComponentZoneFaces(created.project, profilesFor(created.project), created.smartComponentId);
      const next = reconcileGeneratedSmartComponents(regenerateSmartComponent(locked, created.smartComponentId));
      const updated = commitProject("smartComponent.createFromPreset", next, {
        changedObjectIds: [created.smartComponentId],
        regeneratedObjectIds: [created.smartComponentId]
      });
      return { project: updated, smartComponentId: created.smartComponentId };
    },

    createLevel(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("level options must be an object");
      const next = clone(state.currentProject);
      const id = nextObjectId(next, options.id === undefined ? "level" : options.id);
      const level = {
        id,
        type: options.type || "datum-level",
        name: options.name || id,
        elevation: finiteNumber(options.elevation) ? Number(options.elevation) : 0
      };
      validateLevel(level);
      addIndexedObject(next, "levels", level);
      for (const gridSystem of Object.values(projectCollection(next, "gridSystems"))) {
        gridSystem.levelIds = unique([...(Array.isArray(gridSystem.levelIds) ? gridSystem.levelIds : []), id]);
      }
      const updated = commitProject("level.create", next, { changedObjectIds: [id] });
      return { project: updated, levelId: id, level: updated.model.levels[id] };
    },

    createGridSystem(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)) fail("grid system options must be an object");
      const next = clone(state.currentProject);
      const id = nextObjectId(next, options.id === undefined ? "grid" : options.id);
      const levelIds = Array.isArray(options.levelIds)
        ? unique(options.levelIds.filter((levelId) => projectCollection(next, "levels")[levelId]))
        : Object.keys(projectCollection(next, "levels"));
      const gridSystem = {
        id,
        type: options.type || "orthogonal-grid-system",
        name: options.name || "Grid",
        origin: Array.isArray(options.origin) ? [...options.origin] : [0, 0, 0],
        axisX: Array.isArray(options.axisX) ? [...options.axisX] : [1, 0, 0],
        axisY: Array.isArray(options.axisY) ? [...options.axisY] : [0, 1, 0],
        axisZ: Array.isArray(options.axisZ) ? [...options.axisZ] : [0, 0, 1],
        axes: {
          x: arrayValues(options.axes?.x).length ? clone(options.axes.x) : [
            { id: `${id}_x_1`, label: "1", position: 0 },
            { id: `${id}_x_2`, label: "2", position: 6000 }
          ],
          y: arrayValues(options.axes?.y).length ? clone(options.axes.y) : [
            { id: `${id}_y_a`, label: "A", position: 0 },
            { id: `${id}_y_b`, label: "B", position: 6000 }
          ]
        },
        levelIds
      };
      validateGridSystem(gridSystem);
      addIndexedObject(next, "gridSystems", gridSystem);
      const updated = commitProject("gridSystem.create", next, { changedObjectIds: [id] });
      return { project: updated, gridSystemId: id, gridSystem: updated.model.gridSystems[id] };
    },

    deleteSmartComponent(smartComponentId) {
      const smartComponent = smartComponentById(state.currentProject, smartComponentId);
      const ownedIds = smartComponentOwnedObjectIds(smartComponent);
      const helperIds = smartComponentGeneratedHelperIds(state.currentProject, smartComponent);
      return commitProject(
        "smartComponent.delete",
        removeObjects(state.currentProject, [...ownedIds, ...helperIds, smartComponentId]),
        { removedObjectIds: [...ownedIds, ...helperIds, smartComponentId] }
      );
    },

    smartComponentPlateOptions(smartComponentId) {
      return projectSmartComponentPlateOptions(state.currentProject, definitionFor(state.currentProject, smartComponentId), smartComponentId);
    },

    smartComponentRoleOptions(smartComponentId) {
      return projectSmartComponentRoleOptions(state.currentProject, definitionFor(state.currentProject, smartComponentId), smartComponentId);
    },

    setSmartComponentRoleActive(smartComponentId, role, active) {
      return updateRegeneratedSmartComponent(smartComponentId, (next, smartComponent) => {
        const definition = definitionFor(next, smartComponentId);
        if (!requiredArray(definition.components, `${definition.type}.components`).some((component) => component?.role === role)) fail(`${smartComponentId}: unknown component role ${role}`);
        smartComponent.suppressedRoles = setRoleInList(smartComponent.suppressedRoles, role, !active);
        return next;
      });
    },

    setSmartComponentPlateIncluded(smartComponentId, plateId, included) {
      return commitProject(
        "smartComponent.plate.setIncluded",
        setProjectSmartComponentPlateIncluded(state.currentProject, definitionFor(state.currentProject, smartComponentId), smartComponentId, plateId, included),
        { changedObjectIds: [smartComponentId, plateId], regeneratedObjectIds: [smartComponentId] }
      );
    },

    resolveSmartComponentDiagnostics,

    updateSmartComponent(smartComponentId, parameters) {
      return commitProject("smartComponent.update", reconcileGeneratedSmartComponents(updateSmartComponentRuntime({
        project: state.currentProject,
        profiles: profilesFor(state.currentProject),
        definition: definitionFor(state.currentProject, smartComponentId),
        catalog: smartComponentCatalog,
        fasteners,
        materials,
        instanceId: smartComponentId,
        parameters
      })), { changedObjectIds: [smartComponentId], regeneratedObjectIds: [smartComponentId] });
    },
  };
}
