@AGENTS.md

# Ask

Mobile-first web app that helps college students (especially international students) ask for help. A student types a vague need; AI turns it into a clear, small ask and suggests who or where to ask. People do all the helping.

Full product spec: `docs/PRD.md` (loaded below). It wins on product questions; the code may lag behind it.

@docs/PRD.md

Hackathon demo: one ask, start to finish. No DB schema, no auth for the Ask flow yet; state is in memory.

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

`/` Home → `/clarify` (≤2 chip questions) → `/draft` (editable ask) → `/where` (helpers + partner groups) → `/share` (preview + "Post to group") → `/matched/[token]` → `/thanks`.
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
- Nothing is posted or sent without an explicit user tap. `postToGroup` is only called from `postAsk` (the "Post to group" button) and `claimAsk` (the "I can help" button).
- `safetyCheck` runs first. Crisis → professional resources only, never match or post. "Write my essay" → tutoring.
- Never offer group sharing for crisis or sensitive asks (visa, money, health). The server enforces this in `postAsk`, not just the UI.
- The model may only make a safety result _more_ restrictive than the keyword check.
- Anonymous posts go through `privacyScrub`; always show what was removed, with Undo.
- The bot is post-only: no GroupMe callback URL, nothing reads group messages.
- The "✅ Covered" follow-up never names the asker (or the helper).
- Rate limit: 3 posts per group per day (`src/lib/ask/store.ts`).
- No payments, no ratings, no leaderboards.
- Fictional names and campus only (Northfield University).
- To add a chat platform: add an adapter in `src/lib/groups/`, register it in `index.ts`, add the platform to `Platform` in `src/lib/ask/types.ts`.

## Not now (leave TODOs)

Database schema, auth, helper inbox, notifications, Slack interactive buttons. Search for `TODO(` to find the spots.
