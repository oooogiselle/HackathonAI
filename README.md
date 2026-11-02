<p align="center">
  <img src="public/dartask-logo.png" alt="DartAsk logo" width="96" />
</p>

<h1 align="center">DartAsk</h1>

<p align="center">
  A mobile web app that helps Dartmouth students, starting with international students, ask for help.<br />
  <em>AI can make asking easier. Only people can help.</em>
</p>

<p align="center">
  <img src="docs/screenshot.png" alt="DartAsk needs board on a phone: open asks for cooking help, moving boxes and a winter coat" width="300" />
</p>

---

## Why

Most students would happily help a classmate. Asking is the hard part, especially when you are new, far from home and have no car, no family nearby and no idea who to ask. Today's workaround is the group chat, and it makes asking harder: you post to hundreds of people at once, each community has its own chat, an unanswered message is buried in twenty minutes, and the same questions come back every term.

DartAsk was built for the hackathon theme "AI at 70: What must remain human?". Our answer: AI lowers the barrier to asking, and the helping stays human. The AI turns a vague, awkward need into a clear, small ask with a fair price. It never does the helping, and it never sends anything without a tap.

## How an ask works

1. **Board.** `/` is the needs board: open asks from other students. Anyone can browse it. Signed in, asks that match what you like helping with (set on Me) come first under "For you", and paid asks are hidden from anyone who can't accept payment.
2. **Post a need.** The round Ask button in the tab bar opens a plain form at `/ask`: what you need, details, pay (Fund with a price, Trade or Free; $0 makes it a favor), when, where, how long, and who to ask. AI suggestions appear only when you tap "Get suggestions", and nothing they suggest is applied without another tap. Or tap "Let AI help": type the messy version (`/describe`), answer at most two quick questions (`/clarify`), and AI breaks it into up to four small, editable asks, each with a suggested price, that you send one at a time (`/draft`).
3. **Quick check.** Both paths land on `/check`, which runs the safety check again on the final wording. Crisis messages go to `/resources?type=crisis` and graded schoolwork to `/resources?type=tutoring`; neither is ever posted or matched. Personal topics stay private automatically. For a common need, "You're not the only one" shows a tip from a past helper.
4. **Where it goes.** On `/where` the asker picks the needs board, a GroupMe group, or a few matched helpers privately (`/private`), and when the ask comes down. Every ask is anonymous, and the privacy check shows what it removed, with Undo. "Preview" opens `/share`, which shows exactly what the bot will post to the chosen group. Nothing goes out until "Post to the board" (or "Post to the board and <group>") on `/where`. Then the DartAsk bot posts the same card to GroupMe, and the asker lands on the task page.
5. **Claim.** A helper opens the card (`/h/<token>`) from the board or the GroupMe link, signs in and taps "Claim this task". For a paid ask, a mocked helper setup comes first: "I can accept payment" plus a payout account. Everyone else now sees "Already taken", on the board and from the group link alike. While an ask waits, the asker can extend it by 24 hours, copy a share link for any group chat, or cancel it.
6. **Confirm and pay to hold.** The asker taps "Confirm <alias>", and the bot posts "Covered, thanks to whoever helped!" to the group, naming no one. That opens a message thread between the two (`/h/<token>/messages`), and the task page shows a public place to meet. The asker taps "Pay $17.28 and hold": the $15 ask plus a 10% platform fee and card processing (`src/lib/ask/fees.ts`), mocked.
7. **Done and thanks.** The helper taps Done, and the asker taps "Confirm done" (or "Report a problem"). The payment is released, and "Write a thank-you" lets the asker thank the helper in their own words, with no AI. If the asker never responds, payment auto-releases 48 hours after Done unless they report a problem; cancelling before Done refunds.

Private asks land in the picked helpers' Inbox, where they answer "I can help" or "Not this time" (no reason asked). Personal topics (visa, money, health) can only take this route.

## On a phone and on a laptop

DartAsk is a phone app first.

- **On a phone:** open the deployed link and add it to your home screen (iPhone: Safari Share menu, then Add to Home Screen; Android: the "Add to home screen" button on the Me tab). It then opens full screen from its own icon, like an app. On an iPhone, sign in once inside the home-screen app; it keeps its own login, separate from Safari. A `localhost` link can't be installed; use the Vercel URL.
- **On a laptop:** you see the same phone layout in a centered column, so the app looks the same everywhere.
- **Wider layout (built, switched off):** a tablet/laptop layout with the tabs along the top and a grid of cards is in the code. To turn it on, set `LAYOUT = "wide"` in `src/lib/ask/layout.ts`.
- **Moving between screens:** the ask flow slides forward and back, other screens crossfade, and tab screens show a loading placeholder right away. With the device's "Reduce motion" setting on, only the fades remain.

## Guardrails

