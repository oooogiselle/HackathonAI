import { Skeleton } from "@/components/ui/skeleton";

export function LoadingLines({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="text-sm text-muted-foreground">{label}</span>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-4/5" />
    </div>
  );
}
