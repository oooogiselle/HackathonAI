// Me tab: a helper describes what they could help with in their own words; this
// turns it into interest chips and a few specific tags (matching reads both).
// Suggestions only: nothing is added to the profile without a tap.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import {
  cleanSkills,
  guessSkills,
  INTEREST_LABELS,
  INTERESTS,
  KNOWN_TAGS,
  type SkillSuggestion,
} from "@/lib/ask/helper-fit";

import { withFallback } from "./fallback";

const schema = z.object({
  interests: z.array(z.string()),
  tags: z.array(z.string()),
});

const INSTRUCTIONS = `A college student wrote, in their own words, what they could help classmates with.
Turn it into:
- interests: the ids from this list that fit what they said: ${INTERESTS.map((i) => `${i} (${INTEREST_LABELS[i]})`).join(", ")}.
- tags: 2-6 short lowercase keywords (1-2 words) for the specifics they mentioned, like "car", "airport", "korean", "ikea furniture". Prefer these known tags when they fit: ${KNOWN_TAGS.join(", ")}.
Only use what they actually said; never invent skills. Never include names, dorms, room numbers, emails or phone numbers.`;

export async function suggestSkills(text: string): Promise<SkillSuggestion> {
  return withFallback(
    "suggestSkills",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: text,
        output: Output.object({ schema }),
      });
      return cleanSkills(output);
    },
    () => guessSkills(text),
  );
}
