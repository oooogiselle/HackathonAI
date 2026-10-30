<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Overnight / headless task runs

When running unattended (`claude -p` in a loop), follow these rules:

- **Task source:** work comes from `tasks.md`, one task per run. Only pick tasks that have a clear "Done when". Skip vague ones and add a note under them saying why.
- **Isolation:** each task gets its own branch `agent/<task-slug>`, ideally in its own git worktree. Never commit to or push `main`.
- **Environment:** runs happen inside a Docker container / devcontainer with no production keys or deploy credentials. Never run `vercel deploy`, migrations against prod, or anything outward-facing other than pushing your branch and opening a draft PR.
- **Gate:** a task is done when `pnpm lint` and `pnpm typecheck` pass (plus `pnpm test` once a test script exists) and the task's "Done when" is met. Then commit, push the branch, and open a draft PR (`gh pr create --draft`) with a short summary of what changed and how it was verified. Check the task off in `tasks.md`.
- **Stuck rule:** after 3 failed attempts to pass the gate, stop. Write down why in the PR body (or under the task in `tasks.md` as `BLOCKED: <reason>`), commit anything useful, and move on. Don't loop.
- **Scope:** stay within the task. No drive-by refactors or unrelated changes.

Human-side setup (not for agents): protect `main` on GitHub so nothing merges without review, set a hard spend cap on the API key/plan, and keep secrets out of the container.
