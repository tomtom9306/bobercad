# Finding Line-Reduction Estimates

This replaces the earlier broad estimate table.

Rule for this report: include only entries with `Very high` confidence. If the LOC impact depends on a refactor style, product decision, migration strategy, or combined fix with another finding, it is intentionally omitted rather than listed with lower confidence.

Sorting: descending by `Code/config LOC reduction`.

Line-count basis: nonblank physical lines that can be removed from the current worktree with the stated narrow fix. Edits that only change text on an existing line count as `0`.

## Summary

| Metric | Value |
| --- | ---: |
| Findings researched | 216 |
| Findings included with `Very high` confidence | 8 |
| Findings omitted because confidence would be below `Very high` or LOC is not a code/config reduction | 208 |
| Estimated net code/config LOC reduction from included rows | +44 |
| Estimated net repo text LOC reduction from included rows | +44 |

## Very High Confidence LOC Reductions

| Rank | ID | Code/config LOC reduction | Repo text LOC reduction | Confidence | Evidence checked | Net calculation | Why this is `Very high` |
| ---: | --- | ---: | ---: | --- | --- | --- | --- |
| 1 | F131 | +12 | +12 | Very high | `bobercad/app/ui/shell/workspace-customizer-commands.mjs:7-12`; `bobercad/app/ui/shell/workspace-customizer-dialog.mjs:9-14`; canonical export already exists at `bobercad/app/ui/shell/workspace-customizer-state.mjs:567-569`. | Remove two duplicated 6-line `VIEWER_OVERLAY_CORNER_SPECS` constants; add names to existing imports without adding lines. | The duplicated constants are exact local copies next to an existing exported canonical constant. |
| 2 | F02 | +7 | +7 | Very high | `scripts/serve_viewer.js:102-108`; `scripts/serve_viewer.js:130-131`; `scripts/serve_viewer.js:179-180`. | Remove `legacyEncodedBranchPathPrefix` lines 102-104, remove `branchPathPrefixes` lines 106-108, remove config field line 131, and keep line 180 using the existing `branchPathPrefix`. | The legacy encoded-branch helper is isolated and the canonical `branchPathPrefix` already exists. |
| 3 | F162 | +7 | +7 | Very high | `bobercad/app/ui/viewer/viewer-editor-panels.css:21-32`; `bobercad/app/ui/viewer/viewer-editor-panels.css:45-46`. | Remove trim selector line 22, remove unused trim-only rule lines 28-32, and remove trim hidden selector line 46. | The finding is specifically unused trim context CSS; these are the only matching selector lines in the stylesheet. |
| 4 | F107 | +6 | +6 | Very high | Duplicate implementation at `bobercad/app/ui/viewer/viewer-qa-bridge.mjs:125-131`; canonical implementation at `bobercad/app/rendering/webgl/webgl-view-state.mjs:7-13`; import area at `viewer-qa-bridge.mjs:1-8`. | Remove the 7-line local function and add one import line for `cameraAnglesForDirection`. | The math body is the same calculation and the replacement function already exists. |
| 5 | F132 | +4 | +4 | Very high | Local helper at `bobercad/app/ui/shell/workspace-customizer-dialog.mjs:16-20`; shared helper exists at `bobercad/app/ui/shell/workspace-customizer-labels.mjs:3`; usages at `workspace-customizer-dialog.mjs:211`, `:353`, `:393`, `:436`. | Remove 5-line local `titleCase`; add one import line from `workspace-customizer-labels.mjs`. | The shared helper already exists and the local helper has the same purpose. |
| 6 | F209 | +4 | +4 | Very high | Alias helper at `bobercad/data/libraries/smart-components/components/stairs/stair-system/build.mjs:192-195`; only call at `:300`. | Remove 4-line `componentRefForRailing` and change the call line to pass `parameters.railings.family` directly. | The alias helper has one local call site and the fix is a direct line replacement plus deletion. |
| 7 | F09 | +2 | +2 | Very high | Existing helper at `bobercad/app/rendering/interaction/keyboard-shortcuts.mjs:77-79`; duplicate local helper at `bobercad/app/ui/viewer/panels/panel-elements.mjs:596-598`; call sites at `panel-elements.mjs:583` and `:587`. | Remove 3-line local helper and add one import line for `shortcutSetting`. | The helper body is identical to the existing exported function. |
| 8 | F201 | +2 | +2 | Very high | `tools/stress/generate_random_beam_stress_projects.mjs:108`; `tools/stress/generate_random_beam_stress_projects.mjs:155`; string emission at `:235`. | Remove `connectionsPath` line 108 and the `libraries.connections` line 155. Removing `"connections": {}` from line 235 changes text on an existing line, so it counts as `0` LOC. | The obsolete connection library path and library entry are standalone physical lines. |

## Notes On Omitted Findings

- Large apparent reductions such as retiring `tools/dev/no_cache_http_server.py` were omitted because other code still references them, for example `tools/qa/capture_connection_views.mjs:143-158`; exact LOC depends on fixing that coupled workflow.
- Broad refactors such as shared validators, shared panel shells, shared Smart Component resolvers, and split contract suites were omitted because the net LOC depends on the chosen abstraction and migration shape.
- Documentation-only cleanup can reduce repo text, but it is not listed here unless it is a code/config LOC reduction with `Very high` confidence.
