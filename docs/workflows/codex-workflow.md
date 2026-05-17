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
python .\scripts\check_repo.py
```

Run project schema validation:

```powershell
python .\validate_project.py .\bobercad\data\projects\sample_structure.json
```

## When Work Gets Confusing

Do not guess silently. Improve one of:

- schema
- docs
- validation scripts
- data naming
- file organization

That is the Harness Engineering loop for this repo.
