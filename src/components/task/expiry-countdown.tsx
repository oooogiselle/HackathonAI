"use client";

// "Expires in 18 h 20 min" with a bar that empties as the ask's time runs out.
import { useEffect, useState } from "react";

import { whenLabel } from "@/lib/ask/card-format";

const MINUTE = 60_000;

function left(ms: number) {
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / MINUTE);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h} h ${mins % 60} min` : `${mins} min`;
}

export function ExpiryCountdown({
  createdAt,
  expiresAt,
}: {
  createdAt: number;
  expiresAt: number;
}) {
  // null until mounted, so the server and browser render the same thing.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const total = Math.max(expiresAt - createdAt, 1);
  const remaining = now === null ? total : Math.max(expiresAt - now, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">Expires in</span>
        <span className="text-xl font-extrabold tabular-nums">
          {now === null ? "…" : left(remaining)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Time left"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((remaining / total) * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(remaining / total) * 100}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground">Comes down {whenLabel(expiresAt)}</span>
    </div>
  );
}
