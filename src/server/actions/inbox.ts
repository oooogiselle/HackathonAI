// Inbox (Actions / Updates) and the message thread on an ask.
"use server";

import { z } from "zod";

import { checkMessage } from "@/lib/ai/ask/message-check";
import {
  listInbox as listInboxInStore,
  listMessages as listMessagesInStore,
  markRead,
  sendMessage as sendMessageInStore,
} from "@/lib/ask/inbox";
import { getCurrentUser } from "@/lib/ask/mock-session";
import type { MessageFlag } from "@/lib/ask/scam-check";
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

/** The Inbox tab's badge. 0 when signed out. */
export async function countUnread(): Promise<number> {
  return (await listInbox()).filter((item) => !item.read).length;
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

export async function listMessages(
  cardToken: string,
): Promise<Result<{ messages: Message[]; otherAlias: string }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = token.safeParse(cardToken);
  if (!tok.success) return { error: "We couldn't find that ask." };
  const result = await listMessagesInStore(tok.data, user.id);
  return "error" in result ? result : { ok: true, ...result };
}

/**
 * Called only from the thread's Send button. Open once both have said yes.
 * Scam guard: a message that suggests paying outside Ask, or asks for an ID
 * number, comes back as `{ warning }` and isn't sent. "Send anyway" calls again
 * with `confirmed: true`. The flag is always computed here, never taken from
 * the client, and stored so the other side sees a note under the message.
 */
export async function sendMessage(input: {
  token: string;
  body: string;
  confirmed?: boolean;
}): Promise<Result | { warning: MessageFlag }> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = z
    .object({
      token,
      body: z.string().trim().min(1, "Write a message first.").max(1000),
      confirmed: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Write a message first." };
  const flag = await checkMessage(parsed.data.body);
  if (flag && !parsed.data.confirmed) return { warning: flag };
  const error = await sendMessageInStore(parsed.data.token, user.id, parsed.data.body, flag);
  return error ?? { ok: true };
}
