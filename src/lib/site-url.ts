// Base URL used for auth redirects. Must match a "Redirect URL" in
// Supabase → Authentication → URL Configuration.
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
