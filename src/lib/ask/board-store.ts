// Board cards: one ask, one card, whether it's on the board, opened from a
// GroupMe link, or sent privately. Backed by Postgres (see ./db.ts).
//
// Every state change is one guarded `UPDATE … WHERE <expected state> RETURNING`
// (or an insert guarded by a primary key / row lock), inside a transaction that
// also writes the inbox notification. Only the request whose update returned a
// row gets a card back, so callers run side effects (bot posts) exactly once.
import "server-only";

import { randomBytes } from "node:crypto";

import {
  type AnyColumn,
  and,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import {
  askRecipients,
  askShares,
  asks,
  blocks,
  claims,
  groupPostCounts,
  notifications,
  payments,
  users,
} from "@/db/schema";

import { type AskDb, getAskDb } from "./db";
import { MEETING_SPOTS } from "./mock-data";
import type {
  AskCategory,
  BoardCard,
  CardStatus,
  CardViewer,
  InboxKind,
  InboxTopic,
  PayType,
  Payment,
  PaymentMethod,
  PublicCard,
} from "./types";

export const MAX_POSTS_PER_GROUP_PER_DAY = 3;
export const MAX_PRIVATE_RECIPIENTS = 3;
const HOUR = 3_600_000;

/** Either the updated card, or a user-facing reason it didn't change. */
export type Transition = { card: BoardCard } | { error: string };

const NOT_FOUND = { error: "We couldn't find that ask." };
const NOT_YOURS = { error: "Only the person who posted this ask can do that." };

export function newToken() {
  return randomBytes(9).toString("base64url");
}

// ---------- reading ----------

type AskRow = typeof asks.$inferSelect;

function effectiveStatus(row: { status: string; expiresAt: Date }, now: number): CardStatus {
  const status = row.status as CardStatus;
  if ((status === "open" || status === "held") && row.expiresAt.getTime() <= now) return "expired";
  return status;
}

const ms = (d: Date | null | undefined) => (d ? d.getTime() : undefined);

/** Turns ask rows into cards with their asker, holder, shares and payment. */
async function hydrate(db: AskDb, rows: AskRow[], now: number): Promise<BoardCard[]> {
  if (!rows.length) return [];
  const tokens = rows.map((r) => r.token);
  const askerIds = [...new Set(rows.map((r) => r.askerId))];

  const [askers, held, shares, pays] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        year: users.classYear,
        showYear: users.showClassYear,
      })
      .from(users)
      .where(inArray(users.id, askerIds)),
    db
      .select({
        token: claims.askToken,
        userId: users.id,
        firstName: users.firstName,
        email: users.email,
        year: users.classYear,
        showYear: users.showClassYear,
        heldAt: claims.heldAt,
      })
      .from(claims)
      .innerJoin(users, eq(users.id, claims.helperId))
      .where(inArray(claims.askToken, tokens)),
    db.select().from(askShares).where(inArray(askShares.askToken, tokens)),
    db.select().from(payments).where(inArray(payments.askToken, tokens)),
  ]);

  const askerById = new Map(askers.map((a) => [a.id, a]));
  const heldByToken = new Map(held.map((h) => [h.token, h]));
  const payByToken = new Map(pays.map((p) => [p.askToken, p]));

  return rows.map((row) => {
    const asker = askerById.get(row.askerId);
    const holder = heldByToken.get(row.token);
    const pay = payByToken.get(row.token);
    const payment: Payment | undefined = pay && {
      amountCents: pay.amountCents,
      platformFeeCents: pay.platformFeeCents,
      processingFeeCents: pay.processingFeeCents,
      totalCents: pay.totalCents,
      method: pay.method as PaymentMethod,
      status: pay.status as Payment["status"],
      heldAt: pay.heldAt.getTime(),
      releasedAt: ms(pay.releasedAt),
      refundedAt: ms(pay.refundedAt),
    };
    return {
      token: row.token,
      askerId: row.askerId,
      title: row.title,
      text: row.details,
      category: row.category as AskCategory,
      payType: row.payType as PayType,
      minutes: row.minutes,
      price: row.price,
      anonymous: row.anonymous,
      private: row.private,
      askerFirstName: row.anonymous ? undefined : asker?.firstName,
      askerYear: asker?.showYear ? (asker.year ?? undefined) : undefined,
      status: effectiveStatus(row, now),
      createdAt: row.createdAt.getTime(),
      startsAt: ms(row.startsAt),
      neededBy: ms(row.neededBy),
      expiresAt: row.expiresAt.getTime(),
      shares: shares
        .filter((s) => s.askToken === row.token)
        .map((s) => ({ groupId: s.groupId, postedAt: s.postedAt.getTime() })),
      heldBy: holder && {
        userId: holder.userId,
        firstName: holder.firstName,
        email: holder.email,
        year: holder.showYear ? (holder.year ?? undefined) : undefined,
        heldAt: holder.heldAt.getTime(),
      },
      meetingSpot: row.meetingSpot ?? undefined,
      payment,
      thanks: row.thanks ?? undefined,
    };
  });
}

