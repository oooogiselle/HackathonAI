import { describe, expect, it } from "vitest";

import { matchesInterests, rankForViewer } from "./board-rank";
import type { PublicCard } from "./types";

// Sat Nov 7 2026, 10:00 local.
const SAT_10 = new Date(2026, 10, 7, 10, 0).getTime();

const card = (token: string, patch: Partial<PublicCard> = {}): PublicCard => ({
  token,
  title: "Help",
  text: "Some help.",
  category: "Other",
  payType: "free",
  minutes: 30,
  price: 0,
  anonymous: true,
  private: false,
  status: "open",
  createdAt: 0,
  expiresAt: SAT_10 + 3_600_000,
  shares: [],
  viewer: "other",
  ...patch,
});

describe("matchesInterests", () => {
  it("matches a preset category the helper picked", () => {
    expect(matchesInterests(card("a", { category: "Rides" }), ["rides"])).toBe(true);
    expect(matchesInterests(card("a", { category: "Cooking" }), ["rides"])).toBe(false);
  });

  it("falls back to keywords for a typed category", () => {
    const lift = card("a", { category: "Errands", title: "Ride to the airport" });
    expect(matchesInterests(lift, ["rides"])).toBe(true);
    expect(matchesInterests(lift, ["cooking"])).toBe(false);
  });

  it("matches nothing with no interests", () => {
    expect(matchesInterests(card("a", { category: "Rides" }), [])).toBe(false);
  });
});

describe("rankForViewer", () => {
  const cards = [
    card("other", { category: "Cooking" }),
    card("busy", { category: "Rides", startsAt: SAT_10 }),
    card("free", { category: "Rides" }),
    card("mine", { category: "Rides", viewer: "asker" }),
  ];
  const busy = [{ day: 6, start: "09:00", end: "12:00" }];

  it("puts matches first, ones you're free for before busy ones", () => {
    const ranked = rankForViewer(cards, { interests: ["rides"], busy });
    expect(ranked.map((c) => c.token)).toEqual(["free", "busy", "other", "mine"]);
    expect(ranked.map((c) => Boolean(c.forYou))).toEqual([true, true, false, false]);
  });

  it("keeps newest first inside a group", () => {
    const ranked = rankForViewer(cards, { interests: ["rides"], busy: [] });
    expect(ranked.map((c) => c.token)).toEqual(["busy", "free", "other", "mine"]);
  });

  it("leaves the board as is with no interests", () => {
    expect(rankForViewer(cards, { interests: [], busy })).toEqual(cards);
  });
});
