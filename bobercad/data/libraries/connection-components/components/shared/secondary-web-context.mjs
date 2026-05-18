function memberEndPoint(member, iface) {
  return iface.memberEnd === "end" ? member.end : member.start;
}

export function secondaryWebConnectionContext(ctx, input = {}) {
  const existing = input.connectionContext || input.recipeContext?.connectionContext;
  if (existing) return existing;

  const supportInterface = input.supportInterface || ctx.interface("main");
  const beamInterface = input.beamInterface || ctx.interface("secondary");
  const supportMember = input.supportMember || ctx.member("main");
  const supportedBeam = input.supportedBeam || ctx.member("secondary");
  const supportProfile = input.supportProfile || ctx.profile("main");
  const supportedBeamProfile = input.supportedBeamProfile || ctx.profile("secondary");
  ctx.check.requireMemberEnd(beamInterface, "secondary interface missing memberEnd");

  const plate = input.plate || ctx.params({
    thickness: "plate.thickness",
    length: "plate.length",
    height: "plate.height",
    edgeOffset: "plate.edgeOffset"
  });
  const beamDirection = input.beamDirection || ctx.geometry.secondaryBeamDirection(supportedBeam, beamInterface);
  const beamGap = input.beamGap ?? ctx.optionalParam("fit.beamGap", 0);
  const clipBeam = input.clipBeam ?? ctx.optionalParam("fit.clipBeam", true);
  const boltsParallelToSupport = input.boltsParallelToSupport ?? ctx.optionalParam("bolts.parallelToSupport", false);
  const supportNormal = input.supportNormal || (ctx.geometry.v.dot(supportInterface.normal, beamDirection) < 0
    ? ctx.geometry.v.mul(supportInterface.normal, -1)
    : supportInterface.normal);
  const beamEndPoint = memberEndPoint(supportedBeam, beamInterface);
  const supportPlane = ctx.geometry.v.add(supportInterface.origin, ctx.geometry.v.mul(supportNormal, plate.edgeOffset));
  const supportEdge = ctx.geometry.linePlaneIntersection(beamEndPoint, ctx.geometry.v.mul(beamDirection, -1), supportPlane, supportNormal)
    || ctx.geometry.projectPointToPlane(beamEndPoint, supportPlane, supportNormal);
  const plateReference = input.plateReference || ctx.geometry.secondaryWebReference({
    member: supportedBeam,
    profile: supportedBeamProfile,
    supportInterface,
    beamInterface,
    plateLength: plate.length,
    plateThickness: plate.thickness,
    startReferencePoint: supportEdge
  });
  const beamHoleReference = input.beamHoleReference || ctx.geometry.secondaryWebReference({
    member: supportedBeam,
    profile: supportedBeamProfile,
    supportInterface,
    beamInterface,
    plateLength: plate.length,
    plateThickness: plate.thickness,
    startReferencePoint: beamEndPoint
  });
  const supportAxisZ = ctx.geometry.projectedAxis(supportInterface.localAxisZ, beamHoleReference.normal);
  const layoutAxisZ = supportAxisZ && Math.abs(ctx.geometry.v.dot(supportAxisZ, beamHoleReference.localAxisY)) < 0.98
    ? (ctx.geometry.v.dot(supportAxisZ, beamHoleReference.localAxisZ) < 0 ? ctx.geometry.v.mul(supportAxisZ, -1) : supportAxisZ)
    : beamHoleReference.localAxisZ;
  const layoutReference = input.layoutReference || (boltsParallelToSupport
    ? { ...beamHoleReference, localAxisY: beamHoleReference.localAxisY, localAxisZ: layoutAxisZ }
    : beamHoleReference);
  const holeReference = input.holeReference || beamHoleReference;
  const beamWebThickness = input.beamWebThickness || beamHoleReference.webThickness || ctx.geometry.webThickness(supportedBeamProfile);

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
