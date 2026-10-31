# Task queue

Small, specific tasks for overnight agent runs. Rules for agents are in `AGENTS.md` ("Overnight / headless task runs") and `CLAUDE.md`.

Each task needs a clear "Done when". Leave out anything vague like "make it better".

Runner (inside the sandbox container):

```sh
claude -p "Do the next unchecked task in tasks.md following AGENTS.md" --max-turns 30
```

## Tasks

- [ ] Add a test runner and safety tests
      Runner done: `pnpm test` runs Vitest (`vitest.config.mts`). The safety `keywordCheck` tests are still to write.
      Done when: `pnpm test` runs Vitest; tests cover `keywordCheck` in `src/lib/ai/ask/safety-check.ts` (crisis, academic, sensitive, ok, and "option" is not sensitive) with AI disabled; lint + typecheck + test pass.

- [ ] Unit-test the fallback privacy scrub
      Done when: tests show the fallback in `src/lib/ai/ask/privacy-scrub.ts` removes emails, phone numbers, "I'm <Name>", dorm names, and room numbers, and leaves "i'm in need of help" unchanged; `pnpm test` passes.

- [ ] Unit-test postAsk guards
      Done when: tests show `postAsk` rejects sensitive text, rejects an unknown group, and returns an error on the 4th post to the same group in a day (mock adapter, no network); `pnpm test` passes.

- [ ] Show which details the safety check flagged
      Done when: for sensitive asks, the screen after the draft shows the reason string from `safetyCheck` above the offices list; lint + typecheck pass.

- [ ] Verify the helper's school email before a claim counts
      Done when: `/h/[token]` sends a Supabase magic link to the entered .edu email and the claim is only saved after the link is clicked; the "✅ Covered" follow-up posts only after verification; lint + typecheck pass.

- [ ] Add a Discord adapter
      Done when: `src/lib/groups/discord.ts` posts via a Discord webhook from `DISCORD_WEBHOOK_URL`, falls back to the mock adapter when unset, is registered in `src/lib/groups/index.ts`, and one mock Discord group exists in `mock-data.ts`; `.env.example` documents the var; lint + typecheck pass.

- [ ] Copy / share-sheet fallback for groups without the bot
      Done when: the Share preview has "Copy" (clipboard + toast) and, where `navigator.share` exists, "Share…" buttons that hand over the exact preview text; nothing is sent by Ask; works for every group, bot or not; lint + typecheck pass.

- [ ] Remember the user's first name between asks
      Done when: the name typed on `/share` is saved to localStorage (wrapped in try/catch) and pre-filled next time; it's never used when "Post anonymously" is selected; lint + typecheck pass.

- [ ] Replace polling on the Matched page
      Done when: `/matched/[token]` gets the claim through Supabase Realtime (or server-sent events) instead of `setInterval`, with polling kept as a fallback; lint + typecheck pass.

## New PRD: demo path (Giselle/Yvonne own these tonight; agents only if still unclaimed)

The PRD's demo path is board-first: Home → Clarify → Your ask with a price → public board → bot posts the same card to GroupMe → claim in the browser → "Already taken" + "Covered" → Matched → mocked "Pay $15" → Thank you. No Stripe API, no Google API. Do these in order.

- [x] Seed 15–20 fictional helpers with free/busy and payment eligibility
      Done when: `HELPERS` in `src/lib/ask/mock-data.ts` has 15–20 fictional Northfield helpers, each with `interests` (from: rides, moving stuff, US paperwork, cooking, language practice, course advice, been through OPT), seeded `busy` time ranges (free/busy only, no event titles), `weeklyLimit`, and `canAcceptPayment` (some false); the `Helper` type in `src/lib/ask/types.ts` has these fields; lint + typecheck pass.

- [x] Suggested price on Your ask
      Done (expanded): `draftAsk` now breaks a need into 1–4 `AskPart`s, each with minutes, helper preferences (with seeded fit counts) and a deterministic `PriceSuggestion`; see `docs/contract.md`.
      Done when: `draftAsk` also returns `minutes` and `suggestedPrice` (`{ min, max }` in whole dollars, from the time needed); `/draft` shows a price field pre-filled from it with a "$0 = favor" option; the price is stored in flow state; academic asks never show a price; lint + typecheck pass.

