"use client";

// Price for one ask: the student's number, the suggested range with its
// reason, and who each price reaches (paid asks only go to helpers who can
// accept payment).
import { Input } from "@/components/ui/input";
import type { PriceSuggestion } from "@/lib/ask/types";

import { ToggleChip } from "./form-bits";

export const MAX_PRICE = 200;

export function PriceField({
  price,
  value,
  fits,
  fitsPaid,
  onChange,
}: {
  price: PriceSuggestion;
  value: number;
  fits: number;
  fitsPaid: number;
  onChange: (value: number) => void;
}) {
  function set(raw: number) {
    onChange(Number.isFinite(raw) ? Math.min(MAX_PRICE, Math.max(0, Math.round(raw))) : 0);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Price</h3>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">$</span>
        <Input
          aria-label="Price in dollars"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_PRICE}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="w-24 text-lg"
        />
        <ToggleChip label="$0 = favor" pressed={value === 0} onClick={() => set(0)} />
        {value !== price.suggested && (
          <button
            type="button"
            onClick={() => set(price.suggested)}
            className="text-sm text-muted-foreground underline"
          >
            Use ${price.suggested}
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Suggested ${price.min}–${price.max}. {price.reason}
      </p>
      {price.favorHint && <p className="text-sm text-muted-foreground">{price.favorHint}</p>}
      {fits > 0 && (
        <p className="text-sm">
          {value > 0
            ? `$${value} reaches ${fitsPaid} of ${fits} helpers who fit (the others can't accept payment). $0 reaches all ${fits}.`
            : `A favor reaches all ${fits} helpers who fit.`}
        </p>
      )}
    </div>
  );
}
