// EXAMPLE (items): list page. Reads happen directly in the Server Component;
// writes go through server actions in src/server/actions/items.ts.
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ItemForm } from "@/components/items/item-form";
import { ItemList } from "@/components/items/item-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { items } from "@/db/schema";
import { getUser } from "@/lib/supabase/server";

export default async function ItemsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(items)
    .where(eq(items.userId, user.id))
    .orderBy(desc(items.createdAt));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Items</h1>
      <Card>
        <CardHeader>
          <CardTitle>New item</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemForm />
        </CardContent>
      </Card>
      <ItemList items={rows} />
    </div>
  );
}
