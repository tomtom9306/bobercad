# 0005 Stair Gallery QA, Curved Members, And Reusable Connections

## Problem

The stair gallery exposed issues that the previous visual QA accepted too easily:

- U/switchback railings and posts can visually crowd or cross through the stair volume.
- Curved, spiral, and helical support members are currently emitted as many straight beam segments. Rolled members must be represented as semantic curved/helix members, not as fabricated straight segment chains.
- Stair connection code lives under `components/stairs/connections` and uses stair-specific component kinds/names. The underlying hardware is reusable plate, bracket, cleat, splice, base, anchor, and post-base logic and should be available as standard shared connection components.

## Hard Requirements

- Project JSON must not store meshes, vertices, triangles, B-reps, scene graph data, or generated render geometry.
- Curved or helical rolled profiles must use semantic member centerlines:
  - `line` for straight members
  - `arc` for rolled planar members
  - `helix` for spiral/helical rolled members
- A rolled member must not be represented as a chain of straight member objects.
- `member.start` and `member.end` remain present for compatibility, but curved geometry is authoritative through `member.centerline`.
- If a new member field is introduced, update `bobercad/app/schemas/project.schema.json` in the same change.
- Connection implementation must not remain stair-only. Reusable hardware builders/components should live under a shared connections/component area and stair system should consume them through generic names.
- Visual QA must fail obvious crowding, rail crossing, broken support continuity, missing connection intent, or segmented rolled members.

## Deliverables

- `member.centerline` schema for line/arc/helix centerline metadata.
- Stair support generation that emits one semantic rolled member for curved/winder/spiral/helical stringers instead of many straight segment members.
- Viewer support for rendering semantic curved/helix members without changing project JSON into meshes.
- Shared reusable connection builders/components replacing stair-only connection modules where practical in this pass.
- Stricter QA checks in `scripts/qa_stair_variants.mjs`.
- Regenerated stair samples, including `sample_stair_all_variants.json`.
- Fresh screenshot QA for the gallery and individual variants.

## Acceptance

Completion requires all of:

```powershell
node .\scripts\generate_stair_samples.mjs
node .\scripts\qa_stair_variants.mjs --run-id all-variants-0005-final
node .\scripts\validate_json_schema.js .\bobercad\data\projects\sample_stair_all_variants.json
node .\scripts\check_repo.js
```

And:

- `sample_stair_all_variants.json` contains 14 top-level stair-system instances.
- Curved/winder/spiral/helical support members contain `centerline.type` of `arc` or `helix` and are not emitted as straight segment chains.
- No stair connection component config remains with `kind: "stair-connection"`.
- Visual QA review files for the final run explicitly reject the previous gallery issues and end in `FINAL: PASS`.
- The final QA summary says `ALL STAIR VARIANTS PASS`.
