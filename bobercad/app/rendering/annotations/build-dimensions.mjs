import { combine } from "./dimension-context.mjs";
import { dimensionHandler } from "./dimension-registry.mjs?v=reference-plane-1";

function buildOne(ctx, spec) {
  const activePaths = [spec.parameter, spec.reference?.customParameter].filter(Boolean);
  const active = activePaths.includes(ctx.activeParameterPath);
  const nextCtx = { ...ctx, active, activeMode: active ? ctx.activeParameterMode : null, activeEditing: active && ctx.activeParameterEditing };
  return dimensionHandler(spec.reference?.kind)?.(nextCtx, spec) || null;
}

export function buildSmartComponentDimensions({ project, profiles, definition, smartComponentId, activeParameterPath = null, activeDimensionId = null, activeParameterMode = "select", activeParameterEditing = false, dimensionSettings = null }) {
  const smartComponent = project.model.smartComponentInstances?.[smartComponentId];
  if (!smartComponent || smartComponent.status !== "generated") return { lines: [], labels: [] };
  const ctx = { project, profiles, definition, smartComponent, activeParameterPath, activeDimensionId, activeParameterMode, activeParameterEditing, dimensionSettings: dimensionSettings || {} };
  return combine((definition.dimensions || []).map((spec) => buildOne(ctx, spec)));
}
