# 0007 Professional UI And Design System

## Goal

Replace the current test-oriented viewer UI with a professional, consistent, customizable CAD/BIM interface.

The new UI should feel clear and calm for new users, but still powerful for advanced steel modeling workflows. The primary canvas stays dominant. Important commands are easy to find. Advanced options are available when the user goes deeper, not shown all at once.

This plan covers the UI architecture, design system, command organization, SVG icon system, workspace customization, and the separation between UI and app logic.

## Product Principles

- The UI is a professional modeling workspace, not a demo page.
- The first screen is the usable application: canvas, key tools, status, and context panels.
- Do not overwhelm the user with every command at once.
- Show primary commands first; expose advanced settings through panels, popovers, drawers, command search, or contextual inspectors.
- Similar actions must look, behave, and be named the same way everywhere.
- The design system is the source of truth for visual language. Changing a token, primitive, or theme should update the whole UI.
- User customization is a first-class workflow. Users can rearrange buttons, groups, and toolbars without changing project JSON.
- UI code must be replaceable and evolvable without breaking modeling logic, renderer logic, or the semantic project model.
- Project JSON remains semantic model data only. UI layout, generated geometry, preview state, toolbar state, and user preferences do not belong in project files.

## Current Problem

The current viewer UI is useful for testing functionality, but it is not yet a production UI:

| Area | Current state | Target state |
|---|---|---|
| Styling | One large `style.css` with direct colors and per-panel rules | Design tokens, themes, component CSS, and reusable layout primitives |
| Buttons | Text/shortcut labels such as `B`, `C`, `Snap`, `Rel` | SVG icon buttons with accessible labels, tooltips, shortcut hints, and consistent states |
| Toolbars | Fixed toolbar in `index.html` / `modeling-toolbar.mjs` | Command-driven toolbars that can be rearranged and customized |
| Panels | Separate hand-built DOM panels | Shared inspector, field, section, tabs, menu, popover, and dock panel primitives |
| Layout | Fixed HUD, toolbar, status, and side panels | Dockable professional workspace shell |
| UI logic | Viewer `viewer-runtime.mjs` wires many UI pieces directly | App/controller boundary with command registry and UI adapter |
| Discoverability | Features depend on knowing where test panels live | Command search, contextual actions, clear grouping, and progressive disclosure |
| Customization | No workspace customization | Persisted user workspace: toolbar order, visible commands, panel docks, density, theme |

## User Requirement Traceability

This plan is driven by the requested end state:

| User requirement | Plan response |
|---|---|
| Fully replace the testing UI with a professional UI | Professional shell, inspector migration, command registry, and panel replacement phases |
| Best possible UX without overwhelming the user | Progressive disclosure, contextual inspector, compact defaults, hidden diagnostics, command palette |
| Everything easy to find, grouped, and named properly | Stable command groups, naming rules, command metadata, model/library entry points |
| Nice SVG icons | Shared SVG icon registry, icon family list, icon rules, icon-button accessibility requirements |
| One design convention for the whole application | Design-system tokens, themes, primitive components, and shared component CSS |
| UI inherits from the design system so one change updates the whole app | CSS custom property tokens and shared primitives are the only styling path for migrated UI |
| User can customize UI like professional CAD software | Workspace customization, draggable commands/toolbars, persisted workspace presets, reset actions |
| User can move buttons and whole toolbars | Toolbar drag handles, supported docks, command id based workspace data |
| Figma-like primary actions with deeper advanced options | Main toolbar plus contextual inspector, popovers, drawers, collapsed advanced sections |
| UI fully separated from engine and logic | Dependency direction, app/controller boundary, public command APIs, no engine imports from UI |
| UI can evolve independently without breaking the app | Command registry, design-system contract, shell adapter, gradual panel migration |
| Project/model JSON must stay clean | Hard rule: no UI layout, toolbar customization, preview state, or user preferences in project JSON |

## Hard Requirements

- Add a shared design system before replacing large UI areas.
- Use SVG icons through an icon registry or sprite, not ad hoc text buttons.
- All command buttons need accessible names, tooltips, active/disabled states, and shortcut hints.
- Use design-system tokens for colors, typography, spacing, borders, focus rings, shadows, z-index, and density.
- Keep cards at 8px radius or less.
- Avoid nested cards and decorative page-section cards.
- Keep the canvas visually dominant.
- Keep high-frequency controls close to the canvas and selection.
- Put advanced controls behind details, tabs, popovers, drawers, or inspector sections.
- Do not write UI layout, toolbar customization, preview state, generated geometry, scene graph data, or user preferences to project JSON.
- Do not add OpenCascade or a general CAD kernel.
- Smart Component custom UI must use public model APIs and shared UI primitives, not hardcoded app branches.
- If a persistent UI config file shape is introduced, add or update the matching schema in the same change.

## Non-Goals

- No full modeling behavior redesign in this plan.
- No data-model changes unless a UI config schema is intentionally added.
- No generated geometry storage.
- No one-off visual redesign that bypasses reusable primitives.
- No mandatory framework migration as the first step. The design-system contract should work with repo-native ES modules now and still allow a future framework if it becomes worth it.

## Target UI Architecture

### New Folders

Add UI modules under `bobercad/app/ui`:

| Folder | Responsibility |
|---|---|
| `design-system/` | Tokens, themes, primitive components, shared CSS, icon registry, tooltip/menu/dialog behavior |
| `icons/` | SVG source icons or generated sprite assets used by the icon registry |
| `commands/` | Command metadata: id, label, icon, shortcut, group, availability, and action binding |
| `shell/` | App frame, dock layout, top bar, side rails, status bar, command palette, workspace customization |
| `workspaces/` | Default workspace layouts and toolbar presets |
| `viewer/` | Viewer-specific adapter, panels, and canvas integration |

Existing viewer UI can be migrated gradually. Do not delete the current UI until replacement modules are wired and verified.

### Source Artifacts

These are the durable artifacts this plan expects to create or change:

| Artifact | Purpose |
|---|---|
| `bobercad/app/ui/design-system/tokens.css` | Global token contract |
| `bobercad/app/ui/design-system/theme-light.css` | Initial professional light theme |
| `bobercad/app/ui/design-system/theme-dark.css` | Future dark theme, same token contract |
| `bobercad/app/ui/design-system/components.css` | Shared primitive component styling |
| `bobercad/app/ui/design-system/*.mjs` | Primitive DOM/component helpers |
| `bobercad/app/ui/icons/icon-registry.mjs` | SVG icon lookup and rendering |
| `bobercad/app/ui/icons/*.svg` or generated sprite | Source SVG icons |
| `bobercad/app/ui/commands/command-group-metadata.mjs` | Shared command group labels, icons, descriptions, and top-nav order |
| `bobercad/app/ui/commands/command-registry.mjs` | Command metadata and command discovery |
| `bobercad/app/ui/commands/view-metadata.mjs` | Shared display-mode and view-orientation labels, order, icons, and normalization |
| `bobercad/app/ui/shell/*.mjs` | Workspace shell, docks, status bar, command palette, customization |
| `bobercad/app/ui/workspaces/default-workspace.json` | Default command and panel layout once workspace config is formalized |
| `bobercad/app/schemas/ui-workspace.schema.json` | Schema for committed workspace presets if/when added |
| `bobercad/app/ui/viewer/README.md` | Viewer UI map pointing to this plan |

### Dependency Direction

The UI dependency direction should be:

```text
design-system
  <- shell
    <- viewer UI adapter
      <- app controllers / project-store public APIs
        <- engine / rendering / model APIs
```

Rules:

- `engine/` must not import `ui/`.
- `rendering/` must not import design-system components.
- UI commands call public app/controller APIs.
- Modeling commits go through project-store or existing headless project APIs.
- UI can subscribe to app state snapshots, selection state, command state, and diagnostics.
- UI must not derive missing geometry, infer connection faces, or mutate model JSON directly.

### App Controller Boundary

Create a viewer app/controller boundary that exposes UI-safe operations:

```js
{
  project(),
  subscribe(listener),
  commandState(),
  runCommand(commandId, input),
  cancelCommand(),
  selectionState(),
  selectObject(objectId, detail),
  clearSelection(),
  setSnapSettings(patch),
  setWorkspacePatch(patch),
  resetWorkspace()
}
```

The shell and panels should use this boundary instead of reaching into every renderer/controller module directly.

Current implementation:

- `bobercad/app/ui/viewer/viewer-app-controller.mjs` introduces the first viewer-facing facade for `project()`, `subscribe()`, command registration/running, command state, selection state, object selection, selection framing, snap settings, and workspace patch/reset hooks.
- `bobercad/app/ui/viewer/viewer-command-adapter.mjs` turns command registry metadata into runnable command-palette items through that facade and keeps shell panel actions outside `viewer-runtime.mjs`.
- `bobercad/app/ui/shell/workspace-customizer-panel.mjs` now exposes `state()`, `setWorkspacePatch()`, and `resetWorkspace()` so workspace changes can be reached through the facade instead of direct DOM/storage coupling.
- `bobercad/app/ui/viewer/viewer-runtime.mjs` still creates the renderer/controllers, but toolbar and palette command execution now routes through stable command ids registered on the viewer app facade.
- `bobercad/app/ui/commands/command-group-metadata.mjs` centralizes command group labels, icons, descriptions, and feature-navbar order so the top navbar, command palette adapter, and command registry use the same grouping contract.
- `bobercad/app/ui/commands/view-metadata.mjs` centralizes display-mode and view-orientation metadata so the command registry, runtime handlers, nav cube, and viewer settings strip share labels, ids, order, icons, and normalization.
- `bobercad/app/ui/workspaces/default-workspace.json` now includes `navigation.featureNavbar.groupIds` / `hiddenGroupIds`, and the workspace customizer preserves that state so top navigation order and visibility can become user-customizable without storing UI preferences in project JSON.

## Design System

### Tokens

Create tokens as CSS custom properties, grouped by purpose:

| Token group | Examples |
|---|---|
| Color primitives | neutral, blue, green, amber, red |
| Semantic colors | canvas, panel, toolbar, field, border, focus, selection, hover, active, disabled |
| CAD colors | axis X/Y/Z, snap, guide, preview, selected object, warning overlay |
| Typography | family, size, weight, line-height |
| Spacing | 2, 4, 6, 8, 12, 16, 24 |
| Radius | none, 2, 4, 6, 8 |
| Elevation | toolbar, popover, modal, drag ghost |
| Motion | fast, normal, reduced-motion alternatives |
| Density | compact, normal, spacious |
| Layering | canvas, overlay, toolbar, panel, popover, modal |

Initial files:

```text
bobercad/app/ui/design-system/tokens.css
bobercad/app/ui/design-system/theme-light.css
bobercad/app/ui/design-system/theme-dark.css
bobercad/app/ui/design-system/components.css
```

Direct hex colors should disappear from viewer component CSS over time. Scene/render colors can still live in `viewer-settings.json` where they describe canvas/rendering behavior.

### Components

Create reusable primitives before rebuilding panels:

| Component | Purpose |
|---|---|
| `Icon` | Renders a registered SVG icon with `currentColor` |
| `IconButton` | Toolbar and compact action buttons |
| `Button` | Text or icon+text command buttons |
| `Toolbar` | Command groups, separators, overflow, drag handles |
| `Menu` | Command menus and contextual menus |
| `Popover` | Snap settings, command options, quick settings |
| `Tooltip` | Accessible hover/focus labels and shortcut hints |
| `Panel` | Dockable panel surface |
| `InspectorSection` | Collapsible details inside inspectors |
| `Field` | Label, help, validation, and control layout |
| `NumericInput` | CAD numeric entry with units and validation |
| `SegmentedControl` | Mode selection such as local/global, light/normal/strong |
| `Toggle` | Binary settings |
| `Tabs` | Inspector/category switching |
| `Tree` | Model browser and object hierarchy |
| `StatusBar` | Command prompts, selected object, snap state, warnings |
| `CommandPalette` | Searchable commands and settings |
| `DockLayout` | Resizable, draggable panels and toolbars |

`bobercad/app/ui/viewer/panels/panel-elements.mjs` should become a compatibility wrapper over these primitives during migration.

### SVG Icon System

Icons should be registered by semantic command id:

```js
{
  id: "model.beam.create",
  icon: "beam",
  label: "Beam",
  shortcut: "B"
}
```

Icon rules:

- Use SVG with a consistent `viewBox`, stroke width, corner style, and optical size.
- Prefer `currentColor` for stroke/fill so themes work automatically.
- Do not put text inside icons.
- Use 16px icons for dense panels, 20px for normal toolbars, and 24px for large touch targets.
- Every icon-only button needs an accessible label and tooltip.
- Icons should represent user concepts, not internal model names.

Initial icon families:

| Family | Icons |
|---|---|
| Core | select, move, rotate, delete, undo, redo, search, settings, close, more |
| View | orbit, pan, zoom-fit, reset-view, section, isolate, show-hide |
| Model | beam, column, plate, sketch, work-plane, trim, bend |
| Connection | smart-component, connection, bolt, weld, hole, plate-connection |
| Snap | snap, grid, endpoint, axis, face, point, relation |
| Status | success, warning, error, info, locked, hidden |

## UX Model

### Workspace Layout

Default workspace:

```text
Top bar:        project name, file/actions, command search, global settings
Left rail:      primary tool families and model/library entry points
Top toolbar:    active modeling commands, grouped and compact
Canvas:         full-bleed 3D modeling view
Right dock:     contextual inspector for selection/tool settings
Bottom bar:     command prompt, snap state, selection count, units, warnings
Popovers:       quick settings and advanced options
```

The canvas should remain the largest visual area. Panels should feel attached to the workspace, not like floating test boxes.

### Command Grouping

Use stable user-facing groups:

| Group | Purpose |
|---|---|
| Project | open sample, save/export later, project info |
| View | camera, fit, section, display, isolate |
| Select | selection modes, filters, object browser |
| Snap | strength, filters, work plane |
| Model | beam, column, plate, sketch, bend |
| Edit | move, transform, align, copy, delete |
| Connections | Smart Components, bolts, welds, connection zones |
| Fabrication | part marks, NC1 readiness, features, holes |
| Review | warnings, validation, diagnostics |

Do not expose every future group at once. Empty or not-yet-implemented groups should stay hidden.

### Progressive Disclosure

The default UI should behave like a Figma-style modeling tool:

- Main toolbar shows the most important commands.
- Clicking a tool starts the command immediately or opens one compact options popover.
- The right inspector shows only the selected object/tool context.
- Advanced settings live inside collapsed sections such as `Advanced`, `Constraints`, `Fabrication`, `Diagnostics`.
- Power users can find commands through command search.
- Context menus and quick actions should offer the next likely action near the selection.
- Diagnostics should be available, but not part of the normal visual weight.

Examples:

| User intent | Default UI | Deeper UI |
|---|---|---|
| Create a beam | Beam icon in main modeling toolbar | Beam settings in tool inspector |
| Adjust snapping | Snap strength button | Advanced snap targets popover |
| Edit a plate | Select plate, use inspector basics | Sketch relations and fabrication sections |
| Edit Smart Component | Select component, show key parameters | Advanced parameters, generated object roles, diagnostics |
| Find hidden command | Command palette | Customize toolbar to pin it |

### Naming Rules

- Commands should use clear verb-noun or noun labels: `Create Beam`, `Set Work Plane`, `Fit View`.
- Toolbar labels can be shorter: `Beam`, `Work Plane`, `Fit`.
- Internal ids stay stable and namespaced: `model.beam.create`, `view.fit`, `snap.filters.open`.
- User-facing labels should not expose internal collection names unless the user is inspecting raw model data.
- Use consistent terms: `Smart Component`, `Work Plane`, `Snap`, `Inspector`, `Model Browser`.

## Workspace Customization

Users should be able to customize the UI like professional CAD tools:

- Drag buttons between toolbars.
- Reorder commands inside a toolbar.
- Drag whole toolbars to allowed dock regions.
- Show/hide command groups.
- Add/remove commands from a toolbar through a customize menu.
- Reset a toolbar or the whole workspace to default.
- Save density, theme, panel widths, collapsed sections, and visible docks.
- Import/export workspace presets through versioned JSON.

### Workspace Data

Default workspace presets can live in repo files:

```text
bobercad/app/ui/workspaces/default-workspace.json
bobercad/app/ui/workspaces/steel-modeling-workspace.json
```

User overrides should initially live in browser storage:

```text
localStorage key: bobercad.ui.workspace.v1
```

Future desktop/cloud user preferences can use a user settings file or account profile. They still must not be stored in project JSON.

Workspace shape:

```json
{
  "$schema": "../../schemas/ui-workspace.schema.json",
  "schema": "bobercad-ui-workspace",
  "schemaVersion": "0.1.0",
  "theme": "light",
  "density": "compact",
  "navigation": {
    "featureNavbar": {
      "groupIds": ["model", "view", "select", "data", "panel", "settings", "workspace", "core"],
      "hiddenGroupIds": []
    }
  },
  "toolbars": {
    "modeling": {
      "label": "Modeling Toolbar",
      "dock": "top",
      "commandIds": ["model.beam.create", "model.column.create", "model.plate.create"],
      "hiddenCommandIds": [],
      "collapsedGroups": []
    }
  },
  "bottomStrip": { "itemIds": ["selection", "scope", "snap", "units"], "hiddenItemIds": [] },
  "viewerSettingsStrip": { "groupIds": ["display", "view"], "hiddenGroupIds": [] },
  "panels": {
    "inspector": { "dock": "right", "width": 380, "visible": true },
    "library": { "dock": "left", "width": 300, "visible": true, "activeTab": "model" }
  },
  "sections": {}
}
```

If this becomes a committed config file, add `bobercad/app/schemas/ui-workspace.schema.json` and validate default workspace files in `scripts/check_repo.js`.

## Command Registry

Create a command registry so UI and behavior are separated:

```js
{
  id: "model.beam.create",
  label: "Beam",
  description: "Create a beam from two points.",
  icon: "beam",
  group: "model",
  defaultToolbar: "modeling",
  shortcut: "B",
  run: ({ app }) => app.runModelingCommand("beam")
}
```

Benefits:

- Toolbars render from metadata.
- Command palette searches the same metadata.
- Keyboard shortcuts are shown consistently.
- Custom workspaces store command ids, not DOM details.
- Smart Component and future modules can contribute commands through registration.

Command states:

| State | Meaning |
|---|---|
| enabled | Command can run |
| disabled | Visible but not currently available |
| hidden | Not shown in current workspace/context |
| active | Current running tool or mode |
| pending | Running async action |
| warning | Available but has model/setup warning |

## Panel Strategy

Replace current panels gradually:

| Existing panel | Target |
|---|---|
| HUD | Top bar project summary plus status bar details |
| Inspector `properties` slot | Right `Inspector` dock with dynamic generated Properties |
| `member-transform-panel` | Inspector transform section plus optional floating transform HUD |
| Inspector `feature` slot | Inspector `Feature` tab or right-side detail drawer |
| Inspector `trim` slot | Inspector trim workflow with operation list and canvas quick actions |
| `library-panel` | Left dock `Library` panel |
| Inspector `component` slot | Smart Component inspector using design-system fields |
| `modeling-status` | Bottom status/command prompt |
| `modeling-toolbar` | Command-registry toolbar with SVG icons and overflow |

Do not move every advanced field into the top-level inspector. Use collapsed sections and tabs.

## Smart Component UI

Smart Component custom UIs should inherit the design system:

- Use shared fields, sections, toggles, numeric inputs, and messages.
- Register command metadata for component-specific actions.
- Show key parameters first.
- Put advanced/generated-object details behind sections.
- Continue using public model APIs and component definitions from `bobercad/data/libraries/smart-components`.
- Do not hardcode special branches for connection components in the shell.

## Theming And User UI Preferences

Initial theme targets:

- Light professional theme.
- Dark professional theme.
- Compact density default for desktop CAD workflows.
- Normal density for accessibility/touch.

Preferences:

- theme
- density
- panel layout
- toolbar layout
- command favorites
- recent commands
- snap UI visibility
- advanced sections expanded/collapsed

These preferences are UI/user settings only. They must not change project semantics.

## First Implementation Slice

The first coding slice should prove the architecture without attempting the full visual rewrite.

### Slice 1 Scope

