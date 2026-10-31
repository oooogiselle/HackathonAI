// Mocked fee breakdown, shared by the server (what's stored) and the Pay screen
// (what's shown before the tap). 10% platform fee plus an estimated processing
// fee. No money moves (TODO(stripe)).
import type { PaymentMethod } from "./types";

export function paymentBreakdown(price: number, method: PaymentMethod) {
  const amountCents = price * 100;
  const platformFeeCents = Math.round(amountCents * 0.1);
  const base = amountCents + platformFeeCents;
  const processingFeeCents =
    method === "venmo" ? Math.round(base * 0.019) : Math.round(base * 0.029) + 30;
  return {
    amountCents,
    platformFeeCents,
    processingFeeCents,
    totalCents: amountCents + platformFeeCents + processingFeeCents,
  };
}

export function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
