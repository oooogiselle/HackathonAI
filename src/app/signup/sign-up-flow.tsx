"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { withNext } from "@/lib/safe-next";
import { type CodesSent, resendCode, startSignUp, verifySignUp } from "@/server/actions/account";

const RESEND_SECONDS = 30;
const CODE_MINUTES = 10;

function clock(seconds: number) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SignUpFlow({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<CodesSent & { at: number }>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function sendCodes(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await startSignUp({ username, password, email, phone });
      if ("error" in result) return setError(result.error);
      setSent({ ...result, at: Date.now() });
    });
  }

  if (sent) {
    return (
      <VerifyStep
        sent={sent}
        onEdit={() => setSent(undefined)}
        onDone={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={sendCodes} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Create account</h1>
        <p className="text-muted-foreground">
          Students only. Pick a username and password, then verify your school email and phone.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          maxLength={24}
          onChange={(e) => setUsername(e.target.value)}
          className="h-11"
          autoComplete="username"
          autoCapitalize="none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Password</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          autoComplete="new-password"
        />
        <span className="text-xs text-muted-foreground">At least 8 characters.</span>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="school-email">School email</Label>
        <Input
          id="school-email"
          type="email"
          value={email}
          placeholder={`you@${SCHOOL_EMAIL_DOMAIN}`}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mobile">Mobile number (+1)</Label>
        <Input
          id="mobile"
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={16}
          placeholder="(603) 555-0123"
          onChange={(e) => setPhone(e.target.value)}
          className="h-11"
          autoComplete="tel-national"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Classmates only see your username. We send a code to your school email and your phone, and
        neither is ever shown to other members.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Sending…" : "Send code"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={withNext("/signin", next)} className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function VerifyStep({
  sent,
  onEdit,
  onDone,
}: {
  sent: CodesSent & { at: number };
  onEdit: () => void;
  onDone: () => void;
}) {
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [demoCodes, setDemoCodes] = useState(sent.demoCodes ?? {});
  // When each channel's code was last sent (both at the start).
  const [sentAt, setSentAt] = useState({ email: sent.at, phone: sent.at });
  const [now, setNow] = useState(sent.at);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function resend(channel: "email" | "phone") {
    setError(undefined);
    startTransition(async () => {
      const result = await resendCode({ signupId: sent.signupId, channel });
      if ("error" in result) return setError(result.error);
      setSentAt((s) => ({ ...s, [channel]: Date.now() }));
      if (result.demoCode) setDemoCodes((d) => ({ ...d, [channel]: result.demoCode }));
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await verifySignUp({ signupId: sent.signupId, emailCode, phoneCode });
      if ("error" in result) return setError(result.error);
      onDone();
    });
  }

  const rows = [
    {
      channel: "email" as const,
      label: "School email code",
      to: `Sent to ${sent.email}`,
      value: emailCode,
      set: setEmailCode,
    },
    {
      channel: "phone" as const,
      label: "Phone code",
      to: `Texted to (•••) •••-${sent.phoneLast4}`,
      value: phoneCode,
      set: setPhoneCode,
    },
  ];

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-sm font-bold text-primary">Step 2 of 2</span>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Verify both</h1>
        <p className="text-muted-foreground">
          Enter the two 6-digit codes we sent. Both are needed to join.
        </p>
      </header>
      {rows.map((row) => {
        const since = Math.floor((now - sentAt[row.channel]) / 1000);
        const wait = RESEND_SECONDS - since;
        const demo = demoCodes[row.channel];
        return (
          <section key={row.channel} className="flex flex-col gap-2 rounded-3xl bg-card p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${row.channel}-code`}>{row.label}</Label>
              <span className="text-xs text-muted-foreground">
                {since < CODE_MINUTES * 60
                  ? `Expires in ${clock(CODE_MINUTES * 60 - since)}`
                  : "Expired"}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">{row.to}</span>
            <Input
              id={`${row.channel}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={row.value}
              onChange={(e) => row.set(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-center text-2xl font-extrabold tracking-[0.5em]"
            />
            {demo && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Demo: nothing can send this yet, so here it is:{" "}
                <span
                  data-testid={`demo-${row.channel}-code`}
                  className="font-bold text-foreground"
                >
                  {demo}
                </span>
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="self-start px-0 text-primary"
              disabled={pending || wait > 0}
              onClick={() => resend(row.channel)}
            >
              {wait > 0 ? `Resend in ${clock(wait)}` : "Resend"}
            </Button>
          </section>
        );
      })}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="h-12 text-base"
        disabled={pending || emailCode.length !== 6 || phoneCode.length !== 6}
      >
        {pending ? "Checking…" : "Verify and join"}
      </Button>
      <Button type="button" variant="ghost" onClick={onEdit}>
        Wrong email or number? Edit details
      </Button>
    </form>
  );
}
