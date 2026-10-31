// Why a card can't be acted on: cancelled, expired, or already taken.
import Link from "next/link";

import { BottomActions, TaskHeader, TaskTicket } from "@/components/task/task-parts";
import { buttonVariants } from "@/components/ui/button";
import type { PublicCard } from "@/lib/ask/types";

const COPY = {
  cancelled: { status: "Cancelled", title: "This ask was cancelled" },
  expired: { status: "Expired", title: "This ask has expired" },
  taken: { status: "Taken", title: "Already taken" },
} as const;

export function Closed({ card, reason }: { card: PublicCard; reason: keyof typeof COPY }) {
  const subtitle =
    reason === "taken"
      ? "Someone already offered to help. Thank you!"
      : reason === "expired"
        ? "No one claimed it in time, so it left the board."
        : card.viewer === "helper"
          ? "Thanks for offering. Any payment was refunded."
          : card.viewer === "asker"
            ? "It's off the board. Any payment was refunded."
            : undefined;

  return (
    <>
      <TaskHeader status={COPY[reason].status} title={COPY[reason].title} subtitle={subtitle} />
      <div className="opacity-60">
        <TaskTicket card={card} />
      </div>
      <BottomActions>
        <Link
          href="/"
          className={buttonVariants({
            size: "lg",
            variant: "secondary",
            className: "h-12 text-base",
          })}
        >
          Back to the board
        </Link>
      </BottomActions>
    </>
  );
}
