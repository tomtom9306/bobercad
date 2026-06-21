import { clearanceCutGeometry } from "../../../engine/geometry/cut-features.mjs";
import { arrayValues } from "../../../engine/core/model.mjs";
import { requiredReferencePlane } from "../../../engine/geometry/reference-plane.mjs";
import { trimOperationFirstReferencePlaneId, trimPlaneOperation } from "../../../engine/api/project/trim-operations.mjs";
import {
  clearanceAnnotationBasis,
  dimensionOffset,
  featureBasis,
  makeNote,
  paramValue,
  parameterLabel,
  rangeMid,
  roleObject,
  v
} from "../dimension-geometry-and-label-context.mjs";

const EPSILON = 1e-9;

function optionLabel(spec, value) {
  const stringValue = String(value);
  const valueLabels = spec.reference?.valueLabels || {};
  if (valueLabels[stringValue]) return valueLabels[stringValue];
  const option = arrayValues(spec.reference?.modeControl?.options)
    .find((item) => String(item.value) === stringValue);
  return option?.label || stringValue;
}

function planePlacement(plane) {
  if (!Array.isArray(plane?.origin) || !Array.isArray(plane?.normal) || !Array.isArray(plane?.axisX) || !Array.isArray(plane?.axisY)) return null;
  const normal = v.norm(plane.normal);
  const localAxisY = v.norm(plane.axisX);
  let localAxisZ = plane.axisY;
  if (v.len(localAxisZ) <= EPSILON) return null;
  return {
    basis: {
      origin: plane.origin,
      normal,
      localAxisY,
      localAxisZ: v.norm(localAxisZ)
    },
    anchor: plane.origin
  };
}

function clearanceFeaturePlacement(ctx, feature) {
  if (feature?.kind !== "support-flange-notch") return null;
  const geometry = clearanceCutGeometry(ctx.project, ctx.profiles, feature);
  if (!geometry) return null;
  const anchor = geometry.pointAt(
    rangeMid(geometry.ranges, "x"),
    rangeMid(geometry.ranges, "y"),
    rangeMid(geometry.ranges, "z")
  );
  return {
    basis: clearanceAnnotationBasis(geometry),
    anchor
  };
}

function featurePlacement(ctx, feature) {
  const placement = clearanceFeaturePlacement(ctx, feature);
  if (placement) return placement;
  const basis = featureBasis(ctx.project, feature);
  return basis ? { basis, anchor: basis.origin } : null;
}

function optionCalloutDimension(ctx, spec, placement) {
  if (!placement) return null;
  const value = paramValue(ctx.definition, ctx.smartComponent, spec.parameter);
  const label = spec.reference?.showLabel === false
    ? optionLabel(spec, value)
    : `${spec.label || parameterLabel(ctx.definition, spec.parameter)}: ${optionLabel(spec, value)}`;
  const point = v.add(
    placement.anchor,
    dimensionOffset(ctx, placement.basis, spec.reference.offset || {}, { clampNormal: false })
  );
  return makeNote({
    ...ctx,
    spec,
    anchor: placement.anchor,
    point,
    textValue: label,
    displayTextValue: label,
    titleValue: parameterLabel(ctx.definition, spec.parameter),
    labelAxis: spec.reference.labelAxis || undefined
  });
}

export function featureOptionCalloutDimension(ctx, spec) {
  return optionCalloutDimension(ctx, spec, featurePlacement(ctx, roleObject(ctx.project, ctx.smartComponent, spec.reference.featureRole)));
}

export function trimOptionCalloutDimension(ctx, spec) {
  const trimJoint = roleObject(ctx.project, ctx.smartComponent, spec.reference.trimRole);
  const operation = trimPlaneOperation(trimJoint);
  const plane = operation ? requiredReferencePlane(ctx.project, trimOperationFirstReferencePlaneId(operation), trimJoint.id, () => null) : null;
  return optionCalloutDimension(ctx, spec, planePlacement(plane));
}
