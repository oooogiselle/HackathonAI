// Helper, right after "I can help": it's held for them until the asker confirms.
// TODO(G8): "Let go of this ride" needs a releaseClaim action; hidden until then.
import Link from "next/link";

import { BottomActions, Panel, TaskHeader, TaskTicket } from "@/components/task/task-parts";
import { buttonVariants } from "@/components/ui/button";
import type { PublicCard } from "@/lib/ask/types";

export function HelperOffered({ card }: { card: PublicCard }) {
  const pay = card.price > 0 ? `$${card.price}` : null;
  const steps = [
    pay ? `The asker confirms you and holds the ${pay}.` : "The asker confirms you.",
    "You both get each other's first name and a chat. Your school email stays hidden.",
    pay
      ? `After you help, the asker confirms it's done and the ${pay} goes to you.`
      : "You help, and you both mark it done.",
  ];

  return (
    <>
      <TaskHeader
        status="Held for you"
        title="You offered to help"
        subtitle="It's held for you. Waiting for the asker to confirm."
      />

      <TaskTicket card={card} />

      <Panel title="What happens next">
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-background"
                }`}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Panel>

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
