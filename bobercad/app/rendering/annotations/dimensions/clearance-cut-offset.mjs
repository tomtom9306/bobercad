import { clearanceCutGeometry } from "../../../engine/geometry/cut-features.mjs";
import { clearanceAnnotationBasis, dimensionOffset, rangeMid, roleObject, spacingDimension } from "../dimension-context.mjs";

export function clearanceCutOffsetDimension(ctx, spec) {
  const feature = roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole);
  if (!feature || feature.operationEnabled === false) return null;
  const geometry = clearanceCutGeometry(ctx.project, ctx.profiles, feature);
  if (!geometry) return null;

  const key = spec.reference.offsetKey;
  const axes = {
    xMinus: { axis: "x", side: "Min" },
    xPlus: { axis: "x", side: "Max" },
    yMinus: { axis: "y", side: "Min" },
    yPlus: { axis: "y", side: "Max" },
    zMinus: { axis: "z", side: "Min" },
    zPlus: { axis: "z", side: "Max" }
  };
  const info = axes[key];
  if (!info) return null;

  const coord = {
    x: rangeMid(geometry.baseRanges, "x"),
    y: rangeMid(geometry.baseRanges, "y"),
    z: rangeMid(geometry.baseRanges, "z")
  };
  const rangeKey = `${info.axis}${info.side}`;
  const measured = Math.abs(geometry.ranges[rangeKey] - geometry.baseRanges[rangeKey]);
  coord[info.axis] = geometry.baseRanges[rangeKey];
  const a = geometry.pointAt(coord.x, coord.y, coord.z);
  coord[info.axis] = geometry.ranges[rangeKey];
  const b = geometry.pointAt(coord.x, coord.y, coord.z);
  const basis = clearanceAnnotationBasis(geometry);

  return spacingDimension(ctx, {
    spec,
    a,
    b,
    offset: dimensionOffset(ctx, basis, spec.reference.offset),
    measured
  });
}
