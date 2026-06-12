# Exec Plan 0002: Authoring Patterns And NC1-Ready Data

## Goal

Improve the JSON data model so AI agents can build large steel structures with fewer placement mistakes, while keeping each member, plate, hole, cut, and bend explicit enough for a future NC1 exporter.

## Current Baseline

Implemented in schema/model baseline `0.5.0`:

- `model.holePatterns`
- `model.objectPatterns`
- object-level `authoring`
- `holePatternRef` on features and fastener groups
- plate `sketch` and `fabrication.bends` for bent plates
- `sourceComponent` for Smart Component provenance
- `sourceTemplate` for frame/template provenance
- `settings.tolerances`
- starter `bobercad/data/libraries/smart-components/smart-component-register.json`
- starter `bobercad/data/libraries/model-library/model-register.json`
- sample beam-to-beam end plate connection with stored hole patterns, web bolts, weld, and top flange notch feature

## Non-Goals

- No IFC exporter work in this step.
- No STEP exporter work in this step.
- No OpenCascade or general CAD kernel.
- No stored meshes, B-reps, scene graph data, or generated solids.
- No hidden runtime generation from patterns, frame templates, or Smart Component presets.

## Core Rule

The project JSON remains the source of truth.

Libraries, templates, presets, and patterns are authoring aids only. After they are used, the project must still contain the actual stored objects:

- `members`
- `plates`
- `features`
- `holePatterns`
- `fastenerGroups`
- `welds`
- `workPoints`
- `interfaces`
- `connectionZones`
- `groups`
- `assemblies`

Exporters must read those stored objects, not rebuild the model from authoring history.

## 1. Separate Hole Patterns From Object Patterns

Rename the current project-level `model.patterns` to:

```json
"holePatterns": {}
```

Use `holePatterns` only for holes, slots, and fastener positions on a feature face.

Add a new collection:

```json
"objectPatterns": {}
```

Use `objectPatterns` for repeated model objects:

- `linear-pattern`
- `rectangular-pattern`
- `circular-pattern`
- `path-pattern`
- `mirror-pattern`

Example:

```json
{
  "id": "pat_columns_a",
  "type": "linear-pattern",
  "status": "linked",
  "sourceObjectIds": ["col_1_a"],
  "generatedObjectIds": ["col_1_a", "col_2_a", "col_3_a"],
  "transform": {
    "direction": [1, 0, 0],
    "spacing": 6000,
    "count": 3
  }
}
```

The generated objects must still exist normally in `members`, `plates`, or other model collections.

## 2. Add Object Authoring Metadata

Add an optional `authoring` block to physical objects.

Example:

```json
{
  "id": "col_2_a",
  "type": "industrial-column",
  "start": [6000, 0, 0],
  "end": [6000, 0, 6600],
  "authoring": {
    "source": "object-pattern",
    "patternId": "pat_columns_a",
    "patternIndex": 1,
    "patternStatus": "linked"
  }
}
```

Allowed `patternStatus` values:

- `source` - base object used to define the pattern
- `linked` - object can still be moved by pattern edits
- `detached` - object was manually changed and must not be moved by pattern edits
- `deleted-from-pattern` - pattern position exists historically, but the object was removed

This allows a user to break a pattern later, for example when changing middle column spacing.

## 3. Make Members NC1-Ready

Each member intended for NC1 export must have enough stored data to export without guessing.

Minimum member data:

- `id`
- `type`
- `profile`
- `material`
- `start`
- `end`
- `rotation`
- `cardinalPoint`
- `fabrication.partMark`
- explicit `features` for holes, slots, cuts, copes, notches, and mitres

Useful optional data:

- `startPointRef`
- `endPointRef`
- `referencePlaneId`
- `assemblyId`
- `tracking`
- `bim`

Do not rely on connection presets, frame templates, or object patterns to create missing NC1 data at export time.

## 4. Expand Features For Steel Fabrication

Extend `features` so member fabrication is explicit.

Required feature types:

- `round-hole`
- `slot-hole`
- `hole-pattern`
- `cope`
- `notch`
- `miter-cut`
- `saw-cut`
- `end-cut`
- `contour-cut`
- `plate-opening`

Feature data should identify:

- `ownerId`
- feature `type`
- target face, member end, or interface
- local coordinate system
- stored dimensions
- stored position
- linked `holePattern` where repeated hole positions are used

This is the layer that makes NC1 export straightforward.

## 5. Make Plates And Bent Plates Fabrication-Ready

Flat plates use the shared sketch structure:

- `center`
- `normal`
- `localAxisY`
- `localAxisZ`
- `thickness`
- `sketch.vertices` and `sketch.edges`
- `features`

Bent plates add stored bend operations:

