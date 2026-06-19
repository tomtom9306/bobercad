import { recipeContext, secondaryWebConnectionContext } from "../shared/secondary-web-context.mjs";
import { requiredNonNegativeNumber, requiredObject } from "../shared/validation.mjs";

function weldSize(ctx, path) {
  return requiredNonNegativeNumber(ctx, ctx.param(path), path);
}

function addWeldRun(runs, edge, size, side = null) {
  if (size === 0) return;
  runs.push({ edge, ...(side ? { side } : {}), size });
}

function supportWeldRuns(ctx) {
  const runs = [];
  addWeldRun(runs, "support", weldSize(ctx, "welds.front"), "front");
  addWeldRun(runs, "support", weldSize(ctx, "welds.back"), "back");
  addWeldRun(runs, "top", weldSize(ctx, "welds.top"));
  addWeldRun(runs, "bottom", weldSize(ctx, "welds.bottom"));
  return runs;
}

export function build(ctx, input) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipe = recipeContext(ctx, input, "support-edge-fillet");
  const { supportMember, supportInterface, beamInterface } = context;
  const finPlate = requiredObject(ctx, recipe.finPlate, "recipeContext.finPlate");
  const backFinPlate = requiredObject(ctx, recipe.backFinPlate, "recipeContext.backFinPlate");

  const weldRuns = supportWeldRuns(ctx);
  if (!weldRuns.length) ctx.fail("support-edge-fillet requires at least one positive weld size");
  const size = Math.max(...weldRuns.map((run) => run.size));
  ctx.weld.fillet("weld", {
    size,
    participants: [supportMember.id, finPlate.id],
    reference: {
      kind: "plate-support-edge",
      plateId: finPlate.id,
      supportInterfaceId: supportInterface.id,
      stationReferenceInterfaceRef: beamInterface.id,
      runs: weldRuns
    }
  });
  ctx.weld.fillet("backWeld", {
    size,
    participants: [supportMember.id, backFinPlate.id],
    reference: {
      kind: "plate-support-edge",
      plateId: backFinPlate.id,
      supportInterfaceId: supportInterface.id,
      stationReferenceInterfaceRef: beamInterface.id,
      runs: weldRuns
    }
  });

  return { weldRuns };
}
