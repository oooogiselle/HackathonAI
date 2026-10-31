// Asker, all done: what was released, then a thank-you in their own words.
import Link from "next/link";

import {
  BottomActions,
  Panel,
  Progress,
  TaskHeader,
  TaskTicket,
} from "@/components/task/task-parts";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/ask/fees";
import type { PublicCard } from "@/lib/ask/types";

export function AskerDone({ card }: { card: PublicCard }) {
  const helperName = card.heldByAlias ?? "your helper";
  return (
    <>
      <TaskHeader status="Done" title="All done" subtitle={`${helperName} helped you out.`} />

      <TaskTicket card={card} />

      <Progress card={card} />

      {card.payment?.status === "released" && (
        <Panel>
          <p>
            {formatCents(card.payment.amountCents)} released to {helperName}.
          </p>
        </Panel>
      )}

      {card.thanks ? (
        <Panel title="Your thank-you">
          <p className="whitespace-pre-line text-muted-foreground">{card.thanks}</p>
        </Panel>
      ) : (
        <BottomActions>
          <Link
            href={`/thanks?token=${encodeURIComponent(card.token)}`}
            className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
          >
            Write a thank-you
          </Link>
        </BottomActions>
      )}
    </>
  );
}
