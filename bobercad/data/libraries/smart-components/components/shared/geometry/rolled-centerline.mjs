import { normalizePath } from "../../../../../../app/engine/api/geometry/paths.mjs?v=path-segment-parameter-dry-1";

export function rolledCenterline(sourcePath, lateralOffset = 0, options = {}) {
  if (!sourcePath || !["arc", "helix", "spiral"].includes(sourcePath.type)) return null;
  const radius = (sourcePath.radius || 0) - lateralOffset;
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const sweep = (sourcePath.endAngle || 0) - (sourcePath.startAngle || 0);
  const sourceHeight = sourcePath.type === "helix" || sourcePath.type === "spiral" ? sourcePath.height || 0 : 0;
  const height = Number.isFinite(options.height) ? options.height : sourceHeight;
  const verticalOffset = Number.isFinite(options.verticalOffset) ? options.verticalOffset : 0;
  const center = [
    sourcePath.center?.[0] || 0,
    sourcePath.center?.[1] || 0,
    (sourcePath.center?.[2] || 0) + verticalOffset
  ];
  return {
    ...sourcePath,
    type: height ? "helix" : "arc",
    center,
    radius,
    height,
    axisZ: sourcePath.axisZ || [0, 0, 1],
    representation: "analytic-centerline",
    math: {
      family: height ? "circular-helix" : "circular-arc",
      parameter: "t in [0,1]",
      equation: height
        ? "P(t)=center + axisX*cos(startAngle+sweep*t)*radius + axisY*sin(startAngle+sweep*t)*radius + axisZ*height*t"
        : "P(t)=center + axisX*cos(startAngle+sweep*t)*radius + axisY*sin(startAngle+sweep*t)*radius",
      radius,
      startAngle: sourcePath.startAngle || 0,
      endAngle: sourcePath.endAngle,
      sweep,
      height,
      axisX: sourcePath.axisX || [1, 0, 0],
      axisY: sourcePath.axisY || [0, 1, 0],
      axisZ: sourcePath.axisZ || [0, 0, 1],
      lateralOffset,
      verticalOffset
    }
  };
}

export function centerlineEndpoints(centerline) {
  const path = normalizePath(centerline);
  return {
    path,
    start: path.segments[0].pointAt(0),
    end: path.segments[path.segments.length - 1].pointAt(path.segments[path.segments.length - 1].length)
  };
}
