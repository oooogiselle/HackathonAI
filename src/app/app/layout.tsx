import { redirect } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { getUser } from "@/lib/supabase/server";

// Dashboard shell for everything under /app. The proxy already redirects
// signed-out users; this check is a second line of defense.
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header email={user.email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
