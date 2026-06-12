import { libraryProfileById } from "../../../project/profiles.mjs?v=profile-lookup-dry-1";

function memberDirectionFromJoint(ctx, member, iface) {
  const frame = ctx.geometry.memberFrame(member);
  return iface.memberEnd === "end" ? ctx.geometry.v.mul(frame.x, -1) : frame.x;
}

function equalAngleNormal(ctx, ownDirection, mateDirection) {
  const v = ctx.geometry.v;
  let normal = v.norm(v.sub(mateDirection, ownDirection));
  if (v.len(normal) <= 1e-9) return ownDirection;
  if (v.dot(normal, ownDirection) < 0) normal = v.mul(normal, -1);
  return Math.abs(v.dot(normal, ownDirection)) <= 1e-9 ? ownDirection : normal;
}

function trimPlaneAtJoint(ctx, member, ownDirection, mateDirection, joint) {
  const v = ctx.geometry.v;
  const frame = ctx.geometry.memberFrame(member);
  const normal = equalAngleNormal(ctx, ownDirection, mateDirection);
  const axisX = ctx.geometry.projectedAxis(frame.y, normal)
    || ctx.geometry.projectedAxis(frame.z, normal)
    || ctx.geometry.projectedAxis([0, 0, 1], normal)
    || ctx.geometry.projectedAxis([0, 1, 0], normal);
  if (!axisX) ctx.fail(`${member.id}: cannot resolve gusset trim plane axis`);
  const axisY = v.norm(v.cross(normal, axisX));
  const bounds = ctx.geometry.sectionBounds(libraryProfileById(ctx.profiles, member.profile));
  const span = Math.max(bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ, 1) * 1.35;
  return { origin: joint, normal, axisX, axisY, size: [span, span] };
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
  const webHalfThickness = Math.max(Math.abs(webBounds.minY || 0), Math.abs(webBounds.maxY || 0));
  return webHalfThickness + plateThickness / 2;
}

function apexGussetOutline(ctx, plate, center, plateNormal, localAxisY, localAxisZ, mainDirection, secondaryDirection) {
  const v = ctx.geometry.v;
  let outline = ctx.geometry.rectangleOutline(plate.width, plate.height);
  const apexPoint = v.add(center, v.mul(localAxisZ, plate.height / 2));
  const keepPoint = v.add(center, v.mul(localAxisZ, -plate.height / 2));
  const trimToMemberSlope = (direction) => {
    const projectedDirection = ctx.geometry.projectedAxis(direction, plateNormal);
    if (!projectedDirection) return;
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
  plate.verticalOffset = ctx.optionalParam("plate.verticalOffset", 0);
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
  const v = ctx.geometry.v;
  const mainDirection = memberDirectionFromJoint(ctx, mainMember, mainInterface);
  const secondaryDirection = memberDirectionFromJoint(ctx, secondaryMember, secondaryInterface);
  let plateNormal = v.cross(mainDirection, secondaryDirection);
  if (v.len(plateNormal) <= 1e-9) plateNormal = mainInterface.localAxisY || [0, 1, 0];
  plateNormal = v.norm(plateNormal);
  if (v.dot(plateNormal, [0, 1, 0]) < 0) plateNormal = v.mul(plateNormal, -1);

  let localAxisZ = ctx.geometry.projectedAxis([0, 0, 1], plateNormal) || ctx.geometry.projectedAxis(mainInterface.localAxisZ, plateNormal);
  if (!localAxisZ) localAxisZ = [0, 0, 1];
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
    width: plate.width,
    height: plate.height,
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
    parameters: ["plate.width", "plate.height"]
  });
  for (const [pattern, rolePrefix] of [[mainPattern, "main"], [secondaryPattern, "secondary"]]) {
    ctx.check.gridFitsPlate(pattern, gussetPlate, {
      code: `${rolePrefix}-gusset-hole-grid-outside-plate`,
      message: "Gusset bolt holes do not fit inside the plate.",
      objectRoles: ["gussetPlate", `${rolePrefix}HolePattern`, `${rolePrefix}PlateHoles`, `${rolePrefix}Fasteners`],
      parameters: ["bolts.pitch", "bolts.groupSpacing", "holes.diameter", "plate.width", "plate.height"]
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
}
