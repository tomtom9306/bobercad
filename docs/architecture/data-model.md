# Data Model

The product is a JSON-first steel BIM system. The JSON model is a database-like source of truth.

## Files

- `projects/sample_structure.json` - sample beam-column connection project and model database.
- `projects/sample_portal_frame.json` - sample grid-based portal frame project and model database.
- `projects/sample_beam_to_beam_end_plate.json` - beam-to-beam end plate connection sample with a stored top flange notch and web bolt pattern.
- `projects/sample_authoring_nc1_test.json` - compact regression sample for authoring patterns and NC1-ready data.
- `libraries/profiles.json` - point-based profile library.
- `libraries/materials.json` - material library.
- `libraries/fasteners.json` - bolt, blind bolt, hook bolt, anchor, stud, nut, and washer catalog library.
- `libraries/connections.json` - connection preset authoring library.
- `libraries/frames.json` - frame template authoring library.
- `viewer/viewer_settings.json` - viewer-only camera, UI, control, and render settings.
- `schemas/project_schema.json` - schema for project files.
- `schemas/profile_schema.json` - schema for profile libraries.
- `schemas/material_schema.json` - schema for material libraries.
- `schemas/fastener_schema.json` - schema for fastener libraries.
- `schemas/connection_library_schema.json` - schema for connection preset libraries.
- `schemas/frame_library_schema.json` - schema for frame template libraries.
- `schemas/viewer_settings_schema.json` - schema for viewer settings.

## Non-Negotiable Model Rules

- Project JSON stores semantic model data only.
- Do not store meshes, vertices, triangle indexes, B-reps, display geometry, generated solids, NC1 output, IFC output, STEP output, or drawing linework.
- Viewer/editor/exporter geometry is always derived.
- `objectIndex` is stored and authoritative for now. Keep it in sync manually until app commands can maintain it.
- Materials live in `libraries/materials.json`; project objects reference them with `"material": "S355"`.
- Profiles live in `libraries/profiles.json`; members reference them with `"profile": "PROFILE_ID"`.
- Fasteners live in `libraries/fasteners.json`; fastener groups reference catalog entries with `"fastenerRef": "M16_8_8"` directly or through `modelDefaults`.
- Connection presets live in `libraries/connections.json`; project connections may keep `sourcePreset` provenance, but stored `manualParts` remain the source of truth.
- Frame templates live in `libraries/frames.json`; project groups/assemblies may keep `sourceTemplate` provenance, but stored project objects remain the source of truth.
- Hole and slot positions live in `model.holePatterns`; repeated object authoring lives in `model.objectPatterns`.
- Repeated object values live in `modelDefaults`; objects only store fields that differ from those defaults.
- BIM metadata lives on the object in a `bim` block.
- Viewer camera, UI, and render preferences do not belong in project JSON; keep them in `viewer/viewer_settings.json`.

## Default Resolution

The app resolves every model object before use:

1. Collection default: `modelDefaults.collections.<collection>.*`
2. Type default: `modelDefaults.collections.<collection>.<type>`
3. Object data: `model.<collection>.<id>`

Later levels override earlier levels. Nested objects are merged, so an object can set only `bim.propertySets.Identity.mark` and still inherit default BIM category/type values.

Keep defaults semantic. They can store repeated project data such as material, profile, cardinal point, visibility, tracking, fabrication status, and default BIM property values. They must not store meshes, generated solids, drawing output, scene data, or exporter output.

## Member Geometry Convention

Defined in `projects/sample_structure.json/settings/modelingConvention`:

- `memberLocalX`: start-to-end
- `memberLocalY`: profile-section-y-width-axis
- `memberLocalZ`: profile-section-z-depth-axis
- `memberRotation`: degrees-about-member-local-x
- `cardinalPoint`: profile-reference-point-name
- `objectIndex`: stored-and-authoritative

Viewer and editor work must follow these conventions.

## Work Points And Reference Planes

Use `model.workPoints` for named, stored construction points that AI agents and editors can reference without guessing coordinates.

A member can include `startPointRef` and `endPointRef`, but `start` and `end` remain the authoritative geometry. The refs are for authoring clarity, review, and future QA checks. They must not be used as hidden fallbacks to fill missing member coordinates.

Use `model.referencePlanes` for stored semantic planes such as roof slopes, facade planes, floor planes, truss center planes, and connection working planes. A reference plane is not a mesh, a surface body, or generated geometry. It is a named plane with origin, normal, local axes, and optional extents.

For roof and truss work, prefer this pattern:

- store the roof slope planes once in `referencePlanes`
- store grid/node points in `workPoints`
- store each member with explicit `start`, `end`, and optional point refs
- keep `placementIntent` as descriptive metadata only

## Object Patterns

Use `model.objectPatterns` for authoring repetition such as linear column lines, purlin rows, circular stairs, mirrored plates, or repeated bracing bays.

Object patterns do not replace stored objects. Every generated object must still exist in its normal model collection. A pattern records authoring history and edit intent:

- `sourceObjectIds`: objects used as the pattern seed
- `generatedObjectIds`: all stored objects that belong to the pattern
- `detachedObjectIds`: objects that were manually changed and must not be moved by future pattern edits
- `transform`: spacing, direction, count, axis, or other repeat data

Individual objects can also carry an `authoring` block with `patternId`, `patternIndex`, and `patternStatus`. Allowed statuses are `source`, `linked`, `detached`, and `deleted-from-pattern`.

If a user breaks a pattern, do not delete the stored object. Change its `authoring.patternStatus` to `detached` and keep its explicit geometry.

## Hole Patterns And Features

Use `model.holePatterns` only for hole, slot, and fastener positions on a stored feature reference plane.

