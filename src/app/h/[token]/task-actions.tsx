"use client";

// The buttons on a task, by who's looking (card.viewer) and where it is.
// Every tap is one server action; the server decides who wins and returns the
// error string to show as-is. While someone is waiting on the other person,
// the page refreshes every few seconds.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { whenLabel } from "@/lib/ask/card-format";
import { formatCents, paymentBreakdown } from "@/lib/ask/fees";
import { findGroup } from "@/lib/ask/mock-data";
import type { PublicCard, Result } from "@/lib/ask/types";
import {
  cancelCard,
  claimCard,
  confirmHelper,
  extendCard,
  markDone,
  markHelperDone,
  payToHold,
  reportProblem,
} from "@/server/actions/board";

const REFRESH_MS = 3000;
const HOUR = 3_600_000;

function Note({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-xl border p-4 text-sm">{children}</div>;
}

export function TaskActions({
  card,
  signedIn,
  needsPaymentSetup,
}: {
  card: PublicCard;
  signedIn: boolean;
  needsPaymentSetup: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { viewer, status, token } = card;
  const party = viewer === "asker" || viewer === "helper";
  const live = status === "open" || status === "held" || status === "confirmed";

  // Waiting on the other side: keep the page fresh.
  useEffect(() => {
    if (!party || !live) return;
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [party, live, router]);

  function run(
    action: () => Promise<Result | Result<object>>,
    success?: string,
    { reload = false } = {},
  ) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else if (reload) {
        // A first claim turns a visitor into the helper; on Vercel the soft
        // refresh left the button on "Claiming…", so load the page fresh.
        window.location.reload();
        return;
      } else if (success) toast.success(success);
      router.refresh();
    });
  }

  if (status === "expired") {
    return (
      <Note>
        <p className="font-medium">This ask has expired</p>
        <p className="text-muted-foreground">No one claimed it in time, so it left the board.</p>
        {viewer === "asker" && (
          <Link href="/ask" className={buttonVariants({ className: "mt-2 h-11" })}>
            Post again
          </Link>
        )}
      </Note>
    );
  }
  if (status === "cancelled") {
    return (
      <Note>
        <p className="font-medium">This ask was cancelled</p>
        {viewer === "helper" && (
          <p className="text-muted-foreground">Thanks for offering. Any payment was refunded.</p>
        )}
      </Note>
    );
  }

  // ---------- not the asker or the helper ----------
  if (!party) {
    if (status !== "open") {
      return (
        <Note>
          <p className="font-medium">Already taken</p>
          <p className="text-muted-foreground">Someone already offered to help. Thank you!</p>
        </Note>
      );
    }
    if (!signedIn) {
      return (
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href={`/signin?next=${encodeURIComponent(`/h/${token}`)}`}
            className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
          >
            Claim this task
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Sign in with your Dartmouth account to help.
          </p>
        </div>
      );
    }
    return <ClaimSection card={card} needsSetup={needsPaymentSetup} pending={pending} run={run} />;
  }

  const helperName = card.heldByAlias ?? "Your helper";
  const paidAsk = card.price > 0;
  const held = card.payment?.status === "held";
  const meeting = card.meetingSpot && (
    <Note>
      <span className="text-muted-foreground">Meet at (public)</span>
      <span className="font-medium">{card.meetingSpot}</span>
    </Note>
  );
  const autoConfirm = card.autoConfirmAt && (
    <p className="text-xs text-muted-foreground">
      Confirms automatically {whenLabel(card.autoConfirmAt)}
      {card.problemReportedAt ? " (paused: a problem was reported)" : ""}.
    </p>
  );

  // ---------- helper ----------
  if (viewer === "helper") {
    if (status === "held") {
      return (
        <Note>
          <p className="font-medium">You offered to help</p>
          <p className="text-muted-foreground">Waiting for the asker to confirm.</p>
        </Note>
      );
    }
    if (status === "confirmed") {
      return (
        <>
          {meeting}
          {paidAsk && !held && !card.helperDoneAt ? (
            <Note>
              <p className="font-medium">You&apos;re confirmed</p>
              <p className="text-muted-foreground">
                Waiting for the asker to pay to hold. Start once it&apos;s held.
              </p>
            </Note>
          ) : card.helperDoneAt ? (
            <Note>
              <p className="font-medium">Marked done</p>
              <p className="text-muted-foreground">
                Waiting for the asker to confirm
                {paidAsk ? `, then ${formatCents(card.price * 100)} is released to you` : ""}.
              </p>
              {autoConfirm}
            </Note>
          ) : (
            <div className="mt-auto flex flex-col gap-2">
              {paidAsk && (
                <p className="text-center text-sm text-muted-foreground">
                  {formatCents(card.price * 100)} is held for you.
                </p>
              )}
              <Button
                size="lg"
                className="h-12 text-base"
                disabled={pending}
                onClick={() => run(() => markHelperDone(token))}
              >
                Done
              </Button>
            </div>
          )}
        </>
      );
    }
    return (
      <Note>
        <p className="font-medium">Done. Thank you for helping!</p>
        {card.payment?.status === "released" && (
          <p className="text-muted-foreground">
            {formatCents(card.payment.amountCents)} released to you.
          </p>
        )}
      </Note>
    );
  }

  // ---------- asker ----------
  const canCancel =
    status === "open" || status === "held" || (status === "confirmed" && !card.helperDoneAt);
  const cancelButton = canCancel && (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Cancel this ask? Any payment is refunded.")) {
          run(() => cancelCard(token), "Ask cancelled");
        }
      }}
    >
      Cancel ask
    </Button>
  );

  if (status === "open") {
    return (
      <>
        <Note>
          <p className="font-medium">Waiting for a helper</p>
          <p className="text-muted-foreground">
            Expires {whenLabel(card.expiresAt)}. We&apos;ll update this page when someone says yes.
          </p>
          {card.shares.length > 0 && (
            <p className="text-muted-foreground">
              Shared to {card.shares.map((s) => findGroup(s.groupId)?.name ?? s.groupId).join(", ")}
              .
            </p>
          )}
        </Note>
        {!card.private && <ShareLink token={token} title={card.title} />}
        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="outline"
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
          {cancelButton}
        </div>
      </>
    );
  }

  if (status === "held") {
    return (
      <>
        <Note>
          <p className="font-medium">{helperName} can help!</p>
          <p className="text-muted-foreground">
            Confirm to lock it in. You&apos;ll talk in the thread; names and contact details stay
            private.
          </p>
        </Note>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={pending}
            onClick={() => run(() => confirmHelper(token))}
          >
            Confirm {helperName}
          </Button>
          {cancelButton}
        </div>
      </>
    );
  }

  if (status === "confirmed") {
    if (paidAsk && !held) {
      return (
        <>
          {meeting}
          <PaySection card={card} pending={pending} run={run} />
          {cancelButton}
        </>
      );
    }
    return (
      <>
        {meeting}
        <Note>
          <p className="font-medium">
            {card.helperDoneAt ? `${helperName} marked it done` : `${helperName} is on it`}
          </p>
          <p className="text-muted-foreground">
            {paidAsk
              ? `${formatCents(card.payment!.amountCents)} is held. Confirm when the help is done to release it.`
              : "Confirm when the help is done."}
          </p>
          {autoConfirm}
        </Note>
        <DoneSection card={card} pending={pending} run={run} />
        {cancelButton}
      </>
    );
  }

  // done
  return (
    <>
      <Note>
        <p className="font-medium">Done!</p>
        {card.payment?.status === "released" && (
          <p className="text-muted-foreground">
            {formatCents(card.payment.amountCents)} released to {helperName}.
          </p>
        )}
      </Note>
      <Link
        href={`/thanks?token=${encodeURIComponent(token)}`}
        className={buttonVariants({ size: "lg", className: "mt-auto h-12 text-base" })}
      >
        Write a thank-you
      </Link>
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
    <div className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm">
      <span className="text-muted-foreground">Share the link in any group chat</span>
      <Button variant="secondary" onClick={share} aria-live="polite">
        {copied ? "Link copied" : "Share link"}
      </Button>
    </div>
  );
}

