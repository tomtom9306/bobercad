import { recipeContext, secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";
import { enumValue, requiredNonNegativeNumber, requiredObject } from "../shared/validation.mjs";

function isBeam(ctx, member) {
  if (typeof member.type !== "string" || !member.type) ctx.fail(`${member.id}: member type is required`);
  return member.type.includes("beam");
}

function notchOffset(ctx, path) {
  return requiredNonNegativeNumber(ctx, ctx.parameterValue(path), path);
}

function notchOffsets(ctx, path) {
  return {
    xMinus: notchOffset(ctx, `${path}.xMinus`),
    xPlus: notchOffset(ctx, `${path}.xPlus`),
    yMinus: notchOffset(ctx, `${path}.yMinus`),
    yPlus: notchOffset(ctx, `${path}.yPlus`),
    zMinus: notchOffset(ctx, `${path}.zMinus`),
    zPlus: notchOffset(ctx, `${path}.zPlus`)
  };
}

function supportFlangeNotch(ctx, { region, modePath, offsetsPath, supportMember, supportProfile, supportedBeam, supportedBeamProfile, supportInterface, beamInterface }) {
  if (!isBeam(ctx, supportMember)) return null;
  if (!isBeam(ctx, supportedBeam)) ctx.fail(`${supportedBeam.id}: support-flange-clearance requires a beam secondary member`);
  if (supportProfile.profileType !== "i-section") ctx.fail(`${supportMember.id}: support-flange-clearance requires an i-section support beam profile`);
  if (supportedBeamProfile.profileType !== "i-section") ctx.fail(`${supportedBeam.id}: support-flange-clearance requires an i-section secondary beam profile`);

  const supportStation = ctx.geometry.memberStationAtPoint(supportMember, supportInterface.origin);

  return {
    operationEnabled: enumValue(ctx, ctx.parameterValue(modePath), ["auto", "off"], modePath) !== "off",
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

export function build(ctx, input) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipe = recipeContext(ctx, input, "support-flange-clearance");
  const {
    supportMember,
    supportProfile,
    supportedBeam,
    supportedBeamProfile,
    supportInterface,
    beamInterface
  } = context;
  const finPlate = requiredObject(ctx, recipe.finPlate, "recipeContext.finPlate");

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
  return {};
}
