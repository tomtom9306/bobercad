import { buildRailingSystem } from "../shared/railing-system.mjs";

export function build(ctx) {
  buildRailingSystem(ctx, { family: "wall-handrail", title: "Wall handrail" });
}
