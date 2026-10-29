// EXAMPLE (chat): streaming chat endpoint used by useChat on /app/chat.
// Optionally augments the prompt with RAG context from the `documents` table.
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { chatModel } from "@/lib/ai/models";
import { hasDocuments, searchSimilar } from "@/lib/ai/rag";
import { getUser } from "@/lib/supabase/server";

const BASE_INSTRUCTIONS = "You are a helpful assistant. Be concise.";

export async function POST(req: Request) {
  if (!(await getUser())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: chatModel,
    instructions: BASE_INSTRUCTIONS + (await retrieveContext(messages)),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}

/**
 * RAG step: finds chunks similar to the latest user message and formats them
 * for the prompt. Best-effort — skipped when there's no OpenAI key, no stored
 * documents, or any error, so chat works with only ANTHROPIC_API_KEY set.
 */
async function retrieveContext(messages: UIMessage[]): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";

  const lastUser = messages.findLast((m) => m.role === "user");
  const query = lastUser?.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
  if (!query) return "";

  try {
    if (!(await hasDocuments())) return "";
    const matches = await searchSimilar(query, 4);
    if (matches.length === 0) return "";

    const context = matches.map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n");
    return `\n\nUse the following context if it is relevant:\n\n${context}`;
  } catch (error) {
    console.error("RAG lookup failed, continuing without context:", error);
    return "";
  }
}
