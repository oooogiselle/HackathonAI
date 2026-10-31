// Users, mock sign-in sessions, profile settings and blocked people.
import "server-only";

import { randomBytes } from "node:crypto";

import { and, desc, eq, isNotNull, or } from "drizzle-orm";

import { asks, blocks, claims, sessions, users } from "@/db/schema";

import { aliasFor } from "./alias";
import type { ViewerPrefs } from "./board-rank";
import { getAskDb } from "./db";
import type { BlockedEntry, HelperSetup, Profile, ThanksNote } from "./types";

export type SessionUser = { id: string; firstName: string; email: string };

/** Mock sign-up: same email → same account. Marks the email verified (TODO(auth)). */
export async function signInUser(
  firstName: string,
  email: string,
): Promise<{ sessionId: string; user: SessionUser }> {
  const db = await getAskDb();
  const [user] = await db
    .insert(users)
    .values({
      id: randomBytes(9).toString("base64url"),
      firstName,
      email,
      emailVerifiedAt: new Date(),
    })
    .onConflictDoUpdate({ target: users.email, set: { firstName } })
    .returning({ id: users.id, firstName: users.firstName, email: users.email });
  const sessionId = randomBytes(18).toString("base64url");
  await db.insert(sessions).values({ id: sessionId, userId: user.id });
  return { sessionId, user };
}

export async function getSessionUser(sessionId: string): Promise<SessionUser | null> {
  const db = await getAskDb();
  const [row] = await db
    .select({ id: users.id, firstName: users.firstName, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId));
  return row ?? null;
}

export async function deleteSession(sessionId: string) {
  const db = await getAskDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = await getAskDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  return {
    firstName: u.firstName,
    alias: aliasFor(u.id),
    email: u.email,
    phone: u.phone ?? undefined,
    classYear: u.classYear ?? undefined,
    showClassYear: u.showClassYear,
    blurb: u.blurb ?? undefined,
    busy: u.busy,
    canAcceptPayment: u.canAcceptPayment,
    payoutMethod: (u.payoutMethod ?? undefined) as Profile["payoutMethod"],
    payoutHandle: u.payoutHandle ?? undefined,
    interests: u.interests,
    tags: u.tags,
    weeklyLimit: u.weeklyLimit,
    emailNotifications: u.emailNotifications,
  };
}

/** What the board ranks by: interests and seeded free/busy. null with no interests picked. */
export async function getViewerPrefs(userId: string): Promise<ViewerPrefs | null> {
  const db = await getAskDb();
  const [u] = await db
    .select({ interests: users.interests, busy: users.busy })
    .from(users)
    .where(eq(users.id, userId));
  return u && u.interests.length > 0 ? u : null;
}

export type ProfileUpdate = Partial<Omit<Profile, "email" | "alias">>;

export async function updateProfile(userId: string, update: ProfileUpdate) {
  const db = await getAskDb();
  await db.update(users).set(update).where(eq(users.id, userId));
}

/** Thank-you notes on asks you helped with, newest first. */
export async function listThanksFor(userId: string, limit = 5): Promise<ThanksNote[]> {
  const db = await getAskDb();
  const rows = await db
    .select({ title: asks.title, thanks: asks.thanks, at: claims.heldAt })
    .from(claims)
    .innerJoin(asks, eq(asks.token, claims.askToken))
    .where(and(eq(claims.helperId, userId), isNotNull(asks.thanks)))
    .orderBy(desc(claims.heldAt))
    .limit(limit);
  return rows.map((r) => ({ title: r.title, thanks: r.thanks ?? "", at: r.at.toISOString() }));
}

/** The mocked helper setup on the claim page. Saved so it isn't asked again. */
export async function saveHelperSetup(userId: string, setup: HelperSetup) {
  await updateProfile(userId, {
    canAcceptPayment: setup.canAcceptPayment,
    // "bank" = a bank account or debit card connected through Stripe (mocked).
    payoutMethod: setup.payoutMethod ?? "bank",
    payoutHandle: setup.payoutAccount || undefined,
  });
}

export async function canUserAcceptPayment(userId: string) {
  const db = await getAskDb();
  const [u] = await db
    .select({ ok: users.canAcceptPayment, handle: users.payoutHandle })
    .from(users)
    .where(eq(users.id, userId));
  return Boolean(u?.ok && u.handle);
}

// ---------- blocked people ----------

/**
 * Blocks the other person on a card: the asker if you're a helper or browsing,
 * the helper if you're the asker. Works without revealing who an anonymous asker is.
 */
export async function blockFromCard(
  token: string,
  userId: string,
): Promise<{ error: string } | null> {
  const db = await getAskDb();
  const [row] = await db
    .select({ askerId: asks.askerId, helperId: claims.helperId })
    .from(asks)
    .leftJoin(claims, eq(claims.askToken, asks.token))
    .where(eq(asks.token, token));
  if (!row) return { error: "We couldn't find that ask." };
  const other = row.askerId === userId ? row.helperId : row.askerId;
  if (!other || other === userId) return { error: "There's no one to block on this ask." };
  await db
    .insert(blocks)
    .values({ blockerId: userId, blockedId: other, viaAskToken: token })
    .onConflictDoNothing();
  return null;
}

export async function listBlocked(userId: string): Promise<BlockedEntry[]> {
  const db = await getAskDb();
  const rows = await db
    .select({
      blockedId: blocks.blockedId,
      viaAskToken: blocks.viaAskToken,
      title: asks.title,
      askerId: asks.askerId,
    })
    .from(blocks)
    .leftJoin(asks, eq(asks.token, blocks.viaAskToken))
    .where(eq(blocks.blockerId, userId));
  // Aliases only, never names. Askers aren't shown even by alias on their cards.
  return rows.map((r) => ({
    key: r.viaAskToken ? `ask:${r.viaAskToken}` : `user:${r.blockedId}`,
    label:
      r.askerId === r.blockedId
        ? `The asker of “${r.title}”`
        : r.title
          ? `${aliasFor(r.blockedId)} (“${r.title}”)`
          : aliasFor(r.blockedId),
  }));
}

export async function unblock(userId: string, key: string) {
  const db = await getAskDb();
  const [kind, value] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const match =
    kind === "ask"
      ? eq(blocks.viaAskToken, value)
      : kind === "user"
        ? eq(blocks.blockedId, value)
        : undefined;
  if (!match) return;
  await db.delete(blocks).where(and(eq(blocks.blockerId, userId), match));
}

/** Either user has blocked the other. */
export async function isBlockedBetween(a: string, b: string) {
  const db = await getAskDb();
  const rows = await db
    .select({ one: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    );
  return rows.length > 0;
}
