// Runs the real SQL against an in-process Postgres (PGlite), migrated from ./drizzle.
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { pendingSignups, users } from "@/db/schema";

import {
  checkPassword,
  CODE_TTL_MS,
  LOCKOUT_MS,
  MAX_CODE_TRIES,
  RESEND_WAIT_MS,
  resendCode,
  startSignup,
  verifySignup,
} from "./accounts";
import { getAskDb, openTestDb } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { signInUser } from "./users";

beforeAll(async () => {
  await openTestDb();
});

let n = 0;
function account(overrides: Partial<Parameters<typeof startSignup>[0]> = {}) {
  n += 1;
  return {
    username: `user${n}`,
    password: "correct-horse",
    email: `user${n}@dartmouth.edu`,
    phone: `603555${String(1000 + n).slice(-4)}`,
    ...overrides,
  };
}

async function started(input = account(), now = Date.now()) {
  const s = await startSignup(input, now);
  if ("error" in s) throw new Error(s.error);
  return s;
}

describe("passwords", () => {
  it("hashes with a salt and verifies only the right password", async () => {
    const a = await hashPassword("correct-horse");
    const b = await hashPassword("correct-horse");
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct-horse");
    expect(await verifyPassword("correct-horse", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});

describe("sign-up with two codes", () => {
  it("stores only hashes of the codes and the password", async () => {
    const input = account();
    const { signupId, codes } = await started(input);
    expect(codes.email).toMatch(/^\d{6}$/);
    const db = await getAskDb();
    const [row] = await db.select().from(pendingSignups).where(eq(pendingSignups.id, signupId));
    expect(JSON.stringify(row)).not.toContain(codes.email);
    expect(JSON.stringify(row)).not.toContain(input.password);
  });

  it("creates a verified account only when both codes are right, then signs in", async () => {
    const input = account();
    const { signupId, codes } = await started(input);
    expect(await verifySignup(signupId, { email: codes.phone, phone: codes.phone })).toMatchObject({
      error: expect.stringContaining("school email code"),
    });
    const ok = await verifySignup(signupId, codes);
    expect("userId" in ok).toBe(true);

    const db = await getAskDb();
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    expect(user).toMatchObject({ username: input.username, firstName: input.username });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
    // Used once only.
    expect(await verifySignup(signupId, codes)).toEqual({
      error: "This sign-up expired. Start again.",
    });

    expect(await checkPassword(input.username, input.password)).toEqual({ userId: user.id });
    expect(await checkPassword(input.email.toUpperCase(), input.password)).toEqual({
      userId: user.id,
    });
  });

  it("allows 5 tries, even in parallel, then needs new codes", async () => {
    const { signupId, codes } = await started();
    const wrong = { email: "000000", phone: "000000" };
    const tries = await Promise.all(Array.from({ length: 8 }, () => verifySignup(signupId, wrong)));
    expect(tries.filter((t) => "error" in t && t.error.includes("isn't right"))).toHaveLength(
      MAX_CODE_TRIES,
    );
    expect(await verifySignup(signupId, codes)).toEqual({
      error: "Too many wrong codes. Tap Resend to get new ones.",
    });
  });

  it("expires codes after 10 minutes", async () => {
    const now = Date.now();
    const { signupId, codes } = await started(account(), now - CODE_TTL_MS - 1000);
    expect(await verifySignup(signupId, codes, now)).toEqual({
      error: "These codes expired. Tap Resend to get new ones.",
    });
  });

  it("resends at most every 30 seconds, and the new code replaces the old one", async () => {
    const now = Date.now();
    const { signupId, codes } = await started(account(), now);
    expect(await resendCode(signupId, "phone", now + 5_000)).toEqual({
      error: "Wait 30 seconds before asking for another code.",
    });
    const again = await resendCode(signupId, "phone", now + RESEND_WAIT_MS + 1);
    if ("error" in again) throw new Error(again.error);
    expect(await verifySignup(signupId, codes, now + RESEND_WAIT_MS + 2)).toMatchObject({
      error: expect.stringContaining("phone code"),
    });
    expect(
      "userId" in
        (await verifySignup(signupId, { email: codes.email, phone: again.code }, now + 40_000)),
    ).toBe(true);
  });

  it("won't flood an inbox: one sign-up per email or phone every 30 seconds", async () => {
    const input = account();
    await started(input);
    expect(await startSignup({ ...input, username: "someoneelse" })).toEqual({
      error: "We just sent codes. Wait 30 seconds, then try again.",
    });
  });

  it("rejects a taken username or an email that already has an account", async () => {
    const first = account();
    const { signupId, codes } = await started(first);
    await verifySignup(signupId, codes);
    expect(await startSignup(account({ username: first.username }))).toEqual({
      error: "That username is taken.",
    });
    expect(await startSignup(account({ email: first.email }))).toEqual({
      error: "An account already uses that email. Sign in instead.",
    });
  });

  it("lets someone verify an email first used with the demo sign-in", async () => {
    const input = account();
    const { user } = await signInUser("Mo", input.email);
    const { signupId, codes } = await started(input);
    expect(await verifySignup(signupId, codes)).toEqual({ userId: user.id });
  });
});

describe("password sign-in", () => {
  it("gives one message for an unknown user or a wrong password", async () => {
    const input = account();
    const { signupId, codes } = await started(input);
    await verifySignup(signupId, codes);
    const wrong = { error: "Wrong username, email or password." };
    expect(await checkPassword("nobody-here", "whatever")).toEqual(wrong);
    expect(await checkPassword(input.username, "not-it")).toEqual(wrong);
  });

  it("locks for 15 minutes after 5 wrong passwords", async () => {
    const input = account();
    const { signupId, codes } = await started(input);
    await verifySignup(signupId, codes);
    const now = Date.now();
    for (let i = 0; i < 5; i++) await checkPassword(input.username, "not-it", now);
    expect(await checkPassword(input.username, input.password, now + 1000)).toMatchObject({
      error: expect.stringContaining("Too many wrong passwords"),
    });
    expect(
      "userId" in (await checkPassword(input.username, input.password, now + LOCKOUT_MS + 1)),
    ).toBe(true);
  });

  it("never signs in a demo or seeded user (no password)", async () => {
    await signInUser("Zed", "zed@dartmouth.edu");
    expect(await checkPassword("zed@dartmouth.edu", "")).toEqual({
      error: "Wrong username, email or password.",
    });
  });
});
