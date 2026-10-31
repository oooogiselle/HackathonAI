// "Try this instead" on Quick check, when an ask asks someone to do graded
// work. Suggests an honest version a classmate *can* help with (talk through
// an outline, quiz me, look at my own draft). Shown only on a tap-to-use card:
// nothing is changed until the student taps "Use this rewrite", and the
// rewrite goes through checkSafety again like any other wording.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";

import { withFallback } from "./fallback";
import { keywordCheck } from "./safety-check";

export type RewriteSuggestion = {
  // Short title for "What do you need?"
  what: string;
  // The details helpers read.
  text: string;
  minutes: number;
};

const schema = z.object({
  what: z.string().describe("Short title, under 70 characters"),
  text: z.string().describe("One or two friendly sentences, under 240 characters"),
  minutes: z.number().int().describe("Realistic minutes, 15–90"),
});

const INSTRUCTIONS = `A college student asked a classmate to do graded work for them, which breaks the honor code, so it can't be posted.
Rewrite it as an honest ask a classmate could help with, where the student still does their own work: talking through an outline or ideas, quizzing them before a test, explaining a concept, studying together, or reading a draft they wrote themselves and giving feedback.
- Keep the subject, course and timing they gave. Don't add details they didn't give.
- Never ask anyone to write, finish, do, solve or take the graded work.
- No prices, no emojis, no names, no contact details.`;

// Words that come before "essay", "exam", ... but aren't the subject.
const NOT_SUBJECTS = new Set([
  "my",
  "the",
  "a",
  "an",
  "this",
  "that",
  "our",
  "your",
  "final",
  "short",
  "long",
  "next",
  "write",
  "do",
  "finish",
  "take",
  "page",
  "pages",
  "word",
  "words",
  "graded",
]);

const KINDS: { pattern: RegExp; build: (subject: string) => RewriteSuggestion }[] = [
  {
    pattern: /\b(exam|test|quiz|midterm|final)\b/i,
    build: (s) => ({
      what: `Study partner before my ${s}exam`,
      text: `Looking for someone to quiz me and talk through the tricky parts before my ${s}exam. I'll bring my notes.`,
      minutes: 45,
    }),
  },
  {
    pattern: /\b(problem set|pset|homework|assignment|worksheet|lab report)\b/i,
    build: (s) => ({
      what: `Explain a concept from my ${s}class`,
      text: `Looking for someone to explain the ideas behind my ${s}problem set so I can work through it myself.`,
      minutes: 30,
    }),
  },
  {
    pattern: /\b(essay|paper|thesis|report|draft)\b/i,
    build: (s) => ({
      what: `Talk through my ${s}essay outline`,
      text: `Looking for a study partner to talk through my ${s}essay outline and give feedback on my own draft.`,
      minutes: 30,
    }),
  },
];

/** "my 5-page history essay" → "history ". Empty when there's no clear subject. */
export function subjectOf(text: string) {
  const m = text.match(
    /\b([a-z][a-z-]{2,})\s+(?:\d+[- ]?pages?\s+)?(?:essay|paper|thesis|report|draft|problem set|pset|homework|assignment|worksheet|lab report|exam|test|quiz|midterm|final|class)\b/i,
  );
  const word = m?.[1]?.toLowerCase();
  return word && !NOT_SUBJECTS.has(word) ? `${word} ` : "";
}

/** No-key / error path: a template by kind of work, with the subject kept. */
export function fallbackRewrite(text: string): RewriteSuggestion {
  const subject = subjectOf(text);
  const kind = KINDS.find((k) => k.pattern.test(text)) ?? KINDS[KINDS.length - 1];
  return kind.build(subject);
}

/** True when the rewrite itself would pass Quick check as an everyday ask. */
export function isSafeRewrite(r: RewriteSuggestion) {
  return keywordCheck(`${r.what}. ${r.text}`).category === "none";
}

function clean(r: RewriteSuggestion): RewriteSuggestion {
  return {
    what: r.what.trim().slice(0, 80),
    text: r.text.trim().slice(0, 280),
    minutes: Math.min(90, Math.max(15, Math.round(r.minutes))),
  };
}

export async function suggestRewrite(blockedAsk: string): Promise<RewriteSuggestion> {
  const fallback = () => fallbackRewrite(blockedAsk);
  const suggestion = await withFallback(
    "suggestRewrite",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: blockedAsk,
        output: Output.object({ schema }),
      });
      return clean(output);
    },
    fallback,
  );
  // The model may only suggest something Quick check would let through.
  return isSafeRewrite(suggestion) ? suggestion : fallback();
}
