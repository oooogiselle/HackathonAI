import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