- Add design-system token CSS and primitive component CSS.
- Add an SVG icon registry with the first core/model/snap icons.
- Add command registry metadata for the current modeling toolbar commands.
- Render the existing modeling toolbar from command metadata.
- Replace toolbar text buttons with design-system icon buttons plus tooltips and shortcut hints.
- Keep current command behavior and panel behavior unchanged.
- Keep existing `index.html`, `viewer-runtime.mjs`, and command controller behavior working.

### Slice 1 Files

Expected initial changes:

```text
bobercad/app/ui/design-system/tokens.css
bobercad/app/ui/design-system/theme-light.css
bobercad/app/ui/design-system/components.css
bobercad/app/ui/design-system/ui-elements.mjs
bobercad/app/ui/icons/icon-registry.mjs
bobercad/app/ui/commands/command-registry.mjs
bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs
bobercad/app/ui/viewer/style.css
```

### Slice 1 Acceptance

- Toolbar still starts beam, column, plate, sketch, work plane, bend, trim, snap/relation, and cancel commands.
- Buttons use SVG icons from the registry.
- Each icon-only control has an accessible label and tooltip.
- Toolbar visual states use design tokens.
- No project JSON changes.
- `node .\scripts\check_repo.js` passes.
- Browser screenshot confirms toolbar icons render and do not overlap at desktop and narrow widths.

## Migration Phases

### Phase 1: Design System Foundation

- Add token CSS files.
- Add base component CSS.
- Add SVG icon registry and first icon set.
- Add primitive component helpers.
- Make `panel-elements.mjs` wrap new primitives where possible.
- Keep current UI layout running.

Acceptance:

- Existing viewer still runs.
- New components can render buttons, icon buttons, fields, sections, tooltips, and popovers.
- No modeling behavior changes.

### Phase 2: Command Registry

- Add `bobercad/app/ui/commands/command-registry.mjs`.
- Move toolbar command metadata out of `modeling-toolbar.mjs`.
- Render current modeling toolbar from command metadata.
- Add command state: active, disabled, hidden.
- Keep existing command controller behavior.

Implementation note:

- `bobercad/app/ui/commands/command-registry.mjs` now includes the first `View` command group entries, `view.reset` and `view.fitSelection`, using shared SVG icons and stable command metadata. `bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs` exposes `resetView()` so the topbar reset button and command registry path share the same camera reset behavior.
- `bobercad/app/ui/viewer/viewer-runtime.mjs` registers `view.reset` and `view.fitSelection` on the viewer app controller, so command search and pinned toolbar buttons call the renderer/facade boundary instead of reaching into topbar DOM or inspector quick-action internals.

Acceptance:

- Beam, column, plate, sketch, work plane, bend, trim, snap, relations, and cancel are still available.
- Commands have stable ids, labels, icons, shortcuts, and tooltips.
- Keyboard shortcuts still match `viewer-settings.json`.

### Phase 3: Professional Shell

- Add workspace shell with top bar, left rail, top toolbar region, right dock, bottom status bar, and canvas slot.
- Move existing panels into shell docks without rewriting all panel internals.
- Replace HUD/status positioning with shell-owned layout.
- Keep canvas full-bleed.

Implementation note:

- Initial shell added with `bobercad/app/ui/shell/workspace-shell.css` and a semantic wrapper in `bobercad/app/ui/viewer/index.html`.
- Existing IDs are preserved so `viewer-runtime.mjs` and current panel modules continue to run.
- Current panel internals remain legacy DOM/CSS; only their workspace placement has moved into top bar, toolbar band, left dock, right dock, floating layer, and status bar regions.
- The topbar reset-view action now uses the shared SVG icon registry and `bc-icon-button` styling instead of the leftover text button. `bobercad/app/ui/icons/icon-registry.mjs` registers `reset-view`, `bobercad/app/ui/viewer/viewer-runtime.mjs` decorates the existing reset node without changing the WebGL reset handler, and old `#reset`/`bc-text-button` CSS has been removed from the migrated shell path.
- Browser smoke confirmed `#reset` loads as an icon-only button with `aria-label="Reset view"`, one registered SVG icon, 30px square dimensions, no `bc-text-button` class, no remaining `#reset` stylesheet rules, and the existing click path still leaves the viewer usable with status `Ready`.
- `bobercad/app/ui/shell/status-bar.mjs` now owns the bottom status bar presentation. The shell keeps the existing command prompt as an ARIA live region and adds compact SVG-icon segments for selection count, snap strength, and project length units, while `bobercad/app/ui/viewer/style.css` no longer turns `#modeling-status` into a floating test badge.
- Browser smoke evidence: the status bar mounts as a shell grid with the prompt positioned statically inside `.bc-statusbar`, three SVG-backed segments (`Selection`, `Snap`, `Units`), `0 selected` by default, `1 selected` after loading with `qaSelectObject=demo_boolean_beam`, `Snap: off` plus muted state after changing snap strength to `off`, and no horizontal overflow at a 390px viewport.
- The bottom status bar now acts as the first interaction strip. `bobercad/app/ui/shell/status-bar.mjs` adds a compact selection-scope segmented control (`All`, `Selected`, `Component`) plus a bottom-opening Snap popover with strength and collapsible target filters. Scope and snap changes flow through `viewerApp.setSnapSettings()` / the selection controller, not project JSON, while `bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs` exposes `setSnapScope()` so the existing toolbar Snap popover stays synchronized with the bottom strip.
- Bottom-strip selection scope and snap target controls are now command-addressable. `bobercad/app/ui/commands/command-registry.mjs` adds `selection.scope.all`, `selection.scope.selected`, `selection.scope.component`, and `settings.snapTarget.*.toggle` commands for actual snap target filters; `viewer-runtime.mjs` registers shared handlers, mirrors active/disabled command state from the selection scope, and refreshes command providers after any scope/target change. Scope commands own selected/component mode semantics so the command palette does not duplicate them as target toggles.
- Selection-scope commands are now toolbar-pinnable. `selection.scope.all`, `selection.scope.selected`, and `selection.scope.component` carry `toolbarPin: true`, so users can promote scope controls into customized modeling toolbars while the existing command state keeps selected/component modes disabled until the relevant selection exists.
- The default modeling toolbar order is now contract-checked against `MODELING_TOOLBAR_COMMANDS`. The default workspace, first-render toolbar, reset path, and customizer stay aligned on the same command ids/order instead of letting registry metadata and persisted workspace defaults drift apart.
- Bottom-strip, toolbar, command-registry, and runtime snap labels now inherit shared metadata from `bobercad/app/ui/commands/snap-metadata.mjs`. Strength labels, scope modes, filter labels, command target ids, and runtime handler keys are derived from that module, while `snap-selection-manager.mjs` remains the rendering-side authority for normalized scope behavior. Contract checks compare the shared UI metadata with `DEFAULT_SNAP_SCOPE`, registry command metadata, and the consuming UI modules so labels and keys cannot silently drift.
- The bottom interaction strip now derives its visible controls from `bottom-strip-metadata.mjs` instead of a separate local control list. `status-bar.mjs` builds item controls from `BOTTOM_STRIP_ITEM_SPECS`, keeps the existing selection/snap/units data hooks, and renders the `All / Selected / Component` scope selector through the shared `segmentedControl()` primitive so bottom-strip scope controls inherit the same design-system behavior as the viewer settings strip.
- Bottom-strip non-visual smoke evidence: loading with `qaSelectObject=demo_boolean_beam` rendered `All`, `Selected`, and disabled `Component` scope modes, with `Selection` and `Units` exposing stable `data-status-segment` hooks. Clicking `Selected` set status to `Selection scope: Selected` and checked `selectedObjectsOnly` in both the bottom Snap popover and existing toolbar Snap panel. Opening Snap showed strength `normal`, collapsed target filters, and a `10/11` target count; changing strength to `strong` updated the bottom summary and toolbar select; expanding targets and disabling `Members` updated both filter surfaces and status `Members snap disabled`; clicking `All` cleared selected-only scope in both places. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- The left dock now has separate roots for project data and Smart Component creation. `bobercad/app/ui/viewer/model-browser.mjs` renders a design-system/token-styled Project browser from the current semantic model, grouped into Model, Components, and Reference Data collections. Rows use registered SVG icons, preserve the existing Smart Component picker under `#smart-component-library`, and call the viewer app/controller boundary for object selection, Smart Component selection, and fit/framing instead of mutating project JSON or reaching into renderer internals.
- Model-browser non-visual smoke evidence: loading with `qaSelectObject=demo_boolean_beam` mounted one `#model-browser.bc-model-browser` while keeping the outer `#library-panel` visible, showed `Project` with `8 model items`, listed `Members`, `Features`, `Trim Joints`, and `Reference Planes`, kept the existing Smart Component library mounted, and marked `demo_boolean_beam` active. Search for `demo` kept focus in the search input while filtering, clicking the member row synced the right Inspector to `Member / demo_boolean_beam`, the row stayed active, the focus action reported `Framed demo_boolean_beam.`, and the browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- The left dock now includes a read-only `Data` tab implemented by `bobercad/app/ui/viewer/project-data-panel.mjs` and `bobercad/app/ui/viewer/project-data-panel.css`. It summarizes source files, loaded library packs, model content counts, project schema/version, units, and stored `objectIndex` size from the viewer app facade and already-loaded library metadata. It adds shared `file` and `database` SVG icons and keeps this data/UI surface separate from project JSON.
- Left-dock data surfaces now inherit shared design-system data-list primitives. `bobercad/app/ui/design-system/panels-and-controls.css` owns `bc-data-*` headers, search, sections, collection summaries, rows, action rows, badges, and empty states; `model-browser.mjs` and `project-data-panel.mjs` emit those classes alongside their semantic hooks; and their local CSS files now keep only panel-specific wrappers. This keeps Data and Model visually consistent and makes future Files/Libraries/Model list changes flow through one design-system layer.
- Data Dock tab identity now has a shared metadata boundary in `bobercad/app/ui/commands/data-dock-metadata.mjs`. The command registry derives `data.dock.*` command specs from `DATA_DOCK_TABS`, the viewer runtime derives tab commands, workspace panel config, legacy active-tab storage, and dock tab rendering from the same module, and contracts compare the default workspace and command metadata against that source so tab ids, labels, icons, and compatibility keys cannot drift.
- Data Dock panel chrome now also derives from `data-dock-metadata.mjs`: description, SVG icon id, dock side, default/min/max width, default visibility, pinned state, and the legacy `panel.library.toggle` command copy/icon all share the same metadata boundary as the tab ids.
- Data Dock collection identity now has a shared metadata boundary in `bobercad/app/ui/commands/model-collection-metadata.mjs`. The Model Browser and Project Data panels both derive collection groups, labels, singular names, icons, default-open state, browser visibility, focusability, and model counts from that source. The left Model Browser filters to primary, user-actionable collections by default, while Project Data still covers all object API collections including groups, interfaces, connection zones, assemblies, object patterns, Smart Components, and relations. Project Data now derives library/source rows from `project.libraries`, including frame and Smart Component declarations, while keeping app-owned files such as viewer settings and default workspace as explicit UI sources.
- Data Dock library identity now has a shared metadata boundary in `bobercad/app/ui/commands/data-surface-metadata.mjs`. Project Data derives default library ids, row order, labels, icons, loaded-library entry keys, and fallback source labels from that module instead of local constants, and repository contracts verify the metadata covers profiles, materials, fasteners, frames, and Smart Components with registered SVG icons.
- Data Dock source/library provenance now also inherits from `data-surface-metadata.mjs`. Project Data rows and command-palette left-dock Data results share source and library descriptors for display paths, loaded/declared status, versions, entry counts, and search keywords, keeping provenance searchable without making the Data tab visually noisy.
- Project Data panel copy and row intent identity now have a shared metadata boundary in `bobercad/app/ui/commands/project-data-metadata.mjs`. Header/search/empty copy, Data tab section labels, source/model/component action labels/icons/title verbs, and Project Settings row labels/icons are metadata-driven, while `project-data-panel.mjs` stays focused on rendering and reading live app/project values.
- Model Browser panel copy and scope identity now have a shared metadata boundary in `bobercad/app/ui/commands/model-browser-metadata.mjs`. Header/search/empty copy, focus/select/status labels, the focus SVG icon, the default `Primary` scope, and the compact `Primary` / `Advanced` scope modes are metadata-driven while `model-browser.mjs` stays focused on collection rendering, filtering, selection, and framing callbacks.
- Smart Component browser panel, kind, action, and status identity now have a shared metadata boundary in `bobercad/app/ui/commands/smart-component-browser-metadata.mjs`. The Components browser derives header/search/empty copy, status icons and labels, preset create/member-pick actions, registered kind labels/icons, and stair-family fallback icons from metadata while keeping catalog filtering and Smart Component creation/pick flow in the viewer panel boundary.
- Left-dock content is now exposed to the command palette through runtime-only result descriptors in `bobercad/app/ui/commands/left-dock-result-metadata.mjs`. The descriptor layer builds search-only Data row, Model collection/object, and Smart Component preset results from the current project/catalog state; `viewer-runtime.mjs` attaches run handlers that route through existing Data Dock tab, Project Data, Model Browser, and Smart Component Browser APIs. The static `command-registry.mjs`, toolbar customizer, and feature navbar remain command-only, so generated project data cannot pollute persistent toolbar/top-nav customization.
- Model object search now uses shared semantic descriptors from `bobercad/app/ui/commands/model-collection-metadata.mjs`. The left Model Browser and command-palette left-dock results both search object ids, collection labels, types, part marks, assembly marks, numbering status, profile/material refs, fastener refs, and Smart Component refs through the same pure metadata helper instead of rebuilding local keyword lists.
- The left Model Browser now has a compact `Primary` / `Advanced` scope control built with the shared segmented-control primitive. `Primary` remains the calm default; `Advanced` applies the metadata filter `["primary", "advanced"]`, exposing interfaces, connection zones, assemblies, groups, hole patterns, object patterns, and relations without hiding editable primary objects. `model-browser.mjs` also exposes `showCollection(collectionId)`, which switches to the right scope and filters by collection id for Project Data navigation.
- Project Data rows now expose explicit UI-only intents. Source rows resolve safe JSON links against the project URL and open in a new tab with `noopener noreferrer`; model content rows emit `showCollection` intents; the Smart Components library row emits `showComponents`; and `viewer-runtime.mjs` routes those intents through the existing Data Dock tab facade and Model Browser API. This makes the Data tab navigable while keeping project JSON untouched.
- The Components tab now uses a viewer-owned Smart Component browser in `bobercad/app/ui/viewer/smart-component-browser.mjs` instead of mounting the Smart Component library pack's bespoke two-member connection UI into the Data Dock. The browser reuses `bc-data-panel` primitives, groups presets by kind, supports search, creates non-connection presets directly through the public project store API, and keeps connection member picking as a contained row action. The right-side Smart Component parameter editor still uses definition-specific generated property UI, so browsing and domain editing stay separated.
- Inspector Dock context identity now has a shared metadata boundary in `bobercad/app/ui/commands/inspector-dock-metadata.mjs`. The runtime derives right-dock context tabs, labels, icons, panel element ids, default active context, storage key, workspace panel identity, dock placement, width defaults, visibility, and command copy from that source, keeping the generated Properties surface, Feature editor, Trim editor, and Smart Component parameter editor aligned as one contextual inspector system.
- Inspector generated-property context identity now has an initial metadata seam in `bobercad/app/ui/commands/inspector-property-metadata.mjs`. `inspector-panel.mjs` keeps existing update logic and field builders, but empty/member/Smart Component/object property headers, member/object/Smart Component identity sections, Smart Component diagnostic summaries, and object-reference icons now derive from shared descriptor helpers backed by `model-collection-metadata.mjs`, removing local object title/icon maps and identity-section assembly from the large inspector panel.
- Inspector support-object generated properties now use the same metadata seam. `inspector-property-metadata.mjs` owns pure descriptor helpers for Work Points, Reference Planes, Interfaces, Connection Zones, Assemblies, Groups, Hole Patterns, Object Patterns, Relations, metadata sections, bounded id lists, object references, and shared inspector formatting. `inspector-panel.mjs` injects selection/focus/update actions through `inspectorSupportObjectPropertySections()` but no longer owns those support-object builders, keeping the right-hand dynamic Properties surface closer to a UI metadata layer rather than a monolithic mounted panel.
- Active modeling tools now surface in the right Inspector as generated Properties context when no object is selected. `inspector-property-metadata.mjs` owns `inspectorActiveToolContext()` and `inspectorActiveToolSections()`, `inspector-panel.mjs` renders the active command from `MODELING_TOOLBAR_COMMANDS` with a generated Cancel action routed through `command.cancel`, and `viewer-runtime.mjs` refreshes the Inspector while clearing stale selection when modeling commands start.
- Active modeling tool properties now include editable generated precision controls instead of only read-only command status. `viewer-app-controller.mjs` exposes UI-safe `activeToolState()`, `snapSettings()`, and `cycleActiveSnap()` facade methods; `inspector-property-metadata.mjs` builds active-tool `Guidance`, `Precision`, and collapsed `Snap Targets` sections from command and snap metadata; and `inspector-panel.mjs` routes snap strength, selection scope, target toggles, snap cycling, snap settings, and cancel actions through stable command ids. This keeps the right Inspector dynamic like a professional modeling tool while avoiding direct renderer/project JSON coupling.
- Active-tool generated Properties now use a binding adapter instead of embedding UI callbacks in the metadata descriptors. `bobercad/app/ui/viewer/panels/generated-property-bindings.mjs` converts serializable `commit`, `commandId`, and `action` intents into panel handlers, while `inspectorActiveToolSections()` emits those intents for cancel, snap cycling, snap strength, selection scope, snap target toggles, and Snap settings. Repository contracts now assert that active-tool descriptors contain no functions before binding and that the adapter attaches the expected handlers at the panel boundary.
- Object-reference rows in generated Properties now use the same serializable binding path. `inspectorObjectReferenceSection()` emits `select` and `fit` intents with object ids, Smart Component generated/managed object rows use the same intent shape for object and component references, `inspector-panel.mjs` binds those intents to the existing object selection/framing facade, and repository contracts assert that raw reference descriptors stay callback-free while bound descriptors still expose renderer-ready handlers.
- Member edit Properties now follow the generated descriptor boundary. `inspector-property-metadata.mjs` owns `inspectorMemberEditSections()` for Section, Rotation, Center, Endpoints, and Alignment rows, emitting serializable `commit` and `action` intents; `inspector-panel.mjs` binds those intents to the existing member profile, rotation, endpoint, center, and alignment APIs. Contracts assert the raw member edit descriptors contain no callbacks and the adapter supplies renderer-ready handlers.
- Member material editing now uses that same generated Properties path. The viewer passes the loaded material library into the Inspector, `inspectorMemberEditSections()` emits a serializable `member.material.set` select field beside Section, and `inspector-property-bindings.mjs` routes it through the supplied member mutation callback so material changes stay on the public project-store boundary.
- Support-object generated Properties now follow the same descriptor/binding boundary. Work Points, Reference Planes, Interfaces, Connection Zones, Assemblies, Groups, Hole Patterns, and Object Patterns emit serializable `supportObject.*.update` commit intents for scalar, vector, extent, nested tracking, and editable hole-position fields; `inspector-property-bindings.mjs` assembles the resulting patches and routes them through callbacks supplied by the Inspector. Contracts now check that support-object descriptors contain no bound functions and bind to editable handlers only at the Inspector edge.
- Smart Component generated Properties now use serializable intents for quick parameters, optional generated-component toggles, lifecycle actions, diagnostics, parameter opening, and deletion. `parameterFieldDescriptor()` accepts a `commit` descriptor while preserving the older callback path, `inspectorSmartComponentPropertySections()` / `inspectorObjectGeneratedBySection()` in `inspector-property-metadata.mjs` assemble the Smart Component Properties descriptors, and `inspector-property-bindings.mjs` routes `smartComponent.*` commits/actions through callbacks supplied by `inspector-panel.mjs`.
- Ordinary object generated Properties now use the same binding edge for the first editable object slices. Fastener group, plate, first-bend, trim-operation, feature-operation/body, and weld rows emit `object.*` commit/action descriptors from `inspectorObjectPropertySections()` in `inspector-property-metadata.mjs`, while `inspector-property-bindings.mjs` converts those descriptors to existing project-store mutation callbacks. This keeps common object selection in the right-hand Properties dock declarative without changing the visual row layout, and the metadata formatter now preserves zero-valued vector coordinates for CAD positions.
- Generated Properties binding/mutation routing now has a dedicated viewer-layer boundary in `bobercad/app/ui/viewer/panels/inspector-property-bindings.mjs`. The generic adapter still attaches renderer callbacks, metadata still emits serializable descriptors, and `inspector-panel.mjs` now supplies selection, update, and editor-opening callbacks to `createInspectorPropertyBindings()` instead of owning support-object, Smart Component, and object patch/commit dispatch tables directly.
- Inspector primary pick controls are now descriptor-driven too. `inspectorPrimaryActions()` owns the Pick Member, Pick Smart Component, Pick Object, and Clear labels, SVG icon ids, titles, and action ids; `inspector-panel.mjs` binds those intents through `bindActionButtons()` and renders them with the shared `button()` primitive instead of hard-coding the row in `render()`.
- Inspector selection quick actions now use the same descriptor/binding split. `inspectorSelectionQuickActions()` emits serializable Fit, Component, Feature, Trim, Relations, and Clear intents from selection context metadata, while `inspector-property-bindings.mjs` attaches the existing selection-wide focus, Smart Component, editor-opening, relations-toggle, and clear callbacks at the panel boundary before `quickActions()` renders the strip.
- Object selection no longer renders a duplicate legacy object-detail disclosure. Generated Properties owns object identity, generated-by component references, Open Parameters, Feature/Trim editor actions, sketch-to-plate creation, and the plate sketch relation editor; deeper editors stay as explicit Inspector Dock contexts instead of a second object-detail fallback.
- Fastener groups now rely on generated Properties instead of duplicate legacy object-detail controls. `inspector-panel.mjs` no longer owns the manual `fastenerGroupEditor()` rows; catalog, length, grip, washer, nut-offset, participant, and installation metadata stay in `inspectorObjectPropertySections()` and bind through `object.fastenerGroup.update`.
- Smart Component selection now relies on generated Properties instead of a duplicate Advanced Smart Component disclosure. `inspectorSmartComponentPropertySections()` includes identity, diagnostics messages, quick parameters, generated-component toggles, lifecycle rows, Open Parameters, Resolve Diagnostics, and Remove actions; `inspector-panel.mjs` keeps only the viewer-edge callbacks and no longer renders `smartComponentEditor()`.
- Member editing now stays inside generated Properties. Section, rotation, center coordinates, endpoints, and alignment stay in `inspectorMemberEditSections()` with descriptor bindings, while custom section authoring and point-constraint removal live in advanced generated sections from `inspectorMemberAdvancedSections()` instead of a separate `Advanced Member` disclosure.
- Sketch object generated Properties now live in the metadata dispatcher. `inspector-panel.mjs` computes sketch definition state at the engine boundary, but the `Sketch` status, outline, and free-DOF descriptor rows are produced by `inspectorObjectPropertySections()` instead of an inline panel fallback.
- Sketch-to-plate creation now belongs to generated Object Properties as a serializable `object.sketch.createPlate` action. `inspector-property-metadata.mjs` owns the `Create Plate` descriptor and icon, `inspector-property-bindings.mjs` routes it through the Inspector object callback boundary, and `inspector-panel.mjs` preserves the existing create/select/message behavior without rendering a duplicate sketch object-detail editor.
- Plate sketch relation repair now starts from generated Object Properties. The `Sketch` section emits a serializable `object.plate.relations.infer` action for `Infer Relations`, `inspector-property-bindings.mjs` routes it through the object callback boundary, and the duplicate `Infer Missing Relations` button was removed from the plate relation editor so the common action has one generated owner.
- Plate bend editing now belongs to generated Object Properties instead of the old object-detail fallback. `inspector-property-metadata.mjs` emits per-bend generated sections for direction, angle, radius, flange length, relief, relief radius, and removal; `inspector-property-bindings.mjs` routes `object.plate.bend.update` and `object.plate.bend.remove`; and `inspector-panel.mjs` no longer needs a duplicate object-detail mount for plate editing.
- Plate sketch overview now has one owner. Generated Object Properties owns the plate sketch status, relation summary, diagnostics, under-defined counts, Show/Hide Relations action, and the advanced `Sketch Relations` section so selection does not show the same sketch state twice.
- The repeated plate sketch relation list now uses the generated field pipeline instead of hand-built row DOM. `inspector-panel.mjs` emits serializable generic `statusGroupTitle` and `statusRow` descriptors for the grouped relation list and Unfix All action, `generated-properties-panel.mjs` renders those descriptor types with reusable status-row CSS, and `inspector-property-bindings.mjs` routes value edits, select, mode, resolve, remove, and unfix-all intents through the object callback boundary.
- The selected-entity relation list now reuses the same generated relation-row descriptors in compact mode. The stateful add-relation preview decision table stays local to the Inspector panel for now, but repeated existing-relation rows under `Relations on selected entities` no longer hand-build their own Select/Resolve/Remove DOM.
- The selected plate sketch relation card now renders through a generated generic `summaryCard` descriptor. The descriptor carries title, status, readouts, diagnostic text, optional driving-dimension commit, edge/vertex locate actions, and relation actions, letting `generated-properties-panel.mjs` own the card row layout while `inspector-property-bindings.mjs` keeps routing relation operations through existing object callbacks.
- The under-defined plate sketch entity card now renders through a generated generic `statusListCard` descriptor. The card keeps Fix Remaining, per-edge/per-vertex Select, and fixed-relation Fix actions, while `generated-property-bindings.mjs` now binds nested action groups and row actions so generated cards can stay serializable until the viewer-edge binding pass.
- The selected-entity Add Relation controls now render through a generated `actionRow` descriptor. `inspector-panel.mjs` keeps the same relation preview decision table and construction-line endpoint matching, but emits serializable action descriptors for existing relation selection, relation creation, construction-line creation, and clearing sketch selection; `generated-properties-panel.mjs` owns the inline action row and status button classes.
- The selected sketch entities card wrapper now renders through a generated generic `nestedFieldCard` descriptor. The descriptor owns the card title, edge/vertex readouts, guidance messages, nested Add Relation action row, and nested relation rows, while `generated-property-bindings.mjs` recursively binds child fields so the card remains serializable until hydration.
- The generated Properties renderer no longer has plate-named relation field types or plate-specific relation CSS selectors. Plate sketch tooling still computes domain state in `inspector-panel.mjs`, but it now emits reusable status/summary descriptors (`statusGroupTitle`, `statusRow`, `summaryCard`, `statusListCard`, and `nestedFieldCard`) so future generated property surfaces can inherit the same design-system card and row recipes without copying plate UI branches.
- Generated Properties now honors section placement and priority metadata. `generated-properties-panel.mjs` partitions normalized sections into `main`, `actions`, `diagnostics`, and `reference` zones, sorts sections by priority inside those zones, and `panels-and-controls.css` styles the zones so primary controls, action rows, diagnostics, and lower-priority provenance/reference material stay visually grouped without hardcoding object-specific layout in the renderer.
- Generated action rows now use the shared `bc-action-row` recipe directly. `generated-properties-panel.mjs` filters hydrated action descriptors through `descriptorActions()` and appends rows with `appendActionRow()`, while `panel-elements.mjs` and `viewer-editor-panels.css` no longer carry the deprecated `editor-inline-actions` compatibility path.
- Generated status rows now use `bc-status-label` inside the shared status/list recipes instead of depending on the older `editor-value` class. The renderer can still use legacy editor classes in older panel primitives where needed, but reusable status descriptors no longer require legacy editor selectors in `panels-and-controls.css`.
- Generated Properties now emits design-system-native classes directly. Field rows, labels, messages, empty states, and generated buttons use `bc-field`, `bc-label`, `bc-message`, `bc-empty`, and `bc-button*` classes; `scripts/check_repo_contracts.js` rejects any future `editor-*` token in `generated-properties-panel.mjs` so the dynamic right-hand Properties surface no longer depends on the legacy editor compatibility mapper.
- Generated Properties shell primitives now live in the shared design-system DOM helper layer. `ui-elements.mjs` owns `propertiesPanelShell()`, `disclosureSection()`, `field()`, and `readout()` with the existing `bc-properties-*`, `bc-disclosure`, `bc-field`, and `bc-readout` contracts; `panel-elements.mjs` remains a compatibility wrapper for viewer/editor callers until the remaining panel-specific controls are migrated.
- The right Inspector chrome now emits design-system classes directly for its title and primary action row. `inspector-panel.mjs` uses `bc-inspector-title`, `bc-action-row`, and `bc-button*` for Pick/Clear controls, and contracts reject the old `editor-title`, `editor-actions`, and `editor-button` chrome path in that panel.
- The floating Member Transform panel now uses the shared `bc-empty` empty-state class for affected-point fallback text, removing another legacy `editor-*` dependency from a migrated generated-field panel.
- The rich plate sketch relation editor now mounts as the generated Object Properties section `inspector.properties.object.plate.relations`. `inspector-panel.mjs` still computes the stateful relation preview descriptors at the viewer edge, but the section is appended to the generated object section list, hydrated through `bindGeneratedPropertySections()`, and rendered by `generated-properties-panel.mjs`; the legacy object-detail renderer and direct `generatedPropertyField()` bridge were removed from the Inspector panel.
- Ordinary Smart Component parameter rows in the deeper parameter panel now follow the same generated binding boundary. `parameterFieldDescriptor()` can emit a serializable `customAction` for standard-number custom values, `generated-property-bindings.mjs` hydrates that action into `onCustom`, and `smart-component-parameter-ui.mjs` binds `smartComponent.parameter.set` / `smartComponent.parameter.customNumber` at the panel edge before rendering the generated field. Specialized Smart Component widgets keep their shell behavior local only where needed.
- Member generated-property bindings now use the shared Inspector binding boundary. `inspector-property-bindings.mjs` owns `member.*` commit/action routing for profile, rotation, center, endpoints, and alignment, while `inspector-panel.mjs` supplies only member mutation callbacks to `createInspectorPropertyBindings()`.
- Active Tool generated-property bindings now use the same shared Inspector boundary. `inspector-property-bindings.mjs` routes active command actions, Snap settings, snap strength, selection scope, and snap target toggles through callbacks supplied by `inspector-panel.mjs`, keeping command execution at the viewer edge while removing the inline binding table from `activeToolPropertiesPanel()`.
- The Inspector Dock now treats generated `Properties` as the normal dynamic context and advanced panels as explicit destinations. `inspector-dock.mjs` no longer auto-activates a panel just because it became visible; `viewer-runtime.mjs` activates `Properties` for normal selection and active modeling commands; and Feature, Trim, Component, and Smart Component parameter actions request their advanced contexts explicitly. This prevents the dynamic properties window from being hidden behind an advanced editor after routine selection changes.
- The Inspector Dock now has metadata-driven SVG context tabs again. `inspector-dock.mjs` renders available `INSPECTOR_CONTEXTS` as a compact `tablist` with `tab` / `tabpanel` ARIA wiring, keyboard navigation, active-state persistence, and icon-registry icons, while keeping `hidden` as the availability signal for advanced contexts.
- Inspector Dock contexts are now discoverable command-palette actions. `inspector-dock-metadata.mjs` owns command ids/actions/titles for Properties, Feature, Trim, and Component contexts; `command-registry.mjs` derives `INSPECTOR_CONTEXT_COMMANDS` from that metadata; and `viewer-runtime.mjs` registers context handlers with active/disabled state so users can search for deeper right-side panels instead of hunting through tabs.
- Active-tool Inspector non-visual verification evidence: syntax checks passed for `viewer-app-controller.mjs`, `inspector-property-metadata.mjs`, `inspector-panel.mjs`, `inspector-dock.mjs`, `viewer-runtime.mjs`, and `check_repo_contracts.js`; focused repository contracts validate the generated active-tool section ids, per-command guidance coverage, snap metadata driven fields, collapsed target controls, facade methods, command-id action routing, Inspector context DOM ids, explicit Properties activation, and explicit Component parameter context. No browser or Playwright visual checks were run for this slice; visual inspection remains reserved for user review.
- Project-data non-visual smoke evidence: loading the viewer mounted `Data`, `Model`, and `Components` left-dock tabs; clicking `Data` showed Source Files, Libraries, Model Contents, and Project Settings sections. Source rows included project JSON, profile/material/fastener libraries, viewer settings, and the Smart Component register path. Library rows reported 9 profile entries, 5 material entries, 5 fastener entries, and 24 Smart Component presets; model rows reported the active sample contents; Data/Model/Components panels toggled visibility through the shared tab shell. ArrowRight moved Data to Model, Home returned to Data, and the browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Left Data Dock navigation evidence: `scripts/check_repo_contracts.js` now imports `model-browser.mjs`, verifies the exported `Primary` / `Advanced` scope contract, checks that primary mode excludes advanced-only collections while Advanced includes both primary and advanced metadata collections, requires the shared `bc-data-segment` styling hook, and guards Project Data row intents through `onRowAction`, `data-project-data-action` / `data-project-data-target`, safe source links, `showDataDockTab()`, and `modelBrowserUi.showCollection()`. Module syntax checks and focused repository contracts passed with the bundled Node runtime. No browser or Playwright visual inspection was run for this slice.
- The topbar now includes a command-backed feature navbar owned by `bobercad/app/ui/shell/feature-navbar.mjs` and styled by `bobercad/app/ui/shell/feature-navbar.css`. It groups the existing viewer command provider into `Model`, `View`, `Select`, `Panels`, `Settings`, `Workspace`, and `Core` menus, uses registered SVG icons, exposes active/disabled command state, and keeps command execution inside the viewer app facade rather than adding renderer-specific branches.
- The topbar File entry is no longer a placeholder. `viewer-runtime.mjs` decorates it with the registered `file` SVG icon and opens command search filtered to workspace/file actions, so import/export/customization commands stay discoverable through the same command surface instead of a dead test-menu status message.
- The viewer-settings strip is now a command-segment surface rather than a hard-coded display-mode widget. `bobercad/app/ui/design-system/ui-elements.mjs` exposes a shared `segmentedControl()` primitive, `panels-and-controls.css` owns the tokenized `bc-segment*` recipe, `view.displayMode.*` and compact `view.orientation.*` commands carry `settingsStripGroup`/order metadata, and `viewer-settings-strip.mjs` renders live command items from the same viewer command provider used by the navbar and command palette.
- The viewer-settings strip is physically restored as its own fixed `bc-viewer-settings-band` directly under the top navbar. Reset, display mode, and compact view orientation controls stay visible under navigation while the customizable `.bc-toolbar-band` remains reserved for dockable modeling commands.
- The viewer-settings strip shows only clickable controls. Group labels/icons stay out of the visible strip, while command buttons themselves carry the SVG icons, labels, tooltips, active state, and disabled state.
- Feature-navbar non-visual smoke evidence: loading with `qaSelectObject=demo_boolean_beam` rendered the seven feature groups, opened `View` with `view.displayMode.shaded` and `view.orientation.iso` active, ran `view.orientation.top` with status `View: top`, opened `Select` with `selection.clear` enabled, cleared selection through the navbar so the model browser active row disappeared and the Inspector message/status became `Selection cleared.`, then reopened `Select` with `selection.clear` disabled and reason `Select something to clear.` The `Workspace` menu exposed 34 shell/customization commands, the first dropdown row was positioned below the secondary viewer-settings/toolbar band, and the browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.