These are product rules, enforced on the server, not just in the UI.

- **Safety first.** Every ask is checked before anything else. Crisis-type messages get professional resources only (988 and campus counseling) and are never matched or posted. "Write my essay" goes to tutoring and the writing center, never to a paid or public ask. Visa, money and health asks can't go to the board or a group. The model can only make a safety result stricter than the keyword check, never looser.
- **Nothing happens without a tap.** Nothing is sent, posted, paid or added to a calendar on its own.
- **Fully anonymous.** Students only ever see each other's alias (for example "Steady Loon 42"), never a name, email or phone, even after a match. Askers show as "A classmate" on cards.
- **Post-only bot.** The GroupMe bot has no callback URL, so it never receives or reads group messages. When it joins a group, someone runs `pnpm bot:intro` once to post its intro. It posts at most 3 asks per group per day.
- **Scam guard.** Messages that suggest paying outside DartAsk or ask for an ID number get a warning for the sender and a note for the receiver.
- **Visa-aware payments.** Helpers say whether they can accept payment; paid asks never reach those who can't (many F-1 students). Favors go to everyone.
- **No overload.** Helpers set a weekly limit and matching spreads the load.
- **No scores.** No ratings, streaks or leaderboards. The thank-you note is the only feedback.

## What's real and what's mocked

| Part      | Tonight                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI steps  | Real with `ANTHROPIC_API_KEY`; each step falls back to a canned answer (`src/lib/ai/ask/fallback.ts`) when there is no key, the call fails, or it takes over 12 s |
| Group bot | Posts to the real GroupMe with `GROUPME_BOT_ID` (Slack with `SLACK_WEBHOOK_URL`); otherwise logged as `[mock:<platform>]`                                         |
| Database  | Postgres. Locally an in-process PGlite database, migrated and seeded on first use, reset on restart; `ASK_DB=postgres` uses the shared Supabase database          |
| Sign-in   | Mocked "Sign in with Dartmouth": first name plus an `@dartmouth.edu` email, no verification                                                                       |
| Payments  | The hold-and-release flow is modeled end to end; no Stripe API and no payment keys                                                                                |
| Calendar  | Free/busy only. Helpers' free/busy is seeded; the asker's "connect calendar" on Me is a mock kept in that browser. No Google API or OAuth                         |
| Email     | The three notification events go through one `notify()` interface and are logged to the console                                                                   |
| People    | Real campus, fictional people. Seeded helpers and groups live in `src/lib/ask/mock-data.ts`                                                                       |

## Run it locally

Requires Node 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # every key is optional for the demo
pnpm dev                     # http://localhost:3000
```

With an empty `.env.local` the whole demo path works: AI uses the fallbacks, bot posts go to the console, and data lives in a local database that resets when the server restarts.

| Variable                                               | What it does                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                    | Turns on the real AI steps                                                              |
| `ANTHROPIC_MODEL`                                      | Model for the AI steps (default `claude-sonnet-5-5`)                                    |
| `GROUPME_BOT_ID`                                       | The bot posts to the real GroupMe                                                       |
| `SLACK_WEBHOOK_URL`                                    | The bot posts to a real Slack channel                                                   |
| `ASK_DB=postgres`                                      | Use the shared Supabase database instead of local PGlite (needs `DATABASE_URL`)         |
| `NEXT_PUBLIC_SITE_URL`                                 | Base URL for links in bot posts (`http://localhost:3000` locally)                       |
| `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*` | Shared database and the original starter's Supabase auth; not needed for the local demo |

> **Heads up:** if `.env.local` has `GROUPME_BOT_ID`, sharing an ask to a group from your local app (and `pnpm bot:intro`) posts to the real GroupMe. Blank it when you're just testing.

**Demo tip:** use two browsers (or a normal and a private window) so the asker and helper have different sign-ins. Post from one, then open the card on the board in the other and tap "Claim this task".

## Scripts

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                 | Dev server on port 3000                                             |
| `pnpm build` / `start`     | Production build / serve it                                         |
| `pnpm lint`                | ESLint                                                              |
| `pnpm typecheck`           | Generates Next route types, then `tsc --noEmit`                     |
| `pnpm test`                | Unit and server-action tests (Vitest)                               |
| `pnpm test:e2e`            | Playwright run of the demo path on two simulated phones             |
| `pnpm format`              | Prettier                                                            |
| `pnpm db:generate`         | Generate a SQL migration from `src/db/schema`                       |
| `pnpm db:migrate`          | Apply pending migrations to the shared database (uses `DIRECT_URL`) |
| `pnpm db:studio`           | Drizzle Studio                                                      |
| `pnpm bot:intro <groupId>` | Post the bot's one-time intro to a group                            |

## Testing

Before committing: `pnpm lint && pnpm typecheck && pnpm test`. Unit tests sit next to the code they test (`*.test.ts`).

