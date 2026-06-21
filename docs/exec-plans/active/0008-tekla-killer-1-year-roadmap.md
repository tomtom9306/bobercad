# 0008 Tekla-Killer 1-Year Roadmap

## Status

Planning-only investigation document.

This replaces the first draft of this plan. The first draft was too generic. This version is anchored in the current repository, current app architecture, actual sample data, actual gaps, and the current Tekla competitive baseline checked from official Trimble/Tekla sources on 2026-06-20.

## Goal

Make BoberCAD a serious steel BIM, detailing, fabrication, and AI-authoring product within 12 months, using a coordinated 100-agent development organization.

The goal is not to clone every Tekla dialog. The goal is to beat Tekla on the things where an AI-native, semantic-model-first app can win:

- faster authoring from intent
- safer regeneration after manual edits
- traceable connection automation
- continuous model and fabrication auditing
- reviewable AI changes
- production outputs from explicit semantic data
- collaboration and revision clarity

## External Competitive Baseline

Official Tekla/Trimble material describes the modern Tekla target as more than modeling:

- constructible steel detailing with automatic parametric tools, components, fabrication data, construction documentation, production planning, automated production, connected delivery, and Model Sharing
- DSTV NC export from model data, including part lengths, holes, bevels, notches, cuts, pop marks, contour marks, MIS lists, and logs
- AI-assisted fabrication drawing creation with human-in-the-loop review
- project settings management through cloud environments
- real-time collaboration, status sharing, Trimble Connect integration, PowerFab integration, layout/as-built workflows, and natural-language assistant features

Sources checked:

- https://www.tekla.com/solutions/steel-detailing
- https://support.tekla.com/doc/tekla-structures/2026/int_create_nc_files
- https://support.tekla.com/doc/tekla-structures/2026/rel_cover
- https://support.tekla.com/sv/doc/tekla-structures/2025/rel_cover
- https://news.trimble.com/Trimble-Unveils-2026-Tekla-Software-Accelerating-BIM-Engineering-and-Construction-Productivity-Through-Streamlined-Workflows-and-AI
- https://news.trimble.com/2025-03-12-Trimble-Expands-Connected-Workflows-in-Tekla-Structures-2025

Implication: "Tekla killer" cannot mean "nice viewer plus some connections." It means a complete delivery chain: model, detail, check, number, draw, export, fabricate, revise, collaborate, and automate.

## Repository Investigation Summary

### What BoberCAD Is Today

BoberCAD is currently an early steel BIM platform kernel. It is stronger than a viewer, weaker than a production detailing product.

Evidence from this repo:

- 27 project samples under `bobercad/data/projects`.
- 29 viewer demo targets in `bobercad/app/ui/viewer/viewer-settings.json`.
- Project schema covers members, plates, sketches, hole patterns, object patterns, features, trim joints, fastener groups, welds, interfaces, connection zones, assemblies, Smart Component instances, relations, grid systems, levels, work points, and reference planes.
- Sample corpus totals, across all sample projects:
  - 847 members
  - 2033 plates
  - 1301 features
  - 1161 hole patterns
  - 1168 fastener groups
  - 503 trim joints
  - 460 assemblies
  - 379 interfaces
  - 360 Smart Component instances
  - 245 object patterns
  - 188 reference planes
  - 105 welds
- Largest samples:
  - `sample_stair_all_variants.json`: 3373 stored model objects across counted collections.
  - `sample_warehouse_12x24.json`: 1446 stored model objects across counted collections.
  - `sample_stair_helical.json`: 560 stored model objects across counted collections.
- Smart Component register has 23 component configs:
  - connection: fin plate, moment end plate, base plate, stair hardware, member splice, apex gusset
  - stairs: stair system, path flight, landings, tread families, support families, railing families, transport sections
  - frames/buildings: portal frame, warehouse
- `api-register.json` lists 94 public API entries.
- `createProjectStore()` exposes 105 headless methods, including creation/editing of members, plates, sketches, grids, levels, trims, features, Smart Components, relations, and object updates.
- Command registry has 77 command entries, but most are view, settings, shell, snap, and navigation commands. Only 9 are model-facing and only 1 is structural-analysis-facing.
- The renderer derives geometry from semantic JSON through `scene-geometry-builder.mjs`; generated meshes are not written back to project JSON.
- There is a real professional UI effort: design tokens, shell, command palette, docks, inspector, model browser, data dock, Smart Component browser, icons, workspace customization, and snap controls.
- There is a real Smart Component runtime: recipes, build modules, stable roles, child components, overrides, detach/reattach, suppression, diagnostics, regeneration, and explicit stored output objects.
- There is a real annotation/dimension framework driven by component `config.json` dimension definitions.
- There are QA and stress tools, but some are stale.

