# Stage: ideate

Find the most valuable small tasks an agent could finish tonight. You are in a read-only checkout of the base branch.

Read, in this order: `docs/PRD.md` (the demo path and the success checklist), `CLAUDE.md` (rules and "Built today"), `docs/demo-script.md` (what the video shows), `tasks.md` (what's queued or done), `docs/contract.md`, `e2e/demo-path.spec.ts`, then the code. Run `grep -rn "TODO(" src` for known gaps.

Good ideas:

- close a gap between the PRD's demo path or success checklist and what the code does, especially anything the video shows (`docs/demo-script.md`)
- make the demo path more robust (an untested branch of a flow screen, a missing error state on a step the demo uses)
- add tests for a CLAUDE.md rule that nothing tests yet
- are small (S = under an hour of agent work, M = a few hours), with a Done when that a test can prove

Not ideas: anything in "Not now" in CLAUDE.md (real auth, Stripe API, Google Calendar API, push, reading group messages), ratings or leaderboards, a redesign, a refactor with no user-visible effect, or duplicates of a task already in `tasks.md`.

Give each idea evidence (file:line, a missing test, a failing check in the baseline gate below) and quote the PRD or CLAUDE.md line it serves. Tag risks honestly: anything touching the safety check, crisis handling, payments, bot posts, sign-in, the DB schema or the privacy scrub gets that tag.

Return at most the number of ideas given below, best first.
