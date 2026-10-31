// Match an ask to a need that comes back every term (src/lib/ask/common-needs.ts).
// Keywords win when they hit, since they're precise; otherwise embeddings catch
// paraphrases ("get my social"). Without OPENAI_API_KEY, or if the call fails,
// it's keywords only. No match is fine: the card just doesn't show.
import "server-only";

import { cosineSimilarity, embed, embedMany } from "ai";

import { embeddingModel } from "@/lib/ai/models";
import { COMMON_NEEDS, type CommonNeed, matchCommonNeedByKeyword } from "@/lib/ask/common-needs";

// Higher than category suggestions: a wrong tip is worse than no tip.
const MIN_SIMILARITY = 0.5;
// Quick check shouldn't wait on retries.
const MAX_RETRIES = 0;

let needVectors: Promise<number[][]> | null = null;

function embedNeeds() {
  needVectors ??= embedMany({
    model: embeddingModel,
    maxRetries: MAX_RETRIES,
    values: COMMON_NEEDS.map((n) => n.about),
  }).then((r) => r.embeddings);
  // A failed batch shouldn't stick for the life of the process.
  needVectors.catch(() => (needVectors = null));
  return needVectors;
}

export async function matchCommonNeed(text: string): Promise<CommonNeed | null> {
  const byKeyword = matchCommonNeedByKeyword(text);
  if (byKeyword || !process.env.OPENAI_API_KEY) return byKeyword;
  try {
    const [{ embedding }, vectors] = await Promise.all([
      embed({ model: embeddingModel, maxRetries: MAX_RETRIES, value: text }),
      embedNeeds(),
    ]);
    const best = COMMON_NEEDS.map((need, i) => ({
      need,
      score: cosineSimilarity(embedding, vectors[i]),
    })).sort((a, b) => b.score - a.score)[0];
    return best && best.score >= MIN_SIMILARITY ? best.need : null;
  } catch (error) {
    console.error("[ai:matchCommonNeed] failed, using keywords:", error);
    return null;
  }
}
