import { durationLabel, guessCategory } from "@/lib/ask/card-format";
import type { AskPart } from "@/lib/ask/types";

import { AskCard } from "./ask-card";

// The ask being posted, as the same ticket helpers will see on the board.
export function PartTicket({ part, text }: { part: AskPart; text?: string }) {
  return (
    <AskCard
      category={part.askCategory ?? guessCategory(part)}
      payType={part.payType ?? (part.priceSet > 0 ? "pay" : "free")}
      price={part.priceSet}
      title={part.what}
      text={text}
      meta={[
        { kind: "time", label: durationLabel(part.minutes) },
        ...(part.when ? [{ kind: "when" as const, label: part.when }] : []),
      ]}
    />
  );
}
