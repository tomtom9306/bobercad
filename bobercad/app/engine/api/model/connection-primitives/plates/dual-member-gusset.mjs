import { libraryProfileById } from "../../../project/profiles.mjs";
import { enumValue, requiredFiniteNumber, requiredNonNegativeNumber, requiredPositiveInteger, requiredPositiveNumber, requiredString } from "../shared/validation.mjs";

function memberDirectionFromJoint(ctx, member, iface) {
  const frame = ctx.geometry.memberFrame(member);
  if (iface.memberEnd === "start") return frame.x;
  if (iface.memberEnd === "end") return ctx.geometry.v.mul(frame.x, -1);
  ctx.fail(`${iface.id || "interface"} memberEnd must be start or end`);
}

function equalAngleNormal(v, ownDirection, mateDirection) {
  let normal = v.norm(v.sub(mateDirection, ownDirection));
  if (v.len(normal) <= 1e-9) return ownDirection;
  if (v.dot(normal, ownDirection) < 0) normal = v.mul(normal, -1);
  return Math.abs(v.dot(normal, ownDirection)) <= 1e-9 ? ownDirection : normal;
}

function squareExtents(size) {
  return {
    xMin: -size / 2,
    xMax: size / 2,
    yMin: -size / 2,
    yMax: size / 2
  };
}

function trimPlaneAtJoint(ctx, member, ownDirection, mateDirection, joint) {
  const v = ctx.geometry.v;
  const frame = ctx.geometry.memberFrame(member);
  const normal = equalAngleNormal(v, ownDirection, mateDirection);
  const axisX = ctx.geometry.projectedAxis(frame.y, normal)
    || ctx.geometry.projectedAxis(frame.z, normal);
  if (!axisX) ctx.fail(`${member.id}: cannot resolve gusset trim plane axis`);
  const axisY = v.norm(v.cross(normal, axisX));
  const bounds = ctx.geometry.sectionBounds(libraryProfileById(ctx.profiles, member.profile));
  const span = Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1) * 1.35;
  return { origin: joint, normal, axisX, axisY, extents: squareExtents(span) };
}

function boltPositions(rows, pitch, lineOffset) {
  const positions = [];
  for (let row = 0; row < rows; row += 1) {
    positions.push([lineOffset, (row - (rows - 1) / 2) * pitch]);
  }
  return positions;
}

function webSidePlateOffset(ctx, plateThickness) {
  const webBounds = ctx.geometry.sectionWebBounds(ctx.profile("main"));
  if (!Number.isFinite(webBounds.minY) || !Number.isFinite(webBounds.maxY)) ctx.fail("dual-member-gusset: main member web bounds must be finite");
  const webHalfThickness = Math.max(Math.abs(webBounds.minY), Math.abs(webBounds.maxY));
  return webHalfThickness + plateThickness / 2;
}

function apexGussetOutline(ctx, plate, center, plateNormal, localAxisY, localAxisZ, mainDirection, secondaryDirection) {
  const v = ctx.geometry.v;
  let outline = ctx.geometry.rectangleOutline(plate.width, plate.height);
  const apexPoint = v.add(center, v.mul(localAxisZ, plate.height / 2));
  const keepPoint = v.add(center, v.mul(localAxisZ, -plate.height / 2));
  const trimToMemberSlope = (direction) => {
    const projectedDirection = ctx.geometry.projectedAxis(direction, plateNormal);
    if (!projectedDirection) ctx.fail("dual-member-gusset: member direction is parallel to gusset plate normal");
    const planeNormal = v.norm(v.cross(plateNormal, projectedDirection));
    outline = ctx.geometry.clipPlateOutlineByPlane({
      outline,
      plateCenter: center,
      localAxisY,
      localAxisZ,
      planeOrigin: apexPoint,
      planeNormal,
      keepPoint
    });
  };
  trimToMemberSlope(mainDirection);
  trimToMemberSlope(secondaryDirection);
  return outline;
}

