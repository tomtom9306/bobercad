import { basisAxis, dimensionOffset, interfaceByRole, makeDimension, plateBasis, pointToPlane, roleObject, v } from "../dimension-context.mjs";

export function plateReferencePlaneOffsetDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.smartComponent, spec.reference.objectRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.smartComponent, spec.reference.interfaceRole);
  if (!plate || !iface) return null;

  const basis = plateBasis(plate);
  const axis = basisAxis(basis, spec.reference.axis || "normal");
  if (v.len(axis) <= 1e-6) return null;

  const unit = v.norm(axis);
  const start = pointToPlane(plate.center, iface.origin, unit);
  const measured = Math.abs(v.dot(v.sub(plate.center, start), unit));
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: plate.center,
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured
  });
}
