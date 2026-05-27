# Folder Structure

Current root shape:

```text
bobercad
|-- .gitignore
|-- AGENTS.md
|-- docs
|-- scripts
`-- bobercad
    |-- app
    `-- data
```

Main idea:

```text
bobercad/          repo workspace: agents, docs, scripts, dev setup
bobercad/bobercad  actual product root

bobercad/bobercad/app   app-owned code, schemas, validation, headless API
bobercad/bobercad/data  editable projects, catalogs, standards, industry knowledge
```

Current checked structure:

```text
bobercad
|-- AGENTS.md
|
|-- docs
|   |-- README.md
|   |-- architecture
|   |   |-- data-model.md
|   |   `-- folder-structure.md
|   |-- decisions
|   |-- exec-plans
|   |-- quality
|   `-- workflows
|
|-- scripts
|   |-- check_repo.js
|   |-- check_repo_structure.js
|   |-- check_viewer_geometry.js
|   |-- export_bobercad_ai_review.js
|   `-- validate_json_schema.js
|
`-- bobercad
    |-- app
    |   |-- schemas
    |   |   |-- project.schema.json
    |   |   |-- viewer-settings.schema.json
    |   |   |-- api-register.schema.json
    |   |   |-- material-library.schema.json
    |   |   |-- profile-library.schema.json
    |   |   |-- fastener-library.schema.json
    |   |   |-- model-library.schema.json
    |   |   |-- connection.schema.json
    |   |   |-- connection-register.schema.json
    |   |   |-- connection-component.schema.json
    |   |   `-- connection-component-register.schema.json
    |   |
    |   |-- engine
    |   |   |-- api
    |   |   |   |-- api-register.json
    |   |   |   |
    |   |   |   |-- project
    |   |   |   |   |-- project-api.mjs
    |   |   |   |   |-- members.mjs
    |   |   |   |   |-- objects.mjs
    |   |   |   |   `-- snapping.mjs
    |   |   |   |
    |   |   |   |-- geometry
    |   |   |   |   |-- geometry-api.mjs
    |   |   |   |   |-- vectors.mjs
    |   |   |   |   `-- planes.mjs
    |   |   |   |
    |   |   |   `-- connections
    |   |   |       |-- connection-api.mjs
    |   |   |       |-- builders.mjs
    |   |   |       |-- checks.mjs
    |   |   |       `-- geometry.mjs
    |   |   |
    |   |   |-- core
    |   |   |   |-- math.mjs
    |   |   |   `-- model.mjs
    |   |   |
    |   |   |-- geometry
    |   |   |   |-- csg.mjs
    |   |   |   |-- member-evaluator.mjs
    |   |   |   |-- member-geometry.mjs
    |   |   |   `-- polygon.mjs
    |   |   |
    |   |   |-- store
    |   |   |   `-- project-store.mjs
    |   |   |
    |   |   `-- modules
    |   |       |-- connections
    |   |       |   |-- connection-registry.mjs
    |   |       |   |-- component-registry.mjs
    |   |       |   |-- component-config-groups.mjs
    |   |       |   |-- connection-generator.mjs
    |   |       |   |-- connection-recipe.mjs
    |   |       |   |-- connection-schema.mjs
    |   |       |   `-- README.md
    |   |       |
    |   |       |-- drawings
    |   |       |   `-- drawing-generator.mjs
    |   |       |
    |   |       `-- reports
    |   |           `-- report-generator.mjs
    |   |
    |   |-- rendering
    |   |   |-- annotations
    |   |   |   `-- README.md
    |   |   |
    |   |   |-- scene
    |   |   |   |-- build-authoring-overlays.mjs
    |   |   |   `-- build-scene.mjs
    |   |   |
    |   |   |-- interaction
    |   |   |   |-- member-edit-controller.mjs
    |   |   |   |-- selection-controller.mjs
    |   |   |   `-- snap-controller.mjs
    |   |   |
    |   |   `-- webgl
    |   |       |-- camera.mjs
    |   |       `-- webgl-renderer.mjs
    |   |
    |   `-- ui
    |       `-- viewer
    |           |-- index.html
    |           |-- README.md
    |           |-- style.css
    |           |-- viewer-settings.json
    |           |-- main.mjs
    |           |
    |           |-- workbench
    |           |   |-- workbench.mjs
    |           |   |-- layout-store.mjs
    |           |   `-- command-registry.mjs
    |           |
    |           |-- navigation
    |           |   |-- navigation-ui.mjs
    |           |   `-- toolbar-ui.mjs
    |           |
    |           |-- panels
    |           |   |-- panel-host.mjs
    |           |   |-- panel-registry.mjs
    |           |   |-- property-panel.mjs
    |           |   `-- viewport-panel.mjs
    |           |
    |           |-- controls
    |           |   |-- form-controls.mjs
    |           |   `-- menu-controls.mjs
    |           |
    |           `-- themes
    |               `-- theme.mjs
    |
    `-- data
        |-- libraries
        |   |-- materials
        |   |   |-- material-register.json
        |   |   `-- material-libraries
        |   |       `-- starter-materials
        |   |           `-- config.json
        |   |
        |   |-- profiles
        |   |   |-- profile-register.json
        |   |   `-- profile-libraries
        |   |       `-- starter-profiles
        |   |           `-- config.json
        |   |
        |   |-- fasteners
        |   |   |-- fastener-register.json
        |   |   `-- fastener-libraries
        |   |       `-- starter-fasteners
        |   |           `-- config.json
        |   |
        |   |-- model-library
        |   |   |-- model-register.json
        |   |   `-- models
        |   |       `-- starter-frames
        |   |           `-- config.json
        |   |
        |   |-- connections
        |   |   |-- connection-register.json
        |   |   |-- README.md
        |   |   |-- connection-library-ui.mjs
        |   |   |-- connection-ui.mjs
        |   |   |
        |   |   `-- connections
        |   |       |-- fin-plate
        |   |       |   `-- config.json
        |   |       |
        |   |       `-- moment-end-plate
        |   |           `-- config.json
        |   |
        |   `-- connection-components
        |       |-- component-register.json
        |       |-- README.md
        |       |
        |       `-- components
        |           |-- metadata
        |           |   `-- design-status
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- plates
        |           |   |-- secondary-web-plate
        |           |   |   |-- config.json
        |           |   |   `-- build.mjs
        |           |   |
        |           |   `-- member-end-plate
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- features
        |           |   `-- secondary-member-gap-fitting
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- fasteners
        |           |   `-- web-bolt-pattern
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- cuts
        |           |   `-- support-flange-clearance
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- welds
        |           |   `-- support-edge-fillet
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- stiffeners
        |           |   `-- support-web-stiffeners
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           `-- shared
        |               `-- secondary-web-context.mjs
        |
        `-- projects
            `-- sample_*.json
