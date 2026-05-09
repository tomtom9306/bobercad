# Codex Map

This repo follows OpenAI's Harness Engineering approach: humans steer, agents execute, and repository knowledge is the system of record.

Start here, then open the specific docs needed for the task.

## Source Of Truth

- Connection sample project: `projects/sample_structure.json`
- Portal frame sample project: `projects/sample_portal_frame.json`
- Beam-to-beam end plate sample project: `projects/sample_beam_to_beam_end_plate.json`
- Authoring and NC1 data-model test project: `projects/sample_authoring_nc1_test.json`
- Profile library: `libraries/profiles.json`
- Material library: `libraries/materials.json`
- Fastener library: `libraries/fasteners.json`
- Connection preset library: `libraries/connections.json`
- Frame template library: `libraries/frames.json`
- Viewer settings: `viewer/viewer_settings.json`
- Schemas: `schemas/`

## Required Reading

- Data model work: `docs/architecture/data-model.md`
- Viewer/editor work: `docs/exec-plans/active/0001-viewer-mvp.md`
- Agent workflow: `docs/workflows/codex-workflow.md`
- Validation rules: `docs/quality/validation.md`
- Architecture decisions: `docs/decisions/0001-json-source-of-truth.md`
- Project schema: `schemas/project_schema.json`
- Fastener library schema: `schemas/fastener_schema.json`
- Connection library schema: `schemas/connection_library_schema.json`
- Frame library schema: `schemas/frame_library_schema.json`

## Hard Rules

- Do not store meshes, vertices, triangles, B-reps, scene graph data, or generated geometry in project JSON.
- Do not add OpenCascade or a general CAD kernel to the core model.
- Keep `objectIndex` stored and authoritative for now.
- Use `modelDefaults` for repeated semantic values; object fields override defaults.
- `placementIntent` replaces ad hoc attachment metadata for manual connection parts, but it is metadata only; do not use it as a renderer/exporter fallback or hidden geometry generator.
- Profiles are point-based `[y, z]` contours, not flange/web parameter definitions.
- Fasteners live in `libraries/fasteners.json`; fastener groups reference catalog entries with `fastenerRef` directly or through `modelDefaults`.
- Use `model.workPoints` and `model.referencePlanes` for large-frame authoring points, roof slopes, grid nodes, and truss nodes; member `start`/`end` stay authoritative and point refs are review metadata only.
- Use `model.holePatterns` for hole/slot/fastener positions and `model.objectPatterns` for linear/circular/rectangular/path/mirror repetition of stored objects.
- Connection presets and frame templates are authoring provenance only; project objects must still store all geometry needed by the viewer and NC1 exporter.
- Use stored `interfaces` and `connectionZones` to describe connection locations; do not infer connection faces from vague object proximity.
- BIM metadata lives inside the object as `bim`, not in a separate wrapper.
- If model structure changes, update the matching schema in the same change.

## Standard Checks

Run after JSON/schema/doc workflow changes:

```powershell
python .\scripts\check_repo.py
```

Run project schema validation:

```powershell
python .\validate_project.py .\projects\sample_structure.json
```
