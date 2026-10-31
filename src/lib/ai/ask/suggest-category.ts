// Suggest categories for an ask: presets plus categories other askers typed,
// ranked by embedding similarity to the ask (or to what the asker is typing
// under "Other", so "airport pickup" points to Rides instead of a near-duplicate).
// Without OPENAI_API_KEY, or if the call fails, keyword matching takes over.
// Suggestions are only shown; nothing is picked without a tap.
import "server-only";

import { cosineSimilarity, embed, embedMany } from "ai";

import { embeddingModel } from "@/lib/ai/models";
import {
  CATEGORY_PRESETS,
  categoryEmbeddingText,
  rankCategoriesByKeyword,
} from "@/lib/ask/categories";

const LIMIT = 3;
// Below this, a category is too far from the ask to be worth suggesting.
const MIN_SIMILARITY = 0.25;
// Suggestions refresh as the asker types, so fail fast to keywords instead of retrying.
const MAX_RETRIES = 0;

function embeddingsEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// One embedding per category label, kept for the life of the process.
const cache = new Map<string, Promise<number[]>>();

async function embedCategories(labels: string[]) {
  const missing = labels.filter((l) => !cache.has(l));
  if (missing.length > 0) {
    const batch = embedMany({
      model: embeddingModel,
      maxRetries: MAX_RETRIES,
      values: missing.map(categoryEmbeddingText),
    }).then((r) => r.embeddings);
    missing.forEach((label, i) => {
      const one = batch.then((e) => e[i]);
      // A failed batch shouldn't poison the cache.
      one.catch(() => cache.delete(label));
      cache.set(label, one);
    });
  }
  return Promise.all(labels.map((l) => cache.get(l)!));
}

export async function suggestCategories(text: string, extra: string[] = []): Promise<string[]> {
  const candidates = [...new Set([...CATEGORY_PRESETS.map((p) => p.label), ...extra])];
  const fallback = () => rankCategoriesByKeyword(text, candidates, LIMIT);
  if (!text.trim()) return [];
  if (!embeddingsEnabled()) return fallback();
  try {
    const [{ embedding }, vectors] = await Promise.all([
      embed({ model: embeddingModel, maxRetries: MAX_RETRIES, value: text }),
      embedCategories(candidates),
    ]);
    return candidates
      .map((label, i) => ({ label, score: cosineSimilarity(embedding, vectors[i]) }))
      .filter((c) => c.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)
      .slice(0, LIMIT)
      .map((c) => c.label);
  } catch (error) {
    console.error("[ai:suggestCategories] failed, using keywords:", error);
    return fallback();
  }
}
