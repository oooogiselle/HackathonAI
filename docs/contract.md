# Ask: backend ↔ frontend contract

Screens call the backend through **server actions**: the ask flow is in `src/server/actions/ask.ts`, and the board and card lifecycle are in `src/server/actions/board.ts`. Import a function and `await` it like any other async function, with no `fetch` and no URLs. All shared types live in `src/lib/ask/types.ts`, and seed data in `src/lib/ask/mock-data.ts`.

Status: **✅ exists** means you can call it today. **🟡 planned** means the signature below is the promise, and you can mock it until it lands (see "Mocking" at the end).

## Who can call what

The landing page is the public board. **Anyone can view it**: `listBoard` and `getCard` need no account. **Posting and taking an ask need a Supabase sign-in** (magic link or Google at `/login`). An asker step (confirm, done, pay, thanks, share) works only for the person who posted the card. Every one of these is checked on the server.

- Signed out → `{ error: "Sign in to post or help." }`. Send the user to `/login`.
- `PublicCard.viewer` is `"asker"`, `"helper"`, `"other"` or `"signed-out"`. Use it to pick the buttons: the asker sees Confirm / Done / Pay / Share, a signed-in `"other"` sees "I can help" on an open card, and `"signed-out"` sees "Sign in to help".

## Rules every screen follows

- Nothing is sent, posted, paid or added to a calendar without an explicit tap. Disable the button while its action is in flight.
- Every action that can fail returns `{ error: string }`. Show that string as-is; it's written for the user.
- Hide group sharing and the board unless the safety category is `"none"`. The server rejects it anyway.
- Anonymous posts: show `ScrubResult.removed` with an Undo.
- On "I can help", the server decides who wins. A loser gets `{ error: "Already taken" }`, so refresh the card.
- Never show a helper's email. `PublicCard` doesn't contain it.

## Asker flow

| Screen           | Action                | Input                                                         | Returns                                                                                                                                                  | Status                     |
| ---------------- | --------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Home             | `checkSafety`         | `need: string`                                                | `SafetyResult` (`category`: `none` / `sensitive` / `academic` / `crisis`)                                                                                | ✅                         |
| Home             | (route)               |                                                               | `crisis` → `/resources?type=crisis`, `academic` → `/resources?type=tutoring`                                                                             | ✅                         |
| Clarify          | `getClarifyQuestions` | `need: string`                                                | `ClarifyQuestion[]` (≤ 2, each with 2–4 chip options)                                                                                                    | ✅                         |
| Your ask         | `draftAsk`            | `need: string, answers: ClarifyAnswer[]`                      | today `string`; **planned** `DraftResult` (`ask`, `minutes`, `suggestedPrice: PriceRange`)                                                               | ✅ → 🟡                    |
| Your ask         | `scrubForAnonymous`   | `ask: string`                                                 | `ScrubResult` (`text`, `removed[]`)                                                                                                                      | ✅                         |
| Your ask → board | `postToBoard`         | `{ text, minutes, price, anonymous, firstName?, expiresAt? }` | `Result<{ token: string }>` (signed in; sensitive/academic/crisis rejected; `expiresAt` ms, default +24 h, max 7 days)                                   | ✅ board.ts                |
| Board (landing)  | `listBoard`           | `{ helperId?: string }`                                       | `PublicCard[]` (public; open cards, newest first; 5 seeded cards on a fresh server; paid cards hidden for a seeded `helperId` that can't accept payment) | ✅ board.ts                |
| Card / Matched   | `getCard`             | `token: string`                                               | `PublicCard \| null` (public)                                                                                                                            | ✅ board.ts                |
| Share to GroupMe | `shareCardToGroup`    | `{ token, groupId }`                                          | `Result` (asker only; card must be open; rate limit 3 posts / group / day)                                                                               | ✅ board.ts                |
| Matched          | `confirmHelper`       | `token: string`                                               | `Result<{ card: PublicCard }>` (asker only; `held` → `confirmed`; bot posts "Covered" once)                                                              | ✅ board.ts                |
| Matched          | `markDone`            | `token: string`                                               | `Result<{ card: PublicCard }>` (asker only; `confirmed` → `done`)                                                                                        | ✅ board.ts                |
| Pay (mock)       | `markPaid`            | `token: string`                                               | `Result<{ card: PublicCard }>` (asker only; only after `done`, once; free cards skip this screen)                                                        | ✅ board.ts                |
| Thank you        | `saveCardThanks`      | `token: string, note: string`                                 | `Result<{ card: PublicCard }>` (asker only; after confirm). Old `saveThanks` in ask.ts is for the group-first flow.                                      | ✅ board.ts                |
| Ask privately    | `matchHelpers`        | `{ text, minutes, price, when?: string }`                     | `HelperSuggestion[]` (2–3, may be empty)                                                                                                                 | 🟡 (today: `suggestWhere`) |

## Helper flow (claim page `/h/[token]` and board)

| Step                            | Action                | Input                                       | Returns                                                                                                                                                                                                | Status      |
| ------------------------------- | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Open link                       | `getCard`             | `token`                                     | `PublicCard \| null` (`status: "expired"` / `"held"` → show "Already taken")                                                                                                                           | ✅ board.ts |
| Sign in                         | (`/login`)            | Supabase magic link or Google               | Viewing the card needs no account; claiming does                                                                                                                                                       | ✅          |
| Setup (paid cards only, mocked) | (part of `claimCard`) | `HelperSetup`                               | Needs `canAcceptPayment: true` and a non-empty `payoutAccount`                                                                                                                                         | ✅          |
| I can help                      | `claimCard`           | `{ token, firstName, setup?: HelperSetup }` | `Result` — or `{ error: "Already taken" }` / `"This ask has expired"` / `"This ask needs a helper who can accept payment"` / `"You can't take your own ask."`. Email comes from the signed-in account. | ✅ board.ts |

## Key types (`src/lib/ask/types.ts`)

- `BoardCard` / `PublicCard`: one ask, one card. `PublicCard` never has user ids or the helper's email, and hides the asker's name on anonymous cards; it adds `viewer` and `heldByFirstName`. `status`: `open → held → confirmed → done` (or `expired` / `cancelled`). `price` is whole dollars, where `0` means a favor. `minutes` is how long the help takes. `expiresAt` is in ms.
- `Helper`: `interests`, seeded weekly `busy` slots (free/busy only), `weeklyLimit`, `canAcceptPayment`.
- `Result<T>`: `({ ok: true } & T) | { error: string }`.

## Seed data (`src/lib/ask/mock-data.ts`)

- `HELPERS`: 16 fictional Northfield helpers. Five can't accept payment: Tomás, Aiko, Yuna, Samir and Nadia.
- `GROUPS`: 3 partner groups (2 GroupMe, 1 Slack). `OFFICES`, `MEETING_SPOTS`, `CRISIS_RESOURCES`, `TUTORING_RESOURCES`.
- Demo ask: a $15 ride to the airport, about 45 minutes.

## Mocking a 🟡 action

Until it lands, write a stub with the same name and signature in your component file or a `mocks.ts`, returning data shaped like the table above. When the real one ships, change the import to `@/server/actions/ask` (or `@/server/actions/board` for board actions). Because the types match, TypeScript flags anything that changed.

## Open decisions

- Suggested price ranges (Giselle + Yvonne). Current placeholder: rides $10–20, 20-minute help $5–10, favors $0.
