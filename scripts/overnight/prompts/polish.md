# Stage: polish

The task below passed review. Simplify the staged diff (`git diff --cached <base>`) without changing behavior: remove duplication, reuse existing helpers, and match the surrounding style. Don't touch tests except to dedupe them, and don't add features. Run `pnpm lint`, `pnpm typecheck` and `pnpm test` afterwards. If nothing is worth changing, change nothing.
