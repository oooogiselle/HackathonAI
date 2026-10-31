"use client";

// Asker, helper confirmed on a paid ask, money not held yet: the next step is
// Pay to hold (/h/[token]/pay). The chat is open from here on.
import Link from "next/link";

import { MessageThread } from "@/components/task/message-thread";
import { HelperLine, Panel, Progress, TaskHeader, TaskTicket } from "@/components/task/task-parts";
import { useTaskAction } from "@/components/task/use-task-action";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PublicCard } from "@/lib/ask/types";
import { cancelCard } from "@/server/actions/board";

export function AskerClaimed({ card }: { card: PublicCard }) {
  const { pending, run } = useTaskAction();
  const helperName = card.heldByFirstName ?? "Your helper";

  return (
    <>
      <TaskHeader status="Claimed" title={`${helperName} is helping`} />

      <TaskTicket card={card} />

      <Panel>
        <HelperLine card={card} />
      </Panel>

      <Progress card={card} />

      <section className="flex flex-col gap-3 rounded-3xl bg-pay p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">One step before {helperName} starts</h2>
          <p className="text-[15px] text-secondary-foreground">
            Your payment waits with Stripe; it isn&apos;t sent yet. {helperName} starts once
            it&apos;s held, and it goes to them when you confirm it&apos;s done.
          </p>
        </div>
        <Link
          href={`/h/${card.token}/pay`}
          className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
        >
          Hold ${card.price} to start
        </Link>
      </section>

      <MessageThread token={card.token} />

      <Button
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Cancel this ask? Nothing has been charged.")) {
            run(() => cancelCard(card.token), "Ask cancelled");
          }
        }}
      >
        Cancel ask
      </Button>
    </>
  );
}
