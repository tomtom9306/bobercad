# Modeling Commands

This is the small-map for adding interactive modeling commands without loading the whole viewer in your head.

## Flow

Every command should follow the same loop:

```text
start command -> collect snaps/work plane -> show preview -> commit semantic JSON through project-store
```

Do not write generated mesh data, preview state, or temporary snap state into project JSON.

## Files

- `bobercad/app/engine/api/project/member-factory.mjs`: builds semantic member objects.
- `bobercad/app/engine/api/project/snap-candidates.mjs`: collects snap points and lines from the project.
- `bobercad/app/engine/api/project/snap-solver.mjs`: chooses the best snap for a cursor.
- `bobercad/app/engine/api/project/work-plane.mjs`: active modeling plane helpers.
- `bobercad/app/engine/store/project-store.mjs`: only place that mutates the project.
- `bobercad/app/rendering/interaction/command-controller.mjs`: shared keyboard and pointer routing.
- `bobercad/app/rendering/interaction/member-create-controller.mjs`: beam/column creation command.
- `bobercad/app/rendering/scene/authoring/`: temporary preview, snap, and work-plane overlays.
- `bobercad/app/ui/viewer/toolbar/modeling-toolbar.mjs`: command buttons/status only.

## Rules

- A command must commit through a headless API, usually `project-store`.
- A command preview must be disposable rendering state.
- New snap behavior belongs in candidate collection or solver files, not inside one command.
- Viewer settings such as snap tolerance, preview color, and default column height belong in `viewer-settings.json`.
- If a command needs a new persistent JSON shape, update the matching schema in the same change.
