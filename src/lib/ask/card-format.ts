// Display labels for a card, shared by the board and the task page.
import type { AskCategory, PublicCard } from "./types";

export const CATEGORY_LABELS: Record<AskCategory, string> = {
  writing: "Writing",
  coding: "Coding",
  lab: "Lab",
  errands: "Errands",
  other: "Other",
};

export function priceLabel(card: Pick<PublicCard, "payType" | "price">) {
  if (card.payType === "trade") return "Trade";
  if (card.price === 0) return "Favor";
  return `$${card.price}`;
}

export function durationLabel(minutes: number) {
  return minutes >= 60 ? `~${Math.round((minutes / 60) * 10) / 10} h` : `~${minutes} min`;
}

export function expiresLabel(expiresAt: number, now: number) {
  const hours = (expiresAt - now) / 3_600_000;
  if (hours <= 0) return "Expired";
  if (hours < 1) return "Expires soon";
  if (hours < 24) return `Expires in ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

/** "Sat, Nov 1, 3:00 PM" */
export function whenLabel(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function askerLabel(card: Pick<PublicCard, "askerFirstName" | "askerYear">) {
  return card.askerFirstName ?? card.askerYear ?? "A classmate";
}
