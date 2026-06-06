import { planeExtentsFromSize } from "../../geometry/feature-plane.mjs";

function gridPositions({ rows, columns, pitch, gauge }) {
  const positions = [];
  for (let row = 0; row < rows; row += 1) {
    const z = (row - (rows - 1) / 2) * pitch;
    for (let column = 0; column < columns; column += 1) {
      positions.push([(column - (columns - 1) / 2) * gauge, z]);
    }
  }
  return positions;
}

function trimRegionKey(parts) {
  return parts.map(({ planeId, side }) => `${planeId}:${side}`).join("|");
}

function planeTrimRegionKeys(referencePlaneIds) {
  const keys = [];
  const walk = (index, parts) => {
    if (index >= referencePlaneIds.length) {
      keys.push(trimRegionKey(parts));
      return;
    }
    const planeId = referencePlaneIds[index];
    walk(index + 1, [...parts, { planeId, side: "-" }]);
    walk(index + 1, [...parts, { planeId, side: "+" }]);
  };
  walk(0, []);
  return keys;
}

function defaultPlaneTrimRemovedRegionKeys(referencePlaneIds) {
  return planeTrimRegionKeys(referencePlaneIds).filter((key) => key.split("|").some((part) => part.endsWith(":-")));
}

function fastenerValueControls(data = {}) {
  const parameterPaths = data.parameterPaths || data.valuePaths || data.valueSource?.parameterPaths;
  const controls = {
    kind: "component-driven-fastener-values",
    api: "model.fastener.patternedGroup",
    abstractionLayers: ["component", "hole-pattern", "feature", "fastener-group"],
    componentDrivesValues: true,
    directFastenerOverrides: true,
    valueBindingMode: "component-driven-with-direct-override"
  };
  if (parameterPaths && Object.keys(parameterPaths).length) {
    controls.parameterPaths = parameterPaths;
    controls.valueBindings = Object.fromEntries(Object.entries(parameterPaths).map(([field, path]) => [field, {
      source: "component-parameter",
      path,
      override: "direct-object-field-override"
    }]));
  }
  if (data.valueSource?.componentRole) controls.componentRole = data.valueSource.componentRole;
  return controls;
}

