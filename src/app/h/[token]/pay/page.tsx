// Pay to hold (/h/[token]/pay): the asker holds the task pay with Stripe
// (mocked, TODO(stripe)) so the helper can start. Only for a confirmed, paid,
// not-yet-held ask; anything else goes back to the task page.
import { redirect } from "next/navigation";

import { Panel, Rows, TaskHeader } from "@/components/task/task-parts";
import { formatCents, paymentBreakdown } from "@/lib/ask/fees";
import { getCard } from "@/server/actions/board";

import { PayButton } from "./pay-button";

export default async function PayPage({ params }: PageProps<"/h/[token]/pay">) {
  const { token } = await params;
  const card = await getCard(token);
  if (
    !card ||
    card.viewer !== "asker" ||
    card.status !== "confirmed" ||
    card.price === 0 ||
    card.payment?.status === "held"
  ) {
    redirect(`/h/${token}`);
  }

  const helperName = card.heldByAlias ?? "your helper";
  const fees = paymentBreakdown(card.price, "card");
  const steps = [
    "You pay now. Stripe holds it; nothing is sent yet.",
    `${helperName} helps you out.`,
    `You confirm it's done, and ${formatCents(fees.amountCents)} goes to ${helperName}.`,
  ];

  return (
    <>
      <TaskHeader
        backHref={`/h/${token}`}
        status="Pay to hold"
        title={`Hold $${card.price} for ${helperName}`}
        subtitle={card.title}
      />

      <Panel title="Breakdown">
        <Rows
          rows={[
            [`Task pay (goes to ${helperName})`, formatCents(fees.amountCents)],
            ["Platform fee (10%)", formatCents(fees.platformFeeCents)],
            ["Card processing (Stripe)", formatCents(fees.processingFeeCents)],
            [
              <span key="t" className="font-bold text-foreground">
                Total today
              </span>,
              <span key="v" className="text-lg font-extrabold">
                {formatCents(fees.totalCents)}
              </span>,
            ],
          ]}
        />
      </Panel>

      <Panel title="Pay with">
        <p className="font-semibold">Card or Apple Pay</p>
        <p className="text-sm text-muted-foreground">Visa, Mastercard, Amex · secured by Stripe</p>
      </Panel>

      <Panel title="How your money moves">
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-[13px] font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Not finished, or you cancel before it starts? You get a full refund. If you don&apos;t
          confirm, it&apos;s released 48 h after {helperName} marks it done, unless you report a
          problem.
        </p>
      </Panel>

      <PayButton token={token} total={formatCents(fees.totalCents)} />
    </>
  );
}
