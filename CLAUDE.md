@AGENTS.md

# Ask

Mobile-first web app that helps college students (especially international students) ask for help. A student types a vague need; AI turns it into a clear, small ask with a suggested price. The asker sends it privately to 2–3 matched helpers who are free then, or posts it anonymously to the public board; the bot can share that same board card to GroupMe. A helper says "I can help"; the asker confirms, they meet, and the asker pays (a mocked "Pay $15" screen tonight) and writes a thank-you. People do all the helping.

Full product spec: `docs/PRD.md` (loaded below). It wins on product questions.

**Heads up:** the code on `dev` implements an earlier group-first flow (bot post → claim link → "Covered"; no board, price, matching or mocked pay). Much of it carries over to the PRD's demo path. `tasks.md` "New PRD: demo path" lists the gap.

@docs/PRD.md

Hackathon demo: one ask, start to finish. **Sign-in is mocked:** "Sign in with Dartmouth" is a mocked SSO step (first name + @dartmouth.edu email), no verification (`src/server/actions/session.ts`, TODO(auth)). Anyone can view the board and a card; posting, claiming and every asker step need the mock sign-in, checked inside each server action. Asks, claims, users, inbox, messages and mocked payments are in Postgres (`src/db/schema/ask.ts`). Locally that's an in-process PGlite database (migrated + seeded on first use, reset on restart); set `ASK_DB=postgres` to use the shared Supabase database so two phones and every Vercel instance see the same card (apply `drizzle/` migrations first; a human runs them). Payments, calendar and school-email sign-up are mocked.

## Run

```bash
pnpm install
cp .env.example .env.local   # every key is optional for the Ask demo
pnpm dev                     # http://localhost:3000
```

- No `ANTHROPIC_API_KEY` → every AI step uses a canned fallback (`src/lib/ai/ask/fallback.ts`).
- No `GROUPME_BOT_ID` / `SLACK_WEBHOOK_URL` → posts are logged to the server console as `[mock:<platform>]`.
- `ANTHROPIC_MODEL` picks the model for the Ask steps (default `claude-sonnet-5-5`).
- Gate before committing: `pnpm lint`, `pnpm typecheck` and `pnpm test` (Vitest).
- **After every prompt that changes code, run `pnpm test:e2e` before reporting done.** It's a Playwright test of the demo path (`e2e/demo-path.spec.ts`): the board at `/` → Ask for help → form at `/ask` → Where → Share (anonymous) → post to the board + a group → a second phone (own browser context) opens the card from the board, signs in with the mocked Dartmouth SSO and claims it → a third sees "Already taken" → asker confirms → pays $17.28 to hold (card via Stripe, mocked) → helper taps Done → asker confirms done → thank-you, plus the essay and crisis redirects. It starts its own dev server on :3100 (build folder `.next-e2e`) with bot and AI keys blanked and `ASK_DB` unset (local PGlite, never Supabase), so it runs next to `pnpm dev`, never posts to the real GroupMe, and uses the canned AI fallbacks. When you change a flow screen or add one (sign-in, board, Pay), update the spec in the same change. If it fails, fix it or report the failure output; don't say it works until it passes. First time on a machine: `pnpm exec playwright install chromium`.
- `pnpm bot:intro <groupId>` posts the bot intro once when it joins a group. It reads `.env.local`, so with `GROUPME_BOT_ID` set it posts to the real GroupMe.
- Demo tip: use two browsers (or a normal + private window) so asker and helper have different sign-ins. Post from one; open the card on the board (or the `/h/<token>` link from the GroupMe post) in the other and tap Claim.
- Local data (PGlite) resets when the dev server restarts. The old group-first actions (`postAsk` / `claimAsk` / `getPostStatus` / `saveThanks`) are deprecated and no screen calls them.

## Flow

**Target demo path (PRD):** Home (a form: title, details, when, deadline, where, time, who to ask, price; $0 = favor; AI suggestions only on a tap), or the optional AI path ("Let AI help": messy need → Clarify (≤2 chip questions) → Your ask, where AI breaks it into 1–4 small editable asks) → public board (anonymous, privacy-checked) → bot shares the same card to GroupMe → helper claims in the browser → board shows "Already taken", bot posts "Covered" → Matched (public meeting spot) → mocked "Pay $15" → Thank you. Private route (matched helpers → mock inbox) ships as a simple mock and is told, not demoed. Matching uses seeded free/busy and payment eligibility.

