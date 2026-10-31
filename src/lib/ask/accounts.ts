// Real accounts: Create account (username, password, school email, phone) →
// a 6-digit code to the email and another to the phone → both verified →
// the user row. Then sign in with username or school email + password.
//
// Codes are random, stored only as hashes, expire after 10 minutes, allow 5
// wrong tries (a guarded `attempts < 5` update, so parallel guesses can't skip
// the limit) and can be re-sent every 30 seconds. Passwords use scrypt; 5 wrong
// passwords in a row lock sign-in for 15 minutes.
import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { pendingSignups, users } from "@/db/schema";

import { getAskDb } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_WAIT_MS = 30_000;
export const MAX_CODE_TRIES = 5;
export const MAX_PASSWORD_TRIES = 5;
export const LOCKOUT_MS = 15 * 60_000;

export type Channel = "email" | "phone";
export type NewAccount = { username: string; password: string; email: string; phone: string };

type Fail = { error: string };

function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(signupId: string, channel: Channel, code: string) {
  return createHash("sha256").update(`${signupId}:${channel}:${code}`).digest("base64url");
}

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Starts a sign-up. Returns the plain codes once, for the caller to send;
 * only their hashes are stored.
 */
export async function startSignup(
  input: NewAccount,
  now = Date.now(),
): Promise<{ signupId: string; codes: Record<Channel, string> } | Fail> {
  const db = await getAskDb();
  const [taken] = await db
    .select({ username: users.username, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(or(eq(users.username, input.username), eq(users.email, input.email)));
  if (taken?.username === input.username) return { error: "That username is taken." };
  if (taken?.email === input.email && taken.passwordHash) {
    return { error: "An account already uses that email. Sign in instead." };
  }

  // One sign-up at a time per email or phone, and no faster than every 30 s,
  // so nobody can flood a stranger's inbox or phone with codes.
  const [recent] = await db
    .select({ id: pendingSignups.id })
    .from(pendingSignups)
    .where(
      and(
        or(eq(pendingSignups.email, input.email), eq(pendingSignups.phone, input.phone)),
        gt(pendingSignups.lastSentAt, new Date(now - RESEND_WAIT_MS)),
      ),
    );
  if (recent) return { error: "We just sent codes. Wait 30 seconds, then try again." };
  await db
    .delete(pendingSignups)
    .where(or(eq(pendingSignups.email, input.email), eq(pendingSignups.phone, input.phone)));

  const signupId = randomBytes(18).toString("base64url");
  const codes = { email: newCode(), phone: newCode() };
  await db.insert(pendingSignups).values({
    id: signupId,
    username: input.username,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    emailCodeHash: hashCode(signupId, "email", codes.email),
    phoneCodeHash: hashCode(signupId, "phone", codes.phone),
    expiresAt: new Date(now + CODE_TTL_MS),
    lastSentAt: new Date(now),
  });
  return { signupId, codes };
}

/** A new code for one channel (the other stays valid). At most every 30 s. */
export async function resendCode(
  signupId: string,
  channel: Channel,
  now = Date.now(),
): Promise<{ code: string; to: { email: string; phone: string } } | Fail> {
  const db = await getAskDb();
  const code = newCode();
  const hash = hashCode(signupId, channel, code);
  const [row] = await db
    .update(pendingSignups)
    .set({
      ...(channel === "email" ? { emailCodeHash: hash } : { phoneCodeHash: hash }),
      attempts: 0,
      lastSentAt: new Date(now),
      expiresAt: new Date(now + CODE_TTL_MS),
    })
    .where(
      and(
        eq(pendingSignups.id, signupId),
        lt(pendingSignups.lastSentAt, new Date(now - RESEND_WAIT_MS)),
      ),
    )
    .returning({ email: pendingSignups.email, phone: pendingSignups.phone });
  if (row) return { code, to: row };
  const [exists] = await db
    .select({ id: pendingSignups.id })
    .from(pendingSignups)
    .where(eq(pendingSignups.id, signupId));
  return exists
    ? { error: "Wait 30 seconds before asking for another code." }
    : { error: "This sign-up expired. Start again." };
}

/**
 * Checks both codes. On success the account exists (or, for an email first
 * used with the mocked sign-in, gets its password) and the pending sign-up is
 * gone. Returns the user id.
 */
export async function verifySignup(
  signupId: string,
  codes: Record<Channel, string>,
  now = Date.now(),
): Promise<{ userId: string } | Fail> {
  const db = await getAskDb();
  // Count the try first, in the same statement that checks the limit.
  const [pending] = await db
    .update(pendingSignups)
    .set({ attempts: sql`${pendingSignups.attempts} + 1` })
    .where(
      and(
        eq(pendingSignups.id, signupId),
        lt(pendingSignups.attempts, MAX_CODE_TRIES),
        gt(pendingSignups.expiresAt, new Date(now)),
      ),
    )
    .returning();
  if (!pending) {
    const [row] = await db.select().from(pendingSignups).where(eq(pendingSignups.id, signupId));
    if (!row) return { error: "This sign-up expired. Start again." };
    if (row.attempts >= MAX_CODE_TRIES) {
      return { error: "Too many wrong codes. Tap Resend to get new ones." };
    }
    return { error: "These codes expired. Tap Resend to get new ones." };
  }

  const left = MAX_CODE_TRIES - pending.attempts;
  const tries = left > 0 ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : "";
  if (!sameHash(pending.emailCodeHash, hashCode(signupId, "email", codes.email))) {
    return { error: `That school email code isn't right.${tries}` };
  }
  if (!sameHash(pending.phoneCodeHash, hashCode(signupId, "phone", codes.phone))) {
    return { error: `That phone code isn't right.${tries}` };
  }

  try {
    const userId = await db.transaction(async (tx) => {
      // Only one request can consume the sign-up.
      const [gone] = await tx
        .delete(pendingSignups)
        .where(eq(pendingSignups.id, signupId))
        .returning({ id: pendingSignups.id });
      if (!gone) return null;
      const verified = {
        firstName: pending.username,
        username: pending.username,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        emailVerifiedAt: new Date(now),
        phoneVerifiedAt: new Date(now),
        failedSignIns: 0,
        signInLockedUntil: null,
      };
      // An email first used with the mocked sign-in (no password) is claimed.
      const [claimed] = await tx
        .update(users)
        .set(verified)
        .where(and(eq(users.email, pending.email), isNull(users.passwordHash)))
        .returning({ id: users.id });
      if (claimed) return claimed.id;
      const [created] = await tx
        .insert(users)
        .values({ id: randomBytes(9).toString("base64url"), email: pending.email, ...verified })
        .returning({ id: users.id });
      return created.id;
    });
    return userId ? { userId } : { error: "This sign-up was already used. Sign in instead." };
  } catch {
    // Unique username or email, taken by someone else in the meantime.
    return { error: "That username or email was just taken. Start again." };
  }
}

const WRONG = { error: "Wrong username, email or password." };

/** Username or school email + password. Returns the user id. */
export async function checkPassword(
  identifier: string,
  password: string,
  now = Date.now(),
): Promise<{ userId: string } | Fail> {
  const db = await getAskDb();
  const id = identifier.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(id.includes("@") ? eq(users.email, id) : eq(users.username, id));

  if (user?.signInLockedUntil && user.signInLockedUntil.getTime() > now) {
    const mins = Math.ceil((user.signInLockedUntil.getTime() - now) / 60_000);
    return { error: `Too many wrong passwords. Try again in ${mins} min.` };
  }
  // Runs even with no account, so timing doesn't reveal which usernames exist.
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !user.passwordHash) return WRONG;

  if (!ok) {
    const failed = user.failedSignIns + 1;
    await db
      .update(users)
      .set(
        failed >= MAX_PASSWORD_TRIES
          ? { failedSignIns: 0, signInLockedUntil: new Date(now + LOCKOUT_MS) }
          : { failedSignIns: sql`${users.failedSignIns} + 1` },
      )
      .where(eq(users.id, user.id));
    return WRONG;
  }
  if (user.failedSignIns > 0 || user.signInLockedUntil) {
    await db
      .update(users)
      .set({ failedSignIns: 0, signInLockedUntil: null })
      .where(eq(users.id, user.id));
  }
  return { userId: user.id };
}
