// Landing page: the public needs board. Anyone can browse open asks; tapping a
// card opens the task page (/h/[token]), and the round Ask button in the tab
// bar starts a new ask (/ask). Data comes straight from
// listBoard, so it's always the live board (paid asks hidden from people who
// can't accept payment, blocked people hidden both ways).
import Link from "next/link";

import { AskCard } from "@/components/ask/ask-card";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import {
  askerLabel,
  durationLabel,
  expiresLabel,
  expiresSoon,
} from "@/lib/ask/card-format";
import { listBoard } from "@/server/actions/board";
import { getMe } from "@/server/actions/session";

export default async function BoardPage() {
  const [cards, me] = await Promise.all([listBoard(), getMe()]);
  // Rendered per request (listBoard reads the session cookie), so this is "now".
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <TopBar title="Needs board" firstName={me?.firstName} next="/" />

      <p className="-mt-3 text-sm text-muted-foreground">
        {cards.length === 1 ? "1 open ask" : `${cards.length} open asks`}
      </p>

      {cards.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
          No open asks right now. Be the first to ask.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
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
                  { kind: "who", label: askerLabel(card) },
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
      )}

      <TabBar active="Feed" />
    </>
  );
}
