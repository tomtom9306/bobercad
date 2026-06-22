# Codex Map

This repo follows OpenAI's Harness Engineering approach: humans steer, agents execute, and repository knowledge is the system of record.

Start here, then open the specific docs needed for the task.

## Source Of Truth

- Connection sample project: `bobercad/data/projects/sample_seed_connection_structure.json`
- Fin plate sample project: `bobercad/data/projects/sample_beam_to_column_fin_plate.json`
- Connection test frame sample project: `bobercad/data/projects/sample_connection_test_frame.json`
- Portal frame sample project: `bobercad/data/projects/sample_portal_frame.json`
- Beam-to-beam fin plate sample project: `bobercad/data/projects/sample_beam_to_beam_fin_plate.json`
- Beam-to-beam end plate sample project: `bobercad/data/projects/sample_beam_to_beam_end_plate.json`
- Authoring and NC1 data-model test project: `bobercad/data/projects/sample_authoring_nc1_test.json`
- Profile library pack: `bobercad/data/libraries/profiles/profile-libraries/starter-profiles/config.json`
- Material library pack: `bobercad/data/libraries/materials/material-libraries/starter-materials/config.json`
- Fastener library pack: `bobercad/data/libraries/fasteners/fastener-libraries/starter-fasteners/config.json`
- Smart Component library register: `bobercad/data/libraries/smart-components/smart-component-register.json`
- Frame library register: `bobercad/data/libraries/frames/frame-register.json`
- Viewer settings: `bobercad/app/ui/viewer/viewer-settings.json`
- Local dev server settings: `scripts/dev_server.config.json`
- Schemas: `bobercad/app/schemas/`

## Required Reading

- Data model work: `docs/architecture/data-model.md`
- Viewer/editor work: `docs/exec-plans/active/0001-viewer-mvp.md`
- Agent workflow: `docs/workflows/codex-workflow.md`
- Multi-agent Codex workflow: `docs/workflows/multi-agent-codex.md`
- Validation rules: `docs/quality/validation.md`
- Architecture decisions: `docs/decisions/0001-json-source-of-truth.md`
- Project schema: `bobercad/app/schemas/project.schema.json`
- Fastener library schema: `bobercad/app/schemas/fastener-library.schema.json`
- Smart Component schema: `bobercad/app/schemas/smart-component.schema.json`
- Smart Component register schema: `bobercad/app/schemas/smart-component-register.schema.json`
- Frame library schema: `bobercad/app/schemas/frame-library.schema.json`

## Hard Rules

- This local workspace already has fixed per-agent worktrees:
  - `C:\boberos\main` is the integrator worktree on `main`.
  - `C:\boberos\agent1` through `C:\boberos\agent10` are the authoring worktrees on `codex/agent1` through `codex/agent10`.
