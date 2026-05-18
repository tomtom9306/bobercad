import { closestHole, dimensionOffset, featureBasis, finite, makeDimension, positionPoint, roleObject, v } from "../dimension-context.mjs";

export function fastenerLengthDimension(ctx, spec) {
  const group = roleObject(ctx.project, ctx.connection, spec.reference.fastenerRole);
  const pattern = roleObject(ctx.project, ctx.connection, spec.reference.holePatternRole);
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const basis = featureBasis(ctx.project, feature);
  const position = pattern && basis ? closestHole(pattern) : null;
  const length = group?.assembly?.length;
  if (!group || !position || !finite(length) || length <= 0) return null;
  const axis = Array.isArray(group.orientation?.axis) ? v.norm(group.orientation.axis) : basis.normal;
  const start = positionPoint(basis, position);
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: v.add(start, v.mul(axis, length)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: length
  });
}
