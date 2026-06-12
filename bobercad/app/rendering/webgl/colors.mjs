const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex, fallback = [0, 0, 0]) {
  if (typeof hex !== "string" || !HEX_COLOR.test(hex)) return fallback;
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

export function hexToRgba(color, opacity = 1, fallback = [0, 0, 0]) {
  const rgb = hexToRgb(color, fallback);
  return [rgb[0], rgb[1], rgb[2], Math.round(255 * opacity)];
}

export function safeHexColor(value, fallback) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}
