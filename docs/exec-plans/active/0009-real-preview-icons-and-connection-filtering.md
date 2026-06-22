# Exec Plan 0009: Real Smart Component Preview Icons And Connection Filtering

## Goal

Connections and future reusable component pickers must use real Smart Component generation for availability, sorting, and optional CAD previews.
Compact Connections tiles may use temporary image-generator bitmap artwork while the final thumbnail visual language is still unsettled.

The same capability must be reusable in:

- Connections dock tiles as generated bitmap artwork/status tiles.
- Properties panels, where there is enough room for generated previews.
- Future component galleries and quick-pick surfaces.

When members are selected, the picker should prioritize components that can actually be generated for that selection. Unsupported components remain visible but are de-emphasized, disabled, and explain why they are unavailable.

## Non-Negotiables

- Do not store rendered bitmaps, meshes, vertices, triangles, scene graph data, or generated geometry in project JSON or Smart Component JSON.
- CAD preview icons must come from the same semantic Smart Component generator and scene builder used by real model creation.
- A preview may be cached in memory or browser storage, but the cache is derived and disposable.
- If a Smart Component cannot generate for a preview context, the UI must show an unavailable state instead of a fake visual.
- Filtering must be based on the same creation/runtime rules that real creation uses, not duplicated UI heuristics.

## Current Evidence

Existing foundations:

- `createSmartComponentFromPreset(presetId, memberIds)` creates real Smart Component instances from selected members.
- `createProjectSmartComponentFromPreset(...)` already validates connection roles, member intersections, existing zones, and duplicate connection state.
- `buildScene(project, profiles, fasteners, viewerSettings, options)` builds the real render scene from stored semantic objects.
- `createWebglViewer(...).canvasDataUrl()` can capture rendered output when used with a capture-capable canvas configuration.
- Connections dock tiles now have a dedicated compact tile surface for generated bitmap artwork and availability status.

Prototype result on `sample_connection_test_frame.json` for `["column_c1", "beam_b1_south"]`:

- Some presets generated and produced real scene geometry.
- Some presets failed with generator/runtime diagnostics, for example incompatible interface requirements.
- This confirms the desired available/unavailable UX should be driven by dry-run generation diagnostics.

## Current Implementation Status

Implemented vertical slice:

- `store.previewSmartComponentFromPreset(...)` dry-runs real Smart Component creation/regeneration without committing to the active project.
- Smart Component definitions declare semantic `preview.contexts`; the resolver no longer relies on a UI-only type switch to choose canonical scenes.
- `bobercad/app/ui/viewer/smart-component-preview-service.mjs` evaluates selection-aware availability and default preview contexts.
- `bobercad/app/rendering/preview/scene-thumbnail-renderer.mjs` creates isometric thumbnail data URLs from real `buildScene(...)` output.
- Connections tiles request availability asynchronously without rendering CAD thumbnails, show temporary image-generator bitmap artwork, sort available presets first, show unavailable/no-preview presets lower, and disable the action when the unavailable result comes from the current member selection.
- Smart Component Properties panels render existing instances through the same preview service and `previewImage` property field type.
- Initial preview contexts use existing semantic sample projects:
  - `sample_fin_plate_preview_seed.json`
  - `sample_connection_test_frame.json`
  - `sample_beam_to_beam_fin_plate.json`
  - `sample_beam_to_beam_end_plate.json`
  - `sample_warehouse_12x24.json`
  - `sample_stair_straight_basic.json`
  - `sample_stair_manual_station_split.json`

Verified current coverage:

- Default/no-selection preview evaluation succeeds for all registered connection presets:
  - `fin-plate`
  - `moment-end-plate`
  - `end-plate`
  - `base-plate`
  - `stair-hardware`
  - `member-splice`
  - `apex-gusset`
- With `qaSelectObject=column_c1`, the Connections panel recalculates tile states from the selected member context.
- With `qaSelectObject=connection_beam_to_beam_fin_plate_1`, the Properties panel shows an available current-project preview image for the selected Smart Component.
- Contract coverage verifies:
  - Dry-run preview does not mutate the active store project.
  - Every registered connection preset declares known `preview.contexts` metadata.
  - Every registered connection preset has a real default preview data URL.
  - Classic steel connection preset default previews use dry-run generation rather than a stored preview instance.
  - One selected member evaluates compatible connection candidates with selection-active preview state.
  - A compatible selected member pair ranks as available.
  - An incompatible selected member pair remains visible as unavailable with a reason.

Known limitations of this vertical slice:

- Base plate now uses a warehouse foundation preview context, but the core model still needs a more explicit foundation/support authoring concept.
- Nested stair-system connection presets (`stair-hardware`, `member-splice`) regenerate existing semantic preview context instances because their creation path is driven by the parent stair-system, not a direct two-member pick.
- Properties panels currently consume existing Smart Component instance previews. Preset previews in arbitrary future property cards still need a small descriptor/binding wrapper.