### Current Product Shape

Use this classification for planning:

| Product area | Current state | Judgment |
| --- | --- | --- |
| Semantic project model | Broad and coherent | Strong foundation |
| Viewer geometry | Working, steel-specific, semantic-derived | Good early kernel |
| UI shell | Substantial professional rewrite underway | Promising but not product-complete |
| Authoring commands | Beam/column/plate/sketch/work plane/bend/trim/member edit exist | Early workflow, not daily production parity |
| Snapping/selection | Unified route in progress | Correct architectural direction |
| Smart Components | Real runtime and catalog | Strong differentiator if hardened |
| Connections | Fin plate is deep; other families are thin | Major catalog gap |
| Stairs/platform-like systems | Strong sample coverage | Unusual early strength |
| Fabrication output | Data model is NC1-ready; exporter absent | Critical gap |
| Drawings | Annotations exist; drawings module was intentionally removed as placeholder | Critical gap |
| Numbering | Fields exist; workflow absent | Critical gap |
| Structural design/checking | UI placeholder and component design assumptions exist | Critical gap |
| Interop | No productized IFC/STEP/import/export | Critical gap |
| Collaboration | Workspace prefs exist locally; no multi-user model workflow | Critical gap |
| Domain validation | Schema checks only plus repo contracts | Critical gap |
| Libraries | Starter packs are demo/not certified | Critical gap |
| Performance | Viewer smoke includes large synthetic members; real budgets absent | Needs formal targets |

## Non-Negotiable Repo Rules

These remain valid even if architecture changes:

- Project JSON stores semantic model data only.
- Do not store meshes, vertices, triangles, B-reps, scene graph data, generated geometry, drawing linework, NC output, IFC output, or STEP output in project JSON.
- Do not add OpenCascade or a general CAD kernel to the core model.
- Keep `objectIndex` stored and authoritative until a deliberate migration replaces it.
- Use `modelDefaults` for repeated semantic values.
- `placementIntent` is metadata only; it must not render, export, or generate hidden geometry.
- Profiles are point-based `[y, z]` contours.
- Fasteners live in library packs and are referenced by `fastenerRef`.
- Use `workPoints`, `referencePlanes`, `holePatterns`, and `objectPatterns` for authoring intent.
- Smart Components are authoring provenance. Project objects remain the source of truth.
- Connections use stored `interfaces` and `connectionZones`; no vague proximity inference.
- BIM metadata lives inside objects as `bim`.
- If model structure changes, schema changes in the same change.

## Brutal Gap Assessment

### Gap 1: Stale Architecture In Tools

Some scripts still reference deleted/legacy concepts:

- `tools/demo/generate_warehouse_hall_12x24.mjs`
- `tools/stress/generate_eiffel_tower_stress.mjs`
- `tools/stress/generate_warehouse_hall_stress.mjs`
- `tools/stress/benchmark_member_move.mjs`

Observed stale patterns:

- `model.connections`
- `createConnectionFromPreset`
- connection IDs on assemblies from removed connection architecture

This matters because 100 agents will copy whatever patterns exist. Stale scripts must be treated as blockers before scaling parallel work.

### Gap 2: Production Outputs Do Not Exist

The model is deliberately NC1-ready, but there is no production NC1/DSTV writer, no MIS list, no exporter settings, no golden output fixtures, no logs, no plate/profile selection policy, and no user workflow.

This is the largest gap between BoberCAD and Tekla-class value.

### Gap 3: Drawings Are Not A Product Yet

There is a useful 3D annotation framework, but fabrication drawings are not implemented. Earlier placeholder drawing modules were removed deliberately, which is good. They need to return as real artifact generators with sheet/view/template/dimension/mark/table semantics outside project JSON.

### Gap 4: Authoring Is Not Yet A Day-To-Day Detailer Workflow

The app can create and edit important objects, but it lacks the full production command set:

- copy, mirror, array, rotate, align, extend, split, shorten, chamfer, fit, cope, cut
- command history and undo/redo across all object types
- save/load as a user workflow
- selection sets, filters, isolate/hide/show
- robust object/pattern editing
- fast hole/bolt/weld tools
- project templates and working units

### Gap 5: Connection Catalog Is Too Small

Fin plate is the best-developed connection. To compete, the app needs dozens of connection families, each with:

- placement rules
- compatible interfaces/zones
- explicit stored plates/features/hole patterns/fasteners/welds/trims
- parameter UI
- dimension definitions
- diagnostics
- role stability tests
- fabrication readiness tests
- optional design checks

