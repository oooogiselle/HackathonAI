// Picks 2–3 seeded helpers for one ask, each with a one-line "why".
// Rules run first and are never up to the model: free at the ask's time (seeded
// free/busy), under their weekly limit, and able to accept payment when price > 0.
// Then Dartmouth fit: people who've done this exact thing first (their tags, campus
// words like "Dartmouth Coach", and, with OPENAI_API_KEY, embeddings), a boost for
// sharing the asker's house community or Greek house (never a filter), and load
// spread inside each tier. The model only orders the people who pass and writes the reasons.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { aliasFor } from "@/lib/ask/alias";
import {
  campusTags,
  communityTagsIn,
  findHouseByTag,
  isCommunityTag,
  mentionsTag,
  stripGreek,
} from "@/lib/ask/dartmouth";
import { isBusyAt } from "@/lib/ask/free-busy";
import { helperFits } from "@/lib/ask/helper-fit";
import { HELPERS } from "@/lib/ask/mock-data";
import type { Helper, HelperSuggestion, Interest } from "@/lib/ask/types";

import { withFallback } from "./fallback";
import { helperSimilarity } from "./helper-similarity";

export { isBusyAt };

const MAX_PICKS = 3;
// How many rule-passing helpers the model gets to choose from.
const MAX_CANDIDATES = 6;
// Embedding similarity at or above this counts as "has done this before".
const SIMILAR = 0.45;

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
  // The signed-in asker's house / Greek tags (from their own profile).
  askerCommunities?: string[];
  // Helper id → embedding similarity with the ask (helperSimilarity). Optional.
  similarity?: Record<string, number>;
};

const schema = z.object({
  picks: z.array(z.object({ id: z.string(), why: z.string() })).max(MAX_PICKS),
});

const INSTRUCTIONS = `Pick the ${MAX_PICKS} Dartmouth peers best placed to help with this ask, best first.
Everyone listed is already free at that time and has room this week; prefer people who have done this exact thing.
For each, write a one-line reason (under 12 words) that cites concrete experience from their profile.
If a peer is marked as sharing the asker's house community, you may say "Also in <house>".
Never name a fraternity, sorority or Greek house. Never mention their calendar, payment status or how busy they are.
Don't use he or she; start with what they do (e.g. "Drives to Lebanon airport most breaks")`;

type Fit = {
  // Has done this kind of thing: a skill tag the ask points at, or close by embeddings.
  expert: boolean;
  // Points at the helper at all (skills or interests); community alone doesn't count.
  fit: number;
  score: number;
  // The house community they share with the asker, if any.
  sharedHouse?: string;
};

function communitiesFor(input: MatchInput) {
  return new Set([...communityTagsIn(input.text), ...(input.askerCommunities ?? [])]);
}

export function fitFor(helper: Helper, input: MatchInput): Fit {
  const implied = campusTags(input.text);
  const skills = helper.tags.filter((t) => !isCommunityTag(t));
  const tagHits = skills.filter((t) => mentionsTag(input.text, t) || implied.includes(t)).length;
  const interestHits = helper.interests.filter((i) => input.interests.includes(i)).length;
  const similarity = input.similarity?.[helper.id] ?? 0;
  const communities = communitiesFor(input);
  const shared = helper.tags.filter((t) => isCommunityTag(t) && communities.has(t));
  const sharedHouse = shared.map(findHouseByTag).find(Boolean)?.name;
  return {
    expert: tagHits > 0 || similarity >= SIMILAR,
    fit: tagHits + interestHits + (similarity >= SIMILAR ? 1 : 0),
    score: 3 * tagHits + interestHits + 4 * similarity + 2 * shared.length,
    sharedHouse,
  };
}

/**
 * Everyone who passes the rules: people who've done this first, then fewest
 * active matches (spreads load), then best fit. Pure, so tests and the no-key
 * fallback share it.
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
      .map((h) => ({ h, f: fitFor(h, input) }))
      // With no preferences, the ask's own words must point at the helper.
      .filter(({ f }) => !noPrefs || f.fit > 0)
      .sort(
        (a, b) =>
          Number(b.f.expert) - Number(a.f.expert) ||
          active(a.h) - active(b.h) ||
          b.f.score - a.f.score,
      )
      .map(({ h }) => h)
  );
}

// The why never names a Greek house, even from a blurb written before the scrub knew them.
const fallbackPicks = (candidates: Helper[]): HelperSuggestion[] =>
  candidates.slice(0, MAX_PICKS).map((helper) => ({ helper, why: stripGreek(helper.blurb) }));

/** 2–3 helpers with a reason; fewer (or none) when fewer fit. Never throws. */
export async function matchHelpers(
  input: MatchInput,
  helpers: Helper[] = HELPERS,
): Promise<HelperSuggestion[]> {
  const similarity = input.similarity ?? (await helperSimilarity(input.text, helpers));
  const ranked = { ...input, similarity };
  const candidates = eligibleHelpers(ranked, helpers).slice(0, MAX_CANDIDATES);
  if (candidates.length <= 1) return fallbackPicks(candidates);

  return withFallback(
    "matchHelpers",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: `Ask: ${input.text}\n\nPeers:\n${candidates
          .map((h) => {
            const skills = h.tags.filter((t) => !isCommunityTag(t));
            const house = fitFor(h, ranked).sharedHouse;
            return `- id=${h.id}: ${aliasFor(h.id)} (${h.year}). ${stripGreek(h.blurb)}${skills.length ? ` Good with: ${skills.join(", ")}.` : ""}${house ? ` Shares the asker's house community: ${house}.` : ""}`;
          })
          .join("\n")}`,
        output: Output.object({ schema }),
      });
      const picked: HelperSuggestion[] = [];
      for (const p of output.picks) {
        const helper = candidates.find((h) => h.id === p.id);
        if (helper && !picked.some((s) => s.helper.id === helper.id)) {
          picked.push({ helper, why: stripGreek(p.why.trim()) || stripGreek(helper.blurb) });
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
