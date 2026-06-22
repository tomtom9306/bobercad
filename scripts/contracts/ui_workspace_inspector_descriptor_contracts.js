const fs = require("fs");
const path = require("path");
const { validateValue } = require("../validate_json_schema");
const { checkInspectorObjectContracts } = require("./ui_workspace_inspector_object_contracts");
const { ROOT, fail, parseModelCollections, readJson, stripCssComments, lineNumberAt } = require("./ui_contract_helpers");

function checkInspectorDescriptorContracts(context) {
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
  const objectApiText = fs.readFileSync(path.join(ROOT, "bobercad/app/engine/api/project/objects.mjs"), "utf8");
  const objectApiCollections = parseModelCollections(objectApiText);
  const metadataCollectionIds = (modelCollectionMetadata.MODEL_COLLECTION_SPECS || []).map((spec) => spec.id);
  if (JSON.stringify(metadataCollectionIds.slice().sort()) !== JSON.stringify(objectApiCollections.slice().sort())) {
    fail(errors, `model-collection-metadata must cover object API collections, got ${JSON.stringify(metadataCollectionIds)} expected ${JSON.stringify(objectApiCollections)}`);
  }
  const metadataGroupIds = new Set((modelCollectionMetadata.MODEL_COLLECTION_GROUP_SPECS || []).map((group) => group.id));
  const browserVisibilities = new Set(["primary", "advanced", "none"]);
  for (const spec of modelCollectionMetadata.MODEL_COLLECTION_SPECS || []) {
    if (!spec.id || !spec.label || !spec.singularLabel || !spec.icon || !spec.group) {
      fail(errors, `model-collection-metadata collection must declare id, label, singularLabel, icon, and group: ${JSON.stringify(spec)}`);
    }
    if (!metadataGroupIds.has(spec.group)) fail(errors, `model-collection-metadata collection ${spec.id} references unknown group ${spec.group}`);
    if (spec.icon && !iconNames.has(spec.icon)) fail(errors, `model-collection-metadata collection ${spec.id} references unknown icon: ${spec.icon}`);
    if (!browserVisibilities.has(spec.browserVisibility)) {
      fail(errors, `model-collection-metadata collection ${spec.id} has invalid browserVisibility: ${spec.browserVisibility}`);
    }
  }
  for (const advancedCollectionId of ["interfaces", "assemblies", "groups", "objectPatterns", "relations"]) {
    if (modelCollectionMetadata.modelCollectionBrowserVisibility?.(advancedCollectionId) !== "advanced") {
      fail(errors, `model-collection-metadata collection ${advancedCollectionId} must be advanced for the left Model Browser`);
    }
  }
  const modelSearchDescriptor = modelCollectionMetadata.modelObjectSearchDescriptor?.("members", "beam_1", {
    type: "beam",
    profileRef: "IPE300",
    materialRef: "S355",
    fabrication: {
      partMark: "B1",
      assemblyMark: "A100",
      numberingStatus: "preliminary"
    },
    componentRef: "portal_frame_1"
  }, {
    type: "indexed-beam",
    fastenerRef: "M16_8_8"
  });
  const modelSearchKeywords = modelSearchDescriptor?.keywords || [];
  if (
    modelSearchDescriptor?.label !== "beam_1"
    || modelSearchDescriptor?.type !== "beam"
    || !modelSearchDescriptor?.description?.includes("Part: B1")
    || !modelSearchDescriptor?.description?.includes("Assembly: A100")
    || !modelSearchDescriptor?.description?.includes("Numbering: preliminary")
    || !["beam_1", "members", "Member", "beam", "B1", "A100", "preliminary", "IPE300", "S355", "M16_8_8", "portal_frame_1"].every((keyword) => modelSearchKeywords.includes(keyword))
    || !modelSearchDescriptor?.searchText?.includes("Material: S355")
    || !Object.isFrozen(modelSearchDescriptor)
  ) {
    fail(errors, `model-collection-metadata must expose a frozen semantic object search descriptor, got ${JSON.stringify(modelSearchDescriptor)}`);
  }
  for (const spec of modelCollectionMetadata.MODEL_COLLECTION_SPECS || []) {
    const entry = { collection: spec.id, type: spec.singularLabel };
    const title = inspectorPropertyMetadata.inspectorObjectTitleForEntry?.(entry);
    const icon = inspectorPropertyMetadata.inspectorObjectIconForEntry?.(entry);
    if (title !== modelCollectionMetadata.modelCollectionLabel(spec.id, { singular: true })) {
      fail(errors, `inspector-property-metadata title for ${spec.id} must derive from model-collection-metadata`);
    }
    if (icon !== modelCollectionMetadata.modelCollectionIcon(spec.id)) {
      fail(errors, `inspector-property-metadata icon for ${spec.id} must derive from model-collection-metadata`);
    }
  }
  for (const helperName of [
    "inspectorEmptySelectionContext",
    "inspectorMemberContext",
    "inspectorMemberAdvancedSections",
    "inspectorMemberEditSections",
    "inspectorMemberIdentitySection",
    "inspectorActiveToolContext",
    "inspectorActiveToolSections",
    "inspectorPrimaryActions",
    "inspectorSelectionQuickActions",
    "inspectorSmartComponentContext",
    "inspectorSmartComponentDiagnosticsSummary",
    "inspectorSmartComponentIdentitySection",
    "inspectorSmartComponentPropertySections",
    "inspectorObjectGeneratedBySection",
    "inspectorObjectContext",
    "inspectorObjectIdentitySection",
    "inspectorFeatureEditorSections",
    "inspectorObjectTitleForEntry",
    "inspectorObjectIconForEntry",
    "inspectorObjectReferenceSection",
    "inspectorIdListSection",
    "inspectorMetadataSection",
    "inspectorAssemblyContentIds",
    "inspectorFlattenSmartComponentObjectIds",
    "inspectorMetadataLabel",
    "inspectorFormatNumber",
    "inspectorFormatVector",
    "inspectorFormatKeyValues",
    "inspectorFormatPointBounds",
    "inspectorSupportObjectPropertySections",
    "normalizeInspectorPropertySections",
    "normalizeInspectorPropertySection"
  ]) {
    if (typeof inspectorPropertyMetadata[helperName] !== "function") {
      fail(errors, `inspector-property-metadata must export ${helperName}`);
    }
  }
  if (
    !Array.isArray(inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS)
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("primary")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("advanced")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_LEVELS.includes("diagnostic")
    || !Array.isArray(inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS)
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS.includes("main")
    || !inspectorPropertyMetadata.INSPECTOR_SECTION_PLACEMENTS.includes("diagnostics")
  ) {
    fail(errors, "inspector-property-metadata must declare section levels and placements for generated property descriptors");
  }
  const normalizedInspectorSections = inspectorPropertyMetadata.normalizeInspectorPropertySections?.([
    { id: "primary", label: "Primary", fields: [{ label: "Name", value: "A" }] },
    { id: "advanced", label: "Advanced", open: false, fields: [{ label: "Hidden", value: "B" }] },
    { id: "diagnostics", label: "Diagnostics", fields: [{ type: "message", state: "error", value: "Broken" }] },
    { id: "raw-row-escape", label: "Raw Rows", rows: [{ label: "Raw" }] }
  ]);
  const normalizedRawRowSection = normalizedInspectorSections?.find((section) => section.id === "raw-row-escape");
  if (
    normalizedInspectorSections?.[0]?.level !== "primary"
    || normalizedInspectorSections?.[0]?.placement !== "main"
    || normalizedInspectorSections?.[0]?.priority !== 0
    || normalizedInspectorSections?.[1]?.level !== "advanced"
    || normalizedInspectorSections?.[2]?.level !== "diagnostic"
    || normalizedInspectorSections?.[2]?.placement !== "diagnostics"
    || Object.hasOwn(normalizedRawRowSection || {}, "rows")
  ) {
    fail(errors, `generated inspector sections must normalize level, placement, and priority metadata: ${JSON.stringify(normalizedInspectorSections)}`);
  }
  for (const [relative, forbidden] of [
    ["bobercad/app/ui/commands/inspector-property-metadata.mjs", ["../engine/", "../../engine/", "../rendering/", "../../rendering/", "viewer-runtime", "buildScene", "createWebglViewer"]],
    ["bobercad/app/ui/viewer/panels/generated-properties-panel.mjs", ["../engine/", "../../engine/", "../../../engine/", "../rendering/", "../../rendering/", "../../../rendering/", "api.", "buildScene", "createWebglViewer"]],
    ["bobercad/app/ui/viewer/panels/panel-elements.mjs", ["../engine/", "../../engine/", "../../../engine/", "../rendering/", "../../rendering/", "../../../rendering/", "api.", "buildScene", "createWebglViewer"]]
  ]) {
    const textContent = fs.readFileSync(path.join(ROOT, relative), "utf8");
    for (const token of forbidden) {
      if (textContent.includes(token)) fail(errors, `${relative}: generated inspector/property UI must stay descriptor-driven and not depend on engine/rendering/viewer code: ${token}`);
    }
  }
  const generatedPropertiesPanelText = fs.readFileSync(path.join(ROOT, "bobercad/app/ui/viewer/panels/generated-properties-panel.mjs"), "utf8");
  if (
    !generatedPropertiesPanelText.includes("normalizeInspectorPropertySections")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionLevel")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionPlacement")
    || !generatedPropertiesPanelText.includes("dataset.inspectorSectionPriority")
    || !generatedPropertiesPanelText.includes("propertiesPanelShell")
  ) {
    fail(errors, "Generated properties panel must normalize section descriptors, route through the shared panel shell, and expose level/placement/priority for progressive disclosure");
  }
  const emptyContext = inspectorPropertyMetadata.inspectorEmptySelectionContext?.();
  if (emptyContext?.title !== "No selection" || emptyContext?.icon !== "inspector") {
    fail(errors, `inspector-property-metadata empty context has unexpected shape: ${JSON.stringify(emptyContext)}`);
  }
  const memberContext = inspectorPropertyMetadata.inspectorMemberContext?.({
    memberId: "member-a",
    member: { type: "beam", material: "S355" }
  });
  if (
    memberContext?.title !== modelCollectionMetadata.modelCollectionLabel("members", { singular: true })
    || memberContext?.subtitle !== "member-a"
    || memberContext?.icon !== modelCollectionMetadata.modelCollectionIcon("members")
  ) {
    fail(errors, `inspector-property-metadata member context must derive from model-collection-metadata: ${JSON.stringify(memberContext)}`);
  }
  const activeToolContext = inspectorPropertyMetadata.inspectorActiveToolContext?.({
    command: { id: "model.beam.create", label: "Beam", title: "Create beam", description: "Create a beam from two picked points.", icon: "beam" }
  });
  const activeToolHintCommandIds = inspectorPropertyMetadata.ACTIVE_TOOL_HINT_COMMAND_IDS || [];
  const modelingCommandIds = (registry.MODELING_TOOLBAR_COMMANDS || []).map((command) => command.id);
  if (JSON.stringify(activeToolHintCommandIds) !== JSON.stringify(modelingCommandIds)) {
    fail(errors, `inspector-property-metadata active tool hints must cover modeling toolbar commands exactly: ${JSON.stringify({ activeToolHintCommandIds, modelingCommandIds })}`);
  }
  const activeToolSections = inspectorPropertyMetadata.inspectorActiveToolSections?.({
    command: { id: "model.beam.create", label: "Beam", title: "Create beam", description: "Create a beam from two picked points.", icon: "beam", keyFallback: "B" },
    commandState: { active: true, activeCommandId: "model.beam.create" },
    toolState: { status: "Beam: pick start point", canCycleSnap: true, needsPointerHit: true },
    snapSettings: { strength: "strong", scope: { members: true, selectedObjectsOnly: true, selectedObjectIds: ["member-a"] } },
    selectionState: { selectedObjectIds: ["member-a"] },
    canCancel: true,
    canCycleSnap: true,
    canOpenSnapSettings: true,
    canSnapStrengthChange: true,
    canSnapScopeChange: true,
    canSnapTargetChange: true
  });
  const activeToolSectionIds = activeToolSections?.map((section) => section.id) || [];
  const activeToolCurrent = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.current");
  const activeToolPrecision = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.precision");
  const activeToolSnapTargets = activeToolSections?.find((section) => section.id === "inspector.properties.activeTool.snapTargets");
  const activeToolCycleSnapField = activeToolCurrent?.fields?.find((field) => field.type === "action" && field.icon === "snap");
  const activeToolCancelField = activeToolCurrent?.fields?.find((field) => field.type === "action" && field.icon === "cancel");
  const activeToolStrengthField = activeToolPrecision?.fields?.find((field) => field.type === "select" && field.label === "Snap strength");
  const activeToolScopeField = activeToolPrecision?.fields?.find((field) => field.type === "select" && field.label === "Selection scope");
  const activeToolSettingsField = activeToolPrecision?.fields?.find((field) => field.type === "action" && field.label === "Open Snap Settings");
  if (
    activeToolContext?.title !== "Beam"
    || activeToolContext?.icon !== "beam"
    || activeToolContext?.badges?.[0]?.label !== "Active"
    || activeToolCurrent?.id !== "inspector.properties.activeTool.current"
    || activeToolCancelField?.action !== "activeTool.cancel"
    || activeToolCycleSnapField?.action !== "activeTool.cycleSnap"
    || !activeToolSectionIds.includes("inspector.properties.activeTool.guidance")
    || !activeToolSectionIds.includes("inspector.properties.activeTool.precision")
    || !activeToolSectionIds.includes("inspector.properties.activeTool.snapTargets")
    || activeToolStrengthField?.value !== "strong"
    || activeToolStrengthField?.commit?.action !== "snapStrength.set"
    || activeToolScopeField?.value !== "selected"
    || activeToolScopeField?.commit?.action !== "selectionScope.set"
    || activeToolSettingsField?.commandId !== "settings.snap.toggle"
    || activeToolSnapTargets?.open !== false
    || activeToolSnapTargets?.fields?.length !== (snapMetadata.SNAP_TARGET_SPECS || []).length
    || !activeToolSnapTargets?.fields?.every((field) => field.type === "checkbox" && field.commit?.action === "snapTarget.set" && field.commit?.target)
  ) {
    fail(errors, `inspector-property-metadata active tool context/sections have unexpected shape: ${JSON.stringify({ activeToolContext, activeToolSections })}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(activeToolSections)) {
    fail(errors, "inspector-property-metadata active tool sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const primaryActions = inspectorPropertyMetadata.inspectorPrimaryActions?.();
  if (
    JSON.stringify(primaryActions?.map((action) => action.label)) !== JSON.stringify(["Pick Member", "Pick Smart Component", "Pick Object", "Clear"])
    || JSON.stringify(primaryActions?.map((action) => action.action)) !== JSON.stringify(["inspector.pickMember", "inspector.pickSmartComponent", "inspector.pickObject", "selection.clear"])
    || !primaryActions?.every((action) => action.icon && action.title)
  ) {
    fail(errors, `inspector-property-metadata primary actions have unexpected descriptor shape: ${JSON.stringify(primaryActions)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(primaryActions)) {
    fail(errors, "inspector-property-metadata primary actions must expose serializable descriptors, not bound UI callbacks");
  }
  const plateQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "plate-a",
    objectDetail: { sketchMode: "relations", sketchSelection: ["edge-a"] },
    entry: { collection: "plates" },
    rootSmartComponent: { id: "component-a" }
  });
  const trimQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "trim-a",
    objectDetail: { operationId: "trim-1" },
    entry: { collection: "trimJoints" }
  });
  const featureQuickActions = inspectorPropertyMetadata.inspectorSelectionQuickActions?.({
    objectId: "feature-a",
    entry: { collection: "features" }
  });
  if (
    JSON.stringify(plateQuickActions?.map((action) => action.label)) !== JSON.stringify(["Fit", "Component", "Relations", "Clear"])
    || plateQuickActions?.[1]?.action !== "selection.smartComponent.open"
    || plateQuickActions?.[1]?.payload?.smartComponentId !== "component-a"
    || plateQuickActions?.[2]?.action !== "selection.plateRelations.toggle"
    || plateQuickActions?.[2]?.pressed !== true
    || plateQuickActions?.[2]?.payload?.detail?.sketchMode !== "clean"
    || plateQuickActions?.[2]?.payload?.detail?.clearSketchSelection !== true
    || trimQuickActions?.[1]?.action !== "selection.trim.open"
    || trimQuickActions?.[1]?.payload?.detail?.operationId !== "trim-1"
    || featureQuickActions?.[1]?.action !== "selection.feature.open"
    || inspectorPropertyMetadata.inspectorSelectionQuickActions?.()?.length
  ) {
    fail(errors, `inspector-property-metadata selection quick actions have unexpected descriptor shape: ${JSON.stringify({ plateQuickActions, trimQuickActions, featureQuickActions })}`);
  }
  if (
    generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(plateQuickActions)
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(trimQuickActions)
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(featureQuickActions)
  ) {
    fail(errors, "inspector-property-metadata selection quick actions must expose serializable descriptors, not bound UI callbacks");
  }
  const boundActiveToolSections = generatedPropertyBindings.bindGeneratedPropertySections?.(activeToolSections, {
    runCommand: () => "command",
    actions: {
      "activeTool.cancel": () => "cancel",
      "activeTool.cycleSnap": () => "cycle"
    },
    commits: {
      "snapStrength.set": () => "strength",
      "selectionScope.set": () => "scope",
      "snapTarget.set": () => "target"
    }
  }) || [];
  const boundActiveToolCurrent = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.current");
  const boundActiveToolPrecision = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.precision");
  const boundActiveToolSnapTargets = boundActiveToolSections.find((section) => section.id === "inspector.properties.activeTool.snapTargets");
  if (
    typeof boundActiveToolCurrent?.fields?.find((field) => field.action === "activeTool.cancel")?.onClick !== "function"
    || typeof boundActiveToolCurrent?.fields?.find((field) => field.action === "activeTool.cycleSnap")?.onClick !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commit?.action === "snapStrength.set")?.onChange !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commit?.action === "selectionScope.set")?.onChange !== "function"
    || typeof boundActiveToolPrecision?.fields?.find((field) => field.commandId === "settings.snap.toggle")?.onClick !== "function"
    || !boundActiveToolSnapTargets?.fields?.every((field) => field.commit?.action === "snapTarget.set" && typeof field.onChange === "function")
  ) {
    fail(errors, `Generated Properties binding adapter must attach active-tool handlers from serializable intents: ${JSON.stringify(boundActiveToolSections)}`);
  }
  for (const command of registry.MODELING_TOOLBAR_COMMANDS || []) {
    const sections = inspectorPropertyMetadata.inspectorActiveToolSections?.({
      command,
      commandState: { active: true, activeCommandId: command.id },
      snapSettings: { strength: "normal", scope: {} },
      canCancel: true,
      canCycleSnap: true,
      canOpenSnapSettings: true,
      canSnapStrengthChange: true,
      canSnapScopeChange: true,
      canSnapTargetChange: true
    }) || [];
    const ids = sections.map((section) => section.id);
    for (const requiredId of [
      "inspector.properties.activeTool.current",
      "inspector.properties.activeTool.guidance",
      "inspector.properties.activeTool.precision",
      "inspector.properties.activeTool.snapTargets"
    ]) {
      if (!ids.includes(requiredId)) fail(errors, `Active tool generated properties for ${command.id} must include ${requiredId}`);
    }
  }
  const unknownObjectContext = inspectorPropertyMetadata.inspectorObjectContext?.({
    objectId: "unknown-a",
    entry: { collection: "unknown" },
    object: { type: "mystery" }
  });
  if (unknownObjectContext?.title !== "Object" || unknownObjectContext?.icon !== "inspector") {
    fail(errors, `inspector-property-metadata unknown object context must use neutral fallback metadata: ${JSON.stringify(unknownObjectContext)}`);
  }
  const memberIdentity = inspectorPropertyMetadata.inspectorMemberIdentitySection?.({
    memberId: "member-a",
    member: { type: "beam", material: "S355" },
    lengthText: "1200 mm"
  });
  if (
    memberIdentity?.id !== "inspector.properties.member.identity"
    || JSON.stringify(memberIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "member-a"],
      ["Type", "beam"],
      ["Material", "S355"],
      ["Length", "1200 mm"]
    ])
  ) {
    fail(errors, `inspector-property-metadata member identity section has unexpected shape: ${JSON.stringify(memberIdentity)}`);
  }
  const memberEditSections = inspectorPropertyMetadata.inspectorMemberEditSections?.({
    memberId: "member-a",
    member: { profile: "IPE200", material: "S355", rotation: 15, start: [0, 0, 0], end: [1000, 0, 0] },
    profileOptions: [{ id: "IPE200", label: "IPE 200" }],
    materialOptions: [{ id: "S355", label: "S355 structural steel" }],
    center: [500, 0, 0],
    alignmentLabel: "Global X",
    hasAlignment: true,
    worldAxisIds: ["x", "y", "z"]
  });
  const memberEditSectionIds = memberEditSections?.map((section) => section.id) || [];
  const memberPrimarySection = memberEditSections?.find((section) => section.id === "inspector.properties.member.primary");
  const memberPositionSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.position");
  const memberEndpointSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.endpoints");
  const memberAlignmentSection = memberEditSections?.find((section) => section.id === "inspector.properties.member.alignment");
  if (
    !memberEditSectionIds.includes("inspector.properties.member.primary")
    || !memberEditSectionIds.includes("inspector.properties.member.position")
    || !memberEditSectionIds.includes("inspector.properties.member.endpoints")
    || !memberEditSectionIds.includes("inspector.properties.member.alignment")
    || memberPrimarySection?.fields?.find((field) => field.label === "Section")?.value !== "IPE200"
    || JSON.stringify(memberPrimarySection?.fields?.find((field) => field.label === "Section")?.options?.map((option) => option.id)) !== JSON.stringify(["IPE200"])
    || memberPrimarySection?.fields?.find((field) => field.label === "Section")?.commit?.action !== "member.profile.set"
    || memberPrimarySection?.fields?.find((field) => field.label === "Material")?.value !== "S355"
    || JSON.stringify(memberPrimarySection?.fields?.find((field) => field.label === "Material")?.options?.map((option) => option.id)) !== JSON.stringify(["S355"])
    || memberPrimarySection?.fields?.find((field) => field.label === "Material")?.commit?.action !== "member.material.set"
    || memberPrimarySection?.fields?.find((field) => field.label === "Rotation")?.value !== 15
    || memberPrimarySection?.fields?.find((field) => field.label === "Rotation")?.commit?.action !== "member.rotation.set"
    || memberPositionSection?.fields?.length !== 3
    || JSON.stringify(memberPositionSection?.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([["Center X", 500], ["Center Y", 0], ["Center Z", 0]])
    || memberPositionSection?.fields?.[0]?.commit?.action !== "member.centerCoordinate.set"
    || memberEndpointSection?.fields?.length !== 6
    || memberEndpointSection?.fields?.[0]?.label !== "Start X"
    || memberEndpointSection?.fields?.[5]?.label !== "End Z"
    || memberEndpointSection?.fields?.[0]?.commit?.action !== "member.endpointCoordinate.set"
    || memberAlignmentSection?.fields?.find((field) => field.label === "Current")?.value !== "Global X"
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.setGlobalAxis" && field.payload?.axisId === "x")
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.pickAxis")
    || !memberAlignmentSection?.fields?.some((field) => field.action === "member.alignment.clear")
  ) {
    fail(errors, `inspector-property-metadata member edit sections have unexpected shape: ${JSON.stringify(memberEditSections)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(memberEditSections)) {
    fail(errors, "inspector-property-metadata member edit sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const memberAdvancedSections = inspectorPropertyMetadata.inspectorMemberAdvancedSections?.({
    memberId: "member-a",
    customProfileValue: "-50 -100\n50 -100\n50 100\n-50 100",
    pointRelations: [{ id: "relation-a", label: "P1 on Global X" }],
    alignmentLabel: "Global X"
  });
  const memberAdvancedSectionIds = memberAdvancedSections?.map((section) => section.id) || [];
  const memberCustomSection = memberAdvancedSections?.find((section) => section.id === "inspector.properties.member.customSection");
  const memberConstraintSection = memberAdvancedSections?.find((section) => section.id === "inspector.properties.member.constraints");
  if (
    !memberAdvancedSectionIds.includes("inspector.properties.member.customSection")
    || !memberAdvancedSectionIds.includes("inspector.properties.member.constraints")
    || memberCustomSection?.level !== "advanced"
    || memberConstraintSection?.level !== "advanced"
    || memberCustomSection?.fields?.find((field) => field.label === "Contour points")?.commit?.action !== "member.customProfileDraft.set"
    || memberCustomSection?.fields?.find((field) => field.label === "Contour points")?.options?.multiline !== true
    || !memberCustomSection?.fields?.some((field) => field.action === "member.customProfile.create")
    || memberConstraintSection?.fields?.find((field) => field.label === "Member alignment")?.value !== "Global X"
    || memberConstraintSection?.fields?.find((field) => field.label === "Constraint 1")?.value !== "P1 on Global X"
    || !memberConstraintSection?.fields?.some((field) => field.action === "member.relation.remove" && field.payload?.relationId === "relation-a")
  ) {
    fail(errors, `inspector-property-metadata member advanced sections have unexpected shape: ${JSON.stringify(memberAdvancedSections)}`);
  }
  if (generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(memberAdvancedSections)) {
    fail(errors, "inspector-property-metadata member advanced sections must expose serializable generated descriptors, not bound UI callbacks");
  }
  const boundMemberEditSections = generatedPropertyBindings.bindGeneratedPropertySections?.([...(memberEditSections || []), ...(memberAdvancedSections || [])], {
    commits: {
      "member.profile.set": () => "profile",
      "member.material.set": () => "material",
      "member.rotation.set": () => "rotation",
      "member.centerCoordinate.set": () => "center",
      "member.endpointCoordinate.set": () => "endpoint",
      "member.customProfileDraft.set": () => "custom-profile-draft"
    },
    actions: {
      "member.alignment.setGlobalAxis": () => "axis",
      "member.alignment.pickAxis": () => "pick",
      "member.alignment.clear": () => "clear",
      "member.customProfile.create": () => "custom-profile-create",
      "member.relation.remove": () => "member-relation-remove"
    }
  }) || [];
  const boundMemberFields = boundMemberEditSections.flatMap((section) => section.fields || []);
  if (
    typeof boundMemberFields.find((field) => field.commit?.action === "member.profile.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.material.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.centerCoordinate.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.endpointCoordinate.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.setGlobalAxis")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.pickAxis")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.alignment.clear")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.commit?.action === "member.customProfileDraft.set")?.onChange !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.customProfile.create")?.onClick !== "function"
    || typeof boundMemberFields.find((field) => field.action === "member.relation.remove")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach member edit handlers from serializable intents: ${JSON.stringify(boundMemberEditSections)}`);
  }
  const diagnosticsSummary = inspectorPropertyMetadata.inspectorSmartComponentDiagnosticsSummary?.({
    health: "warning",
    diagnostics: [{ severity: "error" }, { severity: "warning" }, { severity: "info" }]
  });
  if (diagnosticsSummary?.errorCount !== 1 || diagnosticsSummary?.warningCount !== 1 || diagnosticsSummary?.diagnostics?.length !== 3) {
    fail(errors, `inspector-property-metadata Smart Component diagnostics summary has unexpected shape: ${JSON.stringify(diagnosticsSummary)}`);
  }
  const smartComponentIdentity = inspectorPropertyMetadata.inspectorSmartComponentIdentitySection?.({
    smartComponentId: "component-a",
    smartComponent: { type: "fin-plate", kind: "connection" },
    diagnosticsSummary,
    managedObjectCount: 4,
    detachedObjectCount: 1,
    overrideObjectCount: 2
  });
  if (
    smartComponentIdentity?.id !== "inspector.properties.smartComponent.identity"
    || JSON.stringify(smartComponentIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "component-a"],
      ["Type", "fin-plate"],
      ["Kind", "connection"],
      ["Diagnostics", "1 errors, 1 warnings"],
      ["Managed objects", "4"],
      ["Detached", "1"],
      ["Overrides", "2"]
    ])
  ) {
    fail(errors, `inspector-property-metadata Smart Component identity section has unexpected shape: ${JSON.stringify(smartComponentIdentity)}`);
  }
  const smartComponentPropertySections = inspectorPropertyMetadata.inspectorSmartComponentPropertySections?.({
    smartComponentId: "component-a",
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      diagnostics: [{ severity: "warning", message: "Missing optional stiffener." }],
      objectRoles: { plate: "object_a", optional: "object_b", nested: ["object_c", { child: "object_d" }] },
      detachedObjectIds: ["object_b", "object_d"],
      fieldOverrides: { object_a: { thickness: 12 }, object_c: { thickness: 10 } }
    },
    definition: {
      components: [
        { role: "plate", label: "Plate", objectRoles: ["plate"] },
        { role: "optional", label: "Optional part", default: "ghost", objectRoles: ["optional"] },
        { role: "nested", label: "Nested parts", objectRoles: ["nested"] }
      ]
    },
    diagnosticsSummary: { diagnostics: [{ severity: "warning", message: "Missing optional stiffener." }], errorCount: 0, warningCount: 1, health: "warning" },
    memberFields: [
      {
        label: "Main member",
        value: "member_a",
        options: [{ id: "member_a", label: "member_a - IPE 300" }, { id: "member_b", label: "member_b - IPE 200" }],
        commit: { action: "smartComponent.member.set", smartComponentId: "component-a", role: "main" }
      },
      {
        label: "Secondary member",
        value: "member_b",
        options: [{ id: "member_a", label: "member_a - IPE 300" }, { id: "member_b", label: "member_b - IPE 200" }],
        commit: { action: "smartComponent.member.set", smartComponentId: "component-a", role: "secondary" }
      }
    ],
    quickParameterFields: [{ type: "number", label: "Thickness", value: 12, commit: { action: "smartComponent.parameter.set", smartComponentId: "component-a", parameterPath: "plate.thickness" } }],
    liveRoleOptions: [{ role: "plate", active: true }],
    objectIndex: {
      object_a: { collection: "plates", type: "plate" },
      object_b: { collection: "plates", type: "plate" },
      object_c: { collection: "plates", type: "plate" },
      object_d: { collection: "plates", type: "plate" }
    },
    capabilities: {
      resetObjectOverrides: true,
      detachObject: true,
      reattachObject: true,
      resolveDiagnostics: true,
      deleteSmartComponent: true
    }
  });
  const smartComponentPropertyFields = smartComponentPropertySections?.flatMap((section) => section.fields || []) || [];
  const smartComponentPropertyActions = smartComponentPropertyFields.flatMap((field) => [field, ...(field.actions || [])]);
  const smartComponentDiagnosticsSection = smartComponentPropertySections?.find((section) => section.id === "inspector.properties.smartComponent.diagnostics");
  const smartComponentMembersSection = smartComponentPropertySections?.find((section) => section.id === "inspector.properties.smartComponent.members");
  const smartComponentMemberFields = smartComponentMembersSection?.fields || [];
  const mainMemberField = smartComponentMemberFields.find((field) => field.label === "Main member");
  const secondaryMemberField = smartComponentMemberFields.find((field) => field.label === "Secondary member");
  const smartComponentLifecycleFields = smartComponentPropertySections
    ?.find((section) => section.id === "inspector.properties.smartComponent.lifecycle")
    ?.fields || [];
  const lifecycleFieldByObjectId = (objectId) => smartComponentLifecycleFields.find((field) => field.value === objectId);
  const lifecycleActionsForObjectId = (objectId) => lifecycleFieldByObjectId(objectId)?.actions || [];
  if (
    !Array.isArray(smartComponentPropertySections)
    || !smartComponentPropertySections.some((section) => section.id === "inspector.properties.smartComponent.primaryParameters")
    || smartComponentPropertySections.some((section) => section.id === "inspector.properties.smartComponent.preview")
    || smartComponentMembersSection?.label !== "Members"
    || smartComponentMembersSection?.open !== true
    || smartComponentMembersSection?.priority !== -20
    || mainMemberField?.type !== "optionGrid"
    || mainMemberField?.value !== "member_a"
    || mainMemberField?.commit?.action !== "smartComponent.member.set"
    || mainMemberField?.commit?.role !== "main"
    || mainMemberField?.options?.length !== 2
    || mainMemberField?.className !== "bc-smart-component-member-field"
    || mainMemberField?.buttonClassName !== "bc-smart-component-member-option"
    || secondaryMemberField?.type !== "optionGrid"
    || secondaryMemberField?.value !== "member_b"
    || secondaryMemberField?.commit?.action !== "smartComponent.member.set"
    || secondaryMemberField?.commit?.role !== "secondary"
    || secondaryMemberField?.options?.length !== 2
    || secondaryMemberField?.className !== "bc-smart-component-member-field"
    || secondaryMemberField?.buttonClassName !== "bc-smart-component-member-option"
    || smartComponentDiagnosticsSection?.label !== "Diagnostics"
    || smartComponentDiagnosticsSection?.open !== true
    || !smartComponentDiagnosticsSection?.fields?.some((field) => field.type === "message" && field.state === "warning" && field.value === "Missing optional stiffener.")
    || !smartComponentPropertyFields.some((field) => field.commit?.action === "smartComponent.roleActive.set")
    || lifecycleFieldByObjectId("object_a")?.type !== "objectRef"
    || lifecycleFieldByObjectId("object_c")?.type !== "objectRef"
    || lifecycleFieldByObjectId("object_d")?.type !== "objectRef"
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.objectOverrides.reset")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.object.detach")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.object.reattach")
    || !lifecycleActionsForObjectId("object_a").some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || !lifecycleActionsForObjectId("object_a").some((field) => field.action === "smartComponent.object.detach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || lifecycleActionsForObjectId("object_b").some((field) => field.action === "smartComponent.object.detach")
    || !lifecycleActionsForObjectId("object_b").some((field) => field.action === "smartComponent.object.reattach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_b")
    || !lifecycleActionsForObjectId("object_c").some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.objectId === "object_c")
    || !lifecycleActionsForObjectId("object_d").some((field) => field.action === "smartComponent.object.reattach" && field.payload?.objectId === "object_d")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.diagnostics.resolve")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.parameters.open")
    || !smartComponentPropertyActions.some((field) => field.action === "smartComponent.delete")
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(smartComponentPropertySections)
  ) {
    fail(errors, `inspector-property-metadata Smart Component property sections must be serializable descriptor data: ${JSON.stringify(smartComponentPropertySections)}`);
  }
  const boundSmartComponentSections = generatedPropertyBindings.bindGeneratedPropertySections?.(smartComponentPropertySections, {
    commits: {
      "smartComponent.parameter.set": () => "parameter",
      "smartComponent.roleActive.set": () => "role",
      "smartComponent.member.set": () => "member"
    },
    actions: {
      "smartComponent.objectOverrides.reset": () => "reset",
      "smartComponent.object.detach": () => "detach",
      "smartComponent.object.reattach": () => "reattach",
      "smartComponent.diagnostics.resolve": () => "diagnostics",
      "smartComponent.parameters.open": () => "open",
      "smartComponent.delete": () => "delete"
    },
    select: () => "select",
    fit: () => "fit"
  }) || [];
  const boundSmartComponentFields = boundSmartComponentSections.flatMap((section) => section.fields || []);
  const boundSmartComponentActions = boundSmartComponentFields.flatMap((field) => [field, ...(field.actions || [])]);
  if (
    typeof boundSmartComponentFields.find((field) => field.commit?.action === "smartComponent.parameter.set")?.onChange !== "function"
    || typeof boundSmartComponentFields.find((field) => field.commit?.action === "smartComponent.roleActive.set")?.onChange !== "function"
    || typeof boundSmartComponentFields.find((field) => field.commit?.action === "smartComponent.member.set")?.onChange !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.objectOverrides.reset")?.onClick !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.object.detach")?.onClick !== "function"
    || typeof boundSmartComponentActions.find((field) => field.action === "smartComponent.object.reattach")?.onClick !== "function"
    || typeof boundSmartComponentFields.find((field) => field.action === "smartComponent.diagnostics.resolve")?.onClick !== "function"
  ) {
    fail(errors, `Generated Properties binding adapter must attach Smart Component handlers from metadata intents: ${JSON.stringify(boundSmartComponentSections)}`);
  }
  const generatedBySection = inspectorPropertyMetadata.inspectorObjectGeneratedBySection?.({
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      objectRoles: { plate: "object_a" },
      fieldOverrides: { object_a: { thickness: 12 } }
    },
    rootSmartComponent: { id: "root-component", type: "frame", kind: "assembly" },
    objectId: "object_a",
    objectIndex: {
      "component-a": { collection: "smartComponentInstances", type: "connection" },
      "root-component": { collection: "smartComponentInstances", type: "assembly" },
      object_a: { collection: "plates", type: "plate" }
    },
    capabilities: { resetObjectOverrides: true, detachObject: true, reattachObject: true }
  });
  const generatedByObjectRefActions = generatedBySection?.fields?.flatMap((field) => field.actions || []) || [];
  if (
    generatedBySection?.id !== "inspector.properties.object.generatedBy"
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(generatedBySection)
    || !generatedByObjectRefActions.some((action) => action.action === "objectRef.select" && action.payload?.smartComponentId === "component-a")
    || !generatedByObjectRefActions.some((action) => action.action === "objectRef.select" && action.payload?.smartComponentId === "root-component")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.objectOverrides.reset" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.object.detach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || generatedBySection.fields?.some((field) => field.action === "smartComponent.object.reattach")
    || !generatedBySection.fields?.some((field) => field.action === "smartComponent.parameters.open")
  ) {
    fail(errors, `inspector-property-metadata object generated-by section must be serializable descriptor data: ${JSON.stringify(generatedBySection)}`);
  }
  const generatedByDetachedSection = inspectorPropertyMetadata.inspectorObjectGeneratedBySection?.({
    smartComponent: {
      id: "component-a",
      type: "fin-plate",
      kind: "connection",
      objectRoles: { plate: "object_a" },
      detachedObjectIds: ["object_a"]
    },
    objectId: "object_a",
    objectIndex: {
      "component-a": { collection: "smartComponentInstances", type: "connection" },
      object_a: { collection: "plates", type: "plate" }
    },
    capabilities: { resetObjectOverrides: true, detachObject: true, reattachObject: true }
  });
  if (
    generatedByDetachedSection?.id !== "inspector.properties.object.generatedBy"
    || !generatedByDetachedSection.fields?.some((field) => field.label === "Lifecycle" && field.value === "Detached")
    || generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.object.detach")
    || generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.objectOverrides.reset")
    || !generatedByDetachedSection.fields?.some((field) => field.action === "smartComponent.object.reattach" && field.payload?.smartComponentId === "component-a" && field.payload?.objectId === "object_a")
    || generatedPropertyBindings.generatedPropertyDescriptorsContainFunctions?.(generatedByDetachedSection)
  ) {
    fail(errors, `inspector-property-metadata detached object generated-by section must expose reattach-only lifecycle data: ${JSON.stringify(generatedByDetachedSection)}`);
  }
  const objectIdentity = inspectorPropertyMetadata.inspectorObjectIdentitySection?.({
    objectId: "plate-a",
    entry: { collection: "plates", type: "plate" },
    object: { type: "plate", ownerId: "component-a", memberEnd: "start", fabrication: { operation: "cut" } }
  });
  if (
    objectIdentity?.id !== "inspector.properties.object.identity"
    || JSON.stringify(objectIdentity.fields?.map((field) => [field.label, field.value])) !== JSON.stringify([
      ["ID", "plate-a"],
      ["Collection", "plates"],
      ["Type", "plate"],
      ["Owner", "component-a"],
      ["Member end", "start"],
      ["Operation", "cut"]
    ])
  ) {
    fail(errors, `inspector-property-metadata object identity section has unexpected shape: ${JSON.stringify(objectIdentity)}`);
  }
  checkInspectorObjectContracts(context);
}

module.exports = { checkInspectorDescriptorContracts };
