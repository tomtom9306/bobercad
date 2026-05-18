import { secondaryWebConnectionContext } from "../../shared/secondary-web-context.mjs";

function addWeldRun(runs, edge, size, side = null) {
  if (size > 0) runs.push({ edge, ...(side ? { side } : {}), size });
}

function supportWeldRuns(ctx) {
  const runs = [];
  addWeldRun(runs, "support", ctx.optionalParam("welds.front", 0), "front");
  addWeldRun(runs, "support", ctx.optionalParam("welds.back", 0), "back");
  addWeldRun(runs, "top", ctx.optionalParam("welds.top", 0));
  addWeldRun(runs, "bottom", ctx.optionalParam("welds.bottom", 0));
  return runs;
}

export function build(ctx, input = {}) {
  const context = secondaryWebConnectionContext(ctx, input);
  const recipeContext = input.recipeContext || {};
  const { supportMember, supportInterface, beamInterface } = context;
  const finPlate = input.finPlate || recipeContext.finPlate;
  const backFinPlate = input.backFinPlate || recipeContext.backFinPlate;
  if (!supportMember || !supportInterface || !beamInterface || !finPlate || !backFinPlate) {
    ctx.fail("support-edge-fillet: secondary-web-plate must run before support-edge-fillet");
  }

  const weldRuns = supportWeldRuns(ctx);
  ctx.weld.fillet("weld", {
    size: Math.max(0, ...weldRuns.map((run) => run.size)),
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
    size: Math.max(0, ...weldRuns.map((run) => run.size)),
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
