"use client";

// Asker, after the ask came down unclaimed: post the same ask again, edit it
// first, or let it go.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { BottomActions, Panel, TaskHeader, TaskTicket } from "@/components/task/task-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PublicCard } from "@/lib/ask/types";
import { postToBoard } from "@/server/actions/board";

export function AskerExpired({ card }: { card: PublicCard }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Same wording and settings, a fresh 24 h on the board (safety re-checked by the server).
  function postAgain() {
    startTransition(async () => {
      const posted = await postToBoard({
        title: card.title,
        text: card.text,
        category: card.category,
        payType: card.payType,
        minutes: card.minutes,
        price: card.price,
        anonymous: card.anonymous,
        startsAt: card.startsAt && card.startsAt > Date.now() ? card.startsAt : undefined,
        expiresIn: "24h",
      });
      if ("error" in posted) return void toast.error(posted.error);
      toast.success("Posted again");
      router.push(`/h/${posted.token}`);
    });
  }

  return (
    <>
      <TaskHeader
        status="Expired"
        title="This ask expired"
        subtitle="No one claimed it in time. It's off the board, and its link now says it expired."
      />

      <div className="opacity-60">
        <TaskTicket card={card} />
      </div>

      <Panel title="What a helper sees from the link">
        <p className="text-muted-foreground">This ask has expired.</p>
      </Panel>

      <BottomActions>
        {/* Private asks never go to the board, so they're picked again from Where it goes. */}
        {!card.private && (
          <Button size="lg" className="h-12 text-base" disabled={pending} onClick={postAgain}>
            {pending ? "Posting…" : "Post again"}
          </Button>
        )}
        <Link
          href={`/ask?from=${encodeURIComponent(card.token)}`}
          className={buttonVariants({
            size: "lg",
            variant: card.private ? "default" : "secondary",
            className: "h-12 text-base",
          })}
        >
          Edit and post
        </Link>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", className: "text-muted-foreground" })}
        >
          Don&apos;t need it anymore
        </Link>
      </BottomActions>
    </>
  );
}
