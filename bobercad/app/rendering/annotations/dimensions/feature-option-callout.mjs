import { clearanceCutGeometry } from "../../../engine/geometry/cut-features.mjs";
import { memberFrameAt, memberLength } from "../../../engine/geometry/member-geometry.mjs";
import { objectById } from "../../../engine/core/model.mjs";
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

function planeFeaturePlacement(feature) {
  const plane = feature?.plane;
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

function memberTrimPlacement(ctx, feature) {
  if (!feature?.trim || !feature.ownerId) return null;
  if (!ctx.project.objectIndex?.[feature.ownerId]) return null;
  const member = objectById(ctx.project, feature.ownerId);
  if (!member) return null;
  const station = feature.memberEnd === "start" ? 0 : memberLength(member);
  const frame = memberFrameAt(member, station);
  const inward = feature.memberEnd === "start" ? frame.x : v.mul(frame.x, -1);
  return {
    basis: {
      origin: feature.trim.jointPoint || frame.origin,
      normal: frame.y,
      localAxisY: inward,
      localAxisZ: frame.z
    },
    anchor: feature.trim.jointPoint || frame.origin
  };
}

function featurePlacement(ctx, feature) {
  const placement = planeFeaturePlacement(feature)
    || clearanceFeaturePlacement(ctx, feature)
    || memberTrimPlacement(ctx, feature);
  if (placement) return placement;
  const basis = featureBasis(ctx.project, feature);
  return basis ? { basis, anchor: basis.origin } : null;
}

export function featureOptionCalloutDimension(ctx, spec) {
  const feature = roleObject(ctx.project, ctx.connection, spec.reference.featureRole);
  const placement = featurePlacement(ctx, feature);
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
