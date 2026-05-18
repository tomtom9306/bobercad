import { secondaryWebConnectionContext } from "../../shared/secondary-web-context.mjs";

function trimAllowance(ctx, height, localAxisY, localAxisZ, planeNormal) {
  const alongY = Math.abs(ctx.geometry.v.dot(localAxisY, planeNormal));
  if (alongY <= 1e-9) return 0;
  return height * Math.abs(ctx.geometry.v.dot(localAxisZ, planeNormal)) / alongY + 1;
}

function finPlateOutline(ctx, plate, supportInterface, beamDirection, webReference) {
  const supportPlane = ctx.geometry.v.add(supportInterface.origin, ctx.geometry.v.mul(supportInterface.normal, plate.edgeOffset));
  const beamEndPlane = ctx.geometry.v.add(supportPlane, ctx.geometry.v.mul(beamDirection, plate.length));
  const beamKeepPoint = ctx.geometry.v.add(supportPlane, ctx.geometry.v.mul(beamDirection, plate.length / 2));
  const extra = Math.max(
    trimAllowance(ctx, plate.height, webReference.localAxisY, webReference.localAxisZ, supportInterface.normal),
    trimAllowance(ctx, plate.height, webReference.localAxisY, webReference.localAxisZ, beamDirection)
  );
  let outline = ctx.geometry.rectangleOutline(plate.length + 2 * extra, plate.height);
  outline = ctx.geometry.clipPlateOutlineByPlane({
    outline,
    plateCenter: webReference.origin,
    localAxisY: webReference.localAxisY,
    localAxisZ: webReference.localAxisZ,
    planeOrigin: supportPlane,
    planeNormal: supportInterface.normal,
    keepPoint: beamKeepPoint
  });
  outline = ctx.geometry.clipPlateOutlineByPlane({
    outline,
    plateCenter: webReference.origin,
    localAxisY: webReference.localAxisY,
    localAxisZ: webReference.localAxisZ,
    planeOrigin: beamEndPlane,
    planeNormal: beamDirection,
    keepPoint: supportPlane
  });
  return outline;
}

export function build(ctx, input = {}) {
  const context = secondaryWebConnectionContext(ctx, input);
  const { plate, supportInterface, beamInterface, supportMember, supportedBeam, beamDirection, plateReference, beamHoleReference, beamWebThickness } = context;

  ctx.check.plateFitsInterface(beamHoleReference, plate.length, plate.height, {
    offset: plate.edgeOffset,
    objectRoles: ["finPlate"],
    lengthCode: "fin-plate-length-outside-secondary-interface",
    lengthMessage: (overrun) => `Fin plate extends ${overrun} mm past the secondary member connection zone.`,
    lengthParameters: ["plate.length", "plate.edgeOffset"],
    heightCode: "fin-plate-height-intersects-secondary-flanges",
    heightMessage: (allowedHeight) => `Fin plate height ${plate.height} mm exceeds the secondary web zone height ${allowedHeight} mm.`,
    heightParameters: ["plate.height"]
  });

  const outline = finPlateOutline(ctx, plate, supportInterface, beamDirection, plateReference);
  ctx.check.plateOutlineValid(outline, {
    code: "fin-plate-outline-invalid-after-trimming",
    message: "Fin plate trimming left no valid plate outline.",
    objectRoles: ["finPlate"],
    parameters: ["plate.length", "plate.height", "plate.edgeOffset"]
  });

  const finPlate = ctx.part.plate("finPlate", {
    type: "rectangular-plate",
    thickness: plate.thickness,
    width: plate.length,
    height: plate.height,
    outline,
    center: plateReference.origin,
    normal: plateReference.normal,
    localAxisY: plateReference.localAxisY,
    localAxisZ: plateReference.localAxisZ,
    assemblyId: ctx.connection.assemblyId,
    placementIntent: {
      role: "fin-plate",
      host: { objectId: supportMember.id, interfaceId: supportInterface.id },
      references: [{ objectId: supportedBeam.id, end: beamInterface.memberEnd }],
      fit: "support-face-to-secondary-web"
    },
    display: { color: "#4f6f83" },
    fabrication: { partMark: "FP1" }
  });

  const backPlateCenter = ctx.geometry.v.sub(plateReference.webFaceOrigin, ctx.geometry.v.mul(plateReference.normal, beamWebThickness + plate.thickness / 2));
  const backFinPlate = ctx.part.plate("backFinPlate", {
    type: "rectangular-plate",
    thickness: plate.thickness,
    width: plate.length,
    height: plate.height,
    outline,
    center: backPlateCenter,
    normal: ctx.geometry.v.mul(plateReference.normal, -1),
    localAxisY: plateReference.localAxisY,
    localAxisZ: plateReference.localAxisZ,
    assemblyId: ctx.connection.assemblyId,
    placementIntent: {
      role: "back-fin-plate",
      host: { objectId: supportMember.id, interfaceId: supportInterface.id },
      references: [{ objectId: supportedBeam.id, end: beamInterface.memberEnd }],
      fit: "opposite-side-sandwich-plate"
    },
    display: { color: "#4f6f83" },
    fabrication: { partMark: "FP2" }
  });

  return { connectionContext: context, finPlate, backFinPlate, outline };
}
