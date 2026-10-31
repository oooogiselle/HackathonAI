"use client";

// How long the ask takes: a few presets. A time from the AI path that isn't
// one of them shows as its own picked chip.
import { ToggleChip } from "@/components/ask/form-bits";

const PRESETS = [15, 30, 60, 120];

export function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function DurationField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (minutes: number) => void;
}) {
  const options = PRESETS.includes(value)
    ? PRESETS
    : [...PRESETS, value].sort((a, b) => a - b);
  return (
    <div id={id} role="group" aria-label="How long it takes" className="flex flex-wrap gap-2">
      {options.map((m) => (
        <ToggleChip
          key={m}
          label={durationLabel(m)}
          pressed={value === m}
          onClick={() => onChange(m)}
        />
      ))}
    </div>
  );
}
