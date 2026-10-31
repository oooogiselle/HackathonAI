"use client";

// Free times from the asker's calendar on Post a need, and how many helpers
// are free then too. The calendar is connected on Me (a mock tonight, kept in
// this browser). Free/busy only, never event titles.
// TODO(calendar): real Google OAuth + freeBusy API, saved on the profile.
import { CalendarCheck } from "lucide-react";
import { useState } from "react";

import { toLocalInput } from "@/components/ask/time-picker";
import { freeSlots } from "@/lib/ask/free-busy";
import { ASKER_BUSY, HELPERS } from "@/lib/ask/mock-data";
import type { Interest } from "@/lib/ask/types";
import { cn } from "cn";

const STORAGE_KEY = "ask.gcal";

// Remembered per browser; the page works the same without storage. Only call
// it from a component that mounts on the client (the form waits for `ready`).
export function useCalendarConnection() {
  const [connected, setConnected] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  function set(next: boolean) {
    setConnected(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  return { connected, busy: connected ? ASKER_BUSY : undefined, setConnected: set };
}

function slotDay(at: Date) {
  const today = new Date();
  const diff = Math.round(
    (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return at.toLocaleDateString("en-US", { weekday: "long" });
}

const slotTime = (at: Date) =>
  at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();

export function CalendarSlots({
  connected,
  onConnectInMe,
  minutes,
  interests,
  value,
  onPick,
}: {
  connected: boolean;
  // Saves the draft and opens Me, where the calendar is connected.
  onConnectInMe: () => void;
  minutes: number;
  // Who to ask; helpers free are counted among these (everyone if none).
  interests: Interest[];
  value: string;
  onPick: (value: string) => void;
}) {
  if (!connected) {
    return (
      <button
        type="button"
        onClick={onConnectInMe}
        className="flex items-center gap-3 rounded-2xl border border-dashed border-brand-light/60 bg-card px-4 py-3 text-left hover:bg-pay/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CalendarCheck className="size-5 shrink-0 text-brand-light" />
        <span className="flex flex-col">
          <span className="text-sm font-semibold">See when you&apos;re free</span>
          <span className="text-xs text-muted-foreground">
            Connect Google Calendar in Me. Your draft is saved.
          </span>
        </span>
      </button>
    );
  }

  const helpers = interests.length
    ? HELPERS.filter((h) => h.interests.some((i) => interests.includes(i)))
    : HELPERS;
  const slots = freeSlots({ busy: ASKER_BUSY, minutes, helpers });
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted-foreground">
        You&apos;re free, and so are helpers
      </span>
      {slots.length ? (
        <div
          role="radiogroup"
          aria-label="Free times from your calendar"
          className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          {slots.map(({ at, helpersFree }) => {
            const local = toLocalInput(at);
            const selected = local === value;
            return (
              <button
                key={local}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPick(local)}
                className={cn(
                  "flex shrink-0 snap-start flex-col items-start rounded-2xl px-3.5 py-2.5 text-left",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-pay text-ink hover:bg-pay/70",
                )}
              >
                <span className="text-xs font-medium opacity-80">{slotDay(at)}</span>
                <span className="text-base font-bold">{slotTime(at)}</span>
                <span className="text-xs opacity-80">
                  {helpersFree} {helpersFree === 1 ? "helper" : "helpers"} free
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No free time in the next 3 days for an ask this long. Pick a time below.
        </p>
      )}
    </div>
  );
}
