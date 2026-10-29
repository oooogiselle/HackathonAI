import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/app/items">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>Example CRUD with server actions.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/app/chat">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Chat</CardTitle>
              <CardDescription>Streaming AI chat with optional RAG.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
