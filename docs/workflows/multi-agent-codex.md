# Multi-agent Codex Workflow

Use this workflow whenever an agent changes code, docs, schemas, scripts, or app data.

## Required Flow

- Use the assigned task working copy/worktree before editing.
- In the local `C:\boberos` workspace, agent folders are already provisioned: `C:\boberos\agent1` through `C:\boberos\agent10`.
- If you are assigned to one of those folders, do not create another worktree, checkout, or clone. For example, agent1 always works in `C:\boberos\agent1` on branch `codex/agent1`.
- Make all edits, checks, and browser verification inside that copy.
- Run the app from the copy with `npm run dev` or `node .\scripts\serve_viewer.js`.
- The server assigns stable ports by worktree: `main` uses `5173`, `agent1` uses `5181`, `agent2` uses `5182`, through `agent10` on `5190`.
- The preview URL given to the user must include the branch query parameter printed by the server, for example `branch=codex%2Fagent2`. A review URL on port `5173` or without the agent branch parameter is invalid for agent work.
- Keep `main` unchanged while the user is reviewing the copy.
- When implementation and checks are complete, set `INTEGRATION_REQUEST.txt` to `STATUS: USER_REVIEW` and summarize the result for the user.
- Do not set `STATUS: READY` until the user explicitly confirms in chat that the change is correct and approved for integration.
- `STATUS: READY` is the integrator queue and must mean user-approved, not merely agent-complete.
- Merge or promote the change only after the user confirms in chat that the result is OK.
- After merge, the integrator resets the used agent worktree to the latest accepted `main` state. Do not archive or delete the fixed agent folder unless the user explicitly asks.

## Agent Coordination

- Use subagents for independent investigation or review when the task has separable parts, but keep one agent responsible for the final patch and verification.
- Do not let multiple agents edit the same file in parallel unless there is an explicit integration owner.
- If two copies touch the same area, merge through the reviewed copy, not directly into `main`.
- If the assigned agent folder is missing, the named preview URL cannot be served, or the reset-after-integration step is unclear, stop and report the blocker before editing application files.

## Verification

Run the standard repo check from the working copy before asking for approval:

```powershell
node .\scripts\check_repo.js
```

For viewer work, also verify the named local preview URL in the browser and report the exact URL used.
