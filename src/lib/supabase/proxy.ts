// Session refresh + route protection, called from src/proxy.ts on every request.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths under this prefix require a signed-in user.
const PROTECTED_PREFIX = "/app";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let isSignedIn = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });

    // Don't put code between createServerClient and getClaims — this call
    // refreshes the auth token and writes the updated cookies.
    const { data } = await supabase.auth.getClaims();
    isSignedIn = Boolean(data?.claims);
  }

  const { pathname } = request.nextUrl;
  if (!isSignedIn && pathname.startsWith(PROTECTED_PREFIX)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
