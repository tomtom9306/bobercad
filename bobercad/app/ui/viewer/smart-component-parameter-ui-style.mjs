const STYLE_ID = "bobercad-connection-ui";

const STYLE = `
.connection-ui .connection-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--bc-space-1, 2px) var(--bc-space-6, 12px);
  padding: var(--bc-space-6, 12px) var(--bc-space-8, 16px) var(--bc-space-5, 10px);
  border-bottom: 1px solid var(--bc-color-border, #cbd5e1);
  background: var(--bc-color-surface-solid, #f8fafc);
}
.connection-ui .connection-kicker {
  grid-column: 1 / 2;
  color: var(--bc-color-text-subtle, #64748b);
  font-size: var(--bc-font-size-11, 11px);
}
.connection-ui .connection-title {
  min-width: 0;
  overflow: hidden;
  grid-column: 1 / 2;
  margin: 0;
  color: var(--bc-color-text, #111827);
  font-size: var(--bc-font-size-14, 14px);
  line-height: var(--bc-line-tight, 1.2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-ui .connection-status {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  align-self: start;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-hover, #e8eef5);
  color: var(--bc-color-text-muted, #334155);
  padding: var(--bc-space-1, 2px) var(--bc-space-3, 6px);
  font-size: var(--bc-font-size-11, 11px);
  text-transform: capitalize;
}
.connection-ui .connection-status[data-state="error"] {
  border-color: var(--bc-color-danger, #991b1b);
  background: color-mix(in srgb, var(--bc-color-danger, #991b1b) 12%, var(--bc-color-field, #ffffff));
  color: var(--bc-color-danger, #991b1b);
}
.connection-ui .bc-parameter-tab-body {
  display: grid;
  align-content: start;
  gap: var(--bc-space-4, 8px);
  min-width: 0;
  min-height: 220px;
  overflow-x: hidden;
  padding: var(--bc-space-6, 12px) var(--bc-space-8, 16px);
  background: var(--bc-color-field, #ffffff);
}
.connection-ui [data-parameter-path].focused {
  outline: 2px solid var(--bc-color-accent, #2563eb);
  outline-offset: 2px;
}
.connection-ui input[type="text"],
.connection-ui select {
  width: 100%;
  min-width: 0;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--bc-color-border-strong, #aeb9c9);
  border-radius: var(--bc-radius-1, 2px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-4, 8px);
  font: inherit;
}
.connection-ui input[type="text"]:focus,
.connection-ui select:focus {
  outline: 2px solid var(--bc-color-focus, #7aa7d9);
  outline-offset: 0;
  border-color: var(--bc-color-accent, #4d7fb6);
}
.connection-ui input[type="text"].invalid {
  border-color: var(--bc-color-danger, #b91c1c);
  background: color-mix(in srgb, var(--bc-color-danger, #b91c1c) 7%, var(--bc-color-field, #ffffff));
}
.connection-ui input[type="checkbox"] {
  width: 14px;
  height: 14px;
  margin: 0;
}
.connection-ui input[type="checkbox"]:disabled {
  opacity: 0.65;
}
.connection-ui .connection-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--bc-space-5, 10px);
  min-width: 0;
  overflow-x: hidden;
  padding: var(--bc-space-5, 10px) var(--bc-space-8, 16px);
  border-top: 1px solid var(--bc-color-border, #cbd5e1);
  background: var(--bc-color-surface-solid, #f8fafc);
}
.connection-ui .connection-action {
  min-width: 0;
  min-height: 28px;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text, #172033);
  padding: 0 var(--bc-space-5, 10px);
  font: var(--bc-font-weight-medium, 600) var(--bc-font-size-12, 12px) / 1 var(--bc-font-family, inherit);
  cursor: pointer;
}
.connection-ui .connection-action.primary {
  border-color: var(--bc-color-border-strong, #9fb0c3);
  background: var(--bc-color-hover, #e8eef5);
  color: var(--bc-color-accent-strong, #1d4ed8);
}
.connection-ui .connection-action.danger {
  border-color: color-mix(in srgb, var(--bc-color-danger, #b91c1c) 45%, transparent);
  color: var(--bc-color-danger, #991b1b);
}
.connection-ui .connection-message {
  flex: 1 1 120px;
  min-width: 0;
  min-height: 18px;
  color: var(--bc-color-text-muted, #475569);
  line-height: 1.35;
}
.connection-ui .connection-message[data-state="ok"] {
  color: var(--bc-color-success, #166534);
}
.connection-ui .connection-message[data-state="error"] {
  color: var(--bc-color-danger, #b91c1c);
}
.connection-ui .stair-route-modules {
  display: grid;
  gap: var(--bc-space-5, 10px);
  min-width: 0;
}
.connection-ui .stair-route-card {
  display: grid;
  gap: var(--bc-space-4, 8px);
  min-width: 0;
  overflow-x: hidden;
  border: 1px solid var(--bc-color-border, #cbd5e1);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-surface-solid, #f8fafc);
  padding: var(--bc-space-4, 8px);
}
.connection-ui .stair-route-card.dragging {
  opacity: 0.55;
}
.connection-ui .stair-route-card.drop-before {
  border-top-color: var(--bc-color-accent, #2563eb);
  box-shadow: inset 0 3px 0 var(--bc-color-accent, #2563eb);
}
.connection-ui .stair-route-card.drop-after {
  border-bottom-color: var(--bc-color-accent, #2563eb);
  box-shadow: inset 0 -3px 0 var(--bc-color-accent, #2563eb);
}
.connection-ui .stair-route-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--bc-space-3, 6px);
}
.connection-ui .stair-route-card-header {
  justify-content: space-between;
}
.connection-ui .stair-route-title {
  min-width: 0;
  overflow: hidden;
  color: var(--bc-color-text, #172033);
  font-weight: var(--bc-font-weight-bold, 700);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.connection-ui .stair-route-card-controls,
.connection-ui .stair-route-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--bc-space-2, 4px);
  min-width: 0;
}
.connection-ui .stair-route-card-controls {
  justify-content: flex-end;
}
.connection-ui .stair-route-drag-handle {
  width: 26px;
  min-width: 26px;
  height: 24px;
  border: 1px solid var(--bc-color-border, #9fb0c3);
  border-radius: var(--bc-radius-2, 4px);
  background: var(--bc-color-field, #ffffff);
  color: var(--bc-color-text-muted, #334155);
  padding: 0;
  cursor: grab;
  font: inherit;
  line-height: 1;
}
.connection-ui .stair-route-drag-handle:active {
  cursor: grabbing;
}
.connection-ui .stair-route-actions .connection-action {
  flex: 1 1 135px;
  white-space: normal;
  line-height: 1.2;
}
.connection-ui .connection-action.compact {
  min-height: 24px;
  padding: 0 var(--bc-space-3, 6px);
  font-size: var(--bc-font-size-11, 11px);
}
`;

export function ensureSmartComponentParameterUiStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}
