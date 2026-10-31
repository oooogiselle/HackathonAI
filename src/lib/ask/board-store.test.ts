import { describe, expect, it } from "vitest";

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
  toPublicCard,
} from "./board-store";
import type { BoardCard } from "./types";

const HOUR = 3_600_000;
const ASKER = "user-asker";

function makeCard(overrides: Partial<BoardCard> = {}): BoardCard {
  const now = Date.now();
  const card: BoardCard = {
    token: newToken(),
    askerId: ASKER,
    text: "Ride to Bradley Airport Saturday morning",
    minutes: 45,
    price: 15,
    anonymous: true,
    askerFirstName: "Lin",
    status: "open",
    createdAt: now,
    expiresAt: now + 24 * HOUR,
    sharedTo: [],
    ...overrides,
  };
  createCard(card);
  return card;
}

const helper = (n: number) => ({
  userId: `helper-${n}`,
  firstName: `H${n}`,
  email: `h${n}@northfield.edu`,
});

describe("board store", () => {
  it("starts with seeded open cards, newest first", () => {
    const cards = listOpenCards();
    expect(cards.length).toBeGreaterThanOrEqual(5);
    const times = cards.map((c) => c.createdAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("lets exactly one of 10 parallel claims win", async () => {
    const card = makeCard();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => holdCard(card.token, helper(i))),
      ),
    );
    expect(results.filter((r) => "card" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r && r.error === "Already taken")).toHaveLength(9);
    expect(listOpenCards().some((c) => c.token === card.token)).toBe(false);
  });

  it("won't let the asker take their own ask", () => {
    const card = makeCard();
    expect(holdCard(card.token, { ...helper(1), userId: ASKER })).toEqual({
      error: "You can't take your own ask.",
    });
  });

  it("expires cards at their deadline", () => {
    const card = makeCard({ expiresAt: Date.now() + HOUR });
    const later = Date.now() + 2 * HOUR;
    expect(holdCard(card.token, helper(1), later)).toEqual({ error: "This ask has expired" });
    expect(listOpenCards(later).some((c) => c.token === card.token)).toBe(false);
    expect(getBoardCard(card.token)?.status).toBe("expired");
  });

  it("only lets the asker confirm, finish and pay, each once", () => {
    const card = makeCard();
    holdCard(card.token, helper(1));

    expect("error" in confirmCard(card.token, "helper-1")).toBe(true);
    expect("card" in confirmCard(card.token, ASKER)).toBe(true);
    expect("error" in confirmCard(card.token, ASKER)).toBe(true);
    expect(card.meetingSpot).toBeTruthy();

    expect("error" in markCardPaid(card.token, ASKER)).toBe(true); // not done yet
    expect("error" in markCardDone(card.token, "helper-1")).toBe(true);
    expect("card" in markCardDone(card.token, ASKER)).toBe(true);
    expect("error" in markCardDone(card.token, ASKER)).toBe(true);

    expect("card" in markCardPaid(card.token, ASKER)).toBe(true);
    const paidAt = card.paidAt;
    expect(markCardPaid(card.token, ASKER)).toEqual({ error: "Already paid." });
    expect(card.paidAt).toBe(paidAt);
  });

  it("never charges for a favor", () => {
    const card = makeCard({ price: 0 });
    holdCard(card.token, helper(1));
    confirmCard(card.token, ASKER);
    markCardDone(card.token, ASKER);
    expect("error" in markCardPaid(card.token, ASKER)).toBe(true);
  });

  it("only the asker shares, once per group, and only while open", () => {
    const card = makeCard();
    expect("error" in addSharedGroup(card.token, "someone-else", "intl")).toBe(true);
    expect("card" in addSharedGroup(card.token, ASKER, "intl")).toBe(true);
    expect("error" in addSharedGroup(card.token, ASKER, "intl")).toBe(true);
    holdCard(card.token, helper(1));
    expect("error" in addSharedGroup(card.token, ASKER, "kessler")).toBe(true);
  });

  it("public cards hide user ids, emails and anonymous names", () => {
    const card = makeCard();
    holdCard(card.token, helper(1));
    const pub = toPublicCard(card, null);
    const json = JSON.stringify(pub);
    expect(json).not.toContain("northfield.edu");
    expect(json).not.toContain(ASKER);
    expect(json).not.toContain("helper-1");
    expect(json).not.toContain("Lin");
    expect(pub.heldByFirstName).toBe("H1");
    expect(pub.viewer).toBe("signed-out");

    expect(toPublicCard(card, ASKER).viewer).toBe("asker");
    expect(toPublicCard(card, "helper-1").viewer).toBe("helper");
    expect(toPublicCard(card, "helper-2").viewer).toBe("other");

    const named = makeCard({ anonymous: false });
    expect(toPublicCard(named, null).askerFirstName).toBe("Lin");
  });
});
