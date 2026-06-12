import { plateAxisDimension } from "./dimensions/plate-axis.mjs?v=unified-dimension-overlay-1";
import { holeSpacingDimension } from "./dimensions/hole-spacing.mjs?v=unified-dimension-overlay-1";
import { holeEdgeDistanceDimension, holeInterfaceEdgeDistanceDimension } from "./dimensions/hole-edge-distance.mjs?v=unified-dimension-overlay-1";
import { holePatternDimension } from "./dimensions/hole-pattern.mjs?v=unified-dimension-overlay-1";
import { holeDiameterDimension } from "./dimensions/hole-diameter.mjs?v=unified-dimension-overlay-1";
import { featureDepthDimension } from "./dimensions/feature-depth.mjs?v=unified-dimension-overlay-1";
import { fastenerLengthDimension } from "./dimensions/fastener-length.mjs?v=unified-dimension-overlay-1";
import { interfaceOffsetDimension, trimPlaneOffsetDimension } from "./dimensions/interface-offsets.mjs?v=unified-dimension-overlay-1";
import { clearanceCutOffsetDimension } from "./dimensions/clearance-cut-offset.mjs?v=unified-dimension-overlay-1";
import { featureOptionCalloutDimension, trimOptionCalloutDimension } from "./dimensions/feature-option-callout.mjs?v=unified-dimension-overlay-1";
import { plateReferencePlaneOffsetDimension } from "./dimensions/plate-reference-plane-offset.mjs?v=unified-dimension-overlay-1";
import { weldSizeDimension } from "./dimensions/weld-size.mjs?v=unified-dimension-overlay-1";

const handlers = new Map([
  ["plate-axis", plateAxisDimension],
  ["bolt-pattern", holePatternDimension],
  ["hole-spacing", holeSpacingDimension],
  ["hole-edge-distance", holeEdgeDistanceDimension],
  ["hole-interface-edge-distance", holeInterfaceEdgeDistanceDimension],
  ["hole-diameter", holeDiameterDimension],
  ["feature-depth", featureDepthDimension],
  ["fastener-length", fastenerLengthDimension],
  ["interface-offset", interfaceOffsetDimension],
  ["trim-plane-offset", trimPlaneOffsetDimension],
  ["feature-option-callout", featureOptionCalloutDimension],
  ["trim-option-callout", trimOptionCalloutDimension],
  ["plate-reference-plane-offset", plateReferencePlaneOffsetDimension],
  ["clearance-cut-offset", clearanceCutOffsetDimension],
  ["weld-size", weldSizeDimension]
]);

export function dimensionHandler(kind) {
  return handlers.get(kind) || null;
}
