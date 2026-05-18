# Codex Workflow

Use this workflow for changes in this repo.

## Before Editing

- Identify which source file owns the requested behavior.
- Read `AGENTS.md`.
- Read the relevant architecture, workflow, quality, or decision doc.
- Read the matching schema before changing any JSON model structure.

## During Editing

- Keep changes small and scoped.
- Update schema files in the same change as model shape changes.
- Do not add generated artifacts to project JSON.
- Do not introduce hidden assumptions; encode them in schema, docs, or scripts.
- Prefer simple data and simple scripts over broad dependencies.

## After Editing

Run:

```powershell
node .\scripts\check_repo.js
```

Run schema validation for a specific JSON file when changing JSON contracts:

```powershell
node .\scripts\validate_json_schema.js .\bobercad\data\projects\sample_structure.json
```

## When Work Gets Confusing

Do not guess silently. Improve one of:

- schema
- docs
- validation scripts
- data naming
- file organization

That is the Harness Engineering loop for this repo.

## Agent Routing

- New connection behavior: start in `bobercad/data/libraries/connections/README.md`.
- Reusable connection parts such as stiffeners: start in `bobercad/data/libraries/connection-components/README.md`.
- Connection runtime or API behavior: start in `bobercad/app/engine/modules/connections/README.md`.
- 3D dimensions and labels: start in `bobercad/app/rendering/annotations/README.md`.
- Viewer panels, layout, and controls: start in `bobercad/app/ui/viewer/README.md`.