### Gap 6: Design Checks Are Mostly Intent

Current Smart Component configs include design assumptions like `standard: EN 1993-1-8` and `status: not-calculated`. This honesty must remain. Do not pretend calculations exist. Build a real rule/check framework and reports.

### Gap 7: Validation Is Too Thin

Current validation is mostly schema and repo contract checks. Tekla-class development needs separate validators for:

- model references
- objectIndex
- library refs
- material/profile/fastener existence
- trim/feature/hole consistency
- Smart Component lifecycle
- connection zone integrity
- fabrication readiness
- duplicate bolts/hole clashes
- impossible geometry
- numbering/mark conflicts
- drawing/export readiness

### Gap 8: Collaboration Is Missing

Tekla is pushing live collaboration, Model Sharing, status sharing, and connected data workflows. BoberCAD has local workspace preferences and browser storage, but no project server, permissions, revision graph, comments, issues, locks, merge, or artifact history.

### Gap 9: Libraries Are Demo Scope

Starter profile/material/fastener packs are not certified for fabrication. A real product needs region-scoped certified packs with versioning, source references, migration policy, and QA.

### Gap 10: 100 Agents Need An Operating System

Without work-package boundaries, contracts, fixtures, and review gates, 100 agents will create collisions and shallow features. The plan needs the agent workflow as part of the product architecture.

## Product Thesis

BoberCAD should not try to win by being "Tekla but cheaper."

It should win by being:

1. AI-native.
2. Semantic-first.
3. Traceable.
4. Fabrication-native.
5. Human-reviewable.

The promise:

> A detailer can describe intent, inspect every generated object, preserve manual edits, validate fabrication readiness, generate drawings/NC/reports, and review every AI change as a semantic diff with screenshots and diagnostics.

## Tekla-Killer Feature Bets

### Bet 1: Continuous Model Auditor

Always-on model QA that finds:

- broken references
- missing material/profile/fastener refs
- invalid objectIndex entries
- unnumbered parts
- unexportable members
- duplicate bolts
- hole/edge distance risk
- impossible cuts
- fastener/plate clashes
- members that pass through other objects without trims
- Smart Component role drift
- detached component objects that need review
- drawing/export stale artifacts

Why it can beat Tekla:

- The JSON semantic model makes object reasoning explicit.
- AI agents can explain fixes, not just show warnings.

### Bet 2: Intent-To-Steel Authoring

User enters grids, levels, roof slopes, bay spacing, stair/platform intent, or connection intent. Agents propose:

- work points
- reference planes
- members
- plates
- object patterns
- interfaces
- connection zones
- assemblies
- Smart Component instances
- diagnostics

The user accepts a reviewed diff, not hidden generated geometry.

### Bet 3: Connection Autopilot With Reasons

For a selected zone, the app proposes connection families and parameters based on:

- member types/profiles
- interface orientation
- loads/design assumptions if available
- fabrication preferences
- shop standards
- access/erection constraints

Every output plate, fastener, weld, cut, trim, and stiffener has a role and reason.

### Bet 4: Regeneration That Respects Manual Detailing

This is already architecturally plausible because Smart Components support stable roles, overrides, detach/reattach, suppression, and diagnostics.

Make this a flagship feature:

- "regenerate safely"
- "show what would change"
- "preserve my manual edit"
- "reset this one field"
- "detach this plate"
- "reattach with review"

### Bet 5: AI-Assisted Fabrication Pack

From one semantic model:

- numbering
- NC1/DSTV files
- MIS/part lists
- bolt lists
- weld lists
- material takeoff
- assembly reports
- fabrication drawings
- erection drawings
- IFC coordination export
- revision delta

Generated artifacts live outside project JSON and link to model revision IDs.

### Bet 6: Drawing AI That Is Verifiable

Tekla has AI cloud fabrication drawing direction. BoberCAD should respond with:

- drawing templates from company standards
- AI view/template suggestions
- human-in-the-loop approval
- associativity to semantic objects
- stale drawing diagnostics
- before/after drawing diff
- automatic screenshot QA

### Bet 7: Semantic Collaboration

Instead of only file locking:

- object-level semantic diff
- zone/component ownership
- issue/comment pins on objects
- AI change proposals as reviewable patches
- artifact lineage
- merge/conflict diagnostics

## Architecture Changes Worth Making

### 1. Domain Validation Engine

Add `scripts/check_model_domain.js` or similar. Keep it separate from `validate_json_schema.js`.

Validator layers:

