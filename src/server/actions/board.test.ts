import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { openTestDb } from "@/lib/ask/db";
import { COVERED_MESSAGE } from "@/lib/ask/format";
import { type SessionUser, signInUser, updateProfile } from "@/lib/ask/users";

// Who's signed in for the next action call. null = signed out.
let currentUser: SessionUser | null = null;

vi.mock("@/lib/ask/mock-session", () => ({ getCurrentUser: async () => currentUser }));
vi.mock("@/lib/groups", () => ({ postToGroup: vi.fn(async () => {}) }));
// Keyword check only, no API calls.
vi.stubEnv("ANTHROPIC_API_KEY", "");

const { postToGroup } = await import("@/lib/groups");
const board = await import("./board");
const privateAsks = await import("./private");
const inbox = await import("./inbox");

let asker: SessionUser;
const helpers: SessionUser[] = [];
const setup = { canAcceptPayment: true, payoutAccount: "@sam-venmo" };

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin@northfield.edu")).user;
  for (let i = 1; i <= 3; i++) {
    helpers.push((await signInUser(`H${i}`, `h${i}@northfield.edu`)).user);
  }
});

async function postDemoCard(price = 15) {
  currentUser = asker;
  const res = await board.postToBoard({
    title: "Ride to the airport",
    text: "Saturday morning, one suitcase.",
    category: "errands",
    minutes: 45,
    price,
    anonymous: true,
  });
  if (!("ok" in res)) throw new Error(res.error);
  return res.token;
}

async function createPrivate(title: string, text: string) {
  currentUser = asker;
  const res = await board.createPrivateAsk({ title, text, minutes: 30, price: 0 });
  if (!("ok" in res)) throw new Error(res.error);
  return res.token;
}

beforeEach(() => {
  currentUser = null;
  vi.mocked(postToGroup).mockClear();
});

