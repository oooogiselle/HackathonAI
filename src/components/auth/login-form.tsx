"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signInWithGoogle, type AuthFormState } from "@/server/actions/auth";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInWithEmail, {
    error: initialError,
  });

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send magic link"}
        </Button>
      </form>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
