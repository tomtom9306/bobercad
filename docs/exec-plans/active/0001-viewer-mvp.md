# Exec Plan 0001: Viewer MVP

## Goal

Build the first web viewer for `bobercad/data/projects/sample_structure.json`.

## Inputs

- `bobercad/data/projects/sample_structure.json`
- `bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json`
- `bobercad/data/libraries/materials/material-libraries/starter-materials/config.json`
- `bobercad/app/ui/viewer/viewer-settings.json`

## Required Behavior

- Load all three JSON files.
- Load viewer camera, UI, control, and render settings from `bobercad/app/ui/viewer/viewer-settings.json`.
- Use `objectIndex` to resolve objects.
- Resolve `modelDefaults` before rendering so object-specific values override collection/type defaults.
- Render members by extruding profile section contours along member start/end axes.
- Render plates from plate center, normal, local axes, width, height, and thickness.
- Render fastener groups from `holePatterns` positions.
- Use `display.color` where present.
- Ignore `placementIntent` for rendering; it is descriptive metadata, not a fallback source for geometry.
- Do not write generated geometry back to JSON.

## Exclusions

- No editor yet.
- No NC1/IFC/STEP exporters yet.
- No viewer test fixtures inside project JSON.
- No general CAD kernel.

## Acceptance Checks

- JSON files still parse.
- `node .\scripts\check_repo.js` passes.
- Viewer runs locally.
- Generated geometry is runtime-only.

## Implementation

- Static entrypoint: `bobercad/app/ui/viewer/index.html`
- Styles: `bobercad/app/ui/viewer/style.css`
- Runtime entrypoint: `bobercad/app/ui/viewer/main.mjs`
- No viewer geometry is written back to project JSON.
