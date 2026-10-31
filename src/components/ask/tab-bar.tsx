import Link from "next/link";
import { Plus } from "lucide-react";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/claimed", label: "Claimed" },
  { href: "/ask", label: "Ask" },
  { href: "/inbox", label: "Inbox" },
  { href: "/me", label: "Me" },
] as const;

type Tab = (typeof TABS)[number]["label"];

// Bottom bar on the tab screens. "Ask" is the raised round button in the middle.
export function TabBar({ active, unread = 0 }: { active: Tab; unread?: number }) {
  return (
    <>
      {/* Keeps the last card clear of the fixed bar. */}
      <div aria-hidden className="h-24 shrink-0" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md items-start justify-around border-t border-background bg-card px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-4px_16px_-8px_rgba(14,42,32,0.12)]"
      >
        {TABS.map((tab) =>
          tab.label === "Ask" ? (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label="Ask for help"
              className="-mt-6 flex flex-col items-center gap-1 text-xs font-bold text-primary"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                <Plus aria-hidden className="size-6" />
              </span>
              Ask
            </Link>
          ) : (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.label === active ? "page" : undefined}
              aria-label={
                tab.label === "Inbox" && unread > 0 ? `Inbox, ${unread} unread` : undefined
              }
              className={`relative flex min-h-11 min-w-14 items-center justify-center px-1 text-center text-xs ${
                tab.label === active
                  ? "font-bold text-primary"
                  : "font-semibold text-muted-foreground"
              }`}
            >
              {tab.label}
              {tab.label === "Inbox" && unread > 0 && (
                <span
                  aria-hidden
                  className="absolute top-0.5 right-0 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-bold text-white"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
