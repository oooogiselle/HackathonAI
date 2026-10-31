// Scam guard on the message thread, through the server actions (real SQL on PGlite).
import { beforeAll, describe, expect, it, vi } from "vitest";

import { confirmCard, createCard, holdCard } from "@/lib/ask/board-store";
import { openTestDb } from "@/lib/ask/db";
import { type SessionUser, signInUser } from "@/lib/ask/users";

// Who's signed in for the next action call.
let currentUser: SessionUser | null = null;

vi.mock("@/lib/ask/mock-session", () => ({ getCurrentUser: async () => currentUser }));
// Keyword scam check only, no API calls.
vi.stubEnv("ANTHROPIC_API_KEY", "");

const { listMessages, sendMessage } = await import("./inbox");

let asker: SessionUser;
let helper: SessionUser;
let stranger: SessionUser;
let token: string;

beforeAll(async () => {
  await openTestDb();
  asker = (await signInUser("Lin", "lin@dartmouth.edu")).user;
  helper = (await signInUser("Rina", "rina@dartmouth.edu")).user;
  stranger = (await signInUser("Sam", "sam@dartmouth.edu")).user;
  ({ token } = await createCard({
    askerId: asker.id,
    title: "Ride to Manchester airport",
    text: "Saturday morning, two suitcases.",
    category: "Rides",
    payType: "pay",
    price: 15,
    minutes: 60,
    anonymous: true,
    private: false,
    expiresAt: Date.now() + 24 * 3_600_000,
  }));
  await holdCard(token, helper.id);
  await confirmCard(token, asker.id);
});

async function thread(as: SessionUser) {
  currentUser = as;
  const result = await listMessages(token);
  if (!("messages" in result)) throw new Error(JSON.stringify(result));
  return result.messages;
}

describe("sendMessage scam guard", () => {
  it("sends a normal message with no flag", async () => {
    currentUser = asker;
    expect(await sendMessage({ token, body: "I'm at the Collis porch" })).toEqual({ ok: true });
    const [msg] = await thread(helper);
    expect(msg).toMatchObject({ body: "I'm at the Collis porch", fromMe: false, flag: null });
  });

  it("warns before sending a payment outside Ask, and stores nothing", async () => {
    currentUser = helper;
    expect(await sendMessage({ token, body: "You can just Venmo me instead" })).toEqual({
      warning: "off-platform-payment",
    });
    expect((await thread(asker)).map((m) => m.body)).not.toContain("You can just Venmo me instead");
  });

  it("sends after 'Send anyway', and the other side sees the flag", async () => {
    currentUser = helper;
    expect(
      await sendMessage({ token, body: "You can just Venmo me instead", confirmed: true }),
    ).toEqual({ ok: true });
    const forAsker = (await thread(asker)).at(-1);
    expect(forAsker).toMatchObject({ fromMe: false, flag: "off-platform-payment" });
    // The sender's own copy carries the flag too; the UI shows the note only to the receiver.
    expect((await thread(helper)).at(-1)).toMatchObject({
      fromMe: true,
      flag: "off-platform-payment",
    });
  });

  it("flags asking for an ID number", async () => {
    currentUser = helper;
    expect(await sendMessage({ token, body: "Send me your SSN to verify" })).toEqual({
      warning: "id-number",
    });
  });

  it("still keeps people outside the thread out, even with 'Send anyway'", async () => {
    currentUser = stranger;
    const result = await sendMessage({ token, body: "Pay me on Zelle", confirmed: true });
    expect(result).toHaveProperty("error");
  });

  it("needs sign-in", async () => {
    currentUser = null;
    expect(await sendMessage({ token, body: "hi" })).toHaveProperty("error");
  });
});
