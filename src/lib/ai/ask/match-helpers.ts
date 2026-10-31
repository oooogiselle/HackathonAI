// Picks 2–3 seeded helpers for one ask, each with a one-line "why".
// Rules run first and are never up to the model: free at the ask's time (seeded
// free/busy), under their weekly limit, and able to accept payment when price > 0.
// The model only orders the people who pass and writes the reasons.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { aliasFor } from "@/lib/ask/alias";
import { helperFits } from "@/lib/ask/helper-fit";
import { HELPERS } from "@/lib/ask/mock-data";
import type { BusySlot, Helper, HelperSuggestion, Interest } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const MAX_PICKS = 3;
// How many rule-passing helpers the model gets to choose from.
const MAX_CANDIDATES = 6;

export type MatchInput = {
  text: string;
  interests: Interest[];
  // Must-haves, matched against Helper.tags.
  needs: string[];
  // ISO. No time → the free/busy check is skipped.
  startsAt?: string;
  minutes: number;
  // Whole dollars. 0 = a favor, open to everyone.
  price: number;
  // Helper id → asks they're already matched on this week (missing = 0).
  // The matchHelpers action fills this from recentLoad (claims in the last 7 days).
  activeMatches?: Record<string, number>;
};

const schema = z.object({
  picks: z.array(z.object({ id: z.string(), why: z.string() })).max(MAX_PICKS),
});

const INSTRUCTIONS = `Pick the ${MAX_PICKS} peers best placed to help with this ask, best first.
Everyone listed is already free at that time and has room this week; just pick the best fit.
For each, write a one-line reason (under 12 words) that references their profile.
Never mention their calendar, payment status or how busy they are.
Don't use he or she; start with what they do (e.g. "Drives to Lebanon airport most breaks")`;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// True if [start, start + minutes) overlaps a busy slot. Local server time, the
// same clock the seeded slots use. An ask that runs past midnight is checked
// against the next day too.
export function isBusyAt(busy: BusySlot[], startsAt: Date, minutes: number) {
  const day = startsAt.getDay();
  const from = startsAt.getHours() * 60 + startsAt.getMinutes();
  const to = from + Math.max(minutes, 1);
  return busy.some((slot) => {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (slot.day === day) return from < end && start < to;
    if (slot.day === (day + 1) % 7) return to > 24 * 60 && start < to - 24 * 60;
    return false;
  });
}

function fitScore(helper: Helper, input: MatchInput) {
  const text = input.text.toLowerCase();
  const tagHits = helper.tags.filter((t) => text.includes(t)).length;
  const interestHits = helper.interests.filter((i) => input.interests.includes(i)).length;
  return tagHits + 2 * interestHits + input.needs.length;
}

/**
 * Everyone who passes the rules, fewest active matches first (spreads load),
 * then best fit. Pure, so tests and the no-key fallback share it.
 */
export function eligibleHelpers(input: MatchInput, helpers: Helper[] = HELPERS): Helper[] {
  const startsAt = input.startsAt ? new Date(input.startsAt) : undefined;
  const hasTime = startsAt !== undefined && !Number.isNaN(startsAt.getTime());
  const active = (h: Helper) => input.activeMatches?.[h.id] ?? 0;
  const noPrefs = input.interests.length === 0 && input.needs.length === 0;

  return (
    helpers
      .filter((h) => helperFits(h, input.interests, input.needs))
      .filter((h) => !(hasTime && isBusyAt(h.busy, startsAt, input.minutes)))
      .filter((h) => active(h) < h.weeklyLimit)
      .filter((h) => input.price === 0 || h.canAcceptPayment)
      .map((h) => ({ h, score: fitScore(h, input) }))
      // With no preferences, the ask's own words must point at the helper.
      .filter(({ score }) => !noPrefs || score > 0)
      .sort((a, b) => active(a.h) - active(b.h) || b.score - a.score)
      .map(({ h }) => h)
  );
}

const fallbackPicks = (candidates: Helper[]): HelperSuggestion[] =>
  candidates.slice(0, MAX_PICKS).map((helper) => ({ helper, why: helper.blurb }));

/** 2–3 helpers with a reason; fewer (or none) when fewer fit. Never throws. */
export async function matchHelpers(
  input: MatchInput,
  helpers: Helper[] = HELPERS,
): Promise<HelperSuggestion[]> {
  const candidates = eligibleHelpers(input, helpers).slice(0, MAX_CANDIDATES);
  if (candidates.length <= 1) return fallbackPicks(candidates);

  return withFallback(
    "matchHelpers",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: `Ask: ${input.text}\n\nPeers:\n${candidates
          .map(
            (h) =>
              `- id=${h.id}: ${aliasFor(h.id)} (${h.year}). ${h.blurb}${h.tags.length ? ` Good with: ${h.tags.join(", ")}.` : ""}`,
          )
          .join("\n")}`,
        output: Output.object({ schema }),
      });
      const picked: HelperSuggestion[] = [];
      for (const p of output.picks) {
        const helper = candidates.find((h) => h.id === p.id);
        if (helper && !picked.some((s) => s.helper.id === helper.id)) {
          picked.push({ helper, why: p.why.trim() || helper.blurb });
        }
      }
      // Top up from the rule order so there are always 2–3 when that many fit.
      for (const s of fallbackPicks(candidates)) {
        if (picked.length >= 2) break;
        if (!picked.some((p) => p.helper.id === s.helper.id)) picked.push(s);
      }
      return picked;
    },
    () => fallbackPicks(candidates),
  );
}
