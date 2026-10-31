// Optional AI help for the "write it myself" form: better wording, a time
// estimate, who'd fit, and what's missing. Only runs when the student taps
// "Get suggestions", and nothing is applied until they tap "Use".
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { composeAskText } from "@/lib/ask/format";
import { guessHelperPrefs, INTERESTS, KNOWN_TAGS, toHelperPrefs } from "@/lib/ask/helper-fit";
import type { AssistSuggestions, HelperPrefs } from "@/lib/ask/types";

import { HELPER_RULE, helperSchema } from "./draft-ask";
import { withFallback } from "./fallback";

export type AssistInput = {
  what: string;
  details: string;
  when?: string;
  where?: string;
  minutes: number;
};

const MAX_MISSING = 2;

const schema = z.object({
  text: z.string().describe("Improved ask, under 280 characters"),
  minutes: z.number().int().describe("Realistic minutes the helper spends, 5–240"),
  helper: helperSchema,
});

const INSTRUCTIONS = `A college student filled in a form to ask a peer for help. Suggest improvements; they decide what to use.
- text: rewrite their details as one short, friendly, specific ask in first person, under 280 characters. Keep their meaning. Don't add times, places or personal details they didn't give. No hashtags, no emojis, no prices.
- minutes: realistic time the helper spends.
- ${HELPER_RULE}`;

// Deterministic, so nudges match the fields on screen even when the AI is on.
function missingInfo(input: AssistInput, helper: HelperPrefs): AssistSuggestions["missing"] {
  const missing: AssistSuggestions["missing"] = [];
  if (!input.when) {
    missing.push({ field: "when", hint: "Add a time so helpers know if they're free." });
  }
  const needsPlace = helper.interests.some((i) => i === "rides" || i === "moving");
  if (!input.where && needsPlace) {
    missing.push({ field: "where", hint: "Where should they meet you or pick you up?" });
  }
  if (input.details.trim().length < 20) {
    missing.push({ field: "details", hint: "A sentence more helps people say yes." });
  }
  return missing.slice(0, MAX_MISSING);
}

function clampMinutes(minutes: number) {
  return Math.min(240, Math.max(5, Math.round(minutes)));
}

export async function assistAsk(input: AssistInput): Promise<AssistSuggestions> {
  const suggestion = await withFallback(
    "assistAsk",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: [
          `Allowed interests: ${INTERESTS.join(", ")}`,
          `Allowed needs tags: ${KNOWN_TAGS.join(", ")}`,
          `Title: ${input.what}`,
          `Details: ${input.details || "(empty)"}`,
          `When: ${input.when || "(not given)"}`,
          `Where: ${input.where || "(not given)"}`,
          `Their time estimate: ${input.minutes} min`,
        ].join("\n"),
        output: Output.object({ schema }),
      });
      return {
        text: output.text.trim().slice(0, 280),
        minutes: clampMinutes(output.minutes),
        helper: toHelperPrefs(output.helper),
      };
    },
    () => ({
      text: input.details.trim() || composeAskText(input),
      minutes: input.minutes,
      helper: guessHelperPrefs(`${input.what} ${input.details}`),
    }),
  );
  return { ...suggestion, missing: missingInfo(input, suggestion.helper) };
}
