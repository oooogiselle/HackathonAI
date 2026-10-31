// Server actions for asks: the public board, private asks, and every step from
// "I can help" to the thank-you. Anyone can view the board and a card; posting,
// claiming and every asker step need the mocked sign-in
// (src/server/actions/session.ts). Server actions are public endpoints, so each
// one re-checks sign-in, ownership and safety here, never trusting the UI.
"use server";

import { z } from "zod";

import { safetyCheck } from "@/lib/ai/ask/safety-check";
import {
  addSharedGroup,
  cancelCard as cancelCardInStore,
  confirmCard,
  createCard,
  extendCard as extendCardInStore,
  getBoardCard,
  holdCard,
  isRecipient,
  listMine,
  listOpenCards,
  markCardDone,
  markCardPaid,
  MAX_POSTS_PER_GROUP_PER_DAY,
  refundRateLimit,
  removeSharedGroup,
  saveCardThanks as saveCardThanksInStore,
  takeRateLimit,
  toPublicCard,
  type Transition,
} from "@/lib/ask/board-store";
import { COVERED_MESSAGE, formatPostMessage } from "@/lib/ask/format";
import { findGroup } from "@/lib/ask/mock-data";
import { getCurrentUser, type MockUser } from "@/lib/ask/mock-session";
import { ASK_CATEGORIES, PAY_TYPES, type PublicCard, type Result } from "@/lib/ask/types";
import { canUserAcceptPayment, saveHelperSetup } from "@/lib/ask/users";
import { postToGroup } from "@/lib/groups";
import { siteUrl } from "@/lib/site-url";

const SIGN_IN_ERROR = "Sign in to post or help.";
const NOT_FOUND = { error: "We couldn't find that ask." };
const HOUR = 3_600_000;

const text = z.string().trim().min(1).max(1000);
const token = z.string().min(1).max(64);

async function requireUser(): Promise<MockUser | null> {
  return getCurrentUser();
}

async function viewerId() {
  return (await getCurrentUser())?.id ?? null;
}

function parseToken(value: unknown): string | null {
  const parsed = token.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toResult(t: Transition, userId: string): Result<{ card: PublicCard }> {
  return "error" in t ? t : { ok: true, card: toPublicCard(t.card, userId) };
}

/** The landing page: open, unexpired public asks, newest first. Public. */
export async function listBoard(): Promise<PublicCard[]> {
  const viewer = await viewerId();
  return (await listOpenCards(viewer)).map((card) => toPublicCard(card, viewer));
}

/** One card, for the claim page (/h/[token]), Waiting and Matched. Public, except private asks. */
export async function getCard(cardToken: string): Promise<PublicCard | null> {
  const tok = parseToken(cardToken);
  const card = tok ? await getBoardCard(tok) : undefined;
  if (!card) return null;
  const viewer = await viewerId();
  const invited = Boolean(viewer && card.private && (await isRecipient(card.token, viewer)));
  // Private asks are visible only to the asker, the picked helpers and the holder.
  if (card.private && viewer !== card.askerId && viewer !== card.heldBy?.userId && !invited) {
    return null;
  }
  return toPublicCard(card, viewer, invited);
}

/** The Claimed tab: "My asks" (asking) and "I'm helping". Empty when signed out. */
export async function listMyCards(): Promise<{ asking: PublicCard[]; helping: PublicCard[] }> {
  const user = await requireUser();
  if (!user) return { asking: [], helping: [] };
  const mine = await listMine(user.id);
  return {
    asking: mine.asking.map((c) => toPublicCard(c, user.id)),
    helping: mine.helping.map((c) => toPublicCard(c, user.id)),
  };
}

// "Expires in": 3 h, today (end of day), 24 h, 3 days. Or an exact time.
const EXPIRY_CHOICES = { "3h": 3 * HOUR, "24h": 24 * HOUR, "3d": 72 * HOUR } as const;

const askSchema = z.object({
  title: z.string().trim().min(1, "Add a short title.").max(120),
  text,
  category: z.enum(ASK_CATEGORIES).default("other"),
  payType: z.enum(PAY_TYPES).optional(),
  minutes: z.number().int().min(5).max(480),
  price: z.number().int().min(0).max(500),
  anonymous: z.boolean().default(true),
  startsAt: z.number().int().optional(),
  neededBy: z.number().int().optional(),
  expiresIn: z.enum(["3h", "today", "24h", "3d"]).optional(),
  expiresAt: z.number().int().optional(),
});

type AskInput = z.input<typeof askSchema>;

function resolveExpiry(input: z.output<typeof askSchema>, now: number) {
  const latest = now + 7 * 24 * HOUR;
  let at = input.expiresAt ?? now + 24 * HOUR;
  if (input.expiresIn === "today") {
    // TODO(timezone): server-local end of day; pass the user's timezone later.
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);
    at = end.getTime();
  } else if (input.expiresIn) {
    at = now + EXPIRY_CHOICES[input.expiresIn];
  }
  return Math.min(at, latest);
}

async function createAsk(input: AskInput, isPrivate: boolean): Promise<Result<{ token: string }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Something's missing from your ask." };
  }
  const data = parsed.data;
  const payType = data.payType ?? (data.price > 0 ? "pay" : "free");
  // Trades and favors carry no price.
  const price = payType === "pay" || payType === "fund" ? data.price : 0;

  // Crisis and academic asks never become asks. Sensitive ones (visa, money,
  // health) may go privately to picked helpers, never to the board or a group.
  const safety = await safetyCheck(`${data.title}\n${data.text}`);
  if (safety.category === "crisis" || safety.category === "academic") {
    return { error: "We can't post this one. Let's find the right support instead." };
  }
  if (safety.category === "sensitive" && !isPrivate) {
    return { error: "This ask is better shared one-on-one, so we won't post it to the board." };
  }

  const now = Date.now();
  const expiresAt = resolveExpiry(data, now);
  if (expiresAt <= now) return { error: "That time has already passed." };

  const card = await createCard(
    {
      askerId: user.id,
      title: data.title,
      text: data.text,
      category: data.category,
      payType,
      price,
      minutes: data.minutes,
      anonymous: data.anonymous,
      private: isPrivate,
      startsAt: data.startsAt,
      neededBy: data.neededBy,
      expiresAt,
    },
    now,
  );
  return { ok: true, token: card.token };
}

