# 0006 Unified Snapping And Selection Manager

## Goal

Make snapping feel identical across sketches, plates, beams, member editing, workplane creation, and future tools.

The user should not need to understand which internal tool is active. If a point, edge, axis, grid, relation, or object is snap-enabled, it should behave the same way everywhere:

- same filter rules
- same snap strength
- same marker style
- same priority behavior
- same keyboard overrides
- same diagnostics
- same selection and snap scope

This is a hard-change plan. Do not preserve the old per-tool snap routes as compatibility layers. Existing projects may break during migration; fix them against the new route.

## Problem

Snapping currently has a shared low-level core, but controllers still make their own snap decisions:

| Area | Current file | Problem |
|---|---|---|
| Project snap targets | `bobercad/app/rendering/interaction/snap-providers.mjs` | Collects members, grids, reference planes, work points, global axes, and member profile surface targets through one provider path. |
| Snap solving | `bobercad/app/engine/api/project/snap-solver.mjs` | Picks nearest point, line, or line intersection, but receives already-decided candidates and tolerances. It cannot know why a target is allowed. |
| Composite member snapping | `bobercad/app/rendering/interaction/snap-providers.mjs` | Adds member/axis projection snaps through the construction provider, not a member-create-only branch. |
| Member creation | `bobercad/app/rendering/interaction/member-create-controller.mjs` | Builds construction axes, profile axes, face-axis snaps, active reference axes, direct-point preference, and biases locally. |
| Member editing | `bobercad/app/rendering/interaction/member-edit-controller.mjs` | Builds drag guide axes, large-scene local snap options, axis snaps, quantized translation, and auto axis relation behavior locally. |
| Plate creation | `bobercad/app/rendering/interaction/plate-create-controller.mjs` | Uses plate-only adaptive grid and model-plane projection helpers. |
| Plate sketch editing | `bobercad/app/rendering/interaction/plate-sketch-edit-controller.mjs` | Has separate edge, vertex, relation, equal-length, 90-degree, grid, and model snap logic. |
| Precision grid | `bobercad/app/rendering/interaction/snap-profiles.mjs` | Adaptive grid steps are profile-driven and shared by plate creation, plate sketch editing, and future tools. |
| Model-to-plane snapping | `bobercad/app/rendering/interaction/snap-manager.mjs` | Projects accepted model snaps onto an active workplane or plate sketch plane when the context asks for projection. |
| Sketch creation | `bobercad/app/rendering/interaction/sketch-create-controller.mjs` | Resolves only a raw workplane point; it does not use model snapping. |
| Workplane creation | `bobercad/app/rendering/interaction/work-plane-controller.mjs` | Resolves only raw points; it does not use the shared snap route. |
| Selection | `bobercad/app/rendering/interaction/selection-controller.mjs` | Stores highlighted ids and pick mode only. It has no object/category filter state. |
| Viewer picking | `bobercad/app/rendering/webgl/webgl-renderer.mjs` | Internal picking already supports `objectIds` and `componentKind`, but that capability is not exposed as a reusable selection/snap scope. |
| Settings | `bobercad/app/ui/viewer/viewer-settings.json` and `bobercad/app/schemas/viewer-settings.schema.json` | Snap tolerances are scattered by tool, so changing one setting does not change the whole app consistently. |

## Hard Requirements

- One authoritative snap route for every interactive tool.
- One manager controls both selection scope and snapping scope.
- If an object type is filtered out for selection, it is filtered out for snapping by default.
- Snap strength is controlled in one place.
- Snapping must support tool-specific smart defaults without creating tool-specific snap engines.
- Plate sketch, member creation, member editing, sketch creation, and workplane creation must call the same manager.
- The manager must support filtering by object class, object id, smart component scope, active selection, active sketch, and provider type.
- No generated snap state, preview state, or scene graph data may be written into project JSON.
- No OpenCascade or general CAD kernel.
- Project geometry remains semantic. Snap targets are runtime candidates only.
- No compatibility layer for old helper names. Delete or fold old helpers into the new provider route.
- Existing APIs and docs must be updated in the same change.