Acceptance:

- No incoherent overlap at desktop and narrow viewport sizes.
- Canvas remains usable.
- Existing editor, library, Smart Component, feature, and trim workflows are reachable.

### Phase 4: Inspector And Panel Migration

- Rebuild object editor as a design-system inspector.
- Migrate member transform, feature editor, trim editor, and Smart Component panel to shared primitives.
- Use tabs and collapsible sections for advanced details.
- Add contextual quick actions near selections where useful.

Implementation note:

- Initial inspector migration keeps existing panel behavior but routes panel helper output through design-system classes in `bobercad/app/ui/viewer/panels/panel-elements.mjs`.
- Shared inspector, section, action-row, field, readout, message, input, and button styles were added to `bobercad/app/ui/design-system/components.css`.
- `inspector-panel.mjs`, `feature-editor-panel.mjs`, `trim-joint-editor-panel.mjs`, and `member-transform-panel.mjs` now inherit more design-system styling through shared classes and tokenized CSS.
- Shared disclosure primitives now live in `bobercad/app/ui/viewer/panels/panel-elements.mjs`, with tokenized styles in `bobercad/app/ui/design-system/components.css` and the SVG chevron affordance in `bobercad/app/ui/icons/icon-registry.mjs`.
- `bobercad/app/ui/viewer/panels/inspector-panel.mjs` now presents the right dock as a contextual Inspector with a generated `Properties` surface at the top. The generated surface changes with the active selection context, while deeper Member, Smart Component, or Object editors are shown as the single relevant advanced disclosure instead of keeping unrelated empty groups visible.
- `bobercad/app/ui/viewer/panels/generated-properties-panel.mjs` introduces a descriptor-driven properties renderer for readouts, numeric fields, selects, checkboxes, text fields, actions, badges, and token-styled property sections. The first integration covers Member identity/section/rotation/center, Smart Component identity/health/actions, and Object basics for plates, sketches, trim joints, features, and fastener groups.
- Generated Feature properties now expose the common cut-editing path directly in the right Properties surface: Operation has `Enabled` and Boolean type controls, Cutting Body has center and supported body dimensions (`Radius`/`Depth` for cylinders, `Size` for boxes, `Depth`/outline count for polygonal prisms), while axes and outline-point editing remain in the deeper Feature Editor but now render as generated field descriptors too.
- Generated Trim Joint properties now expose more of the common trim-editing path directly in the right Properties surface. The overview shows participant/operation counts, fabrication operation, and active cut; a generated `tabList` switches cuts without leaving Properties; participants and member roles render as object-reference rows; member-end and miter choices use segmented controls; member-to-member trim type changes use the shared SVG option-grid; and plane/region rows use generated action lists that open the advanced Trim context at the relevant cut or region.
- Generated Plate properties now expose the common plate-editing path directly in the right Properties surface: Plate carries `Thickness`, material, assembly/reference, and fabrication marks; Sketch summarizes status, outline, relation health, free DOF, compact diagnostic counts, and relation-overlay visibility; Bends summarizes bend count and exposes first-bend direction/angle/radius/flange/relief controls when bends exist, while the full sketch relation and multi-bend controls stay in the advanced object disclosure.
- Generated Fastener Group properties now expose the common bolt-editing path directly in the right Properties surface: Fastener carries catalog selection and library details, Assembly carries length/grip/nut-offset controls, Washers carries head/nut toggles and washer catalog dimensions, and Installation carries hole-pattern, through-feature, orientation, and participant context. Fastener groups now use a dedicated SVG fastener icon instead of borrowing the snap icon.
- Generated Weld properties now expose the common weld review/editing path directly in the right Properties surface: Weld carries editable size and optional length controls, Participants lists joined objects, Reference shows placement intent context, and Runs summarizes each weld run with edge/side/size/length details. Welds now use a dedicated SVG weld icon and a store-backed `updateWeld` path validates positive size/length values before persisting.
- Generated support-object properties now replace the generic fallback for semantic project/reference collections in the right Properties surface. Work Points, Reference Planes, Interfaces, Connection Zones, Assemblies, Groups, Hole Patterns, Object Patterns, and Relations now have grouped readouts for identity, geometry/reference vectors, counts, contents, authoring/tracking metadata, bounded object lists, and pattern bounds. The icon registry now includes dedicated SVG icons for those support-object concepts, and the slice stays read-focused until broader write APIs have explicit validation.
- Generated support-object editing now exposes safe direct controls for the support objects with clear local validation contracts. Work Points can edit role and point coordinates through `updateWorkPoint`; Reference Planes can edit name, origin, normal, local axes, and extents through the validated `setReferencePlane` path; Hole Patterns can edit hole diameter, hole type, and the first bounded set of 2D positions through `updateHolePattern`. The project store now validates finite work-point coordinates, non-zero reference-plane vectors, finite extents, positive hole diameter, finite hole positions, and stable ids/types before persisting.
- Generated metadata-object editing now covers the low-risk text/status fields that users need while organizing structural membership as read-only context. Groups can edit name through `updateGroup`; Assemblies can edit name, mark, and tracking status through `updateAssembly`; Object Patterns can edit name, status, and notes through `updateObjectPattern`. The project store validates stable ids/types, required names and object lists, supported object-pattern status/type values, optional tracking fields, and finite transform metadata before persisting.
- Generated connection-authoring editing now covers safe Interface and Connection Zone fields while keeping structural references read-only. Interfaces can edit role, notes, station, stored origin/normal/local-axis vectors, and stored extents through `updateInterface`; Connection Zones can edit name, notes, and stored origin through `updateConnectionZone`. The project store validates stable ids/types, immutable interface owners, immutable zone main objects, supported interface kinds, finite vectors/stations/extents, non-zero interface direction vectors, required zone interface ids, and optional object/component membership arrays before persisting.
- Generated Properties now has first-class compact vector descriptors. `panel-elements.mjs` renders `vector3` and `vector2` fields with shared numeric validation and tokenized `bc-vector-*` controls, and the Inspector uses `vector3` descriptors for Work Point coordinates and Reference Plane origin/normal/local axes instead of expanding each coordinate into separate scalar rows. This moves the right-hand Properties panel closer to a compact Figma-like property editor while keeping the same store validation paths.
- Generated Smart Component properties now surface a compact `Primary Parameters` section before the deeper parameter editor. The section follows `definition.ui.tabs` order, skips UI-only items, sections into nested UI groups, and plain read-only fields, keeps derived or conditionally editable values as readouts/controls, and writes through `spec.writePath || path` before reusing the existing `api.updateSmartComponent` regeneration path. The deeper parameter editor now shares the corrected read-only/editableWhen rule, so quick Properties and advanced Smart Component parameters agree about editability.
- Indexed Smart Component object selection now routes directly to the generated Smart Component Properties surface. When selection arrives through an object-id path and the object index entry belongs to `smartComponentInstances`, the Inspector reuses the existing Smart Component selection/highlight/editor path instead of showing a generic object wrapper with a second `Open Smart Component` step.
- Generated Properties action rows now use the same SVG icon convention as the rest of the professional shell. The shared `button()` primitive accepts `icon` and `pressed` options, generated Properties forwards action icon/state metadata, and actions such as Open Parameters, Remove Smart Component, Open Smart Component, Show/Hide Relations, Open Trim Editor, and Open Feature Editor now declare semantic icon ids instead of remaining text-only controls.
- Generated reference lists now use navigable object-reference rows instead of dead bounded readouts for support-object contexts where ids represent selectable model objects. Connection Zone interfaces/objects/components, Assembly contents, Group objects, and Object Pattern generated/detached objects now show semantic icons with `Select` and `Fit` actions routed through the existing Inspector selection/focus facade; Smart Component references reuse the Smart Component selection/highlight path.
- Generated Smart Component Properties now expose lifecycle controls without forcing users into the deeper custom parameter editor for common management tasks. The surface shows managed/detached/override counts, definition-backed generated component toggles for optional roles that may not exist in `objectRoles` yet, a collapsed Managed Objects section with object icons, status chips, Select/Fit actions, and validated Reset/Detach/Reattach actions, plus a Resolve Diagnostics action when diagnostics are present. New `link` and `unlink` SVG icons were added to the shared registry.
- Generated Member Properties now expose editable physical endpoints and alignment status/actions in the primary Properties surface. Users can change Start/End coordinates through the validated `setMemberPhysicalEndpoint` store path, see the current alignment relation, quickly align to global axes, start a pick-axis alignment flow, or remove alignment from a collapsed advanced section without opening the deeper Member editor.
- Member center editing, custom profile fallback, member constraints, object details, and linked component actions are grouped into nested disclosures so advanced controls stay available without turning the inspector into one long list.
- Focused Feature Editor information architecture now follows the same metadata boundary as generated Properties. `inspectorFeatureEditorSections()` in `bobercad/app/ui/commands/inspector-property-metadata.mjs` owns the serializable Overview, Operation, Source, Cutting body, Axes, and Outline descriptors, while `bobercad/app/ui/viewer/panels/feature-editor-panel.mjs` only binds those intents to existing update APIs and renders them through `bindGeneratedPropertySections()`.
- `bobercad/app/ui/viewer/panels/trim-joint-editor-panel.mjs` now uses the shared disclosure primitive and generated field descriptor path for the simple focused Trim Editor rows. Overview readouts plus cut `Result`, `Enabled`, `Gap`, `Miter`, plane/region actions, and member-end `Start`/`End` controls hydrate through `bindGeneratedPropertySections()`; the generated Properties renderer owns the reusable SVG option-grid, action-list, and segmented primitives while only the CAD-specific member picker shell remains custom.
- Trim operation option grids now use registry-backed icon ids instead of raw SVG markup. `bobercad/app/ui/commands/trim-operation-metadata.mjs` owns the operation labels, gap support, and semantic icon ids; `trim-joint-editor-panel.mjs` consumes that UI metadata; `generated-properties-panel.mjs` only accepts `option.icon` through `createIcon()` for option-grid icons; and `icon-registry.mjs` includes six dedicated trim operation SVG icons that inherit the shared design-system icon styling.
- `bobercad/app/ui/viewer/panels/member-transform-panel.mjs` now keeps the core axis movement controls visible while moving reference metadata, dependent-point details, axis movement, and confirm/cancel actions through generated field descriptors. The affected-point count is summarized in the section title, empty dependent-point state uses the shared empty style, shortcut-aware transform inputs live in the generated `axisTransformGrid` renderer, and generated action rows use shared `check`/`cancel` SVG icons.
- `bobercad/data/libraries/smart-components/smart-component-parameter-ui.mjs` now imports the shared SVG icon registry and uses the same `bc-disclosure` classes for generic Smart Component `section` items. The custom panel also joins the `bc-inspector` surface contract, text/select controls inherit `bc-input`/`bc-select`, connection actions inherit shared button classes, and the inline Smart Component style block now consumes design tokens with fallbacks.
- `bobercad/data/libraries/smart-components/member-pick-smart-component-library-ui.mjs` now uses the shared icon registry for a Smart Component SVG mark, joins the `bc-inspector` surface contract, gives the preset selector `bc-select`, gives create/cancel actions shared button classes, and moves the panel's inline styles to design tokens with fallbacks.
- `bobercad/app/ui/icons/icon-registry.mjs` now includes the `smart-component` icon used by the library/create panel.
- `bobercad/app/ui/viewer/viewer-runtime.mjs`, `bobercad/app/engine/modules/smart-components/smart-component-registry.mjs`, and `bobercad/app/ui/viewer/index.html` now use updated cache keys for the inspector, feature editor, trim editor, member transform, Smart Component editor, and Smart Component library slices so the browser loads the current modules and design-system CSS.
- `bobercad/app/ui/viewer/panels/panel-elements.mjs` now exposes a shared `quickActions()` primitive, styled by `bobercad/app/ui/design-system/components.css`.
- The Inspector now shows contextual quick actions directly under the pick controls: selected members and ordinary objects get `Fit` and `Clear`; feature objects also get `Feature`; trim joints get `Trim`; plates get a stateful `Relations` toggle; objects linked to generated Smart Components get `Component`. The shared `quickActions()` primitive now supports `aria-pressed` so toggle-style quick actions can expose state without creating bespoke button markup.
- The `Fit` action calls `viewer-app-controller.mjs` `focusSelection()` so the Inspector can frame selected objects through the viewer facade instead of reaching into WebGL directly.
- `bobercad/app/ui/icons/icon-registry.mjs` now includes the `zoom-fit` icon for selection framing.
- Verification: module syntax checks pass for `viewer-runtime.mjs`, `panel-elements.mjs`, `inspector-panel.mjs`, `feature-editor-panel.mjs`, `trim-joint-editor-panel.mjs`, `member-transform-panel.mjs`, `smart-component-parameter-ui.mjs`, `member-pick-smart-component-library-ui.mjs`, `smart-component-registry.mjs`, and `icon-registry.mjs`; `bobercad/app/ui/workspaces/default-workspace.json` validates against `ui-workspace.schema.json`; `node .\scripts\check_repo.js` passes. Browser smoke confirmed three top-level inspector disclosures, Feature Editor groups for `demo_round_part_cut` (`Overview`, `Operation`, `Cutting body`), Trim Editor groups for `demo_top_end_plane_trim` (`Overview`, `Cuts (1)`, `Members (1)`), nested `Axes` closed by default, SVG chevrons, static shell dock placement, and native disclosure state syncing through the shared helper. Browser DOM smoke for `member-transform-panel.mjs` confirmed `Reference` opens by default, `Affected points (1)` stays collapsed with one dependent-point row, all transform inputs carry `bc-input`, and browser-dispatched numeric changes still call the movement callback. Browser DOM smoke for the fin-plate Smart Component panel confirmed `bc-inspector`, tabs `Design`, `Parts`, `Bolts`, and `Welds`, shared disclosures on `Parts` (`Top notch offsets`, `Bottom notch offsets`, `Stiffeners`) and `Bolts` (`Fastener setup`), SVG chevrons, `bc-input`/`bc-select` controls, and shared button classes. Browser DOM smoke for the Smart Component library panel confirmed `bc-inspector`, SVG title icon, `bc-select`, 24 preset options, and shared button classes.
- Quick-action browser smoke confirmed `demo_round_part_cut` shows `Fit`, `Feature`, and `Clear`; `Fit` updates the Inspector message to `Selection framed.`, `Feature` opens the Feature Editor, and `Clear` removes the quick-action strip. Member smoke confirmed `demo_boolean_beam` shows only `Fit` and `Clear`, with `Fit` using the same framing path.
- Generated-properties non-visual smoke evidence: loading with `qaSelectObject=demo_boolean_beam` mounted one `data-inspector-properties` panel titled `Member` with subtitle `demo_boolean_beam`; it rendered generated `Identity`, `Primary`, and `Position` sections, one Section select, one Rotation input, and three Center inputs. The member custom-section and constraint tools now render as advanced generated Properties sections, with no separate `Advanced Member` disclosure or irrelevant empty Member/Smart Component/Object sections. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Feature-properties non-visual smoke evidence: loading with `qaSelectObject=demo_round_part_cut` mounted generated `Properties` titled `Feature` with subtitle `demo_round_part_cut` and sections `Identity`, `Operation`, and `Cutting Body`. Fields included Enabled, Boolean, Cut kind, Body, Center X/Y/Z, Radius, and Depth; toggling Enabled and changing Boolean to `BOOLEAN_ADD` kept the feature selected and reported `Feature updated.`; the generated `Open Feature Editor` action opened the deeper Feature Editor with `Overview`, `Operation`, `Cutting body`, and `Axes` sections. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Trim-properties non-visual smoke evidence: loading with `qaSelectObject=demo_top_end_plane_trim` mounted generated `Properties` titled `Trim Joint` with subtitle `demo_top_end_plane_trim` and sections `Identity`, `Trim Joint`, `Participants`, and `Operation`. Fields included Participants `1`, Operations `1`, Fabrication `top-plane-trim`, Active cut `demo_top_end_plane_trim_plane_trim`, Member 1 `demo_boolean_beam`, Type `Plane trim`, Enabled, Gap `0`, Member A `demo_boolean_beam`, Planes `1 reference plane`, and Removed regions `1`; the generated `Open Trim Editor` action switched the right dock from `Properties` to `Trim`. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Plate-properties non-visual smoke evidence: loading the fin-plate demo with `qaSelectObject=connection_fin_plate_1_fin_plate` mounted generated `Properties` titled `Plate` with subtitle `connection_fin_plate_1_fin_plate` and sections `Identity`, `Plate`, `Sketch`, `Bends`, and `Linked Component`. Fields included Thickness `10`, Material `S355`, Assembly `assembly_fin_plate_1`, Part mark `FP1`, Sketch status `Under-defined`, Outline `4 vertices`, Relations `12 (4/8 independent)`, Free DOF `4`, Under-defined `4 vertices, 4 edges`, compact Diagnostics `2 warnings`, Bends count `0`, and linked component root `connection_fin_plate_1`; the generated `Show Relations in 3D` action kept the Plate selected and changed to `Hide Relations in 3D`. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Fastener-properties non-visual smoke evidence: loading the fin-plate demo with `qaSelectObject=connection_fin_plate_1_bolts` mounted generated `Properties` titled `Fastener Group` with subtitle `connection_fin_plate_1_bolts`, a six-path SVG fastener icon, and sections `Identity`, `Fastener`, `Assembly`, `Washers`, `Installation`, and `Linked Component`. Fields included Fastener `M16_8_8`, Kind `through-bolt`, Standard `EN 14399`, Grade `8.8`, Diameter `16`, Hole `18 round`, Length `60`, Grip length `18`, Head washer/Nut washer toggles, washer outer diameter `30`, washer thickness `3`, hole pattern `connection_fin_plate_1_bolt_grid`, through features, head side `fin-plate-side`, axis `0, -1, 0`, and two participants; toggling Head washer kept the selection on the fastener group and reported `Fastener group updated.`. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Weld-properties non-visual smoke evidence: loading the fin-plate demo with `qaSelectObject=connection_fin_plate_1_support_weld` mounted generated `Properties` titled `Weld` with subtitle `connection_fin_plate_1_support_weld`, a five-path SVG weld icon, and sections `Identity`, `Weld`, `Participants`, `Reference`, `Runs`, and `Linked Component`. Fields included Size `6`, Participants `2`, Runs `2`, participant rows for `column_1` and `connection_fin_plate_1_fin_plate`, Kind `plate-support-edge`, Plate `connection_fin_plate_1_fin_plate`, Support interface `if_column_1_x_plus_fin_plate`, Run 1 `support / front`, Run 1 size `6`, Run 2 `support / back`, Run 2 size `6`, and linked component root `connection_fin_plate_1`. A store-level update smoke changed weld size to `7` and rejected size `0` with `project store: weld size must be a positive number`; browser text-entry mutation was not used because the Browser Use virtual clipboard was unavailable in this session. The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated support-object Properties non-visual smoke evidence: loading selected support objects through `qaSelectObject` mounted contextual generated `Properties` with the `generated-properties-support-objects-1` cache key, dedicated SVG icons, and zero missing expected sections/fields for eight representative cases. The fin-plate demo covered Hole Pattern `connection_fin_plate_1_bolt_grid` (`Identity`, `Hole Pattern`, `Positions`, `Authoring`, `Linked Component`; hole diameter `18`, type `round`, 3 positions, bounds `X: 0..0, Y: -80..80`), Interface `if_column_1_x_plus_fin_plate` (`Identity`, `Interface`, `Local Axes`; owner `column_1`, role, face, station, origin, normal, extents, local axes), Connection Zone `cz_fin_plate_1` (`Identity`, `Connection Zone`, `Interfaces`, `Objects`, `Smart Components`; main object, 2 interfaces, 8 managed objects, 1 Smart Component), Assembly `assembly_fin_plate_1` (`Identity`, `Assembly`, `Contents`, `Tracking`; mark, child/member/plate/fastener/weld/zone counts), Group `group_zone_a` (`Identity`, `Group`, `Objects`; project-tree ref and 16 bounded object rows), and Reference Plane `connection_fin_plate_1_beam_gap_trim_plane` (`Identity`, `Reference Plane`, `Authoring`, `Linked Component`; name, origin, normal, axes). The connection-test-frame demo covered Work Point `wp_c1_base` (`Identity`, `Work Point`; role, point, grid system, grid refs). The stair-tread-variants demo covered Object Pattern `sc_plate_tread_tread_pattern` (`Identity`, `Object Pattern`, `Generated Objects`, `Authoring`, `Linked Component`; status `linked`, kind, family, count, generated/detached counts). The browser console reported zero errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated support-object editing non-visual evidence: a store-level smoke changed Work Point `wp1` point to `[1, 2, 3]`, changed Reference Plane `rp1` normal to `[0, 1, 0]` and `extents.xMin` to `-20`, and changed Hole Pattern `hp1` diameter to `20` plus first position to `[5, 10]`; invalid patches were rejected with `project store: work point point must be a finite [x, y, z] point`, `project store: reference plane normal cannot be zero length`, and `project store: hole diameter must be a positive number`. Browser DOM smoke confirmed `generated-properties-support-edit-1` loads editable controls for Work Point role/Point X/Y/Z, Reference Plane name/origin/normal/axis fields, and Hole Pattern diameter/type plus collapsed Position Editing fields, with zero console errors. Browser text-entry mutation was not used because the Browser Use virtual clipboard was unavailable in this session. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Inspector metadata-boundary evidence: `scripts/check_repo_contracts.js` now imports `inspector-property-metadata.mjs`, checks support-object dispatcher output for all support collections, verifies generated property field renderer support for descriptor field types, requires the expanded design-system/shell file set, and guards against moving support-object builders back into `inspector-panel.mjs`. Non-visual verification used bundled Node syntax checks plus `scripts/check_repo_contracts.js`; no browser or Playwright visual inspection was run for this slice.
- Generated metadata-object editing non-visual evidence: a store-level smoke changed Group `group_zone_a` name to `Updated group`, Assembly `assembly_fin_plate_1` name/mark/status to `Updated assembly`/`UA1`/`checked`, and Object Pattern `sc_plate_tread_tread_pattern` name/status/notes to `Updated pattern`/`partially-detached`/`Review detached positions`; invalid patches were rejected with `project store: group name must be a non-empty string`, `project store: assembly tracking.shopOrSite must be shop or site`, and `project store: object pattern status is unsupported: archived`. Browser DOM smoke confirmed `generated-properties-metadata-edit-1` loads Assembly controls for Name/Mark/Status, Group Name editing with Project tree and Objects context, and Object Pattern Name/Status/Notes controls with Status as a native select, with zero console errors. Browser text-entry mutation was not used because the Browser Use virtual clipboard was unavailable in this session. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated connection-authoring editing non-visual evidence: a store-level smoke changed Interface `if_column_1_x_plus_fin_plate` role/notes/origin/station/extents to `updated-support-face`/`Reviewed in inspector`/`[171, 2, 1501]`/`1051`/`{ width: 161, height: 301 }`, and changed Connection Zone `cz_fin_plate_1` name/notes/origin to `Updated fin plate zone`/`Zone note`/`[150, 0, 1500]`; invalid patches were rejected with `project store: interface normal cannot be zero length`, `project store: interface owner cannot be changed`, `project store: connection zone origin must be a finite [x, y, z] point`, and `project store: connection zone main object cannot be changed`. Browser DOM smoke confirmed `generated-properties-zone-interface-edit-1` loads Interface controls for Role/Notes/Station/Origin/Normal/Extents/Local axes and Connection Zone controls for Name/Notes with structural context rows, with zero console errors. Browser text-entry mutation was not used because the Browser Use virtual clipboard was unavailable in this session. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Generated Smart Component quick-parameter non-visual evidence: a store-level smoke loaded the real Smart Component registry and library packs, changed `connection_fin_plate_1` parameters `plate.thickness` to `12` and `fit.clipBeam` to `false`, and rejected `plate.thickness = 0` with `fin-plate: plate.thickness must be a positive number`. Browser DOM smoke opened the selected fin-plate Smart Component from the generated Linked Component action, confirmed `smart-component-quick-properties-1` loads `Primary Parameters` with `Plate thickness (mm)`, `Plate length (mm)`, `Plate height (mm)`, `Support edge (mm)`, `Beam gap (mm)`, and `Clip beam`, kept `Open Parameters` and `Remove Smart Component` in Actions, and reported zero console errors. Browser text-entry mutation was not used because the Browser Use virtual clipboard was unavailable in this session. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Latest Smart Component quick-parameter non-browser evidence: syntax checks passed for `parameter-values.mjs`, `smart-component-parameter-ui.mjs`, `inspector-panel.mjs`, and `check_repo_contracts.js`; an exact ESM assertion confirmed `moment-end-plate` quick paths are `plate.thickness`, `plate.width`, `plate.height`, `bolts.rows`, `bolts.columns`, `bolts.pitch` while raw `plate.offset` stays out because it is absent from `ui.tabs`; `stair-system` quick paths start at `levels.ffl1` after skipping the UI-only `stairRouteModules` route editor; and `node .\scripts\check_repo_contracts.js` passes. No browser or Playwright visual checks were run for this slice.
- Generated Properties now supports editable `numberList` descriptors for Smart Component quick parameters. `generated-properties-panel.mjs` renders compact pipe/comma/space-separated numeric-list fields with item minimum validation, `inspector-panel.mjs` emits `numberList` descriptors for editable Smart Component list parameters instead of degrading them to readouts, and `panels-and-controls.css` adds tokenized number-list field styling. Non-browser verification confirmed descriptor wiring, module syntax, `node .\scripts\check_repo_contracts.js`, and `node .\scripts\check_repo.js` pass.
- Smart Component parameter controls now share the generated-property descriptor path. `parameter-values.mjs` exports `parameterFieldDescriptor()` for ordinary number, number-list, boolean, text, enum, and catalog parameters; the quick Inspector and the deeper Smart Component parameter panel both consume that adapter, while specialized widgets such as stair route modules stay custom. `generated-properties-panel.mjs` exposes `generatedPropertyField()` so the Component tab can render ordinary rows through the shared field renderer without embedding an extra Properties header.
- Smart Component standard numeric choices now use the same generated-property path as ordinary parameters. `parameter-values.mjs` emits `numberChoice` descriptors for catalog-backed fastener length options, `panel-elements.mjs` owns the select-plus-custom control and shared numeric validation, and the deeper Smart Component panel only preserves transient custom-choice state. Positive integer, max, exclusive max, and step metadata now flow through `panel-elements.mjs` numeric validation instead of remaining documentation-only parameter intent.
- Smart Component role and generated-plate toggles in the deeper parameter panel now use generated checkbox descriptors too. `smart-component-parameter-ui.mjs` emits serializable `smartComponent.roleActive.set` and `smartComponent.plateIncluded.set` commit intents, binds them at the panel edge to the existing role/plate update APIs, and preserves required generated plates as disabled generated controls with a clear disabled reason; complex stair route cards and override widgets remain custom only where they need custom shell behavior.
- Stair route module scalar/select/checkbox controls now use generated descriptors inside the custom route card shell. `smart-component-parameter-ui.mjs` emits `smartComponent.routeModule.set` commit descriptors for module type, step overrides, radius, turn direction, rotation, landing length/extensions, and switchback distance; route Add and Remove controls now use generated `actionRow` descriptors with `smartComponent.routeModule.add/remove` actions, while drag/drop ordering stays local to the route widget.
- Smart Component diagnostics in the deeper parameter panel now use the generated field renderer through a shared `diagnosticList` descriptor. The descriptor preserves severity, title, and metadata rows for clause/rule/parameters/roles/measured/allowed values while keeping Resolve Diagnostics in the footer action path.
- Smart Component managed-object override rows in the deeper parameter panel now use generated `objectRefList` descriptors. Reset overrides, Detach, and Reattach are serializable actions bound at the panel edge to the existing Smart Component lifecycle APIs, matching the right Inspector lifecycle pattern.
- Smart Component parameter-panel footer controls now use generated `actionRow` descriptors instead of local footer buttons. Modify, Delete, and conditional Resolve Diagnostics actions carry shared SVG icon ids and bind at the panel edge to the existing apply/delete/resolve handlers.
- Stair computed-geometry readouts in the deeper Smart Component parameter panel now use generated `readoutList` descriptors. Step height/count, target count, and optional flight split keep the same solver-output fallbacks while shared design-system CSS owns the readout-list spacing.
- Nested sections inside the deeper Smart Component parameter panel now use the shared `disclosureSection()` primitive instead of a private chevron/disclosure renderer. The panel keeps its per-session open-state map while inheriting the same disclosure classes and SVG chevron behavior as the rest of the Inspector.
- Smart Component parameter tabs now render through generated `tabList` descriptors bound at the panel edge with `smartComponent.parameterPanel.tab.set`. The shared renderer owns `tablist` / `tab` semantics plus Arrow, Home, and End keyboard navigation, and `panels-and-controls.css` owns the tab strip/button styling through `bc-panel-tab-strip` / `bc-panel-tab` modifiers while the panel keeps the same focus-path tab selection and body render behavior.
- Smart Component parameter-panel fallback readout rows now render through generated field descriptors instead of local `property-readout` markup, inline `property-*` CSS, or a private readout wrapper. Live parameter refreshes now target the generated `.bc-readout[data-path]` / `.bc-readout-value` path, so changing readout styling in the design system updates the deeper parameter panel too.
- Smart Component parameter-panel wrappers now use design-system-native `bc-*` classes instead of the last `property-section` / `property-tab-body` shell names. Nested parameter sections keep the shared disclosure primitive with `bc-disclosure-nested`, tab panels use `bc-parameter-tab-body bc-properties-body`, and contracts reject the old property wrapper names so the deeper Component editor keeps converging with generated Properties.
- Generated diagnostic and object-reference lists now use shared design-system classes (`bc-diagnostic-*`, `bc-object-ref-list`) instead of Smart Component inline `diagnostic-*` selectors. The same generated `diagnosticList` / `objectRefList` field types can now render consistently outside the Smart Component parameter panel.
- Trim Editor plane and region controls now use generated action-list descriptors. `generated-properties-panel.mjs` supports a reusable `actionList` field type with design-system styling in `panels-and-controls.css`, and `trim-joint-editor-panel.mjs` emits serializable `trim.plane.pick`, `trim.plane.remove`, and `trim.region.toggle` actions for plane-trim rows instead of local plane chips and region buttons.
- Trim Editor member-end controls now use generated `segmented` descriptors bound through `trim.operation.memberEnd.set`. The old private `trimOptionGroup`, `endToggle`, `trim-member-end-toggle`, and `trim-end-option` implementation has been removed, leaving only a small layout adapter for the generated segmented field inside the CAD-specific member picker.
- Member Transform axis movement now uses a generated `axisTransformGrid` descriptor. The generated Properties renderer owns the shortcut-aware X/Y/Z delta and result inputs, SVG plus/minus nudge buttons, and increment row; `member-transform-panel.mjs` now only emits `transform.delta.set`, `transform.result.set`, `transform.increment.set`, `transform.nudge`, confirm, and cancel intents while `panels-and-controls.css` owns the axis-grid styling.
- Member Transform UI formatting is now local to the focused panel instead of importing engine helpers. The panel keeps tiny number and array guards beside its generated descriptor adapter, and contracts reject engine/rendering imports in the transform UI layer.
- Left-dock data panels now share `dataPanel*` DOM primitives from `ui-elements.mjs` for repeated header, search, section, collection, empty-state, and row-copy scaffolding. Model Browser, Project Data, and Smart Component Browser preserve their existing callbacks and dataset hooks while inheriting the same `bc-data-*` structure from one helper layer.
- Generated field descriptor state is now part of the shared design-system contract. `generated-properties-panel.mjs` honors `disabled`, `disabledReason`, `readOnly`, `help`, `error`, `warning`, and `validation` metadata with accessible control state, field notes, and action-button wrapping; `panel-elements.mjs` prevents disabled generated buttons from firing; `panels-and-controls.css` owns tokenized help/validation/read-only/disabled styling; and `parameter-values.mjs` preserves Smart Component parameter `help`/`description` and read-only state in generated descriptors. Static contracts in `check_repo_contracts.js` cover the renderer, button primitive, CSS selectors, and Smart Component descriptor producer.
- Project JSON isolation now has parsed contract coverage instead of raw string scanning. `check_repo_contracts.js` rejects UI workspace/viewer schemas, root or settings-level UI preference keys, generated runtime caches, mesh/render payloads, and non-sketch `vertices` in project JSON while explicitly keeping semantic `sketch.vertices`, `display`, `authoring.controls`, Smart Component geometry/layout parameters, and `placementIntent` legal. The same contract also prevents `project.schema.json` from referencing UI workspace/viewer settings schemas or blessing root UI properties.
- Indexed Smart Component selection routing evidence: no Playwright/browser automation was used after the verification policy update. Static source review confirmed `selectObject()` now delegates `smartComponentInstances` entries to `selectSmartComponent()`, and cache keys were bumped to `smart-component-quick-properties-2`; module syntax checks for the store, inspector, generated properties panel, icon registry, and viewer runtime passed, and `node .\scripts\check_repo.js` passed.
- Expanded quick-action evidence: no Playwright/browser automation was used. Static source assertions confirmed selected Trim Joint objects add a `Trim` quick action, selected Plate objects add a `Relations` quick action that toggles `sketchMode` between `relations` and `clean`, and the shared quick-action primitive emits `aria-pressed`; module syntax checks for `panel-elements.mjs`, `inspector-panel.mjs`, and `viewer-runtime.mjs` passed.
- Generated action icon evidence: no Playwright/browser automation was used. Static source assertions confirmed `button()` handles `options.icon`, generated Properties forwards `field.icon` and `field.pressed`, generated action descriptors declare `smart-component`, `relation`, `trim`, `feature`, and `cancel` icons, and `panels-and-controls.css` defines tokenized `.bc-button .bc-icon` and `.bc-button-label` styles. Module syntax checks for `panel-elements.mjs`, `generated-properties-panel.mjs`, and `inspector-panel.mjs` passed.
- Trim operation icon evidence: no Playwright/browser automation was used. Static repository contracts confirmed all six trim operation option icons exist in the shared registry, trim operation UI metadata exposes id/label/gap/icon for each supported result, the Trim editor imports UI metadata instead of the rendering SVG helper, and generated option grids no longer accept `option.iconMarkup` or raw template SVG injection.
- Generated object-reference evidence: no Playwright/browser automation was used. Static source assertions confirmed shared panel primitives handle `objectRef` rows with Select/Fit actions, the Inspector creates object-reference sections for Connection Zones, Assemblies, Groups, and Object Patterns while keeping Hole Pattern positions as value readouts, and `panels-and-controls.css` defines tokenized `.bc-object-ref-*` classes. Module syntax checks for `panel-elements.mjs`, `generated-properties-panel.mjs`, `inspector-panel.mjs`, and `viewer-runtime.mjs` passed with the bundled Node runtime; `node .\scripts\check_repo.js` passed through the same runtime.
- Active-tool Inspector evidence: no Playwright/browser automation was used. Static source assertions confirmed active-tool context and section descriptors are exported from `inspector-property-metadata.mjs`, the Inspector renders them through generated Properties using `MODELING_TOOLBAR_COMMANDS` and `app.commandState()`, cancellation routes through `app.runCommand("command.cancel")`, and the runtime refreshes/clears stale selection on command start. Module syntax checks for `inspector-property-metadata.mjs`, `inspector-panel.mjs`, `viewer-runtime.mjs`, and focused repository contracts passed.
- Generated Smart Component lifecycle evidence: no Playwright/browser automation was used. Static source assertions confirmed definition-backed generated component toggles, Managed Objects object-reference rows with extra actions/status text, Resolve Diagnostics wiring, cache keys, and `link`/`unlink` icon registration. A store-level smoke loaded `sample_beam_to_column_fin_plate.json` with the real starter libraries and Smart Component catalog, enabled optional role `backFinPlate`, verified generated object `connection_fin_plate_1_back_fin_plate`, detached and reattached that object, then disabled the role again. Module syntax checks for `icon-registry.mjs`, `panel-elements.mjs`, `generated-properties-panel.mjs`, `inspector-panel.mjs`, and `viewer-runtime.mjs` passed with the bundled Node runtime.
- Generated object ownership is now surfaced inline. Selecting a managed plate, feature, weld, fastener group, or other generated object in the generated Properties panel adds a `Generated By` section with the direct Smart Component, optional root Smart Component, role label, lifecycle status, and reset/detach/reattach/open-parameters actions, so object-level inspection exposes provenance without mixing UI state into project JSON.
- Generated Properties sections now carry normalized progressive-disclosure metadata. `inspector-property-metadata.mjs` defines section `level`, `placement`, and `priority` contracts; `generated-properties-panel.mjs` normalizes every descriptor before rendering and exposes those values on disclosure sections, giving the right Inspector a stable path for calm primary defaults, advanced sections, diagnostics, and future customization.
- Shell layout geometry now has a central design-system token layer. `tokens.css` owns topbar row heights, statusbar height, toolbar/dock offsets, floating dock sizing, inspector wide minimums, and nav-cube stage/model sizes; `workspace-shell.css` and `nav-cube.css` consume those tokens so changing shell proportions no longer requires hunting through panel CSS.
- Generated Member endpoint/alignment evidence: no Playwright/browser automation was used. Static source assertions confirmed the generated Member Properties surface includes `Endpoints`, `Alignment`, Start/End controls, `setMemberPhysicalEndpoint`, and global-axis alignment actions. A store-level smoke loaded `sample_boolean_beam.json`, moved `demo_boolean_beam` start X by 10 mm through `setMemberPhysicalEndpoint`, added a global X `member-align-axis` relation, and removed it through `clearMemberAlignment`; module syntax checks for `inspector-panel.mjs` and `viewer-runtime.mjs` passed with the bundled Node runtime.
- Standard-check compatibility note: `check_repo_structure.js` exposed an existing mismatch between fin-plate sample data/dimensions and regeneration validation where `welds.top = 0` and `welds.bottom = 0` mean `no weld`. `support-edge-fillet.mjs` now skips zero-sized weld runs while still requiring at least one positive run, and `support-web-stiffeners.mjs` now accepts non-negative optional top/bottom weld sizes and skips zero-sized stiffener welds, preserving the stored sample semantics and allowing `node .\scripts\check_repo.js` to pass.
- `bobercad/app/ui/shell/inspector-dock.mjs` and `bobercad/app/ui/shell/inspector-dock.css` now wrap right-side `data-inspector-context-panel` slots into one contextual Inspector dock. The shell owns the Inspector header, SVG context tabs, keyboard tab navigation, active-context persistence, ARIA tab/tabpanel wiring, and body-level visibility while the Properties, Feature, Trim, and Component slots keep their existing rendering and model-update behavior.
- Inspector context panel identity is now metadata/slot-driven rather than legacy DOM-id driven. `inspector-dock-metadata.mjs` declares `panelSlot`, `index.html` exposes matching `data-inspector-context-panel` slots, `viewer-runtime.mjs` resolves panels from those slots, and shell/editor CSS targets the slot attributes instead of `object-editor`, `feature-editor`, `trim-joint-editor`, or `custom-panel` ids.
- Focused Inspector editor chrome now emits design-system-native classes directly. The shared `renderEditorPanel()` helper uses generic `bc-editor-header`, `bc-inspector-title`, `bc-inspector-section`, and `bc-button` classes instead of Feature-specific or legacy editor chrome names; Trim Editor custom cut/member actions now use native `bc-button`, `bc-button-primary`, `bc-button-danger`, `bc-empty`, `bc-section-title`, and `bc-trim-section` classes; generated multiline metadata asks for `bc-field bc-field-stack` directly; and the unused legacy `editor-sketch-status` / `editor-details` CSS was removed.
- Focused Inspector editor color fallbacks now respect the design-system boundary. Sketch-to-Plate creation no longer stamps hardcoded display colors from `inspector-panel.mjs`, leaving created-object appearance to model/rendering defaults, and Trim Editor member swatches fall back to `var(--bc-color-guide)` instead of a fixed UI hex color.
- Shared panel primitive defaults now emit design-system markup for generated and focused editors without a legacy compatibility mapper. `panel-elements.mjs` now accepts `bc-*` classes directly for fields, labels, subtitles, messages, readouts, buttons, and action rows; contracts reject the old `editor-*` translation tokens so changing the design-system recipes updates the dynamic Properties surface without relying on legacy helper output.
- Shared panel primitives are now UI-local instead of importing engine helpers for number formatting and array handling. `panel-elements.mjs` keeps tiny control-formatting helpers beside the DOM primitives, and contracts reject engine/rendering imports in the generated Inspector/property primitive layer.
- The model Grid command no longer runs a placeholder “not wired” tool. It remains discoverable through command search as a planned capability, but `viewer-runtime.mjs` marks `model.grid.create` disabled with a clear Data/Properties fallback message and contracts prevent the fake Grid creator status path from returning.
- Workspace customization choices now share the same segmented-control primitive as generated Properties, Model Browser, Status scope, and the viewer settings strip. Theme, Density, toolbar dock, and panel dock controls all render through `segmentedControl()`, while `workspace-customizer.css` keeps only layout-specific wrappers and no longer redefines global `.bc-segment-button` styling.
- Snap settings command ownership now matches the shell map. The bottom-strip Snap summary routes through `settings.snap.toggle`, `status-bar.mjs` exposes a small popover API, and `viewer-command-adapter.mjs` toggles the visible bottom-strip Snap menu before falling back to the toolbar popover.
- Topbar action triggers now share a single design-system helper. `topbarMenuButton()` in `ui-elements.mjs` owns SVG icon, label, shortcut keycap, tooltip, popup, and expanded-state markup for File, command search, and Workspace Settings, replacing three local decoration recipes.
- Generated Properties action rendering now inherits shared panel primitives. `panel-elements.mjs` exports `actionButton()`, `actionRow()`, descriptor action filtering, property button classing, and generated `action` / `actionRow` / `actionList` controls; `generated-properties-panel.mjs` uses those helpers for action fields, action rows/lists, status rows, summary cards, and object-reference actions instead of repeating button-state wiring locally.
- Generated Properties segmented fields now inherit the shared panel primitive layer. `panel-elements.mjs` wraps the design-system `segmentedControl()`, owns option normalization and `bc-segmented-field` row markup, and leaves `generated-properties-panel.mjs` with descriptor routing and read-only fallback behavior.
- Generated Properties option-grid and tab-list controls now inherit shared panel primitives too. `panel-elements.mjs` owns registry-backed option icons, ARIA selection state, keyboard tab navigation, and `bc-option-grid-*` / `bc-tab-*` markup, while `generated-properties-panel.mjs` stays focused on descriptor routing and read-only fallback behavior.
- Generated Properties number-choice controls now inherit shared panel primitives. `panel-elements.mjs` owns catalog option normalization, the Custom selector path, numeric validation, read-only custom input state, and `bc-number-choice-*` markup, while `generated-properties-panel.mjs` only routes `numberChoice` descriptors and read-only fallback behavior.
- Generated Properties number-list controls now inherit the shared panel primitive layer as well. `panel-elements.mjs` owns pipe/comma/space parsing, finite-number validation, item minimum metadata, Enter-to-commit behavior, and `bc-number-list-*` markup, while the generated Properties renderer keeps only descriptor routing and read-only fallback behavior.
- Generated Properties vector controls now inherit shared panel primitives. `panel-elements.mjs` owns `vector2`/`vector3` axis label resolution, numeric inputs, unit display, and `bc-vector-*` markup, while `generated-properties-panel.mjs` only routes descriptors and supplies formatted read-only fallback text.
- Generated Properties readout lists, object-reference rows/lists, and diagnostic lists now inherit shared panel primitives. `panel-elements.mjs` owns `bc-readout-list`, `bc-object-ref-*`, and `bc-diagnostic-*` markup plus reference action styling, while `generated-properties-panel.mjs` supplies descriptor routing and the domain value formatter hook.
- Generated Properties axis-transform grids now inherit shared panel primitives. `panel-elements.mjs` owns the transform table, before/move/after inputs, step buttons, increment row, confirm/cancel shortcut handling, and `bc-axis-transform-*` markup, while `generated-properties-panel.mjs` only routes `axisTransformGrid` descriptors.
- Left-dock data rows now inherit shared design-system primitives. `ui-elements.mjs` exports `dataPanelRow()`, `dataPanelActionRow()`, and `dataPanelLinkRow()` for the Model Browser, Project Data, and Smart Component Browser; `panels-and-controls.css` owns generic `bc-data-row[data-state]` status styling for error, pick, created, and cancelled rows.
- Command visual state now has a shared design-system helper. `applyCommandState()` in `ui-elements.mjs` owns `data-command-active`, `aria-pressed`, `aria-disabled`, disabled reasons, active/current classes, and shortcut-aware tooltip text for modeling toolbar buttons, viewer settings strip controls, feature ribbon commands, command palette results, and workspace-customized toolbar/overflow commands.
- Top-navbar ribbon sections now come from command metadata instead of shell-local heuristics. `command-group-metadata.mjs` owns ribbon section order, labels, and fallback inference helpers, while `feature-navbar.mjs` only consumes those helpers to group explicit `ribbonSection` command metadata.
- Modeling toolbar status text now routes through bottom status-bar ownership. `mountModelingToolbar()` accepts an `onStatusChange` callback for prompt updates, keeps direct DOM text writes as a fallback only, and `viewer-runtime.mjs` passes a dedicated `updateStatusBarPrompt()` bridge to `statusBar.setPrompt()`.
- Workspace customization rows now inherit shared design-system primitives. `ui-elements.mjs` owns toggle rows, add/action rows, move buttons, and drag-handle button markup with a semantic `drag-handle` SVG, while `workspace-customizer-panel.mjs` keeps the domain-specific visibility, ordering, and pointer-drag behavior.
- Workspace customizer row drag behavior now shares one design-system binding primitive. `bindWorkspaceCustomizerRowReorderDrag()` owns pointer capture, drag/drop row classes, scope filtering, and source/target dataset lookup, while `workspace-customizer-panel.mjs` only declares the relevant row selectors and workspace reorder callbacks for top navigation, toolbar groups, toolbar commands, bottom strip, settings strip, and panel tabs.
- Compact toolbar and customizer control sizing now inherits density-aware design tokens. `tokens.css` defines tiny/tile/action/icon sizing plus customizer row columns, and both the viewer settings strip and workspace customizer consume those variables instead of local 30px/26px/42px control constants.
- The feature navbar/ribbon compact geometry now inherits design-system sizing tokens. `tokens.css` owns tab height/widths, ribbon min height, section title height, command tile widths, icon sizes, and label clipping, while `feature-navbar.css` consumes those variables for desktop and narrow breakpoints instead of hard-coded local dimensions.
- Shell chrome controls now have shared design-system constructors. `ui-elements.mjs` owns toolbar drag handles, toolbar overflow rows, and dock resize/reveal/pin buttons, including their classes, SVG icons, tooltip wiring, and ARIA attributes, while `workspace-customizer-panel.mjs` keeps only the workspace behavior for dragging toolbars, running overflowed source commands, resizing docks, and toggling pin/reveal state.
- Generated Properties status and message rows now inherit shared panel primitives. `panel-elements.mjs` owns `statusGroupTitleControl()`, `statusRowControl()`, and `messageControl()`, while `generated-properties-panel.mjs` routes descriptor types through those controls instead of carrying local status/message markup.
- Shared disclosure chevron state is now CSS-driven. `panel-elements.mjs` only updates the disclosure `data-state`, and `panels-and-controls.css` owns the open-state chevron color and rotation, keeping generated Properties and Component parameter disclosures styleable through the design system.
- Generated Properties summary-card shells now inherit shared panel primitives too. `panel-elements.mjs` owns `summaryCardControl()` and `statusListRowControl()`, while `generated-properties-panel.mjs` keeps only descriptor-specific readouts, diagnostics, actions, and nested child rendering.
- The generated Properties panel shell now lives in shared panel primitives. `propertiesPanelShell()` in `panel-elements.mjs` owns the `bc-properties-*` panel, header, badge, body, empty-state, and `data-inspector-properties` markup, leaving `generated-properties-panel.mjs` focused on descriptor normalization, disclosure metadata, and field routing.
- Focused editor close controls now use the shared icon-capable button primitive with the `cancel` SVG instead of a text-only close action, keeping Feature/Trim/Component editor chrome aligned with the icon-led shell controls.
- `bobercad/app/ui/icons/icon-registry.mjs` now includes a semantic `feature` icon for the Feature inspector context, and `workspace-shell.css` lets trim-specific dock widening apply only when the Trim context is the active inspector tab.
- Inspector-dock non-visual smoke evidence: loading with `qaSelectObject=demo_round_part_cut` mounted one `.bc-inspector-dock-shell`, moved Properties and Feature panels into `.bc-inspector-dock-body`, exposed `Properties` and `Feature` tabs with `role=tab` and panel `role=tabpanel`, kept hidden Trim/Component contexts unavailable, switched Feature/Properties by click and Home/ArrowRight, set inactive context panels to computed `display: none`, updated the bottom status prompt, and reported zero browser console errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- `bobercad/app/ui/viewer/viewer-editor-panels.css` now removes the old global HUD/title/meta styling and tokenizes Feature Editor and Trim Editor state styles, including sketch status, relation diagnostics, trim cards, member rows, region buttons, trim type buttons, and invalid fields. Those panels now derive state colors from `--bc-color-*` tokens and `color-mix()` instead of carrying fixed light-theme colors.
- Shared editor-panel primitives now inherit from the design-system panel layer. `bobercad/app/ui/viewer/panels/panel-elements.mjs` maps legacy editor helper classes onto `bc-*` classes for titles, sections, fields, inputs, action rows, help, and validation messages; `bobercad/app/ui/design-system/panels-and-controls.css` owns the tokenized primitive styling; and `bobercad/app/ui/viewer/viewer-editor-panels.css` keeps only Feature/Trim-specific composition and state styles.
- Editor-panel browser smoke confirmed selecting `demo_round_part_cut` opens the Feature Editor with expected groups (`Overview`, `Operation`, `Cutting body`, `Axes`), keeps the project summary `#hud` static inside `.bc-topbar`, keeps the Feature Editor docked below the topbar, and has no sampled Feature Editor text overflow. Selecting `demo_top_end_plane_trim` opens the Trim Editor with expected groups (`Overview`, `Cuts (1)`, `Cut 1: Plane trim`, `Members (1)`), tokenized default/active/removed row states, and no sampled trim-control text overflow. Screenshots captured at `artifacts/ui-qa-professional-shell/editor-panels-token-feature.png` and `artifacts/ui-qa-professional-shell/editor-panels-token-trim.png`.
- Remaining work: continue expanding quick actions where they remove high-value inspector travel, and continue retiring legacy viewer CSS that still has bespoke styling outside the shared design-system path.

