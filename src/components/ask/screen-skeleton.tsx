import { ViewTransition } from "react";

import { cn } from "cn";

import { TabBar } from "./tab-bar";

type Tab = React.ComponentProps<typeof TabBar>["active"];

// What a tab screen looks like while its data loads: the header, a few card
// shapes, and the tab bar in place (so it doesn't blink). Shown by loading.tsx
// the moment a tab or card is tapped; it fades out when the real screen arrives.
export function ScreenSkeleton({
  tab,
  cards = 3,
  grid = false,
}: {
  tab?: Tab;
  cards?: number;
  grid?: boolean;
}) {
  return (
    <ViewTransition exit="vt-fade-out" default="none">
      <div role="status" aria-label="Loading" className="flex flex-1 flex-col gap-6">
        <div className={cn("flex flex-col gap-2 pt-2", tab && "md:mt-16")}>
          <Bone className="h-6 w-28 md:hidden" />
          <Bone className="h-9 w-48" />
        </div>
        <div className={cn("flex flex-col gap-4", grid && "md:grid md:grid-cols-2 lg:grid-cols-3")}>
          {Array.from({ length: cards }, (_, i) => (
            <Bone key={i} className="h-40 rounded-[24px]" />
          ))}
        </div>
        {tab && <TabBar active={tab} />}
      </div>
    </ViewTransition>
  );
}

function Bone({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-muted motion-reduce:animate-none", className)}
    />
  );
}
