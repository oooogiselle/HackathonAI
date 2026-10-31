"use client";

// Board header: "Sign in", or "Hi, Lin · Sign out" (mocked sign-in).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { mockSignOut } from "@/server/actions/session";

export function AccountLink({ firstName, next }: { firstName?: string; next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!firstName) {
    return (
      <Link href={`/signin?next=${encodeURIComponent(next)}`} className="font-medium underline">
        Sign in
      </Link>
    );
  }
  return (
    <span className="text-muted-foreground">
      Hi, {firstName} ·{" "}
      <button
        type="button"
        disabled={pending}
        className="underline hover:text-foreground"
        onClick={() =>
          startTransition(async () => {
            await mockSignOut();
            router.refresh();
          })
        }
      >
        Sign out
      </button>
    </span>
  );
}
