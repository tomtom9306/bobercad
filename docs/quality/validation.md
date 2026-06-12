# Validation

Validation should be mechanical where possible.

## Current Checks

Use:

```powershell
node .\scripts\check_repo.js
```

This checks:

- required folders exist
- required JSON files exist
- JSON files parse
- `$schema` references point to existing local files
- project JSON files validate against their local schemas
- Smart Component register and component `config.json` files validate against their schemas
- important docs exist
- `AGENTS.md` points to current paths
- sample project `objectIndex` entries point to existing model objects
- sample projects do not use old `model.patterns` or `patternRef` names

Use:

```powershell
node .\scripts\validate_json_schema.js .\bobercad\data\projects\sample_structure.json
```

This validates a JSON file against the schema referenced by its `$schema` field. With no arguments it validates sample projects, the Smart Component register, and Smart Component `config.json` files. It has no third-party package requirement.

## Validation Philosophy

- Schema validation checks shape.
- Future domain validation can check references, numbering, fabrication rules, and geometry constraints.
- Do not mix domain validation into `scripts/validate_json_schema.js`; that script is schema-only.
- If domain validation is needed later, create a separate script.
