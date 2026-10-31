"use client";

// The form's Category row. Presets as chips, suggested ones first (ranked
// against the ask as it's typed), and "Other" opens a box to type your own,
// with similar categories offered so "airport pickup" can join Rides. Suggestions
// are only shown; nothing is picked without a tap.
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { ToggleChip } from "@/components/ask/form-bits";
import { Input } from "@/components/ui/input";
import { CATEGORY_PRESETS, MAX_CATEGORY_LENGTH, normalizeCategory } from "@/lib/ask/categories";
import { suggestCategories } from "@/server/actions/ask";

const PRESET_LABELS = CATEGORY_PRESETS.map((p) => p.label);

// Ranked suggestions for `text`, fetched after the asker pauses typing.
function useSuggestions(text: string, delayMs: number) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const latest = useRef(0);
  useEffect(() => {
    const value = text.trim();
    const id = ++latest.current;
    const timer = setTimeout(
      async () => {
        const result = value.length < 3 ? [] : await suggestCategories(value).catch(() => []);
        if (id === latest.current) setSuggestions(result);
      },
      value.length < 3 ? 0 : delayMs,
    );
    return () => clearTimeout(timer);
  }, [text, delayMs]);
  return suggestions;
}

export function CategoryPicker({
  value,
  onChange,
  askText,
}: {
  value: string;
  onChange: (category: string) => void;
  askText: string;
}) {
  const isCustom = value !== "" && !PRESET_LABELS.includes(value);
  const [typing, setTyping] = useState(isCustom);
  const [typed, setTyped] = useState(isCustom ? value : "");

  const forAsk = useSuggestions(askText, 600);
  const forTyped = useSuggestions(typing ? typed : "", 300);
  const similar = forTyped.filter(
    (s) => s.toLowerCase() !== normalizeCategory(typed).toLowerCase(),
  );

  // Suggested first (presets or categories others typed), then the rest of the presets.
  const chips = [...new Set([...forAsk, ...PRESET_LABELS])];

  function pick(category: string) {
    setTyping(false);
    setTyped("");
    onChange(category);
  }

  function type(text: string) {
    setTyped(text);
    onChange(text.trim() ? text : "");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Category</span>
      <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <ToggleChip
            key={c}
            label={c}
            icon={forAsk.includes(c) ? <Sparkles className="size-3.5" aria-hidden /> : undefined}
            pressed={!typing && value === c}
            onClick={() => pick(c)}
          />
        ))}
        <ToggleChip
          label="Other"
          pressed={typing}
          onClick={() => {
            setTyping(true);
            onChange(typed);
          }}
        />
      </div>
      {forAsk.length > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="size-3" aria-hidden /> Suggested for your ask
        </span>
      )}
      {typing && (
        <div className="flex flex-col gap-2 pt-1">
          <Input
            aria-label="Your category"
            autoFocus
            value={typed}
            maxLength={MAX_CATEGORY_LENGTH}
            placeholder="Bike repair, haircut, dorm setup..."
            onChange={(e) => type(e.target.value)}
          />
          {similar.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Similar:</span>
              {similar.map((c) => (
                <ToggleChip key={c} label={c} pressed={false} onClick={() => pick(c)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