## Architecture

Add a reusable preview subsystem with three separable layers.

### 1. Preview Contexts

Create semantic preview contexts that describe a typical input model for each Smart Component family. These are not thumbnails and not generated geometry; they are small temporary project templates or context builders.

Planned module:

- `bobercad/app/engine/modules/smart-components/smart-component-preview-contexts.mjs`

Each context returns a temporary project with:

- Required settings and tolerances.
- Minimal model collections.
- Typical members/supports for the connection family.
- Proper `objectIndex`.
- Stable member ids used as Smart Component inputs.

Initial context families:

- `beam-to-column-fin-plate` for fin plates.
- `beam-to-column-side` for side/end plate variants.
- `beam-to-beam-end` for beam-to-beam end plates.
- `beam-to-beam-web` for beam-to-beam fin plates.
- `column-base` for base plates. This may need a support/foundation semantic object or a temporary base-support member until the core model gains foundation supports.
- `member-splice` for collinear member splices.
- `apex-gusset` for two rafters or beams meeting at an apex.

Smart Component definitions or presets should reference preview contexts with metadata, for example:

```json
"preview": {
  "contexts": [
    "beam-to-column-side"
  ],
  "focusMode": "generated-with-inputs"
}
```

Schema update required:

- `smart-component.schema.json` has optional `preview.contexts` metadata on definitions and presets.
- Allowed preview context ids are validated in a domain contract, not in the generic schema, so the list can grow.

### 2. Dry-Run Preview And Eligibility Service

Create one service that answers both:

- What preview/status should this component surface show?
- Is this component available for the current selection?

Planned module:

- `bobercad/app/engine/modules/smart-components/smart-component-preview-service.mjs`

API shape:

```js
previewSmartComponentPreset({
  project,
  profiles,
  fasteners,
  materials,
  viewerSettings,
  smartComponentCatalog,
  presetId,
  context,
  selectedObjectIds
})
```

Return shape:

```js
{
  presetId,
  status: "available" | "unavailable" | "preview-only" | "error",
  reason: "",
  diagnostics: [],
  previewProject,
  smartComponentId,
  renderObjectIds,
  scene
}
```

Rules:

- With no selection, use the preset's canonical preview context and mark as `preview-only`.
- With one selected member, score and sort likely matches but do not hide the rest. Use context/matching metadata to indicate "pick another member".
- With two selected members, dry-run creation for every connection preset against a cloned project.
- Available means dry-run generation succeeded and scene building produced renderable generated objects.
- Unavailable means dry-run generation failed, returned diagnostic errors, or produced no meaningful generated objects.
- The real project must not be mutated during dry-run.

Implementation detail:

- Prefer adding a store/runtime method such as `evaluateSmartComponentPreset(...)` that shares the real creation/update code path but returns a result without committing.
- Avoid duplicating connection geometry rules in the UI.
- Normalize generator exceptions into user-facing reasons.

### 3. Thumbnail Renderer

Create a reusable thumbnail renderer that consumes a real scene and returns an image URL/blob.

Planned module:

- `bobercad/app/rendering/preview/scene-thumbnail-renderer.mjs`

Inputs:

- `scene` from `buildScene`.
- fixed camera/view options, normally isometric.
- target size such as `160x120` or `192x144`.
- focus mode: generated component only, generated plus selected context, or whole preview context.

Output:

- `dataUrl` or `Blob`.
- optional `dominantBounds`, `faceCount`, `lineCount` for diagnostics.

Renderer strategy:

1. Use a hidden/offscreen WebGL canvas when available.
2. Reuse the existing scene rendering path as much as possible.
3. Fall back to a simple generated state only if WebGL is unavailable, not to a fake icon.

Cache keys:

```text
preview:v1:<presetId>:<presetVersion>:<definitionVersion>:<contextHash>:<selectionSignature>:<rendererVersion>
```

Cache policy:

- In-memory LRU first.
- Optional browser persistent cache later.
- Invalidate on component version, parameter defaults, preview context, renderer version, or selection signature changes.

## UI Behavior

### Connections Dock

The Connections tab should render tiles with:

- Real preview image.
- Preset name.
- Short family/type label.
- State badge: available, needs another member, unavailable.
- Small action button for pick/create.

Sorting:

1. Available for current selection.
2. Needs another member.
3. Preview-only / no selection.
4. Unavailable, visually de-emphasized at the bottom.

Unavailable tile behavior:

- Disabled main action.
- Still selectable for explanation.
- Tooltip or inline reason, for example "Requires member end face" or "Selected axes do not intersect".

### Selection-Aware Filtering

Selection states:

