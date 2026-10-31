# Stage: implement

Build the task below exactly as the approved spec and design say. You are in the task's own git worktree on branch `agent/<slug>`, with dependencies installed.

1. Write the tests from the design's test plan first, and run them to see them fail.
2. Make the change. Reuse existing helpers and match the style around them (comment density, naming, idioms).
3. If you change or add a flow screen, update `e2e/demo-path.spec.ts` in the same change.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` yourself, and fix what fails. After you, the pipeline runs the full gate and a separate reviewer reads your diff, so report what you actually ran in `verified`.

Rules: stay in scope, with no drive-by refactors. Don't edit `tasks.md` (the pipeline checks the task off). Never delete, skip or weaken a test. If you had to depart from the design, say where and why in `deviations`. If only a human can unblock the task, stop and set `blocked_reason`.
