import { commandGroupSpec } from "../commands/command-group-metadata.mjs";

export function titleCase(value = "") {
  return String(value)
    .replace(/[.-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function navigationGroupLabel(groupId) {
  return commandGroupSpec(groupId)?.label || titleCase(groupId);
}
