# Ask: backend ↔ frontend contract

Screens call the backend through **server actions**: the ask flow is in `src/server/actions/ask.ts`; asks, the board and every step after posting are in `board.ts`; private asks in `private.ts`; inbox and messages in `inbox.ts`; sign-in, profile and blocking in `session.ts` (all under `src/server/actions/`). Data lives in Postgres (see "Storage" at the end). Import a function and `await` it like any other async function, with no `fetch` and no URLs. All shared types live in `src/lib/ask/types.ts`, and seed data in `src/lib/ask/mock-data.ts`.

Status: **✅ exists** means you can call it today. **🟡 planned** means the signature below is the promise, and you can mock it until it lands (see "Mocking" at the end).

## Who can call what

The landing page is the public board. **Anyone can view it**: `listBoard` and `getCard` need no account. **Posting and taking an ask need the mocked sign-in**: `mockSignIn({ firstName, email })` with a school `.edu` email, no verification. It sets a session cookie on that browser. An asker step (confirm, done, pay, thanks, share) works only for the person who posted the card. Every one of these is checked on the server.

- Signed out → `{ error: "Sign in to post or help." }`. Show the sign-in form (first name + school email), then retry.
- `getMe()` → `{ firstName, email } | null` tells you who's signed in on this browser; `mockSignOut()` clears it. All three are in `src/server/actions/session.ts`.
- `PublicCard.viewer` is `"asker"`, `"helper"`, `"invited"` (picked for a private ask), `"other"` or `"signed-out"`. Use it to pick the buttons: the asker sees Confirm / Done / Pay / Share, a signed-in `"other"` sees "I can help" on an open card, and `"signed-out"` sees "Sign in to help".

## Rules every screen follows

- Nothing is sent, posted, paid or added to a calendar without an explicit tap. Disable the button while its action is in flight.
- Every action that can fail returns `{ error: string }`. Show that string as-is; it's written for the user.
- Hide group sharing and the board unless the safety category is `"none"`. The server rejects it anyway.
- Anonymous posts: show `ScrubResult.removed` with an Undo.
- On "I can help", the server decides who wins. A loser gets `{ error: "Already taken" }`, so refresh the card.
- Never show a helper's email. `PublicCard` doesn't contain it.

## Asker flow

