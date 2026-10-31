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
export type Interest =
  "rides" | "moving" | "us-paperwork" | "cooking" | "language" | "course-advice" | "opt";

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

export type DraftResult = {
  ask: string;
  minutes: number;
  suggestedPrice: PriceRange;
};

// One ask = one card, whether seen on the board or opened from a GroupMe link.
// open → held (first "I can help") → confirmed (asker picks them) → done.
// Any state before done can become cancelled; open/held become expired at expiresAt.
export type CardStatus = "open" | "held" | "confirmed" | "done" | "expired" | "cancelled";

export type BoardCard = {
  token: string;
  // Supabase user id of whoever posted it ("seed" for demo cards). Never sent to browsers.
  askerId: string;
  text: string;
  minutes: number;
  price: number;
  anonymous: boolean;
  // Shown only when not anonymous.
  askerFirstName?: string;
  status: CardStatus;
  createdAt: number;
  expiresAt: number;
  // Group ids the bot has shared this card to.
  sharedTo: string[];
  heldBy?: { userId: string; firstName: string; email: string; heldAt: number };
  meetingSpot?: string;
  // Mocked payment: set when the asker taps "Pay $X" after done. Free cards never set it.
  paidAt?: number;
  thanks?: string;
};

// Who is looking at a card, so the UI knows which buttons to show.
export type CardViewer = "asker" | "helper" | "other" | "signed-out";

// What any browser may see. Never includes user ids, the helper's email (contact
// info is shared only after both say yes) or the asker's name on anonymous cards.
export type PublicCard = Omit<BoardCard, "askerId" | "heldBy"> & {
  heldByFirstName?: string;
  viewer: CardViewer;
};

// Mocked helper setup on the claim page for paid cards.
export type HelperSetup = { canAcceptPayment: boolean; payoutAccount: string };

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
