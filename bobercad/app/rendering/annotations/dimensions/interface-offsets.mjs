import { requiredReferencePlane } from "../../../engine/geometry/feature-plane.mjs";
import { dimensionOffset, distance, finite, interfaceAnnotationBasis, interfaceAxis, interfaceByRole, linePlane, makeDimension, paramValue, plateBasis, pointToPlane, roleObject, v } from "../dimension-context.mjs";

export function interfaceOffsetDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const value = paramValue(ctx.definition, ctx.connection, spec.parameter);
  if (!plate || !iface || !finite(value) || value <= 0) return null;
  const basis = plateBasis(plate);
  const axis = interfaceAxis(iface, plate);
  const start = pointToPlane(plate.center, iface.origin, axis);
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: v.add(start, v.mul(axis, value)),
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured: value
  });
}



function trimPlane(trimJoint) {
  return (trimJoint?.operations || []).find((operation) => operation.type === "plane-trim" && operation.referencePlaneIds?.length) || null;
}

export function trimPlaneOffsetDimension(ctx, spec) {
  const plate = roleObject(ctx.project, ctx.connection, spec.reference.objectRole);
  const trimJoint = roleObject(ctx.project, ctx.connection, spec.reference.trimRole);
  const iface = interfaceByRole(ctx.project, ctx.profiles, ctx.definition, ctx.connection, spec.reference.interfaceRole);
  const operation = trimPlane(trimJoint);
  if (!plate || !operation || !iface) return null;
  const plane = requiredReferencePlane(ctx.project, operation.referencePlaneIds[0], trimJoint.id, () => null);
  if (!plane) return null;
  const offsetBasis = interfaceAnnotationBasis(plate, iface);
  const axis = interfaceAxis(iface, plate);
  const start = pointToPlane(plate.center, iface.origin, axis);
  const end = linePlane(start, axis, plane.origin, plane.normal);
  if (!end) return null;
  return makeDimension({
    ...ctx,
    spec,
    a: start,
    b: end,
    offset: dimensionOffset(ctx, offsetBasis, spec.reference.offset),
    measured: distance(start, end)
  });
}