- `0 members`: show all connection tiles with canonical availability status.
- `1 member`: show compatible families first and prompt to pick a second member.
- `2 members`: show successful dry-run presets first; unavailable presets stay visible lower in the list.
- `>2 members`: show a constrained message and disable create actions until selection is reduced.

The current selected member(s) should be visible as context in the tile surface. The preview should either:

- Render the selected member geometry as a muted context around the generated connection, or
- Render a canonical preview but add a selection compatibility badge.

Phase 1 uses badges, sorting, and image-generator bitmap artwork in compact tiles. CAD thumbnails are reserved for larger surfaces such as Properties where they have enough space.

### Properties Panels

Properties panels should consume the same preview API through a generic preview field/control:

- Input: preset id, smart component instance id, or object id.
- Output: generated CAD preview image plus status when the surface opts into CAD images; otherwise generated bitmap artwork and availability/status only.
- No separate hand-authored icon system.

## Implementation Phases

### Phase 1: Dry-Run Eligibility

Deliverables:

- Add `evaluateSmartComponentPreset(...)` that dry-runs creation without committing.
- Add connection preset availability evaluation from selected members.
- Surface `available/unavailable/reason` in `smart-component-browser.mjs`.
- Sort Connections tiles by availability.
- Keep image-generator tile artwork for this phase only; keep availability driven by dry-run generation.

Checks:

- Contract: evaluation does not mutate the project.
- Contract: selected incompatible member pair returns unavailable with reason.
- Contract: selected compatible pair returns available for at least one known connection preset.

### Phase 2: Canonical Preview Contexts

Deliverables:

- Add preview context builders.
- Add optional `preview` metadata to Smart Component definitions/presets.
- Add canonical preview evaluation for no-selection state.
- Confirm every connection preset either generates a preview or reports a clear reason.

Checks:

- Schema validation for `preview` metadata.
- Contract: every registered connection preset has a preview context or inherited definition preview.
- Contract: canonical previews build scenes with nonzero generated geometry for supported connection presets.

### Phase 3: Scene Thumbnail Renderer

Deliverables:

- Add reusable thumbnail renderer.
- Add preview image cache for preview-enabled surfaces.
- Render compact generated-bitmap-artwork/status tiles in Connections.
- Ensure availability evaluation is async and does not block first paint.

Checks:

- Contract: renderer receives `scene` output from `buildScene`, not static image files.
- Contract: thumbnail has nonblank pixel data for a known generated connection when a surface requests images.
- Visual QA: Connections dock shows stable compact generated-bitmap-artwork tiles at desktop and narrow dock widths.

### Phase 4: Selected Context Thumbnails

Deliverables:

- Generate availability using the actual selected member pair when available.
- Include muted selected members and highlighted generated connection objects.
- Add cancellable async jobs so rapidly changing selection does not show stale availability.

Checks:

- Contract: tile preview updates when selected members change.
- Contract: stale jobs cannot overwrite newer tile state.
- Visual QA: generated connection is framed in isometric view.

### Phase 5: Reusable Properties Preview Control

Deliverables:

- Add a generated-property field/control for Smart Component preview images.
- Use same preview service/cache as Connections availability.
- Use it for selected Smart Components and future object references.

Checks:

- Contract: properties preview uses same preview renderer module.
- Contract: properties preview can render an existing generated Smart Component instance from current project data.

## Design Decisions

- Prefer dry-run generation over manually maintained compatibility matrices.
- Use preview context metadata to select canonical input geometry, not to store preview geometry.
- Keep unavailable options visible because hidden options make it harder to discover why something is unavailable.
- Use real renderer output when a surface opts into CAD preview images. On compact surfaces, generated bitmap artwork plus generated availability is better than a cramped or unreadable CAD thumbnail.
- Treat preview generation failures as product feedback: if a preset cannot preview, fix the preset/context rather than hiding the problem.

## Risks

- Some current connection presets are not fully compatible with the same member pair. The service must support multiple canonical contexts.
- Base plates need a better support/foundation context; current two-member connection assumptions may be too narrow.
- Thumbnail rendering can be expensive. Use async queues, small image sizes, and caching on preview-enabled surfaces.
- Scene thumbnails and availability dry-runs must not leak temporary preview projects into the real project store.
- Generated scenes may include the whole context unless `renderObjectIds` is scoped carefully to generated objects plus selected context.

## Acceptance Criteria

- Connections tiles show generated bitmap artwork and generated availability for supported presets without cramped CAD-thumbnail clutter.
- CAD previews are generated from Smart Component output and `buildScene`, not static artwork.
- Selecting two members reorders/marks tiles according to real dry-run availability.
- Unavailable tiles show a clear reason and are visually de-emphasized.
- The preview API is reusable from Properties panels.
- `node .\scripts\check_repo.js` passes.
- Browser QA verifies stable layout in the Connections dock and nonblank generated thumbnails for preview-enabled surfaces.