async function readCard(db: AskDb, token: string, now: number): Promise<BoardCard | undefined> {
  const rows = await db.select().from(asks).where(eq(asks.token, token));
  return (await hydrate(db, rows, now))[0];
}

export async function getBoardCard(token: string, now = Date.now()) {
  return readCard(await getAskDb(), token, now);
}

/** Neither user has blocked the other. */
function notBlockedBetween(a: AnyColumn, b: string) {
  return notExists(
    sql`(select 1 from ${blocks} where (${blocks.blockerId} = ${a} and ${blocks.blockedId} = ${b})
      or (${blocks.blockerId} = ${b} and ${blocks.blockedId} = ${a}))`,
  );
}

/**
 * The public board: open, unexpired, non-private asks, newest first.
 * Hides asks between blocked people, and paid asks from a viewer who said
 * they can't accept payment.
 */
export async function listOpenCards(viewerId: string | null, now = Date.now()) {
  const db = await getAskDb();
  const conditions = [
    eq(asks.status, "open"),
    eq(asks.private, false),
    gt(asks.expiresAt, new Date(now)),
  ];
  if (viewerId) {
    conditions.push(notBlockedBetween(asks.askerId, viewerId));
    const [viewer] = await db
      .select({ canAcceptPayment: users.canAcceptPayment })
      .from(users)
      .where(eq(users.id, viewerId));
    if (viewer?.canAcceptPayment === false) conditions.push(eq(asks.price, 0));
  }
  const rows = await db
    .select()
    .from(asks)
    .where(and(...conditions))
    .orderBy(desc(asks.createdAt));
  return hydrate(db, rows, now);
}

/** "My asks" and "I'm helping" on the Claimed tab. */
export async function listMine(userId: string, now = Date.now()) {
  const db = await getAskDb();
  const [mine, helping] = await Promise.all([
    db.select().from(asks).where(eq(asks.askerId, userId)).orderBy(desc(asks.createdAt)),
    db
      .select({ ask: asks })
      .from(asks)
      .innerJoin(claims, eq(claims.askToken, asks.token))
      .where(eq(claims.helperId, userId))
      .orderBy(desc(claims.heldAt)),
  ]);
  return {
    asks: await hydrate(db, mine, now),
    helping: await hydrate(
      db,
      helping.map((r) => r.ask),
      now,
    ),
  };
}

export function toPublicCard(
  card: BoardCard,
  viewerId: string | null,
  invited = false,
): PublicCard {
  const { askerId, heldBy, askerFirstName, payment, ...rest } = card;
  let viewer: CardViewer = "signed-out";
  if (viewerId) {
    if (viewerId === askerId) viewer = "asker";
    else if (viewerId === heldBy?.userId) viewer = "helper";
    else if (invited) viewer = "invited";
    else viewer = "other";
  }
  const party = viewer === "asker" || viewer === "helper";
  return {
    ...rest,
    shares: rest.shares.map((s) => ({ ...s })),
    ...(card.anonymous ? {} : { askerFirstName }),
    heldByFirstName: heldBy?.firstName,
    heldByYear: heldBy?.year,
    ...(party && payment ? { payment } : {}),
    viewer,
  };
}

// ---------- notifications (always inside the winning transaction) ----------

type Note = { askToken?: string; kind: InboxKind; topic: InboxTopic; title: string; body: string };

