import { normalizePlate, sketchFromOutline, sketchFromRectangle } from "../project/plate-sketch-relations-and-bends.mjs";
import { trimOperationUsesMemberEnd } from "../project/trim-operations.mjs";

function gridPositions(data, ctx) {
  const rows = requiredPositiveInteger(data.rows, "rectangular grid rows", ctx);
  const columns = requiredPositiveInteger(data.columns, "rectangular grid columns", ctx);
  const pitch = requiredNonNegativeNumber(data.pitch, "rectangular grid pitch", ctx);
  const gauge = requiredNonNegativeNumber(data.gauge, "rectangular grid gauge", ctx);
  const positions = [];
  for (let row = 0; row < rows; row += 1) {
    const z = (row - (rows - 1) / 2) * pitch;
    for (let column = 0; column < columns; column += 1) {
      positions.push([(column - (columns - 1) / 2) * gauge, z]);
    }
  }
  return positions;
}

function fastenerValueControls(data, ctx) {
  const parameterPaths = data.parameterPaths;
  if (parameterPaths !== undefined && (!parameterPaths || typeof parameterPaths !== "object" || Array.isArray(parameterPaths))) {
    ctx.fail("fastener parameterPaths must be an object");
  }
  if (parameterPaths && Object.keys(parameterPaths).some((key) => typeof key !== "string" || !key.trim())) {
    ctx.fail("fastener parameterPaths keys must be non-empty strings");
  }
  if (parameterPaths && Object.values(parameterPaths).some((path) => typeof path !== "string" || !path.trim())) {
    ctx.fail("fastener parameterPaths values must be non-empty strings");
  }
  const controls = {
    kind: "component-driven-fastener-values"
  };
  if (parameterPaths && Object.keys(parameterPaths).length) {
    controls.parameterPaths = parameterPaths;
  }
  return controls;
}

function placementMetadata(data) {
  return {
    placementIntent: data.placementIntent,
    fabrication: data.fabrication,
    display: data.display,
    bim: data.bim
  };
}

function optionalString(value, fallback, label, ctx) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !value.trim()) ctx.fail(`${label} must be a non-empty string`);
  return value;
}

function requiredString(value, label, ctx) {
  if (typeof value !== "string" || !value.trim()) ctx.fail(`${label} must be a non-empty string`);
  return value;
}

function optionalObject(value, fallback, label, ctx) {
  if (value === undefined) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) ctx.fail(`${label} must be an object`);
  return value;
}

function requiredObject(value, label, ctx) {
  if (!value || typeof value !== "object" || Array.isArray(value)) ctx.fail(`${label} must be an object`);
  return value;
}

function requiredStringArray(value, label, ctx) {
  if (!Array.isArray(value)) ctx.fail(`${label} must be an array of non-empty strings`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) ctx.fail(`${label} must be an array of non-empty strings`);
    if (seen.has(item)) ctx.fail(`${label} contains duplicate value: ${item}`);
    seen.add(item);
  }
  return value;
}

function requiredNonEmptyStringArray(value, label, ctx) {
  const items = requiredStringArray(value, label, ctx);
  if (!items.length) ctx.fail(`${label} cannot be empty`);
  return items;
}

