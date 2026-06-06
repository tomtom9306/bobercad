import { buildRailingSystem } from "../shared/railing-system.mjs";

export function build(ctx) {
  buildRailingSystem(ctx, { family: "glass-panel", title: "Glass panel railing" });
}
