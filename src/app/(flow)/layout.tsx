import { AskFlowProvider } from "@/components/ask/flow-provider";

// Mobile-first shell for the Ask flow (steps 1–7).
export default function FlowLayout({ children }: LayoutProps<"/">) {
  return (
    <AskFlowProvider>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </AskFlowProvider>
  );
}
