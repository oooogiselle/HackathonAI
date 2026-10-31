import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// What a tab screen shows when nobody is signed in.
export function SignInPrompt({ next, why }: { next: string; why: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center">
      <p className="font-semibold">Sign in to see this</p>
      <p className="text-sm text-muted-foreground">{why}</p>
      <Link
        href={`/signin?next=${encodeURIComponent(next)}`}
        className={buttonVariants({ className: "mt-1 w-full" })}
      >
        Sign in with Dartmouth
      </Link>
    </section>
  );
}
