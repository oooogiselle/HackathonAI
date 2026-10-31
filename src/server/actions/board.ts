// Server actions for the public board: one ask, one card. Anyone can view the
// board and a card; posting, claiming and every asker step need the mocked
// sign-in (src/server/actions/session.ts). Server actions are public endpoints, so each one re-checks
// sign-in, ownership and safety here, never trusting the UI.
"use server";

import { z } from "zod";

import { safetyCheck } from "@/lib/ai/ask/safety-check";
import {
  addSharedGroup,
  confirmCard,
  createCard,
  getBoardCard,
  holdCard,
  listOpenCards,
  markCardDone,
  markCardPaid,
  newToken,
  removeSharedGroup,
  saveCardThanks as saveCardThanksInStore,
  toPublicCard,
  type Transition,
} from "@/lib/ask/board-store";
import { COVERED_MESSAGE, formatPostMessage } from "@/lib/ask/format";
import { findGroup, HELPERS } from "@/lib/ask/mock-data";
import { getCurrentUser, type MockUser } from "@/lib/ask/mock-session";
import { MAX_POSTS_PER_GROUP_PER_DAY, refundRateLimit, takeRateLimit } from "@/lib/ask/store";
import type { PublicCard, Result } from "@/lib/ask/types";
import { postToGroup } from "@/lib/groups";
import { siteUrl } from "@/lib/site-url";

const SIGN_IN_ERROR = "Sign in to post or help.";
const HOUR = 3_600_000;

const text = z.string().trim().min(1).max(1000);
const token = z.string().min(1).max(64);

async function requireUser(): Promise<MockUser | null> {
  return getCurrentUser();
}

async function viewerId() {
  return (await getCurrentUser())?.id ?? null;
}

const NOT_FOUND = { error: "We couldn't find that ask." };

function parseToken(value: unknown): string | null {
  const parsed = token.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toResult(t: Transition, userId: string): Result<{ card: PublicCard }> {
  return "error" in t ? t : { ok: true, card: toPublicCard(t.card, userId) };
}

/** The landing page: open, unexpired cards, newest first. Public. */
export async function listBoard(input: { helperId?: string } = {}): Promise<PublicCard[]> {
  const viewer = await viewerId();
  // TODO(profile): read payment eligibility from the signed-in user's helper
  // profile. Until then a seeded helper id stands in for it.
  const helper = HELPERS.find((h) => h.id === input.helperId);
  const hidePaid = helper ? !helper.canAcceptPayment : false;
  return listOpenCards()
    .filter((card) => !(hidePaid && card.price > 0))
    .map((card) => toPublicCard(card, viewer));
}

/** One card, for the claim page (/h/[token]) and Matched. Public. */
export async function getCard(cardToken: string): Promise<PublicCard | null> {
  const tok = parseToken(cardToken);
  const card = tok ? getBoardCard(tok) : undefined;
  return card ? toPublicCard(card, await viewerId()) : null;
}

const postSchema = z.object({
  text,
  minutes: z.number().int().min(5).max(480),
  price: z.number().int().min(0).max(500),
  anonymous: z.boolean(),
  expiresAt: z.number().int().optional(),
});

/** Called only from the "Post to board" button. Text arrives already privacy-scrubbed. */
export async function postToBoard(
  input: z.input<typeof postSchema>,
): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { error: "Something's missing from your ask." };
  const { anonymous, minutes, price } = parsed.data;

  // Crisis, sensitive (visa, money, health) and academic asks never reach the board.
  const safety = await safetyCheck(parsed.data.text);
  if (safety.category !== "none") {
    return { error: "This ask is better shared one-on-one, so we won't post it to the board." };
  }

  const now = Date.now();
  const latest = now + 7 * 24 * HOUR;
  const expiresAt = Math.min(parsed.data.expiresAt ?? now + 24 * HOUR, latest);
  if (expiresAt <= now) return { error: "That time has already passed." };

  const cardToken = newToken();
  createCard({
    token: cardToken,
    askerId: user.id,
    text: parsed.data.text,
    minutes,
    price,
    anonymous,
    askerFirstName: anonymous ? undefined : user.firstName,
    status: "open",
    createdAt: now,
    expiresAt,
    sharedTo: [],
  });
  return { ok: true, token: cardToken };
}

