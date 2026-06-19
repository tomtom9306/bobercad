import { buildStairHardwareConnections } from "../../shared/connections/stair-and-splice-hardware-connections.mjs";

export function build(ctx) {
  buildStairHardwareConnections(ctx, { family: "stair-hardware", title: "Stair hardware" });
}
