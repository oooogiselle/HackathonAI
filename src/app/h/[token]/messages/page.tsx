// The message thread on a task: only the asker and the helper, and only once
// both have said yes (the asker confirmed). Anyone else goes back to the task.
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NAV } from "@/lib/ask/nav";
import { getCard } from "@/server/actions/board";
import { listMessages } from "@/server/actions/inbox";

import { Thread } from "./thread";

export default async function MessagesPage({ params }: PageProps<"/h/[token]/messages">) {
  const { token } = await params;
  const taskPath = `/h/${token}`;
  const card = await getCard(token);
  const party = card && (card.viewer === "asker" || card.viewer === "helper");
  if (!card || !party) redirect(taskPath);
  const result = await listMessages(token);
  if ("error" in result) redirect(taskPath);

  const name = result.otherAlias || "your match";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-2xl">
      <header className="sticky top-0 z-10 bg-background px-4 pt-3 pb-2">
        <Link
          href={taskPath}
          transitionTypes={NAV.back}
          className="-ml-1 flex w-fit items-center gap-0.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" /> Task
        </Link>

        {/* A compact ask ticket; the conversation hangs off its stub. */}
        <div className="mt-2 rounded-[24px] bg-card shadow-[0_1px_2px_rgba(14,42,32,0.06),0_8px_24px_-12px_rgba(14,42,32,0.18)]">
          <div className="px-4 pt-3.5 pb-3">
            <h1 className="truncate text-base leading-snug font-bold">{card.title}</h1>
            <p className="truncate text-[13px] text-muted-foreground">
              With {name}
              {card.meetingSpot ? `, meet at ${card.meetingSpot}` : ""}
            </p>
          </div>
          <div aria-hidden className="relative mx-4 h-0 border-t-2 border-dashed border-input">
            <span className="absolute -top-[9px] -left-6 size-4 rounded-full bg-background" />
            <span className="absolute -top-[9px] -right-6 size-4 rounded-full bg-background" />
          </div>
          <p className="px-4 py-2.5 text-center text-[13px] text-muted-foreground">
            You both said yes. Plan the details here.
          </p>
        </div>
      </header>

      <Thread
        token={token}
        otherAlias={name}
        initial={result.messages}
        closed={card.status === "cancelled"}
      />
    </main>
  );
}
