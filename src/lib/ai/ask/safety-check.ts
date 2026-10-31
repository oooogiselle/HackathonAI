// Runs before every other step. A deterministic keyword pass always runs; the
// model can only make the result *more* restrictive, never less.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import type { SafetyCategory, SafetyResult } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const SAFETY_SEVERITY: Record<SafetyCategory, number> = {
  none: 0,
  sensitive: 1,
  academic: 2,
  crisis: 3,
};

const KEYWORDS: [SafetyCategory, RegExp, string][] = [
  [
    "crisis",
    /suicid|kill myself|end my life|want to die|self[- ]?harm|hurt myself|overdos|being abused|assault/i,
    "This sounds serious. Please reach out to people trained to help.",
  ],
  [
    "academic",
    /\b(write|do|finish)\b.{0,20}\b(essay|paper|homework|assignment|problem set|thesis)\b|\btake my (exam|test|quiz)\b/i,
    "Ask can't do coursework for you, but tutors can help you do it yourself.",
  ],
  [
    "sensitive",
    /\b(visas?|i-20|sevis|immigration|opt|cpt|green card|money|loans?|borrow|rent|debt|cash|venmo|medical|doctors?|health|therapy|prescriptions?|medications?)\b|pregnan/i,
    "This is personal, so we'll suggest people and offices, not group chats.",
  ],
];

export function keywordCheck(text: string): SafetyResult {
  for (const [category, pattern, reason] of KEYWORDS) {
    if (pattern.test(text)) return { category, reason };
  }
  return { category: "none", reason: "" };
}

const schema = z.object({
  category: z.enum(["none", "sensitive", "academic", "crisis"]),
  reason: z.string().describe("One short, kind sentence shown to the student"),
});

const INSTRUCTIONS = `You screen help requests from college students before they are shared with peers.
Classify the request:
- "crisis": self-harm, suicide, abuse, danger, or a mental health emergency
- "academic": asking someone to do graded work for them (write an essay, take a test)
- "sensitive": visa/immigration, money, or health details that should not go in a group chat
- "none": everyday practical help (rides, errands, moving, paperwork logistics)
When unsure between two, pick the more cautious one.`;

export async function safetyCheck(text: string): Promise<SafetyResult> {
  const byKeyword = keywordCheck(text);
  // Crisis short-circuits: no need to wait on a model call.
  if (byKeyword.category === "crisis") return byKeyword;

  const byModel = await withFallback(
    "safetyCheck",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: text,
        output: Output.object({ schema }),
      });
      return output;
    },
    () => byKeyword,
  );

  return SAFETY_SEVERITY[byModel.category] >= SAFETY_SEVERITY[byKeyword.category]
    ? byModel
    : byKeyword;
}
