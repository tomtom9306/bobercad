# Viewer UI Map

This folder owns the browser viewer entry, toolbar, panels, and dimension-edit UI.

## Files

- `index.html`, `main.mjs`, `style.css`, and `viewer-settings.json` are the viewer entry.
- `panels/` owns generic panel hosting and generic project/property panels.
- `toolbar/` owns modeling command controls.
- `dimensions/` owns generic dimension edit state and commits edited values back to Smart Component parameters.

## Boundary

Viewer UI should stay generic. Smart Component parameter panels are loaded from `bobercad/data/libraries/smart-components`, not hardcoded into viewer panels.

If a UI feature needs domain behavior, prefer a generic command or panel hook here and keep the domain implementation in the matching data library.
