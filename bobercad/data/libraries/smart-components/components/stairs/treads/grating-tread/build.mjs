import { buildTreadSet } from "../shared/tread-set.mjs?v=timber-backing-plate-1";

export function build(ctx) {
  buildTreadSet(ctx, { family: "grating-tread", title: "Grating tread", color: "#64748b", plateType: "grating-tread" });
}