## Non-Goals

- No persistent project JSON change for snap candidates.
- No new CAD kernel.
- No stored mesh/B-rep snap cache.
- No final production constraint solver redesign. Relation hints can be routed through the snap result, but the existing sketch/member relation APIs remain responsible for committing semantic relations.

## User Behavior

### Default Mode

Default snapping should be simple enough for a new user or shop-floor user:

- Snap is on.
- Strength is `Normal`.
- Scope is `Smart`.
- The active tool decides which categories are relevant, but the same manager enforces the rule.
- The cursor shows one clean snap marker and one short label.
- If there are multiple close snaps, the strongest/clearest snap wins.
- `Tab` cycles close candidates.
- `Alt` temporarily disables snapping while held.
- A small toolbar button opens snap settings.

Example:

- Creating a beam near a member endpoint snaps to the endpoint.
- Creating a plate near the same endpoint snaps with the same marker and strength.
- Editing a plate sketch near that endpoint projects the endpoint onto the sketch plane and uses the same snap marker.
- Dragging a member endpoint near that endpoint uses the same priority and label behavior.

### Snap Strength

| Strength | Behavior | Intended user |
|---|---|---|
| `Off` | No snap candidates accepted. Raw pointer position only. | Free placement or debugging. |
| `Light` | Endpoints, sketch corners, plate corners, work points, grid intersections. Small tolerance. | Precise users who dislike magnetic behavior. |
| `Normal` | Light targets plus axes, grid lines, active workplane axes, sketch relation hints. Medium tolerance. | Default. |
| `Strong` | Normal targets plus projections, intersections, active guide axes, reference axes. Larger tolerance. | Construction and alignment work. |
| `Training` | Strong snapping, clearer labels, fewer advanced categories visible, conservative candidate cycling. | New users and shop-floor workflows. |

Strength changes only the manager profile. Individual tools must not invent private tolerance constants.

### Selection And Snap Scope

The manager exposes high-level categories first:

- Members
- Plates
- Fasteners
- Welds
- Features
- Trim joints
- Work points
- Reference planes
- Grids
- Active sketch
- Construction guides
- Current smart component
- Selected objects only

Advanced mode can expand categories into details:

- member endpoints
- member center points
- member physical axis
- member layout axis
- member profile faces
- member profile face centers
- member profile edges
- member profile edge midpoints
- member profile corners
- plate corners
- plate sketch vertices
- plate sketch edges
- fastener centers
- hole centers
- grid lines
- grid intersections
- reference plane origin
- reference plane corners
- reference plane axes

Default rule:

```text
selection scope filters picking
selection scope also filters snapping
snap-specific overrides are allowed only in advanced mode
```

Examples:

- If `Members` is off, beams cannot be selected and snapping ignores member endpoints, axes, and layout axes.
- If `Plates` is on and `Members` is off, plate sketch editing can snap to plate vertices but not beam endpoints.
- If `Current smart component` is on, both picking and snapping ignore objects outside the active component.
- If `Selected objects only` is on, snapping ignores all unselected model objects but can still use grid/workplane if those provider toggles are on.

## Target Architecture

### New Modules

Add these modules:

| New module | Responsibility |
|---|---|
| `bobercad/app/rendering/interaction/snap-selection-manager.mjs` | Owns selection and snapping scope state. Converts user filters into predicates for picking and snapping. |
| `bobercad/app/rendering/interaction/snap-manager.mjs` | One public runtime entrypoint for resolving snaps. Builds provider list, applies scope, calls solver, returns a normalized result. |
| `bobercad/app/rendering/interaction/snap-profiles.mjs` | Defines `Off`, `Light`, `Normal`, `Strong`, and `Training` strengths. |
| `bobercad/app/rendering/interaction/snap-providers.mjs` | Providers for model objects, grids, reference planes, work points, construction axes, active workplane, active sketch, sketch relations, adaptive grid, and model-to-plane projection. |
| `bobercad/app/rendering/interaction/snap-result.mjs` | Normalizes accepted snap data, relation hints, labels, preview metadata, and diagnostics. |
| `bobercad/app/rendering/scene/authoring/snap-overlays.mjs` | One overlay renderer shape for snap markers, candidate highlights, and guide lines. |
| `bobercad/app/ui/viewer/toolbar/snap-manager-toolbar.mjs` | Compact snap UI: strength, Smart scope, filters, and advanced details. |

