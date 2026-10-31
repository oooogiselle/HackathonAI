import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blocks } from "@/db/schema";
import { getAskDb, openTestDb } from "@/lib/ask/db";
import { listHelperProfiles } from "@/lib/ask/board-store";
import { type SessionUser, signInUser, updateProfile } from "@/lib/ask/users";

// Who's signed in for the next action call. null = signed out.
let currentUser: SessionUser | null = null;

vi.mock("@/lib/ask/mock-session", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("@/lib/groups", () => ({ postToGroup: vi.fn(async () => {}) }));
// Keyword safety check and rule-order picks, no API calls.
vi.stubEnv("ANTHROPIC_API_KEY", "");
vi.stubEnv("OPENAI_API_KEY", "");

const board = await import("./board");
const { matchHelpers } = await import("./private");

// Seeded helpers (src/lib/ask/mock-data.ts) with a car: Mei and Chloe, both free Saturday morning.
const MEI: SessionUser = { id: "mei", firstName: "Mei", email: "mei@dartmouth.edu" };

// Saturday Nov 7 2026, 10:00 server-local time.
const SAT_10AM = new Date(2026, 10, 7, 10, 0).getTime();

const ride = {
  text: "Ride to Lebanon airport Saturday morning, two suitcases",
  minutes: 60,
  price: 15,
  startsAt: SAT_10AM,
  interests: ["rides" as const],
  needs: ["car"],
};

const ids = (list: { helper: { id: string } }[] | { id: string }[]) =>
  list.map((x) => ("helper" in x ? x.helper.id : x.id)).sort();

let asker: SessionUser;

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin@dartmouth.edu")).user;
});

beforeEach(() => {
  currentUser = null;
});

describe("listHelperProfiles", () => {
  it("lists seeded helpers, never the viewer or people without a helper profile", async () => {
    const all = await listHelperProfiles(null);
    expect(all.map((h) => h.id)).toContain("mei");
    expect(all.map((h) => h.id)).not.toContain(asker.id);
    expect((await listHelperProfiles("mei")).map((h) => h.id)).not.toContain("mei");
  });

  it("treats a helper who hasn't answered about payment as unable to accept it", async () => {
    const newbie = (await signInUser("Ana", "ana@dartmouth.edu")).user;
    await updateProfile(newbie.id, { interests: ["rides"] });
    const ana = (await listHelperProfiles(null)).find((h) => h.id === newbie.id);
    expect(ana?.canAcceptPayment).toBe(false);
  });

  it("leaves out people blocked either way", async () => {
    const viewer = (await signInUser("Kai", "kai@dartmouth.edu")).user;
    const db = await getAskDb();
    await db.insert(blocks).values([
      { blockerId: viewer.id, blockedId: "chloe" },
      { blockerId: "diego", blockedId: viewer.id },
    ]);
    const seen = (await listHelperProfiles(viewer.id)).map((h) => h.id);
    expect(seen).not.toContain("chloe");
    expect(seen).not.toContain("diego");
    expect(seen).toContain("mei");
  });
});

describe("matchHelpers action", () => {
  it("never matches crisis or essay asks", async () => {
    expect(await matchHelpers({ ...ride, text: "I want to kill myself" })).toEqual([]);
    expect(await matchHelpers({ ...ride, text: "Write my essay for history class" })).toEqual([]);
  });

  it("picks free helpers who can accept payment, and shares only public fields", async () => {
    const picks = await matchHelpers(ride);
    expect(ids(picks)).toEqual(["chloe", "mei"]);
    for (const p of picks) {
      expect(Object.keys(p.helper).sort()).toEqual(["alias", "id", "year"]);
      expect(p.why).not.toBe("");
    }
  });

  it("never suggests the signed-in asker to themselves", async () => {
    currentUser = MEI;
    expect(ids(await matchHelpers(ride))).toEqual(["chloe"]);
  });

  it("leaves out a helper who reached their weekly limit", async () => {
    // Mei's weekly limit is 3: she holds three asks this week.
    for (let i = 0; i < 3; i++) {
      currentUser = asker;
      const res = await board.postToBoard({
        title: `Favor ${i}`,
        text: "Carry a box to the mailroom.",
        minutes: 15,
        price: 0,
      });
      if (!("ok" in res)) throw new Error(res.error);
      currentUser = MEI;
      expect(await board.claimCard({ token: res.token })).toEqual({ ok: true });
    }
    currentUser = null;
    expect(ids(await matchHelpers(ride))).toEqual(["chloe"]);
  });
});
