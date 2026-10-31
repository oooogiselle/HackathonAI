"use client";

// Small form pieces shared by Your ask (/draft) and the Home form (/).
import { X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "cn";

export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function RemovableChip({
  label,
  onRemove,
  strong,
}: {
  label: string;
  onRemove: () => void;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm",
        strong ? "border-primary/40 bg-primary/10" : "border-border",
      )}
    >
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

export function ToggleChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-[10px] border px-3 py-1.5 text-sm font-semibold",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