Fold or delete these old modules after migration:

- `bobercad/app/rendering/interaction/plate-grid-snap.mjs`
- `bobercad/app/rendering/interaction/model-plane-snap.mjs`
- `bobercad/app/engine/api/project/snap-candidates.mjs`
- `bobercad/app/engine/api/project/snap-composer.mjs`

The useful logic from those files becomes providers. The public old routes should not remain.

### Snap Request

Every tool calls the manager with a request like:

```js
snapManager.resolve({
  project,
  viewer,
  screen,
  rawPoint,
  context: {
    tool: "member-create",
    phase: "pick-end",
    activeObjectId: null,
    excludedObjectIds: [],
    selectedObjectIds: [],
    smartComponentId: null,
    workPlane,
    localFrame: null,
    wants: ["point", "line", "intersection"]
  }
});
```

Tool examples:

| Tool | `tool` | `phase` examples |
|---|---|---|
| Beam/column creation | `member-create` | `pick-start`, `pick-end`, `preview-end` |
| Member edit | `member-edit` | `drag-endpoint`, `drag-center`, `drag-layout-endpoint` |
| Plate creation | `plate-create` | `pick-corner-1`, `pick-corner-2`, `pick-depth` |
| Plate sketch edit | `plate-sketch` | `drag-vertex`, `drag-edge`, `insert-vertex`, `notch-size` |
| Sketch create | `sketch-create` | `pick-sketch-point` |
| Workplane create | `workplane-create` | `pick-plane-point` |

### Snap Result

Every tool receives the same result shape:

```js
{
  accepted: true,
  pointWorld: [0, 0, 0],
  pointLocal: null,
  rawPointWorld: [0, 0, 0],
  label: "Endpoint: member_1 start",
  strength: "Normal",
  providerId: "model.members",
  type: "member-endpoint",
  target: {
    collection: "members",
    objectId: "member_1",
    subId: "start",
    componentId: null,
    semanticRole: "endpoint"
  },
  relationHints: [],
  preview: {
    marker: "point",
    guideLines: [],
    highlightObjectIds: ["member_1"]
  },
  diagnostics: []
}
```

If no snap is accepted:

```js
{
  accepted: false,
  pointWorld: rawPoint,
  rawPointWorld: rawPoint,
  relationHints: [],
  diagnostics: []
}
```

Tools can use `pointWorld` or `pointLocal`, but they must not reinterpret candidates directly.

### Providers

Providers are small, testable functions:

```js
provider.collect({
  project,
  viewer,
  context,
  scope,
  profile,
  rawPoint
});
```

Providers return normalized candidates:

```js
{
  kind: "point",
  type: "member-endpoint",
  providerId: "model.members",
  point: [0, 0, 0],
  priority: 120,
  target: {
    collection: "members",
    objectId: "member_1",
    subId: "start"
  },
  label: "Endpoint: member_1 start",
  relationHints: []
}
```

Required providers:

| Provider | Replaces or absorbs |
|---|---|
| `model.members` | Member endpoints, member axes, layout axes, profile face/edge/corner snap targets from resolved member profiles. |
| `model.plates` | Plate corners, plate sketch vertices/edges, plate centers. |
| `model.fasteners` | Fastener centers and hole centers. |
| `model.workPoints` | Work points from the project model. |
| `model.referencePlanes` | Reference plane origin/corners/axes/edges. |
| `model.grids` | Grid lines and intersections. |
| `construction.globalAxes` | Global origin and axes. |
| `construction.memberCreateAxes` | Current start axes, profile axes, creation axes, active reference axes. |
| `construction.memberEditAxes` | Drag guide axes and relation axes. |
| `construction.composite` | Projection and axis-axis candidates in `snap-providers.mjs`. |
| `plane.projection` | Projection of accepted model snaps onto active workplane or plate sketch plane in `snap-manager.mjs`. |
| `precision.adaptiveGrid` | Adaptive grid in `snap-profiles.mjs`, generalized for any local frame. |
| `sketch.vertices` | Plate sketch vertices, construction vertices, insert midpoint handles. |
| `sketch.edges` | Plate sketch edge snaps, collinear candidates, edge-drag candidates. |
| `sketch.relations` | 90-degree, perpendicular, parallel, equal-length, horizontal, vertical, coincident, midpoint, point-on-line hints. |