`pnpm test:e2e` walks the demo path in a real browser (`e2e/demo-path.spec.ts`): board -> form -> Quick check -> Where -> group preview -> post -> a second phone signs in and claims -> a third sees "Already taken" -> confirm, the message thread and its scam warning, pay to hold, Done, confirm done, thank-you, plus the essay and crisis redirects. `e2e/tabs.spec.ts` covers the tabs when signed out, the next step on Claimed and Inbox, Me autosave and the payout hint, interest-first ordering on the board, the private route for personal topics, and tap-to-call on the crisis screen. `e2e/responsive.spec.ts` checks the laptop view (the centered phone column) and the home-screen manifest and icons. The run starts its own dev server on port 3100 (build folder `.next-e2e`) with the AI and bot keys blanked and `ASK_DB` unset, so it runs next to `pnpm dev`, never posts to the real GroupMe and never touches the shared database. First time on a machine: `pnpm exec playwright install chromium`.

## Project layout

```
src/app/(flow)/          the asker flow: board (/, in (board)/), ask, describe/clarify/draft, check, where, share,
                         thanks, resources (crisis and tutoring redirects), plus the Claimed, Inbox and Me tabs
src/app/h/[token]/       the task page: one card, buttons by viewer; messages/ is the asker-helper thread
src/app/signin/          mocked "Sign in with Dartmouth"
src/components/ask/      flow state and small UI pieces
src/lib/ai/ask/          one small AI function per step (safety, clarify, draft, match, privacy scrub, ...)
src/lib/ask/             types, seed data, the board store, aliases, fees, scam check
src/lib/groups/          postToGroup() with one adapter per platform (GroupMe, Slack, mock)
src/lib/notify/          notify() for the three email events (console adapter)
src/server/actions/      the backend: server actions for the ask flow, board, private asks, inbox, session
src/db/schema/ask.ts     the DartAsk tables
drizzle/                 SQL migrations
e2e/                     Playwright specs
scripts/bot-intro.mts    the bot's one-time intro post
```

Screens talk to the backend only through server actions; `docs/contract.md` lists every one with its input, output and status. `src/app/app`, `/login`, items, chat and RAG are left over from the original starter and are not part of DartAsk.

## Shared database

Locally, each dev server has its own database. For a real demo on two phones, or on Vercel, everyone needs to see the same card, so set `ASK_DB=postgres` to use the shared Supabase database.

- Migrations live in `drizzle/`. Change `src/db/schema` -> `pnpm db:generate` -> commit the new file -> a human runs `pnpm db:migrate`. Everyone shares one database, so coordinate: one person applies, the others pull.
- The app connects through the transaction pooler (`DATABASE_URL`, port 6543); drizzle-kit uses the session pooler (`DIRECT_URL`, port 5432).
- Drizzle connects as the `postgres` role and bypasses row-level security, so authorization lives in the server actions, which check sign-in and ownership on every call.
- Every state change on asks, claims and payments is an atomic guarded `UPDATE ... RETURNING`, so a card can't be claimed twice and "Covered" is posted exactly once. Local PGlite is only correct on a single server process.

## Deploy

On Vercel, add the variables from `.env.example` except `DIRECT_URL`, and set:

- `ASK_DB=postgres`: required, since Vercel runs many instances and PGlite lives in one process
- `NEXT_PUBLIC_SITE_URL` to the production URL, so links in bot posts open the deployed card
- `GROUPME_BOT_ID` for the real bot

Migrations don't run on deploy; apply them first with `pnpm db:migrate`.

## Not built yet

Real sign-in and school-email verification, Stripe Connect payouts, the Google Calendar API, a cron job for the 48-hour auto-release (it runs when a card or inbox is read for now), push notifications, an iOS app and Slack interactive buttons. Search the code for `TODO(` to find each spot.

## Docs

- [`docs/PRD.md`](docs/PRD.md): the product spec; it wins on product questions
- [`docs/contract.md`](docs/contract.md): every server action the screens call
- [`docs/demo-script.md`](docs/demo-script.md): the 2-3 minute demo video script
- [`tasks.md`](tasks.md): the task queue for overnight agent runs
- [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md): rules for coding agents working in this repo

## Dev notes

- This is Next.js 16 (App Router) with TypeScript, Tailwind, shadcn/ui, Drizzle and AI SDK 7. APIs differ from older versions, so check the bundled docs in `node_modules/next/dist/docs/` and `node_modules/ai/docs/`. For example, AI SDK 7 renamed `system` to `instructions`.
- `cacheComponents` is off in `next.config.ts`, so pages can read the session anywhere without extra `<Suspense>` boundaries.

## Team

Built in one night (Oct 30-31, 2026) by Giselle (backend), Yvonne (frontend) and Sophia (story, user testing and the demo video).
