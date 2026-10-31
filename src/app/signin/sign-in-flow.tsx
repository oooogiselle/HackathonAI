"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { mockSignIn } from "@/server/actions/session";

export function SignInFlow({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"start" | "sso">("start");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await mockSignIn({ firstName, email });
      if ("error" in result) return setError(result.error);
      router.replace(next);
      router.refresh();
    });
  }

  if (step === "start") {
    return (
      <div className="flex flex-col gap-3">
        <Button size="lg" className="h-12 text-base" onClick={() => setStep("sso")}>
          Sign in with Dartmouth
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Your school email only confirms you&apos;re a student. It&apos;s never shown to other
          members.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border p-4">
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Demo: Dartmouth SSO is mocked tonight. No password needed.
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Signing in…" : "Continue"}
      </Button>
    </form>
  );
}
