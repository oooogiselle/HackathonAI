// Payouts (mocked): what's released to me, what's held, and where each paid
// task is. No money moves tonight (TODO(stripe)).
import Link from "next/link";

import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { StepHeader } from "@/components/ask/step-header";
import { formatCents } from "@/lib/ask/fees";
import type { PublicCard } from "@/lib/ask/types";
import { listMyCards } from "@/server/actions/board";
import { getMyRatings } from "@/server/actions/reviews";
import { getMyProfile } from "@/server/actions/session";
import { cn } from "cn";

import { earnings } from "../earnings";

function Timeline({ card }: { card: PublicCard }) {
  const p = card.payment;
  const steps = [
    { label: "Claimed", done: true },
    { label: "Asker paid to hold", done: Boolean(p) },
    { label: "You marked it done", done: Boolean(card.helperDoneAt) || card.status === "done" },
    { label: "Asker confirms", done: card.status === "done" },
    {
      label: `${formatCents(p?.amountCents ?? card.price * 100)} released`,
      done: p?.status === "released",
    },
  ];
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center justify-between text-sm">
          {s.label}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              s.done ? "bg-pay text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {s.done ? "Done" : "Not yet"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function PayoutsPage() {
  const [profile, mine, ratings] = await Promise.all([
    getMyProfile(),
    listMyCards(),
    getMyRatings(),
  ]);
  if (!profile) {
    return (
      <>
        <StepHeader title="Your earnings" backHref="/me" />
        <SignInPrompt next="/me/payouts" why="See what you've earned helping classmates." />
      </>
    );
  }
  const tipsCents = ratings?.tipsCents ?? 0;
  const money = earnings(mine.helping, tipsCents);
  const paid = mine.helping.filter((c) => c.price > 0 && c.status !== "cancelled");
  const account = profile.payoutHandle
    ? profile.payoutMethod === "bank"
      ? `Bank or card ending ${profile.payoutHandle}`
      : `Venmo ${profile.payoutHandle}`
    : null;

  return (
    <>
      <StepHeader title="Your earnings" backHref="/me" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-pay p-4">
          <div className="text-xs font-semibold text-muted-foreground">Available</div>
          <div className="text-2xl font-extrabold">{formatCents(money.availableCents)}</div>
        </div>
        <div className="rounded-3xl bg-card p-4">
          <div className="text-xs font-semibold text-muted-foreground">Held</div>
          <div className="text-2xl font-extrabold">{formatCents(money.heldCents)}</div>
        </div>
      </div>
      {tipsCents > 0 && (
        <p className="text-sm">
          Includes <span className="font-semibold">{formatCents(tipsCents)}</span> in tips.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Held money is released once the asker confirms the task is done. If they don&apos;t respond,
        it auto-confirms 48 hours after you mark it done.
      </p>

      <section className="flex flex-col gap-3 rounded-3xl bg-card p-4">
        <h2 className="text-[15px] font-bold">Cash out to</h2>
        <p className="text-sm">{account ?? "No payout account yet."}</p>
        <button
          type="button"
          disabled
          className="h-12 rounded-2xl bg-primary text-base font-bold text-primary-foreground opacity-50"
        >
          Cash out {formatCents(money.availableCents)}
        </button>
        <p className="text-xs text-muted-foreground">
          Demo: cash out is mocked. Change your payout account on the{" "}
          <Link href="/me" className="font-semibold text-primary underline">
            Me
          </Link>{" "}
          tab.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Paid tasks
        </h2>
        {paid.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            No paid tasks yet. Favors and trades don&apos;t show here.
          </p>
        ) : (
          paid.map((card) => (
            <section key={card.token} className="flex flex-col gap-3 rounded-3xl bg-card p-4">
              <Link href={`/h/${card.token}`} className="font-bold">
                {card.title}
              </Link>
              <Timeline card={card} />
            </section>
          ))
        )}
      </section>
    </>
  );
}
