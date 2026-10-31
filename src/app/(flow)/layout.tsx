import { AskFlowProvider } from "@/components/ask/flow-provider";

// Mobile-first shell for the Ask flow (steps 1–7). On wider screens it grows;
// template.tsx sets each screen's width and animates the move between screens.
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return (
    <AskFlowProvider>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 md:max-w-3xl md:px-8 md:py-10 lg:max-w-5xl">
        {children}
      </main>
    </AskFlowProvider>
  );
}
