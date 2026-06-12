const EPSILON = 1e-9;

export const SNAP_STRENGTHS = Object.freeze(["off", "light", "normal", "strong", "training"]);

const DEFAULT_PROFILES = Object.freeze({
  off: {
    enabled: false,
    screenTolerancePx: 0,
    intersectionTolerancePx: 0,
    pointBiasPx: 0,
    intersectionBiasPx: 0,
    projectionBiasPx: 0,
    axisBiasPx: 0,
    maxIntersectionSources: 0,
    gridMaxStep: 0,
    gridMaxSteps: { fine: 0, micro: 0 },
    sketchWorldTolerance: { edge: 0, relation: 0, angle: 0, equalLength: 0 },
    showLabels: false,
    includeSurfaceTargets: false
  },
  light: {
    enabled: true,
    screenTolerancePx: 8,
    intersectionTolerancePx: 10,
    pointBiasPx: 8,
    intersectionBiasPx: 6,
    projectionBiasPx: 2,
    axisBiasPx: 4,
    maxIntersectionSources: 24,
    gridMaxStep: 5,
    gridMaxSteps: { fine: 0.5, micro: 0.25 },
    sketchWorldTolerance: { edge: 6, relation: 5, angle: 8, equalLength: 12 },
    showLabels: false,
    includeSurfaceTargets: "corners"
  },
  normal: {
    enabled: true,
    screenTolerancePx: 16,
    intersectionTolerancePx: 22,
    pointBiasPx: 12,
    intersectionBiasPx: 10,
    projectionBiasPx: 5,
    axisBiasPx: 10,
    maxIntersectionSources: 48,
    gridMaxStep: 10,
    gridMaxSteps: { fine: 1, micro: 0.5 },
    sketchWorldTolerance: { edge: 10, relation: 8, angle: 12, equalLength: 20 },
    showLabels: true,
    includeSurfaceTargets: "faces"
  },
  strong: {
    enabled: true,
    screenTolerancePx: 28,
    intersectionTolerancePx: 36,
    pointBiasPx: 16,
    intersectionBiasPx: 14,
    projectionBiasPx: 8,
    axisBiasPx: 14,
    maxIntersectionSources: 64,
    gridMaxStep: 25,
    gridMaxSteps: { fine: 2, micro: 1 },
    sketchWorldTolerance: { edge: 16, relation: 12, angle: 18, equalLength: 28 },
    showLabels: true,
    includeSurfaceTargets: "faces"
  },
  training: {
    enabled: true,
    screenTolerancePx: 34,
    intersectionTolerancePx: 42,
    pointBiasPx: 18,
    intersectionBiasPx: 16,
    projectionBiasPx: 10,
    axisBiasPx: 16,
    maxIntersectionSources: 64,
    gridMaxStep: 50,
    gridMaxSteps: { fine: 5, micro: 2 },
    sketchWorldTolerance: { edge: 20, relation: 16, angle: 24, equalLength: 36 },
    showLabels: true,
    includeSurfaceTargets: "faces"
  }
});

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > EPSILON ? number : fallback;
}

function finiteNonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizedStrength(value, fallback = "normal") {
  const strength = String(value || fallback).toLowerCase();
  return SNAP_STRENGTHS.includes(strength) ? strength : fallback;
}

function normalizedSurfaceTargets(value, fallback) {
  if (value === false || value === "corners" || value === "edges" || value === "faces") return value;
  return fallback;
}

function positiveMap(override = {}, base = {}) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = finiteNonNegative(value, result[key]);
  }
  return result;
}

function profileOverride(base, override = {}) {
  return {
    ...base,
    ...override,
    enabled: override.enabled === undefined ? base.enabled : Boolean(override.enabled),
    screenTolerancePx: finiteNonNegative(override.screenTolerancePx, base.screenTolerancePx),
    intersectionTolerancePx: finiteNonNegative(override.intersectionTolerancePx, base.intersectionTolerancePx),
    pointBiasPx: finiteNonNegative(override.pointBiasPx, base.pointBiasPx),
    intersectionBiasPx: finiteNonNegative(override.intersectionBiasPx, base.intersectionBiasPx),
    projectionBiasPx: finiteNonNegative(override.projectionBiasPx, base.projectionBiasPx),
    axisBiasPx: finiteNonNegative(override.axisBiasPx, base.axisBiasPx),
    maxIntersectionSources: finiteNonNegative(override.maxIntersectionSources, base.maxIntersectionSources),
    gridMaxStep: finiteNonNegative(override.gridMaxStep, base.gridMaxStep),
    gridMaxSteps: positiveMap(override.gridMaxSteps, base.gridMaxSteps),
    sketchWorldTolerance: positiveMap(override.sketchWorldTolerance, base.sketchWorldTolerance),
    showLabels: override.showLabels === undefined ? base.showLabels : Boolean(override.showLabels),
    includeSurfaceTargets: normalizedSurfaceTargets(override.includeSurfaceTargets, base.includeSurfaceTargets)
  };
}

