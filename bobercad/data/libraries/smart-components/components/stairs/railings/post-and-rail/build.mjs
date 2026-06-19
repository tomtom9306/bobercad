import { buildRailingSystem } from "../shared/railing-path-and-panel-system.mjs";

export function build(ctx) {
  buildRailingSystem(ctx, { family: "post-and-rail", title: "Post and rail" });
}
