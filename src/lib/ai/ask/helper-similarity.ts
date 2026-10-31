// How close an ask is to each helper's own words (blurb + tags), by embeddings.
// Catches paraphrases keywords miss: "get to Boston for my flight" vs a helper who
// "drives to Logan". Optional: without OPENAI_API_KEY, or if the call fails or is
// slow, it returns {} and matching uses keywords only. Same pattern as common-need.ts.
import "server-only";

import { cosineSimilarity, embed, embedMany } from "ai";

import { embeddingModel } from "@/lib/ai/models";
import { isCommunityTag } from "@/lib/ask/dartmouth";
import type { Helper } from "@/lib/ask/types";

// Matching shouldn't wait long on an optional step.
const TIMEOUT_MS = 2500;
const MAX_CACHE = 500;

// Profile text → vector, so each helper is embedded once per wording.
const cache = new Map<string, number[]>();

// Skills only: where someone lives is a separate boost, never "expertise".
const profileText = (h: Helper) =>
  [h.blurb, h.tags.filter((t) => !isCommunityTag(t)).join(", ")].filter(Boolean).join(". ");

/** Helper id → cosine similarity with the ask, for helpers with a profile. */
export async function helperSimilarity(
  text: string,
  helpers: Helper[],
): Promise<Record<string, number>> {
  if (!process.env.OPENAI_API_KEY || helpers.length === 0) return {};
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const texts = helpers.map(profileText);
    const missing = [...new Set(texts.filter((t) => t && !cache.has(t)))];
    const [{ embedding }, fresh] = await Promise.all([
      embed({ model: embeddingModel, maxRetries: 0, value: text, abortSignal: signal }),
      missing.length
        ? embedMany({ model: embeddingModel, maxRetries: 0, values: missing, abortSignal: signal })
        : Promise.resolve({ embeddings: [] as number[][] }),
    ]);
    if (cache.size > MAX_CACHE) cache.clear();
    missing.forEach((t, i) => cache.set(t, fresh.embeddings[i]));
    const scores: Record<string, number> = {};
    helpers.forEach((h, i) => {
      const vector = cache.get(texts[i]);
      if (vector) scores[h.id] = cosineSimilarity(embedding, vector);
    });
    return scores;
  } catch (error) {
    console.error("[ai:helperSimilarity] failed, using keywords:", error);
    return {};
  }
}
