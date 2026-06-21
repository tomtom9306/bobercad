# App Architecture Audit

Date: 2026-06-20

Scope: current working copy of `bobercad/app`, `bobercad/data/libraries`, `bobercad/data/projects`, `scripts`, `tools`, and the architecture/workflow/validation documents named in `AGENTS.md`.

This audit supersedes the earlier 2026-06-20 scans. The remediation record is in `docs/architecture/app-architecture-remediation-log.md`.

## Final Result

| Check | Result |
| --- | ---: |
| Files scanned | 407 |
| Lines scanned | 957,661 |
| Score 5 findings | 0 |
| Score 4 findings | 0 |
| Score 3 findings | 0 |
| Active architecture blockers | 0 |

## Verification

| Command | Result |
| --- | --- |
| `node .\scripts\check_repo.js` | Pass |
| `node .\scripts\architecture_line_scan.js` | Pass, `findings: 0` |
| Full JS/MJS syntax sweep under `bobercad/app` and `scripts` | Pass, `249` files checked |
| Browser startup smoke on `http://127.0.0.1:8010/bobercad/app/ui/viewer/index.html` | Pass, title `Bobercad Viewer`, console/page errors `0` |
| Raw line findings CSV | Header only, no active rows |

## Current Rating Table

Score scale:

- 0 = resolved and guarded by checks.
- 1 = materially resolved, small residual follow-up.
- 2 = partially remediated.
- 3 = significant architecture issue.
- 4 = high-risk bottleneck.
- 5 = blocker or conflicting source of truth.

| Register | Rows | Highest Current Score | Status | Artifact |
| --- | ---: | ---: | --- | --- |
| Original top-10 blocker list | 10 | 0 | Resolved | This file |
| Former 55-row high-risk register | 55 | 0 | Resolved | `docs/architecture/app-architecture-rescan-compact-table.md` |
| Current line findings | 0 | 0 | Clean | `docs/architecture/app-architecture-line-findings.csv` |
| Full file ledger | 407 | 0 | Clean | `docs/architecture/app-architecture-file-audit.csv` |

## External Review P3 Follow-Up

| Reviewer Finding | Previous Review Severity | Action Taken | Current Blocker Score | Verification |
| --- | --- | --- | ---: | --- |
| WebGL README pointed at removed `dimension-label-editor-ui.mjs` | P3 | Updated `bobercad/app/rendering/webgl/README.md` to map the current WebGL modules and the real dimension UI owner, `bobercad/app/ui/viewer/dimensions/dimension-overlay-ui.mjs` | 0 | README no longer references the removed file; viewer runtime imports `dimension-overlay-ui.mjs` |
| `project-command-store.mjs` still owned trim authoring methods inline | P3 | Moved trim-joint store API methods to `bobercad/app/engine/store/project-store-trim-methods.mjs`; the store now composes that module | 0 | Public trim methods remain functions on the store; `scripts/contracts/project_store_contracts.js` blocks moving them back into the facade |
| Contract checks were effective but too concentrated in one script | P3 | Split project-store contract checks into `scripts/contracts/project_store_contracts.js` and switched this area to module-specifier based import checks | 0 | `node .\scripts\check_repo.js` passes; architecture line scan reports `407` files, `957,661` lines, and `findings: 0` |
| `project.schema.json` kept broad object-level `additionalProperties` allowances | P3 | Hardened root, `model`, and every model collection item definition to reject unknown fields; dynamic payload bags remain explicit | 0 | `check_repo.js` validates all 27 project files; `scripts/contracts/project_schema_contracts.js` blocks reopening collection item schemas |

## Top-10 Closure

| # | Issue | Original Score | Current Score | Verification |
| ---: | --- | ---: | ---: | --- |
| 1 | Renderer used `placementIntent` as geometry fallback | 5 | 0 | Renderer/exporter fallback scans clean; evaluator contracts pass |
| 2 | Source imports contained `?v=` cache keys | 4 | 0 | Import hygiene scan and contract checks pass |
| 3 | `viewer-runtime.mjs` was app-wide coordinator | 4 | 0 | Runtime delegates scheduler, QA, workspace, command, and DOM concerns |
| 4 | Project store was a mutation hub | 4 | 0 | Command/result/store helper split passes contracts |
| 5 | Scene builder mixed semantic evaluation and visual assembly | 4 | 0 | Scene builder is a small adapter composer; evaluator boundaries pass |
| 6 | Smart Component primitive vocabulary was static core state | 4 | 0 | Manifest registry and input validation pass |
| 7 | Engine Smart Component registry imported data-library UI | 3 | 0 | Engine/data UI boundary scan is clean |
| 8 | Plate sketch engine/controller layers were monoliths | 3 | 0 | Engine solver and drag controller split modules pass scan |
| 9 | Inspector/workspace customizer were product logic hubs | 3 | 0 | Metadata/contribution/customizer splits pass contracts |
| 10 | Domain validation lagged runtime invariants | 3 | 0 | Domain validator is wired into `check_repo.js` and passes |

## Full Register

The previous 55-row high-risk list is retained as a proper table with every current score set to `0`:

`docs/architecture/app-architecture-rescan-compact-table.md`

## North Star

The enforced path remains:

```text
public engine API -> project command object -> domain validation -> semantic evaluator -> scene adapter -> UI metadata/contribution
```

Future work that bypasses this path needs an explicit contract and should not reintroduce compatibility layers, fallback geometry paths, or hidden source-of-truth branches.