- [ ] Public board: one ask, one card
      Backend done (`src/server/actions/board.ts`, `src/lib/ask/board-store.ts`, tests): post, list, claim/hold, confirm, done, mocked pay, thanks, share, expiry, sign-in gating. Still needed: the `/board` landing UI and the privacy-scrub Undo on the post screen.
      Done when: posting from the flow (explicit tap) creates a board card in the store (ask, minutes, price, anonymous by default, run through `privacyScrub` with the removed list + Undo); `/board` lists open cards; the first "I can help" holds the card and everyone else sees "Already taken"; the asker confirms the helper (explicit tap); the server rejects crisis, sensitive and academic asks for the board; paid cards are hidden from helpers with `canAcceptPayment: false`; lint + typecheck pass.

- [ ] Postgres store for asks and claims, with atomic updates
      Done when: `asks` and `claims` tables exist in `src/db/schema/` (plus a group/day post counter) with a generated migration (do not run it against the shared DB; a human applies it); `src/lib/ask/store.ts` uses Drizzle when `DATABASE_URL` is set and the in-memory store otherwise; claim, confirm, pay and the rate limit are each one guarded `UPDATE … WHERE <expected state> RETURNING` (or `INSERT … ON CONFLICT … WHERE n < 3 RETURNING` for the counter), never read-then-write; two browsers see the same card state; lint + typecheck pass.
      Done (backend): tables in `src/db/schema/ask.ts`, migration `drizzle/0002_ask_tables.sql` (not applied to the shared DB; a human runs `pnpm db:migrate`, then sets `ASK_DB=postgres`). Local dev uses in-process PGlite with the same SQL. Every transition is a guarded UPDATE/INSERT … RETURNING.

- [ ] Save the card before posting its link
      Done when: `postAsk` in `src/server/actions/ask.ts` saves the card (status open) before calling `postToGroup`, and marks it failed/removed if the post fails, so a helper who taps the GroupMe link instantly never sees "expired"; a failed post gives back its rate-limit slot; lint + typecheck pass.

- [ ] Concurrency tests
      Done when: a test fires 10 parallel `claimAsk` calls on one card and exactly 1 succeeds, 9 get "Already taken", and exactly one "Covered" is posted (mock adapter); repeated confirm and pay calls are no-ops after the first; 4 parallel posts to one group yield exactly 3 successes; runs against the in-memory store, and against Postgres when `DATABASE_URL` is set; `pnpm test` passes. Depends on "Add a test runner and safety tests".
      Done against PGlite (`src/lib/ask/board-store.test.ts`, `src/server/actions/board.test.ts`): 10 parallel claims → 1, one confirm/pay/Covered, 4 parallel posts → 3. Not yet run against Supabase Postgres.

- [ ] Ask deadline and expiry
      Done when: every ask has `expiresAt` (from the drafted time, default 24 h); expired cards are hidden from `/board`, the claim page shows "This ask has expired", and the claim's atomic update includes `expires_at > now()`; lint + typecheck pass.
      Backend done: `expiresAt` on every ask (3 h / today / 24 h / 3 d or exact), expired asks leave the board, claims check `expires_at > now`, `extendCard` (Extend 24 h). The claim page's "This ask has expired" UI is still to do.

- [ ] Mocked school-email sign-up + helper setup on the claim page
      Backend done: `mockSignIn` / `getMe` / `mockSignOut` in `src/server/actions/session.ts`; `claimCard` takes the name and email from the session and checks the mocked setup for paid cards. Only the claim-page UI is left.
      Done when: `/h/[token]` first asks for first name + school (.edu) email (mocked sign-up, no verification; TODO(auth)); for a paid card it then shows a mocked helper setup ("I can accept payment" toggle + payout account field) and refuses to claim if they can't accept payment; free cards skip the setup; lint + typecheck pass.

- [ ] Email notifications (console only tonight)
      Done when: `src/lib/notify/` has a `notify(event, to, data)` interface with a console adapter (same adapter pattern as `src/lib/groups/`), called for exactly three events: matched ask → helper, ask claimed → asker, other side marked done → both (with a confirm link); only the request that won the state update sends; no message reveals an anonymous asker; lint + typecheck pass.

- [ ] Bot intro message
      Done when: a one-time action or script (`pnpm bot:intro <groupId>`) posts "I post asks from Ask. I can't read your messages. Remove me anytime." through `postToGroup`; it is never sent with regular posts; lint + typecheck pass.

- [ ] Bot shares the board card to GroupMe
      Done when: "Share to GroupMe" (explicit tap) calls `postToGroup` with the card's text and a link that opens that same card (reuse `/h/[token]` as the card page); claiming from the link and from `/board` hit the same hold, so a card can't be taken twice; the demo card is $15, so the link goes through the mocked sign-up and helper setup before claiming (free cards need only sign-up); after the asker confirms, the bot posts "Covered" without naming an anonymous asker; existing guards (safety re-check, rate limit) still apply; lint + typecheck pass.

