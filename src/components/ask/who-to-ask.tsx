"use client";

// "Who to ask" for one ask: the AI's one-line why, must-have and nice-to-have
// chips, and how many seeded helpers fit. The form also lets the student pick
// interests themselves.
import { countFits, INTEREST_LABELS, INTERESTS } from "@/lib/ask/helper-fit";
import type { HelperPrefs, Interest } from "@/lib/ask/types";

import { RemovableChip, ToggleChip } from "./form-bits";

export function WhoToAsk({
  helper,
  onChange,
  pickInterests,
}: {
  helper: HelperPrefs;
  onChange: (helper: HelperPrefs) => void;
  pickInterests?: boolean;
}) {
  function set(interests: Interest[], needs: string[], nice = helper.nice) {
    onChange({ ...helper, interests, needs, nice, ...countFits(interests, needs) });
  }

  function toggleInterest(interest: Interest) {
    const interests = helper.interests.includes(interest)
      ? helper.interests.filter((i) => i !== interest)
      : [...helper.interests, interest];
    set(interests, helper.needs);
  }

  const { fits } = helper;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Who to ask</h3>
      {helper.why && <p className="text-sm text-muted-foreground">{helper.why}</p>}
      {pickInterests && (
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <ToggleChip
              key={interest}
              label={INTEREST_LABELS[interest]}
              pressed={helper.interests.includes(interest)}
              onClick={() => toggleInterest(interest)}
            />
          ))}
        </div>
      )}
      {(helper.needs.length > 0 || helper.nice.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {helper.needs.map((need) => (
            <RemovableChip
              key={need}
              label={`Needs: ${need}`}
              onRemove={() =>
                set(
                  helper.interests,
                  helper.needs.filter((n) => n !== need),
                )
              }
              strong
            />
          ))}
          {helper.nice.map((nice) => (
            <RemovableChip
              key={nice}
              label={nice}
              onRemove={() =>
                set(
                  helper.interests,
                  helper.needs,
                  helper.nice.filter((n) => n !== nice),
                )
              }
            />
          ))}
        </div>
      )}
      <p className="text-sm">
        {fits === 0
          ? "No helper fits all of these yet. Try removing a must-have."
          : `${fits} helper${fits === 1 ? "" : "s"} fit`}
      </p>
    </div>
  );
}
