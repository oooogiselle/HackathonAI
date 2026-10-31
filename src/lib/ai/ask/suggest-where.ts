// Suggests up to 3 peers (with a one-line "why") and partner group chats.
// Works with zero helpers. Sensitive asks get offices, never group chats.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { aliasFor } from "@/lib/ask/alias";
import { GROUPS, OFFICES } from "@/lib/ask/mock-data";
import type { Helper, HelperSuggestion, SafetyCategory, WhereSuggestion } from "@/lib/ask/types";

import { withFallback } from "./fallback";

const MAX_HELPERS = 3;

const schema = z.object({
  picks: z.array(z.object({ id: z.string(), why: z.string() })).max(MAX_HELPERS),
});

const INSTRUCTIONS = `Pick up to ${MAX_HELPERS} peers who are most likely able to help with this ask.
For each, write a one-line reason (under 12 words) that references their profile. Only pick people who fit.
Return an empty list if nobody fits.`;

function fallbackPicks(ask: string, helpers: Helper[]): HelperSuggestion[] {
  const text = ask.toLowerCase();
  return helpers
    .map((helper) => ({ helper, score: helper.tags.filter((t) => text.includes(t)).length }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_HELPERS)
    .map(({ helper }) => ({ helper, why: helper.blurb }));
}

export async function suggestWhere(
  ask: string,
  category: SafetyCategory,
  helpers: Helper[],
): Promise<WhereSuggestion> {
  const picks =
    helpers.length === 0
      ? []
      : await withFallback(
          "suggestWhere",
          async () => {
            const { output } = await generateText({
              model: askModel,
              instructions: INSTRUCTIONS,
              prompt: `Ask: ${ask}\n\nPeers:\n${helpers
                .map(
                  (h) =>
                    `- id=${h.id}: ${aliasFor(h.id)} (${h.year}). ${h.blurb}${h.tags.length ? ` Good with: ${h.tags.join(", ")}.` : ""}`,
                )
                .join("\n")}`,
              output: Output.object({ schema }),
            });
            return output.picks.flatMap((p) => {
              const helper = helpers.find((h) => h.id === p.id);
              return helper ? [{ helper, why: p.why }] : [];
            });
          },
          () => fallbackPicks(ask, helpers),
        );

  const sensitive = category !== "none";
  return {
    helpers: picks,
    groups: sensitive ? [] : GROUPS,
    offices: sensitive ? OFFICES : [],
  };
}
