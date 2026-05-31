import { clearanceCutGeometry } from "../../../engine/geometry/cut-features.mjs";
import { requiredReferencePlane } from "../../../engine/geometry/feature-plane.mjs";
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
} from "../dimension-context.mjs";

const EPSILON = 1e-9;

function optionLabel(spec, value) {
  const stringValue = String(value);
  const valueLabels = spec.reference?.valueLabels || {};
  if (valueLabels[stringValue]) return valueLabels[stringValue];
  const option = (spec.reference?.modeControl?.options || [])
    .find((item) => String(item.value) === stringValue);
  return option?.label || stringValue;
}

function planePlacement(plane) {
  if (!Array.isArray(plane?.origin) || !Array.isArray(plane?.normal)) return null;
  const normal = v.norm(plane.normal);
  const localAxisY = v.norm(plane.axisX || plane.localAxisY || [1, 0, 0]);
  let localAxisZ = plane.axisY || plane.localAxisZ || v.cross(normal, localAxisY);
  if (v.len(localAxisZ) <= EPSILON) localAxisZ = [0, 0, 1];
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

function trimPlaneOperation(trimJoint) {
  return (trimJoint?.operations || []).find((operation) => operation.type === "plane-trim" && operation.referencePlaneIds?.length) || null;
}

function clearanceFeaturePlacement(ctx, feature) {
  if (feature?.kind !== "support-flange-notch" && feature?.cut?.kind !== "support-flange-notch") return null;
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
  const value = paramValue(ctx.definition, ctx.connection, spec.parameter);
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
  return optionCalloutDimension(ctx, spec, featurePlacement(ctx, roleObject(ctx.project, ctx.connection, spec.reference.featureRole)));
}

export function trimOptionCalloutDimension(ctx, spec) {
  const trimJoint = roleObject(ctx.project, ctx.connection, spec.reference.trimRole);
  const operation = trimPlaneOperation(trimJoint);
  const plane = operation ? requiredReferencePlane(ctx.project, operation.referencePlaneIds[0], trimJoint.id, () => null) : null;
  return optionCalloutDimension(ctx, spec, planePlacement(plane));
}
