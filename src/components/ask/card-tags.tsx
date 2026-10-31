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

// One color per kind of exchange, picked to sit with the forest green:
// money is the brand green, a trade is honey, a favor is blush.
function priceStyle(card: Pick<PublicCard, "payType" | "price">) {
  if (card.payType === "trade") return "bg-[#f2d58a] text-[#5a4300]";
  if (card.price === 0) return "bg-[#f5d5dc] text-[#8c2f4a]";
  return "bg-primary text-primary-foreground";
}

export function PriceTag({ card }: { card: Pick<PublicCard, "payType" | "price"> }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold ${priceStyle(card)}`}>
      {priceLabel(card)}
    </span>
  );
}
