# WebGL Renderer Map

This folder owns browser-side drawing and viewport interaction.

## Files

- `webgl-viewer-runtime.mjs` draws scene faces, edges, authoring handles, dimension lines, camera orbit/pan/zoom, and picking.
- `dimension-label-editor-ui.mjs` owns dimension labels, tooltips, editable text boxes, mode menus, check/cancel/repair actions, and label hover state.
- `camera.mjs` owns projection, fitting, orbit, pan, and zoom math.

## Rules

- Keep connection-specific geometry and dimension meaning out of this folder.
- Add dimension placement logic under `app/rendering/annotations/`.
- Add dimension label/edit UX changes in `dimension-label-editor-ui.mjs`.
- Keep `webgl-viewer-runtime.mjs` as the drawing and event-wiring layer.