| Screen                   | Action                | Input                                                                                                                                              | Returns                                                                                                                                                                                                          | Status                     |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Home / Describe          | `checkSafety`         | `need: string`                                                                                                                                     | `SafetyResult` (`category`: `none` / `sensitive` / `academic` / `crisis`)                                                                                                                                        | ✅                         |
| Home / Describe          | (route)               |                                                                                                                                                    | `crisis` → `/resources?type=crisis`, `academic` → `/resources?type=tutoring`                                                                                                                                     | ✅                         |
| Clarify                  | `getClarifyQuestions` | `need: string`                                                                                                                                     | `ClarifyQuestion[]` (≤ 2, each with 2–4 chip options)                                                                                                                                                            | ✅                         |
| Your ask                 | `draftAsk`            | `need: string, answers: ClarifyAnswer[]`                                                                                                           | `DraftResult { parts: AskPart[] }`: 1–4 small asks, each with what/when/where, `minutes`, `helper: HelperPrefs`, `price: PriceSuggestion`, `priceSet`, `text`, `category`, `deadline`. Empty for academic/crisis | ✅                         |
| Home (form)              | `assistAsk`           | `{ what, details, when?, where?, minutes }`                                                                                                        | `{ suggestions: AssistSuggestions }` (`text`, `minutes`, `helper`, `missing[]`) or `{ redirect: "crisis" \| "tutoring" }`. Only on a tap; the form applies nothing without a "Use" tap                           | ✅                         |
| Your ask                 | `scrubForAnonymous`   | `ask: string`                                                                                                                                      | `ScrubResult` (`text`, `removed[]`)                                                                                                                                                                              | ✅                         |
| Your ask → board         | `postToBoard`         | `{ title, text, category?, payType?, minutes, price, anonymous?, startsAt?, neededBy?, expiresIn?: "3h" \| "today" \| "24h" \| "3d", expiresAt? }` | `Result<{ token }>`. Signed in. Sensitive / academic / crisis rejected. `payType` `trade` / `free` forces price 0. Default expiry 24 h, max 7 days                                                               | ✅ board.ts                |
| Board (landing)          | `listBoard`           | none                                                                                                                                               | `PublicCard[]`: open, unexpired, non-private, newest first; 5 seeded cards. Hides asks between blocked people, and paid asks from a viewer who said they can't accept payment                                    | ✅ board.ts                |
| Card / Waiting / Matched | `getCard`             | `token`                                                                                                                                            | `PublicCard \| null`. Public, except private asks (asker, picked helpers and holder only)                                                                                                                        | ✅ board.ts                |
| Claimed tab              | `listMyCards`         | none                                                                                                                                               | `Result<{ asks: PublicCard[]; helping: PublicCard[] }>` ("My asks" / "I'm helping")                                                                                                                              | ✅ board.ts                |
| Waiting                  | `extendAsk`           | `token`                                                                                                                                            | `Result<{ card }>`: +24 h, open asks only, max 7 days out                                                                                                                                                        | ✅ board.ts                |
| Waiting / any            | `cancelAsk`           | `token`                                                                                                                                            | `Result<{ card }>`: before done; refunds a held payment                                                                                                                                                          | ✅ board.ts                |
| Share to GroupMe         | `shareCardToGroup`    | `{ token, groupId }`                                                                                                                               | `Result`. Asker only, open public asks, 3 posts / group / day                                                                                                                                                    | ✅ board.ts                |
| Waiting → Matched        | `confirmHelper`       | `token`                                                                                                                                            | `Result<{ card }>`: `held` → `confirmed`, picks `meetingSpot`; bot posts "Covered" once                                                                                                                          | ✅ board.ts                |
| Pay to hold task (mock)  | `payToHold`           | `{ token, method: "venmo" \| "card" }`                                                                                                             | `Result<{ card }>`: after confirm, paid asks only, once. `card.payment` has `amountCents`, `platformFeeCents` (10%), `processingFeeCents`, `totalCents` ($15 by Venmo → 1681), `status`                          | ✅ board.ts                |
| Done                     | `markDone`            | `token`                                                                                                                                            | `Result<{ card }>`: `confirmed` → `done`; paid asks must be paid first; releases the payment                                                                                                                     | ✅ board.ts                |
| Thank you                | `saveCardThanks`      | `token, note`                                                                                                                                      | `Result<{ card }>` (after confirm). Old `saveThanks` in ask.ts is for the group-first flow                                                                                                                       | ✅ board.ts                |
| Ask privately            | `createPrivateAsk`    | same as `postToBoard`                                                                                                                              | `Result<{ token }>`. Sensitive asks allowed here (never the board or a group); academic / crisis rejected                                                                                                        | ✅ board.ts                |
| Ask privately            | `sendPrivately`       | `{ token, helperIds }`                                                                                                                             | `Result<{ card }>`: up to 3 people in total; paid asks only to helpers who can accept payment; skips nobody silently                                                                                             | ✅ private.ts              |
| Ask privately            | `matchHelpers`        | `{ text, minutes, price, when?: string }`                                                                                                          | `HelperSuggestion[]` (2–3, may be empty)                                                                                                                                                                         | 🟡 (today: `suggestWhere`) |

## Helper flow (claim page `/h/[token]` and board)

| Step                            | Action                | Input                                  | Returns                                                                                                                                                                                                        | Status        |
| ------------------------------- | --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Open link                       | `getCard`             | `token`                                | `PublicCard \| null` (`status: "expired"` / `"held"` → show "Already taken")                                                                                                                                   | ✅ board.ts   |
| Sign in (mocked)                | `mockSignIn`          | `{ firstName, email }` (school `.edu`) | `Result<{ me: { firstName, email } }>`. Viewing the card needs no account; claiming does                                                                                                                       | ✅ session.ts |
| Setup (paid cards only, mocked) | (part of `claimCard`) | `HelperSetup`                          | Needs `canAcceptPayment: true` and a non-empty `payoutAccount`                                                                                                                                                 | ✅            |
| I can help                      | `claimCard`           | `{ token, setup?: HelperSetup }`       | `Result` — or `{ error: "Already taken" }` / `"This ask has expired"` / `"This ask needs a helper who can accept payment"` / `"You can't take your own ask."`. Name and email come from the signed-in account. | ✅ board.ts   |

## Private requests, inbox and messages

