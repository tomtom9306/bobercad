import { arrayValues } from "../../engine/core/model.mjs?v=smart-config-array-values-dry-1";
import { finite, combine, truthyValues, v } from "./dimension-context.mjs?v=unified-dimension-overlay-1";
import { dimensionHandler } from "./dimension-registry.mjs?v=unified-dimension-overlay-1";

function buildOne(ctx, spec) {
  const activePaths = truthyValues([spec.parameter, spec.reference?.customParameter]);
  const active = activePaths.includes(ctx.activeParameterPath);
  const nextCtx = {
    ...ctx,
    active,
    activeMode: active ? ctx.activeParameterMode : null,
    activeEditing: active && ctx.activeParameterEditing
  };
  return dimensionHandler(spec.reference?.kind)?.(nextCtx, spec) || null;
}

function offsetLine(line, offset) {
  const placementOffset = finite(offset) ? offset : 0;
  const baseLine = { ...line, placementOffset };
  if (Math.abs(placementOffset) <= 1e-6 || !Array.isArray(line?.labelUpAxis)) return baseLine;
  const delta = v.mul(v.norm(line.labelUpAxis), placementOffset);
  const movesExtensionPointOnly = String(line.kind || "").endsWith("-extension");
  return {
    ...baseLine,
    points: arrayValues(line.points).map((point, index) => (
      movesExtensionPointOnly && index === 0 ? point : v.add(point, delta)
    )),
    dimensionStart: Array.isArray(line.dimensionStart) ? v.add(line.dimensionStart, delta) : line.dimensionStart,
    dimensionEnd: Array.isArray(line.dimensionEnd) ? v.add(line.dimensionEnd, delta) : line.dimensionEnd
  };
}

function offsetLabel(label, offset) {
  const placementOffset = finite(offset) ? offset : 0;
  const baseLabel = { ...label, placementOffset };
  if (Math.abs(placementOffset) <= 1e-6 || !Array.isArray(label?.labelUpAxis)) return baseLabel;
  const delta = v.mul(v.norm(label.labelUpAxis), placementOffset);
  return {
    ...baseLabel,
    point: Array.isArray(label.point) ? v.add(label.point, delta) : label.point,
    labelLine: Array.isArray(label.labelLine)
      ? label.labelLine.map((point) => v.add(point, delta))
      : label.labelLine,
    dimensionStart: Array.isArray(label.dimensionStart) ? v.add(label.dimensionStart, delta) : label.dimensionStart,
    dimensionEnd: Array.isArray(label.dimensionEnd) ? v.add(label.dimensionEnd, delta) : label.dimensionEnd
  };
}

function applyPlacementOffsets(overlay, offsets = {}) {
  const placementOffsets = offsets && typeof offsets === "object" ? offsets : {};
  const offsetFor = (item) => finite(placementOffsets[item?.dimensionId]) ? placementOffsets[item.dimensionId] : 0;
  return {
    lines: arrayValues(overlay.lines).map((line) => offsetLine(line, offsetFor(line))),
    labels: arrayValues(overlay.labels).map((label) => offsetLabel(label, offsetFor(label)))
  };
}

export function buildSmartComponentDimensions({ project, profiles, definition, smartComponentId, activeParameterPath = null, activeDimensionId = null, activeParameterMode = "select", activeParameterEditing = false, dimensionSettings = null, dimensionPlacementOffsets = null }) {
  const smartComponent = project.model.smartComponentInstances?.[smartComponentId];
  if (!smartComponent || smartComponent.status !== "generated") return { lines: [], labels: [] };
  const ctx = { project, profiles, definition, smartComponent, activeParameterPath, activeDimensionId, activeParameterMode, activeParameterEditing, dimensionSettings: dimensionSettings || {}, dimensionPlacementOffsets: dimensionPlacementOffsets || {} };
  return applyPlacementOffsets(
    combine(arrayValues(definition.dimensions).map((spec) => buildOne(ctx, spec))),
    dimensionPlacementOffsets
  );
}
