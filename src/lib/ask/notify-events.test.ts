// The 3 PRD email events, against PGlite: each sends once, only from the
// request that won, and never names the asker.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as { event: string; to: string; data: unknown }[]);
vi.mock("@/lib/notify", () => ({
  notify: vi.fn(async (event: string, to: string, data: unknown) => {
    sent.push({ event, to, data });
  }),
}));

const {
  confirmCard,
  createCard,
  holdCard,
  holdPayment,
  markCardDone,
  markHelperDone,
  sendPrivately,
} = await import("./board-store");
const { openTestDb } = await import("./db");
const { saveHelperSetup, signInUser, updateProfile } = await import("./users");

const HOUR = 3_600_000;

let asker: string;
let helpers: string[];

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin-notify@dartmouth.edu")).user.id;
  helpers = [];
  for (let i = 0; i < 10; i++) {
    const { user } = await signInUser(`N${i}`, `n${i}@dartmouth.edu`);
    await saveHelperSetup(user.id, { canAcceptPayment: true, payoutAccount: `@n${i}` });
    helpers.push(user.id);
  }
});

beforeEach(() => {
  sent.length = 0;
});

const card = (overrides: { private?: boolean; price?: number } = {}) =>
  createCard({
    askerId: asker,
    title: "Ride to Lebanon airport",
    text: "Saturday morning, one suitcase.",
    category: "errands",
    payType: "pay",
    price: 15,
    minutes: 45,
    anonymous: true,
    private: false,
    expiresAt: Date.now() + 24 * HOUR,
    ...overrides,
  });

describe("email notifications", () => {
  it("emails the asker once when 10 helpers claim at the same moment", async () => {
    const { token } = await card();
    await Promise.all(helpers.map((id) => holdCard(token, id)));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: "claimed", to: "lin-notify@dartmouth.edu" });
  });

  it("emails each picked helper for a private ask, and nobody on a failed send", async () => {
    const { token } = await card({ private: true });
    expect("error" in (await sendPrivately(token, asker, helpers.slice(0, 4)))).toBe(true);
    expect(sent).toHaveLength(0);
    await sendPrivately(token, asker, [helpers[0], helpers[1]]);
    expect(sent.map((s) => [s.event, s.to])).toEqual([
      ["private-ask", "n0@dartmouth.edu"],
      ["private-ask", "n1@dartmouth.edu"],
    ]);
    expect(JSON.stringify(sent)).not.toContain("Lin");
  });

  it("emails the other side when either marks done, once each", async () => {
    const { token } = await card();
    await holdCard(token, helpers[2]);
    await confirmCard(token, asker);
    await holdPayment(token, asker, "venmo");
    sent.length = 0;

    await Promise.all([markHelperDone(token, helpers[2]), markHelperDone(token, helpers[2])]);
    await Promise.all([markCardDone(token, asker), markCardDone(token, asker)]);
    expect(sent.map((s) => [s.event, s.to])).toEqual([
      ["done", "lin-notify@dartmouth.edu"],
      ["done", "n2@dartmouth.edu"],
    ]);
  });

  it("skips people who turned email off", async () => {
    await updateProfile(asker, { emailNotifications: false });
    const { token } = await card();
    await holdCard(token, helpers[3]);
    expect(sent).toHaveLength(0);
    await updateProfile(asker, { emailNotifications: true });
  });
});
