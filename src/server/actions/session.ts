// Mocked sign-in actions. Anyone can view the board; posting and taking an ask
// need this sign-in. No email is sent and nothing is verified (TODO(auth)).
"use server";

import { z } from "zod";

import { getCurrentUser, signIn, signOut } from "@/lib/ask/mock-session";
import type { Result } from "@/lib/ask/types";

const signInSchema = z.object({
  firstName: z.string().trim().min(1, "Add your first name.").max(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email.")
    .refine((e) => e.endsWith(".edu"), "Please use your school (.edu) email."),
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
