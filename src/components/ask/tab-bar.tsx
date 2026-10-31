import Link from "next/link";
import { Plus } from "lucide-react";

import { NAV } from "@/lib/ask/nav";
import { cn } from "cn";

import { Brand } from "./brand";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/claimed", label: "Claimed" },
  { href: "/ask", label: "Ask" },
  { href: "/inbox", label: "Inbox" },
  { href: "/me", label: "Me" },
] as const;

type Tab = (typeof TABS)[number]["label"];

// Main navigation on the tab screens. Phones: a bar along the bottom with
// "Ask" as the raised round button in the middle. Tablets and laptops: a bar
// along the top with the wordmark, the tabs, and "Ask for help" on the right.
// It has its own view-transition name, so it stays put while the screen
// under it crossfades.
export function TabBar({ active, unread = 0 }: { active: Tab; unread?: number }) {
  return (
    <>
      {/* Keeps the last card clear of the fixed bar on phones. */}
      <div aria-hidden className="h-24 shrink-0 md:hidden" />
      <nav
        aria-label="Main"
        style={{ viewTransitionName: "tab-bar" }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-background bg-card px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-4px_16px_-8px_rgba(14,42,32,0.12)]",
          "md:top-0 md:bottom-auto md:max-w-none md:border-t-0 md:border-b md:border-border md:px-8 md:pt-[env(safe-area-inset-top)] md:pb-0 md:shadow-none",
        )}
      >
        <div className="flex items-start justify-around md:mx-auto md:h-16 md:max-w-5xl md:items-center md:justify-start md:gap-1">
          <Link href="/" aria-hidden tabIndex={-1} className="mr-6 hidden md:flex">
            <Brand />
          </Link>
          {TABS.map((tab) =>
            tab.label === "Ask" ? (
              <Link
                key={tab.label}
                href={tab.href}
                transitionTypes={NAV.forward}
                aria-label="Ask for help"
                className="-mt-6 flex flex-col items-center gap-1 text-xs font-bold text-primary md:order-last md:mt-0 md:ml-auto"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors md:h-10 md:w-auto md:gap-1.5 md:px-4 md:text-sm md:shadow-none md:hover:bg-primary/90">
                  <Plus aria-hidden className="size-6 md:size-4" />
                  <span className="hidden md:inline">Ask for help</span>
                </span>
                <span className="md:hidden">Ask</span>
              </Link>
            ) : (
              <Link
                key={tab.label}
                href={tab.href}
                aria-current={tab.label === active ? "page" : undefined}
                aria-label={
                  tab.label === "Inbox" && unread > 0 ? `Inbox, ${unread} unread` : undefined
                }
                className={cn(
                  "relative flex min-h-11 min-w-14 items-center justify-center px-1 text-center text-xs",
                  "md:min-h-9 md:rounded-full md:px-3.5 md:text-sm md:transition-colors",
                  tab.label === active
                    ? "font-bold text-primary md:bg-secondary"
                    : "font-semibold text-muted-foreground md:hover:bg-muted md:hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.label === "Inbox" && unread > 0 && (
                  <span
                    aria-hidden
                    className="absolute top-0.5 right-0 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-bold text-white md:-top-0.5 md:-right-1"
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            ),
          )}
        </div>
      </nav>
    </>
  );
}
