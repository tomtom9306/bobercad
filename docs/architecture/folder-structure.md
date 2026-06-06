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
    |   |   |   `-- selection-controller.mjs
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
        |   `-- smart-components
        |       |-- smart-component-register.json
        |       |-- smart-component-library-ui.mjs
        |       |-- smart-component-ui.mjs
        |       |-- parameter-values.mjs
        |       |
        |       `-- components
        |           |-- connections
        |           |   |-- fin-plate
        |           |   |   `-- config.json
        |           |   |
        |           |   |-- moment-end-plate
        |           |   |   `-- config.json
        |           |   |
        |           |   |-- base-plate
        |           |   |   `-- config.json
        |           |   |
        |           |   `-- apex-gusset
        |           |       `-- config.json
        |           |
        |           |-- stairs
        |           |   `-- stair-system
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           |-- frames
        |           |   `-- portal-frame
        |           |       |-- config.json
        |           |       `-- build.mjs
        |           |
        |           `-- buildings
        |               `-- warehouse
        |                   |-- config.json
        |                   `-- build.mjs
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

Domain-specific panels should be contributions loaded into generic viewer hosts, not hardcoded UI structure. Files such as `connection-creator-panel.mjs` or `connection-panel.mjs` must not live in `app/ui/viewer`. The Smart Component register points to `data/libraries/smart-components/smart-component-library-ui.mjs` for library-level tools. Component-specific fields come from Smart Component config, not custom viewer files.

API rule:

```text
engine/api/api-register.json   high-level list of available calls
engine/api/<topic>             API calls and helpers grouped by topic
engine/modules/<name>          feature implementation used by API and store
```

`bobercad/bobercad/data/libraries` is for editable industry knowledge. Material, profile, fastener, and model libraries should be grouped as packs, not one folder per individual item.

Smart Component libraries keep parametric authoring definitions out of app core. Connections, stairs, frames, warehouses, and nested building blocks live in the same library:

```text
bobercad/bobercad/data/libraries/smart-components
|-- smart-component-register.json
|-- smart-component-library-ui.mjs
|-- smart-component-ui.mjs
`-- components
    |-- connections
    |   `-- one-folder-per-connection-kind
    |       `-- config.json
    |-- stairs
    |   `-- one-folder-per-stair-kind
    |       |-- config.json
    |       `-- build.mjs
    |-- frames
    `-- buildings
```

Adding a new Smart Component means adding one folder under the matching `components/<kind>` subfolder and registering that folder path in `bobercad/bobercad/data/libraries/smart-components/smart-component-register.json`. The register is also the only link to library UI through `libraryUi`. A config may run a declarative `recipe` of public operations or a local `build.mjs` that calls the public model API. Do not add specific component types to app core.