**Landing:** `/` is the needs board (open cards from `listBoard`, category chips), with a sticky "Ask for help" button that opens the form at `/ask`. Each card opens the task page `/h/[token]`.

**Built today:** `/ask` = the form ("Get suggestions" is opt-in AI) → `/check` (Quick check: safety on the final wording, plus "You're not the only one" when the ask is a common need: seeded count + a helper-written tip, `src/lib/ask/common-needs.ts`; AI only matches, never writes tips) → `/where` (helpers + partner groups) → `/share` (preview; "Post to the board" + optional group via the bot; sign-in required) → `/h/[token]` (task page) → `/thanks?token=`. Optional AI path: Home "Let AI help" → `/describe` (messy need) → `/clarify` → `/draft` (AI breaks the need into small asks) → `/where`.
Side routes: `/resources?type=crisis|tutoring` (safety redirects), `/h/[token]` (the task page: same card from the board or a GroupMe link; a screen per viewer and state), `/h/[token]/pay` (Pay to hold, Stripe only, mocked), `/h/[token]/messages` (asker and helper thread, open once both said yes), `/signin` (mocked "Sign in with Dartmouth"), `/matched/[token]` (redirects to `/h/[token]`).

## Folder map (Ask code)

```
src/app/(flow)/            flow pages (`/` = needs board, `/ask` = the form, describe/clarify/draft AI path, where, share, matched, thanks) + resources; layout wraps <AskFlowProvider>
src/app/h/[token]/         task page: one screen per viewer/state (asker-*, helper-*, closed) + pay/ (Pay to hold);
                           messages/ = the asker-helper thread once both said yes
src/components/task/       task screen parts: header, ticket, progress, expiry countdown
src/app/signin/            mocked "Sign in with Dartmouth" (@dartmouth.edu only), returns to ?next=
src/components/ask/        flow-provider (client state, sessionStorage) + small UI pieces
src/lib/ai/ask/            one small AI function per step: safety-check, clarify, draft-ask,
                           suggest-where, privacy-scrub; fallback.ts = no-key / error path
src/lib/ask/               types, mock-data (Dartmouth campus, fictional people/groups), store (old flow, in-memory),
                           format (exact posted message, shared by preview + server)
src/lib/groups/            postToGroup(group, text) + one adapter per platform (groupme, slack, mock)
src/lib/notify/            notify(event, to, data): emails for the 3 PRD events; console adapter only tonight
src/server/actions/ask.ts  server actions for the ask flow; re-checks safety + rate limit before any post
src/server/actions/board.ts board card lifecycle: listBoard, getCard, postToBoard, claimCard, confirmHelper,
                           payToHold, markHelperDone, markDone, reportProblem, saveCardThanks, shareCardToGroup, extendCard, cancelCard,
                           listMyCards, createPrivateAsk (sign-in + ownership checked)
src/server/actions/session.ts mocked sign-in (cookie → sessions table), profile, blocking
src/server/actions/private.ts private asks: sendPrivately, listMyRequests, respondToRequest
src/server/actions/inbox.ts  inbox notifications and per-ask messages
src/db/schema/ask.ts       Ask tables; src/lib/ask/db.ts picks PGlite (local) or Supabase (ASK_DB=postgres)
src/lib/ask/board-store.ts cards; every transition is a guarded UPDATE … RETURNING (+ inbox row) in one transaction
docs/contract.md           backend ↔ frontend contract: every server action, its input/output, status
```

The rest of the repo (`/app`, `/login`, items, chat, Supabase, Drizzle) is the original starter. Leave it alone unless a task says otherwise.

## Rules

