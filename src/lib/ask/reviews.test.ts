// Runs the real SQL against an in-process Postgres (PGlite), migrated from ./drizzle.
import { beforeAll, describe, expect, it } from "vitest";

import {
  confirmCard,
  createCard,
  holdCard,
  holdPayment,
  markCardDone,
  markHelperDone,
  type NewCard,
} from "./board-store";
import { openTestDb } from "./db";
import { listInbox } from "./inbox";
import {
  EDIT_WINDOW_MS,
  myRatings,
  pointsForStars,
  publicRating,
  saveReview,
  tipFeeCents,
} from "./reviews";
import { saveHelperSetup, signInUser, updateProfile } from "./users";

const HOUR = 3_600_000;
let asker: string;
let helper: string;
let other: string;

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin-reviews@dartmouth.edu")).user.id;
  helper = (await signInUser("Maya", "maya-reviews@dartmouth.edu")).user.id;
  other = (await signInUser("Eli", "eli-reviews@dartmouth.edu")).user.id;
  await saveHelperSetup(helper, { canAcceptPayment: true, payoutAccount: "@maya" });
});

/** A done ask between asker and helper; paid asks are paid by `method`. */
async function doneAsk(overrides: Partial<NewCard> = {}, method?: "venmo" | "card") {
  const { token } = await createCard({
    askerId: asker,
    title: "Ride to Lebanon airport",
    text: "Friday, one carry-on.",
    category: "Errands",
    payType: "pay",
    price: 15,
    minutes: 45,
    anonymous: true,
    private: false,
    expiresAt: Date.now() + 24 * HOUR,
    ...overrides,
  });
  await holdCard(token, helper);
  await confirmCard(token, asker);
  if ((overrides.price ?? 15) > 0) await holdPayment(token, asker, method ?? "venmo");
  await markHelperDone(token, helper);
  await markCardDone(token, asker);
  return token;
}

const review = { stars: 4, tags: ["On time" as const], showName: false, tipCents: 0 };

describe("reviews", () => {
  it("only the asker can rate, and only once it's done", async () => {
    const token = await doneAsk();
    expect(await saveReview(token, other, review)).toEqual({
      error: "We couldn't find that ask.",
    });
    const { token: open } = await createCard({
      askerId: asker,
      title: "Not done yet",
      text: "x",
      category: "Other",
      payType: "free",
      price: 0,
      minutes: 10,
      anonymous: true,
      private: false,
      expiresAt: Date.now() + HOUR,
    });
    await holdCard(open, helper);
    expect(await saveReview(open, asker, review)).toEqual({
      error: "You can rate your helper once it's done.",
    });
  });

  it("charges a tip once, with the fee of the method used to hold", async () => {
    const token = await doneAsk({}, "card");
    const first = await saveReview(token, asker, { ...review, tipCents: 200 });
    expect(first).toMatchObject({ created: true, review: { tipCents: 200, tipFeeCents: 36 } });
    // Editing keeps the tip as charged.
    const edit = await saveReview(token, asker, { ...review, stars: 5, tipCents: 500 });
    expect(edit).toMatchObject({ created: false, review: { stars: 5, tipCents: 200 } });
    expect(tipFeeCents(200, "venmo")).toBe(4);
  });

  it("never tips a favor", async () => {
    const token = await doneAsk({ payType: "free", price: 0 });
    expect(await saveReview(token, asker, { ...review, tipCents: 200 })).toEqual({
      error: "Tips are only for paid asks.",
    });
    expect("review" in (await saveReview(token, asker, review))).toBe(true);
  });

  it("is editable for 24 hours only", async () => {
    const token = await doneAsk();
    const then = Date.now();
    await saveReview(token, asker, review, then);
    expect(
      await saveReview(token, asker, { ...review, stars: 2 }, then + EDIT_WINDOW_MS + 1),
    ).toEqual({
      error: "Reviews can only be edited for 24 hours.",
    });
  });

  it("tells the helper, without naming an anonymous reviewer", async () => {
    const token = await doneAsk();
    await saveReview(token, asker, { ...review, tipCents: 300 });
    const note = (await listInbox(helper)).find((n) => n.token === token);
    expect(note).toMatchObject({
      title: "Your asker rated you and left a tip",
      topic: "payments",
    });
    expect(note?.text).toContain("$3.00 tip");
    expect(note?.text).not.toContain("Lin");
  });

  it("computes trust points from stars and finished help, never stored", async () => {
    expect([5, 4, 3, 2, 1].map(pointsForStars)).toEqual([10, 10, 5, 0, 0]);
    const fresh = (await signInUser("Jo", "jo-reviews@dartmouth.edu")).user.id;
    await saveHelperSetup(fresh, { canAcceptPayment: true, payoutAccount: "@jo" });
    const { token } = await createCard({
      askerId: asker,
      title: "Carry a desk",
      text: "Two flights.",
      category: "Errands",
      payType: "free",
      price: 0,
      minutes: 20,
      anonymous: false,
      private: false,
      expiresAt: Date.now() + HOUR,
    });
    await holdCard(token, fresh);
    await confirmCard(token, asker);
    await markHelperDone(token, fresh);
    await markCardDone(token, asker);
    await saveReview(token, asker, {
      stars: 5,
      tags: ["Friendly", "On time"],
      comment: "So kind, thank you!",
      showName: true,
      tipCents: 0,
    });
    const mine = await myRatings(fresh);
    expect(mine).toMatchObject({
      average: 5,
      count: 1,
      onTime: 1,
      trustPoints: 10 + 2,
      tipsCents: 0,
      recent: [{ stars: 5, comment: "So kind, thank you!", by: "Lin" }],
    });
    expect(mine.tagCounts.map((t) => t.tag).sort()).toEqual(["Friendly", "On time"]);
  });

  it("hides a helper's rating from askers when they turn reviews off", async () => {
    expect(await publicRating(helper)).not.toBeNull();
    await updateProfile(helper, { showReviews: false });
    expect(await publicRating(helper)).toBeNull();
    await updateProfile(helper, { showReviews: true });
  });
});
