import { buildSupportSystem } from "../shared/support-system.mjs";

export function build(ctx) {
  buildSupportSystem(ctx, { family: "mono-stringer", title: "Mono stringer support", color: "#365f78" });
}