- `shape`: JSON schema only.
- `reference`: IDs and objectIndex.
- `library`: material/profile/fastener/component refs.
- `geometry-intent`: trims, holes, cuts, work planes, interfaces.
- `component`: Smart Component roles, ownership, detach, suppression.
- `fabrication`: numbering, NC1 readiness, machine constraints.
- `drawing`: drawing artifact staleness/readiness.
- `design`: assumptions and calculation status.

This should become mandatory in `check_repo.js` after stale scripts are cleaned.

### 2. Command Journal And Revision Graph

The project store is already the mutation boundary. Add:

- command records
- before/after semantic patches
- undo/redo
- revision IDs
- AI provenance
- artifact provenance
- diff summaries

Storage location:

- current project JSON may store final semantic state only
- journal/revisions can live in sidecar files or backend tables
- do not store preview/scene/generated geometry

### 3. Steel Geometry Kernel, Not General CAD Kernel

Do not add OpenCascade to the core. Do add a focused steel geometry service:

- profile contour evaluation
- analytic line/arc/helix centerlines
- member face/interface resolution
- plate sketch/extrusion
- steel-specific CSG for holes/cuts/trims
- plate unfolding for bends
- NC coordinate extraction
- clash and clearance checks

This can run in workers/CLI/server and produce derived artifacts/caches outside project JSON.

### 4. Artifact System

Add an artifact boundary for generated outputs:

- NC files
- drawings
- PDFs
- DXF/SVG
- IFC
- reports
- screenshots
- validation reports
- calculation reports

Artifact metadata should include:

- artifact id
- artifact type
- project revision id
- generator version
- settings version
- source object IDs
- diagnostics
- file paths/hashes

Artifacts are not project model JSON.

### 5. Library Versioning And Certification

Add library metadata:

- region
- standard
- source
- certified scope
- reviewer
- version
- migration notes
- test fixtures

Libraries to version:

- profiles
- materials
- fasteners
- welds
- hole rules
- drawing templates
- Smart Components
- design rule packs
- exporter settings

### 6. Plugin/Component Capability Boundary

Smart Component build modules are powerful. Before marketplace-scale growth, add:

- deterministic output requirements
- allowed API capabilities
- no direct filesystem/network in component builds
- diagnostics contract
- fixture contract
- performance budget
- compatibility version

### 7. Workerized Pipelines

Move expensive derived work behind job boundaries:

- scene building
- clash detection
- model audit
- export preview
- drawing generation
- screenshot QA
- performance stress

Use the same headless APIs in browser, CLI, and server.

### 8. Collaboration Backend

Later in the year, add a service for:

- projects
- revisions
- locks
- comments
- object issues
- artifacts
- agent jobs
- users/roles
- merge/conflict records

The backend stores metadata and revisions; project model rules still apply.

## 100 Code-Agent Organization

In this plan, all 100 agents are code-development agents. They write code, schemas, tests, fixtures, docs tied to implementation, exporters, UI, validators, and infrastructure. Product direction and final prioritization are human-owned. Review and integration are duties inside the coding process, not separate non-coding headcount.

The practical shape is 20 coding pods of 5 agents. Each pod can run as:

- 3 feature builders
- 1 test/fixture/validation builder
- 1 integration/review builder

The review builder still writes code: failing tests, contract checks, fixture updates, small fixes, and merge-hardening patches. The role rotates weekly so no agent becomes only a manager.

| Coding workstream | Code agents | Primary code output |
| --- | ---: | --- |
| Model/schema core | 8 | schemas, migrations, defaults, objectIndex tools, model APIs |
| Validation and test infrastructure | 8 | domain validators, sample inventory, golden fixtures, CI contracts |
| Project store, journal, persistence | 7 | command journal, undo/redo, save/load, semantic diffs |
| Authoring controllers and snapping | 10 | modeling commands, snap providers, manipulators, selection workflows |
| UI shell, inspector, commands | 6 | command UI, inspector panels, workspace shell, accessibility fixes |
| Geometry/rendering/workers | 8 | scene builder, CSG, LOD, workerized geometry, picking, clash geometry |
| Smart Component runtime and SDK | 8 | role stability, overrides, detach/reattach, component SDK, lifecycle tests |
| Connection catalog and primitives | 12 | connection families, registered primitives, dimensions, diagnostics |
| Stairs, platforms, buildings | 5 | stair hardening, platforms, ladders, warehouse/frame generators |
| Fabrication, exporters, numbering | 9 | numbering, NC1/DSTV, MIS lists, reports, exporter diagnostics |
| Drawings and artifact generation | 7 | drawing artifact model, sheets, views, templates, PDF/SVG/DXF |
| Structural and rule checks | 4 | load/check model, rule packs, calculation reports |
| Interop and import/export | 3 | IFC, reference import, catalog import/export, mapping diagnostics |
| Collaboration/backend | 3 | revision service, locks, comments, issues, artifact/job APIs |
| DevEx, performance, security | 2 | benchmark harness, sandbox checks, release tooling |

