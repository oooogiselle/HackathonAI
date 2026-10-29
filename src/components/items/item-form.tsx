// EXAMPLE (items): form wired to a server action with useActionState + toast.
"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createItem, type ItemFormState } from "@/server/actions/items";

export function ItemForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(createItem, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success("Item created");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <Input name="title" placeholder="Title" required maxLength={200} />
      <Textarea name="description" placeholder="Description (optional)" rows={3} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create item"}
      </Button>
    </form>
  );
}
