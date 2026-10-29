import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getUser()) redirect("/app");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use a magic link or your Google account.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm initialError={typeof error === "string" ? error : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