This totals 100 code-development agents.

### Code Ownership For 100 Agents

To keep 100 coding agents productive, ownership must be stricter than normal:

- each workstream owns a file/module map
- each pod owns one PR-sized slice at a time
- schema collections can have only one active owner
- shared APIs require an accepted interface note before implementation
- component families cannot be edited by two pods at once
- exporters consume validator contracts instead of private geometry assumptions
- UI pods mutate project data only through public project-store APIs
- merge windows happen on an integration branch, not directly on the main branch

### Parallel Coding Cadence

Daily cadence:

1. 100 agents pull latest integration branch.
2. Pods claim work packages from the current month plan.
3. Each pod creates a short branch with one deliverable.
4. Builders implement; validation builder adds tests/fixtures in the same branch.
5. Review builder runs checks and fixes small contract failures.
6. Integration queue merges only green branches.
7. Failed branches are repaired or split, not force-merged.

Hard limits:

- target PR size: 1 to 8 files for routine work, 15 files for schema-wide changes
- max active schema migrations: 1
- max active exporter contract changes: 1
- max active project-store mutation contract changes: 1
- generated artifacts never go into project JSON
- stale architecture patterns block merge

Every work item must define:

- objective
- files owned
- model/schema impact
- sample fixtures
- acceptance checks
- docs to update
- rollback path

## Agent Operating System

### Work Package Format

Every task should be written as:

```text
ID:
Owner workcell:
Objective:
Repo context:
Files likely touched:
Data model impact:
Schema impact:
Samples required:
Validation required:
Visual/export artifacts required:
Acceptance gate:
Known non-goals:
```

### Parallelization Rules

- Only one workcell owns a schema collection at a time.
- Only one workcell owns a Smart Component family at a time.
- Exporter and drawing teams consume stable validator contracts, not private assumptions.
- UI teams use public project store APIs only.
- Component teams use public model APIs and registered primitives only.
- Stale patterns are blockers.
- Agents must update docs before conflicting architecture changes.

### Review Gates

Every PR-sized change must answer:

- Did `check_repo.js` pass?
- Did schema validation pass for touched JSON?
- Did domain validation pass, if available?
- Did sample counts change intentionally?
- Did generated artifacts stay outside project JSON?
- Did `objectIndex` remain correct?
- Did UI preferences stay outside project JSON?
- Did component regeneration preserve overrides/detach behavior?
- Did exporter/drawing output derive only from stored semantic data?

## 12-Month Roadmap

### Month 1: Foundation Reality Pass

Goal: make the repo safe for 100 code-development agents working in parallel.

Deliverables:

- Remove or migrate all stale `model.connections` and `createConnectionFromPreset` scripts.
- Add stale-pattern guard to repo contracts.
- Add `docs/quality/test-matrix.md`.
- Add `docs/workflows/agent-work-packages.md`.
- Add sample inventory script with expected counts.
- Add domain validator skeleton:
  - objectIndex references
  - missing material/profile/fastener refs
  - missing owner refs
  - bad holePattern refs
  - bad Smart Component ownedObjectIds/objectRoles
  - bad assembly/group refs
- Add scene-build smoke across every sample, not only one.
- Record which samples are render fixtures, stress fixtures, or data-only fixtures.

Exit gate:

- `check_repo.js` passes.
- No active tool references deleted connection architecture.
- Every sample has schema validation and domain validation status.
- Every renderable sample builds a scene headlessly.

Month 1 code-agent allocation:

