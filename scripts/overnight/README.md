# Overnight pipeline

Runs agents unattended overnight. They come up with tasks, critique them, write a mini-PRD, design and analyze it, build it test-first, try to break it, review it and fix it. Each task ends as a draft PR with a report and a prompt to run it again. Agent rules are in `AGENTS.md` ("Overnight / headless task runs") and `CLAUDE.md`.

```
preflight: Docker, image, token, gh; copy skills; smoke test
baseline gate on dev (red: a "fix the base" task goes first)
IDEATE -> CRITIQUE (tonight's ideas + every open task in tasks.md)
for each task, until STOP_AT or the budget runs out:
  SPEC (mini-PRD) -> ARCHITECTURE -> ANALYSIS     (read-only; revise up to 2 rounds; reject ends it)
  IMPLEMENT (tests first)
  GATE + GUARDS -> BREAK-IT -> GATE -> REVIEW -> FIX ... (max 3 attempts)
  pass: one commit, check off tasks.md, push, draft PR (report + spec + design + analysis)
  stuck: WIP commit, "[blocked]" draft PR, next-prompt.md
notes PR: tasks.md SKIP/BLOCKED notes + proposed ideas that need a human
SUMMARY.md
```

**Who decides what.** The pipeline runs the gate (lint, typecheck, unit tests, e2e) and the guards itself. An agent saying "tests pass" counts for nothing. Each critic (critique, analysis, review) is a fresh agent that didn't write what it's judging.

## One-time setup (human)

```bash
claude setup-token                              # then, in your shell (not .env.local):
export CLAUDE_CODE_OAUTH_TOKEN=...
gh auth status                                  # for pushing branches and draft PRs
pnpm overnight:image                            # builds the ask-overnight Docker image
```

Docker Desktop needs about 8 GB of memory. The gate caps Vitest at 3 workers (`GATE_TEST_WORKERS`), because each worker starts its own PGlite database.

## Commands

```bash
pnpm overnight --dry-run                        # the queue and skip reasons; no agents, no Docker
pnpm overnight --ideate-only --no-push          # ideas + critique only (cheap); writes SUMMARY.md
pnpm overnight --task <slug> --design-only      # spec + architecture + analysis, no code
pnpm overnight --task <slug>                    # one task, all stages
pnpm overnight                                  # the whole night
pnpm overnight --resume <slug>                  # continue a stuck task with its saved next prompt
```

Flags: `--once` (one task, then stop), `--no-ideate`, `--no-push` (branches stay local), `--polish` (a `simplify` pass after review, rolled back if it breaks the gate), `--skip-baseline`, `--no-smoke`.

Environment (all optional): `BASE` (dev), `MAX_COST_USD` (40, the whole night), `TASK_BUDGET_USD` (12), `STOP_AT` (07:30, no new task starts after it), `MAX_ATTEMPTS` (3), `MAX_DESIGN_ROUNDS` (2), `MAX_IDEAS` (6), `MAX_IDEA_TASKS` (3), `MIN_IDEA_SCORE` (7), `MAX_DIFF_LINES` (600), `MODEL`, `GATE_TEST_WORKERS` (3). Every agent call also gets `--max-turns` and `--max-budget-usd` (see `STAGES` in `lib/config.ts`).

## What runs tonight vs. what waits

- **Existing tasks** in `tasks.md` run when they have a "Done when", aren't checked, aren't marked `BLOCKED:`/`SKIP:`, aren't in "Later" / "Needs a human" / "Proposed", and have no `agent/<slug>` branch yet. The critic can still drop one as stale, rejected or needs-human; the notes PR then adds a `SKIP:` note under it.
- **New ideas** run tonight only if the critic accepts them with a score of 7 or more, they're size S or M, and they carry no risk tag in safety, crisis, payments, bot-posting, auth, schema or privacy (`RISKY_TAGS` in `lib/rules.ts`). At most 3 per night. The rest go to a "Proposed by overnight run" section via the notes PR, and a human moves them into the queue.

## Guards (deterministic, in `lib/guards.ts`)

A task fails the guards on any of these: an added `.skip`/`.only`/`.fixme`/`.todo`, a deleted test file, fewer test declarations than the base, an `.env*` change, an edit to an existing migration, a new emoji, or a diff over `MAX_DIFF_LINES`. Touching `PROTECTED_PATHS` (safety check, bot adapters, the card store, sign-in, schema) doesn't fail, but the PR is marked "Needs human eyes".

## Sandbox

The host-side orchestrator (`run.mts`) owns git, `gh` and the budget. Every agent stage and every gate run is a `docker run` of `ask-overnight` with:

- the task's worktree mounted at its host path, read-only for the read-only stages (ideate, critique, spec, architecture, analysis, review)
- the repo's `.git` read-only, with only this worktree's admin folder writable, so agents can't touch the main checkout or other worktrees
- a `node_modules` volume per worktree (Linux binaries) and a shared pnpm store volume
- a throwaway `HOME` with only the copied skills mounted read-only
- only the Claude token as a secret; app keys are blanked, so tests use the mock bot and the canned AI fallbacks, and the gate container gets no Claude token at all
- write stages run with `--dangerously-skip-permissions` (it's a container), with `git push/commit/reset/stash/checkout`, `gh`, `vercel`, `pnpm db:*` and `pnpm bot:*` disallowed

## Skills

`lib/skills.ts` maps each stage to skills and copies them from the host's `~/.claude` (personal skills, synced plugins, the plugin cache; never `.trash`). Built-ins (`code-review`, `security-review`, `simplify`, `claude-api`) ship with the CLI.

| Stage        | Skills                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| ideate       | intended-vs-implemented, brainstorm-ideas-existing, prioritize-features                   |
| critique     | strategy-red-team, pre-mortem                                                             |
| spec         | prd-writing                                                                               |
| architecture | architecture-design, nextjs, database-designer (data changes), /derive-tests              |
| analysis     | strategy-red-team, pre-mortem, intended-vs-implemented                                    |
| implement    | nextjs; frontend-design (screens), claude-api (AI steps), database-designer (data)        |
| break-it     | test-scenarios                                                                            |
| review       | code-review; security-review and /security-audit-static (server actions, card store, bot) |
| polish       | simplify                                                                                  |

The smoke test reads the CLI's `init` event to see which skills actually loaded. A missing skill is noted in the prompt ("do it by hand") and in `SUMMARY.md`; it never stops the night.

## Output

`.overnight/<run-id>/` (git-ignored):

- `SUMMARY.md`: every task with status, cost, PR and a resume command; the ideas with critic verdicts; the existing tasks as the critic saw them; skills
- `<slug>/report.md` (also the PR body), `spec.md`, `design.md`, `analysis.json`, `review.json`, `next-prompt.md`, `state.json`
- `<slug>/*.prompt.md`, `*.json`, `*.gate.log`, `*.diff`: every stage's exact prompt and raw output, for debugging a stage

Clean up after merging: `git worktree remove .claude/worktrees/agent-<slug>` and `docker volume rm ask-overnight-nm-agent-<slug>`.

## Known limits

- Tasks run one at a time; the containers would allow two in parallel, but that isn't built.
- Local PGlite only. The gate never touches Supabase, so the "against Postgres" parts of a task can't be verified overnight.