type Run = (
  action: () => Promise<Result | Result<object>>,
  success?: string,
  options?: { reload?: boolean },
) => void;

function ClaimSection({
  card,
  needsSetup,
  pending,
  run,
}: {
  card: PublicCard;
  needsSetup: boolean;
  pending: boolean;
  run: Run;
}) {
  const [canAcceptPayment, setCanAcceptPayment] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState("");
  const setupBlocked = needsSetup && (!canAcceptPayment || !payoutAccount.trim());

  return (
    <div className="mt-auto flex flex-col gap-3">
      {needsSetup && (
        <section className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
          <div>
            <h2 className="font-medium">Helper setup (demo)</h2>
            <p className="text-muted-foreground">
              This is a paid ask. Paid asks only go to helpers who can accept payment. Many F-1
              students can&apos;t; leave this off if that&apos;s you.
            </p>
          </div>
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
                placeholder="Last 4 digits of your bank account or debit card"
                inputMode="numeric"
                className="h-11"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Demo: no real account is connected. Stripe pays you once the help is done.
              </p>
            </div>
          )}
        </section>
      )}
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
                  ? { canAcceptPayment, payoutMethod: "bank", payoutAccount: payoutAccount.trim() }
                  : undefined,
              }),
            "You offered to help",
            { reload: true },
          )
        }
      >
        {pending ? "Claiming…" : "Claim this task"}
      </Button>
      {setupBlocked && (
        <p className="text-center text-sm text-muted-foreground">
          {canAcceptPayment
            ? "Add your payout account to claim."
            : 'Turn on "I can accept payment" to claim this paid ask.'}
        </p>
      )}
      {card.price > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Payment is held when the asker confirms, and released to you when it&apos;s done.
        </p>
      )}
    </div>
  );
}

