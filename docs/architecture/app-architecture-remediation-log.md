# App Architecture Remediation Log

Date started: 2026-06-20

Goal: resolve the top 10 issues in `docs/architecture/app-architecture-audit.md` with hard changes only: no fallbacks, no compatibility layers, and no obsolete code left behind.

Concurrent-work note: another agent may be editing app files. Re-read target files before editing and do not revert unrelated changes.

## Status Table

| Rank | Issue | Status | Files Changed | Verification |
| ---: | --- | --- | --- | --- |
| 1 | Renderer uses `placementIntent` as a geometry fallback | Fixed, verified | `bobercad/app/rendering/scene/scene-geometry-builder.mjs`; `bobercad/app/engine/store/project-command-store.mjs`; `bobercad/app/schemas/project.schema.json`; `bobercad/data/libraries/smart-components/components/stairs/railings/shared/railing-path-and-panel-system.mjs`; stair sample project JSON | Local scan: 0 fastener groups without `through.fromFeatureId`; no renderer fallback symbols found; `node .\scripts\check_repo.js` passes |
| 2 | Source imports contain pervasive `?v=` cache keys | Fixed, verified | 75 files under `bobercad/app` | `rg -n "\\?v=" bobercad\\app` returns no matches; `node .\scripts\check_repo.js` passes |
| 3 | `viewer-runtime.mjs` is the app-wide coordinator | Fixed, verified | `bobercad/app/ui/viewer/viewer-runtime.mjs`; `bobercad/app/ui/viewer/viewer-render-scheduler.mjs`; `bobercad/app/ui/viewer/viewer-qa-bridge.mjs`; `bobercad/app/ui/viewer/viewer-workspace-bindings.mjs`; `bobercad/app/ui/viewer/viewer-command-registration.mjs`; `scripts/check_repo_contracts.js` | Render scheduling, QA bridge, workspace bindings, and command registration extracted; stale-symbol scan shows no local extracted policy bodies left in `viewer-runtime.mjs`; focused contracts and touched module syntax checks pass |
| 4 | Project store is a mutation hub, not a command system | Fixed, verified | `bobercad/app/engine/store/project-command-store.mjs`; `bobercad/app/engine/store/project-store-trim-methods.mjs`; `bobercad/app/engine/store/project-command-registry.mjs`; `bobercad/app/engine/store/project-command-results.mjs`; `bobercad/app/engine/store/project-transaction.mjs`; `scripts/check_repo_contracts.js`; `scripts/contracts/project_store_contracts.js` | Store mutations route through command objects/results; trim authoring methods live outside the facade; undo/redo/history state exists; direct setter scan is clean; `node .\scripts\check_repo.js` passes |
| 5 | Scene builder mixes semantic evaluation with visual assembly | Fixed, verified | `bobercad/app/engine/geometry/evaluators/fastener-evaluator.mjs`; `bobercad/app/engine/geometry/evaluators/trim-evaluator.mjs`; `bobercad/app/engine/geometry/evaluators/weld-evaluator.mjs`; `bobercad/app/rendering/scene/scene-geometry-builder.mjs`; `scripts/check_repo_contracts.js` | Touched module syntax OK; scene/evaluator import smokes OK; direct `buildScene` sample smoke passed; `node .\scripts\check_repo.js` passes |
| 6 | Smart Component primitive vocabulary is still app-core | Fixed, verified | `bobercad/app/engine/api/model/connection-primitive-registry.mjs`; `bobercad/app/engine/api/model/connection-primitive-manifest.mjs`; `bobercad/app/engine/modules/smart-components/smart-component-recipe.mjs`; `bobercad/app/engine/modules/smart-components/smart-component-runtime.mjs`; `bobercad/app/engine/modules/smart-components/smart-component-registry.mjs` | Syntax OK; operation input contract rejects unknown keys; headless catalog loads 23 definitions and 24 presets; `node .\scripts\check_repo.js` passes |
| 7 | Engine Smart Component registry imports data-library UI | Fixed, verified | `bobercad/app/engine/modules/smart-components/smart-component-registry.mjs`; `bobercad/app/engine/modules/smart-components/smart-component-parameters-and-definition.mjs`; `bobercad/app/ui/viewer/smart-component-ui-loader.mjs`; `bobercad/app/ui/viewer/viewer-runtime.mjs`; `bobercad/app/schemas/smart-component-register.schema.json`; `bobercad/data/libraries/smart-components/smart-component-register.json`; deleted `bobercad/data/libraries/smart-components/member-pick-smart-component-library-ui.mjs`; `docs/architecture/folder-structure.md`; `docs/exec-plans/active/0007-professional-ui-design-system.md` | `rg` scan: no engine imports from `data/libraries`; Smart Component register schema validation OK; `node .\scripts\check_repo.js` passes |
| 8 | Plate sketch engine/controller layers are monoliths | Fixed, verified | `bobercad/app/engine/api/project/plate-sketch-relations-and-bends.mjs`; modules under `bobercad/app/engine/api/project/plate-sketch/`; `bobercad/app/rendering/interaction/plate-sketch-drag-edit-controller.mjs`; modules under `bobercad/app/rendering/interaction/plate-sketch/`; `scripts/check_repo_contracts.js` | Bundled Node `--check` OK for touched `.mjs` files; engine/controller import smokes OK; split guardrails added; plate-like cutting-body sketch drag smoke passes; `node .\scripts\check_repo.js` passes |
| 9 | Inspector and workspace customizer are product logic hubs | Fixed, verified | `bobercad/app/ui/viewer/panels/inspector-panel.mjs`; `bobercad/app/ui/viewer/panels/contributions/smart-component-properties.mjs`; `bobercad/app/ui/shell/workspace-customizer-panel.mjs`; `bobercad/app/ui/viewer/viewer-workspace-bindings.mjs`; `bobercad/app/ui/viewer/viewer-command-registration.mjs`; `bobercad/app/ui/commands/data-dock-metadata.mjs`; `bobercad/app/ui/commands/inspector-dock-metadata.mjs`; `scripts/check_repo_contracts.js` | Inspector sections are generated metadata/binding driven; Data Dock and Inspector tabs derive from metadata/workspace panel state; legacy active-tab migration is blocked; `node .\scripts\check_repo.js` passes |
| 10 | Domain validation lags runtime invariants | Fixed, verified | `scripts/validate_domain_model.js`; `scripts/check_repo.js`; `scripts/check_repo_contracts.js`; sample project JSON objectIndex/assembly fixes | Dedicated domain validator checks objectIndex, fastener basis refs, Smart Component refs, connection zones, trim operations, and plate sketches across 27 projects; `node .\scripts\check_repo.js` passes |

