// In-memory store for board cards: one ask, one card, whether it's seen on the
// board or opened from a GroupMe link. Lives on globalThis so it survives dev
// hot reloads.
//
// Every state change is a synchronous check-and-set (no await between the check
// and the set), so two "I can help" taps can't both win. Callers run side
// effects (bot posts) only when the transition returned a card.
// TODO(db): move to Postgres with guarded `UPDATE … WHERE status = … RETURNING`.
import "server-only";

import { randomBytes } from "node:crypto";

import { MEETING_SPOTS, SEED_CARDS } from "./mock-data";
import type { BoardCard, CardViewer, PublicCard } from "./types";

const SEED_ASKER = "seed";

type Store = { cards: Map<string, BoardCard> };

const g = globalThis as typeof globalThis & { __boardStore?: Store };
const store: Store = (g.__boardStore ??= { cards: seedCards(Date.now()) });

function seedCards(now: number) {
  const cards = new Map<string, BoardCard>();
  for (const seed of SEED_CARDS) {
    const token = newToken();
    cards.set(token, {
      token,
      askerId: SEED_ASKER,
      text: seed.text,
      minutes: seed.minutes,
      price: seed.price,
      anonymous: true,
      status: "open",
      createdAt: now - seed.postedMinutesAgo * 60_000,
      expiresAt: now + seed.expiresInHours * 3_600_000,
      sharedTo: [],
    });
  }
  return cards;
}

export function newToken() {
  return randomBytes(9).toString("base64url");
}

/** Either the updated card, or a user-facing reason it didn't change. */
export type Transition = { card: BoardCard } | { error: string };

function expireIfDue(card: BoardCard, now: number) {
  if ((card.status === "open" || card.status === "held") && card.expiresAt <= now) {
    card.status = "expired";
  }
}

function find(token: string, now: number): BoardCard | undefined {
  const card = store.cards.get(token);
  if (card) expireIfDue(card, now);
  return card;
}

function findAsAsker(token: string, userId: string, now: number): Transition {
  const card = find(token, now);
  if (!card) return { error: "We couldn't find that ask." };
  if (card.askerId !== userId) return { error: "Only the person who posted this ask can do that." };
  return { card };
}

export function createCard(card: BoardCard) {
  store.cards.set(card.token, card);
}

export function getBoardCard(token: string, now = Date.now()): BoardCard | undefined {
  return find(token, now);
}

/** Open, unexpired cards, newest first. */
export function listOpenCards(now = Date.now()): BoardCard[] {
  const open: BoardCard[] = [];
  for (const card of store.cards.values()) {
    expireIfDue(card, now);
    if (card.status === "open") open.push(card);
  }
  return open.sort((a, b) => b.createdAt - a.createdAt);
}

/** open → held. The first "I can help" wins; everyone after sees "Already taken". */
export function holdCard(
  token: string,
  holder: { userId: string; firstName: string; email: string },
  now = Date.now(),
): Transition {
  const card = find(token, now);
  if (!card) return { error: "We couldn't find that ask." };
  if (card.status === "expired") return { error: "This ask has expired" };
  if (card.askerId === holder.userId) return { error: "You can't take your own ask." };
  if (card.status !== "open") return { error: "Already taken" };
  card.status = "held";
  card.heldBy = { ...holder, heldAt: now };
  return { card };
}

/** held → confirmed, by the asker. Picks a public meeting spot. */
export function confirmCard(token: string, userId: string, now = Date.now()): Transition {
  const found = findAsAsker(token, userId, now);
  if ("error" in found) return found;
  const { card } = found;
  if (card.status !== "held") return { error: "There's no helper to confirm yet." };
  card.status = "confirmed";
  card.meetingSpot = MEETING_SPOTS[Math.floor(Math.random() * MEETING_SPOTS.length)];
  return { card };
}

/** confirmed → done, by the asker. */
export function markCardDone(token: string, userId: string, now = Date.now()): Transition {
  const found = findAsAsker(token, userId, now);
  if ("error" in found) return found;
  const { card } = found;
  if (card.status !== "confirmed") return { error: "This ask isn't in progress." };
  card.status = "done";
  return { card };
}

/** Mocked "Pay $X": only after done, only for paid cards, only once. */
export function markCardPaid(token: string, userId: string, now = Date.now()): Transition {
  const found = findAsAsker(token, userId, now);
  if ("error" in found) return found;
  const { card } = found;
  if (card.price === 0) return { error: "This ask is a favor, so there's nothing to pay." };
  if (card.status !== "done") return { error: "Mark the help as done before paying." };
  if (card.paidAt) return { error: "Already paid." };
  card.paidAt = now;
  return { card };
}

export function saveCardThanks(
  token: string,
  userId: string,
  note: string,
  now = Date.now(),
): Transition {
  const found = findAsAsker(token, userId, now);
  if ("error" in found) return found;
  const { card } = found;
  if (card.status !== "confirmed" && card.status !== "done") {
    return { error: "You can thank your helper once they're confirmed." };
  }
  // TODO(notifications): deliver the note to the helper.
  card.thanks = note;
  return { card };
}

/** Records a bot share before posting, so the link works the moment it lands. */
export function addSharedGroup(
  token: string,
  userId: string,
  groupId: string,
  now = Date.now(),
): Transition {
  const found = findAsAsker(token, userId, now);
  if ("error" in found) return found;
  const { card } = found;
  if (card.status !== "open") return { error: "Only open asks can be shared." };
  if (card.sharedTo.includes(groupId)) return { error: "Already shared to that group." };
  card.sharedTo.push(groupId);
  return { card };
}

/** Undo addSharedGroup when the bot post fails. */
export function removeSharedGroup(token: string, groupId: string) {
  const card = store.cards.get(token);
  if (card) card.sharedTo = card.sharedTo.filter((id) => id !== groupId);
}

export function toPublicCard(card: BoardCard, viewerId: string | null): PublicCard {
  const { askerId, heldBy, askerFirstName, ...rest } = card;
  let viewer: CardViewer = "signed-out";
  if (viewerId) {
    viewer = viewerId === askerId ? "asker" : viewerId === heldBy?.userId ? "helper" : "other";
  }
  return {
    ...rest,
    sharedTo: [...rest.sharedTo],
    ...(card.anonymous ? {} : { askerFirstName }),
    heldByFirstName: heldBy?.firstName,
    viewer,
  };
}
