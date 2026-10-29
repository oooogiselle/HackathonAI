import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// Landing page. Replace the copy once you've picked an idea.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Hackathon Starter</span>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Sign in
        </Link>
      </header>

      <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your next idea, shipped this weekend.
        </h1>
        <p className="text-lg text-muted-foreground">
          One sentence about what this project does and who it&apos;s for.
        </p>
        <Link href="/app" className={buttonVariants({ size: "lg" })}>
          Get started
        </Link>
      </section>
    </main>
  );
}
