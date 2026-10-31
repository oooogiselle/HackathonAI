// "You're not the only one" on Quick check: others asked about this last term,
// and a helper's tip. The tip is written by a person; AI only found the match.
import { Users } from "lucide-react";

import type { CommonNeedMatch } from "@/lib/ask/types";

export function CommonNeedCard({ match }: { match: CommonNeedMatch }) {
  return (
    <section
      aria-labelledby="common-need-heading"
      className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(14,42,32,0.06)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Users className="size-4" />
        </span>
        <div className="flex flex-col">
          <h2 id="common-need-heading" className="font-bold">
            You&apos;re not the only one
          </h2>
          <p className="text-sm text-muted-foreground">
            {match.askedLastTerm} students asked about {match.label} last term.
          </p>
        </div>
      </div>
      <figure className="flex flex-col gap-1.5 rounded-2xl bg-background p-3">
        <blockquote className="text-[15px]">&ldquo;{match.tip}&rdquo;</blockquote>
        <figcaption className="text-sm text-muted-foreground">
          {match.from.firstName}, {match.from.year} · helper
        </figcaption>
      </figure>
    </section>
  );
}
