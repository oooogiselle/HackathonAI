// Mocked fee breakdown, shared by the server (what's stored) and the Pay screen
// (what's shown before the tap). 10% platform fee plus an estimated processing
// fee. No money moves (TODO(stripe)).
import type { PaymentMethod } from "./types";

// Pay to hold: Venmo, PayPal, or a credit or debit card (the design's order).
export const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  detail: string;
  badge?: string;
}[] = [
  { id: "venmo", label: "Venmo", detail: "Fee 1.9% (est.) · Approve in app", badge: "Fastest" },
  { id: "paypal", label: "PayPal", detail: "Fee 2.9% + $0.30 (est.) · Approve in app" },
  {
    id: "card",
    label: "Credit or debit card",
    detail: "Visa, Mastercard, Amex · 2.9% + $0.30 (est.)",
  },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = "venmo";

export function paymentBreakdown(price: number, method: PaymentMethod) {
  const amountCents = price * 100;
  const platformFeeCents = Math.round(amountCents * 0.1);
  const base = amountCents + platformFeeCents;
  // Venmo 1.9%; PayPal and cards 2.9% + $0.30.
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