async function notify(db: AskDb, userId: string, note: Note) {
  // TODO(notifications): also email via notify() for the 3 PRD events.
  await db.insert(notifications).values({ userId, ...note });
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

// ---------- creating ----------

export type NewCard = {
  askerId: string;
  title: string;
  text: string;
  category: AskCategory;
  payType: PayType;
  price: number;
  minutes: number;
  anonymous: boolean;
  private: boolean;
  startsAt?: number;
  neededBy?: number;
  expiresAt: number;
};

export async function createCard(input: NewCard, now = Date.now()): Promise<BoardCard> {
  const db = await getAskDb();
  const token = newToken();
  await db.transaction(async (tx) => {
    await tx.insert(asks).values({
      token,
      askerId: input.askerId,
      title: input.title,
      details: input.text,
      category: input.category,
      payType: input.payType,
      price: input.price,
      minutes: input.minutes,
      anonymous: input.anonymous,
      private: input.private,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      neededBy: input.neededBy ? new Date(input.neededBy) : null,
      expiresAt: new Date(input.expiresAt),
      createdAt: new Date(now),
    });
    if (!input.private) {
      await notify(tx, input.askerId, {
        askToken: token,
        kind: "update",
        topic: "tasks",
        title: "Posted to the needs board",
        body: `“${input.title}” is live until it expires.`,
      });
    }
  });
  return (await readCard(db, token, now))!;
}

// ---------- transitions ----------

/** After a guarded update matched nothing: say why, from the current state. */
async function explain(db: AskDb, token: string, now: number, why: (card: BoardCard) => string) {
  const card = await readCard(db, token, now);
  return card ? { error: why(card) } : NOT_FOUND;
}

/** open → held. The first "I can help" wins; everyone after sees "Already taken". */
export async function holdCard(
  token: string,
  helperId: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const won = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(asks)
      .set({ status: "held" })
      .where(
        and(
          eq(asks.token, token),
          eq(asks.status, "open"),
          gt(asks.expiresAt, new Date(now)),
          ne(asks.askerId, helperId),
          notBlockedBetween(asks.askerId, helperId),
          // Private asks: only the helpers the asker picked.
          or(
            eq(asks.private, false),
            exists(
              tx
                .select({ one: sql`1` })
                .from(askRecipients)
                .where(
                  and(eq(askRecipients.askToken, token), eq(askRecipients.helperId, helperId)),
                ),
            ),
          ),
        ),
      )
      .returning();
    if (!row) return null;
    await tx.insert(claims).values({ askToken: token, helperId, heldAt: new Date(now) });
    const [helper] = await tx.select().from(users).where(eq(users.id, helperId));
    await notify(tx, row.askerId, {
      askToken: token,
      kind: "action",
      topic: "tasks",
      title: `${helper?.firstName ?? "Someone"} can help`,
      body: `${helper?.firstName ?? "A helper"} said yes to “${row.title}”. Confirm to lock it in.`,
    });
    return row;
  });
  if (won) return { card: (await readCard(db, token, now))! };

  return explain(db, token, now, (card) => {
    if (card.status === "expired") return "This ask has expired";
    if (card.askerId === helperId) return "You can't take your own ask.";
    if (card.status !== "open") return "Already taken";
    if (card.private) return "This ask was sent to other helpers.";
    return "You can't take this ask.";
  });
}

/** held → confirmed, by the asker. Picks a public meeting spot. */
export async function confirmCard(
  token: string,
  userId: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const spot = MEETING_SPOTS[Math.floor(Math.random() * MEETING_SPOTS.length)];
  const won = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(asks)
      .set({ status: "confirmed", meetingSpot: spot })
      .where(
        and(
          eq(asks.token, token),
          eq(asks.askerId, userId),
          eq(asks.status, "held"),
          gt(asks.expiresAt, new Date(now)),
        ),
      )
      .returning();
    if (!row) return null;
    const [claim] = await tx.select().from(claims).where(eq(claims.askToken, token));
    if (claim) {
      await notify(tx, claim.helperId, {
        askToken: token,
        kind: "update",
        topic: "tasks",
        title: "You're confirmed",
        body: `Meet at ${spot} for “${row.title}”.`,
      });
    }
    return row;
  });
  if (won) return { card: (await readCard(db, token, now))! };
  return explain(db, token, now, (card) =>
    card.askerId !== userId
      ? NOT_YOURS.error
      : card.status === "expired"
        ? "This ask has expired"
        : "There's no helper to confirm yet.",
  );
}

/** Mocked fee breakdown: 10% platform fee plus an estimated processing fee. */
export function paymentBreakdown(price: number, method: PaymentMethod) {
  const amountCents = price * 100;
  const platformFeeCents = Math.round(amountCents * 0.1);
  const base = amountCents + platformFeeCents;
  const processingFeeCents =
    method === "venmo" ? Math.round(base * 0.019) : Math.round(base * 0.029) + 30;
  return {
    amountCents,
    platformFeeCents,
    processingFeeCents,
    totalCents: amountCents + platformFeeCents + processingFeeCents,
  };
}

