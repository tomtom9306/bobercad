# Exec Plan 0001: Viewer MVP

## Goal

Build the first web viewer for `projects/sample_structure.json`.

## Inputs

- `projects/sample_structure.json`
- `libraries/profiles.json`
- `libraries/materials.json`
- `viewer/viewer_settings.json`

## Required Behavior

- Load all three JSON files.
- Load viewer camera, UI, control, and render settings from `viewer/viewer_settings.json`.
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
- `scripts/check_repo.py` passes.
- Viewer runs locally.
- Generated geometry is runtime-only.

## Implementation

- Static entrypoint: `viewer/index.html`
- Styles: `viewer/style.css`
- Runtime entrypoint: `viewer/src/app.mjs`
- No viewer geometry is written back to project JSON.
