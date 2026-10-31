// Seeds the fictional Dartmouth helpers and the demo board cards.
// Safe to run on every start: seed users are upserted by id, and demo cards that
// expired unclaimed (or expired while held) are reopened with fresh times.
import "server-only";

import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { askRecipients, askShares, asks, claims, users } from "@/db/schema";

import type { AskDb } from "./db";
import { HELPERS, SCHOOL_EMAIL_DOMAIN, SEED_ASKER, SEED_CARDS } from "./mock-data";

export async function seedAskData(db: AskDb, now = Date.now()) {
  await db
    .insert(users)
    .values([
      { ...SEED_ASKER, showClassYear: false },
      ...HELPERS.map((h) => ({
        id: h.id,
        firstName: h.firstName,
        email: `${h.id}@${SCHOOL_EMAIL_DOMAIN}`,
        classYear: h.year,
        blurb: h.blurb,
        interests: h.interests,
        tags: h.tags,
        busy: h.busy,
        weeklyLimit: h.weeklyLimit,
        canAcceptPayment: h.canAcceptPayment,
      })),
    ])
    .onConflictDoUpdate({
      // Seed accounts only (fixed ids): keeps their email on the current campus domain.
      target: users.id,
      set: { email: sql`excluded.email`, blurb: sql`excluded.blurb` },
    });

  const reopened: string[] = [];
  for (const card of SEED_CARDS) {
    const row = {
      token: card.token,
      askerId: SEED_ASKER.id,
      title: card.title,
      details: card.text,
      category: card.category,
      payType: card.payType,
      price: card.price,
      minutes: card.minutes,
      anonymous: true,
      status: "open",
      createdAt: new Date(now - card.postedMinutesAgo * 60_000),
      expiresAt: new Date(now + card.expiresInHours * 3_600_000),
    };
    const [written] = await db
      .insert(asks)
      .values(row)
      .onConflictDoUpdate({
        target: asks.token,
        set: { status: "open", createdAt: row.createdAt, expiresAt: row.expiresAt },
        // Only reopen demo cards that expired before anyone finished them.
        setWhere: and(
          eq(asks.askerId, SEED_ASKER.id),
          sql`${asks.status} in ('open', 'held')`,
          lte(asks.expiresAt, new Date(now)),
        ),
      })
      .returning({ token: asks.token });
    if (written) reopened.push(written.token);
  }
  // Keep demo card wording current (seed-owned cards only).
  for (const card of SEED_CARDS) {
    await db
      .update(asks)
      .set({ title: card.title, details: card.text })
      .where(and(eq(asks.token, card.token), eq(asks.askerId, SEED_ASKER.id)));
  }
  if (reopened.length) {
    await db.delete(claims).where(inArray(claims.askToken, reopened));
    await db.delete(askShares).where(inArray(askShares.askToken, reopened));
    await db.delete(askRecipients).where(inArray(askRecipients.askToken, reopened));
  }
}
