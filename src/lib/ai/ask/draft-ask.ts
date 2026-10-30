import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import type { ClarifyAnswer } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const schema = z.object({
  ask: z.string().describe("The drafted ask, under 280 characters"),
});

const INSTRUCTIONS = `Turn a student's vague need plus their answers into ONE short, specific ask for a peer.
Rules: under 280 characters, first person, friendly and polite, say exactly what, when, and roughly how long.
Make it easy to say yes to (small and specific). No hashtags, no emojis, no offers of money.
Don't add personal details the student didn't give.`;

function fallback(need: string, answers: ClarifyAnswer[]) {
  const details = answers.map((a) => a.answer).join(", ");
  const base = need.trim().replace(/[.!?]+$/, "");
  return `Hi! Could anyone help me with this: ${base}${details ? ` (${details})` : ""}? Happy to work around your schedule. Thank you!`;
}

export async function draftAsk(need: string, answers: ClarifyAnswer[]): Promise<string> {
  return withFallback(
    "draftAsk",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: `Need: ${need}\nAnswers:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n") || "(none)"}`,
        output: Output.object({ schema }),
      });
      return output.ask;
    },
    () => fallback(need, answers),
  );
}
