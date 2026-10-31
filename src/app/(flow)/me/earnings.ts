// A helper's mocked balance, from the payments on the asks they're helping with.
import type { PublicCard } from "@/lib/ask/types";

/** Released payments plus tips are available; held payments wait for "done". */
export function earnings(helping: PublicCard[], tipsCents = 0) {
  let availableCents = tipsCents;
  let heldCents = 0;
  for (const card of helping) {
    if (card.payment?.status === "released") availableCents += card.payment.amountCents;
    if (card.payment?.status === "held") heldCents += card.payment.amountCents;
  }
  return { availableCents, heldCents };
}
