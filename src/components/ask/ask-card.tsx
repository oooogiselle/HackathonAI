import { Calendar, CalendarClock, Clock, User } from "lucide-react";

import type { AskCategory, PayType } from "@/lib/ask/types";
import { cn } from "cn";

import { CategoryTag, PriceTag } from "./card-tags";

export type AskCardMeta = {
  kind: "who" | "time" | "when" | "expires";
  label: string;
  urgent?: boolean;
};

const META_ICONS = { who: User, time: Clock, when: Calendar, expires: CalendarClock };

// One ask, one card: the same ticket on the board, Quick check, Where it goes
// and the task page. The perforated stub holds the facts a helper scans first
// (who, how long, when it comes down) and the action.
export function AskCard({
  category,
  payType,
  price,
  title,
  text,
  meta,
  action,
  titleSlot,
  notice,
  className,
}: {
  category: AskCategory;
  payType: PayType;
  price: number;
  title: string;
  text?: string;
  meta: AskCardMeta[];
  action?: React.ReactNode;
  // Replaces the plain title, e.g. with a link that makes the whole card tappable.
  titleSlot?: React.ReactNode;
  // Under the stub, e.g. the next step on the Claimed tab.
  notice?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[24px] bg-card shadow-[0_1px_2px_rgba(14,42,32,0.06),0_8px_24px_-12px_rgba(14,42,32,0.18)]",
        className,
      )}
    >
      <div className="flex flex-col p-4 pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <CategoryTag category={category} />
          <PriceTag card={{ payType, price }} />
        </div>
        <h2 className="mt-3 text-lg leading-tight font-bold text-balance">{titleSlot ?? title}</h2>
        {text && <p className="mt-1.5 line-clamp-2 text-[15px] text-muted-foreground">{text}</p>}
      </div>

      {/* The perforation: a dashed rule with a notch cut into each side. */}
      <div aria-hidden className="relative mx-4 h-0 border-t-2 border-dashed border-input">
        <span className="absolute -top-[9px] -left-6 size-4 rounded-full bg-background" />
        <span className="absolute -top-[9px] -right-6 size-4 rounded-full bg-background" />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {meta.map((m) => {
            const Icon = META_ICONS[m.kind];
            return (
              <li
                key={m.kind}
                className={cn(
                  "flex items-center gap-1",
                  m.urgent && "font-semibold text-[#9a4300]",
                )}
              >
                <Icon aria-hidden className="size-3.5 shrink-0" />
                {m.label}
              </li>
            );
          })}
        </ul>
        {action}
      </div>
      {notice}
    </article>
  );
}