Acceptance:

- Selection opens relevant inspector content.
- Advanced fields are available but not shown as one overwhelming list.
- Field validation and messages use shared components.

### Phase 5: Workspace Customization

- Add default workspace JSON.
- Add drag handles for toolbar groups and toolbar buttons.
- Add customize mode.
- Persist user overrides in `localStorage`.
- Add reset workspace and reset toolbar actions.
- Add schema/validation if default workspace config becomes a committed contract.

Implementation note:

- Initial workspace customization now lives in `bobercad/app/ui/shell/workspace-customizer-panel.mjs`, keeping toolbar customization in the shell layer instead of inline viewer boot code.
- `bobercad/app/ui/viewer/viewer-runtime.mjs` only passes viewer-owned DOM anchors, command metadata, and status callbacks into the shell customizer.
- Toolbar preferences are persisted under `localStorage` key `bobercad.ui.workspace.v1` and store command ids, hidden command ids, and the modeling toolbar dock. Project JSON remains untouched.
- Theme and density preferences are now persisted at the workspace preference root under the same `localStorage` key, while toolbar command/dock state stays under `toolbars.modeling`.
- `bobercad/app/ui/design-system/theme-dark.css` adds the first dark professional theme using the same semantic token contract as the light theme.
- `bobercad/app/ui/design-system/tokens.css` now exposes density sizing tokens; `bobercad/app/ui/design-system/components.css` consumes those tokens for toolbar buttons, inputs, disclosures, command palette rows, and workspace customization controls.
- The workspace customizer now includes segmented controls for `Theme` (`Light`, `Dark`, `System`) and `Density` (`Compact`, `Normal`, `Spacious`). Reset returns theme, density, command order, visibility, and toolbar dock to defaults.
- `bobercad/app/ui/design-system/components.css` now includes token-driven styles for customize mode, draggable toolbar buttons, toolbar drag handle, workspace customizer panel, visibility rows, and dock segmented controls.
- `bobercad/app/ui/shell/workspace-shell.css` now supports top, left, right, and bottom toolbar dock placement through `data-toolbar-dock`.
- `bobercad/app/ui/viewer/style.css` no longer owns fixed toolbar placement; the shell owns toolbar layout.
- `bobercad/app/ui/workspaces/default-workspace.json` and `bobercad/app/schemas/ui-workspace.schema.json` define the committed workspace preset contract.
- `bobercad/app/ui/viewer/viewer-runtime.mjs` now loads `default-workspace.json` during viewer boot and passes it into `bobercad/app/ui/shell/workspace-customizer-panel.mjs`; the shell normalizes that preset as the default command order, hidden groups, dock, theme, density, panel layout, and reset target, while `localStorage` remains a user override layered on top of the preset.
- `scripts/check_repo_structure.js` now validates UI workspace JSON, checks default workspace command ids against the command registry, and fails if UI workspace data leaks into project JSON.
- Hidden toolbar commands can now be restored from command search. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` contributes dynamic `workspace.toolbar.show.*` commands for toolbar commands that are hidden in the saved workspace, then clears the command id from `hiddenCommandIds` through the same workspace persistence boundary.
- Optional toolbar commands can now be pinned from command search. Panel and snap-settings commands carry `toolbarPin: true` metadata, the workspace manager keeps default toolbar commands separate from optional pinned commands, and generated pinned buttons use the shared design-system `iconButton` primitive before persisting command ids in the same workspace storage boundary.
- Library and Inspector dock visibility now live in the same workspace persistence boundary. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` owns `panels.library.visible` and `panels.inspector.visible`, applies visibility to dock containers rather than inner panel widgets, and exposes panel rows in the Workspace customizer. `bobercad/app/ui/viewer/viewer-command-adapter.mjs` routes `panel.library.toggle` and `panel.inspector.toggle` through that workspace state.
- Library and Inspector dock widths now live in the same workspace persistence boundary. The shell adds resize handles to left/right dock containers, stores `panels.library.width` and `panels.inspector.width`, applies those widths through `--bc-dock-width`, clamps them to panel-specific min/max values, and reset returns them to the default workspace widths.
- Inspector and editor disclosure state now has a workspace preference boundary. `bobercad/app/ui/shell/workspace-storage.mjs` owns the shared workspace storage key plus `sections` helpers, `bobercad/app/ui/viewer/panels/panel-elements.mjs` persists opted-in disclosure sections by stable `sectionId`, and `bobercad/app/ui/shell/workspace-customizer-panel.mjs` preserves `sections` when toolbar, theme, density, or panel saves rewrite the workspace payload. `bobercad/app/ui/workspaces/default-workspace.json` and `bobercad/app/schemas/ui-workspace.schema.json` now include the committed `sections` contract so collapsed advanced sections remain workspace data, not project JSON.
- Workspace reset now clears disclosure section preferences too. `bobercad/app/ui/shell/workspace-storage.mjs` exposes a reset event/helper for section state, `bobercad/app/ui/shell/workspace-customizer-panel.mjs` writes `sections: {}` when resetting the workspace, and `bobercad/app/ui/viewer/panels/panel-elements.mjs` restores live disclosure sections to their default open/closed state while suppressing reset-triggered persistence.
- Workspace reset is now discoverable from command search as `workspace.reset`. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` contributes it beside `workspace.customize.open`, routes it through the same shell reset path as the customizer button, and keeps it as a stable recent command while transient toolbar pin/show commands remain excluded from recents.
- Modeling toolbar reset is now available without resetting the whole workspace. `workspace-customizer-panel.mjs` contributes `workspace.toolbar.reset` to command search, adds a `Reset toolbar` action to the Workspace customizer, and restores only `toolbars.modeling.commandIds`, `hiddenCommandIds`, `collapsedGroups`, and `dock` from the default workspace while preserving theme, density, panel layout, navigation, strip order, and disclosure-section preferences.
- Theme and density settings are now discoverable from command search. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` contributes stable `workspace.theme.*` and `workspace.density.*` commands, routes them through the same manager paths as the Workspace customizer segmented controls, marks the current theme/density command active, and records those settings commands as stable recents.
- Modeling toolbar dock placement is now discoverable from command search. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` contributes stable `workspace.toolbarDock.*` commands, routes them through the same workspace manager path as the customizer dock segmented controls, marks the current dock command active, and records dock changes as stable recents while saving the dock under `toolbars.modeling`.
- Toolbar command groups now have first-class visibility state. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` exposes a `Command groups` section, persists hidden groups as `toolbars.modeling.collapsedGroups`, hides toolbar commands by group before individual command visibility is applied, and contributes dynamic `workspace.toolbar.showGroup.*` recovery commands to command search. Showing an individual command also reopens its group, so users are not trapped by a broad group hide.
- Top feature-navbar groups are now user-customizable from the same Workspace panel. `workspace-customizer-panel.mjs` exposes `Top navigation` rows backed by `command-group-metadata.mjs`, persists order in `navigation.featureNavbar.groupIds`, persists visibility in `navigation.featureNavbar.hiddenGroupIds`, and notifies the viewer runtime so `feature-navbar.mjs` refreshes from the workspace state immediately.
- Top viewer settings-strip groups are now user-customizable from the same Workspace panel. `settings-strip-metadata.mjs` owns the Display/View group identity, `default-workspace.json` persists `viewerSettingsStrip.groupIds` and `hiddenGroupIds`, `workspace-customizer-panel.mjs` exposes `Top settings strip` rows with SVG icons and move controls, and `viewer-runtime.mjs` refreshes `viewer-settings-strip.mjs` from workspace state without storing UI preferences in project JSON.
- Toolbar add/remove is now available directly inside the Workspace customizer. The `Toolbar commands` section keeps default modeling commands visible/hidden but non-removable, optional pinned commands get a small SVG remove action, and a new `Add commands` section lists toolbar-eligible commands such as Reset View, Fit Selection, Library, Inspector, and Snap Settings. These controls write the same command-id workspace payload used by command search pinning, so add/remove stays outside project JSON.
- Toolbar command reordering is now available directly inside the Workspace customizer. Each toolbar command row has compact SVG move-up and move-down controls backed by the same `toolbars.modeling.commandIds` ordering used by live toolbar drag/reorder, so users can customize the toolbar precisely without relying only on pointer drag mode.
- The live Modeling toolbar now renders workspace-managed command groups instead of flattening all commands into the first toolbar group. `modeling-toolbar.mjs` marks the default Model command group separately from the fixed Snap/Relations group, and `workspace-customizer-panel.mjs` reconciles commands into `.bc-toolbar-group[data-workspace-toolbar-group]` containers ordered by `toolbars.modeling.groupIds`, while toolbar overflow anchors after those managed groups and leaves fixed settings controls alone.
- `bobercad/app/ui/workspaces/default-workspace.json` and `bobercad/app/schemas/ui-workspace.schema.json` now make `collapsedGroups` explicit in the default toolbar preset and validate group ids with the same command-id-friendly naming pattern.
- Current non-browser verification evidence: module syntax checks passed for the shell workspace customizer, viewer runtime, shared panel helpers, generated Properties panel, Inspector panel, Feature Editor panel, Trim Joint panel, and Member Transform panel; `default-workspace.json` validates against `ui-workspace.schema.json`; a direct command-registry assertion validated all seven default toolbar command ids; static assertions confirmed runtime preset loading, preset reset/merge helpers, design-system panel primitive mappings, and generated-object ownership lifecycle actions. `git diff --check` passed for the tracked touched files.
- Latest non-browser verification evidence: syntax checks passed for `ui-elements.mjs`, `viewer-settings-strip.mjs`, `command-registry.mjs`, `viewer-runtime.mjs`, and `check_repo_contracts.js`; static assertions confirmed the shared segmented-control primitive, tokenized segment styles, command metadata-driven settings strip, runtime command-provider/refresh wiring, and full command-catalog icon contract coverage; `git diff --check` passed for the touched UI files; `node .\scripts\check_repo.js` passes. No browser or Playwright visual checks were run.
- Top settings-strip workspace verification evidence: syntax checks passed for `settings-strip-metadata.mjs`, `viewer-settings-strip.mjs`, `workspace-customizer-panel.mjs`, `viewer-runtime.mjs`, and `check_repo_contracts.js`; `default-workspace.json` validates against `ui-workspace.schema.json`; focused repo contracts validate settings-strip metadata, workspace persistence, customizer controls, runtime refresh wiring, and project JSON isolation; `git diff --check` and `node .\scripts\check_repo.js` pass. No browser or Playwright visual checks were run.
- The left dock is now normalized as a Data Dock while preserving the existing `panels.library` workspace key and `panel.library.toggle` command id for compatibility. `bobercad/app/ui/commands/command-registry.mjs` adds command-search entries for the Data, Model, and Components tabs; `bobercad/app/ui/shell/workspace-customizer-panel.mjs` stores tab state as `panels.library.activeTab`; `dock-tabs.mjs` mirrors workspace-backed tab state to the legacy left-dock tab key; and `default-workspace.json` defaults the dock label to `Data` with the Model tab active.
- Verification: module syntax checks pass for `viewer-runtime.mjs`, `command-palette.mjs`, `workspace-customizer-panel.mjs`, and `modeling-toolbar.mjs`; the default workspace validates against `ui-workspace.schema.json`; `node .\scripts\check_repo.js` passes. Browser smoke confirmed the customizer mounts after the viewer toolbar loads, and later system-Chrome Playwright QA captured the customizer panel in `artifacts/ui-qa-professional-shell/workspace-customizer.png`. Theme/density browser smoke confirmed light/compact defaults, dark/spacious persistence after reload, storage at the workspace root rather than under `toolbars.modeling`, and reset back to light/compact with `Workspace reset.` status.
- Panel visibility browser smoke confirmed `panel.library.toggle` hides the left dock and persists `panels.library.visible: false`; refresh keeps the Library dock hidden; the Workspace customizer shows `Toolbar commands` and `Panels` sections with Library/Inspector rows; hiding Inspector through the customizer persists `panels.inspector.visible: false` and hides the right dock; reset restores both docks and both panel rows to visible.
- Dock width browser smoke confirmed default widths of 300px Library and 380px Inspector, two resize handles, drag resizing to 382px and 476px, persisted panel width values in `localStorage`, refresh restoring those widths, Workspace customizer panel descriptions reflecting the current widths, and reset restoring 300px/380px defaults.
- Disclosure persistence browser smoke confirmed a clean first load does not write default disclosure state, closing `inspector.member.center` persists `sections.inspector.member.center.open: false`, refresh restores Center point closed while keeping Constraints closed by default, changing theme to Dark preserves the same section state inside the full workspace payload, and no horizontal body overflow is present. Screenshot captured at `artifacts/ui-qa-professional-shell/disclosure-state-persistence.png`.
- Workspace reset browser smoke confirmed closing `inspector.member.center` persists `sections.inspector.member.center.open: false`; clicking `Reset workspace` immediately restores Center point open and Constraints closed, writes a full default workspace payload with `sections: {}`, and reload keeps those default disclosure states. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-reset-sections.png`.
- Command-palette workspace reset browser smoke confirmed searching `reset workspace` finds `workspace.reset` with a Workspace group label; running it resets dark theme back to light, density back to compact, removes an added `view.reset` toolbar command, restores default panel/toolbar state, clears `sections`, reopens the default Inspector Center point section, reports `Workspace reset.`, and records `workspace.reset` in command recents. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-reset-command.png`.
- Command-palette workspace settings browser smoke confirmed searching `dark theme` finds `workspace.theme.dark`, running it persists `theme: "dark"` and reports `Theme set to dark.`, reopening search shows the command with `Active` / `aria-current`; searching `spacious density` finds `workspace.density.spacious`, running it persists `density: "spacious"` and reports `Density set to spacious.`, reopening search shows the same active state, refresh restores dark/spacious, and recents include both stable settings commands. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-settings-commands.png`.
- Command-palette toolbar dock browser smoke confirmed searching `dock toolbar left` finds `workspace.toolbarDock.left`, running it moves the toolbar to the left dock, persists `toolbars.modeling.dock: "left"`, reports `Toolbar docked left.`, and reopening search shows `Active` / `aria-current`; searching `dock toolbar bottom` moves the toolbar to the bottom dock, persists through reload, and command recents include both stable dock commands. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-dock-commands.png`.
- Command-group visibility browser smoke confirmed a clean system-Chrome session starts with the Model group on and `collapsedGroups: []`; hiding the Model group sets all seven model toolbar commands to hidden and persists `collapsedGroups: ["model"]`; refresh restores the group hidden; command search finds `workspace.toolbar.showGroup.model`; running it clears `collapsedGroups` and restores all seven model commands. Screenshot captured at `artifacts/ui-qa-professional-shell/toolbar-group-visibility-hidden.png`.
- Toolbar add/remove browser smoke confirmed a clean customizer shows Reset View, Fit Selection, Library, Inspector, and Snap Settings under `Add commands`; adding Reset View creates a generated toolbar button, persists `view.reset` in `toolbars.modeling.commandIds`, and shows a removable command row; reload preserves the added button; removing Reset View deletes the generated toolbar button, removes the id from workspace storage, returns it to `Add commands`, and reload keeps it removed. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-customizer-add-remove.png`.
- Toolbar reorder-controls browser smoke confirmed the customizer renders two SVG move controls per toolbar command row, disables move-up on the first row and move-down on the last row, moves Beam below Column through the customizer, updates the live toolbar order and stored `toolbars.modeling.commandIds`, restores that order after reload, and moves Beam back above Column. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-customizer-reorder-controls.png`.
- Workspace import/export now has a versioned storage boundary. `workspace-storage.mjs` exports schema/version constants, adds `$schema` to workspace envelopes, migrates legacy flat and nested `modeling` toolbar preferences into `toolbars.modeling`, rejects wrong-schema or future-version import files, and keeps user workspace state in `localStorage` rather than project JSON. `workspace-customizer-panel.mjs` adds `workspace.import` / `workspace.export` command-search entries, Import/Export buttons in the customizer, JSON download/upload helpers, and transactional import so invalid files do not clear section state or mutate the current workspace. `icon-registry.mjs` adds shared SVG `upload` and `download` icons for those controls.
- Workspace import/export non-visual verification evidence: syntax checks passed for `workspace-storage.mjs`, `workspace-customizer-panel.mjs`, `icon-registry.mjs`, and `check_repo_contracts.js`; `default-workspace.json` validates against `ui-workspace.schema.json`; focused repository contracts validate schema constants, export schema validation, legacy migration, invalid import rejection, command metadata completeness, workspace customizer import/export wiring, schema/runtime dock alignment, and project JSON isolation; `git diff --check` and `node .\scripts\check_repo.js` pass. No browser or Playwright visual checks were run for this slice; visual inspection remains reserved for user review.

