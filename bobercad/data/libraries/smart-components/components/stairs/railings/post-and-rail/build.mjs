import { buildRailingSystem } from "../shared/railing-system.mjs";

export function build(ctx) {
  buildRailingSystem(ctx, { family: "post-and-rail", title: "Post and rail" });
}
