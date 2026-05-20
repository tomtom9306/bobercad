import { plateAxisDimension } from "./dimensions/plate-axis.mjs";
import { holeSpacingDimension } from "./dimensions/hole-spacing.mjs";
import { holeEdgeDistanceDimension, holeInterfaceEdgeDistanceDimension } from "./dimensions/hole-edge-distance.mjs";
import { holePatternDimension } from "./dimensions/hole-pattern.mjs";
import { holeDiameterDimension } from "./dimensions/hole-diameter.mjs";
import { featureDepthDimension } from "./dimensions/feature-depth.mjs";
import { fastenerLengthDimension } from "./dimensions/fastener-length.mjs";
import { interfaceOffsetDimension, featurePlaneOffsetDimension } from "./dimensions/interface-offsets.mjs";
import { clearanceCutOffsetDimension } from "./dimensions/clearance-cut-offset.mjs";
import { plateReferencePlaneOffsetDimension } from "./dimensions/plate-reference-plane-offset.mjs";
import { weldSizeDimension } from "./dimensions/weld-size.mjs";

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
  ["feature-plane-offset", featurePlaneOffsetDimension],
  ["plate-reference-plane-offset", plateReferencePlaneOffsetDimension],
  ["clearance-cut-offset", clearanceCutOffsetDimension],
  ["weld-size", weldSizeDimension]
]);

export function dimensionHandler(kind) {
  return handlers.get(kind) || null;
}

export function registerDimensionHandler(kind, handler) {
  if (!kind || typeof handler !== "function") return;
  handlers.set(kind, handler);
}