Acceptance:

- User can reorder toolbar commands.
- User can hide/show command groups.
- User can move toolbars between supported docks.
- User can import/export workspace presets as versioned JSON.
- Refreshing the browser restores the customized layout.
- Reset returns to default.

### Phase 6: Command Palette And Discovery

- Add command palette search.
- Include commands, settings, panels, and recently used actions.
- Show shortcut hints.
- Allow pinning command results to a toolbar.

Implementation note:

- Initial command palette added with `bobercad/app/ui/shell/command-palette.mjs`.
- `bobercad/app/ui/commands/command-registry.mjs` now carries labels, descriptions, groups, stable ids, and shortcut metadata for current modeling commands.
- The viewer top bar exposes command search through `Ctrl+K` and a searchable SVG-icon trigger.
- Palette commands are bound by `bobercad/app/ui/viewer/viewer-command-adapter.mjs` through stable command ids registered on `bobercad/app/ui/viewer/viewer-app-controller.mjs`, reducing direct command wiring in `viewer-runtime.mjs`.
- Workspace customization is now discoverable through the command palette via the shell customizer command.
- Panel and settings entry points are now first-class command metadata: `panel.library.toggle`, `panel.inspector.toggle`, and `settings.snap.toggle`.
- `bobercad/app/ui/icons/icon-registry.mjs` now includes shell/discovery icons for library, inspector, and settings.
- Legacy fixed-position panel CSS in `bobercad/app/ui/viewer/style.css` was reduced so `bobercad/app/ui/shell/workspace-shell.css` owns Library, Inspector, Feature, Trim, and Smart Component dock placement.
- `scripts/check_repo_structure.js` now validates command icons against the registered SVG icon names.
- `bobercad/app/ui/shell/command-palette.mjs` now accepts dynamic command providers, so shell modules can add contextual discovery commands without coupling the palette to workspace storage details.
- `bobercad/app/ui/shell/command-palette.mjs` now persists recently used stable command ids under `localStorage` key `bobercad.ui.command-palette.recents.v1`, shows recent actions first with a `Recent` group label when the palette opens with an empty query, and skips transient `workspace.toolbar.*` commands so recents do not point at disappearing pin/show actions.
- Reset View is now discoverable as `view.reset` in the command palette under the `View` group, records as a recent stable command, and can be pinned to the modeling toolbar as an optional generated SVG icon button.
- Fit Selection is now discoverable as `view.fitSelection` in the command palette under the `View` group, routes through the existing `viewerApp.focusSelection()` facade path used by Inspector quick actions, records as a recent stable command, and can be pinned to the modeling toolbar as an optional generated SVG icon button.
- Browser smoke evidence: command palette contains modeling, panel, settings, core, and workspace commands; Library and Inspector panels compute as `position: static` inside shell docks; invoking `panel.library.toggle` from the palette hides the library dock, closes the palette, and updates status to `Library hidden.`.
- Controller-bound browser smoke evidence: with `index.html` loading `viewer-runtime.mjs?v=viewer-app-controller-1`, command palette results included modeling, panel, settings, core, and workspace commands; invoking `panel.library.toggle` ran through the facade and toggled the Library dock/status; invoking `model.beam.create` from the toolbar ran through the same command id boundary and `command.cancel` cleared the modeling status.
- Toolbar recovery browser smoke evidence: with `model.beam.create` hidden in `localStorage`, command search included `workspace.toolbar.show.model.beam.create` labeled `Show Beam in toolbar`; invoking it restored Beam to the modeling toolbar, cleared the saved hidden command list, closed the palette, reported `Beam shown in toolbar.`, and removed the recovery command from subsequent palette results.
- Toolbar pin browser smoke evidence: with a clean workspace, command search for `pin library` included `workspace.toolbar.pin.panel.library.toggle`; invoking it added a generated Library icon button to the modeling toolbar, persisted `panel.library.toggle` in `toolbars.modeling.commandIds`, closed the palette, reported `Library pinned to toolbar.`, and removed the pin command from later `pin library` results. Clicking the generated toolbar button toggled the Library dock and reported `Library hidden.`.
- Optional pinned-command recovery smoke evidence: after pinning Library, the workspace customizer listed the Library row; hiding it set the generated toolbar button hidden and persisted `panel.library.toggle` in `hiddenCommandIds`; command search for `show library` included `workspace.toolbar.show.panel.library.toggle`, and invoking it cleared `hiddenCommandIds` and restored the toolbar button.
- Recent-command browser smoke evidence: with clean palette storage, running `model.beam.create` and `panel.library.toggle` from command search persisted `["panel.library.toggle", "model.beam.create"]`; reopening the palette with an empty query showed Library and Beam first with `Recent` group labels, followed by normal Model commands. Running `workspace.toolbar.pin.panel.library.toggle` did not add the transient pin command to recents.
- Reset View browser smoke evidence: with a clean workspace, command search for `reset view` showed `view.reset` with `View` group label and one SVG icon; running it closed the palette, set status to `View reset.`, and stored `view.reset` in command recents. Searching `pin reset` showed `workspace.toolbar.pin.view.reset`; invoking it added one generated toolbar button with the reset-view icon, persisted `view.reset` in `toolbars.modeling.commandIds`, and the generated toolbar button ran the same `View reset.` command.
- Command palette rows now support disabled command state through the shared shell/design-system path. Disabled commands remain discoverable, expose `aria-disabled="true"`, show the unavailable reason in the description/title, and do not close or run when submitted from the keyboard.
- Fit Selection browser smoke evidence: with no selection, command search for `fit selection` showed `view.fitSelection` disabled with the reason `Select an object to frame it.`, and pressing Enter kept the palette open while reporting the same status. With `demo_boolean_beam` selected through the viewer QA/inspector path, the same command was enabled with `aria-disabled="false"`, pressing Enter closed the palette, and status updated to `Selection framed.`. Earlier pinning smoke confirmed searching `pin fit` shows `workspace.toolbar.pin.view.fitSelection`; invoking it adds one generated toolbar button with the zoom-fit icon, persists `view.fitSelection` in `toolbars.modeling.commandIds`, and the generated toolbar button runs the same selection framing command.
- Generated/pinned toolbar buttons now refresh from the same command-state provider as the command palette. Browser smoke with `view.fitSelection` pre-pinned in workspace storage confirmed the generated toolbar button renders `aria-disabled="true"`, `data-command-enabled="false"`, and the same disabled reason when there is no selection; with `demo_boolean_beam` selected, the same button refreshes to `aria-disabled="false"`, normal click runs the command, and status updates to `Selection framed.`.
- Clear Selection is now discoverable as `selection.clear` in the command palette under the new `Select` group, uses the shared `selection-clear` SVG icon, routes through `viewerApp.clearSelection()`, and can be pinned as an optional generated toolbar command.
- Clear Selection browser smoke evidence: with no selection, command search for `clear selection` showed `selection.clear` disabled with the reason `Select something to clear.`, pressing Enter kept the palette open and reported that reason, and the row exposed one SVG icon plus `aria-disabled="true"`. With `demo_boolean_beam` selected through the viewer QA path, the same command was enabled, pressing Enter closed the palette, set status to `Selection cleared.`, removed selection quick actions, and returned the status bar selection segment to `0 selected`. Searching `pin clear` showed `workspace.toolbar.pin.selection.clear`; invoking it persisted `selection.clear` in `toolbars.modeling.commandIds`, and the generated toolbar command refreshed between disabled and enabled states with the same command-state provider. Screenshots captured at `artifacts/ui-qa-professional-shell/selection-clear-command-disabled-toolbar.png` and `artifacts/ui-qa-professional-shell/selection-clear-command-enabled-toolbar.png`.
- Axis Relations is now discoverable as `settings.relations.toggle` in the command palette under `Settings`, uses the shared relation SVG icon, routes the static toolbar button through the viewer app command facade, and can be pinned as an optional generated toolbar command. Its command state reports active when automatic axis relations are enabled, or when the selected plate sketch relation overlay is visible.
- Axis Relations browser smoke evidence: command search for `relations` showed `settings.relations.toggle` enabled, grouped under `Settings`, and active with the description `Automatic axis relations are on.`. Pressing Enter toggled automatic relations off, closed the palette, updated the toolbar pressed state, and changed status to `Automatic axis relations off.`. Searching `pin relations` showed `workspace.toolbar.pin.settings.relations.toggle`; invoking it persisted `settings.relations.toggle` in `toolbars.modeling.commandIds`. With the pinned command overflowed into the `More` menu, the overflow row stayed enabled, showed `Axis Relations`, ran the same command path, updated status to `Automatic axis relations on.`, and refreshed the hidden source button and static toolbar button back to active. Screenshot captured at `artifacts/ui-qa-professional-shell/relations-toggle-command.png`.
- Snap strength presets are now discoverable as `settings.snapStrength.off`, `settings.snapStrength.light`, `settings.snapStrength.normal`, `settings.snapStrength.strong`, and `settings.snapStrength.training` under `Settings`. They share the snap SVG icon, route through the viewer app command facade, update the existing Snap popover select, status bar, and command state, and can be pinned as optional generated toolbar commands.
- Snap strength browser smoke evidence: command search for `snap strong` showed `settings.snapStrength.strong` enabled, grouped under `Settings`, and inactive with its preset description. Pressing Enter changed the Snap select and status to `strong`; reopening search showed `Snap Strong is active.` with the active badge and `aria-current="true"`. Searching `pin snap strong` showed `workspace.toolbar.pin.settings.snapStrength.strong`; invoking it persisted `settings.snapStrength.strong` in `toolbars.modeling.commandIds`. After switching to `Snap Off`, the pinned Snap Strong command refreshed inactive and then ran successfully from the generated toolbar overflow path, returning status and the Snap select to `strong`. Screenshot captured at `artifacts/ui-qa-professional-shell/snap-strength-command.png`.
- Panel toggle commands now expose live state. `panel.library.toggle` and `panel.inspector.toggle` report active while their docks are visible, switch their command titles between `Hide ...` and `Show ...`, and refresh pinned/generated toolbar state after a panel is toggled through command search or an overflowed toolbar command.
- Panel command browser smoke evidence: command search for `library` showed `panel.library.toggle` active under `Panels` with title `Hide Library`, description `Library dock is visible.`, and a `Pin Library to toolbar` command beside it. Command search for `inspector` showed the same active-state behavior for `panel.inspector.toggle`. Running `panel.library.toggle` hid the left dock and changed the next command result to `Show Library`; pinning persisted `panel.library.toggle` in `toolbars.modeling.commandIds`; the generated toolbar command started inactive while hidden, then ran from the overflow path, restored the dock, and refreshed to active. Screenshot captured at `artifacts/ui-qa-professional-shell/panel-command-state.png`.
- The shell now has a dedicated viewer-settings strip under the top navigation and above the modeling toolbar. `bobercad/app/ui/viewer/viewer-settings-strip.mjs` renders command metadata marked for the strip through the shared `segmentedControl()` primitive, and `bobercad/app/ui/viewer/viewer-settings-strip.css` now owns layout only while the segment/button recipe lives in the design system. The current strip is populated by `view.displayMode.shaded`, `view.displayMode.wireframe`, and `view.displayMode.xray`, each using registered SVG icons and live active state from the viewer command provider. `bobercad/app/rendering/webgl/webgl-viewer-runtime.mjs` exposes `setDisplayMode()` / `renderMode()` so wireframe mode can suppress face drawing and snap logic can read the active render mode.
- Viewer-settings non-visual smoke evidence: a headless DOM check confirmed the strip renders three modes in order (`shaded`, `wireframe`, `xray`), Shaded starts active, searching `display wireframe` shows `view.displayMode.wireframe` enabled under `View`, running it updates status to `Display mode: wireframe` and flips the strip active state, clicking the X-Ray strip button routes through the command facade, and reopening command search shows `view.displayMode.xray` active with `aria-current="true"`. No screenshot was captured for this slice because visual inspection is reserved for user review.
- The shell now has a bottom-right nav-cube surface and bottom-strip Snap control entry point. `bobercad/app/ui/viewer/nav-cube.mjs` renders seven orientation controls (`iso`, `top`, `front`, `right`, `left`, `back`, `bottom`) with tokenized styling in `nav-cube.css`; the controls route through new command ids `view.orientation.*`, share the registered `view-orientation` SVG icon, and keep command palette/generated toolbar active state in sync. The WebGL viewer exposes `setViewOrientation()` / `viewOrientation()`, backed by `camera.setViewAngles()`, so orientation changes are renderer operations rather than UI-side camera math. The status bar Snap segment is now an SVG-backed button that opens the existing detailed Snap settings command path.
- The bottom interaction strip now has the same workspace boundary as the rest of the professional shell. `bobercad/app/ui/commands/bottom-strip-metadata.mjs` defines the Selection, Scope, Snap, and Units items; `status-bar.mjs` renders the strip from workspace `bottomStrip.itemIds` / `hiddenItemIds`; `workspace-customizer-panel.mjs` persists order and visibility under `bobercad.ui.workspace.v1`; and `default-workspace.json` plus `ui-workspace.schema.json` make the committed bottom-strip preset explicit without storing UI state in project JSON.
- Bottom strip and top settings-strip customization are now discoverable from command search instead of only the Workspace panel. `withWorkspaceCommand()` contributes context-aware `workspace.bottomStrip.show/hide.*` and `workspace.settingsStrip.show/hide.*` commands from the current workspace state, and `mountToolbarWorkspaceCustomization()` exposes the same bottom/settings strip visibility operations through the workspace facade. This lets users search for workflows such as hiding Units from the bottom strip or restoring Display controls to the top strip while still persisting only workspace item/group ids outside project JSON.
- Bottom strip ordering now has direct drag customization in the Workspace panel. Each bottom-strip row gets a tokenized drag handle when customize mode is enabled, pointer drop targets update `bottomStrip.itemIds` through the same workspace preference path as the existing up/down controls, and command-search visibility controls remain backed by `bottom-strip-metadata.mjs` ids rather than DOM layout state.
- Top settings-strip ordering now uses the same drag customization model. The Workspace panel exposes drag handles for metadata-defined settings groups, persists reordered `viewerSettingsStrip.groupIds` through the versioned workspace envelope, and keeps visibility commands/search tied to `settings-strip-metadata.mjs` instead of hardcoded DOM controls.
- The top viewer settings strip now includes a compact `Visibility` group for clickable `Cuts` and `Planes` controls. `command-registry.mjs` owns the SVG-icon command metadata, `viewer-runtime.mjs` maps the buttons to `settings.render.visibility`, and `scene-geometry-builder.mjs` uses those runtime-only settings to hide cutting-object visuals, trim callouts/handles, or reference-plane markers without writing UI state into project JSON.
- Top navigation groups and toolbar command rows now use direct drag customization in the Workspace panel. The same customize-mode drag handle pattern updates `navigation.featureNavbar.groupIds` and modeling `commandIds`, preserving hidden ids and keeping row-level customization aligned with the actual draggable toolbar surface. `withWorkspaceCommand()` also contributes searchable `workspace.featureNavbar.show/hide.*` commands so users can restore or hide top-level nav groups without hunting through the panel.
- Modeling toolbar groups are now first-class workspace layout state. `ui-workspace.schema.json` requires `toolbars.modeling.groupIds`, `default-workspace.json` seeds the Modeling group order, `workspace-storage.mjs` migrates/imports/exports group order with legacy toolbar preferences, and `workspace-customizer-panel.mjs` exposes drag/move controls for toolbar groups that persist through `groupIds` while preserving `collapsedGroups` visibility.
- Live toolbar group rendering now follows that same workspace boundary. Group order comes from `toolbars.modeling.groupIds`, command order within each group comes from `toolbars.modeling.commandIds`, generated buttons are stamped with command-group metadata, and overflow scans only workspace-managed command groups so the fixed Snap/Relations controls cannot be accidentally absorbed by toolbar customization.
- The topbar Settings trigger now follows the same SVG-backed menu-button recipe as File: `workspace-customizer-panel.mjs` renders the registered `settings` icon plus `bc-topbar-menu-label`, keeping topbar actions consistent with the icon registry and shell CSS.
- The top feature navbar is now an explicit curated command surface instead of an include-everything ribbon. Command metadata must opt in with `navSurface: "feature-navbar"` and a `ribbonSection`, while advanced utilities such as snap target filters, workspace import/export, theme/density, dock placement, and strip customization remain available through command search and the Workspace panel. The generated Workspace command contributes only `workspace.customize.open` to the top navbar, preserving the Figma-like split between common tools and deeper configuration.
- Feature-navbar rendering now skips configured groups that have no visible commands, preventing blank top tabs as the curated command surface evolves. The top viewer settings strip also resolves Display/View group SVG icons from `settings-strip-metadata.mjs`, so strip groups inherit the same metadata-driven icon convention as the navbar, command palette, and workspace customizer.
- The top feature navbar now exposes a curated `Tools` ribbon alongside `Model`. View reset/fit, display modes, view orientations, Clear Selection, dock toggles, Axis Relations, and Snap Settings opt into `navSurface: "feature-navbar"` through command metadata, while detailed snap target/strength commands stay deeper in settings and command search to avoid overwhelming the ribbon.
- Dock panel pinning is now reachable from the same professional workspace customization path as visibility. The Workspace panel renders Data/Inspector rows as a visibility toggle plus an SVG pin action, `withWorkspaceCommand()` contributes context-aware `workspace.panel.pin.*` / `workspace.panel.unpin.*` commands, and the controls reuse the existing persisted `panels.*.pinned` state so dock behavior remains user preference data outside project JSON.
- Dock panel placement is now workspace-owned instead of metadata-only. `workspace-customizer-panel.mjs` preserves/imports `panels.*.dock`, exposes compact L/R/T/B/F dock controls in the Workspace panel, swaps occupied side docks for the current two-panel shell, and reflects the normalized value onto `data-workspace-panel-dock` / `data-workspace-panel-side-dock` so `workspace-shell.css` can place Library and Inspector without coupling placement to engine/viewer logic.
- NavCube overlay visibility and placement are now workspace-owned too. `ui-workspace.schema.json` and `default-workspace.json` persist `viewerOverlays.navCube.visible` plus a corner enum, `workspace-customizer-panel.mjs` exposes a Viewer overlays row and searchable show/hide/corner commands, and `viewer-runtime.mjs` only reflects the normalized state onto NavCube data attributes while `nav-cube.css` handles tokenized corner placement.
- The left Data tab now has the same search affordance as Model and Components. `project-data-panel.mjs` renders a tokenized `bc-data-search` control, preserves keyboard focus while filtering, and filters Libraries, Model Contents, and Project Settings rows from the same row intents used for dock navigation, so growing project/library metadata remains findable without adding visual clutter.
- Project/source files now have their own left-dock Files tab instead of crowding the Data tab. `project-files-panel.mjs` reuses the shared data-panel header/search/section/link-row helpers, lists app-owned project/viewer/workspace sources plus declared library config files, and exposes `showRow()` for command search. `left-dock-result-metadata.mjs` now emits `source-file` results in the `Files` group with `showFileRow` actions targeting the `files` tab, while Project Data keeps semantic Libraries, Model Contents, and Project Settings rows.
- Data Dock tabs are now workspace-customizable panel state. `panels.library.tabIds` / `hiddenTabIds` persist ordered visible tab layout through the same versioned workspace envelope as panel visibility, the Workspace panel exposes show/hide, up/down, and drag handles for tab rows, and `dock-tabs.mjs` renders workspace-provided active-tab state without owning separate localStorage. Command search contributes context-aware `workspace.panelTab.show/hide.*` entries, activating a hidden Data Dock tab restores that tab before selecting it, and the legacy Data Dock active-tab key is read only through workspace migration.
- Inspector Dock context tabs now use the same workspace-owned panel tab state as Data Dock. `panels.inspector.tabIds`, `hiddenTabIds`, and `activeTab` seed the Properties / Feature / Trim / Component order, the legacy inspector active-context localStorage key is read only through workspace migration, and `inspector-dock.mjs` now renders `setPanels()` input from runtime instead of owning separate active-tab storage.
- Inspector Dock now uses the same vertical `bc-dock-tabs` rail language as the Data Dock while preserving contextual availability. `hidden` remains the availability signal for advanced Properties contexts, inactive panels are hidden through `data-inspector-active`, and the right dock keeps mirrored rail/content placement for side docking.
- The Data tab now loads declared frame library coverage instead of merely listing the Frames row from project JSON. `viewer-runtime.mjs` follows `project.libraries.frames.path` through the frame register to the selected frame-library `config.json` and passes the loaded `frames` library into `mountProjectDataPanel()`, letting the existing left-dock library rows report real frame-template counts alongside profiles, materials, fasteners, and Smart Components.
- View orientation state now has one shared free-state contract for navcube, settings strip, command search, and the feature navbar. `view-metadata.mjs` owns `VIEW_ORIENTATION_FREE_ID`, `normalizeViewOrientationState()`, and `activeViewOrientation()` so renderer-reported `custom` camera states clear active orientation commands consistently, while command inputs still normalize unknown orientation requests back to `iso`. `viewer-runtime.mjs` now resynchronizes surfaces from `viewer.viewCamera()` after orientation commands and refreshes command surfaces only when the active orientation token changes.
- Navcube placement now matches the planned shell map. `nav-cube.css` anchors the orientation control in the bottom-right using tokenized right and statusbar-aware bottom offsets, while preserving the right-docked toolbar horizontal offset and mobile reduction.
- Nav-cube and bottom-strip non-visual smoke evidence: the in-app browser DOM check confirmed seven nav-cube buttons, initial `iso` active state, clicking `Top` updates status to `View: top`, command search for `front view` runs `view.orientation.front` and updates the nav-cube/status to `View: front`, the bottom Snap entry point exposes the current `normal` strength and is now owned by the bottom interaction strip, and there were zero browser console errors. No screenshot was captured for this slice because visual inspection is reserved for user review.
- Snap settings now use progressive disclosure through the shared `bobercad/app/ui/controls/snap-settings-control.mjs` builder: snap strength stays visible as the quick control, while detailed snap target controls live in a collapsed `Targets` section with an enabled-count badge. The toolbar popover and bottom status strip keep their own host styling, but both render strength and target toggles from `SNAP_STRENGTH_SPECS` / `SNAP_TARGET_SPECS`, leaving Selected/Component scope constraints in the separate scope segmented control instead of duplicating them as target checkboxes.
- Toolbar overflow is now part of the shared shell/design-system path. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` mirrors overflowed toolbar command buttons into a token-styled `More` menu that keeps command ids, SVG icons, disabled reasons, and generated command state in sync with the original buttons. `bobercad/app/ui/design-system/components.css` owns the overflow menu/button styling, `bobercad/app/ui/icons/icon-registry.mjs` adds the shared `more` SVG icon, and `bobercad/app/ui/shell/workspace-shell.css` flips the overflow menu upward when the toolbar is bottom-docked.
- Toolbar overflow browser smoke evidence: with a 390px viewport and optional commands pinned, the toolbar kept Beam, Column, and Plate visible, moved nine commands into the `More` menu, rendered a registered SVG More icon, fit within its 338px toolbar width with no horizontal body overflow, showed `view.fitSelection` as `aria-disabled="true"` with `Select an object to frame it.`, kept the menu open when that disabled row was clicked, then enabled and ran the same overflow row with `demo_boolean_beam` selected and reported `Selection framed.`. Screenshot captured at `artifacts/ui-qa-professional-shell/toolbar-overflow-narrow.png`.
- Active command state now flows through the same command metadata path as disabled state. `bobercad/app/ui/viewer/viewer-app-controller.mjs` exposes stable `activeCommandId`, `bobercad/app/ui/viewer/viewer-command-adapter.mjs` marks matching command items as active, `bobercad/app/ui/shell/command-palette.mjs` shows an `Active` badge with `aria-current`, and `bobercad/app/ui/shell/workspace-customizer-panel.mjs` syncs `data-command-active` / `aria-pressed` onto generated, pinned, and overflowed toolbar commands. `bobercad/app/ui/viewer/viewer-runtime.mjs` maps active tool types to stable command ids so toolbar, overflow, and palette state agree.
- Active command browser smoke evidence: with a 390px viewport and optional commands pinned, pressing `S` started `model.sketch.create`; the overflowed Sketch toolbar button had `data-command-active="true"` and `aria-pressed="true"`, the `More` menu row for Sketch had `data-command-active="true"` and `aria-current="true"`, command search for `sketch` showed the same row with an `Active` badge and `aria-current="true"`, pressing Escape twice cleared all toolbar active command ids, and no horizontal body overflow was present. Screenshot captured at `artifacts/ui-qa-professional-shell/command-active-palette.png`.
- Command palette active-result state now follows a combobox/listbox contract. `bobercad/app/ui/shell/command-palette.mjs` gives the search input `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, and `aria-activedescendant`; result rows receive stable option ids, `role="option"`, and `aria-selected`; the active result scrolls into view without moving focus out of the input.
- Command palette keyboard and hover movement now updates only the affected active rows and `aria-activedescendant` instead of recomputing the full command provider. Query changes, command refreshes, open/close, and disabled-state runs still rebuild results, but ArrowUp/ArrowDown and hover stay cheap even when runtime Data Dock objects and Smart Component presets are included.
- Command palette ARIA browser smoke evidence: in the in-app browser, `Ctrl+K` from the shell opened the palette and focused the combobox. Searching `model` set `aria-activedescendant` to `command-palette-option-model-beam-create`; ArrowDown changed it to `command-palette-option-model-column-create` while focus stayed in the input; Escape closed the palette, cleared `aria-activedescendant`, set `aria-expanded="false"`, and returned focus to the search trigger. System-Chrome Playwright repeated the active-descendant assertions with clean local storage. Screenshots captured at `artifacts/ui-qa-professional-shell/command-palette-aria.png` and `artifacts/ui-qa-professional-shell/command-palette-aria-system.png`.
- `scripts/check_repo_contracts.js` now validates the full command palette catalog through `commandPaletteSpecs()`, including View and Select commands, so strip/navbar/palette command icons are covered by the same registry check.
- Future work remains: include more panel/settings commands beyond the initial settings toggles and snap presets, plus richer target toolbar/group choices when the UI grows beyond the single modeling toolbar.

