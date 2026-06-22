# Multi-agent Codex Workflow

Use this workflow whenever an agent changes code, docs, schemas, scripts, or app data.

## Required Flow

- Start from the current main working tree, then create or switch to a task-specific working copy/worktree before editing.
- Name the copy after the task or branch, for example `worktree-connection-members-1`.
- Make all edits, checks, and browser verification inside that copy.
- Run the app from the copy. The preview URL given to the user must identify the copy being tested, preferably through a `/w/<copy-name>/...` route or an equivalent configured worktree server URL.
- Keep `main` unchanged while the user is reviewing the copy.
- Merge or promote the change only after the user confirms in chat that the result is OK.
- After merge, move the reviewed working copy into a `superseded/` archive, or keep an equivalent archived snapshot that can be compared later.

## Agent Coordination

- Use subagents for independent investigation or review when the task has separable parts, but keep one agent responsible for the final patch and verification.
- Do not let multiple agents edit the same file in parallel unless there is an explicit integration owner.
- If two copies touch the same area, merge through the reviewed copy, not directly into `main`.
- If the copy cannot be created, the named preview URL cannot be served, or the merge/archive step is unclear, stop and report the blocker before editing application files.

## Verification

Run the standard repo check from the working copy before asking for approval:

```powershell
node .\scripts\check_repo.js
```

For viewer work, also verify the named local preview URL in the browser and report the exact URL used.
