import { ViewTransition } from "react";

import { cn } from "cn";

// Wraps one screen so route changes animate instead of cutting. Used from
// template.tsx files: a template remounts on every navigation, so its
// enter/exit fire (a layout persists, so it never would). The ask flow slides
// (forward = new screen from the right, back = from the left); everything else
// crossfades. `update: none` keeps in-page changes (router.refresh, a form
// state change) from animating. Reduced motion is handled in globals.css.
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "vt-in-fwd", "nav-back": "vt-in-back", default: "vt-fade-in" }}
      exit={{ "nav-forward": "vt-out-fwd", "nav-back": "vt-out-back", default: "vt-fade-out" }}
      update="none"
      share="none"
    >
      <div className={cn("flex w-full flex-1 flex-col", className)}>{children}</div>
    </ViewTransition>
  );
}
