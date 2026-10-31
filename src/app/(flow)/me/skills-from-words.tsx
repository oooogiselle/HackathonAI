"use client";

// "Or say it in your own words": the helper writes what they could help with,
// AI suggests interest chips and specific tags, and each one is added only on a tap.
import { Plus, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ToggleChip } from "@/components/ask/form-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTEREST_LABELS, type SkillSuggestion } from "@/lib/ask/helper-fit";
import type { Interest } from "@/lib/ask/types";
import { suggestMySkills } from "@/server/actions/session";

export function SkillsFromWords({
  interests,
  tags,
  onAdd,
}: {
  interests: Interest[];
  tags: string[];
  onAdd: (add: SkillSuggestion) => void;
}) {
  const [words, setWords] = useState("");
  const [suggestion, setSuggestion] = useState<SkillSuggestion>();
  const [reading, startReading] = useTransition();

  // Only what isn't on the profile yet; added chips drop out of the list.
  const newInterests = suggestion?.interests.filter((i) => !interests.includes(i)) ?? [];
  const newTags = suggestion?.tags.filter((t) => !tags.includes(t)) ?? [];

  function suggest() {
    startReading(async () => {
      const result = await suggestMySkills(words);
      if ("error" in result) return void toast.error(result.error);
      setSuggestion({ interests: result.interests, tags: result.tags });
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3">
      <Label htmlFor="me-words" className="text-[13px] font-semibold text-muted-foreground">
        Or say it in your own words
      </Label>
      <Textarea
        id="me-words"
        rows={2}
        maxLength={500}
        value={words}
        placeholder="I have a car, I make great dumplings, and I went through OPT last summer."
        onChange={(e) => setWords(e.target.value)}
        className="bg-card"
      />
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={reading || words.trim().length < 3}
        onClick={suggest}
      >
        <Sparkles aria-hidden className="size-4" />
        {reading ? "Reading..." : "Turn into chips"}
      </Button>

      {suggestion &&
        (newInterests.length + newTags.length > 0 ? (
          <div role="status" className="flex flex-col gap-2 pt-1">
            <span className="text-sm font-semibold">From what you wrote</span>
            <div className="flex flex-wrap gap-2">
              {newInterests.map((i) => (
                <ToggleChip
                  key={i}
                  label={INTEREST_LABELS[i]}
                  icon={<Plus aria-hidden className="size-3.5" />}
                  pressed={false}
                  onClick={() => onAdd({ interests: [i], tags: [] })}
                />
              ))}
              {newTags.map((t) => (
                <ToggleChip
                  key={t}
                  label={t}
                  icon={<Plus aria-hidden className="size-3.5" />}
                  pressed={false}
                  onClick={() => onAdd({ interests: [], tags: [t] })}
                />
              ))}
            </div>
            <Button
              variant="link"
              className="self-start px-0"
              onClick={() => onAdd({ interests: newInterests, tags: newTags })}
            >
              Add all
            </Button>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {suggestion.interests.length + suggestion.tags.length > 0
              ? "All added."
              : "Nothing to add yet. Try naming what you'd do, like \u201cairport rides\u201d."}
          </p>
        ))}
    </div>
  );
}
