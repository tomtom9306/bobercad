import { enumValue, requiredBoolean, requiredFiniteNumber, requiredNonNegativeNumber, requiredPositiveInteger, requiredPositiveNumber, requiredString } from "../shared/validation.mjs";

function requiredProjectedAxis(ctx, axis, normal, label) {
  const projected = ctx.geometry.projectedAxis(axis, normal);
  if (!projected) ctx.fail(`${label}: axis is parallel to plate normal`);
  return projected;
}

export function build(ctx) {
  const supportInterface = ctx.interface("main");
  const columnInterface = ctx.interface("secondary");
  const supportMember = ctx.member("main");
  const column = ctx.member("secondary");
  ctx.check.requireMemberEnd(columnInterface, "base plate secondary interface missing memberEnd");

  const plate = ctx.params({
    thickness: "plate.thickness",
    width: "plate.width",
    depth: "plate.depth"
  });
  plate.thickness = requiredPositiveNumber(ctx, plate.thickness, "plate.thickness");
  plate.width = requiredPositiveNumber(ctx, plate.width, "plate.width");
  plate.depth = requiredPositiveNumber(ctx, plate.depth, "plate.depth");
  plate.offset = requiredFiniteNumber(ctx, ctx.parameterValue("plate.offset"), "plate.offset");

  const anchors = ctx.params({
    fastenerRef: "anchors.fastenerRef",
    rows: "anchors.rows",
    columns: "anchors.columns",
    pitch: "anchors.pitch",
    gauge: "anchors.gauge",
    length: "anchors.length",
    holeDiameter: "holes.diameter",
    holeType: "holes.type",
    supportDepth: "holes.supportDepth"
  });
  anchors.fastenerRef = requiredString(ctx, anchors.fastenerRef, "anchors.fastenerRef");
  anchors.rows = requiredPositiveInteger(ctx, anchors.rows, "anchors.rows");
  anchors.columns = requiredPositiveInteger(ctx, anchors.columns, "anchors.columns");
  anchors.pitch = requiredNonNegativeNumber(ctx, anchors.pitch, "anchors.pitch");
  anchors.gauge = requiredNonNegativeNumber(ctx, anchors.gauge, "anchors.gauge");
  anchors.length = requiredPositiveNumber(ctx, anchors.length, "anchors.length");
  anchors.holeDiameter = requiredPositiveNumber(ctx, anchors.holeDiameter, "holes.diameter");
  anchors.holeType = enumValue(ctx, anchors.holeType, ["round", "slotted", "countersunk"], "holes.type");
  anchors.supportDepth = requiredPositiveNumber(ctx, anchors.supportDepth, "holes.supportDepth");
  const v = ctx.geometry.v;
  const columnStation = columnInterface.memberEnd === "end" ? ctx.geometry.memberLength(column) : 0;
  const columnFrame = ctx.geometry.memberFrameAt(column, columnStation);
  const columnDirection = ctx.geometry.secondaryBeamDirection(column, columnInterface);
  let normal = v.norm(supportInterface.normal);
  if (v.dot(normal, columnDirection) < 0) normal = v.mul(normal, -1);

  let localAxisY = requiredProjectedAxis(ctx, columnFrame.y, normal, "base plate localAxisY");
  if (v.dot(localAxisY, columnFrame.y) < 0) localAxisY = v.mul(localAxisY, -1);
  const localAxisZ = v.norm(v.cross(normal, localAxisY));
  const center = v.add(supportInterface.origin, v.mul(normal, plate.thickness / 2 + plate.offset));

  const basePlate = ctx.part.plate("basePlate", {
    type: "rectangular-plate",
    thickness: plate.thickness,
    outline: ctx.geometry.rectangleOutline(plate.width, plate.depth),
    center,
    normal,
    localAxisY,
    localAxisZ,
    assemblyId: ctx.assemblyId,
    placementIntent: {
      role: "base-plate",
      host: { objectId: column.id, end: columnInterface.memberEnd },
      references: [{ objectId: supportMember.id, interfaceId: supportInterface.id }],
      fit: "column-end-to-support-plane"
    },
    display: { color: "#425466" },
    fabrication: { partMark: "BP1" }
  });

  const anchorPattern = ctx.pattern.rectangularGrid("anchorPattern", {
    rows: anchors.rows,
    columns: anchors.columns,
    pitch: anchors.rows === 1 ? 0 : anchors.pitch,
    gauge: anchors.columns === 1 ? 0 : anchors.gauge,
    holeDiameter: anchors.holeDiameter,
    holeType: anchors.holeType
  });
  ctx.check.gridFitsRectangularPlate(anchorPattern, plate.width, plate.depth, {
    code: "base-plate-anchor-grid-outside-plate",
    message: "Anchor holes do not fit inside the base plate.",
    objectRoles: ["basePlate", "anchorPattern", "plateHoles", "anchors"],
    parameterPaths: ["anchors.pitch", "anchors.gauge", "holes.diameter", "plate.width", "plate.depth"]
  });

  const plateHoles = ctx.feature.holePattern("plateHoles", {
    ownerId: basePlate.id,
    holePatternRef: anchorPattern.id,
    reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: basePlate.localAxisY, localAxisZ: basePlate.localAxisZ },
    fabrication: { operation: "drill" }
  });
  const supportHoles = ctx.feature.holePattern("supportHoles", {
    ownerId: supportMember.id,
    holePatternRef: anchorPattern.id,
    depth: anchors.supportDepth,
    reference: { kind: "member-face", interfaceRef: supportInterface.id },
    fabrication: { operation: "anchor-drill" },
    display: { visible: false }
  });

  ctx.fastener.group("anchors", {
    fastenerRef: anchors.fastenerRef,
    holePatternRef: anchorPattern.id,
    participants: [basePlate.id, supportMember.id],
    through: { fromFeatureId: plateHoles.id, toFeatureId: supportHoles.id },
    orientation: { axis: normal, headSide: "top" },
    assembly: {
      length: anchors.length,
      gripLength: plate.thickness + anchors.supportDepth,
      washers: {
        head: requiredBoolean(ctx, ctx.parameterValue("washers.head"), "washers.head"),
        nut: requiredBoolean(ctx, ctx.parameterValue("washers.nut"), "washers.nut")
      }
    }
  });

  const weldSize = ctx.param("welds.column");
  requiredNonNegativeNumber(ctx, weldSize, "welds.column");
  if (weldSize > 0) {
    ctx.weld.fillet("weld", {
      size: weldSize,
      participants: [column.id, basePlate.id],
      reference: { kind: "member-end-profile", memberId: column.id, end: columnInterface.memberEnd }
    });
  }
  return {};
}