const claimSchema = z.object({
  token,
  setup: z
    .object({ canAcceptPayment: z.boolean(), payoutAccount: z.string().trim().max(100) })
    .optional(),
});

/** Called only from the "I can help" button, on the board or the claim page. */
export async function claimCard(input: z.input<typeof claimSchema>): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const card = getBoardCard(parsed.data.token);
  if (!card) return NOT_FOUND;
  // Paid asks never go to helpers who can't accept payment (e.g. many F-1 students).
  // TODO(stripe): the setup is mocked; real payouts need Stripe Connect onboarding.
  const { setup } = parsed.data;
  if (card.price > 0 && !(setup?.canAcceptPayment && setup.payoutAccount)) {
    return { error: "This ask needs a helper who can accept payment" };
  }

  // Name and email come from the signed-in account, never from the form.
  const held = holdCard(parsed.data.token, {
    userId: user.id,
    firstName: user.firstName,
    email: user.email,
  });
  return "error" in held ? held : { ok: true };
}

/** Asker picks the helper who said yes. The bot posts "Covered" exactly once. */
export async function confirmHelper(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  const t = confirmCard(tok, user.id);

  // Only the request that won the transition gets here with a card.
  if ("card" in t) {
    for (const groupId of t.card.sharedTo) {
      const group = findGroup(groupId);
      if (!group) continue;
      // Never names the asker or the helper.
      await postToGroup(group, COVERED_MESSAGE).catch((error) =>
        console.error("Covered follow-up failed:", error),
      );
    }
  }
  return toResult(t, user.id);
}

export async function markDone(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  return toResult(markCardDone(tok, user.id), user.id);
}

/** The mocked "Pay $X" button. No payment API (TODO(stripe)). */
export async function markPaid(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  return toResult(markCardPaid(tok, user.id), user.id);
}

export async function saveCardThanks(
  cardToken: string,
  note: string,
): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  const parsedNote = text.safeParse(note);
  if (!parsedNote.success) return { error: "Write a short note first." };
  const t = saveCardThanksInStore(tok, user.id, parsedNote.data);
  return toResult(t, user.id);
}

const shareSchema = z.object({ token, groupId: z.string().max(64) });

/** Called only from the "Share to GroupMe" button. Same card, same link. */
export async function shareCardToGroup(input: z.input<typeof shareSchema>): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { error: "Something's missing." };

  const group = findGroup(parsed.data.groupId);
  if (!group) return { error: "That group isn't available." };

  const card = getBoardCard(parsed.data.token);
  if (!card) return NOT_FOUND;
  if (card.askerId !== user.id)
    return { error: "Only the person who posted this ask can do that." };

  const safety = await safetyCheck(card.text);
  if (safety.category !== "none") {
    return { error: "This ask is better shared one-on-one, so we won't post it to a group." };
  }

  if (!takeRateLimit(group.id)) {
    return {
      error: `${group.name} already has ${MAX_POSTS_PER_GROUP_PER_DAY} asks today. Try another group or tomorrow.`,
    };
  }

  // Save the share before posting, so a helper who taps the link instantly finds the card.
  const shared = addSharedGroup(card.token, user.id, group.id);
  if ("error" in shared) {
    refundRateLimit(group.id);
    return shared;
  }

  const message = formatPostMessage(
    card.text,
    card.anonymous ? null : card.askerFirstName || null,
    `${siteUrl()}/h/${card.token}`,
  );
  try {
    await postToGroup(group, message);
  } catch (error) {
    console.error("postToGroup failed:", error);
    removeSharedGroup(card.token, group.id);
    refundRateLimit(group.id);
    return { error: "Couldn't reach the group chat. Please try again." };
  }
  return { ok: true };
}
