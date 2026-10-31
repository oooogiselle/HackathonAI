// Who'd be a good fit for an ask, counted against the seeded helpers. A preview
// for the Your ask screen; matchHelpers (Phase 2) adds free/busy, weekly limits
// and load spreading and picks the actual 2–3 people. Safe to run on the client.
import { campusTags, canonicalTag, isCommunityTag, mentionsTag } from "./dartmouth";
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

// Every skill tag a seeded helper has; "needs" must come from this list. House and
// Greek tags are left out: where someone lives is a boost, never a must-have.
export const KNOWN_TAGS = [...new Set(HELPERS.flatMap((h) => h.tags))]
  .filter((t) => !isCommunityTag(t))
  .sort();

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
  // Whole words only, so "id" doesn't match inside "need"; campus words count
  // too ("Dartmouth Coach" → airport, ride).
  const implied = campusTags(need);
  const mentions = (tag: string) => mentionsTag(need, tag) || implied.includes(tag);
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

// ---------- a helper describing themselves ----------

export type SkillSuggestion = { interests: Interest[]; tags: string[] };

export const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;

/**
 * Cleans tags from the model, the client or a typed box: lowercase, trimmed,
 * 2–24 characters, deduped, never an email or phone number (tags are public).
 */
export function cleanTags(tags: string[], limit = MAX_TAGS): string[] {
  const clean = tags
    // Contact details never become tags, even with the punctuation stripped.
    .filter((t) => !t.includes("@") && !/\d[\d\s().-]{5,}\d/.test(t))
    .map((t) =>
      t
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((t) => t.length >= 2 && t.length <= MAX_TAG_LENGTH)
    // "Psi U" → "psi upsilon", "Fahey" → "west house", so matching sees one name.
    .map(canonicalTag);
  return [...new Set(clean)].slice(0, limit);
}

export function cleanSkills(raw: { interests: string[]; tags: string[] }): SkillSuggestion {
  return {
    interests: INTERESTS.filter((i) => raw.interests.includes(i)),
    tags: cleanTags(raw.tags, 6),
  };
}

// No-AI guess: known tags mentioned in the text, and the interests that go with them.
export function guessSkills(text: string): SkillSuggestion {
  return cleanSkills({
    interests: guessHelperPrefs(text).interests,
    tags: KNOWN_TAGS.filter((tag) => mentionsTag(text, tag)),
  });
}
