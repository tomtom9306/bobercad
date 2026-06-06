import { buildStandardHardwareConnections } from "../../shared/connections/standard-connections.mjs";

export function build(ctx) {
  buildStandardHardwareConnections(ctx, { family: "standard-hardware", title: "Standard hardware" });
}
