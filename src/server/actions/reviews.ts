// Ratings: "Rate your helper" (asker, after done), the helper's own ratings on
// Me, and the helper's rating shown to their asker. Trust points and tips:
// see src/lib/ask/reviews.ts.
"use server";

import { z } from "zod";

import { getBoardCard } from "@/lib/ask/board-store";
import { getCurrentUser } from "@/lib/ask/mock-session";
import {
  helperOf,
  myRatings,
  publicRating,
  type ReviewContext,
  reviewContext,
  saveReview,
} from "@/lib/ask/reviews";
import {
  type HelperRating,
  type MyRatings,
  type Result,
  type Review,
  REVIEW_TAGS,
} from "@/lib/ask/types";

const SIGN_IN_ERROR = "Sign in to rate your helper.";
const token = z.string().min(1).max(64);
// Reviews are read by other students: no emails or phone numbers.
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

const reviewSchema = z.object({
  token,
  stars: z.number().int().min(1, "Pick 1 to 5 stars.").max(5),
  tags: z.array(z.enum(REVIEW_TAGS)).max(REVIEW_TAGS.length).default([]),
  comment: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters.")
    .refine((c) => !CONTACT.test(c), "Leave out emails and phone numbers.")
    .optional(),
  showName: z.boolean().default(false),
  // Whole cents, up to $50.
  tipCents: z.number().int().min(0).max(5000).default(0),
});

/** Everything Rate your helper needs, for the asker of a done ask. */
export async function getReviewPage(cardToken: string): Promise<Result<{ page: ReviewContext }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = token.safeParse(cardToken);
  if (!tok.success) return { error: "We couldn't find that ask." };
  const page = await reviewContext(tok.data, user.id);
  return "error" in page ? page : { ok: true, page };
}

/** "Submit review": creates it (charging any tip once) or edits it within 24 h. */
export async function submitReview(
  input: z.input<typeof reviewSchema>,
): Promise<Result<{ review: Review; created: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your review." };
  const { token: tok, ...review } = parsed.data;
  const saved = await saveReview(tok, user.id, { ...review, tags: [...new Set(review.tags)] });
  return "error" in saved ? saved : { ok: true, ...saved };
}

/** Me tab: my ratings as a helper, trust points and tips. */
export async function getMyRatings(): Promise<MyRatings | null> {
  const user = await getCurrentUser();
  return user ? myRatings(user.id) : null;
}

/**
 * The helper's rating, for the asker of this ask only, once someone said yes.
 * null when there's no helper yet or they hide their reviews.
 */
export async function getHelperRating(cardToken: string): Promise<HelperRating | null> {
  const user = await getCurrentUser();
  const tok = token.safeParse(cardToken);
  if (!user || !tok.success) return null;
  const card = await getBoardCard(tok.data);
  if (!card || card.askerId !== user.id) return null;
  const helperId = await helperOf(tok.data);
  return helperId ? publicRating(helperId) : null;
}