### Member Profile Snap Targets

Members must expose more than just start/end/axis targets. A beam, column, channel, box, angle, or custom profile has real geometry that users expect to snap to when placing plates, trims, holes, workplanes, sketches, and other members.

The `model.members` provider must derive runtime snap targets from the evaluated member profile and member local frame:

| Target | Example use | Candidate kind |
|---|---|---|
| Physical axis | Place another member on the beam centerline. | `line` |
| Layout axis | Align to the member's authored layout axis if present. | `line` |
| Endpoints | Pick start/end of member. | `point` |
| Midpoint | Pick member center along length. | `point` |
| Profile face plane | Snap plate/workplane to web or flange face. | `plane` or projected `line/point` depending on tool context |
| Face centerline | Find center of web/flange face along member length. | `line` |
| Face center point | Snap to center of a face at a station or member midpoint. | `point` |
| Longitudinal profile edge | Snap to flange/web corner edge running along beam length. | `line` |
| Edge midpoint | Snap to the midpoint of a visible profile edge at start/end/mid station. | `point` |
| Profile corner | Snap to the actual corner of a profile at start/end/mid station. | `point` |

These targets are runtime authoring candidates only. They must not be written into project JSON.

Implementation notes:

- Use the profile contour points as the source of section corners. Profiles are point-based `[y, z]` contours, not flange/web parameter definitions.
- Transform contour points through the member's local axes to create world-space profile corners at start, end, and sampled stations.
- Longitudinal edges are lines created by connecting the same contour point at member start and end.
- Face targets are derived from profile contour segments and member length, not from rendered mesh triangles.
- Face center targets are derived from the midpoint of a contour segment swept along member length.
- Curved or helix members must expose equivalent targets along the semantic centerline. The provider samples authoring snap stations from the mathematical centerline for snapping only; it must not create segmented member objects.
- For performance, profile-surface targets should respect snap scope, camera distance, raw point radius, and strength. `Light` can expose endpoints/corners only; `Normal` can expose edges/face centers; `Strong` can expose faces and projected face snaps.
- If the selection scope disables `Members`, all member profile targets are disabled too.

### Solver

`snap-solver.mjs` should become a pure ranking and hit-testing module. It should not know UI state, but it should rank consistently using a normalized profile:

```js
{
  screenTolerancePx,
  intersectionTolerancePx,
  pointBiasPx,
  intersectionBiasPx,
  lineBiasPx,
  projectionBiasPx,
  axisBiasPx
}
```

Ranking order:

1. Filtered-out candidates are removed before solving.
2. Candidate-specific hard constraints are checked.
3. Candidate screen distance is computed.
4. Snap class bias is applied.
5. Provider priority is applied.
6. Stable label/id sort breaks ties.
7. `cycleIndex` selects alternate candidates under cursor.

The solver should return candidates sorted with reasons:

```js
diagnostics: [
  { candidateId: "...", status: "accepted", reason: "closest point" },
  { candidateId: "...", status: "rejected", reason: "filtered: members disabled" }
]
```

Diagnostics are for development/QA and should not overwhelm normal UI.

## Settings

Replace scattered authoring snap settings with one block:

