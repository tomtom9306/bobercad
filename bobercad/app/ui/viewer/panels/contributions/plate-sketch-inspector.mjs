import { arrayValues, jsonClone as clone } from "../../../../engine/core/model.mjs";
import {
  plateOutline as sketchPlateOutline,
  plateSketchDefinitionStatus,
  plateSketchRelationActionPreview,
  plateSketchRelationHealth,
  sketchAngleRelationMode,
  sketchConstructionEdges,
  sketchConstructionVertices,
  sketchDistanceRelationMode,
  sketchEdges,
  sketchLengthRelationMode,
  sketchRelationBadge,
  sketchRelationEdgeIds,
  sketchRelationKey,
  sketchRelationLabel,
  sketchRelationVertexIds,
  sketchRelations,
  sketchVertices
} from "../../../../engine/api/project/plate-sketch-relations-and-bends.mjs";

export function createPlateSketchInspector({
  api,
  selection,
  applyProjectChange,
  selectObject,
  setSelectedObjectState,
  getSelectedObjectId,
  getSelectedObjectDetail,
  setMessage,
  showError
}) {
  function selectedObjectId() {
    return getSelectedObjectId?.() || null;
  }

  function selectedObjectDetail() {
    return getSelectedObjectDetail?.() || null;
  }

  function inferPlateSketchRelations(plateId = selectedObjectId()) {
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
      setSelectedObjectState(result.plateId, {});
      applyProjectChange(result.project);
      selection.select([result.plateId]);
      setMessage(`Created ${result.plateId}.`, "ok");
    } catch (error) {
      showError(error);
    }
  }

  const updatePlateAndSelectRelation = (operation, relationId, message = "Plate updated.") => {
    const plateId = selectedObjectId();
    if (!plateId) return;
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
    const plateId = selectedObjectId();
    if (!plateId) return;
    try {
      const nextProject = operation(plateId);
      applyProjectChange(nextProject);
      selectObject(plateId, detail || {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updatePlateAndSelectRelationPatch = (operation, relationPatch, message = "Plate updated.", plateId = selectedObjectId()) => {
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

  const relationPayloadPlateId = (payload = {}) => payload.objectId || selectedObjectId();

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
    const plateId = payload.objectId || selectedObjectId();
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
    const plateId = payload.objectId || selectedObjectId();
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

  const plateEditor = (plate) => {
    const definition = plateSketchDefinitionStatus(plate);
    const fields = [];
    const outlineEdges = sketchEdges(plate.sketch);
    const constructionEdges = sketchConstructionEdges(plate.sketch);
    const edgeById = new Map([...outlineEdges, ...constructionEdges].map((edge, index) => [edge.id, { edge, index }]));
    const relations = sketchRelations(plate.sketch);
    const fixedRelations = relations.filter((relation) => relation.type === "fixed");
    const relationHealth = plateSketchRelationHealth(plate);
    const activeRelationId = selectedObjectId() === plate.id ? selectedObjectDetail()?.relationId || null : null;
    const activeRelation = activeRelationId ? sketchRelations(plate.sketch).find((relation) => relation.id === activeRelationId) || null : null;
    const activeEdgeIds = selectedObjectId() === plate.id ? arrayValues(selectedObjectDetail()?.edgeIds).filter(Boolean).slice(0, 2) : [];
    const activeVertexIds = selectedObjectId() === plate.id ? arrayValues(selectedObjectDetail()?.vertexIds).filter(Boolean).slice(0, 2) : [];
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

  return {
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
    removePlateSketchFixedRelations,
    plateEditor
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
