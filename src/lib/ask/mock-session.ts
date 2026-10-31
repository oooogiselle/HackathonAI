// Mocked sign-in for the demo: first name + school email, no verification.
// The cookie holds only a random session id; the user and session live in the
// database, so nobody can edit a cookie to act as someone else's account.
// TODO(auth): replace with real sign-in + .edu (and phone) verification.
import "server-only";

import { cookies } from "next/headers";

import { deleteSession, getSessionUser, type SessionUser, signInUser } from "./users";

export type MockUser = SessionUser;

export const SESSION_COOKIE = "ask_session";

export async function signIn(firstName: string, email: string): Promise<MockUser> {
  const { sessionId, user } = await signInUser(firstName, email);
  (await cookies()).set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
  return user;
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
