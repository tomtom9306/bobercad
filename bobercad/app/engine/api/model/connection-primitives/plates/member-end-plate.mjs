import { enumValue, requiredFiniteNumber, requiredNonNegativeNumber, requiredPositiveInteger, requiredPositiveNumber, requiredString } from "../shared/validation.mjs";

export function build(ctx) {
  const mainInterface = ctx.interface("main");
  const secondaryInterface = ctx.interface("secondary");
  const mainMember = ctx.member("main");
  const secondaryMember = ctx.member("secondary");
  ctx.check.requireMemberEnd(secondaryInterface, "secondary interface missing memberEnd");

  const plate = ctx.params({
    thickness: "plate.thickness",
    width: "plate.width",
    height: "plate.height",
    offset: "plate.offset"
  });
  plate.thickness = requiredPositiveNumber(ctx, plate.thickness, "plate.thickness");
  plate.width = requiredPositiveNumber(ctx, plate.width, "plate.width");
  plate.height = requiredPositiveNumber(ctx, plate.height, "plate.height");
  plate.offset = requiredFiniteNumber(ctx, plate.offset, "plate.offset");
  const v = ctx.geometry.v;
  const beamDirection = ctx.geometry.secondaryBeamDirection(secondaryMember, secondaryInterface);
  let plateNormal = v.norm(mainInterface.normal);
  if (v.dot(plateNormal, beamDirection) < -0.5) plateNormal = v.mul(plateNormal, -1);
  const supportOrigin = mainInterface.origin;
  const center = v.add(supportOrigin, v.mul(plateNormal, plate.thickness / 2 + plate.offset));
  const beamFaceOrigin = v.add(supportOrigin, v.mul(plateNormal, plate.thickness + plate.offset));
  const axes = ctx.geometry.endPlateAxes({ ...mainInterface, normal: plateNormal });

  ctx.check.vectorsAligned(plateNormal, beamDirection, {
    minDot: 0.5,
    code: "moment-end-plate-secondary-end-not-facing-support",
    message: "The secondary member end is not facing the selected support interface.",
    objectRoles: ["endPlate", "beamTrim", "weld"],
    parameterPaths: ["plate.thickness", "plate.offset"]
  });

  const endPlate = ctx.part.plate("endPlate", {
    type: "rectangular-plate",
    thickness: plate.thickness,
    outline: ctx.geometry.rectangleOutline(plate.width, plate.height),
    center,
    normal: plateNormal,
    localAxisY: axes.localAxisY,
    localAxisZ: axes.localAxisZ,
    assemblyId: ctx.assemblyId,
    placementIntent: {
      role: "end-plate",
      host: { objectId: secondaryMember.id, end: secondaryInterface.memberEnd },
      references: [{ objectId: mainMember.id, interfaceId: mainInterface.id }],
      fit: "support-face-to-fitted-secondary-end"
    },
    display: { color: "#355a70" },
    fabrication: { partMark: "EP1" }
  });

  const beamTrimPlane = ctx.reference.plane("beamTrimPlane", {
    origin: beamFaceOrigin,
    normal: plateNormal,
    axisX: axes.localAxisY,
    axisY: axes.localAxisZ,
    fabrication: { operation: "end-plate-outer-face-plane" }
  });
  ctx.trim.planeTrim("beamTrim", {
    memberId: secondaryMember.id,
    memberEnd: secondaryInterface.memberEnd,
    referencePlaneIds: [beamTrimPlane.id],
    removedRegionKeys: [`${beamTrimPlane.id}:-`],
    gap: 0,
    display: { visible: false },
    fabrication: { operation: "trim-to-end-plate" },
    placementIntent: {
      role: "fit-secondary-member-to-end-plate",
      host: { objectId: secondaryMember.id, end: secondaryInterface.memberEnd },
      references: [{ objectId: endPlate.id }],
      fit: "secondary-end-to-end-plate-outer-face"
    }
  });

  const bolts = ctx.params({
    rows: "bolts.rows",
    columns: "bolts.columns",
    pitch: "bolts.pitch",
    gauge: "bolts.gauge",
    fastenerRef: "bolts.fastenerRef",
    holeDiameter: "holes.diameter",
    holeType: "holes.type",
    memberDepth: "holes.memberDepth"
  });
  bolts.rows = requiredPositiveInteger(ctx, bolts.rows, "bolts.rows");
  bolts.columns = requiredPositiveInteger(ctx, bolts.columns, "bolts.columns");
  bolts.pitch = requiredNonNegativeNumber(ctx, bolts.pitch, "bolts.pitch");
  bolts.gauge = requiredNonNegativeNumber(ctx, bolts.gauge, "bolts.gauge");
  bolts.fastenerRef = requiredString(ctx, bolts.fastenerRef, "bolts.fastenerRef");
  bolts.holeDiameter = requiredPositiveNumber(ctx, bolts.holeDiameter, "holes.diameter");
  bolts.holeType = enumValue(ctx, bolts.holeType, ["round", "slotted", "countersunk"], "holes.type");
  bolts.memberDepth = requiredPositiveNumber(ctx, bolts.memberDepth, "holes.memberDepth");
  const boltGrid = ctx.pattern.rectangularGrid("holePattern", {
    rows: bolts.rows,
    columns: bolts.columns,
    pitch: bolts.rows === 1 ? 0 : bolts.pitch,
    gauge: bolts.columns === 1 ? 0 : bolts.gauge,
    holeDiameter: bolts.holeDiameter,
    holeType: bolts.holeType
  });

  ctx.check.gridFitsRectangularPlate(boltGrid, plate.width, plate.height, {
    code: "moment-end-plate-hole-grid-outside-plate",
    message: "Bolt holes do not fit inside the end plate.",
    objectRoles: ["endPlate", "holePattern", "plateHoles", "fasteners"],
    parameterPaths: ["bolts.pitch", "bolts.gauge", "holes.diameter", "plate.width", "plate.height"]
  });
  ctx.check.gridFitsCenteredInterface(boltGrid, mainInterface, {
    code: "moment-end-plate-hole-grid-outside-main-interface",
    message: "Bolt holes do not fit inside the main member connection face.",
    objectRoles: ["holePattern", "memberHoles", "fasteners"],
    parameterPaths: ["bolts.pitch", "bolts.gauge", "holes.diameter"]
  });

  const plateHoles = ctx.feature.holePattern("plateHoles", {
    ownerId: endPlate.id,
    holePatternRef: boltGrid.id,
    reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: endPlate.localAxisY, localAxisZ: endPlate.localAxisZ },
    fabrication: { operation: "drill" }
  });
  const memberHoles = ctx.feature.holePattern("memberHoles", {
    ownerId: mainMember.id,
    holePatternRef: boltGrid.id,
    depth: bolts.memberDepth,
    reference: {
      kind: "member-face",
      origin: supportOrigin,
      normal: plateNormal,
      localAxisY: axes.localAxisY,
      localAxisZ: axes.localAxisZ
    },
    fabrication: { operation: "drill" }
  });

  ctx.fastener.group("fasteners", {
    fastenerRef: bolts.fastenerRef,
    holePatternRef: boltGrid.id,
    participants: [endPlate.id, mainMember.id],
    through: { fromFeatureId: plateHoles.id, toFeatureId: memberHoles.id },
    orientation: { axis: v.mul(plateNormal, -1), headSide: "secondary-member-side" }
  });
  ctx.weld.fillet("weld", {
    size: requiredPositiveNumber(ctx, ctx.param("welds.beamWeb"), "welds.beamWeb"),
    participants: [secondaryMember.id, endPlate.id],
    reference: { kind: "member-end-profile", memberId: secondaryMember.id, end: secondaryInterface.memberEnd, referencePlaneId: beamTrimPlane.id }
  });
  return {};
}
