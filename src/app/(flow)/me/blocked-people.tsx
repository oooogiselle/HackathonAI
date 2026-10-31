"use client";

// Blocked people on the Me tab. Labels never reveal an anonymous asker.
// Blocking happens from a task ("Block" on the task page); unblock here.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BlockedEntry } from "@/lib/ask/types";
import { unblockPerson } from "@/server/actions/session";

export function BlockedPeople({ blocked }: { blocked: BlockedEntry[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-card p-4">
      <h2 className="text-[15px] font-bold">Blocked people</h2>
      {blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None. You can block someone from any task you share with them. You won&apos;t see each
          other&apos;s asks.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-background">
          {blocked.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              {b.label}
              <Button
                variant="ghost"
                className="-mr-3 text-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await unblockPerson(b.key);
                    if ("error" in result) return void toast.error(result.error);
                    toast.success("Unblocked");
                    router.refresh();
                  })
                }
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
