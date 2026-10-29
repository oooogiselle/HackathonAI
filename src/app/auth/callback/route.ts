// Magic links and Google OAuth both land here with a `code`, which we
// exchange for a session cookie, then send the user into the app.
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Only allow relative redirects.
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/app"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Could not sign in")}`);
}
