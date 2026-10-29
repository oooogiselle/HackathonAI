// EXAMPLE (items): server actions pattern — auth check → validate → write →
// revalidate. Copy for your own resources, then rename or delete.
//
// NOTE: Drizzle connects as the `postgres` role, which bypasses Supabase RLS.
// Authorization is therefore *our* job: always scope queries by user id.
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { items } from "@/db/schema";
import { getUser } from "@/lib/supabase/server";

export type ItemFormState = { error?: string; success?: boolean };

const createItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
});

export async function createItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const user = await getUser();
  if (!user) return { error: "Not signed in." };

  const parsed = createItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await db.insert(items).values({ ...parsed.data, userId: user.id });

  revalidatePath("/app/items");
  return { success: true };
}

export async function deleteItem(id: string) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in.");

  // The userId condition stops users from deleting each other's items.
  await db.delete(items).where(and(eq(items.id, id), eq(items.userId, user.id)));

  revalidatePath("/app/items");
}
