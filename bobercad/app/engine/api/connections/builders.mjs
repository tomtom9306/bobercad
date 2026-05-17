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

export function createSemanticBuilders(ctx) {
  return {
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

      fitting(role, data) {
        const id = ctx.id(role);
        const feature = {
          id,
          type: "fitting",
          cutKind: "fitting",
          ownerId: data.ownerId,
          operationEnabled: data.operationEnabled,
          plane: data.plane,
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