| Workstream | Code agents | Month 1 code output |
| --- | ---: | --- |
| Validation and test infrastructure | 18 | domain validator, sample inventory, all-sample smoke, stale-pattern guard |
| Model/schema core | 10 | validator hooks, reference walkers, objectIndex utilities, fixture normalization |
| Project store, journal, persistence | 6 | mutation inventory, command-store contract tests, prep for Month 2 journal |
| Authoring controllers and snapping | 8 | investigate current snap contract failure, add targeted authoring fixture coverage |
| UI shell, inspector, commands | 5 | command coverage audit, missing command metadata, workflow entry cleanup |
| Geometry/rendering/workers | 8 | all-sample scene-build harness, render fixture classification |
| Smart Component runtime and SDK | 8 | owned-object/role validation, lifecycle fixture inventory |
| Connection catalog and primitives | 10 | stale connection cleanup, connection fixture map, primitive coverage audit |
| Stairs, platforms, buildings | 4 | stair sample classification, generator fixture expectations |
| Fabrication, exporters, numbering | 7 | NC1-readiness validator skeleton, fabrication field audit |
| Drawings and artifact generation | 4 | drawing artifact boundary plan, annotation-to-drawing code spike |
| Structural and rule checks | 3 | design-status validator, rule-pack fixture map |
| Interop and import/export | 2 | IFC/export boundary spike, catalog import audit |
| Collaboration/backend | 2 | revision/artifact sidecar prototype |
| DevEx, performance, security | 5 | branch/work-package tooling, benchmark command wrappers, component sandbox audit |

This uses all 100 agents on code-producing work in Month 1.

### Month 2: Command Journal, Undo/Redo, Save/Load

Goal: make editing trustworthy.

Deliverables:

- Add command journal in project store.
- Add undo/redo for all existing model mutations.
- Add semantic patch summaries.
- Add save/load/export project workflow.
- Add revision ID and dirty-state UI.
- Add semantic diff viewer for project snapshots.
- Add AI provenance sidecar format.

Exit gate:

- User can create/edit/delete objects, undo, redo, save, reload, and see the same model.
- Project JSON remains free of UI workspace state and generated geometry.
- Diff view can show added/removed/changed/regenerated/detached/overridden objects.

### Month 3: Authoring Core Parity

Goal: make manual modeling usable for a small steel frame.

Deliverables:

- Finish unified snapping across member, plate, sketch, work plane, trim, and transform workflows.
- Add copy, move, rotate, mirror, array, align, extend, split, trim-to-plane/member.
- Add selection filters and scope modes in real workflows.
- Add object/pattern edit UI.
- Add work point/reference plane/grid/level creation polish.
- Add plate sketch dimension-driven editing polish.
- Add fast hole/bolt/weld creation commands for manual work.

Exit gate:

- A user can build a simple portal frame with plates, holes, bolts, trims, welds, and references without hand-editing JSON.
- All commands commit semantic JSON through the project store.

### Month 4: Smart Component Platform Hardening

Goal: make regeneration safe enough for production catalogs.

Deliverables:

- Role stability snapshot tests.
- Override/detach/reattach/suppression regression tests.
- Child component lifecycle tests.
- Component compatibility checks.
- Component diagnostics report UI.
- Component SDK docs and templates.
- Component capability policy.
- Component versioning and migration plan.

Exit gate:

- Repeated regeneration does not lose intentional manual edits.
- Component failures are visible, actionable, and testable.

### Month 5: Connection Catalog V1

Goal: become useful for common steel detailing.

Deliverables:

- Harden existing:
  - fin plate
  - moment end plate
  - base plate
  - apex gusset
  - member splice
- Add priority connections:
  - double fin plate
  - shear tab variants
  - clip angle
  - seated connection
  - column splice
  - beam splice
  - bracing gusset
  - purlin cleat
  - cap plate
  - haunch
  - stiffener sets
  - rail/post base
- Add connection picker from stored interfaces/zones.
- Add batch apply, replace, regenerate, compare.
- Add bolt clash and hole-edge validation.
- Add connection visual QA matrix.

Exit gate:

- `sample_connection_test_frame.json` can be populated, changed, deleted, regenerated, and audited entirely through UI.
- Every connection outputs explicit project objects.

### Month 6: Fabrication Data, Numbering, NC1/DSTV V1

Goal: first real fabrication output.

Deliverables:

- Part and assembly numbering.
- Mark conflict detection.
- NC1/DSTV readiness validator.
- Export settings artifact.
- NC1/DSTV writer for profiles:
  - length
  - holes
  - slots
  - saw cuts
  - mitres
  - basic copes/notches
  - basic trims
- Basic plate DSTV or plate report path where feasible.
- MIS/part list.
- Export log listing exported and rejected parts.
- Golden `.nc1` fixtures.

Exit gate:

- A selected sample exports machine-readable files from stored semantic data only.
- Exporter refuses ambiguous or unsupported objects with diagnostics.

### Month 7: Drawing System V1

Goal: generate reviewable fabrication drawings.

Deliverables:

- Drawing artifact model outside project JSON.
- Sheet/view/template model.
- GA, assembly, and single-part drawing views.
- Marks, dimensions, labels, sections, detail bubbles, bolt/weld callouts.
- Drawing template library.
- Stale drawing detection by project revision.
- PDF/SVG/DXF export.
- Drawing visual QA.

