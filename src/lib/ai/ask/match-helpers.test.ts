import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Helper } from "@/lib/ask/types";

import { eligibleHelpers, isBusyAt, matchHelpers, type MatchInput } from "./match-helpers";

function makeHelper(id: string, overrides: Partial<Helper> = {}): Helper {
  return {
    id,
    firstName: id,
    year: "Senior",
    blurb: `${id} has a car`,
    tags: ["ride", "car", "airport"],
    interests: ["rides"],
    busy: [],
    weeklyLimit: 3,
    canAcceptPayment: true,
    ...overrides,
  };
}

// Saturday Nov 7 2026, 10:00 local time.
const SAT_10AM = new Date(2026, 10, 7, 10, 0).toISOString();

const ride = (overrides: Partial<MatchInput> = {}): MatchInput => ({
  text: "Ride to Lebanon airport Saturday morning",
  interests: ["rides"],
  needs: ["car"],
  startsAt: SAT_10AM,
  minutes: 45,
  price: 15,
  ...overrides,
});

const ids = (helpers: { id: string }[]) => helpers.map((h) => h.id);

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
});

describe("isBusyAt", () => {
  const busy = [{ day: 6, start: "09:00", end: "11:00" }];

  it("flags an overlap and ignores back-to-back times", () => {
    expect(isBusyAt(busy, new Date(2026, 10, 7, 10, 30), 30)).toBe(true);
    expect(isBusyAt(busy, new Date(2026, 10, 7, 8, 30), 45)).toBe(true);
    expect(isBusyAt(busy, new Date(2026, 10, 7, 11, 0), 30)).toBe(false);
    expect(isBusyAt(busy, new Date(2026, 10, 7, 8, 0), 60)).toBe(false);
  });

  it("only checks the ask's own day", () => {
    expect(isBusyAt(busy, new Date(2026, 10, 6, 10, 0), 30)).toBe(false);
  });

  it("checks the next morning for an ask that runs past midnight", () => {
    const early = [{ day: 0, start: "00:00", end: "01:00" }];
    expect(isBusyAt(early, new Date(2026, 10, 7, 23, 30), 60)).toBe(true);
    expect(isBusyAt(early, new Date(2026, 10, 7, 22, 0), 60)).toBe(false);
  });
});

describe("eligibleHelpers", () => {
  it("drops helpers who are busy at the ask's time", () => {
    const helpers = [
      makeHelper("busy", { busy: [{ day: 6, start: "09:00", end: "12:00" }] }),
      makeHelper("free"),
    ];
    expect(ids(eligibleHelpers(ride(), helpers))).toEqual(["free"]);
  });

  it("skips the free/busy check when the ask has no time", () => {
    const helpers = [makeHelper("busy", { busy: [{ day: 6, start: "09:00", end: "12:00" }] })];
    expect(ids(eligibleHelpers(ride({ startsAt: undefined }), helpers))).toEqual(["busy"]);
  });

  it("drops helpers at their weekly limit", () => {
    const helpers = [makeHelper("full", { weeklyLimit: 2 }), makeHelper("room")];
    const input = ride({ activeMatches: { full: 2 } });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["room"]);
  });

  it("keeps paid asks away from helpers who can't accept payment", () => {
    const helpers = [makeHelper("f1", { canAcceptPayment: false }), makeHelper("paid")];
    expect(ids(eligibleHelpers(ride(), helpers))).toEqual(["paid"]);
    expect(ids(eligibleHelpers(ride({ price: 0 }), helpers))).toEqual(["f1", "paid"]);
  });

  it("drops helpers missing a must-have", () => {
    const helpers = [makeHelper("nocar", { tags: ["ride"] }), makeHelper("car")];
    expect(ids(eligibleHelpers(ride(), helpers))).toEqual(["car"]);
  });

  it("puts helpers with fewer active matches first", () => {
    const helpers = [makeHelper("a"), makeHelper("b"), makeHelper("c")];
    const input = ride({ activeMatches: { a: 2, b: 1 } });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["c", "b", "a"]);
  });

  it("matches tags as whole words: 'carry' is not 'car'", () => {
    const helpers = [makeHelper("driver", { tags: ["car"], interests: ["rides"] })];
    const input = ride({ text: "Help me carry boxes", interests: [], needs: [] });
    expect(eligibleHelpers(input, helpers)).toEqual([]);
  });

  it("reads Dartmouth words: a Dartmouth Coach ask finds the airport driver", () => {
    const helpers = [
      makeHelper("cook", { tags: ["cooking"], interests: ["cooking"] }),
      makeHelper("driver", { tags: ["airport", "luggage"], interests: ["rides"] }),
    ];
    const input = ride({ text: "Get me to the Dartmouth Coach stop", interests: [], needs: [] });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["driver"]);
  });

  it("puts someone who's done this exact thing ahead of a less busy generalist", () => {
    const helpers = [
      makeHelper("general", { tags: ["errand"] }),
      makeHelper("expert", { tags: ["airport", "luggage"] }),
    ];
    const input = ride({ needs: [], activeMatches: { expert: 1 } });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["expert", "general"]);
  });

  it("boosts a shared house community but never filters on it", () => {
    const helpers = [
      makeHelper("far", { tags: ["airport", "car"] }),
      makeHelper("near", { tags: ["airport", "car", "west house"] }),
    ];
    const input = ride({ askerCommunities: ["west house"] });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["near", "far"]);
    expect(ids(eligibleHelpers(ride(), helpers))).toHaveLength(2);
  });

  it("counts close embeddings as experience when they're there", () => {
    const helpers = [makeHelper("a", { tags: ["errand"] }), makeHelper("b", { tags: ["errand"] })];
    const input = ride({ needs: [], activeMatches: { b: 1 }, similarity: { b: 0.6, a: 0.1 } });
    expect(ids(eligibleHelpers(input, helpers))).toEqual(["b", "a"]);
  });

  it("needs the ask's words to point at a helper when there are no preferences", () => {
    const helpers = [makeHelper("cook", { tags: ["cooking", "kitchen"], interests: ["cooking"] })];
    const input = ride({ interests: [], needs: [] });
    expect(eligibleHelpers(input, helpers)).toEqual([]);
  });
});

describe("matchHelpers (no API key)", () => {
  it("returns up to 3 helpers with a one-line why", async () => {
    const helpers = ["a", "b", "c", "d"].map((id) => makeHelper(id));
    const picks = await matchHelpers(ride(), helpers);
    expect(picks).toHaveLength(3);
    for (const p of picks) expect(p.why).toBe(p.helper.blurb);
  });

  it("returns an empty list when nobody fits", async () => {
    const helpers = [makeHelper("f1", { canAcceptPayment: false })];
    await expect(matchHelpers(ride(), helpers)).resolves.toEqual([]);
  });

  it("finds a seeded helper for a paid airport ride", async () => {
    const picks = await matchHelpers(ride());
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.length).toBeLessThanOrEqual(3);
    for (const p of picks) expect(p.helper.canAcceptPayment).toBe(true);
  });
});
