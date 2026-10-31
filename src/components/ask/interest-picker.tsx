"use client";

// The form's "Who to ask" chips, which double as the card's category. Suggested
// interests come first (ranked against the ask as it's typed), and "Other" opens
// a box to type your own category, with similar ones offered so "airport pickup"
// can join Rides. Suggestions are only shown; nothing is picked without a tap.
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { ToggleChip } from "@/components/ask/form-bits";
import { Input } from "@/components/ui/input";
import {
  categoryForInterest,
  interestForCategory,
  MAX_CATEGORY_LENGTH,
  normalizeCategory,
} from "@/lib/ask/categories";
import { INTERESTS } from "@/lib/ask/helper-fit";
import type { Interest } from "@/lib/ask/types";
import { suggestCategories } from "@/server/actions/ask";

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

export function InterestPicker({
  interests,
  onToggle,
  custom,
  onCustom,
  askText,
}: {
  interests: Interest[];
  onToggle: (interest: Interest) => void;
  // A category the asker typed under Other; "" = none.
  custom: string;
  onCustom: (category: string) => void;
  askText: string;
}) {
  const [typing, setTyping] = useState(custom !== "");

  const forAsk = useSuggestions(askText, 600)
    .map(interestForCategory)
    .filter((i): i is Interest => Boolean(i));
  const forTyped = useSuggestions(typing ? custom : "", 300);
  const similar = forTyped.filter(
    (s) => s.toLowerCase() !== normalizeCategory(custom).toLowerCase(),
  );

  // Suggested first, then the rest.
  const chips = [...new Set([...forAsk, ...INTERESTS])];

  function pickSimilar(category: string) {
    const interest = interestForCategory(category);
    setTyping(false);
    if (interest) {
      onCustom("");
      if (!interests.includes(interest)) onToggle(interest);
    } else {
      onCustom(category);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Who to ask" className="flex flex-wrap gap-2">
        {chips.map((interest) => (
          <ToggleChip
            key={interest}
            label={categoryForInterest(interest)}
            icon={forAsk.includes(interest) ? <Sparkles className="size-3.5" aria-hidden /> : undefined}
            pressed={interests.includes(interest)}
            onClick={() => onToggle(interest)}
          />
        ))}
        <ToggleChip
          label={!typing && custom ? custom : "Other"}
          pressed={typing || custom !== ""}
          onClick={() => {
            if (typing) {
              setTyping(false);
              onCustom("");
            } else {
              setTyping(true);
            }
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
            value={custom}
            maxLength={MAX_CATEGORY_LENGTH}
            placeholder="Bike repair, haircut, dorm setup..."
            onChange={(e) => onCustom(e.target.value)}
          />
          {similar.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Similar:</span>
              {similar.map((c) => (
                <ToggleChip key={c} label={c} pressed={false} onClick={() => pickSimilar(c)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
