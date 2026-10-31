// Splash + Welcome: the logo, the tagline, then Sign in or Create account.
// Browsing the board needs no account.
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { safeNext, withNext } from "@/lib/safe-next";

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <div className="flex flex-col items-center gap-2 rounded-b-[36px] bg-primary px-6 pt-16 pb-12 text-primary-foreground">
        <Image
          src="/dartask-logo.png"
          alt="DartAsk logo"
          width={132}
          height={132}
          priority
          className="rounded-[30px] shadow-lg"
        />
        <div className="mt-2 text-[44px] font-extrabold tracking-tight">
          Dart<span className="text-brand-light">Ask</span>
        </div>
        <div className="text-base font-semibold opacity-85">Post. Find. Help. Together.</div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-8">
        <h1 className="text-[28px] font-extrabold tracking-tight">
          Welcome to Dart<span className="text-primary">Ask</span>!
        </h1>
        <p className="text-muted-foreground">Your Dartmouth campus help and task hub.</p>
        <Link
          href={withNext("/signin", next)}
          className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
        >
          Sign in
        </Link>
        <Link
          href={withNext("/signup", next)}
          className={buttonVariants({
            size: "lg",
            variant: "outline",
            className: "h-12 text-base",
          })}
        >
          Create account
        </Link>
        <Link href="/" className="py-2 text-center text-sm font-semibold text-muted-foreground">
          Just browsing? See the needs board
        </Link>
      </div>
    </main>
  );
}
