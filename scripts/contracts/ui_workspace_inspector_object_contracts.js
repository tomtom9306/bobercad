const fs = require("fs");
const path = require("path");
const { validateValue } = require("../validate_json_schema");
const { ROOT, fail, parseModelCollections, readJson, stripCssComments, lineNumberAt } = require("./ui_contract_helpers");

function checkInspectorObjectContracts(context) {
  const {
    errors,
    workspaceRelative,
    registryPath,
    commandGroupMetadataPath,
    bottomStripMetadataPath,
    dataSurfaceMetadataPath,
    projectDataMetadataPath,
    dataDockMetadataPath,
    inspectorDockMetadataPath,
    inspectorPropertyMetadataPath,
    trimOperationMetadataPath,
    inspectorPropertyBindingsPath,
    generatedPropertyBindingsPath,
    generatedPropertiesPanelPath,
    modelBrowserPath,
    modelBrowserMetadataPath,
    smartComponentBrowserMetadataPath,
    leftDockResultMetadataPath,
    commandPaletteMetadataPath,
    modelCollectionMetadataPath,
    snapMetadataPath,
    settingsStripMetadataPath,
    viewMetadataPath,
    workspaceStoragePath,
    workspaceCustomizerPath,
    snapSelectionManagerPath,
    iconRegistryPath,
    workspace,
    workspaceSchema,
    registry,
    commandGroupMetadata,
    bottomStripMetadata,
    dataSurfaceMetadata,
    projectDataMetadata,
    dataDockMetadata,
    inspectorDockMetadata,
    inspectorPropertyMetadata,
    trimOperationMetadata,
    inspectorPropertyBindings,
    generatedPropertyBindings,
    modelBrowser,
    modelBrowserMetadata,
    smartComponentBrowserMetadata,
    leftDockResultMetadata,
    commandPaletteMetadata,
    modelCollectionMetadata,
    snapMetadata,
    settingsStripMetadata,
    viewMetadata,
    workspaceStorage,
    workspaceCustomizer,
    snapSelectionManager,
    iconRegistry,
    commands,
    commandIdPattern,
    commandIds,
    defaultToolbarIds,
    commandById,
    featureNavbarCommands,
    iconNames,
    groupIds
  } = context;
  const primaryActions = inspectorPropertyMetadata.inspectorPrimaryActions?.();
  const plateQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "plate-a",
    objectDetail: { sketchMode: "relations", sketchSelection: ["edge-a"] },
    entry: { collection: "plates" },
    rootSmartComponent: { id: "component-a" }
  });
  const objectPlateSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "plates",
    objectId: "plate-a",
    objectDetail: { sketchMode: "relations" },
    object: {
      id: "plate-a",
      type: "plate",
      thickness: 8,
      material: "S355"
    },
    objectState: {
      definition: {
        label: "Under-defined",
        degreesOfFreedom: 2,
        relationCount: 5,
        independentConstraintCount: 4,
        variableCount: 8,
        underDefinedVertexIds: ["v1"],
        underDefinedEdgeIds: ["e1"]
      },
      outlineVertices: 4,
      bends: []
    }
  });
  const objectPlateFields = objectPlateSections?.flatMap((section) => section.fields || []) || [];
  if (
    JSON.stringify(objectPlateSections?.map((section) => section.id)) !== JSON.stringify([
      "inspector.properties.object.plate",
      "inspector.properties.object.plate.sketch",
      "inspector.properties.object.plate.bends"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlateSections)
    || !objectPlateFields.some((field) => field.commit?.action === "object.plate.update" && field.label === "Thickness")
    || !objectPlateFields.some((field) => field.action === "object.plate.relations.toggle" && field.pressed === true)
    || !objectPlateFields.some((field) => field.type === "action" && field.action === "object.plate.relations.infer" && field.payload?.objectId === "plate-a" && field.icon === "relation")
  ) {
    fail(errors, `inspector-property-metadata plate generated Properties must expose serializable plate/sketch/bend descriptors: ${JSON.stringify(objectPlateSections)}`);
  }
  const objectPlateWithBendsSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "plates",
    objectId: "plate-b",
    object: {
      id: "plate-b",
      type: "plate",
      thickness: 10,
      material: "S355",
      fabrication: {
        reliefDefaults: { type: "round", size: 1 }
      }
    },
    objectState: {
      definition: { label: "Defined", relationCount: 6, independentConstraintCount: 6, variableCount: 6 },
      outlineVertices: 4,
      bends: [
        { id: "bend-a", edgeId: "edge-a", direction: "up", angle: 90, radius: 2, flangeLength: 50, targetLabel: "1. edge-a" },
        { id: "bend-b", edgeId: "edge-b", direction: "down", angle: 45, radius: 3, flangeLength: 75, targetLabel: "2. edge-b" }
      ],
      resolvedReliefDefaults: {
        type: "circular",
        size: 1,
        radius: 10,
        clearance: 0,
        flangeGap: 0,
        flangeGapMode: "symmetric",
        flangeGapSwapped: false,
        diagnostics: [],
        properties: [
          { key: "size", sourceKey: "size", label: "Size", kind: "number", required: true, value: 1 },
          { key: "flangeGap", sourceKey: "flangeGap", label: "Flange gap", kind: "signed-number", required: false, value: 0 },
          { key: "flangeGapMode", sourceKey: "flangeGapMode", label: "Flange offset", kind: "select", required: false, value: "symmetric" },
          { key: "flangeGapSwapped", sourceKey: "flangeGapSwapped", label: "Swap", kind: "boolean", required: false, value: false }
        ]
      },
      cornerReliefs: [
        {
          id: "corner_relief_vertex-a",
          vertexId: "vertex-a",
          incomingBendId: "bend-a",
          outgoingBendId: "bend-b",
          source: "default",
          relief: { type: "round", size: 1 },
          resolvedRelief: {
            type: "circular",
            size: 1,
            radius: 10,
            clearance: 0,
            flangeGap: 0,
            flangeGapMode: "symmetric",
            flangeGapSwapped: false,
            diagnostics: [],
            properties: [
              { key: "size", sourceKey: "size", label: "Size", kind: "number", required: true, value: 1 },
              { key: "flangeGap", sourceKey: "flangeGap", label: "Flange gap", kind: "signed-number", required: false, value: 0 },
              { key: "flangeGapMode", sourceKey: "flangeGapMode", label: "Flange offset", kind: "select", required: false, value: "symmetric" },
              { key: "flangeGapSwapped", sourceKey: "flangeGapSwapped", label: "Swap", kind: "boolean", required: false, value: false }
            ]
          }
        }
      ]
    }
  });
  const objectPlateBendSections = objectPlateWithBendsSections?.filter((section) => section.id?.startsWith("inspector.properties.object.plate.bend.")) || [];
  const objectPlateBendFields = objectPlateBendSections.flatMap((section) => section.fields || []);
  const objectPlateCornerReliefFields = objectPlateWithBendsSections?.filter((section) => section.id?.includes("cornerRelief")).flatMap((section) => section.fields || []) || [];
  const objectPlateCornerReliefTypeFields = objectPlateCornerReliefFields.filter((field) => field.label === "Type");
  if (
    objectPlateBendSections.length !== 2
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlateWithBendsSections)
    || objectPlateCornerReliefTypeFields.some((field) => (
      field.value === "round"
        || field.value === "rect"
        || field.options?.some((option) => option.id === "round" || option.id === "rect" || String(option.label || "").includes("legacy"))
    ))
    || objectPlateCornerReliefTypeFields.length !== 1
    || !objectPlateCornerReliefTypeFields.some((field) => field.value === "circular" && JSON.stringify(field.commit?.patchPath) === JSON.stringify(["fabrication", "reliefDefaults", "type"]))
    || !objectPlateCornerReliefFields.some((field) => field.label === "Size" && field.value === 1 && field.commit?.action === "object.plate.update" && JSON.stringify(field.commit?.patchPath) === JSON.stringify(["fabrication", "reliefDefaults", "size"]))
    || !objectPlateCornerReliefFields.some((field) => field.label === "Flange gap" && field.value === 0 && field.commit?.action === "object.plate.update" && JSON.stringify(field.commit?.patchPath) === JSON.stringify(["fabrication", "reliefDefaults", "flangeGap"]))
    || !objectPlateCornerReliefFields.some((field) => field.label === "Flange offset" && field.value === "symmetric" && field.commit?.action === "object.plate.update" && JSON.stringify(field.commit?.patchPath) === JSON.stringify(["fabrication", "reliefDefaults", "flangeGapMode"]))
    || objectPlateCornerReliefFields.some((field) => ["Default Radius", "Corner Radius", "Default Flange offset", "Corner Flange offset", "Default Swap", "Corner Swap", "Radius", "Width", "Depth", "Kerf", "Clearance", "Flange gap / overlap", "Swap"].includes(field.label))
    || !objectPlateBendFields.some((field) => field.label === "Remove Bend" && field.icon === "cancel" && field.action === "object.plate.bend.remove" && field.payload?.bendId === "bend-a")
    || !objectPlateBendFields.some((field) => field.label === "Direction" && field.commit?.bend?.id === "bend-b")
  ) {
    fail(errors, `inspector-property-metadata plate bend generated Properties must cover bend edit/remove and plate corner relief descriptors: ${JSON.stringify(objectPlateWithBendsSections)}`);
  }
  const objectFeatureSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "features",
    objectId: "feature-a",
    object: {
      id: "feature-a",
      type: "boolean-part",
      operationEnabled: true,
      booleanType: "BOOLEAN_CUT",
      cutKind: "csg",
      body: { type: "box", center: [0, 0, 0], size: [10, 20, 30] },
      source: { memberId: "member-a" }
    }
  });
  const objectFeatureFields = objectFeatureSections?.flatMap((section) => section.fields || []) || [];
  const centerXField = objectFeatureFields.find((field) => field.label === "Center X");
  if (
    !Array.isArray(objectFeatureSections)
    || !objectFeatureSections.length
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectFeatureSections)
    || centerXField?.value !== 0
    || centerXField?.commit?.action !== "object.feature.body.update"
    || JSON.stringify(centerXField?.commit?.vectorValue) !== JSON.stringify([0, 0, 0])
    || !objectFeatureFields.some((field) => field.action === "object.feature.openEditor")
  ) {
    fail(errors, `inspector-property-metadata object dispatcher must expose serializable object descriptors and preserve zero vectors: ${JSON.stringify(objectFeatureSections)}`);
  }
  const boundObjectFeatureSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectFeatureSections, {
    commits: {
      "object.feature.operationEnabled.set": () => "enabled",
      "object.feature.update": () => "feature",
      "object.feature.body.update": () => "body"
    },
    actions: { "object.feature.openEditor": () => "editor" }
  }) || [];
  const boundObjectFeatureFields = boundObjectFeatureSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectFeatureFields.find((field) => field.label === "Center X")?.onChange !== "function"
    || typeof boundObjectFeatureFields.find((field) => field.action === "object.feature.openEditor")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach object-property handlers from metadata intents: ${JSON.stringify(boundObjectFeatureSections)}`);
  }
  const trimJointFixture = {
    id: "trim-a",
    type: "corner-trim",
    participants: [
      { memberId: "beam-a" },
      { memberId: "column-b" }
    ],
    operations: [
      {
        id: "cut-a",
        type: "end-miter",
        enabled: true,
        gap: 5,
        memberAId: "beam-a",
        memberAEnd: "end",
        memberBId: "column-b",
        memberBEnd: "start",
        miterMode: "equal-angle"
      },
      {
        id: "plane-a",
        type: "plane-trim",
        enabled: true,
        gap: 2,
        memberAId: "beam-a",
        memberAEnd: "end",
        referencePlaneIds: ["plane-1"],
        removedRegionKeys: ["plane-1:-"]
      }
    ]
  };
  const objectTrimSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "trimJoints",
    objectId: "trim-a",
    objectDetail: { operationId: "cut-a" },
    object: trimJointFixture
  });
  const objectTrimFields = objectTrimSections?.flatMap((section) => section.fields || []) || [];
  const trimCutSelector = objectTrimFields.find((field) => field.type === "tabList" && field.label === "Cuts");
  const trimTypeField = objectTrimFields.find((field) => field.type === "optionGrid" && field.label === "Type");
  if (
    JSON.stringify(objectTrimSections?.map((section) => section.id)) !== JSON.stringify([
      "inspector.properties.object.trimJoint.overview",
      "inspector.properties.object.trimJoint.cuts",
      "inspector.properties.object.trimJoint.participants",
      "inspector.properties.object.trimJoint.operation"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectTrimSections)
    || trimCutSelector?.commit?.action !== "object.trimJoint.operation.select"
    || JSON.stringify(trimCutSelector?.options?.map((option) => option.id)) !== JSON.stringify(["cut-a", "plane-a"])
    || trimTypeField?.commit?.action !== "object.trimJoint.operation.type.set"
    || trimTypeField?.commit?.operationId !== "cut-a"
    || !trimTypeField?.options?.some((option) => option.id === "end-miter" && option.icon === "trim-miter")
    || trimTypeField?.options?.some((option) => option.id === "plane-trim")
    || !objectTrimFields.some((field) => field.type === "objectRef" && field.label === "Member A" && field.value === "beam-a")
    || !objectTrimFields.some((field) => field.type === "segmented" && field.label === "Member A end" && field.commit?.patchKey === "memberAEnd")
    || !objectTrimFields.some((field) => field.type === "segmented" && field.label === "Miter" && field.commit?.patchKey === "miterMode")
  ) {
    fail(errors, `inspector-property-metadata trim joint generated Properties must expose cut selection, type grid, member refs, and common trim controls: ${JSON.stringify(objectTrimSections)}`);
  }
  const objectPlaneTrimSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "trimJoints",
    objectId: "trim-a",
    objectDetail: { operationId: "plane-a" },
    object: trimJointFixture
  });
  const objectPlaneTrimFields = objectPlaneTrimSections?.flatMap((section) => section.fields || []) || [];
  if (
    generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectPlaneTrimSections)
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Type" && field.actions?.some((action) => action.action === "object.trim.openEditor" && action.payload?.detail?.operationId === "plane-a"))
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Planes" && field.actions?.some((action) => action.payload?.detail?.operationId === "plane-a"))
    || !objectPlaneTrimFields.some((field) => field.type === "actionList" && field.label === "Regions" && field.actions?.some((action) => action.payload?.detail?.regionKey === "plane-1:-"))
  ) {
    fail(errors, `inspector-property-metadata plane trim generated Properties must expose advanced-editor actions for type, planes, and regions: ${JSON.stringify(objectPlaneTrimSections)}`);
  }
  const boundObjectTrimSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectTrimSections, {
    commits: {
      "object.trimJoint.operation.select": () => "select",
      "object.trimJoint.operation.type.set": () => "type",
      "object.trimJoint.operation.update": () => "update"
    },
    actions: {
      "object.trim.openEditor": () => "editor",
      "objectRef.select": () => "selectObject",
      "objectRef.fit": () => "fitObject"
    }
  }) || [];
  const boundObjectTrimFields = boundObjectTrimSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectTrimFields.find((field) => field.type === "tabList")?.onChange !== "function"
    || typeof boundObjectTrimFields.find((field) => field.type === "optionGrid")?.onChange !== "function"
    || typeof boundObjectTrimFields.find((field) => field.label === "Member A")?.actions?.[0]?.onClick !== "function"
    || typeof boundObjectTrimFields.find((field) => field.label === "Miter")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach trim joint property handlers from metadata intents: ${JSON.stringify(boundObjectTrimSections)}`);
  }
  const featureEditorSections = inspectorPropertyMetadata.inspectorFeatureEditorSections?.({
    id: "feature-a",
    type: "boolean-part",
    ownerId: "member-a",
    operationEnabled: true,
    booleanType: "BOOLEAN_CUT",
    source: { kind: "member-profile", memberId: "member-a" },
    body: {
      type: "polygonal-prism",
      center: [0, 0, 0],
      depth: 25,
      axisX: [1, 0, 0],
      axisY: [0, 1, 0],
      axisZ: [0, 0, 1],
      outline: [[0, 0], [100, 0], [100, 50]]
    }
  });
  const featureEditorNestedSections = featureEditorSections?.flatMap((section) => section.sections || []) || [];
  const featureEditorFields = [
    ...(featureEditorSections?.flatMap((section) => section.fields || []) || []),
    ...featureEditorNestedSections.flatMap((section) => section.fields || [])
  ];
  const featureEditorAxisFields = featureEditorNestedSections.find((section) => section.id === "feature.body.axes")?.fields || [];
  const featureEditorOutlineFields = featureEditorNestedSections.find((section) => section.id === "feature.body.outline")?.fields || [];
  const featureEditorBooleanField = featureEditorFields.find((field) => field.label === "Boolean");
  const featureEditorSourceKindField = featureEditorFields.find((field) => field.label === "Kind");
  if (
    JSON.stringify(featureEditorSections?.map((section) => section.id)) !== JSON.stringify(["feature.overview", "feature.operation", "feature.source", "feature.body"])
    || !featureEditorSections?.find((section) => section.id === "feature.body")?.open
    || JSON.stringify(featureEditorNestedSections.map((section) => section.id)) !== JSON.stringify(["feature.body.axes", "feature.body.outline"])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(featureEditorSections)
    || JSON.stringify(featureEditorBooleanField?.options?.map((option) => option.id)) !== JSON.stringify(["BOOLEAN_CUT", "BOOLEAN_ADD", "BOOLEAN_WELDPREP"])
    || !featureEditorSourceKindField?.options?.some((option) => option.id === "member-profile")
    || !featureEditorFields.some((field) => field.label === "Enabled" && field.commit?.action === "feature.operationEnabled.set")
    || !featureEditorFields.some((field) => field.label === "Center" && field.commit?.action === "feature.body.update" && field.commit?.patchKey === "center")
    || !featureEditorFields.some((field) => field.label === "Member" && field.commit?.action === "feature.source.update" && field.commit?.patchKey === "memberId")
    || !["axisX", "axisY", "axisZ"].every((patchKey) => featureEditorAxisFields.some((field) => field.commit?.action === "feature.body.update" && field.commit?.patchKey === patchKey))
    || !featureEditorOutlineFields.every((field, index) => field.type === "vector2" && JSON.stringify(field.axisLabels) === JSON.stringify(["Y", "Z"]) && field.commit?.action === "feature.body.outlinePoint.update" && field.commit?.pointIndex === index)
  ) {
    fail(errors, `inspector-property-metadata Feature Editor sections must expose serializable focused editor descriptors: ${JSON.stringify(featureEditorSections)}`);
  }
  const featureEditorBindableSections = (featureEditorSections || []).flatMap((section) => [
    { ...section, sections: undefined },
    ...((section.sections || []).map((nestedSection) => ({ ...nestedSection, sections: undefined })))
  ]);
  const boundFeatureEditorSections = generatedPropertyBindings.bindGeneratedPropertySections?.(featureEditorBindableSections, {
    commits: {
      "feature.operationEnabled.set": () => "enabled",
      "feature.update": () => "feature",
      "feature.body.update": () => "body",
      "feature.body.outlinePoint.update": () => "outline",
      "feature.source.update": () => "source"
    }
  }) || [];
  const boundFeatureEditorFields = boundFeatureEditorSections.flatMap((section) => section.fields || []);
  if (
    typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.operationEnabled.set")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.update")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.patchKey === "axisX")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.body.outlinePoint.update")?.onChange !== "function"
    || typeof boundFeatureEditorFields.find((field) => field.commit?.action === "feature.source.update")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach Feature Editor handlers from metadata intents: ${JSON.stringify(boundFeatureEditorSections)}`);
  }
  const objectSketchSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "sketches",
    object: { id: "sketch-a", type: "sketch" },
    objectId: "sketch-a",
    objectState: {
      definition: { label: "Under-defined", degreesOfFreedom: 2 },
      outlineVertices: 4
    }
  });
  const objectSketchFields = objectSketchSections?.flatMap((section) => section.fields || []) || [];
  if (
    JSON.stringify(objectSketchSections?.map((section) => section.id)) !== JSON.stringify(["inspector.properties.object.sketch"])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectSketchSections)
    || !objectSketchFields.some((field) => field.label === "Status" && field.value === "Under-defined")
    || !objectSketchFields.some((field) => field.label === "Outline" && field.value === "4 vertices")
    || !objectSketchFields.some((field) => field.label === "Free DOF" && field.value === 2)
    || !objectSketchFields.some((field) => field.type === "action" && field.action === "object.sketch.createPlate" && field.payload?.objectId === "sketch-a" && field.icon === "plate" && field.primary === true && field.disabled !== true)
  ) {
    fail(errors, `inspector-property-metadata sketch generated Properties must come from objectState descriptors and expose sketch-to-plate intent: ${JSON.stringify(objectSketchSections)}`);
  }
  const objectFastenerSections = inspectorPropertyMetadata.inspectorObjectPropertySections?.({
    collection: "fastenerGroups",
    object: {
      id: "fastener-a",
      fastenerRef: "M16",
      holePatternRef: "holes-a",
      assembly: {
        length: 60,
        gripLength: 42,
        nutOffset: 5,
        washers: { head: true, nut: false }
      },
      participants: ["plate-a", "beam-a"],
      through: { fromFeatureId: "feature-from", toFeatureId: "feature-to" },
      orientation: { headSide: "front", axis: "x" }
    },
    catalogEntries: (catalog) => catalog === "fasteners" ? {
      M16: {
        id: "M16",
        kind: "bolt",
        standard: "ISO",
        grade: "8.8",
        shank: { diameter: 16 },
        hole: { defaultDiameter: 18, shape: "round" },
        washer: { outerDiameter: 30, thickness: 3 }
      }
    } : {},
    catalogOptions: () => [{ id: "M16", label: "M16" }, { id: "M20", label: "M20" }],
    fastenerLengthOptions: () => [{ id: "60", label: "60" }, { id: "80", label: "80" }]
  });
  const fastenerSectionIds = objectFastenerSections?.map((section) => section.id) || [];
  const objectFastenerFields = objectFastenerSections?.flatMap((section) => section.fields || []) || [];
  const fastenerCatalogField = objectFastenerFields.find((field) => field.label === "Fastener");
  const fastenerLengthField = objectFastenerFields.find((field) => field.label === "Length");
  const fastenerGripField = objectFastenerFields.find((field) => field.label === "Grip length");
  const fastenerHeadWasherField = objectFastenerFields.find((field) => field.label === "Head washer");
  const fastenerNutWasherField = objectFastenerFields.find((field) => field.label === "Nut washer");
  if (
    JSON.stringify(fastenerSectionIds) !== JSON.stringify([
      "inspector.properties.object.fastenerGroup.catalog",
      "inspector.properties.object.fastenerGroup.assembly",
      "inspector.properties.object.fastenerGroup.washers",
      "inspector.properties.object.fastenerGroup.installation"
    ])
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectFastenerSections)
    || fastenerCatalogField?.type !== "select"
    || fastenerCatalogField?.value !== "M16"
    || JSON.stringify(fastenerCatalogField?.options?.map((option) => option.id)) !== JSON.stringify(["M16", "M20"])
    || fastenerCatalogField?.commit?.action !== "object.fastenerGroup.update"
    || fastenerCatalogField?.commit?.patchKey !== "fastenerRef"
    || !objectFastenerFields.some((field) => field.label === "Kind" && field.value === "bolt")
    || !objectFastenerFields.some((field) => field.label === "Standard" && field.value === "ISO")
    || !objectFastenerFields.some((field) => field.label === "Grade" && field.value === "8.8")
    || !objectFastenerFields.some((field) => field.label === "Diameter" && field.value === "16")
    || !objectFastenerFields.some((field) => field.label === "Hole" && field.value === "18 round")
    || fastenerLengthField?.type !== "select"
    || fastenerLengthField?.value !== "60"
    || JSON.stringify(fastenerLengthField?.options?.map((option) => option.id)) !== JSON.stringify(["60", "80"])
    || fastenerLengthField?.commit?.action !== "object.fastenerGroup.update"
    || JSON.stringify(fastenerLengthField?.commit?.patchPath) !== JSON.stringify(["assembly", "length"])
    || fastenerLengthField?.commit?.valueType !== "number"
    || JSON.stringify(fastenerGripField?.commit?.patchPath) !== JSON.stringify(["assembly", "gripLength"])
    || fastenerHeadWasherField?.type !== "checkbox"
    || fastenerHeadWasherField?.value !== true
    || JSON.stringify(fastenerHeadWasherField?.commit?.patchPath) !== JSON.stringify(["assembly", "washers", "head"])
    || fastenerNutWasherField?.type !== "checkbox"
    || fastenerNutWasherField?.value !== false
    || JSON.stringify(fastenerNutWasherField?.commit?.patchPath) !== JSON.stringify(["assembly", "washers", "nut"])
    || !objectFastenerFields.some((field) => field.label === "Hole pattern" && field.value === "holes-a")
    || !objectFastenerFields.some((field) => field.label === "From feature" && field.value === "feature-from")
    || !objectFastenerFields.some((field) => field.label === "To feature" && field.value === "feature-to")
    || !objectFastenerFields.some((field) => field.label === "Head side" && field.value === "front")
    || !objectFastenerFields.some((field) => field.label === "Axis" && field.value === "x")
    || !objectFastenerFields.some((field) => field.label === "Participants" && field.value === "2")
    || !objectFastenerFields.some((field) => field.label === "Participant 2" && field.value === "beam-a")
    || !objectFastenerFields.some((field) => field.label === "Outer diameter" && field.value === "30")
    || !objectFastenerFields.some((field) => field.label === "Thickness" && field.value === "3")
  ) {
    fail(errors, `inspector-property-metadata fastener generated Properties must cover catalog, assembly, washers, and installation without legacy Advanced Object controls: ${JSON.stringify(objectFastenerSections)}`);
  }
  const boundObjectFastenerSections = generatedPropertyBindings.bindGeneratedPropertySections?.(objectFastenerSections, {
    commits: { "object.fastenerGroup.update": () => "fastener" }
  }) || [];
  const boundObjectFastenerFields = boundObjectFastenerSections.flatMap((section) => section.fields || []);
  if (
    typeof boundObjectFastenerFields.find((field) => field.label === "Fastener")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Length")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Head washer")?.onChange !== "function"
    || typeof boundObjectFastenerFields.find((field) => field.label === "Nut washer")?.onChange !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach fastener handlers from metadata intents: ${JSON.stringify(boundObjectFastenerSections)}`);
  }
  if (inspectorPropertyMetadata.inspectorMetadataLabel?.("member_end-id") !== "Member End Id") {
    fail(errors, "inspector-property-metadata metadata label formatter must normalize camel/kebab/snake labels");
  }
  if (inspectorPropertyMetadata.inspectorFormatNumber?.(12.34567) !== "12.346") {
    fail(errors, "inspector-property-metadata number formatter must keep inspector numeric precision stable");
  }
  if (inspectorPropertyMetadata.inspectorFormatVector?.([1, 2.34567, "A"]) !== "1, 2.346, A") {
    fail(errors, "inspector-property-metadata vector formatter must keep inspector vector display stable");
  }
  const metadataSection = inspectorPropertyMetadata.inspectorMetadataSection?.({
    id: "demo.authoring",
    object: { authoring: { createdBy: "test", offset: [1, 2] } }
  });
  if (
    metadataSection?.id !== "demo.authoring"
    || metadataSection?.open !== false
    || JSON.stringify(metadataSection.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["Created By", "test"],
      ["Offset", "1, 2"]
    ])
  ) {
    fail(errors, `inspector-property-metadata metadata section has unexpected shape: ${JSON.stringify(metadataSection)}`);
  }
  const supportActions = {
    objectIndex: {
      object_a: { collection: "plates", type: "plate" },
      object_b: { collection: "members", type: "beam" }
    },
    updateWorkPoint: () => {},
    updateReferencePlane: () => {},
    updateInterface: () => {},
    updateConnectionZone: () => {},
    updateAssembly: () => {},
    updateGroup: () => {},
    updateHolePattern: () => {},
    updateObjectPattern: () => {},
    selectObjectReference: () => {},
    focusObjectReference: () => {}
  };
  const supportCollections = {
    workPoints: { role: "grid", point: [1, 2, 3] },
    referencePlanes: { name: "Plane A", origin: [0, 0, 0], normal: [0, 0, 1], axisX: [1, 0, 0], axisY: [0, 1, 0], extents: { xMin: -100, xMax: 100 } },
    interfaces: { role: "face", origin: [0, 0, 0], normal: [0, 0, 1], localAxisY: [1, 0, 0], localAxisZ: [0, 1, 0], extents: { width: 50, height: 80 } },
    connectionZones: { name: "Zone A", origin: [0, 0, 0], interfaceIds: ["object_a"], objectIds: ["object_b"], smartComponentInstanceIds: [] },
    assemblies: { name: "Assembly A", partIds: ["object_a"], memberIds: ["object_b"] },
    groups: { name: "Group A", objectIds: ["object_a"] },
    holePatterns: { holeDiameter: 18, holeType: "round", positions: [[0, 0], [40, 0]] },
    objectPatterns: { name: "Pattern A", generatedObjectIds: ["object_a"], detachedObjectIds: ["object_b"], transform: { count: 2 } },
    relations: { label: "Relation A", source: { type: "global-axis", origin: [0, 0, 0] } }
  };
  const supportCommitHandlers = {
    "supportObject.workPoint.update": () => "workPoint",
    "supportObject.referencePlane.update": () => "referencePlane",
    "supportObject.interface.update": () => "interface",
    "supportObject.connectionZone.update": () => "connectionZone",
    "supportObject.assembly.update": () => "assembly",
    "supportObject.group.update": () => "group",
    "supportObject.holePattern.update": () => "holePattern",
    "supportObject.objectPattern.update": () => "objectPattern"
  };
  for (const [collection, object] of Object.entries(supportCollections)) {
    const sections = inspectorPropertyMetadata.inspectorSupportObjectPropertySections?.({ collection, object, actions: supportActions });
    if (!Array.isArray(sections) || !sections.length || !sections[0]?.id?.startsWith("inspector.properties.object.")) {
      fail(errors, `inspector-property-metadata support dispatcher returned unexpected sections for ${collection}: ${JSON.stringify(sections)}`);
    }
    if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(sections)) {
      fail(errors, `inspector-property-metadata support dispatcher must return serializable descriptors for ${collection}, not bound callbacks`);
    }
    const supportCommitFields = sections.flatMap((section) => section.fields || []).filter((field) => field?.commit);
    if (collection !== "relations" && !supportCommitFields.length) {
      fail(errors, `inspector-property-metadata support dispatcher must expose editable commit intents for ${collection}`);
    }
    const boundSupportSections = generatedPropertyBindings.bindGeneratedPropertySections?.(sections, { commits: supportCommitHandlers }) || [];
    const boundSupportCommitFields = boundSupportSections.flatMap((section) => section.fields || []).filter((field) => field?.commit);
    if (supportCommitFields.length !== boundSupportCommitFields.length || boundSupportCommitFields.some((field) => typeof field.onChange !== "function")) {
      fail(errors, `Generated Properties binding adapter must attach support-object handlers from serializable intents for ${collection}: ${JSON.stringify(boundSupportSections)}`);
    }
  }
  const objectReferenceSection = inspectorPropertyMetadata.inspectorObjectReferenceSection?.({
    id: "demo.refs",
    label: "References",
    values: ["object_a", "missing"],
    itemLabel: "Object",
    objectIndex: supportActions.objectIndex,
    onSelectObject: supportActions.selectObjectReference,
    onFitObject: supportActions.focusObjectReference
  });
  const firstObjectRef = objectReferenceSection?.fields?.[0];
  const missingObjectRef = objectReferenceSection?.fields?.[1];
  const firstObjectRefSelect = firstObjectRef?.actions?.find((action) => action.action === "objectRef.select");
  const firstObjectRefFit = firstObjectRef?.actions?.find((action) => action.action === "objectRef.fit");
  if (
    objectReferenceSection?.id !== "demo.refs"
    || firstObjectRef?.type !== "objectRef"
    || firstObjectRef?.icon !== modelCollectionMetadata.modelCollectionIcon("plates")
    || firstObjectRefSelect?.label !== "Select"
    || firstObjectRefSelect?.icon !== "selection"
    || firstObjectRefSelect?.payload?.objectId !== "object_a"
    || firstObjectRefFit?.label !== "Fit"
    || firstObjectRefFit?.icon !== "zoom-fit"
    || firstObjectRefFit?.payload?.objectId !== "object_a"
    || missingObjectRef?.actions?.length
  ) {
    fail(errors, `inspector-property-metadata object reference section has unexpected shape: ${JSON.stringify(objectReferenceSection)}`);
  }
  for (const action of [firstObjectRefSelect, firstObjectRefFit]) {
    if (!action?.action || !action?.label || !action?.icon || !iconNames.has(action.icon) || !action.payload) {
      fail(errors, `inspector-property-metadata object reference action must declare action, label, icon, and payload: ${JSON.stringify(action)}`);
    }
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(objectReferenceSection)) {
    fail(errors, "inspector-property-metadata object reference sections must expose serializable select/fit intents, not bound UI callbacks");
  }
  const boundObjectReferenceSection = generatedPropertyBindings.bindGeneratedPropertySections?.([objectReferenceSection], {
    actions: {
      "objectRef.select": () => "select",
      "objectRef.fit": () => "fit"
    }
  })?.[0];
  const boundObjectRefActions = boundObjectReferenceSection?.fields?.[0]?.actions || [];
  if (
    typeof boundObjectRefActions.find((action) => action.action === "objectRef.select")?.onClick !== "function"
    || typeof boundObjectRefActions.find((action) => action.action === "objectRef.fit")?.onClick !== "function"
    || boundObjectReferenceSection?.fields?.[0]?.onSelect
    || boundObjectReferenceSection?.fields?.[0]?.onFit
    || boundObjectReferenceSection?.fields?.[1]?.actions?.length
  ) {
    fail(errors, `Generated Properties binding adapter must attach object reference handlers from serializable intents: ${JSON.stringify(boundObjectReferenceSection)}`);
  }
  if (typeof inspectorPropertyBindings.createInspectorPropertyBindings !== "function" || typeof inspectorPropertyBindings.propertyPatch !== "function") {
    fail(errors, "inspector-property-bindings must export the generated Properties binding factory and patch helper");
  }
  const nestedPatch = inspectorPropertyBindings.propertyPatch?.(42, { patchPath: ["assembly", "length"] });
  const vectorPatch = inspectorPropertyBindings.propertyPatch?.(7, { patchKey: "center", vectorValue: [0, 0, 0], axisIndex: 1 });
  if (JSON.stringify(nestedPatch) !== JSON.stringify({ assembly: { length: 42 } }) || JSON.stringify(vectorPatch) !== JSON.stringify({ center: [0, 7, 0] })) {
    fail(errors, `inspector-property-bindings propertyPatch must preserve nested paths and zero vectors: ${JSON.stringify({ nestedPatch, vectorPatch })}`);
  }
  const bindingEvents = [];
  const inspectorBindings = inspectorPropertyBindings.createInspectorPropertyBindings?.({
    getSelection: () => ({
      memberId: "selected-member",
      smartComponentId: "selected-component",
      objectId: "selected-object",
      objectDetail: { operationId: "trim-1" }
    }),
    definition: (smartComponentId) => ({ type: smartComponentId }),
    refs: {
      selectSmartComponent: (smartComponentId) => bindingEvents.push(["selectSmartComponent", smartComponentId]),
      selectObjectReference: (objectId) => bindingEvents.push(["selectObject", objectId]),
      focusObjectReference: (objectId) => bindingEvents.push(["fit", objectId])
    },
    selectionActions: {
      pickMember: () => bindingEvents.push(["pickMember"]),
      pickSmartComponent: () => bindingEvents.push(["pickSmartComponent"]),
      pickObject: () => bindingEvents.push(["pickObject"]),
      fit: () => bindingEvents.push(["quickFit"]),
      clear: () => bindingEvents.push(["quickClear"]),
      selectSmartComponent: (smartComponentId) => bindingEvents.push(["quickComponent", smartComponentId]),
      openFeatureEditor: (objectId) => bindingEvents.push(["quickFeature", objectId]),
      openTrimEditor: (objectId, detail) => bindingEvents.push(["quickTrim", objectId, detail]),
      selectObjectDetail: (objectId, detail) => bindingEvents.push(["quickDetail", objectId, detail])
    },
    activeTool: {
      runCommand: (commandId) => bindingEvents.push(["toolCommand", commandId]),
      cycleSnap: () => bindingEvents.push(["toolCycleSnap"]),
      cancel: () => bindingEvents.push(["toolCancel"]),
      setSnapStrength: (strength) => bindingEvents.push(["toolStrength", strength]),
      setSelectionScope: (mode) => bindingEvents.push(["toolScope", mode]),
      setSnapTarget: (target, enabled) => bindingEvents.push(["toolTarget", target, enabled])
    },
    members: {
      setProfile: (memberId, profileId) => bindingEvents.push(["memberProfile", memberId, profileId]),
      setMaterial: (memberId, materialId) => bindingEvents.push(["memberMaterial", memberId, materialId]),
      setRotation: (memberId, rotation) => bindingEvents.push(["memberRotation", memberId, rotation]),
      setCenterCoordinate: (memberId, axisIndex, value) => bindingEvents.push(["memberCenter", memberId, axisIndex, value]),
      setEndpointCoordinate: (memberId, endpoint, axisIndex, value) => bindingEvents.push(["memberEndpoint", memberId, endpoint, axisIndex, value]),
      setCustomProfileDraft: (memberId, value) => bindingEvents.push(["memberCustomProfileDraft", memberId, value]),
      createCustomProfile: (memberId) => bindingEvents.push(["memberCreateCustomProfile", memberId]),
      removeRelation: (relationId, memberId) => bindingEvents.push(["memberRemoveRelation", memberId, relationId]),
      setAlignmentGlobalAxis: (memberId, axisId) => bindingEvents.push(["memberAxis", memberId, axisId]),
      pickAlignmentAxis: (memberId) => bindingEvents.push(["memberPickAxis", memberId]),
      clearAlignment: (memberId) => bindingEvents.push(["memberClearAlignment", memberId])
    },
    support: {
      updateWorkPoint: (patch) => bindingEvents.push(["workPoint", patch])
    },
    smartComponents: {
      updateParameter: (smartComponentId, definition, path, value) => bindingEvents.push(["parameter", smartComponentId, definition.type, path, value]),
      setRoleActive: (smartComponentId, role, active) => bindingEvents.push(["role", smartComponentId, role, active]),
      resetObjectOverrides: (smartComponentId, objectId) => bindingEvents.push(["reset", smartComponentId, objectId]),
      detachObject: (smartComponentId, objectId) => bindingEvents.push(["detach", smartComponentId, objectId]),
      reattachObject: (smartComponentId, objectId) => bindingEvents.push(["reattach", smartComponentId, objectId])
    },
    objects: {
      updateFastenerGroup: (patch) => bindingEvents.push(["fastener", patch]),
      updatePlatePatch: (patch) => bindingEvents.push(["plate", patch]),
      upsertPlateBend: (bend) => bindingEvents.push(["bend", bend]),
      removePlateBend: (bendId) => bindingEvents.push(["removeBend", bendId]),
      inferPlateSketchRelations: (objectId) => bindingEvents.push(["inferRelations", objectId]),
      createPlateFromSketch: (objectId) => bindingEvents.push(["createPlate", objectId]),
      selectTrimOperation: (operationId) => bindingEvents.push(["trimSelect", operationId]),
      setTrimOperationType: (operationId, type) => bindingEvents.push(["trimType", operationId, type]),
      setPlateSketchRelationValue: (value, commit) => bindingEvents.push(["relationValue", value, commit]),
      selectPlateSketchRelation: (payload) => bindingEvents.push(["relationSelect", payload]),
      setPlateSketchRelationMode: (payload) => bindingEvents.push(["relationMode", payload]),
      resolvePlateSketchRelation: (payload) => bindingEvents.push(["relationResolve", payload]),
      removePlateSketchRelation: (payload) => bindingEvents.push(["relationRemove", payload]),
      addPlateSketchRelation: (payload) => bindingEvents.push(["relationAdd", payload]),
      addPlateSketchConstructionLine: (payload) => bindingEvents.push(["constructionLine", payload]),
      fixPlateSketchUnderDefinedEntities: (payload) => bindingEvents.push(["underDefinedFix", payload]),
      removePlateSketchFixedRelations: (payload) => bindingEvents.push(["relationUnfixAll", payload]),
      selectObjectDetail: (objectId, detail) => bindingEvents.push(["detail", objectId, detail]),
      openTrimEditor: (objectId, detail) => bindingEvents.push(["trimEditor", objectId, detail]),
      openFeatureEditor: (objectId) => bindingEvents.push(["featureEditor", objectId])
    }
  });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.select"]({ payload: { smartComponentId: "component-ref" } });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.select"]({ payload: { objectId: "object-ref" } });
  inspectorBindings.generatedReferenceBindings().actions["objectRef.fit"]({ payload: { objectId: "fit-ref" } });
  inspectorBindings.generatedActiveToolBindings().runCommand("settings.snap.toggle");
  inspectorBindings.generatedActiveToolBindings().actions["activeTool.cycleSnap"]({});
  inspectorBindings.generatedActiveToolBindings().actions["activeTool.cancel"]({});
  inspectorBindings.generatedActiveToolBindings().commits["snapStrength.set"]("strong");
  inspectorBindings.generatedActiveToolBindings().commits["selectionScope.set"]("component");
  inspectorBindings.generatedActiveToolBindings().commits["snapTarget.set"](false, { target: "members" });
  inspectorBindings.generatedMemberBindings().commits["member.profile.set"]("IPE300", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().commits["member.material.set"]("S275", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().commits["member.rotation.set"](30, {});
  inspectorBindings.generatedMemberBindings().commits["member.centerCoordinate.set"](125, { memberId: "member-a", axisIndex: 0 });
  inspectorBindings.generatedMemberBindings().commits["member.endpointCoordinate.set"](250, { memberId: "member-a", endpoint: "end", axisIndex: 2 });
  inspectorBindings.generatedMemberBindings().commits["member.customProfileDraft.set"]("0 0\n1 0\n0 1", { memberId: "member-a" });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.setGlobalAxis"]({ payload: { memberId: "member-a", axisId: "z" } });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.pickAxis"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.alignment.clear"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.customProfile.create"]({ payload: { memberId: "member-a" } });
  inspectorBindings.generatedMemberBindings().actions["member.relation.remove"]({ payload: { memberId: "member-a", relationId: "relation-a" } });
  inspectorBindings.generatedSmartComponentBindings().commits["smartComponent.parameter.set"](12, { smartComponentId: "component-a", parameterPath: "plate.thickness" });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.objectOverrides.reset"]({ payload: { smartComponentId: "component-a", objectId: "object-a" } });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.object.detach"]({ payload: { smartComponentId: "component-a", objectId: "object-detach" } });
  inspectorBindings.generatedSmartComponentBindings().actions["smartComponent.object.reattach"]({ payload: { smartComponentId: "component-a", objectId: "object-reattach" } });
  inspectorBindings.generatedSupportObjectBindings().commits["supportObject.workPoint.update"](4, { patchKey: "role" });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.objectOverrides.reset"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-reset" } });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.object.detach"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-detach" } });
  inspectorBindings.generatedObjectBindings().actions["smartComponent.object.reattach"]({ payload: { smartComponentId: "component-b", objectId: "object-bound-reattach" } });
  inspectorBindings.generatedObjectBindings().commits["object.fastenerGroup.update"]("80", { patchPath: ["assembly", "length"], valueType: "number" });
  inspectorBindings.generatedObjectBindings().commits["object.fastenerGroup.update"](true, { patchPath: ["assembly", "washers", "head"] });
  inspectorBindings.generatedObjectBindings().commits["object.plate.bend.update"]("rect", { bend: { id: "bend-a", relief: { type: "round", width: 5 } }, patchPath: ["relief", "type"] });
  inspectorBindings.generatedObjectBindings().actions["object.plate.bend.remove"]({ payload: { bendId: "bend-remove" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.relations.infer"]({ payload: { objectId: "plate-a" } });
  inspectorBindings.generatedObjectBindings().commits["object.trimJoint.operation.select"]("trim-op-a");
  inspectorBindings.generatedObjectBindings().commits["object.trimJoint.operation.type.set"]("end-miter", { operationId: "trim-op-a" });
  inspectorBindings.generatedObjectBindings().commits["object.plate.sketchRelation.value.set"](42, { objectId: "plate-a", relationId: "relation-a" });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.select"]({ payload: { objectId: "plate-a", relationId: "relation-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.mode.set"]({ payload: { objectId: "plate-a", relationId: "relation-a", mode: "driven" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.resolve"]({ payload: { objectId: "plate-a", relationId: "relation-a", healthStatus: "conflicted" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.remove"]({ payload: { objectId: "plate-a", relationId: "relation-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelation.add"]({ payload: { objectId: "plate-a", relation: { type: "fixed", edgeId: "e1" } } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchConstructionLine.add"]({ payload: { objectId: "plate-a", from: [0, 0], to: [1, 1] } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchUnderDefined.fixRemaining"]({ payload: { objectId: "plate-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.plate.sketchRelations.unfixAll"]({ payload: { objectId: "plate-a" } });
  const boundRelationNestedField = generatedPropertyBindings.bindGeneratedPropertyField?.({
    type: "statusListCard",
    actions: [{ label: "Fix remaining", action: "object.plate.sketchUnderDefined.fixRemaining", payload: { objectId: "nested-plate" } }],
    actionGroups: [{ actions: [{ label: "Select", action: "object.plate.sketchRelation.select", payload: { relationId: "nested-relation" } }] }],
    groups: [{ rows: [{ actions: [{ label: "Fix", action: "object.plate.sketchRelation.add", payload: { relation: { type: "fixed", vertexId: "v1" } } }] }] }],
    fields: [{ type: "actionRow", actions: [{ label: "Construction line", action: "object.plate.sketchConstructionLine.add", payload: { objectId: "nested-plate", from: [0, 0], to: [2, 2] } }] }]
  }, inspectorBindings.generatedObjectBindings());
  boundRelationNestedField.actions?.[0]?.onClick?.();
  boundRelationNestedField.actionGroups?.[0]?.actions?.[0]?.onClick?.();
  boundRelationNestedField.groups?.[0]?.rows?.[0]?.actions?.[0]?.onClick?.();
  boundRelationNestedField.fields?.[0]?.actions?.[0]?.onClick?.();
  inspectorBindings.generatedObjectBindings().actions["object.sketch.createPlate"]({ payload: { objectId: "sketch-a" } });
  inspectorBindings.generatedObjectBindings().actions["object.trim.openEditor"]({ payload: { objectId: "trim-a", detail: { operationId: "trim-op-a" } } });
  const boundPrimaryActions = inspectorBindings.bindActionButtons(primaryActions);
  boundPrimaryActions.find((action) => action.action === "inspector.pickMember")?.onClick?.();
  boundPrimaryActions.find((action) => action.action === "inspector.pickSmartComponent")?.onClick?.();
  boundPrimaryActions.find((action) => action.action === "inspector.pickObject")?.onClick?.();
  const boundQuickActions = inspectorBindings.bindQuickActions([
    ...plateQuickActions,
    { action: "selection.feature.open", payload: { objectId: "feature-quick" }, label: "Feature" },
    { action: "selection.trim.open", payload: { objectId: "trim-quick", detail: { operationId: "quick-trim" } }, label: "Trim" }
  ]);
  boundQuickActions.find((action) => action.action === "selection.fit")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.smartComponent.open")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.plateRelations.toggle")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.clear")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.feature.open")?.onClick?.();
  boundQuickActions.find((action) => action.action === "selection.trim.open")?.onClick?.();
  if (
    !bindingEvents.some((event) => event[0] === "parameter" && event[1] === "component-a" && event[3] === "plate.thickness" && event[4] === 12)
    || !bindingEvents.some((event) => event[0] === "selectSmartComponent" && event[1] === "component-ref")
    || !bindingEvents.some((event) => event[0] === "selectObject" && event[1] === "object-ref")
    || !bindingEvents.some((event) => event[0] === "fit" && event[1] === "fit-ref")
    || !bindingEvents.some((event) => event[0] === "toolCommand" && event[1] === "settings.snap.toggle")
    || !bindingEvents.some((event) => event[0] === "toolCycleSnap")
    || !bindingEvents.some((event) => event[0] === "toolCancel")
    || !bindingEvents.some((event) => event[0] === "toolStrength" && event[1] === "strong")
    || !bindingEvents.some((event) => event[0] === "toolScope" && event[1] === "component")
    || !bindingEvents.some((event) => event[0] === "toolTarget" && event[1] === "members" && event[2] === false)
    || !bindingEvents.some((event) => event[0] === "memberProfile" && event[1] === "member-a" && event[2] === "IPE300")
    || !bindingEvents.some((event) => event[0] === "memberMaterial" && event[1] === "member-a" && event[2] === "S275")
    || !bindingEvents.some((event) => event[0] === "memberRotation" && event[1] === "selected-member" && event[2] === 30)
    || !bindingEvents.some((event) => event[0] === "memberCenter" && event[1] === "member-a" && event[2] === 0 && event[3] === 125)
    || !bindingEvents.some((event) => event[0] === "memberEndpoint" && event[1] === "member-a" && event[2] === "end" && event[3] === 2 && event[4] === 250)
    || !bindingEvents.some((event) => event[0] === "memberCustomProfileDraft" && event[1] === "member-a" && event[2] === "0 0\n1 0\n0 1")
    || !bindingEvents.some((event) => event[0] === "memberAxis" && event[1] === "member-a" && event[2] === "z")
    || !bindingEvents.some((event) => event[0] === "memberPickAxis" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberClearAlignment" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberCreateCustomProfile" && event[1] === "member-a")
    || !bindingEvents.some((event) => event[0] === "memberRemoveRelation" && event[1] === "member-a" && event[2] === "relation-a")
    || !bindingEvents.some((event) => event[0] === "reset" && event[1] === "component-a" && event[2] === "object-a")
    || !bindingEvents.some((event) => event[0] === "detach" && event[1] === "component-a" && event[2] === "object-detach")
    || !bindingEvents.some((event) => event[0] === "reattach" && event[1] === "component-a" && event[2] === "object-reattach")
    || !bindingEvents.some((event) => event[0] === "reset" && event[1] === "component-b" && event[2] === "object-bound-reset")
    || !bindingEvents.some((event) => event[0] === "detach" && event[1] === "component-b" && event[2] === "object-bound-detach")
    || !bindingEvents.some((event) => event[0] === "reattach" && event[1] === "component-b" && event[2] === "object-bound-reattach")
    || !bindingEvents.some((event) => event[0] === "workPoint" && event[1].role === 4)
    || !bindingEvents.some((event) => event[0] === "fastener" && event[1].assembly?.length === 80)
    || !bindingEvents.some((event) => event[0] === "fastener" && event[1].assembly?.washers?.head === true)
    || !bindingEvents.some((event) => event[0] === "bend" && event[1].relief?.type === "rect" && event[1].relief?.width === 5)
    || !bindingEvents.some((event) => event[0] === "removeBend" && event[1] === "bend-remove")
    || !bindingEvents.some((event) => event[0] === "inferRelations" && event[1] === "plate-a")
    || !bindingEvents.some((event) => event[0] === "trimSelect" && event[1] === "trim-op-a")
    || !bindingEvents.some((event) => event[0] === "trimType" && event[1] === "trim-op-a" && event[2] === "end-miter")
    || !bindingEvents.some((event) => event[0] === "relationValue" && event[1] === 42 && event[2].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationSelect" && event[1].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationMode" && event[1].mode === "driven")
    || !bindingEvents.some((event) => event[0] === "relationResolve" && event[1].healthStatus === "conflicted")
    || !bindingEvents.some((event) => event[0] === "relationRemove" && event[1].relationId === "relation-a")
    || !bindingEvents.some((event) => event[0] === "relationAdd" && event[1].relation?.edgeId === "e1")
    || !bindingEvents.some((event) => event[0] === "constructionLine" && event[1].from?.[0] === 0 && event[1].to?.[1] === 1)
    || !bindingEvents.some((event) => event[0] === "underDefinedFix" && event[1].objectId === "plate-a")
    || !bindingEvents.some((event) => event[0] === "relationUnfixAll" && event[1].objectId === "plate-a")
    || !bindingEvents.some((event) => event[0] === "underDefinedFix" && event[1].objectId === "nested-plate")
    || !bindingEvents.some((event) => event[0] === "relationSelect" && event[1].relationId === "nested-relation")
    || !bindingEvents.some((event) => event[0] === "relationAdd" && event[1].relation?.vertexId === "v1")
    || !bindingEvents.some((event) => event[0] === "constructionLine" && event[1].objectId === "nested-plate" && event[1].to?.[0] === 2)
    || !bindingEvents.some((event) => event[0] === "createPlate" && event[1] === "sketch-a")
    || !bindingEvents.some((event) => event[0] === "trimEditor" && event[1] === "trim-a" && event[2].operationId === "trim-op-a")
    || !boundPrimaryActions.every((action) => typeof action.onClick === "function")
    || !bindingEvents.some((event) => event[0] === "pickMember")
    || !bindingEvents.some((event) => event[0] === "pickSmartComponent")
    || !bindingEvents.some((event) => event[0] === "pickObject")
    || !boundQuickActions.every((action) => typeof action.onClick === "function")
    || !bindingEvents.some((event) => event[0] === "quickFit")
    || !bindingEvents.some((event) => event[0] === "quickComponent" && event[1] === "component-a")
    || !bindingEvents.some((event) => event[0] === "quickDetail" && event[1] === "plate-a" && event[2].clearSketchSelection === true)
    || !bindingEvents.some((event) => event[0] === "quickClear")
    || !bindingEvents.some((event) => event[0] === "quickFeature" && event[1] === "feature-quick")
    || !bindingEvents.some((event) => event[0] === "quickTrim" && event[1] === "trim-quick" && event[2].operationId === "quick-trim")
  ) {
    fail(errors, `inspector-property-bindings factory must route generated descriptor intents through supplied callbacks: ${JSON.stringify(bindingEvents)}`);
  }
}

module.exports = { checkInspectorObjectContracts };
