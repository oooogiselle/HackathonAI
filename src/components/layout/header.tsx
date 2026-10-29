import Link from "next/link";

import { navLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function Header({ email }: { email?: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
      {/* Sidebar is hidden on mobile, so show compact links instead. */}
      <nav className="flex gap-3 text-sm md:hidden">
        {navLinks.map(({ href, label }) => (
          <Link key={href} href={href} className="text-muted-foreground hover:text-foreground">
            {label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
        <SignOutButton />
      </div>
    </header>
  );
}