function optionalStringArray(value, label, ctx) {
  return value === undefined ? [] : requiredStringArray(value, label, ctx);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function requiredNonNegativeNumber(value, label, ctx) {
  if (!Number.isFinite(value) || value < 0) ctx.fail(`${label} must be a non-negative number`);
  return value;
}

function requiredPositiveNumber(value, label, ctx) {
  if (!Number.isFinite(value) || value <= 0) ctx.fail(`${label} must be a positive number`);
  return value;
}

function requiredOffsets(value, label, ctx) {
  const offsets = requiredObject(value, label, ctx);
  return Object.fromEntries(["xMinus", "xPlus", "yMinus", "yPlus", "zMinus", "zPlus"]
    .map((key) => [key, requiredNonNegativeNumber(offsets[key], `${label}.${key}`, ctx)]));
}

function requiredPositiveInteger(value, label, ctx) {
  if (!Number.isInteger(value) || value <= 0) ctx.fail(`${label} must be a positive integer`);
  return value;
}

function trimGap(data, ctx) {
  return requiredNonNegativeNumber(data.gap, "trim gap", ctx);
}

function rejectDefinedFields(data, fields, label, ctx) {
  for (const field of fields) {
    if (data[field] !== undefined) ctx.fail(`${label}.${field} is not supported here`);
  }
}

function plateSketch(data, role, id, ctx) {
  const hasSketch = data.sketch !== undefined;
  const hasOutline = data.outline !== undefined;
  const hasRectangle = data.width !== undefined || data.height !== undefined;
  const sourceCount = [hasSketch, hasOutline, hasRectangle].filter(Boolean).length;
  if (sourceCount !== 1) ctx.fail(`${role}: plate must define exactly one sketch source: sketch, outline, or width/height`);
  if (hasSketch) return data.sketch;
  if (hasOutline) return sketchFromOutline(data.outline, id);
  if (data.width === undefined || data.height === undefined) ctx.fail(`${role}: plate rectangle requires width and height`);
  return sketchFromRectangle(data.width, data.height, id);
}

function optionalMemberEnd(value, label, ctx) {
  if (value === undefined) return undefined;
  if (value === "start" || value === "end") return value;
  ctx.fail(`${label} must be start or end`);
}

function referencePlaneExtents(data, role, ctx) {
  if (data.size !== undefined) ctx.fail(`${role}: reference plane size is not supported; use extents`);
  if (data.extents !== undefined) return optionalObject(data.extents, undefined, `${role}: reference plane extents`, ctx);
  return undefined;
}

function trimJointMetadata(data, ctx) {
  return {
    gap: trimGap(data, ctx),
    ...placementMetadata(data)
  };
}

function featureOperationFields(data) {
  return {
    ownerId: data.ownerId,
    operationEnabled: data.operationEnabled,
    source: data.source,
    target: data.target,
    offsets: data.offsets,
    ...placementMetadata(data)
  };
}

export function createSemanticBuilders(ctx) {
  function createFeature(role, fields) {
    const feature = { id: ctx.id(role), ...fields };
    ctx.add("features", feature.id, feature);
    ctx.attachFeature(feature.ownerId, feature.id);
    ctx.role(role, feature.id);
    return feature;
  }

  function createTrimJoint(role, id, data, fields) {
    const { type, ...rest } = fields;
    const trimJoint = { id, type, ...trimJointMetadata(data, ctx), ...rest };
    ctx.add("trimJoints", id, trimJoint);
    ctx.role(role, id);
    return trimJoint;
  }

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
        const extents = referencePlaneExtents(data, role, ctx);
        const plane = {
          id,
          type: optionalString(data.type, "reference-plane", `${role}: reference plane type`, ctx),
          name: data.name,
          origin: data.origin,
          normal: data.normal,
          axisX: data.axisX,
          axisY: data.axisY,
          notes: data.notes,
          display: data.display,
          fabrication: data.fabrication,
          bim: data.bim
        };
        if (extents !== undefined) plane.extents = extents;
        ctx.add("referencePlanes", id, plane);
        ctx.role(role, id);
        return plane;
      }
    },

    trim: {
      planeTrim(role, data) {
        const memberId = requiredString(data.memberId, `${role}: plane trim memberId`, ctx);
        const referencePlaneIds = requiredStringArray(data.referencePlaneIds, `${role}: plane trim referencePlaneIds`, ctx);
        if (!referencePlaneIds.length) ctx.fail(`${role}: plane trim missing referencePlaneIds`);
        const memberEnd = optionalMemberEnd(data.memberEnd, `${role}: plane trim memberEnd`, ctx);
        const id = ctx.id(role);
        const operationId = `${id}_plane_trim`;
        const removedRegionKeys = data.removedRegionKeys;
        requiredStringArray(removedRegionKeys, `${role}: plane trim removedRegionKeys`, ctx);
        if (!removedRegionKeys.length) ctx.fail(`${role}: plane trim removedRegionKeys cannot be empty`);
        return createTrimJoint(role, id, data, {
          type: "member-trim",
          participants: [{
            memberId,
            ...(memberEnd ? { memberEnd } : {}),
            enabled: data.operationEnabled !== false
          }],
          operations: [{
            id: operationId,
            type: "plane-trim",
            memberAId: memberId,
            ...(memberEnd ? { memberAEnd: memberEnd } : {}),
            referencePlaneIds,
            removedRegionKeys,
            gap: trimGap(data, ctx),
            enabled: data.operationEnabled !== false
          }]
        });
      },

      cornerTrim(role, data) {
        requiredStringArray(data.memberIds, `${role}: corner trim memberIds`, ctx);
        if (data.memberIds.length < 2) ctx.fail(`${role}: corner trim requires at least two memberIds`);
        const [memberAId, memberBId] = data.memberIds;
        const operationType = optionalString(data.operationType, undefined, `${role}: corner trim operationType`, ctx);
        if (!operationType) ctx.fail(`${role}: corner trim missing operationType`);
        if (!["end-butt-1", "end-butt-2", "end-butt-both", "end-miter", "profile-cope"].includes(operationType)) {
          ctx.fail(`${role}: unsupported corner trim operation ${operationType}`);
        }
        if (data.miterMode && operationType !== "end-miter") ctx.fail(`${role}: miterMode is only valid for end-miter`);
        if (data.miterMode && !["equal-angle", "profile-balanced"].includes(data.miterMode)) ctx.fail(`${role}: unsupported miterMode ${data.miterMode}`);
        if (data.allowExtension !== undefined && typeof data.allowExtension !== "boolean") ctx.fail(`${role}: allowExtension must be boolean`);
        const id = ctx.id(role);
        const operationId = optionalString(data.operationId, `${id}_${operationType.replace(/-/g, "_")}`, `${role}: corner trim operationId`, ctx);
        const memberAEnd = optionalMemberEnd(data.memberAEnd, `${role}: corner trim memberAEnd`, ctx);
        const memberBEnd = optionalMemberEnd(data.memberBEnd, `${role}: corner trim memberBEnd`, ctx);
        if (trimOperationUsesMemberEnd(operationType, "memberA") && !memberAEnd) ctx.fail(`${role}: corner trim memberAEnd is required for ${operationType}`);
        if (trimOperationUsesMemberEnd(operationType, "memberB") && !memberBEnd) ctx.fail(`${role}: corner trim memberBEnd is required for ${operationType}`);
        const profileCope = operationType === "profile-cope";
        if (!profileCope) rejectDefinedFields(data, ["memberAIds", "memberBIds", "removedRegionKeys", "allowExtension"], `${role}: corner trim`, ctx);
        else rejectDefinedFields(data, ["memberAEnd", "memberBEnd", "miterMode"], `${role}: object trim`, ctx);
        const memberAIds = profileCope
          ? (data.memberAIds === undefined ? [memberAId] : requiredNonEmptyStringArray(data.memberAIds, `${role}: object trim memberAIds`, ctx))
          : [memberAId];
        const memberBIds = profileCope
          ? (data.memberBIds === undefined ? [memberBId] : requiredNonEmptyStringArray(data.memberBIds, `${role}: object trim memberBIds`, ctx))
          : [memberBId];
        if (profileCope && memberAIds.some((id) => memberBIds.includes(id))) ctx.fail(`${role}: object trim memberAIds and memberBIds must not overlap`);
        const operationFields = profileCope ? {
          memberAId: memberAIds[0],
          memberBId: memberBIds[0],
          memberAIds,
          memberBIds,
          removedRegionKeys: optionalStringArray(data.removedRegionKeys, `${role}: object trim removedRegionKeys`, ctx),
          ...(data.allowExtension !== undefined ? { allowExtension: data.allowExtension } : {})
        } : {
          memberAId,
          memberBId,
          ...(memberAEnd ? { memberAEnd } : {}),
          ...(memberBEnd ? { memberBEnd } : {}),
          ...(data.miterMode ? { miterMode: data.miterMode } : {})
        };
        const participantEnd = (memberId) => (
          memberId === memberAId && memberAEnd ? memberAEnd
            : memberId === memberBId && memberBEnd ? memberBEnd
              : undefined
        );
        return createTrimJoint(role, id, data, {
          type: "corner-trim",
          participants: uniqueStrings([...data.memberIds, ...memberAIds, ...memberBIds]).map((memberId) => {
            const memberEnd = participantEnd(memberId);
            return {
              memberId,
              ...(memberEnd ? { memberEnd } : {}),
              enabled: data.operationEnabled !== false
            };
          }),
          operations: [{
            id: operationId,
            type: operationType,
            ...operationFields,
            gap: trimGap(data, ctx),
            enabled: data.operationEnabled !== false
          }]
        });
      }
    },

    part: {
      plate(role, data) {
        const id = ctx.id(role);
        const sketch = plateSketch(data, role, id, ctx);
        const plate = normalizePlate({
          id,
          type: optionalString(data.type, "plate", `${role}: plate type`, ctx),
          thickness: data.thickness,
          sketch,
          center: data.center,
          normal: data.normal,
          localAxisY: data.localAxisY,
          localAxisZ: data.localAxisZ,
          featureIds: optionalStringArray(data.featureIds, `${role}: plate featureIds`, ctx),
          assemblyId: data.assemblyId,
          ...placementMetadata(data)
        });
        ctx.add("plates", id, plate);
        ctx.role(role, id);
        return plate;
      }
    },

    pattern: {
      rectangularGrid(role, data) {
        const id = ctx.id(role);
        const hasExplicitPositions = data.positions !== undefined;
        if (hasExplicitPositions) rejectDefinedFields(data, ["rows", "columns", "pitch", "gauge"], `${role}: rectangular grid`, ctx);
        const positions = hasExplicitPositions ? data.positions : gridPositions(data, ctx);
        if (!Array.isArray(positions)) ctx.fail(`${role}: rectangular grid positions must be an array`);
        for (const [index, position] of positions.entries()) {
          if (!Array.isArray(position) || position.length !== 2 || position.some((value) => !Number.isFinite(value))) {
            ctx.fail(`${role}: rectangular grid positions[${index}] must be a finite [y, z] point`);
          }
        }
        const pattern = {
          id,
          type: "rectangular-grid",
          holeDiameter: data.holeDiameter,
          holeType: data.holeType,
          positions
        };
        if (data.layoutReference) pattern.layoutReference = data.layoutReference;
        ctx.add("holePatterns", id, pattern);
        ctx.role(role, id);
        return pattern;
      }
    },

    feature: {
      holePattern(role, data) {
        return createFeature(role, {
          type: "hole-pattern",
          ownerId: requiredString(data.ownerId, `${role}: hole pattern ownerId`, ctx),
          holePatternRef: requiredString(data.holePatternRef, `${role}: hole pattern ref`, ctx),
          depth: data.depth,
          reference: requiredObject(data.reference, `${role}: hole pattern reference`, ctx),
          ...placementMetadata(data)
        });
      },

      booleanPart(role, data) {
        const teklaClass = requiredString(data.teklaClass, `${role}: boolean part teklaClass`, ctx);
        if (teklaClass !== "BooleanPart") ctx.fail(`${role}: boolean part teklaClass must be BooleanPart`);
        const fields = {
          type: "boolean-part",
          teklaClass,
          booleanType: data.booleanType,
          cutKind: data.cutKind,
          ...featureOperationFields(data)
        };
        if (data.cut !== undefined) fields.cut = data.cut;
        if (data.body !== undefined) fields.body = data.body;
        return createFeature(role, fields);
      },

      clearanceCut(role, data) {
        return createFeature(role, {
          type: "clearance-cut",
          kind: requiredString(data.kind, `${role}: clearance cut kind`, ctx),
          cutKind: requiredString(data.cutKind, `${role}: clearance cut kind`, ctx),
          ...featureOperationFields(data),
          ownerId: requiredString(data.ownerId, `${role}: clearance cut ownerId`, ctx),
          source: requiredObject(data.source, `${role}: clearance cut source`, ctx),
          target: requiredObject(data.target, `${role}: clearance cut target`, ctx),
          offsets: requiredOffsets(data.offsets, `${role}: clearance cut offsets`, ctx)
        });
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
          participants: requiredNonEmptyStringArray(data.participants, `${role}: fastener participants`, ctx),
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

      patternedGroup(role, data) {
        if (data.feature !== undefined && (!data.feature || typeof data.feature !== "object" || Array.isArray(data.feature))) {
          ctx.fail(`${role}: fastener feature must be an object`);
        }
        requiredStringArray(data.participants, `${role}: fastener participants`, ctx);
        if (!data.participants.length) ctx.fail(`${role}: fastener participants must be a non-empty array`);
        const authoringPatch = data.authoring === undefined ? {} : data.authoring;
        if (!authoringPatch || typeof authoringPatch !== "object" || Array.isArray(authoringPatch)) {
          ctx.fail(`${role}: fastener authoring must be an object`);
        }
        const controlsPatch = authoringPatch.controls === undefined ? {} : authoringPatch.controls;
        if (!controlsPatch || typeof controlsPatch !== "object" || Array.isArray(controlsPatch)) {
          ctx.fail(`${role}: fastener authoring.controls must be an object`);
        }
        const pattern = data.holePatternRef !== undefined
          ? { id: data.holePatternRef }
          : builders.pattern.rectangularGrid(requiredString(data.patternRole, `${role}: fastener pattern role`, ctx), {
            holeDiameter: data.holeDiameter,
            holeType: data.holeType,
            positions: data.positions,
            rows: data.rows,
            columns: data.columns,
            pitch: data.pitch,
            gauge: data.gauge,
            layoutReference: data.layoutReference
          });
        if (typeof pattern.id !== "string" || !pattern.id) ctx.fail(`${role}: fastener holePatternRef must be a non-empty string`);
        if (data.feature && data.feature.holePatternRef === undefined) ctx.fail(`${role}: fastener feature holePatternRef is required`);
        if (data.feature && data.through === undefined) ctx.fail(`${role}: fastener through is required when feature is generated`);
        const featureRole = data.feature ? requiredString(data.feature.role, `${role}: fastener feature role`, ctx) : undefined;
        const feature = data.feature
          ? builders.feature.holePattern(featureRole, data.feature)
          : null;
        const authoring = {
          ...authoringPatch,
          controls: {
            ...controlsPatch,
            ...fastenerValueControls(data, ctx)
          }
        };
        const fasteners = builders.fastener.group(role, {
          fastenerRef: data.fastenerRef,
          holePatternRef: pattern.id,
          participants: data.participants,
          through: data.through,
          orientation: data.orientation,
          assembly: data.assembly,
          placementIntent: data.placementIntent,
          authoring,
          display: data.display,
          bim: data.bim
        });
        return {
          pattern,
          feature,
          fasteners,
          patternId: pattern.id,
          featureId: feature?.id,
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
          size: requiredPositiveNumber(data.size, `${role}: weld size`, ctx),
          participants: requiredNonEmptyStringArray(data.participants, `${role}: weld participants`, ctx),
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

    assembly: {
      create(role, data) {
        const id = ctx.id(role);
        const assembly = {
          id,
          type: optionalString(data.type, "assembly", `${role}: assembly type`, ctx),
          name: optionalString(data.name, role, `${role}: assembly name`, ctx),
          mark: data.mark,
          parentAssemblyId: data.parentAssemblyId,
          childAssemblyIds: optionalStringArray(data.childAssemblyIds, `${role}: assembly childAssemblyIds`, ctx),
          partIds: optionalStringArray(data.partIds, `${role}: assembly partIds`, ctx),
          memberIds: optionalStringArray(data.memberIds, `${role}: assembly memberIds`, ctx),
          plateIds: optionalStringArray(data.plateIds, `${role}: assembly plateIds`, ctx),
          connectionZoneIds: optionalStringArray(data.connectionZoneIds, `${role}: assembly connectionZoneIds`, ctx),
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
      create(role, data) {
        const id = ctx.id(role);
        const point = {
          id,
          type: optionalString(data.type, "work-point", `${role}: work point type`, ctx),
          role: optionalString(data.role, role, `${role}: work point role`, ctx),
          point: data.point,
          gridRefs: data.gridSystemId
            ? { ...(data.gridRefs || {}), gridSystemId: data.gridSystemId }
            : data.gridRefs,
          referencePlaneId: data.referencePlaneId,
          notes: data.notes
        };
        ctx.add("workPoints", id, point);
        ctx.role(role, id);
        return point;
      }
    },

    objectPattern: {
      create(role, data) {
        const id = ctx.id(role);
        const pattern = {
          id,
          type: optionalString(data.type, "linear-pattern", `${role}: object pattern type`, ctx),
          status: optionalString(data.status, "linked", `${role}: object pattern status`, ctx),
          generatedObjectIds: requiredStringArray(data.generatedObjectIds, `${role}: object pattern generatedObjectIds`, ctx),
          detachedObjectIds: optionalStringArray(data.detachedObjectIds, `${role}: object pattern detachedObjectIds`, ctx),
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

  return builders;
}
