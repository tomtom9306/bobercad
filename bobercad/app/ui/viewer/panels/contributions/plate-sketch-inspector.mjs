import { arrayValues, jsonClone as clone } from "../../../../engine/core/model.mjs";
import {
  plateOutline as sketchPlateOutline,
  plateSketchDefinitionStatus,
  plateSketchRelationActionPreview,
  plateSketchRelationHealth,
  sketchDefinitionStatus,
  sketchAngleRelationMode,
  sketchConstructionEdges,
  sketchConstructionVertices,
  sketchDistanceRelationMode,
  sketchEdgeIsCircularArc,
  sketchEdges,
  sketchLengthRelationMode,
  measuredSketchEdgeRadius,
  sketchRadiusRelationDisplay,
  sketchRadiusRelationMode,
  sketchRelationBadge,
  sketchRelationEdgeIds,
  sketchRelationKey,
  sketchRelationLabel,
  sketchRelationVertexIds,
  sketchRelations,
  sketchRelationHealth,
  setSketchEdgeAngleMode as previewSetSketchEdgeAngleMode,
  setSketchEdgeLengthMode as previewSetSketchEdgeLengthMode,
  setSketchPointDistanceMode as previewSetSketchPointDistanceMode,
  upsertSketchRelation as previewUpsertSketchRelation,
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

  function sketchHostFromProject(project, objectId = selectedObjectId()) {
    if (!objectId) return null;
    const entry = project?.objectIndex?.[objectId] || null;
    if (entry?.collection !== "plates" && entry?.collection !== "sketches") return null;
    const host = project?.model?.[entry.collection]?.[objectId] || null;
    return host?.sketch ? { id: objectId, collection: entry.collection, object: host, sketch: host.sketch } : null;
  }

  const sketchHostForId = (objectId = selectedObjectId()) => sketchHostFromProject(api.project(), objectId);

  const sketchHostLabel = (host) => (host?.collection === "sketches" ? "Sketch" : "Plate");

  const updateSketchHostAndSelectRelation = (operation, relationId, message = "Sketch updated.", objectId = selectedObjectId()) => {
    const host = sketchHostForId(objectId);
    if (!host) return;
    try {
      const nextProject = operation(host.id, host);
      applyProjectChange(nextProject);
      const nextHost = sketchHostFromProject(nextProject, host.id);
      const nextRelation = sketchRelations(nextHost?.sketch)
        .find((relation) => relation.id === relationId);
      selectObject(host.id, nextRelation ? { relationId: nextRelation.id } : {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateSketchHostAndSelectDetail = (operation, detail = {}, message = "Sketch updated.", objectId = selectedObjectId()) => {
    const host = sketchHostForId(objectId);
    if (!host) return;
    try {
      const nextProject = operation(host.id, host);
      applyProjectChange(nextProject);
      selectObject(host.id, detail || {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const updateSketchHostAndSelectRelationPatch = (operation, relationPatch, message = "Sketch updated.", objectId = selectedObjectId()) => {
    const host = sketchHostForId(objectId);
    if (!host || !relationPatch) return;
    try {
      const nextProject = operation(host.id, host);
      applyProjectChange(nextProject);
      selection.select([host.id]);
      const nextHost = sketchHostFromProject(nextProject, host.id);
      const relationKey = sketchRelationKey(relationPatch);
      const nextRelation = nextHost
        ? sketchRelations(nextHost.sketch).find((relation) => sketchRelationKey(relation) === relationKey)
        : null;
      selectObject(host.id, nextRelation ? { relationId: nextRelation.id } : {});
      setMessage(message, "ok");
    } catch (error) {
      showError(error);
    }
  };

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

  const currentSketchRelation = (objectId, relationId) => {
    if (!objectId || !relationId) return null;
    const host = sketchHostForId(objectId);
    return sketchRelations(host?.sketch).find((relation) => relation.id === relationId) || null;
  };

  const relationPayloadObjectId = (payload = {}) => payload.objectId || selectedObjectId();

  const relationFromPayload = (payload = {}) => (
    currentSketchRelation(relationPayloadObjectId(payload), payload.relationId)
    || payload.relation
    || null
  );

  const setPlateSketchRelationValue = (value, commit = {}) => {
    const relation = relationFromPayload(commit);
    if (!relation) return;
    if (relation.type === "length") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeLength(objectId, relation.edgeId, value, { mode: "driving" })
          : api.setPlateSketchEdgeLength(objectId, relation.edgeId, value, { mode: "driving" }),
        relation.id,
        "Sketch dimension updated."
      );
    } else if (relation.type === "angle") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeAngle(objectId, relation.edgeIds, value, { mode: "driving", targetEdgeId: relation.edgeIds?.[1] })
          : api.setPlateSketchEdgeAngle(objectId, relation.edgeIds, value, { mode: "driving", targetEdgeId: relation.edgeIds?.[1] }),
        relation.id,
        "Sketch dimension updated."
      );
    } else if (relation.type === "distance") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchPointDistance(objectId, relation.vertexIds, value, { mode: "driving", targetVertexId: relation.vertexIds?.[1] })
          : api.setPlateSketchPointDistance(objectId, relation.vertexIds, value, { mode: "driving", targetVertexId: relation.vertexIds?.[1] }),
        relation.id,
        "Sketch dimension updated."
      );
    } else if (relation.type === "radius") {
      const display = sketchRadiusRelationDisplay(relation);
      const radius = display === "diameter" ? value / 2 : value;
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeRadius(objectId, relation.edgeId, radius, { mode: "driving", display })
          : api.setPlateSketchEdgeRadius(objectId, relation.edgeId, radius, { mode: "driving", display }),
        relation.id,
        "Sketch dimension updated."
      );
    }
  };

  const selectPlateSketchRelation = (payload = {}) => {
    const objectId = relationPayloadObjectId(payload);
    if (objectId && payload.relationId) selectObject(objectId, { relationId: payload.relationId });
  };

  const setPlateSketchRelationMode = (payload = {}) => {
    const relation = relationFromPayload(payload);
    const nextMode = payload.mode;
    if (!relation || !["driving", "driven"].includes(nextMode)) return;
    if (relation.type === "length") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeLengthMode(objectId, relation.edgeId, nextMode)
          : api.setPlateSketchEdgeLengthMode(objectId, relation.edgeId, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    } else if (relation.type === "angle") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeAngleMode(objectId, relation.edgeIds, nextMode)
          : api.setPlateSketchEdgeAngleMode(objectId, relation.edgeIds, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    } else if (relation.type === "distance") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchPointDistanceMode(objectId, relation.vertexIds, nextMode)
          : api.setPlateSketchPointDistanceMode(objectId, relation.vertexIds, nextMode),
        relation.id,
        `Sketch dimension set ${nextMode}.`
      );
    } else if (relation.type === "radius") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeRadiusMode(objectId, relation.edgeId, nextMode)
          : api.setPlateSketchEdgeRadiusMode(objectId, relation.edgeId, nextMode),
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
    updateSketchHostAndSelectDetail(
      (objectId, host) => host.collection === "sketches"
        ? api.removeSketchRelation(objectId, relation.id)
        : api.removePlateSketchRelation(objectId, relation.id),
      payload.detail || {},
      sketchRelationRemoveMessage(relation)
    );
  };

  const addPlateSketchRelationFromPayload = (payload = {}) => {
    const relation = payload.relation;
    const objectId = payload.objectId || selectedObjectId();
    if (!objectId || !relation) return;
    if (relation.type === "length") {
      updateSketchHostAndSelectRelationPatch(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeLengthMode(objectId, relation.edgeId, "driving")
          : api.setPlateSketchEdgeLengthMode(objectId, relation.edgeId, "driving"),
        { type: "length", edgeId: relation.edgeId },
        `${sketchHostLabel(sketchHostForId(objectId))} updated.`,
        objectId
      );
      return;
    }
    if (relation.type === "angle") {
      updateSketchHostAndSelectRelationPatch(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeAngleMode(objectId, relation.edgeIds, "driving")
          : api.setPlateSketchEdgeAngleMode(objectId, relation.edgeIds, "driving"),
        { type: "angle", edgeIds: relation.edgeIds },
        `${sketchHostLabel(sketchHostForId(objectId))} updated.`,
        objectId
      );
      return;
    }
    if (relation.type === "distance") {
      updateSketchHostAndSelectRelationPatch(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchPointDistanceMode(objectId, relation.vertexIds, "driving")
          : api.setPlateSketchPointDistanceMode(objectId, relation.vertexIds, "driving"),
        { type: "distance", vertexIds: relation.vertexIds },
        `${sketchHostLabel(sketchHostForId(objectId))} updated.`,
        objectId
      );
      return;
    }
    if (relation.type === "radius") {
      updateSketchHostAndSelectRelationPatch(
        (objectId, host) => host.collection === "sketches"
          ? api.setSketchEdgeRadius(objectId, relation.edgeId, relation.value, { mode: "driven", ...(relation.display ? { display: relation.display } : {}) })
          : api.setPlateSketchEdgeRadius(objectId, relation.edgeId, relation.value, { mode: "driven", ...(relation.display ? { display: relation.display } : {}) }),
        { type: "radius", edgeId: relation.edgeId },
        `${sketchHostLabel(sketchHostForId(objectId))} updated.`,
        objectId
      );
      return;
    }
    updateSketchHostAndSelectRelationPatch(
      (objectId, host) => host.collection === "sketches"
        ? api.upsertSketchRelation(objectId, relation)
        : api.upsertPlateSketchRelation(objectId, relation),
      relation,
      `${sketchHostLabel(sketchHostForId(objectId))} updated.`,
      objectId
    );
  };

  const addPlateSketchConstructionLineFromPayload = (payload = {}) => {
    const objectId = payload.objectId || selectedObjectId();
    const { from, to } = payload;
    if (!objectId || !Array.isArray(from) || !Array.isArray(to)) return;
    const host = sketchHostForId(objectId);
    if (!host) return;
    try {
      const nextProject = host.collection === "sketches"
        ? api.addSketchConstructionLine(objectId, from, to)
        : api.addPlateSketchConstructionLine(objectId, from, to);
      applyProjectChange(nextProject);
      const nextHost = sketchHostFromProject(nextProject, objectId);
      const nextEdges = sketchConstructionEdges(nextHost?.sketch);
      const nextVertexMap = sketchVertexPointMap(nextHost?.sketch);
      const newEdge = [...nextEdges].reverse().find((edge) => {
        const edgeFrom = nextVertexMap.get(edge.from);
        const edgeTo = nextVertexMap.get(edge.to);
        return (sameSketchPoint(edgeFrom, from) && sameSketchPoint(edgeTo, to))
          || (sameSketchPoint(edgeFrom, to) && sameSketchPoint(edgeTo, from));
      });
      selectObject(objectId, newEdge ? { edgeIds: [newEdge.id] } : {});
      setMessage(`${sketchHostLabel(host)} updated.`, "ok");
    } catch (error) {
      showError(error);
    }
  };

  const createPlateSketchThreePointArcFromPayload = (payload = {}) => {
    const objectId = payload.objectId || selectedObjectId();
    const vertexIds = arrayValues(payload.vertexIds).filter(Boolean);
    if (!objectId || vertexIds.length !== 3) return;
    const host = sketchHostForId(objectId);
    if (!host) return;
    try {
      const result = host.collection === "sketches"
        ? api.setSketchThreePointArc(objectId, vertexIds, { mode: "driven" })
        : api.setPlateSketchThreePointArc(objectId, vertexIds, { mode: "driven" });
      applyProjectChange(result.project);
      selectObject(objectId, result.edgeId ? { edgeIds: [result.edgeId] } : {});
      setMessage("3 point arc created.", "ok");
    } catch (error) {
      showError(error);
    }
  };

  const convertPlateSketchEdgeArcFromPayload = (payload = {}) => {
    const objectId = payload.objectId || selectedObjectId();
    const edgeId = payload.edgeId;
    if (!objectId || !edgeId) return;
    updateSketchHostAndSelectDetail(
      (objectId, host) => host.collection === "sketches"
        ? api.setSketchEdgeArc(objectId, edgeId, { radius: payload.radius, side: payload.side || "left", mode: "driven" })
        : api.setPlateSketchEdgeArc(objectId, edgeId, { radius: payload.radius, side: payload.side || "left", mode: "driven" }),
      { edgeIds: [edgeId] },
      "Sketch edge converted to arc."
    );
  };

  const flipPlateSketchArcFromPayload = (payload = {}) => {
    const objectId = payload.objectId || selectedObjectId();
    const edgeId = payload.edgeId;
    if (!objectId || !edgeId) return;
    updateSketchHostAndSelectDetail(
      (objectId, host) => host.collection === "sketches"
        ? api.flipSketchEdgeArc(objectId, edgeId)
        : api.flipPlateSketchEdgeArc(objectId, edgeId),
      { edgeIds: [edgeId] },
      "Sketch arc flipped."
    );
  };

  const splitPlateSketchArcFromPayload = (payload = {}) => {
    const objectId = payload.objectId || selectedObjectId();
    const edgeId = payload.edgeId;
    if (!objectId || !edgeId) return;
    const host = sketchHostForId(objectId);
    if (!host) return;
    try {
      const result = host.collection === "sketches"
        ? api.splitSketchEdgeArc(objectId, edgeId, { mode: "driven" })
        : api.splitPlateSketchEdgeArc(objectId, edgeId, { mode: "driven" });
      applyProjectChange(result.project);
      selectObject(objectId, {
        edgeIds: arrayValues(result.edgeIds).filter(Boolean).slice(0, 2),
        vertexIds: result.vertexId ? [result.vertexId] : [],
        sketchMode: "relations"
      });
      setMessage("Sketch arc split.", "ok");
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
        : relation.type === "radius"
          ? sketchRadiusRelationMode(relation)
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
      : relation.type === "radius"
        ? `${relation.edgeId} (${relationMode === "driven" ? `reference ${sketchRadiusRelationDisplay(relation) === "diameter" ? relation.value * 2 : relation.value} mm` : "driving"})`
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

  const previewRelationHealthRecord = (status, message = "") => ({
    status,
    severity: status === "ok" ? "ok" : status === "driven" ? "info" : status === "redundant" ? "warning" : "error",
    ...(message ? { message } : {})
  });

  const sortedSketchRelations = (relations, relationHealth) => relations
    .map((relation, index) => ({ relation, index, weight: sketchRelationSortWeight(relation, relationHealth) }))
    .sort((a, b) => a.weight - b.weight || a.index - b.index)
    .map((item) => item.relation);

  const resolveSketchRelation = (relation, relationMode, healthStatus, relationDetail = {}) => {
    if (healthStatus === "conflicted") {
      updateSketchHostAndSelectRelation(
        (objectId, host) => host.collection === "sketches"
          ? api.removeSketchRelation(objectId, relation.id)
          : api.solvePlateSketchRelation(objectId, relation.id),
        relation.id,
        sketchHostForId()?.collection === "sketches" ? "Sketch relation removed." : "Sketch relation resolved."
      );
      return;
    }
    if (healthStatus === "redundant" && relationMode === "driving") {
      if (relation.type === "length") {
        updateSketchHostAndSelectRelation(
          (objectId, host) => host.collection === "sketches"
            ? api.setSketchEdgeLengthMode(objectId, relation.edgeId, "driven")
            : api.setPlateSketchEdgeLengthMode(objectId, relation.edgeId, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
      if (relation.type === "angle") {
        updateSketchHostAndSelectRelation(
          (objectId, host) => host.collection === "sketches"
            ? api.setSketchEdgeAngleMode(objectId, relation.edgeIds, "driven")
            : api.setPlateSketchEdgeAngleMode(objectId, relation.edgeIds, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
      if (relation.type === "distance") {
        updateSketchHostAndSelectRelation(
          (objectId, host) => host.collection === "sketches"
            ? api.setSketchPointDistanceMode(objectId, relation.vertexIds, "driven")
            : api.setPlateSketchPointDistanceMode(objectId, relation.vertexIds, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
      if (relation.type === "radius") {
        updateSketchHostAndSelectRelation(
          (objectId, host) => host.collection === "sketches"
            ? api.setSketchEdgeRadiusMode(objectId, relation.edgeId, "driven")
            : api.setPlateSketchEdgeRadiusMode(objectId, relation.edgeId, "driven"),
          relation.id,
          "Sketch relation converted to reference."
        );
        return;
      }
    }
    updateSketchHostAndSelectDetail(
      (objectId, host) => host.collection === "sketches"
        ? api.removeSketchRelation(objectId, relation.id)
        : api.removePlateSketchRelation(objectId, relation.id),
      relationDetail,
      "Sketch relation removed."
    );
  };

  const plateEditor = (plate) => {
    const host = sketchHostForId(plate?.id);
    const isStandaloneSketch = host?.collection === "sketches";
    const definition = isStandaloneSketch ? sketchDefinitionStatus(plate?.sketch) : plateSketchDefinitionStatus(plate);
    const fields = [];
    const outlineEdges = sketchEdges(plate.sketch);
    const constructionEdges = sketchConstructionEdges(plate.sketch);
    const edgeById = new Map([...outlineEdges, ...constructionEdges].map((edge, index) => [edge.id, { edge, index }]));
    const vertices = sketchVertices(plate.sketch);
    const vertexIds = new Set(vertices.map((vertex) => vertex.id));
    const relations = sketchRelations(plate.sketch);
    const relationIds = new Set(relations.map((relation) => relation.id));
    const fixedRelations = relations.filter((relation) => relation.type === "fixed");
    const relationHealth = isStandaloneSketch ? sketchRelationHealth(plate.sketch) : plateSketchRelationHealth(plate);
    const selectedDetail = selectedObjectId() === plate.id ? selectedObjectDetail() || {} : {};
    const activeRelationId = relationIds.has(selectedDetail.relationId) ? selectedDetail.relationId : null;
    const activeRelation = activeRelationId ? sketchRelations(plate.sketch).find((relation) => relation.id === activeRelationId) || null : null;
    const activeEdgeIds = arrayValues(selectedDetail.edgeIds).filter((edgeId) => edgeById.has(edgeId)).slice(0, 2);
    const activeVertexIds = arrayValues(selectedDetail.vertexIds).filter((vertexId) => vertexIds.has(vertexId)).slice(0, 3);
    const constructionEdgeIds = new Set(constructionEdges.map((edge) => edge.id));
    const canConstrainVertexToEdge = (vertexId, edgeId) => {
      const edge = edgeById.get(edgeId)?.edge;
      return Boolean(edge && edge.from !== vertexId && edge.to !== vertexId);
    };
    const vertexTouchesOtherCircularArc = (vertexId, targetEdgeId) => Boolean(vertexId && targetEdgeId && [...outlineEdges, ...constructionEdges].some((edge) => (
      edge?.id
      && edge.id !== targetEdgeId
      && (edge.from === vertexId || edge.to === vertexId)
      && sketchEdgeIsCircularArc(plate.sketch, edge.id)
    )));

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
        actions: isStandaloneSketch ? [] : [{
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
      if (!["length", "angle", "distance", "radius"].includes(relation.type) || relationMode === "driven") return {};
      const unit = relation.type === "angle" ? "deg" : "mm";
      const value = relation.type === "radius" && sketchRadiusRelationDisplay(relation) === "diameter"
        ? relation.value * 2
        : relation.value;
      return {
        value,
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
      if (!["length", "angle", "distance", "radius"].includes(relation.type)) return null;
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
          title: healthStatus === "conflicted" && isStandaloneSketch
            ? "Remove this conflicted relation from the standalone sketch."
            : healthStatus === "conflicted"
            ? "Try to move sketch geometry so this relation is satisfied."
            : healthStatus === "redundant" && relationMode === "driving" && ["length", "angle", "distance", "radius"].includes(relation.type)
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

    const standaloneSketchRelationActionPreview = (relationPatch) => {
      if (relationPatch.type === "length") {
        return previewSetSketchEdgeLengthMode(plate, relationPatch.edgeId, "driving");
      }
      if (relationPatch.type === "angle") {
        return previewSetSketchEdgeAngleMode(plate, relationPatch.edgeIds, "driving");
      }
      if (relationPatch.type === "distance") {
        return previewSetSketchPointDistanceMode(plate, relationPatch.vertexIds, "driving");
      }
      return previewUpsertSketchRelation(plate, relationPatch);
    };

    const relationActionPreview = (relation) => {
      try {
        if (!isStandaloneSketch) return plateSketchRelationActionPreview(plate, relation);
        const nextSketchObject = standaloneSketchRelationActionPreview(relation);
        const relationKey = sketchRelationKey(relation);
        const nextRelation = sketchRelations(nextSketchObject?.sketch).find((item) => sketchRelationKey(item) === relationKey) || null;
        const health = nextRelation
          ? sketchRelationHealth(nextSketchObject.sketch)[nextRelation.id] || previewRelationHealthRecord("ok")
          : previewRelationHealthRecord("conflicted", "Relation could not be evaluated.");
        return {
          plate: nextSketchObject,
          relation: nextRelation,
          health,
          definition: sketchDefinitionStatus(nextSketchObject?.sketch)
        };
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
      const radiusDisplaySwitch = existingRelation?.type === "radius"
        && relation.type === "radius"
        && sketchRadiusRelationDisplay(existingRelation) !== sketchRadiusRelationDisplay(relation);
      if (existingRelation && !radiusDisplaySwitch) {
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

    const edgeArcActionDescriptor = (edgeId, edgePoints) => ({
      label: "Edge Arc",
      action: "object.plate.sketchEdge.arc",
      title: "Convert this straight sketch edge into a circular arc.",
      payload: {
        objectId: plate.id,
        edgeId,
        radius: defaultEdgeArcRadius(edgePoints),
        side: "left"
      }
    });

    const flipArcActionDescriptor = (edgeId) => ({
      label: "Flip Arc",
      action: "object.plate.sketchArc.flip",
      title: "Flip this circular arc to the opposite side of its chord.",
      payload: { objectId: plate.id, edgeId }
    });

    const splitArcActionDescriptor = (edgeId) => ({
      label: "Split Arc",
      action: "object.plate.sketchArc.split",
      title: "Split this circular arc into two tangent arcs at its midpoint.",
      payload: { objectId: plate.id, edgeId }
    });

    const selectedEntityRelationActions = () => {
      const actions = [];
      if (activeVertexIds.length === 3 && !activeEdgeIds.length) {
        actions.push({
          label: "3 Point Arc",
          action: "object.plate.sketchArc.threePoint",
          title: "Convert these three consecutive sketch vertices into a circular arc.",
          payload: { objectId: plate.id, vertexIds: [...activeVertexIds] }
        });
        return actions;
      }
      if (activeVertexIds.length === 2 && activeEdgeIds.length === 1) {
        if (!sketchEdgeIsCircularArc(plate.sketch, activeEdgeIds[0])) {
          actions.push(relationActionDescriptor({ type: "symmetric", vertexIds: activeVertexIds, edgeId: activeEdgeIds[0] }));
        }
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
          const isCircularArc = sketchEdgeIsCircularArc(plate.sketch, activeEdgeIds[0]);
          const canPointOnCircle = isCircularArc && !vertexTouchesOtherCircularArc(activeVertexIds[0], activeEdgeIds[0]);
          actions.push(
            ...(canPointOnCircle ? [relationActionDescriptor({ type: "point-on-circle", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] })] : []),
            ...(!isCircularArc ? [
              relationActionDescriptor({ type: "point-on-line", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] }),
              relationActionDescriptor({ type: "midpoint", vertexId: activeVertexIds[0], edgeId: activeEdgeIds[0] })
            ] : [])
          );
        }
        return actions;
      }
      if (activeVertexIds.length === 1) {
        actions.push(relationActionDescriptor({ type: "fixed", vertexId: activeVertexIds[0] }));
        return actions;
      }
      if (activeEdgeIds.length === 2) {
        const selectedArcEdgeCount = activeEdgeIds.filter((edgeId) => sketchEdgeIsCircularArc(plate.sketch, edgeId)).length;
        actions.push(
          ...(selectedArcEdgeCount >= 1 ? [relationActionDescriptor({ type: "tangent", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] })] : []),
          ...(selectedArcEdgeCount === 2 ? [
            relationActionDescriptor({ type: "concentric", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
            relationActionDescriptor({ type: "equal-radius", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] })
          ] : []),
          ...(!selectedArcEdgeCount ? [
            relationActionDescriptor({ type: "parallel", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
            relationActionDescriptor({ type: "collinear", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
            relationActionDescriptor({ type: "perpendicular", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
            relationActionDescriptor({ type: "equal-length", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }),
            relationActionDescriptor({ type: "angle", edgeIds: activeEdgeIds, targetEdgeId: activeEdgeIds[1] }, "Angle")
          ] : [])
        );
        return actions;
      }
      if (activeEdgeIds.length === 1) {
        const edgePoints = sketchEdgePoints(plate.sketch, activeEdgeIds[0]);
        const isCircularArc = sketchEdgeIsCircularArc(plate.sketch, activeEdgeIds[0]);
        const isConstructionEdge = constructionEdgeIds.has(activeEdgeIds[0]);
        actions.push(
          ...(!isCircularArc && !isConstructionEdge && edgePoints
            ? [edgeArcActionDescriptor(activeEdgeIds[0], edgePoints)]
            : []),
          ...(isCircularArc && !isConstructionEdge ? [flipArcActionDescriptor(activeEdgeIds[0])] : []),
          ...(isCircularArc && !isConstructionEdge ? [splitArcActionDescriptor(activeEdgeIds[0])] : []),
          ...(!isCircularArc ? [
            relationActionDescriptor({ type: "horizontal", edgeId: activeEdgeIds[0] }),
            relationActionDescriptor({ type: "vertical", edgeId: activeEdgeIds[0] }),
            relationActionDescriptor({ type: "length", edgeId: activeEdgeIds[0] }, "Length")
          ] : []),
          relationActionDescriptor({ type: "fixed", edgeId: activeEdgeIds[0] }),
          ...(isCircularArc ? [relationActionDescriptor({
            type: "radius",
            edgeId: activeEdgeIds[0],
            value: measuredSketchEdgeRadius(plate.sketch, activeEdgeIds[0]),
            mode: "driven",
            display: "radius"
          }, "Radius")] : []),
          ...(isCircularArc ? [relationActionDescriptor({
            type: "radius",
            edgeId: activeEdgeIds[0],
            value: measuredSketchEdgeRadius(plate.sketch, activeEdgeIds[0]),
            mode: "driven",
            display: "diameter"
          }, "Diameter")] : []),
          ...(isCircularArc || isConstructionEdge || !edgePoints ? [] : [constructionLineActionDescriptor(edgePoints.from, edgePoints.to)])
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
    if (!isStandaloneSketch && fixedRelations.length) {
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
    createPlateSketchThreePointArcFromPayload,
    convertPlateSketchEdgeArcFromPayload,
    flipPlateSketchArcFromPayload,
    splitPlateSketchArcFromPayload,
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

function defaultEdgeArcRadius(edgePoints) {
  if (!edgePoints?.from || !edgePoints?.to) return 50;
  const chordLength = Math.hypot(edgePoints.to[0] - edgePoints.from[0], edgePoints.to[1] - edgePoints.from[1]);
  const radius = Math.max(chordLength * 0.75, chordLength / 2 + 1, 10);
  return Math.round(radius * 1000) / 1000;
}
