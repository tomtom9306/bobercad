# Codex Workflow

Use this workflow for changes in this repo.

## Before Editing

- Identify which source file owns the requested behavior.
- Read `AGENTS.md`.
- Read the relevant architecture, workflow, quality, or decision doc.
- Read the matching schema before changing any JSON model structure.

## Branching

- Treat `main` as a clean integration base, not a working branch.
- Before making any code, data, docs, or schema edit, use your assigned task branch.
- In this local `C:\boberos` setup, the task branches already exist as fixed worktrees: `C:\boberos\agent1` through `C:\boberos\agent10` on `codex/agent1` through `codex/agent10`. If you are assigned to one of these folders, do not create another worktree or clone.
- Only edit directly on `main` when the user explicitly instructs that exact behavior.
- If already on `main` and the task requires feature edits, move to the assigned agent folder instead of editing `main`.
- `node .\scripts\check_repo.js` runs a branch guard and fails when local edits are present on `main`. Use `BOBERCAD_ALLOW_MAIN_EDITS=1` only for an explicit user-approved direct-main edit.

## Parallel Agent Worktrees

Git branch state belongs to a working tree folder, not to a Codex chat window. Multiple Codex chats pointed at the same folder will all see the same branch, so one chat changing branches changes the branch for every other chat using that folder.