```

Ownership rule:

```text
If changing it changes how the app works, it belongs in bobercad/bobercad/app.
If changing it changes what knowledge/content the app has, it belongs in bobercad/bobercad/data.
If changing it changes a JSON contract used by app validation, it belongs in bobercad/bobercad/app/schemas.
Repo-only workflow files stay in the outer bobercad root.
```

Schema rule:

```text
All schemas live flat in bobercad/bobercad/app/schemas.
Do not split schemas into nested folders unless the folder count becomes painful.
```

`bobercad/bobercad/app/engine/api` is the only API root. It can have topic folders as the app grows.

App code layout:

```text
bobercad/bobercad/app/engine             headless logic, data model, API, generation
bobercad/bobercad/app/engine/api         one public API root, grouped by topic
bobercad/bobercad/app/engine/store       runtime app state and mutations
bobercad/bobercad/app/engine/modules     engine feature implementations
bobercad/bobercad/app/rendering          visual scene and WebGL rendering
bobercad/bobercad/app/ui/viewer          browser workbench: panels, navigation, layout
```

The app should be grouped by responsibility. `engine` should be usable without the browser UI. `rendering` should turn engine data into visual output. `ui` should be buttons, navigation, layouts, panels, and workbench customization; it should call the engine and rendering layers rather than owning project rules, generation logic, or WebGL internals. Saved project files live in `data/projects`; runtime project state lives in `engine/store`.

UI rule:

```text
ui/workbench   panel layout, docking, commands, workspace state
ui/navigation  menus, toolbar, tree/sidebar navigation
ui/panels      generic panel host and reusable panel shells
ui/controls    reusable inputs, buttons, menus, form controls
ui/themes      visual styling tokens and theme switching
```

Domain-specific panels should be contributions loaded into generic viewer hosts, not hardcoded UI structure. Connection files such as `connection-creator-panel.mjs` or `connection-panel.mjs` must not live in `app/ui/viewer`. The connection register points to `data/libraries/connections/connection-library-ui.mjs` for library-level tools. Connection-specific fields come from JSON config merged from reusable components, not custom viewer files.

API rule:

```text
engine/api/api-register.json   high-level list of available calls
engine/api/<topic>             API calls and helpers grouped by topic
engine/modules/<name>          feature implementation used by API and store
```

`bobercad/bobercad/data/libraries` is for editable industry knowledge. Material, profile, fastener, and model libraries should be grouped as packs, not one folder per individual item.

Connection libraries are intentionally thin because standard connections should be composed from reusable components:

```text
bobercad/bobercad/data/libraries/connections
|-- connection-register.json
|-- connection-library-ui.mjs
|-- connection-ui.mjs
`-- connections
    `-- one-folder-per-connection
        `-- config.json
```

Adding a new connection should usually mean adding one folder under `bobercad/bobercad/data/libraries/connections/connections` and adding that folder path to `bobercad/bobercad/data/libraries/connections/connection-register.json`. The register is also the only link to connection library UI through `libraryUi`. The app reads each connection `config.json`, composes `componentRefs`, and runs its declarative `recipe`; connection folders must not contain `build.mjs` or `ui.mjs`.

Reusable connection parts live in `bobercad/bobercad/data/libraries/connection-components`. Add one folder under `components`, register it in `component-register.json`, then reference it from a connection config with `componentRefs` and `recipe`. Component configs own shared roles, UI fragments, dimensions, and optional parameters; component build files create explicit model objects through the connection API. Compact config groups are allowed when they prevent repeated boilerplate across many components.
