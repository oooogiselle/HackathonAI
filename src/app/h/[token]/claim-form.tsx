"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/ask/mock-data";
import { claimAsk } from "@/server/actions/ask";

export function ClaimForm({ token }: { token: string }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await claimAsk({ token, firstName, email });
      if ("error" in result) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <p className="font-medium">Thank you, {firstName}! 🙌</p>
        <p className="text-sm text-muted-foreground">
          We let them know. They&apos;ll see a public spot to meet. The group has been told
          it&apos;s covered.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="h-11"
          maxLength={40}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">School email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`you@${SCHOOL_EMAIL_DOMAIN}`}
          className="h-11"
          required
        />
        <span className="text-xs text-muted-foreground">
          Only used to confirm you&apos;re a student. Never posted.
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Sending…" : "I can help"}
      </Button>
    </form>
  );
}
