// Ask categories are free text: the "Who to ask" interests as presets, plus
// anything the asker types under "Other". Suggestions rank presets and categories
// already on the board (embeddings when OPENAI_API_KEY is set, else these
// keywords). Client-safe.
import type { Interest } from "./types";

export type CategoryPreset = {
  label: string;
  // The helper interest this preset matches (same label as on Who to ask).
  interest: Interest;
  // What the category covers; embedded for suggestions.
  about: string;
  keywords: string[];
  style?: string;
};

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    label: "Rides",
    interest: "rides",
    about: "a ride or lift in a car: airport, bus station, store, appointment",
    keywords: ["ride", "drive", "airport", "car", "lift", "bus", "pick up", "drop off", "lebanon", "boston"],
    style: "bg-[#ffead5] text-[#9a4300]",
  },
  {
    label: "Moving stuff",
    interest: "moving",
    about: "carrying boxes, furniture or luggage, moving rooms, storage",
    keywords: ["move", "moving", "boxes", "carry", "furniture", "storage", "suitcase", "luggage"],
    style: "bg-[#ffead5] text-[#9a4300]",
  },
  {
    label: "US paperwork",
    interest: "us-paperwork",
    about: "US paperwork and systems: SSN, bank account, phone plan, forms, taxes, insurance",
    keywords: ["ssn", "bank", "form", "paperwork", "tax", "insurance", "phone plan", "license", "apply"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
  {
    label: "Cooking",
    interest: "cooking",
    about: "cooking, recipes, kitchen help, groceries",
    keywords: ["cook", "cooking", "food", "rice", "recipe", "kitchen", "meal", "dumpling", "groceries"],
    style: "bg-pay text-secondary-foreground",
  },
  {
    label: "Language practice",
    interest: "language",
    about: "English or language practice, conversation, pronunciation",
    keywords: ["english", "language", "conversation", "practice", "pronunciation", "speak", "chinese", "spanish"],
    style: "bg-[#ede7ff] text-[#5b3cc4]",
  },
  {
    label: "Course advice",
    interest: "course-advice",
    about: "which classes to take, majors, professors, registration",
    keywords: ["course", "class", "major", "professor", "registration", "schedule", "advice"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
  {
    label: "Been through OPT",
    interest: "opt",
    about: "OPT, CPT, internships and work authorization for international students",
    keywords: [" opt ", " cpt ", "internship", "work authorization", "ead"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
];

export const DEFAULT_CATEGORY = "Other";
export const MAX_CATEGORY_LENGTH = 24;

const OTHER_STYLE = "bg-muted text-muted-foreground";

function findPreset(label: string) {
  const key = label.trim().toLowerCase();
  return CATEGORY_PRESETS.find((p) => p.label.toLowerCase() === key);
}

/** The helper interest behind a preset category, if it is one. */
export function interestForCategory(label: string) {
  return findPreset(label)?.interest;
}

export function categoryForInterest(interest: Interest) {
  return CATEGORY_PRESETS.find((p) => p.interest === interest)!.label;
}

/** Tidy a typed category: collapse spaces, cap length, capitalize, reuse a preset's spelling. */
export function normalizeCategory(raw: string) {
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_LENGTH).trim();
  if (!clean) return DEFAULT_CATEGORY;
  return findPreset(clean)?.label ?? clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function categoryStyle(label: string) {
  return findPreset(label)?.style ?? OTHER_STYLE;
}

// Words in a category label count as keywords too, so typed categories match.
function keywordsFor(label: string) {
  const preset = findPreset(label);
  const words = label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return [...(preset?.keywords ?? []), ...words];
}

/** No-embedding ranking: how many of each candidate's keywords appear in the text. */
export function rankCategoriesByKeyword(text: string, candidates: string[], limit = 3) {
  const lower = ` ${text.toLowerCase()} `;
  return candidates
    .map((label) => ({
      label,
      score: keywordsFor(label).filter((k) => lower.includes(k)).length,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => c.label);
}

/** A best guess for the AI path, where nobody picked a category. */
export function guessCategoryFromText(text: string) {
  const presets = CATEGORY_PRESETS.map((p) => p.label);
  return rankCategoriesByKeyword(text, presets, 1)[0] ?? DEFAULT_CATEGORY;
}

/** The text that gets embedded for a category. */
export function categoryEmbeddingText(label: string) {
  const preset = findPreset(label);
  return preset ? `${preset.label}: ${preset.about}` : label;
}
