// EXAMPLE (RAG): text chunks + their embeddings for similarity search.
// Requires the pgvector extension (enabled by the first migration).
import { index, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

// Must match the embedding model in src/lib/ai/models.ts
// (OpenAI text-embedding-3-small = 1536). Changing it needs a new migration.
export const EMBEDDING_DIMENSIONS = 1536;

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    content: text("content").notNull(),
    // Free-form: source URL, file name, owner id, etc.
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // HNSW index for fast cosine-distance search.
    index("documents_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
).enableRLS(); // RLS on + no policies = not reachable via Supabase's public API. Drizzle bypasses it.

export type Document = typeof documents.$inferSelect;