/** Called only from the "Post" button. Text arrives already privacy-scrubbed. */
export async function postToBoard(input: AskInput): Promise<Result<{ token: string }>> {
  return createAsk(input, false);
}

/** "Ask privately": creates the ask; send it with sendPrivately (src/server/actions/private.ts). */
export async function createPrivateAsk(input: AskInput): Promise<Result<{ token: string }>> {
  return createAsk(input, true);
}

const claimSchema = z.object({
  token,
  setup: z
    .object({
      canAcceptPayment: z.boolean(),
      payoutMethod: z.enum(["venmo", "bank"]).optional(),
      payoutAccount: z.string().trim().max(100),
    })
    .optional(),
});

/** Called only from the "I can help" / "Claim" button, on the board or the claim page. */
export async function claimCard(input: z.input<typeof claimSchema>): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const card = await getBoardCard(parsed.data.token);
  if (!card) return NOT_FOUND;

  // Paid asks never go to helpers who can't accept payment (e.g. many F-1 students).
  // TODO(stripe): the setup is mocked; real payouts need Stripe Connect onboarding.
  const { setup } = parsed.data;
  if (setup) await saveHelperSetup(user.id, setup);
  if (card.price > 0 && !(await canUserAcceptPayment(user.id))) {
    return { error: "This ask needs a helper who can accept payment" };
  }

  const held = await holdCard(parsed.data.token, user.id);
  return "error" in held ? held : { ok: true };
}

/** Asker picks the helper who said yes. The bot posts "Covered" exactly once. */
export async function confirmHelper(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  const t = await confirmCard(tok, user.id);

  // Only the request that won the transition gets here with a card.
  if ("card" in t) {
    for (const { groupId } of t.card.shares) {
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

/** Asker confirms the help is done. Paid asks go to the Pay screen next. */
export async function markDone(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  return toResult(await markCardDone(tok, user.id), user.id);
}

const payMethod = z.enum(["venmo", "card"]);

/**
 * The mocked "Pay $X" button, after done. Free favors skip it. No payment API
 * (TODO(stripe)). `card.payment` has the fee breakdown for the receipt.
 */
export async function markPaid(
  cardToken: string,
  method: z.infer<typeof payMethod> = "venmo",
): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  const parsedMethod = payMethod.safeParse(method);
  if (!tok || !parsedMethod.success) return NOT_FOUND;
  return toResult(await markCardPaid(tok, user.id, parsedMethod.data), user.id);
}

/** "Cancel ask" while waiting (open or held). */
export async function cancelCard(cardToken: string): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const tok = parseToken(cardToken);
  if (!tok) return NOT_FOUND;
  return toResult(await cancelCardInStore(tok, user.id), user.id);
}

/** "Extend 24 h" on Waiting: pass card.expiresAt + 24 h. Open asks only; max 7 days from now. */
export async function extendCard(input: {
  token: string;
  expiresAt: number;
}): Promise<Result<{ card: PublicCard }>> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = z.object({ token, expiresAt: z.number().int() }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  return toResult(
    await extendCardInStore(parsed.data.token, user.id, parsed.data.expiresAt),
    user.id,
  );
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
  return toResult(await saveCardThanksInStore(tok, user.id, parsedNote.data), user.id);
}

const shareSchema = z.object({ token, groupId: z.string().max(64) });

/** Called only from the "Post to group" button. Same card, same link. */
export async function shareCardToGroup(input: z.input<typeof shareSchema>): Promise<Result> {
  const user = await requireUser();
  if (!user) return { error: SIGN_IN_ERROR };

  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { error: "Something's missing." };

  const group = findGroup(parsed.data.groupId);
  if (!group) return { error: "That group isn't available." };

  const card = await getBoardCard(parsed.data.token);
  if (!card) return NOT_FOUND;
  if (card.askerId !== user.id)
    return { error: "Only the person who posted this ask can do that." };
  if (card.private) return { error: "Private asks are never shared to groups." };

  const safety = await safetyCheck(`${card.title}\n${card.text}`);
  if (safety.category !== "none") {
    return { error: "This ask is better shared one-on-one, so we won't post it to a group." };
  }

  if (!(await takeRateLimit(group.id))) {
    return {
      error: `${group.name} already has ${MAX_POSTS_PER_GROUP_PER_DAY} asks today. Try another group or tomorrow.`,
    };
  }

  // Save the share before posting, so a helper who taps the link instantly finds the card.
  const shared = await addSharedGroup(card.token, user.id, group.id, group.name);
  if ("error" in shared) {
    await refundRateLimit(group.id);
    return shared;
  }

  const message = formatPostMessage(
    `${card.title}\n${card.text}`,
    card.anonymous ? null : card.askerFirstName || null,
    `${siteUrl()}/h/${card.token}`,
  );
  try {
    await postToGroup(group, message);
  } catch (error) {
    console.error("postToGroup failed:", error);
    await removeSharedGroup(card.token, group.id);
    await refundRateLimit(group.id);
    return { error: "Couldn't reach the group chat. Please try again." };
  }
  return { ok: true };
}
