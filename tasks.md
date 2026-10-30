# Task queue

Small, specific tasks for overnight agent runs. Rules for agents are in `AGENTS.md` ("Overnight / headless task runs") and `CLAUDE.md`.

Each task needs a clear "Done when". Leave out anything vague like "make it better".

Runner (inside the sandbox container):

```sh
claude -p "Do the next unchecked task in tasks.md following AGENTS.md" --max-turns 30
```

## Tasks

- [ ] Add a test runner and safety tests
      Done when: `pnpm test` runs Vitest; tests cover `keywordCheck` in `src/lib/ai/ask/safety-check.ts` (crisis, academic, sensitive, ok, and "option" is not sensitive) with AI disabled; lint + typecheck + test pass.

- [ ] Unit-test the fallback privacy scrub
      Done when: tests show the fallback in `src/lib/ai/ask/privacy-scrub.ts` removes emails, phone numbers, "I'm <Name>", dorm names, and room numbers, and leaves "i'm in need of help" unchanged; `pnpm test` passes.

- [ ] Unit-test postAsk guards
      Done when: tests show `postAsk` rejects sensitive text, rejects an unknown group, and returns an error on the 4th post to the same group in a day (mock adapter, no network); `pnpm test` passes.

- [ ] Persist posts in Postgres
      Done when: a `posts` table (token, group_id, text, anonymous, created_at, claim fields, thanks) exists in `src/db/schema/` with a generated migration; `src/lib/ask/store.ts` reads/writes it via Drizzle; the flow still works end to end locally; lint + typecheck pass. Do not run migrations against the shared DB.

- [ ] Back the rate limit with the database
      Done when: `takeRateLimit` counts today's rows in `posts` for the group instead of the in-memory map; limit stays 3/group/day; lint + typecheck pass. Depends on "Persist posts in Postgres".

- [ ] Show which details the safety check flagged
      Done when: for sensitive asks, `/where` shows the reason string from `safetyCheck` above the offices list; lint + typecheck pass.

- [ ] Verify the helper's school email before a claim counts
      Done when: `/h/[token]` sends a Supabase magic link to the entered .edu email and the claim is only saved after the link is clicked; the "✅ Covered" follow-up posts only after verification; lint + typecheck pass.

- [ ] Add a Discord adapter
      Done when: `src/lib/groups/discord.ts` posts via a Discord webhook from `DISCORD_WEBHOOK_URL`, falls back to the mock adapter when unset, is registered in `src/lib/groups/index.ts`, and one mock Discord group exists in `mock-data.ts`; `.env.example` documents the var; lint + typecheck pass.

- [ ] Let the user copy the ask for a direct message
      Done when: each helper card on `/where` has a "Copy ask" button that copies the drafted ask to the clipboard and shows a toast; nothing is sent; lint + typecheck pass.

- [ ] Remember the user's first name between asks
      Done when: the name typed on `/share` is saved to localStorage (wrapped in try/catch) and pre-filled next time; it's never used when "Post anonymously" is selected; lint + typecheck pass.

- [ ] Replace polling on the Matched page
      Done when: `/matched/[token]` gets the claim through Supabase Realtime (or server-sent events) instead of `setInterval`, with polling kept as a fallback; lint + typecheck pass.

## PRD gaps (see `docs/PRD.md`)

- [ ] Rename the safe safety category from `ok` to `none`
      Done when: `SafetyCategory` in `src/lib/ask/types.ts` uses `"none"` instead of `"ok"` (matching the PRD's AI functions table), every usage and the safetyCheck zod enum/prompt are updated, and `rg '"ok"' src/lib/ask src/lib/ai/ask src/server/actions/ask.ts "src/app/(flow)"` finds no safety-category uses; lint + typecheck pass.

- [ ] Add the extension-email option to the "write my essay" redirect
      Done when: `/resources?type=tutoring` shows a third option, "Ask your professor for an extension", with a short editable email template the user can copy (nothing is sent); tutoring and writing center options stay; lint + typecheck pass.

- [ ] Private match route: ask one helper directly
      Done when: each helper card on `/where` has an "Ask {firstName}" button that goes to a private preview (exact message, no group), and on an explicit tap creates a post with no `groupId` in the store and goes to `/matched/[token]`; the "coming soon" note is removed; sensitive asks can use this route but still never get group chats; `postToGroup` is never called for private asks; lint + typecheck pass.

- [ ] Asker accepts before helper contact info is shared
      Done when: a claim on `/h/[token]` is saved as pending; `/matched/[token]` shows "{firstName} offered to help" with Accept / Not this time; the helper's email and the meeting spot appear only after Accept; the "Covered" follow-up posts only after Accept; `getPostStatus` never returns the helper email before acceptance; lint + typecheck pass.

## Needs a human (agents: skip)

- [ ] Put the real campus counseling number on the crisis screen
      Done when: `CRISIS_RESOURCES` in `src/lib/ask/mock-data.ts` has the real counseling center name and number (confirmed by the team, see PRD open questions) alongside 988; lint + typecheck pass.
      Note for agents: needs the real number from the team, so don't guess one.
