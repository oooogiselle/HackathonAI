import type { HelperSuggestion } from "@/lib/ask/types";

export function HelperCard({ suggestion }: { suggestion: HelperSuggestion }) {
  const { helper, why } = suggestion;
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold">
        {helper.firstName[0]}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">
          {helper.firstName}{" "}
          <span className="font-normal text-muted-foreground">· {helper.year}</span>
        </span>
        <span className="text-sm text-muted-foreground">{why}</span>
      </div>
    </div>
  );
}
