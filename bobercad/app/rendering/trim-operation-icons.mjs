import { safeHexColor as safeColor } from "./webgl/colors.mjs?v=hex-color-regex-dry-1";

export const TRIM_OPERATION_TYPES = [
  { id: "end-butt-1", label: "Butt A to B", gap: true },
  { id: "end-butt-2", label: "Butt B to A", gap: true },
  { id: "end-butt-both", label: "Butt both", gap: true },
  { id: "end-miter", label: "Miter", gap: true },
  { id: "profile-cope", label: "Profile cope", gap: false },
  { id: "plane-trim", label: "Plane trim", gap: true }
];

function trimOperationSpec(type) {
  return TRIM_OPERATION_TYPES.find((option) => option.id === type) || TRIM_OPERATION_TYPES[0];
}

export function trimOperationLabel(type) {
  return trimOperationSpec(type).label;
}

export function trimOperationSupportsGap(type) {
  return Boolean(trimOperationSpec(type).gap);
}

export function trimOperationIconMarkup(type, colors = {}, attrs = {}) {
  const keptA = safeColor(colors.memberA, "#365f74");
  const keptB = safeColor(colors.memberB, "#d99200");
  const ghost = safeColor(colors.removed, "#dc2626");
  const ghostFill = safeColor(colors.removedFill, "#fecaca");
  const cut = safeColor(colors.cut, "#facc15");
  const attrText = Object.entries({
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 150 86",
    role: "img",
    "aria-hidden": "true",
    focusable: "false",
    ...attrs
  }).map(([name, value]) => `${name}="${String(value).replaceAll('"', "&quot;")}"`).join(" ");
  const removed = `fill="${ghostFill}" opacity="0.42" stroke="${ghost}" stroke-width="2" stroke-dasharray="5 3"`;
  const cutLine = `fill="none" stroke="${cut}" stroke-width="4" stroke-linecap="square" stroke-linejoin="round"`;

  if (type === "end-butt-2") {
    return `<svg ${attrText}>
      <rect x="38" y="10" width="18" height="66" fill="${keptA}" opacity="0.94"/>
      <rect x="56" y="30" width="46" height="18" fill="${keptB}" opacity="0.94"/>
      <rect x="102" y="30" width="34" height="18" ${removed}/>
      <path d="M56 30 V48" ${cutLine}/>
    </svg>`;
  }

  if (type === "end-butt-both") {
    return `<svg ${attrText}>
      <rect x="14" y="30" width="44" height="18" ${removed}/>
      <rect x="42" y="10" width="18" height="20" ${removed}/>
      <rect x="58" y="30" width="70" height="18" fill="${keptB}" opacity="0.94"/>
      <rect x="42" y="30" width="18" height="46" fill="${keptA}" opacity="0.94"/>
      <rect x="42" y="30" width="18" height="18" fill="#7aa5bd" opacity="0.55"/>
      <path d="M58 30 V48 M42 30 H60" ${cutLine}/>
    </svg>`;
  }

  if (type === "end-miter") {
    return `<svg ${attrText}>
      <path d="M15 33 H74 L90 51 H15 Z" fill="${keptA}" opacity="0.94"/>
      <path d="M74 33 L90 51 L132 14 L116 2 Z" fill="${keptB}" opacity="0.94"/>
      <path d="M74 33 L90 51" ${cutLine}/>
      <path d="M90 51 L107 70" ${removed}/>
      <path d="M74 33 L57 14" ${removed}/>
    </svg>`;
  }

  if (type === "profile-cope") {
    return `<svg ${attrText}>
      <rect x="14" y="33" width="122" height="18" fill="${keptA}" opacity="0.94"/>
      <rect x="64" y="33" width="22" height="18" fill="#f8fafc" stroke="${cut}" stroke-width="3"/>
      <rect x="66" y="9" width="18" height="68" ${removed}/>
      <path d="M64 33 V51 M86 33 V51" ${cutLine}/>
    </svg>`;
  }

  if (type === "plane-trim") {
    return `<svg ${attrText}>
      <rect x="30" y="18" width="88" height="50" fill="none" stroke="${ghost}" stroke-width="4"/>
      <path d="M38 58 L108 28" ${cutLine}/>
      <path d="M108 28 L96 25 M108 28 L101 39" fill="none" stroke="${cut}" stroke-width="4" stroke-linecap="square"/>
    </svg>`;
  }

  return `<svg ${attrText}>
    <rect x="14" y="30" width="88" height="18" fill="${keptB}" opacity="0.94"/>
    <rect x="42" y="48" width="18" height="28" fill="${keptA}" opacity="0.94"/>
    <rect x="42" y="12" width="18" height="18" ${removed}/>
    <path d="M42 48 H60" ${cutLine}/>
  </svg>`;
}
