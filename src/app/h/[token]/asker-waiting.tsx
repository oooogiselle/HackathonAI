"use client";

// Asker, before anyone is confirmed: how long the ask stays up, where it was
// posted, and (once someone taps "I can help") who it's held for.
import { ExpiryCountdown } from "@/components/task/expiry-countdown";
import {
  clockLabel,
  HelperLine,
  Panel,
  Rows,
  TaskHeader,
  TaskTicket,
} from "@/components/task/task-parts";
import { useTaskAction } from "@/components/task/use-task-action";
import { Button } from "@/components/ui/button";
import { findGroup } from "@/lib/ask/mock-data";
import type { PublicCard } from "@/lib/ask/types";
import { cancelCard, confirmHelper, extendCard } from "@/server/actions/board";

const HOUR = 3_600_000;

export function AskerWaiting({ card }: { card: PublicCard }) {
  const { pending, run } = useTaskAction();
  const { token } = card;
  const held = card.status === "held";
  const helperName = card.heldByFirstName ?? "Your helper";

  const postedTo: [string, string][] = [
    [card.private ? "Asked privately" : "Needs board", clockLabel(card.createdAt)],
    ...card.shares.map((s): [string, string] => [
      `${findGroup(s.groupId)?.name ?? s.groupId} · GroupMe`,
      clockLabel(s.postedAt),
    ]),
  ];

  function cancel() {
    if (window.confirm("Cancel this ask? It comes off the board.")) {
      run(() => cancelCard(token), "Ask cancelled");
    }
  }

  return (
    <>
      <TaskHeader
        status={held ? "Someone said yes" : "Open"}
        title={held ? `${helperName} can help` : "Waiting for a helper"}
        subtitle={
          held
            ? "It's held for you. Confirm to lock it in; you'll get each other's first name and a chat."
            : "We'll update this page when someone says yes."
        }
      />

      <TaskTicket card={card} />

      {held ? (
        <Panel className="gap-4">
          <HelperLine card={card} />
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={pending}
            onClick={() => run(() => confirmHelper(token))}
          >
            Confirm {helperName}
          </Button>
        </Panel>
      ) : (
        <Panel className="gap-4">
          <ExpiryCountdown createdAt={card.createdAt} expiresAt={card.expiresAt} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-11"
              disabled={pending}
              onClick={() =>
                run(
                  () => extendCard({ token, expiresAt: card.expiresAt + 24 * HOUR }),
                  "Extended 24 h",
                )
              }
            >
              Extend 24 h
            </Button>
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              disabled={pending}
              onClick={cancel}
            >
              Cancel ask
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Posted to">
        <Rows rows={postedTo} />
      </Panel>

      {held && (
        <Button
          variant="ghost"
          className="mt-auto text-destructive"
          disabled={pending}
          onClick={cancel}
        >
          Cancel ask
        </Button>
      )}
    </>
  );
}