Exit gate:

- Beam/connection and stair samples generate readable review drawings.
- Drawing artifacts link to source revision and object IDs.

### Month 8: Structural And Rule Checks

Goal: stop pretending design is checked; actually check selected scopes.

Deliverables:

- Load/reaction semantic model.
- Design assumption model.
- Rule pack framework for connection checks.
- Fin plate, end plate, base plate, simple splice check V1.
- Member utilization placeholder and external analysis integration boundary.
- Calculation report artifact.
- Clause references, measured values, pass/fail, assumptions, accepted deviations.

Exit gate:

- Components can honestly show:
  - not checked
  - geometry checked
  - fabrication checked
  - design checked
  - failed with reasons

### Month 9: Interoperability

Goal: connect to real project ecosystems.

Deliverables:

- IFC export V1 for members, plates, assemblies, materials, profiles, BIM properties.
- IFC/reference import for grids, levels, and coordination objects.
- External reference model boundary.
- CSV catalog import/export.
- Profile/material/fastener import tools.
- Unsupported mapping diagnostics.

Exit gate:

- A sample exports IFC for coordination.
- Imported reference geometry cannot become hidden fabrication source of truth.

### Month 10: Collaboration, Revisions, AI Review

Goal: make human and agent work reviewable.

Deliverables:

- Backend/local service for revisions, locks, comments, issues, artifacts, jobs.
- Object comments and issue pins.
- Semantic merge/conflict reporting.
- AI proposal workflow:
  - proposed change
  - diff
  - validation
  - screenshots
  - approval/reject
- Role permissions:
  - author
  - reviewer
  - checker
  - fabricator
  - viewer

Exit gate:

- Two users or agents can work on separate zones/components and merge with conflict diagnostics.
- Every generated artifact links to the revision that produced it.

### Month 11: Scale, Security, Release Hardening

Goal: make it robust under real load.

Deliverables:

- Workerized scene build and validation.
- Incremental scene patching.
- Large model LOD and picking improvements.
- Performance budgets:
  - 10k objects interactive
  - 100k simple members viewable
  - dense connection/stair samples responsive
- Smart Component sandbox/security review.
- Import/export file safety checks.
- Crash diagnostics and recovery.
- Packaging/update plan.

Exit gate:

- Stress projects load within published budgets.
- Failures produce diagnostics, not blank states.

### Month 12: Beta Integration

Goal: one coherent beta product.

Deliverables:

- End-to-end project template:
  - grids
  - frame
  - stairs/platforms
  - standard connections
  - checks
  - numbering
  - drawings
  - NC1/DSTV
  - IFC
  - reports
  - revision review
- Certified starter library for one region and beta scope.
- Onboarding projects.
- User docs and tutorials.
- Full QA artifact bundle.
- Beta feedback process.

Exit gate:

- A realistic small steel project can go from layout to reviewed fabrication pack.
- Remaining limitations are explicit.

## First 30 Days: Exact Work

### Week 1

- Create stale architecture issue list.
- Migrate/delete stale demo and stress scripts.
- Add stale pattern guard for `model.connections` and `createConnectionFromPreset`.
- Add sample inventory script.
- Add `docs/quality/test-matrix.md`.
- Add `docs/workflows/agent-work-packages.md`.

### Week 2

- Add domain validator skeleton.
- Validate objectIndex and model references.
- Validate library refs.
- Validate Smart Component ownership and roles.
- Run validator on every sample as warnings.

### Week 3

- Add scene-build smoke for all renderable samples.
- Add expected count snapshots.
- Convert domain validator warnings to errors for non-stale categories.
- Create QA fixture classification.

### Week 4

- Write Month 2 command journal exec plan.
- Write Month 5 connection catalog exec plan.
- Write Month 6 NC1/DSTV exporter exec plan.
- Write Month 7 drawing artifact exec plan.
- Assign 100-agent work packages for Month 2.

## Workstream Backlogs

### Model And Schema

- Schema migration framework.
- Project revision identity.
- Library pinning.
- Object locks and ownership metadata.
- Better project issue references.
- Decide long-term `objectIndex` replacement only after current product stabilizes.

### Validation And Audit

- Domain validation engine.
- Repair suggestions.
- Continuous model auditor UI.
- Audit severity policy.
- Export readiness reports.
- Drawing readiness reports.
- Design assumption status reports.

### Geometry And Rendering

- Steel-specific geometry kernel.
- CSG robustness for holes/cuts/trims.
- Plate bend unfolding.
- Clash/clearance geometry.
- Workerized scene building.
- Incremental rebuild.
- Better picking for dense bolts and thin plates.
- Section boxes and clipping.

