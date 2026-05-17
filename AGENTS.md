# Codex Map

This repo follows OpenAI's Harness Engineering approach: humans steer, agents execute, and repository knowledge is the system of record.

Start here, then open the specific docs needed for the task.

## Source Of Truth

- Connection sample project: `bobercad/data/projects/sample_structure.json`
- Fin plate sample project: `bobercad/data/projects/sample_fin_plate.json`
- Connection test frame sample project: `bobercad/data/projects/sample_connection_test_frame.json`
- Portal frame sample project: `bobercad/data/projects/sample_portal_frame.json`
- Beam-to-beam fin plate sample project: `bobercad/data/projects/sample_beam_to_beam_fin_plate.json`
- Beam-to-beam end plate sample project: `bobercad/data/projects/sample_beam_to_beam_end_plate.json`
- Authoring and NC1 data-model test project: `bobercad/data/projects/sample_authoring_nc1_test.json`
- Profile library pack: `bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json`
- Material library pack: `bobercad/data/libraries/materials/material-libraries/starter-materials/config.json`
- Fastener library pack: `bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json`
- Connection library register: `bobercad/data/libraries/connections/connection-register.json`
- Model library register: `bobercad/data/libraries/model-library/model-register.json`
- Viewer settings: `bobercad/app/ui/viewer/viewer-settings.json`
- Schemas: `bobercad/app/schemas/`

## Required Reading

- Data model work: `docs/architecture/data-model.md`
- Viewer/editor work: `docs/exec-plans/active/0001-viewer-mvp.md`
- Agent workflow: `docs/workflows/codex-workflow.md`
- Validation rules: `docs/quality/validation.md`
- Architecture decisions: `docs/decisions/0001-json-source-of-truth.md`
- Project schema: `bobercad/app/schemas/project.schema.json`
- Fastener library schema: `bobercad/app/schemas/fastener-library.schema.json`
- Connection schema: `bobercad/app/schemas/connection.schema.json`
- Model library schema: `bobercad/app/schemas/model-library.schema.json`

## Hard Rules

- Do not store meshes, vertices, triangles, B-reps, scene graph data, or generated geometry in project JSON.
- Do not add OpenCascade or a general CAD kernel to the core model.
- Keep `objectIndex` stored and authoritative for now.
- Use `modelDefaults` for repeated semantic values; object fields override defaults.
- `placementIntent` replaces ad hoc attachment metadata for manual connection parts, but it is metadata only; do not use it as a renderer/exporter fallback or hidden geometry generator.
- Profiles are point-based `[y, z]` contours, not flange/web parameter definitions.
- Fasteners live in library packs under `bobercad/data/libraries/fasteners`; fastener groups reference catalog entries with `fastenerRef` directly or through `modelDefaults`.
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
python .\validate_project.py .\bobercad\data\projects\sample_structure.json
```
