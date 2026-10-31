// Scam guard for messages (src/lib/ask/scam-check.ts). The keyword pass always
// runs; the model catches rewordings and other languages, and can only add a
// flag, never clear one the keywords found.
import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import { askModel } from "@/lib/ai/models";
import { MESSAGE_FLAGS, type MessageFlag, scamKeywordCheck } from "@/lib/ask/scam-check";

import { withFallback } from "./fallback";

const schema = z.object({
  flag: z.enum(["none", ...MESSAGE_FLAGS]),
});

const INSTRUCTIONS = `You check one chat message between two college students who agreed to help each other through Ask, an app that holds payment until the help is done.
Classify the message:
- "off-platform-payment": suggests or asks to pay or be paid outside Ask (any payment app, cash transfer, gift cards, crypto, "pay me directly"), in any language or wording
- "id-number": asks for, or contains, an ID or account number (SSN, passport number, bank or card numbers, PINs)
- "none": anything else, including just mentioning these topics ("I got my SSN last week", "I'll pay through Ask")
When unsure between "none" and a flag, pick the flag.`;

export async function checkMessage(body: string): Promise<MessageFlag | null> {
  const byKeyword = scamKeywordCheck(body);
  if (byKeyword) return byKeyword;
  const byModel = await withFallback(
    "checkMessage",
    async () => {
      const { output } = await generateText({
        model: askModel,
        instructions: INSTRUCTIONS,
        prompt: body,
        output: Output.object({ schema }),
      });
      return output.flag;
    },
    () => "none" as const,
  );
  return byModel === "none" ? null : byModel;
}
