// Mocked sign-in actions ("Sign in with Dartmouth" is a mocked SSO step). Anyone can view the board; posting and taking an ask
// need this sign-in. No email is sent and nothing is verified (TODO(auth)).
"use server";

import { z } from "zod";

import { suggestSkills } from "@/lib/ai/ask/suggest-skills";
import { cleanTags, MAX_TAGS, type SkillSuggestion } from "@/lib/ask/helper-fit";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { getCurrentUser, signIn, signOut } from "@/lib/ask/mock-session";
import {
  type BlockedEntry,
  INTERESTS,
  type Profile,
  type Result,
  type ThanksNote,
} from "@/lib/ask/types";
import {
  blockFromCard as blockFromCardInStore,
  getProfile,
  listBlocked,
  listThanksFor,
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

/** Called only from the "Sign in" button. */
export async function mockSignIn(input: z.input<typeof signInSchema>): Promise<Result<{ me: Me }>> {
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
    phone: z.string().trim().max(30),
    classYear: z.string().trim().max(30),
    showClassYear: z.boolean(),
    blurb: z.string().trim().max(160),
    busy: z
      .array(
        z
          .object({
            day: z.number().int().min(0).max(6),
            start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
            end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          })
          .refine((s) => s.start < s.end),
      )
      .max(50),
    canAcceptPayment: z.boolean(),
    payoutMethod: z.enum(["venmo", "bank"]),
    payoutHandle: z.string().trim().max(100),
    interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
    tags: z
      .array(z.string().max(40))
      .max(MAX_TAGS * 2)
      .transform((t) => cleanTags(t)),
    weeklyLimit: z.number().int().min(0).max(20),
    emailNotifications: z.boolean(),
  })
  .partial();

/** Profile and settings: only the fields passed change. */
export async function updateMyProfile(input: z.input<typeof profileSchema>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  // TODO(auth): verify a new phone number with a code before saving it.
  await updateProfile(user.id, parsed.data);
  return { ok: true };
}

/**
 * "In your own words" on the Me tab: interest chips and specific tags to offer.
 * Suggestions only; the profile changes only when the helper taps and saves.
 */
export async function suggestMySkills(input: string): Promise<Result<SkillSuggestion>> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  const parsed = z.string().trim().min(3).max(500).safeParse(input);
  if (!parsed.success) return { error: "Write a few words about what you could help with." };
  return { ok: true, ...(await suggestSkills(parsed.data)) };
}

/** Thank-you notes from asks you helped with (the Me tab). */
export async function getMyThanks(): Promise<ThanksNote[]> {
  const user = await getCurrentUser();
  return user ? listThanksFor(user.id) : [];
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
