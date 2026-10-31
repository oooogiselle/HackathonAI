// Inbox notifications and the short message thread on an ask.
import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { asks, claims, messages, notifications, users } from "@/db/schema";

import { settleDue } from "./board-store";
import { getAskDb } from "./db";
import type { InboxItem, InboxKind, InboxTopic, Message } from "./types";
import { isBlockedBetween } from "./users";

/** Newest first. All / Actions (kind "action") / Updates (kind "update"). */
export async function listInbox(
  userId: string,
  filter: { kind?: InboxKind; topic?: InboxTopic } = {},
  limit = 50,
): Promise<InboxItem[]> {
  const db = await getAskDb();
  // Settle any 48 h auto-confirms first, so "released" shows up here.
  await settleDue(db, Date.now());
  const conditions = [eq(notifications.userId, userId)];
  if (filter.kind) conditions.push(eq(notifications.kind, filter.kind));
  if (filter.topic) conditions.push(eq(notifications.topic, filter.topic));
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((n) => ({
    id: n.id,
    token: n.askToken ?? undefined,
    kind: n.kind as InboxKind,
    topic: n.topic as InboxTopic,
    title: n.title,
    text: n.body,
    createdAt: n.createdAt.getTime(),
    read: Boolean(n.readAt),
  }));
}

/** Marks some (or, with no ids, all) of a user's notifications read. */
export async function markRead(userId: string, ids?: string[]) {
  const db = await getAskDb();
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (ids) conditions.push(inArray(notifications.id, ids));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions));
}

// ---------- messages ----------

type Thread = {
  askerId: string;
  helperId: string;
  title: string;
  status: string;
};

/** The asker and the helper on the ask, once a helper has claimed it. */
async function threadFor(token: string): Promise<Thread | null> {
  const db = await getAskDb();
  const [row] = await db
    .select({
      askerId: asks.askerId,
      helperId: claims.helperId,
      title: asks.title,
      status: asks.status,
    })
    .from(asks)
    .innerJoin(claims, eq(claims.askToken, asks.token))
    .where(eq(asks.token, token));
  return row ?? null;
}

// Messages open only after both say yes (the asker confirmed the helper), so
// names and contact details are never shared before that. A cancelled ask
// keeps its thread readable but closed.
const OPEN = new Set(["confirmed", "done"]);
const NO_THREAD = { error: "Messages open once you've both said yes." };

export async function listMessages(
  token: string,
  userId: string,
): Promise<{ messages: Message[]; otherFirstName: string } | { error: string }> {
  const thread = await threadFor(token);
  if (!thread || (userId !== thread.askerId && userId !== thread.helperId)) return NO_THREAD;
  if (!OPEN.has(thread.status) && thread.status !== "cancelled") return NO_THREAD;
  const db = await getAskDb();
  const otherId = userId === thread.askerId ? thread.helperId : thread.askerId;
  const [other] = await db
    .select({ firstName: users.firstName })
    .from(users)
    .where(eq(users.id, otherId));
  const rows = await db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      firstName: users.firstName,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.askToken, token))
    .orderBy(messages.createdAt);
  return {
    otherFirstName: other?.firstName ?? "",
    messages: rows.map((m) => ({
      id: m.id,
      fromMe: m.senderId === userId,
      senderFirstName: m.firstName,
      body: m.body,
      createdAt: m.createdAt.getTime(),
    })),
  };
}

export async function sendMessage(
  token: string,
  userId: string,
  body: string,
): Promise<{ error: string } | null> {
  const thread = await threadFor(token);
  if (!thread || (userId !== thread.askerId && userId !== thread.helperId)) return NO_THREAD;
  if (thread.status === "cancelled") return { error: "This ask was cancelled." };
  if (!OPEN.has(thread.status)) return NO_THREAD;
  const other = userId === thread.askerId ? thread.helperId : thread.askerId;
  if (await isBlockedBetween(userId, other)) return { error: "You can't message this person." };

  const db = await getAskDb();
  await db.transaction(async (tx) => {
    await tx.insert(messages).values({ askToken: token, senderId: userId, body });
    const [me] = await tx
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId));
    await tx.insert(notifications).values({
      userId: other,
      askToken: token,
      kind: "action",
      topic: "tasks",
      title: `Reply about “${thread.title}”`,
      body: `${me?.firstName}: “${body.length > 80 ? `${body.slice(0, 79)}…` : body}”`,
    });
  });
  return null;
}