```json
"authoring": {
  "snap": {
    "enabled": true,
    "strength": "normal",
    "scopeMode": "smart",
    "holdToDisableKey": "Alt",
    "cycleKey": "Tab",
    "profiles": {
      "light": {
        "screenTolerancePx": 8,
        "intersectionTolerancePx": 10,
        "gridMaxStep": 5
      },
      "normal": {
        "screenTolerancePx": 16,
        "intersectionTolerancePx": 22,
        "gridMaxStep": 10
      },
      "strong": {
        "screenTolerancePx": 28,
        "intersectionTolerancePx": 36,
        "gridMaxStep": 25
      },
      "training": {
        "screenTolerancePx": 34,
        "intersectionTolerancePx": 42,
        "gridMaxStep": 50,
        "showLabels": true
      }
    },
    "scope": {
      "members": true,
      "plates": true,
      "fasteners": true,
      "welds": false,
      "features": true,
      "trimJoints": false,
      "workPoints": true,
      "referencePlanes": true,
      "grids": true,
      "activeSketch": true,
      "constructionGuides": true,
      "currentSmartComponentOnly": false,
      "selectedObjectsOnly": false
    }
  }
}
```

Remove these scattered settings as direct controller inputs:

- `snapTolerancePx`
- `plateSketchGridSteps`
- `plateSketchGridMinScreenPx`
- `plateSketchCreateGridMaxStep`
- `plateSketchEdgeGridMaxStep`
- `plateSketchVertexGridMaxStep`
- `plateSketchRelationGridMaxStep`
- `plateSketchNotchGridMaxStep`
- `plateSketchEdgeSnapTolerancePx`
- `plateSketchVertexSnapTolerancePx`
- `plateSketchAngleSnapTolerancePx`
- `plateSketchEdgeSnapMaxWorld`
- `plateSketchVertexRelationSnapMaxWorld`
- `plateSketchVertexAngleSnapMaxWorld`
- `plateSketchVertexEqualLengthSnapMaxWorld`
- `pointSnapBiasPx`
- `intersectionSnapBiasPx`
- `faceAxisSnapBiasPx`
- `multiSnapTolerancePx`
- `startAxisIntersectionBiasPx`
- `startAxisSnapBiasPx`
- `profileAxisSnapBiasPx`
- `globalAxisSnapTolerancePx`
- `profileAxisSnapTolerancePx`
- `creationAxisSnapTolerancePx`
- `activeReferenceAxisSnapTolerancePx`
- `compositeSnapTolerancePx`

If a few values still need tool tuning, they must live under the central snap profile as provider weights, not as controller-private settings.

## UI Plan

### Toolbar

Add one compact snap control to the modeling toolbar:

```text
[Snap: Normal v]
```

Click opens a small quick list:

- Off
- Light
- Normal
- Strong
- Training
- Smart scope on/off
- Snap filters...

`Snap filters...` opens advanced mode.

### Advanced Filter Panel

Advanced panel shows checkboxes grouped by user concepts:

```text
Snap and Select
[x] Members
[x] Plates
[x] Fasteners
[ ] Welds
[x] Features
[x] Work points
[x] Reference planes
[x] Grid
[x] Active sketch
[x] Construction guides

Scope
[ ] Current smart component only
[ ] Selected objects only

Strength
Off | Light | Normal | Strong | Training
```

Do not show every snap subtype by default. Subtypes are advanced details only.

### Visual Feedback

All tools use the same overlay:

- point snap: small filled square/circle marker
- line snap: highlighted guide line
- intersection snap: point marker plus both lines highlighted
- projected snap: marker at projected point plus faint line to original target if helpful
- relation snap: marker plus relation hint icon
- rejected snap: no marker; diagnostics only

Labels should be short:

- `Endpoint`
- `Axis`
- `Grid A/1`
- `Plate corner`
- `90 deg`
- `Parallel`
- `Equal length`

Verbose object ids are diagnostics, not default labels.

## Tool Integration

### Member Create

Replace local `commandSnapCandidates()` with:

```js
snapManager.resolve({
  context: {
    tool: "member-create",
    phase: state.start ? "pick-end" : "pick-start",
    memberType: state.type,
    startPoint: state.start,
    activeReferenceMemberIds: state.activeReferenceMemberIds,
    axisGuideMode: activeAxisGuideMode(),
    workPlane: plane()
  }
});
```

Remove local:

