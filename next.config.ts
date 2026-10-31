import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Playwright run use its own build folder next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PGlite (the local Ask database) ships WASM + data files; load it from
  // node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read at runtime when the local database starts.
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
  // cacheComponents is intentionally off: pages can read the Supabase session
  // anywhere without extra <Suspense> boundaries. Opt in later if you want it.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
