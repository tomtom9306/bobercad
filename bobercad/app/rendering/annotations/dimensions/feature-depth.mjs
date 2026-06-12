import { dimensionOffset, featureBasis, finite, makeDimension, roleObject, v } from "../dimension-context.mjs?v=unified-dimension-overlay-1";

export function featureDepthDimension(ctx, spec) {
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const depth = feature?.depth;
  if (!basis || !finite(depth) || depth <= 0) return null;
  return makeDimension({
    ...ctx,
    spec,
    a: basis.origin,
    b: v.add(basis.origin, v.mul(basis.normal, depth)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: depth
  });
}
