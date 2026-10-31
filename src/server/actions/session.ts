// Session, profile and blocking actions. Real sign-up and password sign-in are
// in account.ts; mockSignIn here is the demo-mode-only "Sign in with Dartmouth".
// Anyone can view the board; posting and taking an ask need a signed-in user.
"use server";

import { z } from "zod";

import { isDemoMode } from "@/lib/ask/demo-mode";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { getCurrentUser, signIn, signOut } from "@/lib/ask/mock-session";
import { type BlockedEntry, INTERESTS, type Profile, type Result } from "@/lib/ask/types";
import {
  blockFromCard as blockFromCardInStore,
  getProfile,
  listBlocked,
  unblock,
  updateProfile,
} from "@/lib/ask/users";

const signInSchema = z.object({
  firstName: z.string().trim().min(1, "Add your first name.").max(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email.")
    // Only this school's accounts tonight (mocked SSO; TODO(auth): real Dartmouth SSO).
    .refine(
      (e) => e.endsWith(`@${SCHOOL_EMAIL_DOMAIN}`),
      `Use your @${SCHOOL_EMAIL_DOMAIN} account.`,
    ),
});

export type Me = { firstName: string; email: string };

/**
 * The mocked "Sign in with Dartmouth": no password, no codes. Demo mode only
 * (development, tests, or ASK_DEMO_MODE=1); real accounts use account.ts.
 */
export async function mockSignIn(input: z.input<typeof signInSchema>): Promise<Result<{ me: Me }>> {
  if (!isDemoMode()) return { error: "Sign in with your DartAsk account." };
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const user = await signIn(parsed.data.firstName, parsed.data.email);
  return { ok: true, me: { firstName: user.firstName, email: user.email } };
}

export async function mockSignOut() {
  await signOut();
}

/** Who's signed in on this browser, or null. */
export async function getMe(): Promise<Me | null> {
  const user = await getCurrentUser();
  return user ? { firstName: user.firstName, email: user.email } : null;
}

// ---------- profile and settings ----------

export async function getMyProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  return user ? getProfile(user.id) : null;
}

const profileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(40),
    classYear: z.string().trim().max(30),
    showClassYear: z.boolean(),
    canAcceptPayment: z.boolean(),
    payoutMethod: z.enum(["venmo", "bank"]),
    payoutHandle: z.string().trim().max(100),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
    weeklyLimit: z.number().int().min(0).max(20),
    emailNotifications: z.boolean(),
    showReviews: z.boolean(),
  })
  .partial();

/** Profile and settings: only the fields passed change. */
export async function updateMyProfile(input: z.input<typeof profileSchema>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  // The phone number is verified at sign-up and isn't editable here.
  await updateProfile(user.id, parsed.data);
  return { ok: true };
}

// ---------- blocked people ----------

/** "Block" on a card: blocks the other person without revealing an anonymous asker. */
export async function blockFromCard(cardToken: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const tok = z.string().min(1).max(64).safeParse(cardToken);
  if (!tok.success) return { error: "We couldn't find that ask." };
  return (await blockFromCardInStore(tok.data, user.id)) ?? { ok: true };
}

export async function listBlockedPeople(): Promise<Result<{ blocked: BlockedEntry[] }>> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  return { ok: true, blocked: await listBlocked(user.id) };
}

export async function unblockPerson(key: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const parsed = z.string().min(1).max(100).safeParse(key);
  if (!parsed.success) return { error: "Something's off with that request." };
  await unblock(user.id, parsed.data);
  return { ok: true };
}
