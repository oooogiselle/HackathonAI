// EXAMPLE (items): server-rendered list.
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Item } from "@/db/schema";

import { DeleteItemButton } from "./delete-item-button";

export function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No items yet. Create one above.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              {item.description && <CardDescription>{item.description}</CardDescription>}
              <CardAction>
                <DeleteItemButton id={item.id} />
              </CardAction>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
