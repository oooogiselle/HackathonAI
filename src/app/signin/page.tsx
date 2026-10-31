// Sign in: username or school email + password (accounts are created and
// verified at /signup). In demo mode the mocked "Sign in with Dartmouth" is
// offered too. TODO(auth): real Dartmouth SSO needs the college to register the app.
import { Brand } from "@/components/ask/brand";
import { isDemoMode } from "@/lib/ask/demo-mode";
import { CAMPUS } from "@/lib/ask/mock-data";
import { safeNext } from "@/lib/safe-next";

import { SignInFlow } from "./sign-in-flow";

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <Brand />
        <h1 className="mt-2 text-[28px] leading-tight font-extrabold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground">
          {CAMPUS} students only. Anyone can browse the board; you need to sign in to post or help.
        </p>
      </header>
      <SignInFlow next={safeNext(next)} demo={isDemoMode()} />
    </main>
  );
}