export function snapSettingsFromAuthoring(authoring = {}) {
  const raw = authoring.snap || {};
  const strength = normalizedStrength(raw.strength, "normal");
  const profiles = {};
  for (const key of SNAP_STRENGTHS) {
    profiles[key] = profileOverride(DEFAULT_PROFILES[key], raw.profiles?.[key]);
  }
  const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
  return {
    enabled,
    strength: enabled ? strength : "off",
    scopeMode: raw.scopeMode === "manual" ? "manual" : "smart",
    holdToDisableKey: raw.holdToDisableKey || "Alt",
    cycleKey: raw.cycleKey || "Tab",
    profiles,
    scope: raw.scope || {}
  };
}

export function snapProfile(authoring = {}, options = {}) {
  const settings = snapSettingsFromAuthoring(authoring);
  const disabledByEvent = options.event?.altKey && settings.holdToDisableKey === "Alt";
  const strength = disabledByEvent ? "off" : normalizedStrength(options.strength || settings.strength, settings.strength);
  const profile = settings.profiles[strength] || settings.profiles.normal;
  return {
    ...profile,
    strength,
    enabled: settings.enabled && profile.enabled && strength !== "off",
    scopeMode: settings.scopeMode,
    holdToDisableKey: settings.holdToDisableKey,
    cycleKey: settings.cycleKey
  };
}

export function adaptiveSnapGridStep(scale, authoring = {}, options = {}) {
  const profile = snapProfile(authoring, options);
  if (!profile.enabled) return 0;
  const steps = Array.isArray(authoring.snap?.gridSteps)
    ? authoring.snap.gridSteps
    : [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50];
  const clean = [...new Set(steps
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > EPSILON))]
    .sort((left, right) => left - right);
  if (!clean.length) return 0;
  const screenScale = Number.isFinite(scale) && scale > EPSILON ? scale : 1;
  const minScreenPx = finitePositive(authoring.snap?.gridMinScreenPx, 0.35);
  let index = clean.findIndex((step) => step * screenScale >= minScreenPx);
  if (index < 0) index = clean.length - 1;
  if (authoring.snap?.gridUseSpeedBoost === true) {
    const speedPx = Number.isFinite(options.speedPx) ? options.speedPx : 0;
    const fastPx = finitePositive(authoring.snap?.gridFastMovePx, 360);
    const veryFastPx = finitePositive(authoring.snap?.gridVeryFastMovePx, 720);
    const boost = speedPx >= veryFastPx ? 2 : speedPx >= fastPx ? 1 : 0;
    index = Math.min(index + boost, clean.length - 1);
  }
  const precision = options.gridPrecision || options.precision || "default";
  const profileMaxStep = finitePositive(profile.gridMaxSteps?.[precision], profile.gridMaxStep);
  const maxStep = finitePositive(options.maxStep, finitePositive(profileMaxStep, clean[index]));
  const minStep = finitePositive(options.minStep, 0);
  return Math.max(minStep, Math.min(clean[index], maxStep));
}

function handleDirectionScale(handle, direction) {
  const axisY = handle?.dragAxesScreen?.x;
  const axisZ = handle?.dragAxesScreen?.y;
  if (!axisY || !axisZ) return 1;
  const y = { x: axisY.unit.x * axisY.scalePxPerWorld, y: axisY.unit.y * axisY.scalePxPerWorld };
  const z = { x: axisZ.unit.x * axisZ.scalePxPerWorld, y: axisZ.unit.y * axisZ.scalePxPerWorld };
  return Math.max(Math.hypot(y.x * direction[0] + z.x * direction[1], y.y * direction[0] + z.y * direction[1]), EPSILON);
}

function handleAverageScale(handle) {
  const axisY = handle?.dragAxesScreen?.x;
  const axisZ = handle?.dragAxesScreen?.y;
  if (!axisY || !axisZ) return 1;
  return Math.max((axisY.scalePxPerWorld + axisZ.scalePxPerWorld) / 2, EPSILON);
}

export function adaptiveSnapGridStepForHandle(handle, authoring = {}, options = {}) {
  const scale = options.direction
    ? handleDirectionScale(handle, options.direction)
    : handleAverageScale(handle);
  return adaptiveSnapGridStep(scale, authoring, options);
}

export function snapScalarToGrid(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= EPSILON) return value;
  return Math.round(value / step) * step;
}

export function snapSketchWorldTolerance(authoring = {}, key, fallback = 0, options = {}) {
  const profile = snapProfile(authoring, options);
  return finitePositive(profile.sketchWorldTolerance?.[key], fallback);
}

export function snapProfileDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILES));
}
