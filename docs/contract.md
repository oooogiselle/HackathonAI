# Ask: backend ↔ frontend contract

Screens call the backend through **server actions** in `src/server/actions/ask.ts`. Import a function and `await` it like any other async function, with no `fetch` and no URLs. All shared types live in `src/lib/ask/types.ts`, and seed data in `src/lib/ask/mock-data.ts`.

Status: **✅ exists** means you can call it today. **🟡 planned** means the signature below is the promise, and you can mock it until it lands (see "Mocking" at the end).

## Rules every screen follows

- Nothing is sent, posted, paid or added to a calendar without an explicit tap. Disable the button while its action is in flight.
- Every action that can fail returns `{ error: string }`. Show that string as-is; it's written for the user.
- Hide group sharing and the board unless the safety category is `"none"`. The server rejects it anyway.
- Anonymous posts: show `ScrubResult.removed` with an Undo.
- On "I can help", the server decides who wins. A loser gets `{ error: "Already taken" }`, so refresh the card.
- Never show a helper's email. `PublicCard` doesn't contain it.

## Asker flow

| Screen           | Action                | Input                                             | Returns                                                                                                                                                                                              | Status                      |
| ---------------- | --------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Home             | `checkSafety`         | `need: string`                                    | `SafetyResult` (`category`: `none` / `sensitive` / `academic` / `crisis`)                                                                                                                            | ✅                          |
| Home             | (route)               |                                                   | `crisis` → `/resources?type=crisis`, `academic` → `/resources?type=tutoring`                                                                                                                         | ✅                          |
| Clarify          | `getClarifyQuestions` | `need: string`                                    | `ClarifyQuestion[]` (≤ 2, each with 2–4 chip options)                                                                                                                                                | ✅                          |
| Your ask         | `draftAsk`            | `need: string, answers: ClarifyAnswer[]`          | `DraftResult { parts: AskPart[] }`: 1–4 small asks, each with what/when/where, `minutes`, `helper: HelperPrefs`, `price: PriceSuggestion`, `priceSet`, `text`, `category`. Empty for academic/crisis | ✅                          |
| Your ask         | `scrubForAnonymous`   | `ask: string`                                     | `ScrubResult` (`text`, `removed[]`)                                                                                                                                                                  | ✅                          |
| Your ask → board | `postToBoard`         | `{ text, minutes, price, anonymous, firstName? }` | `Result<{ token: string }>`                                                                                                                                                                          | 🟡                          |
| Board            | `listBoard`           | `{ helperId?: string }`                           | `PublicCard[]` (open cards only; paid cards hidden from helpers who can't accept payment)                                                                                                            | 🟡                          |
| Card / Matched   | `getCard`             | `token: string`                                   | `PublicCard \| null`                                                                                                                                                                                 | 🟡 (today: `getPostStatus`) |
| Share to GroupMe | `shareCardToGroup`    | `{ token, groupId }`                              | `Result` (rate limit 3 posts / group / day)                                                                                                                                                          | 🟡 (today: `postAsk`)       |
| Matched          | `confirmHelper`       | `token: string`                                   | `Result<{ card: PublicCard }>` (status `held` → `confirmed`; bot posts "Covered")                                                                                                                    | 🟡                          |
| Matched          | `markDone`            | `token: string`                                   | `Result<{ card: PublicCard }>`                                                                                                                                                                       | 🟡                          |
| Pay (mock)       | `markPaid`            | `token: string`                                   | `Result` (only after `done`; free cards skip this screen)                                                                                                                                            | 🟡                          |
| Thank you        | `saveThanks`          | `token: string, note: string`                     | `void`                                                                                                                                                                                               | ✅                          |
| Ask privately    | `matchHelpers`        | `{ text, minutes, price, when?: string }`         | `HelperSuggestion[]` (2–3, may be empty)                                                                                                                                                             | 🟡 (today: `suggestWhere`)  |

## Helper flow (claim page `/h/[token]` and board)

| Step                            | Action                | Input                                                | Returns                                                                                                                    | Status                 |
| ------------------------------- | --------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Open link                       | `getCard`             | `token`                                              | `PublicCard \| null` (`status: "expired"` / `"held"` → show "Already taken")                                               | 🟡                     |
| Sign-up (mocked)                | (none)                | first name + school `.edu` email, kept in page state |                                                                                                                            | 🟡                     |
| Setup (paid cards only, mocked) | (part of `claimCard`) | `HelperSetup`                                        |                                                                                                                            | 🟡                     |
| I can help                      | `claimCard`           | `{ token, firstName, email, setup?: HelperSetup }`   | `Result` — or `{ error: "Already taken" }` / `"This ask has expired"` / `"This ask needs a helper who can accept payment"` | 🟡 (today: `claimAsk`) |

## Key types (`src/lib/ask/types.ts`)

- `BoardCard` / `PublicCard`: one ask, one card. `status`: `open → held → confirmed → done` (or `expired` / `cancelled`). `price` is whole dollars, where `0` means a favor. `minutes` is how long the help takes. `expiresAt` is in ms.
- `Helper`: `interests`, seeded weekly `busy` slots (free/busy only), `weeklyLimit`, `canAcceptPayment`.
- `Result<T>`: `({ ok: true } & T) | { error: string }`.

## Seed data (`src/lib/ask/mock-data.ts`)

- `HELPERS`: 16 fictional Northfield helpers. Five can't accept payment: Tomás, Aiko, Yuna, Samir and Nadia.
- `GROUPS`: 3 partner groups (2 GroupMe, 1 Slack). `OFFICES`, `MEETING_SPOTS`, `CRISIS_RESOURCES`, `TUTORING_RESOURCES`.
- Demo ask: a $15 ride to the airport, about 45 minutes.

## Mocking a 🟡 action

Until it lands, write a stub with the same name and signature in your component file or a `mocks.ts`, returning data shaped like the table above. When the real one ships, change the import to `@/server/actions/ask`. Because the types match, TypeScript flags anything that changed.

## Open decisions

- Suggested price (decided for tonight, `src/lib/ask/price.ts`; the model never sets it): rides and moving ~$20/hr (floor $10), everything else ~$15/hr (floor $5), rounded to $5, range ±$5; 10 min or less suggests $0 (favor). 45-min ride → $15 ($10–20).
- Who to ask (`src/lib/ask/helper-fit.ts`): `HelperPrefs.needs` must be seeded helper tags; `fits`/`fitsPaid` are a preview count only. `matchHelpers` adds free/busy, weekly limits and load spreading.
