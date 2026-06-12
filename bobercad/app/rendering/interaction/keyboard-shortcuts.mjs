import { truthyValues } from "../../engine/core/model.mjs?v=truthy-values-dry-1";

function bindingList(binding) {
  if (Array.isArray(binding)) return binding;
  return [binding];
}

function normalizedKey(value) {
  return String(value || "").trim().toLowerCase();
}

function parseBinding(binding) {
  if (typeof binding !== "string") return null;
  const parts = truthyValues(binding.split("+").map((part) => part.trim()));
  if (!parts.length) return null;
  const key = parts.pop();
  const modifiers = {
    alt: false,
    ctrl: false,
    meta: false,
    shift: false,
    controlOrMeta: false
  };
  for (const part of parts) {
    const token = part.toLowerCase();
    if (token === "alt") modifiers.alt = true;
    else if (token === "ctrl" || token === "control") modifiers.ctrl = true;
    else if (token === "cmd" || token === "meta") modifiers.meta = true;
    else if (token === "shift") modifiers.shift = true;
    else if (token === "controlormeta" || token === "ctrlormeta") modifiers.controlOrMeta = true;
    else return null;
  }
  return { key: normalizedKey(key), modifiers };
}

function eventKey(event) {
  if (!event) return "";
  return normalizedKey(event.key);
}

function modifiersMatch(event, modifiers) {
  const controlOrMeta = Boolean(event.ctrlKey || event.metaKey);
  if (modifiers.controlOrMeta && !controlOrMeta) return false;
  if (!modifiers.controlOrMeta && Boolean(event.ctrlKey) !== modifiers.ctrl) return false;
  if (!modifiers.controlOrMeta && Boolean(event.metaKey) !== modifiers.meta) return false;
  return Boolean(event.altKey) === modifiers.alt && Boolean(event.shiftKey) === modifiers.shift;
}

function matchesOne(event, binding) {
  const parsed = parseBinding(binding);
  if (!parsed) return false;
  return eventKey(event) === parsed.key && modifiersMatch(event, parsed.modifiers);
}

export function isTextInput(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

export function matchesShortcut(event, binding) {
  return bindingList(binding).some((item) => matchesOne(event, item));
}

export function handleEscapeReset(event, reset) {
  if (event?.key !== "Escape") return false;
  reset();
  return true;
}

export function handleBackspaceOrEscape(event, onBackspace, reset) {
  if (event?.key === "Backspace") {
    onBackspace?.();
    return true;
  }
  return handleEscapeReset(event, reset);
}

export function shortcutSetting(scope, key, fallback = "") {
  return Object.prototype.hasOwnProperty.call(scope || {}, key) ? scope[key] : fallback;
}

export function shortcutLabel(binding, fallback = "") {
  const first = bindingList(binding).find((item) => typeof item === "string" && item.trim());
  if (!first) return fallback;
  return first.split("+").map((part) => {
    const token = part.trim();
    if (token.toLowerCase() === "escape") return "Esc";
    if (token.toLowerCase() === "control") return "Ctrl";
    return token;
  }).join("+");
}
