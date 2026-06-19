import { buildMemberSpliceConnections } from "../../shared/connections/stair-and-splice-hardware-connections.mjs";

export function build(ctx) {
  buildMemberSpliceConnections(ctx, { family: "member-splice", title: "Member splice" });
}
