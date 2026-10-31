// Sessions. Real accounts sign in with a password (src/lib/ask/accounts.ts);
// the mocked "Sign in with Dartmouth" (first name + school email, no checks)
// works only in demo mode. The cookie holds only a random session id; the user
// and session live in the database, so nobody can edit a cookie to act as
// someone else's account.
import "server-only";

import { cookies } from "next/headers";

import {
  createSession,
  deleteSession,
  getSessionUser,
  type SessionUser,
  signInUser,
} from "./users";

export type MockUser = SessionUser;

export const SESSION_COOKIE = "ask_session";

async function setSessionCookie(sessionId: string) {
  (await cookies()).set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Mocked sign-in (demo mode only; the caller checks). */
export async function signIn(firstName: string, email: string): Promise<MockUser> {
  const { sessionId, user } = await signInUser(firstName, email);
  await setSessionCookie(sessionId);
  return user;
}

/** After a verified sign-up or a correct password. */
export async function startSession(userId: string) {
  await setSessionCookie(await createSession(userId));
}

export async function signOut() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in (mock) user, or null. */
export async function getCurrentUser(): Promise<MockUser | null> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  return sessionId ? getSessionUser(sessionId) : null;
}
