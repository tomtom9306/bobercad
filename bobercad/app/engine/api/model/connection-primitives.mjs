import { build as secondaryWebPlate } from "./connection-primitives/plates/secondary-web-plate.mjs?v=member-end-point-dry-1";
import { build as secondaryMemberGapTrim } from "./connection-primitives/features/secondary-member-gap-trim.mjs?v=member-end-point-dry-1";
import { build as webBoltPattern } from "./connection-primitives/fasteners/web-bolt-pattern.mjs?v=member-end-point-dry-1";
import { build as supportFlangeClearance } from "./connection-primitives/cuts/support-flange-clearance.mjs?v=member-end-point-dry-1";
import { build as supportEdgeFillet } from "./connection-primitives/welds/support-edge-fillet.mjs?v=member-end-point-dry-1";
import { build as supportWebStiffeners } from "./connection-primitives/stiffeners/support-web-stiffeners.mjs?v=member-end-point-dry-1";
import { build as memberEndPlate } from "./connection-primitives/plates/member-end-plate.mjs";
import { build as basePlate } from "./connection-primitives/plates/base-plate.mjs";
import { build as dualMemberGusset } from "./connection-primitives/plates/dual-member-gusset.mjs";

const OPERATION_BUILDERS = {
  "secondary-web-plate": secondaryWebPlate,
  "secondary-member-gap-trim": secondaryMemberGapTrim,
  "web-bolt-pattern": webBoltPattern,
  "support-flange-clearance": supportFlangeClearance,
  "support-edge-fillet": supportEdgeFillet,
  "support-web-stiffeners": supportWebStiffeners,
  "member-end-plate": memberEndPlate,
  "base-plate": basePlate,
  "dual-member-gusset": dualMemberGusset
};

export function modelOperationBuilder(type) {
  return OPERATION_BUILDERS[type] || null;
}