- **Never commit to or push `main`.** Work on a branch; open a PR.
- Frontend ↔ backend contract = **server actions** in `src/server/actions/` (typed function calls). Don't add API routes for app screens; add a route handler only when something outside the app must call in (e.g. a future webhook). Server actions are public endpoints, so validate input with zod and re-check safety/limits inside each one.
- Nothing is posted or sent without an explicit user tap. `postToGroup` is only called from `shareCardToGroup` (the "Post" button on Share, when a group is picked) and `confirmHelper` ("Covered", once).
- `safetyCheck` runs first. Crisis → professional resources only, never match or post. "Write my essay" → tutoring, and never a paid or public ask.
- Never offer group sharing for crisis or sensitive asks (visa, money, health). The server enforces this in `postToBoard` / `shareCardToGroup`, not just the UI.
- The model may only make a safety result _more_ restrictive than the keyword check.
- Anonymous posts go through `privacyScrub`; always show what was removed, with Undo.
- The bot is post-only: no GroupMe callback URL, nothing reads group messages.
- The "✅ Covered" follow-up never names the asker (or the helper).
- Rate limit: 3 posts per group per day (`src/lib/ask/store.ts`).
- **Concurrency:** state changes on asks, claims, payments and counters are atomic check-and-set: a guarded `UPDATE … WHERE <expected state> RETURNING` (or an insert guarded by a primary key / `SELECT … FOR UPDATE`) in Postgres. Side effects (bot posts, emails) run only for the request that won the update, so "Covered" is posted exactly once. Save state _before_ posting anything that links to it. Local PGlite is only correct on a single server process; any multi-instance deploy needs `ASK_DB=postgres`.
- Asks expire at their deadline: expired cards leave the board and can't be claimed (check expiry inside the same atomic claim).
- Email notifications go through one `notify()` interface. **Tonight they are console-logged only** (decided Oct 30, per the PRD's "logged to the console" option); a Gmail SMTP adapter can be added later behind the same interface. Only the three PRD events trigger them, and they never reveal an anonymous asker.
- The bot posts its intro ("I post asks from Ask. I can't read your messages. Remove me anytime.") once when added to a group, never on every post.
- Nothing is sent, posted, paid or added to a calendar without an explicit tap.
- Payments tonight: mocked, **no Stripe API, no payment keys**, but the PRD's hold-and-release flow is modeled: the asker taps "Pay $X and hold" after confirming a helper (`payToHold`), the helper taps Done, the asker confirms to release it, or it auto-releases 48 h after the helper's Done unless the asker reports a problem; cancel before Done refunds. The auto-release runs when a card or inbox is read (no cron yet, TODO(cron)). Real Stripe Connect is pitched, not built. Paid asks never reach helpers who can't accept payment; $0 asks (favors) go to everyone.
- One ask, one card: a board card and its GroupMe post are the same object; the first "I can help" holds it and everyone else sees "Already taken".
- Public board: posts are anonymous by default and go through `privacyScrub`; crisis, sensitive (visa, money, health) and academic asks can never be posted. Paid board asks show only to helpers who can accept payment.
- Calendar: free/busy only, never event titles or details. Tonight it's seeded in mock helpers; no Google API or OAuth.
- Matching respects each helper's weekly limit and spreads load. "Not this time" never asks for a reason.
<<<<<<< HEAD
- Fully anonymous: students only ever see each other's alias (`aliasFor(userId)` in `src/lib/ask/alias.ts`, e.g. "Steady Loon 42"), never a name, initial, email or phone, even after a match. Askers show as "A classmate" on cards. Every ask is posted anonymously (`createCard` forces it), and a helper's blurb goes through `privacyScrub` on save. Your first name is only for you.
=======
- Contact info is shared only after both sides say yes.
- Scam guard on messages (`src/lib/ask/scam-check.ts`, `src/lib/ai/ask/message-check.ts`): paying outside Ask or an ID number gets a warning for the sender ("Send anyway" is a tap, never a silent block) and a note for the receiver. Keywords always run; the model can only add a flag. The flag is computed on the server and stored on the message.
>>>>>>> origin/dev
- No ratings, streaks or leaderboards. (The design's "Rate your helper" screen and trust points are out; the thank-you note stays.)
- Real campus (Dartmouth College); every person is fictional; no real student names or contact details. Crisis numbers are confirmed by the team, never guessed.
- To add a chat platform: add an adapter in `src/lib/groups/`, register it in `index.ts`, add the platform to `Platform` in `src/lib/ask/types.ts`.
- Do not use emojis

## Not now (leave TODOs)

Real auth and real school-email verification (sign-up is mocked), push notifications, an iOS app, reading group messages, the Stripe API and Stripe Connect, the Google Calendar API and OAuth, Slack interactive buttons. Search for `TODO(` to find the spots.
