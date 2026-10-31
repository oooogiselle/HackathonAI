// "What happens next" on one ask, for whoever is looking: the line under a card
// on the Claimed tab, and whether it's waiting on this person's tap.
import { formatCents, paymentBreakdown } from "./fees";
import type { PublicCard } from "./types";

export type NextStep = { label: string; yourTurn: boolean };

type StepCard = Pick<
  PublicCard,
  | "viewer"
  | "status"
  | "price"
  | "payment"
  | "helperDoneAt"
  | "problemReportedAt"
  | "heldByFirstName"
  | "thanks"
>;

export function nextStep(card: StepCard): NextStep {
  const helper = card.heldByFirstName ?? "Your helper";
  const paid = card.price > 0;
  const held = card.payment?.status === "held";
  const wait = (label: string) => ({ label, yourTurn: false });
  const tap = (label: string) => ({ label, yourTurn: true });

  if (card.status === "expired") return wait("Expired: nobody claimed it in time");
  if (card.status === "cancelled") return wait("Cancelled");

  if (card.viewer === "asker") {
    switch (card.status) {
      case "open":
        return wait("Waiting for a helper");
      case "held":
        return tap(`${helper} can help. Confirm to lock it in`);
      case "confirmed":
        if (paid && !held) {
          return tap(`Pay ${formatCents(paymentBreakdown(card.price, "card").totalCents)} to hold`);
        }
        if (card.helperDoneAt && !card.problemReportedAt) {
          return tap(`${helper} marked it done. Confirm`);
        }
        if (card.problemReportedAt) return wait("Problem reported. Payment stays held");
        return wait(`${helper} is on it`);
      case "done":
        return card.thanks ? wait("Done. Thank-you sent") : tap("Done. Say thank you");
    }
  }

  switch (card.status) {
    case "held":
      return wait("Waiting for the asker to confirm");
    case "confirmed":
      if (paid && !held && !card.helperDoneAt) return wait("Waiting for the asker to pay");
      if (card.helperDoneAt) return wait("Waiting for the asker to confirm done");
      return tap("Tap Done once you've helped");
    case "done":
      return wait("Done. Thank you for helping");
    default:
      return wait("Open");
  }
}
