// Shared types for the Ask flow: the contract between backend and frontend.
// See docs/contract.md for which server action returns what.
// TODO(db): BoardCard becomes the `asks` table (see tasks.md, Postgres store).

// Ordered least → most restrictive (see SAFETY_SEVERITY in safety-check.ts).
// - none: nothing flagged; a normal practical ask
// - sensitive: visa / money / health. Peers + offices only, never group chats
// - academic: "write my essay" style. Redirect to tutoring
// - crisis: show professional resources only. Never match, never post
export type SafetyCategory = "none" | "sensitive" | "academic" | "crisis";

export type SafetyResult = { category: SafetyCategory; reason: string };

export type ClarifyQuestion = { question: string; options: string[] };

export type ClarifyAnswer = { question: string; answer: string };

// What a helper said they'd enjoy helping with (PRD "Helper side").
export const INTERESTS = [
  "rides",
  "moving",
  "us-paperwork",
  "cooking",
  "language",
  "course-advice",
  "opt",
] as const;
export type Interest = (typeof INTERESTS)[number];

// A weekly busy window, from seeded calendar free/busy. Never an event title.
// day: 0 = Sunday … 6 = Saturday; start/end are 24h "HH:MM" local time.
export type BusySlot = { day: number; start: string; end: string };

export type Helper = {
  id: string;
  firstName: string;
  year: string;
  blurb: string;
  // Free-text keywords used by the no-AI fallback matcher.
  tags: string[];
  interests: Interest[];
  busy: BusySlot[];
  weeklyLimit: number;
  // F-1 students and anyone who opts out see only $0 favors.
  canAcceptPayment: boolean;
};

export type HelperSuggestion = { helper: Helper; why: string };

export type Platform = "groupme" | "slack";

export type Group = {
  id: string;
  name: string;
  platform: Platform;
  members: number;
  description: string;
};

export type Office = { name: string; why: string };

export type WhereSuggestion = {
  helpers: HelperSuggestion[];
  groups: Group[];
  offices: Office[];
};

export type ScrubResult = { text: string; removed: string[] };

// Whole US dollars. 0 = a favor.
export type PriceRange = { min: number; max: number };

// Who'd be a good fit for one ask. Only what the need implies: never gender,
// nationality or religion; a language only when the student asked for it.
export type HelperPrefs = {
  interests: Interest[];
  // Must-haves, matched against Helper.tags (e.g. "car", "korean").
  needs: string[];
  // Nice-to-haves, shown to the student only (e.g. "fits luggage").
  nice: string[];
  // One line: "Someone with a car who's free Saturday morning".
  why: string;
  // Seeded helpers that fit (a preview; matchHelpers adds free/busy + limits).
  fits: number;
  // Of those, how many can accept payment.
  fitsPaid: number;
};

export type PriceSuggestion = PriceRange & {
  // Pre-filled value. 0 = a favor.
  suggested: number;
  // "About 45 min of driving × ~$20/hr, gas included → $15"
  reason: string;
  favorHint?: string;
};

// One small ask out of a bigger need. The student edits these on Your ask.
export type AskPart = {
  what: string;
  when?: string;
  // ISO time if the need gave one; used by matching and expiry later.
  startsAt?: string;
  where?: string;
  // ISO. The ask leaves the board after this (Phase 2 expiry uses it as expiresAt).
  deadline?: string;
  minutes: number;
  helper: HelperPrefs;
  price: PriceSuggestion;
  // What the student picked. 0 = a favor.
  priceSet: number;
  // The friendly ask that gets posted.
  text: string;
  // "none" or "sensitive"; academic and crisis parts are dropped.
  category: SafetyCategory;
};

// The form's optional AI help (assistAsk). Each item is applied only on a tap.
export type AssistField = "when" | "where" | "details";
export type AssistSuggestions = {
  text: string;
  minutes: number;
  helper: HelperPrefs;
  // Up to 2 nudges about empty fields.
  missing: { field: AssistField; hint: string }[];
};

// draftAsk breaks one need into 1–4 small asks. Empty for academic/crisis needs.
export type DraftResult = { parts: AskPart[] };

// One ask = one card, whether seen on the board, opened from a GroupMe link,
// or sent privately to picked helpers.
// open → held (first "I can help") → confirmed (asker picks them) → done.
// Any state before done can become cancelled; open/held read as expired after expiresAt.
export type CardStatus = "open" | "held" | "confirmed" | "done" | "expired" | "cancelled";