- If you are assigned to one of those agent folders, that folder is your working copy. Do not create another clone, checkout, or `git worktree`.
- Agent folders must stay on their assigned branch. For example, agent1 works in `C:\boberos\agent1` on `codex/agent1`.
- When an assigned agent believes the work is technically complete, it updates `INTEGRATION_REQUEST.txt` in its own folder with `STATUS: USER_REVIEW`, a summary, checks, and preview URL. This is not an integration request.
- An assigned agent may set `STATUS: READY` only after the user explicitly confirms in chat that the change is correct and approved for integration. Without that approval, never mark work ready for the integrator.
- The integrator processes only `STATUS: READY`, and `READY` means user-approved, not merely agent-complete.
- After integration, the integrator resets the agent worktree back to the latest accepted `main` state so the next task starts clean.
- Do not make code, data, docs, or schema edits directly on `main`. Before editing, create or switch to a task branch, normally `codex/<short-task-name>`, unless the user explicitly instructs otherwise.
- Parallel Codex agents must not share the same working tree. Each concurrent agent needs its own clone or `git worktree` checkout, because switching branches in one shared folder switches that folder for every chat using it.
- If this fixed `C:\boberos\agentN` layout is unavailable in another environment, create per-agent worktrees under `.codex-worktrees/` and run all task commands from the assigned subfolder.
- Only the single agent explicitly assigned as the integrator may merge into `main`. If the user says `jestes integratorem` or otherwise assigns the integrator role, follow the Integrator Workflow in `docs/workflows/codex-workflow.md` immediately.
- Non-integrator agents never merge, rebase, fast-forward, or push changes into `main`.
- In this local file-based workflow, non-integrator agents finish by setting `STATUS: USER_REVIEW` and waiting for the user. They do not open PRs or mark anything ready for integration unless the user explicitly asks for a GitHub PR workflow.
- If the user explicitly asks for GitHub PRs, PR labels may be used as the integration queue, but `ready-for-integration` still requires explicit user approval first.
- Do not store meshes, vertices, triangles, B-reps, scene graph data, or generated geometry in project JSON.
- Do not add OpenCascade or a general CAD kernel to the core model.
- Keep `objectIndex` stored and authoritative for now.
- Use `modelDefaults` for repeated semantic values; object fields override defaults.
- `placementIntent` replaces ad hoc attachment metadata for manual connection parts, but it is metadata only; do not use it as a renderer/exporter fallback or hidden geometry generator.
- Profiles are point-based `[y, z]` contours, not flange/web parameter definitions.
- Fasteners live in library packs under `bobercad/data/libraries/fasteners`; fastener groups reference catalog entries with `fastenerRef` directly or through `modelDefaults`.
- Use `model.workPoints` and `model.referencePlanes` for large-frame authoring points, roof slopes, grid nodes, and truss nodes; member `start`/`end` stay authoritative and point refs are review metadata only.
- Use `model.holePatterns` for hole/slot/fastener positions and `model.objectPatterns` for linear/circular/rectangular/path/mirror repetition of stored objects.
- Smart Components are authoring provenance only; project objects must still store all geometry needed by the viewer and NC1 exporter.
- Smart Components live in `bobercad/data/libraries/smart-components`; `kind: "connection"` is one component kind, not a separate core architecture. Components may use only the public model API and registered connection primitives, not hardcoded app branches or `componentRefs`.
- Use stored `interfaces` and `connectionZones` to describe connection locations; do not infer connection faces from vague object proximity.
- BIM metadata lives inside the object as `bim`, not in a separate wrapper.
- If model structure changes, update the matching schema in the same change.

## Mandatory Worktree Approval Workflow

- Before making code changes, use the assigned task working copy/worktree. In this local workspace, `C:\boberos\agentN` is already that working copy; do not create another one from inside an agent folder.
- Run and verify the app from that copy. The local URL shown to the user must identify the copy being tested, preferably with a `/w/<copy-name>/...` path or an equivalent configured worktree server route.
- When the agent finishes its own implementation and checks, mark `INTEGRATION_REQUEST.txt` as `STATUS: USER_REVIEW`, not `READY`. Wait for the user to confirm that the result is correct.
- Set `STATUS: READY` only after the user explicitly approves the change for integration.
- Do not merge, copy, or otherwise promote changes back to `main` until the user confirms in chat that the result is OK.
- After an approved merge, the integrator resets the used agent worktree to the latest accepted `main` state. Do not archive or delete the fixed `C:\boberos\agentN` folder unless the user explicitly asks.
- If a working copy or named local preview URL cannot be created, stop and report the blocker before editing application files.

## Standard Checks

Run after JSON/schema/doc workflow changes:

```powershell
node .\scripts\check_repo.js
```

Run schema validation for a specific JSON file:

```powershell
node .\scripts\validate_json_schema.js .\bobercad\data\projects\sample_seed_connection_structure.json
```

## Local Dev Server

- Use `npm run dev` or `node .\scripts\serve_viewer.js`; do not start ad hoc local servers on random ports.
- The fixed local server defaults to `http://127.0.0.1:5173/`.
- `scripts/dev_server.config.json` is authoritative for host, port, default viewer path, and replacement policy.
- When `replaceExisting` is `true`, the server stops any current listener on that port before starting so all agents reuse the same URL.
