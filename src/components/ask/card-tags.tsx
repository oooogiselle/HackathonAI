import { priceLabel } from "@/lib/ask/card-format";
import { categoryStyle } from "@/lib/ask/categories";
import type { AskCategory, PublicCard } from "@/lib/ask/types";

export function CategoryTag({ category }: { category: AskCategory }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${categoryStyle(category)}`}
    >
      {category}
    </span>
  );
}

export function PriceTag({ card }: { card: Pick<PublicCard, "payType" | "price"> }) {
  return (
    <span className="rounded-full bg-pay px-2.5 py-1 text-[13px] font-bold">{priceLabel(card)}</span>
  );
}