Acceptance:

- A command can be found without knowing its toolbar location.
- Hidden commands remain discoverable.
- Customization can add discovered commands to a toolbar.

### Phase 7: Visual QA, Accessibility, And Cleanup

- Use Browser/Playwright screenshots for desktop and narrow viewports after frontend changes.
- Check that text does not overflow buttons, tabs, panels, or status areas.
- Check focus order and keyboard access.
- Check tooltip and aria labels for icon-only buttons.
- Scan CSS for raw colors outside token/theme files.
- Remove old direct-style helpers and obsolete panel CSS.

Implementation note:

- Playwright visual QA screenshots were captured with system Chrome into ignored artifacts under `artifacts/ui-qa-professional-shell`: `desktop-default.png`, `narrow-default.png`, `smart-component-panel.png`, `command-palette.png`, and `workspace-customizer.png`.
- Theme/density visual QA captured `artifacts/ui-qa-professional-shell/dark-spacious-customizer.png`, showing the dark/spacious customizer controls, selected segmented states, and reset action.
- Inspector quick-action visual QA captured `artifacts/ui-qa-professional-shell/inspector-quick-actions.png`, showing the selected feature quick-action strip inside the right Inspector.
- Automated DOM box checks for those states found no shell-region overlaps and no text overflow in buttons, command palette labels, customizer labels, connection titles, brand/project summary, or property tabs.
- A narrow dark/spacious DOM overflow check found no visible text overflow after allowing workspace customizer command descriptions to wrap inside their rows.
- `bobercad/app/ui/design-system/components.css` and `bobercad/app/ui/shell/workspace-shell.css` now avoid raw component/shell colors outside the theme file by using design tokens and `color-mix()` token expressions. `bobercad/app/ui/viewer/style.css` imports shared token/theme/component/shell CSS with cache keys for this cleanup slice.
- A follow-up browser smoke against the cleaned CSS imports found no desktop or narrow shell overlaps and no text overflow in the checked UI text targets.
- `bobercad/app/ui/viewer/viewer-snap-controls.css` now avoids direct raw color values; the open Snap manager border derives from `--bc-color-accent` through `color-mix()` so theme changes flow through the design-system token contract.
- Snap-control browser smoke confirmed the Snap popover still opens, the open border computes from the tokenized accent mix, the filter count remains visible as `9/11`, and the detailed filter grid remains collapsed by default. Screenshot captured at `artifacts/ui-qa-professional-shell/snap-token-cleanup.png`.
- A focused raw-color scan now finds no direct hex/RGBA/HSL colors in `bobercad/app/ui/viewer/viewer-editor-panels.css`; remaining color cleanup is concentrated in viewer authoring overlays and any renderer-specific surfaces that still intentionally sit outside the shell component system.
- `bobercad/app/ui/viewer/viewer-authoring-overlays.css` now tokenizes the first floating authoring overlay set: scene callouts, trim callout hover/focus, base authoring labels, snap/work-plane labels, plate relation action/delete labels, and the contextual authoring quick list. Those controls now use `--bc-color-*` tokens, `color-mix()`, and the shared UI font instead of fixed light-theme colors.
- Authoring-overlay browser smoke confirmed the sample app loads `viewer-authoring-overlays.css?v=authoring-overlay-token-1` and renders two live `scene-callout trim-callout` nodes at 42x30 with token-derived border/background/shadow. A system-Chrome fixture confirmed base labels, snap labels, conflicted/delete labels, quick-list rows, danger/disabled items, and quick-list badges inherit light and dark theme tokens, with computed colors changing after `data-bc-theme="dark"`. Screenshots captured at `artifacts/ui-qa-professional-shell/authoring-overlay-token-callouts.png` and `artifacts/ui-qa-professional-shell/authoring-overlay-token-fixture.png`.
- The second authoring-overlay cleanup slice tokenizes plate sketch/creation labels, plate dimension and relation states, sketch status labels, global axis labels, coordinate-space toggles, manipulator hover labels, and reference-plane labels. The first 430 lines of `bobercad/app/ui/viewer/viewer-authoring-overlays.css` now have no direct hex/RGBA/HSL color values; remaining color cleanup starts in the orbit cursor and dimension editor sections.
- Authoring-overlay plate/axis browser smoke confirmed the live viewer loads `viewer-authoring-overlays.css?v=authoring-overlay-token-2` while preserving the two 42x30 trim callouts. A system-Chrome fixture confirmed point-set, cursor, guide, driven/clean dimensions, dimension mode, associated/selected/conflicted relations, sketch status, global axis, local/global space toggles, manipulator hover, and reference-plane labels inherit light and dark theme tokens, with computed styles changing after `data-bc-theme="dark"`. Screenshot captured at `artifacts/ui-qa-professional-shell/authoring-overlay-token-plate-axis-fixture.png`.
- The final authoring-overlay cleanup slice tokenizes the orbit cursor, dimension labels, active/selection states, dimension edit actions, pair editor, dimension mode menu, and dimension tooltip. A focused scan now finds no direct hex/RGBA/HSL color values in `bobercad/app/ui/viewer/viewer-authoring-overlays.css`; the viewer stylesheet cache key is `authoring-overlay-token-3`.
- Authoring-overlay dimension/orbit browser smoke confirmed the live viewer loads `style.css?v=authoring-overlay-token-3` while preserving the two live `scene-callout trim-callout` nodes. A system-Chrome fixture confirmed orbit cursor strokes/fills, dimension labels, warning/error/active states, edit action buttons, pair editor inputs, selected mode options, and the tooltip inherit light and dark theme tokens, with computed styles changing after `data-bc-theme="dark"`. Screenshots captured at `artifacts/ui-qa-professional-shell/authoring-overlay-token-dimensions-fixture-light.png` and `artifacts/ui-qa-professional-shell/authoring-overlay-token-dimensions-fixture-dark.png`.
- A broad UI CSS raw-color scan now reports direct hex/RGBA/HSL colors only in `bobercad/app/ui/design-system/theme-light.css` and `bobercad/app/ui/design-system/theme-dark.css`; component, shell, viewer panel, snap, command-palette, customizer, and authoring-overlay styles now inherit color through the design-system token layer.
- Shell shadow details now inherit from the theme layer too. `theme-light.css` and `theme-dark.css` define `--bc-shadow-toolbar-compact` and `--bc-shadow-dock-reveal`, while the viewer settings strip and workspace dock reveal CSS consume those tokens instead of embedding raw `rgb(...)` shadow values in component styles.
- Icon-only tooltip behavior now has a shared design-system contract. `bobercad/app/ui/design-system/ui-elements.mjs` exposes `applyTooltip()` and `iconButton()` attaches `data-bc-tooltip` alongside native `title`; `bobercad/app/ui/design-system/toolbar.css` renders token-styled hover/focus tooltips; shell-built icon controls for reset, toolbar overflow, toolbar drag, panel resize, customizer close/remove, and customizer move controls use the same helper.
- Tooltip browser smoke confirmed 29 shell tooltip anchors, toolbar command metadata such as Beam `Create beam (B)`, reset tooltip pseudo-content hidden before hover and visible on hover, and matching tooltip/aria labels for Workspace customizer close and move controls. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-tooltips.png`.
- Tooltip placement now handles top-edge controls: topbar and top-docked toolbar tooltip anchors open downward, and tooltip labels use `max-content`/`nowrap` sizing so short command labels do not collapse into vertical strips. A focused CSS fixture confirmed `Reset view` and `Clear selection - Select something to clear.` tooltips render below their controls with normal horizontal text. Screenshot captured at `artifacts/ui-qa-professional-shell/selection-clear-tooltip-fixture.png`.
- Workspace customizer keyboard access now follows the shell dialog contract. `bobercad/app/ui/shell/workspace-customizer-panel.mjs` labels the panel from its `Workspace` title, exposes `aria-modal="false"`, focuses the close control on open, closes on Escape, closes on outside pointerdown, keeps `aria-expanded` in sync, and returns focus to the Customize trigger after keyboard dismissal.
- Workspace customizer focus browser smoke confirmed Enter opens the customizer from the trigger, focus lands on `Close customize panel`, Escape hides the panel and returns focus to `#workspace-customize-open`, outside click hides the panel without forcing focus, and the dialog exposes `role="dialog"` / `aria-labelledby="workspace-customizer-title"`. Screenshot captured at `artifacts/ui-qa-professional-shell/workspace-customizer-focus.png`.
- Command palette keyboard accessibility now exposes the focused result through `aria-activedescendant` instead of relying only on visual `active` classes, keeping assistive-technology state aligned with keyboard navigation.

