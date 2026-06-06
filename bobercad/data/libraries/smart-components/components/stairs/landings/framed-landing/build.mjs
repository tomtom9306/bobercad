import { buildLandingSet } from "../shared-landing.mjs?v=landing-footprint-1";

export function build(ctx) {
  buildLandingSet(ctx, { family: "framed-landing", title: "Framed landing", color: "#737b89", framed: true });
}
