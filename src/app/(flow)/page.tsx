// Landing page: the public needs board. Anyone can browse open asks; the
// button at the bottom starts a new ask (/ask). Data comes straight from
// listBoard, so it's always the live board (paid asks hidden from people who
// can't accept payment, blocked people hidden both ways).
import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CAMPUS } from "@/lib/ask/mock-data";
import { ASK_CATEGORIES, type AskCategory, type PublicCard } from "@/lib/ask/types";
import { listBoard } from "@/server/actions/board";

const CATEGORY_LABELS: Record<AskCategory, string> = {
  writing: "Writing",
  coding: "Coding",
  lab: "Lab",
  errands: "Errands",
  other: "Other",
};

function priceLabel(card: PublicCard) {
  if (card.payType === "trade") return "Trade";
  if (card.price === 0) return "Favor";
  return `$${card.price}`;
}

function durationLabel(minutes: number) {
  return minutes >= 60 ? `~${Math.round((minutes / 60) * 10) / 10} h` : `~${minutes} min`;
}

function expiresLabel(expiresAt: number, now: number) {
  const hours = (expiresAt - now) / 3_600_000;
  if (hours < 1) return "Expires soon";
  if (hours < 24) return `Expires in ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export default async function BoardPage({ searchParams }: PageProps<"/">) {
  const { c } = await searchParams;
  const active = ASK_CATEGORIES.find((cat) => cat === c);
  const all = await listBoard();
  const cards = active ? all.filter((card) => card.category === active) : all;
  // Rendered per request (listBoard reads the session cookie), so this is "now".
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{CAMPUS}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Needs board</h1>
        <p className="text-muted-foreground">
          Small asks from classmates. Posts are anonymous unless the asker adds their name.
        </p>
      </header>

      <nav aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[undefined, ...ASK_CATEGORIES].map((cat) => {
          const selected = cat === active;
          return (
            <Link
              key={cat ?? "all"}
              href={cat ? `/?c=${cat}` : "/"}
              aria-current={selected ? "page" : undefined}
              className={buttonVariants({
                variant: selected ? "default" : "outline",
                size: "sm",
                className: "shrink-0 rounded-full",
              })}
            >
              {cat ? CATEGORY_LABELS[cat] : "All"}
            </Link>
          );
        })}
      </nav>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {active
            ? `No open ${CATEGORY_LABELS[active].toLowerCase()} asks right now.`
            : "No open asks right now. Be the first to ask."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((card) => (
            <li
              key={card.token}
              className="flex flex-col gap-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {CATEGORY_LABELS[card.category]}
                </span>
                <span className="font-semibold">{priceLabel(card)}</span>
              </div>
              <h2 className="text-base font-semibold leading-snug">{card.title}</h2>
              <p className="text-muted-foreground">{card.text}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  card.askerFirstName ?? card.askerYear ?? "A classmate",
                  durationLabel(card.minutes),
                  expiresLabel(card.expiresAt, now),
                ].join(" · ")}
              </p>
              {/* TODO(board): "Claim" button → sign-in, helper setup for paid asks, claimCard. */}
            </li>
          ))}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto bg-background/95 px-4 pt-2 pb-4 backdrop-blur">
        <Link
          href="/ask"
          className={buttonVariants({ size: "lg", className: "h-12 w-full text-base" })}
        >
          <Plus className="size-5" /> Ask for help
        </Link>
      </div>
    </>
  );
}