export const ASK_CATEGORIES = ["writing", "coding", "lab", "errands", "other"] as const;
export type AskCategory = (typeof ASK_CATEGORIES)[number];

// pay: asker pays the helper. fund: paid by a club or office. trade: swap help. free: a favor.
export const PAY_TYPES = ["pay", "fund", "trade", "free"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export type PaymentMethod = "venmo" | "card";
export type PaymentStatus = "held" | "released" | "refunded";

// Mocked: no money moves. All amounts in cents.
export type Payment = {
  amountCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  totalCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  heldAt: number;
  releasedAt?: number;
  refundedAt?: number;
};

export type BoardCard = {
  token: string;
  // User id of whoever posted it ("seed" for demo cards). Never sent to browsers.
  askerId: string;
  title: string;
  // "What done looks like": where, when, details.
  text: string;
  category: AskCategory;
  payType: PayType;
  minutes: number;
  // Whole dollars. 0 = a favor.
  price: number;
  anonymous: boolean;
  // Sent only to picked helpers; never on the board or in a group.
  private: boolean;
  // Shown only when not anonymous.
  askerFirstName?: string;
  // Shown when the asker allows it ("Sophomore").
  askerYear?: string;
  status: CardStatus;
  createdAt: number;
  startsAt?: number;
  neededBy?: number;
  expiresAt: number;
  // Groups the bot has shared this card to.
  shares: { groupId: string; postedAt: number }[];
  heldBy?: { userId: string; firstName: string; email: string; year?: string; heldAt: number };
  meetingSpot?: string;
  // The helper tapped "Done". The asker confirms, or it auto-confirms at autoConfirmAt.
  helperDoneAt?: number;
  autoConfirmAt?: number;
  // The asker reported a problem; auto-confirm is paused.
  problemReportedAt?: number;
  payment?: Payment;
  thanks?: string;
};

// Who is looking at a card, so the UI knows which buttons to show.
// "invited": a helper the asker picked for a private ask.
export type CardViewer = "asker" | "helper" | "invited" | "other" | "signed-out";

// What any browser may see. Never includes user ids, the helper's email (contact
// info is shared only after both say yes) or the asker's name on anonymous cards.
export type PublicCard = Omit<BoardCard, "askerId" | "heldBy" | "payment"> & {
  heldByFirstName?: string;
  heldByYear?: string;
  // Only the asker and the helper see payment details.
  payment?: Payment;
  viewer: CardViewer;
};

export type InboxKind = "action" | "update";
export type InboxTopic = "tasks" | "groups" | "payments";

export type InboxItem = {
  id: string;
  // The ask it's about, if any.
  token?: string;
  kind: InboxKind;
  topic: InboxTopic;
  // Short headline ("Maya can help") and the line under it. Never names an anonymous asker.
  title: string;
  text: string;
  createdAt: number;
  read: boolean;
};

export type Message = {
  id: string;
  // Never a user id: just whether you sent it.
  fromMe: boolean;
  senderFirstName: string;
  body: string;
  createdAt: number;
};

// A private ask waiting in a helper's inbox.
export type PrivateRequest = {
  card: PublicCard;
  sentAt: number;
  response?: "yes" | "no";
};

export type Profile = {
  firstName: string;
  email: string;
  phone?: string;
  classYear?: string;
  showClassYear: boolean;
  canAcceptPayment: boolean | null;
  payoutMethod?: "venmo" | "bank";
  payoutHandle?: string;
  interests: Interest[];
  weeklyLimit: number;
  emailNotifications: boolean;
};

// "Blocked people". Labels never reveal an anonymous asker.
export type BlockedEntry = { key: string; label: string };

// Mocked helper setup on the claim page for paid cards.
export type HelperSetup = {
  canAcceptPayment: boolean;
  payoutMethod?: "venmo" | "bank";
  payoutAccount: string;
};

// Standard server action result: success data or a user-facing error message.
export type Result<T extends object = object> = ({ ok: true } & T) | { error: string };

export type Claim = {
  firstName: string;
  email: string;
  meetingSpot: string;
  claimedAt: number;
};

export type Post = {
  token: string;
  groupId: string;
  text: string;
  anonymous: boolean;
  createdAt: number;
  claim?: Claim;
  thanks?: string;
};
