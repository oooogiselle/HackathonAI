"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { durationLabel, priceLabel } from "@/lib/ask/card-format";
import type { InboxItem, PrivateRequest } from "@/lib/ask/types";
import { markInboxRead } from "@/server/actions/inbox";
import { respondToRequest } from "@/server/actions/private";
import { cn } from "cn";
import { NAV } from "@/lib/ask/nav";

function ago(ms: number) {
  const min = Math.round((Date.now() - ms) / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function PrivateRequests({
  requests,
  canAcceptPayment,
}: {
  requests: PrivateRequest[];
  canAcceptPayment: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Asked you privately · {requests.length}
      </h2>
      <p className="-mt-1 text-sm text-muted-foreground">
        Only you and a couple of others got these. No need to give a reason if you can&apos;t.
      </p>
      <ul className="grid gap-3 wide:grid-cols-2">
        {requests.map((r) => (
          <li key={r.card.token}>
            <RequestCard request={r} canAcceptPayment={canAcceptPayment} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RequestCard({
  request: { card },
  canAcceptPayment,
}: {
  request: PrivateRequest;
  canAcceptPayment: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const needsSetup = card.price > 0 && !canAcceptPayment;

  function answer(value: "yes" | "no") {
    start(async () => {
      const result = await respondToRequest({ token: card.token, answer: value });
      if ("error" in result) toast.error(result.error);
      else if (value === "yes") {
        toast.success("You offered to help. The asker confirms next.");
        router.push(`/h/${card.token}`, { transitionTypes: NAV.forward });
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="flex flex-col gap-3 rounded-3xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/h/${card.token}`} className="font-bold underline-offset-4 hover:underline">
          {card.title}
        </Link>
        <span className="shrink-0 rounded-full bg-pay px-2.5 py-1 text-[13px] font-bold">
          {priceLabel(card)}
        </span>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">{card.text}</p>
      <p className="text-xs text-muted-foreground">{durationLabel(card.minutes)}</p>
      {needsSetup && (
        <p className="rounded-2xl bg-muted px-3 py-2 text-sm">
          This one is paid. Turn on &quot;I can accept payment&quot; on the{" "}
          <Link href="/me" className="font-semibold underline">
            Me
          </Link>{" "}
          tab to say yes.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={pending} onClick={() => answer("no")}>
          Not this time
        </Button>
        <Button disabled={pending || needsSetup} onClick={() => answer("yes")}>
          I can help
        </Button>
      </div>
    </article>
  );
}

export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.some((i) => !i.read);

  function markAll() {
    start(async () => {
      await markInboxRead();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
        Nothing yet. When someone claims your ask or it&apos;s marked done, you&apos;ll see it here.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Updates</h2>
        {unread && (
          <Button
            variant="ghost"
            className="-mr-3 text-primary"
            disabled={pending}
            onClick={markAll}
          >
            Mark all read
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-background overflow-hidden rounded-3xl bg-card">
        {items.map((item) => {
          const body = (
            <>
              <span className="flex items-center justify-between gap-3">
                <span className={cn("flex items-center gap-2", !item.read && "font-bold")}>
                  {!item.read && (
                    <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ago(item.createdAt)}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{item.text}</span>
            </>
          );
          return (
            <li key={item.id}>
              {item.token ? (
                <Link
                  href={`/h/${item.token}`}
                  onClick={() => {
                    if (!item.read) void markInboxRead([item.id]);
                  }}
                  className={cn(
                    "flex flex-col gap-1 p-4 hover:bg-muted/50",
                    item.kind === "action" && !item.read && "bg-pay/40",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-1 p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
