import { AskFlowProvider } from "@/components/ask/flow-provider";

// Mobile-first shell for the Ask flow (steps 1–7). In the wide layout
// (src/lib/ask/layout.ts) it grows and template.tsx sets each screen's width;
// template.tsx also animates the move between screens.
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return (
    <AskFlowProvider>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 wide:max-w-3xl wide:px-8 wide:py-10 wide-lg:max-w-5xl">
        {children}
      </main>
    </AskFlowProvider>
  );
}
