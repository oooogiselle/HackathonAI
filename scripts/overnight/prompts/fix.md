# Stage: fix

A previous attempt at the task below did not pass. Its changes are already in this worktree and staged: run `git status` and `git diff --cached <base>` (the base is named below) to see them. The approved spec and design are below too.

Fix what's listed under "What failed":

- Fix the root cause, not the symptom. Never delete, skip or weaken a test to make it pass. The only exception: break-it tests that the reviewer listed as wrong (`bad_tests`), which you may fix or delete.
- Don't loosen `e2e/demo-path.spec.ts` unless the task changed that screen.
- Re-run the failing check, then the full `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`, and report what you ran in `verified`.
- Stay in scope; don't edit `tasks.md`.
- If only a human can unblock this, set `blocked_reason`.
