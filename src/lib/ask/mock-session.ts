// Mocked sign-in for the demo: first name + school email, no verification.
// The cookie holds only a random session id; the user lives in server memory,
// so nobody can edit a cookie to act as someone else's account.
// TODO(auth): replace with Supabase sign-in + real .edu verification.
import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export type MockUser = { id: string; firstName: string; email: string };

export const SESSION_COOKIE = "ask_session";

type Sessions = Map<string, MockUser>;

const g = globalThis as typeof globalThis & { __askSessions?: Sessions };
const sessions: Sessions = (g.__askSessions ??= new Map());

export async function signIn(firstName: string, email: string): Promise<MockUser> {
  const sessionId = randomBytes(18).toString("base64url");
  // Same email → same account, so a phone that signs in again keeps its asks.
  const existing = [...sessions.values()].find((u) => u.email === email);
  const user = existing
    ? { ...existing, firstName }
    : { id: randomBytes(9).toString("base64url"), firstName, email };
  sessions.set(sessionId, user);
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
  if (sessionId) sessions.delete(sessionId);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in (mock) user, or null. */
export async function getCurrentUser(): Promise<MockUser | null> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  return (sessionId && sessions.get(sessionId)) || null;
}
