import { beforeEach, describe, expect, it, vi } from "vitest";

import { COVERED_MESSAGE } from "@/lib/ask/format";

// Who's signed in for the next action call. null = signed out.
let currentUser: { id: string; email: string } | null = null;

vi.mock("@/lib/supabase/server", () => ({ getUser: async () => currentUser }));
vi.mock("@/lib/groups", () => ({ postToGroup: vi.fn(async () => {}) }));
// Keyword check only, no API calls.
vi.stubEnv("ANTHROPIC_API_KEY", "");

const { postToGroup } = await import("@/lib/groups");
const board = await import("./board");

const asker = { id: "asker-1", email: "lin@northfield.edu" };
const helper = (n: number) => ({ id: `helper-${n}`, email: `h${n}@northfield.edu` });
const setup = { canAcceptPayment: true, payoutAccount: "acct_demo" };

async function postDemoCard(price = 15) {
  currentUser = asker;
  const res = await board.postToBoard({
    text: "Could someone drive me to the airport Saturday morning?",
    minutes: 45,
    price,
    anonymous: true,
  });
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
    expect(
      await board.postToBoard({ text: "help", minutes: 10, price: 0, anonymous: true }),
    ).toEqual({
      error: "Sign in to post or help.",
    });

    const token = await postDemoCard();
    currentUser = null;
    expect((await board.getCard(token))?.viewer).toBe("signed-out");
    expect(await board.claimCard({ token, firstName: "Sam", setup })).toEqual({
      error: "Sign in to post or help.",
    });
  });

  it("keeps sensitive asks off the board", async () => {
    currentUser = asker;
    const res = await board.postToBoard({
      text: "Can someone help me with my visa paperwork?",
      minutes: 30,
      price: 0,
      anonymous: true,
    });
    expect("error" in res).toBe(true);
  });

  it("refuses paid claims from helpers who can't accept payment", async () => {
    const token = await postDemoCard();
    currentUser = helper(1);
    expect(await board.claimCard({ token, firstName: "Sam" })).toEqual({
      error: "This ask needs a helper who can accept payment",
    });
  });

  it("runs the demo path and posts Covered exactly once", async () => {
    const token = await postDemoCard();
    expect(await board.shareCardToGroup({ token, groupId: "intl" })).toEqual({ ok: true });
    expect(vi.mocked(postToGroup)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postToGroup).mock.calls[0][1]).toContain(`/h/${token}`);

    currentUser = helper(1);
    expect(await board.claimCard({ token, firstName: "Sam", setup })).toEqual({ ok: true });
    currentUser = helper(2);
    expect(await board.claimCard({ token, firstName: "Ana", setup })).toEqual({
      error: "Already taken",
    });

    // The helper can't confirm themselves.
    currentUser = helper(1);
    expect("error" in (await board.confirmHelper(token))).toBe(true);

    currentUser = asker;
    const confirms = await Promise.all([board.confirmHelper(token), board.confirmHelper(token)]);
    expect(confirms.filter((r) => "ok" in r)).toHaveLength(1);
    const covered = vi.mocked(postToGroup).mock.calls.filter(([, msg]) => msg === COVERED_MESSAGE);
    expect(covered).toHaveLength(1);

    expect("ok" in (await board.markDone(token))).toBe(true);
    expect("ok" in (await board.markPaid(token))).toBe(true);
    expect("error" in (await board.markPaid(token))).toBe(true);
    const thanked = await board.saveCardThanks(token, "Thank you so much!");
    expect("ok" in thanked && thanked.card.thanks).toBe("Thank you so much!");

    const card = await board.getCard(token);
    expect(card?.status).toBe("done");
    expect(card?.viewer).toBe("asker");
    expect(JSON.stringify(card)).not.toContain("northfield.edu");
  });

  it("gives the rate-limit slot back when the bot post fails", async () => {
    vi.mocked(postToGroup).mockRejectedValueOnce(new Error("down"));
    const token = await postDemoCard(0);
    expect("error" in (await board.shareCardToGroup({ token, groupId: "kessler" }))).toBe(true);
    expect((await board.getCard(token))?.sharedTo).toEqual([]);
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
});
