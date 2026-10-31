"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { BottomActions } from "@/components/task/task-parts";
import { Button } from "@/components/ui/button";
import { payToHold } from "@/server/actions/board";

export function PayButton({ token, total }: { token: string; total: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      const result = await payToHold(token, "card");
      if ("error" in result) return void toast.error(result.error);
      toast.success("Payment held");
      router.replace(`/h/${token}`);
    });
  }

  return (
    <BottomActions>
      <Button size="lg" className="h-12 text-base" disabled={pending} onClick={pay}>
        {pending ? "Holding…" : `Pay ${total} and hold`}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Demo: no real payment is made. We never store your card.
      </p>
    </BottomActions>
  );
}
