import { WORLD_AXIS_DIRECTIONS, WORLD_AXIS_IDS, finiteNumber, finiteNumberOr, finitePositiveNumber } from "../../../engine/core/math.mjs?v=world-axis-dry-1";
import { arrayValues, truthyValues } from "../../../engine/core/model.mjs?v=ui-array-values-dry-1";
import { axisRelationLabel } from "../../../engine/api/project/axis-relations.mjs?v=array-values-dry-1";
import { memberCenter } from "../../../engine/api/project/members.mjs?v=member-api-distance-dry-1";
import { plateBends, plateOutline as sketchPlateOutline, plateSketchDefinitionStatus, plateSketchRelationActionPreview, plateSketchRelationHealth, sketchAngleRelationMode, sketchConstructionEdges, sketchConstructionVertices, sketchDefinitionStatus, sketchDistanceRelationMode, sketchEdges, sketchLengthRelationMode, sketchRelationBadge, sketchRelationEdgeIds, sketchRelationKey, sketchRelationLabel, sketchRelationVertexIds, sketchRelations, sketchVertices } from "../../../engine/api/project/plates.mjs?v=plate-relation-preflight-1";
import { button, checkboxInput, createPanelMessageState, numericControl, numericInput, readout, selectInput, text, textInput } from "./panel-elements.mjs?v=panel-controls-dry-1";

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
  api,
  profiles,
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
  const panelMessage = createPanelMessageState(() => render(), "Pick a member, Smart Component, trim, or cut object.");
  const setMessage = panelMessage.set;
  const showError = (error) => setMessage(error.message, "error");

  const connectedMemberObjectIds = (memberId) => api.memberDependencyObjectIds(memberId, { renderableOnly: true });

  const clearObjectWindow = () => onObjectCleared?.();
  const clearMemberEditSilently = () => memberEdit?.clear({ notify: false });

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

  const updatePlate = (operation) => updateSelectedObject(operation, "Plate updated.");

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

  const updatePlateAndClearSketchSelection = (operation, message = "Plate updated.") => {
    updatePlateAndSelectSketchDetail(operation, {}, message);
  };

  const sketchDimensionValueControl = (relation, relationMode) => {
    if (!["length", "angle", "distance"].includes(relation.type) || relationMode === "driven") return null;
    const unit = relation.type === "angle" ? "deg" : "mm";
    const input = numericControl(`${sketchRelationLabel(relation)} ${unit}`, relation.value, (value) => {
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
    }, { min: 0, minExclusive: true });
    input.className = "editor-relation-value-input";
    input.title = `Driving ${sketchRelationLabel(relation).toLowerCase()} (${unit})`;
    return input;
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

  const relationRows = (relations, emptyText) => {
    if (!relations.length) return [text("div", "editor-empty", emptyText)];
    return relations.map((relation) => {
      const row = document.createElement("div");
      row.className = "editor-relation-row";
      row.append(
        text("span", "editor-value", axisRelationLabel(relation)),
        button("Remove", "editor-button danger", () => removeMemberRelation(relation.id))
      );
      return row;
    });
  };

  const memberRelationRows = (member) => {
    const relations = api.memberAxisRelations(member.id);
    const pointRelations = relations.filter((relation) => relation.type === "point-on-axis");
    const alignment = relations.find((relation) => relation.type === "member-align-axis");
    return [
      text("div", "editor-subtitle", "Point constraints"),
      ...relationRows(pointRelations, "No point constraints."),
      text("div", "editor-subtitle", "Member alignment"),
      alignment
        ? relationRows([alignment], "No member alignment.")[0]
        : text("div", "editor-empty", "No member alignment."),
      ...WORLD_AXIS_IDS.map((axis) => button(`Align ${axis.toUpperCase()}`, "editor-button", () => setMemberAlignment(globalAxisSource(axis)))),
      button("Pick Custom Axis", "editor-button", beginAlignmentAxisPick),
      button("Remove Alignment", "editor-button danger", clearMemberAlignment)
    ];
  };

  const advancedSection = (label, rows) => {
    const details = document.createElement("details");
    details.className = "editor-details";
    const summary = document.createElement("summary");
    summary.textContent = label;
    details.append(summary, ...rows);
    return details;
  };

  const deleteSelectedSmartComponent = () => {
    if (!selectedSmartComponentId) return;
    try {
      const deletedId = selectedSmartComponentId;
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

  const memberEditor = () => {
    if (!selectedMemberId) return [text("div", "editor-empty", "No member selected.")];
    const member = api.member(selectedMemberId);
    const center = memberCenter(member);
    const centerDraft = [...center];

    const applyCenter = () => updateMember((memberId) => api.setMemberCenter(memberId, centerDraft));
    const createCustomProfile = () => {
      const id = `custom_section_${Date.now()}`;
      const outline = parsePointList(customProfilePoints.input?.value);
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
        const nextProject = api.setMemberProfile(selectedMemberId, id);
        applyProjectChange(nextProject, { memberId: selectedMemberId });
        setMessage(`Created ${id}.`, "ok");
      } catch (error) {
        showError(error);
      }
    };
    const customProfilePoints = textInput(
      "Custom section points",
      "-50 -100\n50 -100\n50 100\n-50 100",
      () => {},
      { multiline: true, rows: 5, className: "editor-field editor-field-stack" }
    );
    return [
      readout("Member", selectedMemberId),
      selectInput("Section", profileOptions(api.profiles?.() || profiles), member.profile, (profileId) => updateMember((memberId) => api.setMemberProfile(memberId, profileId))),
      numericInput("Rotation", member.rotation || 0, (rotation) => updateMember((memberId) => api.setMemberRotation(memberId, rotation))),
      text("div", "editor-subtitle", "Center point"),
      numericInput("X", center[0], (value) => { centerDraft[0] = value; }),
      numericInput("Y", center[1], (value) => { centerDraft[1] = value; }),
      numericInput("Z", center[2], (value) => { centerDraft[2] = value; }),
      button("Apply Center", "editor-button primary", applyCenter),
      advancedSection("Advanced custom section", [
        text("div", "editor-help", "Manual section contours are an advanced fallback. Main sketch editing belongs in the 3D view."),
        customProfilePoints,
        button("Create + Apply Section", "editor-button", createCustomProfile)
      ]),
      ...memberRelationRows(member)
    ];
  };

  const smartComponentEditor = () => {
    if (!selectedSmartComponentId) return [text("div", "editor-empty", "No Smart Component selected.")];
    const smartComponent = api.smartComponent(selectedSmartComponentId);
    const health = smartComponent.health || "ok";
    const firstError = arrayValues(smartComponent.diagnostics).find((item) => item.severity === "error");
    return [
      readout("Smart Component", selectedSmartComponentId),
      readout("Type", smartComponent.type),
      readout("Kind", smartComponent.kind || "-"),
      readout("Health", health),
      firstError ? text("div", "editor-error", firstError.message) : text("div", "editor-empty", "Smart Component is valid."),
      button("Open Parameters", "editor-button", () => onSmartComponentSelected(selectedSmartComponentId)),
      button("Remove Smart Component", "editor-button danger", deleteSelectedSmartComponent)
    ];
  };

  const fastenerGroupEditor = (fastenerGroup) => {
    const assembly = fastenerGroup.assembly || {};
    const washers = assembly.washers || {};
    const lengthOptions = fastenerLengthOptions(api, fastenerGroup.fastenerRef, assembly.length);
    const rows = [
      text("div", "editor-subtitle", "Fasteners"),
      selectInput("Fastener", catalogOptions(api, "fasteners", fastenerGroup.fastenerRef), fastenerGroup.fastenerRef || "", (fastenerRef) => updateFastenerGroup({ fastenerRef })),
      lengthOptions.length
        ? selectInput("Length", lengthOptions, String(finiteNumberOr(assembly.length, lengthOptions[0].id)), (length) => updateFastenerGroup({ assembly: { length: Number(length) } }))
        : numericInput("Length", assembly.length, (length) => updateFastenerGroup({ assembly: { length } }), { min: 0, minExclusive: true }),
      numericInput("Grip length", assembly.gripLength, (gripLength) => updateFastenerGroup({ assembly: { gripLength } }), { min: 0, minExclusive: true }),
      checkboxInput("Head washer", washers.head, (head) => updateFastenerGroup({ assembly: { washers: { head } } })),
      checkboxInput("Nut washer", washers.nut, (nut) => updateFastenerGroup({ assembly: { washers: { nut } } }))
    ];
    if (finiteNumber(assembly.nutOffset)) {
      rows.push(numericInput("Nut offset", assembly.nutOffset, (nutOffset) => updateFastenerGroup({ assembly: { nutOffset } }), { min: 0 }));
    }
    return rows;
  };

  const plateEditor = (plate) => {
    const definition = plateSketchDefinitionStatus(plate);
    const visibleDiagnostics = definition.diagnostics.filter((item) => item.severity !== "info");
    const relationsVisibleIn3d = selectedObjectId === plate.id && selectedObjectDetail?.sketchMode === "relations";
    const relationViewDetail = relationsVisibleIn3d
      ? { sketchMode: "clean", clearSketchSelection: true }
      : { ...(selectedObjectDetail || {}), sketchMode: "relations" };
    const rows = [
      text("div", "editor-subtitle", "Plate sketch"),
      text("div", `editor-sketch-status ${definition.status}`, `${definition.label}${definition.degreesOfFreedom ? `: ${definition.degreesOfFreedom} DOF free` : ""}`),
      readout("Relations", `${definition.relationCount} (${definition.independentConstraintCount}/${definition.variableCount} independent)`),
      button(relationsVisibleIn3d ? "Hide Relations in 3D" : "Show Relations in 3D", relationsVisibleIn3d ? "editor-button primary" : "editor-button", () => selectObject(plate.id, relationViewDetail), {
        title: relationsVisibleIn3d ? "Return to the clean sketch view." : "Show relation badges, construction geometry, and relation controls in the 3D sketch overlay."
      }),
      ...(definition.degreesOfFreedom
        ? [readout("Under-defined", `${definition.underDefinedVertexIds?.length || 0} vertices, ${definition.underDefinedEdgeIds?.length || 0} edges`)]
        : []),
      numericInput("Thickness", plate.thickness, (thickness) => updatePlate((plateId) => api.updatePlate(plateId, { thickness })), { min: 0, minExclusive: true }),
      text("div", "editor-help", "Edit the outline in 3D: drag corners, hover an edge to highlight and drag it with snap, drag midpoint points on edges to add corners, and right-click corners for more actions.")
    ];
    visibleDiagnostics.forEach((diagnostic) => rows.push(text("div", diagnostic.severity === "error" ? "editor-error" : "editor-warning", diagnostic.message)));
    const bends = plateBends(plate);
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

    const selectEntityButton = (id, detail) => button(id, "editor-button", () => selectObject(plate.id, detail), {
      title: `Select ${id} in the 3D sketch overlay.`
    });

    const entityButtonRow = (ids, detailForId) => {
      const row = document.createElement("div");
      row.className = "editor-inline-actions";
      ids.slice(0, 8).forEach((id) => row.append(selectEntityButton(id, detailForId(id))));
      if (ids.length > 8) row.append(text("span", "editor-empty", `+${ids.length - 8} more`));
      return row;
    };

    const relationEntityButtonRows = (relation) => {
      const detail = relationSelectionDetail(relation);
      const rows = [];
      if (detail.edgeIds.length) {
        rows.push(
          readout("Edges", `${detail.edgeIds.length}`),
          entityButtonRow(detail.edgeIds, (edgeId) => ({ edgeIds: [edgeId] }))
        );
      }
      if (detail.vertexIds.length) {
        rows.push(
          readout("Vertices", `${detail.vertexIds.length}`),
          entityButtonRow(detail.vertexIds, (vertexId) => ({ vertexIds: [vertexId] }))
        );
      }
      return rows;
    };

    const underDefinedInspector = () => {
      const underEdges = arrayValues(definition.underDefinedEdgeIds).filter(Boolean);
      const underVertices = arrayValues(definition.underDefinedVertexIds).filter(Boolean);
      if (!underEdges.length && !underVertices.length) return null;
      const underDefinedEntityRows = (ids, detailForId, relationForId) => ids.slice(0, 8).flatMap((id) => {
        const row = document.createElement("div");
        row.className = "editor-under-defined-row";
        row.append(
          text("span", "editor-value", id),
          selectEntityButton(id, detailForId(id)),
          relationActionButton(relationForId(id), "Fix")
        );
        return [row];
      });
      const card = document.createElement("div");
      card.className = "editor-selected-relation redundant";
      const actionRow = document.createElement("div");
      actionRow.className = "editor-inline-actions";
      actionRow.append(button("Fix remaining", "editor-button primary", () => updatePlateAndSelectSketchDetail(
        (plateId) => api.fixPlateSketchUnderDefinedEntities(plateId),
        {},
        "Under-defined sketch entities fixed."
      ), {
        title: `Fix ${underEdges.length} edge${underEdges.length === 1 ? "" : "s"} and ${underVertices.length} ${underVertices.length === 1 ? "vertex" : "vertices"} at their current sketch positions.`
      }));
      card.append(text("div", "editor-selected-relation-title", "Under-defined entities"), actionRow);
      if (underEdges.length) {
        card.append(
          readout("Edges", `${underEdges.length}`),
          ...underDefinedEntityRows(underEdges, (edgeId) => ({ edgeIds: [edgeId] }), (edgeId) => ({ type: "fixed", edgeId })),
          ...(underEdges.length > 8 ? [text("div", "editor-empty", `+${underEdges.length - 8} more edges`)] : [])
        );
      }
      if (underVertices.length) {
        card.append(
          readout("Vertices", `${underVertices.length}`),
          ...underDefinedEntityRows(underVertices, (vertexId) => ({ vertexIds: [vertexId] }), (vertexId) => ({ type: "fixed", vertexId })),
          ...(underVertices.length > 8 ? [text("div", "editor-empty", `+${underVertices.length - 8} more vertices`)] : [])
        );
      }
      card.append(text("div", "editor-relation-diagnostic", "Select an entity to inspect it, or Fix it at its current sketch position."));
      return card;
    };

    const relationModeToggleButton = (relation, relationMode) => {
      if (relation.type === "length") {
        const nextMode = relationMode === "driven" ? "driving" : "driven";
        return button(relationMode === "driven" ? "Make Driving" : "Make Driven", "editor-button", () => (
          updatePlateAndSelectRelation(
            (plateId) => api.setPlateSketchEdgeLengthMode(plateId, relation.edgeId, nextMode),
            relation.id,
            `Sketch dimension set ${nextMode}.`
          )
        ));
      }
      if (relation.type === "angle") {
        const nextMode = relationMode === "driven" ? "driving" : "driven";
        return button(relationMode === "driven" ? "Make Driving" : "Make Driven", "editor-button", () => (
          updatePlateAndSelectRelation(
            (plateId) => api.setPlateSketchEdgeAngleMode(plateId, relation.edgeIds, nextMode),
            relation.id,
            `Sketch dimension set ${nextMode}.`
          )
        ));
      }
      if (relation.type === "distance") {
        const nextMode = relationMode === "driven" ? "driving" : "driven";
        return button(relationMode === "driven" ? "Make Driving" : "Make Driven", "editor-button", () => (
          updatePlateAndSelectRelation(
            (plateId) => api.setPlateSketchPointDistanceMode(plateId, relation.vertexIds, nextMode),
            relation.id,
            `Sketch dimension set ${nextMode}.`
          )
        ));
      }
      return null;
    };

    const relationResolveButton = (relation, relationMode, healthStatus) => (
      healthStatus === "conflicted" || healthStatus === "redundant"
        ? button("Resolve", "editor-button primary", () => resolveSketchRelation(relation, relationMode, healthStatus, relationSelectionDetail(relation)), {
          title: healthStatus === "conflicted"
            ? "Try to move sketch geometry so this relation is satisfied."
            : healthStatus === "redundant" && relationMode === "driving" && ["length", "angle", "distance"].includes(relation.type)
              ? "Convert this redundant driving dimension to reference."
              : "Remove this relation to resolve the sketch issue."
        })
        : null
    );

    const relationRemoveLabel = (relation) => (relation?.type === "fixed" ? "Unfix" : "Remove");
    const relationRemoveMessage = (relation) => (relation?.type === "fixed" ? "Sketch entity unfixed." : "Sketch relation removed.");

    const selectedRelationInspector = (relation) => {
      if (!relation) return null;
      const relationMode = sketchRelationMode(relation);
      const health = relationHealth[relation.id];
      const healthStatus = sketchRelationHealthStatus(health);
      const card = document.createElement("div");
      card.className = `editor-selected-relation${healthStatus && healthStatus !== "ok" ? ` ${healthStatus}` : ""}`;
      const actions = document.createElement("div");
      actions.className = "editor-inline-actions";
      const modeButton = relationModeToggleButton(relation, relationMode);
      const resolveButton = relationResolveButton(relation, relationMode, healthStatus);
      actions.append(
        button("Locate", "editor-button", () => selectObject(plate.id, { relationId: relation.id }), {
          title: "Keep this relation selected in the 3D sketch overlay."
        }),
        ...(modeButton ? [modeButton] : []),
        ...(resolveButton ? [resolveButton] : []),
        button(relationRemoveLabel(relation), "editor-button danger", () => updatePlateAndSelectSketchDetail(
          (plateId) => api.removePlateSketchRelation(plateId, relation.id),
          relationSelectionDetail(relation),
          relationRemoveMessage(relation)
        ))
      );
      card.append(
        text("div", "editor-selected-relation-title", `${sketchRelationBadge(relation)} ${sketchRelationLabel(relation)}`),
        readout("Status", sketchRelationStatusText(health, relationMode)),
        readout("Target", sketchRelationTargetText(relation, relationMode)),
        readout("Entities", sketchRelationEntityText(relation)),
        ...relationEntityButtonRows(relation),
        ...(health?.message ? [text("div", healthStatus === "conflicted" ? "editor-error" : "editor-warning", health.message)] : []),
        actions
      );
      const valueControl = sketchDimensionValueControl(relation, relationMode);
      if (valueControl) {
        const valueRow = document.createElement("label");
        valueRow.className = "editor-field";
        valueRow.append(text("span", "editor-label", "Value"), valueControl);
        card.insertBefore(valueRow, actions);
      }
      return card;
    };

    const applyPlateChangeAndSelectRelation = (operation, relationPatch, message = "Plate updated.") => {
      try {
        const nextProject = operation(plate.id);
        applyProjectChange(nextProject);
        selection.select([plate.id]);
        const nextPlate = nextProject.model?.plates?.[plate.id];
        const relationKey = sketchRelationKey(relationPatch);
        const nextRelation = nextPlate
          ? sketchRelations(nextPlate.sketch).find((relation) => sketchRelationKey(relation) === relationKey)
          : null;
        if (nextRelation) {
          selectObject(plate.id, { relationId: nextRelation.id });
          setMessage(message, "ok");
        } else {
          selectObject(plate.id, {});
          setMessage(message, "ok");
        }
      } catch (error) {
        showError(error);
      }
    };

    const addSketchRelation = (relation) => applyPlateChangeAndSelectRelation(
      (plateId) => api.upsertPlateSketchRelation(plateId, relation),
      relation
    );

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

    const relationActionButton = (relation, label = null) => {
      const actionLabel = label || sketchRelationLabel(relation);
      const existingRelation = existingRelationForAction(relation);
      if (existingRelation) {
        return button(`${actionLabel} (existing)`, "editor-button existing", () => selectObject(plate.id, { relationId: existingRelation.id }), {
          title: "This relation already exists. Select it to edit, resolve, convert, or remove it."
        });
      }
      const preview = relationActionPreview(relation);
      const previewStatus = sketchRelationHealthStatus(preview.health);
      const suffix = relationActionStatusSuffix(previewStatus);
      const relationButton = button(suffix ? `${actionLabel} (${suffix})` : actionLabel, `editor-button${previewStatus && previewStatus !== "ok" ? ` ${previewStatus}` : ""}`, () => {
        if (relation.type === "length") {
          applyPlateChangeAndSelectRelation(
            (plateId) => api.setPlateSketchEdgeLengthMode(plateId, relation.edgeId, "driving"),
            { type: "length", edgeId: relation.edgeId }
          );
          return;
        }
        if (relation.type === "angle") {
          applyPlateChangeAndSelectRelation(
            (plateId) => api.setPlateSketchEdgeAngleMode(plateId, relation.edgeIds, "driving"),
            { type: "angle", edgeIds: relation.edgeIds }
          );
          return;
        }
        if (relation.type === "distance") {
          applyPlateChangeAndSelectRelation(
            (plateId) => api.setPlateSketchPointDistanceMode(plateId, relation.vertexIds, "driving"),
            { type: "distance", vertexIds: relation.vertexIds }
          );
          return;
        }
        addSketchRelation(relation);
      });
      if (preview.health?.message) relationButton.title = preview.health.message;
      else if (preview.definition?.status && preview.definition.status !== definition.status) {
        relationButton.title = `Sketch will become ${preview.definition.label.toLowerCase()}.`;
      }
      return relationButton;
    };

    const constructionLineButton = (from, to) => button("Construction line", "editor-button", () => {
      try {
        const nextProject = api.addPlateSketchConstructionLine(plate.id, from, to);
        applyProjectChange(nextProject);
        const nextEdges = sketchConstructionEdges(nextProject.model?.plates?.[plate.id]?.sketch);
        const nextVertexMap = sketchVertexPointMap(nextProject.model?.plates?.[plate.id]?.sketch);
        const newEdge = [...nextEdges].reverse().find((edge) => {
          const edgeFrom = nextVertexMap.get(edge.from);
          const edgeTo = nextVertexMap.get(edge.to);
          return (sameSketchPoint(edgeFrom, from) && sameSketchPoint(edgeTo, to))
            || (sameSketchPoint(edgeFrom, to) && sameSketchPoint(edgeTo, from));
        });
        selectObject(plate.id, newEdge ? { edgeIds: [newEdge.id] } : {});
        setMessage("Plate updated.", "ok");
      } catch (error) {
        showError(error);
      }
    });

    const selectedEntityRelationActions = () => {
      const actions = [];
      if (activeVertexIds.length === 2 && activeEdgeIds.length === 1) {
        actions.push(relationActionButton({ type: "symmetric", vertexIds: activeVertexIds, edgeId: activeEdgeIds[0] }));
        return actions;
      }
      if (activeVertexIds.length === 2) {
        const vertexMap = sketchVertexPointMap(plate.sketch);
        const first = vertexMap.get(activeVertexIds[0]);
        const second = vertexMap.get(activeVertexIds[1]);
        actions.push(
          relationActionButton({ type: "distance", vertexIds: activeVertexIds }, "Distance"),
          relationActionButton({ type: "coincident", vertexIds: activeVertexIds }),
          relationActionButton({ type: "horizontal-points", vertexIds: activeVertexIds }),
          relationActionButton({ type: "vertical-points", vertexIds: activeVertexIds }),
          ...(first && second ? [constructionLineButton(first, second)] : [])
        );
        return actions;
      }
      if (activeVertexIds.length === 1 && activeEdgeIds.length === 1) {
        if (canConstrainVertexToEdge(activeVertexIds[0], activeEdgeIds[0])) {
          actions.push(
            relationActionButton({ type: "point-on-line", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] }),
            relationActionButton({ type: "midpoint", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] })
          );
        }
        return actions;
      }
      if (activeVertexIds.length === 1) {
        actions.push(relationActionButton({ type: "fixed", vertexId: activeVertexIds[0] }));
        return actions;
      }
      if (activeEdgeIds.length === 2) {
        actions.push(
          relationActionButton({ type: "parallel", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionButton({ type: "collinear", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionButton({ type: "perpendicular", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionButton({ type: "equal-length", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
          relationActionButton({ type: "angle", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }, "Angle")
        );
        return actions;
      }
      if (activeEdgeIds.length === 1) {
        const edgePoints = sketchEdgePoints(plate.sketch, activeEdgeIds[0]);
        actions.push(
          relationActionButton({ type: "horizontal", edgeId: activeEdgeIds[0] }),
          relationActionButton({ type: "vertical", edgeId: activeEdgeIds[0] }),
          relationActionButton({ type: "fixed", edgeId: activeEdgeIds[0] }),
          relationActionButton({ type: "length", edgeId: activeEdgeIds[0] }, "Length"),
          ...(constructionEdgeIds.has(activeEdgeIds[0]) || !edgePoints ? [] : [constructionLineButton(edgePoints.from, edgePoints.to)])
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

    const selectedEntityRelationRow = (relation) => {
      const relationMode = sketchRelationMode(relation);
      const health = relationHealth[relation.id];
      const healthStatus = sketchRelationHealthStatus(health);
      const row = document.createElement("div");
      row.className = `editor-relation-row compact${healthStatus && healthStatus !== "ok" ? ` ${healthStatus}` : ""}`;
      row.append(
        text("span", "editor-value", `${sketchRelationBadge(relation)} ${sketchRelationLabel(relation)} ${sketchRelationTargetText(relation, relationMode)}`),
        button("Select", "editor-button", () => selectObject(plate.id, { relationId: relation.id }))
      );
      const resolveButton = relationResolveButton(relation, relationMode, healthStatus);
      if (resolveButton) row.append(resolveButton);
      row.append(button(relationRemoveLabel(relation), "editor-button danger", () => updatePlateAndSelectSketchDetail(
        (plateId) => api.removePlateSketchRelation(plateId, relation.id),
        relationSelectionDetail(relation),
        relationRemoveMessage(relation)
      )));
      if (health?.message) row.title = health.message;
      return row;
    };

    const selectedEntityInspector = () => {
      if (activeRelation || (!activeEdgeIds.length && !activeVertexIds.length)) return null;
      const actions = selectedEntityRelationActions();
      const existingRelations = selectedEntityRelations();
      const relationGroups = groupedSketchRelations(existingRelations, relationHealth);
      const groupedRelationRows = relationGroups.flatMap((group) => [
        text("div", `editor-relation-group-title ${group.status}`, `${group.label} (${group.relations.length})`),
        ...group.relations.map(selectedEntityRelationRow)
      ]);
      const card = document.createElement("div");
      card.className = "editor-selected-relation";
      const actionRow = document.createElement("div");
      actionRow.className = "editor-inline-actions";
      actionRow.append(
        ...(actions.length ? actions : []),
        button("Clear selection", "editor-button", () => selectObject(plate.id, { clearSketchSelection: true }))
      );
      card.append(
        text("div", "editor-selected-relation-title", "Selected sketch entities"),
        readout("Edges", activeEdgeIds.length ? activeEdgeIds.join(", ") : "-"),
        readout("Vertices", activeVertexIds.length ? activeVertexIds.join(", ") : "-"),
        text("div", "editor-relation-diagnostic", actions.length ? "Add relation" : "No panel relation actions for this selection."),
        actionRow,
        text("div", "editor-relation-diagnostic", existingRelations.length ? "Relations on selected entities" : "No existing relations on selected entities."),
        ...groupedRelationRows
      );
      return card;
    };

    rows.push(text("div", "editor-subtitle", "Sketch relations"));
    const underDefined = underDefinedInspector();
    if (underDefined) rows.push(underDefined);
    const inspector = selectedRelationInspector(activeRelation);
    if (inspector) rows.push(inspector);
    const entityInspector = selectedEntityInspector();
    if (entityInspector) rows.push(entityInspector);
    rows.push(button("Infer Missing Relations", "editor-button", () => updatePlate((plateId) => api.inferPlateSketchRelations(plateId))));
    if (fixedRelations.length) {
      rows.push(button(`Unfix all (${fixedRelations.length})`, "editor-button", () => updatePlateAndSelectSketchDetail(
        (plateId) => api.removePlateSketchFixedRelations(plateId),
        {},
        "Fixed sketch relations removed."
      ), {
        title: "Remove every fixed sketch relation and leave dimensional/geometric relations intact."
      }));
    }
    if (!relations.length) {
      rows.push(text("div", "editor-empty", "No sketch relations."));
    } else {
      groupedSketchRelations(relations, relationHealth).forEach((group) => {
        rows.push(text("div", `editor-relation-group-title ${group.status}`, `${group.label} (${group.relations.length})`));
        group.relations.forEach((relation) => {
        const relationMode = sketchRelationMode(relation);
        const target = sketchRelationTargetText(relation, relationMode);
        const health = relationHealth[relation.id];
        const healthStatus = sketchRelationHealthStatus(health);
        const healthText = healthStatus && healthStatus !== "ok" ? ` - ${healthStatus}` : "";
        const isSelectedRelation = relation.id === activeRelationId;
        const row = document.createElement("div");
        row.className = `editor-relation-row${isSelectedRelation ? " selected" : ""}${healthStatus && healthStatus !== "ok" ? ` ${healthStatus}` : ""}`;
        row.append(text("span", "editor-value", `${sketchRelationBadge(relation)} ${sketchRelationLabel(relation)} ${target}${healthText}`));
        if (health?.message && healthStatus !== "ok") {
          row.append(text("div", "editor-relation-diagnostic", health.message));
        }
        const valueControl = sketchDimensionValueControl(relation, relationMode);
        if (valueControl) row.append(valueControl);
        row.append(button(isSelectedRelation ? "Selected" : "Select", isSelectedRelation ? "editor-button primary" : "editor-button", () => selectObject(plate.id, { relationId: relation.id }), {
          title: "Select this relation in the 3D sketch overlay."
        }));
        const modeButton = relationModeToggleButton(relation, relationMode);
        const resolveButton = relationResolveButton(relation, relationMode, healthStatus);
        if (modeButton) row.append(modeButton);
        if (resolveButton) row.append(resolveButton);
        row.append(button(relationRemoveLabel(relation), "editor-button danger", () => updatePlateAndSelectSketchDetail(
          (plateId) => api.removePlateSketchRelation(plateId, relation.id),
          relationSelectionDetail(relation),
          relationRemoveMessage(relation)
        )));
        if (health?.message) row.title = health.message;
        rows.push(row);
      });
      });
    }

    rows.push(text("div", "editor-subtitle", "Bends"));
    if (!bends.length) rows.push(text("div", "editor-empty", "No bends added."));
    bends.forEach((bend) => {
      const edgeEntry = edgeById.get(bend.edgeId);
      const targetLabel = bend.parentBendId
        ? `${bend.parentBendId} / ${bend.parentEdge || "outer"}`
        : edgeEntry ? `${edgeEntry.index + 1}. ${edgeEntry.edge.id}` : bend.edgeId;
      rows.push(readout("Target", targetLabel));
      rows.push(selectInput("Direction", [{ id: "up", label: "Up" }, { id: "down", label: "Down" }], bend.direction, (direction) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, direction }))));
      rows.push(numericInput("Angle", bend.angle, (angle) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, angle }))));
      rows.push(numericInput("Radius", bend.radius, (radius) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, radius })), { min: 0 }));
      rows.push(numericInput("Flange length", bend.flangeLength, (flangeLength) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, flangeLength })), { min: 0, minExclusive: true }));
      rows.push(selectInput("Relief", [
        { id: "round", label: "Round" },
        { id: "rect", label: "Rect" },
        { id: "obround", label: "Obround" },
        { id: "v-notch", label: "V notch" },
        { id: "none", label: "None" }
      ], bend.relief?.type || "round", (type) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, relief: { ...(bend.relief || {}), type } }))));
      rows.push(numericInput("Relief radius", bend.relief?.radius ?? Math.max(plate.thickness || 8, 8), (radius) => updatePlate((plateId) => api.upsertPlateBend(plateId, { ...bend, relief: { ...(bend.relief || {}), radius } })), { min: 0 }));
      rows.push(button("Remove Bend", "editor-button danger", () => updatePlate((plateId) => api.removePlateBend(plateId, bend.id))));
    });

    rows.push(readout("Outline vertices", String(sketchPlateOutline(plate).length)));
    return rows;
  };

  const sketchEditor = (sketchObject) => {
    const definition = sketchDefinitionStatus(sketchObject.sketch);
    const createPlate = () => {
      try {
        const result = api.createPlateFromSketch(sketchObject.id, {
          id: `${sketchObject.id}_plate`,
          thickness: 8,
          display: {
            color: "#6b7280",
            edgeColor: "#0ea5e9"
          }
        });
        setSelectedState({ objectId: result.plateId, objectDetail: {} });
        applyProjectChange(result.project);
        selection.select([result.plateId]);
        setMessage(`Created ${result.plateId}.`, "ok");
      } catch (error) {
        showError(error);
      }
    };
    const rows = [
      text("div", "editor-subtitle", "Sketch outline"),
      text("div", `editor-sketch-status ${definition.status}`, `${definition.label}${definition.degreesOfFreedom ? `: ${definition.degreesOfFreedom} DOF free` : ""}`),
      ...(definition.degreesOfFreedom
        ? [readout("Under-defined", `${definition.underDefinedVertexIds?.length || 0} vertices, ${definition.underDefinedEdgeIds?.length || 0} edges`)]
        : []),
      text("div", "editor-help", "Sketch geometry is edited in the 3D view after creating/selecting a plate."),
      button("Create Plate", "editor-button primary", createPlate)
    ];
    rows.push(readout("Outline vertices", String(sketchPlateOutline(sketchObject).length)));
    return rows;
  };

  const objectEditor = () => {
    if (!selectedObjectId) return [text("div", "editor-empty", "No object selected.")];
    const project = api.project();
    const entry = project.objectIndex?.[selectedObjectId];
    if (!entry?.collection) return [text("div", "editor-error", "Selected object is no longer in the project.")];
    const object = api.object(selectedObjectId);
    const smartComponent = api.smartComponentForObject(selectedObjectId);
    const rootSmartComponent = api.smartComponentRootForObject(selectedObjectId);
    const rows = [
      readout("Object", selectedObjectId),
      readout("Collection", entry.collection),
      readout("Type", object.type || entry.type || "-")
    ];
    if (object.ownerId) rows.push(readout("Owner", object.ownerId));
    if (object.memberEnd) rows.push(readout("Member end", object.memberEnd));
    if (object.cutKind) rows.push(readout("Cut kind", object.cutKind));
    if (object.booleanType) rows.push(readout("Boolean", object.booleanType));
    if (entry.collection === "trimJoints") rows.push(readout("Participants", String(arrayValues(object.participants).length)));
    if (entry.collection === "trimJoints" && selectedObjectDetail?.operationId) rows.push(readout("Selected cut", selectedObjectDetail.operationId));
    if (entry.collection === "fastenerGroups") {
      if (object.holePatternRef) rows.push(readout("Hole pattern", object.holePatternRef));
      rows.push(readout("Participants", String(arrayValues(object.participants).length)));
      rows.push(...fastenerGroupEditor(object));
    }
    if (entry.collection === "plates") rows.push(...plateEditor(object));
    if (entry.collection === "sketches") rows.push(...sketchEditor(object));
    if (object.fabrication?.operation) rows.push(readout("Operation", object.fabrication.operation));
    if (object.operationEnabled === false) rows.push(text("div", "editor-error", "Operation is disabled."));
    if (rootSmartComponent) rows.push(button("Open Smart Component", "editor-button", () => selectSmartComponent(rootSmartComponent.id)));
    if (smartComponent && rootSmartComponent && smartComponent.id !== rootSmartComponent.id) {
      rows.push(button("Open Direct Component", "editor-button", () => selectSmartComponent(smartComponent.id)));
    }
    if (entry.collection === "features") rows.push(button("Open Feature Editor", "editor-button primary", () => onObjectSelected?.(selectedObjectId)));
    return rows;
  };

  function render() {
    if (selectedMemberId && !api.project().model.members?.[selectedMemberId]) setSelectedState();
    if (selectedSmartComponentId && !api.project().model.smartComponentInstances?.[selectedSmartComponentId]) setSelectedState();
    if (selectedObjectId && !api.project().objectIndex?.[selectedObjectId]) setSelectedState();

    const title = text("div", "editor-title", "Editor");
    const actions = document.createElement("div");
    const memberSection = document.createElement("section");
    const smartComponentSection = document.createElement("section");
    const objectSection = document.createElement("section");
    const message = panelMessage.element();

    actions.className = "editor-actions";
    memberSection.className = "editor-section";
    smartComponentSection.className = "editor-section";
    objectSection.className = "editor-section";

    actions.append(
      button("Pick Member", "editor-button", beginMemberPick),
      button("Pick Smart Component", "editor-button", beginSmartComponentPick),
      button("Pick Object", "editor-button", beginObjectPick),
      button("Clear", "editor-button", () => {
        setSelectedState();
        clearMemberEditSilently();
        selection.clear();
        clearObjectWindow();
        setMessage("Selection cleared.");
      })
    );
    memberSection.append(text("div", "editor-section-title", "Member"), ...memberEditor());
    smartComponentSection.append(text("div", "editor-section-title", "Smart Component"), ...smartComponentEditor());
    objectSection.append(text("div", "editor-section-title", "Object"), ...objectEditor());

    panel.hidden = false;
    panel.replaceChildren(title, actions, memberSection, smartComponentSection, objectSection, message);
  }

  api.subscribe(render);
  render();
  return {
    clearSelection(options = {}) {
      setSelectedState();
      if (!options.fromMemberEdit) clearMemberEditSilently();
      selection.clear();
      clearObjectWindow();
      setMessage("Selection cleared.");
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
