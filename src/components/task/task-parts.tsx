// Quiet building blocks for the task page screens (/h/[token]). The ask card is
// the one bold element on each screen; everything here stays plain.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AskCard } from "@/components/ask/ask-card";
import { ASKER_LABEL, durationLabel, whenLabel } from "@/lib/ask/card-format";
import type { PublicCard } from "@/lib/ask/types";
import { cn } from "cn";

/** Back to the board, the state pill in the middle, and the screen's heading. */
export function TaskHeader({
  status,
  title,
  subtitle,
  backHref = "/",
}: {
  status: string;
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <header className="flex flex-col gap-3 pt-2">
      <div className="relative flex h-10 items-center justify-center">
        <Link
          href={backHref}
          aria-label="Back"
          className="absolute left-0 flex size-10 items-center justify-center rounded-2xl bg-card"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <span className="rounded-full bg-card px-3 py-1 text-[13px] font-semibold text-primary">
          {status}
        </span>
      </div>
      <h1 className="mt-2 text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="-mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

/** The ask as the same ticket helpers saw on the board. */
export function TaskTicket({
  card,
  withText = false,
  action,
}: {
  card: PublicCard;
  withText?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <AskCard
      category={card.category}
      payType={card.payType}
      price={card.price}
      title={card.title}
      text={withText ? card.text : undefined}
      action={action}
      meta={[
        { kind: "who", label: ASKER_LABEL },
        { kind: "time", label: durationLabel(card.minutes) },
        ...(card.startsAt ? [{ kind: "when" as const, label: whenLabel(card.startsAt) }] : []),
      ]}
    />
  );
}

/** A plain white section with an optional small heading. */
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2 rounded-3xl bg-card p-4 text-[15px]", className)}>
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label on the left, value on the right, hairline between rows. */
export function Rows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="flex flex-col divide-y divide-background">
      {rows.map(([label, value], i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold whitespace-nowrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** First initial in a soft square, as in the design. */
export function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#ede7ff] text-base font-bold text-[#5b3cc4]"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Who the helper is. No ratings: helpers aren't scored. */
export function HelperLine({ card }: { card: PublicCard }) {
  const name = card.heldByAlias ?? "Your helper";
  return <PersonLine name={[name, card.heldByYear].filter(Boolean).join(", ")} />;
}

/** A person (or "A classmate" on anonymous asks) and that they're verified. */
export function PersonLine({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <Initial name={name} />
      <div className="flex flex-col">
        <span className="font-bold">{name}</span>
        <span className="text-sm text-muted-foreground">Verified Dartmouth student</span>
      </div>
    </div>
  );
}

export function progressSteps(card: PublicCard) {
  const paid = card.price > 0;
  const steps = paid ? ["Posted", "Claimed", "Hold pay", "Done"] : ["Posted", "Claimed", "Done"];
  let at = 0;
  if (card.status === "held" || card.status === "confirmed") at = 1;
  if (card.status === "confirmed" && paid && card.payment?.status === "held") at = 2;
  if (card.status === "done") at = steps.length - 1;
  return { steps, at };
}

/** Posted · Claimed · Hold pay · Done, as dots. */
export function Progress({ card }: { card: PublicCard }) {
  const { steps, at } = progressSteps(card);
  return (
    <ol
      aria-label="Progress"
      className="grid rounded-3xl bg-card px-2 py-4"
      style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
    >
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === at ? "step" : undefined}
          className="flex flex-col items-center gap-2 text-[13px]"
        >
          <span
            className={cn(
              "size-3.5 rounded-full",
              i <= at ? "bg-primary" : i === at + 1 ? "bg-pay" : "bg-muted",
            )}
          />
          <span className={i <= at ? "font-semibold text-primary" : "text-muted-foreground"}>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The big pinned button area at the bottom of a screen. */
export function BottomActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 pt-4">{children}</div>;
}

/** "6:41 pm" */
export function clockLabel(ms: number) {
  return new Date(ms)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}
