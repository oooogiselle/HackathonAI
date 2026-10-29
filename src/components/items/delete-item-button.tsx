// EXAMPLE (items): calling a server action directly from a button.
"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteItem } from "@/server/actions/items";

export function DeleteItemButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await deleteItem(id);
            toast.success("Item deleted");
          } catch {
            toast.error("Could not delete item");
          }
        })
      }
    >
      Delete
    </Button>
  );
}
