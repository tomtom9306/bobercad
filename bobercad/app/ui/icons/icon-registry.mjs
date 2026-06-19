const ICONS = {
  beam: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 17h16" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
    </svg>
  `,
  column: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8" />
      <path d="M8 20h8" />
      <path d="M10 4v16" />
      <path d="M14 4v16" />
      <path d="M8 8h8" />
      <path d="M8 16h8" />
    </svg>
  `,
  plate: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7l10-3 4 3v10l-10 3-4-3z" />
      <path d="M9 10l6-2" />
      <path d="M9 14l6-2" />
    </svg>
  `,
  sketch: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17l4-10 5 7 5-9" />
      <circle cx="5" cy="17" r="1.6" />
      <circle cx="9" cy="7" r="1.6" />
      <circle cx="14" cy="14" r="1.6" />
      <circle cx="19" cy="5" r="1.6" />
    </svg>
  `,
  "work-plane": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16l8-11 8 11z" />
      <path d="M7 16h10" />
      <path d="M12 5v15" />
      <path d="M8 20h8" />
    </svg>
  `,
  "reference-plane": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15l8-9 8 9-8 4z" />
      <path d="M8 15l8-5" />
      <path d="M12 6v13" />
      <path d="M17 5l3 3" />
      <path d="M20 5l-3 3" />
    </svg>
  `,
  "work-point": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v6" />
      <path d="M12 14v6" />
      <path d="M4 12h6" />
      <path d="M14 12h6" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  `,
  bend: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18h7a6 6 0 0 0 6-6V5" />
      <path d="M12 18v-6h6" />
      <path d="M15 5h6v6" />
    </svg>
  `,
  trim: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6h14" />
      <path d="M5 18h14" />
      <path d="M8 6l8 12" />
      <path d="M16 6L8 18" />
    </svg>
  `,
  "trim-butt-a-to-b": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h10" />
      <path d="M5 17h10" />
      <path d="M8 7v10" />
      <path d="M15 5v14" />
      <path d="M17 9h3" />
      <path d="M17 15h3" />
    </svg>
  `,
  "trim-butt-b-to-a": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7h10" />
      <path d="M9 17h10" />
      <path d="M16 7v10" />
      <path d="M9 5v14" />
      <path d="M4 9h3" />
      <path d="M4 15h3" />
    </svg>
  `,
  "trim-butt-both": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h7" />
      <path d="M13 7h7" />
      <path d="M4 17h7" />
      <path d="M13 17h7" />
      <path d="M11 5v14" />
      <path d="M13 5v14" />
    </svg>
  `,
  "trim-miter": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16h7l9-9" />
      <path d="M4 8h7l9 9" />
      <path d="M11 8l4 4-4 4" />
    </svg>
  `,
  "trim-profile-cope": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h16" />
      <path d="M4 16h16" />
      <path d="M7 8v8" />
      <path d="M17 8v8" />
      <path d="M10 8c1.3 1 2 2.3 2 4s-.7 3-2 4" />
      <path d="M14 8c-1.3 1-2 2.3-2 4s.7 3 2 4" />
    </svg>
  `,
  "trim-plane": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18l14-12" />
      <path d="M7 6h10" />
      <path d="M7 18h10" />
      <path d="M9 6v12" />
      <path d="M15 6v12" />
    </svg>
  `,
  fastener: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h8l2 3-2 3H8L6 9z" />
      <path d="M9 12v7" />
      <path d="M15 12v7" />
      <path d="M7 19h10" />
      <path d="M10 6V4" />
      <path d="M14 6V4" />
    </svg>
  `,
  weld: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17h14" />
      <path d="M7 17l2-4 2 4 2-4 2 4 2-4" />
      <path d="M6 7h12" />
      <path d="M8 7l8 5" />
      <path d="M16 7l-8 5" />
    </svg>
  `,
  feature: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  `,
  snap: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5v4" />
      <path d="M17 5v4" />
      <path d="M7 15v4" />
      <path d="M17 15v4" />
      <path d="M9 7h6" />
      <path d="M9 17h6" />
      <path d="M12 9v6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  `,
  grid: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <path d="M5 10h14" />
      <path d="M5 14h14" />
      <path d="M10 5v14" />
      <path d="M14 5v14" />
    </svg>
  `,
  relation: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h7a5 5 0 0 1 5 5v3" />
      <path d="M6 16h12" />
      <circle cx="6" cy="8" r="2" />
      <circle cx="6" cy="16" r="2" />
      <circle cx="18" cy="16" r="2" />
    </svg>
  `,
  interface: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h10l4 4v6H9l-4-4z" />
      <path d="M9 7l4 4v6" />
      <path d="M15 7v6l4 4" />
      <path d="M8 18l-3 3" />
      <path d="M16 18l3 3" />
    </svg>
  `,
  "connection-zone": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h6v10H5z" />
      <path d="M13 5h6v14h-6z" />
      <path d="M11 10h2" />
      <path d="M11 14h2" />
      <circle cx="8" cy="12" r="1.5" />
      <circle cx="16" cy="12" r="1.5" />
    </svg>
  `,
  assembly: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
      <path d="M8 10v6" />
      <path d="M16 10v6" />
    </svg>
  `,
  group: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h5v5H6z" />
      <path d="M13 6h5v5h-5z" />
      <path d="M6 13h5v5H6z" />
      <path d="M13 13h5v5h-5z" />
      <path d="M11 8.5h2" />
      <path d="M11 15.5h2" />
    </svg>
  `,
  "hole-pattern": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="15" cy="9" r="1.5" />
      <circle cx="9" cy="15" r="1.5" />
      <circle cx="15" cy="15" r="1.5" />
    </svg>
  `,
  "object-pattern": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l4-3 4 3-4 3z" />
      <path d="M11 15l4-3 4 3-4 3z" />
      <path d="M9 11v4h2" />
      <path d="M13 8h2v4" />
      <path d="M5 18h4" />
      <path d="M15 5h4" />
    </svg>
  `,
  selection: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h6" />
      <path d="M5 5v6" />
      <path d="M19 19h-6" />
      <path d="M19 19v-6" />
      <path d="M9 9l6 6" />
      <path d="M13 9h2v2" />
    </svg>
  `,
  "selection-clear": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h6" />
      <path d="M5 5v6" />
      <path d="M19 19h-6" />
      <path d="M19 19v-6" />
      <path d="M8 8l8 8" />
      <path d="M16 8L8 16" />
    </svg>
  `,
  units: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17h14" />
      <path d="M7 17V7" />
      <path d="M17 17V7" />
      <path d="M7 9h10" />
      <path d="M10 14h1" />
      <path d="M13 14h1" />
    </svg>
  `,
  cancel: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  `,
  check: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  `,
  add: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  `,
  minus: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  `,
  search: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="M15 15l4.5 4.5" />
    </svg>
  `,
  file: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h7l4 4v12H7z" />
      <path d="M14 4v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  `,
  database: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  `,
  more: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="17.5" cy="12" r="1.4" />
    </svg>
  `,
  "drag-handle": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="7" r="1.1" />
      <circle cx="15" cy="7" r="1.1" />
      <circle cx="9" cy="12" r="1.1" />
      <circle cx="15" cy="12" r="1.1" />
      <circle cx="9" cy="17" r="1.1" />
      <circle cx="15" cy="17" r="1.1" />
    </svg>
  `,
  "zoom-fit": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4H4v3" />
      <path d="M17 4h3v3" />
      <path d="M7 20H4v-3" />
      <path d="M17 20h3v-3" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M9.5 12h5" />
      <path d="M12 9.5v5" />
    </svg>
  `,
  "reset-view": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8a7 7 0 1 1 1.6 10" />
      <path d="M5 4v4h4" />
      <path d="M9.5 12h5" />
      <path d="M12 9.5v5" />
    </svg>
  `,
  link: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 8H7a4 4 0 0 0 0 8h3" />
      <path d="M15 8h2a4 4 0 0 1 0 8h-3" />
      <path d="M9 12h6" />
    </svg>
  `,
  unlink: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 8H7a4 4 0 0 0 0 8h3" />
      <path d="M15 8h2a4 4 0 0 1 0 8h-3" />
      <path d="M8 20L16 4" />
    </svg>
  `,
  download: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 18h14" />
      <path d="M7 15v3" />
      <path d="M17 15v3" />
    </svg>
  `,
  upload: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 18h14" />
      <path d="M7 15v3" />
      <path d="M17 15v3" />
    </svg>
  `,
  "view-orientation": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
      <path d="M8.5 6.2v4" />
      <path d="M15.5 6.2v4" />
      <path d="M9 17l-3 3" />
      <path d="M15 17l3 3" />
    </svg>
  `,
  "display-shaded": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
    </svg>
  `,
  "display-wireframe": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
      <path d="M5 16l7-4 7 4" />
    </svg>
  `,
  "display-xray": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M8 10v5l4 2 4-2v-5" />
    </svg>
  `,
  library: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h5v14H5z" />
      <path d="M10 5h5v14h-5z" />
      <path d="M15 6l4 1v12l-4-1z" />
      <path d="M7 8h1" />
      <path d="M12 8h1" />
      <path d="M17 10l1 .2" />
    </svg>
  `,
  "model-browser": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h6v6H5z" />
      <path d="M13 5h6v6h-6z" />
      <path d="M5 13h6v6H5z" />
      <path d="M13 13h6v6h-6z" />
      <path d="M8 11v2" />
      <path d="M16 11v2" />
      <path d="M11 8h2" />
      <path d="M11 16h2" />
    </svg>
  `,
  inspector: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <path d="M14 5v14" />
      <path d="M8 9h3" />
      <path d="M8 13h3" />
      <path d="M16 9h1" />
      <path d="M16 13h1" />
    </svg>
  `,
  "smart-component": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8l7-4 7 4-7 4z" />
      <path d="M5 8v8l7 4 7-4V8" />
      <path d="M12 12v8" />
      <path d="M8 6v4" />
      <path d="M16 6v4" />
      <path d="M8 18v-4" />
      <path d="M16 18v-4" />
    </svg>
  `,
  settings: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
      <circle cx="9" cy="7" r="1.8" />
      <circle cx="15" cy="12" r="1.8" />
      <circle cx="11" cy="17" r="1.8" />
    </svg>
  `,
  pin: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8" />
      <path d="M9 4l1 7-3 3v2h10v-2l-3-3 1-7" />
      <path d="M12 16v5" />
    </svg>
  `,
  "pin-off": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8" />
      <path d="M9 4l1 7-3 3v2h10v-2l-3-3 1-7" />
      <path d="M12 16v5" />
      <path d="M5 5l14 14" />
    </svg>
  `,
  "chevron-up": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 15l6-6 6 6" />
    </svg>
  `,
  "chevron-down": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  `,
  "chevron-right": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  `,
  "chevron-left": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  `
};

export function createIcon(name, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(ICONS, name)) throw new Error(`Unknown UI icon: ${name}`);
  const wrapper = document.createElement("span");
  wrapper.className = ["bc-icon", options.className].filter(Boolean).join(" ");
  wrapper.setAttribute("aria-hidden", "true");
  const template = document.createElement("template");
  template.innerHTML = ICONS[name];
  wrapper.append(template.content.cloneNode(true));
  return wrapper;
}

export function registeredIconNames() {
  return Object.keys(ICONS);
}