- [ ] `matchHelpers` on seeded data replaces `suggestWhere`
      Lib done: `src/lib/ai/ask/match-helpers.ts` (+ tests): free/busy, weekly limit, payment and load rules, AI picks + no-key fallback, `[]` when nobody fits. Still needed: a server action wrapping it (after the Postgres store merges, so `activeMatches` comes from claims) and swapping it in for `suggestWhere`.
      Done when: `src/lib/ai/ask/match-helpers.ts` returns 2–3 helpers with a one-line why; excludes helpers busy at the ask's time (seeded free/busy; asks with no time skip this), at their weekly limit, or with `canAcceptPayment: false` when price > 0; prefers helpers with fewer active matches; returns an empty list (no throw) when nobody fits; has a no-key fallback; lint + typecheck pass.

- [ ] Matched, mocked "Pay $15", Thank you
      Done when: after the asker confirms a helper, Matched shows the helper's first name and a public meeting spot; for paid asks a "Pay $X" mock screen (explicit tap, no payment API, clearly labeled demo) marks the card paid; $0 asks skip it; Thank you still has the user write their own note; lint + typecheck pass.
      Backend done: `payToHold` (mocked hold after confirm, fee breakdown), helper `markHelperDone`, asker `markDone` (release) or 48 h auto-release, `reportProblem`, refund on cancel, `saveCardThanks`. UI still to do.

- [ ] Private inbox mock (told in the story, not demoed)
      Done when: from Your ask, "Ask privately" lists `matchHelpers` results; tapping "Ask {firstName}" (explicit tap) adds a request to that helper's mock inbox at `/inbox?helper=<id>` (no auth; TODO(auth)); the inbox shows text, minutes and price with "I can help" / "Not this time" (no reason field); no group post happens; lint + typecheck pass.
      Backend done: `createPrivateAsk`, `sendPrivately`, `listMyRequests`, `respondToRequest` (private.ts). UI still to do.

- [ ] Contact info only after both say yes
      Done when: neither side's contact details are returned by any read until the helper has said yes and the asker has confirmed; lint + typecheck pass.
      Backend: `PublicCard` never has emails or user ids; payment details only for the two parties; an anonymous asker shows as "The asker" in messages until they confirm.

## PRD gaps: small fixes (see `docs/PRD.md`)

- [x] Rename the safe safety category from `ok` to `none`
      Done when: `SafetyCategory` in `src/lib/ask/types.ts` uses `"none"` instead of `"ok"` (matching the PRD's AI functions table), every usage and the safetyCheck zod enum/prompt are updated, and `rg '"ok"' src/lib/ask src/lib/ai/ask src/server/actions/ask.ts "src/app/(flow)"` finds no safety-category uses; lint + typecheck pass.

- [ ] Add the extension-email option to the "write my essay" redirect
      Done when: `/resources?type=tutoring` shows a third option, "Ask your professor for an extension", with a short editable email template the user can copy (nothing is sent); tutoring and writing center options stay; an academic ask can never get a price or be matched; lint + typecheck pass.

## Later (not tonight)

- [ ] Real email via Gmail SMTP
      Done when: a Gmail adapter in `src/lib/notify/` (nodemailer over Gmail SMTP, `GMAIL_USER` + `GMAIL_APP_PASSWORD`) is used when both are set, the console adapter otherwise; `.env.example` documents both; lint + typecheck pass.

- [ ] (Human) Create a Gmail app password for Ask's sender address
      Done when: a Gmail account for Ask (ideally a new one, not personal) has 2-Step Verification on, an app password is created at https://myaccount.google.com/apppasswords, and `GMAIL_USER` + `GMAIL_APP_PASSWORD` are in `.env.local` and in Vercel's environment variables (never committed).

## Needs a human (agents: skip)

- [ ] Set up the test GroupMe group and bot (Sophia)
      Done when: a test GroupMe group exists with teammates in it, a bot is created for it with **no callback URL**, and its `GROUPME_BOT_ID` is in `.env.local` on the demo machine.

- [ ] Put the real campus counseling number on the crisis screen
      Done when: `CRISIS_RESOURCES` in `src/lib/ask/mock-data.ts` has the real counseling center name and number (confirmed by the team, see PRD open questions) alongside 988; lint + typecheck pass.
      Note for agents: needs the real number from the team, so don't guess one.
