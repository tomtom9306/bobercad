# App Architecture Rescan Compact Table

Date: 2026-06-20

Scope: full current working copy scan across `bobercad/app`, `bobercad/data/libraries`, `bobercad/data/projects`, `scripts`, `tools`, and architecture/workflow docs.

Result: **0 active architecture findings**.

| Metric | Value |
| --- | ---: |
| Files scanned | 407 |
| Lines scanned | 957,661 |
| Score 5 findings | 0 |
| Score 4 findings | 0 |
| Score 3 findings | 0 |
| Active blocker rows | 0 |

Full file ledger: `docs/architecture/app-architecture-file-audit.csv`.
Raw line findings: `docs/architecture/app-architecture-line-findings.csv`.

## Former High-Risk Register

This table keeps the previous 55-row register visible, but records the current verified score after remediation.

| # | Former Score | Area | Scope | Current Score | Evidence |
| ---: | ---: | --- | --- | ---: | --- |
| 1 | 5 | Smart Components | Data-library parameter UI | 0 | UI moved to app viewer layer; data library stays headless |
| 2 | 5 | Smart Components | Data-library parameter values | 0 | Public engine parameter API replaces private/cache-busted imports |
| 3 | 5 | Smart Components | Stair/splice hardware helpers | 0 | Component uses public model APIs and no placementIntent geometry fallback |
| 4 | 5 | Smart Components | Transport section build | 0 | Private engine/project reads removed from library component path |
| 5 | 5 | Workspace UI | Workspace customizer panel | 0 | Split into command, state, mount, manager, ordering, labels, file IO, and dock modules |
| 6 | 5 | WebGL Runtime | WebGL viewer runtime | 0 | Render orchestration, controls, preview, picker, pick color, and state split |
| 7 | 5 | Checks | Repository contract checker | 0 | Large Smart Component and viewer runtime contract suites extracted |
| 8 | 5 | Rendering Interaction | Member transform edit controller | 0 | Current scan no longer scores this controller as high-risk |
| 9 | 5 | Rendering Interaction | Plate sketch drag edit controller | 0 | Controller split into drag helpers, mutations, dimensions, overlays, snap, and geometry modules |
| 10 | 5 | Scene Build | Scene geometry builder | 0 | Builder is now a small orchestrator over scene adapters |
| 11 | 5 | Store | Project command store | 0 | Model helpers, Smart Component helpers, and plate/sketch methods split out |
| 12 | 5 | Inspector UI | Inspector property metadata | 0 | Editable/support object metadata split into focused modules |
| 13 | 5 | Inspector UI | Inspector panel | 0 | Plate sketch contribution and scene metrics split out |
| 14 | 5 | Viewer UI | Viewer command registration | 0 | Current scan no longer scores command registration as high-risk |
| 15 | 5 | Viewer UI | Viewer runtime | 0 | Runtime remains below scan threshold and delegates to extracted services |
| 16 | 4 | Public API | API register/store facade | 0 | Current scan no longer reports API-register blocker |
| 17 | 4 | Smart Components | Smart Component runtime | 0 | Runtime is a thin entrypoint over validation, catalog, creation, build, override, patch, and option modules |
| 18 | 4 | Schema | Project schema | 0 | Current scan reports no schema source-of-truth blocker |
| 19 | 4 | Dimensions | Dimension context | 0 | Current scan reports no dimension context blocker |
| 20 | 4 | Rendering Interaction | Member create controller | 0 | Current scan reports no creation-controller blocker |
| 21 | 4 | Snapping | Snap candidate providers | 0 | Current scan reports no snap-provider blocker |
| 22 | 4 | Snapping | Snap manager | 0 | Current scan reports no snap-manager blocker |
| 23 | 4 | WebGL UI | Dimension label editor UI | 0 | Obsolete WebGL DOM editor path removed from current scan |
| 24 | 4 | Smart Components | Railing path/panel system | 0 | Current scan reports no data-library boundary blocker |
| 25 | 4 | Smart Components | Stair solver | 0 | Current scan reports no stair-solver blocker |
| 26 | 4 | Commands | Command registry | 0 | Current scan reports no command-registry blocker |
| 27 | 4 | Design System | UI elements helper | 0 | Current scan reports no design-system helper blocker |
| 28 | 4 | Workspace Storage | Workspace storage | 0 | Current scan reports no storage compatibility blocker |
| 29 | 4 | Dimensions UI | Dimension edit controller | 0 | Current scan reports no dimension-controller blocker |
| 30 | 4 | Inspector UI | Inspector property bindings | 0 | Current scan reports no bindings hub blocker |
| 31 | 4 | Trim UI | Trim joint editor panel | 0 | Current scan reports no trim-panel blocker |
| 32 | 4 | QA Boundary | Viewer QA bridge | 0 | Current scan reports no QA boundary blocker |
| 33 | 4 | Rendering Scheduler | Viewer render scheduler | 0 | Current scan reports no scheduler blocker |
| 34 | 3 | Snapping API | Snap solver | 0 | Current scan reports no snap-solver blocker |
| 35 | 3 | Plate Sketch Engine | Solver and relations facade | 0 | Solver core, analysis, mutations, and preview split out |
| 36 | 3 | Geometry | CSG module | 0 | Current scan reports no CSG blocker |
| 37 | 3 | Dimensions | Hole edge distance | 0 | Current scan reports no dimension-handler blocker |
| 38 | 3 | Rendering Interaction | Command controller | 0 | Current scan reports no command-controller blocker |
| 39 | 3 | Rendering Interaction | Plate create controller | 0 | Current scan reports no plate-create blocker |
| 40 | 3 | Plate Sketch UI | Dimension overlay | 0 | Current scan reports no dimension-overlay blocker |
| 41 | 3 | Datums | Reference plane edit controller | 0 | Current scan reports no datum-controller blocker |
| 42 | 3 | Sketch Authoring | Sketch create controller | 0 | Current scan reports no sketch-create blocker |
| 43 | 3 | Commands | Left-dock result metadata | 0 | Current scan reports no metadata model-walk blocker |
| 44 | 3 | Commands | Model collection metadata | 0 | Current scan reports no duplicated-taxonomy blocker |
| 45 | 3 | Trim Commands | Trim operation metadata | 0 | Current scan reports no trim taxonomy blocker |
| 46 | 3 | CSS | Panels and controls CSS | 0 | Current scan reports no stylesheet blocker |
| 47 | 3 | Command Palette | Command palette | 0 | Current scan reports no palette persistence blocker |
| 48 | 3 | CSS | Workspace shell CSS | 0 | Current scan reports no shell stylesheet blocker |
| 49 | 3 | Model Browser | Model browser | 0 | Current scan reports no model-browser blocker |
| 50 | 3 | Feature UI | Feature editor panel | 0 | Current scan reports no feature-panel blocker |
| 51 | 3 | Panel Elements | Panel elements | 0 | Current scan reports no panel-elements blocker |
| 52 | 3 | Smart Component UI | Smart Component browser | 0 | Current scan reports no Smart Component browser blocker |
| 53 | 3 | CSS | Authoring overlays CSS | 0 | Current scan reports no authoring stylesheet blocker |
| 54 | 3 | Workspace Binding | Viewer workspace bindings | 0 | Current scan reports no workspace-binding blocker |
| 55 | 3 | Checks | Viewer runtime smoke test | 0 | Viewer runtime helper module extracted; current scan reports no smoke-test blocker |
