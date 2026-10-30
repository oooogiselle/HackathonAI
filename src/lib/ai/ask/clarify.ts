import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import type { ClarifyQuestion } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const schema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(4),
      }),
    )
    .max(2),
});

const INSTRUCTIONS = `A college student (often an international student) needs practical help and wrote a vague request.
Ask AT MOST 2 quick questions that would make the ask clear and small enough for a peer to say yes.
Each question has 2–4 short tappable answers (1–4 words each). Skip questions the request already answers.
Use plain, friendly English.`;

function fallback(need: string): ClarifyQuestion[] {
  if (/airport|ride|drive|car/i.test(need)) {
    return [
      {
        question: "When do you need the ride?",
        options: ["Today", "This week", "Over break", "Flexible"],
      },
      { question: "How much luggage?", options: ["Just a backpack", "1–2 bags", "Lots"] },
    ];
  }
  if (/move|moving|fridge|furniture|carry/i.test(need)) {
    return [
      {
        question: "How far is it going?",
        options: ["Same building", "Across campus", "Off campus"],
      },
      { question: "When?", options: ["Today", "This weekend", "Flexible"] },
    ];
  }
  return [
    { question: "When do you need this?", options: ["Today", "This week", "Flexible"] },
    { question: "How long might it take?", options: ["< 15 min", "About an hour", "Half a day"] },
  ];
}

export async function clarify(need: string): Promise<ClarifyQuestion[]> {
  return withFallback(
    "clarify",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: need,
        output: Output.object({ schema }),
      });
      return output.questions.slice(0, 2);
    },
    () => fallback(need),
  );
}
