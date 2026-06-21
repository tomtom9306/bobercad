export const SKETCH_UNDER_DEFINED_COLOR = "#2563eb";
export const SKETCH_FULLY_DEFINED_COLOR = "#111827";
export const SKETCH_CONFLICT_COLOR = "#dc2626";

export function relationHealthStatus(health) {
  if (health?.status === "driven") return "reference";
  return health?.status || "ok";
}

export function sketchStatusColor(status) {
  if (status === "fully-defined") return SKETCH_FULLY_DEFINED_COLOR;
  if (status === "under-defined") return SKETCH_UNDER_DEFINED_COLOR;
  return SKETCH_CONFLICT_COLOR;
}

export function sketchEntityColor(definition, fallbackColor) {
  if (typeof definition === "string") return sketchStatusColor(definition);
  if (definition?.status) return sketchStatusColor(definition.status);
  return fallbackColor || SKETCH_UNDER_DEFINED_COLOR;
}

export function relationHealthColor(health, fallbackColor) {
  if (health?.status === "conflicted") return SKETCH_CONFLICT_COLOR;
  if (health?.status === "redundant") return "#d97706";
  if (health?.status === "driven") return "#64748b";
  return fallbackColor;
}

export function relationHealthClass(health) {
  if (!health?.status || health.status === "ok") return "";
  return health.status === "driven" ? " reference" : ` ${health.status}`;
}
