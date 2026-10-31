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
import {
  DEFAULT_PAYMENT_METHOD,
  formatCents,
  PAYMENT_METHODS,
  paymentBreakdown,
} from "@/lib/ask/fees";
import { findGroup } from "@/lib/ask/mock-data";
import type { PaymentMethod, PublicCard, Result } from "@/lib/ask/types";
import {
  cancelCard,
  claimCard,
  confirmHelper,
  extendCard,
  letGoOfCard,
  markDone,
  markHelperDone,
  payToHold,
  reportProblem,
} from "@/server/actions/board";
import { cn } from "cn";

const REFRESH_MS = 3000;
const HOUR = 3_600_000;

function Note({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 rounded-xl border p-4 text-sm">{children}</div>;
}

export function TaskActions({
  card,
  signedIn,
  needsPaymentSetup,
  myReview,
}: {
  card: PublicCard;
  signedIn: boolean;
  needsPaymentSetup: boolean;
  // Asker, done: the review they left, if any.
  myReview?: { stars: number; editable: boolean } | null;
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

  function run(action: () => Promise<Result | Result<object>>, success?: string) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else if (success) toast.success(success);
      router.refresh();
    });
  }

  if (status === "expired") {
    return (
      <Note>
        <p className="font-medium">This ask has expired</p>
        <p className="text-muted-foreground">No one claimed it in time, so it left the board.</p>
        {viewer === "asker" && (
          <>
            <Link href="/ask" className={buttonVariants({ className: "mt-2 h-11" })}>
              Post again
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost", className: "h-11" })}>
              Don&apos;t need it anymore
            </Link>
          </>
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

  const helperName = card.heldByFirstName ?? "Your helper";
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
        <>
          <Note>
            <p className="font-medium">You offered to help</p>
            <p className="text-muted-foreground">Waiting for the asker to confirm.</p>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
              <li>
                {paidAsk
                  ? `The asker confirms you and holds the ${formatCents(card.price * 100)}.`
                  : "The asker confirms you."}
              </li>
              <li>
                You both get each other&apos;s first name and a chat. Your email stays hidden.
              </li>
              <li>
                {paidAsk
                  ? `After it's done, the asker confirms and the ${formatCents(card.price * 100)} goes to you.`
                  : "After it's done, the asker confirms and says thanks."}
              </li>
            </ol>
          </Note>
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/claimed"
              className={buttonVariants({ variant: "outline", className: "h-11" })}
            >
              See my claimed tasks
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Can&apos;t make it anymore? Let go so someone else can help.
            </p>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Let go of this ask? It goes back on the board.")) {
                  run(() => letGoOfCard(token), "You let it go");
                }
              }}
            >
              Let go of this ask
            </Button>
          </div>
        </>
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
            Confirm to lock it in. Your contact details are shared only after you confirm.
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
          {card.shares.length > 0 && (
            <p className="text-xs text-muted-foreground">
              GroupMe: the bot posted &ldquo;Covered&rdquo; in{" "}
              {card.shares.map((s) => findGroup(s.groupId)?.name ?? s.groupId).join(", ")}.
            </p>
          )}
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
        {myReview && (
          <p className="text-muted-foreground">
            You rated {helperName} {myReview.stars} of 5.
          </p>
        )}
      </Note>
      <div className="mt-auto flex flex-col gap-2">
        {(!myReview || myReview.editable) && (
          <Link
            href={`/review?token=${encodeURIComponent(token)}`}
            className={buttonVariants({
              size: "lg",
              variant: myReview ? "outline" : "default",
              className: "h-12 text-base",
            })}
          >
            {myReview ? "Edit your review" : "Rate your helper"}
          </Link>
        )}
        <Link
          href={`/thanks?token=${encodeURIComponent(token)}`}
          className={buttonVariants({
            size: "lg",
            variant: myReview ? "default" : "outline",
            className: "h-12 text-base",
          })}
        >
          Write a thank-you
        </Link>
      </div>
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

type Run = (action: () => Promise<Result | Result<object>>, success?: string) => void;

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
  // Venmo, PayPal or a card (all mocked, TODO(stripe)).
  const [method, setMethod] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const fees = paymentBreakdown(card.price, method);
  const rows: [string, number][] = [
    ["Task pay (goes to your helper)", fees.amountCents],
    ["Platform fee (10%)", fees.platformFeeCents],
    ["Payment processing (est.)", fees.processingFeeCents],
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
      <div>
        <h2 className="font-medium">Pay to hold the task</h2>
        <p className="text-muted-foreground">
          Your payment is held; it isn&apos;t sent yet. It&apos;s released to your helper when you
          confirm the help is done, or 48 h after they mark it done unless you report a problem.
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
      <div role="radiogroup" aria-label="Pay with" className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Pay with
        </span>
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={method === m.id}
            onClick={() => setMethod(m.id)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border p-3 text-left",
              method === m.id ? "border-primary bg-pay/50 ring-1 ring-primary" : "border-input",
            )}
          >
            <span className="flex flex-col">
              <span className="font-semibold">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.detail}</span>
            </span>
            {m.badge && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                {m.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={pending}
        onClick={() => run(() => payToHold(card.token, method), "Payment held")}
      >
        Pay {formatCents(fees.totalCents)} and hold
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Demo: no real payment is made. We never see your card, PayPal or Venmo login.
      </p>
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
