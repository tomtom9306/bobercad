import { buildRailingSystem } from "../shared/railing-path-and-panel-system.mjs";

export function build(ctx) {
  buildRailingSystem(ctx, { family: "wall-handrail", title: "Wall handrail" });
}
