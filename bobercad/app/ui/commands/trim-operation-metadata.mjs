export const TRIM_OPERATION_TYPES = [
  { id: "end-butt-1", label: "Butt A to B", gap: true, icon: "trim-butt-a-to-b" },
  { id: "end-butt-2", label: "Butt B to A", gap: true, icon: "trim-butt-b-to-a" },
  { id: "end-butt-both", label: "Butt both", gap: true, icon: "trim-butt-both" },
  { id: "end-miter", label: "Miter", gap: true, icon: "trim-miter" },
  { id: "profile-cope", label: "Object trim", gap: true, icon: "trim-profile-cope" },
  { id: "plane-trim", label: "Plane trim", gap: true, icon: "trim-plane" }
];

function trimOperationSpec(type) {
  return TRIM_OPERATION_TYPES.find((option) => option.id === type) || TRIM_OPERATION_TYPES[0];
}

export function trimOperationLabel(type) {
  return trimOperationSpec(type).label;
}

export function trimOperationIcon(type) {
  return trimOperationSpec(type).icon;
}

export function trimOperationSupportsGap(type) {
  return Boolean(trimOperationSpec(type).gap);
}
