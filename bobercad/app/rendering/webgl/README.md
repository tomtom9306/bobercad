# WebGL Renderer Map

This folder owns browser-side WebGL drawing, camera math, hit testing, and viewport interaction.

## Files

- `webgl-viewer-runtime.mjs` composes the WebGL renderer, controls, picker, preview, and view state.
- `webgl-render-orchestrator.mjs` draws scene faces, edges, authoring handles, dimension lines, and overlays.
- `webgl-viewer-controls.mjs` owns pointer, orbit, pan, zoom, selection, and drag interaction wiring.
- `webgl-picker.mjs`, `webgl-object-preview.mjs`, `webgl-pick-color-state.mjs`, and `webgl-view-state.mjs` own picking, preview rendering, pick colors, and viewport state.
- `camera.mjs` owns projection, fitting, orbit, pan, and zoom math.

## Rules

- Keep connection-specific geometry and dimension meaning out of this folder.
- Add dimension placement logic under `app/rendering/annotations/`.
- Add dimension label/edit UX changes under `app/ui/viewer/dimensions/`; `dimension-overlay-ui.mjs` owns labels, tooltips, editable text boxes, mode menus, check/cancel/repair actions, and hover state.
- Keep `webgl-viewer-runtime.mjs` as a coordinator; new drawing or interaction behavior belongs in a focused WebGL module.
