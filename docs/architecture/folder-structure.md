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
|   |-- check_viewer_runtime.js
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
    |   |   |-- frame-library.schema.json
    |   |   |-- smart-component.schema.json
    |   |   `-- smart-component-register.schema.json
    |   |
    |   |-- engine
    |   |   |-- api
    |   |   |   |-- api-register.json
    |   |   |   |
    |   |   |   |-- project
    |   |   |   |   |-- members.mjs
    |   |   |   |   |-- objects.mjs
    |   |   |   |   |-- plate-sketch-relations-and-bends.mjs
    |   |   |   |   `-- snap-solver.mjs
    |   |   |   |
    |   |   |   |-- geometry
    |   |   |   |   `-- paths.mjs
    |   |   |   |
    |   |   |   `-- connections
    |   |   |       |-- connection-api.mjs
    |   |   |       |-- semantic-builders.mjs
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
    |   |   |   `-- project-command-store.mjs
    |   |   |
    |   |   `-- modules
    |   |       `-- smart-components
    |   |           |-- smart-component-parameters-and-definition.mjs
    |   |           |-- smart-component-runtime.mjs
    |   |           |-- smart-component-recipe.mjs
    |   |           `-- smart-component-registry.mjs
    |   |
    |   |-- rendering
    |   |   |-- annotations
    |   |   |   `-- README.md
    |   |   |
    |   |   |-- scene
    |   |   |   |-- scene-geometry-builder.mjs
    |   |   |   `-- plate-bend-geometry.mjs
    |   |   |
    |   |   |-- interaction
    |   |   |   |-- member-transform-edit-controller.mjs
    |   |   |   |-- selection-controller.mjs
    |   |   |   |-- snap-manager.mjs
    |   |   |   |-- snap-profiles.mjs
    |   |   |   |-- snap-candidate-providers.mjs
    |   |   |   `-- snap-selection-manager.mjs
    |   |   |
    |   |   `-- webgl
    |   |       |-- camera.mjs
    |   |       `-- webgl-viewer-runtime.mjs
    |   |
    |   `-- ui
    |       `-- viewer
    |           |-- index.html
    |           |-- README.md
    |           |-- style.css
    |           |-- viewer-settings.json
    |           |-- viewer-runtime.mjs
    |           |-- panels
    |           |   `-- inspector-panel.mjs
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
        |   |-- frames
        |   |   |-- frame-register.json
        |   |   `-- frame-libraries
        |   |       `-- starter-frames
        |   |           `-- config.json
        |   |
        |   `-- smart-components
        |       |-- smart-component-register.json
        |       |-- smart-component-parameter-ui.mjs
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
bobercad/bobercad/app/ui/viewer          browser viewer entry, toolbar, panels, dimensions
```

The app should be grouped by responsibility. `engine` should be usable without the browser UI. `rendering` should turn engine data into visual output. `ui` should be viewer entry wiring, toolbar commands, panels, and dimension editing; it should call the engine and rendering layers rather than owning project rules, generation logic, or WebGL internals. Saved project files live in `data/projects`; runtime project state lives in `engine/store`.

UI rule:

```text
ui/toolbar     modeling command controls
ui/panels      generic project/property panels
ui/dimensions  dimension edit state and commits
```

Domain-specific panels should be contributions loaded into generic viewer hosts, not hardcoded UI structure. Files such as `connection-creator-panel.mjs` or `connection-panel.mjs` must not live in `app/ui/viewer`. The Smart Component register is catalog-only; viewer-side Smart Component UI loading is separate from headless catalog loading. Component-specific fields come from Smart Component config, not custom viewer files.

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
|-- smart-component-parameter-ui.mjs
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

Adding a new Smart Component means adding one folder under the matching `components/<kind>` subfolder and registering that folder path in `bobercad/bobercad/data/libraries/smart-components/smart-component-register.json`. The register must stay headless and catalog-only. A config may run a declarative `recipe` of public operations or a local `build.mjs` that calls the public model API. Do not add specific component types to app core.
