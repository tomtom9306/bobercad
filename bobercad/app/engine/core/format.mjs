import { finiteInteger, finiteNumber } from "./math.mjs?v=integer-number-dry-1";

export function formatNumber(value, options = {}) {
  if (!finiteNumber(value)) return options.invalid ?? "";
  const digits = finiteInteger(options.digits) ? Math.max(0, options.digits) : 2;
  const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
  if (finiteInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(digits);
  return options.trimTrailingZeros
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;
}
