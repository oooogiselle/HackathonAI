@AGENTS.md

# Ask

Mobile-first web app that helps college students (especially international students) ask for help. A student types a vague need; AI turns it into a clear, small ask with a suggested price. The asker sends it privately to 2–3 matched helpers who are free then, or posts it anonymously to the public board; the bot can share that same board card to GroupMe. A helper says "I can help"; the asker confirms, they meet, and the asker pays (a mocked "Pay $15" screen tonight) and writes a thank-you. People do all the helping.

Full product spec: `docs/PRD.md` (loaded below). It wins on product questions.

**Heads up:** the code on `dev` implements an earlier group-first flow (bot post → claim link → "Covered"; no board, price, matching or mocked pay). Much of it carries over to the PRD's demo path. `tasks.md` "New PRD: demo path" lists the gap.

@docs/PRD.md

Hackathon demo: one ask, start to finish. No auth yet. Asks and claims move to a small Postgres store (the existing Drizzle + Supabase setup in `src/db/`) so two phones see the same card; until that lands, state is in memory. Payments, calendar and school-email sign-up are mocked.

## Run

```bash
pnpm install
cp .env.example .env.local   # every key is optional for the Ask demo
pnpm dev                     # http://localhost:3000
```

- No `ANTHROPIC_API_KEY` → every AI step uses a canned fallback (`src/lib/ai/ask/fallback.ts`).
- No `GROUPME_BOT_ID` / `SLACK_WEBHOOK_URL` → posts are logged to the server console as `[mock:<platform>]`.
- `ANTHROPIC_MODEL` picks the model for the Ask steps (default `claude-sonnet-5-5`).
- Gate before committing: `pnpm lint` and `pnpm typecheck`.
- Demo tip: after posting, the Matched page links to the helper's claim page (`/h/<token>`). Open it in another tab to claim.
- In-memory data resets when the dev server restarts.

## Flow

**Target demo path (PRD):** Home → Clarify (≤2 chip questions) → Your ask (editable, with price; $0 = favor) → public board (anonymous, privacy-checked) → bot shares the same card to GroupMe → helper claims in the browser → board shows "Already taken", bot posts "Covered" → Matched (public meeting spot) → mocked "Pay $15" → Thank you. Private route (matched helpers → mock inbox) ships as a simple mock and is told, not demoed. Matching uses seeded free/busy and payment eligibility.

**Built today:** `/` Home → `/clarify` → `/draft` → `/where` (helpers + partner groups) → `/share` (preview + "Post to group") → `/matched/[token]` → `/thanks`.
Side routes: `/resources?type=crisis|tutoring` (safety redirects), `/h/[token]` (public claim page for helpers).

## Folder map (Ask code)

```
src/app/(flow)/            the 7 flow pages + resources; layout wraps <AskFlowProvider>
src/app/h/[token]/         public claim page ("I can help": first name + school email)
src/components/ask/        flow-provider (client state, sessionStorage) + small UI pieces
src/lib/ai/ask/            one small AI function per step: safety-check, clarify, draft-ask,
                           suggest-where, privacy-scrub; fallback.ts = no-key / error path
src/lib/ask/               types, mock-data (fictional campus/people/groups), store (in-memory),
                           format (exact posted message, shared by preview + server)
src/lib/groups/            postToGroup(group, text) + one adapter per platform (groupme, slack, mock)
src/server/actions/ask.ts  server actions; re-checks safety + rate limit before any post
```

The rest of the repo (`/app`, `/login`, items, chat, Supabase, Drizzle) is the original starter. Leave it alone unless a task says otherwise.

## Rules

- **Never commit to or push `main`.** Work on a branch; open a PR.
- Frontend ↔ backend contract = **server actions** in `src/server/actions/` (typed function calls). Don't add API routes for app screens; add a route handler only when something outside the app must call in (e.g. a future webhook). Server actions are public endpoints, so validate input with zod and re-check safety/limits inside each one.
- Nothing is posted or sent without an explicit user tap. `postToGroup` is only called from `postAsk` (the "Post to group" button) and `claimAsk` (the "I can help" button).
- `safetyCheck` runs first. Crisis → professional resources only, never match or post. "Write my essay" → tutoring, and never a paid or public ask.
- Never offer group sharing for crisis or sensitive asks (visa, money, health). The server enforces this in `postAsk`, not just the UI.
- The model may only make a safety result _more_ restrictive than the keyword check.
- Anonymous posts go through `privacyScrub`; always show what was removed, with Undo.
- The bot is post-only: no GroupMe callback URL, nothing reads group messages.
- The "✅ Covered" follow-up never names the asker (or the helper).
- Rate limit: 3 posts per group per day (`src/lib/ask/store.ts`).
- **Concurrency:** state changes on asks, claims, payments and counters are atomic check-and-set: a guarded `UPDATE … WHERE <expected state> RETURNING` in Postgres, or synchronous code with no `await` between check and set in the in-memory store. Side effects (bot posts, emails) run only for the request that won the update, so "Covered" is posted exactly once. Save state _before_ posting anything that links to it. The in-memory store is only correct on a single server process; any multi-instance deploy needs Postgres.
- Asks expire at their deadline: expired cards leave the board and can't be claimed (check expiry inside the same atomic claim).
- Email notifications go through one `notify()` interface and are sent with a real email service (decided Oct 30); when its API key isn't set they're console-logged so the demo never breaks. Only the three PRD events trigger them, and they never reveal an anonymous asker.
- The bot posts its intro ("I post asks from Ask. I can't read your messages. Remove me anytime.") once when added to a group, never on every post.
- Nothing is sent, posted, paid or added to a calendar without an explicit tap.
- Payments tonight: a mocked "Pay $X" screen only. **No Stripe API, no payment keys.** The PRD's Stripe Connect hold-and-release design (release when both confirm, 48 h auto-release, refund on cancel) is pitched, not built. Paid asks never reach helpers who can't accept payment; $0 asks (favors) go to everyone.
- One ask, one card: a board card and its GroupMe post are the same object; the first "I can help" holds it and everyone else sees "Already taken".
- Public board: posts are anonymous by default and go through `privacyScrub`; crisis, sensitive (visa, money, health) and academic asks can never be posted. Paid board asks show only to helpers who can accept payment.
- Calendar: free/busy only, never event titles or details. Tonight it's seeded in mock helpers; no Google API or OAuth.
- Matching respects each helper's weekly limit and spreads load. "Not this time" never asks for a reason.
- Contact info is shared only after both sides say yes.
- No ratings, streaks or leaderboards.
- Fictional names and campus only (Northfield University).
- To add a chat platform: add an adapter in `src/lib/groups/`, register it in `index.ts`, add the platform to `Platform` in `src/lib/ask/types.ts`.

## Not now (leave TODOs)

Real auth and real school-email verification (sign-up is mocked), push notifications, an iOS app, reading group messages, the Stripe API and Stripe Connect, the Google Calendar API and OAuth, Slack interactive buttons. Search for `TODO(` to find the spots.
