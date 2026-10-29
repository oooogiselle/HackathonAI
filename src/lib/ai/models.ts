// Every model the app uses, in one place. Swap providers/models here.
import { anthropic } from "@ai-sdk/anthropic"; // reads ANTHROPIC_API_KEY
import { openai } from "@ai-sdk/openai"; // reads OPENAI_API_KEY

export const chatModel = anthropic("claude-sonnet-5-5");

// Anthropic has no embeddings API, so RAG uses OpenAI. If you change this,
// update EMBEDDING_DIMENSIONS in src/db/schema/documents.ts and migrate.
export const embeddingModel = openai.embeddingModel("text-embedding-3-small");
