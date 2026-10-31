import { CATEGORY_LABELS, priceLabel } from "@/lib/ask/card-format";
import type { AskCategory, PublicCard } from "@/lib/ask/types";

// Category pill colors from the design (v2).
const CATEGORY_STYLES: Record<AskCategory, string> = {
  writing: "bg-pay text-secondary-foreground",
  coding: "bg-[#ede7ff] text-[#5b3cc4]",
  lab: "bg-[#e2eeff] text-[#1d5fb8]",
  errands: "bg-[#ffead5] text-[#9a4300]",
  other: "bg-muted text-muted-foreground",
};

export function CategoryTag({ category }: { category: AskCategory }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${CATEGORY_STYLES[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function PriceTag({ card }: { card: Pick<PublicCard, "payType" | "price"> }) {
  return (
    <span className="rounded-full bg-pay px-2.5 py-1 text-[13px] font-bold">{priceLabel(card)}</span>
  );
}
