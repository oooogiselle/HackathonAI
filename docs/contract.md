# Ask: backend ↔ frontend contract

Screens call the backend through **server actions**: the ask flow is in `src/server/actions/ask.ts`, and the board and card lifecycle are in `src/server/actions/board.ts`. Import a function and `await` it like any other async function, with no `fetch` and no URLs. All shared types live in `src/lib/ask/types.ts`, and seed data in `src/lib/ask/mock-data.ts`.

Status: **✅ exists** means you can call it today. **🟡 planned** means the signature below is the promise, and you can mock it until it lands (see "Mocking" at the end).

## Who can call what

The landing page is the public board. **Anyone can view it**: `listBoard` and `getCard` need no account. **Posting and taking an ask need the mocked sign-in**: `mockSignIn({ firstName, email })` with a school `.edu` email, no verification. It sets a session cookie on that browser. An asker step (confirm, done, pay, thanks, share) works only for the person who posted the card. Every one of these is checked on the server.

- Signed out → `{ error: "Sign in to post or help." }`. Show the sign-in form (first name + school email), then retry.
- `getMe()` → `{ firstName, email } | null` tells you who's signed in on this browser; `mockSignOut()` clears it. All three are in `src/server/actions/session.ts`.
- `PublicCard.viewer` is `"asker"`, `"helper"`, `"other"` or `"signed-out"`. Use it to pick the buttons: the asker sees Confirm / Done / Pay / Share, a signed-in `"other"` sees "I can help" on an open card, and `"signed-out"` sees "Sign in to help".

## Design screens → actions