/**
 * Mocked "Pay $X": holds the payment once the asker has confirmed a helper.
 * No money moves (TODO(stripe)). The payments primary key makes it once only.
 */
export async function holdPayment(
  token: string,
  userId: string,
  method: PaymentMethod,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const result = await db.transaction(async (tx): Promise<{ error: string } | null> => {
    // Lock the ask so its state can't change under us.
    const [row] = await tx.select().from(asks).where(eq(asks.token, token)).for("update");
    if (!row) return NOT_FOUND;
    if (row.askerId !== userId) return NOT_YOURS;
    if (row.price === 0) return { error: "This ask is a favor, so there's nothing to pay." };
    if (row.status !== "confirmed") return { error: "Confirm your helper before paying." };
    const [claim] = await tx.select().from(claims).where(eq(claims.askToken, token));
    if (!claim) return { error: "Confirm your helper before paying." };

    const fees = paymentBreakdown(row.price, method);
    const [paid] = await tx
      .insert(payments)
      .values({
        askToken: token,
        payerId: userId,
        payeeId: claim.helperId,
        method,
        heldAt: new Date(now),
        ...fees,
      })
      .onConflictDoNothing()
      .returning();
    if (!paid) return { error: "Already paid." };
    await notify(tx, claim.helperId, {
      askToken: token,
      kind: "update",
      topic: "payments",
      title: `${dollars(fees.amountCents)} held for you`,
      body: `Released when “${row.title}” is marked done.`,
    });
    return null;
  });
  return result ?? { card: (await readCard(db, token, now))! };
}

/** confirmed → done, by the asker. Releases a held payment. Paid asks must be paid first. */
export async function markCardDone(
  token: string,
  userId: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const won = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(asks)
      .set({ status: "done" })
      .where(
        and(
          eq(asks.token, token),
          eq(asks.askerId, userId),
          eq(asks.status, "confirmed"),
          or(
            eq(asks.price, 0),
            exists(
              tx
                .select({ one: sql`1` })
                .from(payments)
                .where(and(eq(payments.askToken, token), eq(payments.status, "held"))),
            ),
          ),
        ),
      )
      .returning();
    if (!row) return null;
    const [released] = await tx
      .update(payments)
      .set({ status: "released", releasedAt: new Date(now) })
      .where(and(eq(payments.askToken, token), eq(payments.status, "held")))
      .returning();
    const [claim] = await tx.select().from(claims).where(eq(claims.askToken, token));
    if (claim) {
      await notify(tx, claim.helperId, {
        askToken: token,
        kind: "update",
        topic: released ? "payments" : "tasks",
        title: released ? `${dollars(released.amountCents)} released to you` : "Marked done",
        body: `“${row.title}” is done. Thank you for helping.`,
      });
    }
    return row;
  });
  if (won) return { card: (await readCard(db, token, now))! };
  return explain(db, token, now, (card) => {
    if (card.askerId !== userId) return NOT_YOURS.error;
    if (card.status === "confirmed" && card.price > 0)
      return "Pay to hold the task before marking it done.";
    return "This ask isn't in progress.";
  });
}

/** Cancel before it's done. Refunds a held payment; tells the helper. */
export async function cancelCard(
  token: string,
  userId: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const won = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(asks)
      .set({ status: "cancelled", cancelledAt: new Date(now) })
      .where(
        and(
          eq(asks.token, token),
          eq(asks.askerId, userId),
          inArray(asks.status, ["open", "held", "confirmed"]),
        ),
      )
      .returning();
    if (!row) return null;
    await tx
      .update(payments)
      .set({ status: "refunded", refundedAt: new Date(now) })
      .where(and(eq(payments.askToken, token), eq(payments.status, "held")));
    const [claim] = await tx.select().from(claims).where(eq(claims.askToken, token));
    if (claim) {
      await notify(tx, claim.helperId, {
        askToken: token,
        kind: "update",
        topic: "tasks",
        title: "Ask cancelled",
        body: `“${row.title}” was cancelled. Thanks for offering.`,
      });
    }
    return row;
  });
  if (won) return { card: (await readCard(db, token, now))! };
  return explain(db, token, now, (card) =>
    card.askerId !== userId ? NOT_YOURS.error : "This ask can't be cancelled anymore.",
  );
}

