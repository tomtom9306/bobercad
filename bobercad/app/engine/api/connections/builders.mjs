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

export function createSemanticBuilders(ctx) {
  return {
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
          display: data.display,
          bim: data.bim
        };
        ctx.add("fastenerGroups", id, group);
        ctx.role(role, id);
        return group;
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
    }
  };
}
