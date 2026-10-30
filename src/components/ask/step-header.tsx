import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const TOTAL_STEPS = 7;

export function StepHeader({
  step,
  title,
  subtitle,
  backHref,
}: {
  step: number;
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {backHref ? (
          <Link href={backHref} className="-ml-1 flex items-center gap-0.5 hover:text-foreground">
            <ChevronLeft className="size-4" /> Back
          </Link>
        ) : (
          <span className="font-semibold text-foreground">Ask</span>
        )}
        <span>
          {step} / {TOTAL_STEPS}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
