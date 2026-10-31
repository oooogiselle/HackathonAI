import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Header for a flow screen: Back (or the DartAsk mark), an optional status
// line ("✓ Everyday ask") and the big title.
export function StepHeader({
  title,
  subtitle,
  eyebrow,
  backHref,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <header className="flex flex-col gap-2 pt-2">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back"
          className="-ml-1 flex size-11 items-center justify-center rounded-full bg-card shadow-sm"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
      )}
      {eyebrow && <div className="text-sm font-bold text-primary">{eyebrow}</div>}
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
