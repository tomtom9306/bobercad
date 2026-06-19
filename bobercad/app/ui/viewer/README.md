# Viewer UI Map

This folder owns the browser viewer entry, toolbar, panels, and dimension-edit UI.

## Files

- `index.html`, `viewer-runtime.mjs`, `style.css`, and `viewer-settings.json` are the viewer entry.
- `panels/` owns generic panel hosting and generic project/property panels.
- `toolbar/` owns modeling command controls.
- `dimensions/` owns generic dimension edit state and commits edited values back to Smart Component parameters.
- `viewer-app-controller.mjs` is the viewer-facing app facade for project, command, selection, snap, and workspace operations.
- `viewer-command-adapter.mjs` binds command registry metadata to the viewer facade and shell panel commands.
- `../commands/command-registry.mjs` owns command metadata for toolbar and palette discovery.
- `../shell/` owns the workspace shell, command palette, and workspace customization behavior, including toolbar layout plus theme/density preferences.
- `../design-system/` and `../icons/` own reusable visual primitives and SVG icons.

## Active UI Plan

- Professional UI replacement and design-system plan: `docs/exec-plans/active/0007-professional-ui-design-system.md`

## Boundary

Viewer UI should stay generic. Smart Component parameter panels are loaded from `bobercad/data/libraries/smart-components`, not hardcoded into viewer panels.

If a UI feature needs domain behavior, prefer a generic command or panel hook here and keep the domain implementation in the matching data library.

The viewer may pass DOM anchors and callbacks into shell modules, but shell layout and workspace customization should not be implemented inline in `viewer-runtime.mjs`.

Command palette and toolbar actions should go through `viewer-app-controller.mjs` where possible, instead of binding directly to renderer or engine modules from shell/UI components.
