import { memberPointAtEnd } from "../../../project/members.mjs";
import { requiredBoolean, requiredNonNegativeNumber, requiredObject, requiredPositiveNumber, requiredVec3 } from "./validation.mjs";

function plateParameters(ctx, plate) {
  const source = requiredObject(ctx, plate, "plate");
  return {
    ...source,
    thickness: requiredPositiveNumber(ctx, source.thickness, "plate.thickness"),
    length: requiredPositiveNumber(ctx, source.length, "plate.length"),
    height: requiredPositiveNumber(ctx, source.height, "plate.height"),
    edgeOffset: requiredNonNegativeNumber(ctx, source.edgeOffset, "plate.edgeOffset")
  };
}

export function recipeContext(ctx, input, scope) {
  return requiredObject(ctx, input.recipeContext, `${scope} recipeContext`);
}

export function secondaryWebConnectionContext(ctx, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) ctx.fail("secondary-web context input must be an object");
  const recipe = recipeContext(ctx, input, "secondary-web context");
  if (Object.prototype.hasOwnProperty.call(recipe, "connectionContext")) {
    return requiredObject(ctx, recipe.connectionContext, "recipeContext.connectionContext");
  }

  const supportInterface = requiredObject(ctx, ctx.interface("main"), "supportInterface");
  const beamInterface = requiredObject(ctx, ctx.interface("secondary"), "beamInterface");
  const supportMember = requiredObject(ctx, ctx.member("main"), "supportMember");
  const supportedBeam = requiredObject(ctx, ctx.member("secondary"), "supportedBeam");
  const supportProfile = requiredObject(ctx, ctx.profile("main"), "supportProfile");
  const supportedBeamProfile = requiredObject(ctx, ctx.profile("secondary"), "supportedBeamProfile");
  ctx.check.requireMemberEnd(beamInterface, "secondary interface missing memberEnd");

  const plate = plateParameters(ctx, ctx.params({
    thickness: "plate.thickness",
    length: "plate.length",
    height: "plate.height",
    edgeOffset: "plate.edgeOffset"
  }));
  const beamDirection = requiredVec3(ctx, ctx.geometry.secondaryBeamDirection(supportedBeam, beamInterface), "beamDirection");
  const beamGap = requiredNonNegativeNumber(ctx, ctx.parameterValue("fit.beamGap"), "beamGap");
  const clipBeam = requiredBoolean(ctx, ctx.parameterValue("fit.clipBeam"), "clipBeam");
  const boltsParallelToSupport = requiredBoolean(ctx, ctx.parameterValue("bolts.parallelToSupport"), "boltsParallelToSupport");
  const supportNormal = requiredVec3(ctx, ctx.geometry.v.dot(supportInterface.normal, beamDirection) < 0
    ? ctx.geometry.v.mul(supportInterface.normal, -1)
    : supportInterface.normal, "supportNormal");
  const beamEndPoint = memberPointAtEnd(supportedBeam, beamInterface.memberEnd);
  const supportPlane = ctx.geometry.v.add(supportInterface.origin, ctx.geometry.v.mul(supportNormal, plate.edgeOffset));
  const supportEdge = ctx.geometry.linePlaneIntersection(beamEndPoint, ctx.geometry.v.mul(beamDirection, -1), supportPlane, supportNormal);
  if (!supportEdge) ctx.fail("secondary-web support edge line does not intersect support plane");
  const plateReference = requiredObject(ctx, ctx.geometry.secondaryWebReference({
    member: supportedBeam,
    profile: supportedBeamProfile,
    supportInterface,
    beamInterface,
    plateLength: plate.length,
    plateThickness: plate.thickness,
    startReferencePoint: supportEdge
  }), "plateReference");
  const beamHoleReference = requiredObject(ctx, ctx.geometry.secondaryWebReference({
    member: supportedBeam,
    profile: supportedBeamProfile,
    supportInterface,
    beamInterface,
    plateLength: plate.length,
    plateThickness: plate.thickness,
    startReferencePoint: beamEndPoint
  }), "beamHoleReference");
  const supportAxisZ = ctx.geometry.projectedAxis(supportInterface.localAxisZ, beamHoleReference.normal);
  const layoutAxisZ = supportAxisZ && Math.abs(ctx.geometry.v.dot(supportAxisZ, beamHoleReference.localAxisY)) < 0.98
    ? (ctx.geometry.v.dot(supportAxisZ, beamHoleReference.localAxisZ) < 0 ? ctx.geometry.v.mul(supportAxisZ, -1) : supportAxisZ)
    : beamHoleReference.localAxisZ;
  const layoutReference = requiredObject(ctx, boltsParallelToSupport
    ? { ...beamHoleReference, localAxisZ: layoutAxisZ }
    : beamHoleReference, "layoutReference");
  const holeReference = beamHoleReference;
  const beamWebThickness = requiredPositiveNumber(ctx, beamHoleReference.webThickness, "beamWebThickness");

  return {
    supportInterface,
    beamInterface,
    supportMember,
    supportedBeam,
    supportProfile,
    supportedBeamProfile,
    plate,
    beamDirection,
    beamGap,
    clipBeam,
    supportNormal,
    supportEdge,
    plateReference,
    beamHoleReference,
    layoutReference,
    holeReference,
    beamWebThickness
  };
}
