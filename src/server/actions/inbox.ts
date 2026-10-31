// Inbox (Actions / Updates) and the message thread on an ask.
"use server";

import { z } from "zod";

import {
  listInbox as listInboxInStore,
  listMessages as listMessagesInStore,
  markRead,
  sendMessage as sendMessageInStore,
} from "@/lib/ask/inbox";
import { getCurrentUser } from "@/lib/ask/mock-session";
import type { InboxItem, Message, Result } from "@/lib/ask/types";

const SIGN_IN_ERROR = "Sign in to see your inbox.";
const token = z.string().min(1).max(64);

const filterSchema = z.object({
  kind: z.enum(["action", "update"]).optional(),
  topic: z.enum(["tasks", "groups", "payments"]).optional(),
});

/**
 * Newest first. No filter = All; `{ kind: "action" }` = Actions, `{ kind: "update" }`
 * = Updates; `topic` narrows to Tasks, Groups or Payments. Empty when signed out.
 */
export async function listInbox(filter: z.input<typeof filterSchema> = {}): Promise<InboxItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const parsed = filterSchema.safeParse(filter);
  return listInboxInStore(user.id, parsed.success ? parsed.data : {});
}

/** "Mark all read" (no ids) or mark the given items read. */
export async function markInboxRead(ids?: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = z.array(z.uuid()).max(200).optional().safeParse(ids);
  if (!parsed.success) return { error: "Something's off with that request." };
  await markRead(user.id, parsed.data);
  return { ok: true };
}

export async function listMessages(cardToken: string): Promise<Result<{ messages: Message[] }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = token.safeParse(cardToken);
  if (!tok.success) return { error: "We couldn't find that ask." };
  const result = await listMessagesInStore(tok.data, user.id);
  return "error" in result ? result : { ok: true, messages: result };
}

/** Called only from the message box's Send button. */
export async function sendMessage(input: { token: string; body: string }): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = z
    .object({ token, body: z.string().trim().min(1, "Write a message first.").max(1000) })
    .safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Write a message first." };
  // TODO(privacy): warn when a message includes a phone number or email before both say yes.
  const error = await sendMessageInStore(parsed.data.token, user.id, parsed.data.body);
  return error ?? { ok: true };
}
