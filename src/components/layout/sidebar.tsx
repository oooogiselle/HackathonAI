"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { navLinks } from "./nav-links";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:flex md:flex-col">
      <div className="px-4 py-4 font-semibold">
        <Link href="/">Hackathon Starter</Link>
      </div>
      <nav className="flex flex-col gap-1 px-2">
        {navLinks.map(({ href, label }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                active && "bg-sidebar-accent font-medium",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