- `faceAxisSnap`
- `preferredDirectPointSnap`
- `preferredSnap`
- `preferredStartAxisSnap`
- `startProfileAxisCandidates`
- `startCreationAxisCandidates`
- `activeReferenceAxisCandidates`
- direct `snapCandidates` calls
- direct `composeSnapCandidates` calls

Those become providers and profile rules.

### Member Edit

Replace drag-local candidates with:

```js
snapManager.resolve({
  context: {
    tool: "member-edit",
    phase: `drag-${handle.target}`,
    activeObjectId: activeMemberId,
    excludedObjectIds: [activeMemberId],
    basePoint,
    dragAxis: axis,
    coordinateSpace
  }
});
```

The manager returns:

- snap point
- guide axis result
- relation hints for auto axis relations
- diagnostics if a relation was ignored

Keep commit logic in member edit. Move snap candidate construction out.

### Plate Create

Replace `modelSnapOnPlane` and `plate-grid-snap` use with:

```js
snapManager.resolve({
  context: {
    tool: "plate-create",
    phase: `pick-corner-${state.points.length + 1}`,
    workPlane: state.plane,
    localFrame: plateCreationFrame,
    axisLocked: state.axisLocked
  }
});
```

The adaptive grid provider handles edge length/depth quantization through the same profile.

### Plate Sketch Edit

Replace local snap functions with manager calls per drag type:

- `drag-vertex`
- `drag-edge`
- `insert-vertex`
- `construction-vertex`
- `notch-size`

The sketch providers return local points and relation hints:

```js
relationHints: [
  { type: "perpendicular", edgeIds: ["e1", "e2"] }
]
```

The controller still validates the sketch and commits through plate APIs.

### Sketch Create

Every picked sketch point goes through the manager:

```js
context: {
  tool: "sketch-create",
  phase: "pick-sketch-point",
  workPlane
}
```

The raw fallback remains a point on the workplane.

### Workplane Create

Every workplane definition point goes through the manager:

```js
context: {
  tool: "workplane-create",
  phase: "pick-plane-point"
}
```

Default provider set should favor endpoints, corners, work points, and grid intersections.

## Migration Phases

### Phase 1: Snap Model And Settings

- Add snap settings schema in `viewer-settings.schema.json`.
- Update `viewer-settings.json`.
- Add `snap-profiles.mjs`, `snap-result.mjs`, and `snap-selection-manager.mjs`.
- Update docs.
- Keep no behavior migration yet except settings load.

### Phase 2: Provider Infrastructure

- Add `snap-providers.mjs`.
- Move model candidates into providers.
- Move composite candidate logic into a construction provider.
- Move plate grid logic into shared adaptive grid profiles.
- Move plane projection logic into the snap manager.
- Update `api-register.json`: remove or replace old public snap API entries.

### Phase 3: Manager And Overlay

- Add `snap-manager.mjs`.
- Update `snap-solver.mjs` to work on normalized candidates and profile weights.
- Recreate `snap-overlays.mjs` as the only snap overlay shape.
- Add diagnostics snapshots for QA.

### Phase 4: Selection Scope

- Expand `selection-controller.mjs` into a scope-aware manager.
- Expose picker filters to `webgl-renderer.mjs`.
- Ensure pick filters and snap filters share the same predicates.
- Add toolbar UI for strength and filters.

### Phase 5: Tool Migration

Migrate tools one at a time, deleting old local snap routes as each tool lands:

1. `member-create-controller.mjs`
2. `member-edit-controller.mjs`
3. `plate-create-controller.mjs`
4. `plate-sketch-edit-controller.mjs`
5. `sketch-create-controller.mjs`
6. `work-plane-controller.mjs`

### Phase 6: Delete Legacy

Delete old modules after all imports are removed:

- `plate-grid-snap.mjs`
- `model-plane-snap.mjs`
- `snap-candidates.mjs`
- `snap-composer.mjs`

Remove old settings and schema fields.

### Phase 7: QA And Documentation

- Update `docs/workflows/modeling-commands.md`.
- Add a snap manager section to viewer README.
- Add QA/debug hooks to expose current snap state in browser tests.
- Run standard checks.

