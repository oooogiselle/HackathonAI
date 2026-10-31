"use client";

import { usePathname } from "next/navigation";

import { PageTransition } from "@/components/ask/page-transition";

// Width per screen on tablets and laptops (phones are one column, as before):
// the board and Claimed spread cards over a grid, the inbox is a bit wider for
// its request cards, and the step-by-step screens and forms stay readable.
const WIDTH: Record<string, string> = {
  "/": "",
  "/claimed": "",
  "/inbox": "md:max-w-2xl",
};

export default function FlowTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <PageTransition className={`mx-auto gap-6 ${WIDTH[pathname] ?? "md:max-w-xl"}`}>
      {children}
    </PageTransition>
  );
}
