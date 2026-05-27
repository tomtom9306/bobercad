const WORLD_AXES = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1]
};

const DEFAULT_AXIS_COLORS = {
  x: "#dc2626",
  y: "#16a34a",
  z: "#2563eb"
};

function axisColors(settings = {}) {
  return {
    x: settings.xColor || DEFAULT_AXIS_COLORS.x,
    y: settings.yColor || DEFAULT_AXIS_COLORS.y,
    z: settings.zColor || DEFAULT_AXIS_COLORS.z
  };
}

function axisEntriesForTarget(target, settings = {}) {
  const configured = settings.coordinateAxesByTarget?.[target] || settings.coordinateAxes;
  return Object.entries(configured || WORLD_AXES).map(([axisId, value]) => {
    const spec = Array.isArray(value) ? { axis: value } : value;
    return {
      axisId,
      axis: spec.axis || WORLD_AXES[axisId],
      axisLabel: spec.axisLabel || axisId.toUpperCase(),
      coordinateSpace: spec.coordinateSpace || settings.coordinateSpace || "global",
      spaceLabel: spec.spaceLabel || (settings.coordinateSpace === "local" ? "Local" : "Global")
    };
  });
}

function handleBase(memberId, target, point, settings = {}) {
  return {
    type: "hub",
    memberId,
    target,
    kind: target === "center" ? "move-member" : `physical-${target}`,
    point,
    color: settings.hubColor || "#0f172a",
    radius: settings.hubRadiusPx || 8
  };
}

function translationAxisHandles(memberId, target, point, settings = {}) {
  const colors = axisColors(settings);
  return axisEntriesForTarget(target, settings).map(({ axisId, axis, axisLabel, coordinateSpace, spaceLabel }) => ({
    type: "axis",
    memberId,
    target,
    kind: "translate-axis",
    axisId,
    axis,
    axisLabel,
    coordinateSpace,
    spaceLabel,
    point,
    color: colors[axisId],
    axisLengthPx: settings.axisLengthPx || 58,
    arrowHeadPx: settings.arrowHeadPx || 9,
    axisStartOffsetPx: settings.axisStartOffsetPx || 0,
    hitTolerancePx: settings.hitTolerancePx || 10
  }));
}

function rotationAxisHandles(memberId, target, point, settings = {}) {
  const colors = axisColors(settings);
  const axisLength = settings.axisLengthPx || 58;
  const axisStartOffset = settings.axisStartOffsetPx || 0;
  const baseRadius = settings.ringRadiusPx || 40;
  const gap = settings.ringGapPx || 8;
  const centerOffset = settings.ringCenterOffsetPx ?? (axisStartOffset + axisLength) / 2;
  return axisEntriesForTarget(target, settings).map(({ axisId, axis, axisLabel, coordinateSpace, spaceLabel }, index) => ({
    type: "rotation-ring",
    memberId,
    target,
    kind: "rotate-axis",
    axisId,
    axis,
    axisLabel,
    coordinateSpace,
    spaceLabel,
    point,
    color: colors[axisId],
    axisLengthPx: axisLength,
    axisStartOffsetPx: axisStartOffset,
    ringCenterOffsetPx: centerOffset,
    radiusPx: baseRadius + index * gap,
    arrowHeadPx: settings.ringArrowHeadPx || 6,
    hitTolerancePx: settings.hitTolerancePx || 10
  }));
}

function spaceToggleHandle(memberId, point, settings = {}) {
  const coordinateSpace = settings.coordinateSpace === "local" ? "local" : "global";
  const nextSpace = coordinateSpace === "local" ? "global" : "local";
  return {
    type: "space-toggle",
    memberId,
    target: "center",
    kind: "coordinate-space-toggle",
    point,
    color: coordinateSpace === "local" ? "#0f766e" : "#475569",
    radius: settings.spaceToggleRadiusPx || 10,
    screenOffsetPx: settings.spaceToggleOffsetPx || { x: -30, y: -30 },
    coordinateSpace,
    nextCoordinateSpace: nextSpace,
    text: coordinateSpace === "local" ? "L" : "G",
    hoverLabel: coordinateSpace === "local" ? "Switch to Global axes" : "Switch to Local axes"
  };
}

export function memberManipulatorHandles(memberId, points, settings = {}) {
  if (settings.visible === false) return [];
  const anchors = [
    { target: "start", point: points.physicalStart },
    { target: "center", point: points.center },
    { target: "end", point: points.physicalEnd }
  ];
  return anchors.flatMap(({ target, point }) => [
    handleBase(memberId, target, point, settings),
    ...(target === "center" && settings.showSpaceToggle !== false ? [spaceToggleHandle(memberId, point, settings)] : []),
    ...translationAxisHandles(memberId, target, point, settings),
    ...rotationAxisHandles(memberId, target, point, settings)
  ]);
}