describe("board actions", () => {
  it("lets anyone view, but only signed-in users post or claim", async () => {
    expect((await board.listBoard()).length).toBeGreaterThan(0);
    expect(await board.postToBoard({ title: "Help", text: "help", minutes: 10, price: 0 })).toEqual(
      { error: "Sign in to post or help." },
    );

    const token = await postDemoCard();
    currentUser = null;
    expect((await board.getCard(token))?.viewer).toBe("signed-out");
    expect(await board.claimCard({ token, setup })).toEqual({ error: "Sign in to post or help." });
  });

  it("keeps sensitive asks off the board but allows them privately", async () => {
    currentUser = asker;
    const visa = {
      title: "Visa paperwork",
      text: "Can someone help with my visa forms?",
      minutes: 30,
      price: 0,
    };
    expect("error" in (await board.postToBoard(visa))).toBe(true);
    expect("ok" in (await board.createPrivateAsk(visa))).toBe(true);
  });

  it("refuses essay asks everywhere", async () => {
    currentUser = asker;
    const essay = {
      title: "Write my essay",
      text: "Write my 5-page history essay",
      minutes: 60,
      price: 40,
    };
    expect("error" in (await board.postToBoard(essay))).toBe(true);
    expect("error" in (await board.createPrivateAsk(essay))).toBe(true);
  });

  it("drops the price on trades and favors", async () => {
    currentUser = asker;
    const res = await board.postToBoard({
      title: "Swap a dumpling lesson",
      text: "Teach me rice, I teach dumplings.",
      payType: "trade",
      minutes: 30,
      price: 20,
    });
    if (!("ok" in res)) throw new Error(res.error);
    expect((await board.getCard(res.token))?.price).toBe(0);
  });

  it("refuses paid claims until the helper can accept payment, then saves the setup", async () => {
    const token = await postDemoCard();
    currentUser = helpers[0];
    expect(await board.claimCard({ token })).toEqual({
      error: "This ask needs a helper who can accept payment",
    });
    expect(await board.claimCard({ token, setup })).toEqual({ ok: true });
  });

  it("runs the demo path and posts Covered exactly once", async () => {
    const token = await postDemoCard();
    expect(await board.shareCardToGroup({ token, groupId: "intl" })).toEqual({ ok: true });
    expect(vi.mocked(postToGroup)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postToGroup).mock.calls[0][1]).toContain(`/h/${token}`);

    currentUser = helpers[1];
    expect(await board.claimCard({ token, setup })).toEqual({ ok: true });
    currentUser = helpers[2];
    expect(await board.claimCard({ token, setup })).toEqual({ error: "Already taken" });

    // The helper can't confirm themselves.
    currentUser = helpers[1];
    expect("error" in (await board.confirmHelper(token))).toBe(true);

    currentUser = asker;
    const confirms = await Promise.all([board.confirmHelper(token), board.confirmHelper(token)]);
    expect(confirms.filter((r) => "ok" in r)).toHaveLength(1);
    const covered = vi.mocked(postToGroup).mock.calls.filter(([, msg]) => msg === COVERED_MESSAGE);
    expect(covered).toHaveLength(1);

    expect("error" in (await board.markDone(token))).toBe(true); // pay first
    const paid = await board.payToHold({ token, method: "venmo" });
    expect("ok" in paid && paid.card.payment?.totalCents).toBe(1681);
    expect("error" in (await board.payToHold({ token, method: "venmo" }))).toBe(true);
    const done = await board.markDone(token);
    expect("ok" in done && done.card.payment?.status).toBe("released");
    const thanked = await board.saveCardThanks(token, "Thank you so much!");
    expect("ok" in thanked && thanked.card.thanks).toBe("Thank you so much!");

    const card = await board.getCard(token);
    expect(card?.status).toBe("done");
    expect(card?.viewer).toBe("asker");
    expect(card?.heldByFirstName).toBe("H2");
    expect(JSON.stringify(card)).not.toContain("northfield.edu");

    // The helper's inbox shows the released payment.
    currentUser = helpers[1];
    const updates = await inbox.listInbox({ topic: "payments" });
    expect("ok" in updates && updates.items[0].title).toBe("$15 released to you");
  });

  it("gives the rate-limit slot back when the bot post fails", async () => {
    vi.mocked(postToGroup).mockRejectedValueOnce(new Error("down"));
    const token = await postDemoCard(0);
    expect("error" in (await board.shareCardToGroup({ token, groupId: "kessler" }))).toBe(true);
    expect((await board.getCard(token))?.shares).toEqual([]);
    // 3 posts a day still fit after the failed one.
    for (let i = 0; i < 3; i++) {
      const t = await postDemoCard(0);
      expect(await board.shareCardToGroup({ token: t, groupId: "kessler" })).toEqual({ ok: true });
    }
    const fourth = await postDemoCard(0);
    expect("error" in (await board.shareCardToGroup({ token: fourth, groupId: "kessler" }))).toBe(
      true,
    );
  });

  it("hides private asks from everyone but the asker and the picked helpers", async () => {
    const token = await createPrivate("Walk with me to an appointment", "Thursday 3 pm.");
    expect("ok" in (await privateAsks.sendPrivately({ token, helperIds: [helpers[0].id] }))).toBe(
      true,
    );

    currentUser = helpers[2];
    expect(await board.getCard(token)).toBeNull();
    currentUser = null;
    expect(await board.getCard(token)).toBeNull();

    currentUser = helpers[0];
    expect((await board.getCard(token))?.viewer).toBe("invited");
    const reqs = await privateAsks.listMyRequests();
    expect("ok" in reqs && reqs.requests.some((r) => r.card.token === token)).toBe(true);
    expect(await privateAsks.respondToRequest({ token, answer: "yes" })).toEqual({ ok: true });
    expect((await board.getCard(token))?.viewer).toBe("helper");
  });

  it("'Not this time' needs no reason and tells the asker nothing", async () => {
    const token = await createPrivate("Borrow a bike pump", "Tonight.");
    await privateAsks.sendPrivately({ token, helperIds: [helpers[1].id] });
    const before = await inbox.listInbox();

    currentUser = helpers[1];
    expect(await privateAsks.respondToRequest({ token, answer: "no" })).toEqual({ ok: true });

    currentUser = asker;
    const after = await inbox.listInbox();
    if (!("ok" in before) || !("ok" in after)) throw new Error("inbox failed");
    expect(after.items).toHaveLength(before.items.length);
  });

  it("hides paid cards from a helper who said they can't accept payment", async () => {
    await updateProfile(helpers[2].id, { canAcceptPayment: false });
    currentUser = helpers[2];
    expect((await board.listBoard()).every((c) => c.price === 0)).toBe(true);
    await updateProfile(helpers[2].id, { canAcceptPayment: true, payoutHandle: "@h3" });
  });
});
