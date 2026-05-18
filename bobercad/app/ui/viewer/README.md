# Viewer UI Map

This folder owns the browser workbench, panels, navigation, and form controls.

## Files

- `index.html`, `main.mjs`, `style.css`, and `viewer-settings.json` are the viewer entry.
- `workbench/` owns layout state and command registration.
- `navigation/` owns toolbars and navigation surfaces.
- `panels/` owns generic panel hosting and generic project/property panels.
- `controls/` owns reusable form and menu controls.
- `dimensions/` owns generic dimension edit state and commits edited values back to connection parameters.
- `themes/` owns visual tokens.

## Boundary

Viewer UI should stay generic. Connection-specific panels belong in each connection folder under `bobercad/data/libraries/connections/connections/<connection-id>/ui.mjs`.

If a UI feature needs domain behavior, prefer a generic command or panel hook here and keep the domain implementation in the matching data library.