function PaySection({ card, pending, run }: { card: PublicCard; pending: boolean; run: Run }) {
  // Card or Apple Pay through Stripe (mocked, TODO(stripe)).
  const fees = paymentBreakdown(card.price, "card");
  const rows: [string, number][] = [
    ["Task pay (goes to your helper)", fees.amountCents],
    ["Platform fee (10%)", fees.platformFeeCents],
    ["Card processing (Stripe)", fees.processingFeeCents],
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
      <div>
        <h2 className="font-medium">Pay to hold the task</h2>
        <p className="text-muted-foreground">
          Stripe holds your payment; it isn&apos;t sent yet. It&apos;s released to your helper when
          you confirm the help is done, or 48 h after they mark it done unless you report a problem.
          Cancel before then for a full refund.
        </p>
      </div>
      <dl className="flex flex-col gap-1">
        {rows.map(([label, cents]) => (
          <div key={label} className="flex justify-between">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{formatCents(cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t pt-1 font-medium">
          <dt>Total today</dt>
          <dd>{formatCents(fees.totalCents)}</dd>
        </div>
      </dl>
      <p className="rounded-lg bg-muted px-3 py-2 font-medium">
        Card or Apple Pay · secured by Stripe
      </p>
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={pending}
        onClick={() => run(() => payToHold(card.token, "card"), "Payment held")}
      >
        Pay {formatCents(fees.totalCents)} and hold
      </Button>
      <p className="text-center text-xs text-muted-foreground">Demo: no real payment is made.</p>
    </section>
  );
}

function DoneSection({ card, pending, run }: { card: PublicCard; pending: boolean; run: Run }) {
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");

  if (card.problemReportedAt) {
    return (
      <Note>
        <p className="font-medium">Problem reported</p>
        <p className="text-muted-foreground">
          The auto-confirm is paused and any payment stays held while it&apos;s reviewed.
        </p>
      </Note>
    );
  }

  return (
    <div className="mt-auto flex flex-col gap-2">
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={pending}
        onClick={() => run(() => markDone(card.token), "Confirmed done")}
      >
        Confirm done
      </Button>
      {reporting ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <Label htmlFor="problem">What went wrong? (optional)</Label>
          <Textarea
            id="problem"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(() => reportProblem(card.token, note), "Problem reported")}
          >
            Send report
          </Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => setReporting(true)}>
          Report a problem
        </Button>
      )}
    </div>
  );
}
