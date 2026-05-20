function line(points, color, meta = {}) {
  return { points, color, collection: "authoring", ...meta };
}

export function snapOverlay(snap, rawPoint = null, settings = {}) {
  if (!snap?.point) return { lines: [], handles: [], labels: [] };
  const color = settings.snapColor || "#38bdf8";
  const lines = [];
  if (rawPoint) lines.push(line([rawPoint, snap.point], color, { kind: "snap-link" }));
  return {
    lines,
    handles: [{ kind: "snap", point: snap.point, color, radius: settings.snapRadius || 11 }],
    labels: [{
      point: snap.point,
      text: snap.label || snap.type || "Snap",
      color,
      className: "snap"
    }]
  };
}
