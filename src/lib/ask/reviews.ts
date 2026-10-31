// "Rate your helper": after an ask is done, its asker rates the helper (1–5
// stars, "what went well" tags, an optional comment) and can add a tip, charged
// once to the method used to hold the ask (mocked, no money moves).
// Reviews are editable for 24 h; the tip can't change after it's charged.
//
// Trust points are computed from reviews and finished help every time they're
// read, never stored, so they can't be bought, sold or edited:
//   4–5 stars → +10, 3 stars → +5, 1–2 stars → 0, each finished help → +2.
import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { asks, claims, notifications, payments, reviews, users } from "@/db/schema";

import { getAskDb } from "./db";
import type { HelperRating, MyRatings, PaymentMethod, Review, ReviewTag } from "./types";
import { REVIEW_TAGS } from "./types";

export const EDIT_WINDOW_MS = 24 * 3_600_000;
const RECENT_WINDOW_MS = 90 * 24 * 3_600_000;
export const POINTS_PER_FINISHED_HELP = 2;

export function pointsForStars(stars: number) {
  return stars >= 4 ? 10 : stars === 3 ? 5 : 0;
}

/** Processing fee on a tip, same estimate as Pay to hold. */
export function tipFeeCents(tipCents: number, method: PaymentMethod) {
  if (tipCents <= 0) return 0;
  return method === "venmo" ? Math.round(tipCents * 0.019) : Math.round(tipCents * 0.029) + 30;
}

type Fail = { error: string };

export type ReviewContext = {
  title: string;
  helperFirstName: string;
  helperYear?: string;
  startsAt?: number;
  // Paid asks: what was released, and the method a tip is charged to.
  releasedCents?: number;
  method?: PaymentMethod;
  review?: Review;
};

function toReview(r: typeof reviews.$inferSelect): Review {
  return {
    stars: r.stars,
    tags: r.tags.filter((t): t is ReviewTag => (REVIEW_TAGS as readonly string[]).includes(t)),
    comment: r.comment ?? undefined,
    showName: r.showName,
    tipCents: r.tipCents,
    tipFeeCents: r.tipFeeCents,
    createdAt: r.createdAt.getTime(),
    editableUntil: r.createdAt.getTime() + EDIT_WINDOW_MS,
  };
}

/** The asker's own done ask, its helper, payment and review. */
export async function reviewContext(token: string, askerId: string): Promise<ReviewContext | Fail> {
  const db = await getAskDb();
  const [row] = await db
    .select({
      ask: asks,
      helperFirstName: users.firstName,
      helperYear: users.classYear,
      showYear: users.showClassYear,
    })
    .from(asks)
    .innerJoin(claims, eq(claims.askToken, asks.token))
    .innerJoin(users, eq(users.id, claims.helperId))
    .where(eq(asks.token, token));
  if (!row || row.ask.askerId !== askerId) return { error: "We couldn't find that ask." };
  if (row.ask.status !== "done") return { error: "You can rate your helper once it's done." };
  const [pay] = await db.select().from(payments).where(eq(payments.askToken, token));
  const [review] = await db.select().from(reviews).where(eq(reviews.askToken, token));
  return {
    title: row.ask.title,
    helperFirstName: row.helperFirstName,
    helperYear: row.showYear ? (row.helperYear ?? undefined) : undefined,
    startsAt: row.ask.startsAt?.getTime(),
    releasedCents: pay?.status === "released" ? pay.amountCents : undefined,
    method: pay ? (pay.method as PaymentMethod) : undefined,
    review: review ? toReview(review) : undefined,
  };
}

export type ReviewInput = {
  stars: number;
  tags: ReviewTag[];
  comment?: string;
  showName: boolean;
  tipCents: number;
};

