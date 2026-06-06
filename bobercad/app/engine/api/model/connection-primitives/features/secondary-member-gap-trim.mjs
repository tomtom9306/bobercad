import { secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";

export function build(ctx, input = {}) {
  const {
    supportInterface,
    supportMember,
    supportedBeam,
    beamInterface,
    plateReference,
    supportNormal,
    beamGap,
    clipBeam
  } = secondaryWebConnectionContext(ctx, input);

  const beamTrimPlane = ctx.reference.plane("beamTrimPlane", {
    origin: ctx.geometry.v.add(supportInterface.origin, ctx.geometry.v.mul(supportNormal, beamGap)),
    normal: supportNormal,
    axisX: plateReference.normal,
    axisY: plateReference.localAxisZ,
    fabrication: { operation: "secondary-member-gap-plane" }
  });
  const beamTrim = ctx.trim.planeTrim("beamTrim", {
    memberId: supportedBeam.id,
    memberEnd: beamInterface.memberEnd,
    operationEnabled: clipBeam,
    referencePlaneIds: [beamTrimPlane.id],
    display: { visible: false },
    fabrication: { operation: "trim-secondary-member-to-support-gap" },
    placementIntent: {
      role: "set-secondary-member-gap",
      host: { objectId: supportedBeam.id, end: beamInterface.memberEnd },
      references: [{ objectId: supportMember.id, interfaceId: supportInterface.id }],
      fit: "secondary-end-to-support-face-gap"
    }
  });

  return { beamTrim };
}