```json
{
  "id": "bent_plate_1",
  "type": "bent-plate",
  "material": "S355",
  "thickness": 8,
  "sketch": {
    "type": "plate-sketch",
    "vertices": [
      { "id": "v1", "point": [0, 0] },
      { "id": "v2", "point": [600, 0] },
      { "id": "v3", "point": [600, 300] },
      { "id": "v4", "point": [0, 300] }
    ],
    "edges": [
      { "id": "e1", "from": "v1", "to": "v2" },
      { "id": "e2", "from": "v2", "to": "v3" },
      { "id": "e3", "from": "v3", "to": "v4" },
      { "id": "e4", "from": "v4", "to": "v1" }
    ]
  },
  "fabrication": {
    "bends": [
      {
        "id": "bend_1",
        "edgeId": "e2",
        "angle": 90,
        "radius": 12,
        "direction": "up",
        "flangeLength": 80,
        "relief": { "mode": "auto", "type": "round", "radius": 8 }
      }
    ]
  }
}
```

This stores semantic fabrication geometry, not meshes.

## 6. Improve Grid Systems For Large Structures

Keep `gridSystems`, `workPoints`, and `referencePlanes` as the main placement tools for AI-generated large frames.

Add or formalize:

- multiple grid systems
- local grid coordinate systems
- grid intersections as stored `workPoints`
- bay zones
- roof slope planes as stored `referencePlanes`
- floor and elevation planes as stored `referencePlanes`

Members still keep explicit `start` and `end`. Work point refs are review and authoring metadata only.

## 7. Add A Smart Component Library

Add:

```text
bobercad/data/libraries/smart-components/smart-component-register.json
bobercad/app/schemas/smart-component.schema.json
```

Smart Component library entries are presets for authoring standard objects such as connections, stairs, frames, and warehouses.

Example:

```json
{
  "id": "beam_to_column_end_plate_m16_2x3",
  "type": "beam-to-column-end-plate",
  "version": "0.1.0",
  "parameters": {
    "plateThickness": 12,
    "boltPattern": "M16_2x3_90_70",
    "weldSize": 6
  }
}
```

When a preset is used, the project Smart Component instance can store provenance:

```json
"sourceComponent": {
  "library": "smart-components",
  "id": "beam_to_column_end_plate_m16_2x3",
  "version": "0.1.0"
}
```

But the actual members, plates, holes, fasteners, welds, cuts, and patterns must be stored in the project.

## 8. Add A Frame Library

Add:

```text
bobercad/data/libraries/model-library/model-register.json
bobercad/app/schemas/model-library.schema.json
```

Frame library entries are templates for common arrangements:

- portal frame
- truss bay
- roof bay
- stair tower bay
- bracing bay
- canopy frame

Using a frame template should write actual `workPoints`, `members`, `groups`, and `assemblies` into the project.

The project can keep provenance:

```json
"sourceTemplate": {
  "library": "frames",
  "id": "portal_frame_2_column_1_beam",
  "version": "0.1.0"
}
```

The template must not be required by the viewer or NC1 exporter.

## 9. Add Tolerances For Quality Checks

Add simple project tolerances:

```json
"tolerances": {
  "coincident": 1,
  "snap": 1,
  "connectionGap": 2
}
```

Use these for future quality checks, not for hidden geometry fallback.

## 10. Validation Strategy

Keep `scripts/validate_json_schema.js` limited to schema matching only.

Add a separate future quality checker for semantic checks:

```text
scripts/check_model_quality.py
```

Useful future checks:

- `objectIndex` matches model collections
- member `startPointRef` matches stored `start`
- member `endPointRef` matches stored `end`
- NC1-exportable members have required fabrication data
- feature references point to existing owners and hole patterns
- detached pattern objects are not updated by pattern edits

## Implementation Order

1. Done: add schema support for `authoring`, `objectPatterns`, and `holePatterns`.
2. Done: migrate current `model.patterns` to `model.holePatterns`.
3. Done: update viewer code from `patterns` to `holePatterns`.
4. Done: add expanded feature fields for NC1-ready members.
5. Done: add bent plate data shape.
6. Done: add connection library files and schema.
7. Done: add frame library files and schema.
8. Done: improve grid system documentation around work points, bay zones, and roof planes.
9. Done: add sample data showing a linear object pattern with one detached middle object.
10. Done: add sample data showing connection preset provenance with explicit stored parts.
11. Next: add a separate model-quality checker for NC1 readiness and reference integrity.

## Acceptance Checks

- Project JSON files still validate against `bobercad/app/schemas/project.schema.json`.
- `node .\scripts\check_repo.js` passes.
- Viewer still renders existing samples.
- No generated geometry is written to project JSON.
- A member with holes, end cuts, and copes can be described only from stored JSON data.
- A pattern can be broken without deleting or changing the stored physical objects.
