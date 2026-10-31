"use client";

// "Block this person" on a task, for the asker or the helper. Never reveals an
// anonymous asker; unblock from the Me tab.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { blockFromCard } from "@/server/actions/session";

export function BlockButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className="self-center text-xs text-muted-foreground"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Block this person? You won't see each other's asks.")) return;
        start(async () => {
          const result = await blockFromCard(token);
          if ("error" in result) return void toast.error(result.error);
          toast.success("Blocked. Unblock anytime on the Me tab.");
          router.push("/");
        });
      }}
    >
      Block this person
    </Button>
  );
}
