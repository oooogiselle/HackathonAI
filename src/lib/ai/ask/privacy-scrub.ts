// For anonymous posts: strip identifying details and report what was removed
// so the user can review (and undo) before posting.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { EMAIL_PATTERN, PHONE_PATTERN } from "@/lib/ask/contact-info";
import { DORMS } from "@/lib/ask/mock-data";
import type { ScrubResult } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const schema = z.object({
  text: z.string().describe("The ask with identifying details removed or generalized"),
  removed: z.array(z.string()).describe("Each exact detail that was removed or changed"),
});

const INSTRUCTIONS = `This help request will be posted anonymously to a student group chat.
Remove or generalize anything that could identify the writer: names, emails, phone numbers,
room or dorm names, exact addresses, student IDs, home country or city if combined with other details,
flight numbers. Keep the ask useful (keep the general time and task). Change nothing else.
List each removed detail exactly as it appeared.`;

const PATTERNS: [RegExp, string][] = [
  [EMAIL_PATTERN, "[email]"],
  [PHONE_PATTERN, "[phone]"],
  // Name must be capitalized, so "i'm in" isn't treated as a name.
  [/\b(?:[Mm]y name is|[Ii]'m|[Ii] am|[Tt]his is)\s+[A-Z][a-z]+,?/g, ""],
  // "in Kessler Hall room 214" → "on campus"
  [
    new RegExp(
      `\\b(?:in|at|from)\\s+(?:${DORMS.join("|")})(?:,?\\s*(?:room|rm\\.?)\\s*#?\\d+[a-z]?)?`,
      "gi",
    ),
    "on campus",
  ],
  [new RegExp(`\\b(?:${DORMS.join("|")})\\b`, "gi"), "my dorm"],
  [/\b(?:room|rm\.?)\s*#?\d+[a-z]?\b/gi, "my room"],
  [/\bflight\s*[A-Z]{2}\s?\d{2,4}\b/gi, "my flight"],
];

function fallback(text: string): ScrubResult {
  const removed: string[] = [];
  let scrubbed = text;
  for (const [pattern, replacement] of PATTERNS) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      removed.push(match.trim());
      return replacement;
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
      return output;
    },
    () => fallback(text),
  );
}
