"use client";

// Asker, before anyone is confirmed: how long the ask stays up, where it was
// posted, and (once someone taps "I can help") who it's held for.
import { useState } from "react";
import { toast } from "sonner";

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
  const helperName = card.heldByAlias ?? "Your helper";

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
            ? "It's held for you. Confirm to lock it in; you'll talk in the thread, and names and contact details stay private."
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

      {!held && !card.private && <ShareLink token={token} title={card.title} />}

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

// After posting: one link that works anywhere (any group chat, a DM), so a
// group without the bot still sees the same card. Uses the phone's share sheet
// when there is one.
function ShareLink({ token, title }: { token: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/h/${token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Can anyone help? ${title}`, url });
        return;
      } catch {
        // Closed the sheet, or sharing is blocked: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Copy the link from the address bar instead.");
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Share the link in any group chat</span>
        <Button variant="secondary" onClick={share} aria-live="polite">
          {copied ? "Link copied" : "Share link"}
        </Button>
      </div>
    </Panel>
  );
}
