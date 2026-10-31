"use client";

import { cn } from "cn";

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value?: string;
  onChange: (option: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "min-h-11 rounded-full border px-4 py-2 text-sm transition-colors",
            value === option
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
