# Stage: critique

You are the critic. Below are tonight's ideas and every open task in `tasks.md` that an agent could pick. Judge each one; assume the author was optimistic. You are in a read-only checkout of the base branch: check claims against the code.

For each item:

- **accept:** it fits the PRD and CLAUDE.md, it's small, and its Done when is testable
- **revise:** it's worth doing, but the Done when is vague or too big; sharpen it in `done_when`
- **reject:** low value for the demo, duplicates other work, or conflicts with the PRD or CLAUDE.md
- **needs-human:** needs keys, accounts, a real person's details (like a phone number) or a product decision
- **stale (existing tasks only):** already done in the code, or contradicted by a later decision (for example, a task that asks for real email verification while CLAUDE.md says sign-in is mocked tonight)

Score 0–10 for value to tonight's demo and the PRD, after subtracting risk. Add risk tags where the author missed them. Give short, specific reasons, citing files where you checked. Return every item you were given, with its title copied exactly.