| Screen         | Action             | Input                                                                        | Returns                                                                                                                                     | Status        |
| -------------- | ------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Inbox (helper) | `listMyRequests`   | none                                                                         | `Result<{ requests: PrivateRequest[] }>` (`card`, `sentAt`, `response?`)                                                                    | ✅ private.ts |
| Inbox (helper) | `respondToRequest` | `{ token, answer: "yes" \| "no" }`                                           | `Result`. "yes" is the same hold as the board (first yes wins); "no" asks no reason and tells the asker nothing                             | ✅ private.ts |
| Inbox          | `listInbox`        | `{ kind?: "action" \| "update", topic?: "tasks" \| "groups" \| "payments" }` | `Result<{ items: InboxItem[]; unreadActions }>`, newest first                                                                               | ✅ inbox.ts   |
| Inbox          | `markInboxRead`    | `ids?: string[]` (none = mark all read)                                      | `Result`                                                                                                                                    | ✅ inbox.ts   |
| Claimed task   | `listMessages`     | `token`                                                                      | `Result<{ messages: Message[] }>`: asker and holder only, once someone said yes. An anonymous asker shows as "The asker" until they confirm | ✅ inbox.ts   |
| Claimed task   | `sendMessage`      | `{ token, body }`                                                            | `Result`; notifies the other side                                                                                                           | ✅ inbox.ts   |

Inbox items are written by the server in the same transaction as the state change: posted, shared to GroupMe, someone can help (action), confirmed, payment held / released, cancelled, new private ask (action), new message (action).

## Profile and blocking (`session.ts`)

| Action                                | Input                                  | Returns                                                                                                                                    |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `getMyProfile`                        | none                                   | `Profile \| null` (name, email, phone, class year + show toggle, `canAcceptPayment`, payout, interests, weekly limit, email notifications) |
| `updateMyProfile`                     | any subset of those fields (not email) | `Result`                                                                                                                                   |
| `blockFromCard`                       | `token`                                | `Result`: blocks the other person on that card without revealing an anonymous asker                                                        |
| `listBlockedPeople` / `unblockPerson` | none / `key`                           | `Result<{ blocked: { key, label }[] }>` / `Result`                                                                                         |

No ratings, reviews, stars or points (PRD). The thank-you note is the only feedback.

## Key types (`src/lib/ask/types.ts`)

- `BoardCard` / `PublicCard`: one ask, one card, with `title`, `text` ("what done looks like"), `category` (writing / coding / lab / errands / other), `payType` (pay / fund / trade / free), `private`, `startsAt?`, `neededBy?`, `askerYear?`, `shares: { groupId, postedAt }[]`, and `payment?` (asker and helper only). `PublicCard` never has user ids or the helper's email, and hides the asker's name on anonymous cards; it adds `viewer` and `heldByFirstName`. `status`: `open → held → confirmed → done` (or `expired` / `cancelled`). `price` is whole dollars, where `0` means a favor. `minutes` is how long the help takes. `expiresAt` is in ms.
- `Helper`: `interests`, seeded weekly `busy` slots (free/busy only), `weeklyLimit`, `canAcceptPayment`.
- `Result<T>`: `({ ok: true } & T) | { error: string }`.

## Seed data (`src/lib/ask/mock-data.ts`)

- `HELPERS`: 16 fictional Northfield helpers. Five can't accept payment: Tomás, Aiko, Yuna, Samir and Nadia.
- `GROUPS`: 3 partner groups (2 GroupMe, 1 Slack). `OFFICES`, `MEETING_SPOTS`, `CRISIS_RESOURCES`, `TUTORING_RESOURCES`.
- Demo ask: a $15 ride to the airport, about 45 minutes.

## Mocking a 🟡 action

Until it lands, write a stub with the same name and signature in your component file or a `mocks.ts`, returning data shaped like the table above. When the real one ships, change the import to `@/server/actions/ask` (or `@/server/actions/board` for board actions). Because the types match, TypeScript flags anything that changed.

## Storage

All of this is in Postgres (tables in `src/db/schema/ask.ts`, migration `drizzle/0002_ask_tables.sql`). Locally it's an in-process PGlite database, migrated and seeded on first use and reset on restart. With `ASK_DB=postgres` it's the shared Supabase database, so two phones (and every Vercel instance) see the same card; run `pnpm db:migrate` first.

## Open decisions

- Suggested price (decided for tonight, `src/lib/ask/price.ts`; the model never sets it): rides and moving ~$20/hr (floor $10), everything else ~$15/hr (floor $5), rounded to $5, range ±$5; 10 min or less suggests $0 (favor). 45-min ride → $15 ($10–20).
- Who to ask (`src/lib/ask/helper-fit.ts`): `HelperPrefs.needs` must be seeded helper tags; `fits`/`fitsPaid` are a preview count only. `matchHelpers` adds free/busy, weekly limits and load spreading.
