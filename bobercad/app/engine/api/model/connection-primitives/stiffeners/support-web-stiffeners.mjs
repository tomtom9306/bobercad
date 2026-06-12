import { secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs?v=member-end-point-dry-1";

function requiredInput(ctx, input, key) {
  const value = input[key];
  if (!value) ctx.fail(`support-web-stiffeners missing ${key}`);
  return value;
}

function createStiffener(ctx, input, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, supportStiffenerStationOffset, interfaceSide, role, stationSide, webSide, partMark) {
  const supportMember = requiredInput(ctx, input, "supportMember");
  const supportInterface = requiredInput(ctx, input, "supportInterface");
  const referencePlate = requiredInput(ctx, input, "referencePlate");
  const plateThickness = input.plateThickness || ctx.optionalParam("stiffeners.thickness", referencePlate.thickness);
  const supportWebY = webSide < 0 ? supportWebBounds.minY : supportWebBounds.maxY;
  const supportOuterY = webSide < 0 ? supportBounds.minY : supportBounds.maxY;
  const supportStiffenerWidth = Math.abs(supportOuterY - supportWebY);
  const supportStiffenerCenterY = (supportWebY + supportOuterY) / 2;
  const supportStiffenerBase = ctx.geometry.v.add(
    supportAt.origin,
    ctx.geometry.v.add(
      ctx.geometry.v.mul(supportAt.y, supportStiffenerCenterY),
      ctx.geometry.v.mul(supportAt.z, supportStiffenerCenterZ)
    )
  );
  const stationLabel = stationSide < 0 ? "left" : "right";
  const sideLabel = webSide === interfaceSide ? "near" : "far";
  return ctx.part.plate(role, {
    type: "rectangular-plate",
    thickness: plateThickness,
    width: supportStiffenerWidth,
    height: supportStiffenerHeight,
    center: ctx.geometry.v.add(supportStiffenerBase, ctx.geometry.v.mul(supportAt.x, stationSide * supportStiffenerStationOffset)),
    normal: supportAt.x,
    localAxisY: ctx.geometry.v.mul(supportAt.y, webSide),
    localAxisZ: supportAt.z,
    assemblyId: ctx.assemblyId,
    placementIntent: {
      role: `${stationLabel}-${sideLabel}-support-stiffener`,
      host: { objectId: supportMember.id, interfaceId: supportInterface.id },
      references: [{ objectId: referencePlate.id }],
      fit: `stiffen-support-web-${stationLabel}-${sideLabel}-of-secondary`
    },
    display: { color: "#5f7f94" },
    fabrication: { partMark }
  });
}

function weldStiffener(ctx, input, role, stiffener, size) {
  const supportMember = requiredInput(ctx, input, "supportMember");
  const supportInterface = requiredInput(ctx, input, "supportInterface");
  const beamInterface = requiredInput(ctx, input, "beamInterface");
  ctx.weld.fillet(role, {
    size,
    participants: [supportMember.id, stiffener.id],
    reference: {
      kind: "plate-support-edge",
      plateId: stiffener.id,
      supportInterfaceId: supportInterface.id,
      stationReferenceInterfaceRef: beamInterface.id,
      runs: [{ edge: "support", size }]
    }
  });
}

export function build(ctx, input = {}) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipeContext = input.recipeContext || {};
  const supportMember = input.supportMember || context.supportMember;
  const supportProfile = input.supportProfile || context.supportProfile;
  const supportInterface = input.supportInterface || context.supportInterface;
  const supportedBeamProfile = input.supportedBeamProfile || context.supportedBeamProfile;
  const referencePlate = input.referencePlate || recipeContext.finPlate;
  if (!supportMember || !supportProfile || !supportInterface || !supportedBeamProfile || !referencePlate) {
    ctx.fail("support-web-stiffeners: secondary-web-plate must run before support-web-stiffeners");
  }
  const resolvedInput = { ...context, ...input, referencePlate };
  const supportStation = ctx.geometry.memberStationAtPoint(supportMember, supportInterface.origin);
  const supportAt = ctx.geometry.memberFrameAt(supportMember, supportStation);
  const supportBounds = ctx.geometry.sectionBounds(supportProfile);
  const supportWebBounds = ctx.geometry.sectionWebBounds(supportProfile);
  const supportStiffenerHeight = supportWebBounds.maxZ - supportWebBounds.minZ;
  const supportStiffenerCenterZ = (supportWebBounds.minZ + supportWebBounds.maxZ) / 2;
  const supportedBeamBounds = ctx.geometry.sectionBounds(supportedBeamProfile);
  const derivedSupportStiffenerStationOffset = (supportedBeamBounds.maxY - supportedBeamBounds.minY) / 2 + referencePlate.thickness / 2;
  const stationOffsets = {
    leftNearSupportStiffener: ctx.optionalParam("stiffeners.leftNearAxisOffset", derivedSupportStiffenerStationOffset),
    leftFarSupportStiffener: ctx.optionalParam("stiffeners.leftFarAxisOffset", derivedSupportStiffenerStationOffset),
    rightNearSupportStiffener: ctx.optionalParam("stiffeners.rightNearAxisOffset", derivedSupportStiffenerStationOffset),
    rightFarSupportStiffener: ctx.optionalParam("stiffeners.rightFarAxisOffset", derivedSupportStiffenerStationOffset)
  };
  const interfaceSide = ctx.geometry.v.dot(supportInterface.normal, supportAt.y) < 0 ? -1 : 1;
  const oppositeSide = interfaceSide * -1;
  const stiffeners = {
    leftNearSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.leftNearSupportStiffener, interfaceSide, "leftNearSupportStiffener", -1, interfaceSide, "ST1"),
    leftFarSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.leftFarSupportStiffener, interfaceSide, "leftFarSupportStiffener", -1, oppositeSide, "ST2"),
    rightNearSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.rightNearSupportStiffener, interfaceSide, "rightNearSupportStiffener", 1, interfaceSide, "ST3"),
    rightFarSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.rightFarSupportStiffener, interfaceSide, "rightFarSupportStiffener", 1, oppositeSide, "ST4")
  };

  const topWeldSize = Math.max(0, ctx.optionalParam("welds.top", ctx.optionalParam("welds.front", 0)));
  const bottomWeldSize = Math.max(0, ctx.optionalParam("welds.bottom", ctx.optionalParam("welds.back", 0)));
  weldStiffener(ctx, resolvedInput, "leftNearSupportStiffenerWeld", stiffeners.leftNearSupportStiffener, topWeldSize);
  weldStiffener(ctx, resolvedInput, "leftFarSupportStiffenerWeld", stiffeners.leftFarSupportStiffener, topWeldSize);
  weldStiffener(ctx, resolvedInput, "rightNearSupportStiffenerWeld", stiffeners.rightNearSupportStiffener, bottomWeldSize);
  weldStiffener(ctx, resolvedInput, "rightFarSupportStiffenerWeld", stiffeners.rightFarSupportStiffener, bottomWeldSize);
  return stiffeners;
}
