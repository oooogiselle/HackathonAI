"use client";

// Every tap on a task screen is one server action; the server decides who wins
// and returns the error string to show as-is. While someone is waiting on the
// other person, the page refreshes every few seconds.
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";

import type { Result } from "@/lib/ask/types";

const REFRESH_MS = 3000;

export type Run = (action: () => Promise<Result | Result<object>>, success?: string) => void;

export function useTaskAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run: Run = (action, success) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else if (success) toast.success(success);
      router.refresh();
    });
  };

  return { pending, run };
}

/** Keeps a live task fresh while the other side acts. Renders nothing. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