### Authoring UX

- Command history UI.
- Undo/redo UI.
- Core edit commands.
- Context menus.
- Selection sets.
- Dimension-driven editing.
- Pattern editing.
- Project file workflows.
- Keyboard-first command prompts.

### Smart Components

- Role snapshots.
- Component SDK.
- Compatibility checks.
- Version migration.
- Nested component debugging.
- Marketplace/package format.
- Component performance budgets.

### Connections

- Connection picker.
- Connection compatibility matrix.
- Connection replacement workflow.
- Batch apply.
- Connection QA gallery.
- Connection calculation hooks.
- Connection drawing templates.

### Stairs, Platforms, Buildings

- Harden stair variants.
- Add platforms.
- Add ladders.
- Add handrail/guardrail catalog.
- Add industrial walkway modules.
- Add portal/warehouse templates.
- Add transport and install sequencing.

### Fabrication

- Numbering.
- Mark conflicts.
- NC1/DSTV writer.
- Export logs.
- MIS/part lists.
- Bolt/weld/material reports.
- Plate unfolding.
- Machine constraints.
- Artifact storage.

### Drawings

- Drawing artifact model.
- Templates.
- View generation.
- Single-part drawings.
- Assembly drawings.
- GA drawings.
- Weld symbols.
- Bolt callouts.
- Revision clouds/deltas.

### Structural And Codes

- Loads/reactions.
- Rule pack versioning.
- Connection checks.
- Member check integration.
- Calculation reports.
- Accepted deviation workflow.

### Interop

- IFC export.
- IFC/reference import.
- TrimBIM-like internal compact exchange later if useful.
- CSV catalog import/export.
- External reference objects.
- Mapping diagnostics.

### Collaboration

- Project service.
- Revisions.
- Locks.
- Comments.
- Issues.
- Artifact/job history.
- Merge/conflict workflow.
- Permissions.

### QA, DevEx, Security

- Unit test harness.
- Fixture integration tests.
- Visual QA with screenshots.
- Exporter golden tests.
- Drawing golden tests.
- Performance budgets.
- Component sandbox tests.
- Import safety tests.

## Release Gates Before Calling It Tekla-Class

- Project save/load works.
- Undo/redo works.
- Core authoring works without JSON edits.
- Smart Components regenerate safely.
- Connection catalog covers common steel details.
- Domain validator catches real fabrication/model risks.
- Numbering exists.
- NC1/DSTV export exists with golden tests.
- Drawing output exists.
- IFC export exists.
- Reports exist.
- Collaboration/revisions exist.
- Library data is certified for a defined beta scope.
- Performance budgets are measured.
- AI changes are reviewable and reversible.

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 100 agents create architecture drift | High | Work-package ownership, schema locks, review gates |
| Stale scripts teach wrong patterns | High | Month 1 stale cleanup gate |
| Exporters infer missing data | High | Exporters must fail with diagnostics |
| Smart Component regeneration loses edits | High | Role/override/detach regression matrix |
| Drawing system stores linework in project JSON | High | Artifact boundary outside project model |
| General CAD kernel temptation | High | Build focused steel geometry service instead |
| UI gets broad but shallow | Medium | Authoring exit gates tied to real sample workflows |
| Libraries remain demo-only | High | Certified beta-scope library track |
| Design checks become fake labels | High | Preserve `not-calculated` until rule result exists |
| Collaboration backend arrives too early | Medium | Delay until revision/journal model exists |

## Definition Of A One-Year Win

At the end of 12 months, a beta user should be able to:

1. Start a steel project from a template, grids, and levels.
2. Model or AI-generate a frame with stairs/platforms.
3. Apply standard connections from stored interfaces and zones.
4. Edit details manually without losing regeneration safety.
5. Validate model references, geometry intent, fabrication readiness, and selected design checks.
6. Number parts and assemblies.
7. Generate NC1/DSTV, drawings, reports, and IFC from stored semantic data.
8. Review AI proposals as diffs with diagnostics and screenshots.
9. Collaborate through revisions, comments, issues, locks, and artifacts.
10. Trust that every output came from explicit project objects, not hidden geometry.

## Immediate Recommendation

Do not start with glamorous AI generation.

Start with Month 1. Clean stale architecture, add domain validation, add all-sample scene smoke, and define the agent work-package system. Then build command history/save/undo. Only after that should 100 agents expand authoring, connections, fabrication, drawings, and collaboration in parallel.

That is the credible path: make the kernel trustworthy, then scale the catalog and outputs around it.
