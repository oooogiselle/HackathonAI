"use client";

// One small ask on the Your ask screen: editable fields, who'd be a good fit,
// and the suggested price with what it means for who can see it.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { composeAskText } from "@/lib/ask/format";
import { suggestPrice } from "@/lib/ask/price";
import type { AskPart } from "@/lib/ask/types";
import { cn } from "cn";

import { Field } from "./form-bits";
import { PriceField } from "./price-field";
import { WhoToAsk } from "./who-to-ask";

export function PartCard({
  part,
  index,
  selectable,
  selected,
  sent,
  onSelect,
  onChange,
}: {
  part: AskPart;
  index: number;
  selectable: boolean;
  selected: boolean;
  sent: boolean;
  onSelect: () => void;
  onChange: (part: AskPart) => void;
}) {
  const id = `part-${index}`;

  // Editing a field rebuilds the sentence; the student can still tweak the wording after.
  function editField(patch: Partial<Pick<AskPart, "what" | "when" | "where" | "minutes">>) {
    const next = { ...part, ...patch };
    if (patch.minutes !== undefined) {
      next.price = suggestPrice(patch.minutes, part.helper.interests);
      next.priceSet = next.price.suggested;
    }
    onChange({ ...next, text: composeAskText(next) });
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-4",
        selected ? "border-primary" : "border-border",
        sent && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {selectable ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name="active-part"
              checked={selected}
              disabled={sent}
              onChange={onSelect}
              className="size-4 accent-primary"
            />
            {sent ? "Sent" : "Send this one first"}
          </label>
        ) : (
          <span />
        )}
        {part.category === "sensitive" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Sensitive: private only
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <Field label="What" id={`${id}-what`}>
          <Input
            id={`${id}-what`}
            value={part.what}
            maxLength={120}
            onChange={(e) => editField({ what: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="When" id={`${id}-when`}>
            <Input
              id={`${id}-when`}
              value={part.when ?? ""}
              placeholder="Any time"
              maxLength={80}
              onChange={(e) => editField({ when: e.target.value })}
            />
          </Field>
          <Field label="Where" id={`${id}-where`}>
            <Input
              id={`${id}-where`}
              value={part.where ?? ""}
              placeholder="Anywhere"
              maxLength={80}
              onChange={(e) => editField({ where: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Time needed (min)" id={`${id}-minutes`}>
          <Input
            id={`${id}-minutes`}
            type="number"
            inputMode="numeric"
            min={5}
            max={240}
            step={5}
            value={part.minutes}
            onChange={(e) => {
              const minutes = Math.min(240, Math.max(5, Number(e.target.value) || 5));
              editField({ minutes });
            }}
          />
        </Field>
      </div>

      <WhoToAsk
        helper={part.helper}
        onChange={(helper) => {
          // New interests can change the rate; follow the suggestion unless the student set a price.
          const price = suggestPrice(part.minutes, helper.interests);
          const priceSet = part.priceSet === part.price.suggested ? price.suggested : part.priceSet;
          onChange({ ...part, helper, price, priceSet });
        }}
      />

      <PriceField
        price={part.price}
        value={part.priceSet}
        fits={part.helper.fits}
        fitsPaid={part.helper.fitsPaid}
        onChange={(priceSet) => onChange({ ...part, priceSet })}
      />

      <Field label="Wording" id={`${id}-text`}>
        <Textarea
          id={`${id}-text`}
          value={part.text}
          onChange={(e) => onChange({ ...part, text: e.target.value })}
          className="min-h-24 text-base"
          maxLength={1000}
        />
      </Field>
    </section>
  );
}