Acceptance:

- `node .\scripts\check_repo.js` passes.
- Viewer runs locally.
- No project JSON contains UI workspace state.
- No generated geometry or scene data is added to JSON.
- UI controls are keyboard reachable.
- Icon-only buttons have accessible labels.

## Acceptance Checks

### UX Checks

- New users can find primary actions without reading internal docs.
- Advanced users can reach detailed settings quickly.
- The default UI shows no more than the essential top-level modeling tools.
- The right inspector changes with selection context.
- Snap settings are compact by default and detailed on demand.
- Command naming is consistent across toolbar, menu, tooltip, command palette, and shortcuts.
- Icons and labels match the same command metadata.

### Architecture Checks

- Design tokens drive colors, spacing, typography, and focus states.
- Toolbar contents come from command registry metadata.
- Workspace layout stores command ids and panel ids, not DOM nodes.
- User workspace preferences are outside project JSON.
- Engine and rendering modules do not import UI shell or design-system modules.
- UI actions mutate project data only through public app/controller/project-store APIs.
- Smart Component custom panels use shared primitives.

### Visual Checks

- No overlapping toolbar/panel/status UI on desktop.
- No button text overflow.
- Icon buttons have stable square dimensions.
- Popovers fit inside the viewport.
- Dragged toolbar/button previews are readable.
- The canvas remains the dominant surface.
- Focus rings are visible in light and dark themes.

