// Runs the real SQL against an in-process Postgres (PGlite), migrated from ./drizzle.
import { beforeAll, describe, expect, it } from "vitest";

import {
  addSharedGroup,
  cancelCard,
  confirmCard,
  createCard,
  extendCard,
  getBoardCard,
  holdCard,
  holdPayment,
  listMine,
  listOpenCards,
  markCardDone,
  type NewCard,
  paymentBreakdown,
  sendPrivately,
  takeRateLimit,
  refundRateLimit,
  toPublicCard,
} from "./board-store";
import { openTestDb } from "./db";
import { listInbox, listMessages, sendMessage } from "./inbox";
import { SEED_CARDS } from "./mock-data";
import {
  blockFromCard,
  listBlocked,
  saveHelperSetup,
  signInUser,
  unblock,
  updateProfile,
} from "./users";

const HOUR = 3_600_000;

let asker: string;
let helpers: string[];

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin@northfield.edu")).user.id;
  helpers = [];
  for (let i = 0; i < 10; i++) {
    const { user } = await signInUser(`H${i}`, `h${i}@northfield.edu`);
    await saveHelperSetup(user.id, { canAcceptPayment: true, payoutAccount: `@h${i}` });
    helpers.push(user.id);
  }
});

function card(overrides: Partial<NewCard> = {}) {
  return createCard({
    askerId: asker,
    title: "Ride to Bradley Airport",
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
}

describe("board store (Postgres)", () => {
  it("is seeded with open demo cards, newest first", async () => {
    const cards = await listOpenCards(null);
    for (const seed of SEED_CARDS) expect(cards.some((c) => c.token === seed.token)).toBe(true);
    const times = cards.map((c) => c.createdAt);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("lets exactly one of 10 parallel claims win", async () => {
    const { token } = await card();
    const results = await Promise.all(helpers.map((id) => holdCard(token, id)));
    expect(results.filter((r) => "card" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r && r.error === "Already taken")).toHaveLength(9);
    expect((await listOpenCards(null)).some((c) => c.token === token)).toBe(false);
  });

  it("won't let the asker take their own ask", async () => {
    const { token } = await card();
    expect(await holdCard(token, asker)).toEqual({ error: "You can't take your own ask." });
  });

  it("expires cards at their deadline, without writing anything", async () => {
    const { token } = await card({ expiresAt: Date.now() + HOUR });
    const later = Date.now() + 2 * HOUR;
    expect(await holdCard(token, helpers[0], later)).toEqual({ error: "This ask has expired" });
    expect((await listOpenCards(null, later)).some((c) => c.token === token)).toBe(false);
    expect((await getBoardCard(token, later))?.status).toBe("expired");
    expect((await getBoardCard(token))?.status).toBe("open");
  });

  it("runs confirm → pay → done once each, only for the asker, and releases the payment", async () => {
    const { token } = await card();
    await holdCard(token, helpers[0]);

    expect("error" in (await confirmCard(token, helpers[0]))).toBe(true);
    const confirms = await Promise.all([confirmCard(token, asker), confirmCard(token, asker)]);
    expect(confirms.filter((r) => "card" in r)).toHaveLength(1);

    expect(await markCardDone(token, asker)).toEqual({
      error: "Pay to hold the task before marking it done.",
    });
    const pays = await Promise.all([
      holdPayment(token, asker, "venmo"),
      holdPayment(token, asker, "venmo"),
    ]);
    expect(pays.filter((r) => "card" in r)).toHaveLength(1);
    expect(pays.find((r) => "error" in r)).toEqual({ error: "Already paid." });

    const done = await markCardDone(token, asker);
    expect("card" in done && done.card.payment?.status).toBe("released");
    expect("error" in (await markCardDone(token, asker))).toBe(true);
  });

  it("matches the design's fee breakdown ($15 by Venmo → $16.81)", () => {
    expect(paymentBreakdown(15, "venmo")).toEqual({
      amountCents: 1500,
      platformFeeCents: 150,
      processingFeeCents: 31,
      totalCents: 1681,
    });
  });

  it("never charges for a favor, and favors finish without paying", async () => {
    const { token } = await card({ payType: "free", price: 0 });
    await holdCard(token, helpers[1]);
    await confirmCard(token, asker);
    expect("error" in (await holdPayment(token, asker, "card"))).toBe(true);
    expect("card" in (await markCardDone(token, asker))).toBe(true);
  });

  it("refunds a held payment on cancel", async () => {
    const { token } = await card();
    await holdCard(token, helpers[2]);
    await confirmCard(token, asker);
    await holdPayment(token, asker, "card");
    const cancelled = await cancelCard(token, asker);
    expect("card" in cancelled && cancelled.card.payment?.status).toBe("refunded");
    expect("error" in (await cancelCard(token, asker))).toBe(true);
  });

  it("extends open asks by 24 h, capped at 7 days", async () => {
    const now = Date.now();
    const { token, expiresAt } = await card({ expiresAt: now + HOUR });
    const extended = await extendCard(token, asker, now);
    expect("card" in extended && extended.card.expiresAt).toBe(expiresAt + 24 * HOUR);
    const far = await card({ expiresAt: now + 7 * 24 * HOUR - HOUR });
    const capped = await extendCard(far.token, asker, now);
    expect("card" in capped && capped.card.expiresAt).toBe(now + 7 * 24 * HOUR);
  });

  it("only the asker shares, once per group, and only while open", async () => {
    const { token } = await card();
    expect("error" in (await addSharedGroup(token, helpers[0], "intl", "Intl"))).toBe(true);
    expect("card" in (await addSharedGroup(token, asker, "intl", "Intl"))).toBe(true);
    expect("error" in (await addSharedGroup(token, asker, "intl", "Intl"))).toBe(true);
    await holdCard(token, helpers[0]);
    expect("error" in (await addSharedGroup(token, asker, "kessler", "Kessler"))).toBe(true);
  });

  it("allows 3 posts per group per day, even in parallel, and refunds", async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => takeRateLimit("ratelimit-test")));
    expect(results.filter(Boolean)).toHaveLength(3);
    await refundRateLimit("ratelimit-test");
    expect(await takeRateLimit("ratelimit-test")).toBe(true);
    expect(await takeRateLimit("ratelimit-test")).toBe(false);
  });

  it("keeps private asks off the board and lets only picked helpers say yes", async () => {
    const { token } = await card({ private: true });
    expect((await listOpenCards(null)).some((c) => c.token === token)).toBe(false);
    expect("error" in (await addSharedGroup(token, asker, "intl", "Intl"))).toBe(true);
    expect("error" in (await sendPrivately(token, asker, helpers.slice(0, 4)))).toBe(true);
    expect("card" in (await sendPrivately(token, asker, [helpers[3], helpers[4]]))).toBe(true);

    expect(await holdCard(token, helpers[5])).toEqual({
      error: "This ask was sent to other helpers.",
    });
    expect("card" in (await holdCard(token, helpers[4]))).toBe(true);
  });

  it("never sends a paid private ask to someone who can't accept payment", async () => {
    const { user } = await signInUser("Nadia", "nadia-f1@northfield.edu");
    await updateProfile(user.id, { canAcceptPayment: false });
    const { token } = await card({ private: true });
    expect(await sendPrivately(token, asker, [user.id])).toEqual({
      error: "This ask needs helpers who can accept payment.",
    });
    // …and hides paid board asks from them.
    const board = await listOpenCards(user.id);
    expect(board.every((c) => c.price === 0)).toBe(true);
  });

  it("blocks both ways without naming an anonymous asker", async () => {
    const { token } = await card();
    expect(await blockFromCard(token, helpers[6])).toBeNull();
    expect((await listOpenCards(helpers[6])).some((c) => c.token === token)).toBe(false);
    expect("error" in (await holdCard(token, helpers[6]))).toBe(true);
    const blocked = await listBlocked(helpers[6]);
    expect(blocked[0].label).toBe("The asker of “Ride to Bradley Airport”");
    expect(JSON.stringify(blocked)).not.toContain("Lin");
    await unblock(helpers[6], blocked[0].key);
    expect("card" in (await holdCard(token, helpers[6]))).toBe(true);
  });

  it("writes inbox notifications and opens messages once someone says yes", async () => {
    const { token } = await card();
    expect(await listMessages(token, asker)).toEqual({
      error: "Messages open once a helper says yes.",
    });
    await holdCard(token, helpers[7]);

    const inbox = await listInbox(asker, { kind: "action" });
    expect(inbox.items.some((n) => n.askToken === token && n.title === "H7 can help")).toBe(true);

    expect(await sendMessage(token, helpers[7], "Which terminal?")).toBeNull();
    expect(await sendMessage(token, helpers[8], "Me too?")).toEqual({
      error: "Messages open once a helper says yes.",
    });
    await sendMessage(token, asker, "Terminal 1, thanks!");
    const thread = await listMessages(token, helpers[7]);
    expect(Array.isArray(thread) && thread.map((m) => [m.fromMe, m.senderFirstName])).toEqual([
      [true, "H7"],
      [false, "The asker"],
    ]);
  });

  it("splits My asks and I'm helping", async () => {
    const { token } = await card();
    await holdCard(token, helpers[9]);
    expect((await listMine(asker)).asks.some((c) => c.token === token)).toBe(true);
    expect((await listMine(helpers[9])).helping.some((c) => c.token === token)).toBe(true);
  });

  it("public cards hide user ids, emails, payments and anonymous names", async () => {
    const { token } = await card();
    await holdCard(token, helpers[0]);
    await confirmCard(token, asker);
    await holdPayment(token, asker, "venmo");
    const full = (await getBoardCard(token))!;
    const pub = toPublicCard(full, null);
    const json = JSON.stringify(pub);
    expect(json).not.toContain("northfield.edu");
    expect(json).not.toContain(asker);
    expect(json).not.toContain(helpers[0]);
    expect(json).not.toContain("Lin");
    expect(pub.payment).toBeUndefined();
    expect(pub.heldByFirstName).toBe("H0");
    expect(toPublicCard(full, asker).payment?.totalCents).toBe(1681);
    expect(toPublicCard(full, helpers[0]).viewer).toBe("helper");
    expect(toPublicCard(full, helpers[1]).viewer).toBe("other");
  });
});
