import { ScreenSkeleton } from "@/components/ask/screen-skeleton";

export default function TaskLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 md:max-w-2xl md:px-8 md:py-10">
      <ScreenSkeleton cards={2} />
    </main>
  );
}