/** "Extend 24 h" while waiting for a helper. Never past 7 days from now. */
export async function extendCard(
  token: string,
  userId: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const [row] = await db
    .update(asks)
    .set({
      expiresAt: sql`least(${asks.expiresAt} + interval '24 hours', ${new Date(now + 7 * 24 * HOUR)})`,
    })
    .where(
      and(
        eq(asks.token, token),
        eq(asks.askerId, userId),
        eq(asks.status, "open"),
        gt(asks.expiresAt, new Date(now)),
      ),
    )
    .returning();
  if (row) return { card: (await readCard(db, token, now))! };
  return explain(db, token, now, (card) =>
    card.askerId !== userId
      ? NOT_YOURS.error
      : card.status === "expired"
        ? "This ask has expired. Post it again instead."
        : "Only open asks can be extended.",
  );
}

export async function saveCardThanks(
  token: string,
  userId: string,
  note: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const [row] = await db
    .update(asks)
    .set({ thanks: note })
    .where(
      and(
        eq(asks.token, token),
        eq(asks.askerId, userId),
        inArray(asks.status, ["confirmed", "done"]),
      ),
    )
    .returning();
  // TODO(notifications): deliver the note to the helper.
  if (row) return { card: (await readCard(db, token, now))! };
  return explain(db, token, now, (card) =>
    card.askerId !== userId ? NOT_YOURS.error : "You can thank your helper once they're confirmed.",
  );
}

// ---------- group shares + rate limit ----------

/** Records a bot share before posting, so the link works the moment it lands. */
export async function addSharedGroup(
  token: string,
  userId: string,
  groupId: string,
  groupName: string,
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const result = await db.transaction(async (tx): Promise<{ error: string } | null> => {
    const [row] = await tx.select().from(asks).where(eq(asks.token, token)).for("update");
    if (!row) return NOT_FOUND;
    if (row.askerId !== userId) return NOT_YOURS;
    if (row.private) return { error: "Private asks are never shared to groups." };
    if (effectiveStatus(row, now) !== "open") return { error: "Only open asks can be shared." };
    const [added] = await tx
      .insert(askShares)
      .values({ askToken: token, groupId, postedAt: new Date(now) })
      .onConflictDoNothing()
      .returning();
    if (!added) return { error: "Already shared to that group." };
    await notify(tx, userId, {
      askToken: token,
      kind: "update",
      topic: "groups",
      title: "Shared to GroupMe",
      body: `Posted “${row.title}” to ${groupName}.`,
    });
    return null;
  });
  return result ?? { card: (await readCard(db, token, now))! };
}

/** Undo addSharedGroup when the bot post fails. */
export async function removeSharedGroup(token: string, groupId: string) {
  const db = await getAskDb();
  await db
    .delete(askShares)
    .where(and(eq(askShares.askToken, token), eq(askShares.groupId, groupId)));
}

