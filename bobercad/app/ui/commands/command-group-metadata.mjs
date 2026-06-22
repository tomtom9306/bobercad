export const COMMAND_GROUP_SPECS = [
  {
    id: "model",
    label: "Model",
    icon: "beam",
    description: "Create and edit structural modeling objects."
  },
  {
    id: "tools",
    label: "Tools",
    icon: "search",
    description: "Coordination and review tools such as clash detection."
  },
  {
    id: "structural-analysis",
    label: "Structural Analysis",
    icon: "feature",
    description: "Structural analysis and review workflows."
  }
];

export const COMMAND_GROUP_ORDER = COMMAND_GROUP_SPECS.map((group) => group.id);
export const COMMAND_GROUPS = Object.fromEntries(COMMAND_GROUP_SPECS.map((group) => [group.id, group.label]));

export const RIBBON_SECTION_ORDER = {
  view: ["camera", "display", "orientation"],
  model: ["members", "plates", "connections", "sketching", "references", "modify"],
  annotations: ["relations", "dimensions"],
  tools: ["coordination"],
  "structural-analysis": ["analysis"],
  other: ["commands"]
};

export const RIBBON_SECTION_LABELS = {
  members: "Members",
  plates: "Plates",
  connections: "Connections",
  sketching: "Sketch & Planes",
  references: "References",
  modify: "Modify",
  camera: "Camera",
  display: "Display",
  orientation: "Orientation",
  selection: "Selection",
  scope: "Scope",
  "project-data": "Project Data",
  libraries: "Libraries",
  docks: "Docks",
  relations: "Relations",
  dimensions: "Dimensions",
  coordination: "Coordination",
  snap: "Snap",
  layout: "Layout",
  analysis: "Analysis",
  commands: "Commands"
};

const COMMAND_GROUP_BY_ID = new Map(COMMAND_GROUP_SPECS.map((group) => [group.id, group]));

export function commandGroupSpec(groupId) {
  return COMMAND_GROUP_BY_ID.get(groupId) || null;
}

export function commandGroupLabel(groupId) {
  return commandGroupSpec(groupId)?.label || titleCase(groupId);
}

export function commandGroupIcon(groupId) {
  return commandGroupSpec(groupId)?.icon || "more";
}

export function commandRibbonSectionOrder(groupId) {
  return RIBBON_SECTION_ORDER[groupId] || RIBBON_SECTION_ORDER.other;
}

export function commandRibbonSectionLabel(sectionId) {
  return RIBBON_SECTION_LABELS[sectionId] || commandGroupLabel(sectionId);
}

export function inferCommandRibbonSection(groupId, command) {
  const id = String(command?.id || "");
  if (groupId === "model") {
    if (id.includes(".beam.") || id.includes(".column.")) return "members";
    if (id.includes(".plate") || id.includes(".bend")) return "plates";
    if (id.includes(".connection") || id.includes(".weld") || id.includes(".bolt")) return "connections";
    if (id.includes(".sketch") || id.includes(".workPlane")) return "sketching";
    return "modify";
  }
  if (groupId === "annotations") {
    if (id.includes("dimension")) return "dimensions";
    return "relations";
  }
  if (groupId === "tools") {
    if (id.includes("clash")) return "coordination";
    return "coordination";
  }
  if (groupId === "view") {
    if (id.includes(".displayMode.")) return "display";
    if (id.includes(".orientation.")) return "orientation";
    return "camera";
  }
  if (groupId === "structural-analysis") return "analysis";
  return "commands";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
