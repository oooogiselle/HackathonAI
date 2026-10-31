// Real accounts: Create account → Verify school and phone → signed in; and
// Sign in with username or school email + password. Codes go out by Gmail /
// Twilio when their keys are set. Without keys they're logged to the server
// console, and in demo mode (never a real production deploy) also returned so
// the screen can show them.
"use server";

import { z } from "zod";

import {
  type Channel,
  checkPassword,
  resendCode as resendCodeInStore,
  startSignup,
  verifySignup,
} from "@/lib/ask/accounts";
import { isDemoMode } from "@/lib/ask/demo-mode";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { startSession } from "@/lib/ask/mock-session";
import type { Result } from "@/lib/ask/types";
import { sendVerificationEmail } from "@/lib/notify";
import { sendSms } from "@/lib/notify/sms";

const accountSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,24}$/, "Usernames are 3 to 24 letters, numbers, dots or underscores."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email.")
    .refine(
      (e) => e.endsWith(`@${SCHOOL_EMAIL_DOMAIN}`),
      `Use your @${SCHOOL_EMAIL_DOMAIN} account.`,
    ),
  phone: z
    .string()
    .transform((p) => p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""))
    .refine((p) => /^\d{10}$/.test(p), "Add a 10-digit US mobile number."),
});

const signupId = z.string().min(10).max(64);
const code = z.string().regex(/^\d{6}$/, "Codes are 6 digits.");

export type CodesSent = {
  signupId: string;
  email: string;
  phoneLast4: string;
  // Demo mode only, and only for a channel with no real sender configured.
  demoCodes?: Partial<Record<Channel, string>>;
};

async function deliver(channel: Channel, to: string, value: string) {
  try {
    return channel === "email"
      ? await sendVerificationEmail(to, value)
      : await sendSms(to, `${value} is your DartAsk code. It expires in 10 minutes.`);
  } catch (error) {
    console.error(`Sending the ${channel} code failed:`, error);
    throw new Error(`We couldn't send the ${channel === "email" ? "email" : "text"} code.`);
  }
}

/** "Send code" on Create account. */
export async function startSignUp(
  input: z.input<typeof accountSchema>,
): Promise<Result<CodesSent>> {
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const started = await startSignup(parsed.data);
  if ("error" in started) return started;
  try {
    const [emailSent, phoneSent] = await Promise.all([
      deliver("email", parsed.data.email, started.codes.email),
      deliver("phone", parsed.data.phone, started.codes.phone),
    ]);
    const demoCodes = isDemoMode()
      ? {
          ...(emailSent ? {} : { email: started.codes.email }),
          ...(phoneSent ? {} : { phone: started.codes.phone }),
        }
      : undefined;
    return {
      ok: true,
      signupId: started.signupId,
      email: parsed.data.email,
      phoneLast4: parsed.data.phone.slice(-4),
      demoCodes,
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** "Resend" next to one of the two codes. */
export async function resendCode(input: {
  signupId: string;
  channel: Channel;
}): Promise<Result<{ demoCode?: string }>> {
  const parsed = z.object({ signupId, channel: z.enum(["email", "phone"]) }).safeParse(input);
  if (!parsed.success) return { error: "This sign-up expired. Start again." };
  const { channel } = parsed.data;
  const result = await resendCodeInStore(parsed.data.signupId, channel);
  if ("error" in result) return result;
  try {
    const sent = await deliver(channel, result.to[channel], result.code);
    return { ok: true, demoCode: !sent && isDemoMode() ? result.code : undefined };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** "Verify and join": both codes right → the account exists and you're signed in. */
export async function verifySignUp(input: {
  signupId: string;
  emailCode: string;
  phoneCode: string;
}): Promise<Result> {
  const parsed = z.object({ signupId, emailCode: code, phoneCode: code }).safeParse(input);
  if (!parsed.success) return { error: "Enter both 6-digit codes." };
  const verified = await verifySignup(parsed.data.signupId, {
    email: parsed.data.emailCode,
    phone: parsed.data.phoneCode,
  });
  if ("error" in verified) return verified;
  await startSession(verified.userId);
  return { ok: true };
}

/** "Sign in" with username or school email + password. */
export async function signInWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<Result> {
  const parsed = z
    .object({
      identifier: z.string().trim().min(1, "Add your username or school email.").max(120),
      password: z.string().min(1, "Add your password.").max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const checked = await checkPassword(parsed.data.identifier, parsed.data.password);
  if ("error" in checked) return checked;
  await startSession(checked.userId);
  return { ok: true };
}

/** Whether the screens offer the mocked "Sign in with Dartmouth". */
export async function demoSignInAvailable() {
  return isDemoMode();
}
