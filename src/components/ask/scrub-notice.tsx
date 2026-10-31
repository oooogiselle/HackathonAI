"use client";

// What the privacy check removed, with Undo. Used for asks (/where) and the
// Me page's "A line about you".
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ScrubNotice({
  checking,
  removed,
  undone,
  onToggle,
}: {
  checking?: boolean;
  // undefined = not checked yet.
  removed?: string[];
  undone: boolean;
  onToggle: () => void;
}) {
  if (checking) {
    return <p className="text-sm text-muted-foreground">Checking for identifying details…</p>;
  }
  if (!removed) return null;
  if (removed.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Check className="size-4 text-primary" /> No identifying details found
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-1 rounded-2xl bg-muted p-3 text-sm">
      <p className="font-semibold">
        {undone ? "Kept your original wording:" : "Removed identifying details:"}
      </p>
      <ul className="ml-5 list-disc text-muted-foreground">
        {removed.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Button variant="link" className="self-start px-0" onClick={onToggle}>
        {undone ? "Remove them again" : "Undo"}
      </Button>
    </div>
  );
}
