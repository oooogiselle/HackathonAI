import Link from "next/link";

import { Brand } from "./brand";

// Header for the tab screens (Feed, Claimed, Inbox, Me): brand, big title and
// the signed-in person's initial (or "Sign in").
export function TopBar({
  title,
  firstName,
  next,
}: {
  title: string;
  firstName?: string;
  next: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="flex flex-col gap-0.5">
        <Brand place="Hanover" />
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {firstName ? (
        <Link
          href="/me"
          aria-label={`Signed in as ${firstName}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {firstName.slice(0, 1).toUpperCase()}
        </Link>
      ) : (
        <Link
          href={`/signin?next=${encodeURIComponent(next)}`}
          className="shrink-0 rounded-full bg-card px-4 py-2 text-sm font-semibold shadow-sm"
        >
          Sign in
        </Link>
      )}
    </header>
  );
}
