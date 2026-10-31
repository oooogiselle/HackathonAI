// Who'd be a good fit for an ask, counted against the seeded helpers. A preview
// for the Your ask screen; matchHelpers (Phase 2) adds free/busy, weekly limits
// and load spreading and picks the actual 2–3 people. Safe to run on the client.
import { HELPERS } from "./mock-data";
import type { Helper, HelperPrefs, Interest } from "./types";

export const INTERESTS: Interest[] = [
  "rides",
  "moving",
  "us-paperwork",
  "cooking",
  "language",
  "course-advice",
  "opt",
];

export const INTEREST_LABELS: Record<Interest, string> = {
  rides: "Rides",
  moving: "Moving stuff",
  "us-paperwork": "US paperwork",
  cooking: "Cooking",
  language: "Language practice",
  "course-advice": "Course advice",
  opt: "Been through OPT",
};

// Every tag a seeded helper has; "needs" must come from this list.
export const KNOWN_TAGS = [...new Set(HELPERS.flatMap((h) => h.tags))].sort();

export function helperFits(helper: Helper, interests: Interest[], needs: string[]) {
  const interestOk = interests.length === 0 || helper.interests.some((i) => interests.includes(i));
  return interestOk && needs.every((n) => helper.tags.includes(n));
}

export function countFits(interests: Interest[], needs: string[], helpers = HELPERS) {
  const fit = helpers.filter((h) => helperFits(h, interests, needs));
  return { fits: fit.length, fitsPaid: fit.filter((h) => h.canAcceptPayment).length };
}

// Cleans what the model (or the client) sent and fills in the counts.
export function toHelperPrefs(raw: {
  interests: string[];
  needs: string[];
  nice: string[];
  why: string;
}): HelperPrefs {
  const interests = INTERESTS.filter((i) => raw.interests.includes(i));
  const needs = [...new Set(raw.needs.map((n) => n.trim().toLowerCase()))].filter((n) =>
    KNOWN_TAGS.includes(n),
  );
  const nice = raw.nice
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 3);
  return { interests, needs, nice, why: raw.why.trim(), ...countFits(interests, needs) };
}

// No-AI guess: interests of helpers whose tags appear in the need.
export function guessHelperPrefs(need: string): HelperPrefs {
  const text = need.toLowerCase();
  // Whole words only, so "id" doesn't match inside "need".
  const mentions = (tag: string) => new RegExp(`\\b${tag}s?\\b`).test(text);
  const interests = INTERESTS.filter((i) =>
    HELPERS.some((h) => h.interests.includes(i) && h.tags.some(mentions)),
  );
  return toHelperPrefs({
    interests,
    needs: [],
    nice: [],
    why: "Someone who's helped with this before",
  });
}
