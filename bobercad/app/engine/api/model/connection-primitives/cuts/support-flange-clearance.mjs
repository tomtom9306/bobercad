import { secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs?v=member-end-point-dry-1";

function isBeam(member) {
  return String(member.type || "").includes("beam");
}

function notchOffsets(ctx, path) {
  return {
    xMinus: Math.max(0, ctx.optionalParam(`${path}.xMinus`, 5)),
    xPlus: Math.max(0, ctx.optionalParam(`${path}.xPlus`, 5)),
    yMinus: Math.max(0, ctx.optionalParam(`${path}.yMinus`, 5)),
    yPlus: Math.max(0, ctx.optionalParam(`${path}.yPlus`, 5)),
    zMinus: Math.max(0, ctx.optionalParam(`${path}.zMinus`, 5)),
    zPlus: Math.max(0, ctx.optionalParam(`${path}.zPlus`, 5))
  };
}

function supportFlangeNotch(ctx, { region, modePath, offsetsPath, supportMember, supportProfile, supportedBeam, supportedBeamProfile, supportInterface, beamInterface }) {
  if (!isBeam(supportMember)) return null;
  if (supportProfile.profileType !== "i-section" || supportedBeamProfile.profileType !== "i-section") return null;

  const supportStation = ctx.geometry.memberStationAtPoint(supportMember, supportInterface.origin);

  return {
    operationEnabled: ctx.optionalParam(modePath, "auto") !== "off",
    source: {
      kind: "member-region",
      memberId: supportMember.id,
      interfaceId: supportInterface.id,
      region,
      station: supportStation
    },
    target: {
      memberId: supportedBeam.id,
      end: beamInterface.memberEnd
    },
    offsets: notchOffsets(ctx, offsetsPath)
  };
}

export function build(ctx, input = {}) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipeContext = input.recipeContext || {};
  const {
    supportMember,
    supportProfile,
    supportedBeam,
    supportedBeamProfile,
    supportInterface,
    beamInterface
  } = context;
  const finPlate = input.finPlate || recipeContext.finPlate;
  if (!supportMember || !supportProfile || !supportedBeam || !supportedBeamProfile || !supportInterface || !beamInterface || !finPlate) {
    ctx.fail("support-flange-clearance: secondary-web-plate must run before support-flange-clearance");
  }

  for (const spec of [
    {
      region: "top-flange",
      modePath: "notch.topMode",
      offsetsPath: "notch.topOffsets",
      memberRole: "topNotch",
      plateRole: "topPlateNotch",
      memberPlacementRole: "clear-supporting-beam-top-flange",
      platePlacementRole: "trim-fin-plate-for-supporting-beam-top-flange",
      operation: "top-flange-notch",
      plateOperation: "top-flange-plate-trim",
      name: "Top flange notch",
      plateName: "Top flange fin plate trim"
    },
    {
      region: "bottom-flange",
      modePath: "notch.bottomMode",
      offsetsPath: "notch.bottomOffsets",
      memberRole: "bottomNotch",
      plateRole: "bottomPlateNotch",
      memberPlacementRole: "clear-supporting-beam-bottom-flange",
      platePlacementRole: "trim-fin-plate-for-supporting-beam-bottom-flange",
      operation: "bottom-flange-notch",
      plateOperation: "bottom-flange-plate-trim",
      name: "Bottom flange notch",
      plateName: "Bottom flange fin plate trim"
    }
  ]) {
    const notch = supportFlangeNotch(ctx, {
      region: spec.region,
      modePath: spec.modePath,
      offsetsPath: spec.offsetsPath,
      supportMember,
      supportProfile,
      supportedBeam,
      supportedBeamProfile,
      supportInterface,
      beamInterface
    });
    if (!notch) continue;

    const common = {
      kind: "support-flange-notch",
      operationEnabled: notch.operationEnabled,
      cutKind: "part-cut",
      source: notch.source,
      target: notch.target,
      offsets: notch.offsets,
    };
    const cutterDisplay = { visible: true, suppressed: true, color: "#ff3366", transparent: true, opacity: 0.28 };
    const hiddenTrimDisplay = { visible: false, color: "#ff3366", transparent: true, opacity: 0.08 };
    const references = [
      { objectId: supportMember.id, interfaceId: supportInterface.id },
      { objectId: supportedBeam.id, end: beamInterface.memberEnd }
    ];

    ctx.feature.clearanceCut(spec.memberRole, {
      ...common,
      ownerId: supportedBeam.id,
      fabrication: { operation: spec.operation },
      placementIntent: {
        role: spec.memberPlacementRole,
        host: { objectId: supportedBeam.id, end: beamInterface.memberEnd },
        references: [references[0]],
        source: "support-flange-clearance-cut"
      },
      bim: { name: spec.name },
      display: cutterDisplay
    });
    ctx.feature.clearanceCut(spec.plateRole, {
      ...common,
      ownerId: finPlate.id,
      fabrication: { operation: spec.plateOperation },
      placementIntent: {
        role: spec.platePlacementRole,
        host: { objectId: finPlate.id },
        references,
        source: "support-flange-clearance-cut"
      },
      bim: { name: spec.plateName },
      display: hiddenTrimDisplay
    });
  }
}
