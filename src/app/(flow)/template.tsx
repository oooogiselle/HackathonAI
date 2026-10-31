"use client";

import { usePathname } from "next/navigation";

import { PageTransition } from "@/components/ask/page-transition";

// Width per screen in the wide layout (src/lib/ask/layout.ts; off by default,
// so every screen is the phone column):
// the board and Claimed spread cards over a grid, the inbox is a bit wider for
// its request cards, and the step-by-step screens and forms stay readable.
const WIDTH: Record<string, string> = {
  "/": "",
  "/claimed": "",
  "/inbox": "wide:max-w-2xl",
};

export default function FlowTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <PageTransition className={`mx-auto gap-6 ${WIDTH[pathname] ?? "wide:max-w-xl"}`}>
      {children}
    </PageTransition>
  );
}
