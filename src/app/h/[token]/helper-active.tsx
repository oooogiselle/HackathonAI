"use client";

// Helper, once confirmed: where to meet, the chat, and Done. On paid asks they
// start once the asker has held the money. Then the asker confirms.
import { MessageThread } from "@/components/task/message-thread";
import {
  BottomActions,
  Panel,
  Progress,
  TaskHeader,
  TaskTicket,
} from "@/components/task/task-parts";
import { useTaskAction } from "@/components/task/use-task-action";
import { Button } from "@/components/ui/button";
import { whenLabel } from "@/lib/ask/card-format";
import { formatCents } from "@/lib/ask/fees";
import type { PublicCard } from "@/lib/ask/types";
import { markHelperDone } from "@/server/actions/board";

export function HelperActive({ card }: { card: PublicCard }) {
  const { pending, run } = useTaskAction();
  const paid = card.price > 0;
  const pay = formatCents(card.price * 100);
  const held = card.payment?.status === "held";

  if (card.status === "done") {
    return (
      <>
        <TaskHeader status="Done" title="Thank you for helping" />
        <TaskTicket card={card} />
        {card.payment?.status === "released" && (
          <Panel>
            <p>{formatCents(card.payment.amountCents)} released to you.</p>
          </Panel>
        )}
        {card.thanks && (
          <Panel title="Their note">
            <p className="whitespace-pre-line text-muted-foreground">{card.thanks}</p>
          </Panel>
        )}
      </>
    );
  }

  const waitingOnPay = paid && !held;
  const title = card.helperDoneAt
    ? "Marked done"
    : waitingOnPay
      ? "You're confirmed"
      : "You're helping";
  const subtitle = card.helperDoneAt
    ? `Waiting for the asker to confirm${paid ? `, then ${pay} is released to you` : ""}.`
    : waitingOnPay
      ? "Waiting for the asker to hold the payment. Start once it's held."
      : paid
        ? `${pay} is held for you.`
        : "Tap Done when you've helped.";

  return (
    <>
      <TaskHeader status="Confirmed" title={title} subtitle={subtitle} />

      <TaskTicket card={card} />

      <Progress card={card} />

      {card.meetingSpot && (
        <Panel title="Meet here">
          <p className="font-semibold">
            {card.meetingSpot}
            {card.startsAt ? ` · ${whenLabel(card.startsAt)}` : ""}
          </p>
          <p className="text-muted-foreground">{card.text}</p>
        </Panel>
      )}

      <MessageThread token={card.token} />

      {card.helperDoneAt
        ? card.autoConfirmAt && (
            <p className="text-center text-sm text-muted-foreground">
              Confirms on its own {whenLabel(card.autoConfirmAt)}
              {card.problemReportedAt ? " (paused: the asker reported a problem)" : ""}.
            </p>
          )
        : !waitingOnPay && (
            <BottomActions>
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={pending}
                onClick={() => run(() => markHelperDone(card.token))}
              >
                Done
              </Button>
            </BottomActions>
          )}
    </>
  );
}
