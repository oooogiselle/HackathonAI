"use client";

// Asker, ready to go (paid asks: money held): where to meet, the chat, what's
// held, and "Confirm done", which shows only after the helper taps Done.
import { useState } from "react";

import {
  BottomActions,
  Panel,
  Progress,
  Rows,
  TaskHeader,
  TaskTicket,
} from "@/components/task/task-parts";
import { useTaskAction } from "@/components/task/use-task-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { whenLabel } from "@/lib/ask/card-format";
import { formatCents } from "@/lib/ask/fees";
import type { PublicCard } from "@/lib/ask/types";
import { cancelCard, markDone, reportProblem } from "@/server/actions/board";

export function AskerConfirmed({
  card,
  messages,
}: {
  card: PublicCard;
  messages: React.ReactNode;
}) {
  const { pending, run } = useTaskAction();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const helperName = card.heldByAlias ?? "Your helper";
  const doneByHelper = Boolean(card.helperDoneAt);

  const facts: [React.ReactNode, React.ReactNode][] = [];
  if (card.payment?.status === "held") {
    facts.push([
      `${formatCents(card.payment.amountCents)} held`,
      `Goes to ${helperName} when you confirm`,
    ]);
  }
  if (card.shares.length > 0) facts.push(["GroupMe", "Bot posted “Covered”"]);

  return (
    <>
      <TaskHeader
        status="Confirmed"
        title={doneByHelper ? `${helperName} marked it done` : `${helperName} is on it`}
        subtitle={
          doneByHelper
            ? "Check it's done, then confirm."
            : `You'll confirm once ${helperName} marks it done.`
        }
      />

      <TaskTicket card={card} />

      <Progress card={card} />

      {card.meetingSpot && (
        <Panel title="Meet here">
          <p className="font-semibold">
            {card.meetingSpot}
            {card.startsAt ? ` · ${whenLabel(card.startsAt)}` : ""}
          </p>
          <p className="text-muted-foreground">
            A public spot. Names and contact details stay private.
          </p>
        </Panel>
      )}

      {messages}

      {facts.length > 0 && (
        <Panel>
          <Rows rows={facts} />
        </Panel>
      )}

      {card.problemReportedAt ? (
        <Panel title="Problem reported">
          <p className="text-muted-foreground">
            The auto-confirm is paused and any payment stays held while we look into it.
          </p>
        </Panel>
      ) : (
        <BottomActions>
          {doneByHelper && (
            <>
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={pending}
                onClick={() => run(() => markDone(card.token), "Confirmed done")}
              >
                Confirm done
              </Button>
              {card.autoConfirmAt && (
                <p className="text-center text-sm text-muted-foreground">
                  Confirms on its own {whenLabel(card.autoConfirmAt)}.
                </p>
              )}
            </>
          )}
          {reporting ? (
            <Panel title="What went wrong?">
              <Textarea
                aria-label="What went wrong?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                maxLength={1000}
              />
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => reportProblem(card.token, note), "Problem reported")}
              >
                Send report
              </Button>
            </Panel>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Something went wrong?{" "}
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                Report a problem
              </button>
            </p>
          )}
          {!doneByHelper && (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Cancel this ask? Any payment is refunded.")) {
                  run(() => cancelCard(card.token), "Ask cancelled");
                }
              }}
            >
              Cancel ask
            </Button>
          )}
        </BottomActions>
      )}
    </>
  );
}
