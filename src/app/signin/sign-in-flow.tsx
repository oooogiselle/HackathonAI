"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { withNext } from "@/lib/safe-next";
import { signInWithPassword } from "@/server/actions/account";
import { mockSignIn } from "@/server/actions/session";

export function SignInFlow({ next, demo }: { next: string; demo: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "sso">("account");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function done() {
    router.replace(next);
    router.refresh();
  }

  function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await signInWithPassword({ identifier, password });
      if ("error" in result) return setError(result.error);
      done();
    });
  }

  // Demo mode only: the mocked "Sign in with Dartmouth" (no password, no codes).
  function submitDemo(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await mockSignIn({ firstName, email });
      if ("error" in result) return setError(result.error);
      done();
    });
  }

  if (step === "sso") {
    return (
      <form onSubmit={submitDemo} className="flex flex-col gap-4 rounded-xl border p-4">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo only: Dartmouth SSO is mocked, with no password or codes. It&apos;s off on the real
          site.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-11"
            maxLength={40}
            autoComplete="given-name"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Dartmouth email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`you@${SCHOOL_EMAIL_DOMAIN}`}
            className="h-11"
            autoComplete="email"
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? "Signing in…" : "Continue"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setStep("account")}>
          Back
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitAccount} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Username or school email</Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-11"
            maxLength={120}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="flex gap-2">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              autoComplete="current-password"
              required
            />
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-primary"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New to DartAsk?{" "}
        <Link href={withNext("/signup", next)} className="font-semibold text-primary">
          Create account
        </Link>
      </p>
      {demo && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-base"
            onClick={() => setStep("sso")}
          >
            Sign in with Dartmouth
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Demo shortcut, no password. Off on the real site.
          </p>
        </div>
      )}
    </div>
  );
}
