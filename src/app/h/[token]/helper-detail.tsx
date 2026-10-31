"use client";

// Task detail for a would-be helper: the card, what done looks like, and
// "I can help". Paid asks first ask for a Stripe payout (mocked). No ratings,
// and no messaging before the asker confirms.
import Link from "next/link";
import { useState } from "react";

import {
  BottomActions,
  Panel,
  PersonLine,
  Progress,
  TaskHeader,
  TaskTicket,
} from "@/components/task/task-parts";
import { useTaskAction } from "@/components/task/use-task-action";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASKER_LABEL, whenLabel } from "@/lib/ask/card-format";
import type { PublicCard } from "@/lib/ask/types";
import { claimCard } from "@/server/actions/board";

export function HelperDetail({
  card,
  signedIn,
  needsSetup,
}: {
  card: PublicCard;
  signedIn: boolean;
  needsSetup: boolean;
}) {
  const { pending, run } = useTaskAction();
  const [canAcceptPayment, setCanAcceptPayment] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState("");
  const setupBlocked = needsSetup && (!canAcceptPayment || !payoutAccount.trim());
  const paid = card.price > 0;

  return (
    <>
      <TaskHeader
        status="Open"
        title="Can you help?"
        subtitle={`Comes down ${whenLabel(card.expiresAt)}.`}
      />

      <TaskTicket card={card} />

      <Panel title="What done looks like">
        <p className="whitespace-pre-line text-muted-foreground">{card.text}</p>
      </Panel>

      <Progress card={card} />

      <Panel className="gap-3">
        <PersonLine name={ASKER_LABEL} />
        <p className="text-sm text-muted-foreground">
          You can message each other once they confirm you.
        </p>
      </Panel>

      {signedIn && needsSetup && (
        <Panel title="Get paid through Stripe">
          <p className="text-muted-foreground">
            This is a paid ask, so it only goes to helpers who can accept payment. Many F-1 students
            can&apos;t; leave this off if that&apos;s you.
          </p>
          <label className="-mx-1 flex min-h-11 items-center gap-3 rounded-lg px-1 font-semibold">
            <input
              type="checkbox"
              checked={canAcceptPayment}
              onChange={(e) => setCanAcceptPayment(e.target.checked)}
              className="size-5 accent-primary"
            />
            I can accept payment
          </label>
          {canAcceptPayment && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="payout">Payout account (connected with Stripe)</Label>
              <Input
                id="payout"
                value={payoutAccount}
                onChange={(e) => setPayoutAccount(e.target.value)}
                placeholder="Last 4 of your bank account or debit card"
                inputMode="numeric"
                className="h-11"
                maxLength={100}
              />
              <p className="text-sm text-muted-foreground">Demo: no real account is connected.</p>
            </div>
          )}
        </Panel>
      )}

      <BottomActions>
        {signedIn ? (
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={pending || setupBlocked}
            onClick={() =>
              run(
                () =>
                  claimCard({
                    token: card.token,
                    setup: needsSetup
                      ? {
                          canAcceptPayment,
                          payoutMethod: "bank",
                          payoutAccount: payoutAccount.trim(),
                        }
                      : undefined,
                  }),
                "You offered to help",
              )
            }
          >
            {pending ? "Sending…" : "I can help"}
          </Button>
        ) : (
          <Link
            href={`/signin?next=${encodeURIComponent(`/h/${card.token}`)}`}
            className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
          >
            I can help
          </Link>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {signedIn && setupBlocked
            ? canAcceptPayment
              ? "Add your payout account to help."
              : 'Turn on "I can accept payment" to help with this paid ask.'
            : signedIn
              ? paid
                ? "Payment is held when the asker confirms you, and released when it's done."
                : "A favor: no money changes hands."
              : "Sign in with your Dartmouth account to help."}
        </p>
      </BottomActions>
    </>
  );
}
