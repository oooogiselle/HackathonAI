// Ask categories are free text: a set of presets, plus anything the asker types
// under "Other". Suggestions rank presets and categories already on the board
// (embeddings when OPENAI_API_KEY is set, else these keywords). Client-safe.

export type CategoryPreset = {
  label: string;
  // What the category covers; embedded for suggestions.
  about: string;
  keywords: string[];
  style?: string;
};

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    label: "Rides",
    about: "a ride or lift in a car: airport, bus station, store, appointment",
    keywords: ["ride", "drive", "airport", "car", "lift", "bus", "pick up", "drop off", "lebanon", "boston"],
    style: "bg-[#ffead5] text-[#9a4300]",
  },
  {
    label: "Moving",
    about: "carrying boxes, furniture or luggage, moving rooms, storage",
    keywords: ["move", "moving", "boxes", "carry", "furniture", "storage", "suitcase", "lift"],
    style: "bg-[#ffead5] text-[#9a4300]",
  },
  {
    label: "Errands",
    about: "picking something up, shopping, mail, returning things, borrowing or lending items",
    keywords: ["errand", "pick up", "groceries", "store", "package", "mail", "borrow", "lend", "return"],
    style: "bg-[#ffead5] text-[#9a4300]",
  },
  {
    label: "Paperwork",
    about: "US paperwork and systems: SSN, bank account, phone plan, forms, taxes, insurance",
    keywords: ["ssn", "bank", "form", "paperwork", "tax", "insurance", "phone plan", "license", "apply"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
  {
    label: "Food",
    about: "cooking, recipes, kitchen help, where to eat",
    keywords: ["cook", "cooking", "food", "rice", "recipe", "kitchen", "eat", "meal", "dumpling"],
    style: "bg-pay text-secondary-foreground",
  },
  {
    label: "Language",
    about: "English or language practice, conversation, pronunciation",
    keywords: ["english", "language", "conversation", "practice", "pronunciation", "speak", "chinese", "spanish"],
    style: "bg-[#ede7ff] text-[#5b3cc4]",
  },
  {
    label: "Tech help",
    about: "fixing a laptop or phone, wifi, printer, software setup",
    keywords: ["laptop", "computer", "phone", "wifi", "printer", "install", "setup", "tech"],
    style: "bg-[#ede7ff] text-[#5b3cc4]",
  },
  {
    label: "Coding",
    about: "programming help, debugging, learning a coding tool",
    keywords: ["code", "coding", "python", "java", "bug", "debug", "program", "git"],
    style: "bg-[#ede7ff] text-[#5b3cc4]",
  },
  {
    label: "Writing",
    about: "feedback on writing such as an email, cover letter or resume",
    keywords: ["write", "writing", "email", "resume", "cover letter", "proofread", "feedback"],
    style: "bg-pay text-secondary-foreground",
  },
  {
    label: "Lab",
    about: "lab equipment, science lab skills, research lab questions",
    keywords: ["lab", "experiment", "microscope", "research", "chemistry", "biology"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
  {
    label: "Course advice",
    about: "which classes to take, majors, professors, registration",
    keywords: ["course", "class", "major", "professor", "registration", "schedule", "advice"],
    style: "bg-[#e2eeff] text-[#1d5fb8]",
  },
  {
    label: "Winter gear",
    about: "winter clothes, coats, boots, getting ready for cold weather",
    keywords: ["coat", "winter", "boots", "jacket", "cold", "snow", "gloves"],
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
