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
export function TabBar({ active, badge }: { active: Tab; badge?: { Inbox?: number } }) {
  return (
    <>
      {/* Keeps the last card clear of the fixed bar. */}
      <div aria-hidden className="h-24 shrink-0" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-[84px] w-full max-w-md items-start justify-around border-t border-background bg-card px-3 pt-3 pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map((tab) =>
          tab.label === "Ask" ? (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label="Ask for help"
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
            >
              <Plus className="size-6" />
            </Link>
          ) : (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.label === active ? "page" : undefined}
              className={`relative min-w-12 py-1 text-center text-xs ${
                tab.label === active ? "font-bold text-primary" : "font-semibold text-muted-foreground"
              }`}
            >
              {tab.label}
              {tab.label === "Inbox" && badge?.Inbox ? (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {badge.Inbox}
                </span>
              ) : null}
            </Link>
          ),
        )}
      </nav>
    </>
  );
}
