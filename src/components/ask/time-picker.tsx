"use client";

// One native date-and-time picker (a wheel on phones). The value is a local
// "YYYY-MM-DDTHH:mm" string.
import { Input } from "@/components/ui/input";
import { isBusyAt } from "@/lib/ask/free-busy";
import type { BusySlot } from "@/lib/ask/types";

const DAYS = 7;

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// A default "any time before": tomorrow evening.
export function tomorrowEvening() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 21, 0);
}

export function TimePicker({
  id,
  value,
  onChange,
  busy,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // The asker's free/busy, once their calendar is connected.
  busy?: BusySlot[];
  label: string;
}) {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS, 23, 59);
  const picked = value ? new Date(value) : undefined;
  const past = picked ? picked <= now : false;
  const busyThen = picked && busy && !past ? isBusyAt(busy, picked, 1) : false;

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        type="datetime-local"
        aria-label={label}
        value={value}
        min={toLocalInput(now)}
        max={toLocalInput(last)}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
      {past && <span className="text-xs text-destructive">That time has passed.</span>}
      {busyThen && (
        <span className="text-xs text-muted-foreground">Your calendar shows you busy then.</span>
      )}
    </div>
  );
}