## Acceptance Checks

### Functional Checks

- Strength `Off`: no tool snaps to anything.
- Strength `Light`: endpoints/corners/grid intersections snap in member create, member edit, plate create, and plate sketch with the same feel.
- Strength `Normal`: axes and sketch relation hints work consistently.
- Strength `Strong`: guide axes and line intersections are accepted consistently.
- Member snapping exposes the same member target family in all tools that support model snaps:
  - physical axis
  - layout axis when present
  - profile face planes or projected face targets
  - profile face centers
  - profile longitudinal edges
  - profile edge midpoints
  - profile corners
- `Alt` disables snap in every migrated tool.
- `Tab` cycles candidates in every migrated tool.
- Plate sketch dragging and beam endpoint dragging use the same marker style and label rules.
- Sketch creation and workplane creation can snap to model endpoints and work points.
- Active smart component scope prevents snapping to objects outside that component.
- Selected-only scope prevents snapping to unselected objects.

### Filter Checks

- With `Members` disabled:
  - members cannot be selected through normal picking
  - member endpoints are not snap targets
  - member axes are not snap targets
  - member layout axes are not snap targets
  - member profile faces, edges, edge midpoints, face centers, and corners are not snap targets
- With `Plates` disabled:
  - plate corners/sketch vertices are not snap targets
  - plate objects cannot be selected
- With `Grid` disabled:
  - grid lines and intersections do not snap
- With `Active sketch` disabled:
  - plate sketch relation/edge/vertex snap does not run
- With `Construction guides` disabled:
  - member creation guide axes and drag guide axes do not snap

### Architecture Checks

- No controller imports `plate-grid-snap.mjs`.
- No controller imports `model-plane-snap.mjs`.
- No controller or repo check imports `snap-candidates.mjs`.
- No controller imports `snap-composer.mjs`.
- Member create/edit, plate create/edit, sketch create, and workplane create all import `snap-manager.mjs`.
- `selection-controller.mjs` exposes a scope state consumed by snap manager and renderer picking.
- Old scattered snap settings are removed from `viewer-settings.json`.
- Matching schema updates are present.
- No project JSON contains snap state, preview state, candidates, or generated geometry.

### Commands

Run after implementation:

```powershell
node .\scripts\check_repo.js
```

Run targeted JavaScript syntax checks for changed modules:

```powershell
node --check .\bobercad\app\rendering\interaction\snap-manager.mjs
node --check .\bobercad\app\rendering\interaction\snap-selection-manager.mjs
node --check .\bobercad\app\rendering\interaction\snap-providers.mjs
node --check .\bobercad\app\rendering\interaction\snap-profiles.mjs
```

If viewer tests are added, they should cover:

- member create endpoint snap
- member drag axis snap
- plate create corner snap
- plate sketch vertex snap
- plate sketch edge snap
- workplane point snap
- filter members off
- filter plates off
- selected-only scope
- active smart component scope

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Manager becomes too large | Keep providers small and stateless. Manager only orchestrates. |
| Tool-specific behavior still leaks into controllers | Controllers may pass context, but may not build candidates or rank snaps. |
| UX becomes too complex | Default UI shows only strength and high-level filters. Advanced subtype filters are hidden. |
| Snapping feels too magnetic | Strength profile controls tolerance globally. `Alt` disables temporarily. |
| Performance drops on large models | Providers receive raw point and scope, and can apply local radius/max candidates before returning candidates. |
| Sketch relation snapping breaks outlines | Controller still validates geometry before commit. Manager suggests relation hints only. |
| Existing sample projects expose hidden assumptions | Accept the breakage and update the tool code/samples to match the new route. No compatibility layer. |

## Completion Definition

This plan is complete only when:

- All interactive authoring tools resolve snaps through `snap-manager.mjs`.
- Picking and snapping share one scope manager.
- Snap strength is centralized.
- Legacy per-tool snap helpers are deleted or folded into providers.
- The UI exposes snap strength and filters in a compact way.
- All acceptance checks above pass.