/** First save creates the review (and charges any tip); later saves edit it for 24 h. */
export async function saveReview(
  token: string,
  askerId: string,
  input: ReviewInput,
  now = Date.now(),
): Promise<{ review: Review; created: boolean } | Fail> {
  const ctx = await reviewContext(token, askerId);
  if ("error" in ctx) return ctx;
  const db = await getAskDb();
  const fields = {
    stars: input.stars,
    tags: input.tags,
    comment: input.comment || null,
    showName: input.showName,
    updatedAt: new Date(now),
  };

  if (ctx.review) {
    // Edits: guarded by the 24 h window; the tip stays as charged.
    const [edited] = await db
      .update(reviews)
      .set(fields)
      .where(
        and(
          eq(reviews.askToken, token),
          eq(reviews.askerId, askerId),
          gt(reviews.createdAt, new Date(now - EDIT_WINDOW_MS)),
        ),
      )
      .returning();
    return edited
      ? { review: toReview(edited), created: false }
      : { error: "Reviews can only be edited for 24 hours." };
  }

  if (input.tipCents > 0 && !ctx.method) {
    return { error: "Tips are only for paid asks." };
  }
  const tip = ctx.method ? input.tipCents : 0;
  const fee = ctx.method ? tipFeeCents(tip, ctx.method) : 0;

  const created = await db.transaction(async (tx) => {
    const [claim] = await tx.select().from(claims).where(eq(claims.askToken, token));
    // The primary key makes the first save (and its tip) happen once.
    const [row] = await tx
      .insert(reviews)
      .values({
        askToken: token,
        askerId,
        helperId: claim.helperId,
        ...fields,
        tipCents: tip,
        tipFeeCents: fee,
        createdAt: new Date(now),
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    const [asker] = await tx
      .select({ firstName: users.firstName })
      .from(users)
      .where(eq(users.id, askerId));
    const who = input.showName ? (asker?.firstName ?? "Your asker") : "Your asker";
    const points = pointsForStars(input.stars);
    await tx.insert(notifications).values({
      userId: claim.helperId,
      askToken: token,
      kind: "update",
      topic: tip > 0 ? "payments" : "tasks",
      title: tip > 0 ? `${who} rated you and left a tip` : `${who} rated your help`,
      body:
        `${input.stars} of 5 for “${ctx.title}”` +
        (tip > 0 ? `, plus a $${(tip / 100).toFixed(2)} tip` : "") +
        (points > 0 ? `. +${points} trust points.` : "."),
    });
    return row;
  });
  return created
    ? { review: toReview(created), created: true }
    : { error: "You already rated this. Refresh to edit it." };
}

/** Average stars and count over the last 90 days, plus "On time" all time. */
async function ratingOf(helperId: string, now: number): Promise<HelperRating> {
  const db = await getAskDb();
  const [recent] = await db
    .select({
      average: sql<number>`coalesce(avg(${reviews.stars}), 0)::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(
      and(eq(reviews.helperId, helperId), gt(reviews.createdAt, new Date(now - RECENT_WINDOW_MS))),
    );
  const [onTime] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.helperId, helperId), sql`'On time' = any(${reviews.tags})`));
  return {
    average: Math.round(recent.average * 10) / 10,
    count: recent.count,
    onTime: onTime.n,
  };
}

/** What an asker may see about their helper; null when the helper hides reviews. */
export async function publicRating(helperId: string, now = Date.now()) {
  const db = await getAskDb();
  const [u] = await db
    .select({ showReviews: users.showReviews })
    .from(users)
    .where(eq(users.id, helperId));
  if (!u?.showReviews) return null;
  return ratingOf(helperId, now);
}

/** The helper on an ask, if any (for the asker's task page). */
export async function helperOf(token: string) {
  const db = await getAskDb();
  const [claim] = await db
    .select({ helperId: claims.helperId })
    .from(claims)
    .where(eq(claims.askToken, token));
  return claim?.helperId ?? null;
}

/** A helper's own ratings, points and tips (Me tab). */
export async function myRatings(userId: string, now = Date.now()): Promise<MyRatings> {
  const db = await getAskDb();
  const rating = await ratingOf(userId, now);
  const all = await db
    .select({
      review: reviews,
      askerName: users.firstName,
      askerYear: users.classYear,
      showYear: users.showClassYear,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.askerId))
    .where(eq(reviews.helperId, userId))
    .orderBy(desc(reviews.createdAt));
  const [finished] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(asks)
    .innerJoin(claims, eq(claims.askToken, asks.token))
    .where(and(eq(claims.helperId, userId), eq(asks.status, "done")));
  const [me] = await db
    .select({ showReviews: users.showReviews })
    .from(users)
    .where(eq(users.id, userId));

  const counts = new Map<ReviewTag, number>();
  for (const { review } of all) {
    for (const tag of toReview(review).tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return {
    ...rating,
    tagCounts: REVIEW_TAGS.filter((t) => counts.has(t))
      .map((tag) => ({ tag, count: counts.get(tag)! }))
      .sort((a, b) => b.count - a.count),
    trustPoints:
      all.reduce((sum, { review }) => sum + pointsForStars(review.stars), 0) +
      finished.n * POINTS_PER_FINISHED_HELP,
    tipsCents: all.reduce((sum, { review }) => sum + review.tipCents, 0),
    recent: all
      .filter(({ review }) => review.comment)
      .slice(0, 3)
      .map(({ review, askerName, askerYear, showYear }) => ({
        stars: review.stars,
        comment: review.comment!,
        // Anonymous reviews show only a class year (if shared), never a name.
        by: review.showName ? askerName : (showYear && askerYear) || "A classmate",
        at: review.createdAt.getTime(),
      })),
    showReviews: me?.showReviews ?? true,
  };
}
