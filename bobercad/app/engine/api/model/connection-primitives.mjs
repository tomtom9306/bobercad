import { build as designStatus } from "./connection-primitives/metadata/design-status.mjs";
import { build as secondaryWebPlate } from "./connection-primitives/plates/secondary-web-plate.mjs";
import { build as secondaryMemberGapTrim } from "./connection-primitives/features/secondary-member-gap-trim.mjs";
import { build as webBoltPattern } from "./connection-primitives/fasteners/web-bolt-pattern.mjs";
import { build as supportFlangeClearance } from "./connection-primitives/cuts/support-flange-clearance.mjs";
import { build as supportEdgeFillet } from "./connection-primitives/welds/support-edge-fillet.mjs";
import { build as supportWebStiffeners } from "./connection-primitives/stiffeners/support-web-stiffeners.mjs";
import { build as memberEndPlate } from "./connection-primitives/plates/member-end-plate.mjs";
import { build as basePlate } from "./connection-primitives/plates/base-plate.mjs";
import { build as dualMemberGusset } from "./connection-primitives/plates/dual-member-gusset.mjs";

const OPERATION_BUILDERS = {
  "design-status": designStatus,
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

export function modelOperationTypes() {
  return Object.keys(OPERATION_BUILDERS).sort();
}
