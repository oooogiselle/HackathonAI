// The task page: one ask, one card. Two ways in, same page: the link in a
// GroupMe post, or tapping a card on the board. Anyone can view it; claiming
// and every asker step need sign-in (checked again in each server action).
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AccountLink } from "@/components/ask/account-link";
import {
  askerLabel,
  durationLabel,
  expiresLabel,
  priceLabel,
  whenLabel,
} from "@/lib/ask/card-format";
import type { PublicCard } from "@/lib/ask/types";
import { getCard } from "@/server/actions/board";
import { getMe, getMyProfile } from "@/server/actions/session";

import { TaskActions } from "./task-actions";

function progressSteps(card: PublicCard) {
  const steps =
    card.price > 0 ? ["Posted", "Claimed", "Paid", "Done"] : ["Posted", "Claimed", "Done"];
  let at = 0;
  if (card.status === "held" || card.status === "confirmed") at = 1;
  if (card.status === "confirmed" && card.price > 0 && card.payment?.status === "held") at = 2;
  if (card.status === "done") at = steps.length - 1;
  return { steps, at };
}

export default async function TaskPage({ params }: PageProps<"/h/[token]">) {
  const { token } = await params;
  const [card, me, profile] = await Promise.all([getCard(token), getMe(), getMyProfile()]);
  // Rendered per request, so this is "now".
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between text-sm">
        <Link
          href="/"
          className="-ml-1 flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Board
        </Link>
        <AccountLink firstName={me?.firstName} next={`/h/${token}`} />
      </div>

      {!card ? (
        <p className="text-muted-foreground">This ask has expired or doesn&apos;t exist.</p>
      ) : (
        <>
          <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {card.category}
              </span>
              <span className="text-lg font-semibold">{priceLabel(card)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{card.title}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                askerLabel(card),
                durationLabel(card.minutes),
                card.startsAt ? whenLabel(card.startsAt) : null,
                card.status === "open" ? expiresLabel(card.expiresAt, now) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          <section className="flex flex-col gap-1 rounded-xl bg-muted/50 p-4 text-sm">
            <h2 className="font-medium">What done looks like</h2>
            <p className="whitespace-pre-line">{card.text}</p>
          </section>

          {(card.viewer === "asker" || card.viewer === "helper") &&
            card.status !== "expired" &&
            card.status !== "cancelled" && <Progress card={card} />}

          <TaskActions
            card={card}
            signedIn={Boolean(me)}
            needsPaymentSetup={
              card.price > 0 && !(profile?.canAcceptPayment && profile.payoutHandle)
            }
          />
        </>
      )}
    </main>
  );
}

function Progress({ card }: { card: PublicCard }) {
  const { steps, at } = progressSteps(card);
  return (
    <ol
      aria-label="Progress"
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
    >
      {steps.map((step, i) => (
        <li key={step} className="flex flex-col gap-1 text-xs">
          <span className={`h-1.5 rounded-full ${i <= at ? "bg-primary" : "bg-muted"}`} />
          <span className={i <= at ? "font-medium" : "text-muted-foreground"}>{step}</span>
        </li>
      ))}
    </ol>
  );
}
