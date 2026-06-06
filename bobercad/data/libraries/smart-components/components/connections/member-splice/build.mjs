import { buildMemberSpliceConnections } from "../../shared/connections/standard-connections.mjs";

export function build(ctx) {
  buildMemberSpliceConnections(ctx, { family: "member-splice", title: "Member splice" });
}