Features reference hole patterns with `holePatternRef`. Do not use generic `patternRef`.

For notches and other cuts that should behave like Tekla cuts, use Tekla-aligned feature types:

- `boolean-part` with `teklaClass: "BooleanPart"` for part cuts, polygon cuts, boolean adds, and weld prep objects.
- `cut-plane` with `teklaClass: "CutPlane"` for a cutting plane that cannot extend the part boundary.
- `fitting` with `teklaClass: "Fitting"` for fitting a part end to a plane; this can make the part shorter or longer.
- `edge-chamfer` with `teklaClass: "EdgeChamfer"` for chamfers.

For `boolean-part`, store `booleanType` with Tekla-style enum names:

- `BOOLEAN_CUT`
- `BOOLEAN_ADD`
- `BOOLEAN_WELDPREP`

The feature is the selectable transparent cut object. Deleting that feature deletes the cut.

Example:

```json
{
  "id": "cut_beam_notch_1",
  "type": "boolean-part",
  "teklaClass": "BooleanPart",
  "booleanType": "BOOLEAN_CUT",
  "cutKind": "part-cut",
  "ownerId": "beam_1",
  "body": {
    "type": "box",
    "center": [0, -100, 165],
    "axisX": [1, 0, 0],
    "axisY": [0, 1, 0],
    "axisZ": [0, 0, 1],
    "size": [160, 170, 70]
  }
}
```

Do not duplicate the cut geometry in `dimensions` or `placementIntent`. `body` is the source of truth.

Supported `boolean-part.body` primitives at this stage:

- `box` for rectangular part cuts and simple weld prep cutters.
- `polygonal-prism` for polygon cuts and square/rectangular openings.
- `cylinder` for round part cuts and round openings.

For NC1-ready member data, each feature should store enough information to locate the operation without guessing:

- `ownerId`
- `type`
- `reference.kind`
- `reference.origin`
- `reference.normal`
- `reference.localAxisY`
- `reference.localAxisZ`
- dimensions such as `diameter`, `slot`, `cut`, `outline`, or linked `holePatternRef`

Keep feature geometry semantic. Do not store NC1 output records or generated solids.

## Profile Geometry Convention

Profiles are point-based polygonal sections.

- Points are `[y, z]`.
- Contours are closed by connecting last point to first point.
- Solid contours are counter-clockwise.
- Void contours are clockwise.
- Hollow profiles use at least one solid contour and one void contour.

Do not make profile geometry depend on web/flange thickness fields as the source representation.

## Plate Geometry Convention

Simple rectangular plates can use `width` and `height`.

Non-rectangular plates use `outline` as local `[y, z]` points in the plate plane, with `center`, `normal`, `localAxisY`, `localAxisZ`, and `thickness` defining placement and extrusion. This is still semantic plate geometry, not a stored mesh.

Bent plates use `flatPattern` with a stored outline and `bendLines`. This is fabrication geometry, not a mesh.

Each bend line should store:

- `start`
- `end`
- `angle` in degrees
- `radius`
- `direction`

## Placement Intent

Manual objects can include `placementIntent`. This replaces older attachment metadata such as ad hoc `attachedTo` blocks for manually placed connection parts.

It must not drive rendering, silently fill missing geometry, or auto-correct object placement. Stored geometry remains authoritative:

- plates still need stored `center`, `normal`, `localAxisY`, `localAxisZ`, `thickness`, and either `width`/`height` or `outline`
- features still need stored references and `holePatternRef` where a repeated hole/slot pattern is used
- fasteners and welds still follow stored references
- missing geometry should fail validation/rendering instead of falling back to `placementIntent`

Keep `placementIntent` compact: role, host object, intended fit, flush faces, avoided zones, and split side. Do not duplicate stored geometry in `placementIntent`.

## Interfaces And Connection Zones

Use `interfaces` for named stored planes/faces that AI agents, editors, and future QA scripts can reference without guessing.

An interface is not a mesh or generated solid. It is a stored semantic plane with:

- `ownerId`
- `origin`
- `normal`
- `localAxisY`
- `localAxisZ`
- optional `extents`, `memberEnd`, and `faceRef`

Use `connectionZones` to group the logical place where objects connect. A zone names the main object, secondary objects, the relevant interface ids, and the manually stored objects that belong to that connection area. It does not generate plates, holes, fasteners, or welds.

## Manual Connections

Before connection generators exist, `connections` group manually modeled parts through `manualParts`.

`generator.status: "not-parametric-yet"` means the connection does not generate geometry. Its plates, holes, fasteners, and welds are stored as normal model objects and remain the source of truth.

Connection `sourcePreset` is provenance only. Viewers and NC1 exporters must not load `libraries/connections.json` to fill missing plates, holes, fasteners, welds, cuts, or dimensions.

## NC1-Ready Data

The first fabrication target is NC1. IFC and STEP are intentionally out of scope for the current data-model step.

An NC1-exportable member must be readable after default resolution and should have:

- `profile`
- `material`
- `start`
- `end`
- `rotation`
- `cardinalPoint`
- `fabrication.partMark`
- explicit `featureIds` for holes, slots, cuts, copes, notches, and mitres

NC1 exporters should read stored project objects and resolved defaults. They must not rebuild missing fabrication data from object patterns, frame templates, connection presets, placement intent, or viewer geometry.

## Object Shape

Physical objects should keep related data together:

```json
{
  "id": "beam_1",
  "type": "beam",
  "start": [-2200, 0, 1500],
  "end": [-162, 0, 1500],
  "fabrication": { "partMark": "B1" },
  "display": { "color": "#9fb3c8" },
  "bim": {
    "name": "Beam B1",
    "propertySets": {
      "Identity": { "mark": "B1" }
    }
  }
}
```
