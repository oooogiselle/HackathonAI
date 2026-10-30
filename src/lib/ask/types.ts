// Shared types for the Ask flow. Plain data only; no DB schema yet.
// TODO(db): turn Post/Claim into tables once the demo flow is settled.

// Ordered least → most restrictive (see SAFETY_SEVERITY in safety-check.ts).
// - ok: normal practical ask
// - sensitive: visa / money / health. Peers + offices only, never group chats
// - academic: "write my essay" style. Redirect to tutoring
// - crisis: show professional resources only. Never match, never post
export type SafetyCategory = "ok" | "sensitive" | "academic" | "crisis";

export type SafetyResult = { category: SafetyCategory; reason: string };

export type ClarifyQuestion = { question: string; options: string[] };

export type ClarifyAnswer = { question: string; answer: string };

export type Helper = {
  id: string;
  firstName: string;
  year: string;
  blurb: string;
  tags: string[];
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
