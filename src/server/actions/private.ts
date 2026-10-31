// Private route: the asker picks 2–3 helpers; only they see the ask.
// Helpers answer "I can help" (the same hold as the board) or "Not this time"
// (no reason asked, nothing sent to the asker). Never posted to a group.
"use server";

import { z } from "zod";

import { matchHelpers as matchHelpersAI } from "@/lib/ai/ask/match-helpers";
import { safetyCheck } from "@/lib/ai/ask/safety-check";
import {
  acceptRequest,
  declineRequest,
  listHelperProfiles,
  listRequestsFor,
  MAX_PRIVATE_RECIPIENTS,
  recentLoad,
  sendPrivately as sendPrivatelyInStore,
  toPublicCard,
} from "@/lib/ask/board-store";
import { getCurrentUser } from "@/lib/ask/mock-session";
import {
  INTERESTS,
  type MatchSuggestion,
  type PrivateRequest,
  type PublicCard,
  type Result,
} from "@/lib/ask/types";
import { canUserAcceptPayment } from "@/lib/ask/users";

const SIGN_IN_ERROR = "Sign in to post or help.";
const token = z.string().min(1).max(64);

const sendSchema = z.object({
  token,
  helperIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_PRIVATE_RECIPIENTS),
});

const matchSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  minutes: z.number().int().min(5).max(480),
  price: z.number().int().min(0).max(500),
  // ms, like createPrivateAsk. No time → free/busy isn't checked.
  startsAt: z.number().int().optional(),
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length).default([]),
  needs: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(5).default([]),
});

/**
 * "Ask privately": 2–3 people likely to say yes, with a one-line why. A
 * read-only preview, so sign-in is optional; when signed in, you and anyone
 * blocked either way are left out. sendPrivately re-checks on send.
 */
export async function matchHelpers(input: z.input<typeof matchSchema>): Promise<MatchSuggestion[]> {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return [];
  const { startsAt, ...ask } = parsed.data;

  // Crisis and essay asks are never matched to a peer.
  const { category } = await safetyCheck(ask.text);
  if (category === "crisis" || category === "academic") return [];

  const viewer = await getCurrentUser();
  const helpers = await listHelperProfiles(viewer?.id ?? null);
  const load = await recentLoad(helpers.map((h) => h.id));
  const picks = await matchHelpersAI(
    {
      ...ask,
      startsAt: startsAt === undefined ? undefined : new Date(startsAt).toISOString(),
      activeMatches: Object.fromEntries(load),
    },
    helpers,
  );
  return picks.map(({ helper, why }) => ({
    helper: { id: helper.id, firstName: helper.firstName, year: helper.year },
    why,
  }));
}

/** Called only from the "Send to N people" button. */
export async function sendPrivately(
  input: z.input<typeof sendSchema>,
): Promise<Result<{ card: PublicCard }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { error: `Pick 1 to ${MAX_PRIVATE_RECIPIENTS} people.` };
  const t = await sendPrivatelyInStore(parsed.data.token, user.id, parsed.data.helperIds);
  return "error" in t ? t : { ok: true, card: toPublicCard(t.card, user.id) };
}

/** A helper's private requests (their inbox of asks). */
export async function listMyRequests(): Promise<Result<{ requests: PrivateRequest[] }>> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const rows = await listRequestsFor(user.id);
  return {
    ok: true,
    requests: rows.map((r) => ({
      card: toPublicCard(r.card, user.id, true),
      sentAt: r.sentAt,
      response: r.response,
    })),
  };
}

const respondSchema = z.object({ token, answer: z.enum(["yes", "no"]) });

/** "I can help" or "Not this time" on a private request. */
export async function respondToRequest(input: z.input<typeof respondSchema>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGN_IN_ERROR };
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) return { error: "Something's missing." };

  if (parsed.data.answer === "no") {
    await declineRequest(parsed.data.token, user.id);
    return { ok: true };
  }

  const card = (await listRequestsFor(user.id)).find(
    (r) => r.card.token === parsed.data.token,
  )?.card;
  if (!card) return { error: "This ask was sent to other helpers." };
  if (card.price > 0 && !(await canUserAcceptPayment(user.id))) {
    return { error: "This ask needs a helper who can accept payment" };
  }
  const held = await acceptRequest(parsed.data.token, user.id);
  return "error" in held ? held : { ok: true };
}
