// EXAMPLE (RAG): the smallest useful retrieval pipeline.
//
//   ingest:   text → chunkText → embedMany → insert into `documents`
//   retrieve: query → embed → nearest chunks by cosine distance
//
// Nothing calls embedAndStore yet — wire it to whatever your project ingests
// (a server action for an upload form, a seed script, a webhook, ...).
import "server-only";

import { cosineDistance, sql } from "drizzle-orm";
import { embed, embedMany } from "ai";

import { db } from "@/db";
import { documents } from "@/db/schema";

import { embeddingModel } from "./models";

/**
 * Splits text into ~`size`-character chunks with `overlap` characters shared
 * between neighbours, so a sentence cut at a boundary still appears whole in
 * one of them. Character-based on purpose: simple and good enough to start.
 */
export function chunkText(text: string, size = 1000, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    chunks.push(clean.slice(start, start + size));
    if (start + size >= clean.length) break;
  }
  return chunks;
}

/** Chunks + embeds `text` and stores every chunk. Returns the chunk count. */
export async function embedAndStore(text: string, metadata: Record<string, unknown> = {}) {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  const { embeddings } = await embedMany({ model: embeddingModel, values: chunks });

  await db
    .insert(documents)
    .values(chunks.map((content, i) => ({ content, metadata, embedding: embeddings[i] })));
  return chunks.length;
}

/** Returns the `k` stored chunks most similar to `query` (best first). */
export async function searchSimilar(query: string, k = 4) {
  const { embedding } = await embed({ model: embeddingModel, value: query });

  // cosine distance: 0 = identical, 2 = opposite. similarity = 1 - distance.
  const similarity = sql<number>`1 - (${cosineDistance(documents.embedding, embedding)})`;

  return db
    .select({ content: documents.content, metadata: documents.metadata, similarity })
    .from(documents)
    .orderBy(cosineDistance(documents.embedding, embedding))
    .limit(k);
}

/** Cheap check so callers can skip embedding when there's nothing to search. */
export async function hasDocuments() {
  const rows = await db
    .select({ one: sql`1` })
    .from(documents)
    .limit(1);
  return rows.length > 0;
}
