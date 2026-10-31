// For anonymous posts: strip identifying details and report what was removed
// so the user can review (and undo) before posting.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { EMAIL_PATTERN, PHONE_PATTERN } from "@/lib/ask/contact-info";
import { GREEK_PATTERN, hallPattern, HOUSE_COMMUNITIES, OTHER_HALLS } from "@/lib/ask/dartmouth";
import type { ScrubResult } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const schema = z.object({
  text: z.string().describe("The ask with identifying details removed or generalized"),
  removed: z.array(z.string()).describe("Each exact detail that was removed or changed"),
});

const INSTRUCTIONS = `This help request will be posted anonymously to a student group chat at Dartmouth.
Remove or generalize anything that could identify the writer: names, emails, phone numbers,
room numbers, exact addresses, student IDs, home country or city if combined with other details,
flight numbers. A residence hall may be generalized to its house community (e.g. "Fahey" → "West House").
A fraternity, sorority or society name becomes "a Greek house". Keep the ask useful (keep the general
time and task). Change nothing else. List each removed detail exactly as it appeared.`;

type Replacement = string | ((match: string) => string);

const ROOM = String.raw`(?:,?\s*(?:room|rm\.?)\s*#?\d+[a-z]?)?`;
// "in Fahey room 214" → "in West House": keep the little word in front.
const withPrep = (halls: string[]) =>
  new RegExp(
    String.raw`\b(?:in|at|from|to)\s+(?:the\s+)?${hallPattern(halls).source}${ROOM}`,
    "giu",
  );
const keepPrep =
  (place: string): Replacement =>
  (match) =>
    `${match.trim().split(/\s+/)[0]} ${place}`;

// Keyword pass. Runs on its own without a model, and after the model otherwise,
// so these details are always caught (it can only remove more).
const PATTERNS: [RegExp, Replacement][] = [
  [EMAIL_PATTERN, "[email]"],
  [PHONE_PATTERN, "[phone]"],
  // Name must be capitalized, so "i'm in" isn't treated as a name.
  [/\b(?:[Mm]y name is|[Ii]'m|[Ii] am|[Tt]his is)\s+[A-Z][a-z]+,?/g, ""],
  // A hall becomes its house community: about 600 people, so it still says "nearby".
  ...HOUSE_COMMUNITIES.flatMap((h): [RegExp, Replacement][] => [
    [withPrep(h.halls), keepPrep(h.name)],
    [new RegExp(hallPattern(h.halls).source + ROOM, "giu"), h.name],
  ]),
  // Halls not tied to one house: "in McLaughlin room 3" → "on campus".
  [withPrep(OTHER_HALLS), "on campus"],
  [new RegExp(hallPattern(OTHER_HALLS).source + ROOM, "giu"), "my dorm"],
  // A Greek house narrows it to a few dozen people.
  [GREEK_PATTERN, "a Greek house"],
  [/\b(?:room|rm\.?)\s*#?\d+[a-z]?\b/gi, "my room"],
  [/\bflight\s*[A-Z]{2}\s?\d{2,4}\b/gi, "my flight"],
];

function keywordScrub(text: string): ScrubResult {
  const removed: string[] = [];
  let scrubbed = text;
  for (const [pattern, replacement] of PATTERNS) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      removed.push(match.trim());
      return typeof replacement === "string" ? replacement : replacement(match);
    });
  }
  return {
    text: scrubbed
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/([:(])\s*,\s*/g, "$1 ")
      .trim(),
    removed,
  };
}

export { keywordScrub as fallbackScrub };

export async function privacyScrub(text: string): Promise<ScrubResult> {
  return withFallback(
    "privacyScrub",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: text,
        output: Output.object({ schema }),
      });
      // The model can only add removals: the keyword pass still runs on its result.
      const after = keywordScrub(output.text);
      return {
        text: after.text,
        removed: [...new Set([...output.removed, ...after.removed])],
      };
    },
    () => keywordScrub(text),
  );
}
