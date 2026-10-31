// Claimed tab: the asks you posted and the ones you offered to help with, each
// with its next step. Cards waiting on your tap come first.
import Link from "next/link";

import { AskCard } from "@/components/ask/ask-card";
import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { durationLabel } from "@/lib/ask/card-format";
import { nextStep } from "@/lib/ask/next-step";
import type { PublicCard } from "@/lib/ask/types";
import { listMyCards } from "@/server/actions/board";
import { countUnread } from "@/server/actions/inbox";
import { getMe } from "@/server/actions/session";
import { cn } from "cn";

// Your turn first, then live asks, then finished ones; newest first within each.
function sortByTurn(cards: PublicCard[]) {
  const rank = (c: PublicCard) =>
    nextStep(c).yourTurn
      ? 0
      : c.status === "open" || c.status === "held" || c.status === "confirmed"
        ? 1
        : 2;
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

export default async function ClaimedPage() {
  const [me, mine, unread] = await Promise.all([getMe(), listMyCards(), countUnread()]);

  return (
    <>
      <TopBar title="Claimed" firstName={me?.firstName} next="/claimed" />

      {!me ? (
        <SignInPrompt
          next="/claimed"
          why="Your asks and the ones you're helping with show up here, with what to do next."
        />
      ) : (
        <>
          <Section
            title="My asks"
            cards={sortByTurn(mine.asking)}
            empty={{
              text: "Nothing posted yet. Small, specific asks get a yes fastest.",
              cta: { href: "/ask", label: "Ask for help" },
            }}
          />
          <Section
            title="I'm helping"
            cards={sortByTurn(mine.helping)}
            empty={{
              text: "When you claim a classmate's ask, it shows up here with your next step.",
              cta: { href: "/", label: "Browse the needs board" },
            }}
          />
        </>
      )}

      <TabBar active="Claimed" unread={unread} />
    </>
  );
}

function Section({
  title,
  cards,
  empty,
}: {
  title: string;
  cards: PublicCard[];
  empty: { text: string; cta: { href: string; label: string } };
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {title} · {cards.length}
      </h2>
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-input p-6 text-center">
          <p className="text-sm text-muted-foreground">{empty.text}</p>
          <Link href={empty.cta.href} className={buttonVariants({ variant: "outline" })}>
            {empty.cta.label}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {cards.map((card) => (
            <li key={card.token}>
              <MyCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MyCard({ card }: { card: PublicCard }) {
  const step = nextStep(card);
  const finished =
    card.status === "done" || card.status === "expired" || card.status === "cancelled";
  return (
    <AskCard
      category={card.category}
      payType={card.payType}
      price={card.price}
      title={card.title}
      className={cn(finished && !step.yourTurn && "opacity-70")}
      titleSlot={
        <Link
          href={`/h/${card.token}`}
          className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/60"
        >
          {card.title}
        </Link>
      }
      meta={[
        { kind: "time", label: durationLabel(card.minutes) },
        ...(card.heldByAlias && card.viewer === "asker"
          ? [{ kind: "who" as const, label: card.heldByAlias }]
          : []),
      ]}
      notice={
        <p
          className={cn(
            "mx-2 mb-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm",
            step.yourTurn
              ? "bg-pay font-semibold text-secondary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {step.yourTurn && (
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-primary-foreground uppercase">
              Your turn
            </span>
          )}
          {step.label}
        </p>
      }
    />
  );
}