## Change Notes

### 2026-06-20

- Created this remediation log to track implementation status and verification.
- Spawned helper agents for validation/contracts, Smart Component boundaries, and read-only refactor mapping.
- Added strict repository contract checks for the audited validation gaps: renderer/exporter `placementIntent` geometry fallback use, `.mjs?v=` module specifiers, app/engine Smart Component UI imports, and explicit fastener group render basis refs in sample projects.
- Verification uses bundled Node at `C:\Users\t93to\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.
- Fixed issue 1:
  - Removed renderer fallback from `fastenerGroupBasis`; it now requires `through.fromFeatureId` and resolves the basis from that feature only.
  - Removed obsolete renderer helpers that supported fallback to plate-like participants/hosts.
  - Required `fastenerGroup.through.fromFeatureId` in store validation and project schema.
  - Updated stair railing panel fixings to create explicit hole-pattern features and set `through.fromFeatureId`.
  - Regenerated stair sample projects with `scripts/generate_stair_samples.mjs`.
  - Verified all project JSON fastener groups now have explicit `through.fromFeatureId`.
- Fixed issue 2:
  - Removed source-level `?v=` cache keys from app module/CSS/HTML/JSON references.
  - Verified `rg -n "\\?v=" bobercad\\app` returns no matches.
- Fixed issue 3:
  - Extracted progressive render scheduling, queued rerenders, detail-refresh scheduling, focused object patching, LOD radius scoring, and Smart Component detail-object expansion into `viewer-render-scheduler.mjs`.
  - Extracted QA screenshot mode, QA view fitting, DOM QA request/response bridge, initial snap smoke, debug target capture, and the `window.__boberCadQa` API into `viewer-qa-bridge.mjs`.
  - Extracted Data Dock/Inspector panel specs, workspace tab state helpers, dock synchronization, workspace change fan-out, feature-navbar grouping, and nav-cube overlay/dock clearance behavior into `viewer-workspace-bindings.mjs`.
  - Extracted viewer command item assembly, command state helpers, handler map composition, left-dock result command routing, settings-strip render visibility handlers, snap/scope handlers, grid-editor command routing, and active modeling command state into `viewer-command-registration.mjs`.
  - Rewired `viewer-runtime.mjs` to compose the scheduler, QA bridge, workspace bindings, and command registration directly; the runtime current working-copy line count is 920 lines, down from 1,702 before this issue-3 completion pass and 2,616 before the first extraction.
  - Removed obsolete local scheduler, QA, workspace binding, and command registration helper bodies from `viewer-runtime.mjs`.
  - Added contract checks requiring the extracted viewer workspace/command modules and rejecting reintroduced policy bodies in `viewer-runtime.mjs`.
  - Verified touched `.mjs` files with bundled Node `--check`.
  - Verified `scripts/check_repo_contracts.js` passes after the split guardrail update.
- Fixed issue 4:
  - Added immutable project command result envelopes with command type, changed object ids, removed object ids, regenerated object ids, and diagnostics.
  - Added a project transaction helper and routed replacement commands through transaction commits.
  - Store subscribers now receive the latest command result as a second argument, and `lastCommandResult()` exposes the committed envelope for controller/viewer callers.
  - Member replacement records generated Smart Component ids affected by regeneration instead of forcing callers to infer refresh scope.
  - Added `project-command-registry.mjs` so store commits execute command objects instead of direct project setters.
  - Migrated direct mutation helpers through `commitProject`, `commitTransaction`, or command wrappers.
  - Added `historyState()`, `undo()`, and `redo()` to the store and contract checks blocking `setProject(` / `setRegeneratedSmartComponent` from returning.
  - Fixed command metadata normalization so omitted/null regenerated ids become an empty command result list instead of failing runtime checks.
- Fixed issue 5:
  - Added a headless fastener evaluator under `bobercad/app/engine/geometry/evaluators`.
  - The evaluator resolves `fastenerGroup.through.fromFeatureId`, validates indexed feature, hole-pattern, and fastener catalog references, evaluates the feature basis, computes world-space fastener positions, and returns semantic grip data.
  - `scene-geometry-builder.mjs` now adapts evaluated fastener data into shank, head, washer, nut, and pick geometry only.
  - Removed fastener catalog lookup, grip-length resolution, and fastener basis helper code from the scene builder.
  - Added contract checks that require the evaluator boundary and reject inline fastener basis/reference resolution in rendering.
  - Extracted trim semantic evaluation into `trim-evaluator.mjs`, including trim-joint participant intersection, member end resolution, butt/miter/profile-cope feature synthesis, plane-trim region features, and marker planes.
  - Extracted weld semantic evaluation into `weld-evaluator.mjs`, including plate support-edge interface resolution, support-edge clipping around clearance cuts, weld run face generation, and member-profile weld loops.
  - `scene-geometry-builder.mjs` now adapts evaluated trim/weld output into faces, lines, callouts, and metadata; obsolete weld and trim helper implementations were removed from rendering.
  - Added contract checks requiring the trim/weld evaluators, rejecting stale trim/weld helper names in the scene builder, and blocking inline `weld.reference` resolution in rendering.
  - Verified touched modules with bundled Node `--check`, evaluator and scene-builder import smokes, and a direct `buildScene` smoke on `sample_beam_to_beam_fin_plate.json`.
- Fixed issue 6:
  - Replaced the static Smart Component primitive map with a pure operation registry and an app-owned connection primitive manifest.
  - Added strict operation input contracts; recipe config inputs and runtime operation inputs now reject unregistered keys.
  - Registered connection primitive operations before recipe catalog loading and runtime execution.
  - Verified changed module syntax with bundled Node and verified the operation contract rejects unknown keys.
- Fixed issue 7:
  - Removed data-library UI imports from the headless Smart Component registry and removed UI injection from `defineSmartComponent`.
  - Added a viewer-side Smart Component UI loader and changed the viewer to mount component parameters through that UI contribution instead of `definition.customUi`.
  - Removed obsolete register-level `libraryUi` data/schema contract and deleted the unused `member-pick-smart-component-library-ui.mjs`.
  - Verified the headless catalog loads 23 definitions and 24 presets with no `customUi` fields.
  - Verified `rg -n "from .*data/libraries|import\\(.*data/libraries" bobercad/app/engine -g "*.mjs"` returns no matches.
  - Verified `rg -n "customUi|libraryUi|member-pick-smart-component-library-ui|attachSmartComponentUi|mountSmartComponentLibraryUi" bobercad/app bobercad/data/libraries/smart-components -g "*.mjs" -g "*.json"` returns no matches.
  - Verified `scripts/validate_json_schema.js` passes for `bobercad/data/libraries/smart-components/smart-component-register.json`.
  - Nested Smart Component connections now emit `component-scope` interfaces when their owners are child component instances, instead of writing incomplete physical face interfaces.
  - Regenerated stair sample projects and verified `scripts/validate_json_schema.js` passes for `sample_stair_straight_basic.json`.
  - Full `scripts/check_repo.js` now passes.
- Fixed issue 8:
  - Extracted pure sketch/plate shape readers into `bobercad/app/engine/api/project/plate-sketch/model-accessors.mjs`.
  - Extracted relation type constants, dimension modes, relation keys, target ID readers, labels, badges, and driven/driving dimension predicates into `bobercad/app/engine/api/project/plate-sketch/relation-metadata.mjs`.
  - Extracted sketch geometry/relation normalization into `bobercad/app/engine/api/project/plate-sketch/sketch-geometry-and-relations.mjs`.
  - Extracted plate model/placement normalization and create helpers into `bobercad/app/engine/api/project/plate-sketch/model-and-placement.mjs`.
  - Extracted relation solving, definition/health analysis, dimension setters, and relation host mutation into `bobercad/app/engine/api/project/plate-sketch/solver-and-relations.mjs`.
  - Extracted construction-line, insert/remove vertex, and notch topology edits into `bobercad/app/engine/api/project/plate-sketch/topology.mjs`.
  - Extracted bend normalization and bend add/remove behavior into `bobercad/app/engine/api/project/plate-sketch/bend-normalization.mjs` and `bobercad/app/engine/api/project/plate-sketch/bends.mjs`.
  - Rewired `bobercad/app/engine/api/project/plate-sketch-relations-and-bends.mjs` as a stable public facade and removed the obsolete inline solver/topology/bend/placement implementations.
  - Extracted plate-sketch dimension overlay building into `bobercad/app/rendering/interaction/plate-sketch/dimension-overlay.mjs`.
  - Extracted shared sketch-edit geometry and relation display helpers into `bobercad/app/rendering/interaction/plate-sketch/sketch-edit-geometry.mjs` and `bobercad/app/rendering/interaction/plate-sketch/relation-display.mjs`.
  - Rewired `bobercad/app/rendering/interaction/plate-sketch-drag-edit-controller.mjs` to compose those modules and removed the obsolete inline overlay/helper bodies.
  - Added `scripts/check_repo_contracts.js` guardrails requiring the new focused modules and rejecting the old monolith/controller bodies.
  - Verified touched modules with bundled Node `--check`; verified engine facade and controller imports.
  - Fixed the extracted solver's missing `plainObject` helper so plate-like cutting-body vertex drags update `body.outline`.
  - Verified `scripts/check_viewer_runtime.js` passes, including the cutting-body sketch drag smoke.
- Fixed issue 9:
  - Moved Smart Component quick parameter field assembly out of the generic inspector and into `panels/contributions/smart-component-properties.mjs`.
  - The inspector now delegates quick Smart Component parameter fields to that contribution while keeping generated property binding at the panel edge.
  - Removed workspace customizer legacy active-tab migration code and deleted the obsolete Data Dock/Inspector active-tab storage-key metadata exports.
  - Updated contract checks to reject reintroducing legacy active-tab migration and to require quick parameter assembly in the contribution module.
  - Updated viewer runtime/workspace contracts to guard the extracted routing modules instead of forcing policy bodies back into `viewer-runtime.mjs`.
  - Verified Data Dock tabs, Inspector contexts, settings strip state, feature navbar groups, and snap command state are metadata/workspace driven.
- Fixed issue 10:
  - Added `scripts/validate_domain_model.js`.
  - Wired the domain validator into `scripts/check_repo.js` between repository structure checks and viewer runtime smoke.
  - Validator checks indexed model collections, objectIndex consistency, assembly references, connection zone links, Smart Component parent/role/owned-object refs, fastener `through.fromFeatureId`, trim operation/member/plane refs, and plate sketch vertices/edges/relations.
  - Added missing objectIndex entries for datum collections in sample projects and removed a trim-joint id from an assembly `featureIds` list.
- Final audit correction:
  - `docs/architecture/app-architecture-audit.md` now records every top-10 item with Current Score `0`.
  - Verification is the full bundled Node `scripts/check_repo.js` run plus targeted scans for cache keys, legacy tab storage, engine UI imports, direct store setters, and renderer fallback helper reintroduction.
- Post-completion architecture re-scan:
  - Re-ran the architecture scan after the zero-score pass.
  - Confirmed the original top-10 remains recorded as fixed/verified.
  - Added a fresh next-wave rating table to `docs/architecture/app-architecture-audit.md`.
  - Independent subagent scans confirmed and sharpened the next-wave scores.
  - Highest new issues: Smart Component library support files under `bobercad/data/libraries` still import app UI/private engine modules; workspace/WebGL runtime files remain large UI/runtime monoliths; and the contract checker itself is now an implementation-lock monolith.
  - Noted the guardrail gap: `scripts/check_repo_contracts.js` currently checks cache-buster import specifiers only under `bobercad/app`, so it does not catch the remaining data-library runtime imports.
  - Expanded `docs/architecture/app-architecture-rescan-table.csv` and the audit table from a top-10 list to a full high-risk register containing every current score 5, 4, and 3 finding from the scan.
  - Added `docs/architecture/app-architecture-rescan-compact-table.md` and changed the audit markdown to show a compact 5-column table instead of the full evidence/fix wall.
  - Added `scripts/architecture_line_scan.js` and generated `docs/architecture/app-architecture-file-audit.csv` plus `docs/architecture/app-architecture-line-findings.csv`.
  - The line scan currently covers 334 files and 954,808 lines across app, data libraries, project samples, scripts, tools, and architecture docs; after false-positive triage it reports 118 raw findings grouped into the high-risk register.
- Zero-score completion pass:
  - Split `project-command-store.mjs` further with model helpers, Smart Component helper/method modules, and plate-sketch store methods.
  - Split Smart Component runtime into validation, model helpers, catalog, instance helpers, creation, build, overrides, patch application, and option modules.
  - Split plate-sketch solver/runtime responsibilities into solver core, relation analysis, relation mutations, relation preview, drag helpers, drag mutations, dimensions, overlays, snap, targets, and geometry modules.
  - Split WebGL runtime into render orchestration, controls, object preview, picker, pick-color state, highlight policy, draw utils, programs, and view state modules.
  - Split scene builder into annotation metadata, line/face assembly, feature cutters, member adapters, datum/reference assembly, and object geometry adapters.
  - Split workspace customizer into commands, state, dialog, mount, manager, toolbar DOM, panel dock, ordering, labels, and file IO modules.
  - Split inspector panel/property responsibilities into plate-sketch contribution, scene metrics, editable object metadata, support object metadata, and parameter UI style modules.
  - Split large repository checks into Smart Component quick-property contracts, Smart Component lifecycle contracts, and viewer runtime helper contracts.
  - Removed artificial scene-builder contract marker comments and updated contracts to verify the new owner modules directly.
  - Updated `docs/architecture/app-architecture-audit.md`, `docs/architecture/app-architecture-rescan-compact-table.md`, and `docs/architecture/app-architecture-rescan-table.csv` so the former 55-row high-risk register now shows Current Score `0` for every row.
  - Verification: `scripts/check_repo.js` passes; `scripts/architecture_line_scan.js` reports `404` scanned files, `957,368` lines, and `0` findings; full JS/MJS syntax sweep under `bobercad/app` and `scripts` passes for `246` files.
- External review P3 follow-up:
  - Updated the stale WebGL renderer map so it points to current WebGL modules and `bobercad/app/ui/viewer/dimensions/dimension-overlay-ui.mjs`, not the removed `dimension-label-editor-ui.mjs`.
  - Moved trim-joint authoring store methods from `project-command-store.mjs` to `bobercad/app/engine/store/project-store-trim-methods.mjs`.
  - Split project-store contract checks into `scripts/contracts/project_store_contracts.js` and added a guard that blocks trim methods from being pasted back into the store facade.
  - Hardened `project.schema.json`: root project objects, `model`, and every model collection item definition now reject unknown fields; dynamic bags such as `addonData`, Smart Component inputs, and BIM property sets remain explicit schema properties.
  - Removed obsolete top-level `gridPlacement.referenceLevel/referenceGridY` metadata from `sample_seed_connection_structure.json` instead of carrying a compatibility shape.
  - Added `scripts/contracts/project_schema_contracts.js` to block reopening root/model/model-item schemas.
  - Current verification: `scripts/check_repo.js` passes; `scripts/architecture_line_scan.js` reports `407` scanned files, `957,661` lines, and `0` findings; full JS/MJS syntax sweep under `bobercad/app` and `scripts` passes for `249` files; browser startup smoke on port `8010` reports title `Bobercad Viewer` and `0` console/page errors.
