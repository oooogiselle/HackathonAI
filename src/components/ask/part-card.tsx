"use client";

// One small ask on the Your ask screen: editable fields, who'd be a good fit,
// and the suggested price with what it means for who can see it.
import { X } from "lucide-react";

import { composeAskText } from "@/lib/ask/format";
import { countFits } from "@/lib/ask/helper-fit";
import { suggestPrice } from "@/lib/ask/price";
import type { AskPart } from "@/lib/ask/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

const MAX_PRICE = 200;

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

  function removeNeed(need: string) {
    const needs = part.helper.needs.filter((n) => n !== need);
    onChange({
      ...part,
      helper: { ...part.helper, needs, ...countFits(part.helper.interests, needs) },
    });
  }

  function removeNice(nice: string) {
    onChange({
      ...part,
      helper: { ...part.helper, nice: part.helper.nice.filter((n) => n !== nice) },
    });
  }

  function setPrice(value: number) {
    const priceSet = Number.isFinite(value)
      ? Math.min(MAX_PRICE, Math.max(0, Math.round(value)))
      : 0;
    onChange({ ...part, priceSet });
  }

  const { fits, fitsPaid } = part.helper;

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
            {sent ? "Sent ✓" : "Send this one first"}
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

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Who to ask</h3>
        {part.helper.why && <p className="text-sm text-muted-foreground">{part.helper.why}</p>}
        {(part.helper.needs.length > 0 || part.helper.nice.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {part.helper.needs.map((need) => (
              <RemovableChip
                key={need}
                label={`Needs: ${need}`}
                onRemove={() => removeNeed(need)}
                strong
              />
            ))}
            {part.helper.nice.map((nice) => (
              <RemovableChip key={nice} label={nice} onRemove={() => removeNice(nice)} />
            ))}
          </div>
        )}
        <p className="text-sm">
          {fits === 0
            ? "No helper fits all of these yet. Try removing a must-have."
            : `${fits} helper${fits === 1 ? "" : "s"} fit`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Price</h3>
        <div className="flex items-center gap-2">
          <span className="text-lg">$</span>
          <Input
            aria-label="Price in dollars"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PRICE}
            value={part.priceSet}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-24 text-lg"
          />
          <button
            type="button"
            aria-pressed={part.priceSet === 0}
            onClick={() => setPrice(0)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              part.priceSet === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            $0 = favor
          </button>
          {part.priceSet !== part.price.suggested && (
            <button
              type="button"
              onClick={() => setPrice(part.price.suggested)}
              className="text-sm text-muted-foreground underline"
            >
              Use ${part.price.suggested}
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Suggested ${part.price.min}–${part.price.max}. {part.price.reason}
        </p>
        {part.price.favorHint && (
          <p className="text-sm text-muted-foreground">{part.price.favorHint}</p>
        )}
        {fits > 0 && (
          <p className="text-sm">
            {part.priceSet > 0
              ? `$${part.priceSet} reaches ${fitsPaid} of ${fits} helpers who fit (the others can't accept payment). $0 reaches all ${fits}.`
              : `A favor reaches all ${fits} helpers who fit.`}
          </p>
        )}
      </div>

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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RemovableChip({
  label,
  onRemove,
  strong,
}: {
  label: string;
  onRemove: () => void;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm",
        strong ? "border-primary/40 bg-primary/10" : "border-border",
      )}
    >
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}
