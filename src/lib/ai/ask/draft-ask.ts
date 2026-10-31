// Breaks one need into 1–4 small asks, each with what / when / where, minutes,
// who'd be a good fit and a suggested price. The model never sets the price
// (see src/lib/ask/price.ts), and each part gets its own keyword safety pass.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { composeAskText } from "@/lib/ask/format";
import { guessHelperPrefs, INTERESTS, KNOWN_TAGS, toHelperPrefs } from "@/lib/ask/helper-fit";
import { suggestPrice } from "@/lib/ask/price";
import type { AskPart, ClarifyAnswer, DraftResult, HelperPrefs } from "@/lib/ask/types";

import { withFallback } from "./fallback";
import { keywordCheck } from "./safety-check";

const MAX_PARTS = 4;
const FALLBACK_MINUTES = 30;

const schema = z.object({
  parts: z
    .array(
      z.object({
        what: z.string().describe('Short label, e.g. "Ride to BTV airport"'),
        when: z.string().optional().describe('Human time if given, e.g. "Sat Nov 1, 7:00am"'),
        startsAt: z.string().optional().describe("ISO 8601 start time, only if a time was given"),
        where: z.string().optional().describe('Place if given, e.g. "from East Hall"'),
        minutes: z.number().int().describe("Realistic minutes the helper spends, 5–240"),
        text: z.string().describe("The friendly ask, under 280 characters"),
        helper: z.object({
          interests: z.array(z.enum(INTERESTS as [string, ...string[]])),
          needs: z.array(z.string()).describe("Must-haves, only from the allowed tag list"),
          nice: z.array(z.string()).describe("Up to 3 short nice-to-haves"),
          why: z.string().describe('One line: "Someone with a car who\'s free Saturday morning"'),
        }),
      }),
    )
    .min(1),
});

const INSTRUCTIONS = `Break a college student's need into the smallest separate asks a peer could each say yes to on their own.
If it's already one small thing, return exactly one. At most ${MAX_PARTS}.
For each ask:
- what / when / where: only details the student gave. Don't invent times, places or personal details.
- startsAt: ISO 8601, only if the student gave a day or time; resolve relative days from today's date.
- minutes: realistic time the helper spends.
- text: under 280 characters, first person, friendly and polite; says what, when and roughly how long. Small and specific. No hashtags, no emojis, no prices or offers of money (price is set separately).
- helper: what kind of helper fits, using only what the need implies (e.g. airport + luggage → needs "car").
  interests from the allowed list. needs only from the allowed tag list. Never prefer a gender, nationality or religion; name a language only if the student asked for one.`;

type RawPart = z.infer<typeof schema>["parts"][number];

function toPart(raw: Omit<RawPart, "helper">, helper: HelperPrefs): AskPart | null {
  const { category } = keywordCheck(`${raw.what} ${raw.text}`);
  if (category === "academic" || category === "crisis") return null;
  const minutes = Math.min(240, Math.max(5, Math.round(raw.minutes)));
  const price = suggestPrice(minutes, helper.interests);
  const startsAt =
    raw.startsAt && !Number.isNaN(Date.parse(raw.startsAt)) ? raw.startsAt : undefined;
  return {
    what: raw.what.trim(),
    when: raw.when?.trim() || undefined,
    startsAt,
    where: raw.where?.trim() || undefined,
    minutes,
    helper,
    price,
    priceSet: price.suggested,
    text: raw.text.trim().slice(0, 280),
    category,
  };
}

function fallback(need: string, answers: ClarifyAnswer[]): DraftResult {
  const base = need.trim().replace(/[.!?]+$/, "");
  const details = answers.map((a) => a.answer).join(", ");
  const what = details ? `${base} (${details})` : base;
  const raw = { what, minutes: FALLBACK_MINUTES };
  const part = toPart({ ...raw, text: composeAskText(raw) }, guessHelperPrefs(need));
  return { parts: part ? [part] : [] };
}

export async function draftAsk(need: string, answers: ClarifyAnswer[]): Promise<DraftResult> {
  return withFallback(
    "draftAsk",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: [
          `Today: ${new Date().toISOString()}`,
          `Allowed interests: ${INTERESTS.join(", ")}`,
          `Allowed needs tags: ${KNOWN_TAGS.join(", ")}`,
          `Need: ${need}`,
          `Answers:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n") || "(none)"}`,
        ].join("\n"),
        output: Output.object({ schema }),
      });
      const parts = output.parts
        .slice(0, MAX_PARTS)
        .flatMap((p) => toPart(p, toHelperPrefs(p.helper)) ?? []);
      return { parts };
    },
    () => fallback(need, answers),
  );
}
