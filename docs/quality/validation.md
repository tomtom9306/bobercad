# Validation

Validation should be mechanical where possible.

## Current Checks

Use:

```powershell
python .\scripts\check_repo.py
```

This checks:

- required folders exist
- required JSON files exist
- JSON files parse
- `$schema` references point to existing local files
- important docs exist
- `AGENTS.md` points to current paths
- sample project `objectIndex` entries point to existing model objects
- sample projects do not use old `model.patterns` or `patternRef` names

Use:

```powershell
python .\validate_project.py .\projects\sample_structure.json
```

This validates the project file against the schema referenced by its `$schema` field. It has no third-party Python package requirement.

## Validation Philosophy

- Schema validation checks shape.
- Future domain validation can check references, numbering, fabrication rules, and geometry constraints.
- Do not mix domain validation into `validate_project.py`; that script is schema-only.
- If domain validation is needed later, create a separate script.
