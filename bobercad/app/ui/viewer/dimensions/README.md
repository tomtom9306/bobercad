# Dimension Editing

This folder owns browser-side editing of rendered dimensions.

- `dimension-edit-controller.mjs` tracks the active connection dimension and commits edited dimension values back into connection parameters.

Dimension placement and measurement geometry live in `bobercad/app/rendering/annotations/`.
Dimension labels, tooltips, menus, and inputs live in `bobercad/app/rendering/webgl/dimension-overlay-ui.mjs`.

Keep connection-specific meaning in connection/component JSON whenever possible. Add code here only for generic edit behavior shared by all dimensions.
