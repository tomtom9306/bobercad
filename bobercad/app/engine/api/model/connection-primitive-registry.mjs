import { build as secondaryWebPlate } from "./connection-primitives/plates/secondary-web-plate.mjs";
import { build as secondaryMemberGapTrim } from "./connection-primitives/trims/secondary-member-gap-trim.mjs";
import { build as webBoltPattern } from "./connection-primitives/fasteners/secondary-web-bolting.mjs";
import { build as supportFlangeClearance } from "./connection-primitives/cuts/support-flange-clearance.mjs";
import { build as supportEdgeFillet } from "./connection-primitives/welds/support-edge-fillet.mjs";
import { build as supportWebStiffeners } from "./connection-primitives/stiffeners/support-web-stiffeners.mjs";
import { build as memberEndPlate } from "./connection-primitives/plates/member-end-plate.mjs";
import { build as basePlate } from "./connection-primitives/plates/base-plate.mjs";
import { build as dualMemberGusset } from "./connection-primitives/plates/dual-member-gusset.mjs";

const OPERATION_BUILDERS = Object.freeze({
  "secondary-web-plate": secondaryWebPlate,
  "secondary-member-gap-trim": secondaryMemberGapTrim,
  "web-bolt-pattern": webBoltPattern,
  "support-flange-clearance": supportFlangeClearance,
  "support-edge-fillet": supportEdgeFillet,
  "support-web-stiffeners": supportWebStiffeners,
  "member-end-plate": memberEndPlate,
  "base-plate": basePlate,
  "dual-member-gusset": dualMemberGusset
});

export function modelOperationBuilder(type) {
  if (typeof type !== "string" || !type) throw new Error("model operation type must be a non-empty string");
  if (!Object.hasOwn(OPERATION_BUILDERS, type)) throw new Error(`model operation not found: ${type}`);
  const build = OPERATION_BUILDERS[type];
  if (typeof build !== "function") throw new Error(`model operation builder is invalid: ${type}`);
  return build;
}