### Persistence Checks

- Workspace reset works.
- Refresh restores customized toolbars.
- Broken or unknown command ids in saved workspace are ignored with diagnostics.
- Workspace schema version can be migrated.
- Project JSON is unchanged by UI customization.

## Standard Commands

Run after doc/config/schema changes:

```powershell
node .\scripts\check_repo.js
```

If UI workspace schemas are added later, validate their sample/default files through `scripts/check_repo.js`.

After frontend implementation phases, run the viewer locally and capture screenshots for at least:

- default desktop workspace
- narrow/mobile-sized viewport
- open inspector
- open snap settings popover
- customize toolbar mode
- command palette

## Plan Maintenance Rules

- Keep this file as the active source of truth for the UI rewrite until the professional shell is complete.
- When a phase starts, add a short implementation note with the exact files being changed.
- When a phase completes, record the evidence: checks run, screenshots captured, and any remaining exceptions.
- If a better UI architecture is chosen later, update this plan before implementing conflicting code.
- If user preference persistence moves beyond `localStorage`, document the new storage boundary and confirm it still stays out of project JSON.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| UI rewrite breaks modeling behavior | Introduce design system and command registry first, then migrate panels gradually |
| Design system becomes too abstract | Start with primitives needed by existing panels and toolbar |
| Customization adds complexity | Store simple command ids, toolbar ids, and dock ids; add schema/versioning |
| Professional UI becomes overwhelming | Use progressive disclosure and hide advanced diagnostics by default |
| Direct DOM code continues spreading | Make `panel-elements.mjs` a compatibility wrapper over design-system primitives |
| Icons become inconsistent | Use one registry, fixed sizes, shared stroke rules, and semantic names |
| UI preferences pollute model data | Persist user workspace outside project JSON and add checks if needed |
| Framework decision stalls progress | Build a stable design-system contract with ES modules first; framework can be revisited later |

## Completion Definition

This plan is complete when:

- Current test UI has been replaced by the professional shell.
- The toolbar, command palette, panels, and Smart Component UIs use the design system.
- Main commands use SVG icons from a shared registry.
- Users can customize and reset toolbars/workspace layout.
- UI styling is controlled through design tokens and themes.
- UI code is separated from engine/model/rendering logic through clear controller APIs.
- Project JSON remains semantic and contains no UI workspace state.
- Standard checks and visual QA pass.
