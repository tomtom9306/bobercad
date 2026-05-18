import { basisAxis, closestHole, dimensionOffset, featureBasis, finite, makeDimension, positionPoint, roleObject, v } from "../dimension-context.mjs";

export function holeDiameterDimension(ctx, spec) {
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const position = pattern && basis ? closestHole(pattern) : null;
  const diameter = pattern?.holeDiameter;
  if (!position || !finite(diameter) || diameter <= 0) return null;
  const center = positionPoint(basis, position);
  const axis = basisAxis(basis, spec.reference.axis || "localAxisY");
  return makeDimension({
    ...ctx,
    spec,
    a: v.add(center, v.mul(axis, -diameter / 2)),
    b: v.add(center, v.mul(axis, diameter / 2)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: diameter
  });
}
