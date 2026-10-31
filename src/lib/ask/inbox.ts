// Inbox notifications and the short message thread on an ask.
import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { asks, claims, messages, notifications, users } from "@/db/schema";

import { getAskDb } from "./db";
import type { InboxItem, InboxKind, InboxTopic, Message } from "./types";
import { isBlockedBetween } from "./users";

export async function listInbox(
  userId: string,
  filter: { kind?: InboxKind; topic?: InboxTopic } = {},
  limit = 50,
): Promise<{ items: InboxItem[]; unreadActions: number }> {
  const db = await getAskDb();
  const conditions = [eq(notifications.userId, userId)];
  if (filter.kind) conditions.push(eq(notifications.kind, filter.kind));
  if (filter.topic) conditions.push(eq(notifications.topic, filter.topic));
  const [rows, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.kind, "action"),
          isNull(notifications.readAt),
        ),
      ),
  ]);
  return {
    items: rows.map((n) => ({
      id: n.id,
      askToken: n.askToken ?? undefined,
      kind: n.kind as InboxKind,
      topic: n.topic as InboxTopic,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.getTime(),
      read: Boolean(n.readAt),
    })),
    unreadActions: unread.length,
  };
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
  anonymous: boolean;
  status: string;
};

/** The asker and the helper holding the ask, once someone has said yes. */
async function threadFor(token: string): Promise<Thread | null> {
  const db = await getAskDb();
  const [row] = await db
    .select({
      askerId: asks.askerId,
      helperId: claims.helperId,
      title: asks.title,
      anonymous: asks.anonymous,
      status: asks.status,
    })
    .from(asks)
    .innerJoin(claims, eq(claims.askToken, asks.token))
    .where(eq(asks.token, token));
  return row ?? null;
}

const NO_THREAD = { error: "Messages open once a helper says yes." };

export async function listMessages(
  token: string,
  userId: string,
): Promise<Message[] | { error: string }> {
  const thread = await threadFor(token);
  if (!thread || (userId !== thread.askerId && userId !== thread.helperId)) return NO_THREAD;
  const db = await getAskDb();
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
  // An anonymous asker stays "The asker" until they confirm the helper.
  const askerHidden = thread.anonymous && thread.status === "held";
  return rows.map((m) => ({
    id: m.id,
    fromMe: m.senderId === userId,
    senderFirstName: m.senderId === thread.askerId && askerHidden ? "The asker" : m.firstName,
    body: m.body,
    createdAt: m.createdAt.getTime(),
  }));
}

export async function sendMessage(
  token: string,
  userId: string,
  body: string,
): Promise<{ error: string } | null> {
  const thread = await threadFor(token);
  if (!thread || (userId !== thread.askerId && userId !== thread.helperId)) return NO_THREAD;
  if (thread.status === "cancelled") return { error: "This ask was cancelled." };
  const other = userId === thread.askerId ? thread.helperId : thread.askerId;
  if (await isBlockedBetween(userId, other)) return { error: "You can't message this person." };

  const db = await getAskDb();
  await db.transaction(async (tx) => {
    await tx.insert(messages).values({ askToken: token, senderId: userId, body });
    const [me] = await tx
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, userId));
    const name =
      userId === thread.askerId && thread.anonymous && thread.status === "held"
        ? "The asker"
        : me?.firstName;
    await tx.insert(notifications).values({
      userId: other,
      askToken: token,
      kind: "action",
      topic: "tasks",
      title: `Reply about “${thread.title}”`,
      body: `${name}: “${body.length > 80 ? `${body.slice(0, 79)}…` : body}”`,
    });
  });
  return null;
}
