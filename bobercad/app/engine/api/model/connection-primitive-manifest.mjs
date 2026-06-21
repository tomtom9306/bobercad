import { registerModelOperation } from "./connection-primitive-registry.mjs";
import { build as supportFlangeClearance } from "./connection-primitives/cuts/support-flange-clearance.mjs";
import { build as webBoltPattern } from "./connection-primitives/fasteners/secondary-web-bolting.mjs";
import { build as basePlate } from "./connection-primitives/plates/base-plate.mjs";
import { build as dualMemberGusset } from "./connection-primitives/plates/dual-member-gusset.mjs";
import { build as memberEndPlate } from "./connection-primitives/plates/member-end-plate.mjs";
import { build as secondaryWebPlate } from "./connection-primitives/plates/secondary-web-plate.mjs";
import { build as supportWebStiffeners } from "./connection-primitives/stiffeners/support-web-stiffeners.mjs";
import { build as secondaryMemberGapTrim } from "./connection-primitives/trims/secondary-member-gap-trim.mjs";
import { build as supportEdgeFillet } from "./connection-primitives/welds/support-edge-fillet.mjs";

const EMPTY_INPUTS = Object.freeze({ required: Object.freeze([]), optional: Object.freeze([]) });

const CONNECTION_PRIMITIVE_OPERATIONS = Object.freeze([
  Object.freeze({ type: "secondary-web-plate", build: secondaryWebPlate, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "secondary-member-gap-trim", build: secondaryMemberGapTrim, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "web-bolt-pattern", build: webBoltPattern, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "support-flange-clearance", build: supportFlangeClearance, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "support-edge-fillet", build: supportEdgeFillet, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "support-web-stiffeners", build: supportWebStiffeners, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "member-end-plate", build: memberEndPlate, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "base-plate", build: basePlate, inputs: EMPTY_INPUTS }),
  Object.freeze({ type: "dual-member-gusset", build: dualMemberGusset, inputs: EMPTY_INPUTS })
]);

let registered = false;

export function registerConnectionPrimitiveOperations() {
  if (registered) return;
  for (const operation of CONNECTION_PRIMITIVE_OPERATIONS) registerModelOperation(operation);
  registered = true;
}

export function connectionPrimitiveOperations() {
  return CONNECTION_PRIMITIVE_OPERATIONS.map((operation) => ({
    type: operation.type,
    inputs: {
      required: [...operation.inputs.required],
      optional: [...operation.inputs.optional]
    }
  }));
}