export function build(ctx) {
  const mainInterface = ctx.interface("main");
  const secondaryInterface = ctx.interface("secondary");
  const mainMember = ctx.member("main");
  const secondaryMember = ctx.member("secondary");
  ctx.check.requireMemberEnd(mainInterface, "gusset main interface missing memberEnd");
  ctx.check.requireMemberEnd(secondaryInterface, "gusset secondary interface missing memberEnd");

  const plate = ctx.params({
    thickness: "plate.thickness",
    width: "plate.width",
    height: "plate.height"
  });
  plate.thickness = requiredPositiveNumber(ctx, plate.thickness, "plate.thickness");
  plate.width = requiredPositiveNumber(ctx, plate.width, "plate.width");
  plate.height = requiredPositiveNumber(ctx, plate.height, "plate.height");
  plate.verticalOffset = requiredFiniteNumber(ctx, ctx.parameterValue("plate.verticalOffset"), "plate.verticalOffset");
  const bolts = ctx.params({
    fastenerRef: "bolts.fastenerRef",
    rows: "bolts.rows",
    pitch: "bolts.pitch",
    groupSpacing: "bolts.groupSpacing",
    length: "bolts.length",
    holeDiameter: "holes.diameter",
    holeType: "holes.type",
    memberDepth: "holes.memberDepth"
  });
  bolts.fastenerRef = requiredString(ctx, bolts.fastenerRef, "bolts.fastenerRef");
  bolts.rows = requiredPositiveInteger(ctx, bolts.rows, "bolts.rows");
  bolts.pitch = requiredNonNegativeNumber(ctx, bolts.pitch, "bolts.pitch");
  bolts.groupSpacing = requiredNonNegativeNumber(ctx, bolts.groupSpacing, "bolts.groupSpacing");
  bolts.length = requiredPositiveNumber(ctx, bolts.length, "bolts.length");
  bolts.holeDiameter = requiredPositiveNumber(ctx, bolts.holeDiameter, "holes.diameter");
  bolts.holeType = enumValue(ctx, bolts.holeType, ["round", "slotted", "countersunk"], "holes.type");
  bolts.memberDepth = requiredPositiveNumber(ctx, bolts.memberDepth, "holes.memberDepth");
  const v = ctx.geometry.v;
  const mainDirection = memberDirectionFromJoint(ctx, mainMember, mainInterface);
  const secondaryDirection = memberDirectionFromJoint(ctx, secondaryMember, secondaryInterface);
  let plateNormal = v.cross(mainDirection, secondaryDirection);
  if (v.len(plateNormal) <= 1e-9) ctx.fail("dual-member-gusset: member directions must not be parallel");
  plateNormal = v.norm(plateNormal);
  if (v.dot(plateNormal, [0, 1, 0]) < 0) plateNormal = v.mul(plateNormal, -1);

  let localAxisZ = ctx.geometry.projectedAxis([0, 0, 1], plateNormal) || ctx.geometry.projectedAxis(mainInterface.localAxisZ, plateNormal);
  if (!localAxisZ) ctx.fail("dual-member-gusset: cannot resolve localAxisZ");
  if (v.dot(localAxisZ, [0, 0, 1]) < 0) localAxisZ = v.mul(localAxisZ, -1);
  let localAxisY = v.norm(v.cross(localAxisZ, plateNormal));
  if (v.dot(localAxisY, secondaryDirection) < 0) localAxisY = v.mul(localAxisY, -1);

  const joint = v.mul(v.add(mainInterface.origin, secondaryInterface.origin), 0.5);
  const webSideOffset = webSidePlateOffset(ctx, plate.thickness);
  const center = v.add(v.add(joint, v.mul(localAxisZ, plate.verticalOffset)), v.mul(plateNormal, -webSideOffset));
  const webFaceOrigin = v.add(center, v.mul(plateNormal, plate.thickness / 2));
  const gussetPlate = ctx.part.plate("gussetPlate", {
    type: "rectangular-plate",
    thickness: plate.thickness,
    outline: apexGussetOutline(ctx, plate, center, plateNormal, localAxisY, localAxisZ, mainDirection, secondaryDirection),
    center,
    normal: plateNormal,
    localAxisY,
    localAxisZ,
    assemblyId: ctx.assemblyId,
    placementIntent: {
      role: "dual-member-gusset",
      host: { objectId: mainMember.id, end: mainInterface.memberEnd },
      references: [{ objectId: secondaryMember.id, end: secondaryInterface.memberEnd }],
      fit: "side-gusset-between-member-webs"
    },
    display: { color: "#506c80" },
    fabrication: { partMark: "GP1" }
  });

  const trimDisplay = { visible: true, suppressed: true, color: "#ff3366", transparent: true, opacity: 0.18 };
  const mainTrimPlane = ctx.reference.plane("mainTrimPlane", trimPlaneAtJoint(ctx, mainMember, mainDirection, secondaryDirection, joint));
  ctx.trim.planeTrim("mainTrim", {
    memberId: mainMember.id,
    memberEnd: mainInterface.memberEnd,
    referencePlaneIds: [mainTrimPlane.id],
    removedRegionKeys: [`${mainTrimPlane.id}:-`],
    gap: 0,
    display: trimDisplay,
    fabrication: { operation: "trim-main-member-to-apex-gusset" },
    placementIntent: {
      role: "trim-main-member-to-apex-gusset",
      host: { objectId: mainMember.id, end: mainInterface.memberEnd },
      references: [{ objectId: gussetPlate.id }, { objectId: secondaryMember.id, end: secondaryInterface.memberEnd }],
      fit: "equal-angle-trim"
    }
  });
  const secondaryTrimPlane = ctx.reference.plane("secondaryTrimPlane", trimPlaneAtJoint(ctx, secondaryMember, secondaryDirection, mainDirection, joint));
  ctx.trim.planeTrim("secondaryTrim", {
    memberId: secondaryMember.id,
    memberEnd: secondaryInterface.memberEnd,
    referencePlaneIds: [secondaryTrimPlane.id],
    removedRegionKeys: [`${secondaryTrimPlane.id}:-`],
    gap: 0,
    display: trimDisplay,
    fabrication: { operation: "trim-secondary-member-to-apex-gusset" },
    placementIntent: {
      role: "trim-secondary-member-to-apex-gusset",
      host: { objectId: secondaryMember.id, end: secondaryInterface.memberEnd },
      references: [{ objectId: gussetPlate.id }, { objectId: mainMember.id, end: mainInterface.memberEnd }],
      fit: "equal-angle-trim"
    }
  });

  const mainPattern = ctx.pattern.rectangularGrid("mainHolePattern", {
    positions: boltPositions(bolts.rows, bolts.pitch, -bolts.groupSpacing / 2),
    holeDiameter: bolts.holeDiameter,
    holeType: bolts.holeType
  });
  const secondaryPattern = ctx.pattern.rectangularGrid("secondaryHolePattern", {
    positions: boltPositions(bolts.rows, bolts.pitch, bolts.groupSpacing / 2),
    holeDiameter: bolts.holeDiameter,
    holeType: bolts.holeType
  });
  ctx.check.plateOutlineValid(ctx.geometry.plateOutline(gussetPlate), {
    code: "apex-gusset-outline-invalid-after-trimming",
    message: "Apex gusset trimming left no valid plate outline.",
    objectRoles: ["gussetPlate"],
    parameterPaths: ["plate.width", "plate.height"]
  });
  for (const [pattern, rolePrefix] of [[mainPattern, "main"], [secondaryPattern, "secondary"]]) {
    ctx.check.gridFitsPlate(pattern, gussetPlate, {
      code: `${rolePrefix}-gusset-hole-grid-outside-plate`,
      message: "Gusset bolt holes do not fit inside the plate.",
      objectRoles: ["gussetPlate", `${rolePrefix}HolePattern`, `${rolePrefix}PlateHoles`, `${rolePrefix}Fasteners`],
      parameterPaths: ["bolts.pitch", "bolts.groupSpacing", "holes.diameter", "plate.width", "plate.height"]
    });
  }

  const mainPlateHoles = ctx.feature.holePattern("mainPlateHoles", {
    ownerId: gussetPlate.id,
    holePatternRef: mainPattern.id,
    reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: gussetPlate.localAxisY, localAxisZ: gussetPlate.localAxisZ },
    fabrication: { operation: "drill" }
  });
  const secondaryPlateHoles = ctx.feature.holePattern("secondaryPlateHoles", {
    ownerId: gussetPlate.id,
    holePatternRef: secondaryPattern.id,
    reference: { kind: "plate-face", face: "back", origin: "plate-center", localAxisY: gussetPlate.localAxisY, localAxisZ: gussetPlate.localAxisZ },
    fabrication: { operation: "drill" }
  });
  const mainMemberHoles = ctx.feature.holePattern("mainMemberHoles", {
    ownerId: mainMember.id,
    holePatternRef: mainPattern.id,
    depth: bolts.memberDepth,
    reference: {
      kind: "member-face",
      origin: webFaceOrigin,
      normal: gussetPlate.normal,
      localAxisY: gussetPlate.localAxisY,
      localAxisZ: gussetPlate.localAxisZ,
      referencePlaneId: mainTrimPlane.id
    },
    fabrication: { operation: "drill" }
  });
  const secondaryMemberHoles = ctx.feature.holePattern("secondaryMemberHoles", {
    ownerId: secondaryMember.id,
    holePatternRef: secondaryPattern.id,
    depth: bolts.memberDepth,
    reference: {
      kind: "member-face",
      origin: webFaceOrigin,
      normal: gussetPlate.normal,
      localAxisY: gussetPlate.localAxisY,
      localAxisZ: gussetPlate.localAxisZ,
      referencePlaneId: secondaryTrimPlane.id
    },
    fabrication: { operation: "drill" }
  });

  ctx.fastener.group("mainFasteners", {
    fastenerRef: bolts.fastenerRef,
    holePatternRef: mainPattern.id,
    participants: [gussetPlate.id, mainMember.id],
    through: { fromFeatureId: mainPlateHoles.id, toFeatureId: mainMemberHoles.id },
    orientation: { axis: v.mul(plateNormal, -1) },
    assembly: { length: bolts.length, gripLength: plate.thickness + bolts.memberDepth }
  });
  ctx.fastener.group("secondaryFasteners", {
    fastenerRef: bolts.fastenerRef,
    holePatternRef: secondaryPattern.id,
    participants: [gussetPlate.id, secondaryMember.id],
    through: { fromFeatureId: secondaryPlateHoles.id, toFeatureId: secondaryMemberHoles.id },
    orientation: { axis: v.mul(plateNormal, -1) },
    assembly: { length: bolts.length, gripLength: plate.thickness + bolts.memberDepth }
  });
  return {};
}
