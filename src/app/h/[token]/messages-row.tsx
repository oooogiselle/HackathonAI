// On the task page once both have said yes: who you're talking to and the
// latest message. Opens the thread.
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { NAV } from "@/lib/ask/nav";
import type { Message } from "@/lib/ask/types";

export function MessagesRow({
  token,
  otherAlias,
  latest,
}: {
  token: string;
  otherAlias: string;
  latest?: Message;
}) {
  return (
    <Link
      href={`/h/${token}/messages`}
      transitionTypes={NAV.forward}
      className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_1px_2px_rgba(14,42,32,0.06),0_4px_12px_-8px_rgba(14,42,32,0.2)] outline-none hover:bg-card/80 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">{otherAlias}</span>
        <span className="truncate text-sm text-muted-foreground">
          {latest ? `${latest.fromMe ? "You: " : ""}${latest.body}` : "Say hi and plan the details"}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