Source: the "Ask: design and contract map" doc and the [design canvas](https://claude.ai/artifact/SHnbdWVPwMQmpdgPy2kwqE). Statuses below come from the code on `dev`, not the doc (the doc lists some board actions as planned; they exist in `board.ts`).

How the flows connect:

- **Asker:** Needs board → Post a need → Quick check (`checkSafety`) routes it. `none` → Where it goes (board, Share to GroupMe or Ask privately, plus expiry) → Waiting. `sensitive` → Kept private (board and GroupMe locked) → Ask privately → Waiting. `crisis` / `academic` → Support resources, never posted or matched. `blocked` (planned) → Quick check: can't post. Then Waiting → Confirm helper → Claimed task → Pay (mock) → Thank you. No yes in time → Ask expired → Post again.
- **Helper:** Needs board → Task detail → Claim → Payouts (mock).
- **Everywhere:** bottom bar with Feed, Claimed, Ask, Inbox, Me. Claimed lists my asks and what I'm helping with. Inbox has All, Actions (needs a tap) and Updates (info only).

| Screen                       | Design file                                | Actions                                                      | Status                   |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------ | ------------------------ |
| Sign in, Verify              | SignIn, Verify                             | `mockSignIn` (first name + `.edu`); phone + codes not built  | ✅ mocked (TODO(auth))   |
| Needs board                  | original/Main                              | `listBoard` (cards show `minutes` and `expiresAt`)           | ✅ board.ts              |
| Post a need                  | original/Post                              | `checkSafety`, `draftAsk`                                    | ✅                       |
| Quick check                  | original/SafetyCheck                       | `checkSafety` = `none`; option to keep it private            | ✅                       |
| Quick check: can't post      | original/SafetyCheckRejected               | `checkSafety` = `blocked` with `reason` + `suggestedRewrite` | 🟡                       |
| Where it goes                | original/Route                             | `postToBoard` (sets `expiresAt`)                             | ✅ board.ts              |
| Kept private                 | original/PrivateRoute                      | `checkSafety` = `sensitive`; board and GroupMe locked        | ✅                       |
| Ask privately                | original/MatchHelpers                      | `matchHelpers` (pick 2–3)                                    | 🟡                       |
| Share to GroupMe             | Share                                      | `shareCardToGroup` (3 per group per day)                     | ✅ board.ts              |
| Waiting for a helper         | original/Waiting                           | `getCard`, `confirmHelper`; `extendCard`, `cancelCard`       | ✅ / 🟡 (Extend, Cancel) |
| Ask expired                  | original/Expired                           | `getCard` (`status: "expired"`)                              | ✅ board.ts              |
| Task detail (helper)         | original/Task                              | `getCard`, `claimCard`                                       | ✅ board.ts              |
| Claimed task                 | original/ClaimedTask                       | `getCard`, `markDone`                                        | ✅ board.ts              |
| Claimed tab                  | original/Claimed                           | `listMyCards`                                                | 🟡                       |
| Pay                          | original/Payment                           | `markPaid` (mocked, after `done`; not a hold)                | ✅ board.ts              |
| Payouts                      | original/Payout                            | Part of `claimCard` `setup` (mocked)                         | ✅ mocked                |
| Inbox: All, Actions, Updates | original/Inbox, InboxActions, InboxUpdates | `listInbox`                                                  | 🟡                       |
| Thank you (was "Rate")       | Review                                     | `saveCardThanks` (a note only, no rating)                    | ✅ board.ts              |
| Profile                      | Profile                                    | `getMe`, `mockSignOut`                                       | ✅ session.ts            |
| Support resources            | Resources                                  | `CRISIS_RESOURCES`, `TUTORING_RESOURCES`                     | ✅ data                  |

## Rules every screen follows

- Nothing is sent, posted, paid or added to a calendar without an explicit tap. Disable the button while its action is in flight.
- Every action that can fail returns `{ error: string }`. Show that string as-is; it's written for the user.
- Hide group sharing and the board unless the safety category is `"none"`. The server rejects it anyway.
- Anonymous posts: show `ScrubResult.removed` with an Undo.
- On "I can help", the server decides who wins. A loser gets `{ error: "Already taken" }`, so refresh the card.
- Never show a helper's email. `PublicCard` doesn't contain it. A helper's school email is shared only after both sides say yes.
- Free favors (`price: 0`) skip the Pay screen.
- Every card shows when it expires. After that it leaves the board, and the GroupMe link shows "This ask has expired".
- Inbox Actions always need a tap; Updates never do. All shows both.
- A blocked ask is never posted, shared or matched. Show the reason and offer a suggested rewrite (checked again on tap), tutoring, or discard.
- No ratings, stars or scores anywhere. The asker writes a thank-you note.

## Asker flow

| Screen           | Action                | Input                                             | Returns                                                                                                                                                                                                          | Status                     |
| ---------------- | --------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Home / Describe  | `checkSafety`         | `need: string`                                    | `SafetyResult` (`category`: `none` / `sensitive` / `academic` / `crisis`)                                                                                                                                        | ✅                         |
| Home / Describe  | (route)               |                                                   | `crisis` → `/resources?type=crisis`, `academic` → `/resources?type=tutoring`                                                                                                                                     | ✅                         |
| Clarify          | `getClarifyQuestions` | `need: string`                                    | `ClarifyQuestion[]` (≤ 2, each with 2–4 chip options)                                                                                                                                                            | ✅                         |
| Your ask         | `draftAsk`            | `need: string, answers: ClarifyAnswer[]`          | `DraftResult { parts: AskPart[] }`: 1–4 small asks, each with what/when/where, `minutes`, `helper: HelperPrefs`, `price: PriceSuggestion`, `priceSet`, `text`, `category`, `deadline`. Empty for academic/crisis | ✅                         |
| Home (form)      | `assistAsk`           | `{ what, details, when?, where?, minutes }`       | `{ suggestions: AssistSuggestions }` (`text`, `minutes`, `helper`, `missing[]`) or `{ redirect: "crisis" \| "tutoring" }`. Only on a tap; the form applies nothing without a "Use" tap                           | ✅                         |
| Your ask         | `scrubForAnonymous`   | `ask: string`                                     | `ScrubResult` (`text`, `removed[]`)                                                                                                                                                                              | ✅                         |
| Your ask → board | `postToBoard`         | `{ text, minutes, price, anonymous, expiresAt? }` | `Result<{ token: string }>` (signed in; a named card shows the signed-in first name; sensitive/academic/crisis rejected; `expiresAt` ms, default +24 h, max 7 days)                                              | ✅ board.ts                |
| Board (landing)  | `listBoard`           | `{ helperId?: string }`                           | `PublicCard[]` (public; open cards, newest first; 5 seeded cards on a fresh server; paid cards hidden for a seeded `helperId` that can't accept payment)                                                         | ✅ board.ts                |
| Card / Matched   | `getCard`             | `token: string`                                   | `PublicCard \| null` (public)                                                                                                                                                                                    | ✅ board.ts                |
| Share to GroupMe | `shareCardToGroup`    | `{ token, groupId }`                              | `Result` (asker only; card must be open; rate limit 3 posts / group / day)                                                                                                                                       | ✅ board.ts                |
| Matched          | `confirmHelper`       | `token: string`                                   | `Result<{ card: PublicCard }>` (asker only; `held` → `confirmed`; bot posts "Covered" once)                                                                                                                      | ✅ board.ts                |
| Matched          | `markDone`            | `token: string`                                   | `Result<{ card: PublicCard }>` (asker only; `confirmed` → `done`)                                                                                                                                                | ✅ board.ts                |
| Pay (mock)       | `markPaid`            | `token: string`                                   | `Result<{ card: PublicCard }>` (asker only; only after `done`, once; free cards skip this screen)                                                                                                                | ✅ board.ts                |
| Thank you        | `saveCardThanks`      | `token: string, note: string`                     | `Result<{ card: PublicCard }>` (asker only; after confirm). Old `saveThanks` in ask.ts is for the group-first flow.                                                                                              | ✅ board.ts                |
| Ask privately    | `matchHelpers`        | `{ text, minutes, price, when?: string }`         | `HelperSuggestion[]` (2–3, may be empty)                                                                                                                                                                         | 🟡 (today: `suggestWhere`) |
| Quick check      | `checkSafety`         | `need: string`                                    | `category` gains `"blocked"` (graded work, unsafe, illegal, or aimed at a person) with `reason` and `suggestedRewrite?`. The rewrite is re-checked on tap; blocked asks are never posted, shared or matched      | 🟡                         |
| Waiting          | `extendCard`          | `{ token, expiresAt }`                            | `Result<{ card: PublicCard }>` (asker only; open cards; max 7 days from now)                                                                                                                                     | 🟡                         |
| Waiting          | `cancelCard`          | `token: string`                                   | `Result<{ card: PublicCard }>` (asker only; `open` / `held` → `cancelled`; leaves the board)                                                                                                                     | 🟡                         |
| Claimed tab      | `listMyCards`         | (none)                                            | `{ asking: PublicCard[]; helping: PublicCard[] }` (signed in; newest first)                                                                                                                                      | 🟡                         |
| Inbox            | `listInbox`           | (none)                                            | `InboxItem[]` (`kind: "action" \| "update"`, `text`, `token?`, `createdAt`); signed in; never reveals an anonymous asker                                                                                         | 🟡                         |

## Helper flow (claim page `/h/[token]` and board)

| Step                            | Action                | Input                                  | Returns                                                                                                                                                                                                        | Status        |
| ------------------------------- | --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Open link                       | `getCard`             | `token`                                | `PublicCard \| null` (`status: "expired"` / `"held"` → show "Already taken")                                                                                                                                   | ✅ board.ts   |
| Sign in (mocked)                | `mockSignIn`          | `{ firstName, email }` (school `.edu`) | `Result<{ me: { firstName, email } }>`. Viewing the card needs no account; claiming does                                                                                                                       | ✅ session.ts |
| Setup (paid cards only, mocked) | (part of `claimCard`) | `HelperSetup`                          | Needs `canAcceptPayment: true` and a non-empty `payoutAccount`                                                                                                                                                 | ✅            |
| I can help                      | `claimCard`           | `{ token, setup?: HelperSetup }`       | `Result` — or `{ error: "Already taken" }` / `"This ask has expired"` / `"This ask needs a helper who can accept payment"` / `"You can't take your own ask."`. Name and email come from the signed-in account. | ✅ board.ts   |

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

## Decided (Oct 30, design vs PRD)

- **Payment:** follows the code. The asker pays with `markPaid` after `done` (mocked "Pay $X"). The design's "Pay to hold" screen is that pay step, not a hold before the ride.
- **No ratings:** the design's "Rate your helper" screen is the thank-you note (`saveCardThanks`), with no stars or score.
- **Sign-in:** mocked for now (`mockSignIn`: first name + school `.edu` email, no codes). The design's phone + two-code Verify screen is not built (TODO(auth)).

## Open decisions

- Suggested price (decided for tonight, `src/lib/ask/price.ts`; the model never sets it): rides and moving ~$20/hr (floor $10), everything else ~$15/hr (floor $5), rounded to $5, range ±$5; 10 min or less suggests $0 (favor). 45-min ride → $15 ($10–20).
- Who to ask (`src/lib/ask/helper-fit.ts`): `HelperPrefs.needs` must be seeded helper tags; `fits`/`fitsPaid` are a preview count only. `matchHelpers` adds free/busy, weekly limits and load spreading.
