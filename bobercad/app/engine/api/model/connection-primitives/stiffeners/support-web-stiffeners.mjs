import { recipeContext, secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";
import { requiredNonNegativeNumber, requiredObject, requiredPositiveNumber } from "../shared/validation.mjs";

function requiredInput(ctx, input, key) {
  const value = input[key];
  if (!value) ctx.fail(`support-web-stiffeners missing ${key}`);
  return value;
}

function createStiffener(ctx, input, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, supportStiffenerStationOffset, interfaceSide, role, stationSide, webSide, partMark) {
  const supportMember = requiredInput(ctx, input, "supportMember");
  const supportInterface = requiredInput(ctx, input, "supportInterface");
  const referencePlate = requiredInput(ctx, input, "referencePlate");
  const plateThickness = requiredPositiveNumber(
    ctx,
    ctx.parameterValue("stiffeners.thickness"),
    "stiffeners.thickness"
  );
  const supportWebY = webSide < 0 ? supportWebBounds.minY : supportWebBounds.maxY;
  const supportOuterY = webSide < 0 ? supportBounds.minY : supportBounds.maxY;
  const supportStiffenerWidth = Math.abs(supportOuterY - supportWebY);
  requiredPositiveNumber(ctx, supportStiffenerWidth, `${role}.width`);
  requiredPositiveNumber(ctx, supportStiffenerHeight, `${role}.height`);
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
  if (size === 0) return null;
  const supportMember = requiredInput(ctx, input, "supportMember");
  const supportInterface = requiredInput(ctx, input, "supportInterface");
  const beamInterface = requiredInput(ctx, input, "beamInterface");
  return ctx.weld.fillet(role, {
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

function weldSize(ctx, path) {
  return requiredNonNegativeNumber(ctx, ctx.param(path), path);
}

export function build(ctx, input) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipe = recipeContext(ctx, input, "support-web-stiffeners");
  const { supportMember, supportProfile, supportInterface } = context;
  const referencePlate = requiredObject(ctx, recipe.finPlate, "recipeContext.finPlate");
  const resolvedInput = { ...context, referencePlate };
  const supportStation = ctx.geometry.memberStationAtPoint(supportMember, supportInterface.origin);
  const supportAt = ctx.geometry.memberFrameAt(supportMember, supportStation);
  const supportBounds = ctx.geometry.sectionBounds(supportProfile);
  const supportWebBounds = ctx.geometry.sectionWebBounds(supportProfile);
  const supportStiffenerHeight = supportWebBounds.maxZ - supportWebBounds.minZ;
  const supportStiffenerCenterZ = (supportWebBounds.minZ + supportWebBounds.maxZ) / 2;
  const stationOffsets = {
    leftNearSupportStiffener: requiredPositiveNumber(ctx, ctx.parameterValue("stiffeners.leftNearAxisOffset"), "stiffeners.leftNearAxisOffset"),
    leftFarSupportStiffener: requiredPositiveNumber(ctx, ctx.parameterValue("stiffeners.leftFarAxisOffset"), "stiffeners.leftFarAxisOffset"),
    rightNearSupportStiffener: requiredPositiveNumber(ctx, ctx.parameterValue("stiffeners.rightNearAxisOffset"), "stiffeners.rightNearAxisOffset"),
    rightFarSupportStiffener: requiredPositiveNumber(ctx, ctx.parameterValue("stiffeners.rightFarAxisOffset"), "stiffeners.rightFarAxisOffset")
  };
  const interfaceSide = ctx.geometry.v.dot(supportInterface.normal, supportAt.y) < 0 ? -1 : 1;
  const oppositeSide = interfaceSide * -1;
  const stiffeners = {
    leftNearSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.leftNearSupportStiffener, interfaceSide, "leftNearSupportStiffener", -1, interfaceSide, "ST1"),
    leftFarSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.leftFarSupportStiffener, interfaceSide, "leftFarSupportStiffener", -1, oppositeSide, "ST2"),
    rightNearSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.rightNearSupportStiffener, interfaceSide, "rightNearSupportStiffener", 1, interfaceSide, "ST3"),
    rightFarSupportStiffener: createStiffener(ctx, resolvedInput, supportAt, supportBounds, supportWebBounds, supportStiffenerHeight, supportStiffenerCenterZ, stationOffsets.rightFarSupportStiffener, interfaceSide, "rightFarSupportStiffener", 1, oppositeSide, "ST4")
  };

  const topWeldSize = weldSize(ctx, "welds.top");
  const bottomWeldSize = weldSize(ctx, "welds.bottom");
  weldStiffener(ctx, resolvedInput, "leftNearSupportStiffenerWeld", stiffeners.leftNearSupportStiffener, topWeldSize);
  weldStiffener(ctx, resolvedInput, "leftFarSupportStiffenerWeld", stiffeners.leftFarSupportStiffener, topWeldSize);
  weldStiffener(ctx, resolvedInput, "rightNearSupportStiffenerWeld", stiffeners.rightNearSupportStiffener, bottomWeldSize);
  weldStiffener(ctx, resolvedInput, "rightFarSupportStiffenerWeld", stiffeners.rightFarSupportStiffener, bottomWeldSize);
  return stiffeners;
}