export function createSemanticBuilders(ctx) {
  const builders = {
    member: {
      beam(role, data) {
        return ctx.createMember(role, { ...data, type: "beam" });
      },

      column(role, data) {
        return ctx.createMember(role, { ...data, type: "column" });
      }
    },

    reference: {
      plane(role, data) {
        const id = ctx.id(role);
        const plane = {
          id,
          type: data.type || "reference-plane",
          name: data.name,
          origin: data.origin,
          normal: data.normal,
          axisX: data.axisX,
          axisY: data.axisY,
          extents: data.extents || planeExtentsFromSize(data.size),
          notes: data.notes,
          display: data.display,
          fabrication: data.fabrication,
          bim: data.bim
        };
        ctx.add("referencePlanes", id, plane);
        ctx.role(role, id);
        return plane;
      }
    },

    trim: {
      planeTrim(role, data) {
        if (!data.memberId) ctx.fail(`${role}: plane trim missing memberId`);
        const referencePlaneIds = data.referencePlaneIds;
        if (!Array.isArray(referencePlaneIds) || !referencePlaneIds.length) ctx.fail(`${role}: plane trim missing referencePlaneIds`);
        const id = ctx.id(role);
        const operationId = `${id}_plane_trim`;
        const trimJoint = {
          id,
          type: "member-trim",
          gap: data.gap || 0,
          participants: [{
            memberId: data.memberId,
            ...(data.memberEnd ? { memberEnd: data.memberEnd } : {}),
            enabled: data.operationEnabled !== false
          }],
          operations: [{
            id: operationId,
            type: "plane-trim",
            memberAId: data.memberId,
            ...(data.memberEnd ? { memberAEnd: data.memberEnd } : {}),
            referencePlaneIds,
            removedRegionKeys: data.removedRegionKeys || defaultPlaneTrimRemovedRegionKeys(referencePlaneIds),
            gap: data.gap || 0,
            enabled: data.operationEnabled !== false
          }],
          placementIntent: data.placementIntent,
          fabrication: data.fabrication,
          display: data.display,
          bim: data.bim
        };
        ctx.add("trimJoints", id, trimJoint);
        ctx.role(role, id);
        return trimJoint;
      },

      cornerTrim(role, data) {
        if (!Array.isArray(data.memberIds) || data.memberIds.length < 2) ctx.fail(`${role}: corner trim requires at least two memberIds`);
        const [memberAId, memberBId] = data.memberIds;
        const operationType = data.operationType || data.type || "end-butt-both";
        if (!["end-butt-1", "end-butt-2", "end-butt-both", "end-miter", "profile-cope"].includes(operationType)) {
          ctx.fail(`${role}: unsupported corner trim operation ${operationType}`);
        }
        if (data.miterMode && operationType !== "end-miter") ctx.fail(`${role}: miterMode is only valid for end-miter`);
        if (data.miterMode && !["equal-angle", "profile-balanced"].includes(data.miterMode)) ctx.fail(`${role}: unsupported miterMode ${data.miterMode}`);
        const id = ctx.id(role);
        const operationId = data.operationId || `${id}_${operationType.replace(/-/g, "_")}`;
        const trimJoint = {
          id,
          type: "corner-trim",
          gap: data.gap || 0,
          participants: data.memberIds.map((memberId) => ({
            memberId,
            ...(data.memberEnds?.[memberId] ? { memberEnd: data.memberEnds[memberId] } : {}),
            enabled: data.operationEnabled !== false
          })),
          operations: [{
            id: operationId,
            type: operationType,
            memberAId,
            memberBId,
            ...(data.memberAEnd ? { memberAEnd: data.memberAEnd } : data.memberEnds?.[memberAId] ? { memberAEnd: data.memberEnds[memberAId] } : {}),
            ...(data.memberBEnd ? { memberBEnd: data.memberBEnd } : data.memberEnds?.[memberBId] ? { memberBEnd: data.memberEnds[memberBId] } : {}),
            ...(data.miterMode ? { miterMode: data.miterMode } : {}),
            gap: data.gap || 0,
            enabled: data.operationEnabled !== false
          }],
          placementIntent: data.placementIntent,
          fabrication: data.fabrication,
          display: data.display,
          bim: data.bim
        };
        ctx.add("trimJoints", id, trimJoint);
        ctx.role(role, id);
        return trimJoint;
      }
    },

    part: {
      plate(role, data) {
        const id = ctx.id(role);
        const plate = {
          id,
          type: data.type || "rectangular-plate",
          thickness: data.thickness,
          width: data.width,
          height: data.height,
          outline: data.outline,
          center: data.center,
          normal: data.normal,
          localAxisY: data.localAxisY,
          localAxisZ: data.localAxisZ,
          flatPattern: data.flatPattern,
          featureIds: data.featureIds || [],
          assemblyId: data.assemblyId,
          placementIntent: data.placementIntent,
          display: data.display,
          fabrication: data.fabrication,
          bim: data.bim
        };
        ctx.add("plates", id, plate);
        ctx.role(role, id);
        return plate;
      }
    },

    pattern: {
      rectangularGrid(role, data) {
        const id = ctx.id(role);
        const pattern = {
          id,
          type: "rectangular-grid",
          holeDiameter: data.holeDiameter,
          holeType: data.holeType,
          positions: Array.isArray(data.positions) ? data.positions : gridPositions(data)
        };
        if (data.layoutReference) pattern.layoutReference = data.layoutReference;
        ctx.add("holePatterns", id, pattern);
        ctx.role(role, id);
        return pattern;
      }
    },

    feature: {
      holePattern(role, data) {
        const id = ctx.id(role);
        const feature = {
          id,
          type: "hole-pattern",
          ownerId: data.ownerId,
          holePatternRef: data.holePatternRef,
          depth: data.depth,
          reference: data.reference,
          placementIntent: data.placementIntent,
          fabrication: data.fabrication,
          display: data.display,
          bim: data.bim
        };
        ctx.add("features", id, feature);
        ctx.attachFeature(data.ownerId, id);
        ctx.role(role, id);
        return feature;
      },

      booleanPart(role, data) {
        const id = ctx.id(role);
        const feature = {
          id,
          type: "boolean-part",
          teklaClass: data.teklaClass || "BooleanPart",
          booleanType: data.booleanType,
          cutKind: data.cutKind,
          ownerId: data.ownerId,
          operationEnabled: data.operationEnabled,
          source: data.source,
          target: data.target,
          offsets: data.offsets,
          placementIntent: data.placementIntent,
          fabrication: data.fabrication,
          display: data.display,
          bim: data.bim
        };
        if (data.cut !== undefined) feature.cut = data.cut;
        if (data.body !== undefined) feature.body = data.body;
        ctx.add("features", id, feature);
        ctx.attachFeature(data.ownerId, id);
        ctx.role(role, id);
        return feature;
      },

      clearanceCut(role, data) {
        const id = ctx.id(role);
        const feature = {
          id,
          type: "clearance-cut",
          kind: data.kind,
          cutKind: data.cutKind || "part-cut",
          ownerId: data.ownerId,
          operationEnabled: data.operationEnabled,
          source: data.source,
          target: data.target,
          offsets: data.offsets,
          placementIntent: data.placementIntent,
          fabrication: data.fabrication,
          display: data.display,
          bim: data.bim
        };
        ctx.add("features", id, feature);
        ctx.attachFeature(data.ownerId, id);
        ctx.role(role, id);
        return feature;
      }
    },

    fastener: {
      group(role, data) {
        const id = ctx.id(role);
        const group = {
          id,
          type: "fastener-group",
          fastenerRef: data.fastenerRef,
          holePatternRef: data.holePatternRef,
          participants: data.participants,
          through: data.through,
          orientation: data.orientation,
          assembly: data.assembly,
          placementIntent: data.placementIntent,
          authoring: data.authoring,
          display: data.display,
          bim: data.bim
        };
        ctx.add("fastenerGroups", id, group);
        ctx.role(role, id);
        return group;
      },

      patternedGroup(role, data = {}) {
        const pattern = data.holePatternRef
          ? { id: data.holePatternRef }
          : builders.pattern.rectangularGrid(data.patternRole || `${role}Pattern`, {
            ...(data.pattern || {}),
            holeDiameter: data.holeDiameter ?? data.pattern?.holeDiameter,
            holeType: data.holeType ?? data.pattern?.holeType ?? "round",
            positions: data.positions ?? data.pattern?.positions,
            rows: data.rows ?? data.pattern?.rows,
            columns: data.columns ?? data.pattern?.columns,
            pitch: data.pitch ?? data.pattern?.pitch,
            gauge: data.gauge ?? data.pattern?.gauge,
            layoutReference: data.layoutReference ?? data.pattern?.layoutReference
          });
        const featureSpecs = data.features || (data.feature ? [data.feature] : []);
        const features = featureSpecs.map((featureSpec, index) => builders.feature.holePattern(
          featureSpec.role || data.featureRole || `${role}Holes${index ? index + 1 : ""}`,
          {
            ...featureSpec,
            holePatternRef: featureSpec.holePatternRef || pattern.id
          }
        ));
        const primaryFeature = features[0];
        const authoring = {
          ...(data.authoring || {}),
          controls: {
            ...((data.authoring || {}).controls || {}),
            ...fastenerValueControls(data)
          }
        };
        const fasteners = builders.fastener.group(role, {
          fastenerRef: data.fastenerRef,
          holePatternRef: pattern.id,
          participants: data.participants || [],
          through: data.through || (primaryFeature ? { fromFeatureId: primaryFeature.id } : undefined),
          orientation: data.orientation,
          assembly: data.assembly,
          placementIntent: data.placementIntent,
          authoring,
          display: data.display,
          bim: data.bim
        });
        return {
          pattern,
          feature: primaryFeature,
          features,
          fasteners,
          patternId: pattern.id,
          featureId: primaryFeature?.id,
          featureIds: features.map((feature) => feature.id),
          fastenerId: fasteners.id
        };
      }
    },

    weld: {
      fillet(role, data) {
        const id = ctx.id(role);
        const weld = {
          id,
          type: "fillet-weld",
          size: data.size,
          participants: data.participants,
          reference: data.reference,
          placementIntent: data.placementIntent,
          display: data.display,
          bim: data.bim
        };
        ctx.add("welds", id, weld);
        ctx.role(role, id);
        return weld;
      }
    },

    group: {
      create(role, data = {}) {
        const id = ctx.id(role);
        const group = {
          id,
          type: data.type || "object-group",
          name: data.name || role,
          objectIds: data.objectIds || [],
          projectTreeNodeId: data.projectTreeNodeId,
          sourceTemplate: data.sourceTemplate,
          authoring: data.authoring,
          display: data.display,
          bim: data.bim
        };
        ctx.add("groups", id, group);
        ctx.role(role, id);
        return group;
      }
    },

    assembly: {
      create(role, data = {}) {
        const id = ctx.id(role);
        const assembly = {
          id,
          type: data.type || "assembly",
          name: data.name || role,
          mark: data.mark,
          parentAssemblyId: data.parentAssemblyId,
          childAssemblyIds: data.childAssemblyIds || [],
          partIds: data.partIds || [],
          memberIds: data.memberIds || [],
          plateIds: data.plateIds || [],
          connectionZoneIds: data.connectionZoneIds || [],
          authoring: data.authoring,
          display: data.display,
          bim: data.bim
        };
        ctx.add("assemblies", id, assembly);
        ctx.role(role, id);
        return assembly;
      }
    },

    workPoint: {
      create(role, data = {}) {
        const id = ctx.id(role);
        const point = {
          id,
          role: data.role || role,
          point: data.point,
          gridSystemId: data.gridSystemId,
          gridRefs: data.gridRefs,
          referencePlaneId: data.referencePlaneId,
          notes: data.notes
        };
        ctx.add("workPoints", id, point);
        ctx.role(role, id);
        return point;
      }
    },

    objectPattern: {
      create(role, data = {}) {
        const id = ctx.id(role);
        const pattern = {
          id,
          type: data.type || "linear-pattern",
          status: data.status || "linked",
          generatedObjectIds: data.generatedObjectIds || [],
          detachedObjectIds: data.detachedObjectIds || [],
          transform: data.transform,
          authoring: data.authoring,
          notes: data.notes
        };
        ctx.add("objectPatterns", id, pattern);
        ctx.role(role, id);
        return pattern;
      }
    }
  };

  builders.plate = { create: builders.part.plate };
  return builders;
}
