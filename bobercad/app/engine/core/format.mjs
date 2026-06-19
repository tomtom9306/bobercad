import { finiteInteger, finiteNumber } from "./math.mjs";

export function formatNumber(value, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("format: options must be an object");
  if (options.digits !== undefined && (!finiteInteger(options.digits) || options.digits < 0)) throw new Error("format: options.digits must be a non-negative integer");
  if (options.trimTrailingZeros !== undefined && typeof options.trimTrailingZeros !== "boolean") throw new Error("format: options.trimTrailingZeros must be boolean");
  if (options.invalid !== undefined && typeof options.invalid !== "string") throw new Error("format: options.invalid must be a string");
  if (!finiteNumber(value)) return options.invalid ?? "";
  const digits = options.digits ?? 2;
  const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
  if (finiteInteger(rounded)) return String(rounded);
  const fixed = rounded.toFixed(digits);
  return options.trimTrailingZeros
    ? fixed.replace(/0+$/, "").replace(/\.$/, "")
    : fixed;
}
