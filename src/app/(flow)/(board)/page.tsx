// Lives in its own route group so its loading skeleton covers only the board.
// Landing page: the public needs board. Anyone can browse open asks; tapping a
// card opens the task page (/h/[token]), and the round Ask button in the tab
// bar starts a new ask (/ask). Data comes straight from
// listBoard, so it's always the live board (paid asks hidden from people who
// can't accept payment, blocked people hidden both ways). Signed in, asks that
// match what you'd enjoy helping with (set on /me) come first, under "For you".
import Link from "next/link";

import { AskCard } from "@/components/ask/ask-card";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { ASKER_LABEL, durationLabel, expiresLabel, expiresSoon } from "@/lib/ask/card-format";
import { buttonVariants } from "@/components/ui/button";
import { NAV } from "@/lib/ask/nav";
import type { PublicCard } from "@/lib/ask/types";
import { listBoard } from "@/server/actions/board";
import { countUnread } from "@/server/actions/inbox";
import { getMyProfile } from "@/server/actions/session";

export default async function BoardPage() {
  const [cards, me, unread] = await Promise.all([listBoard(), getMyProfile(), countUnread()]);
  const forYou = cards.filter((c) => c.forYou);
  const rest = cards.filter((c) => !c.forYou);
  // Rendered per request (listBoard reads the session cookie), so this is "now".
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <TopBar title="Needs board" firstName={me?.firstName} next="/" />

      <p className="-mt-3 text-sm text-muted-foreground">
        {cards.length === 1 ? "1 open ask" : `${cards.length} open asks`}
      </p>
      {me && me.interests.length === 0 && cards.length > 0 && (
        <p className="-mt-2 text-sm text-muted-foreground">
          <Link href="/me" className="font-semibold text-foreground underline underline-offset-2">
            Pick what you like helping with
          </Link>{" "}
          to see those asks first.
        </p>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-input p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No open asks right now. Be the first to ask.
          </p>
          <Link href="/ask" className={buttonVariants({ variant: "outline" })}>
            Ask for help
          </Link>
        </div>
      ) : (
        <>
          {forYou.length > 0 && (
            <section aria-labelledby="board-for-you" className="flex flex-col gap-3">
              <h2 id="board-for-you" className="text-[15px] font-bold">
                For you
              </h2>
              <CardList cards={forYou} now={now} />
            </section>
          )}
          {rest.length > 0 && (
            <section aria-labelledby="board-more" className="flex flex-col gap-3">
              {forYou.length > 0 && (
                <h2 id="board-more" className="text-[15px] font-bold">
                  More asks
                </h2>
              )}
              <CardList cards={rest} now={now} />
            </section>
          )}
        </>
      )}

      <TabBar active="Feed" unread={unread} />
    </>
  );
}

function CardList({ cards, now }: { cards: PublicCard[]; now: number }) {
  return (
    <ul className="grid gap-4 wide:grid-cols-2 wide-lg:grid-cols-3 [&>li>article]:h-full">
      {cards.map((card) => (
        <li key={card.token}>
          <AskCard
            category={card.category}
            payType={card.payType}
            price={card.price}
            title={card.title}
            text={card.text}
            titleSlot={
              // The whole card opens the task (same page as the GroupMe link).
              <Link
                href={`/h/${card.token}`}
                transitionTypes={NAV.forward}
                className="after:absolute after:inset-0 after:rounded-[24px] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/60"
              >
                {card.title}
              </Link>
            }
            meta={[
              {
                kind: "expires",
                label: expiresLabel(card.expiresAt, now),
                urgent: expiresSoon(card.expiresAt, now),
              },
              { kind: "time", label: durationLabel(card.minutes) },
              { kind: "who", label: ASKER_LABEL },
            ]}
            action={
              card.viewer !== "asker" && (
                <span
                  aria-hidden
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white"
                >
                  Claim
                </span>
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