function utcDay(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Takes one of today's 3 slots for a group. false (and nothing counted) if it's full. */
export async function takeRateLimit(groupId: string, now = Date.now()): Promise<boolean> {
  const db = await getAskDb();
  const rows = await db
    .insert(groupPostCounts)
    .values({ groupId, day: utcDay(now), n: 1 })
    .onConflictDoUpdate({
      target: [groupPostCounts.groupId, groupPostCounts.day],
      set: { n: sql`${groupPostCounts.n} + 1` },
      setWhere: sql`${groupPostCounts.n} < ${MAX_POSTS_PER_GROUP_PER_DAY}`,
    })
    .returning({ n: groupPostCounts.n });
  return rows.length > 0;
}

/** Gives back a slot taken by takeRateLimit when the post itself failed. */
export async function refundRateLimit(groupId: string, now = Date.now()) {
  const db = await getAskDb();
  await db
    .update(groupPostCounts)
    .set({ n: sql`${groupPostCounts.n} - 1` })
    .where(
      and(
        eq(groupPostCounts.groupId, groupId),
        eq(groupPostCounts.day, utcDay(now)),
        gt(groupPostCounts.n, 0),
      ),
    );
}

// ---------- private asks ----------

/**
 * Sends a private ask to picked helpers (2–3 in total). Skips nobody silently:
 * returns an error if any pick can't receive it.
 */
export async function sendPrivately(
  token: string,
  userId: string,
  helperIds: string[],
  now = Date.now(),
): Promise<Transition> {
  const db = await getAskDb();
  const result = await db.transaction(async (tx): Promise<{ error: string } | null> => {
    const [row] = await tx.select().from(asks).where(eq(asks.token, token)).for("update");
    if (!row) return NOT_FOUND;
    if (row.askerId !== userId) return NOT_YOURS;
    if (!row.private) return { error: "This ask is on the board, not private." };
    if (effectiveStatus(row, now) !== "open") return { error: "Only open asks can be sent." };

    const already = await tx.select().from(askRecipients).where(eq(askRecipients.askToken, token));
    const fresh = [...new Set(helperIds)].filter((id) => !already.some((r) => r.helperId === id));
    if (already.length + fresh.length > MAX_PRIVATE_RECIPIENTS) {
      return { error: `Pick up to ${MAX_PRIVATE_RECIPIENTS} people.` };
    }
    if (!fresh.length) return null;

    const helpers = await tx
      .select({ id: users.id, canAcceptPayment: users.canAcceptPayment })
      .from(users)
      .where(
        and(inArray(users.id, fresh), ne(users.id, userId), notBlockedBetween(users.id, userId)),
      );
    if (helpers.length !== fresh.length) return { error: "One of those people isn't available." };
    // Paid asks never reach helpers who can't accept payment.
    if (row.price > 0 && helpers.some((h) => h.canAcceptPayment !== true)) {
      return { error: "This ask needs helpers who can accept payment." };
    }

    await tx
      .insert(askRecipients)
      .values(fresh.map((helperId) => ({ askToken: token, helperId, sentAt: new Date(now) })));
    for (const helperId of fresh) {
      await notify(tx, helperId, {
        askToken: token,
        kind: "action",
        topic: "tasks",
        title: "A classmate asked you",
        body: `“${row.title}”, about ${row.minutes} min${row.price ? `, $${row.price}` : ", a favor"}.`,
      });
    }
    return null;
  });
  return result ?? { card: (await readCard(db, token, now))! };
}

/** A helper's private requests, newest first. */
export async function listRequestsFor(helperId: string, now = Date.now()) {
  const db = await getAskDb();
  const rows = await db
    .select({ ask: asks, sentAt: askRecipients.sentAt, response: askRecipients.response })
    .from(askRecipients)
    .innerJoin(asks, eq(asks.token, askRecipients.askToken))
    .where(eq(askRecipients.helperId, helperId))
    .orderBy(desc(askRecipients.sentAt));
  const cards = await hydrate(
    db,
    rows.map((r) => r.ask),
    now,
  );
  return rows.map((r, i) => ({
    card: cards[i],
    sentAt: r.sentAt.getTime(),
    response: (r.response ?? undefined) as "yes" | "no" | undefined,
  }));
}

export async function isRecipient(token: string, helperId: string) {
  const db = await getAskDb();
  const rows = await db
    .select({ one: sql`1` })
    .from(askRecipients)
    .where(and(eq(askRecipients.askToken, token), eq(askRecipients.helperId, helperId)));
  return rows.length > 0;
}

/** "Not this time": no reason asked, nothing sent to the asker. */
export async function declineRequest(token: string, helperId: string, now = Date.now()) {
  const db = await getAskDb();
  const rows = await db
    .update(askRecipients)
    .set({ response: "no", respondedAt: new Date(now) })
    .where(
      and(
        eq(askRecipients.askToken, token),
        eq(askRecipients.helperId, helperId),
        isNull(askRecipients.response),
      ),
    )
    .returning();
  return rows.length > 0;
}

/** "I can help" on a private request: the same hold as the board, then record the yes. */
export async function acceptRequest(
  token: string,
  helperId: string,
  now = Date.now(),
): Promise<Transition> {
  const held = await holdCard(token, helperId, now);
  const db = await getAskDb();
  await db
    .update(askRecipients)
    .set({ response: "yes", respondedAt: new Date(now) })
    .where(
      and(
        eq(askRecipients.askToken, token),
        eq(askRecipients.helperId, helperId),
        isNull(askRecipients.response),
      ),
    );
  return held;
}

// ---------- weekly load (for matching) ----------

/** Asks each helper has held or done in the last 7 days. */
export async function recentLoad(helperIds: string[], now = Date.now()) {
  if (!helperIds.length) return new Map<string, number>();
  const db = await getAskDb();
  const rows = await db
    .select({ helperId: claims.helperId, n: sql<number>`count(*)::int` })
    .from(claims)
    .innerJoin(asks, eq(asks.token, claims.askToken))
    .where(
      and(
        inArray(claims.helperId, helperIds),
        gt(claims.heldAt, new Date(now - 7 * 24 * HOUR)),
        ne(asks.status, "cancelled"),
      ),
    )
    .groupBy(claims.helperId);
  return new Map(rows.map((r) => [r.helperId, r.n]));
}
