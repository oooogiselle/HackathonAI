"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string };

/** Sends a magic link to the given email. */
export async function signInWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) return { error: error.message };
  return { message: "Check your email for a sign-in link." };
}

/** Starts the Google OAuth flow by redirecting to Google. */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "OAuth failed")}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