- Use one separate checkout per concurrent agent.
- Prefer `git worktree` over full extra clones so all checkouts share the same local Git object store.
- Do not switch branches inside a folder that another active agent is using.
- In the standard local setup, those checkouts are already provisioned at `C:\boberos\agent1` ... `C:\boberos\agent10`. Assigned agents must use that existing folder and must not run `git worktree add`.
- If Codex can open different folders, use a stable external folder name that matches the task or role, such as `C:\boberos-worktrees\viewer-selection` or `C:\boberos-worktrees\integrator`.
- If Codex must stay attached to the single `C:\boberos` project, create worktrees under `C:\boberos\.codex-worktrees\`. This folder is ignored by Git.
- The integrator should also use its own checkout and should not share a working tree with authoring agents.

Preferred external worktree:

```powershell
git fetch origin
git worktree add C:\boberos-worktrees\<agent-task> -b codex/<agent-task> origin/main
```

Single Codex project fallback:

```powershell
git fetch origin
git worktree add .\.codex-worktrees\<agent-task> -b codex/<agent-task> origin/main
```

For the single integrator checkout inside the same Codex project:

```powershell
git fetch origin
git worktree add .\.codex-worktrees\integrator -b codex/integrator origin/main
```

When using `.codex-worktrees/`, tell each Codex chat its assigned subfolder and keep all commands scoped there. For example, an agent assigned to `.codex-worktrees\viewer-selection` must run reads, edits, checks, commits, pushes, and PR work from `C:\boberos\.codex-worktrees\viewer-selection`, even though the Codex project root is still `C:\boberos`.

The Codex UI may still show the branch for the outer `C:\boberos` folder. Treat that display as informational only when the chat is assigned to a `.codex-worktrees/` subfolder; the actual task branch is the branch inside the assigned worktree.

## Integration Queue

- In this local workspace, integration state lives in `C:\boberos\agentN\INTEGRATION_REQUEST.txt`.
- GitHub PR labels are used only when the user explicitly asks for a GitHub PR workflow.
- In both workflows, "ready for integration" requires explicit user approval first.
- For GitHub PR mode, use these labels exactly:
  - `ready-for-integration`: the authoring agent says the PR is complete and required checks passed.
  - `integrating`: the single integrator has locked this PR and is actively processing it.
  - `integration-blocked`: integration failed because of conflicts, failing checks, unclear scope, or missing work.
  - `integrated`: optional archive label after a successful merge.
- A non-integrator agent may add `ready-for-integration` only after running the required checks, summarizing them in the PR, and receiving explicit user approval.
- A non-integrator agent must not add `integrating`, merge to `main`, push to `main`, or resolve integration conflicts directly on `main`.

## Integrator Workflow

When the user says `jestes integratorem` or otherwise assigns the integrator role, stop normal feature work and act as the single integration worker.

For this local workspace, the integration queue is file-based unless the user asks for GitHub PRs:

- Agents signal technical completion by setting `STATUS: USER_REVIEW` in `C:\boberos\agentN\INTEGRATION_REQUEST.txt`, then showing the user the result and checks. `USER_REVIEW` is not an integration request.
- Agents must set `STATUS: WIP` before actively editing. `WIP` is the reset-protection lock for active work.
- Agent `USER_REVIEW` notes must include the dedicated preview URL from that agent worktree. The URL must use the agent port (`5181`-`5190`) and include the branch path prefix immediately after the host, such as `/codex/agentN/...`; otherwise the user may be reviewing `main` instead of the agent's work.
- Agents may set `STATUS: READY` only after the user explicitly confirms in chat that the change is correct and approved for integration.
- The integrator treats only `STATUS: READY` as integration-queue input. `READY` means user-approved, not merely agent-complete, so the integrator runs final checks and integrates it without asking for the same approval again.
- The integrator reviews the agent worktree diff against `C:\boberos\main`.
- If final checks fail or the scope is unsafe, the integrator marks the request `NEEDS_WORK` instead of integrating.
- After approved integration, the integrator resets the accepted agent branch and worktree to the latest accepted `main` state, restores `INTEGRATION_REQUEST.txt` to `STATUS: IDLE`, archives the completed agent chat/thread, then refreshes every other non-active agent worktree to `main`.
- Non-active means `STATUS: IDLE` or missing/blank status. Do not reset other agent worktrees marked `WIP`, `USER_REVIEW`, `READY`, or `NEEDS_WORK`.

Integrator rules:

- Process exactly one PR at a time.
- Treat `integrating` as a lock. Do not start a second PR while any PR is locked by you.
- Never do manual code, data, docs, or schema edits on `main`.
- Test integration on a temporary branch such as `codex/integration-pr-123`, not directly on `main`.
- If no PR is ready and the user asked you to monitor, wait 60 seconds and check again. Otherwise report that the integration queue is empty.

Integrator loop:

1. In local file mode, find `agent*/INTEGRATION_REQUEST.txt` with `STATUS: READY`; in GitHub PR mode, find the oldest open PR targeting `main` with `ready-for-integration` and without `integrating` or `integration-blocked`.
2. Lock it by adding `integrating`, removing `ready-for-integration`, and commenting that integration started.
3. Fetch the latest refs and create a temporary integration branch from current `origin/main`.
4. Merge or rebase the PR branch into the temporary integration branch.
5. If conflicts occur, abort the merge or rebase, remove `integrating`, add `integration-blocked`, and comment with the conflict summary and next action for the authoring agent.
6. Run the required checks, at minimum:

```powershell
node .\scripts\check_repo.js
```

7. If checks fail, remove `integrating`, add `integration-blocked`, and comment with the failing command and relevant output.
8. If checks pass, merge the PR to `main` using the repository's normal PR merge path.
9. After the merge succeeds, remove `integrating`, optionally add `integrated`, and comment with the merge result and checks run.
10. Refresh local `main` from `origin/main` with a fast-forward update before taking the next PR.

## During Editing

- Keep changes small and scoped.
- Update schema files in the same change as model shape changes.
- Do not add generated artifacts to project JSON.
- Do not introduce hidden assumptions; encode them in schema, docs, or scripts.
- Prefer simple data and simple scripts over broad dependencies.

## After Editing

Run:

```powershell
node .\scripts\check_repo.js
```

Run schema validation for a specific JSON file when changing JSON contracts:

```powershell
node .\scripts\validate_json_schema.js .\bobercad\data\projects\sample_seed_connection_structure.json
```

## When Work Gets Confusing

Do not guess silently. Improve one of:

- schema
- docs
- validation scripts
- data naming
- file organization

That is the Harness Engineering loop for this repo.

## Agent Routing

- New reusable objects, including connections, stairs, frames, and warehouses: start in `bobercad/data/libraries/smart-components`.
- Shared authoring behavior: start in `bobercad/app/engine/api/model` and expose a generic API or primitive before a library component uses it.
- Smart Component runtime behavior: start in `bobercad/app/engine/modules/smart-components`.
- 3D dimensions and labels: start in `bobercad/app/rendering/annotations/README.md`.
- Viewer panels, layout, and controls: start in `bobercad/app/ui/viewer/README.md`.
